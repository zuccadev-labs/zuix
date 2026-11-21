import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  clamp,
  dividerKeyDelta,
  evenFractions,
  INSPECTOR_BREAKPOINT,
  isHorizontal,
  moveDivider,
  panelMode,
  RESIZE_MAX,
  RESIZE_MIN,
  RESIZE_STEP,
  resizeByKey,
  resizeSign,
  revealOffset,
  SIDEBAR_BREAKPOINT,
  SPLIT_KEY_STEP,
  SPLIT_MIN_FRACTION,
  tabKeyIndex,
  reorder,
  dropIndex,
  finalIndex,
  tabMoveIndex,
  moveBefore,
  beforeFor,
  clampRect,
  moveDelta,
  resizeDelta,
  resizeRect,
  FLOAT_MARGIN,
  paneIds,
  setSizesAt,
  splitPane,
  removePane,
  swapPanes,
  movePane,
  dropEdge,
  neighborPane,
} from "../../zout/src/logic.ts";

const sum = (list) => list.reduce((a, b) => a + b, 0);
const near = (a, b, eps = 1e-12) => assert.ok(Math.abs(a - b) <= eps, `${a} ≉ ${b}`);

describe("panelMode", () => {
  test("sin medir (null) todo queda acoplado", () => {
    assert.equal(panelMode(null, SIDEBAR_BREAKPOINT), "docked");
    assert.equal(panelMode(null, SIDEBAR_BREAKPOINT, "auto"), "docked");
  });
  test("el punto de corte es exclusivo: en el ancho exacto sigue acoplado", () => {
    assert.equal(panelMode(SIDEBAR_BREAKPOINT, SIDEBAR_BREAKPOINT), "docked");
    assert.equal(panelMode(SIDEBAR_BREAKPOINT - 1, SIDEBAR_BREAKPOINT), "overlay");
    assert.equal(panelMode(INSPECTOR_BREAKPOINT - 0.5, INSPECTOR_BREAKPOINT, null), "overlay");
  });
  test("una preferencia explícita gana al ancho", () => {
    assert.equal(panelMode(320, SIDEBAR_BREAKPOINT, "docked"), "docked");
    assert.equal(panelMode(4000, SIDEBAR_BREAKPOINT, "overlay"), "overlay");
    assert.equal(panelMode(null, SIDEBAR_BREAKPOINT, "overlay"), "overlay");
  });
  test("ancho 0 (contenedor oculto) cuenta como estrecho", () => {
    assert.equal(panelMode(0, SIDEBAR_BREAKPOINT), "overlay");
  });
});

describe("ResizeHandle", () => {
  const opts = { min: RESIZE_MIN, max: RESIZE_MAX, step: RESIZE_STEP };
  test("clamp limita por ambos lados y deja pasar lo que cabe", () => {
    assert.equal(clamp(5, 0, 10), 5);
    assert.equal(clamp(-1, 0, 10), 0);
    assert.equal(clamp(11, 0, 10), 10);
  });
  test("signo y eje por lado", () => {
    assert.deepEqual(["left", "right", "top", "bottom"].map(isHorizontal), [true, true, false, false]);
    assert.deepEqual(["left", "right", "top", "bottom"].map(resizeSign), [-1, 1, -1, 1]);
  });
  test("las flechas crecen hacia fuera del panel según el lado", () => {
    assert.equal(resizeByKey("ArrowRight", "right", 300, opts), 316);
    assert.equal(resizeByKey("ArrowLeft", "right", 300, opts), 284);
    assert.equal(resizeByKey("ArrowLeft", "left", 300, opts), 316);
    assert.equal(resizeByKey("ArrowRight", "left", 300, opts), 284);
    assert.equal(resizeByKey("ArrowDown", "bottom", 300, opts), 316);
    assert.equal(resizeByKey("ArrowUp", "bottom", 300, opts), 284);
    assert.equal(resizeByKey("ArrowUp", "top", 300, opts), 316);
    assert.equal(resizeByKey("ArrowDown", "top", 300, opts), 284);
  });
  test("no sale de [min, max]", () => {
    assert.equal(resizeByKey("ArrowRight", "right", RESIZE_MAX - 4, opts), RESIZE_MAX);
    assert.equal(resizeByKey("ArrowLeft", "right", RESIZE_MIN + 4, opts), RESIZE_MIN);
    assert.equal(resizeByKey("ArrowRight", "right", RESIZE_MAX, opts), RESIZE_MAX);
  });
  test("las flechas del otro eje y las teclas ajenas no mueven el tirador", () => {
    assert.equal(resizeByKey("ArrowUp", "right", 300, opts), undefined);
    assert.equal(resizeByKey("ArrowLeft", "top", 300, opts), undefined);
    assert.equal(resizeByKey("Enter", "right", 300, opts), undefined);
  });
  test("Home vuelve al tamaño por defecto (acotado) solo si existe", () => {
    assert.equal(resizeByKey("Home", "right", 500, opts), undefined);
    assert.equal(resizeByKey("Home", "right", 500, { ...opts, defaultSize: 280 }), 280);
    assert.equal(resizeByKey("Home", "right", 500, { ...opts, defaultSize: 50 }), RESIZE_MIN);
    assert.equal(resizeByKey("Home", "right", 500, { ...opts, defaultSize: 0 }), RESIZE_MIN);
  });
});

