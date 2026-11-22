// IA y agentes: Markdown propio (bloques, en línea, enlaces seguros, nunca marcado), texto en streaming, estados de la
// respuesta y de las herramientas, árbol de ramas, uso de contexto; los árboles de las piezas; y la lógica de ChatLayout.
import "./helpers/dom.mjs";
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import fc from "fast-check";
import { markdownText, markdownTree, parseInline, parseMarkdown } from "../../zui/src/core/markdown-lite.ts";
import { createTextStream, firstSentence, provisional } from "../../zui/src/core/stream-text.ts";
import {
  canRespond,
  canTool,
  durationText,
  isBusy,
  isFinalTool,
  planProgress,
  responseAnnouncement,
  toolAnnouncement,
} from "../../zui/src/core/agent-state.ts";
import { activePath, addBranch, branchInfo, childrenOf, selectBranch, siblings, stepBranch } from "../../zui/src/core/branches.ts";
import { compactTokens, formatCost, percentText, usageLevel, usageRatio } from "../../zui/src/core/usage.ts";
import {
  agentPlanWidget,
  agentStatusNode,
  AI_LABELS,
  approvalCardWidget,
  artifactWidget,
  assistantMessageWidget,
  branchNode,
  branchPickerWidget,
  citationNode,
  markdownWidget,
  reasoningNode,
  sourcesNode,
  suggestionsWidget,
  toolCallNode,
  toolCallWidget,
  usageMeterNode,
} from "../../zui/src/core/ai-widgets.ts";
import { toHTML } from "../../zui/src/core/vnode.ts";
import { backView, chatColumns, historyStep, isChatView, nextPane, viewDepth, visiblePanes } from "../../zout/src/chat-layout.ts";

const md = (s: string) => toHTML(markdownTree(s));
const html = <P, C, S>(
  w: { configure(p: P): C; initial(c: C): S; tree(c: C, s: S, uid: string): unknown },
  props: P,
  patch: Partial<S> = {},
) => {
  const c = w.configure(props);
  return toHTML(w.tree(c, { ...w.initial(c), ...patch }, "t") as never);
};

