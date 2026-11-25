// Gráficos de la 0.5: regresión, burbujas, radar, niveles del mapa de calor, rejilla, tramos y cuenta de números
// (core/chart); los árboles de dispersión, radar, combinado, mapa de calor y bala (core/chart-*), CategoryBar
// (core/category-bar) y AnimatedNumber (core/animated-number). Propiedades con fast-check; la interacción, con happy-dom.
import "./helpers/dom.mjs";
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import fc from "fast-check";
import {
  bubbleRadius,
  decimalsOf,
  divergingLevel,
  easeOutCubic,
  gridStep,
  linearRegression,
  nearestPoint,
  polarPoint,
  radarPath,
  radarWedge,
  scatterStep,
  segmentLayout,
  sequentialLevel,
  sequentialThresholds,
  tweenValue,
} from "../../zui/src/core/chart.ts";
import { type ChartProps, chartWidget } from "../../zui/src/core/chart-widget.ts";
import { scatterModel } from "../../zui/src/core/chart-scatter.ts";
import { heatModel } from "../../zui/src/core/chart-heatmap.ts";
import { bulletRows, rangeIndex } from "../../zui/src/core/chart-bullet.ts";
import { categoryBarWidget } from "../../zui/src/core/category-bar.ts";
import {
  animatedNumberConfig,
  animatedNumberTree,
  animatedNumberWidget,
  countDecimals,
  stopAnimatedNumber,
  syncAnimatedNumber,
} from "../../zui/src/core/animated-number.ts";
import { toHTML } from "../../zui/src/core/vnode.ts";
import type { Widget, WidgetHost } from "../../zui/src/core/widget.ts";

const html = (props: ChartProps, state?: Partial<ReturnType<typeof chartWidget.initial>>) => {
  const config = chartWidget.configure(props);
  return toHTML(chartWidget.tree(config, { ...chartWidget.initial(config), ...state }, "c"));
};
const labelsOf = (s: string) => [...s.matchAll(/aria-label="([^"]*)"/g)].map((m) => m[1]!);

/** Monta una pieza en happy-dom con un anfitrión mínimo (el de React y el del modo DOM hacen lo mismo). */
function mountWidget<P, C, S>(widget: Widget<P, C, S>, props: P) {
  const root = document.createElement("div");
  document.body.replaceChildren(root);
  const config = widget.configure(props);
  let state = widget.initial(config);
  const events: Array<[string, unknown]> = [];
  const paint = () => {
    root.innerHTML = toHTML(widget.tree(config, state, "w"));
  };
  const host: WidgetHost<C, S> = {
    config: () => config,
    state: () => state,
    update(patch, focus) {
      state = { ...state, ...patch };
      paint();
      widget.after?.(root, host, Boolean(focus));
    },
    emit: (name, detail) => events.push([name, detail]),
  };
  paint();
  const detach = widget.attach(root, host);
  return { root, host, events, detach, state: () => state };
}
const key = (el: Element, k: string, extra: Record<string, unknown> = {}) =>
  el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, ...extra }));

