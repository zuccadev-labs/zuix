// Dashboard y tableros: variación y ritmo, geometría del Gauge, embudo, Tracker, disposición de DashboardGrid (con
// propiedades: nunca dos piezas se pisan ni se salen de la rejilla), movimientos del kanban, agrupación de la
// actividad, iniciales; y los árboles de las piezas sin estado.
import "./helpers/dom.mjs";
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import fc from "fast-check";
import { dayDiff, dayKey, dayLabel, groupByDay, isoOf, relativeText } from "../../zui/src/core/activity.ts";
import {
  barListTree,
  deltaOf,
  deltaTree,
  deltaWidget,
  funnelTree,
  funnelWidget,
  progressGoalTree,
  progressGoalWidget,
  barListWidget,
} from "../../zui/src/core/dashboard-trees.ts";
import { funnelBottleneck, funnelConversion, funnelStages } from "../../zui/src/core/funnel.ts";
import {
  gaugeFraction,
  gaugeSweep,
  gaugeTree,
  gaugeViewBox,
  gaugeWidget,
  gaugeZones,
  needlePoints,
  parseZones,
  zoneAt,
} from "../../zui/src/core/gauge.ts";
import {
  cellAt,
  clampItem,
  compact,
  describeItem,
  fitColumns,
  keyStep,
  layoutRows,
  moveItem,
  normalizeLayout,
  overlaps,
  parseLayout,
  resizeItem,
  sameLayout,
  serializeLayout,
  sortLayout,
  spanFor,
  type GridItem,
} from "../../zui/src/core/grid-layout.ts";
import { AVATAR_HUES, graphemes, hueOf, initialsOf } from "../../zui/src/core/initials.ts";
import {
  dropIndexAt,
  keyTarget,
  KANBAN_LABELS,
  locateCard,
  moveCard,
  neighborCard,
  placeText,
  type KanbanColumn,
} from "../../zui/src/core/kanban.ts";
import {
  barFractions,
  competitionRanks,
  computeDelta,
  computePace,
  deltaDirection,
  deltaFromRelative,
  deltaMagnitude,
  deltaSentiment,
  deltaSpoken,
  elapsedFraction,
  formatValue,
  shareFractions,
} from "../../zui/src/core/metric.ts";
import { trackerDayText, trackerKey, trackerStatus, trackerSummary, trackerWidget, TRACKER_LABELS } from "../../zui/src/core/tracker.ts";
import { toHTML } from "../../zui/src/core/vnode.ts";

fc.configureGlobal({ seed: Number(process.env.ZUIX_FC_SEED ?? 20261122), numRuns: Number(process.env.ZUIX_FC_RUNS ?? 300) });

