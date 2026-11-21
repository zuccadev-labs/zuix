"use client";
import type { Ref } from "react";
import { chartWidget, type ChartLabels, type ChartMarker, type ChartProps as CoreProps, type ChartSeries } from "../../core/chart-widget";
import { useWidget } from "../agenda/vtree";

export type { ChartLabels, ChartMarker, ChartSeries };

export interface ChartPointDetail {
  index: number;
  datum: Record<string, unknown> | undefined;
}

export interface ChartProps extends CoreProps {
  /** Pulsación (o Intro) en una posición del eje o un sector. */
  onPointClick?: (detail: ChartPointDetail) => void;
  /** Una serie (o un sector) se mostró u ocultó desde la leyenda. Con `hidden` controlado, actualiza la prop. */
  onHiddenChange?: (detail: { hidden: string[] }) => void;
  onViewChange?: (detail: { view: "chart" | "table" }) => void;
  id?: string;
  className?: string;
  ref?: Ref<HTMLDivElement>;
}

/**
 * Gráfico cartesiano o circular sobre un mismo contrato: `figure` con título, leyenda que oculta series, ejes con
 * rótulos de `Intl`, tooltip y cruceta al pasar o enfocar, flechas entre puntos y tabla alternativa.
 */
export function Chart({ onPointClick, onHiddenChange, onViewChange, id, className, ref, ...props }: ChartProps) {
  return useWidget(chartWidget, props, {
    id,
    className,
    ref,
    handlers: { "point-click": onPointClick, "hidden-change": onHiddenChange, "view-change": onViewChange },
  });
}

export type LineChartProps = Omit<ChartProps, "type" | "orientation" | "centerLabel" | "centerValue">;
/** Líneas: una o varias series sobre un eje de categorías, tiempo o número. */
export function LineChart(props: LineChartProps) {
  return <Chart {...props} type="line" />;
}

export type AreaChartProps = Omit<ChartProps, "type" | "orientation" | "centerLabel" | "centerValue">;
/** Áreas: como LineChart con relleno; `stacked` apila las series. */
export function AreaChart(props: AreaChartProps) {
  return <Chart {...props} type="area" />;
}

export type BarChartProps = Omit<ChartProps, "type" | "curve" | "centerLabel" | "centerValue">;
/** Barras verticales u horizontales, agrupadas o apiladas (`stacked`). */
export function BarChart(props: BarChartProps) {
  return <Chart {...props} type="bar" />;
}

export interface DonutDatum {
  label: string;
  value: number;
  /** Color 1–8 (por defecto, su posición). */
  color?: number;
}

export interface DonutChartProps
  extends Omit<
    ChartProps,
    "type" | "data" | "xKey" | "series" | "xType" | "stacked" | "orientation" | "curve" | "yMin" | "yMax" | "yTicks" | "xFormat" | "grid"
  > {
  data: ReadonlyArray<DonutDatum>;
  /** Nombre de la medida (cabecera de la tabla). */
  valueLabel?: string;
}
/** Anillo: parte de un todo, con total en el centro y leyenda con porcentajes. */
export function DonutChart({ data, valueLabel, ...props }: DonutChartProps) {
  return (
    <Chart
      {...props}
      type="donut"
      data={data as unknown as ReadonlyArray<Record<string, unknown>>}
      xKey="label"
      series={[{ key: "value", label: valueLabel ?? "" }]}
    />
  );
}

export type PieChartProps = Omit<DonutChartProps, "centerLabel" | "centerValue">;
/** Tarta: como DonutChart sin hueco central. */
export function PieChart({ data, valueLabel, ...props }: PieChartProps) {
  return (
    <Chart
      {...props}
      type="pie"
      data={data as unknown as ReadonlyArray<Record<string, unknown>>}
      xKey="label"
      series={[{ key: "value", label: valueLabel ?? "" }]}
    />
  );
}
