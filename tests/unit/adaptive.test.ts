// Layouts adaptativos: clases de tamaño, fusión mobile-first de los ajustes, plantillas, orden de lectura y la parte
// de navegador que se puede probar sin layout (reordenar nodos, leer el orden del marcado). Con fast-check para las
// propiedades: la semilla es fija (ZUIX_FC_SEED y ZUIX_FC_RUNS la cambian).
import "./helpers/dom.mjs";
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import fc from "fast-check";
import {
  SIZE_CLASSES,
  SIZE_CLASS_NAMES,
  areaRects,
  areaRows,
  domOrderFor,
  inputClassOf,
  isSizeClass,
  nodeStyle,
  orderMismatch,
  parseAreasValue,
  pickForClass,
  placement,
  readingOrder,
  resolveAdaptive,
  resolveAll,
  resolveNodes,
  resolveTemplate,
  sizeClassFor,
  sizeClassIndex,
  splitOverflow,
  templateColumnsValue,
  templateVars,
  validateAdaptive,
  validateTemplate,
  variantClasses,
  variantMap,
  visualOrder,
  type AdaptiveMap,
  type AdaptiveNode,
  type AdaptiveTemplates,
  type SizeClass,
} from "../../zui/src/core/adaptive.ts";
import { adaptivePanel, adaptivePanelClasses } from "../../zout/src/logic.ts";
import { adaptiveTransition, readLayoutOrder, reorderChildren, syncLayoutOrder } from "../../zout/src/adaptive-runtime.ts";

fc.configureGlobal({
  seed: Number(process.env.ZUIX_FC_SEED ?? 20261125),
  numRuns: Number(process.env.ZUIX_FC_RUNS ?? 300),
});

const cls = fc.constantFrom<SizeClass>(...SIZE_CLASS_NAMES);
const settings = fc.record(
  {
    order: fc.integer({ min: -5, max: 5 }),
    hidden: fc.boolean(),
    area: fc.constantFrom("a", "b", "c", "nav", "main"),
    span: fc.integer({ min: 1, max: 4 }),
    variant: fc.constantFrom("tabs", "select", "menu"),
    props: fc.dictionary(fc.constantFrom("x", "y", "z"), fc.integer()),
  },
  { requiredKeys: [] },
);
const adaptiveMap: fc.Arbitrary<AdaptiveMap> = fc.dictionary(cls, settings, { maxKeys: 5 }) as fc.Arbitrary<AdaptiveMap>;

describe("clases de tamaño", () => {
  test("cortes de Material 3 y tokens", () => {
    assert.deepEqual(
      SIZE_CLASSES.map((c) => [c.name, c.min]),
      [
        ["compact", 0],
        ["medium", 600],
        ["expanded", 840],
        ["large", 1200],
        ["xlarge", 1600],
      ],
    );
    for (const [w, c] of [
      [0, "compact"],
      [599, "compact"],
      [599.98, "compact"],
      [600, "medium"],
      [839, "medium"],
      [840, "expanded"],
      [1199, "expanded"],
      [1200, "large"],
      [1599, "large"],
      [1600, "xlarge"],
      [9999, "xlarge"],
      [-10, "compact"],
      [Number.NaN, "compact"],
    ] as const)
      assert.equal(sizeClassFor(w), c, `${w}`);
    assert.ok(isSizeClass("medium") && !isSizeClass("huge"));
  });

  test("propiedad: la clase crece con el ancho y su rango contiene el ancho", () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 5000, noNaN: true }), fc.double({ min: 0, max: 5000, noNaN: true }), (a, b) => {
        const [lo, hi] = a <= b ? [a, b] : [b, a];
        assert.ok(sizeClassIndex(sizeClassFor(lo)) <= sizeClassIndex(sizeClassFor(hi)));
        const def = SIZE_CLASSES.find((c) => c.name === sizeClassFor(lo))!;
        assert.ok(lo >= def.min && (def.next === null || lo < def.next));
      }),
    );
  });

  test("entrada: puntero y hover desde matchMedia", () => {
    assert.deepEqual(inputClassOf(null), { pointer: "fine", hover: true });
    const touch = (q: string) => ({ matches: q === "(pointer: coarse)" });
    assert.deepEqual(inputClassOf(touch), { pointer: "coarse", hover: false });
  });
});

