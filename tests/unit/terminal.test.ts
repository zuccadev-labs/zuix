// Terminal y código: secuencias ANSI y pantalla de líneas, historial y completado, diff de Myers y parches, filtro de
// logs, tokenizador de código; y los árboles de Terminal, LogConsole, CodeViewer y DiffViewer.
import "./helpers/dom.mjs";
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import fc from "fast-check";
import { applySgr, createAnsiScreen, paletteRgb, parseAnsi, stripAnsi, styleKey } from "../../zui/src/core/ansi.ts";
import { commonPrefix, completeInput, createHistory } from "../../zui/src/core/history.ts";
import {
  changePairs,
  diffLines,
  diffSequence,
  diffStats,
  hunkHeader,
  parsePatch,
  splitLines,
  splitRows,
  toHunks,
  wordDiff,
  wordTokens,
} from "../../zui/src/core/diff.ts";
import { filterLogs, levelOf, logLine, logMatches, markParts, matchRanges } from "../../zui/src/core/log-filter.ts";
import { knownLanguage, languageOf, parseLineRanges, tokenize, tokenizeLines } from "../../zui/src/core/code-tokens.ts";
import { ansiSpan, tokenNodes } from "../../zui/src/core/terminal-shared.ts";
import { terminalWidget } from "../../zui/src/core/terminal-widget.ts";
import { logConsoleWidget } from "../../zui/src/core/log-widget.ts";
import { codeViewerWidget } from "../../zui/src/core/code-viewer-widget.ts";
import { diffViewerWidget } from "../../zui/src/core/diff-widget.ts";
import { toHTML, type VNode } from "../../zui/src/core/vnode.ts";

const html = <P, C, S>(
  w: { configure(p: P): C; initial(c: C): S; tree(c: C, s: S, uid: string): unknown },
  props: P,
  patch: Partial<S> = {},
) => {
  const c = w.configure(props);
  return toHTML(w.tree(c, { ...w.initial(c), ...patch }, "t") as never);
};
const ESC = "\x1b";

