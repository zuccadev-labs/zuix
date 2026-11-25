// Núcleo de los layouts adaptativos, sin React ni DOM. Lo comparten el binding (layouts/Adaptive*.tsx), el modo sin
// framework (dom/adaptive.ts) y el editor visual: todos resuelven igual la clase de tamaño, la fusión de ajustes y el
// orden de lectura.
//
// Responsive estira o pliega el mismo layout. Adaptativo elige, para cada clase de tamaño, qué regiones hay, dónde va
// cada pieza, en qué orden, qué se oculta y qué variante de un componente se usa. El contrato:
//
//   clases     compact < 600 ≤ medium < 840 ≤ expanded < 1200 ≤ large < 1600 ≤ xlarge (tokens --z-size-*)
//   ajustes    adaptive: { [clase]: { order?, hidden?, area?, span?, variant?, props? } }
//   plantilla  templates: { [clase]: { areas: string[], columns?, rows? } }
//
// Los ajustes y las plantillas se heredan hacia arriba (mobile-first): lo de `compact` vale hasta que una clase
// mayor lo sobrescribe.

/** Clase de tamaño (window size classes de Material 3), medida por defecto sobre el contenedor. */
export type SizeClass = "compact" | "medium" | "expanded" | "large" | "xlarge";

export interface SizeClassDef {
  name: SizeClass;
  /** Ancho mínimo, incluido (px). */
  min: number;
  /** Ancho a partir del cual empieza la clase siguiente (px), o `null` en la última. */
  next: number | null;
}

/** Las cinco clases, de menor a mayor. Los cortes son los tokens `--z-size-*`. */
export const SIZE_CLASSES: readonly SizeClassDef[] = Object.freeze([
  { name: "compact", min: 0, next: 600 },
  { name: "medium", min: 600, next: 840 },
  { name: "expanded", min: 840, next: 1200 },
  { name: "large", min: 1200, next: 1600 },
  { name: "xlarge", min: 1600, next: null },
]);

export const SIZE_CLASS_NAMES: readonly SizeClass[] = Object.freeze(SIZE_CLASSES.map((c) => c.name));

export const isSizeClass = (value: unknown): value is SizeClass => SIZE_CLASS_NAMES.includes(value as SizeClass);

/** Posición de una clase en la escala (0 = compact). */
export const sizeClassIndex = (cls: SizeClass) => SIZE_CLASS_NAMES.indexOf(cls);

/** Clase que corresponde a un ancho en px. Un ancho negativo o no finito cuenta como 0. */
export function sizeClassFor(width: number): SizeClass {
  const w = Number.isFinite(width) ? Math.max(0, width) : 0;
  let found: SizeClass = "compact";
  for (const c of SIZE_CLASSES) if (w >= c.min) found = c.name;
  return found;
}

/** Puntero principal: `coarse` (dedo) o `fine` (ratón, lápiz). */
export type PointerKind = "coarse" | "fine";

/** Clase de entrada: tipo de puntero y si hay hover. */
export interface InputClass {
  pointer: PointerKind;
  hover: boolean;
}

/** Entrada a partir de `matchMedia` (o cualquier función con la misma firma). Sin ella: puntero fino con hover. */
export function inputClassOf(match?: ((query: string) => { matches: boolean }) | null): InputClass {
  if (!match) return { pointer: "fine", hover: true };
  return { pointer: match("(pointer: coarse)").matches ? "coarse" : "fine", hover: match("(hover: hover)").matches };
}

/* ---------- Ajustes por clase ---------- */

/** Ajustes de un nodo para una clase. Todos opcionales: lo que falta se hereda de la clase anterior. */
export interface AdaptiveSettings {
  /** Posición en el orden de lectura dentro de su área (y en el flujo, sin plantilla). */
  order?: number;
  hidden?: boolean;
  /** Área con nombre de la plantilla. */
  area?: string;
  /** Columnas que ocupa una pieza sin área. */
  span?: number;
  /** Variante del componente (`tabs`, `select`, `drawer`, `rail`, `menu`…): la interpreta cada componente. */
  variant?: string;
  /** Props que cambian en esa clase. Se fusionan clave a clave con las de las clases anteriores. */
  props?: Record<string, unknown>;
}

export type AdaptiveMap = Partial<Record<SizeClass, AdaptiveSettings>>;

