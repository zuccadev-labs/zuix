// Exportar un elemento (un diagrama, un lienzo de nodos, una tarjeta) a SVG autocontenido y a PNG, sin dependencias.
// El SVG lleva el HTML clonado en un `<foreignObject>` con cada estilo resuelto a su valor (sin `var()`, sin hojas
// externas): se ve igual fuera de la página. Los pseudoelementos con contenido se vuelven elementos, las imágenes del
// mismo origen se incrustan como `data:` y, si se pide, las fuentes también (desde las reglas `@font-face` legibles de
// la página). El PNG se rasteriza en un `<canvas>` desde ese SVG. Solo en el navegador y solo al llamarlo: importar el
// módulo no toca el documento.
//
// Límites: un SVG que abre otra aplicación necesita las fuentes instaladas o incrustadas (`embedFonts`, `fontCSS`);
// los recursos de otro origen sin CORS no se pueden incrustar y se omiten; `<canvas>` y vídeo salen como su
// fotograma actual solo si el navegador deja leerlos.

import { redactText, type RedactOptions, redactionOptions, type SensitiveKind } from "./redact";

export interface ExportOptions {
  /** Ancho y alto del resultado en px CSS. Por defecto, el contenido completo del elemento. */
  width?: number;
  height?: number;
  /** Fondo: un color, `null` para transparente o `auto` (el del elemento o el primero de sus antepasados). Por defecto `auto`. */
  background?: string | null;
  /** Margen alrededor del contenido (lienzos de nodos). Por defecto 32. */
  padding?: number;
  /** Escala del PNG (píxeles por px CSS). Por defecto 2. */
  scale?: number;
  /** Incrusta las fuentes que usa el contenido (reglas `@font-face` legibles de la página). Por defecto sí. */
  embedFonts?: boolean;
  /** CSS adicional (por ejemplo `@font-face` con `src: url(data:…)`) que se escribe en el SVG. */
  fontCSS?: string;
  /** Enmascara los datos sensibles: `true` solo los marcados (`[data-sensitive]`), `"all"` todo el texto. */
  redact?: boolean | "all";
  /** Opciones del enmascarado. Por defecto, las del interruptor global. */
  redactOptions?: RedactOptions;
  /** Descarta elementos del clon (además del cromo: controles, minimapa, `[data-export="skip"]`). */
  filter?: (el: Element) => boolean;
  /** Título del SVG (`<title>`), su nombre accesible. */
  title?: string;
}

const SVG_NS = "http://www.w3.org/2000/svg";
const XHTML_NS = "http://www.w3.org/1999/xhtml";
/** Lo que nunca va en una exportación: el cromo interactivo y lo que la aplicación marca. */
export const EXPORT_SKIP =
  '.z-node-controls, .z-node-minimap, .z-node-canvas__selection, .z-node-canvas__overlay, .z-node-canvas__descs, .z-node-canvas__desc, .z-node-canvas__menu, .z-node__resize, [data-export="skip"], script, noscript, template, style, link';
/** Propiedades que no cambian lo que se ve o que solo estorban en una imagen fija. */
const IGNORED =
  /^(?:--|transition|animation|cursor|pointer-events|will-change|user-select|-webkit-user-select|touch-action|caret|scroll-|overscroll|content-visibility|contain-intrinsic|view-transition|interactivity|-webkit-locale|-webkit-tap|-webkit-user-drag)/;