describe("Markdown propio", () => {
  test("bloques: párrafos, encabezados desde h3, listas anidadas, tareas, citas, código, tabla y regla", () => {
    const out = md(
      [
        "# Title",
        "",
        "Para one",
        "line two",
        "",
        "- a",
        "  - nested",
        "- [x] done",
        "",
        "3. three",
        "4. four",
        "",
        "> quoted *text*",
        "",
        "```js",
        "const x = 1 < 2;",
        "```",
        "",
        "| A | B |",
        "|:--|--:|",
        "| 1 | 2 |",
        "",
        "---",
      ].join("\n"),
    );
    assert.match(out, /^<div class="z-markdown"><h3>Title<\/h3><p>Para one<br>line two<\/p>/);
    assert.match(
      out,
      /<ul><li>a<ul><li>nested<\/li><\/ul><\/li><li data-task><input type="checkbox" disabled checked class="z-markdown__task">done<\/li><\/ul>/,
    );
    assert.match(out, /<ol start="3"><li>three<\/li><li>four<\/li><\/ol>/);
    assert.match(out, /<blockquote><p>quoted <em>text<\/em><\/p><\/blockquote>/);
    assert.match(out, /<pre><code data-lang="js">const x = 1 &lt; 2;<\/code><\/pre>/);
    assert.match(out, /<th data-align="left">A<\/th><th data-align="right">B<\/th>/);
    assert.match(out, /<hr><\/div>$/);
  });
  test("en línea: énfasis, código, tachado, enlaces, citas y escapes", () => {
    assert.equal(
      md("**b** _i_ *j* ~~s~~ `c`"),
      '<div class="z-markdown"><p><strong>b</strong> <em>i</em> <em>j</em> <del>s</del> <code>c</code></p></div>',
    );
    assert.equal(md("snake_case_name and 2*3*4"), '<div class="z-markdown"><p>snake_case_name and 2<em>3</em>4</p></div>');
    assert.match(
      md('[docs](https://a.example/x "t") and https://b.example'),
      /<a href="https:\/\/a.example\/x" target="_blank" rel="noopener noreferrer nofollow">docs<\/a> and <a href="https:\/\/b.example\/"/,
    );
    assert.match(md("see [1] and [2](https://x.example)"), /<sup class="z-markdown__cite">\[1\]<\/sup>/);
    assert.equal(md("\\*not\\* \\[x\\]"), '<div class="z-markdown"><p>*not* [x]</p></div>');
    assert.equal(md("`` a ` b ``"), '<div class="z-markdown"><p><code>a ` b</code></p></div>');
    assert.equal(md("unclosed **bold and `tick"), '<div class="z-markdown"><p>unclosed **bold and `tick</p></div>');
  });
  test("seguridad: sin marcado, sin destinos peligrosos, imágenes como enlace", () => {
    const out = md(
      "<script>alert(1)</script> [x](javascript:alert(1)) [y](data:text/html,1) ![img](https://t.example/p.png) <img src=x onerror=1>",
    );
    assert.doesNotMatch(out, /<script|<img|href="javascript|href="data/);
    assert.match(out, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
    assert.match(out, /<em>x<\/em>/, "un enlace inseguro queda como texto");
    assert.match(out, /<a href="https:\/\/t.example\/p.png"[^>]*>img<\/a>/);
  });
  test("texto plano y opciones del árbol", () => {
    const blocks = parseMarkdown("# H\n\n- a\n- b\n\n```\ncode\n```\n\n| x |\n|---|\n| 1 |\n\n> q\n\n---\n\nsee [1]");
    assert.equal(markdownText(blocks), "H\n\n- a\n\n- b\n\ncode\n\nx\n\n1\n\nq\n\nsee [1]");
    const tree = toHTML(
      markdownTree("```py\nx\n```\n\n[2]", {
        code: (code, lang) => ({ t: "div", a: { class: "custom", "data-lang": lang }, c: [code] }),
        cite: (n) => `(${n})`,
        headingBase: 1,
      }),
    );
    assert.equal(tree, '<div class="z-markdown"><div class="custom" data-lang="py">x</div><p>(2)</p></div>');
    assert.deepEqual(parseInline(""), []);
  });
  test("propiedad: nunca lanza, nunca emite etiquetas fuera de las permitidas y todo href es http(s) o mailto", () => {
    const ALLOWED = new Set([
      "div",
      "p",
      "h3",
      "h4",
      "h5",
      "h6",
      "ul",
      "ol",
      "li",
      "blockquote",
      "pre",
      "code",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
      "hr",
      "br",
      "strong",
      "em",
      "del",
      "a",
      "sup",
      "input",
    ]);
    const piece = fc.oneof(
      fc.string(),
      fc.constantFrom(
        "**",
        "*",
        "_",
        "~~",
        "`",
        "```",
        "\n",
        "\n\n",
        "# ",
        "- ",
        "1. ",
        "> ",
        "| a |",
        "|---|",
        "[x](",
        ")",
        "](javascript:x)",
        "<b>",
        "https://a.example",
        "[1]",
      ),
    );
    fc.assert(
      fc.property(fc.array(piece, { maxLength: 30 }), (parts) => {
        const out = md(parts.join(""));
        for (const tag of out.matchAll(/<([a-z0-9]+)[\s>]/g)) assert.ok(ALLOWED.has(tag[1]!), tag[1]);
        for (const href of out.matchAll(/href="([^"]*)"/g)) assert.match(href[1]!, /^(https?:|mailto:)/);
      }),
    );
  });
  test("propiedad: un texto sin marcas es un solo párrafo con el mismo texto", () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-zA-Z0-9 ,]{1,60}$/).filter((s) => s.trim().length > 0 && !/^\d+[.)] /.test(s.trim()) && !/^\s{4}/.test(s)),
        (s) => markdownText(s) === s.trim(),
      ),
    );
  });
});