describe("ANSI", () => {
  test("SGR: 16 colores, brillantes, 256, 24 bits y atributos", () => {
    assert.deepEqual(applySgr({}, [1, 31]), { bold: true, fg: 1 });
    assert.deepEqual(applySgr({}, [92, 44]), { fg: 10, bg: 4 });
    assert.deepEqual(applySgr({}, [38, 5, 208]), { fg: 208 });
    assert.deepEqual(applySgr({}, [48, 2, 10, 20, 30]), { bg: [10, 20, 30] });
    assert.deepEqual(applySgr({}, [38, 5, 999]), {}, "fuera de rango, se ignora");
    assert.deepEqual(applySgr({ bold: true, dim: true, fg: 3, link: "https://a.b/" }, [22, 39]), { link: "https://a.b/" });
    assert.deepEqual(applySgr({ bold: true, fg: 2 }, []), {}, "ESC[m equivale a ESC[0m");
    assert.deepEqual(applySgr({}, [2, 3, 4, 7, 9]), { dim: true, italic: true, underline: true, inverse: true, strike: true });
    assert.deepEqual(applySgr({ italic: true, underline: true, inverse: true, strike: true, bg: 1 }, [23, 24, 27, 29, 49]), {});
  });
  test("paleta de 256", () => {
    assert.equal(paletteRgb(3), null, "0–15 van por tokens");
    assert.deepEqual(paletteRgb(16), [0, 0, 0]);
    assert.deepEqual(paletteRgb(196), [255, 0, 0]);
    assert.deepEqual(paletteRgb(232), [8, 8, 8]);
    assert.deepEqual(paletteRgb(255), [238, 238, 238]);
  });
  test("trozos con estilo, fusionados", () => {
    const [line] = parseAnsi(`${ESC}[32mok${ESC}[0m done ${ESC}[1;31mfail${ESC}[0m`);
    assert.deepEqual(
      line!.map((s) => [s.text, styleKey(s.style)]),
      [
        ["ok", "2||||||||"],
        [" done ", "||||||||"],
        ["fail", "1||b||||||"],
      ],
    );
  });
  test("retorno de carro reescribe la línea (barras de progreso) y ESC[2K la borra", () => {
    assert.equal(stripAnsi("10%\r50%\r100%\n"), "100%");
    assert.equal(stripAnsi("downloading 3/10\rok"), "okwnloading 3/10", "lo nuevo pisa celda a celda");
    assert.equal(stripAnsi(`downloading\r${ESC}[2Kdone`), "done");
    assert.equal(stripAnsi(`abcdef\r${ESC}[3G${ESC}[K!`), "ab!");
    assert.equal(stripAnsi("a\tb"), "a       b");
    assert.equal(stripAnsi("ab\bc"), "ac");
    assert.equal(stripAnsi("a\r\nb"), "a\nb");
  });
  test("enlaces OSC 8: solo http y https", () => {
    const [line] = parseAnsi(
      `${ESC}]8;;https://example.com/x${ESC}\\site${ESC}]8;;${ESC}\\ and ${ESC}]8;;javascript:alert(1)\x07bad${ESC}]8;;\x07`,
    );
    assert.deepEqual(
      line!.map((s) => [s.text, s.style.link]),
      [
        ["site", "https://example.com/x"],
        [" and bad", undefined],
      ],
    );
  });
  test("otras secuencias se descartan; una secuencia partida entre trozos se completa", () => {
    assert.equal(stripAnsi(`${ESC}[?25l${ESC}[2Jhi${ESC}7${ESC}]0;title\x07!`), "hi!");
    const screen = createAnsiScreen();
    screen.write(`${ESC}[3`);
    screen.write(`1mred${ESC}`);
    screen.write(`[0m plain${ESC}]8;;https://a.b`);
    screen.write(`/\x07link${ESC}]8;;\x07\n`);
    const [line] = screen.lines();
    assert.deepEqual(
      line!.spans.map((s) => [s.text, s.style.fg ?? null, s.style.link ?? null]),
      [
        ["red", 1, null],
        [" plain", null, null],
        ["link", null, "https://a.b/"],
      ],
    );
  });
  test("pantalla con límite: ids estables, se descartan las más antiguas", () => {
    const screen = createAnsiScreen(3);
    for (let i = 0; i < 200; i++) screen.write(`line ${i}\n`);
    screen.write("partial");
    const lines = screen.lines();
    assert.equal(lines.length, 4);
    assert.deepEqual(
      lines.map((l) => l.spans.map((s) => s.text).join("")),
      ["line 197", "line 198", "line 199", "partial"],
    );
    assert.equal(screen.dropped, 197);
    assert.ok(lines[0]!.id < lines[1]!.id);
    assert.equal(screen.lines()[0], lines[0], "una línea terminada es el mismo objeto");
    assert.equal(screen.text(), "line 197\nline 198\nline 199\npartial");
    screen.clear();
    assert.deepEqual(screen.lines(), []);
    assert.equal(screen.dropped, 0);
  });
  test("el texto sin secuencias se conserva (fast-check)", () => {
    fc.assert(
      fc.property(fc.string({ unit: fc.constantFrom("a", "b", " ", "é", "\n", "z", "1") }), (text) => {
        const plain = text.endsWith("\n") ? text.slice(0, -1) : text;
        assert.equal(stripAnsi(text), plain);
      }),
    );
  });
  test("escribir de una vez o a trozos da lo mismo (fast-check)", () => {
    const pieces = fc.array(
      fc.constantFrom("ab", `${ESC}[1;3`, "2m", "x\n", `${ESC}[0m`, "\r", `${ESC}]8;;https://q.r\x07`, "y", `${ESC}`, "[K"),
      { maxLength: 30 },
    );
    fc.assert(
      fc.property(pieces, fc.integer({ min: 1, max: 5 }), (list, size) => {
        const whole = createAnsiScreen();
        whole.write(list.join(""));
        const parts = createAnsiScreen();
        const joined = list.join("");
        for (let i = 0; i < joined.length; i += size) parts.write(joined.slice(i, i + size));
        assert.equal(parts.text(), whole.text());
        assert.deepEqual(
          parts.lines().map((l) => l.spans),
          whole.lines().map((l) => l.spans),
        );
      }),
    );
  });
  test("trozo pintado: tokens para 0–15, variable local para 256 y 24 bits, enlace como <a>", () => {
    const render = (n: VNode) => toHTML(n);
    assert.equal(render(ansiSpan({ text: "x", style: {} })), "x");
    assert.equal(render(ansiSpan({ text: "x", style: { fg: 1, bold: true } })), '<span class="z-ansi" data-fg="1" data-bold>x</span>');
    assert.equal(
      render(ansiSpan({ text: "x", style: { fg: 196 } })),
      '<span class="z-ansi" data-fg="rgb" style="--z-ansi-fg: 255 0 0">x</span>',
    );
    assert.equal(
      render(ansiSpan({ text: "x", style: { bg: [1, 2, 3] } })),
      '<span class="z-ansi" data-bg="rgb" style="--z-ansi-bg: 1 2 3">x</span>',
    );
    assert.match(
      render(ansiSpan({ text: "go", style: { link: "https://a.b/" } })),
      /^<a class="z-ansi" href="https:\/\/a.b\/" target="_blank" rel="noopener noreferrer">go<\/a>$/,
    );
    assert.equal(
      render(ansiSpan({ text: "<b>", style: { fg: 2 } })),
      '<span class="z-ansi" data-fg="2">&lt;b&gt;</span>',
      "el texto nunca es marcado",
    );
  });
});

