import { useMemo, useRef, useState } from "react";
import { Inline, Page, PageHeader, PageSection, Stack } from "@zuccadev-labs/zuix-zout";
import {
  Badge,
  Button,
  type CanvasSelection,
  Field,
  type GraphEdge,
  type GraphNode,
  Input,
  NodeCanvas,
  type NodeCanvasHandle,
  NodeListView,
  SegmentedControl,
  Switch,
} from "@zuccadev-labs/zuix-zui";

const port = (id: string, kind: "source" | "target", type = "json", label?: string) => ({ id, kind, type, label });

const FLOW_NODES: GraphNode[] = [
  {
    id: "hook",
    position: { x: 0, y: 96 },
    data: { label: "Order webhook", icon: "bolt", description: "POST /orders", tone: "accent" },
    ports: [port("out", "source")],
  },
  {
    id: "validate",
    position: { x: 272, y: 96 },
    data: { label: "Validate", icon: "shield-check", description: "Schema v3 · 14 fields", status: "success", tone: "success" },
    ports: [port("in", "target"), port("out", "source")],
  },
  {
    id: "route",
    position: { x: 544, y: 96 },
    data: { label: "Total over 100", icon: "funnel", description: "order.total > 100", tone: "warning" },
    ports: [port("in", "target"), port("yes", "source", "json", "true"), port("no", "source", "json", "false")],
  },
  {
    id: "retry",
    type: "group",
    position: { x: 832, y: -16 },
    size: { width: 272, height: 288 },
    data: { label: "Retry block", icon: "arrow-path" },
  },
  {
    id: "enrich",
    parentId: "retry",
    position: { x: 32, y: 48 },
    data: { label: "Enrich customer", icon: "globe-alt", description: "GET /crm/customers/:id", status: "running", tone: "info" },
    ports: [port("in", "target"), { ...port("out", "source"), side: "bottom" }],
  },
  {
    id: "save",
    parentId: "retry",
    position: { x: 32, y: 176 },
    data: { label: "Save order", icon: "circle-stack", description: "orders · upsert", tone: "accent" },
    ports: [{ ...port("in", "target"), side: "top" }, port("out", "source")],
  },
  {
    id: "notify",
    position: { x: 864, y: 336 },
    data: { label: "Notify sales", icon: "megaphone", description: "#sales-alerts", status: "error", tone: "danger" },
    ports: [port("in", "target", "json text")],
  },
  {
    id: "done",
    position: { x: 1184, y: 144 },
    data: { label: "Respond 201", icon: "paper-airplane", description: "application/json" },
    ports: [port("in", "target", "any")],
  },
];

const FLOW_EDGES: GraphEdge[] = [
  { id: "e-hook", source: "hook", sourcePort: "out", target: "validate", targetPort: "in", animated: true },
  { id: "e-val", source: "validate", sourcePort: "out", target: "route", targetPort: "in", label: "valid" },
  { id: "e-yes", source: "route", sourcePort: "yes", target: "enrich", targetPort: "in", tone: "success" },
  { id: "e-no", source: "route", sourcePort: "no", target: "notify", targetPort: "in" },
  { id: "e-enrich", source: "enrich", sourcePort: "out", target: "save", targetPort: "in" },
  { id: "e-save", source: "save", sourcePort: "out", target: "done", targetPort: "in" },
];

/** Un grafo grande para medir: `cols × rows` nodos en rejilla y unas 1.6 aristas por nodo. */
function bigGraph(count: number): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const cols = Math.ceil(Math.sqrt(count * 1.6));
  const nodes: GraphNode[] = Array.from({ length: count }, (_, i) => ({
    id: `n${i}`,
    position: { x: (i % cols) * 256, y: Math.floor(i / cols) * 128 },
    data: {
      label: `Step ${i + 1}`,
      icon: i % 7 === 0 ? "bolt" : "cube",
      description: `job-${i}`,
      status: i % 41 === 0 ? "error" : undefined,
    },
    ports: [port("in", "target"), port("out", "source")],
  }));
  const edges: GraphEdge[] = [];
  for (let i = 0; i < count && edges.length < Math.round(count * 1.6); i++) {
    if ((i + 1) % cols !== 0 && i + 1 < count)
      edges.push({ id: `r${i}`, source: `n${i}`, sourcePort: "out", target: `n${i + 1}`, targetPort: "in" });
    if (i + cols < count && i % 2 === 0)
      edges.push({ id: `d${i}`, source: `n${i}`, sourcePort: "out", target: `n${i + cols}`, targetPort: "in" });
  }
  return { nodes, edges };
}