describe("metric", () => {
  test("variación absoluta, relativa, dirección y sentido", () => {
    const d = computeDelta(128400, 114200);
    assert.equal(d.abs, 14200);
    assert.ok(Math.abs((d.rel ?? 0) - 0.12434) < 1e-4);
    assert.equal(d.direction, "up");
    assert.equal(d.sentiment, "good");
    assert.equal(computeDelta(90, 100, "down").sentiment, "good");
    assert.equal(computeDelta(110, 100, "down").sentiment, "bad");
    assert.equal(computeDelta(5, 0).rel, null);
    assert.equal(computeDelta(5, 0).direction, "up");
    assert.equal(computeDelta(0, 0).direction, "flat");
    assert.equal(computeDelta(100.01, 100).direction, "flat");
    assert.equal(deltaDirection(Number.NaN), "flat");
    assert.equal(deltaSentiment("flat", "down"), "neutral");
    assert.equal(deltaFromRelative(-0.2, "down").sentiment, "good");
    assert.equal(deltaFromRelative(Number.NaN).rel, null);
  });
  test("magnitud y frase hablada sin depender del color", () => {
    const d = computeDelta(128400, 114200);
    assert.equal(deltaMagnitude(d, "en-US"), "12.4%");
    assert.equal(deltaSpoken(d, "12.4%", "last month"), "up 12.4%, better than last month");
    assert.equal(deltaSpoken(computeDelta(120, 100, "down"), "20%"), "up 20%, worse than the previous period");
    assert.equal(deltaSpoken(computeDelta(1, 1), "0%"), "no change");
    assert.equal(deltaMagnitude(computeDelta(5, 0), "en-US"), "5");
    assert.equal(
      deltaSpoken(deltaFromRelative(0.1), "10%", undefined, { up: "sube {value}", better: ", mejor que {period}", period: "antes" }),
      "sube 10%, mejor que antes",
    );
  });
  test("ritmo hacia la meta", () => {
    assert.deepEqual(computePace(50, 100), { progress: 0.5, expected: null, ratio: null, status: "on-track" });
    assert.equal(computePace(30, 100, 0.5).status, "behind");
    assert.equal(computePace(70, 100, 0.5).status, "ahead");
    assert.equal(computePace(51, 100, 0.5).status, "on-track");
    assert.equal(computePace(120, 100, 0.5).status, "done");
    assert.equal(computePace(10, 100, 0).status, "ahead");
    assert.equal(computePace(0, 100, 0).status, "on-track");
    assert.equal(computePace(5, 5, 0.3, 5).status, "done");
    assert.equal(computePace(150, 200, 0.5, 100).progress, 0.5);
    assert.equal(elapsedFraction(0, 100, 25), 0.25);
    assert.equal(elapsedFraction(0, 100, 500), 1);
    assert.equal(elapsedFraction(10, 10, 9), 0);
    assert.equal(elapsedFraction(10, 10, 11), 1);
  });
  test("barras, proporciones, rangos con empates y formato", () => {
    assert.deepEqual(barFractions([10, 5, -1, Number.NaN]), [1, 0.5, 0, 0]);
    assert.deepEqual(barFractions([10, 5], 20), [0.5, 0.25]);
    assert.deepEqual(barFractions([0, 0]), [0, 0]);
    assert.deepEqual(shareFractions([1, 3]), [0.25, 0.75]);
    assert.deepEqual(shareFractions([0]), [0]);
    assert.deepEqual(competitionRanks([9, 7, 7, 5]), [1, 2, 2, 4]);
    assert.equal(formatValue("$1k"), "$1k");
    assert.equal(formatValue(null), "");
    assert.equal(formatValue(Number.NaN), "");
    assert.equal(formatValue(1234.5, "en-US"), "1,234.5");
    assert.equal(formatValue(0.5, "xx-invalid-@@", { style: "percent" }), formatValue(0.5, undefined, { style: "percent" }));
  });
  test("propiedad: el sentido es bueno exactamente cuando la dirección coincide con lo positivo", () => {
    fc.assert(
      fc.property(
        fc.double({ noNaN: true, min: -1e6, max: 1e6 }),
        fc.double({ noNaN: true, min: -1e6, max: 1e6 }),
        fc.constantFrom("up", "down"),
        (v, p, pos) => {
          const d = computeDelta(v, p, pos as "up" | "down");
          if (d.direction === "flat") return d.sentiment === "neutral";
          return (d.sentiment === "good") === (d.direction === pos);
        },
      ),
    );
  });
});

