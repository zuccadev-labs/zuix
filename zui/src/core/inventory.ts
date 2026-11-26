// Diagrama de infraestructura desde datos: un inventario JSON (redes y VLAN, equipos con sus puertos, enlaces con
// velocidad, hosts con máquinas virtuales y contenedores, pools de discos y servicios expuestos) se convierte en un
// grafo de NodeCanvas, colocado por niveles fijos (internet → borde → núcleo → equipos → servidores) con
// `layeredLayout`. Los enlaces salen del conector exacto (puertos `anchor` de un PortPanel), con grosor por velocidad,
// línea doble en los troncales y color por VLAN en los de acceso. El esquema del inventario va en `INVENTORY_SCHEMA`
// (JSON Schema 2020-12). Puro, sin documento.

import type { LegendOptions } from "./diagram";
import type { Graph, GraphEdge, GraphNode, NodePort } from "./graph";
import { layeredLayout } from "./layout-layers";
import type { PanelPort, PanelVlan, PortConnector, PortState } from "./port-panel";
import type { StoragePoolData } from "./storage-pool";
import type { Size } from "./viewport";

export type DeviceRole = "modem" | "router" | "firewall" | "switch" | "ap" | "workstation" | "server" | "nas" | "kvm" | "iot" | "other";
export type LinkKind = "trunk" | "access" | "wan" | "console" | "internet" | "vpn";

export interface InventoryNetwork {
  /** Identificador («lan», «10»). Los puertos y enlaces lo nombran. */
  id: string;
  name: string;
  vlan?: number;
  subnet?: string;
  /** Tono, token (`chart-1`) o color libre. */
  color?: string;
  note?: string;
  /** Pinta una zona con los invitados (VM, contenedores) de esta red. */
  zone?: boolean;
}

export interface InventoryPort {
  id: string;
  label?: string;
  connector?: PortConnector;
  speed?: string;
  /** Red sin etiquetar (acceso). */
  untagged?: string;
  /** Redes etiquetadas (troncal). */
  tagged?: string[];
  state?: PortState;
  /** Rótulo de destino. Si falta, el nombre del equipo enlazado. */
  to?: string;
}

export interface InventoryHardware {
  /** Tipo («CPU», «Memory», «GPU», «Network», «SSD», «HDD»). */
  kind: string;
  value: string;
  note?: string;
  /** Icono de zicon. */
  icon?: string;
}

export interface InventoryGuest {
  id: string;
  name: string;
  type: "vm" | "ct" | "container";
  /** Número o etiqueta del hipervisor («CT 149»). */
  ref?: string;
  ip?: string;
  hostname?: string;
  network?: string;
  note?: string;
  icon?: string;
  /** Servicios web que publica (nombres de host). */
  hosts?: string[];
}

export interface InventoryDevice {
  id: string;
  name: string;
  role: DeviceRole;
  model?: string;
  os?: string;
  ip?: string;
  hostname?: string;
  network?: string;
  icon?: string;
  /** Color del borde de su tarjeta. Por defecto, el de su red. */
  color?: string;
  ports?: InventoryPort[];
  hardware?: InventoryHardware[];
  guests?: InventoryGuest[];
  pools?: StoragePoolData[];
  /** Redes inalámbricas (puntos de acceso). */
  ssids?: { name: string; network: string }[];
}

export interface InventoryLink {
  id?: string;
  /** `equipo` o `equipo:puerto`; `internet` es la nube. */
  from: string;
  to: string;
  speed?: string;
  kind?: LinkKind;
  /** Red del enlace (color de un enlace de acceso). */
  network?: string;
  label?: string;
}

export interface InventoryService {
  name: string;
  /** Equipo o invitado que lo sirve. */
  host: string;
  /** Puertos publicados («80, 443»). */
  ports?: string;
  protocol?: "tcp" | "udp" | "tcp/udp";
  /** Abierto a internet. */
  public?: boolean;
  note?: string;
}

export interface InventoryExternal {
  id: string;
  name: string;
  note?: string;
  icon?: string;
}

export interface Inventory {
  title?: string;
  networks?: InventoryNetwork[];
  internet?: { label?: string; note?: string; down?: string; up?: string };
  externals?: InventoryExternal[];
  devices: InventoryDevice[];
  links?: InventoryLink[];
  services?: InventoryService[];
}