/**
 * Ajustes efectivos de un nodo en `cls`: `base`, y encima cada clase desde `compact` hasta `cls`, en orden. Una clave
 * con `undefined` no borra la heredada. `props` se fusiona por claves.
 */
export function resolveAdaptive(adaptive: AdaptiveMap | null | undefined, cls: SizeClass, base: AdaptiveSettings = {}): AdaptiveSettings {
  const out: AdaptiveSettings = { ...base };
  if (base.props) out.props = { ...base.props };
  const top = sizeClassIndex(cls);
  for (let i = 0; i <= top; i++) {
    const step = adaptive?.[SIZE_CLASS_NAMES[i]!];
    if (!step) continue;
    for (const key of ["order", "hidden", "area", "span", "variant"] as const) {
      const value = step[key];
      if (value !== undefined) (out as Record<string, unknown>)[key] = value;
    }
    if (step.props) out.props = { ...out.props, ...step.props };
  }
  return out;
}

/** Ajustes efectivos en las cinco clases. */
export function resolveAll(adaptive: AdaptiveMap | null | undefined, base: AdaptiveSettings = {}): Record<SizeClass, AdaptiveSettings> {
  return Object.fromEntries(SIZE_CLASS_NAMES.map((c) => [c, resolveAdaptive(adaptive, c, base)])) as Record<SizeClass, AdaptiveSettings>;
}

/**
 * Elige un valor por clase con herencia mobile-first: el de la mayor clase definida que no pase de `cls`, o
 * `fallback`. Sirve para cualquier mapa por clase (variantes, plantillas).
 */
export function pickForClass<T>(map: Partial<Record<SizeClass, T>> | null | undefined, cls: SizeClass, fallback: T): T {
  let found = fallback;
  const top = sizeClassIndex(cls);
  for (let i = 0; i <= top; i++) {
    const value = map?.[SIZE_CLASS_NAMES[i]!];
    if (value !== undefined) found = value;
  }
  return found;
}

/* ---------- Plantillas ---------- */

/** Plantilla de una clase. `areas` es como `grid-template-areas`, una cadena por fila; `.` deja una celda vacía. */
export interface AdaptiveTemplate {
  areas: string[];
  columns?: string;
  rows?: string;
}

export type AdaptiveTemplates = Partial<Record<SizeClass, AdaptiveTemplate>>;

/** Plantilla efectiva en `cls` (la de la mayor clase definida que no la supere), o `null`: las piezas van en flujo. */
export const resolveTemplate = (templates: AdaptiveTemplates | null | undefined, cls: SizeClass): AdaptiveTemplate | null =>
  pickForClass<AdaptiveTemplate | null>(templates, cls, null);

/** Rectángulo de un área, en celdas (filas y columnas desde 0, fin exclusivo). */
export interface AreaRect {
  row: number;
  col: number;
  rowEnd: number;
  colEnd: number;
}

const AREA_NAME = /^[A-Za-z_][\w-]*$/;

