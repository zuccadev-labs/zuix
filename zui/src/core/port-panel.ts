// Cara de un equipo de red: conectores RJ45, SFP, QSFP o coaxial numerados, con estado (libre, enlazado,
// deshabilitado, expuesto), marcas de VLAN (barra alta = sin etiquetar, barras cortas = etiquetadas, color por VLAN)
// y la etiqueta de destino bajo cada puerto. Es una lista de opciones (listbox horizontal, foco itinerante): las
// flechas, Inicio y Fin van de puerto en puerto y cada uno se anuncia entero («Port 3 Desk, connected, untagged
// VLAN 10 LAN, 1G»). Cada conector lleva `data-port-anchor`: dentro de un NodeCanvas, las aristas salen de él. Marcado
// (core/vnode) y textos, sin documento.

import { edgeColor } from "./edge-style";
import { listText } from "./graph";
import { fill, h, on, type VEl } from "./vnode";

export type PortConnector = "rj45" | "sfp" | "qsfp" | "coax";
export type PortState = "free" | "linked" | "disabled" | "exposed";

export interface PanelVlan {
  id: string;
  /** Número de VLAN (802.1Q). Si el id es un número, ese. */
  vlan?: number;
  /** Nombre corto («LAN»). */
  name?: string;
  /** Tono, token (`chart-1`) o color libre. */
  color?: string;
}

export interface PanelPort {
  id: string;
  /** Rótulo sobre el conector («1», «SFP+1»). Por defecto, su posición. */
  label?: string;
  /** Tipo de conector. Por defecto `rj45`. */
  connector?: PortConnector;
  /** Estado. Por defecto `linked` si tiene destino y `free` si no. */
  state?: PortState;
  /** VLAN sin etiquetar (acceso). */
  untagged?: string;
  /** VLAN etiquetadas (troncal). */
  tagged?: string[];
  /** Destino («Desk», «uplink»). */
  to?: string;
  /** Velocidad negociada («2.5G»). */
  speed?: string;
  /** Nota que solo se lee (y se muestra al pasar). */
  note?: string;
  /** Grupo: los puertos de grupos distintos se separan (por defecto, por tipo de conector). */
  group?: string;
  /** Lado del nodo por el que sale su arista en un lienzo (`top` para un enlace que sube). Por defecto el del panel. */
  side?: "top" | "bottom";
}

export interface PortPanelLabels {
  /** Nombre de la lista. */
  ports: string;
  /** «Port {label}». */
  port: string;
  free: string;
  /** «connected». El destino va justo tras el rótulo («Port 2 Desk»), como se ve. */
  linked: string;
  disabled: string;
  /** «exposed to the internet». */
  exposed: string;
  /** «untagged {vlan}» («untagged VLAN 10 LAN»). */
  untagged: string;
  /** «tagged {list}». */
  tagged: string;
  /** Nombres de los conectores. */
  connectors: Record<PortConnector, string>;
}

export const PORT_PANEL_LABELS: PortPanelLabels = {
  ports: "Ports",
  port: "Port {label}",
  free: "free",
  linked: "connected",
  disabled: "disabled",
  exposed: "exposed to the internet",
  untagged: "untagged {vlan}",
  tagged: "tagged {list}",
  connectors: { rj45: "RJ45", sfp: "SFP", qsfp: "QSFP", coax: "coaxial" },
};

export const mergePortPanelLabels = (l?: Partial<PortPanelLabels>): PortPanelLabels =>
  l ? { ...PORT_PANEL_LABELS, ...l, connectors: { ...PORT_PANEL_LABELS.connectors, ...l.connectors } } : PORT_PANEL_LABELS;

export const portState = (p: PanelPort): PortState => p.state ?? (p.to ? "linked" : "free");
export const portConnector = (p: PanelPort): PortConnector => p.connector ?? "rj45";

/** Nombre legible de una VLAN («VLAN 10 LAN», o su nombre si no tiene número). */
export function vlanName(id: string, vlans: readonly PanelVlan[] = []): string {
  const v = vlans.find((x) => x.id === id);
  const num = v?.vlan ?? (/^\d+$/.test(id) ? Number(id) : undefined);
  if (num === undefined) return v?.name ?? id;
  return v?.name && v.name !== String(num) ? `VLAN ${num} ${v.name}` : `VLAN ${num}`;
}

export interface VlanMark {
  vlan: string;
  /** Sin etiquetar: barra alta. */
  untagged: boolean;
  /** Valor de `--z-vlan-color` (o tono). */
  color: string | undefined;
}