describe("texto en streaming", () => {
  test("no parte un par sustituto", () => {
    const stream = createTextStream("A");
    const emoji = String.fromCodePoint(0x1f44d);
    stream.push(emoji[0]!);
    assert.equal(stream.text(), "A");
    stream.push(`${emoji[1]}!`);
    assert.equal(stream.text(), `A${emoji}!`);
    stream.push("");
    stream.push("x\ud83d");
    assert.equal(stream.end(), `A${emoji}!x\ud83d`);
    stream.reset("z");
    assert.equal(stream.text(), "z");
  });
  test("cierres provisionales", () => {
    assert.equal(provisional("```js\nconst a"), "```js\nconst a\n```");
    assert.equal(provisional("~~~\nx\n"), "~~~\nx\n~~~");
    assert.equal(provisional("```\nx\n```\nok"), "```\nx\n```\nok");
    assert.equal(provisional("old **bold\n\nnew **bo"), "old **bold\n\nnew **bo**");
    assert.equal(provisional("a `co"), "a `co`");
    assert.equal(provisional("a ~~st"), "a ~~st~~");
    assert.equal(provisional("done."), "done.");
  });
  test("propiedad: lo provisional empieza por lo recibido y lo recibido por trozos es la concatenación", () => {
    fc.assert(
      fc.property(fc.array(fc.string({ unit: "grapheme" }), { maxLength: 20 }), (chunks) => {
        const stream = createTextStream();
        for (const c of chunks) stream.push(c);
        const all = chunks.join("");
        return stream.end() === all && provisional(all).startsWith(all);
      }),
    );
  });
  test("primera frase para un resumen", () => {
    assert.equal(firstSentence("**Sure.** Here is more"), "Sure.");
    assert.equal(firstSentence("```js\ncode\n```\nThen [link](https://x) works! More"), "Then link works!");
    assert.equal(firstSentence("x".repeat(200), 20).length, 20);
  });
});

describe("estados de agente", () => {
  test("transiciones y anuncios", () => {
    assert.equal(canRespond("streaming", "done"), true);
    assert.equal(canRespond("done", "streaming"), false);
    assert.equal(canTool("running", "success"), true);
    assert.equal(canTool("success", "running"), false);
    assert.equal(isFinalTool("cancelled"), true);
    assert.equal(isBusy("submitted"), true);
    assert.equal(responseAnnouncement("streaming", "done"), "Response complete");
    assert.equal(responseAnnouncement("streaming", "done", undefined, "Sure."), "Response complete. Sure.");
    assert.equal(responseAnnouncement("submitted", "streaming"), "");
    assert.equal(responseAnnouncement("streaming", "stopped"), "Response stopped");
    assert.equal(responseAnnouncement("streaming", "error"), "Response failed");
    assert.equal(responseAnnouncement("done", "done"), "");
    assert.equal(responseAnnouncement("done", "error"), "", "solo desde una respuesta en curso");
    assert.equal(toolAnnouncement("running", "awaiting-approval", "deploy"), "deploy needs your approval");
    assert.equal(toolAnnouncement("running", "error", "deploy"), "deploy failed");
    assert.equal(toolAnnouncement("pending", "running", "deploy"), "");
    assert.equal(toolAnnouncement("error", "error", "deploy"), "");
  });
  test("duración y progreso del plan", () => {
    assert.equal(durationText(400, "en"), "0.4s");
    assert.equal(durationText(12_300, "en"), "12s");
    assert.equal(durationText(125_000, "en"), "2m 5s");
    assert.equal(durationText(120_000, "en"), "2m");
    assert.equal(durationText(3_780_000, "en"), "1h 3m");
    assert.equal(durationText(3_600_000, "en"), "1h");
    assert.ok(durationText(1000, "zz-!-bad"));
    const p = planProgress([
      { id: "1", title: "a", status: "done" },
      {
        id: "2",
        title: "b",
        status: "running",
        children: [
          { id: "2.1", title: "c", status: "skipped" },
          { id: "2.2", title: "d", status: "failed" },
        ],
      },
      { id: "3", title: "e", status: "pending" },
    ]);
    assert.deepEqual(
      { done: p.done, total: p.total, failed: p.failed, current: p.current?.id },
      { done: 2, total: 4, failed: 1, current: "2" },
    );
  });
});