const URL_REF = /url\(\s*["']?[^"')]*?(#[^"')]+)["']?\s*\)/g;

/** Cadena segura dentro de XML (texto o atributo entre comillas dobles). */
export const escapeXML = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** `url("http://…/page#id")` → `url(#id)`: las referencias a marcadores y degradados siguen dentro del SVG. */
export const localRefs = (value: string) => value.replace(URL_REF, (_m, hash: string) => `url(${hash})`);

/** Tamaño del PNG dentro de los límites de un `<canvas>` (16 384 px de lado, 268 Mpx de área). */
export function pngSize(width: number, height: number, scale = 2): { width: number; height: number; scale: number } {
  const w = Math.max(1, Math.ceil(width));
  const h = Math.max(1, Math.ceil(height));
  let s = Math.max(0.1, scale);
  s = Math.min(s, 16384 / w, 16384 / h, Math.sqrt(268_000_000 / (w * h)));
  return { width: Math.max(1, Math.floor(w * s)), height: Math.max(1, Math.floor(h * s)), scale: s };
}

/** Documento SVG con el HTML ya serializado dentro de un `<foreignObject>`. */
export function svgDocument(o: {
  width: number;
  height: number;
  body: string;
  background?: string | null;
  css?: string;
  title?: string;
}): string {
  const w = Math.max(1, Math.round(o.width));
  const h = Math.max(1, Math.round(o.height));
  const title = o.title ? `<title>${escapeXML(o.title)}</title>` : "";
  // `</style` dentro del CSS cerraría el elemento: se corta.
  const css = o.css ? `<style>${o.css.replace(/<\/style/gi, "<\\/style").replace(/]]>/g, "]]\\>")}</style>` : "";
  const bg = o.background ? `<rect width="100%" height="100%" fill="${escapeXML(o.background)}"/>` : "";
  return `<svg xmlns="${SVG_NS}" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img">${title}${css}${bg}<foreignObject x="0" y="0" width="${w}" height="${h}"><div xmlns="${XHTML_NS}" style="width:${w}px;height:${h}px;position:relative;overflow:hidden">${o.body}</div></foreignObject></svg>`;
}

/** URLs de la regla `src` de un `@font-face` (en orden; prefiere woff2). */
export function fontSources(src: string): string[] {
  const out: string[] = [];
  for (const m of src.matchAll(/url\(\s*(["']?)([^"')]+)\1\s*\)/g)) out.push(m[2]!);
  return out.sort((a, b) => Number(!/\.woff2(?:$|[?#])/i.test(a)) - Number(!/\.woff2(?:$|[?#])/i.test(b)));
}

/** Familias de un valor de `font-family`, sin comillas y en minúsculas. */
export const fontFamilies = (value: string) =>
  value
    .split(",")
    .map((f) =>
      f
        .trim()
        .replace(/^["']|["']$/g, "")
        .toLowerCase(),
    )
    .filter(Boolean);

// ── Navegador ───────────────────────────────────────────────────────────────────────────────────────────────

interface Defaults {
  doc: Document;
  frame: HTMLIFrameElement;
  cache: Map<string, Map<string, string>>;
}

/** Documento en blanco (sin las hojas de la página) para conocer el estilo por defecto de cada etiqueta. */
function defaults(doc: Document): Defaults {
  const frame = doc.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.tabIndex = -1;
  frame.style.setProperty("position", "fixed");
  frame.style.setProperty("inset-inline-start", "-10000px");
  frame.style.setProperty("inline-size", "10px");
  frame.style.setProperty("block-size", "10px");
  frame.style.setProperty("visibility", "hidden");
  doc.body.append(frame);
  return { doc: frame.contentDocument ?? doc, frame, cache: new Map() };
}

function defaultStyle(d: Defaults, ns: string | null, tag: string): Map<string, string> {
  const key = `${ns}|${tag}`;
  const known = d.cache.get(key);
  if (known) return known;
  const holder = ns === SVG_NS ? d.doc.createElementNS(SVG_NS, "svg") : d.doc.body;
  if (ns === SVG_NS) d.doc.body.append(holder);
  const el = ns ? d.doc.createElementNS(ns, tag) : d.doc.createElement(tag);
  holder.append(el);
  const cs = d.doc.defaultView!.getComputedStyle(el);
  const out = new Map<string, string>();
  for (let i = 0; i < cs.length; i++) {
    const p = cs[i]!;
    out.set(p, cs.getPropertyValue(p));
  }
  el.remove();
  if (ns === SVG_NS) holder.remove();
  d.cache.set(key, out);
  return out;
}

/** Declaraciones que difieren del estilo por defecto de la etiqueta. */
function styleText(cs: CSSStyleDeclaration, base: Map<string, string>, extra: Record<string, string> = {}): string {
  const parts: string[] = [];
  for (let i = 0; i < cs.length; i++) {
    const p = cs[i]!;
    if (IGNORED.test(p) || p in extra) continue;
    const v = cs.getPropertyValue(p);
    if (v === base.get(p)) continue;
    parts.push(`${p}:${localRefs(v)}`);
  }
  for (const [p, v] of Object.entries(extra)) parts.push(`${p}:${v}`);
  return parts.join(";");
}

async function toDataURL(url: string, doc: Document): Promise<string | null> {
  if (url.startsWith("data:")) return url;
  try {
    const abs = new URL(url, doc.baseURI);
    if (abs.protocol !== "http:" && abs.protocol !== "https:" && abs.protocol !== "blob:") return null;
    const res = await fetch(abs.href, { mode: "cors", credentials: "same-origin" });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Reglas `@font-face` legibles de la página para las familias usadas, con sus archivos incrustados. */
export async function collectFontCSS(doc: Document, families: ReadonlySet<string>): Promise<string> {
  const rules: { family: string; css: string; src: string[]; base: string }[] = [];
  for (const sheet of [...doc.styleSheets]) {
    let list: CSSRuleList;
    try {
      list = sheet.cssRules;
    } catch {
      continue; // Hoja de otro origen sin CORS: no se puede leer.
    }
    const walk = (rs: CSSRuleList) => {
      for (const r of [...rs]) {
        if (r.constructor.name === "CSSFontFaceRule" || r.type === 5) {
          const style = (r as CSSFontFaceRule).style;
          const family = fontFamilies(style.getPropertyValue("font-family"))[0] ?? "";
          if (families.has(family))
            rules.push({ family, css: r.cssText, src: fontSources(style.getPropertyValue("src")), base: sheet.href ?? doc.baseURI });
        } else if ("cssRules" in r && (r as CSSGroupingRule).cssRules) walk((r as CSSGroupingRule).cssRules);
      }
    };
    walk(list);
  }
  const out: string[] = [];
  for (const rule of rules) {
    const first = rule.src[0];
    if (!first) continue;
    const data = await toDataURL(new URL(first, rule.base).href, doc);
    if (!data) continue;
    out.push(rule.css.replace(/src\s*:[^;}]+/i, `src: url("${data}")`));
  }
  return out.join("\n");
}

interface CloneContext {
  d: Defaults;
  win: Window;
  skip: (el: Element) => boolean;
  redact: false | true | "all";
  redactOptions: RedactOptions;
  families: Set<string>;
  images: Promise<void>[];
}

const sensitiveKind = (el: Element | null): SensitiveKind | null => {
  const holder = el?.closest?.("[data-sensitive]");
  if (!holder) return null;
  const v = holder.getAttribute("data-sensitive");
  return v === "domain" || v === "ip" || v === "email" || v === "text" ? v : "auto";
};

function pseudo(el: Element, which: "::before" | "::after", c: CloneContext): HTMLElement | null {
  const cs = c.win.getComputedStyle(el, which);
  const content = cs.getPropertyValue("content");
  if (!content || content === "none" || content === "normal") return null;
  const out = el.ownerDocument.createElementNS(XHTML_NS, "span") as HTMLElement;
  const text = /^["'](.*)["']$/.exec(content)?.[1] ?? "";
  if (text) out.textContent = text.replace(/\\([0-9a-f]{1,6})\s?/gi, (_m, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)));
  out.setAttribute("style", styleText(cs, defaultStyle(c.d, null, "span")));
  out.setAttribute("aria-hidden", "true");
  return out;
}

function cloneNode(node: Node, c: CloneContext): Node | null {
  if (node.nodeType === 3) {
    const text = node.nodeValue ?? "";
    if (!c.redact) return node.ownerDocument!.createTextNode(text);
    const kind = c.redact === "all" ? "auto" : sensitiveKind(node.parentElement);
    return node.ownerDocument!.createTextNode(kind ? redactText(text, kind, c.redactOptions) : text);
  }
  if (node.nodeType !== 1) return null;
  const el = node as Element;
  if (c.skip(el)) return null;
  const cs = c.win.getComputedStyle(el);
  if (cs.display === "none") return null;
  const ns = el.namespaceURI;
  const tag = el.localName;
  const copy = el.ownerDocument.createElementNS(ns ?? XHTML_NS, tag);
  for (const a of [...el.attributes]) {
    const name = a.name;
    if (/^on/i.test(name) || name === "style" || name === "class" || name === "tabindex" || name === "contenteditable") continue;
    if ((name === "href" || name === "src" || name === "xlink:href") && /^\s*javascript:/i.test(a.value)) continue;
    try {
      copy.setAttribute(name, a.value);
    } catch {
      // Un atributo con un nombre que XML no admite se omite.
    }
  }
  for (const f of fontFamilies(cs.getPropertyValue("font-family"))) c.families.add(f);
  const extra: Record<string, string> = { animation: "none", transition: "none" };
  copy.setAttribute("style", styleText(cs, defaultStyle(c.d, ns === XHTML_NS ? null : ns, tag), extra));
  if (tag === "img" || (ns === SVG_NS && tag === "image")) {
    const attr = tag === "img" ? "src" : el.hasAttribute("href") ? "href" : "xlink:href";
    const src = tag === "img" ? (el as HTMLImageElement).currentSrc || el.getAttribute("src") || "" : (el.getAttribute(attr) ?? "");
    if (src && !src.startsWith("data:"))
      c.images.push(
        toDataURL(src, el.ownerDocument).then((data) => {
          if (data) copy.setAttribute(attr, data);
          else copy.removeAttribute(attr);
        }),
      );
    if (tag === "img") copy.removeAttribute("srcset");
  }
  if (tag === "input" || tag === "textarea") copy.setAttribute("value", (el as HTMLInputElement).value);
  const before = ns === XHTML_NS ? pseudo(el, "::before", c) : null;
  if (before) copy.append(before);
  for (const child of [...el.childNodes]) {
    const k = cloneNode(child, c);
    if (k) copy.append(k);
  }
  const after = ns === XHTML_NS ? pseudo(el, "::after", c) : null;
  if (after) copy.append(after);
  return copy;
}

/** Fondo efectivo: el del elemento o el primero opaco de sus antepasados. */
function effectiveBackground(el: Element, win: Window): string | null {
  for (let cur: Element | null = el; cur; cur = cur.parentElement) {
    const bg = win.getComputedStyle(cur).backgroundColor;
    if (bg && bg !== "transparent" && !/rgba\(.*,\s*0\)$/.test(bg)) return bg;
  }
  return null;
}

export interface CloneResult {
  /** Clon con los estilos resueltos. */
  node: Element;
  width: number;
  height: number;
  background: string | null;
  css: string;
}

/**
 * Clona `el` con sus estilos resueltos. `prepare` puede retocar el clon (un lienzo de nodos quita la vista y encuadra
 * el contenido). Espera a que se incrusten las imágenes y, si se pide, las fuentes.
 */
export async function cloneForExport(
  el: Element,
  o: ExportOptions = {},
  prepare?: (clone: HTMLElement) => { width: number; height: number } | undefined,
): Promise<CloneResult> {
  const doc = el.ownerDocument;
  const win = doc.defaultView!;
  const d = defaults(doc);
  try {
    const ctx: CloneContext = {
      d,
      win,
      skip: (e) => e.matches(EXPORT_SKIP) || (o.filter ? !o.filter(e) : false),
      redact: o.redact ?? false,
      redactOptions: o.redactOptions ?? redactionOptions(),
      families: new Set(),
      images: [],
    };
    const node = cloneNode(el, ctx) as HTMLElement;
    const rect = el.getBoundingClientRect();
    let width = o.width ?? Math.max(rect.width, (el as HTMLElement).scrollWidth || 0);
    let height = o.height ?? Math.max(rect.height, (el as HTMLElement).scrollHeight || 0);
    // El clon va arriba a la izquierda del documento exportado, sin desplazamiento ni margen propios.
    node.style.setProperty("margin", "0");
    node.style.setProperty("position", "relative");
    node.style.setProperty("inset", "auto");
    node.style.setProperty("translate", "none");
    node.style.setProperty("transform", "none");
    const sized = prepare?.(node);
    if (sized) {
      width = o.width ?? sized.width;
      height = o.height ?? sized.height;
    }
    node.style.setProperty("width", `${Math.ceil(width)}px`);
    node.style.setProperty("height", `${Math.ceil(height)}px`);
    node.style.setProperty("max-width", "none");
    node.style.setProperty("max-height", "none");
    await Promise.all(ctx.images);
    const fonts = o.embedFonts !== false ? await collectFontCSS(doc, ctx.families) : "";
    const background = o.background === undefined || o.background === "auto" ? effectiveBackground(el, win) : o.background;
    return { node, width, height, background, css: [fonts, o.fontCSS ?? ""].filter(Boolean).join("\n") };
  } finally {
    d.frame.remove();
  }
}

/** SVG autocontenido de un elemento ya clonado. */
export function cloneToSVG(c: CloneResult, title?: string): string {
  const body = new XMLSerializer().serializeToString(c.node);
  return svgDocument({ width: c.width, height: c.height, body, background: c.background, css: c.css, title });
}

/** SVG autocontenido (texto) de un elemento. */
export async function exportSVG(el: Element, o: ExportOptions = {}): Promise<string> {
  return cloneToSVG(await cloneForExport(el, o), o.title);
}

/** Rasteriza un SVG (texto) a PNG. */
export async function svgToPNG(svg: string, width: number, height: number, scale = 2, doc: Document = document): Promise<Blob> {
  const size = pngSize(width, height, scale);
  const img = new Image();
  img.decoding = "sync";
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await img.decode();
  const canvas = doc.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const g = canvas.getContext("2d");
  if (!g) throw new Error("[zui] canvas 2d no disponible");
  g.scale(size.scale, size.scale);
  g.drawImage(img, 0, 0, Math.ceil(width), Math.ceil(height));
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("[zui] no se pudo crear el PNG"))), "image/png"),
  );
}

/** PNG de un elemento. */
export async function exportPNG(el: Element, o: ExportOptions = {}): Promise<Blob> {
  const c = await cloneForExport(el, o);
  return svgToPNG(cloneToSVG(c, o.title), c.width, c.height, o.scale ?? 2, el.ownerDocument);
}
