// Iniciales de una persona sin romper caracteres compuestos (emoji, letras con diacrítico combinante, escrituras sin
// mayúsculas) con `Intl.Segmenter`, y un tono estable por nombre para el fondo del avatar sin foto. Sin documento.

type Segmenter = { segment(input: string): Iterable<{ segment: string }> };
let segmenter: Segmenter | null | undefined;

/** Grafemas de un texto (con `Intl.Segmenter` si existe; si no, por puntos de código). */
export function graphemes(text: string): string[] {
  if (segmenter === undefined) {
    const Ctor = (Intl as unknown as { Segmenter?: new (l?: string, o?: { granularity: string }) => Segmenter }).Segmenter;
    segmenter = Ctor ? new Ctor(undefined, { granularity: "grapheme" }) : null;
  }
  if (segmenter) return Array.from(segmenter.segment(text), (s) => s.segment);
  return Array.from(text);
}

/** Hasta dos iniciales: primera y última palabra («Ana López» → «AL»; «李小龙» → «李»). */
export function initialsOf(name: string | null | undefined, max = 2): string {
  const words = (name ?? "")
    .trim()
    .split(/[\s 　]+/)
    .filter((w) => /[\p{L}\p{N}\p{Extended_Pictographic}]/u.test(w));
  if (!words.length) return "";
  const first = graphemes(words[0]!)[0] ?? "";
  const last = max > 1 && words.length > 1 ? (graphemes(words[words.length - 1]!)[0] ?? "") : "";
  return (first + last).toLocaleUpperCase();
}

/** Número de tonos del fondo de avatar (`data-hue` de 1 a N, que la hoja lleva a los colores de serie). */
export const AVATAR_HUES = 8;

/** Tono estable por nombre (FNV-1a de 32 bits), de 1 a `hues`. El mismo nombre da siempre el mismo tono. */
export function hueOf(name: string | null | undefined, hues = AVATAR_HUES): number {
  let hash = 0x811c9dc5;
  for (const ch of (name ?? "").trim().toLocaleLowerCase()) {
    hash ^= ch.codePointAt(0)!;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return (hash % Math.max(1, hues)) + 1;
}
