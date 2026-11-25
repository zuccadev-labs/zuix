// Lógica pura del lienzo de nodos: vista, rutas de aristas, modelo, puertos, edición, historial, disposición por
// capas, minimapa y marcado. Las propiedades de geometría e historial van con fast-check (semilla fija).
import "./helpers/dom.mjs";
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import fc from "fast-check";
import {
  edgeRoute,
  type EdgeEnds,
  orthogonalPoints,
  polylineMidpoint,
  routeBounds,
  simplifyPolyline,
  type Side,
} from "../../zui/src/core/edge-path.ts";
import {
  absolutePosition,
  adjacency,
  ancestors,
  descendants,
  describeGraph,
  describeNode,
  type Graph,
  type GraphNode,
  hasCycle,
  indexNodes,
  listText,
  nodeRects,
  paintOrder,
  parseGraph,
  reaches,
  serializeGraph,
  topologicalOrder,
  visibleNodes,
  wouldCreateCycle,
} from "../../zui/src/core/graph.ts";
import {
  addEdge,
  copyFragment,
  dragPositions,
  duplicate,
  freshId,
  groupNodes,
  moveNodes,
  pasteFragment,
  reconnectEdge,
  removeElements,
  resizeNode,
  topmost,
  ungroup,
} from "../../zui/src/core/graph-edit.ts";
import { crossings, feedbackEdges, layeredLayout } from "../../zui/src/core/layout-layers.ts";
import { minimapProjection, minimapView, projectRect, unprojectPoint, viewportFromMinimap } from "../../zui/src/core/minimap.ts";
import { controlsTree, listViewTree, mergeNodeLabels, minimapTree, nodeTree, portLabel } from "../../zui/src/core/node-view.ts";
import {
  anchorOf,
  compatiblePorts,
  connectionProblem,
  normalizeConnection,
  portFractions,
  sidePoint,
  typesMatch,
} from "../../zui/src/core/ports.ts";
import { boxSelection } from "../../zui/src/core/selection.ts";
import { createUndoStack } from "../../zui/src/core/undo.ts";
import { toHTML } from "../../zui/src/core/vnode.ts";
import {
  centerOn,
  clampZoom,
  containsPoint,
  containsRect,
  expandRect,
  fitRect,
  intersects,
  panBy,
  pinchViewport,
  rectFromPoints,
  revealRect,
  snapPoint,
  snapValue,
  toScreen,
  toWorld,
  unionRect,
  type Viewport,
  visibleRect,
  wheelFactor,
  zoomBy,
  zoomTo,
} from "../../zui/src/core/viewport.ts";

fc.configureGlobal({ seed: Number(process.env.ZUIX_FC_SEED ?? 20261122), numRuns: Number(process.env.ZUIX_FC_RUNS ?? 300) });

const coord = fc.double({ min: -5000, max: 5000, noNaN: true });
const zoom = fc.double({ min: 0.1, max: 4, noNaN: true });
const vpArb = fc.record({ x: coord, y: coord, zoom });
const point = fc.record({ x: coord, y: coord });
const side = fc.constantFrom<Side>("left", "right", "top", "bottom");
const close = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) <= eps * Math.max(1, Math.abs(a), Math.abs(b));

const sample = (): Graph => ({
  nodes: [
    {
      id: "a",
      position: { x: 0, y: 0 },
      data: { label: "Fetch", status: "running" },
      ports: [{ id: "out", kind: "source", type: "json" }],
    },
    {
      id: "b",
      position: { x: 300, y: 0 },
      data: { label: "Filter" },
      ports: [
        { id: "in", kind: "target", type: "json", max: 1 },
        { id: "yes", kind: "source", type: "json" },
        { id: "no", kind: "source", type: "text" },
      ],
    },
    { id: "c", position: { x: 600, y: 0 }, data: { label: "Save" }, ports: [{ id: "in", kind: "target", type: "json" }] },
    { id: "d", position: { x: 600, y: 200 }, data: { label: "Log" }, ports: [{ id: "in", kind: "target", type: "text" }] },
  ],
  edges: [
    { id: "e1", source: "a", sourcePort: "out", target: "b", targetPort: "in" },
    { id: "e2", source: "b", sourcePort: "yes", target: "c", targetPort: "in" },
  ],
});