export interface InventoryDiagramOptions {
  /** Origen de la disposición. */
  origin?: { x: number; y: number };
  /** Hueco entre niveles. Por defecto 120. */
  layerGap?: number;
  /** Hueco entre equipos del mismo nivel. Por defecto 56. */
  nodeGap?: number;
  /** Textos de los roles (la parte tras el punto en la pestaña). */
  roles?: Partial<Record<DeviceRole, string>>;
  /** Textos de las categorías de enlace (leyenda). */
  kinds?: Partial<Record<LinkKind, string>>;
  /** Columnas de las zonas. Por defecto 3. */
  zoneColumns?: number;
  /**
   * Tamaños reales de los nodos (los que mide el lienzo: `handle.sizes`). Sin ellos se estiman por el contenido; con
   * ellos, una segunda pasada coloca sin solapes lo que la aplicación pinta en cada tarjeta.
   */
  sizes?: ReadonlyMap<string, Size>;
}

export interface InventoryDiagram extends Graph {
  /** VLAN para los PortPanel (colores y nombres). */
  vlans: PanelVlan[];
  /** Opciones de leyenda (`legendFromGraph(graph, legend)`). */
  legend: LegendOptions;
}

export const ROLE_LABELS: Record<DeviceRole, string> = {
  modem: "modem",
  router: "router",
  firewall: "firewall",
  switch: "switch",
  ap: "access point",
  workstation: "workstation",
  server: "server",
  nas: "storage",
  kvm: "IP-KVM",
  iot: "IoT",
  other: "device",
};

export const LINK_LABELS: Record<LinkKind, string> = {
  trunk: "802.1Q trunk (tagged VLANs)",
  access: "Access port, colored by VLAN",
  wan: "WAN uplink",
  console: "Console (HDMI + USB)",
  internet: "Over the internet (not a cable)",
  vpn: "VPN tunnel",
};

const ROLE_ICONS: Record<DeviceRole, string> = {
  modem: "globe-alt",
  router: "arrows-right-left",
  firewall: "shield-check",
  switch: "server-stack",
  ap: "wifi",
  workstation: "computer-desktop",
  server: "server",
  nas: "circle-stack",
  kvm: "computer",
  iot: "signal",
  other: "cube",
};

/** Nivel de cada rol: internet 0, borde 1–2, núcleo 3, equipos 4, servidores 5. */
export const ROLE_TIER: Record<DeviceRole, number> = {
  modem: 1,
  router: 1,
  firewall: 2,
  switch: 3,
  ap: 4,
  workstation: 4,
  kvm: 4,
  iot: 4,
  other: 4,
  server: 5,
  nas: 5,
};

const SEP = ":";
const split = (ref: string): [string, string | undefined] => {
  const i = ref.indexOf(SEP);
  return i < 0 ? [ref, undefined] : [ref.slice(0, i), ref.slice(i + 1)];
};

/** Problemas de un inventario (referencias a equipos, puertos o redes que no existen, ids repetidos). */
export function validateInventory(inv: Inventory): string[] {
  const out: string[] = [];
  if (!inv || !Array.isArray(inv.devices)) return ["devices: missing"];
  const nets = new Set((inv.networks ?? []).map((n) => n.id));
  const devices = new Map<string, InventoryDevice>();
  for (const d of inv.devices) {
    if (devices.has(d.id) || d.id === "internet") out.push(`devices.${d.id}: duplicate id`);
    devices.set(d.id, d);
    if (d.network && !nets.has(d.network)) out.push(`devices.${d.id}.network: unknown network ${d.network}`);
    for (const p of d.ports ?? []) {
      if (p.untagged && !nets.has(p.untagged)) out.push(`devices.${d.id}.ports.${p.id}.untagged: unknown network ${p.untagged}`);
      for (const t of p.tagged ?? []) if (!nets.has(t)) out.push(`devices.${d.id}.ports.${p.id}.tagged: unknown network ${t}`);
    }
    for (const g of d.guests ?? [])
      if (g.network && !nets.has(g.network)) out.push(`devices.${d.id}.guests.${g.id}.network: unknown network ${g.network}`);
  }
  (inv.links ?? []).forEach((l, i) => {
    for (const end of [l.from, l.to]) {
      const [dev, port] = split(end);
      if (dev === "internet" || (inv.externals ?? []).some((x) => x.id === dev)) continue;
      const d = devices.get(dev);
      if (!d) out.push(`links.${i}: unknown device ${dev}`);
      else if (port && !(d.ports ?? []).some((p) => p.id === port)) out.push(`links.${i}: unknown port ${end}`);
    }
    if (l.network && !nets.has(l.network)) out.push(`links.${i}.network: unknown network ${l.network}`);
  });
  for (const s of inv.services ?? []) {
    const known = devices.has(s.host) || inv.devices.some((d) => (d.guests ?? []).some((g) => g.id === s.host));
    if (!known) out.push(`services.${s.name}: unknown host ${s.host}`);
  }
  return out;
}

