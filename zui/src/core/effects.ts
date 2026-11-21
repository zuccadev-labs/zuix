// Cálculos de los efectos visuales (Glow, TextEffect) que comparten React y el modo sin framework. Sin DOM ni
// efectos al importar.

/** Punto del puntero relativo a la caja del elemento, en px y acotado a la caja. */
export function glowPoint(
  rect: { left: number; top: number; width: number; height: number },
  clientX: number,
  clientY: number,
): { x: number; y: number } {
  const clamp = (v: number, max: number) => Math.min(Math.max(v, 0), Math.max(max, 0));
  return { x: Math.round(clamp(clientX - rect.left, rect.width)), y: Math.round(clamp(clientY - rect.top, rect.height)) };
}

export type TextSplit = "word" | "letter";

/** Trozo de un texto partido: un espacio (sin animar) o una palabra, con su orden o con sus letras. */
export type TextToken =
  | { space: string }
  | {
      word: string;
      /** Orden de aparición de la palabra (al partir por palabras). */
      index?: number;
      /** Letras con su orden (al partir por letras). La palabra no se corta entre líneas. */
      letters?: { text: string; index: number }[];
    };

function graphemes(word: string): string[] {
  const Segmenter = (Intl as { Segmenter?: typeof Intl.Segmenter }).Segmenter;
  return Segmenter ? [...new Segmenter(undefined, { granularity: "grapheme" }).segment(word)].map((s) => s.segment) : Array.from(word);
}

/**
 * Parte un texto en palabras o en letras (grafemas: una letra con tilde combinada o un emoji compuesto cuentan como
 * una). Los espacios se conservan tal cual, para que el texto se vea, se ajuste y se copie igual.
 */
export function splitText(text: string, by: TextSplit = "word"): TextToken[] {
  const out: TextToken[] = [];
  let index = 0;
  for (const part of text.split(/(\s+)/)) {
    if (!part) continue;
    if (/^\s+$/.test(part)) out.push({ space: part });
    else if (by === "word") out.push({ word: part, index: index++ });
    else out.push({ word: part, letters: graphemes(part).map((g) => ({ text: g, index: index++ })) });
  }
  return out;
}

/** Número de piezas animadas (palabras o letras) de un texto partido. */
export const pieceCount = (tokens: readonly TextToken[]) =>
  tokens.reduce((n, t) => n + ("word" in t ? (t.letters ? t.letters.length : 1) : 0), 0);
