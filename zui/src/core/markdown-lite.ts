// Markdown mínimo propio para las respuestas de un asistente: párrafos, encabezados, listas (anidadas, ordenadas y de
// tareas), citas, código en línea y en bloque, tablas sencillas, énfasis, tachado, enlaces y citas a fuentes (`[1]`).
// Construye un árbol (core/vnode), nunca HTML: el texto va siempre como texto y un enlace solo sale si su destino es
// http, https o mailto (core/linkify). Lo que no está aquí (LaTeX, diagramas) lo pinta la aplicación con su propio
// `renderMarkdown`. Puro.

import { linkify, safeHref } from "./linkify";
import { h, type VEl, type VNode } from "./vnode";

export type Inline =
  | string
  | { type: "strong" | "em" | "del"; children: Inline[] }
  | { type: "code"; text: string }
  | { type: "link"; href: string; children: Inline[] }
  | { type: "cite"; n: number }
  | { type: "br" };

export type Block =
  | { type: "p"; inline: Inline[] }
  | { type: "h"; level: number; inline: Inline[] }
  | { type: "list"; ordered: boolean; start: number; loose?: boolean; items: { blocks: Block[]; task?: boolean; checked?: boolean }[] }
  | { type: "quote"; blocks: Block[] }
  | { type: "code"; lang: string; code: string }
  | { type: "table"; align: ("left" | "center" | "right" | null)[]; head: Inline[][]; rows: Inline[][][] }
  | { type: "hr" };

const FENCE = /^ {0,3}(`{3,}|~{3,})\s*([^\s`]*)/;
const HEADING = /^ {0,3}(#{1,6})(?:\s+(.*?))?\s*#*\s*$/;
const HR = /^ {0,3}([-*_])(?:\s*\1){2,}\s*$/;
const QUOTE = /^ {0,3}> ?(.*)$/;
const ITEM = /^(\s*)([-*+]|\d{1,9}[.)])\s+(.*)$/;
const TABLE_SEP = /^\s*\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)*\|?\s*$/;

const indentOf = (line: string) => (/^\s*/.exec(line)?.[0] ?? "").replace(/\t/g, "    ").length;
const blank = (line: string) => !line.trim();

const cells = (line: string) => {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|") && !s.endsWith("\\|")) s = s.slice(0, -1);
  return s.split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, "|"));
};

const startsBlock = (line: string) => FENCE.test(line) || HEADING.test(line) || HR.test(line) || QUOTE.test(line) || ITEM.test(line);

/** Bloques de un texto Markdown. Nunca lanza: lo que no reconoce es un párrafo. */
export function parseMarkdown(source: string): Block[] {
  return parseBlocks(source.replace(/\r\n?/g, "\n").split("\n"), 0);
}

