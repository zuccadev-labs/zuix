// Opiniones (ReviewSummary y ReviewCard): distribución por estrellas con porcentajes que suman 100, media y recuento,
// y el corte de un texto largo en un principio visible y un resto plegable. Lógica pura, sin documento.

export interface RatingRow {
  /** Estrellas de la fila (5, 4, … 1). */
  star: number;
  count: number;
  /** Porcentaje entero del total; las filas suman 100 (o 0 sin opiniones). */
  percent: number;
  /** Fracción exacta del total (0–1), para el ancho de la barra. */
  share: number;
}

/** Recuentos por estrella: `{ 5: 873, 4: 241 }` o una lista con el recuento de 1 estrella primero. */
export type RatingCounts = Readonly<Record<number, number>> | readonly number[];

const clean = (n: unknown) => (typeof n === "number" && Number.isFinite(n) && n > 0 ? Math.floor(n) : 0);

/**
 * Filas de la distribución, de `max` estrellas a 1. Los porcentajes se reparten por el mayor resto: redondear cada fila
 * por separado puede dar 99 % o 101 %, y una persona que suma las barras lo ve.
 */
export function ratingDistribution(counts: RatingCounts, max = 5): RatingRow[] {
  const top = Math.max(1, Math.floor(max));
  const countOf = (star: number) => (Array.isArray(counts) ? clean(counts[star - 1]) : clean((counts as Record<number, number>)[star]));
  const stars = Array.from({ length: top }, (_, i) => top - i);
  const raw = stars.map((star) => ({ star, count: countOf(star) }));
  const total = raw.reduce((a, r) => a + r.count, 0);
  if (!total) return raw.map((r) => ({ ...r, percent: 0, share: 0 }));
  const exact = raw.map((r) => (r.count * 100) / total);
  const floors = exact.map(Math.floor);
  let left = 100 - floors.reduce((a, b) => a + b, 0);
  // A igualdad de resto, gana la fila de más estrellas (orden estable de la lista).
  const order = exact.map((v, i) => ({ i, rest: v - Math.floor(v) })).sort((a, b) => b.rest - a.rest || a.i - b.i);
  for (const { i } of order) {
    if (left <= 0) break;
    floors[i] = (floors[i] ?? 0) + 1;
    left -= 1;
  }
  return raw.map((r, i) => ({ ...r, percent: floors[i] ?? 0, share: r.count / total }));
}

export const ratingTotal = (rows: readonly RatingRow[]) => rows.reduce((a, r) => a + r.count, 0);

/** Media de la distribución con un decimal (0 sin opiniones). */
export function ratingAverage(rows: readonly RatingRow[]): number {
  const total = ratingTotal(rows);
  if (!total) return 0;
  const sum = rows.reduce((a, r) => a + r.star * r.count, 0);
  return Math.round((sum / total) * 10) / 10;
}

export interface Excerpt {
  /** Lo que se ve plegado. */
  head: string;
  /** El resto (vacío si el texto cabe entero). `head + tail` es siempre el texto original. */
  tail: string;
}

/**
 * Corta `text` en torno a `limit` caracteres sin partir una palabra: el corte cae en el último espacio antes del
 * límite (o en el límite si no hay ninguno cerca). Si lo que quedaría oculto es corto (menos de `slack` caracteres),
 * no se pliega: un «Read more» que despliega tres palabras es peor que mostrarlas.
 */
export function excerpt(text: string, limit = 280, slack = 40): Excerpt {
  const chars = [...text];
  if (limit <= 0 || chars.length <= limit + slack) return { head: text, tail: "" };
  const window = chars.slice(0, limit + 1).join("");
  const space = window.search(/\s\S*$/);
  // Un espacio en el último tercio del límite; si no, se corta en el límite (una URL larga, un idioma sin espacios).
  const cut = space >= Math.floor(limit * 0.66) ? space : chars.slice(0, limit).join("").length;
  return { head: text.slice(0, cut), tail: text.slice(cut) };
}

export interface ReviewSummaryLabels {
  /** «{count} reviews» */
  count: string;
  /** Una sola opinión. */
  countOne: string;
  /** Nombre de la lista de barras. */
  distribution: string;
  /** Texto de cada barra para lectores: «{star} stars: {count} reviews, {percent}». */
  bar: string;
  /** Igual con una estrella. */
  barOne: string;
  /** Nombre de las estrellas de la media: «{value} out of {max}». */
  outOf: string;
  /** Sin opiniones todavía. */
  empty: string;
  /** Nombre de las estrellas de la media. */
  rating: string;
}

export const REVIEW_SUMMARY_LABELS: ReviewSummaryLabels = {
  count: "{count} reviews",
  countOne: "1 review",
  distribution: "Rating distribution",
  bar: "{star} stars: {count} reviews, {percent}",
  barOne: "{star} star: {count} reviews, {percent}",
  outOf: "{value} out of {max}",
  empty: "No reviews yet",
  rating: "Average rating",
};

export interface ReviewCardLabels {
  readMore: string;
  readLess: string;
  /** «Response from {name}» */
  replyFrom: string;
  /** Respuesta sin autor. */
  reply: string;
  /** Nombre de cada foto como botón: «Open photo {index} of {count}». */
  photo: string;
  /** Nombre de la lista de fotos. */
  photos: string;
  /** Nombre de las estrellas. */
  rating: string;
  /** Valor de las estrellas: «{value} out of {max}». */
  outOf: string;
}

export const REVIEW_CARD_LABELS: ReviewCardLabels = {
  readMore: "Read more",
  readLess: "Show less",
  replyFrom: "Response from {name}",
  reply: "Response from the owner",
  photo: "Open photo {index} of {count}",
  photos: "Photos",
  rating: "Rating",
  outOf: "{value} out of {max}",
};

/**
 * Valor de `hidden` para lo plegado: `until-found` donde el navegador lo entiende (la búsqueda en la página lo
 * encuentra y lo abre); donde no, `hidden` a secas, porque la hoja le da `display: block` a `[hidden="until-found"]`
 * (un resto en línea no se oculta con `content-visibility`) y sin soporte eso lo dejaría a la vista.
 */
export const foldedValue = (): string =>
  typeof HTMLElement !== "undefined" && "onbeforematch" in HTMLElement.prototype ? "until-found" : "";