describe("gauge", () => {
  test("barridos, fracción, zonas y aguja", () => {
    assert.deepEqual(gaugeSweep(180), { start: 270, sweep: 180 });
    assert.deepEqual(gaugeSweep(240), { start: 240, sweep: 240 });
    assert.deepEqual(gaugeSweep(360), { start: 0, sweep: 360 });
    assert.equal(gaugeFraction(50, 0, 100), 0.5);
    assert.equal(gaugeFraction(-5, 0, 100), 0);
    assert.equal(gaugeFraction(5, 10, 10), 0);
    assert.equal(gaugeViewBox(360), "0 0 100 100");
    assert.equal(gaugeViewBox(240), "0 0 100 82");
    const zones = gaugeZones(
      [
        { to: 85, tone: "warning", label: "Warn" },
        { to: 60, tone: "success" },
        { to: -3, tone: "danger" },
      ],
      0,
      100,
    );
    assert.deepEqual(
      zones.map((z) => [z.from, z.to, z.tone]),
      [
        [0, 60, "success"],
        [60, 85, "warning"],
        [85, 100, "neutral"],
      ],
    );
    assert.equal(zoneAt(zones, 60)?.tone, "success");
    assert.equal(zoneAt(zones, 61)?.tone, "warning");
    assert.equal(zoneAt(zones, 1000)?.tone, "neutral");
    assert.equal(zoneAt([], 1), null);
    const { tip, base } = needlePoints(0.5);
    assert.deepEqual(base, { x: 50, y: 50 });
    assert.ok(Math.abs(tip.x - 50) < 1e-6 && tip.y < 50);
    assert.deepEqual(parseZones("60:success:Healthy|85:warning|x:danger|bad"), [
      { to: 60, tone: "success", label: "Healthy" },
      { to: 85, tone: "warning", label: undefined },
    ]);
    assert.deepEqual(parseZones(undefined), []);
  });
  test("árbol: meter con zona en el texto y vuelta desde el marcado", () => {
    const tree = gaugeTree({
      label: "CPU",
      value: 72,
      zones: [
        { to: 60, tone: "success", label: "Healthy" },
        { to: 85, tone: "warning", label: "Warning" },
      ],
      needle: true,
    });
    const html = toHTML(tree);
    assert.match(html, /role="meter"/);
    assert.match(html, /aria-valuetext="72, Warning"/);
    assert.match(html, /class="z-gauge__needle"/);
    assert.match(html, /data-zones="60:success:Healthy\|85:warning:Warning"/);
    const el = document.createElement("div");
    el.innerHTML = html;
    const props = gaugeWidget.fromDom(el.firstElementChild as HTMLElement, {});
    assert.equal(props.value, 72);
    assert.equal(props.needle, true);
    assert.equal(props.zones?.length, 2);
    assert.equal(toHTML(gaugeWidget.tree(gaugeWidget.configure(props), null, "x")), html);
    assert.match(toHTML(gaugeTree({ label: "Disk", value: 0, arc: 360, min: 5, max: 1 })), /aria-valuemax="105"/);
  });
});

describe("funnel y árboles sin estado", () => {
  test("conversiones y cuello de botella", () => {
    const stages = funnelStages([
      { label: "a", value: 100 },
      { label: "b", value: 40 },
      { label: "c", value: 30 },
      { label: "d", value: -5 },
    ]);
    assert.deepEqual(
      stages.map((s) => [s.ofFirst, s.ofPrevious, s.dropped]),
      [
        [1, 1, 0],
        [0.4, 0.4, 60],
        [0.3, 0.75, 10],
        [0, 0, 30],
      ],
    );
    assert.equal(funnelConversion(stages), 0);
    assert.equal(funnelBottleneck(stages)?.label, "d");
    assert.equal(funnelBottleneck(stages.slice(0, 1)), null);
    assert.equal(funnelConversion([]), 0);
    assert.equal(
      funnelStages([
        { label: "x", value: 0 },
        { label: "y", value: 0 },
      ])[1]!.ofPrevious,
      0,
    );
  });
  test("DeltaBadge, ProgressGoal, BarList y FunnelChart se pintan igual desde su marcado", () => {
    const cases = [
      [deltaWidget, deltaTree({ value: 120, previous: 100, period: "last week", locale: "en-US" })],
      [
        progressGoalWidget,
        progressGoalTree({ label: "Q4", value: 30, target: 100, elapsed: 0.5, locale: "en-US", valueFormat: { notation: "compact" } }),
      ],
      [
        barListWidget,
        barListTree({
          label: "Top",
          items: [
            { label: "A", value: 3, href: "/a", icon: "link" },
            { label: "B", value: 9 },
          ],
          sort: "desc",
          locale: "en-US",
        }),
      ],
      [
        funnelWidget,
        funnelTree({
          title: "F",
          description: "d",
          stages: [
            { label: "a", value: 10 },
            { label: "b", value: 4 },
          ],
          locale: "en-US",
        }),
      ],
    ] as const;
    for (const [widget, tree] of cases) {
      const html = toHTML(tree);
      const el = document.createElement("div");
      el.innerHTML = html;
      // biome-ignore lint/suspicious/noExplicitAny: cada pieza tiene sus props.
      const w = widget as any;
      const again = toHTML(w.tree(w.configure(w.fromDom(el.firstElementChild, {})), null, "x"));
      assert.equal(again, html, w.root);
    }
    assert.equal(deltaOf({}), null);
    assert.match(toHTML(deltaTree({})), /no change/);
    const goal = toHTML(progressGoalTree({ label: "G", value: 30, target: 100, elapsed: 0.5, locale: "en-US" }));
    assert.match(goal, /Behind pace/);
    assert.match(goal, /aria-valuetext="30% of goal, Behind pace"/);
    assert.match(toHTML(progressGoalTree({ label: "G", value: 100, target: 100 })), /Goal reached/);
    const bars = toHTML(
      barListTree({
        label: "T",
        items: [
          { label: "A", value: 1 },
          { label: "B", value: 5 },
        ],
        sort: "desc",
      }),
    );
    assert.ok(bars.indexOf(">B<") < bars.indexOf(">A<"), "de mayor a menor");
    assert.match(
      toHTML(
        funnelTree({
          title: "F",
          stages: [
            { label: "a", value: 10 },
            { label: "b", value: 4 },
          ],
          locale: "en-US",
        }),
      ),
      /6 dropped/,
    );
  });
});

