"use client";
// Binding de React del núcleo de virtualización (core/virtual + core/virtual-runtime): la misma ventana, la misma
// medida de altos y el mismo desplazamiento a un índice que usan el modo DOM y las piezas de core/*-widget.

import { useReducer, useRef, type RefObject } from "react";
import { listWindow, type ListWindow, type ScrollAlign } from "../core/virtual";
import { createVirtualizer, type Virtualizer } from "../core/virtual-runtime";
import { useIsoLayoutEffect } from "./hooks";

export interface UseVirtualOptions {
  /** Si se virtualiza (ver `wantsVirtual`): si no, se pintan todas las filas. */
  enabled: boolean;
  count: number;
  /** Alto fijo o estimado de cada fila. */
  size: number | ((index: number) => number);
  /** Clave estable de cada fila: con ella se miden los altos reales tras pintar. */
  key?: (index: number) => string;
  overscan?: number;
  /** Índices que no salen del documento (la fila con el foco, la que se edita). */
  keep?: ReadonlyArray<number>;
  /** El contenedor que desplaza. */
  scroller: RefObject<HTMLElement | null>;
  /** El elemento que contiene las filas (para medirlas); por defecto, el contenedor. */
  container?: RefObject<HTMLElement | null>;
  /** Selector de las filas pintadas, con la clave en `data-key` (o en `keyAttr`). */
  rowSelector?: string;
  keyAttr?: string;
  /** Lo que ocupa el contenido anterior a la lista dentro del contenedor (cabecera de tabla). */
  offset?: () => number;
}

export interface VirtualHandle extends ListWindow {
  scrollToIndex(index: number, align?: ScrollAlign): void;
}

/** Ventana virtual de una lista de React. Sin `enabled`, devuelve todas las filas y no vigila nada. */
export function useVirtual(o: UseVirtualOptions): VirtualHandle {
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const engine = useRef<Virtualizer | null>(null);
  const latest = useRef(o);
  latest.current = o;
  const keep = o.keep ?? [];

  useIsoLayoutEffect(() => {
    const el = o.scroller.current;
    if (!o.enabled || !el) return;
    const v = createVirtualizer(el, {
      count: latest.current.count,
      size: latest.current.size,
      key: latest.current.key ? (i) => latest.current.key!(i) : undefined,
      overscan: latest.current.overscan,
      keep: () => latest.current.keep ?? [],
      offset: () => latest.current.offset?.() ?? 0,
      onChange: () => rerender(),
    });
    engine.current = v;
    rerender();
    return () => {
      v.destroy();
      engine.current = null;
    };
  }, [o.enabled, o.scroller]);

  // Cada pintado: filas y opciones nuevas, y la medida de lo que se acaba de pintar.
  useIsoLayoutEffect(() => {
    const v = engine.current;
    if (!v) return;
    v.update({ count: o.count, size: o.size, overscan: o.overscan });
    const box = o.container?.current ?? o.scroller.current;
    if (box && o.key && o.rowSelector) v.measure(box, o.rowSelector, o.keyAttr);
  });

  const v = engine.current;
  const win =
    v && o.enabled
      ? listWindow({
          virtual: true,
          count: o.count,
          size: o.key ? v.sizeOf : o.size,
          positions: o.key ? v.positions() : undefined,
          // Se lee en el pintado: la ventana sale del desplazamiento actual con las filas y los fijados de este pintado.
          scroll: scrollOf(o),
          viewport: o.scroller.current?.clientHeight || 600,
          overscan: o.overscan ?? 6,
          keep,
        })
      : listWindow({
          virtual: o.enabled,
          count: o.count,
          size: o.size,
          scroll: 0,
          viewport: 600,
          overscan: o.overscan ?? 6,
          keep,
        });
  return {
    ...win,
    scrollToIndex(index, align) {
      engine.current?.scrollToIndex(index, align);
    },
  };
}

const scrollOf = (o: UseVirtualOptions) => Math.max(0, (o.scroller.current?.scrollTop ?? 0) - (o.offset?.() ?? 0));
