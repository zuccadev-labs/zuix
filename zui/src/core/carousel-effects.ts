// Ejes del Carousel (v0.4): `layout` (cómo se reparte el espacio) y `effect` (cómo se transforma cada slide según su
// distancia al centro). Los efectos son CSS sobre una sola variable por slide, `--z-slide-progress` (−n … 0 … n,
// distancia al punto de ajuste en slides, en orden de lectura). Donde hay animaciones ligadas al desplazamiento la
// variable la anima el navegador; donde no, la escribe el motor con `slideProgress`. Sin documento al importar.

export type CarouselLayout = "strip" | "multi-browse" | "uncontained" | "hero" | "hero-center" | "fullscreen" | "stack";
export type CarouselEffect = "none" | "lens" | "prism" | "coverflow" | "fade" | "parallax" | "wheel";
/** Motor que mueve el carrusel: la tira con lente de siempre, el desplazamiento nativo o el mazo (sin desplazamiento). */
export type CarouselMode = "engine" | "snap" | "deck";

export const LAYOUTS: readonly CarouselLayout[] = ["strip", "multi-browse", "uncontained", "hero", "hero-center", "fullscreen", "stack"];
export const EFFECTS: readonly CarouselEffect[] = ["none", "lens", "prism", "coverflow", "fade", "parallax", "wheel"];
export const isLayout = (v: unknown): v is CarouselLayout => typeof v === "string" && (LAYOUTS as readonly string[]).includes(v);
export const isEffect = (v: unknown): v is CarouselEffect => typeof v === "string" && (EFFECTS as readonly string[]).includes(v);

/** Efectos que se pintan desde `--z-slide-progress`. */
export const PROGRESS_EFFECTS: readonly CarouselEffect[] = ["prism", "coverflow", "parallax", "wheel"];
/** Layouts con máscaras de M3 que calcula `core/keylines`. */
export const KEYLINE_LAYOUTS: readonly CarouselLayout[] = ["multi-browse", "hero", "hero-center"];

export interface ModeInput {
  layout?: CarouselLayout;
  effect?: CarouselEffect;
  /** Slides por página pedidos (número o "auto"). */
  perPage?: number | "auto";
  vertical?: boolean;
}

/**
 * Qué motor lleva el carrusel. La tira con lente o plana de una en una sigue en el motor propio (contrato de 0.3);
 * el fundido y el mazo no desplazan (se superponen); todo lo demás es desplazamiento nativo con scroll-snap.
 */
export function carouselMode({ layout = "strip", effect = "lens", perPage = 1, vertical = false }: ModeInput): CarouselMode {
  if (layout === "stack" || effect === "fade") return "deck";
  if (vertical || perPage === "auto" || (typeof perPage === "number" && perPage > 1)) return "snap";
  if (layout !== "strip" || effect === "wheel") return "snap";
  return effect === "lens" || effect === "none" ? "engine" : "snap";
}

/** Dónde se ajusta cada slide: al centro en los efectos de profundidad y en hero centrado; al inicio en el resto. */
export const snapAlign = (layout: CarouselLayout, effect: CarouselEffect): "start" | "center" =>
  layout === "hero-center" || effect === "prism" || effect === "coverflow" || effect === "wheel" ? "center" : "start";

/** La rueda es un cilindro vertical aunque se pida horizontal. */
export const isVertical = (orientation: string | undefined, effect: CarouselEffect) => orientation === "vertical" || effect === "wheel";

/**
 * Distancia de un slide a su punto de ajuste, en slides (`step` = tamaño + hueco), con coordenadas físicas del eje.
 * Positiva = el slide va después en la tira. `align` elige si se compara el inicio o el centro.
 */
export function slideProgress(
  slideStart: number,
  slideSize: number,
  windowStart: number,
  windowSize: number,
  step: number,
  align: "start" | "center",
): number {
  if (!(step > 0)) return 0;
  const delta = align === "center" ? slideStart + slideSize / 2 - (windowStart + windowSize / 2) : slideStart - windowStart;
  return delta / step;
}

/** Progreso acotado a `limit` slides (el CSS no necesita más: más allá el slide ya no se ve). */
export const clampProgress = (p: number, limit = 3) => (Number.isFinite(p) ? Math.max(-limit, Math.min(limit, p)) : 0);

/** Intensidad del giro y la profundidad (0–2). */
export const depthOf = (v: number | string | undefined | null) => {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? Math.max(0, Math.min(2, n)) : 1;
};

/** Desplazamiento por paso: un número (1–8) o "page" (los que caben). */
export function perMoveOf(v: number | "page" | string | undefined | null, perPage: number): number {
  if (v === "page") return Math.max(1, perPage);
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) && n >= 1 ? Math.min(8, Math.floor(n)) : 1;
}

/**
 * Puntos de ajuste reales de una tira: cada slide se ajusta en `offsets[i]`, pero el navegador no pasa del final de
 * la tira, así que varios slides finales pueden compartir punto. Devuelve un punto por posición alcanzable, con el
 * primer slide (en orden visual) que se ajusta en él.
 */
export function snapPoints(offsets: readonly number[], max: number, tolerance = 1): { at: number; first: number }[] {
  const out: { at: number; first: number }[] = [];
  const end = Math.max(0, max);
  offsets.forEach((raw, i) => {
    const at = Math.max(0, Math.min(end, raw));
    const last = out[out.length - 1];
    if (last && Math.abs(last.at - at) <= tolerance) return;
    out.push({ at, first: i });
  });
  if (!out.length) out.push({ at: 0, first: 0 });
  return out;
}

/** Posición (índice de `points`) más cercana a un desplazamiento. */
export function nearestPoint(points: readonly { at: number }[], scroll: number): number {
  let best = 0;
  let distance = Number.POSITIVE_INFINITY;
  points.forEach((p, i) => {
    const d = Math.abs(p.at - scroll);
    if (d < distance - 0.5) {
      best = i;
      distance = d;
    }
  });
  return best;
}

/** Distancia con signo más corta de `index` a `current` en un mazo de `count` (con bucle da la vuelta). */
export function deckOffset(index: number, current: number, count: number, loop: boolean): number {
  const raw = index - current;
  if (!loop || count < 3) return raw;
  const half = count / 2;
  let d = ((raw % count) + count) % count;
  if (d > half) d -= count;
  return d;
}

/** Fracción del arrastre de un mazo que confirma el paso (o una velocidad de lanzamiento, px/ms). */
export const deckCommits = (dx: number, width: number, velocity = 0) =>
  (width > 0 && Math.abs(dx) / width > 0.28) || Math.abs(velocity) > 0.6;

/**
 * El contenido del slide va dentro de `.z-carousel__face` cuando el efecto o el layout lo transforman: así el área de
 * ajuste (el propio slide) no se mueve con la transformación.
 */
export const needsFace = (layout: CarouselLayout, effect: CarouselEffect) =>
  effect === "prism" || effect === "coverflow" || effect === "wheel" || KEYLINE_LAYOUTS.includes(layout);
