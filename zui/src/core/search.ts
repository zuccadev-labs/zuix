// Comparación de texto para filtros y búsquedas: Combobox, Select, CommandPalette, Tree y menús.

/** Sin mayúsculas ni acentos, para comparar texto. */
export const fold = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Puntuación difusa mínima, sin mayúsculas ni acentos: prefijo (3) > contiene (2) > subsecuencia (1) > nada (0). */
export function score(query: string, text: string): number {
  const q = fold(query);
  const t = fold(text);
  if (t.startsWith(q)) return 3;
  if (t.includes(q)) return 2;
  let qi = 0;
  for (const ch of t) if (ch === q[qi]) qi += 1;
  return qi === q.length ? 1 : 0;
}
