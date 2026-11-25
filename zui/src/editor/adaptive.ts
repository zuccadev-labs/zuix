// Adaptativo en el documento: orden, área, visibilidad, ancho de columna, variante y props por clase de tamaño, y
// plantillas de áreas de AdaptiveLayout. El contrato (nombres de clase, cortes y campos) es el de AdaptiveLayout de
// zout; el CSS y la resolución en ejecución son suyos.
//
// PROVISIONAL hasta integrar con zout: `resolveAdaptive`, `resolveTemplate` y `sizeClassOf` son resolvedores mínimos
// con la semántica acordada (de móvil hacia arriba: lo de `compact` vale hasta que una clase mayor lo sobrescribe),
// y `adaptiveAttributes`/`adaptiveLayoutAttributes` escriben un marcado provisional (variables `--z-*` y `data-*`).
// Al integrar se sustituyen por los de zout sin cambiar el documento ni el catálogo.

import type { JsonValue } from "./types";

/** Clases de tamaño, de menor a mayor. Se miden sobre el contenedor salvo que el layout diga otra cosa. */
export const SIZE_CLASSES = ["compact", "medium", "expanded", "large", "xlarge"] as const;
export type SizeClass = (typeof SIZE_CLASSES)[number];
/** Ancho mínimo (CSS px) de cada clase: compact < 600 ≤ medium < 840 ≤ expanded < 1200 ≤ large < 1600 ≤ xlarge. */
export const SIZE_CLASS_MIN: Record<SizeClass, number> = { compact: 0, medium: 600, expanded: 840, large: 1200, xlarge: 1600 };
/** Ancho de vista previa de cada clase en el lienzo (un valor típico dentro del intervalo). */
export const SIZE_CLASS_PREVIEW: Record<SizeClass, number> = { compact: 390, medium: 720, expanded: 1024, large: 1366, xlarge: 1680 };
export type PointerKind = "coarse" | "fine";

/** Lo que cambia un nodo en una clase. */
export interface AdaptiveOverride {
  order?: number;
  hidden?: boolean;
  /** Área de la plantilla del AdaptiveLayout padre. */
  area?: string;
  /** Columnas que ocupa. */
  span?: number;
  /** Variante adaptativa del componente (Tabs → `select`, Sidebar → `rail`…), de las que declara el catálogo. */
  variant?: string;
  /** Props que cambian en esa clase. */
  props?: Record<string, JsonValue>;
}
export type AdaptiveSpec = Partial<Record<SizeClass, AdaptiveOverride>>;

/** Plantilla de áreas de una clase: filas de nombres separados por espacios (`"nav main"`), como grid-template-areas. */
export interface AdaptiveTemplate {
  areas: string[];
  columns?: string;
  rows?: string;
}
export type AdaptiveTemplates = Partial<Record<SizeClass, AdaptiveTemplate>>;

export const isSizeClass = (v: unknown): v is SizeClass => SIZE_CLASSES.includes(v as SizeClass);

/** Clase de un ancho. PROVISIONAL: la de zout la sustituye al integrar. */
export function sizeClassOf(width: number): SizeClass {
  let out: SizeClass = "compact";
  for (const c of SIZE_CLASSES) if (width >= SIZE_CLASS_MIN[c]) out = c;
  return out;
}

/** Valores en vigor en una clase: se fusionan desde `compact` hasta ella. PROVISIONAL (ver arriba). */
export function resolveAdaptive(spec: AdaptiveSpec | undefined, cls: SizeClass): AdaptiveOverride {
  const out: AdaptiveOverride = {};
  for (const c of SIZE_CLASSES.slice(0, SIZE_CLASSES.indexOf(cls) + 1)) {
    const o = spec?.[c];
    if (!o) continue;
    const { props, ...rest } = o;
    Object.assign(out, rest);
    if (props) out.props = { ...out.props, ...props };
  }
  return out;
}

/** Plantilla en vigor en una clase: la de esa clase o la de la mayor por debajo. PROVISIONAL (ver arriba). */
export function resolveTemplate(templates: AdaptiveTemplates | undefined, cls: SizeClass): AdaptiveTemplate | undefined {
  let out: AdaptiveTemplate | undefined;
  for (const c of SIZE_CLASSES.slice(0, SIZE_CLASSES.indexOf(cls) + 1)) if (templates?.[c]) out = templates[c];
  return out;
}

const AREA = /^[A-Za-z_][A-Za-z0-9_-]*$/;

/** Nombres de área de una plantilla (sin `.`, que es una celda vacía). */
export function templateAreas(t: AdaptiveTemplate | undefined): string[] {
  const out = new Set<string>();
  for (const row of t?.areas ?? []) for (const cell of row.trim().split(/\s+/)) if (cell && !/^\.+$/.test(cell)) out.add(cell);
  return [...out];
}

/**
 * Problemas de una plantilla: filas con distinto número de celdas, nombres no válidos y áreas que no forman un
 * rectángulo (las reglas de grid-template-areas).
 */
