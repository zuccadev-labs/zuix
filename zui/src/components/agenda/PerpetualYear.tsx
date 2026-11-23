"use client";
import type { Ref } from "react";
import type { PerpetualLabels } from "../../core/agenda-year";
import { perpetualWidget, type PerpetualYearProps as CoreProps } from "../../core/perpetual-widget";
import { useWidget } from "./vtree";
import { withRef } from "../../react-compat";

export type { PerpetualLabels };

export interface PerpetualYearProps extends CoreProps {
  onHighlightChange?: (detail: { date: string | null }) => void;
  id?: string;
  className?: string;
  ref?: Ref<HTMLDivElement>;
}

/**
 * Año perpetuo de una página: tabla de días de la semana con los meses sobre su columna y los números 1–31 en filas
 * de 7. Tabla con `caption` e instrucciones enlazadas, y un buscador de fecha que da el día de la semana en texto.
 */
export const PerpetualYear = withRef(function PerpetualYear({ onHighlightChange, id, className, ref, ...props }: PerpetualYearProps) {
  return useWidget(perpetualWidget, props, { id, className, ref, handlers: { "highlight-change": onHighlightChange } });
});
