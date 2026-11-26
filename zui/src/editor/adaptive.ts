// Adaptativo en el documento: orden, área, visibilidad, ancho de columna, variante y props por clase de tamaño, y
// plantillas de AdaptiveLayout. La resolución y el marcado son los de los layouts adaptativos de zout, que viven en
// `core/adaptive` (`@zuccadev-labs/zuix-zui/adaptive`): el editor escribe exactamente lo que escribe AdaptiveLayout.
//
//   layout   .z-adaptive > .z-adaptive__grid, con las plantillas de las cinco clases en variables (`templateVars`)
//   pieza    cada hijo del layout es un .z-adaptive__item con `data-item`, `--z-place-<clase>`, `--z-order-<clase>`
//            y `data-hidden-in` (`nodeStyle`); sus ajustes, también en `data-z-adaptive` (JSON)

import {
  SIZE_CLASSES,
  SIZE_CLASS_NAMES,
  areaRects,
  nodeStyle,
  resolveAdaptive as resolveCore,
  resolveTemplate as resolveTemplateCore,
  templateVars,
  validateTemplate,
  type AdaptiveTemplate,
  type AdaptiveTemplates,
  type PointerKind,
  type SizeClass,
} from "../core/adaptive";
import type { VEl, VNode } from "../core/vnode";
import type { JsonValue } from "./types";

export { SIZE_CLASSES, SIZE_CLASS_NAMES, isSizeClass, sizeClassFor } from "../core/adaptive";
export type { AdaptiveTemplate, AdaptiveTemplates, PointerKind, SizeClass };

/** Ancho mínimo (CSS px) de cada clase: compact < 600 ≤ medium < 840 ≤ expanded < 1200 ≤ large < 1600 ≤ xlarge. */
export const SIZE_CLASS_MIN = Object.fromEntries(SIZE_CLASSES.map((c) => [c.name, c.min])) as Record<SizeClass, number>;
/** Ancho de vista previa de cada clase en el lienzo (un valor típico dentro del intervalo). */
export const SIZE_CLASS_PREVIEW: Record<SizeClass, number> = { compact: 390, medium: 720, expanded: 1024, large: 1366, xlarge: 1680 };

/** Lo que cambia un nodo en una clase (el `AdaptiveSettings` de zout, con props en JSON). */
export interface AdaptiveOverride {
  order?: number;
  hidden?: boolean;
  /** Área de la plantilla del AdaptiveLayout padre. */
  area?: string;
  /** Columnas que ocupa una pieza sin área. */
  span?: number;
  /** Variante adaptativa del componente (AdaptiveTabs → `select`…), de las que declara el catálogo. */
  variant?: string;
  /** Props que cambian en esa clase. */
  props?: Record<string, JsonValue>;
}
export type AdaptiveSpec = Partial<Record<SizeClass, AdaptiveOverride>>;

/** Valores en vigor en una clase: se fusionan desde `compact` hasta ella. */
export const resolveAdaptive = (spec: AdaptiveSpec | undefined, cls: SizeClass): AdaptiveOverride =>
  resolveCore(spec, cls) as AdaptiveOverride;

/** Plantilla en vigor en una clase: la de esa clase o la de la mayor por debajo. */
export const resolveTemplate = (templates: AdaptiveTemplates | undefined, cls: SizeClass): AdaptiveTemplate | undefined =>
  resolveTemplateCore(templates, cls) ?? undefined;

/** Nombres de área de una plantilla (sin `.`, que es una celda vacía), en el orden en que aparecen. */
export const templateAreas = (t: AdaptiveTemplate | undefined): string[] => (t ? [...areaRects(t.areas).keys()] : []);

/** Problemas de una plantilla, como frases para el editor (los de `validateTemplate` de zout). */
export function templateProblems(t: AdaptiveTemplate): string[] {
  const out = validateTemplate(t).map((issue) =>
    issue.code === "empty"
      ? "la plantilla no tiene filas"
      : issue.code === "ragged"
        ? "todas las filas deben tener el mismo número de celdas"
        : issue.code === "invalid-name"
          ? `«${issue.area}» no es un nombre de área válido`
          : `el área «${issue.area}» no es rectangular`,
  );
  return [...new Set(out)];
}

/**
 * Variantes adaptativas por componente. El bloque las pasa a la prop `adaptive` del componente en cada clase
 * (AdaptiveTabs, AdaptiveTable) o a sus acciones (AdaptiveToolbar).
 */
export const ADAPTIVE_VARIANTS: Record<string, { value: string; label: string; description: string }[]> = {
  AdaptiveTabs: [
    { value: "tabs", label: "Pestañas", description: "Lista de pestañas (por defecto desde medium)." },
    { value: "select", label: "Selector", description: "Un <select> con las pestañas como opciones (por defecto en compact)." },
    { value: "bottom-nav", label: "Navegación inferior", description: "Barra inferior con las pestañas como destinos." },
  ],
  AdaptiveTable: [
    { value: "table", label: "Tabla", description: "Filas y columnas (por defecto desde medium)." },
    { value: "cards", label: "Tarjetas", description: "Una tarjeta por fila (por defecto en compact)." },
  ],
  AdaptiveToolbar: [
    { value: "bar", label: "Barra", description: "Las acciones en la barra, salvo las que pidan otra cosa." },
    { value: "menu", label: "Menú «más»", description: "Todas las acciones pasan al menú de desbordamiento." },
  ],
};

/** Nombres antiguos o de otros sistemas que se aceptan como variante. */
export const ADAPTIVE_VARIANT_ALIASES: Record<string, string> = {
  "bottom-navigation": "bottom-nav",
  sidebar: "docked",
  toolbar: "bar",
  overflow: "menu",
};

