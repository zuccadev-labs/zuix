import { useEffect, useMemo, useRef, useState } from "react";
import { Inline, Page, PageHeader, Stack } from "@zuccadev-labs/zuix-zout";
import { registerAppIcons } from "@zuccadev-labs/zuix-zicon/core";
import {
  Badge,
  Button,
  DeviceSummary,
  DiagramLegend,
  diagramFromInventory,
  FolderCard,
  type GraphEdge,
  type GraphNode,
  type InventoryGuest,
  type InventoryHardware,
  legendFromGraph,
  NodeCanvas,
  type NodeCanvasHandle,
  PortPanel,
  type PanelPort,
  Redact,
  setRedaction,
  SpecList,
  StoragePool,
  type StoragePoolData,
  Switch,
  Table,
  useRedaction,
  useToast,
} from "@zuccadev-labs/zuix-zui";
import { DOMAIN, LAB, LAB_ICONS } from "./infra-data";

registerAppIcons(LAB_ICONS.map((icon) => ({ ...icon })) as Parameters<typeof registerAppIcons>[0]);

type Size = { width: number; height: number };

/**
 * El inventario como grafo, con los paneles del póster alrededor (título, redes, leyenda, puertos abiertos y un
 * flujo). Con `sizes` (las medidas reales del lienzo) se vuelve a colocar todo sin solapes.
 */
function buildDiagram(sizes?: ReadonlyMap<string, Size>) {
  const size = (id: string, fallback: Size) => sizes?.get(id) ?? fallback;
  const top = 132;
  const left = size("networks", { width: 420, height: 560 });
  const diagramX = left.width + 96;
  const lab = diagramFromInventory(LAB, { origin: { x: diagramX, y: top }, layerGap: 104, nodeGap: 48, zoneColumns: 4, sizes });
  const right =
    Math.max(...lab.nodes.filter((n) => !n.parentId).map((n) => n.position.x + size(n.id, { width: 320, height: 0 }).width)) + 96;
  const exposed = size("exposed", { width: 520, height: 420 });
  const flowNode = (id: string, x: number, y: number, data: GraphNode["data"]): GraphNode => ({
    id,
    parentId: "flow",
    position: { x, y },
    data,
    ports: [
      { id: "in", kind: "target", side: "left", anchor: true },
      { id: "out", kind: "source", side: "right", anchor: true },
      { id: "down", kind: "source", side: "bottom", anchor: true },
      { id: "up", kind: "target", side: "top", anchor: true },
    ],
  });
  const panels: GraphNode[] = [
    {
      id: "title",
      type: "text",
      position: { x: 0, y: 0 },
      data: { label: LAB.title ?? "Lab", description: "Invented data · every name, domain and address is an example" },
    },
    { id: "networks", type: "folder", position: { x: 0, y: top }, data: { label: "Networks", kind: "VLANs", icon: "signal" } },
    { id: "legend", type: "folder", position: { x: 0, y: top + left.height + 48 }, data: { label: "Legend", icon: "information-circle" } },
    {
      id: "exposed",
      type: "folder",
      position: { x: right, y: top },
      data: { label: "Open to the internet", kind: "port forwards", icon: "globe-alt", color: "danger" },
    },
  ];
  const flow: GraphNode[] = [
    {
      id: "flow",
      type: "group",
      position: { x: right, y: top + exposed.height + 48 },
      size: { width: 520, height: 344 },
      data: { label: "Request flow · how a request reaches an app", icon: "arrows-right-left" },
    },
    flowNode("visitor", 24, 72, { label: "Visitor", icon: "user", description: "phone or laptop" }),
    flowNode("resolver", 296, 72, { label: "DNS", icon: "lab-dns", description: `*.${DOMAIN}` }),
    flowNode("edge", 24, 216, { label: "Reverse proxy", icon: "shield-check", description: "TLS · single sign-on", tone: "accent" }),
    flowNode("app", 296, 216, { label: "App", icon: "cube", description: "container in the DMZ", status: "success", tone: "success" }),
  ];
  const flowEdges: GraphEdge[] = [
    {
      id: "f1",
      source: "visitor",
      sourcePort: "out",
      target: "resolver",
      targetPort: "in",
      label: "lookup",
      type: "smoothstep",
      dash: "dotted",
      tone: "accent",
    },
    {
      id: "f2",
      source: "visitor",
      sourcePort: "down",
      target: "edge",
      targetPort: "up",
      label: "HTTPS",
      type: "smoothstep",
      animated: true,
      tone: "accent",
    },
    {
      id: "f3",
      source: "edge",
      sourcePort: "out",
      target: "app",
      targetPort: "in",
      label: "forward",
      type: "smoothstep",
      animated: true,
      tone: "success",
    },
  ];
  return { nodes: [...panels, ...lab.nodes, ...flow], edges: [...lab.edges, ...flowEdges], vlans: lab.vlans, legend: lab.legend };
}

