// Lógica pura de los diagramas de infraestructura: estilo de aristas (grosor por velocidad, trazo, color, etiquetas de
// extremo), enrutado ortogonal que esquiva nodos y reparte carriles (con su rendimiento en 300 nodos y 600 aristas),
// nube y leyenda, PortPanel, StoragePool, enmascarado, inventario → grafo y piezas puras de la exportación. Las
// propiedades de geometría y del enmascarado van con fast-check (semilla fija).
import "./helpers/dom.mjs";
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import fc from "fast-check";
import { cloudPath, colorVar, describeLegendEntry, diagramLegendTree, folderTabTree, legendFromGraph } from "../../zui/src/core/diagram.ts";
import type { EdgeEnds, Side } from "../../zui/src/core/edge-path.ts";
import { edgeRoute, roundedPath } from "../../zui/src/core/edge-path.ts";
import {
  dashArray,
  DEFAULT_EDGE_WIDTH,
  edgeColor,
  edgeStyleKey,
  edgeWidth,
  parseRate,
  pointAlong,
  scaleWidth,
  SPEED_SCALE,
} from "../../zui/src/core/edge-style.ts";
import { escapeXML, fontFamilies, fontSources, localRefs, pngSize, svgDocument } from "../../zui/src/core/export-image.ts";
import type { Graph } from "../../zui/src/core/graph.ts";
import { isGroup } from "../../zui/src/core/graph.ts";
import {
  diagramFromInventory,
  estimateDeviceSize,
  INVENTORY_SCHEMA,
  type Inventory,
  validateInventory,
} from "../../zui/src/core/inventory.ts";
import { layeredLayout } from "../../zui/src/core/layout-layers.ts";
import { nodeTree } from "../../zui/src/core/node-view.ts";
import { nudgeParallel, routeOrthogonal } from "../../zui/src/core/orthogonal-route.ts";
import {
  bindPortPanel,
  describePort,
  mergePortPanelLabels,
  nextPort,
  type PanelPort,
  portGroups,
  portPanelTree,
  portState,
  vlanMarks,
  vlanName,
} from "../../zui/src/core/port-panel.ts";
import { anchorOf } from "../../zui/src/core/ports.ts";
import {
  isRedacted,
  onRedactionChange,
  redactDomain,
  redactIpv4,
  redactIpv6,
  redactText,
  setRedaction,
  stableHash,
} from "../../zui/src/core/redact.ts";
import {
  diskSummary,
  faultTolerance,
  mergeStoragePoolLabels,
  poolTolerance,
  poolUsage,
  storagePoolTree,
  usageText,
} from "../../zui/src/core/storage-pool.ts";
import type { Point, Rect } from "../../zui/src/core/viewport.ts";
import { toHTML } from "../../zui/src/core/vnode.ts";

fc.configureGlobal({ seed: 20261125, numRuns: 120 });

describe("estilo de aristas", () => {
  test("parseRate lee velocidades y caudales", () => {
    assert.equal(parseRate("10G"), 1e10);
    assert.equal(parseRate("2.5G"), 2.5e9);
    assert.equal(parseRate("2,5 Gbit/s"), 2.5e9);
    assert.equal(parseRate("600 Mbit/s"), 6e8);
    assert.equal(parseRate("100M"), 1e8);
    assert.equal(parseRate("1 Gbps"), 1e9);
    assert.equal(parseRate(42), 42);
    assert.equal(parseRate("fast"), null);
    assert.equal(parseRate(""), null);
    assert.equal(parseRate(-1), null);
    assert.equal(parseRate(undefined), null);
  });
  test("grosor por escala: clave exacta, interpolación logarítmica y número", () => {
    assert.equal(scaleWidth("10G"), SPEED_SCALE["10G"]);
    assert.equal(scaleWidth("10 g"), SPEED_SCALE["10G"]);
    const mid = scaleWidth("4G")!;
    assert.ok(mid > SPEED_SCALE["2.5G"]! && mid < SPEED_SCALE["5G"]!);
    assert.ok(scaleWidth("400G")! >= SPEED_SCALE["100G"]!);
    assert.equal(scaleWidth(3), 3);
    assert.equal(scaleWidth("alto", { alto: 6, bajo: 1 }), 6);
    assert.equal(scaleWidth("medio", { alto: 6, bajo: 1 }), null);
    assert.equal(scaleWidth(undefined), null);
    assert.equal(scaleWidth(1000), 16);
  });
  test("la velocidad ordena el grosor (más rápido, más grueso)", () => {
    const speeds = ["100M", "1G", "2.5G", "10G", "40G"];
    const widths = speeds.map((s) => edgeWidth({ weight: s }));
    for (let i = 1; i < widths.length; i++) assert.ok(widths[i]! > widths[i - 1]!, speeds[i]);
  });
  test("width gana a weight; sin nada, el de por defecto", () => {
    assert.equal(edgeWidth({ width: 7, weight: "100M" }), 7);
    assert.equal(edgeWidth({}), DEFAULT_EDGE_WIDTH);
    assert.equal(edgeWidth({ width: Number.NaN }), DEFAULT_EDGE_WIDTH);
  });
  test("patrones de trazo", () => {
    assert.equal(dashArray("solid", 2), null);
    assert.equal(dashArray(undefined, 2), null);
    assert.match(dashArray("dashed", 2)!, /^\d+(\.\d+)? \d+(\.\d+)?$/);
    assert.match(dashArray("dotted", 2)!, /^0 /);
  });
  test("color: tono, token, color libre y descarte de lo inseguro", () => {
    assert.deepEqual(edgeColor("accent"), { tone: "accent" });
    assert.deepEqual(edgeColor("neutral"), {});
    assert.deepEqual(edgeColor("chart-3"), { value: "var(--z-chart-3)" });
    assert.deepEqual(edgeColor("--brand-wan"), { value: "var(--brand-wan)" });
    assert.deepEqual(edgeColor("#58a6ff"), { value: "#58a6ff" });
    assert.deepEqual(edgeColor("oklch(70% 0.1 250)"), { value: "oklch(70% 0.1 250)" });
    assert.deepEqual(edgeColor("red; background: url(x)"), {});
    assert.deepEqual(edgeColor("url(javascript:alert(1))"), {});
    assert.deepEqual(edgeColor(undefined, "danger"), { tone: "danger" });
    assert.deepEqual(edgeColor(undefined, "nope"), {});
    assert.notEqual(edgeStyleKey({ dash: "dashed" }), edgeStyleKey({ dash: "dotted" }));
  });
  test("pointAlong: a una distancia del extremo, con desplazamiento perpendicular", () => {
    const pts: Point[] = [
      { x: 0, y: 0 },
      { x: 0, y: 100 },
      { x: 50, y: 100 },
    ];
    assert.deepEqual(pointAlong(pts, "start", 16), { x: 0, y: 16 });
    assert.deepEqual(pointAlong(pts, "end", 10), { x: 40, y: 100 });
    assert.deepEqual(pointAlong(pts, "start", 10, 5), { x: -5, y: 10 });
    assert.deepEqual(pointAlong(pts, "start", 1000), { x: 50, y: 100 });
    assert.deepEqual(pointAlong([], "start", 4), { x: 0, y: 0 });
    assert.deepEqual(pointAlong([{ x: 3, y: 3 }], "start", 4), { x: 3, y: 3 });
  });
  test("orthogonal suelto se pinta como smoothstep; roundedPath redondea las esquinas", () => {
    const ends: EdgeEnds = { source: { x: 0, y: 0 }, sourceSide: "right", target: { x: 200, y: 100 }, targetSide: "left" };
    assert.equal(edgeRoute("orthogonal", ends).d, edgeRoute("smoothstep", ends).d);
    assert.match(
      roundedPath(
        [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 100 },
        ],
        10,
      ),
      / Q /,
    );
    assert.equal(roundedPath([], 10), "");
    assert.equal(roundedPath([{ x: 1, y: 2 }], 10), "M 1 2");
  });
});