describe("SplitPane", () => {
  test("evenFractions reparte a partes iguales y suma 1", () => {
    assert.deepEqual(evenFractions(2), [0.5, 0.5]);
    near(sum(evenFractions(3)), 1);
    assert.deepEqual(evenFractions(0), []);
  });
  test("moveDivider conserva la suma del par y no toca el resto", () => {
    const next = moveDivider([0.25, 0.25, 0.5], 0, 0.25, 0.25, 0.1, SPLIT_MIN_FRACTION);
    near(next[0], 0.35);
    near(next[1], 0.15);
    assert.equal(next[2], 0.5);
    near(sum(next), 1);
  });
  test("moveDivider respeta el mínimo en los dos sentidos", () => {
    const grow = moveDivider([0.5, 0.5], 0, 0.5, 0.5, 0.9, SPLIT_MIN_FRACTION);
    near(grow[0], 0.9);
    near(grow[1], 0.1);
    const shrink = moveDivider([0.5, 0.5], 0, 0.5, 0.5, -0.9, SPLIT_MIN_FRACTION);
    near(shrink[0], 0.1);
    near(shrink[1], 0.9);
  });
  test("moveDivider no muta la entrada", () => {
    const input = [0.5, 0.5];
    moveDivider(input, 0, 0.5, 0.5, 0.1, SPLIT_MIN_FRACTION);
    assert.deepEqual(input, [0.5, 0.5]);
  });
  test("moveDivider parte de los tamaños iniciales del arrastre, no de los actuales", () => {
    // Durante un arrastre `fractions` ya se movió; `a` y `b` son los del inicio y `delta` es acumulado.
    const next = moveDivider([0.6, 0.4], 0, 0.5, 0.5, 0.2, SPLIT_MIN_FRACTION);
    near(next[0], 0.7);
    near(next[1], 0.3);
  });
  test("dividerKeyDelta según la dirección", () => {
    assert.equal(dividerKeyDelta("ArrowRight", "row"), SPLIT_KEY_STEP);
    assert.equal(dividerKeyDelta("ArrowLeft", "row"), -SPLIT_KEY_STEP);
    assert.equal(dividerKeyDelta("ArrowDown", "row"), 0);
    assert.equal(dividerKeyDelta("ArrowDown", "column"), SPLIT_KEY_STEP);
    assert.equal(dividerKeyDelta("ArrowUp", "column"), -SPLIT_KEY_STEP);
    assert.equal(dividerKeyDelta("ArrowRight", "column"), 0);
    assert.equal(dividerKeyDelta("Tab", "row"), 0);
  });
});

