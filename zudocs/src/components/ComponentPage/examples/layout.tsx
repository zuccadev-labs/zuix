// Nodos y layouts de zout: lienzos y ventanas en un marco de tamaño fijo, con datos de una aplicación de ejemplo.
import { Badge, type GraphEdge, type GraphNode, NavLink, NodeCanvas, Switch } from "@zuccadev-labs/zuix-zui";
import {
  Page,
  PageHeader,
  Pane,
  Rail,
  RailItem,
  Shell,
  SidePanel,
  Sidebar,
  SidebarItem,
  SidebarSection,
  SplitPane,
  TabStrip,
} from "@zuccadev-labs/zuix-zout";
import { useState } from "react";
import { type ExampleDemos, Frame } from "./shared";

const FLOW: GraphNode[] = [
  {
    id: "hook",
    position: { x: 0, y: 40 },
    data: { label: "Webhook", icon: "bolt", description: "POST /orders", tone: "accent" },
    ports: [{ id: "out", kind: "source", type: "json" }],
  },
  {
    id: "save",
    position: { x: 320, y: 40 },
    data: { label: "Save order", icon: "circle-stack", status: "running" },
    ports: [{ id: "in", kind: "target", type: "json" }],
  },
];

/** Un flujo algo mayor para que los controles y el minimapa tengan algo que mover. */
const PIPELINE: GraphNode[] = [
  {
    id: "a",
    position: { x: 0, y: 0 },
    data: { label: "Checkout", icon: "shopping-cart", tone: "accent" },
    ports: [{ id: "o", kind: "source" }],
  },
  {
    id: "b",
    position: { x: 260, y: -60 },
    data: { label: "Charge card", icon: "credit-card", status: "success" },
    ports: [
      { id: "i", kind: "target" },
      { id: "o", kind: "source" },
    ],
  },
  {
    id: "c",
    position: { x: 260, y: 80 },
    data: { label: "Reserve stock", icon: "cube", status: "running" },
    ports: [
      { id: "i", kind: "target" },
      { id: "o", kind: "source" },
    ],
  },
  { id: "d", position: { x: 520, y: 10 }, data: { label: "Send receipt", icon: "envelope" }, ports: [{ id: "i", kind: "target" }] },
];
const PIPELINE_EDGES: GraphEdge[] = [
  { id: "ab", source: "a", sourcePort: "o", target: "b", targetPort: "i" },
  { id: "ac", source: "a", sourcePort: "o", target: "c", targetPort: "i" },
  { id: "bd", source: "b", sourcePort: "o", target: "d", targetPort: "i" },
  { id: "cd", source: "c", sourcePort: "o", target: "d", targetPort: "i" },
];

const PROJECTS = ["Atlas", "Beacon", "Cinder"];