// ── Enrutado ortogonal ─────────────────────────────────────────────────────────────────────────────────────

const orthogonalOnly = (pts: readonly Point[]) =>
  pts.every((p, i) => i === 0 || Math.abs(p.x - pts[i - 1]!.x) < 0.01 || Math.abs(p.y - pts[i - 1]!.y) < 0.01);
const hits = (a: Point, b: Point, r: Rect) =>
  Math.max(a.x, b.x) > r.x + 0.5 &&
  Math.min(a.x, b.x) < r.x + r.width - 0.5 &&
  Math.max(a.y, b.y) > r.y + 0.5 &&
  Math.min(a.y, b.y) < r.y + r.height - 0.5;
const crosses = (pts: readonly Point[], r: Rect) => pts.some((p, i) => i > 0 && hits(pts[i - 1]!, p, r));

describe("enrutado ortogonal", () => {
  test("rodea un nodo que está en medio", () => {
    const wall = { id: "wall", x: 150, y: -100, width: 60, height: 300 };
    const { routes, fallbacks } = routeOrthogonal(
      [
        {
          id: "e",
          source: "a",
          target: "b",
          ends: { source: { x: 100, y: 50 }, sourceSide: "right", target: { x: 300, y: 50 }, targetSide: "left" },
        },
      ],
      [{ id: "a", x: 0, y: 0, width: 100, height: 100 }, { id: "b", x: 300, y: 0, width: 100, height: 100 }, wall],
    );
    const pts = routes.get("e")!.points;
    assert.deepEqual(fallbacks, []);
    assert.ok(orthogonalOnly(pts));
    assert.equal(crosses(pts, wall), false);
    assert.deepEqual(pts[0], { x: 100, y: 50 });
    assert.deepEqual(pts[pts.length - 1], { x: 300, y: 50 });
    assert.match(routes.get("e")!.d, / Q /);
  });
  test("reparte en carriles los tramos compartidos", () => {
    const routes = [
      [
        { x: 0, y: 0 },
        { x: 0, y: 20 },
        { x: 100, y: 20 },
        { x: 100, y: 200 },
        { x: 100, y: 220 },
      ],
      [
        { x: 50, y: 0 },
        { x: 50, y: 20 },
        { x: 100, y: 20 },
        { x: 100, y: 200 },
        { x: 120, y: 220 },
      ],
    ];
    const out = nudgeParallel(routes, [2, 2], 6);
    const xa = out[0]![2]!.x;
    const xb = out[1]![2]!.x;
    assert.equal(Math.abs(xa - xb), 8);
    assert.equal(out[0]![2]!.x, out[0]![3]!.x);
    // Los extremos no se mueven.
    assert.deepEqual(out[0]![0], { x: 0, y: 0 });
    assert.deepEqual(out[1]![4], { x: 120, y: 220 });
  });
  test("propiedades: tramos ortogonales, extremos fijos, determinista y sin cruzar obstáculos con hueco", () => {
    const side = fc.constantFrom<Side>("left", "right", "top", "bottom");
    fc.assert(
      fc.property(
        fc.integer({ min: -400, max: 400 }),
        fc.integer({ min: -400, max: 400 }),
        side,
        side,
        fc.array(fc.record({ x: fc.integer({ min: -300, max: 300 }), y: fc.integer({ min: -300, max: 300 }) }), { maxLength: 6 }),
        (tx, ty, s1, s2, blocks) => {
          const ends: EdgeEnds = { source: { x: 0, y: 0 }, sourceSide: s1, target: { x: tx, y: ty }, targetSide: s2 };
          const obstacles = blocks
            .map((b, i) => ({ id: `o${i}`, x: b.x, y: b.y, width: 40, height: 40 }))
            .filter((r) => !(Math.abs(r.x) < 80 && Math.abs(r.y) < 80) && !(Math.abs(r.x - tx) < 80 && Math.abs(r.y - ty) < 80));
          const req = [{ id: "e", ends }];
          const a = routeOrthogonal(req, obstacles);
          const b = routeOrthogonal(req, obstacles);
          const pts = a.routes.get("e")!.points;
          assert.deepEqual(pts, b.routes.get("e")!.points);
          assert.ok(orthogonalOnly(pts));
          assert.deepEqual(pts[0], ends.source);
          assert.deepEqual(pts[pts.length - 1], ends.target);
          if (!a.fallbacks.length) for (const o of obstacles) assert.equal(crosses(pts, o), false);
        },
      ),
    );
  });
  test("rendimiento: 300 nodos y 600 aristas", () => {
    const nodes: (Rect & { id: string })[] = [];
    for (let i = 0; i < 300; i++) nodes.push({ id: `n${i}`, x: (i % 20) * 260, y: Math.floor(i / 20) * 180, width: 180, height: 80 });
    const reqs = [];
    // Aristas deterministas: vecinas, a dos filas y saltos largos.
    for (let i = 0; i < 600; i++) {
      const a = nodes[i % 300]!;
      const b = nodes[(i * 37 + 11) % 300]!;
      if (a.id === b.id) continue;
      reqs.push({
        id: `e${i}`,
        source: a.id,
        target: b.id,
        ends: {
          source: { x: a.x + a.width, y: a.y + a.height / 2 },
          sourceSide: "right" as const,
          target: { x: b.x, y: b.y + b.height / 2 },
          targetSide: "left" as const,
        },
      });
    }
    routeOrthogonal(reqs.slice(0, 50), nodes); // calentamiento
    const t0 = performance.now();
    const out = routeOrthogonal(reqs, nodes);
    const ms = performance.now() - t0;
    const clean = reqs.length - out.fallbacks.length;
    console.log(`  enrutado ortogonal: ${reqs.length} aristas entre 300 nodos en ${Math.round(ms)} ms · ${clean} sin cruzar nodos`);
    assert.equal(out.routes.size, reqs.length);
    // Presupuesto holgado: la máquina de CI puede ir cargada; la cifra real se imprime arriba.
    assert.ok(ms < 4000, `${Math.round(ms)} ms`);
    assert.ok(clean / reqs.length > 0.95, `${clean}/${reqs.length}`);
  });
});