describe("viewport", () => {
  test("pantalla ↔ mundo son inversas", () => {
    fc.assert(
      fc.property(vpArb, point, (vp, p) => {
        const back = toScreen(vp, toWorld(vp, p));
        return close(back.x, p.x, 1e-9) && close(back.y, p.y, 1e-9);
      }),
    );
  });
  test("zoomTo deja quieto el punto pedido y respeta los límites", () => {
    fc.assert(
      fc.property(vpArb, fc.double({ min: -10, max: 50, noNaN: true }), point, (vp, z, at) => {
        const next = zoomTo(vp, z, at, 0.25, 2);
        const before = toWorld(vp, at);
        const after = toWorld(next, at);
        return next.zoom >= 0.25 && next.zoom <= 2 && close(before.x, after.x, 1e-6) && close(before.y, after.y, 1e-6);
      }),
    );
  });
  test("acercar y alejar con la rueda vuelve al mismo zoom", () => {
    fc.assert(fc.property(fc.double({ min: -100, max: 100, noNaN: true }), (d) => close(wheelFactor(d) * wheelFactor(-d), 1, 1e-12)));
    assert.equal(wheelFactor(1, 1), wheelFactor(16));
    assert.equal(wheelFactor(1, 2), wheelFactor(400));
    assert.ok(wheelFactor(1e6) > 0.7, "un salto enorme se acota");
  });
  test("clampZoom acepta límites al revés y valores no finitos", () => {
    assert.equal(clampZoom(10, 2, 0.5), 2);
    assert.equal(clampZoom(Number.NaN), 1);
    assert.equal(zoomBy({ x: 0, y: 0, zoom: 1 }, 2, { x: 0, y: 0 }).zoom, 2);
    assert.deepEqual(panBy({ x: 1, y: 2, zoom: 1 }, Number.NaN, 3), { x: 1, y: 5, zoom: 1 });
  });
  test("fitRect encaja la caja con margen y centrada", () => {
    fc.assert(
      fc.property(
        fc.record({
          x: coord,
          y: coord,
          width: fc.double({ min: 10, max: 4000, noNaN: true }),
          height: fc.double({ min: 10, max: 4000, noNaN: true }),
        }),
        (rect) => {
          const size = { width: 800, height: 600 };
          const vp = fitRect(rect, size, { padding: 40, min: 0.01, max: 10 });
          const a = toScreen(vp, rect);
          const b = toScreen(vp, { x: rect.x + rect.width, y: rect.y + rect.height });
          const eps = 1e-6;
          return a.x >= 40 - eps && a.y >= 40 - eps && b.x <= 760 + eps && b.y <= 560 + eps && close((a.x + b.x) / 2, 400, 1e-6);
        },
      ),
    );
    assert.deepEqual(fitRect(null, { width: 100, height: 50 }), { x: 50, y: 25, zoom: 1 });
  });
  test("fitRect con zoom mínimo: el eje que no cabe empieza por el principio de la caja", () => {
    // 300×1000 en 800×600 pediría 0,52; con mínimo 0,8 el alto no cabe y el ancho sí.
    const vp = fitRect({ x: 100, y: 200, width: 300, height: 1000 }, { width: 800, height: 600 }, { padding: 40, min: 0.8 });
    assert.equal(vp.zoom, 0.8);
    assert.ok(close(toScreen(vp, { x: 100, y: 200 }).y, 40, 1e-9), "arriba con el margen");
    assert.ok(close(toScreen(vp, { x: 250, y: 0 }).x, 400, 1e-9), "centrada en el eje que cabe");
  });
  test("visibleRect y revealRect", () => {
    const vp: Viewport = { x: 100, y: 50, zoom: 2 };
    assert.deepEqual(visibleRect(vp, { width: 400, height: 200 }), { x: -50, y: -25, width: 200, height: 100 });
    const size = { width: 400, height: 300 };
    const inside = { x: 50, y: 50, width: 50, height: 50 };
    const start = { x: 0, y: 0, zoom: 1 };
    assert.equal(revealRect(start, inside, size), start, "si se ve no cambia");
    fc.assert(
      fc.property(
        fc.record({
          x: coord,
          y: coord,
          width: fc.double({ min: 1, max: 200, noNaN: true }),
          height: fc.double({ min: 1, max: 200, noNaN: true }),
        }),
        (r) => {
          const next = revealRect(start, r, size, 24);
          const a = toScreen(next, r);
          return a.x >= 24 - 1e-6 && a.y >= 24 - 1e-6 && a.x + r.width <= 376 + 1e-6 && a.y + r.height <= 276 + 1e-6;
        },
      ),
    );
    const huge = revealRect(start, { x: 0, y: 0, width: 1000, height: 1000 }, size);
    assert.ok(Math.abs(toScreen(huge, { x: 500, y: 500 }).x - 200) < 1e-9, "una caja mayor que la vista se centra");
    assert.deepEqual(centerOn(start, { x: 10, y: 10 }, size), { x: 190, y: 140, zoom: 1 });
  });
  test("el pellizco escala por la razón de distancias y sigue al centro", () => {
    const vp = { x: 0, y: 0, zoom: 1 };
    const next = pinchViewport(vp, 100, 200, { x: 50, y: 50 }, { x: 80, y: 60 });
    assert.equal(next.zoom, 2);
    const w = toWorld(next, { x: 80, y: 60 });
    assert.ok(close(w.x, 50) && close(w.y, 50));
    assert.equal(pinchViewport(vp, 0, 10, { x: 0, y: 0 }, { x: 0, y: 0 }).zoom, 1);
  });
  test("rectángulos", () => {
    const ipoint = fc.record({ x: fc.integer({ min: -5000, max: 5000 }), y: fc.integer({ min: -5000, max: 5000 }) });
    fc.assert(
      fc.property(ipoint, ipoint, (a, b) => {
        const r = rectFromPoints(a, b);
        return r.width >= 0 && r.height >= 0 && containsPoint(r, a) && containsPoint(r, b);
      }),
    );
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            x: coord,
            y: coord,
            width: fc.double({ min: 0, max: 500, noNaN: true }),
            height: fc.double({ min: 0, max: 500, noNaN: true }),
          }),
          { minLength: 1, maxLength: 12 },
        ),
        (rects) => {
          const u = unionRect(rects)!;
          return rects.every((r) => containsRect(expandRect(u, 1e-6), r));
        },
      ),
    );
    assert.equal(unionRect([]), null);
    assert.ok(intersects({ x: 0, y: 0, width: 10, height: 10 }, { x: 5, y: 5, width: 10, height: 10 }));
    assert.ok(!intersects({ x: 0, y: 0, width: 10, height: 10 }, { x: 10, y: 0, width: 10, height: 10 }), "tocarse no es cortar");
    assert.equal(snapValue(23, 16), 16);
    assert.equal(snapValue(25, 16), 32);
    assert.equal(snapValue(25, false), 25);
    assert.deepEqual(snapPoint({ x: 7, y: 9 }, 8), { x: 8, y: 8 });
  });
});