/** Tamaño estimado de la tarjeta de un equipo (para colocar; el lienzo mide el real). */
export function estimateDeviceSize(d: InventoryDevice): Size {
  const ports = d.ports?.length ?? 0;
  const groups = new Set((d.ports ?? []).map((p) => p.connector ?? "rj45")).size;
  const panel = ports ? ports * 56 + groups * 16 + 24 : 0;
  if (d.role === "server" || d.role === "nas") {
    const hw = d.hardware?.length ?? 0;
    const pools = d.pools?.length ?? 0;
    const guests = (d.guests ?? []).length;
    return { width: Math.max(560, 300 + (pools ? 420 : 0)), height: 140 + Math.max(Math.ceil(hw / 2) * 64, pools * 200 + guests * 30) };
  }
  const extra = (d.ssids?.length ?? 0) * 20;
  return { width: Math.max(300, panel + (ports ? 300 : 0)), height: (ports ? 160 : 130) + extra };
}

/** Grafo de un inventario, colocado por niveles. */
export function diagramFromInventory(inv: Inventory, o: InventoryDiagramOptions = {}): InventoryDiagram {
  const roles = { ...ROLE_LABELS, ...o.roles };
  const kinds = { ...LINK_LABELS, ...o.kinds };
  const nets = new Map((inv.networks ?? []).map((n) => [n.id, n]));
  const devices = new Map(inv.devices.map((d) => [d.id, d]));
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const sizes = new Map<string, Size>();
  const tier = new Map<string, number>();
  const hasInternet = (inv.links ?? []).some((l) => split(l.from)[0] === "internet" || split(l.to)[0] === "internet") || !!inv.internet;

  // Nombre del equipo al otro lado de cada puerto (rótulo bajo el conector) y lado del conector: arriba si el enlace
  // sube a un nivel anterior (el uplink entra por arriba), abajo si baja.
  const peer = new Map<string, string>();
  const upward = new Set<string>();
  const tierOf = (id: string) =>
    id === "internet" || (inv.externals ?? []).some((x) => x.id === id) ? 0 : (ROLE_TIER[devices.get(id)?.role ?? "other"] ?? 4);
  for (const l of inv.links ?? []) {
    const [a] = split(l.from);
    const [b] = split(l.to);
    const name = (id: string) => (id === "internet" ? (inv.internet?.label ?? "Internet") : (devices.get(id)?.name ?? id));
    peer.set(l.from, name(b));
    peer.set(l.to, name(a));
    if (tierOf(b) < tierOf(a)) upward.add(l.from);
    if (tierOf(a) < tierOf(b)) upward.add(l.to);
  }
  const sizeOf = (id: string, fallback: Size) => o.sizes?.get(id) ?? fallback;
  // Enlaces que llegan a un equipo sin puerto propio: cada uno tiene su punto en el borde (`up-1`, `up-2`…), así dos
  // cables al mismo equipo no se pisan.
  const generic = new Map<string, { up: number; down: number }>();
  const bump = (id: string, end: "up" | "down") => {
    const g = generic.get(id) ?? { up: 0, down: 0 };
    g[end]++;
    generic.set(id, g);
    return g[end];
  };
  const linkEnds = (inv.links ?? []).map((l) => {
    let [a, ap] = split(l.from);
    let [b, bp] = split(l.to);
    if (tierOf(a) > tierOf(b)) {
      [a, b] = [b, a];
      [ap, bp] = [bp, ap];
    }
    const own = (id: string, port: string | undefined) => !!port && !!devices.get(id)?.ports?.some((x) => x.id === port);
    return { a, ap, b, bp, down: own(a, ap) ? 0 : bump(a, "down"), up: own(b, bp) ? 0 : bump(b, "up") };
  });
  const genericPorts = (id: string): NodePort[] => {
    const g = generic.get(id) ?? { up: 0, down: 0 };
    const list = (end: "up" | "down", n: number): NodePort[] =>
      n <= 1
        ? [{ id: end, kind: end === "up" ? "target" : "source", side: end === "up" ? "top" : "bottom", anchor: true }]
        : Array.from({ length: n }, (_, i) => ({
            id: `${end}-${i + 1}`,
            kind: end === "up" ? ("target" as const) : ("source" as const),
            side: end === "up" ? ("top" as const) : ("bottom" as const),
            anchor: true,
          }));
    return [...list("up", g.up), ...list("down", g.down)];
  };
  const portFor = (id: string, end: "up" | "down", k: number) => ((generic.get(id)?.[end] ?? 0) > 1 ? `${end}-${k}` : end);

  if (hasInternet) {
    const note = [inv.internet?.note, inv.internet?.down && `↓ ${inv.internet.down}`, inv.internet?.up && `↑ ${inv.internet.up}`]
      .filter(Boolean)
      .join(" · ");
    nodes.push({
      id: "internet",
      type: "cloud",
      position: { x: 0, y: 0 },
      data: { label: inv.internet?.label ?? "Internet", description: note || undefined },
      ports: [...genericPorts("internet").filter((p) => p.side === "bottom"), { id: "side", kind: "source", side: "right", anchor: true }],
      selectable: true,
    });
    sizes.set("internet", sizeOf("internet", { width: 260, height: 130 }));
    tier.set("internet", 0);
  }
  for (const x of inv.externals ?? []) {
    nodes.push({
      id: x.id,
      position: { x: 0, y: 0 },
      data: { label: x.name, description: x.note, icon: x.icon ?? "cloud" },
      ports: [{ id: "in", kind: "target", side: "left", anchor: true }],
    });
    sizes.set(x.id, sizeOf(x.id, { width: 240, height: 76 }));
    tier.set(x.id, 0);
    if (hasInternet)
      edges.push({
        id: `ext-${x.id}`,
        source: "internet",
        sourcePort: "side",
        target: x.id,
        targetPort: "in",
        type: "orthogonal",
        dash: "dotted",
        kind: "internet",
        markerEnd: "none",
      });
  }

  for (const d of inv.devices) {
    const net = d.network ? nets.get(d.network) : undefined;
    const ports: NodePort[] = [
      ...genericPorts(d.id),
      ...(d.ports ?? []).map(
        (p): NodePort => ({
          id: p.id,
          kind: "source",
          side: upward.has(`${d.id}${SEP}${p.id}`) ? "top" : "bottom",
          anchor: true,
          label: p.label,
        }),
      ),
    ];
    const panel: PanelPort[] = (d.ports ?? []).map((p) => ({
      id: p.id,
      label: p.label,
      connector: p.connector,
      speed: p.speed,
      untagged: p.untagged,
      tagged: p.tagged,
      state: p.state,
      to: p.to ?? peer.get(`${d.id}${SEP}${p.id}`),
      side: upward.has(`${d.id}${SEP}${p.id}`) ? "top" : undefined,
    }));
    nodes.push({
      id: d.id,
      type: "folder",
      position: { x: 0, y: 0 },
      data: {
        label: d.name,
        kind: roles[d.role],
        icon: d.icon ?? ROLE_ICONS[d.role],
        color: d.color ?? net?.color,
        role: d.role,
        model: d.model,
        os: d.os,
        ip: d.ip,
        hostname: d.hostname,
        network: d.network,
        ports: panel.length ? panel : undefined,
        hardware: d.hardware,
        pools: d.pools,
        guests: (d.guests ?? []).filter((g) => !(g.network && nets.get(g.network)?.zone)),
        ssids: d.ssids,
      },
      ports,
    });
    sizes.set(d.id, sizeOf(d.id, estimateDeviceSize(d)));
    tier.set(d.id, ROLE_TIER[d.role] ?? 4);
  }

  (inv.links ?? []).forEach((l, i) => {
    // De arriba abajo: el extremo de nivel más alto es el origen.
    const { a, ap, b, bp, up, down } = linkEnds[i]!;
    const known = (id: string) => id === "internet" || devices.has(id) || (inv.externals ?? []).some((x) => x.id === id);
    if (!known(a) || !known(b)) return;
    const kind: LinkKind = l.kind ?? "access";
    const net = l.network ? nets.get(l.network) : undefined;
    const sourcePort = down ? portFor(a, "down", down) : ap!;
    const targetPort = up ? portFor(b, "up", up) : bp!;
    edges.push({
      id: l.id ?? `link-${i}`,
      source: a,
      sourcePort,
      target: b,
      targetPort,
      type: "orthogonal",
      kind,
      weight: l.speed,
      targetLabel: l.speed,
      label: l.label,
      double: kind === "trunk" || undefined,
      dash: kind === "console" ? "dashed" : kind === "internet" || kind === "vpn" ? "dotted" : undefined,
      color: kind === "wan" ? "danger" : kind === "access" ? (net?.color ?? undefined) : undefined,
      markerEnd: "none",
    });
  });

  // Colocación por niveles.
  const ids = nodes.map((n) => n.id);
  const layout = layeredLayout(ids, edges, sizes, {
    direction: "TB",
    layerGap: o.layerGap ?? 120,
    nodeGap: o.nodeGap ?? 56,
    origin: o.origin,
    minLayer: tier,
  });
  for (const n of nodes) n.position = layout.positions.get(n.id) ?? n.position;
  // Los servicios externos van a la derecha de la nube, en columna.
  const cloud = nodes.find((n) => n.id === "internet");
  if (cloud) {
    let y = cloud.position.y;
    for (const x of inv.externals ?? []) {
      const n = nodes.find((m) => m.id === x.id)!;
      n.position = { x: cloud.position.x + (sizes.get("internet")?.width ?? 260) + 120, y };
      y += (sizes.get(x.id)?.height ?? 76) + 16;
    }
  }

  // Zonas: los invitados de las redes con `zone`, bajo su host.
  const cols = Math.max(1, o.zoneColumns ?? 3);
  const zoneTop = Math.max(0, ...nodes.map((n) => n.position.y + (sizes.get(n.id)?.height ?? 0))) + 80;
  let zoneX = o.origin?.x ?? 0;
  for (const net of inv.networks ?? []) {
    if (!net.zone) continue;
    const guests = inv.devices.flatMap((d) => (d.guests ?? []).filter((g) => g.network === net.id).map((g) => ({ g, d })));
    if (!guests.length) continue;
    const zoneId = `zone-${net.id}`;
    const cardW = 240;
    const cardH = 84;
    const gap = 16;
    const rows = Math.ceil(guests.length / cols);
    const width = Math.min(cols, guests.length) * (cardW + gap) + gap;
    const height = 56 + rows * (cardH + gap);
    nodes.push({
      id: zoneId,
      type: "zone",
      position: { x: zoneX, y: zoneTop },
      size: { width, height },
      data: { label: net.vlan ? `VLAN ${net.vlan} · ${net.name}` : net.name, description: net.note, color: net.color },
      selectable: true,
    });
    guests.forEach(({ g, d }, i) => {
      nodes.push({
        id: `${d.id}-${g.id}`,
        parentId: zoneId,
        position: { x: gap + (i % cols) * (cardW + gap), y: 48 + Math.floor(i / cols) * (cardH + gap) },
        size: { width: cardW, height: cardH },
        data: {
          label: g.name,
          icon: g.icon ?? (g.type === "vm" ? "computer-desktop" : "cube"),
          description: [g.ref, g.note].filter(Boolean).join(" · ") || undefined,
          ip: g.ip,
          hostname: g.hostname,
          hosts: g.hosts,
          guest: g.type,
          host: d.id,
        },
      });
    });
    zoneX += width + 48;
  }

  const vlans: PanelVlan[] = (inv.networks ?? []).map((n) => ({ id: n.id, vlan: n.vlan, name: n.name, color: n.color }));
  const used = new Set(edges.map((e) => e.kind).filter(Boolean) as string[]);
  const legendKinds = Object.fromEntries(Object.entries(kinds).filter(([k]) => used.has(k)));
  return { nodes, edges, vlans, legend: { kinds: legendKinds } };
}