describe("tracker", () => {
  const days = [
    { status: "ok" as const, label: "1" },
    { status: "warning" as const, label: "2", note: "12 min" },
    { status: "error" as const, label: "3" },
    { status: "empty" as const, label: "4" },
    { status: "maintenance" as const, label: "5" },
  ];
  test("resumen, estados y teclas", () => {
    const s = trackerSummary(days);
    assert.deepEqual(s.counts, { ok: 1, warning: 1, error: 1, maintenance: 1, empty: 1 });
    assert.equal(s.uptime, 2.5 / 4);
    assert.equal(trackerSummary([]).uptime, null);
    assert.equal(trackerStatus("nope"), "empty");
    assert.equal(trackerDayText(days[1]!, TRACKER_LABELS), "2: Degraded, 12 min");
    assert.equal(trackerKey("ArrowRight", 1, 5), 2);
    assert.equal(trackerKey("ArrowRight", 1, 5, true), 0);
    assert.equal(trackerKey("ArrowLeft", 0, 5), 0);
    assert.equal(trackerKey("End", 0, 5), 4);
    assert.equal(trackerKey("Home", 3, 5), 0);
    assert.equal(trackerKey("PageDown", 0, 5), 4);
    assert.equal(trackerKey("PageUp", 4, 5), 0);
    assert.equal(trackerKey("a", 0, 5), null);
    assert.equal(trackerKey("End", 0, 0), null);
  });
  test("pieza: lista con una parada, etiqueta del día activo y flechas", () => {
    const c = trackerWidget.configure({ label: "API", days, locale: "en-US" });
    const s = trackerWidget.initial(c);
    assert.equal(s.active, 4);
    const html = toHTML(trackerWidget.tree(c, { ...s, shown: 1 }, "t"));
    assert.equal((html.match(/tabindex="0"/g) ?? []).length, 1);
    assert.match(html, /62\.5% uptime/);
    assert.match(html, /class="z-tracker__tip"/);
    const root = document.createElement("div");
    root.innerHTML = toHTML(trackerWidget.tree(c, s, "t"));
    const el = root.firstElementChild as HTMLElement;
    document.body.append(el);
    let state = s;
    const host = { config: () => c, state: () => state, update: (p: Partial<typeof s>) => (state = { ...state, ...p }), emit() {} };
    const off = trackerWidget.attach(el, host);
    const bar = el.querySelectorAll<HTMLElement>(".z-tracker__bar")[2]!;
    bar.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
    assert.equal(state.active, 1);
    bar.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    assert.equal(state.shown, -1);
    bar.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    assert.equal(state.shown, 2);
    bar.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    assert.equal(state.shown, -1);
    off();
    el.remove();
    const fromDom = document.createElement("div");
    fromDom.dataset.days = "ok warning error";
    fromDom.dataset.label = "Jobs";
    assert.deepEqual(
      trackerWidget.fromDom(fromDom, {}).days.map((d) => d.status),
      ["ok", "warning", "error"],
    );
    fromDom.dataset.days = '[{"status":"ok","label":"Mon"}]';
    assert.equal(trackerWidget.fromDom(fromDom, {}).days[0]!.label, "Mon");
    assert.equal(trackerWidget.control!(c, { active: 99, shown: 3 }).active, 4);
  });
});