describe("rutas de aristas", () => {
  // Coordenadas de pantalla con dos decimales, como las que pinta el lienzo.
  const cpoint = fc.record({
    x: fc.integer({ min: -500000, max: 500000 }).map((n) => n / 100),
    y: fc.integer({ min: -500000, max: 500000 }).map((n) => n / 100),
  });
  const ends = fc.record({ source: cpoint, sourceSide: side, target: cpoint, targetSide: side }) as fc.Arbitrary<EdgeEnds>;
  const startEnd = (d: string) => {
    const nums = d.match(/-?\d+(?:\.\d+)?(?:e-?\d+)?/g)!.map(Number);
    return { start: { x: nums[0]!, y: nums[1]! }, end: { x: nums[nums.length - 2]!, y: nums[nums.length - 1]! } };
  };
  test("toda ruta empieza en el origen y acaba en el destino, con números finitos", () => {
    fc.assert(
      fc.property(ends, fc.constantFrom("straight", "bezier", "step", "smoothstep"), (e, type) => {
        const r = edgeRoute(type, e);
        const { start, end } = startEnd(r.d);
        const ok = (a: number, b: number) => Math.abs(a - b) <= 0.01;
        return (
          !/NaN|Infinity/.test(r.d) &&
          ok(start.x, e.source.x) &&
          ok(start.y, e.source.y) &&
          ok(end.x, e.target.x) &&
          ok(end.y, e.target.y) &&
          Number.isFinite(r.length) &&
          r.length >= 0
        );
      }),
    );
  });
  test("las escalonadas solo tienen tramos horizontales o verticales", () => {
    fc.assert(
      fc.property(ends, (e) => {
        const pts = orthogonalPoints(e, 20);
        for (let i = 1; i < pts.length; i++) {
          const a = pts[i - 1]!;
          const b = pts[i]!;
          if (Math.abs(a.x - b.x) > 0.02 && Math.abs(a.y - b.y) > 0.02) return false;
        }
        return true;
      }),
    );
  });
  test("la etiqueta cae dentro de la caja de la ruta", () => {
    fc.assert(
      fc.property(ends, fc.constantFrom("straight", "bezier", "step", "smoothstep"), (e, type) => {
        const r = edgeRoute(type, e);
        return containsPoint(expandRect(routeBounds(r), 0.01), r.label);
      }),
    );
  });
  test("casos concretos", () => {
    const r = edgeRoute("straight", { source: { x: 0, y: 0 }, sourceSide: "right", target: { x: 100, y: 0 }, targetSide: "left" });
    assert.equal(r.d, "M 0 0 L 100 0");
    assert.deepEqual(r.label, { x: 50, y: 0 });
    assert.equal(r.length, 100);
    const step = edgeRoute("step", { source: { x: 0, y: 0 }, sourceSide: "right", target: { x: 200, y: 100 }, targetSide: "left" });
    assert.match(step.d, /^M 0 0 L/);
    assert.ok(!step.d.includes("Q"), "sin radio, sin curvas");
    const smooth = edgeRoute(
      "smoothstep",
      { source: { x: 0, y: 0 }, sourceSide: "right", target: { x: 200, y: 100 }, targetSide: "left" },
      { radius: 8 },
    );
    assert.ok(smooth.d.includes("Q"), "esquinas redondeadas");
    const bez = edgeRoute(undefined, { source: { x: 0, y: 0 }, sourceSide: "right", target: { x: -200, y: 0 }, targetSide: "left" });
    assert.match(bez.d, /C/);
    assert.equal(bez.points.length, 4);
    const vertical = orthogonalPoints({ source: { x: 0, y: 0 }, sourceSide: "bottom", target: { x: 50, y: 200 }, targetSide: "top" });
    assert.equal(vertical.length, 4);
    const back = orthogonalPoints({ source: { x: 0, y: 0 }, sourceSide: "bottom", target: { x: 50, y: -200 }, targetSide: "top" });
    assert.ok(back.length >= 4);
    const mixed = orthogonalPoints({ source: { x: 0, y: 0 }, sourceSide: "right", target: { x: 100, y: 100 }, targetSide: "top" });
    assert.equal(mixed.length, 3);
    const mixed2 = orthogonalPoints({ source: { x: 0, y: 0 }, sourceSide: "top", target: { x: 100, y: -100 }, targetSide: "left" });
    assert.equal(mixed2.length, 3);
    const same = edgeRoute("smoothstep", { source: { x: 5, y: 5 }, sourceSide: "right", target: { x: 5, y: 5 }, targetSide: "left" });
    assert.ok(same.d.startsWith("M 5 5"));
    assert.deepEqual(
      simplifyPolyline([
        { x: 0, y: 0 },
        { x: 0, y: 0 },
        { x: 5, y: 0 },
        { x: 10, y: 0 },
      ]),
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ],
    );
    assert.deepEqual(polylineMidpoint([]).mid, { x: 0, y: 0 });
    assert.deepEqual(routeBounds({ d: "", label: { x: 0, y: 0 }, length: 0, points: [] }), { x: 0, y: 0, width: 0, height: 0 });
  });
});