describe("matemática de los gráficos nuevos", () => {
  test("regresión lineal: recta exacta, R² y casos sin recta", () => {
    const fit = linearRegression([
      [0, 1],
      [1, 3],
      [2, 5],
    ])!;
    assert.equal(fit.slope, 2);
    assert.equal(fit.intercept, 1);
    assert.equal(fit.r2, 1);
    assert.equal(linearRegression([[1, 2]]), null, "un punto");
    assert.equal(
      linearRegression([
        [3, 1],
        [3, 4],
      ]),
      null,
      "x constante",
    );
    const flat = linearRegression([
      [0, 2],
      [5, 2],
    ])!;
    assert.equal(flat.slope, 0);
    assert.equal(flat.r2, 1);
    assert.ok(
      linearRegression([
        [Number.NaN, 1],
        [0, 0],
        [1, 1],
      ]),
      "ignora los no finitos",
    );
  });
  test("propiedad: la recta pasa por el centroide y R² está en [0, 1]", () => {
    fc.assert(
      fc.property(
        fc.array(fc.tuple(fc.integer({ min: -1000, max: 1000 }), fc.integer({ min: -1000, max: 1000 })), { minLength: 2, maxLength: 40 }),
        (pts) => {
          const fit = linearRegression(pts);
          if (!fit) return assert.ok(new Set(pts.map((p) => p[0])).size === 1);
          const mx = pts.reduce((a, p) => a + p[0], 0) / pts.length;
          const my = pts.reduce((a, p) => a + p[1], 0) / pts.length;
          assert.ok(Math.abs(fit.slope * mx + fit.intercept - my) < 1e-6 * Math.max(1, Math.abs(my)));
          assert.ok(fit.r2 >= 0 && fit.r2 <= 1);
        },
      ),
    );
  });
  test("burbuja: área proporcional y radio mínimo", () => {
    assert.equal(bubbleRadius(100, 100, 4, 24), 24);
    assert.equal(bubbleRadius(25, 100, 4, 24), 12, "un cuarto del valor, la mitad del radio");
    assert.equal(bubbleRadius(0, 100), 4);
    assert.equal(bubbleRadius(-5, 100), 4);
    assert.equal(bubbleRadius(5, 0), 4);
  });
  test("punto más cercano con proporción del área", () => {
    const pts: Array<[number, number]> = [
      [0, 0],
      [10, 0],
      [Number.NaN, 0],
    ];
    assert.equal(nearestPoint(pts, [6, 0]), 1);
    assert.equal(nearestPoint(pts, [6, 0], 0.1), 1);
    assert.equal(nearestPoint([], [0, 0]), -1);
  });
  test("teclado de la dispersión: por la serie y entre series al x más cercano", () => {
    const groups = [[0, 1, 2], [], [3, 4]];
    const xs = [1, 5, 9, 4.5, 10];
    assert.equal(scatterStep(groups, xs, 0, "next"), 1);
    assert.equal(scatterStep(groups, xs, 2, "next"), 2, "no pasa del último");
    assert.equal(scatterStep(groups, xs, 0, "prev"), 0);
    assert.equal(scatterStep(groups, xs, 1, "down"), 3, "salta la serie vacía, x más cercana");
    assert.equal(scatterStep(groups, xs, 4, "up"), 2);
    assert.equal(scatterStep(groups, xs, 3, "down"), 3, "sin serie siguiente, se queda");
    assert.equal(scatterStep(groups, xs, 1, "first"), 0);
    assert.equal(scatterStep(groups, xs, 3, "last"), 4);
    assert.equal(scatterStep(groups, xs, 99, "next"), 0, "índice perdido: primero");
  });
  test("radar: puntos polares, polígono y cuña", () => {
    assert.deepEqual(polarPoint(0, 4, 1, 40), [50, 10]);
    assert.deepEqual(polarPoint(1, 4, 1, 40), [90, 50]);
    assert.deepEqual(polarPoint(2, 4, 0.5, 40), [50, 70]);
    assert.match(radarPath([1, null, 1, 0]), /^M50 10L50 50L50 90L50 50Z$/);
    assert.equal(radarPath([]), "");
    assert.match(radarWedge(0, 4), /^M/);
    assert.match(radarWedge(0, 1), /A/, "un solo eje: el círculo entero");
  });
  test("niveles secuenciales y divergentes", () => {
    assert.equal(sequentialLevel(0, 0, 10), 0);
    assert.equal(sequentialLevel(10, 0, 10), 4);
    assert.equal(sequentialLevel(5, 0, 10), 2);
    assert.equal(sequentialLevel(5, 5, 5), 0);
    assert.equal(sequentialLevel(6, 5, 5), 4);
    assert.equal(sequentialLevel(Number.NaN, 0, 1), 0);
    assert.deepEqual(sequentialThresholds(0, 10, 5), [0, 2, 4, 6, 8]);
    assert.equal(divergingLevel(0, -10, 0, 10), 0);
    assert.equal(divergingLevel(10, -10, 0, 10), 4);
    assert.equal(divergingLevel(0.1, -10, 0, 10), 1);
    assert.equal(divergingLevel(-10, -10, 0, 10), -4);
    assert.equal(divergingLevel(-3, -10, 0, 10), -2);
    assert.equal(divergingLevel(5, 0, 0, 0), 4, "sin tramo positivo: el extremo");
    assert.equal(divergingLevel(-5, 0, 0, 0), -4);
  });
  test("propiedad: los niveles son monótonos y caen dentro de la escala", () => {
    fc.assert(
      fc.property(fc.double({ min: -1e4, max: 1e4, noNaN: true }), fc.double({ min: -1e4, max: 1e4, noNaN: true }), (a, b) => {
        const [lo, hi] = a < b ? [a, b] : [b, a];
        const s1 = sequentialLevel(a, lo, hi);
        const s2 = sequentialLevel(b, lo, hi);
        assert.ok(s1 >= 0 && s1 <= 4 && s2 >= 0 && s2 <= 4);
        assert.ok(a <= b ? s1 <= s2 : s1 >= s2);
        const d1 = divergingLevel(a, -1e4, 0, 1e4);
        const d2 = divergingLevel(b, -1e4, 0, 1e4);
        assert.ok(Math.abs(d1) <= 4 && Math.sign(d1) === Math.sign(a));
        assert.ok(a <= b ? d1 <= d2 : d1 >= d2);
      }),
    );
  });
  test("rejilla: las teclas de APG sin salirse", () => {
    assert.equal(gridStep(0, 3, 4, "right"), 1);
    assert.equal(gridStep(3, 3, 4, "right"), 3);
    assert.equal(gridStep(0, 3, 4, "left"), 0);
    assert.equal(gridStep(1, 3, 4, "down"), 5);
    assert.equal(gridStep(1, 3, 4, "up"), 1);
    assert.equal(gridStep(6, 3, 4, "rowStart"), 4);
    assert.equal(gridStep(4, 3, 4, "rowEnd"), 7);
    assert.equal(gridStep(6, 3, 4, "first"), 0);
    assert.equal(gridStep(0, 3, 4, "last"), 11);
    assert.equal(gridStep(1, 3, 4, "pageDown"), 9);
    assert.equal(gridStep(9, 3, 4, "pageUp"), 1);
    assert.equal(gridStep(3, 0, 0, "right"), 0);
  });
  test("propiedad: la rejilla siempre devuelve una celda válida", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 30 }),
        fc.integer({ min: 1, max: 30 }),
        fc.nat(),
        fc.constantFrom("right", "left", "down", "up", "rowStart", "rowEnd", "first", "last", "pageDown", "pageUp" as const),
        (rows, cols, at, k) => {
          const next = gridStep(at % (rows * cols), rows, cols, k);
          assert.ok(Number.isInteger(next) && next >= 0 && next < rows * cols);
        },
      ),
    );
  });
  test("tramos: proporcionales, contiguos y sin negativos", () => {
    const { segments, total } = segmentLayout([40, 30, -5, 30]);
    assert.equal(total, 100);
    assert.deepEqual(
      segments.map((s) => [s.start, s.end]),
      [
        [0, 0.4],
        [0.4, 0.7],
        [0.7, 0.7],
        [0.7, 1],
      ],
    );
    assert.equal(segmentLayout([]).total, 0);
    assert.equal(segmentLayout([0, 0]).segments[1]!.end, 0);
  });
  test("cuenta de números: curva, decimales y llegada exacta", () => {
    assert.equal(easeOutCubic(0), 0);
    assert.equal(easeOutCubic(1), 1);
    assert.equal(easeOutCubic(2), 1);
    assert.equal(decimalsOf(3), 0);
    assert.equal(decimalsOf(12.25), 2);
    assert.equal(decimalsOf(1e-7), 7);
    assert.equal(decimalsOf(1.5e-7), 8);
    assert.equal(decimalsOf(Number.NaN), 0);
    assert.equal(tweenValue(0, 100, 1, 0), 100);
    assert.equal(tweenValue(0, 100, 0, 0), 0);
    assert.ok(Number.isInteger(tweenValue(0, 1000, 0.37, 0)));
    assert.equal(tweenValue(Number.NaN, 5, 0.5, 0), 5);
  });
  test("propiedad: la cuenta no se sale del tramo y acaba en el destino", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -1e6, max: 1e6 }),
        fc.integer({ min: -1e6, max: 1e6 }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        (a, b, t) => {
          const v = tweenValue(a, b, t, 0);
          assert.ok(v >= Math.min(a, b) && v <= Math.max(a, b));
          assert.equal(tweenValue(a, b, 1, 0), b);
        },
      ),
    );
  });
});