describe("TabStrip", () => {
  test("las flechas dan la vuelta en los extremos", () => {
    assert.equal(tabKeyIndex("ArrowRight", 2, 3), 0);
    assert.equal(tabKeyIndex("ArrowLeft", 0, 3), 2);
    assert.equal(tabKeyIndex("ArrowRight", 0, 3), 1);
  });
  test("Home y End", () => {
    assert.equal(tabKeyIndex("Home", 2, 3), 0);
    assert.equal(tabKeyIndex("End", 0, 3), 2);
  });
  test("sin pestañas o con otra tecla no navega", () => {
    assert.equal(tabKeyIndex("ArrowRight", 0, 0), -1);
    assert.equal(tabKeyIndex("Enter", 0, 3), -1);
  });
  test("con una sola pestaña se queda en ella", () => {
    assert.equal(tabKeyIndex("ArrowRight", 0, 1), 0);
    assert.equal(tabKeyIndex("ArrowLeft", 0, 1), 0);
  });
  test("revealOffset: negativo a la izquierda, positivo a la derecha, 0 si se ve", () => {
    const list = { left: 100, right: 300 };
    assert.equal(revealOffset({ left: 80, right: 140 }, list), -20);
    assert.equal(revealOffset({ left: 280, right: 340 }, list), 40);
    assert.equal(revealOffset({ left: 100, right: 300 }, list), 0);
    assert.equal(revealOffset({ left: 150, right: 200 }, list), 0);
    assert.equal(revealOffset({ left: 120, right: 140 }, list, 24), -4); // fuera del difuminado de 24 px
    assert.equal(revealOffset({ left: 90, right: 280 }, list, 24), -10); // no cabe con margen: entera, sin margen
  });
  test("revealOffset: una pestaña más ancha que la tira se alinea por su inicio", () => {
    assert.equal(revealOffset({ left: 50, right: 400 }, { left: 100, right: 300 }), -50);
  });
});

describe("TabStrip: reordenación", () => {
  test("reorder mueve un elemento a su posición final", () => {
    assert.deepEqual(reorder(["a", "b", "c"], 0, 2), ["b", "c", "a"]);
    assert.deepEqual(reorder(["a", "b", "c"], 2, 0), ["c", "a", "b"]);
    assert.deepEqual(reorder(["a", "b"], 1, 9), ["a", "b"]);
    assert.deepEqual(reorder(["a", "b"], 5, 0), ["a", "b"]);
    assert.deepEqual(reorder(["a", "b", "c"], 1, 1), ["a", "b", "c"]);
  });
  test("dropIndex por mitades, también en RTL", () => {
    const spans = [
      { start: 0, end: 100 },
      { start: 100, end: 200 },
      { start: 200, end: 300 },
    ];
    assert.equal(dropIndex(10, spans), 0);
    assert.equal(dropIndex(60, spans), 1);
    assert.equal(dropIndex(260, spans), 3);
    // RTL: la primera pestaña está a la derecha.
    const rtl = [
      { start: 200, end: 300 },
      { start: 100, end: 200 },
      { start: 0, end: 100 },
    ];
    assert.equal(dropIndex(290, rtl, true), 0);
    assert.equal(dropIndex(240, rtl, true), 1);
    assert.equal(dropIndex(10, rtl, true), 3);
  });
  test("finalIndex descuenta el hueco que deja lo arrastrado", () => {
    assert.equal(finalIndex(0, 3), 2);
    assert.equal(finalIndex(2, 0), 0);
    assert.equal(finalIndex(1, 1), 1);
  });
  test("tabMoveIndex: flechas reflejadas en RTL, Inicio, Fin y extremos", () => {
    assert.equal(tabMoveIndex("ArrowRight", 0, 3), 1);
    assert.equal(tabMoveIndex("ArrowLeft", 0, 3), -1);
    assert.equal(tabMoveIndex("ArrowLeft", 0, 3, true), 1);
    assert.equal(tabMoveIndex("End", 0, 3), 2);
    assert.equal(tabMoveIndex("Home", 0, 3), -1);
    assert.equal(tabMoveIndex("Home", 2, 3), 0);
    assert.equal(tabMoveIndex("ArrowRight", 2, 3), -1);
    assert.equal(tabMoveIndex("x", 1, 3), -1);
  });
  test("moveBefore y beforeFor", () => {
    assert.deepEqual(moveBefore(["a", "b", "c"], "a", "c"), ["b", "a", "c"]);
    assert.deepEqual(moveBefore(["a", "b", "c"], "a", null), ["b", "c", "a"]);
    assert.deepEqual(moveBefore(["a", "b"], "z", null), ["a", "b"]);
    assert.deepEqual(moveBefore(["a", "b"], "a", "a"), ["a", "b"]);
    assert.deepEqual(moveBefore(["a", "b"], "a", "zz"), ["b", "a"]);
    assert.equal(beforeFor(["a", "b", "c"], "a", 1), "c");
    assert.equal(beforeFor(["a", "b", "c"], "a", 2), null);
    assert.equal(beforeFor(["a", "b", "c"], "c", 0), "a");
  });
});

