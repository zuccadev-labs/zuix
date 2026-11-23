"use client";
import { Fragment, type MouseEvent } from "react";
import type { Graph } from "../../core/graph";
import { listViewTree, mergeNodeLabels, type NodeCanvasLabels } from "../../core/node-view";
import { cx } from "../../cx";
import { toReact } from "../vnode";

export interface NodeListViewProps {
  /** El mismo modelo que el lienzo. */
  graph: Graph;
  /** «Show» de un nodo: lo normal es volver al lienzo con el foco en él (`canvas.focusNode(id)`). */
  onShowNode?: (id: string) => void;
  /** Quitar una conexión. Sin él (o con `readOnly`), la columna de acciones de conexiones queda vacía. */
  onRemoveEdge?: (id: string) => void;
  readOnly?: boolean;
  labels?: Partial<NodeCanvasLabels>;
  className?: string;
}

/**
 * Vista en lista de un grafo de nodos: una tabla de nodos (estado, entradas y salidas) y otra de conexiones, con las
 * mismas acciones que el lienzo. Es la alternativa accesible y exportable al diagrama.
 */
export function NodeListView({ graph, onShowNode, onRemoveEdge, readOnly, labels, className }: NodeListViewProps) {
  const tree = listViewTree(graph, mergeNodeLabels(labels), readOnly || !onRemoveEdge);
  const onClick = (event: MouseEvent<HTMLDivElement>) => {
    const button = (event.target as Element).closest<HTMLElement>("[data-node-action]");
    if (!button) return;
    if (button.dataset.nodeAction === "show" && button.dataset.node) onShowNode?.(button.dataset.node);
    if (button.dataset.nodeAction === "remove-edge" && button.dataset.edge) onRemoveEdge?.(button.dataset.edge);
  };
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: delega los clics de sus botones.
    // biome-ignore lint/a11y/useKeyWithClickEvents: los botones nativos ya responden al teclado.
    <div className={cx("z-node-list", className)} onClick={onClick}>
      {(tree.c ?? []).map((c, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: dos tablas fijas.
        <Fragment key={i}>{toReact(c)}</Fragment>
      ))}
    </div>
  );
}
