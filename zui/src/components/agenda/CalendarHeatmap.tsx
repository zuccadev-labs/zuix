"use client";
import type { Ref } from "react";
import { heatmapWidget, type CalendarHeatmapProps as CoreProps, type HeatmapLabels } from "../../core/heatmap-widget";
import { useWidget } from "./vtree";
import { withRef } from "../../react-compat";

export type { HeatmapLabels };

export interface CalendarHeatmapProps extends CoreProps {
  onDayClick?: (detail: { date: string; value: number }) => void;
  onViewChange?: (detail: { view: "grid" | "table" }) => void;
  id?: string;
  className?: string;
  ref?: Ref<HTMLDivElement>;
}

/**
 * Mapa de calor / contribuciones: rejilla por semanas con 5 niveles y leyenda, nombre por celda, etiqueta al enfocar o
 * pasar, tabla alternativa y `encoding="size"` (el nivel también por el área). Rachas y día más activo.
 */
export const CalendarHeatmap = withRef(function CalendarHeatmap({
  onDayClick,
  onViewChange,
  id,
  className,
  ref,
  ...props
}: CalendarHeatmapProps) {
  return useWidget(heatmapWidget, props, { id, className, ref, handlers: { "day-click": onDayClick, "view-change": onViewChange } });
});