describe("historial y completado", () => {
  test("↑ guarda el borrador, ↓ vuelve a él; sin vacías ni repetidas seguidas", () => {
    const h = createHistory(["ls", "", "git status"]);
    assert.deepEqual(h.items, ["ls", "git status"]);
    assert.equal(h.previous("git di"), "git status");
    assert.equal(h.previous("ignored"), "ls");
    assert.equal(h.previous("x"), null);
    assert.equal(h.next(), "git status");
    assert.equal(h.next(), "git di");
    assert.equal(h.next(), null);
    h.push("pnpm test");
    h.push("pnpm test");
    h.push("   ");
    assert.deepEqual(h.items, ["ls", "git status", "pnpm test"]);
    h.previous("");
    h.reset();
    assert.equal(h.index, 3);
  });
  test("tope del historial", () => {
    const h = createHistory([], 2);
    for (const c of ["a", "b", "c"]) h.push(c);
    assert.deepEqual(h.items, ["b", "c"]);
  });
  test("Tab: una opción la escribe; varias, el prefijo común y la lista", () => {
    assert.equal(commonPrefix(["deploy", "dev", "describe"]), "de");
    assert.equal(commonPrefix([]), "");
    assert.deepEqual(completeInput("gi", ["git"]), { value: "git", list: [] });
    assert.deepEqual(completeInput("d", ["deploy", "describe"]), { value: "de", list: ["deploy", "describe"] });
    assert.deepEqual(completeInput("de", ["deploy", "describe"]), { value: "de", list: ["deploy", "describe"] });
    assert.deepEqual(completeInput("x", []), { value: "x", list: [] });
  });
});

