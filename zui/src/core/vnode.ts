// Árbol de nodos sin framework que comparten las vistas de la agenda (EventCalendar, línea temporal, año perpetuo,
// franjas, mapa de calor, rachas): el binding de React lo convierte en elementos y el modo DOM en nodos (el texto
// siempre como texto, nunca como marcado). Un solo origen para el contrato HTML de las dos vías. Sin documento.

export type VAttr = string | number | boolean | null | undefined;
export interface VEl {
  t: string;
  a?: Record<string, VAttr>;
  /** Variables locales de estilo (`--z-…`): solo maquetación calculada. */
  s?: Record<string, string | number>;
  c?: VNode[];
  k?: string;
}
/** Hueco que pinta cada vía a su manera: un icono, el minicalendario de la agenda o un Calendar. */
export interface VSlot {
  slot: "icon" | "minical" | "calendar" | "event";
  p: Record<string, unknown>;
  k?: string;
}
export type VNode = VEl | VSlot | string | null | undefined | false;

type HAttrs = Record<string, VAttr | Record<string, string | number>>;
export const h = (t: string, a?: HAttrs | null, ...c: VNode[]): VEl => {
  const el: VEl = { t };
  if (a) {
    const { key, s: style, ...rest } = a;
    if (key !== undefined && key !== null) el.k = String(key);
    if (style && typeof style === "object") el.s = style;
    el.a = rest as Record<string, VAttr>;
  }
  const kids = c.filter((x) => x !== null && x !== undefined && x !== false);
  if (kids.length) el.c = kids;
  return el;
};
export const icon = (name: string, size = 16): VSlot => ({ slot: "icon", p: { name, size } });
/** Atributo booleano de estado: `""` si es verdadero, ausente si no. */
export const on = (v: boolean | undefined) => (v ? "" : undefined);
export const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? `{${k}}`));

/** HTML del árbol (para el contrato HTML y las pruebas). Escapa texto y atributos. */
export function toHTML(
  node: VNode,
  iconHTML: (name: string, size: number) => string = (n, s) => `<z-icon name="${n}" size="${s}"></z-icon>`,
): string {
  if (node === null || node === undefined || node === false) return "";
  if (typeof node === "string") return escapeText(node);
  if ("slot" in node) {
    if (node.slot === "icon") return iconHTML(String(node.p.name), Number(node.p.size));
    if (node.slot === "event") return '<span class="z-event__custom"></span>';
    const cls = node.slot === "minical" ? "z-calendar z-agenda__minical" : `z-calendar${node.p.className ? ` ${node.p.className}` : ""}`;
    return `<div class="${cls}"${Object.entries((node.p.attrs ?? {}) as Record<string, VAttr>)
      .map(([k, v]) => attrHTML(k, v))
      .join("")}></div>`;
  }
  const attrs = Object.entries(node.a ?? {})
    .map(([k, v]) => attrHTML(k, v))
    .join("");
  const style = node.s
    ? ` style="${escapeAttr(
        Object.entries(node.s)
          .map(([k, v]) => `${k}: ${v}`)
          .join("; "),
      )}"`
    : "";
  const inner = (node.c ?? []).map((c) => toHTML(c, iconHTML)).join("");
  return VOID.has(node.t) ? `<${node.t}${attrs}${style}>` : `<${node.t}${attrs}${style}>${inner}</${node.t}>`;
}
const VOID = new Set(["input", "br", "hr", "img", "col"]);
const escapeText = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escapeAttr = (s: string) => escapeText(s).replace(/"/g, "&quot;");
function attrHTML(k: string, v: VAttr): string {
  if (v === null || v === undefined || v === false) return "";
  if (v === true || v === "") return ` ${k}`;
  return ` ${k}="${escapeAttr(String(v))}"`;
}

/** Primer hueco del tipo pedido en el árbol (el modo DOM lo completa tras pintar). */
export function findSlots(nodes: VNode[], kind: VSlot["slot"], out: VSlot[] = []): VSlot[] {
  for (const n of nodes) {
    if (!n || typeof n === "string") continue;
    if ("slot" in n) {
      if (n.slot === kind) out.push(n);
      continue;
    }
    findSlots(n.c ?? [], kind, out);
  }
  return out;
}

/** Formateadores de `Intl` en UTC (fechas civiles y minutos de pared), cacheados por locale y opciones. */
const formats = new Map<string, Intl.DateTimeFormat>();
export function fmt(locale: string | undefined, options: Intl.DateTimeFormatOptions, timeZone = "UTC"): Intl.DateTimeFormat {
  const key = `${locale ?? ""}|${timeZone}|${JSON.stringify(options)}`;
  let f = formats.get(key);
  if (!f) {
    let resolved: string | undefined;
    try {
      resolved = locale ? Intl.getCanonicalLocales(locale)[0] : undefined;
    } catch {
      resolved = undefined;
    }
    f = new Intl.DateTimeFormat(resolved, { ...options, timeZone });
    formats.set(key, f);
  }
  return f;
}