describe("grid-layout", () => {
  const base: GridItem[] = [
    { id: "a", x: 0, y: 0, w: 6, h: 2 },
    { id: "b", x: 6, y: 0, w: 6, h: 2 },
    { id: "c", x: 0, y: 2, w: 12, h: 1 },
  ];
  const noOverlap = (l: readonly GridItem[]) => l.every((a, i) => l.every((b, j) => i === j || !overlaps(a, b)));
  const inside = (l: readonly GridItem[], cols: number) =>
    l.every((i) => i.x >= 0 && i.y >= 0 && i.w >= 1 && i.h >= 1 && i.x + i.w <= cols);

  test("acotar, ordenar, compactar y serializar", () => {
    assert.deepEqual(clampItem({ id: "x", x: 10, y: -2, w: 20, h: 0 }, 12), { id: "x", x: 0, y: 0, w: 12, h: 1 });
    assert.deepEqual(clampItem({ id: "x", x: 3, y: 1, w: 1, h: 9, minW: 4, maxH: 3 }, 12), {
      id: "x",
      x: 3,
      y: 1,
      w: 4,
      h: 3,
      minW: 4,
      maxH: 3,
    });
    assert.deepEqual(
      sortLayout([
        { id: "z", x: 2, y: 1, w: 1, h: 1 },
        { id: "y", x: 0, y: 1, w: 1, h: 1 },
        { id: "x", x: 5, y: 0, w: 1, h: 1 },
      ]).map((i) => i.id),
      ["x", "y", "z"],
    );
    assert.deepEqual(
      compact([{ id: "a", x: 0, y: 5, w: 2, h: 1 }]).map((i) => i.y),
      [0],
    );
    assert.equal(layoutRows(base), 3);
    const text = serializeLayout(base);
    assert.equal(text, "a:0,0,6,2;b:6,0,6,2;c:0,2,12,1");
    assert.deepEqual(parseLayout(text), base);
    assert.deepEqual(parseLayout("bad;x:1,2,3;:1,1,1,1;y:1,a,1,1"), []);
    assert.deepEqual(parseLayout(null), []);
    assert.deepEqual(
      normalizeLayout([
        { id: "a", x: 0, y: 3, w: 2, h: 1 },
        { id: "a", x: 4, y: 0, w: 2, h: 1 },
      ]).map((i) => [i.id, i.y]),
      [["a", 0]],
    );
    assert.equal(sameLayout(base, [...base].reverse()), true);
    assert.equal(sameLayout(base, base.slice(1)), false);
    assert.equal(sameLayout(base, [{ ...base[0]!, x: 1 }, base[1]!, base[2]!]), false);
  });
  test("mover hacia abajo intercambia con la de debajo; hacia el lado aparta", () => {
    const pair: GridItem[] = [
      { id: "a", x: 0, y: 0, w: 6, h: 2 },
      { id: "b", x: 6, y: 0, w: 6, h: 2 },
      { id: "c", x: 0, y: 2, w: 6, h: 2 },
    ];
    const down = compact(moveItem(pair, "a", 0, 2));
    assert.deepEqual(
      sortLayout(down).map((i) => [i.id, i.y]),
      [
        ["c", 0],
        ["b", 0],
        ["a", 2],
      ].sort((p, q) => (p[1] as number) - (q[1] as number) || (p[0] === "c" ? -1 : 1)),
    );
    // Sin hueco encima (la de debajo ocupa toda la fila), la movida vuelve a subir al compactar.
    assert.equal(compact(moveItem(base, "a", 0, 2)).find((i) => i.id === "a")!.y, 0);
    const right = moveItem(base, "a", 6, 0);
    assert.equal(right.find((i) => i.id === "a")!.x, 6);
    assert.ok(right.find((i) => i.id === "b")!.y >= 2, "b baja");
    assert.ok(noOverlap(right));
    assert.deepEqual(moveItem(base, "zz", 1, 1), base);
    const statics = [{ ...base[0]!, static: true }, base[1]!];
    assert.deepEqual(moveItem(statics, "a", 6, 0), statics);
    const around = moveItem(statics, "b", 0, 0);
    assert.ok(noOverlap(around), "la fijada rodea a la estática");
    assert.equal(around.find((i) => i.id === "b")!.y, 2);
  });
  test("redimensionar, reajustar a menos columnas y paso de teclado", () => {
    const wide = resizeItem(base, "a", 9, 2);
    assert.equal(wide.find((i) => i.id === "a")!.w, 9);
    assert.ok(noOverlap(wide));
    assert.deepEqual(resizeItem(base, "nope", 1, 1), base);
    const narrow = fitColumns(base, 4);
    assert.ok(inside(narrow, 4) && noOverlap(narrow));
    assert.deepEqual(keyStep({ id: "a", x: 1, y: 1, w: 2, h: 2 }, "ArrowRight", false), { type: "move", x: 2, y: 1 });
    assert.deepEqual(keyStep({ id: "a", x: 1, y: 1, w: 2, h: 2 }, "ArrowRight", false, true), { type: "move", x: 0, y: 1 });
    assert.deepEqual(keyStep({ id: "a", x: 1, y: 1, w: 2, h: 2 }, "ArrowDown", true), { type: "resize", w: 2, h: 3 });
    assert.deepEqual(keyStep({ id: "a", x: 1, y: 1, w: 2, h: 2 }, "ArrowLeft", true, true), { type: "resize", w: 3, h: 2 });
    assert.equal(keyStep({ id: "a", x: 1, y: 1, w: 2, h: 2 }, "Enter", false), null);
    assert.deepEqual(cellAt(250, 190, { width: 1200, cols: 12, rowHeight: 80, gap: 16 }, { w: 4 }), { x: 2, y: 2 });
    assert.deepEqual(cellAt(-50, -50, { width: 1200, cols: 12, rowHeight: 80, gap: 16 }, { w: 4 }), { x: 0, y: 0 });
    assert.deepEqual(cellAt(5000, 0, { width: 1200, cols: 12, rowHeight: 80, gap: 16 }, { w: 4 }), { x: 8, y: 0 });
    assert.equal(spanFor(176, 80, 16), 2);
    assert.equal(spanFor(-10, 80, 16), 1);
    assert.equal(describeItem({ id: "a", x: 2, y: 0, w: 4, h: 2 }, "Sales"), "Sales, column 3, row 1, 4 by 2");
  });

  const item = (cols: number) =>
    fc.record({
      x: fc.integer({ min: -3, max: cols + 3 }),
      y: fc.integer({ min: -3, max: 20 }),
      w: fc.integer({ min: 0, max: cols + 2 }),
      h: fc.integer({ min: 0, max: 6 }),
    });
  const layoutArb = (cols: number) =>
    fc.array(item(cols), { minLength: 1, maxLength: 9 }).map((list) => list.map((r, i) => ({ id: `w${i}`, ...r })));
  test("propiedad: compactar, mover y redimensionar dejan piezas dentro y sin pisarse, con los mismos ids", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 0, max: 40 }),
        fc.integer({ min: -2, max: 14 }),
        fc.integer({ min: -2, max: 20 }),
        fc.integer({ min: 0, max: 14 }),
        fc.integer({ min: 0, max: 6 }),
        (cols, seed, x, y, w, h) => {
          const raw = fc.sample(layoutArb(cols), { seed, numRuns: 1 })[0]!;
          const start = normalizeLayout(raw, cols);
          if (!(inside(start, cols) && noOverlap(start))) return false;
          const id = start[seed % start.length]!.id;
          const moved = moveItem(start, id, x, y, cols);
          const resized = resizeItem(start, id, w, h, cols);
          const ok = (l: GridItem[]) =>
            inside(l, cols) && noOverlap(l) && l.length === start.length && l.every((i, k) => i.id === start[k]!.id);
          const target = moved.find((i) => i.id === id)!;
          // La pieza movida queda en la columna pedida (acotada para que quepa).
          const wantX = Math.max(0, Math.min(cols - target.w, x));
          return ok(moved) && ok(resized) && ok(compact(moved, cols)) && target.x === wantX;
        },
      ),
    );
  });
  test("propiedad: reajustar a menos columnas conserva todo sin pisarse", () => {
    fc.assert(
      fc.property(layoutArb(12), fc.integer({ min: 1, max: 12 }), (raw, cols) => {
        const fitted = fitColumns(normalizeLayout(raw, 12), cols);
        return inside(fitted, cols) && noOverlap(fitted) && fitted.length === raw.length;
      }),
    );
  });
});