export function templateProblems(t: AdaptiveTemplate): string[] {
  const problems: string[] = [];
  const rows = t.areas.map((r) => r.trim().split(/\s+/).filter(Boolean));
  if (!rows.length) return ["la plantilla no tiene filas"];
  const width = rows[0]?.length ?? 0;
  if (rows.some((r) => r.length !== width)) problems.push("todas las filas deben tener el mismo número de celdas");
  for (const cell of rows.flat()) if (!/^\.+$/.test(cell) && !AREA.test(cell)) problems.push(`«${cell}» no es un nombre de área válido`);
  for (const name of templateAreas(t)) {
    const cells: [number, number][] = [];
    for (const [y, r] of rows.entries()) for (const [x, c] of r.entries()) if (c === name) cells.push([y, x]);
    const ys = cells.map(([y]) => y);
    const xs = cells.map(([, x]) => x);
    const [y0, y1, x0, x1] = [Math.min(...ys), Math.max(...ys), Math.min(...xs), Math.max(...xs)];
    if (cells.length !== (y1 - y0 + 1) * (x1 - x0 + 1)) problems.push(`el área «${name}» no es rectangular`);
  }
  return [...new Set(problems)];
}

/** Componentes con variante adaptativa y sus valores. Los interpreta el componente (o AdaptiveLayout) en cada clase. */
export const ADAPTIVE_VARIANTS: Record<string, { value: string; label: string; description: string }[]> = {
  Tabs: [
    { value: "tabs", label: "Pestañas", description: "Lista de pestañas (por defecto)." },
    { value: "select", label: "Selector", description: "Un selector con las pestañas como opciones: en compact no caben." },
    { value: "bottom-navigation", label: "Navegación inferior", description: "Barra inferior con las pestañas como destinos." },
  ],
  Sidebar: [
    { value: "sidebar", label: "Barra lateral", description: "Columna fija (por defecto)." },
    { value: "drawer", label: "Cajón", description: "Panel que se abre sobre el contenido." },
    { value: "rail", label: "Riel", description: "Columna estrecha solo con iconos." },
  ],
  DataTable: [
    { value: "table", label: "Tabla", description: "Filas y columnas (por defecto)." },
    { value: "cards", label: "Tarjetas", description: "Una tarjeta por fila: en compact no caben las columnas." },
  ],
  Toolbar: [
    { value: "toolbar", label: "Barra", description: "Todas las acciones visibles (por defecto)." },
    { value: "overflow", label: "Desbordamiento", description: "Las que no caben pasan a un menú «Más»." },
  ],
};

const cssString = (s: string) => `"${s.replace(/["\\]/g, "")}"`;
const SAFE_TRACK = /^[A-Za-z0-9 ().,%+*/-]*$/;

/**
 * Atributos del contenedor AdaptiveLayout: plantillas por clase como variables (`--z-adaptive-areas-<clase>`,
 * `-columns-`, `-rows-`) y la medida. PROVISIONAL: el marcado definitivo es el de zout.
 */
export function adaptiveLayoutAttributes(
  templates: AdaptiveTemplates | undefined,
  measure: "container" | "viewport",
): { a: Record<string, string>; s: Record<string, string> } {
  const s: Record<string, string> = {};
  for (const c of SIZE_CLASSES) {
    const t = templates?.[c];
    if (!t || templateProblems(t).length) continue;
    s[`--z-adaptive-areas-${c}`] = t.areas.map(cssString).join(" ");
    if (t.columns && SAFE_TRACK.test(t.columns)) s[`--z-adaptive-columns-${c}`] = t.columns;
    if (t.rows && SAFE_TRACK.test(t.rows)) s[`--z-adaptive-rows-${c}`] = t.rows;
  }
  return { a: { "data-z-adaptive-layout": "", "data-measure": measure }, s };
}

/**
 * Atributos de un nodo con `adaptive`: por cada clase declarada, `--z-area-<clase>`, `--z-order-<clase>`,
 * `--z-span-<clase>`, `data-hidden-<clase>` y `data-variant-<clase>`, y la especificación entera en
 * `data-z-adaptive` (JSON) para quien aplique las props en ejecución. PROVISIONAL: ver arriba.
 */
export function adaptiveAttributes(spec: AdaptiveSpec | undefined): { a: Record<string, string | undefined>; s: Record<string, string> } {
  const a: Record<string, string | undefined> = {};
  const s: Record<string, string> = {};
  if (!spec) return { a, s };
  const clean: AdaptiveSpec = {};
  for (const c of SIZE_CLASSES) {
    const o = spec[c];
    if (!o) continue;
    clean[c] = o;
    if (typeof o.area === "string" && AREA.test(o.area)) s[`--z-area-${c}`] = o.area;
    if (typeof o.order === "number" && Number.isInteger(o.order)) s[`--z-order-${c}`] = String(o.order);
    if (typeof o.span === "number" && Number.isInteger(o.span) && o.span > 0) s[`--z-span-${c}`] = String(o.span);
    if (typeof o.hidden === "boolean") a[`data-hidden-${c}`] = String(o.hidden);
    if (typeof o.variant === "string" && /^[a-z][a-z0-9-]*$/.test(o.variant)) a[`data-variant-${c}`] = o.variant;
  }
  a["data-z-adaptive"] = JSON.stringify(clean);
  return { a, s };
}
