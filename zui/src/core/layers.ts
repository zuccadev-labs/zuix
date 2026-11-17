// Pila de capas descartables (popover, menú, lista, diálogo): Escape cierra solo la de arriba y una pulsación o
// un foco fuera cierran, de arriba abajo, las capas que no contienen el destino. Los listeners del documento
// existen solo mientras hay alguna capa abierta: importar el módulo no tiene efectos.

export interface Layer {
  /** Verdadero si el nodo pertenece a la capa: su contenido, su disparador o un submenú suyo. */
  contains(target: Node): boolean;
  /** Diálogo modal: lo que queda debajo es inerte y no se evalúa. */
  modal?: boolean;
  /** Escape con esta capa arriba del todo. Sin manejador, la tecla sigue su curso. */
  onEscape?(event: KeyboardEvent): void;
  onPointerOutside?(event: PointerEvent): void;
  onFocusOutside?(event: FocusEvent): void;
}

const stack: Layer[] = [];
let wired: AbortController | undefined;

function outside<E extends Event>(event: E, notify: (layer: Layer, event: E) => void): void {
  const target = event.target;
  if (!(target instanceof Node)) return;
  for (const layer of [...stack].reverse()) {
    if (layer.contains(target)) return;
    notify(layer, event);
    if (layer.modal) return;
  }
}

/**
 * Escape para la capa de arriba. Devuelve true si la capa lo atendió (y el evento queda con `preventDefault`).
 * Un evento ya cancelado no cierra nada: un campo que usa Escape para limpiarse no cierra además el diálogo.
 */
export function escapeTop(event: KeyboardEvent): boolean {
  if (event.key !== "Escape" || event.defaultPrevented) return false;
  const top = stack[stack.length - 1];
  if (!top?.onEscape) return false;
  event.preventDefault();
  top.onEscape(event);
  return true;
}

function wire(doc: Document): void {
  wired = new AbortController();
  const { signal } = wired;
  doc.addEventListener("keydown", escapeTop, { signal });
  doc.addEventListener("pointerdown", (event) => outside(event, (layer, e) => layer.onPointerOutside?.(e)), { capture: true, signal });
  doc.addEventListener("focusin", (event) => outside(event, (layer, e) => layer.onFocusOutside?.(e)), { capture: true, signal });
}

/** Añade una capa encima de la pila. Devuelve la función que la retira. */
export function pushLayer(layer: Layer, doc: Document = document): () => void {
  if (!wired) wire(doc);
  stack.push(layer);
  return () => {
    const at = stack.indexOf(layer);
    if (at >= 0) stack.splice(at, 1);
    if (!stack.length) {
      wired?.abort();
      wired = undefined;
    }
  };
}

/** Verdadero si `layer` es la capa de arriba. */
export const isTopLayer = (layer: Layer) => stack[stack.length - 1] === layer;

/** Capa modal más alta, si hay alguna. */
export const topModal = () => [...stack].reverse().find((layer) => layer.modal);

const outsideBox = (el: Element, x: number, y: number) => {
  const r = el.getBoundingClientRect();
  return x < r.left || x > r.right || y < r.top || y > r.bottom;
};

// Dónde empezó la última pulsación del puntero: un clic en el velo exige que empiece y termine en él.
let pressed: { target: EventTarget | null; x: number; y: number } | undefined;

/** Listener de `pointerdown` (captura): recuerda dónde empezó la pulsación. */
export function notePress(event: { target: EventTarget | null; clientX: number; clientY: number }): void {
  pressed = { target: event.target, x: event.clientX, y: event.clientY };
}

/** Verdadero si el clic recae en el velo de `dialog` (`::backdrop`) y la pulsación empezó también en el velo. */
export function pressedOnBackdrop(dialog: HTMLDialogElement, event: { target: EventTarget | null; clientX: number; clientY: number }): boolean {
  if (event.target !== dialog || !outsideBox(dialog, event.clientX, event.clientY)) return false;
  // Sin pulsación registrada (clic sintético, init() tardío) basta con la posición del clic.
  return !pressed || (pressed.target === dialog && outsideBox(dialog, pressed.x, pressed.y));
}
