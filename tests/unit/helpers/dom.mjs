// DOM mínimo para las pruebas unitarias: happy-dom instalado como globales del proceso.
// Se importa ANTES que el código bajo prueba (`import "./helpers/dom.mjs"` en la primera línea).
// happy-dom no calcula layout ni implementa la API Popover: las medidas se fijan con `setRect`/`setBox`/`setViewport`
// y `showPopover`/`hidePopover` se sustituyen por un marcador. El comportamiento real de la capa superior se
// comprueba en navegador (tests/html, tests/browser); aquí solo se prueba la lógica.
import { Window } from "happy-dom";

export const window = new Window({ url: "http://localhost/", width: 1024, height: 768 });

for (const key of Object.getOwnPropertyNames(window)) {
  if (key in globalThis || key === "undefined") continue;
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: window[key] });
}
globalThis.window = window;
globalThis.document = window.document;
// Node trae sus propios Event y CustomEvent: happy-dom solo despacha los suyos.
for (const key of ["Event", "CustomEvent"])
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: window[key] });

const proto = window.HTMLElement.prototype;
if (typeof proto.showPopover !== "function") {
  proto.showPopover = function showPopover() {
    this.setAttribute("data-test-popover-open", "");
  };
  proto.hidePopover = function hidePopover() {
    this.removeAttribute("data-test-popover-open");
  };
}
// happy-dom 21 no expone HTMLTableSectionElement.rows.
const section = window.HTMLTableSectionElement?.prototype;
if (section && !("rows" in section)) {
  Object.defineProperty(section, "rows", {
    configurable: true,
    get() {
      return [...this.children].filter((child) => child.tagName === "TR");
    },
  });
}

/** Fija el rectángulo que devuelve `getBoundingClientRect()` de un elemento. */
export function setRect(el, { left = 0, top = 0, width = 0, height = 0 }) {
  el.getBoundingClientRect = () => new window.DOMRect(left, top, width, height);
  return el;
}

/** Fija propiedades de caja (offsetLeft, offsetWidth, clientWidth…) de un elemento. */
export function setBox(el, box) {
  for (const [key, value] of Object.entries(box)) Object.defineProperty(el, key, { configurable: true, get: () => value });
  return el;
}

/** Fija el tamaño de la ventana que leen los cálculos de posición (`documentElement.clientWidth/Height`). */
export function setViewport(width, height) {
  setBox(window.document.documentElement, { clientWidth: width, clientHeight: height });
}

/** Sustituye el contenido de <body> y devuelve el primer elemento. */
export function mount(html) {
  window.document.body.innerHTML = html;
  return window.document.body.firstElementChild;
}

/** Pulsa una tecla sobre un elemento; devuelve el evento (para leer `defaultPrevented`). */
export function press(el, key, init = {}) {
  const event = new window.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init });
  el.dispatchEvent(event);
  return event;
}

export function click(el) {
  const event = new window.MouseEvent("click", { bubbles: true, cancelable: true });
  el.dispatchEvent(event);
  return event;
}