describe("ScatterChart", () => {
  const data = [
    { name: "A", x: 1, y: 2, s: 10, g: "one" },
    { name: "B", x: 3, y: 6, s: 40, g: "one" },
    { name: "C", x: 2, y: 4, s: 0, g: "one" },
    { name: "D", x: 5, y: 1, s: 90, g: "two" },
    { name: "E", x: "bad", y: 3, g: "two" },
  ];
  const props: ChartProps = {
    type: "scatter",
    data,
    xKey: "x",
    yKey: "y",
    sizeKey: "s",
    seriesKey: "g",
    labelKey: "name",
    xLabel: "Width",
    yLabel: "Height",
    sizeLabel: "Weight",
    series: [{ key: "two", label: "Two", color: 5 }],
    trend: true,
    locale: "en-US",
  };
  test("modelo: series de seriesKey, orden por x, puntos no finitos fuera y tendencia por serie", () => {
    const m = scatterModel(chartWidget.configure(props), []);
    assert.deepEqual(
      m.series.map((s) => [s.key, s.label, s.color]),
      [
        ["one", "one", 1],
        ["two", "Two", 5],
      ],
    );
    assert.deepEqual(
      m.points.map((p) => p.label),
      ["A", "C", "B", "D"],
    );
    assert.deepEqual(m.groups, [[0, 1, 2], [3]]);
    assert.equal(m.trends.length, 1, "una serie de un punto no tiene recta");
    assert.equal(m.sizeMax, 90);
    assert.equal(scatterModel(chartWidget.configure(props), ["one"]).points.length, 1, "serie oculta");
  });
  test("árbol: puntos enfocables con nombre completo, burbujas, tendencia y tabla", () => {
    const out = html(props, { active: 1, tip: true });
    assert.equal((out.match(/class="z-chart__point"/g) ?? []).length, 4);
    assert.ok(labelsOf(out).includes("C (one): Width 2, Height 4, Weight 0"));
    assert.match(out, /data-bubble/);
    assert.match(out, /class="z-chart__trend"/);
    assert.match(out, /class="z-chart__tip"/);
    assert.equal((out.match(/tabindex="0"/g) ?? []).length, 1, "una sola parada de Tab");
    const table = html(props, { view: "table" });
    assert.equal((table.match(/<tr/g) ?? []).length, 5);
    assert.match(html({ ...props, data: [] }), /No data/);
    const single = html({ type: "scatter", data: [{ x: 1, y: 2 }], locale: "en-US" });
    assert.ok(labelsOf(single).includes("x 1, y 2"), labelsOf(single).join(" | "));
    assert.match(html(props), /slope 2, R² 1/);
  });
});