function parseBlocks(lines: string[], depth: number): Block[] {
  const out: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (blank(line)) {
      i++;
      continue;
    }
    const fence = FENCE.exec(line);
    if (fence) {
      const mark = fence[1]!;
      const body: string[] = [];
      i++;
      while (i < lines.length && !new RegExp(`^ {0,3}${mark[0] === "`" ? "`" : "~"}{${mark.length},}\\s*$`).test(lines[i]!))
        body.push(lines[i++]!);
      i++;
      out.push({ type: "code", lang: fence[2]!.toLowerCase(), code: body.join("\n") });
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      out.push({ type: "h", level: heading[1]!.length, inline: parseInline(heading[2] ?? "") });
      i++;
      continue;
    }
    if (HR.test(line)) {
      out.push({ type: "hr" });
      i++;
      continue;
    }
    if (QUOTE.test(line)) {
      const body: string[] = [];
      while (i < lines.length && !blank(lines[i]!) && (QUOTE.test(lines[i]!) || !startsBlock(lines[i]!))) {
        const q = QUOTE.exec(lines[i]!);
        body.push(q ? q[1]! : lines[i]!);
        i++;
      }
      out.push({ type: "quote", blocks: depth > 8 ? [{ type: "p", inline: parseInline(body.join("\n")) }] : parseBlocks(body, depth + 1) });
      continue;
    }
    const item = ITEM.exec(line);
    if (item) {
      const base = indentOf(line);
      const ordered = /\d/.test(item[2]!);
      const start = ordered ? Number.parseInt(item[2]!, 10) : 1;
      const items: { blocks: Block[]; task?: boolean; checked?: boolean }[] = [];
      let loose = false;
      while (i < lines.length) {
        const m = ITEM.exec(lines[i]!);
        if (!m || indentOf(lines[i]!) !== base || /\d/.test(m[2]!) !== ordered) break;
        const content = indentOf(lines[i]!) + m[2]!.length + 1;
        const body = [m[3]!];
        i++;
        while (i < lines.length) {
          const next = lines[i]!;
          if (blank(next)) {
            // Una línea en blanco sigue dentro del elemento si lo siguiente va sangrado.
            if (i + 1 < lines.length && !blank(lines[i + 1]!) && indentOf(lines[i + 1]!) >= content) {
              loose = true;
              body.push("");
              i++;
              continue;
            }
            break;
          }
          if (indentOf(next) >= Math.min(content, base + 2)) {
            body.push(next.replace(/\t/g, "    ").slice(Math.min(content, indentOf(next))));
            i++;
            continue;
          }
          if (startsBlock(next)) break;
          body.push(next.trim());
          i++;
        }
        const task = /^\[([ xX])\]\s+/.exec(body[0]!);
        if (task) body[0] = body[0]!.slice(task[0].length);
        items.push({
          blocks: depth > 8 ? [{ type: "p", inline: parseInline(body.join("\n")) }] : parseBlocks(body, depth + 1),
          ...(task ? { task: true, checked: task[1] !== " " } : {}),
        });
        const sameList = (line: string) => {
          const n = ITEM.exec(line);
          return n !== null && indentOf(line) === base && /\d/.test(n[2]!) === ordered;
        };
        while (i < lines.length && blank(lines[i]!) && i + 1 < lines.length && sameList(lines[i + 1]!)) {
          loose = true;
          i++;
        }
      }
      out.push({ type: "list", ordered, start, items, ...(loose ? { loose } : {}) });
      continue;
    }
    if (line.includes("|") && i + 1 < lines.length && TABLE_SEP.test(lines[i + 1]!) && lines[i + 1]!.includes("-")) {
      const head = cells(line);
      const align = cells(lines[i + 1]!).map((c) =>
        c.startsWith(":") && c.endsWith(":") ? "center" : c.endsWith(":") ? "right" : c.startsWith(":") ? "left" : null,
      );
      i += 2;
      const rows: Inline[][][] = [];
      while (i < lines.length && !blank(lines[i]!) && lines[i]!.includes("|")) {
        const row = cells(lines[i]!);
        rows.push(head.map((_, c) => parseInline(row[c] ?? "")));
        i++;
      }
      out.push({ type: "table", align: head.map((_, c) => align[c] ?? null), head: head.map(parseInline), rows });
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && !blank(lines[i]!) && (para.length === 0 || !startsBlock(lines[i]!))) para.push(lines[i++]!.trim());
    out.push({ type: "p", inline: parseInline(para.join("\n")) });
  }
  return out;
}