describe("fusión mobile-first", () => {
  test("lo de compact vale hasta que una clase mayor lo sobrescribe", () => {
    const map: AdaptiveMap = {
      compact: { order: 2, hidden: true, props: { dense: true } },
      expanded: { hidden: false, props: { cols: 3 } },
    };
    assert.deepEqual(resolveAdaptive(map, "compact"), { order: 2, hidden: true, props: { dense: true } });
    assert.deepEqual(resolveAdaptive(map, "medium"), { order: 2, hidden: true, props: { dense: true } });
    assert.deepEqual(resolveAdaptive(map, "xlarge"), { order: 2, hidden: false, props: { dense: true, cols: 3 } });
    assert.deepEqual(resolveAdaptive(undefined, "large", { area: "main" }), { area: "main" });
    // Un `undefined` explícito no borra lo heredado.
    assert.equal(resolveAdaptive({ compact: { area: "a" }, large: { area: undefined } }, "xlarge").area, "a");
    assert.equal(resolveAll(map).large.hidden, false);
  });

  test("propiedad: resolver en una clase es fusionar la anterior con la propia", () => {
    fc.assert(
      fc.property(adaptiveMap, (map) => {
        for (let i = 1; i < SIZE_CLASS_NAMES.length; i++) {
          const prev = resolveAdaptive(map, SIZE_CLASS_NAMES[i - 1]!);
          const own = map[SIZE_CLASS_NAMES[i]!];
          const next = resolveAdaptive(map, SIZE_CLASS_NAMES[i]!);
          for (const key of ["order", "hidden", "area", "span", "variant"] as const)
            assert.deepEqual(next[key], own?.[key] !== undefined ? own[key] : prev[key]);
          assert.deepEqual(next.props, own?.props || prev.props ? { ...prev.props, ...own?.props } : undefined);
        }
      }),
    );
  });

  test("pickForClass y variantes", () => {
    const choice = { compact: "select", expanded: "tabs" } as const;
    assert.equal(pickForClass(choice, "compact", "x"), "select");
    assert.equal(pickForClass(choice, "medium", "x"), "select");
    assert.equal(pickForClass(choice, "xlarge", "x"), "tabs");
    assert.equal(pickForClass({ medium: "tabs" }, "compact", "x"), "x");
    assert.deepEqual(variantMap({ compact: { variant: "cards" }, medium: { order: 1 }, large: { variant: "table" } }), {
      compact: "cards",
      large: "table",
    });
    assert.deepEqual(Object.fromEntries(variantClasses(choice, "x")), {
      select: ["compact", "medium"],
      tabs: ["expanded", "large", "xlarge"],
    });
  });
});