const str = { type: "string" } as const;
const strList = { type: "array", items: str } as const;

/** Esquema JSON del inventario (JSON Schema 2020-12). */
export const INVENTORY_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://zuccadev-labs.github.io/zuix/schemas/inventory.schema.json",
  title: "zuix infrastructure inventory",
  type: "object",
  required: ["devices"],
  additionalProperties: false,
  properties: {
    title: str,
    networks: {
      type: "array",
      items: {
        type: "object",
        required: ["id", "name"],
        additionalProperties: false,
        properties: {
          id: str,
          name: str,
          vlan: { type: "integer", minimum: 1, maximum: 4094 },
          subnet: str,
          color: str,
          note: str,
          zone: { type: "boolean" },
        },
      },
    },
    internet: { type: "object", additionalProperties: false, properties: { label: str, note: str, down: str, up: str } },
    externals: {
      type: "array",
      items: {
        type: "object",
        required: ["id", "name"],
        additionalProperties: false,
        properties: { id: str, name: str, note: str, icon: str },
      },
    },
    devices: {
      type: "array",
      items: {
        type: "object",
        required: ["id", "name", "role"],
        additionalProperties: false,
        properties: {
          id: str,
          name: str,
          role: { enum: ["modem", "router", "firewall", "switch", "ap", "workstation", "server", "nas", "kvm", "iot", "other"] },
          model: str,
          os: str,
          ip: str,
          hostname: str,
          network: str,
          icon: str,
          color: str,
          ports: {
            type: "array",
            items: {
              type: "object",
              required: ["id"],
              additionalProperties: false,
              properties: {
                id: str,
                label: str,
                connector: { enum: ["rj45", "sfp", "qsfp", "coax"] },
                speed: str,
                untagged: str,
                tagged: strList,
                state: { enum: ["free", "linked", "disabled", "exposed"] },
                to: str,
              },
            },
          },
          hardware: {
            type: "array",
            items: {
              type: "object",
              required: ["kind", "value"],
              additionalProperties: false,
              properties: { kind: str, value: str, note: str, icon: str },
            },
          },
          guests: {
            type: "array",
            items: {
              type: "object",
              required: ["id", "name", "type"],
              additionalProperties: false,
              properties: {
                id: str,
                name: str,
                type: { enum: ["vm", "ct", "container"] },
                ref: str,
                ip: str,
                hostname: str,
                network: str,
                note: str,
                icon: str,
                hosts: strList,
              },
            },
          },
          pools: {
            type: "array",
            items: {
              type: "object",
              required: ["name", "vdevs", "used", "size"],
              additionalProperties: false,
              properties: {
                name: str,
                used: { type: "number", minimum: 0 },
                size: { type: "number", minimum: 0 },
                note: str,
                vdevs: {
                  type: "array",
                  items: {
                    type: "object",
                    required: ["layout", "disks", "disk"],
                    additionalProperties: false,
                    properties: {
                      role: str,
                      layout: { enum: ["single", "stripe", "mirror", "raidz1", "raidz2", "raidz3"] },
                      disks: { type: "integer", minimum: 1 },
                      disk: { enum: ["hdd", "ssd", "nvme"] },
                      model: str,
                      note: str,
                    },
                  },
                },
              },
            },
          },
          ssids: {
            type: "array",
            items: { type: "object", required: ["name", "network"], additionalProperties: false, properties: { name: str, network: str } },
          },
        },
      },
    },
    links: {
      type: "array",
      items: {
        type: "object",
        required: ["from", "to"],
        additionalProperties: false,
        properties: {
          id: str,
          from: { type: "string", description: "device, device:port, or internet" },
          to: { type: "string", description: "device, device:port, or internet" },
          speed: str,
          kind: { enum: ["trunk", "access", "wan", "console", "internet", "vpn"] },
          network: str,
          label: str,
        },
      },
    },
    services: {
      type: "array",
      items: {
        type: "object",
        required: ["name", "host"],
        additionalProperties: false,
        properties: {
          name: str,
          host: str,
          ports: str,
          protocol: { enum: ["tcp", "udp", "tcp/udp"] },
          public: { type: "boolean" },
          note: str,
        },
      },
    },
  },
} as const;
