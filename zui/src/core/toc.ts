// Índice de una página (TableOfContents): niveles de los encabezados a sangrías, la sección que se lee según la
// posición de cada encabezado respecto a una línea de lectura y el comportamiento del desplazamiento. Puro: la
// observación (IntersectionObserver) y el desplazamiento viven en ./toc-widget.

export interface TocItem {
  /** Id del encabezado o la sección a la que lleva. */
  id: string;
  label: string;
  /** Nivel del encabezado (1–6). El menor de la lista no lleva sangría. */
  level?: number;
}

export interface TocRow {
  id: string;
  label: string;
  /** Sangría desde 0, como mucho 3. */
  depth: number;
}

/** Filas del índice: sin ids vacíos ni repetidos, con la sangría relativa al nivel más alto de la lista. */
export function tocRows(items: readonly TocItem[]): TocRow[] {
  const seen = new Set<string>();
  const clean = items.filter((i) => i && typeof i.id === "string" && i.id !== "" && !seen.has(i.id) && seen.add(i.id));
  const level = (i: TocItem) => Math.max(1, Math.min(6, Math.floor(Number(i.level) || 2)));
  const top = clean.length ? Math.min(...clean.map(level)) : 2;
  return clean.map((i) => ({ id: i.id, label: String(i.label ?? i.id), depth: Math.min(3, level(i) - top) }));
}

/**
 * Índice de la sección que se lee: la última cuyo encabezado ya cruzó la línea de lectura (`line`, px desde arriba
 * del área visible). Si ninguno la cruzó, la primera. Al final del documento (`atEnd`), la última que existe: una
 * sección corta al pie nunca llega a la línea. Los `null` son encabezados que no están en el documento. -1 si no hay
 * ninguno.
 */
export function activeHeading(tops: readonly (number | null)[], line: number, atEnd = false): number {
  let first = -1;
  let last = -1;
  let passed = -1;
  tops.forEach((top, i) => {
    if (top === null || !Number.isFinite(top)) return;
    if (first < 0) first = i;
    last = i;
    if (top <= line) passed = i;
  });
  if (atEnd && last >= 0) return last;
  return passed >= 0 ? passed : first;
}

/** Línea de lectura: bajo lo que tapa arriba (`offset`) y a un cuarto del alto visible, como mucho 160 px más abajo. */
export const readingLine = (viewport: number, offset = 0) => Math.max(0, offset) + Math.min(Math.max(0, viewport) * 0.25, 160);

/** Desplazamiento suave salvo con movimiento reducido o si se pide sin animación. */
export const scrollBehaviorFor = (reduced: boolean, smooth = true): ScrollBehavior => (smooth && !reduced ? "smooth" : "auto");

/** Id al que apunta un `href` de fragmento (`#id`, con o sin codificar); `null` si no es un fragmento. */
export function fragmentId(href: string | null | undefined): string | null {
  if (!href?.startsWith("#") || href.length < 2) return null;
  try {
    return decodeURIComponent(href.slice(1));
  } catch {
    return href.slice(1);
  }
}
