// Preferencia recordada (localStorage) y compartida al momento entre todos los que la usan en la página y entre
// pestañas. En el servidor y en la hidratación vale el valor por defecto: el HTML no depende de lo guardado.
import { useSyncExternalStore } from "react";

export interface Choice<T extends string> {
  subscribe: (fn: () => void) => () => void;
  read: () => T;
  set: (v: T) => void;
  fallback: T;
}

export function createChoice<T extends string>(key: string, values: readonly T[], fallback: T): Choice<T> {
  const listeners = new Set<() => void>();
  let memory: T | undefined;
  const read = (): T => {
    if (memory) return memory;
    try {
      const v = localStorage.getItem(key);
      memory = (values as readonly string[]).includes(v ?? "") ? (v as T) : fallback;
    } catch {
      memory = fallback;
    }
    return memory;
  };
  const subscribe = (fn: () => void) => {
    listeners.add(fn);
    const onStorage = (e: StorageEvent) => {
      if (e.key !== key) return;
      memory = undefined;
      fn();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(fn);
      window.removeEventListener("storage", onStorage);
    };
  };
  const set = (v: T) => {
    memory = v;
    try {
      localStorage.setItem(key, v);
    } catch {
      // Sin almacenamiento la elección dura lo que la página.
    }
    for (const fn of listeners) fn();
  };
  return { subscribe, read, set, fallback };
}

/** Valor actual de una preferencia y la función para cambiarla. */
export function useChoice<T extends string>(choice: Choice<T>): [T, (v: T) => void] {
  return [useSyncExternalStore(choice.subscribe, choice.read, () => choice.fallback), choice.set];
}
