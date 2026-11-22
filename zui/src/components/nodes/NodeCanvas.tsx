"use client";
import { memo, type ReactNode, type Ref, useId, useImperativeHandle, useMemo, useRef, useState } from "react";
import { absolutePosition, type Graph, type GraphEdge, type GraphNode, indexNodes, isGroup, paintOrder } from "../../core/graph";
import {
  bindNodeCanvas,
  type CanvasSelection,
  type GraphChange,
  type NodeCanvasHandle,
  type NodeCanvasOptions,
} from "../../core/node-canvas";
import { mergeNodeLabels, type NodeCanvasLabels } from "../../core/node-view";
import type { Viewport } from "../../core/viewport";
import { cx } from "../../cx";
import { useIsoLayoutEffect, useLatest } from "../../primitives/hooks";
import { Node } from "./Node";
import { NodeControls, type NodeControlsProps, NodeMinimap, type NodeMinimapProps } from "./NodeControls";

export type { CanvasSelection, GraphChange, NodeCanvasHandle };

export interface NodeRenderState {
  /** Posición absoluta. */
  x: number;
  y: number;
}

export interface NodeCanvasProps {
  /** Nodos (controlado). Con `onNodesChange` se reciben los cambios. */
  nodes?: GraphNode[];
  /** Aristas (controlado). */
  edges?: GraphEdge[];
  defaultNodes?: GraphNode[];
  defaultEdges?: GraphEdge[];
  onNodesChange?: (nodes: GraphNode[], change: GraphChange) => void;
  onEdgesChange?: (edges: GraphEdge[], change: GraphChange) => void;
  /** Cualquier cambio del modelo, con los dos arrays. */
  onChange?: (graph: Graph, change: GraphChange) => void;
  /** Conexión nueva (ya incluida en `onEdgesChange`). */
  onConnect?: (edge: GraphEdge) => void;
  /** Validación propia de una conexión, además de sentido, tipos y límites de los puertos. */
  isValidConnection?: (edge: Omit<GraphEdge, "id">) => boolean;
  /** Permite ciclos al conectar. Por defecto sí. */
  allowCycles?: boolean;
  /** Cuerpo de cada nodo. Sin él, la descripción (`data.description`). */
  renderNode?: (node: GraphNode, state: NodeRenderState) => ReactNode;
  viewport?: Viewport;
  defaultViewport?: Viewport;
  onViewportChange?: (viewport: Viewport) => void;
  minZoom?: number;
  maxZoom?: number;
  /** Cuadrícula del imán (unidades del mundo) o `false`. Por defecto 16. */
  snap?: number | false;
  /** Encuadra todo al montar si no llega `viewport` ni `defaultViewport`. Por defecto sí. */
  fitOnMount?: boolean;
  /** Ids seleccionados (controlado). */
  selection?: Partial<CanvasSelection>;
  onSelectionChange?: (selection: CanvasSelection) => void;
  /** Solo mirar y navegar. */
  readOnly?: boolean;
  onLockChange?: (locked: boolean) => void;
  edgeType?: GraphEdge["type"];
  background?: "dots" | "grid" | "none";
  /** Minimapa: `false` lo quita; un objeto lo configura. Por defecto sí. */
  minimap?: boolean | NodeMinimapProps;
  /** Controles: `false` los quita; un objeto los configura. Por defecto sí. */
  controls?: boolean | NodeControlsProps;
  labels?: Partial<NodeCanvasLabels>;
  locale?: string;
  /** Más cromo dentro del lienzo (paneles propios). */
  children?: ReactNode;
  id?: string;
  className?: string;
  "aria-label"?: string;
  ref?: Ref<NodeCanvasHandle>;
}

const NodeView = memo(function NodeView({
  node,
  x,
  y,
  labels,
  render,
}: {
  node: GraphNode;
  x: number;
  y: number;
  labels?: Partial<NodeCanvasLabels>;
  render?: NodeCanvasProps["renderNode"];
}) {
  return (
    <Node node={node} x={x} y={y} labels={labels}>
      {render && !isGroup(node) ? render(node, { x, y }) : undefined}
    </Node>
  );
});