describe("plantillas", () => {
  test("filas, rectángulos y columnas", () => {
    assert.deepEqual(areaRows(['"a a b"', "c . ...", "  d  "]), [["a", "a", "b"], ["c", ".", "."], ["d"]]);
    assert.deepEqual(areaRects(["nav main", "nav aside"]).get("nav"), { row: 0, col: 0, rowEnd: 2, colEnd: 1 });
    assert.equal(templateColumnsValue({ areas: ["a b c"] }), "repeat(3, minmax(0, 1fr))");
    assert.equal(templateColumnsValue({ areas: ["a"] }), "minmax(0, 1fr)");
    assert.equal(templateColumnsValue({ areas: ["a b"], columns: "200px 1fr" }), "200px 1fr");
    assert.equal(templateColumnsValue(null), "minmax(0, 1fr)");
    assert.deepEqual(parseAreasValue('"a b" "c d"'), ["a b", "c d"]);
    assert.equal(parseAreasValue("none"), null);
  });

  test("validación: vacía, filas de distinto ancho, nombres y áreas no rectangulares", () => {
    assert.deepEqual(validateTemplate({ areas: ["a b", "c d"] }), []);
    assert.deepEqual(
      validateTemplate({ areas: [] }).map((i) => i.code),
      ["empty"],
    );
    assert.deepEqual(
      validateTemplate({ areas: ["a b", "c"] }).map((i) => i.code),
      ["ragged"],
    );
    assert.deepEqual(
      validateTemplate({ areas: ["1x b"] }).map((i) => i.code),
      ["invalid-name"],
    );
    // En L: no es un rectángulo.
    assert.deepEqual(
      validateTemplate({ areas: ["a a", "a b"] }, "medium").map((i) => [i.code, i.area, i.sizeClass]),
      [["not-rectangular", "a", "medium"]],
    );
    // Dos trozos separados del mismo nombre.
    assert.deepEqual(
      validateTemplate({ areas: ["a b a"] }).map((i) => i.code),
      ["not-rectangular"],
    );
  });

  test("propiedad: una rejilla de rectángulos generada siempre valida", () => {
    // Columnas y filas de rectángulos: cada celda (r, c) toma el nombre del bloque al que pertenece.
    const blocks = fc.tuple(
      fc.array(fc.integer({ min: 1, max: 3 }), { minLength: 1, maxLength: 4 }),
      fc.array(fc.integer({ min: 1, max: 3 }), { minLength: 1, maxLength: 4 }),
    );
    fc.assert(
      fc.property(blocks, ([rowSpans, colSpans]) => {
        const rows: string[] = [];
        rowSpans.forEach((rs, ri) => {
          for (let k = 0; k < rs; k++) rows.push(colSpans.flatMap((cs, ci) => Array(cs).fill(`b${ri}_${ci}`)).join(" "));
        });
        assert.deepEqual(validateTemplate({ areas: rows }), []);
        assert.equal(areaRects(rows).size, rowSpans.length * colSpans.length);
      }),
    );
  });

  test("propiedad: si validateTemplate no da not-rectangular, cada área llena su rectángulo", () => {
    const grid = fc.array(fc.array(fc.constantFrom("a", "b", "c", "."), { minLength: 3, maxLength: 3 }), { minLength: 1, maxLength: 4 });
    fc.assert(
      fc.property(grid, (cells) => {
        const areas = cells.map((r) => r.join(" "));
        const bad = new Set(
          validateTemplate({ areas })
            .filter((i) => i.code === "not-rectangular")
            .map((i) => i.area),
        );
        for (const [name, r] of areaRects(areas)) {
          const full = cells.slice(r.row, r.rowEnd).every((row) => row.slice(r.col, r.colEnd).every((c) => c === name));
          const count = cells.flat().filter((c) => c === name).length;
          assert.equal(!bad.has(name), full && count === (r.rowEnd - r.row) * (r.colEnd - r.col), `${name} en ${areas.join(" / ")}`);
        }
      }),
    );
  });

  test("validateAdaptive: cada pieza visible necesita un área que exista en su clase", () => {
    const templates: AdaptiveTemplates = { compact: { areas: ["main", "side"] }, expanded: { areas: ["nav main side"] } };
    const nodes: AdaptiveNode[] = [
      { id: "main", area: "main" },
      { id: "side", area: "side" },
      { id: "nav", area: "nav", adaptive: { compact: { hidden: true }, expanded: { hidden: false } } },
      { id: "extra", adaptive: { large: { area: "nope" } } },
    ];
    const issues = validateAdaptive(templates, nodes);
    assert.deepEqual(
      issues.map((i) => [i.code, i.item, i.sizeClass]),
      [
        ["unknown-area", "extra", "large"],
        ["unknown-area", "extra", "xlarge"],
      ],
    );
    const shared = validateAdaptive({ compact: { areas: ["a"] } }, [
      { id: "x", area: "a" },
      { id: "y", area: "a" },
    ]);
    assert.ok(shared.some((i) => i.code === "shared-area" && i.item === "y"));
    // Sin plantilla, un área no existe.
    assert.equal(validateAdaptive({}, [{ id: "x", area: "a" }]).length, 5);
    // Plantilla rota: se informa con su clase.
    assert.ok(
      validateAdaptive({ medium: { areas: ["a a", "a b"] } }, []).some((i) => i.code === "not-rectangular" && i.sizeClass === "medium"),
    );
  });

  test("resolveTemplate hereda hacia arriba", () => {
    const t: AdaptiveTemplates = { medium: { areas: ["a b"] }, large: { areas: ["a b c"] } };
    assert.equal(resolveTemplate(t, "compact"), null);
    assert.equal(resolveTemplate(t, "expanded"), t.medium);
    assert.equal(resolveTemplate(t, "xlarge"), t.large);
  });
});