describe("kanban", () => {
  const cols: KanbanColumn[] = [
    {
      id: "a",
      title: "To do",
      cards: [
        { id: "1", title: "One" },
        { id: "2", title: "Two" },
      ],
    },
    { id: "b", title: "Empty", cards: [] },
    { id: "c", title: "Done", cards: [{ id: "3", title: "Three" }] },
  ];
  test("localizar, mover y destinos de teclado", () => {
    assert.deepEqual(locateCard(cols, "3"), { column: 2, index: 0 });
    assert.equal(locateCard(cols, "x"), null);
    const moved = moveCard(cols, "1", 2, 5);
    assert.deepEqual(
      moved.map((c) => c.cards.map((x) => x.id)),
      [["2"], [], ["3", "1"]],
    );
    assert.deepEqual(
      moveCard(cols, "1", 0, 1)[0]!.cards.map((x) => x.id),
      ["2", "1"],
    );
    assert.deepEqual(moveCard(cols, "nope", 0, 0), cols);
    assert.deepEqual(moveCard(cols, "1", 9, 0), cols);
    assert.deepEqual(keyTarget(cols, "1", "ArrowDown"), { column: 0, index: 1 });
    assert.equal(keyTarget(cols, "2", "ArrowDown"), null);
    assert.equal(keyTarget(cols, "1", "ArrowUp"), null);
    assert.deepEqual(keyTarget(cols, "2", "Home"), { column: 0, index: 0 });
    assert.deepEqual(keyTarget(cols, "1", "End"), { column: 0, index: 1 });
    assert.equal(keyTarget(cols, "2", "End"), null);
    assert.equal(keyTarget(cols, "1", "Home"), null);
    assert.deepEqual(keyTarget(cols, "2", "ArrowRight"), { column: 1, index: 0 });
    assert.deepEqual(keyTarget(cols, "3", "ArrowRight", true), { column: 1, index: 0 });
    assert.equal(keyTarget(cols, "1", "ArrowLeft"), null);
    assert.equal(keyTarget(cols, "1", "x"), null);
    assert.equal(keyTarget(cols, "zz", "ArrowLeft"), null);
    assert.equal(neighborCard(cols, "1", "ArrowRight"), "3");
    assert.equal(neighborCard(cols, "3", "ArrowLeft"), "1");
    assert.equal(neighborCard(cols, "1", "ArrowDown"), "2");
    assert.equal(neighborCard(cols, "2", "ArrowUp"), "1");
    assert.equal(neighborCard(cols, "2", "Home"), "1");
    assert.equal(neighborCard(cols, "1", "End"), "2");
    assert.equal(neighborCard(cols, "3", "ArrowRight"), null);
    assert.equal(neighborCard(cols, "1", "q"), null);
    assert.equal(neighborCard(cols, "zz", "ArrowUp"), null);
    assert.equal(dropIndexAt(5, [10, 20]), 0);
    assert.equal(dropIndexAt(15, [10, 20]), 1);
    assert.equal(dropIndexAt(25, [10, 20]), 2);
    assert.equal(placeText(cols, "2", KANBAN_LABELS.moved), "Two moved to To do, position 2 of 2");
    assert.equal(placeText(cols, "x", KANBAN_LABELS.moved), "");
  });
  test("propiedad: mover conserva todas las tarjetas, una sola vez", () => {
    const board = fc.array(fc.array(fc.constant(0), { maxLength: 5 }), { minLength: 1, maxLength: 5 }).map((lens) => {
      let n = 0;
      return lens.map((l, c) => ({ id: `c${c}`, title: `C${c}`, cards: l.map(() => ({ id: `k${n++}`, title: "t" })) }));
    });
    fc.assert(
      fc.property(board, fc.nat(), fc.nat(), fc.integer({ min: -2, max: 8 }), (b, pick, to, index) => {
        const ids = b.flatMap((c) => c.cards.map((x) => x.id));
        if (!ids.length) return true;
        const id = ids[pick % ids.length]!;
        const col = to % b.length;
        const after = moveCard(b, id, col, index);
        const flat = after.flatMap((c) => c.cards.map((x) => x.id));
        return flat.length === ids.length && new Set(flat).size === ids.length && locateCard(after, id)!.column === col;
      }),
    );
  });
});