describe("modelo", () => {
  test("posición absoluta de los hijos de un grupo y ciclos de parentId", () => {
    const nodes: GraphNode[] = [
      { id: "g", type: "group", position: { x: 100, y: 100 }, size: { width: 400, height: 300 }, data: { label: "G" } },
      { id: "h", type: "group", parentId: "g", position: { x: 10, y: 10 }, data: {} },
      { id: "n", parentId: "h", position: { x: 5, y: 5 }, data: { label: "N" } },
      { id: "x", parentId: "y", position: { x: 1, y: 1 }, data: {} },
      { id: "y", parentId: "x", position: { x: 1, y: 1 }, data: {} },
    ];
    const index = indexNodes(nodes);
    assert.deepEqual(absolutePosition("n", index), { x: 115, y: 115 });
    assert.deepEqual(absolutePosition("x", index), { x: 2, y: 2 }, "un ciclo se corta");
    assert.deepEqual(ancestors("n", index), ["h", "g"]);
    assert.deepEqual(descendants("g", nodes).sort(), ["h", "n"]);
    assert.deepEqual(
      paintOrder(nodes)
        .map((n) => n.id)
        .slice(0, 1),
      ["g"],
    );
    const rects = nodeRects(nodes, new Map([["n", { width: 50, height: 20 }]]));
    assert.deepEqual(rects.get("n"), { x: 115, y: 115, width: 50, height: 20 });
    assert.deepEqual(rects.get("h"), { x: 110, y: 110, width: 360, height: 240 });
  });
  test("adyacencia, alcance, ciclos y orden topológico", () => {
    const g = sample();
    const adj = adjacency(g.edges);
    assert.equal(adj.outgoing.get("a")?.length, 1);
    assert.ok(reaches("a", "c", g.edges));
    assert.ok(!reaches("c", "a", g.edges));
    assert.ok(wouldCreateCycle("c", "a", g.edges));
    assert.ok(wouldCreateCycle("a", "a", g.edges));
    assert.deepEqual(topologicalOrder(["a", "b", "c", "d"], g.edges), ["a", "d", "b", "c"]);
    assert.ok(!hasCycle(["a", "b", "c"], g.edges));
    assert.ok(hasCycle(["a", "b"], [...g.edges, { id: "x", source: "b", target: "a" }]));
    assert.deepEqual([...visibleNodes(nodeRects(g.nodes), { x: 250, y: -10, width: 100, height: 100 })], ["b"]);
  });
  test("descripciones", () => {
    const g = sample();
    assert.equal(describeGraph(g), "4 nodes, 2 connections");
    assert.equal(describeNode(g, "b"), "1 inputs, 2 outputs; connected to Save; receives from Fetch");
    assert.equal(describeNode(g, "a"), "running; 0 inputs, 1 outputs; connected to Filter");
    assert.equal(describeNode(g, "d"), "1 inputs, 0 outputs; not connected");
    assert.equal(describeNode(g, "zz"), "");
    const grouped = groupNodes(g, ["c", "d"], { id: "grp", label: "Sinks" }).graph;
    assert.equal(describeNode(grouped, "grp"), "group with 2 nodes");
    assert.equal(listText(["A", "B", "C"], "en"), "A, B, and C");
    assert.equal(listText(["A"], "zz-invalid-locale-%%"), "A");
  });
  test("serializar y leer", () => {
    const g = sample();
    assert.deepEqual(parseGraph(serializeGraph(g)), g);
    assert.equal(parseGraph("{"), null);
    assert.equal(parseGraph("[]"), null);
    const dirty = parseGraph(
      JSON.stringify({ nodes: [{ id: "a", position: { x: 0, y: 0 } }, { id: 3 }], edges: [{ id: "e", source: "a", target: "nope" }] }),
    );
    assert.deepEqual(dirty, { nodes: [{ id: "a", position: { x: 0, y: 0 }, data: {} }], edges: [] });
  });
});

