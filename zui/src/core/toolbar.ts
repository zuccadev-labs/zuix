// Barra de herramientas (patrón APG «toolbar»): una sola parada de tabulación para todos los controles de la barra,
// también los de sus grupos y los de un ToggleGroup anidado. Las flechas del eje recorren los controles con vuelta,
// Inicio y Fin van a los extremos. Un control deshabilitado con `disabled` se salta; con `aria-disabled` sigue en el
// recorrido (así no desaparece del teclado). Lo usan Toolbar y ActionBar (React) y el modo DOM.
// Sin efectos al importar: las funciones tocan el elemento que reciben.
import { logicalKey } from "./dir";
import { move } from "./roving";

const ITEM =
  'button, a[href], input:not([type="hidden"]), select, textarea, [role="checkbox"], [role="switch"], [role="radio"], [data-toolbar-item]';

/** Verdadero si `el` pertenece a la barra `bar` y no a una capa o barra anidada dentro de ella. */
const ownedBy = (bar: Element, el: Element) => el.closest('[role="toolbar"], [popover], dialog, [role="menu"], [role="listbox"]') === bar;

/** Controles de la barra en orden del documento, sin los deshabilitados con `disabled` ni los ocultos. */
export function toolbarItems(bar: Element): HTMLElement[] {
  return [...bar.querySelectorAll<HTMLElement>(ITEM)].filter(
    (el) => ownedBy(bar, el) && !(el as HTMLButtonElement).disabled && !el.closest("[hidden], [inert]"),
  );
}

// Último control enfocado de cada barra: la parada vuelve a él aunque cambien los controles de alrededor.
const remembered = new WeakMap<Element, Element>();

/**
 * Pone la parada de tabulación en `stop` (o en el último control elegido, o en el primero) y saca del orden al resto.
 * Devuelve el elegido.
 */
export function setToolbarStop(bar: Element, stop?: Element | null): HTMLElement | undefined {
  const items = toolbarItems(bar);
  const find = (el: Element | null | undefined) => (el ? items.find((item) => item === el || item.contains(el)) : undefined);
  const chosen = find(stop) ?? find(remembered.get(bar)) ?? items[0];
  if (chosen) remembered.set(bar, chosen);
  for (const item of items) item.tabIndex = item === chosen ? 0 : -1;
  return chosen;
}

/** Un campo de texto usa las flechas para su cursor: la barra no las roba. */
const editable = (el: Element) =>
  (el instanceof HTMLInputElement && !["button", "checkbox", "radio", "range", "color", "submit", "reset"].includes(el.type)) ||
  el instanceof HTMLTextAreaElement ||
  el instanceof HTMLSelectElement;

/**
 * Control al que lleva una tecla pulsada en `from` (dentro de `bar`), o `undefined` si la tecla no navega. En
 * horizontal, las flechas izquierda y derecha (reflejadas en RTL); en vertical, arriba y abajo.
 */
export function toolbarTarget(bar: Element, from: Element, key: string): HTMLElement | undefined {
  // Un campo de texto o un select usa las flechas, Inicio y Fin para sí: se sale de él con Tab.
  if (editable(from)) return undefined;
  const items = toolbarItems(bar);
  const current = items.find((item) => item === from || item.contains(from));
  if (!current) return undefined;
  const vertical = bar.getAttribute("aria-orientation") === "vertical";
  return move(items, current, vertical ? key : logicalKey(key, bar), vertical);
}