describe("actividad e iniciales", () => {
  test("día civil en una zona, etiqueta y agrupación", () => {
    assert.equal(dayKey(Date.parse("2026-11-22T02:00:00Z"), "America/New_York"), "2026-11-21");
    assert.equal(dayDiff("2026-11-20", "2026-11-22"), 2);
    const now = Date.parse("2026-11-22T15:00:00Z");
    assert.equal(dayLabel(Date.parse("2026-11-22T01:00:00Z"), now, "UTC"), "Today");
    assert.equal(dayLabel(Date.parse("2026-11-21T01:00:00Z"), now, "UTC"), "Yesterday");
    assert.match(dayLabel(Date.parse("2026-11-18T01:00:00Z"), now, "UTC", "en-US"), /Wednesday, November 18/);
    assert.match(dayLabel(Date.parse("2026-11-18T01:00:00Z"), now, "UTC", "xx-invalid-@@"), /18/);
    const groups = groupByDay(
      [
        { at: "2026-11-21T10:00:00Z", id: 1 },
        { at: "2026-11-22T10:00:00Z", id: 2 },
        { at: "nope", id: 3 },
        { at: "2026-11-22T12:00:00Z", id: 4 },
      ],
      now,
      "UTC",
    );
    assert.deepEqual(
      groups.map((g) => [g.label, g.items.map((i) => i.id)]),
      [
        ["Today", [4, 2]],
        ["Yesterday", [1]],
        ["", [3]],
      ],
    );
    assert.equal(relativeText("2026-11-22T13:00:00Z", now, "en-US"), "2 hours ago");
    assert.equal(relativeText("nope", now), "");
    assert.equal(isoOf(0), "1970-01-01T00:00:00.000Z");
    assert.equal(isoOf("nope"), undefined);
  });
  test("iniciales sin partir caracteres y tono estable", () => {
    assert.equal(initialsOf("Ana López"), "AL");
    assert.equal(initialsOf("  marco  "), "M");
    assert.equal(initialsOf("Émile Zola", 1), "É");
    assert.equal(initialsOf("李小龙"), "李");
    assert.equal(initialsOf("👩‍💻 Dev"), "👩‍💻D");
    assert.equal(initialsOf("— · —"), "");
    assert.equal(initialsOf(null), "");
    assert.deepEqual(graphemes("éa"), ["é", "a"]);
    assert.equal(hueOf("Ana"), hueOf(" ana "));
    fc.assert(fc.property(fc.string(), (s) => hueOf(s) >= 1 && hueOf(s) <= AVATAR_HUES));
  });
});