describe("puertos", () => {
  test("reparto a lo largo del lado y anclajes", () => {
    const g = sample();
    const b = g.nodes[1]!;
    const f = portFractions(b.ports!);
    assert.equal(f.get("in"), 0.5);
    assert.ok(Math.abs(f.get("yes")! - 1 / 3) < 1e-9);
    const rect = { x: 0, y: 0, width: 200, height: 90 };
    assert.deepEqual(anchorOf(b, rect, "no", "source"), { side: "right", point: { x: 200, y: 60 } });
    assert.deepEqual(anchorOf(b, rect, undefined, "target").side, "left");
    assert.deepEqual(anchorOf({ id: "z", position: { x: 0, y: 0 }, data: {} }, rect, undefined, "source"), {
      side: "right",
      point: { x: 200, y: 45 },
    });
    assert.deepEqual(sidePoint(rect, "top", 0.5), { x: 100, y: 0 });
    assert.deepEqual(sidePoint(rect, "bottom", 0.25), { x: 50, y: 90 });
  });
  test("validación de conexiones", () => {
    const g = sample();
    assert.equal(connectionProblem(g, { node: "a", port: "out" }, { node: "a", port: "out" }), "same-node");
    assert.equal(connectionProblem(g, { node: "b", port: "yes" }, { node: "a", port: "out" }), "direction");
    assert.equal(connectionProblem(g, { node: "b", port: "no" }, { node: "c", port: "in" }), "type");
    assert.equal(connectionProblem(g, { node: "a", port: "out" }, { node: "b", port: "in" }), "duplicate");
    assert.equal(connectionProblem(g, { node: "a", port: "out" }, { node: "zz" }), "missing");
    assert.equal(connectionProblem(g, { node: "a", port: "nope" }, { node: "b", port: "in" }), "missing");
    const limited = {
      ...g,
      nodes: [...g.nodes, { id: "e", position: { x: 0, y: 0 }, data: {}, ports: [{ id: "o", kind: "source" as const }] }],
    };
    assert.equal(connectionProblem(limited, { node: "e", port: "o" }, { node: "b", port: "in" }), "limit");
    assert.equal(connectionProblem(limited, { node: "e", port: "o" }, { node: "b", port: "in" }, { ignoreEdge: "e1" }), null);
    assert.equal(connectionProblem(g, { node: "c", port: "in" }, { node: "b", port: "yes" }), "duplicate", "desde la entrada se normaliza");
    const loop = {
      ...g,
      nodes: [
        ...g.nodes,
        {
          id: "f",
          position: { x: 0, y: 0 },
          data: {},
          ports: [
            { id: "i", kind: "target" as const },
            { id: "o", kind: "source" as const },
          ],
        },
      ],
      edges: [...g.edges, { id: "x", source: "c", target: "f", targetPort: "i" }],
    };
    assert.equal(connectionProblem(loop, { node: "f", port: "o" }, { node: "c", port: "in" }, { allowCycles: false }), "cycle");
    assert.equal(connectionProblem(loop, { node: "f", port: "o" }, { node: "c", port: "in" }), null);
    assert.deepEqual(
      compatiblePorts(g, { node: "b", port: "no" }).map((p) => `${p.node}.${p.port}`),
      ["d.in"],
    );
    assert.deepEqual(normalizeConnection({ node: "c", port: "in" }, "target", { node: "b", port: "yes" }), {
      source: "b",
      sourcePort: "yes",
      target: "c",
      targetPort: "in",
    });
    assert.ok(typesMatch({ id: "a", kind: "source", type: "any" }, { id: "b", kind: "target", type: "json" }));
    assert.ok(typesMatch({ id: "a", kind: "source", type: "json text" }, { id: "b", kind: "target", type: "text" }));
    assert.ok(!typesMatch({ id: "a", kind: "source", type: "json" }, { id: "b", kind: "target", type: "text" }));
  });
});