describe("orden y colocación", () => {
  const templates: AdaptiveTemplates = {
    compact: { areas: ["header", "main", "aside"] },
    expanded: { areas: ["header header", "aside main"], columns: "280px 1fr" },
  };
  const nodes: AdaptiveNode[] = [
    { id: "header", area: "header" },
    { id: "main", area: "main" },
    { id: "aside", area: "aside", adaptive: { medium: { hidden: true }, expanded: { hidden: false } } },
    { id: "loose", order: -1 },
  ];

  test("orden visual por fila y columna de cada área; flujo detrás", () => {
    assert.deepEqual(visualOrder(templates, nodes, "compact"), ["header", "main", "aside", "loose"]);
    assert.deepEqual(visualOrder(templates, nodes, "medium"), ["header", "main", "loose"]);
    assert.deepEqual(visualOrder(templates, nodes, "expanded"), ["header", "aside", "main", "loose"]);
    assert.deepEqual(domOrderFor(templates, nodes, "medium"), ["header", "main", "loose", "aside"]);
    // Sin plantilla: por order y luego por origen.
    assert.deepEqual(visualOrder(null, nodes, "compact"), ["loose", "header", "main", "aside"]);
  });

  test("resolveNodes: área fuera de la plantilla pasa a flujo; span solo si es mayor que 1", () => {
    const r = resolveNodes(
      { compact: { areas: ["a"] } },
      [
        { id: "x", area: "zz", span: 2 },
        { id: "y", span: 1 },
      ],
      "compact",
    );
    assert.equal(r[0]!.area, null);
    assert.equal(r[0]!.span, 2);
    assert.equal(r[1]!.span, null);
    assert.equal(placement(r[0]!), "auto / auto / auto / span 2");
    assert.equal(placement({ area: "a", span: 3 }), "a");
    assert.equal(placement({ area: null, span: null }), "auto");
  });

  test("orderMismatch compara solo las piezas visibles", () => {
    assert.equal(orderMismatch(["a", "b", "c"], ["a", "c"]), false);
    assert.equal(orderMismatch(["b", "a"], ["a", "b"]), true);
    assert.equal(orderMismatch(["a"], ["a", "b"]), true);
  });

  test("propiedad: el orden visual es una permutación de las visibles y es estable", () => {
    const node = fc.record({ area: fc.option(fc.constantFrom("a", "b", "c", "d"), { nil: undefined }), adaptive: adaptiveMap });
    fc.assert(
      fc.property(fc.array(node, { maxLength: 8 }), cls, (raw, c) => {
        const list: AdaptiveNode[] = raw.map((n, i) => ({ id: `n${i}`, ...n }));
        const t: AdaptiveTemplates = { compact: { areas: ["a b", "c d"] }, large: { areas: ["d c b a"] } };
        const visible = resolveNodes(t, list, c)
          .filter((n) => !n.hidden)
          .map((n) => n.id);
        const order = visualOrder(t, list, c);
        assert.deepEqual([...order].sort(), [...visible].sort());
        assert.deepEqual(visualOrder(t, list, c), order);
        const dom = domOrderFor(t, list, c);
        assert.equal(dom.length, list.length);
        assert.equal(orderMismatch(dom, order), false);
      }),
    );
  });

  test("readingOrder: en la misma área manda order y luego el origen", () => {
    assert.deepEqual(
      readingOrder(
        ["a"],
        [
          { id: "x", index: 0, area: "a", order: 2, hidden: false },
          { id: "y", index: 1, area: "a", order: 1, hidden: false },
          { id: "z", index: 2, area: "a", order: 1, hidden: false },
        ],
      ),
      ["y", "z", "x"],
    );
  });

  test("variables de la rejilla y de cada pieza para las cinco clases", () => {
    const vars = templateVars(templates);
    assert.equal(vars["--z-areas-compact"], '"header" "main" "aside"');
    assert.equal(vars["--z-areas-medium"], '"header" "main" "aside"');
    assert.equal(vars["--z-areas-xlarge"], '"header header" "aside main"');
    assert.equal(vars["--z-columns-large"], "280px 1fr");
    assert.equal(vars["--z-rows-compact"], "none");
    assert.equal(templateVars({})["--z-areas-compact"], "none");
    const aside = nodeStyle(templates, nodes[2]!);
    assert.equal(aside.hiddenIn, "medium");
    assert.equal(aside.vars["--z-place-expanded"], "aside");
    assert.equal(nodeStyle(templates, nodes[3]!).vars["--z-order-compact"], "-1");
    assert.equal(nodeStyle(templates, nodes[0]!).hiddenIn, undefined);
  });

  test("barra con desbordamiento", () => {
    const actions = [
      { id: "a" },
      { id: "b", adaptive: { compact: { variant: "menu" }, expanded: { variant: "bar" } } },
      { id: "c", adaptive: { compact: { hidden: true }, medium: { hidden: false, variant: "menu" } } },
    ];
    const ids = (r: { bar: { id: string }[]; menu: { id: string }[] }) => [r.bar.map((x) => x.id), r.menu.map((x) => x.id)];
    assert.deepEqual(ids(splitOverflow(actions, "compact")), [["a"], ["b"]]);
    assert.deepEqual(ids(splitOverflow(actions, "medium")), [["a"], ["b", "c"]]);
    assert.deepEqual(ids(splitOverflow(actions, "large")), [["a", "b"], ["c"]]);
  });
});