const PUNCT = /[\\`*_~[\]()#+\-.!|>{}]/;
const word = (ch: string | undefined) => Boolean(ch && /[\p{L}\p{N}]/u.test(ch));

/** Elementos en línea. Un delimitador sin pareja se queda como texto. */
export function parseInline(src: string, depth = 0): Inline[] {
  const out: Inline[] = [];
  let text = "";
  const flush = () => {
    if (!text) return;
    for (const part of linkify(text)) out.push(part.type === "link" ? { type: "link", href: part.href, children: [part.text] } : part.text);
    text = "";
  };
  let i = 0;
  while (i < src.length) {
    const ch = src[i]!;
    if (ch === "\\" && PUNCT.test(src[i + 1] ?? "")) {
      text += src[i + 1];
      i += 2;
      continue;
    }
    if (ch === "\n") {
      flush();
      out.push({ type: "br" });
      i++;
      continue;
    }
    if (ch === "`") {
      const run = /^`+/.exec(src.slice(i))![0];
      const close = src.indexOf(run, i + run.length);
      if (close > 0) {
        flush();
        out.push({ type: "code", text: src.slice(i + run.length, close).replace(/^ (.+) $/, "$1") });
        i = close + run.length;
        continue;
      }
      text += run;
      i += run.length;
      continue;
    }
    if (depth < 6) {
      const pair = src.startsWith("**", i) || src.startsWith("__", i) ? src.slice(i, i + 2) : src.startsWith("~~", i) ? "~~" : null;
      const single = !pair && (ch === "*" || ch === "_") ? ch : null;
      const mark = pair ?? single;
      if (mark && !/\s/.test(src[i + mark.length] ?? " ") && !(mark[0] === "_" && word(src[i - 1]))) {
        let close = i + mark.length;
        for (;;) {
          close = src.indexOf(mark, close + 1);
          if (close < 0) break;
          // Cierre válido: no precedido de espacio ni (para `_`) seguido de letra; un `*` suelto no cierra en un `**`.
          if (/\s/.test(src[close - 1]!)) continue;
          if (mark[0] === "_" && word(src[close + mark.length])) continue;
          if (single && src[close + 1] === single) {
            close++;
            continue;
          }
          break;
        }
        if (close > i + mark.length - 1 && close > 0) {
          flush();
          const inner = parseInline(src.slice(i + mark.length, close), depth + 1);
          out.push({ type: mark === "~~" ? "del" : pair ? "strong" : "em", children: inner });
          i = close + mark.length;
          continue;
        }
      }
    }
    if (ch === "[" || (ch === "!" && src[i + 1] === "[")) {
      const image = ch === "!";
      const open = image ? i + 1 : i;
      const cite = image ? null : /^\[(\d{1,3})\](?!\()/.exec(src.slice(i));
      if (cite) {
        flush();
        out.push({ type: "cite", n: Number(cite[1]) });
        i += cite[0].length;
        continue;
      }
      const end = matching(src, open, "[", "]");
      if (end > 0 && src[end + 1] === "(") {
        const close = matching(src, end + 1, "(", ")");
        if (close > 0) {
          const target = src
            .slice(end + 2, close)
            .trim()
            .replace(/\s+"[^"]*"$/, "")
            .replace(/^<(.*)>$/, "$1");
          const href = safeHref(target);
          const label = src.slice(open + 1, end);
          flush();
          const children = depth < 6 ? parseInline(label, depth + 1) : [label];
          // Una imagen del modelo no se carga (podría rastrear): queda su texto como enlace.
          out.push(href ? { type: "link", href, children: children.length ? children : [href] } : { type: "em", children });
          i = close + 1;
          continue;
        }
      }
    }
    text += ch;
    i++;
  }
  flush();
  return out;
}

function matching(src: string, from: number, open: string, close: string): number {
  let level = 0;
  for (let i = from; i < src.length; i++) {
    if (src[i] === "\\") {
      i++;
      continue;
    }
    if (src[i] === open) level++;
    else if (src[i] === close && --level === 0) return i;
  }
  return -1;
}

export interface MarkdownTreeOptions {
  /** Bloque de código: por defecto `pre > code`. Las piezas de IA lo pintan con el CodeViewer. */
  code?: (code: string, lang: string, key: string) => VNode;
  /** Cita `[n]`: por defecto un superíndice con el número. */
  cite?: (n: number, key: string) => VNode;
  /** Nivel del primer encabezado (`#` → h3 por defecto): dentro de un mensaje no compite con la página. */
  headingBase?: number;
}

function inlineNodes(list: readonly Inline[], o: MarkdownTreeOptions, prefix: string): VNode[] {
  return list.map((n, i) => {
    const key = `${prefix}.${i}`;
    if (typeof n === "string") return n;
    switch (n.type) {
      case "br":
        return h("br", { key });
      case "code":
        return h("code", { key }, n.text);
      case "cite":
        return o.cite ? o.cite(n.n, key) : h("sup", { key, class: "z-markdown__cite" }, `[${n.n}]`);
      case "link":
        return h("a", { key, href: n.href, target: "_blank", rel: "noopener noreferrer nofollow" }, ...inlineNodes(n.children, o, key));
      default:
        return h(n.type, { key }, ...inlineNodes(n.children, o, key));
    }
  });
}

