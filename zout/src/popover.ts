// Copia de zui/src/core/popover.ts para los layouts de zout, que no pueden importar el `core` de zui (es interno).
// Las dos las comprueba tests/unit/popover.test.mjs con los mismos casos.
// Popover API con comprobación de existencia. Sin ella (Chromium < 114, Firefox < 125, Safari < 17) `:popover-open`
// no es un selector válido, así que `matches()` y `closest()` lanzan, y `showPopover` no existe: un clic que abre un
// menú terminaría en una excepción. Con estas funciones la capa no se abre, pero nada lanza. Si la aplicación carga
// @oddbird/popover-polyfill, el polyfill pone `showPopover` y marca la capa abierta con la clase `:popover-open`.
// Sin documento: solo toca los elementos que recibe.

/** ¿Está abierta la capa `[popover]`? Sin Popover API ni polyfill, nunca. */
export function popoverOpen(el: Element | null | undefined): boolean {
  if (!el) return false;
  try {
    return el.matches(":popover-open");
  } catch {
    return el.classList.contains(":popover-open");
  }
}

/** Capa `[popover]` abierta más cercana que contiene a `el` (él incluido), o `null`. */
export function closestOpenPopover(el: Element): Element | null {
  try {
    return el.closest(":popover-open");
  } catch {
    return el.closest(".\\:popover-open");
  }
}

/**
 * Abre la capa si el navegador (o el polyfill) sabe hacerlo; devuelve si lo intentó. `source` la declara hija de la
 * capa que contiene a ese elemento, para que abrirla no cierre la otra (donde el navegador lo admite).
 */
export function showPopover(el: HTMLElement, source?: HTMLElement): boolean {
  if (typeof el.showPopover !== "function") return false;
  (el.showPopover as (options?: { source?: HTMLElement }) => void)(source ? { source } : undefined);
  return true;
}
