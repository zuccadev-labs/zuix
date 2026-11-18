// Piezas compartidas del grupo forms: utilidades y popups anclados (listbox de Select y Combobox, panel de DatePicker).
// Los popups usan `popover="manual"`: capa superior del navegador, y el cierre (Escape, clic o foco fuera) lo decide
// la pila de capas de ../core/layers, igual en todos los navegadores y en el binding de React.
import { pushLayer } from "../core/layers";
import { closePopover, openPopover, place, type Placement } from "./index";
import type { Listen } from "./shared";

export const inDom = (el: Element) => el.closest("[data-z-dom]") !== null;

export function emit(el: Element, name: string, detail?: unknown): boolean {
  return el.dispatchEvent(new CustomEvent(`z:${name}`, { bubbles: true, cancelable: true, detail }));
}

/** Elementos de `root` que cumplen el selector, incluido el propio `root`, dentro de `[data-z-dom]`. */
export function all<T extends HTMLElement = HTMLElement>(root: ParentNode, selector: string): T[] {
  const list = [...root.querySelectorAll<T>(selector)];
  if (root instanceof HTMLElement && root.matches(selector)) list.unshift(root as T);
  return list.filter(inDom);
}

/** Pone o quita un atributo según `on`. */
export function flag(el: Element, name: string, on: boolean, value = ""): void {
  if (!on) el.removeAttribute(name);
  else if (el.getAttribute(name) !== value) el.setAttribute(name, value);
}

/** Sin mayúsculas ni acentos, para comparar texto. */
export { fold } from "../core/search";

/** Popup que controla un disparador: su `aria-controls` apunta al popup o a un elemento dentro de él. */
export function popupFor(trigger: Element | null | undefined): HTMLElement | null {
  const id = trigger?.getAttribute("aria-controls");
  const target = id ? document.getElementById(id) : null;
  return target?.closest<HTMLElement>("[popover], .z-listbox") ?? null;
}

interface Entry {
  /** Envoltura del campo: fija la posición y el ancho mínimo del popup. */
  owner: HTMLElement;
  trigger: HTMLElement;
  placement: Placement;
  onClose: () => void;
  /** Retira el popup de la pila de capas (core/layers). */
  release: () => void;
}

const GAP = 4;
const open = new Map<HTMLElement, Entry>();

export const isOpen = (popup: HTMLElement | null | undefined) => Boolean(popup && open.has(popup));
export const ownerOf = (popup: HTMLElement | null | undefined) => (popup ? open.get(popup)?.owner : undefined);

/** Recalcula ancho mínimo, alto disponible y posición respecto al campo. */
export function reposition(popup: HTMLElement): void {
  const entry = open.get(popup);
  if (!entry) return;
  const rect = entry.owner.getBoundingClientRect();
  // Ancho del campo (ancho mínimo de la lista); `place` escribe además el hueco disponible. Las mismas variables
  // que el binding de React.
  popup.style.setProperty("--z-anchor-width", `${rect.width}px`);
  place(popup, rect, entry.placement, GAP);
}

/**
 * Abre `popup` bajo `owner`. `trigger` lleva aria-expanded. Con `returnFocus`, el foco vuelve a `trigger` cuando el
 * popup se cierra con el foco dentro o sin destino (Select, DatePicker); un Combobox nunca pierde el foco del campo.
 */
export function showPopup(popup: HTMLElement, owner: HTMLElement, trigger: HTMLElement, onClose: () => void, returnFocus = true): void {
  if (open.has(popup)) return;
  if (popup.getAttribute("popover") !== "manual") popup.setAttribute("popover", "manual");
  // Capa descartable, la misma pila que usa el binding de React: Escape cierra solo la de arriba (antes de que llegue
  // a un diálogo que la contenga) y una pulsación o un foco fuera del campo y de su popup la cierran.
  const release = pushLayer({
    contains: (target) => popup.contains(target) || owner.contains(target),
    onEscape: () => {
      const inside = popup.contains(document.activeElement);
      hidePopup(popup);
      if (inside) trigger.focus({ preventScroll: true });
    },
    onPointerOutside: () => hidePopup(popup),
    onFocusOutside: () => hidePopup(popup),
  });
  open.set(popup, {
    owner,
    trigger,
    placement: (trigger.getAttribute("data-z-placement") as Placement) ?? "bottom-start",
    onClose,
    release,
  });
  const rect = owner.getBoundingClientRect();
  popup.style.setProperty("--z-anchor-width", `${rect.width}px`);
  // La posición la lleva este módulo (reposition): el popup sigue al campo, no al disparador.
  openPopover(popup, returnFocus ? trigger : { x: rect.left, y: rect.bottom }, "bottom-start", { follow: false });
  trigger.setAttribute("aria-expanded", "true");
  reposition(popup);
}

function forget(popup: HTMLElement): boolean {
  const entry = open.get(popup);
  if (!entry) return false;
  open.delete(popup);
  entry.release();
  entry.trigger.setAttribute("aria-expanded", "false");
  entry.onClose();
  return true;
}

export function hidePopup(popup: HTMLElement): void {
  if (forget(popup)) closePopover(popup);
}

export function setup(on: Listen): void {
  // Cerrado desde fuera (closePopover, hidePopover): se limpia igual.
  on(document, "z:close", (event) => {
    forget(event.target as HTMLElement);
  });
  const follow = (event: Event) => {
    if (!open.size || (event.target instanceof Element && event.target.closest(".z-listbox, [popover]"))) return;
    for (const popup of open.keys()) reposition(popup);
  };
  on(document, "scroll", follow, { capture: true, passive: true });
  on(window, "resize", follow);
}
