import { Fragment } from "react";
import { type ControlsOptions, controlsTree, mergeNodeLabels, minimapTree, type NodeCanvasLabels } from "../../core/node-view";
import type { VEl } from "../../core/vnode";
import { Toolbar } from "../actions/Toolbar";
import { toReact } from "../vnode";

export interface NodeControlsProps extends ControlsOptions {
  labels?: Partial<NodeCanvasLabels>;
  className?: string;
}

/**
 * Controles de un NodeCanvas: acercar, alejar, encajar, bloquear y deshacer/rehacer (y, si se pide, ordenar). Es una
 * Toolbar: una sola parada de tabulación y flechas entre botones. Va dentro del lienzo, que atiende sus acciones.
 */
export function NodeControls({ labels, className, ...options }: NodeControlsProps) {
  const tree = controlsTree(mergeNodeLabels(labels), options);
  const a = tree.a ?? {};
  return (
    <Toolbar
      label={String(a["aria-label"])}
      orientation={options.orientation ?? "vertical"}
      size="sm"
      className={className ? `z-node-controls ${className}` : "z-node-controls"}
      data-position={options.position}
    >
      {(tree.c ?? []).map((c, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: lista fija de controles.
        <Fragment key={i}>{toReact(c)}</Fragment>
      ))}
    </Toolbar>
  );
}

export interface NodeMinimapProps {
  position?: "bottom-right" | "bottom-left" | "top-right" | "top-left";
  labels?: Partial<NodeCanvasLabels>;
  className?: string;
}

/**
 * Minimapa de un NodeCanvas: vista reducida de todos los nodos con el rectángulo visible. Pulsar o arrastrar mueve
 * la vista; con el foco, las flechas desplazan y + y − acercan y alejan.
 */
export function NodeMinimap({ position, labels, className }: NodeMinimapProps) {
  const tree: VEl = minimapTree(mergeNodeLabels(labels), position);
  const a = tree.a ?? {};
  return (
    <nav
      className={className ? `${a.class} ${className}` : String(a.class)}
      aria-label={String(a["aria-label"])}
      data-position={position}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: el minimapa es un control de la vista (flechas desplazan).
      tabIndex={0}
    />
  );
}