describe("edición", () => {
  test("mover con imán, sin duplicar el movimiento de los hijos", () => {
    const start = new Map([
      ["a", { x: 3, y: 5 }],
      ["b", { x: 100, y: 100 }],
    ]);
    const next = dragPositions(start, 10, 10, 16, "a");
    assert.deepEqual(next.get("a"), { x: 16, y: 16 });
    assert.deepEqual(next.get("b"), { x: 113, y: 111 }, "los demás siguen con el mismo desplazamiento");
    const g = groupNodes(sample(), ["a", "b"], { id: "grp" }).graph;
    assert.deepEqual(topmost(["grp", "a", "c"], g.nodes).sort(), ["c", "grp"]);
    const moved = moveNodes(g, ["grp", "a"], 10, 0);
    assert.equal(moved.nodes.find((n) => n.id === "a")!.position.x, g.nodes.find((n) => n.id === "a")!.position.x);
    assert.equal(moved.nodes.find((n) => n.id === "grp")!.position.x, g.nodes.find((n) => n.id === "grp")!.position.x + 10);
  });
  test("las posiciones absolutas no cambian al agrupar y desagrupar", () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({ x: fc.integer({ min: -2000, max: 2000 }), y: fc.integer({ min: -2000, max: 2000 }) }), {
          minLength: 1,
          maxLength: 8,
        }),
        (ps) => {
          const g: Graph = { nodes: ps.map((p, i) => ({ id: `n${i}`, position: p, data: {} })), edges: [] };
          const before = nodeRects(g.nodes);
          const { graph: grouped, id } = groupNodes(
            g,
            g.nodes.map((n) => n.id),
          );
          const mid = nodeRects(grouped.nodes);
          const back = ungroup(grouped, id!);
          const after = nodeRects(back.nodes);
          return g.nodes.every((n) => {
            const a = before.get(n.id)!;
            return close(mid.get(n.id)!.x, a.x) && close(after.get(n.id)!.x, a.x) && close(after.get(n.id)!.y, a.y);
          });
        },
      ),
    );
    assert.deepEqual(groupNodes(sample(), []).id, null);
    assert.equal(ungroup(sample(), "a").nodes.length, 4, "desagrupar algo que no es grupo no cambia nada");
  });
  test("borrar arrastra las aristas y los hijos", () => {
    const g = sample();
    const r = removeElements(g, ["b"]);
    assert.deepEqual(
      r.nodes.map((n) => n.id),
      ["a", "c", "d"],
    );
    assert.deepEqual(r.edges, []);
    const onlyEdge = removeElements(g, [], ["e2"]);
    assert.deepEqual(
      onlyEdge.edges.map((e) => e.id),
      ["e1"],
    );
    const grouped = groupNodes(g, ["c", "d"], { id: "grp" }).graph;
    assert.deepEqual(
      removeElements(grouped, ["grp"]).nodes.map((n) => n.id),
      ["a", "b"],
    );
    assert.equal(g.nodes.length, 4, "la entrada queda intacta");
  });
  test("conectar, reconectar y redimensionar", () => {
    const g = sample();
    const { graph, edge } = addEdge(g, { source: "b", sourcePort: "no", target: "d", targetPort: "in" });
    assert.equal(edge.id, "edge-3");
    assert.equal(graph.edges.length, 3);
    assert.equal(addEdge(g, { id: "mine", source: "a", target: "c" }).edge.id, "mine");
    const re = reconnectEdge(g, "e2", "target", { node: "d", port: "in" });
    assert.equal(re.edges[1]!.target, "d");
    const re2 = reconnectEdge(g, "e2", "source", { node: "a", port: "out" });
    assert.equal(re2.edges[1]!.source, "a");
    const sized = resizeNode(g, "a", { width: 50, height: 300 }, 16);
    assert.deepEqual(sized.nodes[0]!.size, { width: 120, height: 304 });
    assert.equal(freshId("node", new Set(["node-1", "node-2"])), "node-3");
  });
  test("copiar, pegar y duplicar con ids nuevos y aristas internas", () => {
    const g = sample();
    const frag = copyFragment(g, ["a", "b"]);
    assert.equal(frag.nodes.length, 2);
    assert.deepEqual(
      frag.edges.map((e) => e.id),
      ["e1"],
    );
    const { graph, ids } = pasteFragment(g, frag, { x: 10, y: 20 });
    assert.equal(graph.nodes.length, 6);
    assert.equal(ids.length, 2);
    assert.ok(ids.every((id) => !g.nodes.some((n) => n.id === id)));
    const pasted = graph.nodes.find((n) => n.id === ids[0])!;
    assert.deepEqual(pasted.position, { x: 10, y: 20 });
    const edge = graph.edges[graph.edges.length - 1]!;
    assert.deepEqual([edge.source, edge.target], ids);
    const twice = pasteFragment(graph, frag);
    assert.equal(new Set(twice.graph.nodes.map((n) => n.id)).size, twice.graph.nodes.length, "ids únicos al pegar dos veces");
    const grouped = groupNodes(g, ["c", "d"], { id: "grp" }).graph;
    const child = copyFragment(grouped, ["c"]);
    assert.equal(child.nodes[0]!.parentId, undefined, "un hijo copiado sin su grupo pasa a posición absoluta");
    assert.deepEqual(child.nodes[0]!.position, { x: 600, y: 0 });
    const dup = duplicate(grouped, ["grp"]);
    const newGroup = dup.ids[0]!;
    assert.equal(dup.graph.nodes.filter((n) => n.parentId === newGroup).length, 2, "el grupo duplicado lleva sus hijos");
  });
});