function blockNodes(blocks: readonly Block[], o: MarkdownTreeOptions, prefix: string): VNode[] {
  const base = Math.max(1, Math.min(6, o.headingBase ?? 3));
  return blocks.map((b, i) => {
    const key = `${prefix}${i}`;
    switch (b.type) {
      case "p":
        return h("p", { key }, ...inlineNodes(b.inline, o, key));
      case "h":
        return h(`h${Math.min(6, base + b.level - 1)}`, { key }, ...inlineNodes(b.inline, o, key));
      case "hr":
        return h("hr", { key });
      case "quote":
        return h("blockquote", { key }, ...blockNodes(b.blocks, o, `${key}.`));
      case "code":
        return o.code ? o.code(b.code, b.lang, key) : h("pre", { key }, h("code", { "data-lang": b.lang || undefined }, b.code));
      case "table":
        return h(
          "div",
          { key, class: "z-markdown__table" },
          h(
            "table",
            null,
            h(
              "thead",
              null,
              h(
                "tr",
                null,
                ...b.head.map((c, j) =>
                  h("th", { key: String(j), "data-align": b.align[j] ?? undefined }, ...inlineNodes(c, o, `${key}.h${j}`)),
                ),
              ),
            ),
            h(
              "tbody",
              null,
              ...b.rows.map((row, r) =>
                h(
                  "tr",
                  { key: String(r) },
                  ...row.map((c, j) =>
                    h("td", { key: String(j), "data-align": b.align[j] ?? undefined }, ...inlineNodes(c, o, `${key}.${r}.${j}`)),
                  ),
                ),
              ),
            ),
          ),
        );
      case "list": {
        // Lista compacta (sin líneas en blanco): el primer párrafo de cada elemento se pinta sin <p>.
        const items = b.items.map((it, j) => {
          const [first, ...rest] = it.blocks;
          const inline = !b.loose && first?.type === "p" ? first.inline : null;
          const body = inline
            ? [...inlineNodes(inline, o, `${key}.${j}`), ...blockNodes(rest, o, `${key}.${j}.r`)]
            : blockNodes(it.blocks, o, `${key}.${j}.`);
          const box = it.task ? h("input", { type: "checkbox", disabled: true, checked: it.checked, class: "z-markdown__task" }) : null;
          return h("li", { key: String(j), "data-task": it.task ? "" : undefined }, box, ...body);
        });
        return b.ordered ? h("ol", { key, start: b.start !== 1 ? b.start : undefined }, ...items) : h("ul", { key }, ...items);
      }
      default:
        return null;
    }
  });
}

/** Árbol de un Markdown dentro de `div.z-markdown`. */
export function markdownTree(source: string | readonly Block[], o: MarkdownTreeOptions = {}): VEl {
  const blocks = typeof source === "string" ? parseMarkdown(source) : source;
  return h("div", { class: "z-markdown" }, ...blockNodes(blocks, o, "b"));
}

/** Texto plano de unos bloques (copiar una respuesta sin marcas, contar palabras). */
export function markdownText(source: string | readonly Block[]): string {
  const blocks = typeof source === "string" ? parseMarkdown(source) : source;
  const inline = (list: readonly Inline[]): string =>
    list
      .map((n) =>
        typeof n === "string"
          ? n
          : n.type === "br"
            ? "\n"
            : n.type === "code"
              ? n.text
              : n.type === "cite"
                ? `[${n.n}]`
                : inline(n.children),
      )
      .join("");
  const walk = (bs: readonly Block[]): string[] =>
    bs.flatMap((b) => {
      switch (b.type) {
        case "p":
        case "h":
          return [inline(b.inline)];
        case "code":
          return [b.code];
        case "hr":
          return [];
        case "quote":
          return walk(b.blocks);
        case "list":
          return b.items.map((it, j) => `${b.ordered ? `${b.start + j}.` : "-"} ${walk(it.blocks).join("\n")}`);
        case "table":
          return [b.head.map(inline).join("\t"), ...b.rows.map((r) => r.map(inline).join("\t"))];
        default:
          return [];
      }
    });
  return walk(blocks).join("\n\n");
}