/** Nombre canónico de una variante (los alias se traducen). */
export const normalizeVariant = (variant: string): string => ADAPTIVE_VARIANT_ALIASES[variant] ?? variant;

/** Si `variant` (o su alias) es una variante de `type`. */
export const isAdaptiveVariant = (type: string, variant: string): boolean =>
  ADAPTIVE_VARIANTS[type]?.some((v) => v.value === normalizeVariant(variant)) ?? false;

/** Mapa `{ clase: { variant } }` de un nodo, con los alias traducidos: lo que recibe la prop `adaptive` del componente. */
export function variantProp(spec: AdaptiveSpec | undefined): Partial<Record<SizeClass, { variant: string }>> | undefined {
  const out: Partial<Record<SizeClass, { variant: string }>> = {};
  for (const cls of SIZE_CLASS_NAMES) {
    const v = spec?.[cls]?.variant;
    if (typeof v === "string") out[cls] = { variant: normalizeVariant(v) };
  }
  return Object.keys(out).length ? out : undefined;
}

const AREA = /^[A-Za-z_][\w-]*$/;
const SAFE_TRACK = /^[A-Za-z0-9 ().,%+*/-]*$/;

/** Plantillas utilizables: sin las que tienen problemas ni pistas con caracteres fuera de la lista. */
function cleanTemplates(templates: AdaptiveTemplates | undefined): AdaptiveTemplates {
  const out: AdaptiveTemplates = {};
  for (const cls of SIZE_CLASS_NAMES) {
    const t = templates?.[cls];
    if (!t || !Array.isArray(t.areas) || templateProblems(t).length) continue;
    out[cls] = {
      areas: t.areas,
      ...(t.columns && SAFE_TRACK.test(t.columns) ? { columns: t.columns } : {}),
      ...(t.rows && SAFE_TRACK.test(t.rows) ? { rows: t.rows } : {}),
    };
  }
  return out;
}

/** Ajustes de un nodo saneados (lo que se escribe en `data-z-adaptive`). */
function cleanSpec(spec: AdaptiveSpec | undefined): AdaptiveSpec {
  const out: AdaptiveSpec = {};
  for (const cls of SIZE_CLASS_NAMES) {
    const o = spec?.[cls];
    if (!o) continue;
    const c: AdaptiveOverride = {};
    if (typeof o.area === "string" && AREA.test(o.area)) c.area = o.area;
    if (typeof o.order === "number" && Number.isInteger(o.order)) c.order = o.order;
    if (typeof o.span === "number" && Number.isInteger(o.span) && o.span > 0) c.span = o.span;
    if (typeof o.hidden === "boolean") c.hidden = o.hidden;
    if (typeof o.variant === "string" && /^[a-z][a-z0-9-]*$/.test(o.variant)) c.variant = normalizeVariant(o.variant);
    if (o.props) c.props = o.props;
    out[cls] = c;
  }
  return out;
}

/**
 * Atributos de un nodo con `adaptive`: `data-item` (su id) y la especificación en `data-z-adaptive`. La colocación
 * (`--z-place-*`, `--z-order-*`, `data-hidden-in`) la escribe el AdaptiveLayout que lo contiene, que conoce las
 * plantillas.
 */
export function adaptiveAttributes(id: string, spec: AdaptiveSpec | undefined): Record<string, string> {
  if (!spec) return {};
  return { "data-item": id, "data-z-adaptive": JSON.stringify(cleanSpec(spec)) };
}

const isEl = (n: VNode): n is VEl => typeof n === "object" && n !== null && "t" in n;

/**
 * Marcado de un AdaptiveLayout con sus hijos: `.z-adaptive > .z-adaptive__grid`, y cada hijo como pieza con sus
 * variables para las cinco clases. Es el mismo que sale del binding de React (`zout/html.json`).
 */
export function adaptiveLayoutTree(templates: AdaptiveTemplates | undefined, measure: "container" | "viewport", children: VNode[]): VEl {
  const t = cleanTemplates(templates);
  const items = children.map((child, index): VNode => {
    // Hueco de `toReact` (el hijo se pinta después, con su componente si lo hay): lleva la colocación consigo.
    const hole = child as unknown as { slot?: string; p?: { node?: { id: string; adaptive?: AdaptiveSpec } } };
    if (hole && typeof hole === "object" && hole.slot === "react" && hole.p?.node) {
      const n = hole.p.node;
      const { vars, hiddenIn } = nodeStyle(t, { id: n.id, adaptive: cleanSpec(n.adaptive) });
      return { ...hole, p: { ...hole.p, item: { id: n.id, hiddenIn, vars } } } as unknown as VNode;
    }
    if (!isEl(child)) return child;
    const a = child.a ?? {};
    let spec: AdaptiveSpec = {};
    try {
      spec = typeof a["data-z-adaptive"] === "string" ? (JSON.parse(a["data-z-adaptive"]) as AdaptiveSpec) : {};
    } catch {
      spec = {};
    }
    const id = typeof a["data-item"] === "string" ? a["data-item"] : `#${index}`;
    const { vars, hiddenIn } = nodeStyle(t, { id, adaptive: spec });
    const cls = [a.class, "z-adaptive__item"].filter(Boolean).join(" ");
    return {
      ...child,
      a: { ...a, class: cls, "data-item": id, ...(hiddenIn ? { "data-hidden-in": hiddenIn } : {}) },
      s: { ...vars, ...child.s },
    };
  });
  return {
    t: "div",
    a: { class: "z-adaptive", "data-reorder": "dom", ...(measure === "viewport" ? { "data-measure": "window" } : {}) },
    c: [{ t: "div", a: { class: "z-adaptive__grid" }, s: templateVars(t), c: items }],
  };
}