describe("historial", () => {
  test("deshacer n veces devuelve los estados en orden inverso y rehacer los recupera", () => {
    fc.assert(
      fc.property(fc.array(fc.integer(), { minLength: 1, maxLength: 30 }), fc.integer({ min: 0, max: 40 }), (values, k) => {
        const stack = createUndoStack<number>({ limit: 100, merge: 0 });
        let state = 0;
        const states = [state];
        for (const v of values) {
          stack.record(state);
          state = v;
          states.push(state);
        }
        const n = Math.min(k, values.length);
        for (let i = 0; i < n; i++) state = stack.undo(state)!;
        if (state !== states[states.length - 1 - n]) return false;
        for (let i = 0; i < n; i++) state = stack.redo(state)!;
        return state === states[states.length - 1] && stack.redo(state) === null;
      }),
    );
  });
  test("límite, fusión por clave y un cambio nuevo vacía lo rehacible", () => {
    let t = 0;
    const stack = createUndoStack<string>({ limit: 3, merge: 500, now: () => t });
    for (const s of ["a", "b", "c", "d", "e"]) stack.record(s);
    assert.equal(stack.size, 3);
    stack.clear();
    stack.record("s0", "move");
    t = 100;
    stack.record("s1", "move");
    assert.equal(stack.size, 1, "dos movimientos seguidos son un paso");
    t = 1000;
    stack.record("s2", "move");
    assert.equal(stack.size, 2, "fuera de la ventana, otro paso");
    stack.seal();
    stack.record("s3", "move");
    assert.equal(stack.size, 3, "tras sellar, otro paso");
    assert.equal(stack.undo("now"), "s3");
    assert.ok(stack.canRedo);
    stack.record("x");
    assert.ok(!stack.canRedo);
    assert.ok(stack.canUndo);
    assert.equal(createUndoStack().undo(1), null);
  });
});

describe("disposición por capas", () => {
  const sizes = new Map<string, { width: number; height: number }>();
  test("las aristas van hacia delante, sin solapes en la capa, y es determinista", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 14 }), fc.array(fc.tuple(fc.nat(13), fc.nat(13)), { maxLength: 30 }), (n, pairs) => {
        const ids = Array.from({ length: n }, (_, i) => `n${i}`);
        const edges = pairs.filter(([a, b]) => a < n && b < n).map(([a, b], i) => ({ id: `e${i}`, source: `n${a}`, target: `n${b}` }));
        const r = layeredLayout(ids, edges, sizes, { nodeGap: 10, layerGap: 50 });
        const back = feedbackEdges(ids, edges);
        for (const e of edges) {
          if (e.source === e.target || back.has(e.id)) continue;
          if (r.layers.get(e.source)! >= r.layers.get(e.target)!) return false;
        }
        for (const row of r.order)
          for (let i = 1; i < row.length; i++)
            if (r.positions.get(row[i]!)!.y < r.positions.get(row[i - 1]!)!.y + 76 + 10 - 1e-6) return false;
        const again = layeredLayout(ids, edges, sizes, { nodeGap: 10, layerGap: 50 });
        return (
          [...r.positions].every(([id, p]) => again.positions.get(id)!.x === p.x && again.positions.get(id)!.y === p.y) &&
          r.positions.size === n
        );
      }),
    );
  });
  test("el baricentro deshace un cruce evidente y TB pone las capas en filas", () => {
    const ids = ["a", "b", "c", "d"];
    const edges = [
      { id: "1", source: "a", target: "d" },
      { id: "2", source: "b", target: "c" },
    ];
    const r = layeredLayout(ids, edges, sizes);
    assert.equal(crossings(r.order, edges), 0);
    const tb = layeredLayout(["a", "b"], [{ id: "1", source: "a", target: "b" }], sizes, { direction: "TB", origin: { x: 5, y: 5 } });
    assert.ok(tb.positions.get("b")!.y > tb.positions.get("a")!.y);
    assert.equal(tb.positions.get("a")!.y, 5);
    assert.equal(
      crossings(
        [
          ["a", "b"],
          ["c", "d"],
        ],
        [
          { id: "1", source: "a", target: "d" },
          { id: "2", source: "b", target: "c" },
        ],
      ),
      1,
    );
    assert.deepEqual(layeredLayout([], [], sizes).order, []);
    assert.equal(
      feedbackEdges(
        ["a", "b"],
        [
          { id: "x", source: "a", target: "b" },
          { id: "y", source: "b", target: "a" },
        ],
      ).size,
      1,
    );
  });
});