export function Flows() {
  const canvas = useRef<NodeCanvasHandle>(null);
  const [nodes, setNodes] = useState(FLOW_NODES);
  const [edges, setEdges] = useState(FLOW_EDGES);
  const [selection, setSelection] = useState<CanvasSelection>({ nodes: [], edges: [] });
  const [view, setView] = useState<"canvas" | "list">("canvas");
  const [big, setBig] = useState(false);
  const [edgeType, setEdgeType] = useState<"bezier" | "smoothstep" | "step" | "straight">("bezier");
  const large = useMemo(() => (big ? bigGraph(500) : null), [big]);
  const selected = nodes.find((n) => n.id === selection.nodes[0] && selection.nodes.length === 1);

  const rename = (label: string) => {
    if (!selected) return;
    setNodes((list) => list.map((n) => (n.id === selected.id ? { ...n, data: { ...n.data, label } } : n)));
  };

  return (
    <Page>
      <PageHeader
        title="Flows"
        description="Node editor: ports with types, edges, groups, minimap, undo and keyboard."
        actions={
          <Inline gap={2}>
            <SegmentedControl
              label="View"
              value={view}
              onValueChange={(v) => setView(v as "canvas" | "list")}
              items={[
                { value: "canvas", label: "Canvas" },
                { value: "list", label: "List" },
              ]}
            />
            <Button size="sm" icon="squares-2x2" onClick={() => canvas.current?.layout()} data-testid="f-layout">
              Arrange
            </Button>
          </Inline>
        }
      />
      <PageSection title="Order pipeline">
        <Stack gap={3}>
          <Inline gap={3} className="app-flow-bar">
            <SegmentedControl
              label="Edge style"
              size="sm"
              value={edgeType}
              onValueChange={(v) => setEdgeType(v as typeof edgeType)}
              items={[
                { value: "bezier", label: "Curve" },
                { value: "smoothstep", label: "Smooth" },
                { value: "step", label: "Step" },
                { value: "straight", label: "Line" },
              ]}
            />
            <span className="app-muted" data-testid="f-count">
              {`${nodes.length} nodes · ${edges.length} connections`}
            </span>
            {selection.nodes.length ? <Badge tone="accent">{`${selection.nodes.length} selected`}</Badge> : null}
          </Inline>
          <div className="app-flow" hidden={view !== "canvas"}>
            <NodeCanvas
              ref={canvas}
              id="flow-canvas"
              aria-label="Order pipeline"
              className="app-flow__canvas"
              nodes={nodes}
              edges={edges}
              edgeType={edgeType}
              onNodesChange={setNodes}
              onEdgesChange={setEdges}
              onSelectionChange={setSelection}
              controls={{ showLayout: true }}
              renderNode={(node) =>
                node.id === "notify" ? (
                  <Stack gap={2}>
                    <span>{String(node.data.description)}</span>
                    <Switch defaultChecked size="sm">
                      Mention on-call
                    </Switch>
                  </Stack>
                ) : undefined
              }
            />
            {selected ? (
              <aside className="app-flow__inspector z-liquid" aria-label="Node settings" data-testid="f-inspector">
                <Field label="Name">
                  <Input value={String(selected.data.label ?? "")} onChange={(e) => rename(e.target.value)} data-testid="f-name" />
                </Field>
                <span className="app-muted">{`${selected.ports?.length ?? 0} ports · ${selected.id}`}</span>
              </aside>
            ) : null}
          </div>
          {view === "list" ? (
            <NodeListView
              graph={{ nodes, edges }}
              onShowNode={(id) => {
                setView("canvas");
                requestAnimationFrame(() => canvas.current?.focusNode(id));
              }}
              onRemoveEdge={(id) => setEdges((list) => list.filter((e) => e.id !== id))}
            />
          ) : null}
        </Stack>
      </PageSection>
      <PageSection title="Large graph">
        <Stack gap={3}>
          <Inline gap={3}>
            <Switch checked={big} onCheckedChange={setBig} data-testid="f-big">
              500 nodes and 800 connections
            </Switch>
            {large ? <span className="app-muted">{`${large.nodes.length} nodes · ${large.edges.length} connections`}</span> : null}
          </Inline>
          {large ? (
            <NodeCanvas
              id="flow-big"
              aria-label="Large graph"
              className="app-flow__canvas app-flow__canvas--big"
              defaultNodes={large.nodes}
              defaultEdges={large.edges}
              defaultViewport={{ x: 24, y: 24, zoom: 0.8 }}
              edgeType="smoothstep"
            />
          ) : null}
        </Stack>
      </PageSection>
    </Page>
  );
}