/**
 * Lienzo de nodos sin dependencias: zoom (Ctrl/⌘ + rueda o pellizco), desplazamiento (rueda, arrastre del fondo,
 * Espacio + arrastre, flechas), imán, caja de selección con Mayús, arrastrar y redimensionar nodos, conectar arrastrando
 * desde un puerto (o con dos clics, o con el teclado), reconectar, borrar, copiar/pegar/duplicar, deshacer/rehacer,
 * grupos, minimapa, controles y disposición automática por capas. Solo se pintan los nodos y aristas que se ven.
 */
export function NodeCanvas({
  nodes,
  edges,
  defaultNodes,
  defaultEdges,
  onNodesChange,
  onEdgesChange,
  onChange,
  onConnect,
  isValidConnection,
  allowCycles,
  renderNode,
  viewport,
  defaultViewport,
  onViewportChange,
  minZoom,
  maxZoom,
  snap = 16,
  fitOnMount,
  selection,
  onSelectionChange,
  readOnly,
  onLockChange,
  edgeType,
  background = "dots",
  minimap = true,
  controls = true,
  labels,
  locale,
  children,
  id,
  className,
  "aria-label": ariaLabel,
  ref,
}: NodeCanvasProps) {
  const auto = useId().replace(/:/g, "");
  const uid = id ?? `z-node-canvas-${auto}`;
  const root = useRef<HTMLDivElement | null>(null);
  const handle = useRef<NodeCanvasHandle | null>(null);
  const [graph, setGraph] = useState<Graph>(() => ({ nodes: nodes ?? defaultNodes ?? [], edges: edges ?? defaultEdges ?? [] }));
  // Antes de montar se pintan todos (marcado de servidor); luego, solo los visibles.
  const [visible, setVisible] = useState<ReadonlySet<string> | null>(null);
  const callbacks = useLatest({
    onNodesChange,
    onEdgesChange,
    onChange,
    onConnect,
    onViewportChange,
    onSelectionChange,
    onLockChange,
    isValidConnection,
  });
  const prev = useRef({ nodes, edges, viewport, selection });
  const l = mergeNodeLabels(labels);

  const options: Omit<NodeCanvasOptions, "graph"> = {
    minZoom,
    maxZoom,
    snap,
    readOnly,
    edgeType,
    allowCycles,
    labels,
    locale,
    isValidConnection: (edge) => callbacks.current.isValidConnection?.(edge) ?? true,
  };

  useIsoLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    let last: Graph = handle.current?.graph ?? graph;
    const h = bindNodeCanvas(el, {
      ...options,
      graph: last,
      viewport: viewport ?? defaultViewport,
      fitOnMount: fitOnMount ?? !(viewport ?? defaultViewport),
      onVisible: (ids) => setVisible(new Set(ids)),
      onGraphChange: (next, change) => {
        const before = last;
        last = next;
        setGraph(next);
        const c = callbacks.current;
        if (next.nodes !== before.nodes) c.onNodesChange?.(next.nodes, change);
        if (next.edges !== before.edges) c.onEdgesChange?.(next.edges, change);
        c.onChange?.(next, change);
      },
      onViewportChange: (vp) => callbacks.current.onViewportChange?.(vp),
      onSelectionChange: (sel) => callbacks.current.onSelectionChange?.(sel),
      onConnect: (edge) => callbacks.current.onConnect?.(edge),
      onLockChange: (locked) => callbacks.current.onLockChange?.(locked),
    });
    handle.current = h;
    if (selection) h.setSelection(selection);
    return () => {
      h.dispose();
      handle.current = null;
    };
    // El lienzo se monta una vez: lo que cambia después entra por setGraph, setViewport y setOptions.
  }, []);

  // Props controladas: solo si cambian y no son el eco de lo que el lienzo acaba de emitir.
  useIsoLayoutEffect(() => {
    const h = handle.current;
    const p = prev.current;
    prev.current = { nodes, edges, viewport, selection };
    if (!h) return;
    h.setOptions(options);
    const nodesChanged = nodes !== undefined && nodes !== p.nodes && nodes !== h.graph.nodes;
    const edgesChanged = edges !== undefined && edges !== p.edges && edges !== h.graph.edges;
    if (nodesChanged || edgesChanged) {
      const next = { nodes: nodes ?? h.graph.nodes, edges: edges ?? h.graph.edges };
      h.setGraph(next);
      setGraph(next);
    }
    if (viewport && viewport !== p.viewport) {
      const v = h.viewport;
      if (v.x !== viewport.x || v.y !== viewport.y || v.zoom !== viewport.zoom) h.setViewport(viewport);
    }
    if (selection && selection !== p.selection) h.setSelection(selection);
  });

  // Tras cada pintado de React: colocar los nodos nuevos y dar foco al pendiente.
  useIsoLayoutEffect(() => {
    handle.current?.refresh();
  });

  useImperativeHandle(
    ref,
    () =>
      ({
        setGraph: (g) => handle.current?.setGraph(g),
        setViewport: (v) => handle.current?.setViewport(v),
        setOptions: (o) => handle.current?.setOptions(o),
        setSelection: (s) => handle.current?.setSelection(s),
        refresh: () => handle.current?.refresh(),
        fitView: (p) => handle.current?.fitView(p),
        zoomIn: () => handle.current?.zoomIn(),
        zoomOut: () => handle.current?.zoomOut(),
        zoomTo: (z) => handle.current?.zoomTo(z),
        undo: () => handle.current?.undo(),
        redo: () => handle.current?.redo(),
        layout: (d) => handle.current?.layout(d),
        focusNode: (nid) => handle.current?.focusNode(nid),
        removeSelection: () => handle.current?.removeSelection(),
        removeEdge: (eid) => handle.current?.removeEdge(eid),
        get graph() {
          return handle.current?.graph ?? graph;
        },
        get viewport() {
          return handle.current?.viewport ?? { x: 0, y: 0, zoom: 1 };
        },
        get selection() {
          return handle.current?.selection ?? { nodes: [], edges: [] };
        },
        get locked() {
          return handle.current?.locked ?? false;
        },
        get visible() {
          return handle.current?.visible ?? new Set<string>();
        },
        dispose: () => handle.current?.dispose(),
      }) satisfies NodeCanvasHandle,
    [graph],
  );

  const index = useMemo(() => indexNodes(graph.nodes), [graph.nodes]);
  const order = useMemo(() => paintOrder(graph.nodes), [graph.nodes]);
  const shown = order.filter((n) => !visible || visible.has(n.id));
  const view = (n: GraphNode) => {
    const p = absolutePosition(n.id, index);
    return <NodeView key={n.id} node={n} x={p.x} y={p.y} labels={labels} render={renderNode} />;
  };
  // El cromo no depende del modelo: no se vuelve a pintar cuando cambian los nodos visibles.
  const labelsKey = JSON.stringify(labels ?? null);
  const minimapKey = JSON.stringify(minimap);
  const controlsKey = JSON.stringify(controls);
  // biome-ignore lint/correctness/useExhaustiveDependencies: las claves resumen labels, minimap y controls.
  const chrome = useMemo(
    () => (
      <>
        {minimap !== false ? <NodeMinimap labels={labels} {...(typeof minimap === "object" ? minimap : {})} /> : null}
        {controls !== false ? <NodeControls labels={labels} {...(typeof controls === "object" ? controls : {})} /> : null}
      </>
    ),
    [labelsKey, minimapKey, controlsKey],
  );

  return (
    <div
      ref={root}
      id={uid}
      className={cx("z-node-canvas", className)}
      data-z-node-canvas=""
      data-background={background}
      role="group"
      aria-roledescription={l.roleCanvas}
      aria-label={ariaLabel ?? l.canvas}
      aria-describedby={`${uid}-desc`}
    >
      <div className="z-node-canvas__background" aria-hidden="true" />
      <div className="z-node-canvas__world">
        <div className="z-node-canvas__groups">{shown.filter(isGroup).map(view)}</div>
        <svg className="z-node-canvas__edges" aria-hidden="true" />
        <div className="z-node-canvas__labels" aria-hidden="true" />
        <div className="z-node-canvas__nodes">{shown.filter((n) => !isGroup(n)).map(view)}</div>
        <svg className="z-node-canvas__overlay" aria-hidden="true" />
      </div>
      <div className="z-node-canvas__selection" hidden />
      <p className="z-node-canvas__desc z-sr-only" id={`${uid}-desc`} />
      <div className="z-node-canvas__descs" hidden />
      {chrome}
      {children}
    </div>
  );
}
