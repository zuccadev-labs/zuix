"use client";
import type { Ref } from "react";
import { chartWidget, type ChartLabels, type ChartMarker, type ChartProps as CoreProps, type ChartSeries } from "../../core/chart-widget";
import { useWidget } from "../agenda/vtree";
import { withRef } from "../../react-compat";

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
export const Chart = withRef(function Chart({ onPointClick, onHiddenChange, onViewChange, id, className, ref, ...props }: ChartProps) {
  return useWidget(chartWidget, props, {
    id,
    className,
    ref,
    handlers: { "point-click": onPointClick, "hidden-change": onHiddenChange, "view-change": onViewChange },
  });
});

/** Props que solo tienen sentido en un tipo: cada componente quita las de los demás. */
type RoundOnly = "centerLabel" | "centerValue";
type ScatterOnly =
  | "yKey"
  | "sizeKey"
  | "seriesKey"
  | "labelKey"
  | "trend"
  | "xValueFormat"
  | "sizeFormat"
  | "yLabel"
  | "sizeLabel"
  | "xMin"
  | "xMax";
type ComboOnly = "y2Min" | "y2Max" | "y2Format";
type RadarOnly = "gridShape";
type HeatOnly = "valueKey" | "scale" | "domain" | "midpoint" | "showValues";
type BulletOnly = "ranges" | "rangeLabels";
type Others = ScatterOnly | ComboOnly | RadarOnly | HeatOnly | BulletOnly;

export type LineChartProps = Omit<ChartProps, "type" | "orientation" | RoundOnly | Others>;
/** Líneas: una o varias series sobre un eje de categorías, tiempo o número. */
export const LineChart = withRef(function LineChart(props: LineChartProps) {
  return <Chart {...props} type="line" />;
});

export type AreaChartProps = Omit<ChartProps, "type" | "orientation" | RoundOnly | Others>;
/** Áreas: como LineChart con relleno; `stacked` apila las series. */
export const AreaChart = withRef(function AreaChart(props: AreaChartProps) {
  return <Chart {...props} type="area" />;
});

export type BarChartProps = Omit<ChartProps, "type" | "curve" | RoundOnly | Others>;
/** Barras verticales u horizontales, agrupadas o apiladas (`stacked`). */
export const BarChart = withRef(function BarChart(props: BarChartProps) {
  return <Chart {...props} type="bar" />;
});

export interface DonutDatum {
  label: string;
  value: number;
  /** Color 1–8 (por defecto, su posición). */
  color?: number;
}

export interface DonutChartProps
  extends Omit<
    ChartProps,
    | "type"
    | "data"
    | "xKey"
    | "series"
    | "xType"
    | "stacked"
    | "orientation"
    | "curve"
    | "yMin"
    | "yMax"
    | "yTicks"
    | "xFormat"
    | "grid"
    | Others
  > {
  data: ReadonlyArray<DonutDatum>;
  /** Nombre de la medida (cabecera de la tabla). */
  valueLabel?: string;
}
/** Anillo: parte de un todo, con total en el centro y leyenda con porcentajes. */
export const DonutChart = withRef(function DonutChart({ data, valueLabel, ...props }: DonutChartProps) {
  return (
    <Chart
      {...props}
      type="donut"
      data={data as unknown as ReadonlyArray<Record<string, unknown>>}
      xKey="label"
      series={[{ key: "value", label: valueLabel ?? "" }]}
    />
  );
});

export type PieChartProps = Omit<DonutChartProps, "centerLabel" | "centerValue">;
/** Tarta: como DonutChart sin hueco central. */
export const PieChart = withRef(function PieChart({ data, valueLabel, ...props }: PieChartProps) {
  return (
    <Chart
      {...props}
      type="pie"
      data={data as unknown as ReadonlyArray<Record<string, unknown>>}
      xKey="label"
      series={[{ key: "value", label: valueLabel ?? "" }]}
    />
  );
});

export type ScatterChartProps = Omit<
  ChartProps,
  "type" | "orientation" | "curve" | "stacked" | "xType" | "xFormat" | RoundOnly | ComboOnly | RadarOnly | HeatOnly | BulletOnly
>;
/**
 * Dispersión: puntos con forma por serie (`seriesKey`), burbujas con `sizeKey` (área proporcional al valor) y recta de
 * regresión con `trend`. Cada punto es enfocable: ←→ por la serie, ↑↓ entre series.
 */
export const ScatterChart = withRef(function ScatterChart(props: ScatterChartProps) {
  return <Chart {...props} type="scatter" />;
});

export type RadarChartProps = Omit<
  ChartProps,
  "type" | "orientation" | "curve" | "stacked" | "xType" | "xFormat" | RoundOnly | ScatterOnly | ComboOnly | HeatOnly | BulletOnly
>;
/** Radar: un eje radial por fila, una serie por polígono translúcido y escala configurable (`yMin`, `yMax`, `yTicks`). */
export const RadarChart = withRef(function RadarChart(props: RadarChartProps) {
  return <Chart {...props} type="radar" />;
});

export type ComboChartProps = Omit<ChartProps, "type" | "orientation" | RoundOnly | ScatterOnly | RadarOnly | HeatOnly | BulletOnly>;
/** Barras y líneas en el mismo gráfico (`series[].type`), con eje secundario opcional (`series[].axis: "end"`). */
export const ComboChart = withRef(function ComboChart(props: ComboChartProps) {
  return <Chart {...props} type="combo" />;
});

export type HeatmapChartProps = Omit<
  ChartProps,
  | "type"
  | "orientation"
  | "curve"
  | "stacked"
  | "xType"
  | "xFormat"
  | "markers"
  | "patterns"
  | "yMin"
  | "yMax"
  | "yTicks"
  | "grid"
  | "hidden"
  | "defaultHidden"
  | "onHiddenChange"
  | RoundOnly
  | Exclude<ScatterOnly, "yKey" | "yLabel">
  | ComboOnly
  | RadarOnly
  | BulletOnly
>;
/** Mapa de calor: rejilla de celdas (`role="grid"`) con escala secuencial o divergente y leyenda de la escala. */
export const HeatmapChart = withRef(function HeatmapChart(props: HeatmapChartProps) {
  return <Chart {...props} type="heatmap" />;
});

export interface BulletDatum {
  label: string;
  value: number | null;
  /** Objetivo: la marca vertical (u horizontal). */
  target?: number;
  /** Límites superiores de los rangos de esta fila (por defecto, `ranges`). */
  ranges?: number[];
  /** Fin de la escala para esta fila (la escala es común: manda el mayor). */
  max?: number;
  /** Color 1–8 de la barra del valor. */
  color?: number;
}

export interface BulletChartProps
  extends Omit<
    ChartProps,
    | "type"
    | "data"
    | "xKey"
    | "series"
    | "xType"
    | "stacked"
    | "curve"
    | "xFormat"
    | "markers"
    | "patterns"
    | "grid"
    | "hidden"
    | "defaultHidden"
    | "onHiddenChange"
    | RoundOnly
    | ScatterOnly
    | ComboOnly
    | RadarOnly
    | HeatOnly
  > {
  data: ReadonlyArray<BulletDatum>;
}
/** Bala: valor frente a objetivo sobre rangos cualitativos, una fila por medida, horizontal o vertical. */
export const BulletChart = withRef(function BulletChart({ data, ...props }: BulletChartProps) {
  return <Chart {...props} type="bullet" data={data as unknown as ReadonlyArray<Record<string, unknown>>} xKey="label" />;
});
