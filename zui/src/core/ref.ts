/**
 * Elemento al que apunta un atributo de referencia (`data-z-open`, `data-z-context`, `data-z-submenu`,
 * `data-raster`). El valor es `#id` o, por compatibilidad, un selector CSS.
 *
 * `#id` se resuelve con `getElementById`: admite cualquier id (los de `useId` de React llevan `:` o `«»`,
 * que en un selector habría que escapar) y no interpreta el valor como selector. Un selector inválido
 * devuelve null en lugar de lanzar dentro de un manejador de eventos.
 */
export function byRef<T extends HTMLElement = HTMLElement>(ref: string | null | undefined, doc: Document = document): T | null {
  const value = ref?.trim();
  if (!value) return null;
  if (value.startsWith("#")) {
    const direct = doc.getElementById(value.slice(1));
    if (direct) return direct as T;
  }
  try {
    return doc.querySelector<T>(value);
  } catch {
    return null;
  }
}