/** Filas de celdas de una plantilla. Una fila escrita entre comillas (`"a b"`) se acepta igual que sin ellas. */
export function areaRows(areas: readonly string[]): string[][] {
  return areas.map((row) =>
    row
      .trim()
      .replace(/^["']|["']$/g, "")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      // Varios puntos seguidos son una sola celda vacía, como en CSS.
      .map((cell) => (/^\.+$/.test(cell) ? "." : cell)),
  );
}

/** Rectángulo que ocupa cada área con nombre (el que la envuelve; `validateTemplate` dice si es rectangular). */
export function areaRects(areas: readonly string[]): Map<string, AreaRect> {
  const rects = new Map<string, AreaRect>();
  for (const [row, cells] of areaRows(areas).entries())
    for (const [col, name] of cells.entries()) {
      if (name === ".") continue;
      const r = rects.get(name);
      if (!r) rects.set(name, { row, col, rowEnd: row + 1, colEnd: col + 1 });
      else {
        r.row = Math.min(r.row, row);
        r.col = Math.min(r.col, col);
        r.rowEnd = Math.max(r.rowEnd, row + 1);
        r.colEnd = Math.max(r.colEnd, col + 1);
      }
    }
  return rects;
}

/** Número de columnas de una plantilla (el de su primera fila). */
export const templateColumns = (areas: readonly string[]) => areaRows(areas)[0]?.length ?? 0;

export type AdaptiveIssueCode = "empty" | "ragged" | "invalid-name" | "not-rectangular" | "unknown-area" | "shared-area";

export interface AdaptiveIssue {
  code: AdaptiveIssueCode;
  message: string;
  sizeClass?: SizeClass;
  area?: string;
  item?: string;
}

/** Problemas de una plantilla: vacía, filas de distinto ancho, nombres no válidos o áreas que no son rectángulos. */
export function validateTemplate(template: AdaptiveTemplate, sizeClass?: SizeClass): AdaptiveIssue[] {
  const issues: AdaptiveIssue[] = [];
  const at = sizeClass ? ` (${sizeClass})` : "";
  const rows = areaRows(template.areas);
  if (rows.length === 0 || rows.some((r) => r.length === 0)) {
    issues.push({ code: "empty", sizeClass, message: `La plantilla${at} tiene una fila vacía o ninguna.` });
    return issues;
  }
  const width = rows[0]!.length;
  if (rows.some((r) => r.length !== width))
    issues.push({ code: "ragged", sizeClass, message: `Las filas de la plantilla${at} no tienen todas ${width} columnas.` });
  for (const name of new Set(rows.flat()))
    if (name !== "." && !AREA_NAME.test(name))
      issues.push({ code: "invalid-name", sizeClass, area: name, message: `«${name}» no es un nombre de área válido${at}.` });
  for (const [name, r] of areaRects(template.areas)) {
    let cells = 0;
    let inside = 0;
    for (const [row, cellsOfRow] of rows.entries())
      for (const [col, cell] of cellsOfRow.entries()) {
        if (cell !== name) continue;
        cells++;
        if (row >= r.row && row < r.rowEnd && col >= r.col && col < r.colEnd) inside++;
      }
    if (cells !== (r.rowEnd - r.row) * (r.colEnd - r.col) || inside !== cells)
      issues.push({ code: "not-rectangular", sizeClass, area: name, message: `El área «${name}»${at} no forma un rectángulo.` });
  }
  return issues;
}

/** Una pieza de un layout adaptativo: identificador, área por defecto y ajustes por clase. */
export interface AdaptiveNode {
  id: string;
  area?: string;
  order?: number;
  span?: number;
  hidden?: boolean;
  adaptive?: AdaptiveMap;
}

const baseOf = (node: AdaptiveNode): AdaptiveSettings => ({ area: node.area, order: node.order, span: node.span, hidden: node.hidden });

/**
 * Valida un layout entero, clase por clase: cada plantilla definida, y que cada pieza visible con área tenga esa área
 * en la plantilla efectiva de la clase. Una pieza con área en una clase sin plantilla también es un error: el área no
 * existe. Dos piezas visibles en la misma área se avisan (se pisarían).
 */
export function validateAdaptive(templates: AdaptiveTemplates | null | undefined, nodes: readonly AdaptiveNode[]): AdaptiveIssue[] {
  const issues: AdaptiveIssue[] = [];
  for (const cls of SIZE_CLASS_NAMES) {
    const own = templates?.[cls];
    if (own) issues.push(...validateTemplate(own, cls));
    const template = resolveTemplate(templates, cls);
    const names = template ? areaRects(template.areas) : new Map<string, AreaRect>();
    const taken = new Map<string, string>();
    for (const node of nodes) {
      const s = resolveAdaptive(node.adaptive, cls, baseOf(node));
      if (s.hidden || !s.area) continue;
      if (!names.has(s.area)) {
        issues.push({
          code: "unknown-area",
          sizeClass: cls,
          area: s.area,
          item: node.id,
          message: `«${node.id}» va en el área «${s.area}», que no existe en la plantilla de ${cls}.`,
        });
        continue;
      }
      const other = taken.get(s.area);
      if (other)
        issues.push({
          code: "shared-area",
          sizeClass: cls,
          area: s.area,
          item: node.id,
          message: `«${node.id}» y «${other}» comparten el área «${s.area}» en ${cls}.`,
        });
      else taken.set(s.area, node.id);
    }
  }
  return issues;
}

/* ---------- Orden y colocación ---------- */

export interface ResolvedNode {
  id: string;
  /** Posición en el origen (el DOM tal como se escribió). */
  index: number;
  /** Área efectiva, o `null` si la pieza va en flujo (sin plantilla o sin área en ella). */
  area: string | null;
  order: number;
  hidden: boolean;
  span: number | null;
  variant?: string;
  props?: Record<string, unknown>;
}

/** Ajustes efectivos de cada pieza en `cls`. Un área que no está en la plantilla se trata como flujo. */
export function resolveNodes(
  templates: AdaptiveTemplates | null | undefined,
  nodes: readonly AdaptiveNode[],
  cls: SizeClass,
): ResolvedNode[] {
  const template = resolveTemplate(templates, cls);
  const names = template ? areaRects(template.areas) : null;
  return nodes.map((node, index) => {
    const s = resolveAdaptive(node.adaptive, cls, baseOf(node));
    const span = s.span !== undefined && Number.isFinite(s.span) && s.span > 1 ? Math.floor(s.span) : null;
    return {
      id: node.id,
      index,
      area: s.area && names?.has(s.area) ? s.area : null,
      order: Number.isFinite(s.order) ? (s.order as number) : 0,
      hidden: s.hidden === true,
      span,
      variant: s.variant,
      props: s.props,
    };
  });
}

/** Lo que hace falta de una pieza ya resuelta para ordenarla. */
export type PlacedNode = Pick<ResolvedNode, "id" | "index" | "area" | "order" | "hidden">;

/**
 * Orden de lectura de piezas ya resueltas sobre una plantilla (`areas`, o `null` sin plantilla): las que tienen área,
 * por la fila y la columna lógica de su esquina inicial (en RTL la columna inicial está a la derecha y también se lee
 * primero); dentro de la misma área y en flujo, por `order` y después por su posición en el origen. Las piezas en
 * flujo van tras las colocadas. Las ocultas no cuentan.
 */
export function readingOrder(areas: readonly string[] | null, nodes: readonly PlacedNode[]): string[] {
  const rects = areas ? areaRects(areas) : new Map<string, AreaRect>();
  const key = (n: PlacedNode) => {
    const r = n.area ? rects.get(n.area) : undefined;
    return r ? [0, r.row, r.col, n.order, n.index] : [1, 0, 0, n.order, n.index];
  };
  return nodes
    .filter((n) => !n.hidden)
    .map((n) => ({ n, k: key(n) }))
    .sort((a, b) => {
      for (let i = 0; i < a.k.length; i++) if (a.k[i] !== b.k[i]) return a.k[i]! - b.k[i]!;
      return 0;
    })
    .map(({ n }) => n.id);
}

/** Orden de lectura visual de las piezas visibles de un layout en `cls` (ver `readingOrder`). */
export function visualOrder(templates: AdaptiveTemplates | null | undefined, nodes: readonly AdaptiveNode[], cls: SizeClass): string[] {
  return readingOrder(resolveTemplate(templates, cls)?.areas ?? null, resolveNodes(templates, nodes, cls));
}

/** Filas de una plantilla escrita como valor de `grid-template-areas` (`"a b" "c d"`), o `null` con `none`. */
export function parseAreasValue(value: string | null | undefined): string[] | null {
  const rows = [...(value ?? "").matchAll(/"([^"]*)"|'([^']*)'/g)].map((m) => (m[1] ?? m[2] ?? "").trim());
  return rows.length ? rows : null;
}

/**
 * Orden del DOM para el modo `domOrder`: el visual, y detrás las piezas ocultas en su orden de origen (no se ven ni se
 * enfocan, pero siguen en el documento para no rehacerlas al volver).
 */
export function domOrderFor(templates: AdaptiveTemplates | null | undefined, nodes: readonly AdaptiveNode[], cls: SizeClass): string[] {
  const visible = visualOrder(templates, nodes, cls);
  const seen = new Set(visible);
  return [...visible, ...nodes.map((n) => n.id).filter((id) => !seen.has(id))];
}

/**
 * Si el orden del DOM de las piezas visibles se aparta del visual: el teclado y el lector de pantalla recorrerían la
 * página en un orden distinto del que se ve (WCAG 1.3.2 y 2.4.3). `dom` es el orden actual de los identificadores.
 */
export function orderMismatch(dom: readonly string[], visual: readonly string[]): boolean {
  const shown = new Set(visual);
  const domVisible = dom.filter((id) => shown.has(id));
  return domVisible.length !== visual.length || domVisible.some((id, i) => id !== visual[i]);
}

/* ---------- Estilos ---------- */

/** Valor de `grid-area` de una pieza resuelta: su área, `span N` en flujo, o `auto`. */
export function placement(node: Pick<ResolvedNode, "area" | "span">): string {
  if (node.area) return node.area;
  return node.span ? `auto / auto / auto / span ${node.span}` : "auto";
}

/** Valor de `grid-template-areas` de una plantilla (`none` sin plantilla). */
export const templateAreasValue = (template: AdaptiveTemplate | null) =>
  template
    ? areaRows(template.areas)
        .map((cells) => `"${cells.join(" ")}"`)
        .join(" ")
    : "none";

/** Valor de `grid-template-columns`: el de la plantilla o tantas columnas iguales como celdas tenga una fila. */
export function templateColumnsValue(template: AdaptiveTemplate | null): string {
  if (!template) return "minmax(0, 1fr)";
  if (template.columns) return template.columns;
  const n = Math.max(1, templateColumns(template.areas));
  return n === 1 ? "minmax(0, 1fr)" : `repeat(${n}, minmax(0, 1fr))`;
}

/**
 * Variables de la rejilla para las cinco clases: `--z-areas-<clase>`, `--z-columns-<clase>` y `--z-rows-<clase>`. La
 * hoja (`.z-adaptive__grid`) elige cada una con una consulta de contenedor, así que la colocación inicial sale de CSS
 * y no espera a JavaScript.
 */
export function templateVars(templates: AdaptiveTemplates | null | undefined): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const cls of SIZE_CLASS_NAMES) {
    const t = resolveTemplate(templates, cls);
    vars[`--z-areas-${cls}`] = templateAreasValue(t);
    vars[`--z-columns-${cls}`] = templateColumnsValue(t);
    vars[`--z-rows-${cls}`] = t?.rows ?? "none";
  }
  return vars;
}