describe("RadarChart y ComboChart", () => {
  const radar: ChartProps = {
    type: "radar",
    data: [
      { k: "Speed", a: 80, b: 40 },
      { k: "Range", a: 60, b: null },
      { k: "Price", a: 20, b: 90 },
    ],
    xKey: "k",
    series: [
      { key: "a", label: "A" },
      { key: "b", label: "B" },
    ],
    yMax: 100,
    yTicks: 4,
    locale: "en-US",
  };
  test("radar: cuñas enfocables, polígonos, anillos y rótulos", () => {
    const out = html(radar, { active: 0, tip: true });
    assert.ok(labelsOf(out).includes("Range: A 60, B no data"));
    assert.equal((out.match(/class="z-chart__radar"/g) ?? []).length, 2);
    assert.match(out, /Scale 0 to 100, rings every 25/);
    assert.equal((out.match(/class="z-chart__radar-label"/g) ?? []).length, 3);
    assert.match(out, /class="z-chart__tip"/);
    assert.match(html({ ...radar, gridShape: "circle", markers: true }), /a40 40/);
    assert.match(html({ ...radar, data: [] }), /No data/);
    assert.match(html(radar), /A: from 20 to 80/);
    assert.equal((html(radar, { view: "table" }).match(/<tr/g) ?? []).length, 4);
  });
  const combo: ChartProps = {
    type: "combo",
    data: [
      { m: "Jan", r: 100, p: 0.2 },
      { m: "Feb", r: 120, p: 0.25 },
    ],
    xKey: "m",
    series: [
      { key: "r", label: "Revenue" },
      { key: "p", label: "Margin", type: "line", axis: "end" },
    ],
    y2Format: { style: "percent" },
    locale: "en-US",
  };
  test("combinado: barras, línea por encima, eje secundario y formatos por eje", () => {
    const out = html(combo, { active: 1, tip: true });
    assert.equal((out.match(/class="z-chart__bar"/g) ?? []).length, 2);
    assert.match(out, /<svg[^>]*><g class="z-chart__marks"><path class="z-chart__line"/);
    assert.match(out, /data-side="end"/);
    assert.ok(labelsOf(out).includes("Feb: Revenue 120, Margin 25%"));
    assert.match(out, /data-mark="line"/);
    assert.doesNotMatch(html(combo, { hidden: ["p"] }), /data-side="end"/, "sin series en el eje secundario, no hay eje");
    const stacked = html({ ...combo, stacked: true, series: [...combo.series!, { key: "r", label: "Again" }] }, { active: 0, tip: true });
    assert.match(stacked, /Total/);
  });
});