/** Marcas de VLAN de un puerto: primero la sin etiquetar (alta), después las etiquetadas, sin repetir. */
export function vlanMarks(p: PanelPort, vlans: readonly PanelVlan[] = []): VlanMark[] {
  const colorOf = (id: string) => {
    const c = edgeColor(vlans.find((v) => v.id === id)?.color);
    return c.value ?? (c.tone ? `var(--z-${c.tone})` : undefined);
  };
  const out: VlanMark[] = [];
  if (p.untagged) out.push({ vlan: p.untagged, untagged: true, color: colorOf(p.untagged) });
  for (const t of p.tagged ?? [])
    if (t !== p.untagged && !out.some((m) => m.vlan === t)) out.push({ vlan: t, untagged: false, color: colorOf(t) });
  return out;
}

/**
 * Descripción completa de un puerto para lectores de pantalla. Empieza por lo que se ve, en el mismo orden (rótulo y
 * destino: «Port 2 Desk»), así el nombre contiene la etiqueta visible (WCAG 2.5.3).
 */
export function describePort(
  p: PanelPort,
  index: number,
  vlans: readonly PanelVlan[] = [],
  labels: PortPanelLabels = PORT_PANEL_LABELS,
  locale?: string,
): string {
  const state = portState(p);
  const shown = p.to ?? (state === "free" ? labels.free : "");
  const parts = [`${fill(labels.port, { label: p.label ?? String(index + 1) })}${shown ? ` ${shown}` : ""}`];
  if (state === "linked" || (state === "exposed" && p.to)) parts.push(labels.linked);
  if (state === "disabled") parts.push(labels.disabled);
  if (portConnector(p) !== "rj45") parts.push(labels.connectors[portConnector(p)]);
  if (state === "exposed") parts.push(labels.exposed);
  if (p.untagged) parts.push(fill(labels.untagged, { vlan: vlanName(p.untagged, vlans) }));
  const tagged = (p.tagged ?? []).filter((t) => t !== p.untagged);
  if (tagged.length)
    parts.push(
      fill(labels.tagged, {
        list: listText(
          tagged.map((t) => vlanName(t, vlans)),
          locale,
        ),
      }),
    );
  if (p.speed) parts.push(p.speed);
  if (p.note) parts.push(p.note);
  return parts.join(", ");
}

/** Grupos consecutivos de puertos (por `group` o, sin él, por tipo de conector). */
export function portGroups(ports: readonly PanelPort[]): { key: string; ports: { port: PanelPort; index: number }[] }[] {
  const out: { key: string; ports: { port: PanelPort; index: number }[] }[] = [];
  ports.forEach((port, index) => {
    const key = port.group ?? portConnector(port);
    const last = out[out.length - 1];
    if (last && last.key === key) last.ports.push({ port, index });
    else out.push({ key, ports: [{ port, index }] });
  });
  return out;
}

export interface PortPanelProps {
  ports: PanelPort[];
  vlans?: PanelVlan[];
  /** Nombre accesible del panel. */
  label?: string;
  /** Puerto seleccionado (resaltado). */
  selected?: string;
  /** Puerto con la parada de tabulación (el último enfocado). Por defecto el seleccionado o el primero. */
  active?: string;
  /** Lado del nodo por el que salen las aristas de los conectores. Por defecto `bottom`. */
  side?: "top" | "bottom";
  /** Tamaño. Por defecto `md`. */
  size?: "sm" | "md";
  /** Rótulos de destino bajo los puertos. Por defecto sí. */
  showTargets?: boolean;
  labels?: Partial<PortPanelLabels>;
  locale?: string;
  /** Prefijo de los ids (enlaza la descripción). */
  idPrefix?: string;
}