// ── Nube, leyenda, carpeta ─────────────────────────────────────────────────────────────────────────────────

describe("piezas del diagrama", () => {
  test("cloudPath es un contorno cerrado dentro de la caja", () => {
    const d = cloudPath(200, 120);
    assert.match(d, /^M /);
    assert.match(d, /Z$/);
    const nums = [...d.matchAll(/-?\d+(?:\.\d+)?/g)].map((m) => Number(m[0]));
    assert.ok(nums.every((n) => n >= 0 && n <= 200));
    assert.equal(cloudPath(10, 10), cloudPath(40, 28));
  });
  test("legendFromGraph: categorías, grosores, zonas y símbolos", () => {
    const graph: Graph = {
      nodes: [
        { id: "a", position: { x: 0, y: 0 }, data: {} },
        { id: "z", type: "zone", position: { x: 0, y: 0 }, data: { label: "DMZ", color: "chart-2" } },
      ],
      edges: [
        { id: "1", source: "a", target: "a", kind: "trunk", double: true, weight: "10G" },
        { id: "2", source: "a", target: "a", kind: "console", dash: "dashed", weight: "1G" },
        { id: "3", source: "a", target: "a", kind: "trunk", weight: "2.5G" },
        { id: "4", source: "a", target: "a", weight: "1G" },
      ],
    };
    const entries = legendFromGraph(graph, {
      kinds: { trunk: "802.1Q trunk" },
      symbols: [{ key: "lan", label: "only from LAN", symbol: "chip:LAN" }],
    });
    assert.deepEqual(
      entries.map((e) => e.key),
      ["kind:trunk", "kind:console", "width:10G", "width:2.5G", "width:1G", "zone:z", "symbol:lan"],
    );
    const trunk = entries[0]!;
    assert.equal(trunk.type === "line" && trunk.double, true);
    assert.equal(trunk.label, "802.1Q trunk");
    assert.equal(entries[1]!.label, "console");
    assert.equal(describeLegendEntry(entries[1]!), "Dashed line: console");
    assert.equal(describeLegendEntry(trunk), "Double line: 802.1Q trunk");
    assert.equal(describeLegendEntry(entries[2]!), "Line width: 10G");
    assert.equal(describeLegendEntry(entries[5]!), "Zone: DMZ");
    assert.equal(describeLegendEntry(entries[6]!), "only from LAN");
    assert.deepEqual(
      legendFromGraph(graph, { widths: false, zones: false }).map((e) => e.type),
      ["line", "line"],
    );
    const html = toHTML(diagramLegendTree({ entries, title: "Legend", columns: 2 }));
    assert.match(html, /<section class="z-diagram-legend" data-columns="2"><h3 class="z-diagram-legend__title">Legend<\/h3>/);
    assert.match(html, /data-double[ >]/);
    assert.match(html, /<span class="z-sr-only">Dashed line: <\/span>console/);
    assert.match(html, /z-diagram-legend__chip" aria-hidden="true">LAN/);
    assert.match(toHTML(diagramLegendTree({ entries: [] })), /aria-label="Legend"/);
  });
  test("colorVar y pestaña de carpeta", () => {
    assert.equal(colorVar("accent"), "var(--z-accent)");
    assert.equal(colorVar("chart-1"), "var(--z-chart-1)");
    assert.equal(colorVar(undefined), undefined);
    assert.equal(
      toHTML(folderTabTree({ title: "Core", kind: "switch" })),
      '<div class="z-folder-card__tab"><h3 class="z-folder-card__title">Core</h3><span class="z-folder-card__kind">switch</span></div>',
    );
  });
  test("nodos nube, carpeta y zona en el marcado", () => {
    const cloud = toHTML(
      nodeTree({ id: "i", type: "cloud", position: { x: 0, y: 0 }, data: { label: "Internet", description: "ISP" } }, 0, 0),
    );
    assert.match(cloud, /class="z-node__shape"/);
    assert.match(cloud, /<span class="z-node__title">Internet<\/span>/);
    const folder = toHTML(
      nodeTree(
        {
          id: "sw",
          type: "folder",
          position: { x: 0, y: 0 },
          data: { label: "Core", kind: "switch", color: "chart-1" },
          ports: [
            { id: "p1", kind: "source", side: "bottom", anchor: true },
            { id: "in", kind: "target" },
          ],
        },
        0,
        0,
      ),
    );
    assert.match(folder, /class="z-node z-folder-card"/);
    assert.match(folder, /--z-folder-color: var\(--z-chart-1\)/);
    assert.equal((folder.match(/z-node-port"/g) ?? []).length, 1);
    const zone = toHTML(
      nodeTree({ id: "z", type: "zone", position: { x: 0, y: 0 }, data: { label: "DMZ", color: "#f0883e", description: "no LAN" } }, 0, 0),
    );
    assert.match(zone, /class="z-node-group" data-id="z" data-type="zone"/);
    assert.match(zone, /--z-zone-color: #f0883e/);
    assert.match(zone, /z-node-group__note">no LAN/);
    assert.equal(isGroup({ type: "zone" }), true);
  });
  test("anchorOf usa la fracción medida de un puerto `anchor`", () => {
    const node = {
      id: "n",
      position: { x: 0, y: 0 },
      data: {},
      ports: [{ id: "p", kind: "source" as const, side: "bottom" as const, anchor: true }],
    };
    const rect = { x: 0, y: 0, width: 200, height: 100 };
    assert.deepEqual(anchorOf(node, rect, "p", "source").point, { x: 100, y: 100 });
    assert.deepEqual(anchorOf(node, rect, "p", "source", new Map([["p", 0.25]])).point, { x: 50, y: 100 });
    assert.deepEqual(anchorOf(node, rect, "p", "source", new Map([["p", 9]])).point, { x: 200, y: 100 });
  });
});

// ── PortPanel ──────────────────────────────────────────────────────────────────────────────────────────────

describe("PortPanel", () => {
  const vlans = [
    { id: "10", name: "LAN", color: "chart-1" },
    { id: "20", name: "DMZ", color: "#f0883e" },
    { id: "iot", color: "success" },
  ];
  const ports: PanelPort[] = [
    { id: "p1", to: "Firewall", tagged: ["10", "20"] },
    { id: "p2", untagged: "10", tagged: ["20", "10"], to: "AP", speed: "2.5G" },
    { id: "p3" },
    { id: "p4", state: "disabled", note: "bad cable" },
    { id: "sfp1", label: "SFP+1", connector: "sfp", to: "Server", state: "exposed", untagged: "iot" },
  ];
  test("estado por defecto, marcas de VLAN y nombres", () => {
    assert.equal(portState(ports[0]!), "linked");
    assert.equal(portState(ports[2]!), "free");
    assert.deepEqual(vlanMarks(ports[1]!, vlans), [
      { vlan: "10", untagged: true, color: "var(--z-chart-1)" },
      { vlan: "20", untagged: false, color: "#f0883e" },
    ]);
    assert.equal(vlanMarks(ports[4]!, vlans)[0]!.color, "var(--z-success)");
    assert.equal(vlanName("10", vlans), "VLAN 10 LAN");
    assert.equal(vlanName("iot", vlans), "iot");
    assert.equal(vlanName("lan", [{ id: "lan", vlan: 10, name: "LAN" }]), "VLAN 10 LAN");
    assert.equal(vlanName("lan", [{ id: "lan", name: "LAN" }]), "LAN");
    assert.equal(vlanName("99"), "VLAN 99");
  });
  test("descripción para lectores", () => {
    assert.equal(describePort(ports[1]!, 1, vlans), "Port 2 AP, connected, untagged VLAN 10 LAN, tagged VLAN 20 DMZ, 2.5G");
    assert.equal(describePort(ports[2]!, 2, vlans), "Port 3 free");
    assert.equal(describePort(ports[3]!, 3, vlans), "Port 4, disabled, bad cable");
    assert.equal(describePort(ports[4]!, 4, vlans), "Port SFP+1 Server, connected, SFP, exposed to the internet, untagged iot");
    assert.equal(
      describePort(
        ports[0]!,
        0,
        vlans,
        mergePortPanelLabels({ port: "Puerto {label}", linked: "conectado", tagged: "etiquetadas {list}" }),
        "es",
      ),
      "Puerto 1 Firewall, conectado, etiquetadas VLAN 10 LAN y VLAN 20 DMZ",
    );
  });
  test("grupos y teclado", () => {
    assert.deepEqual(
      portGroups(ports).map((g) => [g.key, g.ports.length]),
      [
        ["rj45", 4],
        ["sfp", 1],
      ],
    );
    const ids = ports.map((p) => p.id);
    assert.equal(nextPort(ids, "p1", "ArrowRight"), "p2");
    assert.equal(nextPort(ids, "p1", "ArrowLeft"), "p1");
    assert.equal(nextPort(ids, "sfp1", "ArrowRight"), "sfp1");
    assert.equal(nextPort(ids, "p2", "Home"), "p1");
    assert.equal(nextPort(ids, "p2", "End"), "sfp1");
    assert.equal(nextPort(ids, undefined, "ArrowUp"), "p1");
    assert.equal(nextPort(ids, "p2", "x"), undefined);
    assert.equal(nextPort([], "p2", "Home"), undefined);
  });
  test("marcado: listbox horizontal, parada de tabulación y anclas", () => {
    const html = toHTML(portPanelTree({ ports, vlans, label: "Core ports", selected: "p2", size: "sm" }));
    assert.match(html, /^<div class="z-port-panel" role="listbox" aria-orientation="horizontal" aria-label="Core ports" data-size="sm">/);
    assert.equal((html.match(/tabindex="0"/g) ?? []).length, 1);
    assert.match(html, /data-port="p2" data-port-anchor data-side="bottom"/);
    assert.match(html, /aria-selected="true"[^>]*data-port="p2"/);
    assert.match(html, /aria-disabled="true"/);
    assert.match(html, /<span class="z-port__to" aria-hidden="true">free<\/span>/);
    assert.match(html, /aria-label="Port 3 free"/);
    assert.match(toHTML(portPanelTree({ ports, active: "p3" })), /tabindex="0"[^>]*data-port="p3"/);
    assert.doesNotMatch(toHTML(portPanelTree({ ports, showTargets: false })), /z-port__to/);
    assert.match(toHTML(portPanelTree({ ports, side: "top" })), /data-side="top"/);
  });
});

// ── StoragePool ────────────────────────────────────────────────────────────────────────────────────────────

describe("StoragePool", () => {
  test("tolerancia por tipo de vdev y del pool", () => {
    assert.equal(faultTolerance("raidz1", 7), 1);
    assert.equal(faultTolerance("raidz2", 6), 2);
    assert.equal(faultTolerance("raidz3", 8), 3);
    assert.equal(faultTolerance("raidz3", 3), 0);
    assert.equal(faultTolerance("mirror", 3), 2);
    assert.equal(faultTolerance("single", 1), 0);
    assert.equal(faultTolerance("stripe", 4), 0);
    assert.equal(poolTolerance([]), 0);
    assert.equal(
      poolTolerance([
        { layout: "raidz2", disks: 6, disk: "hdd" },
        { layout: "mirror", disks: 2, disk: "ssd" },
      ]),
      1,
    );
  });
  test("uso, resumen y texto", () => {
    assert.equal(poolUsage(5, 10), 0.5);
    assert.equal(poolUsage(20, 10), 1);
    assert.equal(poolUsage(1, 0), 0);
    assert.equal(
      diskSummary([
        { layout: "raidz1", disks: 7, disk: "hdd" },
        { layout: "mirror", disks: 2, disk: "ssd" },
        { layout: "single", disks: 0, disk: "nvme" },
      ]),
      "7 HDD + 2 SSD",
    );
    const TiB = 1024 ** 4;
    assert.equal(usageText(41.2 * TiB, 85.6 * TiB, { locale: "en-US" }), "48% used · 44.4\u00a0TiB free · 85.6\u00a0TiB usable");
    assert.equal(usageText(500e9, 1e12, { locale: "en-US", units: "decimal" }), "50% used · 500 GB free · 1 TB usable");
    assert.equal(mergeStoragePoolLabels({ mayFail: { one: "uno", other: "{count}" } }).layouts.mirror, "mirror");
  });
  test("marcado: medidor con valor en texto, discos y tolerancia", () => {
    const html = toHTML(
      storagePoolTree({
        name: "tank",
        used: 95,
        size: 100,
        locale: "en-US",
        note: "hourly snapshots",
        headingLevel: 4,
        vdevs: [
          { role: "data", layout: "raidz2", disks: 6, disk: "hdd", model: "6× 12 TB" },
          { role: "cache", layout: "single", disks: 1, disk: "nvme", note: "L2ARC" },
        ],
      }),
    );
    assert.match(html, /<h4 class="z-storage-pool__name">tank<\/h4>/);
    assert.match(html, /role="meter"[^>]*aria-valuenow="95"[^>]*aria-valuetext="95% used/);
    assert.match(html, /data-level="critical"/);
    assert.equal((html.match(/class="z-disk" data-kind="hdd"/g) ?? []).length, 6);
    assert.match(html, /2 disks may fail/);
    assert.match(html, /data-redundancy="none">no redundancy/);
    assert.match(html, /z-storage-pool__note">hourly snapshots/);
  });
});

// ── Enmascarado ────────────────────────────────────────────────────────────────────────────────────────────

describe("enmascarado", () => {
  test("dominios: conserva el subdominio y los nombres internos", () => {
    assert.equal(redactDomain("jellyfin.mylab.net"), "jellyfin.example.com");
    assert.equal(redactDomain("mylab.net"), "example.com");
    assert.equal(redactDomain("a.b.mylab.co.uk"), "a.b.example.com");
    assert.equal(redactDomain("nas.internal"), "nas.internal");
    assert.equal(redactDomain("printer.local"), "printer.local");
    assert.equal(redactDomain("app.example.com"), "app.example.com");
    assert.equal(redactDomain("app.mylab.net", { domain: "redacted.com" }), "app.redacted.com");
  });
  test("IP: públicas a rangos de documentación, privadas intactas salvo que se pida", () => {
    assert.equal(redactIpv4("10.0.10.20"), "10.0.10.20");
    assert.equal(redactIpv4("192.168.1.1"), "192.168.1.1");
    assert.match(redactIpv4("192.168.1.1", { privateIps: true }), /^(192\.0\.2|198\.51\.100|203\.0\.113)\.\d+$/);
    assert.match(redactIpv4("81.40.12.7"), /^(192\.0\.2|198\.51\.100|203\.0\.113)\.\d+$/);
    assert.equal(redactIpv4("203.0.113.9"), "203.0.113.9");
    assert.equal(redactIpv4("81.40.12.7"), redactIpv4("81.40.12.7"));
    assert.match(redactIpv6("2a02:1234:5678::1"), /^2001:db8::[0-9a-f]+$/);
    assert.equal(redactIpv6("fe80::1"), "fe80::1");
    assert.equal(stableHash("a"), stableHash("a"));
  });
  test("texto: auto, por tipo y máscara", () => {
    assert.equal(
      redactText("git at git.mylab.net (81.40.12.7), mail me@mylab.net, see notes.md, host nas.internal, LAN 10.0.10.20"),
      `git at git.example.com (${redactIpv4("81.40.12.7")}), mail user@example.com, see notes.md, host nas.internal, LAN 10.0.10.20`,
    );
    assert.equal(redactText("a.mylab.net 81.40.12.7", "domain"), "a.example.com 81.40.12.7");
    assert.equal(redactText("a.mylab.net 81.40.12.7", "ip"), `a.mylab.net ${redactIpv4("81.40.12.7")}`);
    assert.equal(redactText("secret", "text"), "••••••");
    assert.equal(redactText("secret", "text", { mask: "***" }), "***");
    assert.equal(redactText(""), "");
    assert.equal(redactText("no data here"), "no data here");
  });
  test("propiedades: estable, nunca deja el dominio original y en tiempo lineal", () => {
    const label = fc.stringMatching(/^[a-z][a-z0-9]{1,8}$/);
    fc.assert(
      fc.property(label, label, fc.constantFrom("net", "org", "dev", "io"), (sub, name, tld) => {
        fc.pre(!["example", "internal", "local", "lan", "localhost"].includes(name));
        const text = `see https://${sub}.${name}.${tld}/x now`;
        const out = redactText(text);
        assert.equal(out, redactText(text));
        assert.ok(!out.includes(`${name}.${tld}`), out);
        assert.equal(redactText(out), out);
      }),
    );
    const t0 = performance.now();
    redactText(`${"a.".repeat(60_000)}!`);
    redactText("1.".repeat(60_000));
    assert.ok(performance.now() - t0 < 1000);
  });
  test("interruptor global con avisos", () => {
    let calls = 0;
    const off = onRedactionChange(() => calls++);
    setRedaction(true);
    setRedaction(true);
    assert.equal(isRedacted(), true);
    setRedaction(true, { domain: "redacted.com" });
    setRedaction(false);
    off();
    setRedaction(true);
    setRedaction(false);
    assert.equal(calls, 3);
    assert.equal(isRedacted(), false);
  });
});

// ── Inventario ─────────────────────────────────────────────────────────────────────────────────────────────

const LAB: Inventory = {
  title: "Example lab",
  networks: [
    { id: "lan", name: "LAN", vlan: 10, subnet: "10.0.10.0/24", color: "chart-1" },
    { id: "dmz", name: "DMZ", vlan: 20, color: "chart-2", zone: true },
    { id: "mgmt", name: "MGMT", vlan: 99, color: "chart-6" },
  ],
  internet: { label: "Internet", down: "1 Gbit/s", up: "100 Mbit/s" },
  externals: [{ id: "dns", name: "DNS provider" }],
  devices: [
    { id: "fw", name: "Edge", role: "firewall", ip: "10.0.99.1", network: "mgmt" },
    {
      id: "sw",
      name: "Core",
      role: "switch",
      network: "mgmt",
      ports: [
        { id: "p1", untagged: "mgmt", tagged: ["lan", "dmz"] },
        { id: "p2", untagged: "lan" },
        { id: "p3" },
        { id: "s1", label: "SFP+1", connector: "sfp", tagged: ["lan", "dmz"] },
      ],
    },
    { id: "pc", name: "Desk", role: "workstation", network: "lan" },
    {
      id: "srv",
      name: "Host",
      role: "server",
      network: "lan",
      hardware: [{ kind: "CPU", value: "8 cores" }],
      guests: [
        { id: "web", name: "Web", type: "ct", network: "dmz" },
        { id: "db", name: "DB", type: "vm", network: "lan" },
      ],
      pools: [{ name: "tank", used: 1, size: 2, vdevs: [{ layout: "mirror", disks: 2, disk: "ssd" }] }],
    },
  ],
  links: [
    { from: "internet", to: "fw", kind: "wan", speed: "1G" },
    { from: "fw", to: "sw:p1", kind: "trunk", speed: "2.5G" },
    { from: "pc", to: "sw:p2", speed: "1G", network: "lan" },
    { from: "sw:s1", to: "srv", kind: "trunk", speed: "10G" },
  ],
  services: [{ name: "Web", host: "web", ports: "443", protocol: "tcp", public: true }],
};

describe("inventario", () => {
  test("validación de referencias", () => {
    assert.deepEqual(validateInventory(LAB), []);
    const bad: Inventory = {
      networks: [{ id: "lan", name: "LAN" }],
      devices: [
        {
          id: "a",
          name: "A",
          role: "switch",
          network: "nope",
          ports: [{ id: "p", untagged: "x", tagged: ["y"] }],
          guests: [{ id: "g", name: "G", type: "vm", network: "z" }],
        },
        { id: "a", name: "B", role: "other" },
      ],
      links: [
        { from: "a:q", to: "ghost" },
        { from: "a", to: "internet", network: "w" },
      ],
      services: [{ name: "S", host: "nobody" }],
    };
    assert.deepEqual(validateInventory(bad), [
      "devices.a.network: unknown network nope",
      "devices.a.ports.p.untagged: unknown network x",
      "devices.a.ports.p.tagged: unknown network y",
      "devices.a.guests.g.network: unknown network z",
      "devices.a: duplicate id",
      "links.0: unknown port a:q",
      "links.0: unknown device ghost",
      "links.1.network: unknown network w",
      "services.S: unknown host nobody",
    ]);
    assert.deepEqual(validateInventory({} as Inventory), ["devices: missing"]);
  });
  test("grafo: nube, carpetas con puertos ancla, zona y aristas con estilo", () => {
    const g = diagramFromInventory(LAB);
    const byId = new Map(g.nodes.map((n) => [n.id, n]));
    assert.equal(byId.get("internet")!.type, "cloud");
    assert.match(String(byId.get("internet")!.data.description), /↓ 1 Gbit\/s · ↑ 100 Mbit\/s/);
    assert.equal(byId.get("sw")!.type, "folder");
    assert.equal(byId.get("sw")!.data.kind, "switch");
    assert.equal(byId.get("sw")!.data.color, "chart-6");
    assert.ok(byId.get("sw")!.ports!.every((p) => p.anchor));
    const panel = byId.get("sw")!.data.ports as { id: string; to?: string }[];
    assert.deepEqual(
      panel.map((p) => p.to),
      ["Edge", "Desk", undefined, "Host"],
    );
    assert.equal(byId.get("zone-dmz")!.type, "zone");
    assert.equal(byId.get("srv-web")!.parentId, "zone-dmz");
    assert.deepEqual(
      (byId.get("srv")!.data.guests as { id: string }[]).map((x) => x.id),
      ["db"],
    );
    const e = new Map(g.edges.map((x) => [x.id, x]));
    assert.equal(e.get("link-0")!.color, "danger");
    assert.equal(e.get("link-1")!.double, true);
    assert.equal(e.get("link-1")!.targetPort, "p1");
    // El enlace del equipo se da la vuelta: el switch (nivel más alto) es el origen.
    assert.equal(e.get("link-2")!.source, "sw");
    assert.equal(e.get("link-2")!.sourcePort, "p2");
    assert.equal(e.get("link-2")!.targetPort, "up");
    assert.equal(e.get("link-2")!.color, "chart-1");
    assert.equal(e.get("link-3")!.weight, "10G");
    assert.equal(e.get("ext-dns")!.dash, "dotted");
    assert.ok(g.edges.every((x) => x.type === "orthogonal"));
    // Niveles: internet arriba, después el borde, el núcleo, los equipos y los servidores.
    const y = (id: string) => byId.get(id)!.position.y;
    assert.ok(y("internet") < y("fw") && y("fw") < y("sw") && y("sw") < y("pc") && y("pc") < y("srv"));
    assert.ok(y("zone-dmz") > y("srv"));
    assert.deepEqual(g.vlans[0], { id: "lan", vlan: 10, name: "LAN", color: "chart-1" });
    assert.deepEqual(Object.keys(g.legend.kinds ?? {}).sort(), ["access", "internet", "trunk", "wan"]);
    assert.deepEqual(diagramFromInventory(LAB), g);
  });
  test("tamaños estimados y capa mínima del layout", () => {
    assert.ok(estimateDeviceSize(LAB.devices[1]!).width >= 300);
    assert.ok(estimateDeviceSize(LAB.devices[3]!).width >= 560);
    const r = layeredLayout(["a", "b"], [], new Map(), { minLayer: new Map([["b", 3]]) });
    assert.equal(r.layers.get("b"), 3);
  });
  test("el esquema describe el inventario de ejemplo", () => {
    // Validador mínimo de lo que usa el esquema (type, required, properties, items, enum, additionalProperties).
    type S = {
      type?: string;
      required?: string[];
      properties?: Record<string, S>;
      items?: S;
      enum?: unknown[];
      additionalProperties?: boolean;
    };
    const check = (s: S, v: unknown, path: string): string[] => {
      const out: string[] = [];
      if (s.enum && !s.enum.includes(v)) out.push(`${path}: enum`);
      if (s.type === "object") {
        if (typeof v !== "object" || v === null || Array.isArray(v)) return [`${path}: object`];
        for (const r of s.required ?? []) if (!(r in v)) out.push(`${path}.${r}: required`);
        for (const [k, val] of Object.entries(v)) {
          const ps = s.properties?.[k];
          if (!ps) {
            if (s.additionalProperties === false) out.push(`${path}.${k}: extra`);
          } else out.push(...check(ps, val, `${path}.${k}`));
        }
      } else if (s.type === "array") {
        if (!Array.isArray(v)) return [`${path}: array`];
        v.forEach((x, i) => {
          out.push(...check(s.items ?? {}, x, `${path}[${i}]`));
        });
      } else if (s.type === "string" && typeof v !== "string") out.push(`${path}: string`);
      else if ((s.type === "number" || s.type === "integer") && typeof v !== "number") out.push(`${path}: number`);
      else if (s.type === "boolean" && typeof v !== "boolean") out.push(`${path}: boolean`);
      return out;
    };
    assert.deepEqual(check(INVENTORY_SCHEMA as unknown as S, LAB, "$"), []);
    assert.deepEqual(check(INVENTORY_SCHEMA as unknown as S, { devices: [{ id: "x", name: "X", role: "toaster" }], extra: 1 }, "$"), [
      "$.devices[0].role: enum",
      "$.extra: extra",
    ]);
  });
});

// ── Exportación (piezas puras) ─────────────────────────────────────────────────────────────────────────────

describe("exportar (puro)", () => {
  test("documento SVG con foreignObject, fondo, título y CSS sin escapes peligrosos", () => {
    const svg = svgDocument({
      width: 100.4,
      height: 50,
      body: "<p>x</p>",
      background: "#000",
      css: "a{}</style><script>",
      title: 'A "b" <c>',
    });
    assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="100" height="50" viewBox="0 0 100 50" role="img">/);
    assert.match(svg, /<title>A &quot;b&quot; &lt;c&gt;<\/title>/);
    assert.doesNotMatch(svg, /<\/style><script>/);
    assert.match(svg, /<rect width="100%" height="100%" fill="#000"\/>/);
    assert.match(svg, /<foreignObject x="0" y="0" width="100" height="50"><div xmlns="http:\/\/www\.w3\.org\/1999\/xhtml"/);
    assert.doesNotMatch(svgDocument({ width: 1, height: 1, body: "" }), /<rect|<title|<style/);
  });
  test("referencias locales, fuentes y tamaño del PNG", () => {
    assert.equal(localRefs('url("http://x/page?a=1#z-arrow")'), "url(#z-arrow)");
    assert.equal(localRefs("url(#a) none"), "url(#a) none");
    assert.deepEqual(fontSources('url("a.woff") format("woff"), url(b.woff2) format("woff2")'), ["b.woff2", "a.woff"]);
    assert.deepEqual(fontFamilies('"Inter Variable", system-ui, sans-serif'), ["inter variable", "system-ui", "sans-serif"]);
    assert.deepEqual(pngSize(100, 50, 2), { width: 200, height: 100, scale: 2 });
    const big = pngSize(20000, 100, 2);
    assert.ok(big.width <= 16384);
    assert.equal(escapeXML(`<&"'>`), "&lt;&amp;&quot;&#39;&gt;");
  });
});

describe("PortPanel con el DOM", () => {
  test("flechas, Inicio y Fin mueven el foco itinerante; Intro y clic eligen", () => {
    const host = document.createElement("div");
    host.innerHTML = toHTML(
      portPanelTree({
        ports: [{ id: "a", to: "X" }, { id: "b" }, { id: "c", state: "disabled" }],
      }),
    );
    document.body.append(host);
    const root = host.firstElementChild as HTMLElement;
    const chosen: string[] = [];
    const active: string[] = [];
    const off = bindPortPanel(root, { onSelect: (id) => chosen.push(id), onActive: (id) => active.push(id) });
    const opt = (id: string) => root.querySelector<HTMLElement>(`[data-port="${id}"]`)!;
    const key = (el: HTMLElement, k: string) => {
      const e = new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true });
      el.dispatchEvent(e);
      return e.defaultPrevented;
    };
    assert.equal(key(opt("a"), "ArrowRight"), true);
    assert.equal(opt("b").tabIndex, 0);
    assert.equal(opt("a").tabIndex, -1);
    assert.equal(key(opt("b"), "End"), true);
    assert.equal(opt("c").tabIndex, 0);
    assert.equal(key(opt("c"), "ArrowRight"), true);
    assert.equal(key(opt("c"), "Enter"), false);
    assert.equal(key(opt("a"), " "), true);
    assert.equal(key(opt("a"), "x"), false);
    opt("b").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    assert.deepEqual(chosen, ["a", "b"]);
    assert.deepEqual(active, ["b", "c", "b"]);
    off();
    key(opt("a"), "ArrowRight");
    assert.deepEqual(active, ["b", "c", "b"]);
    host.remove();
  });
});
