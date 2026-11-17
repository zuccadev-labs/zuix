// Foco: elementos tabulables, entrada del foco en una capa, trampa de Tab y devolución al cerrar.

const TABBABLE =
  'a[href], area[href], button, input:not([type="hidden"]), select, textarea, summary, iframe, audio[controls], video[controls], [contenteditable]:not([contenteditable="false"]), [tabindex]';

const visible = (el: HTMLElement) =>
  !el.closest("[hidden], [inert]") && (typeof el.checkVisibility === "function" ? el.checkVisibility() : el.getClientRects().length > 0);

/** Elementos de `root` que reciben el foco con Tab, en orden del documento. */
export function tabbable(root: ParentNode): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(TABBABLE)].filter(
    (el) => el.tabIndex >= 0 && !(el as HTMLButtonElement).disabled && visible(el),
  );
}

/** Elemento con el foco, o null si está en `body` o no hay documento. */
export function activeElement(doc: Document = document): HTMLElement | null {
  const active = doc.activeElement;
  return active instanceof HTMLElement && active !== doc.body ? active : null;
}

/** Enfoca sin desplazar la página. Devuelve si el foco quedó en el elemento. */
export function focusQuiet(el: HTMLElement | null | undefined): boolean {
  if (!el?.isConnected) return false;
  el.focus({ preventScroll: true });
  return el.ownerDocument.activeElement === el;
}

/** Lleva el foco dentro de `container`: `[autofocus]`, el primer tabulable o el propio contenedor. */
export function focusInto(container: HTMLElement): void {
  if (container.contains(container.ownerDocument.activeElement) && container.ownerDocument.activeElement !== container) return;
  const target = container.querySelector<HTMLElement>("[autofocus]") ?? tabbable(container)[0];
  if (!focusQuiet(target)) {
    if (!container.hasAttribute("tabindex")) container.tabIndex = -1;
    focusQuiet(container);
  }
}

/**
 * Tab dentro de una capa no modal que retiene el foco: del último tabulable vuelve al primero y al revés.
 * Devuelve true si movió el foco (el llamador hace `preventDefault`).
 */
export function trapTab(container: HTMLElement, event: { key: string; shiftKey: boolean }): boolean {
  if (event.key !== "Tab") return false;
  const list = tabbable(container);
  const active = container.ownerDocument.activeElement;
  if (!list.length) return focusQuiet(container) || true;
  const first = list[0]!;
  const last = list[list.length - 1]!;
  if (event.shiftKey && (active === first || active === container)) return focusQuiet(last) || true;
  if (!event.shiftKey && active === last) return focusQuiet(first) || true;
  return false;
}