describe("HeatmapChart", () => {
  const data = [
    { d: "Mon", h: "09", v: 1 },
    { d: "Mon", h: "10", v: 9 },
    { d: "Tue", h: "09", v: 5 },
  ];
  const props: ChartProps = {
    type: "heatmap",
    data,
    xKey: "h",
    yKey: "d",
    valueKey: "v",
    locale: "en-US",
    series: [{ key: "v", label: "Tickets" }],
  };
  test("modelo: filas y columnas por orden de aparición, huecos y escala divergente simétrica", () => {
    const m = heatModel(chartWidget.configure(props));
    assert.deepEqual(m.rows, ["Mon", "Tue"]);
    assert.deepEqual(m.cols, ["09", "10"]);
    assert.deepEqual(m.values, [1, 9, 5, null]);
    assert.deepEqual(m.source, [0, 1, 2, -1]);
    const d = heatModel(chartWidget.configure({ ...props, scale: "diverging", midpoint: 4 }));
    assert.equal(d.lo, -1);
    assert.equal(d.hi, 9);
    const fixed = heatModel(chartWidget.configure({ ...props, domain: [10, 0] }));
    assert.deepEqual([fixed.lo, fixed.hi], [0, 10]);
  });
  test("árbol: role=grid con cabeceras, celdas con nombre, hueco y leyenda de escala", () => {
    const out = html(props, { active: 1, tip: true });
    assert.match(out, /role="grid"/);
    assert.equal((out.match(/role="columnheader"/g) ?? []).length, 3);
    assert.equal((out.match(/role="rowheader"/g) ?? []).length, 2);
    assert.equal((out.match(/role="gridcell"/g) ?? []).length, 4);
    assert.ok(labelsOf(out).includes("Mon, 10: 9"));
    assert.ok(labelsOf(out).includes("Tue, 10: no data"));
    assert.match(out, /data-empty/);
    assert.match(out, /data-mark="empty"/);
    assert.match(out, /class="z-chart__tip"/);
    assert.match(out, /Tickets: from 1 \(Mon, 09\) to 9 \(Mon, 10\)/);
    const div = html({ ...props, scale: "diverging", showValues: true });
    assert.equal((div.match(/data-mark="level"/g) ?? []).length, 9);
    assert.match(div, /data-show-values/);
    assert.match(html({ ...props, data: [] }), /No data/);
    assert.equal((html(props, { view: "table" }).match(/<tr/g) ?? []).length, 3);
  });
});

