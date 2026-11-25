// Serialización del documento al marcado del contrato (`html.json`). Cada bloque `template` tiene aquí una función
// que produce el mismo árbol que su componente de React, sobre `core/vnode`: el texto y los atributos se escapan al
// escribir, las etiquetas y los nombres de atributo son fijos, los valores de enumeración se reducen a los
// admitidos y las URL pasan por `safeUrl`. `pnpm check` compara la salida con `html.json` en cada ejemplo.
// Sin documento del navegador: `toHTML` funciona en Node, en un worker o en el servidor.

import { trustedHTML } from "../trusted";
import { type VEl, type VNode, toHTML as vnodeHTML } from "../core/vnode";
import type { A11yRule, Catalog, ContentCategory, JsonSchema, JsonValue, PageDocument, PageNode, SlotRule, StyleSpec } from "./types";
import { isText } from "./types";
import { CHILDREN, slotOf } from "./tree";

/** Lo que recibe la función de un bloque. */
export interface RenderContext {
  /** Props del nodo con los valores por defecto del bloque aplicados. */
  props: Record<string, JsonValue>;
  /** Hijos ya convertidos. */
  children: VNode[];
  /** Un hueco con nombre ya convertido (lista vacía si no hay). */
  slot(name: string): VNode[];
  /** Si el hueco tiene algo. */
  has(name: string): boolean;
  /** Texto plano de los hijos. */
  text: string;
  /** Id del nodo (para ids derivados estables). */
  id: string;
}

/** Definición de un bloque del conector: metadatos de edición y su serialización. */
export interface BlockSpec {
  type: string;
  package: "zui" | "zout" | "core";
  /** Solo en bloques del conector (`core`), que no tienen manifiesto. */
  group?: string;
  title?: string;
  description?: string;
  icon: string;
  categories: ContentCategory[];
  layout?: boolean;
  children?: SlotRule;
  slots?: Record<string, SlotRule>;
  parents?: string[];
  a11y?: A11yRule[];
  /**
   * Props editables. `true` toma el esquema del manifiesto del componente; un objeto lo da (o lo completa con
   * `x-control`, rangos o patrones). Las props que no aparecen no se editan ni se serializan.
   */
  props: Record<string, JsonSchema | true>;
  render(ctx: RenderContext): VEl;
}

const ALLOWED_SCHEMES = /^(?:https?|mailto|tel):$/i;
const IMAGE_DATA = /^data:image\/(?:png|jpeg|gif|webp|avif);base64,[a-z0-9+/=\s]+$/i;

/**
 * URL segura para `href` o `src`: relativa, de ancla, http(s), mailto o tel (y en imágenes, `data:` de mapa de bits).
 * Cualquier otra (`javascript:`, `data:text/html`, `vbscript:`) devuelve `undefined` y el atributo no se escribe:
 * escapar entidades no neutraliza un esquema peligroso.
 */
export function safeUrl(value: unknown, kind: "link" | "image" = "link"): string | undefined {
  if (typeof value !== "string") return undefined;
  const url = value.trim();
  if (!url) return undefined;
  if (kind === "image" && IMAGE_DATA.test(url)) return url;
  // Los navegadores ignoran tabuladores y saltos dentro del esquema (`java\tscript:`): se quitan antes de mirarlo.
  const compact = [...url]
    .filter((ch) => {
      const c = ch.charCodeAt(0);
      return c > 0x20 && (c < 0x7f || c > 0x9f);
    })
    .join("");
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(compact);
  if (!scheme) return /^[\\/]{2}/.test(compact) ? undefined : url;
  return ALLOWED_SCHEMES.test(scheme[0]) ? url : undefined;
}

/** Valor de enumeración admitido o el de respaldo: un documento sin validar no puede inventar una etiqueta. */
export function oneOf<T extends JsonValue>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

const str = (v: unknown) => (typeof v === "string" ? v : typeof v === "number" ? String(v) : undefined);
const TOKEN = /^[a-z][a-z0-9-]*$/;

/** Estilo de un nodo como variables CSS de tokens. Ignora lo que no esté en `spec` (sin catálogo, solo el patrón). */
export function styleOf(style: Record<string, string | undefined> | undefined, spec?: StyleSpec): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(style ?? {})) {
    if (typeof value !== "string") continue;
    const rule = spec?.[key] ?? DEFAULT_STYLE[key];
    if (!rule) continue;
    if (rule.keywords?.includes(value)) out[rule.css] = value;
    else if (TOKEN.test(value) && (!rule.tokens || rule.tokens.includes(value))) out[rule.css] = `var(--z-${value})`;
  }
  return out;
}

/** Propiedades de `style` y la propiedad CSS que escriben. El catálogo añade la lista de tokens de cada una. */
export const DEFAULT_STYLE: StyleSpec = {
  padding: { css: "padding" },
  paddingBlock: { css: "padding-block" },
  paddingInline: { css: "padding-inline" },
  margin: { css: "margin" },
  marginBlock: { css: "margin-block" },
  marginInline: { css: "margin-inline" },
  gap: { css: "gap" },
  background: { css: "background" },
  color: { css: "color" },
  radius: { css: "border-radius" },
  maxWidth: { css: "max-width" },
  textAlign: { css: "text-align", keywords: ["start", "center", "end"] },
};

