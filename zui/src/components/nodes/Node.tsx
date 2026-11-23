import type { CSSProperties, HTMLAttributes, ReactNode, Ref } from "react";
import { Icon, type IconName } from "@zuccadev-labs/zuix-zicon/core";
import { isGroup, nodeLabel, type GraphNode, type NodePort as PortModel } from "../../core/graph";
import { mergeNodeLabels, type NodeCanvasLabels, nodeVars, portLabel } from "../../core/node-view";
import { portFractions, portSide } from "../../core/ports";
import { cx } from "../../cx";
import { withRef } from "../../react-compat";

export interface NodePortProps {
  port: PortModel;
  /** Fracción (0–1) a lo largo de su lado. Por defecto 0.5. */
  t?: number;
  labels?: Partial<NodeCanvasLabels>;
}

/** Puerto de un nodo: botón con objetivo de 24 px, lado, sentido (entrada o salida) y tipo de dato. */
export function NodePort({ port, t = 0.5, labels }: NodePortProps) {
  const l = mergeNodeLabels(labels);
  return (
    <button
      type="button"
      className="z-node-port"
      data-port={port.id}
      data-kind={port.kind}
      data-side={portSide(port)}
      data-type={port.type}
      data-max={port.max}
      aria-label={portLabel(port, l)}
      style={{ "--z-port-t": Math.round(t * 100) / 100 } as CSSProperties}
    >
      {port.label ? <span className="z-node-port__label">{port.label}</span> : null}
    </button>
  );
}

export interface NodeProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  node: GraphNode;
  /** Posición absoluta (en un lienzo la pone la interacción; aquí sirve para el primer pintado). */
  x?: number;
  y?: number;
  labels?: Partial<NodeCanvasLabels>;
  /** Cuerpo propio. Sin él, la descripción del nodo. */
  children?: ReactNode;
  ref?: Ref<HTMLDivElement>;
}

/**
 * Nodo de un lienzo: caja con cabecera (icono, título y estado), cuerpo libre, puertos de entrada y salida y asa de
 * redimensionado. Con `type: "group"`, un grupo con título. Solo marcado: lo mueve NodeCanvas.
 */
export const Node = withRef(function Node({ node, x, y, labels, children, className, style, ref, ...rest }: NodeProps) {
  const l = mergeNodeLabels(labels);
  const label = nodeLabel(node);
  const vars = nodeVars(x ?? node.position.x, y ?? node.position.y, node.size) as CSSProperties;
  if (isGroup(node)) {
    return (
      <div
        {...rest}
        ref={ref}
        className={cx("z-node-group", className)}
        data-id={node.id}
        data-type="group"
        role="group"
        aria-roledescription={l.roleGroup}
        aria-label={label}
        style={{ ...style, ...vars }}
      >
        <div className="z-node-group__header">
          {node.data.icon ? <Icon name={node.data.icon as IconName} size={16} /> : null}
          <span className="z-node-group__title">{label}</span>
        </div>
        {children}
        <span className="z-node__resize" aria-hidden="true" />
      </div>
    );
  }
  const ports = node.ports ?? [];
  const fractions = portFractions(ports);
  const status = node.data.status;
  const statusText = status ? l.status[status] : "";
  const body = children ?? (node.data.description ? String(node.data.description) : null);
  return (
    <div
      {...rest}
      ref={ref}
      className={cx("z-node", className)}
      data-id={node.id}
      data-type={node.type}
      data-status={status && status !== "idle" ? status : undefined}
      data-tone={node.data.tone}
      role="group"
      aria-roledescription={l.roleNode}
      aria-label={label}
      style={{ ...style, ...vars }}
    >
      <div className="z-node__header">
        {node.data.icon ? (
          <span className="z-node__icon" aria-hidden="true">
            <Icon name={node.data.icon as IconName} size={16} />
          </span>
        ) : null}
        <span className="z-node__title">{label}</span>
        {statusText ? (
          <span className="z-node__status" data-status={status}>
            {statusText}
          </span>
        ) : null}
      </div>
      {body !== null && body !== undefined && body !== false ? <div className="z-node__body">{body}</div> : null}
      {ports.map((p) => (
        <NodePort key={p.id} port={p} t={fractions.get(p.id) ?? 0.5} labels={labels} />
      ))}
      <span className="z-node__resize" aria-hidden="true" />
    </div>
  );
});

export interface NodeGroupProps extends Omit<NodeProps, "node"> {
  node: Omit<GraphNode, "type"> & { type?: "group" };
}

/** Grupo o subflujo: marco con título; los nodos con `parentId` se mueven con él. */
export const NodeGroup = withRef(function NodeGroup({ node, ...rest }: NodeGroupProps) {
  return <Node {...rest} node={{ ...node, type: "group" }} />;
});
