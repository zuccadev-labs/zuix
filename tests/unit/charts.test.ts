// Gráficos: escalas (lineal, temporal y de banda), marcas «bonitas», apilado, sectores y trazados (core/chart); el árbol
// de la pieza (core/chart-widget) y el minigráfico (core/sparkline). Propiedades con fast-check donde las hay.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import fc from "fast-check";
import {
  arcCentroid,
  arcPath,
  areaPath,
  axisNumberOptions,
  bandScale,
  extent,
  hitEdges,
  indexAt,
  linearScale,
  linePath,
  niceStep,
  niceTicks,
  numberFormat,
  pieLayout,
  segments,
  stack,
  timeGrain,
  timePointFormat,
  timeTickFormat,
  timeTicks,
  toTime,
} from "../../zui/src/core/chart.ts";
import { CHART_LABELS, chartWidget, type ChartProps } from "../../zui/src/core/chart-widget.ts";
import { sparklineTree, sparklineWidget } from "../../zui/src/core/sparkline.ts";
import { toHTML, type VEl, type VNode } from "../../zui/src/core/vnode.ts";

const html = (props: ChartProps, state?: Partial<ReturnType<typeof chartWidget.initial>>) => {
  const config = chartWidget.configure(props);
  return toHTML(chartWidget.tree(config, { ...chartWidget.initial(config), ...state }, "c"));
};
const find = (node: VNode, cls: string, out: VEl[] = []): VEl[] => {
  if (!node || typeof node === "string" || "slot" in node) return out;
  if (
    String(node.a?.class ?? "")
      .split(" ")
      .includes(cls)
  )
    out.push(node);
  for (const c of node.c ?? []) find(c, cls, out);
  return out;
};
const tree = (props: ChartProps, state?: Partial<ReturnType<typeof chartWidget.initial>>) => {
  const config = chartWidget.configure(props);
  return chartWidget.tree(config, { ...chartWidget.initial(config), ...state }, "c");
};

describe("escalas y marcas de eje", () => {
  test("extensión de los valores finitos", () => {
    assert.deepEqual(extent([3, null, -2, Number.NaN, 8, undefined]), [-2, 8]);
    assert.equal(extent([null, Number.NaN]), null);
  });
  test("paso bonito 1, 2, 2.5, 5 × 10ⁿ", () => {
    assert.equal(niceStep(100, 5), 20);
    assert.equal(niceStep(1, 4), 0.25);
    assert.equal(niceStep(48000, 5), 10000);
    assert.equal(niceStep(0, 5), 1);
  });
  test("marcas que cubren el dominio, con cero opcional y sin ruido de coma flotante", () => {
    assert.deepEqual(niceTicks(38000, 112000, 5).ticks, [20000, 40000, 60000, 80000, 100000, 120000]);
    assert.deepEqual(niceTicks(0.1, 0.7, 6).ticks, [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7]);
    const z = niceTicks(12, 30, 5, true);
    assert.equal(z.min, 0);
    assert.ok(z.ticks.includes(0));
    assert.deepEqual(niceTicks(5, 5, 4).ticks.length > 1, true, "un único valor se abre");
    assert.deepEqual(niceTicks(0, 0, 4, true), { min: 0, max: 1, step: 0.25, ticks: [0, 0.25, 0.5, 0.75, 1] });
    const neg = niceTicks(-4, 15, 5, true);
    assert.ok(neg.min <= -4 && neg.max >= 15 && neg.ticks.includes(0));
    assert.deepEqual(niceTicks(Number.NaN, Number.NaN).ticks, [0, 0.2, 0.4, 0.6, 0.8, 1]);
  });
  test("propiedad: las marcas cubren [min, max], van en orden y con paso constante", () => {
    fc.assert(
      fc.property(
        fc.double({ min: -1e6, max: 1e6, noNaN: true }),
        fc.double({ min: -1e6, max: 1e6, noNaN: true }),
        fc.integer({ min: 2, max: 10 }),
        (a, b, n) => {
          const t = niceTicks(a, b, n);
          assert.ok(t.min <= Math.min(a, b) + 1e-6 && t.max >= Math.max(a, b) - 1e-6);
          for (let i = 1; i < t.ticks.length; i++) assert.ok(Math.abs(t.ticks[i]! - t.ticks[i - 1]! - t.step) <= t.step * 1e-6);
          assert.ok(t.ticks.length <= n * 3 + 2);
        },
      ),
    );
  });
  test("escala lineal y su inversa", () => {
    const s = linearScale([0, 200], [0, 1]);
    assert.equal(s(50), 0.25);
    assert.equal(s.invert(0.5), 100);
    assert.equal(linearScale([5, 5])(5), 0, "dominio vacío sin división por cero");
  });
  test("escala de banda: bandas dentro de [0, 1], centradas y del mismo ancho", () => {
    const b = bandScale(4, 0.3, 0.15);
    assert.ok(b.start(0) > 0 && b.start(3) + b.bandwidth < 1);
    assert.ok(Math.abs(b.start(3) + b.bandwidth + b.step * 0.15 - 1) < 1e-9);
    assert.equal(b.center(1), b.start(1) + b.bandwidth / 2);
    assert.ok(bandScale(0).bandwidth > 0);
  });
  test("zonas activas por cercanía", () => {
    const edges = hitEdges([0, 0.5, 1]);
    assert.deepEqual(edges, [
      [0, 0.25],
      [0.25, 0.75],
      [0.75, 1],
    ]);
    assert.equal(indexAt(edges, 0.1), 0);
    assert.equal(indexAt(edges, 0.6), 1);
    assert.equal(indexAt(edges, 1), 2);
    assert.equal(indexAt([], 0.5), -1);
  });
});

