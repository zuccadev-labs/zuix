"use client";
// Binding de React de la carga asíncrona de opciones (core/async-options): el mismo antirrebote, la misma
// cancelación y la misma paginación que el modo DOM.

import { useEffect, useRef, useState } from "react";
import { createAsyncOptions, INITIAL_ASYNC, type AsyncLoader, type AsyncOptions, type AsyncState } from "../core/async-options";

export interface AsyncOptionsHandle<T> {
  state: AsyncState<T>;
  search(query: string, immediate?: boolean): void;
  more(): void;
  retry(): void;
  abort(): void;
}

/** Carga asíncrona de opciones. Sin `load`, un estado en reposo y funciones que no hacen nada. */
export function useAsyncOptions<T>(load: AsyncLoader<T> | undefined, debounce?: number, minLength?: number): AsyncOptionsHandle<T> {
  const [state, setState] = useState<AsyncState<T>>(INITIAL_ASYNC as AsyncState<T>);
  const loader = useRef(load);
  loader.current = load;
  const engine = useRef<AsyncOptions<T> | null>(null);
  const enabled = Boolean(load);
  if (enabled && !engine.current)
    engine.current = createAsyncOptions<T>({
      load: (query, context) => loader.current!(query, context),
      debounce,
      minLength,
      onChange: setState,
    });
  // Al desmontar, nada queda en curso (ni respuestas tardías que pinten).
  useEffect(() => () => engine.current?.abort(), []);
  const e = enabled ? engine.current : null;
  return {
    state,
    search: (query, immediate) => e?.search(query, immediate),
    more: () => e?.more(),
    retry: () => e?.retry(),
    abort: () => e?.abort(),
  };
}