describe("BulletChart", () => {
  const props: ChartProps = {
    type: "bullet",
    data: [
      { label: "North", value: 82, target: 85 },
      { label: "South", value: 64, target: 75, ranges: [40, 70, 100] },
      { label: "West", value: null },
    ],
    ranges: [50, 75, 100],
    rangeLabels: ["Poor", "Fair", "Good"],
    locale: "en-US",
  };
  test("filas: rangos propios o comunes y rango de cada valor", () => {
    const rows = bulletRows(chartWidget.configure(props));
    assert.deepEqual(rows[1]!.ranges, [40, 70, 100]);
    assert.deepEqual(rows[0]!.ranges, [50, 75, 100]);
    assert.equal(rangeIndex(64, [50, 75, 100]), 1);
    assert.equal(rangeIndex(120, [50, 75, 100]), 2);
    assert.equal(rangeIndex(5, []), -1);
  });
  test("árbol: horizontal por defecto, nombre con objetivo y rango, leyenda y tabla", () => {
    const out = html(props, { active: 0, tip: true });
    assert.match(out, /data-orientation="horizontal"/);
    assert.deepEqual(labelsOf(out).slice(-3), ["North: 82, target 85, in Good", "South: 64, target 75, in Fair", "West: no data"]);
    assert.equal((out.match(/class="z-chart__range"/g) ?? []).length, 9);
    assert.match(out, /data-mark="target"/);
    assert.match(out, /data-axis="bullet-h"/);
    assert.match(html({ ...props, orientation: "vertical" }, { active: 0, tip: true }), /data-axis="bullet-v"/);
    assert.equal((html(props, { view: "table" }).match(/<th scope="col">/g) ?? []).length, 4);
    assert.match(html({ ...props, data: [] }), /No data/);
  });
});