describe("FloatingPanel: posición y tamaño", () => {
  const bounds = { width: 800, height: 600 };
  const min = { width: 200, height: 120 };
  test("clampRect deja el panel dentro del área con su margen", () => {
    assert.deepEqual(clampRect({ x: -50, y: 900, width: 300, height: 200 }, bounds, min), {
      x: FLOAT_MARGIN,
      y: 392,
      width: 300,
      height: 200,
    });
    assert.deepEqual(clampRect({ x: 10, y: 10, width: 2000, height: 50 }, bounds, min), { x: 8, y: 10, width: 784, height: 120 });
    // Área más pequeña que el mínimo: manda el mínimo, pegado al margen de inicio.
    assert.deepEqual(clampRect({ x: 40, y: 40, width: 100, height: 100 }, { width: 150, height: 100 }, min), {
      x: 8,
      y: 8,
      width: 200,
      height: 120,
    });
  });
  test("moveDelta y resizeDelta: las flechas apuntan hacia donde se mueve", () => {
    assert.deepEqual(moveDelta("ArrowLeft", 10), { dx: -10, dy: 0 });
    assert.deepEqual(moveDelta("ArrowDown", 5), { dx: 0, dy: 5 });
    assert.deepEqual(moveDelta("ArrowUp", 5), { dx: 0, dy: -5 });
    assert.deepEqual(moveDelta("ArrowRight", 5), { dx: 5, dy: 0 });
    assert.equal(moveDelta("Enter", 5), null);
    assert.deepEqual(resizeDelta("ArrowRight", 10), { dw: 10, dh: 0 });
    assert.equal(resizeDelta("Home", 10), null);
  });
  test("resizeRect acota al mínimo y al área; en RTL conserva el borde derecho", () => {
    const rect = { x: 100, y: 100, width: 300, height: 200 };
    assert.deepEqual(resizeRect(rect, 50, -500, bounds, min), { x: 100, y: 100, width: 350, height: 120 });
    assert.deepEqual(resizeRect(rect, 5000, 5000, bounds, min), { x: 100, y: 100, width: 692, height: 492 });
    assert.deepEqual(resizeRect(rect, -50, 0, bounds, min, true), { x: 50, y: 100, width: 350, height: 200 });
    assert.deepEqual(resizeRect(rect, 500, 0, bounds, min, true), { x: 200, y: 100, width: 200, height: 200 });
  });
});