describe("minimapa y caja de selección", () => {
  test("proyectar y deshacer la proyección son inversas", () => {
    fc.assert(
      fc.property(point, (p) => {
        const proj = minimapProjection(
          { x: -100, y: -50, width: 800, height: 400 },
          { x: 0, y: 0, width: 300, height: 200 },
          { width: 200, height: 140 },
        );
        const m = projectRect(proj, { ...p, width: 0, height: 0 });
        const back = unprojectPoint(proj, m);
        return close(back.x, p.x, 1e-9) && close(back.y, p.y, 1e-9);
      }),
    );
    const vp = { x: 0, y: 0, zoom: 1 };
    const size = { width: 400, height: 300 };
    const proj = minimapProjection(null, visibleRect(vp, size), { width: 200, height: 150 });
    const view = minimapView(proj, vp, size);
    assert.ok(view.x >= 0 && view.x + view.width <= 200 + 1e-9);
    const moved = viewportFromMinimap(proj, { x: 100, y: 75 }, vp, size);
    assert.ok(close(toWorld(moved, { x: 200, y: 150 }).x, unprojectPoint(proj, { x: 100, y: 75 }).x));
  });
  test("caja de selección por corte o por contención", () => {
    const rects = new Map([
      ["a", { x: 0, y: 0, width: 10, height: 10 }],
      ["b", { x: 20, y: 0, width: 10, height: 10 }],
    ]);
    assert.deepEqual(boxSelection(rects, { x: 5, y: 5, width: 20, height: 2 }), ["a", "b"]);
    assert.deepEqual(boxSelection(rects, { x: -1, y: -1, width: 15, height: 15 }, "contain"), ["a"]);
  });
});

describe("marcado", () => {
  test("nodo, grupo, puertos, controles, minimapa y lista", () => {
    const g = sample();
    const html = toHTML(nodeTree(g.nodes[1]!, 300, 0));
    assert.match(html, /class="z-node" data-id="b"/);
    assert.match(html, /aria-roledescription="node"/);
    assert.match(html, /data-port="yes" data-kind="source" data-side="right"/);
    assert.match(html, /--z-node-x: 300px/);
    const running = toHTML(nodeTree(g.nodes[0]!, 0, 0));
    assert.match(running, /data-status="running"/);
    assert.match(running, /z-node__status/);
    const grp = toHTML(
      nodeTree({ id: "g", type: "group", position: { x: 0, y: 0 }, size: { width: 10, height: 10 }, data: { label: "<G>" } }, 0, 0),
    );
    assert.match(grp, /class="z-node-group"/);
    assert.match(grp, /&lt;G&gt;/);
    assert.equal(portLabel({ id: "x", kind: "target" }), "Input x");
    assert.equal(portLabel({ id: "x", kind: "source", label: "OK" }, mergeNodeLabels({ output: "Salida {name}" })), "Salida OK");
    const ctl = toHTML(controlsTree());
    assert.match(ctl, /role="toolbar"/);
    assert.match(ctl, /data-node-action="undo"[^>]*aria-disabled="true"|aria-disabled="true"[^>]*data-node-action="undo"/);
    assert.doesNotMatch(ctl, /layout/);
    assert.match(
      toHTML(controlsTree(undefined, { showLayout: true, showHistory: false, showZoom: false, showFit: false, showLock: false })),
      /data-node-action="layout"/,
    );
    assert.match(toHTML(minimapTree()), /<nav class="z-node-minimap z-liquid"/);
    const list = toHTML(listViewTree(g));
    assert.match(list, /data-node-action="remove-edge" data-edge="e1"/);
    assert.match(list, /<caption class="z-node-list__caption">Nodes<\/caption>/);
    assert.doesNotMatch(toHTML(listViewTree(g, undefined, true)), /remove-edge/);
    assert.match(toHTML(listViewTree({ nodes: [], edges: [] })), /No nodes/);
    assert.equal(mergeNodeLabels().canvas, "Diagram");
    assert.equal(mergeNodeLabels({ status: { running: "en marcha" } as never }).status.error, "error");
  });
});