describe("interacción de los gráficos nuevos (happy-dom)", () => {
  test("mapa de calor: flechas, Inicio/Fin, Ctrl+Fin, Intro y Escape", () => {
    const w = mountWidget(chartWidget, {
      type: "heatmap",
      data: [
        { d: "A", h: "1", value: 1 },
        { d: "A", h: "2", value: 2 },
        { d: "B", h: "1", value: 3 },
        { d: "B", h: "2", value: 4 },
      ],
      xKey: "h",
      yKey: "d",
    });
    const cell = () => w.root.querySelector<HTMLElement>('[data-index][tabindex="0"]')!;
    key(cell(), "ArrowRight");
    assert.equal(w.state().active, 1);
    key(cell(), "ArrowDown");
    assert.equal(w.state().active, 3);
    key(cell(), "Home");
    assert.equal(w.state().active, 2);
    key(cell(), "End", { ctrlKey: true });
    assert.equal(w.state().active, 3);
    key(cell(), "Enter");
    assert.deepEqual(w.events.at(-1), ["point-click", { index: 3, datum: { d: "B", h: "2", value: 4 } }]);
    key(cell(), "Escape");
    assert.equal(w.state().tip, false);
    w.detach();
  });
  test("dispersión: ←→ por la serie, ↓ a la otra serie e Intro con la fila", () => {
    const w = mountWidget(chartWidget, {
      type: "scatter",
      data: [
        { x: 1, y: 1, g: "a" },
        { x: 2, y: 2, g: "a" },
        { x: 2, y: 5, g: "b" },
      ],
      xKey: "x",
      yKey: "y",
      seriesKey: "g",
    });
    const pt = () => w.root.querySelector<HTMLElement>('[data-index][tabindex="0"]')!;
    key(pt(), "ArrowRight");
    assert.equal(w.state().active, 1);
    key(pt(), "ArrowDown");
    assert.equal(w.state().active, 2);
    key(pt(), "Enter");
    assert.deepEqual(w.events.at(-1), ["point-click", { index: 2, datum: { x: 2, y: 5, g: "b" } }]);
    w.detach();
  });
  test("CategoryBar: flechas entre tramos, foco, Escape y RTL", () => {
    const w = mountWidget(categoryBarWidget, { values: [1, 0, 2, 3], categories: ["A", "B", "C", "D"], locale: "en-US" });
    const seg = () => w.root.querySelector<HTMLElement>('[data-index][tabindex="0"]')!;
    assert.equal(w.root.querySelectorAll(".z-category-bar__segment").length, 3, "el tramo vacío no se pinta");
    key(seg(), "ArrowRight");
    assert.equal(w.state().active, 2, "salta el vacío");
    key(seg(), "End");
    assert.equal(w.state().active, 3);
    key(seg(), "Home");
    assert.equal(w.state().active, 0);
    key(seg(), "Escape");
    assert.equal(w.state().tip, false);
    seg().dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    assert.equal(w.state().tip, true);
    w.root.setAttribute("dir", "rtl");
    key(seg(), "ArrowLeft");
    assert.equal(w.state().active, 2, "en RTL ← avanza");
    w.detach();
  });
  test("CategoryBar: árbol, marcador, rótulos que ceden y modo DOM", () => {
    const config = categoryBarWidget.configure({
      values: [40, 30, 20, 8, 2],
      categories: ["A", "B", "C", "D"],
      colors: [9],
      marker: { value: 62, label: "Now" },
      showLabels: true,
      legend: true,
      patterns: true,
      label: "Budget",
      locale: "en-US",
    });
    assert.equal(config.colors[0], 1, "color 9 da la vuelta a 1");
    const out = toHTML(categoryBarWidget.tree(config, { active: 0, tip: true }, "b"));
    assert.ok(labelsOf(out).includes("Budget"));
    assert.ok(labelsOf(out).includes("A: 40 (40%)"));
    assert.ok(labelsOf(out).includes("5: 2 (2%)"), "sin nombre, su número");
    assert.match(out, /Marker: Now/);
    assert.match(out, /class="z-category-bar__tip"/);
    const ticks = [...out.matchAll(/class="z-category-bar__tick"[^>]*>([^<]*)</g)].map((m) => m[1]);
    assert.deepEqual(ticks, ["0", "40", "70", "100"], "el final siempre; los pegados ceden");
    assert.match(toHTML(categoryBarWidget.tree(categoryBarWidget.configure({}), { active: null, tip: false }, "e")), /No data/);
    const el = document.createElement("div");
    el.dataset.marker = "5";
    el.dataset.showLabels = "";
    el.dataset.legend = "";
    const p = categoryBarWidget.fromDom(el, { values: [1, 2] });
    assert.deepEqual(p.values, [1, 2]);
    assert.equal(p.marker?.value, 5);
    assert.equal(p.showLabels, true);
    assert.equal(p.legend, true);
  });
  test("modo DOM de los nuevos tipos: atributos y JSON", () => {
    const el = document.createElement("div");
    Object.assign(el.dataset, {
      type: "heatmap",
      yKey: "d",
      valueKey: "v",
      scale: "diverging",
      midpoint: "2",
      showValues: "",
      trend: "",
      gridShape: "circle",
      y2Min: "0",
      orientation: "vertical",
    });
    const p = chartWidget.fromDom(el, { domain: [0, 4], ranges: [1, 2], rangeLabels: ["a", "b"], y2Format: { style: "percent" } });
    assert.equal(p.scale, "diverging");
    assert.equal(p.midpoint, 2);
    assert.equal(p.showValues, true);
    assert.equal(p.gridShape, "circle");
    assert.equal(p.y2Min, 0);
    assert.equal(p.orientation, "vertical");
    assert.deepEqual(p.ranges, [1, 2]);
    const c = chartWidget.configure({ type: "bullet", orientation: "vertical", ranges: [3, Number.NaN, 1] as number[] });
    assert.equal(c.orientation, "vertical");
    assert.deepEqual(c.ranges, [1, 3]);
    assert.equal(chartWidget.configure({ type: "bullet" }).orientation, "horizontal");
  });
});

