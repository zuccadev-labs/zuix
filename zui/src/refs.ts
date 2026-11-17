"use client";
import { useCallback, type Ref, type RefCallback } from "react";

/**
 * Une varias refs en una sola función de ref. Respeta el contrato de React 19: si una ref de función
 * devuelve una limpieza, se llama a esa limpieza al desmontar (y no a la ref con `null`).
 */
export function mergeRefs<T>(...refs: Array<Ref<T> | undefined>): RefCallback<T> {
  return (node) => {
    const cleanups = refs.map((ref) => {
      if (typeof ref === "function") {
        const cleanup = ref(node);
        return typeof cleanup === "function" ? cleanup : () => void ref(null);
      }
      if (ref) {
        ref.current = node;
        return () => {
          ref.current = null;
        };
      }
      return undefined;
    });
    return () => {
      for (const cleanup of cleanups) cleanup?.();
    };
  };
}

/** `mergeRefs` estable entre renders mientras no cambien las refs: React no la desconecta en cada render. */
export function useMergedRef<T>(inner: Ref<T> | undefined, outer: Ref<T> | undefined): RefCallback<T> {
  // eslint-disable-next-line react-hooks/exhaustive-deps -- las dos refs son las dependencias.
  return useCallback(mergeRefs(inner, outer), [inner, outer]);
}