describe("diff", () => {
  test("Myers: aplicar las operaciones reconstruye los dos lados (fast-check)", () => {
    const seq = fc.array(fc.constantFrom("a", "b", "c", "d"), { maxLength: 40 });
    fc.assert(
      fc.property(seq, seq, (a, b) => {
        const ops = diffSequence(a, b);
        assert.deepEqual(
          ops.filter((o) => o.kind !== "insert").map((o) => o.value),
          a,
        );
        assert.deepEqual(
          ops.filter((o) => o.kind !== "delete").map((o) => o.value),
          b,
        );
        // Mínimo: las iguales son una subsecuencia común más larga (comparada con programación dinámica).
        const lcs = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
        for (let i = a.length - 1; i >= 0; i--)
          for (let j = b.length - 1; j >= 0; j--)
            lcs[i]![j] = a[i] === b[j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
        assert.equal(ops.filter((o) => o.kind === "equal").length, lcs[0]![0]);
      }),
    );
  });
  test("con límite, lo de en medio queda como borrado e inserción", () => {
    const ops = diffSequence(["a", "x", "y", "z"], ["a", "1", "2", "3"], Object.is, 0);
    assert.deepEqual(
      ops.map((o) => o.kind),
      ["equal", "delete", "delete", "delete", "insert", "insert", "insert"],
    );
  });
  test("líneas, numeración, bloques con contexto y cabecera", () => {
    assert.deepEqual(splitLines("a\r\nb\n"), ["a", "b"]);
    assert.deepEqual(splitLines(""), []);
    const before = Array.from({ length: 20 }, (_, i) => `line ${i + 1}`).join("\n");
    const after = before.replace("line 3", "line three").replace("line 18", "line eighteen");
    const lines = diffLines(before, after);
    assert.deepEqual(diffStats(lines), { added: 2, removed: 2 });
    const hunks = toHunks(lines, 2);
    assert.equal(hunks.length, 2);
    assert.equal(hunkHeader(hunks[0]!), "@@ -1,5 +1,5 @@");
    assert.equal(hunkHeader(hunks[1]!), "@@ -16,5 +16,5 @@");
    assert.equal(toHunks(lines, 10).length, 1, "con contexto amplio se unen");
    assert.deepEqual(hunkHeader({ oldStart: 4, oldLines: 1, newStart: 4, newLines: 0 }), "@@ -4 +4,0 @@");
    const added = toHunks(diffLines("", "a\nb"), 3);
    assert.deepEqual([added[0]!.oldStart, added[0]!.oldLines, added[0]!.newStart, added[0]!.newLines], [0, 0, 1, 2]);
  });
  test("parche unificado de git, con varios archivos, nuevo, borrado y binario", () => {
    const patch = [
      "diff --git a/src/a.js b/src/a.js",
      "index 1..2 100644",
      "--- a/src/a.js",
      "+++ b/src/a.js",
      "@@ -1,3 +1,3 @@ function a() {",
      " const x = 1;",
      "-const y = 2;",
      "+const y = 3;",
      "--- comment",
      "diff --git a/new.txt b/new.txt",
      "new file mode 100644",
      "--- /dev/null",
      "+++ b/new.txt",
      "@@ -0,0 +1 @@",
      "+hello",
      "diff --git a/img.png b/img.png",
      "Binary files a/img.png and b/img.png differ",
    ].join("\n");
    const files = parsePatch(patch);
    assert.equal(files.length, 3);
    const [a, created, binary] = files;
    assert.deepEqual([a!.oldName, a!.newName, a!.added, a!.removed], ["src/a.js", "src/a.js", 1, 2]);
    assert.equal(a!.hunks[0]!.header, "function a() {");
    assert.deepEqual(
      a!.hunks[0]!.lines.map((l) => [l.kind, l.old ?? null, l.new ?? null, l.text]),
      [
        ["equal", 1, 1, "const x = 1;"],
        ["delete", 2, null, "const y = 2;"],
        ["insert", null, 2, "const y = 3;"],
        ["delete", 3, null, "-- comment"],
      ],
      "una línea quitada que empieza por «--» no es una cabecera",
    );
    assert.deepEqual([created!.oldName, created!.newName, created!.added], ["", "new.txt", 1]);
    assert.equal(binary!.binary, true);
    const plain = parsePatch("--- old.txt\n+++ new.txt\n@@ -1 +1 @@\n-a\n+b\n");
    assert.deepEqual([plain[0]!.oldName, plain[0]!.newName], ["old.txt", "new.txt"]);
    assert.deepEqual(parsePatch("nothing here"), []);
  });
  test("palabras cambiadas y filas lado a lado", () => {
    assert.deepEqual(wordTokens("a  b,c"), ["a", "  ", "b", ",", "c"]);
    const wd = wordDiff("sum += item.price;", "sum += item.price * item.quantity;");
    assert.deepEqual(
      wd.after.filter((p) => p.changed).map((p) => p.text),
      [" * item.quantity"],
    );
    assert.ok(wd.before.every((p) => !p.changed));
    const total = wordDiff("abc", "xyz");
    assert.deepEqual(total.before, [{ text: "abc", changed: true }], "casi todo cambia: la línea entera");
    const lines = diffLines("a\nb\nc\n", "a\nB\nC\nd\nc\n");
    const rows = splitRows(lines);
    assert.deepEqual(
      rows.map((r) => [r.left?.text ?? null, r.right?.text ?? null]),
      [
        ["a", "a"],
        ["b", "B"],
        [null, "C"],
        [null, "d"],
        ["c", "c"],
      ],
    );
    const pairs = changePairs(lines);
    const b = lines.find((l) => l.text === "b")!;
    assert.equal(pairs.get(b)?.text, "B");
  });
});

describe("filtro de logs", () => {
  const entries = [
    { message: "GET /a 200", level: "info" as const, source: "api" },
    { message: "Slow query", level: "warn" as const, source: "db" },
    { message: "Timeout", level: "error" as const, source: "api" },
    { message: "cache hit", level: "debug" as const },
    { message: "no level" },
  ];
  test("niveles, texto y contadores", () => {
    assert.equal(levelOf({}), "info");
    assert.equal(levelOf({ level: "nope" as never }), "info");
    const all = filterLogs(entries);
    assert.deepEqual(all.rows, [0, 1, 2, 3, 4]);
    assert.deepEqual(all.counts, { debug: 1, info: 2, warn: 1, error: 1 });
    const api = filterLogs(entries, { query: "API", levels: ["error"] });
    assert.deepEqual(api.rows, [2]);
    assert.deepEqual(api.counts, { debug: 0, info: 1, warn: 0, error: 1 }, "los contadores no dependen del filtro de niveles");
    assert.ok(logMatches(entries[0]!, ""));
    assert.ok(!logMatches(entries[3]!, "api"));
  });
  test("tramos que coinciden y trozos para <mark>", () => {
    assert.deepEqual(matchRanges("Error: error", "error"), [
      [0, 5],
      [7, 12],
    ]);
    assert.deepEqual(matchRanges("aaa", "aa"), [[0, 2]], "sin solaparse");
    assert.deepEqual(matchRanges("x", " "), []);
    assert.deepEqual(matchRanges("İstanbul", "i"), [], "si minúsculas cambia la longitud, no se marca");
    assert.deepEqual(markParts("a-b-a", "a"), [
      { text: "a", match: true },
      { text: "-b-", match: false },
      { text: "a", match: true },
    ]);
    assert.deepEqual(markParts("abc", "zz"), [{ text: "abc", match: false }]);
    assert.equal(logLine({ message: "m", level: "warn", source: "s" }, "10:00"), "10:00 WARN  [s] m");
  });
  test("los tramos marcados son exactamente las apariciones (fast-check)", () => {
    fc.assert(
      fc.property(
        fc.string({ unit: fc.constantFrom("a", "b", "A", " ") }),
        fc.string({ unit: fc.constantFrom("a", "b"), minLength: 1, maxLength: 3 }),
        (text, q) => {
          const parts = markParts(text, q);
          assert.equal(parts.map((p) => p.text).join(""), text);
          for (const p of parts) if (p.match) assert.equal(p.text.toLowerCase(), q.toLowerCase());
        },
      ),
    );
  });
});

describe("tokenizador de código", () => {
  test("tipos por lenguaje", () => {
    const kinds = (code: string, lang: string) =>
      tokenize(code, lang)
        .filter((t) => t.type !== "plain")
        .map((t) => `${t.type}:${t.text}`);
    assert.deepEqual(kinds('const n = fn("x", 42); // ok', "ts"), [
      "keyword:const",
      "punctuation:=",
      "function:fn",
      "punctuation:(",
      'string:"x"',
      "punctuation:,",
      "number:42",
      "punctuation:);",
      "comment:// ok",
    ]);
    assert.deepEqual(
      kinds("const a: Array<string> = []", "ts").filter((k) => k.startsWith("tag")),
      [],
      "en TS un genérico no es una etiqueta",
    );
    assert.ok(kinds("<Button size='sm' />", "tsx").includes("tag:<Button"));
    assert.deepEqual(kinds('{"a": true, "b": [1]}', "json"), [
      "punctuation:{",
      'property:"a"',
      "punctuation::",
      "literal:true",
      "punctuation:,",
      'property:"b"',
      "punctuation::",
      "punctuation:[",
      "number:1",
      "punctuation:]}",
    ]);
    assert.ok(kinds(".a { color: #fff; }", "css").includes("property:color"));
    assert.ok(kinds("echo $HOME --flag # note", "bash").includes("variable:$HOME"));
    assert.ok(kinds("echo $HOME --flag # note", "bash").includes("comment:# note"));
    assert.ok(kinds("@app.route\ndef f(): return None", "python").includes("attr:@app.route"));
    assert.ok(kinds('<a href="/x">hi</a>', "html").includes('string:"/x"'));
    assert.deepEqual(tokenize("x y", "brainfuck"), [{ type: "plain", text: "x y" }]);
    assert.deepEqual(tokenize("", "ts"), []);
  });
  test("comentarios y cadenas de varias líneas se parten por línea", () => {
    const lines = tokenizeLines("a /* one\ntwo */ b\n", "js");
    assert.equal(lines.length, 2);
    assert.deepEqual(lines[1]![0], { type: "comment", text: "two */" });
    assert.deepEqual(tokenizeLines('s = """\nx\n"""', "py")[1], [{ type: "string", text: "x" }]);
  });
  test("los tokens reconstruyen el código, en cualquier lenguaje (fast-check)", () => {
    const code = fc.string({
      unit: fc.constantFrom("a", "1", " ", "\n", '"', "'", "/", "*", "#", "<", ">", "{", "}", "$", "-", "`", "@", ":", "\\"),
    });
    fc.assert(
      fc.property(code, fc.constantFrom("ts", "tsx", "json", "css", "html", "bash", "python", "none"), (src, lang) => {
        assert.equal(
          tokenize(src, lang)
            .map((t) => t.text)
            .join(""),
          src,
        );
        assert.equal(
          tokenizeLines(src, lang)
            .map((l) => l.map((t) => t.text).join(""))
            .join("\n"),
          src.endsWith("\n") ? src.slice(0, -1) : src,
        );
      }),
    );
  });
  test("lenguaje por extensión, rangos de líneas y nodos", () => {
    assert.equal(languageOf("src/app.tsx"), "tsx");
    assert.equal(languageOf("README"), undefined);
    assert.equal(languageOf("data.unknown"), undefined);
    assert.ok(knownLanguage("Python"));
    assert.ok(!knownLanguage(undefined));
    assert.deepEqual(
      [...parseLineRanges("3-5, 9,7–6")].sort((a, b) => a - b),
      [3, 4, 5, 6, 7, 9],
    );
    assert.deepEqual([...parseLineRanges([2, -1, 1.5, 4])], [2, 4]);
    assert.equal(parseLineRanges("x").size, 0);
    assert.equal(parseLineRanges(null).size, 0);
    assert.equal(
      toHTML({
        t: "code",
        c: tokenNodes([
          { type: "keyword", text: "if" },
          { type: "plain", text: " x" },
        ]),
      }),
      '<code><span class="z-tok" data-tok="keyword">if</span> x</code>',
    );
  });
});

describe("árboles de la familia", () => {
  test("Terminal: región, salida role=log sin anunciar cada línea y entrada con etiqueta", () => {
    const out = html(terminalWidget, { prompt: "~ $", defaultOutput: `${ESC}[32mready${ESC}[0m\n`, title: "build" });
    assert.match(out, /^<div class="z-terminal" role="region" aria-label="build"/);
    assert.match(out, /role="log" aria-live="off" aria-label="Terminal output" tabindex="0"/);
    assert.match(out, /<span class="z-ansi" data-fg="2">ready<\/span>/);
    assert.match(
      out,
      /<label class="z-sr-only" for="t-field">Command<\/label><span class="z-terminal__prompt" aria-hidden="true">~ \$<\/span><input class="z-terminal__field" id="t-field" type="text" autocomplete="off"/,
    );
    assert.match(html(terminalWidget, { announce: "all" }), /aria-live="polite"/);
    const ro = html(terminalWidget, { readOnly: true, busy: true });
    assert.ok(!ro.includes("z-terminal__input"));
    assert.match(ro, /data-running/);
    assert.match(ro, /z-terminal__status/);
  });
  test("LogConsole: rejilla con aria-rowcount y solo la ventana visible", () => {
    const entries = Array.from({ length: 5000 }, (_, i) => ({
      id: i,
      message: `entry ${i}`,
      level: i % 10 === 0 ? ("error" as const) : ("info" as const),
    }));
    const out = html(logConsoleWidget, { entries, follow: false }, { viewport: 280, rowHeight: 28, scroll: 0 });
    assert.match(out, /role="grid"[^>]*aria-rowcount="5001"/);
    const rows = (out.match(/role="row" aria-rowindex=/g) ?? []).length - 1;
    assert.ok(rows > 5 && rows < 40, `${rows} filas pintadas de 5000`);
    assert.match(
      out,
      /aria-pressed="true"[^>]*><span class="z-log-console__dot" data-level="error" aria-hidden="true"><\/span>Error<span class="z-log-console__count">500</,
    );
    assert.equal((out.match(/tabindex="0"/g) ?? []).length, 1, "una sola parada de Tab");
    const far = html(logConsoleWidget, { entries, follow: false }, { viewport: 280, rowHeight: 28, scroll: 0, row: 4000 });
    assert.match(far, /aria-rowindex="4002" data-level="error" data-detached/, "la fila activa sigue en el documento");
    const search = html(logConsoleWidget, { entries: entries.slice(0, 30), follow: false, wrap: true }, { query: "entry 2" });
    assert.match(search, /<mark class="z-log-console__match">entry 2<\/mark>/);
    assert.match(search, /aria-rowcount="12"/);
    assert.match(html(logConsoleWidget, { entries: [] }), /z-log-console__empty">No entries/);
    const timed = html(logConsoleWidget, {
      entries: [{ time: "2026-11-21T10:42:01.120Z", message: "x" }],
      timeZone: "UTC",
      locale: "en-GB",
    });
    assert.match(timed, /<time datetime="2026-11-21T10:42:01.120Z">10:42:01.120<\/time>/);
  });
  test("CodeViewer: números ocultos al lector, líneas resaltadas y pestañas", () => {
    const out = html(codeViewerWidget, { code: "const a = 1;\nconst b = 2;\n", language: "js", highlightLines: "2", title: "a.js" });
    assert.match(out, /role="region" aria-label="a.js" tabindex="0"/);
    assert.match(out, /<span class="z-code-viewer__number" aria-hidden="true">1<\/span>/);
    assert.match(out, /data-highlighted><span class="z-code-viewer__number" aria-hidden="true">2/);
    assert.match(out, /<span class="z-tok" data-tok="keyword">const<\/span>/);
    const tabs = html(codeViewerWidget, {
      files: [
        { name: "a.json", code: "{}" },
        { name: "b.css", code: "a{}" },
      ],
    });
    assert.match(tabs, /role="tablist" aria-label="Files"/);
    assert.match(tabs, /role="tab" id="t-tab-0" data-index="0" aria-selected="true" aria-controls="t-panel" tabindex="0">a.json/);
    assert.match(tabs, /role="tabpanel" aria-labelledby="t-tab-0"/);
    assert.match(tabs, /data-language="json"/);
    const plain = html(codeViewerWidget, { code: "x", lineNumbers: false, startLine: 10, maxHeight: "200px" });
    assert.ok(!plain.includes("z-code-viewer__number"));
    assert.match(plain, /--z-code-viewer-max: 200px/);
  });
  test("DiffViewer: tipo de cada línea en texto, palabras y huecos plegados", () => {
    const before = Array.from({ length: 30 }, (_, i) => `row ${i}`).join("\n");
    const after = before.replace("row 15", "row fifteen");
    const out = html(diffViewerWidget, { before, after, fileName: "rows.txt" });
    assert.match(out, /<span class="z-sr-only">removed: <\/span>row <span class="z-diff__word">15<\/span>/);
    assert.match(out, /<span class="z-sr-only">added: <\/span>row <span class="z-diff__word">fifteen<\/span>/);
    assert.match(out, /Show 12 unchanged lines/);
    assert.match(out, /1 additions, 1 deletions/);
    assert.match(out, /<thead class="z-sr-only">/);
    const expanded = html(diffViewerWidget, { before, after, fileName: "rows.txt" }, { expanded: ["f0g0"] });
    assert.match(expanded, /data-gap-start="f0g0" tabindex="-1"/);
    const split = html(diffViewerWidget, { before: "a\nb", after: "a\nc", defaultMode: "split", hideModeToggle: true });
    assert.match(split, /data-left="delete" data-right="insert"/);
    assert.ok(!split.includes('z-diff__mode"'));
    const patch = html(diffViewerWidget, { patch: "--- a/x\n+++ b/x\n@@ -1 +1 @@ top\n-a\n+b\n" });
    assert.match(patch, /z-diff__hunk"><td colspan="4">@@ -1 \+1 @@ top/);
    assert.match(html(diffViewerWidget, { before: "same", after: "same" }), /No changes/);
  });
});