describe("AnimatedNumber", () => {
  test("árbol: valor final visible (oculto a lectores) y copia para ellos con aria-live opcional", () => {
    const out = toHTML(animatedNumberTree(animatedNumberConfig({ value: 1284.5, locale: "en-US", live: "polite" })));
    assert.equal(
      out,
      '<span class="z-animated-number"><span class="z-animated-number__value" aria-hidden="true">1,284.5</span><span class="z-sr-only" aria-live="polite" aria-atomic="true">1,284.5</span></span>',
    );
    assert.match(toHTML(animatedNumberTree(animatedNumberConfig({ value: null }))), /data-empty.*—/);
    const c = animatedNumberConfig({ value: Number.NaN, duration: 99999, live: "loud" as "polite" });
    assert.equal(c.value, null);
    assert.equal(c.duration, 10000);
    assert.equal(c.live, "off");
    assert.equal(countDecimals(animatedNumberConfig({ format: { maximumFractionDigits: 1 } }), 0, 12.345), 1);
    assert.equal(countDecimals(animatedNumberConfig({ format: { style: "percent" } }), 0, 0.873), 2);
  });
  test("cuenta: del valor anterior al nuevo, sin cuenta con movimiento reducido y parada al desmontar", () => {
    const frames: FrameRequestCallback[] = [];
    window.requestAnimationFrame = ((cb: FrameRequestCallback) => frames.push(cb)) as typeof window.requestAnimationFrame;
    window.cancelAnimationFrame = () => {};
    let reduce = false;
    window.matchMedia = ((q: string) => ({ matches: reduce && q.includes("reduce") })) as unknown as typeof window.matchMedia;
    const root = document.createElement("span");
    const paint = (value: number) => {
      const config = animatedNumberConfig({ value, locale: "en-US", duration: 100 });
      root.innerHTML = toHTML(animatedNumberTree(config));
      syncAnimatedNumber(root, config);
    };
    const text = () => root.querySelector(".z-animated-number__value")!.textContent;
    paint(100);
    assert.equal(text(), "100", "primer pintado sin from: sin cuenta");
    paint(200);
    assert.equal(text(), "100", "arranca desde el anterior");
    assert.ok(root.hasAttribute("data-animating"));
    assert.equal(root.querySelector(".z-sr-only")!.textContent, "200", "la copia accesible ya dice el final");
    frames.shift()!(performance.now() + 50);
    const mid = Number(text()!.replace(/,/g, ""));
    assert.ok(mid > 100 && mid < 200, `intermedio: ${mid}`);
    frames.shift()!(performance.now() + 1000);
    assert.equal(text(), "200");
    assert.ok(!root.hasAttribute("data-animating"));
    reduce = true;
    paint(300);
    assert.equal(text(), "300", "movimiento reducido: sin cuenta");
    stopAnimatedNumber(root);
    reduce = false;
    const fresh = document.createElement("span");
    const config = animatedNumberConfig({ value: 50, from: 0, locale: "en-US" });
    fresh.innerHTML = toHTML(animatedNumberTree(config));
    syncAnimatedNumber(fresh, config);
    assert.equal(fresh.querySelector(".z-animated-number__value")!.textContent, "0", "con from cuenta al montar");
    stopAnimatedNumber(fresh);
  });
  test("modo DOM: atributos y JSON", () => {
    const el = document.createElement("span");
    Object.assign(el.dataset, { value: "12", from: "3", duration: "300", animate: "false", live: "assertive", locale: "en-US" });
    const p = animatedNumberWidget.fromDom(el, { format: { style: "percent" } });
    assert.equal(p.value, 12);
    assert.equal(p.from, 3);
    assert.equal(p.duration, 300);
    assert.equal(p.animate, false);
    assert.equal(p.live, "assertive");
    assert.equal(animatedNumberWidget.fromDom(document.createElement("span"), { value: 7 }).value, 7);
    const root = document.createElement("span");
    const stop = animatedNumberWidget.attach(root, {} as never);
    stop();
  });
});