describe("PaneLayout: árbol de paneles", () => {
  const p = (id) => ({ type: "pane", id });
  const tree = {
    type: "split",
    direction: "row",
    sizes: [0.5, 0.5],
    children: [p("a"), { type: "split", direction: "column", sizes: [0.5, 0.5], children: [p("b"), p("c")] }],
  };
  test("paneIds en orden de lectura; null vacío", () => {
    assert.deepEqual(paneIds(tree), ["a", "b", "c"]);
    assert.deepEqual(paneIds(null), []);
  });
  test("splitPane: hoja nueva o hermano en la misma dirección", () => {
    assert.deepEqual(splitPane(p("a"), "a", "n", "column", "before"), {
      type: "split",
      direction: "column",
      sizes: [0.5, 0.5],
      children: [p("n"), p("a")],
    });
    assert.deepEqual(splitPane(p("a"), "x", "n", "row"), p("a"));
    const sibling = splitPane(tree, "a", "n", "row");
    assert.deepEqual(sibling.sizes, [0.25, 0.25, 0.5]);
    assert.deepEqual(paneIds(sibling), ["a", "n", "b", "c"]);
    const before = splitPane(tree, "b", "n", "column", "before");
    assert.deepEqual(paneIds(before), ["a", "n", "b", "c"]);
    const nested = splitPane(tree, "b", "n", "row");
    assert.equal(nested.children[1].children[0].type, "split");
  });
  test("removePane: la división con un hijo cede su sitio y se renormaliza", () => {
    const rest = removePane(tree, "b");
    assert.deepEqual(rest, { type: "split", direction: "row", sizes: [0.5, 0.5], children: [p("a"), p("c")] });
    assert.deepEqual(removePane(rest, "a"), p("c"));
    assert.equal(removePane(p("a"), "a"), null);
    const three = { type: "split", direction: "row", sizes: [0.2, 0.3, 0.5], children: [p("a"), p("b"), p("c")] };
    assert.deepEqual(
      removePane(three, "c").sizes.map((x) => Math.round(x * 100)),
      [40, 60],
    );
    assert.equal(removePane({ type: "split", direction: "row", sizes: [1], children: [p("a")] }, "a"), null);
  });
  test("swapPanes y movePane (bordes y centro)", () => {
    assert.deepEqual(paneIds(swapPanes(tree, "a", "c")), ["c", "b", "a"]);
    assert.deepEqual(paneIds(movePane(tree, "a", "c", "center")), ["c", "b", "a"]);
    const moved = movePane(tree, "a", "c", "inline-end");
    assert.deepEqual(paneIds(moved), ["b", "c", "a"]);
    assert.equal(moved.type, "split");
    assert.deepEqual(paneIds(movePane(tree, "c", "a", "block-start")), ["c", "a", "b"]);
    assert.equal(movePane(tree, "a", "a", "inline-end"), tree);
    assert.equal(movePane(tree, "a", "zz", "inline-end"), tree);
  });
  test("setSizesAt cambia el reparto de una división por su ruta", () => {
    assert.deepEqual(setSizesAt(tree, [1], [0.3, 0.7]).children[1].sizes, [0.3, 0.7]);
    assert.deepEqual(setSizesAt(tree, [], [0.4, 0.6]).sizes, [0.4, 0.6]);
    assert.deepEqual(setSizesAt(p("a"), [], [1]), p("a"));
  });
  test("dropEdge: centro, bordes y RTL", () => {
    const r = { left: 0, top: 0, width: 100, height: 100 };
    assert.equal(dropEdge(r, { x: 50, y: 50 }), "center");
    assert.equal(dropEdge(r, { x: 5, y: 50 }), "inline-start");
    assert.equal(dropEdge(r, { x: 5, y: 50 }, true), "inline-end");
    assert.equal(dropEdge(r, { x: 95, y: 40 }), "inline-end");
    assert.equal(dropEdge(r, { x: 50, y: 4 }), "block-start");
    assert.equal(dropEdge(r, { x: 50, y: 96 }), "block-end");
    assert.equal(dropEdge({ left: 0, top: 0, width: 0, height: 0 }, { x: 0, y: 0 }), "center");
  });
  test("neighborPane por geometría", () => {
    const rects = [
      { id: "a", rect: { left: 0, top: 0, width: 100, height: 200 } },
      { id: "b", rect: { left: 100, top: 0, width: 100, height: 100 } },
      { id: "c", rect: { left: 100, top: 100, width: 100, height: 100 } },
    ];
    assert.equal(neighborPane(rects, "a", "right"), "b");
    assert.equal(neighborPane(rects, "b", "down"), "c");
    assert.equal(neighborPane(rects, "c", "up"), "b");
    assert.equal(neighborPane(rects, "c", "left"), "a");
    assert.equal(neighborPane(rects, "a", "left"), null);
    assert.equal(neighborPane(rects, "zz", "left"), null);
  });
});