export const layout: Record<string, ExampleDemos> = {
  NodeCanvas: {
    "Flujo con puertos tipados": () => (
      <NodeCanvas
        aria-label="Order flow"
        defaultNodes={FLOW}
        defaultEdges={[{ id: "e1", source: "hook", sourcePort: "out", target: "save", targetPort: "in", animated: true }]}
      />
    ),
    "Controlado, con cuerpo propio": () => {
      const [nodes, setNodes] = useState(PIPELINE);
      const [edges, setEdges] = useState(PIPELINE_EDGES);
      return (
        <NodeCanvas
          aria-label="Checkout pipeline"
          nodes={nodes}
          edges={edges}
          onNodesChange={setNodes}
          onEdgesChange={setEdges}
          edgeType="smoothstep"
          renderNode={(node) => (
            <Switch size="sm" defaultChecked>
              {String(node.data.label)}
            </Switch>
          )}
          controls={{ showLayout: true }}
        />
      );
    },
  },
  NodeControls: {
    "Horizontal arriba": () => (
      <NodeCanvas
        aria-label="Checkout pipeline"
        defaultNodes={PIPELINE}
        defaultEdges={PIPELINE_EDGES}
        controls={{ orientation: "horizontal", position: "top-left", showLayout: true }}
      />
    ),
  },
  NodeMinimap: {
    "Arriba a la derecha": () => (
      <NodeCanvas
        aria-label="Checkout pipeline"
        defaultNodes={PIPELINE}
        defaultEdges={PIPELINE_EDGES}
        minimap={{ position: "top-right" }}
      />
    ),
  },
  Shell: {
    "Aplicación con rail, sidebar e inspector": () => {
      const [sidebarOpen, setSidebarOpen] = useState(true);
      const [detailsOpen, setDetailsOpen] = useState(false);
      const [project, setProject] = useState("Atlas");
      return (
        <Frame size="lg">
          <Shell
            rail={
              <Rail>
                <RailItem icon="home" label="Home" active onClick={() => setSidebarOpen((o) => !o)} />
                <RailItem icon="gear" label="Settings" onClick={() => setDetailsOpen((o) => !o)} />
              </Rail>
            }
            sidebar={{
              label: "Navigation",
              open: sidebarOpen,
              content: (
                <Sidebar>
                  <SidebarSection title="Projects" count={PROJECTS.length}>
                    {PROJECTS.map((p) => (
                      <SidebarItem key={p} label={p} icon="folder" active={p === project} onClick={() => setProject(p)} />
                    ))}
                  </SidebarSection>
                </Sidebar>
              ),
            }}
            inspector={{
              label: "Details",
              open: detailsOpen,
              content: (
                <SidePanel title="Details">
                  <p>
                    {project} · <Badge tone="success">Live</Badge>
                  </p>
                </SidePanel>
              ),
            }}
            onCloseOverlay={() => {
              setSidebarOpen(false);
              setDetailsOpen(false);
            }}
            mainAs="div"
            // Medido contra el marco de la demo, no contra la ventana: el rail siempre a la vista, la sidebar
            // acoplada desde 480 px y el inspector como cajón salvo en un marco muy ancho.
            railBreakpoint={0}
            sidebarBreakpoint={480}
            inspectorBreakpoint={960}
            onModeChange={(modes) => {
              if (modes.sidebar === "overlay") setSidebarOpen(false);
            }}
          >
            <Page header={<PageHeader title={project} />}>
              <p>Home in the rail shows or hides the projects; Settings opens the details panel.</p>
            </Page>
          </Shell>
        </Frame>
      );
    },
  },
  Sidebar: {
    "Dos secciones": () => (
      <Frame size="sm">
        <Sidebar footer={<NavLink icon="gear">Settings</NavLink>}>
          <SidebarSection title="Workspaces" count={2} grow>
            <SidebarItem label="Design" icon="swatch" active />
            <SidebarItem label="Platform" icon="server" />
          </SidebarSection>
          <SidebarSection title="Recent" defaultOpen={false}>
            <SidebarItem label="Atlas" icon="folder" />
            <SidebarItem label="Beacon" icon="folder" />
          </SidebarSection>
        </Sidebar>
      </Frame>
    ),
  },
  SplitPane: {
    "Editor y vista previa": () => (
      <Frame>
        <SplitPane defaultSizes={[0.6, 0.4]}>
          <Pane header="Editor" focused>
            <pre className="zd-pane-code">{`export function Hello() {\n  return <p>Hello</p>;\n}`}</pre>
          </Pane>
          <Pane header="Preview" focused={false}>
            <p>Hello</p>
          </Pane>
        </SplitPane>
      </Frame>
    ),
  },
  TabStrip: {
    "Pestañas con alta": () => {
      const [tabs, setTabs] = useState([
        { id: "a", title: "main.ts" },
        { id: "b", title: "README.md" },
      ]);
      const [active, setActive] = useState("a");
      const [next, setNext] = useState(1);
      return (
        <TabStrip
          tabs={tabs}
          activeId={active}
          onSelect={setActive}
          onClose={(id) => {
            const rest = tabs.filter((t) => t.id !== id);
            setTabs(rest);
            if (active === id && rest[0]) setActive(rest[0].id);
          }}
          onAdd={() => {
            const tab = { id: `n${next}`, title: `untitled-${next}.ts` };
            setNext((n) => n + 1);
            setTabs((t) => [...t, tab]);
            setActive(tab.id);
          }}
        />
      );
    },
  },
};
