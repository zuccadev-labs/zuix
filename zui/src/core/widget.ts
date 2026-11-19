// Contrato de las piezas de la agenda que no son el EventCalendar (año perpetuo, línea temporal, buscar hueco,
// franjas, mapa de calor, rachas): una pieza es un árbol (core/vnode) calculado de su configuración y su estado, más la
// interacción conectada al elemento raíz. El binding de React y el modo DOM pintan el mismo árbol y llaman a la misma
// interacción; aquí solo los tipos y ayudas sin documento al importar.

import type { VEl } from "./vnode";

export interface WidgetHost<C, S> {
  config(): C;
  state(): S;
  /** Cambia el estado y vuelve a pintar; con `focus`, tras pintar lleva el foco a la pieza activa. */
  update(patch: Partial<S>, focus?: boolean): void;
  /** Avisa a la aplicación: `onX` en React, `z:x` (sin guiones) en el modo DOM. */
  emit(name: string, detail: unknown): void;
}

export interface Widget<P, C, S> {
  /** Clase de la raíz (`z-timeline`): el modo DOM monta los elementos que la llevan. */
  root: string;
  configure(props: P): C;
  initial(config: C): S;
  /** Lo controlado por props que manda en cada pintado (React) o al cambiar atributos (DOM). */
  control?(config: C, state: S): S;
  tree(config: C, state: S, uid: string): VEl;
  attach(root: HTMLElement, host: WidgetHost<C, S>): () => void;
  /** Tras pintar: foco y lo que dependa de la geometría. Por defecto, el foco a la pieza con `tabindex="0"`. */
  after?(root: HTMLElement, host: WidgetHost<C, S>, focus: boolean): void;
  /** Cambio de un Calendar incrustado (hueco `calendar` con `p.name`). */
  calendarChange?(host: WidgetHost<C, S>, name: string, value: unknown): void;
  /** Props del modo DOM: atributos `data-*` y `<script type="application/json" data-props>`. */
  fromDom(el: HTMLElement, json: Record<string, unknown>): P;
}

/** Foco por defecto tras pintar: la pieza activa de la vista (o la indicada por selector). */
export function focusActive(root: HTMLElement, selector = '[data-focus-id][tabindex="0"]'): void {
  const target = root.querySelector<HTMLElement>(selector);
  if (target && target !== root.ownerDocument.activeElement) {
    target.focus({ preventScroll: true });
    target.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }
}

/** Nombre del evento del modo DOM (`z:` + nombre sin guiones) y de la prop de React (`on` + CamelCase). */
export const domEventName = (name: string) => name.replace(/-/g, "");
export const reactHandlerName = (name: string) => `on${name.replace(/(^|-)(\w)/g, (_, __, c: string) => c.toUpperCase())}`;

/** Lectura tolerante de atributos `data-*`. */
export const yes = (v: string | undefined) => v !== undefined && v !== "false";
export const num = (v: string | undefined, fallback: number) => (v !== undefined && v !== "" && Number.isFinite(Number(v)) ? Number(v) : fallback);
export const list = (v: string | undefined) => (v ?? "").split(/[\s,]+/).filter(Boolean);

/** Anuncio educado con ~500 ms de retraso y vaciado previo en la región viva `.z-live` de la pieza. */
const liveTimers = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();
export function announceIn(root: HTMLElement, text: string, selector = "[data-live]"): void {
  const live = root.querySelector<HTMLElement>(selector);
  if (!live) return;
  clearTimeout(liveTimers.get(live));
  live.textContent = "";
  liveTimers.set(
    live,
    setTimeout(() => {
      live.textContent = text;
    }, 500),
  );
}
