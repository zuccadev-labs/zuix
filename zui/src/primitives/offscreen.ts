"use client";
import { useEffect, useRef, type RefCallback, type Ref } from "react";
import { pauseOffscreen } from "../core/visibility";

/**
 * Ref que pausa las animaciones del elemento mientras está fuera de pantalla (core/visibility) y reenvía el nodo
 * a la `ref` de la persona usuaria. `enabled` en falso no observa (un efecto sin movimiento no lo necesita).
 */
export function useOffscreenRef<T extends Element>(ref?: Ref<T>, enabled = true): RefCallback<T> {
  const node = useRef<T | null>(null);
  const outer = useRef(ref);
  outer.current = ref;
  useEffect(() => (enabled && node.current ? pauseOffscreen(node.current) : undefined), [enabled]);
  const set = useRef<RefCallback<T>>((el) => {
    node.current = el;
    const r = outer.current;
    if (typeof r === "function") r(el);
    else if (r) (r as { current: T | null }).current = el;
  });
  return set.current;
}