export interface NodeStyle {
  /** Variables `--z-place-<clase>` y `--z-order-<clase>`. */
  vars: Record<string, string>;
  /** Clases en que la pieza no se muestra, separadas por espacios (atributo `data-hidden-in`), o `undefined`. */
  hiddenIn: string | undefined;
}

/** Variables de una pieza para las cinco clases, y en qué clases va oculta. */
export function nodeStyle(templates: AdaptiveTemplates | null | undefined, node: AdaptiveNode): NodeStyle {
  const vars: Record<string, string> = {};
  const hidden: SizeClass[] = [];
  for (const cls of SIZE_CLASS_NAMES) {
    const [r] = resolveNodes(templates, [node], cls);
    if (!r) continue;
    vars[`--z-place-${cls}`] = placement(r);
    vars[`--z-order-${cls}`] = String(r.order);
    if (r.hidden) hidden.push(cls);
  }
  return { vars, hiddenIn: hidden.length ? hidden.join(" ") : undefined };
}

/** Clases en que se muestra cada variante de un mapa de variantes (`data-classes` de AdaptiveSwitch). */
export function variantClasses(choice: Partial<Record<SizeClass, string>>, fallback: string): Map<string, SizeClass[]> {
  const out = new Map<string, SizeClass[]>();
  for (const cls of SIZE_CLASS_NAMES) {
    const v = pickForClass(choice, cls, fallback);
    out.set(v, [...(out.get(v) ?? []), cls]);
  }
  return out;
}

/** Mapa de variante por clase a partir de un mapa de ajustes (`{ compact: { variant: "select" } }`). */
export function variantMap(adaptive: AdaptiveMap | null | undefined): Partial<Record<SizeClass, string>> {
  const out: Partial<Record<SizeClass, string>> = {};
  for (const cls of SIZE_CLASS_NAMES) {
    const v = adaptive?.[cls]?.variant;
    if (v !== undefined) out[cls] = v;
  }
  return out;
}

/* ---------- Barra con desbordamiento ---------- */

/**
 * Reparte las acciones de una barra en `cls`: las que se quedan en la barra y las que pasan al menú de
 * desbordamiento (variante `menu`). Las ocultas no van a ninguno de los dos.
 */
export function splitOverflow<T extends { id: string; adaptive?: AdaptiveMap }>(
  actions: readonly T[],
  cls: SizeClass,
): { bar: T[]; menu: T[] } {
  const bar: T[] = [];
  const menu: T[] = [];
  for (const action of actions) {
    const s = resolveAdaptive(action.adaptive, cls);
    if (s.hidden) continue;
    (s.variant === "menu" ? menu : bar).push(action);
  }
  return { bar, menu };
}