const NETWORKS = LAB.networks ?? [];
const SERVICES = LAB.services ?? [];

const hardwareItems = (list: InventoryHardware[] | undefined) =>
  (list ?? []).map((h) => ({ label: h.kind, value: h.value, note: h.note, icon: h.icon as never }));

const guestItems = (list: InventoryGuest[] | undefined) =>
  (list ?? []).map((g) => ({
    label: `${g.type === "vm" ? "VM" : "CT"} ${g.ref?.replace(/^\D+/, "") ?? ""}`,
    value: g.name,
    note: g.hostname ? <Redact kind="domain">{g.hostname}</Redact> : g.note,
    icon: g.icon as never,
    color: NETWORKS.find((n) => n.id === g.network)?.color,
  }));

export function Infra() {
  const { toast } = useToast();
  const canvas = useRef<NodeCanvasHandle | null>(null);
  const redacted = useRedaction();
  const [busy, setBusy] = useState<"svg" | "png" | null>(null);
  const [diagram, setDiagram] = useState(() => buildDiagram());
  // Segunda pasada: con las tarjetas ya pintadas, se recoloca con sus medidas reales.
  useEffect(() => {
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        const sizes = canvas.current?.sizes;
        if (sizes?.size) setDiagram(buildDiagram(sizes));
      });
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  const legend = useMemo(
    () =>
      legendFromGraph(diagram, {
        ...diagram.legend,
        symbols: [
          { key: "public", label: "public via the reverse proxy", symbol: `text:app.${DOMAIN}` },
          { key: "internal", label: "local DNS, no proxy", symbol: "text:name.internal" },
          { key: "lan", label: "only from LAN or VPN", symbol: "chip:LAN" },
          { key: "vlan", label: "port VLANs (tall = untagged)", symbol: "vlan" },
        ],
      }),
    [diagram],
  );

  // El interruptor es global: al salir de la pantalla se apaga.
  useEffect(() => () => setRedaction(false), []);

  const save = async (kind: "svg" | "png") => {
    const handle = canvas.current;
    if (!handle) return;
    setBusy(kind);
    try {
      const options = { title: "Example lab", padding: 40, redact: redacted ? ("all" as const) : false };
      const blob =
        kind === "svg"
          ? new Blob([await handle.exportSVG(options)], { type: "image/svg+xml" })
          : await handle.exportPNG({ ...options, scale: 2 });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `example-lab.${kind}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast({ title: `Diagram exported as ${kind.toUpperCase()}`, intent: "success" });
    } catch (error) {
      toast({ title: "Export failed", description: String(error), intent: "danger" });
    } finally {
      setBusy(null);
    }
  };

  const renderNode = (node: GraphNode) => {
    const d = node.data as Record<string, unknown>;
    if (node.id === "networks")
      return (
        <SpecList
          columns={1}
          items={NETWORKS.map((n) => ({
            label: n.vlan ? `VLAN ${n.vlan}` : n.name === "VPN" ? "WireGuard" : "Uplink",
            value: (
              <>
                {n.name} · <Redact kind="ip">{n.subnet ?? ""}</Redact>
              </>
            ),
            note: n.note,
            color: n.color,
          }))}
        />
      );
    if (node.id === "legend") return <DiagramLegend entries={legend} />;
    if (node.id === "exposed")
      return (
        <Stack gap={2}>
          <span className="app-muted">blocklist and intrusion detection first, then the forward</span>
          <Table caption="Port forwards" captionHidden density="compact">
            <thead>
              <tr>
                <th scope="col">Port</th>
                <th scope="col">Service</th>
                <th scope="col">Protocol</th>
              </tr>
            </thead>
            <tbody>
              {SERVICES.map((s) => (
                <tr key={s.name}>
                  <td className="app-mono">{s.ports}</td>
                  <td>
                    <Stack gap={0}>
                      <strong>{s.name}</strong>
                      <span className="app-muted">{s.note}</span>
                    </Stack>
                  </td>
                  <td>
                    <Inline gap={1}>
                      {s.protocol?.includes("tcp") ? <Badge tone="info">TCP</Badge> : null}
                      {s.protocol?.includes("udp") ? <Badge tone="success">UDP</Badge> : null}
                    </Inline>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Stack>
      );
    if (node.type === "zone" || node.type === "cloud" || node.type === "text") return undefined;
    if (node.parentId?.startsWith("zone-"))
      return (
        <Stack gap={0}>
          <span>{String(d.description ?? "")}</span>
          {d.hostname ? (
            <span className="app-mono">
              <Redact kind="domain">{String(d.hostname)}</Redact>
            </span>
          ) : null}
        </Stack>
      );
    if (node.parentId === "flow") return undefined;
    if (node.type !== "folder") return <span>{String(d.description ?? "")}</span>;
    const summary = (
      <DeviceSummary
        icon={(d.icon as never) ?? "server"}
        title={String(d.model ?? node.data.label)}
        ip={d.ip as string | undefined}
        hostname={d.hostname as string | undefined}
        meta={d.os ? String(d.os) : undefined}
        tone={d.role === "server" ? "accent" : "neutral"}
      />
    );
    const ports = d.ports as PanelPort[] | undefined;
    const panel = ports ? <PortPanel ports={ports} vlans={diagram.vlans} label={`${String(node.data.label)} ports`} /> : null;
    if (d.role === "server")
      return (
        <Stack gap={4}>
          {summary}
          <div className="app-infra-server">
            <SpecList title="Hardware" columns={1} items={hardwareItems(d.hardware as InventoryHardware[])} />
            <Stack gap={3}>
              {(d.pools as StoragePoolData[]).map((p) => (
                <StoragePool key={p.name} {...p} locale="en-US" headingLevel={2} />
              ))}
              <SpecList title="Guests outside the DMZ" columns={2} items={guestItems(d.guests as InventoryGuest[])} />
            </Stack>
          </div>
        </Stack>
      );
    if (d.role === "firewall")
      return (
        <Stack gap={4}>
          <Inline gap={6} align="end" justify="between" wrap>
            {summary}
            {panel}
          </Inline>
          <SpecList title="Hardware" columns={2} items={hardwareItems(d.hardware as InventoryHardware[])} />
          <SpecList
            title="Services"
            columns={3}
            items={[
              { value: "DNS filter", note: "DNS for all VLANs", icon: "shield-check", tone: "success" },
              { value: "DHCP", note: "DHCP + *.internal", icon: "server-stack" },
              { value: "VPN", note: "wg0 · UDP 51820", icon: "lock-closed", tone: "info" },
              { value: "Intrusion detection", note: "outbound inspection", icon: "eye", tone: "danger" },
              { value: "Threat feed", note: "community blocklist", icon: "users" },
              { value: "Blocklist", note: "~2.3k bad IPs on WAN", icon: "no-circle", tone: "warning" },
            ]}
          />
        </Stack>
      );
    if (d.role === "ap")
      return (
        <Stack gap={3}>
          {summary}
          <SpecList
            title="SSIDs"
            columns={1}
            items={((d.ssids as { name: string; network: string }[]) ?? []).map((s) => {
              const net = NETWORKS.find((n) => n.id === s.network);
              return {
                value: (
                  <Redact kind="text" placeholder="SSID">
                    {s.name}
                  </Redact>
                ),
                note: net ? `VLAN ${net.vlan} · ${net.name}` : undefined,
                color: net?.color,
              };
            })}
          />
        </Stack>
      );
    return (
      <Inline gap={6} align="end" justify="between" wrap>
        {summary}
        {panel}
      </Inline>
    );
  };

  return (
    <Page>
      <PageHeader
        title="Infrastructure"
        description="A home lab from a JSON inventory: networks, ports with VLANs, links by speed, storage and the DMZ."
        actions={
          <Inline gap={2} align="center" wrap>
            <Switch
              checked={redacted}
              onCheckedChange={(on) => setRedaction(on, { domain: "redacted.example", privateIps: true })}
              data-testid="infra-redact"
            >
              Mask sensitive data
            </Switch>
            <Button size="sm" icon="arrow-down-tray" loading={busy === "svg"} onClick={() => save("svg")} data-testid="infra-svg">
              Export SVG
            </Button>
            <Button size="sm" variant="primary" icon="photo" loading={busy === "png"} onClick={() => save("png")} data-testid="infra-png">
              Export PNG
            </Button>
          </Inline>
        }
      />
      <NodeCanvas
        ref={canvas}
        id="infra-canvas"
        aria-label="Example lab infrastructure"
        className="app-infra"
        readOnly
        cull={false}
        nodes={diagram.nodes}
        edges={diagram.edges}
        edgeType="orthogonal"
        minZoom={0.15}
        renderNode={renderNode}
        controls={{ showLock: false, showHistory: false }}
      />
      <FolderCard title="About this diagram" kind="example data" icon="information-circle" headingLevel={2} className="app-infra-note">
        Every name, domain and address here is invented ({DOMAIN} and private ranges). The canvas is built with diagramFromInventory; the
        panels around it are ordinary nodes.
      </FolderCard>
    </Page>
  );
}