export interface HtmlOptions {
  /** Catálogo: hace falta para los bloques `preset` (su marcado) y para limitar `style` a sus tokens. */
  catalog?: Catalog;
  /** Bloques extra o que sustituyen a los de serie (un adaptador que añade los suyos). */
  blocks?: readonly BlockSpec[];
  /** Escribe `data-z-node="<id>"` en la raíz de cada bloque (lo usa el lienzo). Por defecto no. */
  ids?: boolean;
}

export class RenderError extends Error {
  constructor(
    message: string,
    readonly nodeId: string,
  ) {
    super(message);
    this.name = "RenderError";
  }
}

/** Marcado de un preset (bloques `preset`): el que fija el contrato, sin pasar por las props. */
export interface RawHtml {
  slot: "html";
  html: string;
  id: string;
}

type Out = VNode | RawHtml;

/** Registro de bloques con su función de serialización. */
export function registry(blocks: readonly BlockSpec[]): Map<string, BlockSpec> {
  return new Map(blocks.map((b) => [b.type, b]));
}

/** Props del nodo con los valores por defecto del esquema del bloque. */
export function withDefaults(spec: BlockSpec, props: Record<string, JsonValue> | undefined, catalog?: Catalog): Record<string, JsonValue> {
  const out: Record<string, JsonValue> = {};
  const schema = catalog?.blocks.find((b) => b.type === spec.type)?.props.properties;
  for (const [name, s] of Object.entries(spec.props)) {
    const def = typeof s === "object" ? s.default : schema?.[name]?.default;
    if (def !== undefined) out[name] = def;
  }
  for (const [k, v] of Object.entries(props ?? {})) if (k in spec.props) out[k] = v;
  return out;
}

/** Convierte una lista de nodos en árboles de `core/vnode` (o marcado de preset). */
export function toTrees(list: readonly PageNode[], blocks: Map<string, BlockSpec>, o: HtmlOptions = {}): Out[] {
  return list.map((node) => toTree(node, blocks, o));
}

function toTree(node: PageNode, blocks: Map<string, BlockSpec>, o: HtmlOptions): Out {
  if (isText(node)) return node.text;
  const spec = blocks.get(node.type);
  if (!spec) {
    const block = o.catalog?.blocks.find((b) => b.type === node.type);
    if (block?.html === "preset") {
      const preset = block.presets.find((p) => p.id === node.preset);
      if (!preset?.html) throw new RenderError(`${node.type}: el preset "${node.preset ?? ""}" no existe o no tiene marcado`, node.id);
      return { slot: "html", html: preset.html, id: node.id };
    }
    throw new RenderError(
      block ? `${node.type} no tiene contrato HTML: solo sale por toReact` : `el tipo "${node.type}" no existe en el catálogo`,
      node.id,
    );
  }
  const kids = (slot: string) => toTrees(slotOf(node, slot), blocks, o) as VNode[];
  const ctx: RenderContext = {
    props: withDefaults(spec, node.props, o.catalog),
    children: kids(CHILDREN),
    slot: kids,
    has: (name) => slotOf(node, name).length > 0,
    text: slotOf(node)
      .map((c) => (isText(c) ? c.text : ""))
      .join(""),
    id: node.id,
  };
  const el = spec.render(ctx);
  const style = styleOf(node.style, o.catalog?.style);
  const extra: Record<string, string> = o.ids ? { "data-z-node": node.id } : {};
  return {
    ...el,
    a: { ...el.a, ...extra },
    ...(Object.keys(style).length ? { s: { ...el.s, ...style } } : {}),
  };
}

const isRaw = (n: unknown): n is RawHtml => typeof n === "object" && n !== null && (n as RawHtml).slot === "html";

/** HTML de un árbol: escapado por `core/vnode`; el marcado de preset va tal cual (es del contrato, no del usuario). */
export function treeHTML(node: Out): string {
  if (isRaw(node)) return node.html;
  if (!node || typeof node !== "object" || "slot" in node || !node.c?.length) return vnodeHTML(node as VNode);
  // Se serializa por partes: un preset anidado a cualquier profundidad entra sin escapar.
  const shell = vnodeHTML({ ...node, c: [] });
  const close = `</${node.t}>`;
  if (!shell.endsWith(close)) return shell;
  return `${shell.slice(0, -close.length)}${(node.c as Out[]).map(treeHTML).join("")}${close}`;
}

/**
 * Marcado estándar del documento (el de `html.json`). No depende de la configuración regional ni de la zona
 * horaria: ningún bloque formatea fechas ni números con `Intl`.
 */
export function toHTML(doc: PageDocument, o: HtmlOptions & { builtins?: readonly BlockSpec[] } = {}): string {
  const blocks = registry([...(o.builtins ?? []), ...(o.blocks ?? [])]);
  return toTrees(doc.body, blocks, o).map(treeHTML).join("\n");
}

/** Comprueba que un subárbol solo usa categorías y tipos admitidos por un hueco. */
export function accepts(rule: SlotRule | undefined, child: { type: string; categories: ContentCategory[] }): boolean {
  if (!rule) return false;
  if (child.type === "#text") return Boolean(rule.text);
  if (rule.rejects?.some((c) => child.categories.includes(c))) return false;
  if (rule.types?.includes(child.type)) return true;
  return Boolean(rule.accepts?.some((c) => child.categories.includes(c)));
}

/** El HTML como `TrustedHTML` de la política `zuix-zui`, para asignarlo a `innerHTML` bajo Trusted Types. */
export function trusted(html: string): string {
  return trustedHTML(html);
}

export { str };
