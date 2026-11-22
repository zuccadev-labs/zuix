// Disposición de DashboardGrid: piezas con columna, fila, ancho y alto en una rejilla de N columnas (12 por defecto).
// Colocación acotada, colisiones, compactación vertical (las piezas suben hasta tocar la de encima), mover y
// redimensionar una pieza con las demás apartándose, reajuste a menos columnas y serialización. Mover y
// redimensionar fijan la pieza en su destino y compactan alrededor: así una pieza que baja cambia el sitio con la que
// tenía debajo en vez de volver a subir. Sin documento; quien pinta mide el puntero y lo convierte a celdas.

export interface GridItem {
  id: string;
  /** Columna de inicio, desde 0. */
  x: number;
  /** Fila de inicio, desde 0. */
  y: number;
  /** Ancho en columnas. */
  w: number;
  /** Alto en filas. */
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
  /** Fija: no se mueve, no se redimensiona y las demás la rodean. */
  static?: boolean;
}

export type GridLayout = GridItem[];

export const GRID_COLUMNS = 12;

const int = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v) : fallback);

/** Una pieza dentro de la rejilla: tamaño entre sus mínimos y máximos (y nunca más ancha que la rejilla), sin salirse. */
export function clampItem(item: GridItem, cols = GRID_COLUMNS): GridItem {
  const minW = Math.max(1, Math.min(cols, int(item.minW, 1)));
  const maxW = Math.max(minW, Math.min(cols, int(item.maxW, cols)));
  const minH = Math.max(1, int(item.minH, 1));
  const maxH = Math.max(minH, int(item.maxH, Number.MAX_SAFE_INTEGER));
  const w = Math.max(minW, Math.min(maxW, int(item.w, minW)));
  const h = Math.max(minH, Math.min(maxH, int(item.h, minH)));
  const x = Math.max(0, Math.min(cols - w, int(item.x, 0)));
  const y = Math.max(0, int(item.y, 0));
  return { ...item, x, y, w, h };
}

