// Lectura de HTML de contenido a un documento: títulos, párrafos, énfasis, enlaces, imágenes, listas, citas, secciones
// e iconos (los bloques del conector). Sirve para importar texto pegado o una página sencilla, y para comprobar que
// documento → HTML → documento conserva el contenido. Lo que no reconoce no se inventa: se lista en `skipped`.
// Lector propio y sin documento del navegador (funciona en Node y en un worker); no ejecuta ni carga nada.

import { idGenerator } from "./tree";
import { DOCUMENT_FORMAT, DOCUMENT_SCHEMA_VERSION, type ElementNode, type JsonValue, type PageDocument, type PageNode } from "./types";

export interface ParseResult {
  document: PageDocument;
  /** Elementos que no corresponden a un bloque del conector (se descartan con su contenido). */
  skipped: string[];
}

interface Tag {
  name: string;
  attrs: Record<string, string>;
  kids: (Tag | string)[];
}

const VOID = new Set(["img", "br", "hr", "input", "meta", "link", "source", "col", "wbr"]);
const RAW = new Set(["script", "style", "template", "textarea", "title"]);

const ENTITY: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (all, e: string) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? Number.parseInt(e.slice(2), 16) : Number.parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : all;
    }
    return ENTITY[e.toLowerCase()] ?? all;
  });
}

function tokenize(html: string): Tag {
  const root: Tag = { name: "#root", attrs: {}, kids: [] };
  const stack: Tag[] = [root];
  const re =
    /<!--[\s\S]*?-->|<\/([a-zA-Z][\w-]*)\s*>|<([a-zA-Z][\w-]*)((?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*\/?>|([^<]+|<)/g;
  let m: RegExpExecArray | null = re.exec(html);
  while (m !== null) {
    const top = stack[stack.length - 1] as Tag;
    if (m[1]) {
      const name = m[1].toLowerCase();
      const at = stack.map((t) => t.name).lastIndexOf(name);
      if (at > 0) stack.length = at;
    } else if (m[2]) {
      const name = m[2].toLowerCase();
      const attrs: Record<string, string> = {};
      for (const a of (m[3] ?? "").matchAll(/([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g))
        attrs[(a[1] as string).toLowerCase()] = decodeEntities(a[2] ?? a[3] ?? a[4] ?? "");
      const tag: Tag = { name, attrs, kids: [] };
      top.kids.push(tag);
      if (RAW.has(name)) {
        const close = html.toLowerCase().indexOf(`</${name}`, re.lastIndex);
        re.lastIndex = close < 0 ? html.length : close;
      } else if (!VOID.has(name) && !m[0].endsWith("/>")) stack.push(tag);
    } else if (m[4] !== undefined) top.kids.push(decodeEntities(m[4]));
    m = re.exec(html);
  }
  return root;
}

const INLINE = new Set(["strong", "em", "code", "kbd", "mark", "small", "s", "span", "sub", "sup"]);
const SECTIONS = new Set(["div", "section", "article", "header", "footer", "main", "aside", "nav"]);

/** Lee HTML de contenido. El texto entre bloques que solo son espacios (sangrado) se descarta. */
export function fromHTML(html: string, o: { nextId?: () => string } = {}): ParseResult {
  const nextId = o.nextId ?? idGenerator("h");
  const skipped: string[] = [];
  const el = (type: string, props: Record<string, JsonValue> | null, kids: PageNode[]): ElementNode => {
    const n: ElementNode = { id: nextId(), type };
    if (props && Object.keys(props).length) n.props = props;
    if (kids.length) n.children = kids;
    return n;
  };
  const convert = (list: (Tag | string)[], inline: boolean): PageNode[] => {
    const out: PageNode[] = [];
    for (const k of list) {
      if (typeof k === "string") {
        if (inline ? k !== "" : k.trim() !== "") out.push({ id: nextId(), type: "#text", text: inline ? k : k.trim() });
        continue;
      }
      const n = node(k);
      if (n) out.push(n);
    }
    return out;
  };
  const node = (t: Tag): PageNode | null => {
    const h = /^h([1-6])$/.exec(t.name);
    if (h) return el("Heading", { level: Number(h[1]) }, convert(t.kids, true));
    if (t.name === "p") return el("Paragraph", null, convert(t.kids, true));
    if (INLINE.has(t.name)) return el("InlineText", { tag: t.name }, convert(t.kids, true));
    if (t.name === "a") return el("Anchor", t.attrs.href !== undefined ? { href: t.attrs.href } : null, convert(t.kids, true));
    if (t.name === "img") {
      const props: Record<string, JsonValue> = {};
      if (t.attrs.src !== undefined) props.src = t.attrs.src;
      props.alt = t.attrs.alt ?? "";
      for (const k of ["width", "height"] as const) if (t.attrs[k] && /^\d+$/.test(t.attrs[k] as string)) props[k] = Number(t.attrs[k]);
      if (t.attrs.loading === "eager") props.loading = "eager";
      return el("Image", props, []);
    }
    if (t.name === "ul" || t.name === "ol")
      return el(
        "List",
        t.name === "ol" ? { ordered: true } : null,
        t.kids
          .filter((k): k is Tag => typeof k !== "string" && k.name === "li")
          .map((li) => el("ListItem", null, convert(li.kids, hasInlineOnly(li)))),
      );
    if (t.name === "blockquote")
      return el("Quote", t.attrs.cite !== undefined ? { cite: t.attrs.cite } : null, convert(t.kids, hasInlineOnly(t)));
    if (SECTIONS.has(t.name)) {
      const props: Record<string, JsonValue> = { tag: t.name };
      if (t.attrs["aria-label"]) props.label = t.attrs["aria-label"];
      return el("Section", props, convert(t.kids, false));
    }
    if (t.name === "z-icon") {
      const props: Record<string, JsonValue> = { name: t.attrs.name ?? "star" };
      if (t.attrs.size && /^\d+$/.test(t.attrs.size)) props.size = Number(t.attrs.size);
      if (t.attrs.variant === "solid") props.variant = "solid";
      if (t.attrs.label) props.label = t.attrs.label;
      return el("Icon", props, []);
    }
    skipped.push(t.name);
    return null;
  };
  const root = tokenize(html);
  return { document: { format: DOCUMENT_FORMAT, schemaVersion: DOCUMENT_SCHEMA_VERSION, body: convert(root.kids, false) }, skipped };
}

/** Si un elemento solo tiene texto y elementos en línea (entonces su texto se conserva tal cual, con espacios). */
function hasInlineOnly(t: Tag): boolean {
  return t.kids.every((k) => typeof k === "string" || INLINE.has(k.name) || k.name === "a" || k.name === "img" || k.name === "z-icon");
}
