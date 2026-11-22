// «Keylines» de los carruseles de Material 3 (multi-browse, hero y hero centrado): dado el ancho de la vista, una
// lista de huecos de tamaños distintos (grande, mediano, pequeño). Cada slide mide siempre lo del hueco grande y
// el desplazamiento es el nativo; lo que cambia al desplazar es la máscara (qué parte del slide se ve) y una
// traslación que junta las máscaras con el hueco de siempre. Lógica pura, en px.

export type KeylineLayout = "multi-browse" | "hero" | "hero-center";

export interface Arrangement {
  layout: KeylineLayout;
  /** Ancho real de cada slide (el del hueco grande). */
  item: number;
  gap: number;
  /** Tamaño visible de cada hueco, en orden. */
  lines: number[];
  /** Hueco donde se ajusta el slide actual. */
  focal: number;
  /** Tamaño de los huecos que quedan fuera de la vista (por donde entran y salen los slides). */
  small: number;
  align: "start" | "center";
}

export interface ArrangeOptions {
  gap?: number;
  /** Ancho preferido del hueco grande (multi-browse). Por defecto 320. */
  large?: number;
  /** Hueco pequeño: entre 40 y 56 px en M3. */
  small?: number;
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/** Huecos para una vista de `view` px. Nunca da tamaños negativos: en una vista mínima queda un solo hueco. */
export function arrange(layout: KeylineLayout, view: number, options: ArrangeOptions = {}): Arrangement {
  const gap = Math.max(0, options.gap ?? 8);
  const v = Math.max(1, view);
  const small = clamp(options.small ?? clamp(v * 0.1, 40, 56), 8, Math.max(8, v / 4));
  if (layout === "hero") {
    const item = Math.max(1, v - small - gap);
    return { layout, item, gap, lines: [item, small], focal: 0, small, align: "start" };
  }
  if (layout === "hero-center") {
    const item = Math.max(1, v - 2 * (small + gap));
    return { layout, item, gap, lines: [small, item, small], focal: 1, small, align: "center" };
  }
  // multi-browse: k grandes, uno mediano (la mitad del grande) y uno pequeño.
  const preferred = Math.max(80, options.large ?? 320);
  const k = clamp(Math.floor((v - small) / (preferred * 1.5)), 1, 3);
  const item = Math.max(1, (v - small - (k + 1) * gap) / (k + 0.5));
  const lines = [...Array.from({ length: k }, () => item), item / 2, small];
  return { layout, item, gap, lines, focal: 0, small, align: "start" };
}

/** Tamaño del hueco `k` (entero), con los de fuera de la vista: pequeños y luego cero. */
function sizeAt(lines: readonly number[], small: number, k: number): number {
  if (k >= 0 && k < lines.length) return lines[k]!;
  if (k === -1 || k === lines.length) return small;
  return 0;
}

/** Inicio del hueco `k` (entero) desde el inicio de la vista. */
function startAt(lines: readonly number[], small: number, gap: number, k: number): number {
  if (k >= 0) {
    let x = 0;
    for (let i = 0; i < k; i++) x += sizeAt(lines, small, i) + gap;
    return x;
  }
  let x = 0;
  for (let i = -1; i >= k; i--) x -= sizeAt(lines, small, i) + gap;
  return x;
}

/** Máscara de un slide que está en la posición `slot` (fraccionaria): inicio y tamaño, interpolados entre huecos. */
export function frameAtSlot(lines: readonly number[], small: number, gap: number, slot: number): { x: number; size: number } {
  const k = Math.floor(slot);
  const t = slot - k;
  const s0 = sizeAt(lines, small, k);
  const s1 = sizeAt(lines, small, k + 1);
  const x0 = startAt(lines, small, gap, k);
  const x1 = startAt(lines, small, gap, k + 1);
  return { x: x0 + (x1 - x0) * t, size: s0 + (s1 - s0) * t };
}

export interface KeylineFrame {
  /** Traslación del slide respecto a su sitio natural (px, en el eje y en orden de lectura). */
  shift: number;
  /** Recorte de cada lado del slide (px): la máscara es el centro del slide. */
  inset: number;
  /** Tamaño visible. */
  size: number;
}

/**
 * Máscara y traslación de un slide a `p` slides de su punto de ajuste. `end` (0–1) mezcla con la disposición
 * invertida al final de una tira alineada al inicio, para que el último slide llegue grande; `endSlot` es la posición
 * que ocupa el slide en la disposición invertida.
 */
export function keylineFrame(a: Arrangement, p: number, end = 0, endSlot = 0): KeylineFrame {
  const step = a.item + a.gap;
  const startFrame = frameAtSlot(a.lines, a.small, a.gap, a.focal + p);
  let frame = startFrame;
  if (end > 0 && a.align === "start") {
    const reversed = [...a.lines].reverse();
    const endFrame = frameAtSlot(reversed, a.small, a.gap, endSlot);
    const e = Math.max(0, Math.min(1, end));
    frame = { x: startFrame.x + (endFrame.x - startFrame.x) * e, size: startFrame.size + (endFrame.size - startFrame.size) * e };
  }
  const view = a.lines.reduce((n, s) => n + s, 0) + a.gap * (a.lines.length - 1);
  // Sitio natural del inicio del slide respecto al inicio de la vista.
  const natural = a.align === "center" ? view / 2 - a.item / 2 + p * step : p * step;
  const inset = Math.max(0, (a.item - frame.size) / 2);
  return { shift: frame.x - inset - natural, inset, size: frame.size };
}

/**
 * Mezcla con la disposición final de una tira alineada al inicio: 0 lejos del final, 1 en el tope. `scroll` y `max`
 * en px; la mezcla ocupa los últimos `lines − 1` pasos (o toda la tira si es más corta).
 */
export function endBlend(a: Arrangement, scroll: number, max: number): number {
  if (a.align !== "start" || !(max > 0)) return 0;
  const span = Math.min(max, (a.lines.length - 1) * (a.item + a.gap));
  if (!(span > 0)) return 0;
  return Math.max(0, Math.min(1, 1 - (max - scroll) / span));
}