/** Árbol del panel (contrato HTML). El primer puerto (o el seleccionado) lleva la parada de tabulación. */
export function portPanelTree(props: PortPanelProps): VEl {
  const labels = mergePortPanelLabels(props.labels);
  const vlans = props.vlans ?? [];
  const stop =
    props.ports.find((p) => p.id === props.active)?.id ?? props.ports.find((p) => p.id === props.selected)?.id ?? props.ports[0]?.id;
  return h(
    "div",
    {
      class: "z-port-panel",
      role: "listbox",
      "aria-orientation": "horizontal",
      "aria-label": props.label ?? labels.ports,
      "data-size": props.size && props.size !== "md" ? props.size : undefined,
      "data-side": props.side === "top" ? "top" : undefined,
    },
    ...portGroups(props.ports).map((g) =>
      h(
        "div",
        { class: "z-port-panel__group", role: "presentation", "data-group": g.key, key: `${g.key}-${g.ports[0]!.index}` },
        ...g.ports.map(({ port, index }) => {
          const state = portState(port);
          const marks = vlanMarks(port, vlans);
          const color = marks.find((m) => m.untagged)?.color;
          return h(
            "div",
            {
              key: port.id,
              class: "z-port",
              role: "option",
              tabindex: port.id === stop ? 0 : -1,
              "aria-selected": port.id === props.selected ? "true" : "false",
              "aria-disabled": state === "disabled" ? "true" : undefined,
              "aria-label": describePort(port, index, vlans, labels, props.locale),
              title: port.note,
              "data-port": port.id,
              "data-port-anchor": "",
              "data-side": port.side ?? props.side ?? "bottom",
              "data-connector": portConnector(port),
              "data-state": state,
              "data-vlan": on(!!color),
              s: color ? { "--z-port-color": color } : undefined,
            },
            h("span", { class: "z-port__number", "aria-hidden": "true" }, port.label ?? String(index + 1)),
            h("span", { class: "z-port__jack", "aria-hidden": "true" }, h("span", { class: "z-port__socket" })),
            h(
              "span",
              { class: "z-port__vlans", "aria-hidden": "true" },
              ...marks.map((m) =>
                h("span", {
                  key: m.vlan,
                  class: "z-port__vlan",
                  "data-untagged": on(m.untagged),
                  s: m.color ? { "--z-vlan-color": m.color } : undefined,
                }),
              ),
            ),
            props.showTargets === false
              ? null
              : h("span", { class: "z-port__to", "aria-hidden": "true" }, state === "free" && !port.to ? labels.free : (port.to ?? "")),
          );
        }),
      ),
    ),
  );
}

/** Siguiente puerto con el teclado (flechas, Inicio, Fin), o `undefined` si la tecla no mueve. */
export function nextPort(ids: readonly string[], current: string | undefined, key: string): string | undefined {
  if (!ids.length) return undefined;
  const i = current ? ids.indexOf(current) : -1;
  if (key === "Home") return ids[0];
  if (key === "End") return ids[ids.length - 1];
  if (key === "ArrowRight" || key === "ArrowDown") return ids[Math.min(ids.length - 1, i + 1)];
  if (key === "ArrowLeft" || key === "ArrowUp") return ids[Math.max(0, i < 0 ? 0 : i - 1)];
  return undefined;
}

/**
 * Teclado y puntero de un panel montado (lo comparten React y el modo DOM): flechas, Inicio y Fin mueven el foco
 * itinerante entre puertos; Intro, Espacio o un clic eligen el puerto. La cara de un equipo no se refleja en RTL: el
 * puerto 1 sigue a la izquierda. Devuelve la función que suelta los listeners.
 */
export function bindPortPanel(root: HTMLElement, o: { onSelect?: (id: string) => void; onActive?: (id: string) => void } = {}): () => void {
  const options = () => [...root.querySelectorAll<HTMLElement>('[role="option"][data-port]')];
  const activate = (el: HTMLElement, focus: boolean) => {
    for (const x of options()) x.tabIndex = x === el ? 0 : -1;
    if (focus) {
      el.focus({ preventScroll: true });
      el.scrollIntoView?.({ block: "nearest", inline: "nearest" });
    }
    o.onActive?.(el.dataset.port ?? "");
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    const target = (e.target as Element).closest?.<HTMLElement>('[role="option"][data-port]');
    if (!target || !root.contains(target)) return;
    if (e.key === "Enter" || e.key === " ") {
      if (target.getAttribute("aria-disabled") === "true") return;
      e.preventDefault();
      o.onSelect?.(target.dataset.port ?? "");
      return;
    }
    const list = options();
    const next = nextPort(
      list.map((x) => x.dataset.port ?? ""),
      target.dataset.port,
      e.key,
    );
    if (next === undefined) return;
    const el = list.find((x) => x.dataset.port === next);
    if (!el || el === target) {
      // En un extremo: la tecla es nuestra igualmente (no desplaza el lienzo ni la página).
      e.preventDefault();
      return;
    }
    e.preventDefault();
    activate(el, true);
  };
  const onClick = (e: MouseEvent) => {
    const target = (e.target as Element).closest?.<HTMLElement>('[role="option"][data-port]');
    if (!target || !root.contains(target)) return;
    activate(target, false);
    if (target.getAttribute("aria-disabled") !== "true") o.onSelect?.(target.dataset.port ?? "");
  };
  root.addEventListener("keydown", onKey);
  root.addEventListener("click", onClick);
  return () => {
    root.removeEventListener("keydown", onKey);
    root.removeEventListener("click", onClick);
  };
}