describe("Shell con ajustes por clase", () => {
  const adaptive: AdaptiveMap = {
    compact: { variant: "drawer" },
    medium: { variant: "rail" },
    expanded: { variant: "docked" },
    xlarge: { hidden: true },
  };
  test("modo, rail y oculto según el ancho del shell", () => {
    assert.deepEqual(adaptivePanel(null, adaptive), { mode: "docked", rail: false, hidden: false });
    assert.deepEqual(adaptivePanel(400, adaptive), { mode: "overlay", rail: false, hidden: false });
    assert.deepEqual(adaptivePanel(700, adaptive), { mode: "docked", rail: true, hidden: false });
    assert.deepEqual(adaptivePanel(1000, adaptive), { mode: "docked", rail: false, hidden: false });
    assert.equal(adaptivePanel(1700, adaptive).hidden, true);
    assert.equal(adaptivePanel(400, { compact: { variant: "overlay" } }).mode, "overlay");
  });
  test("clases de cada variante para la hoja", () => {
    assert.deepEqual(adaptivePanelClasses(adaptive), { drawerIn: "compact", railIn: "medium", hiddenIn: "xlarge" });
    assert.deepEqual(adaptivePanelClasses({}), { drawerIn: undefined, railIn: undefined, hiddenIn: undefined });
  });
});

describe("navegador: reordenar y leer el marcado", () => {
  const build = () => {
    const layout = document.createElement("div");
    layout.className = "z-adaptive";
    const grid = document.createElement("div");
    grid.className = "z-adaptive__grid";
    grid.style.setProperty("--z-areas-medium", '"b a"');
    layout.append(grid);
    for (const [id, place] of [
      ["a", "a"],
      ["b", "b"],
      ["c", "auto"],
    ]) {
      const item = document.createElement("div");
      item.className = "z-adaptive__item";
      item.dataset.item = id;
      item.style.setProperty("--z-place-medium", place!);
      item.style.setProperty("--z-order-medium", "0");
      grid.append(item);
    }
    document.body.append(layout);
    return { layout, grid };
  };
  const ids = (grid: Element) => [...grid.children].map((c) => (c as HTMLElement).dataset.item);

  test("readLayoutOrder lee áreas, orden y ocultos de las variables", () => {
    const { layout, grid } = build();
    (grid.children[2] as HTMLElement).setAttribute("data-hidden-in", "compact medium");
    const r = readLayoutOrder(layout, "medium");
    assert.deepEqual(r.dom, ["a", "b", "c"]);
    assert.deepEqual(r.visual, ["b", "a"]);
    layout.remove();
  });

  test("syncLayoutOrder en dom mueve los nodos; en visual informa", () => {
    const { layout, grid } = build();
    const visual = syncLayoutOrder(layout, "medium", "visual");
    assert.equal(visual.mismatch, true);
    assert.equal(visual.moved, false);
    assert.deepEqual(ids(grid), ["a", "b", "c"]);
    const dom = syncLayoutOrder(layout, "medium", "dom");
    assert.equal(dom.moved, true);
    assert.deepEqual(ids(grid), ["b", "a", "c"]);
    assert.equal(syncLayoutOrder(layout, "medium", "dom").mismatch, false);
    layout.remove();
  });

  test("modo visual: el DOM vuelve al orden de origen aunque antes se reordenara", () => {
    const { layout, grid } = build();
    syncLayoutOrder(layout, "medium", "dom");
    assert.deepEqual(ids(grid), ["b", "a", "c"]);
    const report = syncLayoutOrder(layout, "medium", "visual");
    assert.deepEqual(ids(grid), ["a", "b", "c"]);
    assert.equal(report.mismatch, true);
    assert.deepEqual(report.dom, ["a", "b", "c"]);
    layout.remove();
  });

  test("reorderChildren conserva el foco y no mueve lo que ya está en su sitio", () => {
    const { layout, grid } = build();
    const button = document.createElement("button");
    grid.children[0]!.append(button);
    button.focus();
    const [a, b, c] = [...grid.children];
    assert.equal(reorderChildren(grid, [a!, b!, c!]), false);
    assert.equal(reorderChildren(grid, [c!, a!, b!]), true);
    assert.deepEqual(ids(grid), ["c", "a", "b"]);
    assert.equal(document.activeElement, button);
    layout.remove();
  });

  test("adaptiveTransition aplica el cambio aunque no haya view transitions", () => {
    let done = false;
    adaptiveTransition(document.body, () => {
      done = true;
    });
    assert.ok(done);
  });
});