describe("ramas", () => {
  const nodes = [
    { id: "u1", parentId: null },
    { id: "a1", parentId: "u1" },
    { id: "a2", parentId: "u1" },
    { id: "u2", parentId: "a1" },
    { id: "u2b", parentId: "a1" },
    { id: "a3", parentId: "u2" },
  ];
  test("camino activo por defecto (el más reciente) y elegido", () => {
    assert.deepEqual(
      activePath(nodes).map((n) => n.id),
      ["u1", "a2"],
    );
    const sel = selectBranch(nodes, {}, "a1");
    assert.deepEqual(
      activePath(nodes, sel).map((n) => n.id),
      ["u1", "a1", "u2b"],
    );
    assert.deepEqual(
      activePath(nodes, selectBranch(nodes, sel, "u2")).map((n) => n.id),
      ["u1", "a1", "u2", "a3"],
    );
    assert.deepEqual(selectBranch(nodes, sel, "missing"), sel);
  });
  test("hermanos, paso y alta", () => {
    assert.deepEqual(siblings(nodes, "a2"), { list: [nodes[1], nodes[2]], index: 1 });
    assert.deepEqual(siblings(nodes, "zz"), { list: [], index: -1 });
    assert.deepEqual(branchInfo(nodes, "a2"), { index: 2, count: 2 });
    assert.equal(branchInfo(nodes, "a3"), null);
    assert.deepEqual(stepBranch(nodes, {}, "a2", -1), { u1: "a1" });
    assert.deepEqual(stepBranch(nodes, {}, "a1", -1), { u1: "a1" }, "sin dar la vuelta");
    assert.deepEqual(stepBranch(nodes, { x: "y" }, "zz", 1), { x: "y" });
    const added = addBranch(nodes, {}, { id: "a4", parentId: "u1" });
    assert.equal(childrenOf(added.nodes, "u1").length, 3);
    assert.deepEqual(
      activePath(added.nodes, added.selection).map((n) => n.id),
      ["u1", "a4"],
    );
  });
  test("un ciclo en los datos no cuelga", () => {
    assert.deepEqual(
      activePath([
        { id: "a", parentId: null },
        { id: "b", parentId: "a" },
        { id: "a", parentId: "b" },
      ]).map((n) => n.id).length <= 3,
      true,
    );
  });
  test("propiedad: el camino activo es una cadena padre → hijo desde la raíz", () => {
    fc.assert(
      fc.property(fc.array(fc.nat(), { maxLength: 30 }), fc.array(fc.nat(), { maxLength: 10 }), (parents, picks) => {
        const ns = parents.map((p, i) => ({ id: `n${i}`, parentId: i === 0 || p % (i + 1) === i ? null : `n${p % i}` }));
        let sel = {};
        for (const k of picks) if (ns.length) sel = selectBranch(ns, sel, `n${k % ns.length}`);
        const path = activePath(ns, sel);
        for (const [i, n] of path.entries()) assert.equal(n.parentId, i === 0 ? null : path[i - 1]!.id);
        if (path.length) assert.equal(childrenOf(ns, path[path.length - 1]!.id).length, 0, "acaba en una hoja");
      }),
    );
  });
});

describe("uso de contexto", () => {
  test("proporción, nivel, tokens, coste y porcentaje", () => {
    assert.equal(usageRatio(50, 200), 0.25);
    assert.equal(usageRatio(500, 200), 1);
    assert.equal(usageRatio(5, 0), 0);
    assert.equal(usageLevel(0.79), "ok");
    assert.equal(usageLevel(0.8), "warning");
    assert.equal(usageLevel(0.96), "danger");
    assert.equal(compactTokens(980, "en"), "980");
    assert.equal(compactTokens(12_400, "en"), "12.4K");
    assert.equal(compactTokens(1_200_000, "en"), "1M");
    assert.equal(formatCost(0.84, "USD", "en"), "$0.84");
    assert.equal(formatCost(0.0042, "USD", "en"), "$0.0042");
    assert.equal(percentText(0.76, "en"), "76%");
    assert.ok(compactTokens(5, "zz-!-bad"));
  });
});

