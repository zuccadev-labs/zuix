import type { CSSProperties, HTMLAttributes, ReactNode, Ref } from "react";
import { Icon, type IconName } from "@zuccadev-labs/zuix-zicon/core";
import { CLOUD_BOX, CLOUD_PATH, colorVar } from "../../core/diagram";
import { isGroup, nodeLabel, type GraphNode, type NodePort as PortModel } from "../../core/graph";
import { mergeNodeLabels, type NodeCanvasLabels, nodeVars, portLabel } from "../../core/node-view";
import { portFractions, portSide } from "../../core/ports";
import { cx } from "../../cx";
import { withRef } from "../../react-compat";
import { FolderTab } from "./FolderCard";

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
 * redimensionado. Con `type: "group"`, un grupo con título; con `zone`, una zona de borde discontinuo con su color;
 * con `cloud`, una nube; con `folder`, una tarjeta con pestaña de carpeta (`data.kind` sigue al título). Solo marcado:
 * lo mueve NodeCanvas.
 */
export const Node = withRef(function Node({ node, x, y, labels, children, className, style, ref, ...rest }: NodeProps) {
  const l = mergeNodeLabels(labels);
  const label = nodeLabel(node);
  const vars = nodeVars(x ?? node.position.x, y ?? node.position.y, node.size) as CSSProperties;
  const color = colorVar(node.data.color as string | undefined);
  if (isGroup(node)) {
    const zone = node.type === "zone";
    return (
      <div
        {...rest}
        ref={ref}
        className={cx("z-node-group", className)}
        data-id={node.id}
        data-type={zone ? "zone" : "group"}
        role="group"
        aria-roledescription={l.roleGroup}
        aria-label={label}
        style={{ ...style, ...vars, ...(zone && color ? { "--z-zone-color": color } : {}) } as CSSProperties}
      >
        <div className="z-node-group__header">
          {node.data.icon ? <Icon name={node.data.icon as IconName} size={16} /> : null}
          <span className="z-node-group__title">{label}</span>
          {zone && node.data.description ? <span className="z-node-group__note">{String(node.data.description)}</span> : null}
        </div>
        {children}
        <span className="z-node__resize" aria-hidden="true" />
      </div>
    );
  }
  const ports = node.ports ?? [];
  const fractions = portFractions(ports);
  const handles = ports
    .filter((p) => !p.anchor)
    .map((p) => <NodePort key={p.id} port={p} t={fractions.get(p.id) ?? 0.5} labels={labels} />);
  const description = node.data.description ? String(node.data.description) : null;
  if (node.type === "cloud")
    return (
      <div
        {...rest}
        ref={ref}
        className={cx("z-node", className)}
        data-id={node.id}
        data-type="cloud"
        role="group"
        aria-roledescription={l.roleNode}
        aria-label={label}
        style={{ ...style, ...vars }}
      >
        <svg
          className="z-node__shape"
          viewBox={`0 0 ${CLOUD_BOX.width} ${CLOUD_BOX.height}`}
          preserveAspectRatio="none"
          aria-hidden="true"
          focusable="false"
        >
          <path d={CLOUD_PATH} vectorEffect="non-scaling-stroke" />
        </svg>
        <div className="z-node__header">
          <span className="z-node__title">{label}</span>
        </div>
        {(children ?? description) ? <div className="z-node__body">{children ?? description}</div> : null}
        {handles}
      </div>
    );
  if (node.type === "folder")
    return (
      <div
        {...rest}
        ref={ref}
        className={cx("z-node z-folder-card", className)}
        data-id={node.id}
        data-type="folder"
        role="group"
        aria-roledescription={l.roleNode}
        aria-label={label}
        style={{ ...style, ...vars, ...(color ? { "--z-folder-color": color } : {}) } as CSSProperties}
      >
        <FolderTab title={label} kind={node.data.kind as string | undefined} icon={node.data.icon as IconName | undefined} as="span" />
        <div className="z-folder-card__body">{children ?? description}</div>
        {handles}
        <span className="z-node__resize" aria-hidden="true" />
      </div>
    );
  const status = node.data.status;
  const statusText = status ? l.status[status] : "";
  const body = children ?? description;
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
      {handles}
      <span className="z-node__resize" aria-hidden="true" />
    </div>
  );
});

export interface NodeGroupProps extends Omit<NodeProps, "node"> {
  node: Omit<GraphNode, "type"> & { type?: "group" | "zone" };
}

/** Grupo o subflujo: marco con título; los nodos con `parentId` se mueven con él. */
export const NodeGroup = withRef(function NodeGroup({ node, ...rest }: NodeGroupProps) {
  return <Node {...rest} node={{ ...node, type: node.type === "zone" ? "zone" : "group" }} />;
});
