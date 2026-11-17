"use client";
// Hooks comunes de las primitivas propias del binding de React. La lógica vive en ../core (sin React).
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { pushLayer, type Layer } from "../core/layers";
import { afterExit } from "../core/presence";

/** `useLayoutEffect` en el navegador; en el servidor no hay efecto (ni aviso). */
export const useIsoLayoutEffect = typeof document === "undefined" ? useEffect : useLayoutEffect;

/** Último valor de una prop o función, para leerlo desde efectos y listeners sin volver a suscribirse. */
export function useLatest<T>(value: T): RefObject<T> {
  const ref = useRef(value);
  useIsoLayoutEffect(() => {
    ref.current = value;
  });
  return ref;
}

/** Estado controlado (`value`) o propio (`defaultValue`), con el mismo `set` para los dos casos. */
export function useControllable<T>(value: T | undefined, defaultValue: T, onChange?: (value: T) => void): [T, (next: T) => void] {
  const [inner, setInner] = useState(defaultValue);
  const controlled = value !== undefined;
  const current = controlled ? value : inner;
  const latest = useLatest({ current, onChange });
  const set = useCallback(
    (next: T) => {
      if (Object.is(next, latest.current.current)) return;
      setInner(next);
      latest.current.onChange?.(next);
    },
    [latest],
  );
  return [current, set];
}

/**
 * Presencia: mantiene montado un elemento mientras dura su animación de salida. Devuelve si hay que pintarlo;
 * el elemento lleva `data-state="closed"` desde que `open` pasa a false hasta que la animación termina.
 */
export function usePresence(open: boolean, ref: RefObject<HTMLElement | null>): boolean {
  const [present, setPresent] = useState(open);
  if (open && !present) setPresent(true);
  useIsoLayoutEffect(() => {
    if (open || !present) return;
    const el = ref.current;
    if (!el) {
      setPresent(false);
      return;
    }
    return afterExit(el, () => setPresent(false));
  }, [open, present, ref]);
  return open || present;
}

/** Registra una capa descartable mientras `active`: Escape, pulsación fuera y foco fuera (ver core/layers). */
export function useLayer(active: boolean, layer: Layer): void {
  const latest = useLatest(layer);
  useEffect(() => {
    if (!active) return;
    return pushLayer({
      contains: (target) => latest.current.contains(target),
      modal: latest.current.modal,
      onEscape: latest.current.onEscape ? (event) => latest.current.onEscape?.(event) : undefined,
      onPointerOutside: (event) => latest.current.onPointerOutside?.(event),
      onFocusOutside: (event) => latest.current.onFocusOutside?.(event),
    });
  }, [active, latest]);
}
