import { cloneElement, type ReactElement } from "react";
import { type DiagramLegendProps as CoreProps, diagramLegendTree, type LegendOptions, legendFromGraph } from "../../core/diagram";
import type { Graph } from "../../core/graph";
import { cx } from "../../cx";
import { toReact } from "../vnode";

export type { DiagramLegendLabels, LegendEntry, LegendOptions } from "../../core/diagram";

export interface DiagramLegendProps extends Omit<CoreProps, "entries"> {
  /** Filas de la leyenda. Sin ellas, se deducen de `graph`. */
  entries?: CoreProps["entries"];
  /** Grafo del que se deduce la leyenda (categorías de arista, grosores, zonas). */
  graph?: Graph;
  /** Opciones de la deducción: textos de cada categoría, escala, símbolos extra. */
  options?: LegendOptions;
  className?: string;
  id?: string;
}

/**
 * Leyenda de un diagrama: estilos de línea por categoría (continua, discontinua, punteada, doble, con su color),
 * grosores por valor (la velocidad de un enlace), colores de zona y símbolos. Se deduce del propio grafo con
 * `legendFromGraph`, así no se desincroniza del dibujo. Cada muestra se pinta con las mismas reglas que las aristas.
 */
export function DiagramLegend({ entries, graph, options, className, id, ...props }: DiagramLegendProps) {
  const list = entries ?? (graph ? legendFromGraph(graph, options) : []);
  const el = toReact(diagramLegendTree({ ...props, entries: list })) as ReactElement<{ className?: string; id?: string }>;
  return cloneElement(el, { id, className: cx((el.props as { className?: string }).className, className) });
}