/** Si dos piezas se pisan (bordes que se tocan no cuentan). */
export const overlaps = (a: GridItem, b: GridItem) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** Orden de lectura: por fila, luego columna, luego id (estable). Es el orden del DOM y del lector. */
export function sortLayout(layout: readonly GridItem[]): GridItem[] {
  return [...layout].sort((a, b) => a.y - b.y || a.x - b.x || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** Filas que ocupa la disposición. */
export const layoutRows = (layout: readonly GridItem[]) => layout.reduce((m, i) => Math.max(m, i.y + i.h), 0);

/**
 * Compactación vertical: cada pieza, en orden de lectura, baja hasta no pisar a las ya colocadas y luego sube todo lo
 * que pueda. Las fijas (`static`) y la de `pinned` se quedan donde están y las demás las rodean.
 */
export function compact(layout: readonly GridItem[], cols = GRID_COLUMNS, pinned?: string): GridItem[] {
  const placed: GridItem[] = layout.filter((i) => i.static).map((i) => clampItem(i, cols));
  const pin = layout.find((i) => i.id === pinned && !i.static);
  if (pin) {
    // La fijada no pisa a una estática: baja hasta el primer hueco.
    const item = clampItem(pin, cols);
    let y = item.y;
    while (placed.some((p) => overlaps(p, { ...item, y }))) y++;
    placed.push({ ...item, y });
  }
  const free = sortLayout(layout.filter((i) => !i.static && i.id !== pinned));
  for (const raw of free) {
    const item = clampItem(raw, cols);
    const hits = (y: number) => placed.some((p) => overlaps(p, { ...item, y }));
    let y = item.y;
    while (hits(y)) y++;
    while (y > 0 && !hits(y - 1)) y--;
    placed.push({ ...item, y });
  }
  const byId = new Map(placed.map((i) => [i.id, i]));
  // Mismo orden que la entrada: quien pinta decide el orden de lectura con sortLayout.
  return layout.map((i) => byId.get(i.id)!);
}

/** Disposición válida: piezas acotadas, ids únicos (la segunda con un id repetido se descarta) y compactada. */
export function normalizeLayout(layout: readonly GridItem[], cols = GRID_COLUMNS): GridItem[] {
  const seen = new Set<string>();
  const unique = layout.filter((i) => i && typeof i.id === "string" && !seen.has(i.id) && seen.add(i.id));
  return compact(
    unique.map((i) => clampItem(i, cols)),
    cols,
  );
}

/** Mueve una pieza a (x, y) y compacta las demás alrededor de ella; sin la pieza (o fija) devuelve la misma disposición. */
export function moveItem(layout: readonly GridItem[], id: string, x: number, y: number, cols = GRID_COLUMNS): GridItem[] {
  const target = layout.find((i) => i.id === id);
  if (!target || target.static) return [...layout];
  const moved = clampItem({ ...target, x, y }, cols);
  return compact(
    layout.map((i) => (i.id === id ? moved : i)),
    cols,
    id,
  );
}

/** Cambia el tamaño de una pieza (entre sus mínimos y máximos) y compacta las demás alrededor. */
export function resizeItem(layout: readonly GridItem[], id: string, w: number, h: number, cols = GRID_COLUMNS): GridItem[] {
  const target = layout.find((i) => i.id === id);
  if (!target || target.static) return [...layout];
  const resized = clampItem({ ...target, w, h }, cols);
  return compact(
    layout.map((i) => (i.id === id ? resized : i)),
    cols,
    id,
  );
}

/** Igualdad de posiciones y tamaños (sin mirar el orden de la lista). */
export function sameLayout(a: readonly GridItem[], b: readonly GridItem[]): boolean {
  if (a.length !== b.length) return false;
  const byId = new Map(b.map((i) => [i.id, i]));
  return a.every((i) => {
    const o = byId.get(i.id);
    return o !== undefined && o.x === i.x && o.y === i.y && o.w === i.w && o.h === i.h;
  });
}

/** La misma disposición en menos columnas: cada pieza se estrecha si no cabe, se desplaza a la izquierda y se compacta. */
export function fitColumns(layout: readonly GridItem[], cols: number): GridItem[] {
  return compact(
    sortLayout(layout).map((i) => {
      const w = Math.min(i.w, cols);
      return { ...i, w, minW: Math.min(i.minW ?? 1, cols), x: Math.min(i.x, cols - w) };
    }),
    cols,
  );
}

export type GridAction = { type: "move"; x: number; y: number } | { type: "resize"; w: number; h: number };

/**
 * Paso de teclado con la pieza cogida: flechas mueven una celda; Mayús + flechas cambian el tamaño. Las flechas son
 * visuales: en RTL la flecha izquierda avanza columnas. `null` si la tecla no hace nada.
 */
export function keyStep(item: GridItem, key: string, shift: boolean, rtl = false): GridAction | null {
  const dx = key === "ArrowRight" ? (rtl ? -1 : 1) : key === "ArrowLeft" ? (rtl ? 1 : -1) : 0;
  const dy = key === "ArrowDown" ? 1 : key === "ArrowUp" ? -1 : 0;
  if (!dx && !dy) return null;
  if (shift) return { type: "resize", w: item.w + (rtl ? -dx : dx), h: item.h + dy };
  return { type: "move", x: item.x + dx, y: item.y + dy };
}

/** Celda bajo un punto relativo a la rejilla (px), acotada para que la pieza quepa. */
export function cellAt(
  px: number,
  py: number,
  metrics: { width: number; cols: number; rowHeight: number; gap: number },
  item: Pick<GridItem, "w">,
): { x: number; y: number } {
  const colWidth = (metrics.width - metrics.gap * (metrics.cols - 1)) / metrics.cols;
  const x = Math.round(px / (colWidth + metrics.gap));
  const y = Math.round(py / (metrics.rowHeight + metrics.gap));
  return { x: Math.max(0, Math.min(metrics.cols - item.w, x)), y: Math.max(0, y) };
}

/** Tamaño en celdas para un tamaño en px (al redimensionar con el puntero). */
export function spanFor(px: number, size: number, gap: number): number {
  return Math.max(1, Math.round((px + gap) / (size + gap)));
}

/** `id:x,y,w,h;…` — para guardar la disposición en una URL o un atributo. */
export function serializeLayout(layout: readonly GridItem[]): string {
  return sortLayout(layout)
    .map((i) => `${i.id}:${i.x},${i.y},${i.w},${i.h}`)
    .join(";");
}

/** Inversa de serializeLayout; ignora lo que no tenga forma de pieza. */
export function parseLayout(text: string | null | undefined): GridItem[] {
  return (text ?? "")
    .split(";")
    .map((part) => {
      const at = part.lastIndexOf(":");
      if (at <= 0) return null;
      const nums = part
        .slice(at + 1)
        .split(",")
        .map(Number);
      if (nums.length !== 4 || nums.some((n) => !Number.isFinite(n))) return null;
      const [x, y, w, h] = nums as [number, number, number, number];
      return { id: part.slice(0, at).trim(), x, y, w, h };
    })
    .filter((i): i is GridItem => i !== null && i.id !== "");
}

export interface GridLabels {
  /** «{name}, column {x}, row {y}, {w} by {h}» */
  position: string;
  /** «{name} grabbed. Arrows move it, Shift and arrows resize, Enter drops, Escape cancels.» */
  grabbed: string;
  /** «{name} dropped. {position}» */
  dropped: string;
  /** «{name} back to column {x}, row {y}» */
  cancelled: string;
  /** Pista visible del asa con el foco. */
  hint: string;
  /** Pista visible con la pieza cogida. */
  hintGrabbed: string;
  /** Nombre del asa: «Move {name}». */
  handle: string;
  /** Nombre del tirador: «Resize {name}». */
  resize: string;
  /** Descripción del asa (aria-describedby): cómo se mueve con el teclado. */
  instructions: string;
}

export const GRID_LABELS: GridLabels = {
  position: "{name}, column {x}, row {y}, {w} by {h}",
  grabbed: "{name} grabbed. Arrows move it, Shift and arrows resize, Enter drops, Escape cancels.",
  dropped: "{name} dropped. {position}",
  cancelled: "{name} back to column {x}, row {y}",
  hint: "Space to move",
  hintGrabbed: "Arrows move · Shift resizes · Enter drops · Esc cancels",
  handle: "Move {name}",
  resize: "Resize {name}",
  instructions: "Space or Enter picks the card up; arrows move it, Shift and arrows resize it, Enter drops it and Escape cancels.",
};

const put = (t: string, v: Record<string, string | number>) => t.replace(/\{(\w+)\}/g, (_, k: string) => String(v[k] ?? ""));

/** Texto de posición de una pieza (columnas y filas desde 1). */
export function describeItem(item: GridItem, name: string, labels: Partial<GridLabels> = {}): string {
  return put(labels.position ?? GRID_LABELS.position, { name, x: item.x + 1, y: item.y + 1, w: item.w, h: item.h });
}
