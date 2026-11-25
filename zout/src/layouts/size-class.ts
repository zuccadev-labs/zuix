"use client";
// Clase de tamaño en React: el contexto que dan AdaptiveLayout y AdaptiveSwitch y el hook useSizeClass(). La medida
// la hace ../adaptive-runtime, la misma que usa el modo sin framework.
import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import type { PointerKind, SizeClass } from "../adaptive";
import { observeSizeClass, type MeasureMode, type SizeState } from "../adaptive-runtime";

/** `useLayoutEffect` en el navegador; en el servidor, `useEffect` (React 18 avisa de un efecto de layout en el servidor). */
export const useIsoLayoutEffect = typeof document === "undefined" ? useEffect : useLayoutEffect;

/** Lo que devuelve `useSizeClass()`. Todo `null` hasta medir (en el servidor y en el primer render). */
export interface SizeClassView {
  sizeClass: SizeClass | null;
  width: number | null;
  pointer: PointerKind | null;
  hover: boolean | null;
}

const UNMEASURED: SizeClassView = Object.freeze({ sizeClass: null, width: null, pointer: null, hover: null });

/** Clase del AdaptiveLayout o AdaptiveSwitch más cercano. `null` fuera de ellos. */
export const SizeClassContext = createContext<SizeState | null>(null);

/**
 * Mide `el` (o la ventana) y devuelve su clase. Vuelve a renderizar solo cuando cambia la clase de tamaño o la de
 * entrada, no con cada píxel. `onChange` se llama con cada cambio, antes del pintado.
 */
export function useMeasuredSizeClass(
  ref: RefObject<Element | null>,
  measure: MeasureMode = "container",
  onChange?: (state: SizeState, previous: SizeState | null) => void,
): SizeState | null {
  const [state, setState] = useState<SizeState | null>(null);
  const callback = useRef(onChange);
  callback.current = onChange;
  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    return observeSizeClass(
      el,
      (next, previous) => {
        callback.current?.(next, previous);
        setState(next);
      },
      measure,
    );
  }, [ref, measure]);
  return state;
}

/**
 * Clase de tamaño y de entrada.
 *
 * - Sin argumentos, dentro de un `AdaptiveLayout` o `AdaptiveSwitch`: la de ese contenedor.
 * - Con `ref`: la del contenedor de consulta de ese elemento (o del propio elemento, si lo es).
 * - Sin argumentos y fuera de ellos: la de la ventana.
 *
 * Hasta medir devuelve todo `null`: lo que se pinte en el servidor no debe depender de la clase (para eso están las
 * plantillas y `AdaptiveSwitch`, que se colocan con CSS).
 */
export function useSizeClass(ref?: RefObject<Element | null>, measure: MeasureMode = "container"): SizeClassView {
  const context = useContext(SizeClassContext);
  const own = !ref && context === null;
  const measured = useMeasuredSizeClass(ref ?? (own ? ROOT : NONE), ref ? measure : "window");
  const state = ref || own ? measured : context;
  return state ? { sizeClass: state.sizeClass, width: state.width, pointer: state.pointer, hover: state.hover } : UNMEASURED;
}

const NONE: RefObject<Element | null> = { current: null };
/** La raíz del documento, para medir la ventana. Se lee al montar, nunca en el servidor. */
const ROOT: RefObject<Element | null> = {
  get current() {
    return typeof document === "undefined" ? null : document.documentElement;
  },
};