describe("árboles de IA", () => {
  const L = AI_LABELS;
  test("mensaje en streaming: aria-busy, cursor dentro del último bloque y sin acciones", () => {
    const out = html(assistantMessageWidget, { state: "streaming", parts: [{ type: "text", text: "Hello **wor" }] });
    assert.match(out, /role="article" data-state="streaming" aria-busy="true"/);
    assert.match(out, /<p>Hello <strong>wor<\/strong><span class="z-caret" aria-hidden="true"><\/span><\/p>/);
    assert.doesNotMatch(out, /z-assistant-message__actions/);
    const waiting = html(assistantMessageWidget, { state: "submitted", parts: [] });
    assert.match(waiting, /z-assistant-message__waiting.*Thinking…/);
  });
  test("mensaje terminado: código con CodeViewer, citas enlazadas, acciones y ramas", () => {
    const out = html(assistantMessageWidget, {
      branch: { index: 2, count: 3 },
      feedback: "up",
      parts: [
        { type: "text", text: "See [1].\n\n```ts\nconst a = 1;\n```" },
        {
          type: "sources",
          items: [
            { title: "Docs", url: "https://docs.example/a" },
            { title: "Bad", url: "javascript:x" },
          ],
        },
        { type: "artifact", id: "ar", title: "Card", kind: "HTML" },
      ],
    });
    assert.match(out, /<a class="z-citation" href="https:\/\/docs.example\/a"[^>]*aria-label="Source 1: Docs"/);
    assert.match(out, /class="z-code-viewer"[^>]*data-language="ts"/);
    assert.match(out, /data-block="b1"/);
    assert.match(out, /aria-label="1 sources"/, "la fuente insegura no cuenta");
    assert.match(out, /role="toolbar" aria-label="Response actions"/);
    assert.match(out, /data-action="good" aria-label="Good response" title="Good response" aria-pressed="true"/);
    assert.match(out, /role="group" aria-label="Version 2 of 3"/);
    assert.match(out, /z-artifact-card" data-artifact="ar"/);
    assert.match(html(assistantMessageWidget, { state: "error", parts: [] }), /Something went wrong\.[\s\S]*Retry/);
    assert.match(html(assistantMessageWidget, { state: "stopped", parts: [] }), /Stopped/);
  });
  test("razonamiento, herramienta, aprobación y fuentes", () => {
    assert.match(toHTML(reasoningNode({ state: "thinking" }, L)), /data-state="thinking".*data-effect="shimmer"/);
    assert.match(
      toHTML(reasoningNode({ state: "done", startedAt: 0, endedAt: 12_000, text: "x" }, L, { locale: "en" })),
      /Thought for 12s/,
    );
    assert.match(toHTML(reasoningNode({ state: "done" }, L)), /Reasoning/);
    const tool = toHTML(toolCallNode({ id: "t", name: "deploy", status: "awaiting-approval", input: { a: 1 }, error: "boom" }, L));
    assert.match(tool, /aria-label="deploy, Awaiting approval"/);
    assert.match(tool, /<details class="z-tool-call__details" open>/);
    assert.match(tool, /z-tool-call__approve/);
    assert.match(tool, /<span class="z-tok" data-tok="string">"a"<\/span>|"a"/);
    assert.match(toHTML(toolCallNode({ name: "x", status: "running", output: "plain" }, L)), /Running/);
    const high = html(
      approvalCardWidget,
      { id: "d", title: "Deploy", risk: "high", details: [{ label: "Env", value: "prod" }], allowAlways: true },
      { confirming: { d: true } },
    );
    assert.match(high, /role="region" aria-labelledby="t-approval-d"/);
    assert.match(high, /Risk: High/);
    assert.match(high, /z-btn--danger z-approval__approve" data-size="sm" data-confirming>Confirm approval/);
    assert.match(high, /z-approval__cancel/);
    assert.match(html(approvalCardWidget, { id: "d", title: "Deploy", decision: "approved" }), /data-decision="approved">.*Approved/);
    assert.equal(sourcesNode([{ title: "x", url: "ftp://x" }], L), null);
    assert.match(
      toHTML(sourcesNode([{ title: "Docs", url: "https://www.docs.example/a", snippet: "s" }], L, { open: true })),
      /<span class="z-sr-only">Source 1: <\/span>.*docs.example/,
    );
    assert.match(toHTML(citationNode(3, undefined, L) as never), /\[3\]/);
  });
  test("plan, sugerencias, estado, uso, ramas y artefacto", () => {
    const plan = html(agentPlanWidget, {
      title: "Ship",
      collapsible: true,
      steps: [
        { id: "1", title: "A", status: "done" },
        { id: "2", title: "B", status: "running" },
      ],
    });
    assert.match(plan, /<progress class="z-agent-plan__progress" max="2" value="1" aria-label="Ship: 1 of 2"/);
    assert.match(plan, /aria-current="step"/);
    assert.match(plan, /<span class="z-sr-only">, Done<\/span>/);
    assert.match(
      html(suggestionsWidget, { items: ["Hi", { text: "Plan", icon: "calendar" }], layout: "grid" }),
      /data-layout="grid".*data-text="Hi".*data-text="Plan"/,
    );
    assert.match(
      toHTML(agentStatusNode({ state: "tool", detail: "search", since: 0, now: 5000, locale: "en" })),
      /role="status".*Using search.*5s/,
    );
    assert.match(toHTML(agentStatusNode({})), /data-state="idle".*Idle/);
    const usage = toHTML(
      usageMeterNode({
        used: 192_000,
        limit: 200_000,
        variant: "ring",
        breakdown: { input: 1000 },
        cost: { value: 1.5, currency: "EUR" },
        locale: "en",
      }),
    );
    assert.match(usage, /data-level="danger"/);
    assert.match(usage, /<meter class="z-usage__meter" min="0" max="200000" value="192000"/);
    assert.match(usage, /aria-label="Context: 192K \/ 200K tokens \(96%\)"/);
    assert.match(usage, /€1.50/);
    assert.equal(branchNode(1, 1, L), null);
    assert.match(toHTML(branchNode(1, 3, L)), /data-step="-1"[^>]*disabled/);
    assert.match(html(branchPickerWidget, { index: 3, count: 3 }), /data-step="1"[^>]*disabled/);
    const art = html(artifactWidget, {
      title: "Card",
      versions: [
        { code: "<b>x</b>", preview: "html" },
        { code: "# T", preview: "markdown" },
      ],
      downloadName: "c.html",
      closable: true,
    });
    assert.match(art, /role="tablist" aria-label="View"/);
    assert.match(art, /aria-label="Version 2 of 2"/);
    assert.match(
      html(artifactWidget, { title: "Card", versions: [{ code: "<b>x</b>", preview: "html" }] }),
      /<iframe class="z-artifact__frame" sandbox srcdoc="&lt;b&gt;x&lt;\/b&gt;"/,
    );
    assert.match(
      html(artifactWidget, { title: "Doc", versions: [{ code: "# T", preview: "markdown" }] }),
      /z-artifact__doc"><div class="z-markdown"><h3>T<\/h3>/,
    );
    assert.match(html(artifactWidget, { title: "Code", versions: [{ code: "x", language: "js" }] }), /z-code-viewer/);
    const ac = artifactWidget.configure({ versions: [{ code: "a" }, { code: "b" }], version: 0 });
    assert.equal(artifactWidget.control!(ac, { version: 1, view: "code", copied: "idle" }).version, 0);
    assert.match(html(markdownWidget, { text: "x", streaming: true }), /aria-busy="true".*z-caret/);
    assert.match(html(toolCallWidget, { name: "n", status: "success" }), /z-tool-call-block/);
  });
});

describe("ChatLayout (lógica)", () => {
  test("vistas, columnas, paneles, F6 e historial", () => {
    assert.equal(isChatView("details"), true);
    assert.equal(isChatView("x"), false);
    assert.equal(viewDepth("conversation"), 1);
    assert.equal(backView("details"), "conversation");
    assert.equal(backView("conversation"), "list");
    assert.equal(backView("list"), null);
    assert.equal(chatColumns(null), 3);
    assert.equal(chatColumns(1200), 3);
    assert.equal(chatColumns(800), 2);
    assert.equal(chatColumns(390), 1);
    assert.deepEqual(visiblePanes(1, "details", false), ["conversation"]);
    assert.deepEqual(visiblePanes(1, "list", true), ["list"]);
    assert.deepEqual(visiblePanes(2, "details", true), ["list", "conversation", "details"]);
    assert.deepEqual(visiblePanes(2, "conversation", true), ["list", "conversation"]);
    assert.deepEqual(visiblePanes(3, "list", true), ["list", "conversation", "details"]);
    assert.deepEqual(visiblePanes(3, "list", false), ["list", "conversation"]);
    assert.equal(nextPane(["list", "conversation"], "conversation"), "list");
    assert.equal(nextPane(["list", "conversation"], "list", true), "conversation");
    assert.equal(nextPane(["list", "conversation"], null, true), "conversation");
    assert.equal(nextPane([], "list"), null);
    assert.equal(historyStep("list", "conversation"), "push");
    assert.equal(historyStep("details", "list"), "back");
    assert.equal(historyStep("list", "list"), null);
  });
});