describe("tiempo", () => {
  const day = 86_400_000;
  test("valores temporales", () => {
    assert.equal(toTime("2026-03-01"), Date.UTC(2026, 2, 1));
    assert.equal(toTime("2026-03"), Date.UTC(2026, 2, 1));
    assert.equal(toTime("2026-03-01T10:00:00Z"), Date.UTC(2026, 2, 1, 10));
    assert.equal(toTime(new Date(5)), 5);
    assert.equal(toTime(7), 7);
    assert.ok(Number.isNaN(toTime("Design")));
    assert.ok(Number.isNaN(toTime(null)));
  });
  test("marcas de calendario: meses, días, semanas en lunes, horas y años", () => {
    const months = timeTicks(Date.UTC(2026, 0, 1), Date.UTC(2026, 11, 1), 6);
    assert.equal(months.unit, "month");
    assert.ok(months.ticks.every((t) => new Date(t).getUTCDate() === 1));
    const days = timeTicks(Date.UTC(2026, 10, 1), Date.UTC(2026, 10, 7), 6);
    assert.equal(days.unit, "day");
    const weeks = timeTicks(Date.UTC(2026, 9, 1), Date.UTC(2026, 10, 30), 10);
    assert.equal(weeks.unit, "week");
    assert.ok(
      weeks.ticks.every((t) => new Date(t).getUTCDay() === 1),
      "semanas que empiezan en lunes",
    );
    const hours = timeTicks(Date.UTC(2026, 0, 1, 0), Date.UTC(2026, 0, 1, 18), 6);
    assert.equal(hours.unit, "hour");
    assert.equal(hours.every, 3);
    const years = timeTicks(Date.UTC(2000, 0, 1), Date.UTC(2026, 0, 1), 6);
    assert.equal(years.unit, "year");
    assert.ok(years.ticks.every((t) => new Date(t).getUTCFullYear() % years.every === 0));
    assert.equal(timeTicks(0, 59_000, 4).unit, "second");
    assert.equal(timeTicks(0, 3_600_000, 4).unit, "minute");
  });
  test("grano y formato por unidad", () => {
    assert.equal(timeGrain([0, day, 2 * day]), "day");
    assert.equal(timeGrain([0, 31 * day, 61 * day]), "month");
    assert.equal(timeGrain([0, 3_600_000]), "hour");
    assert.equal(timeGrain([0, 60_000]), "minute");
    assert.equal(timeGrain([0, 1000]), "second");
    assert.equal(timeGrain([0, 8 * day]), "week");
    assert.equal(timeGrain([0, 400 * day]), "year");
    assert.equal(timeGrain([0]), "day");
    assert.deepEqual(timeTickFormat("month"), { month: "short", year: "2-digit" });
    assert.deepEqual(timeTickFormat("month", 12), { year: "numeric" });
    assert.deepEqual(timeTickFormat("hour"), { hour: "numeric", minute: "2-digit" });
    assert.deepEqual(timeTickFormat("second"), { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    assert.deepEqual(timeTickFormat("year"), { year: "numeric" });
    assert.deepEqual(timeTickFormat("week"), { month: "short", day: "numeric" });
    assert.deepEqual(timePointFormat("month"), { month: "long", year: "numeric" });
    assert.deepEqual(timePointFormat("minute"), { dateStyle: "medium", timeStyle: "short" });
    assert.deepEqual(timePointFormat("year"), { year: "numeric" });
    assert.deepEqual(timePointFormat("day"), { dateStyle: "medium" });
  });
});

describe("apilado y sectores", () => {
  test("positivos hacia arriba, negativos hacia abajo, ausentes como cero", () => {
    assert.deepEqual(
      stack([
        [1, -2, null],
        [3, -1, 4],
      ]),
      [
        [
          [0, 1],
          [0, -2],
          [0, 0],
        ],
        [
          [1, 4],
          [-2, -3],
          [0, 4],
        ],
      ],
    );
  });
  test("propiedad: la cima de la última serie es la suma de los positivos", () => {
    fc.assert(
      fc.property(
        fc.array(fc.array(fc.integer({ min: 0, max: 100 }), { minLength: 3, maxLength: 3 }), { minLength: 1, maxLength: 5 }),
        (m) => {
          const s = stack(m);
          for (let i = 0; i < 3; i++)
            assert.equal(
              s[s.length - 1]![i]![1],
              m.reduce((a, row) => a + row[i]!, 0),
            );
        },
      ),
    );
  });
  test("sectores: vuelta completa en orden, sin negativos y con hueco", () => {
    const arcs = pieLayout([1, 1, 2]);
    assert.equal(arcs[0]!.start, 0);
    assert.ok(Math.abs(arcs[2]!.end - Math.PI * 2) < 1e-9);
    assert.equal(arcs[2]!.fraction, 0.5);
    assert.equal(pieLayout([-3, 0, 5])[0]!.value, 0);
    const padded = pieLayout([1, 1], 0.1);
    assert.ok(padded[0]!.end < padded[1]!.start);
    assert.equal(pieLayout([0, 0])[0]!.fraction, 0);
  });
  test("trazados de sector: anillo, tarta, vuelta completa y vacío", () => {
    assert.match(arcPath(50, 50, 30, 50, 0, Math.PI / 2), /^M50 0A50 50 0 0 1 100 50L80 50A30 30 0 0 0 50 20Z$/);
    assert.match(arcPath(50, 50, 0, 50, 0, Math.PI * 1.5), /A50 50 0 1 1 .*L50 50Z$/);
    assert.equal((arcPath(50, 50, 30, 50, 0, Math.PI * 2).match(/Z/g) ?? []).length, 2);
    assert.equal((arcPath(50, 50, 0, 50, 0, Math.PI * 2).match(/Z/g) ?? []).length, 1);
    assert.equal(arcPath(50, 50, 0, 50, 1, 1), "");
    assert.deepEqual(arcCentroid(50, 50, 0, 40, 0, Math.PI), [70, 50]);
  });
});

describe("trazados", () => {
  test("los huecos cortan la línea", () => {
    assert.equal(segments([[0, 0], null, [2, 2], [3, 3]]).length, 2);
    assert.equal(linePath([[0, 10], [50, 20], null, [100, 30]]), "M0 10L50 20M100 30h0");
    assert.equal(
      linePath(
        [
          [0, 10],
          [50, 20],
          [100, 0],
        ],
        "step",
      ),
      "M0 10H25V20H50H75V0H100",
    );
  });
  test("monótona: no inventa picos fuera del rango de cada tramo", () => {
    const d = linePath(
      [
        [0, 50],
        [10, 50],
        [20, 0],
        [30, 0],
      ],
      "monotone",
    );
    const ys = [...d.matchAll(/C[\d.-]+ ([\d.-]+) [\d.-]+ ([\d.-]+)/g)].flatMap((m) => [Number(m[1]), Number(m[2])]);
    assert.ok(ys.every((y) => y >= 0 && y <= 50));
  });
  test("área entre una línea y su base, cerrada y con huecos", () => {
    const d = areaPath(
      [[0, 10], [50, 20], null, [80, 5], [100, 5]],
      [
        [0, 100],
        [50, 100],
        [60, 100],
        [80, 100],
        [100, 100],
      ],
    );
    assert.equal((d.match(/Z/g) ?? []).length, 2);
    assert.ok(d.startsWith("M0 10L50 20L50 100L0 100Z"));
  });
  test("formato de números cacheado y opciones de eje", () => {
    assert.equal(numberFormat("en-US").format(1234), "1,234");
    assert.equal(numberFormat("en-US"), numberFormat("en-US"));
    assert.equal(numberFormat("no válido!!", {}).format(1), "1");
    assert.deepEqual(axisNumberOptions({}, 120000), { notation: "compact", maximumFractionDigits: 1 });
    assert.deepEqual(axisNumberOptions({}, 900), {});
    assert.deepEqual(axisNumberOptions({ style: "percent" }, 1e6), { style: "percent" });
  });
});

const SALES = [
  { month: "2026-01", revenue: 42, costs: 38 },
  { month: "2026-02", revenue: 48, costs: null },
  { month: "2026-03", revenue: 45, costs: 41 },
];
const series = [
  { key: "revenue", label: "Revenue" },
  { key: "costs", label: "Costs" },
];

describe("árbol del gráfico", () => {
  test("configuración: tipo, eje temporal deducido, leyenda con dos series y etiquetas por defecto", () => {
    const c = chartWidget.configure({ data: SALES, xKey: "month", series });
    assert.equal(c.type, "line");
    assert.equal(c.xType, "time");
    assert.equal(c.legend, true);
    assert.equal(c.labels.viewAsTable, CHART_LABELS.viewAsTable);
    assert.equal(chartWidget.configure({ type: "nope" as never, data: [{ x: "A", y: 1 }] }).xType, "category");
    assert.equal(chartWidget.configure({ type: "line", stacked: true }).stacked, false, "solo área y barras se apilan");
    assert.equal(chartWidget.configure({ type: "line", orientation: "horizontal" }).orientation, "vertical");
    assert.equal(chartWidget.configure({ type: "donut" }).xKey, "label");
  });
  test("figure con título, resumen, un punto enfocable por posición y nombre completo", () => {
    const out = html({ title: "Sales", data: SALES, xKey: "month", series, locale: "en-US" });
    assert.match(out, /<figure class="z-chart__figure"><figcaption/);
    assert.match(out, /role="group" aria-label="Sales" aria-describedby="c-summary c-hint"/);
    assert.equal((out.match(/class="z-chart__hit"/g) ?? []).length, 3);
    assert.equal((out.match(/tabindex="0"/g) ?? []).length, 1, "un solo punto en el orden de tabulación");
    assert.match(out, /aria-label="February 2026: Revenue 48, Costs no data"/);
    assert.match(out, /Line chart, 2 series: Revenue, Costs\. 3 points from January 2026 to March 2026\./);
    assert.match(out, /Revenue: from 42 to 48\./);
    assert.match(out, /class="z-chart__line" d="M0 /);
  });
  test("tooltip, cruceta y marcadores de la posición activa", () => {
    const t = tree({ data: SALES, xKey: "month", series, locale: "en-US" }, { active: 2, tip: true });
    const tip = find(t, "z-chart__tip")[0]!;
    assert.equal(tip.a?.["data-side"], "start");
    assert.match(toHTML(tip), /<b>45<\/b><span>Revenue<\/span>/);
    assert.equal(find(t, "z-chart__cross").length, 1);
    assert.equal(find(t, "z-chart__dot").length, 2);
  });
  test("series ocultas: fuera del trazado y de la tabla, la última visible no se oculta y el color sigue a la serie", () => {
    const t = tree({ type: "bar", data: SALES, xKey: "month", series, locale: "en-US" }, { hidden: ["revenue"] });
    const bars = find(t, "z-chart__bar");
    assert.ok(bars.every((b) => b.a?.["data-color"] === 2));
    const keys = find(t, "z-chart__key");
    assert.equal(keys[0]!.a?.["aria-pressed"], "false");
    assert.equal(keys[1]!.a?.["aria-disabled"], "true");
  });
  test("barras apiladas: extremo redondeado solo en la punta y hueco sobre la base", () => {
    const t = tree({
      type: "bar",
      stacked: true,
      data: [{ x: "A", a: 2, b: 3 }],
      xKey: "x",
      series: [
        { key: "a", label: "A" },
        { key: "b", label: "B" },
      ],
    });
    const [a, b] = find(t, "z-chart__bar");
    assert.equal(a!.a?.["data-cap"], undefined);
    assert.equal(b!.a?.["data-cap"], "");
    assert.equal(b!.a?.["data-under"], "");
    assert.equal(a!.s?.["--y0"], 0);
  });
  test("barras horizontales negativas y agrupadas", () => {
    const t = tree({
      type: "bar",
      orientation: "horizontal",
      data: [
        { x: "A", v: -4 },
        { x: "B", v: 6 },
      ],
      xKey: "x",
      series: [{ key: "v", label: "V" }],
    });
    const bars = find(t, "z-chart__bar");
    assert.equal(bars[0]!.a?.["data-negative"], "");
    assert.equal(find(t, "z-chart__frame")[0]!.a?.["data-orientation"], "horizontal");
    assert.equal(find(t, "z-chart__base").length, 1);
  });
  test("área apilada, eje numérico, sin datos y tabla alternativa", () => {
    const area = html({ type: "area", stacked: true, data: SALES, xKey: "month", series });
    assert.equal((area.match(/class="z-chart__area"/g) ?? []).length, 2);
    const numeric = html({
      data: [
        { x: 1, y: 2 },
        { x: 4, y: 3 },
      ],
      xType: "number",
      locale: "en-US",
    });
    assert.match(numeric, /class="z-chart__tick"[^>]*>1</);
    assert.match(html({ data: [] }), /No data/);
    const table = html({ title: "Sales", data: SALES, xKey: "month", xLabel: "Month", series, locale: "en-US" }, { view: "table" });
    assert.match(table, /<caption id="c-caption">Sales<\/caption>/);
    assert.match(table, /<th scope="col">Month<\/th><th scope="col">Revenue<\/th>/);
    assert.match(table, /<td>no data<\/td>/);
  });
  test("anillo: sectores enfocables con porcentaje, centro con el total o el sector activo, trama opcional", () => {
    const data = [
      { label: "Media", value: 3 },
      { label: "Docs", value: 1 },
    ];
    const out = html({ type: "donut", data, locale: "en-US", patterns: true });
    assert.match(out, /aria-label="Media: 3 \(75%\)"/);
    assert.match(out, /<b>4<\/b><span>Total<\/span>/);
    assert.match(out, /fill="url\(#c-p1\)"/);
    const active = html({ type: "donut", data, locale: "en-US" }, { active: 1, tip: true });
    assert.match(active, /<b>1<\/b><span>Docs · 25%<\/span>/);
    const pie = tree({ type: "pie", data, locale: "en-US" }, { active: 0, tip: true });
    assert.equal(find(pie, "z-chart__tip").length, 1);
    assert.equal(find(pie, "z-chart__center").length, 0);
    assert.match(html({ type: "pie", data, locale: "en-US" }, { view: "table" }), /<td>75%<\/td>/);
    assert.match(html({ type: "donut", data: [] }), /No data/);
  });
  test("modo DOM: atributos y JSON", () => {
    const el = {
      dataset: {
        type: "bar",
        xKey: "x",
        stacked: "",
        orientation: "horizontal",
        markers: "",
        height: "300",
        hidden: "a b",
        view: "table",
        legend: "false",
      },
    } as unknown as HTMLElement;
    const p = chartWidget.fromDom(el, { data: [{ x: "A", a: 1 }], series: [{ key: "a", label: "A" }] });
    assert.equal(p.type, "bar");
    assert.equal(p.stacked, true);
    assert.equal(p.orientation, "horizontal");
    assert.equal(p.height, 300);
    assert.deepEqual(p.defaultHidden, ["a", "b"]);
    assert.equal(p.defaultView, "table");
    assert.equal(p.legend, false);
    const state = chartWidget.initial(chartWidget.configure({ hidden: ["x"] }));
    assert.deepEqual(chartWidget.control!(chartWidget.configure({ hidden: ["y"] }), state).hidden, ["y"]);
  });
});

describe("minigráfico", () => {
  test("nombre con primero, último, mínimo y máximo", () => {
    const t = sparklineTree({ values: [3, 1, 8, 5], label: "Visits", locale: "en-US" });
    assert.equal(t.a?.role, "img");
    assert.equal(t.a?.["aria-label"], "Visits: from 3 to 5, low 1, high 8");
    assert.equal(sparklineTree({ values: [2, 4] }).a?.["aria-label"], "from 2 to 4, low 2, high 4");
    assert.equal(sparklineTree({ values: [] }).a?.["aria-label"], "No data");
    assert.equal(sparklineTree({ values: [1], ariaLabel: "Custom" }).a?.["aria-label"], "Custom");
  });
  test("línea con punto final, área y barras con la última resaltada", () => {
    assert.match(toHTML(sparklineTree({ values: [1, 2, 3] })), /z-sparkline__end/);
    assert.match(toHTML(sparklineTree({ values: [1, 2, 3], type: "area" })), /z-sparkline__area/);
    const bars = toHTML(sparklineTree({ values: [1, -2, 3], type: "bar", color: 12 }));
    assert.equal((bars.match(/<rect/g) ?? []).length, 3);
    assert.match(bars, /data-color="8"/);
    assert.match(bars, /data-last/);
    assert.doesNotMatch(toHTML(sparklineTree({ values: [1, 2, null], showEnd: true })), /z-sparkline__end/);
  });
  test("modo DOM: valores en data-values", () => {
    const el = { dataset: { values: "3,4, 5", type: "bar", color: "2", end: "false", zero: "false" } } as unknown as HTMLElement;
    const p = sparklineWidget.fromDom(el, {});
    assert.deepEqual(p.values, [3, 4, 5]);
    assert.equal(p.showEnd, false);
    assert.equal(p.zero, false);
    assert.equal(sparklineWidget.tree(sparklineWidget.configure(p), null, "s").a?.["data-type"], "bar");
  });
});
