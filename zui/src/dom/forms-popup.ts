// Piezas compartidas del grupo forms: utilidades y popups anclados (listbox de Select y Combobox, panel de DatePicker).
// Los popups usan `popover="manual"`: capa superior del navegador, y el cierre (Escape, clic o foco fuera) lo decide
// este módulo, igual en todos los navegadores.
import { closePopover, openPopover, place, type Placement } from "./index";

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
export const fold = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

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
  const room = Math.max(rect.top, document.documentElement.clientHeight - rect.bottom) - GAP - 8;
  // Las mismas variables que fija Radix en el binding de React; el estilo ya las lee.
  popup.style.setProperty("--radix-select-trigger-width", `${rect.width}px`);
  popup.style.setProperty("--radix-select-content-available-height", `${room}px`);
  popup.style.setProperty("--radix-popover-content-available-height", `${room}px`);
  place(popup, rect, entry.placement, GAP);
}

/**
 * Abre `popup` bajo `owner`. `trigger` lleva aria-expanded. Con `returnFocus`, el foco vuelve a `trigger` cuando el
 * popup se cierra con el foco dentro o sin destino (Select, DatePicker); un Combobox nunca pierde el foco del campo.
 */
export function showPopup(popup: HTMLElement, owner: HTMLElement, trigger: HTMLElement, onClose: () => void, returnFocus = true): void {
  if (open.has(popup)) return;
  if (popup.getAttribute("popover") !== "manual") popup.setAttribute("popover", "manual");
  open.set(popup, { owner, trigger, placement: (trigger.getAttribute("data-z-placement") as Placement) ?? "bottom-start", onClose });
  const rect = owner.getBoundingClientRect();
  popup.style.setProperty("--radix-select-trigger-width", `${rect.width}px`);
  openPopover(popup, returnFocus ? trigger : { x: rect.left, y: rect.bottom }, "bottom-start");
  trigger.setAttribute("aria-expanded", "true");
  reposition(popup);
}

function forget(popup: HTMLElement): boolean {
  const entry = open.get(popup);
  if (!entry) return false;
  open.delete(popup);
  entry.trigger.setAttribute("aria-expanded", "false");
  entry.onClose();
  return true;
}

export function hidePopup(popup: HTMLElement): void {
  if (forget(popup)) closePopover(popup);
}

export function setup(): void {
  // Clic fuera del campo y de su popup.
  document.addEventListener("pointerdown", (event) => {
    const target = event.target as Node;
    for (const [popup, entry] of [...open]) if (!popup.contains(target) && !entry.owner.contains(target)) hidePopup(popup);
  }, true);
  // El foco sale del campo y de su popup.
  document.addEventListener("focusin", (event) => {
    const target = event.target as Node;
    for (const [popup, entry] of [...open]) if (!popup.contains(target) && !entry.owner.contains(target)) hidePopup(popup);
  });
  // Escape cierra el popup antes de que llegue a un diálogo que lo contenga.
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    const target = event.target as Node;
    for (const [popup, entry] of [...open]) {
      if (!popup.contains(target) && !entry.owner.contains(target)) continue;
      event.preventDefault();
      event.stopPropagation();
      const inside = popup.contains(document.activeElement);
      hidePopup(popup);
      if (inside) entry.trigger.focus({ preventScroll: true });
    }
  }, true);
  // Cerrado desde fuera (closePopover, hidePopover): se limpia igual.
  document.addEventListener("z:close", (event) => {
    forget(event.target as HTMLElement);
  });
  const follow = (event: Event) => {
    if (!open.size || (event.target instanceof Element && event.target.closest(".z-listbox, [popover]"))) return;
    for (const popup of open.keys()) reposition(popup);
  };
  document.addEventListener("scroll", follow, { capture: true, passive: true });
  window.addEventListener("resize", follow);
}
