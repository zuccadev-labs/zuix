// Oleada 4: lógica compartida de las capas y la navegación de aplicación (`zui/src/core`). Cada módulo la usan a la
// vez el binding de React y `@zuccadev-labs/zuix-zui/dom`; aquí se prueba directamente, sobre happy-dom.
import { mount } from "./helpers/dom.mjs";
import assert from "node:assert/strict";
import { describe, test } from "node:test";

const core = (name) => import(`../../zui/src/core/${name}.ts`);
const toolbar = await core("toolbar");
const focus = await core("focus");

describe("core/toolbar", () => {
  const bar = () =>
    mount(`<div role="toolbar" aria-label="Format">
      <div role="group" aria-label="Style"><button id="b">B</button><button id="i">I</button></div>
      <div role="separator"></div>
      <button id="dis" disabled>D</button>
      <button id="soft" aria-disabled="true">S</button>
      <input id="text" type="text">
      <div popover><button id="inside">x</button></div>
      <div role="toolbar" aria-label="Nested"><button id="nested">n</button></div>
    </div>`);

  test("controles propios, sin deshabilitados ni los de capas o barras anidadas", () => {
    const el = bar();
    assert.deepEqual(
      toolbar.toolbarItems(el).map((item) => item.id),
      ["b", "i", "soft", "text"],
    );
  });

  test("una sola parada de tabulación, que sigue al control elegido", () => {
    const el = bar();
    assert.equal(toolbar.setToolbarStop(el)?.id, "b");
    const stops = () => toolbar.toolbarItems(el).filter((item) => item.tabIndex === 0);
    assert.equal(stops().length, 1);
    toolbar.setToolbarStop(el, el.querySelector("#soft"));
    assert.deepEqual(
      stops().map((item) => item.id),
      ["soft"],
    );
    // Sin elección, se queda la parada que había.
    assert.equal(toolbar.setToolbarStop(el)?.id, "soft");
  });

  test("flechas del eje con vuelta, Inicio y Fin; vertical y RTL", () => {
    const el = bar();
    const at = (id, key) => toolbar.toolbarTarget(el, el.querySelector(`#${id}`), key)?.id;
    assert.equal(at("b", "ArrowRight"), "i");
    assert.equal(at("i", "ArrowRight"), "soft");
    assert.equal(at("b", "ArrowLeft"), "text");
    assert.equal(at("i", "Home"), "b");
    assert.equal(at("b", "End"), "text");
    assert.equal(at("b", "ArrowDown"), undefined);
    // Un campo de texto conserva sus flechas.
    assert.equal(at("text", "ArrowLeft"), undefined);
    assert.equal(at("text", "Home"), undefined);
    el.setAttribute("aria-orientation", "vertical");
    assert.equal(at("b", "ArrowDown"), "i");
    assert.equal(at("b", "ArrowRight"), undefined);
    el.removeAttribute("aria-orientation");
    el.setAttribute("dir", "rtl");
    el.style.direction = "rtl";
    assert.equal(at("i", "ArrowLeft"), "soft");
    // Un elemento ajeno a la barra no navega.
    assert.equal(toolbar.toolbarTarget(el, el.querySelector("#nested"), "ArrowRight"), undefined);
  });
});

describe("core/focus: nextTabbable", () => {
  test("el siguiente tabulable fuera del elemento, o ninguno", () => {
    mount(
      `<div><button id="a">a</button><section id="s"><button id="in">in</button></section><button id="b" tabindex="-1">b</button><a id="c" href="#x">c</a></div>`,
    );
    const section = document.getElementById("s");
    for (const el of document.querySelectorAll("button, a")) el.getClientRects = () => [{}];
    assert.equal(focus.nextTabbable(section)?.id, "c");
    assert.equal(focus.nextTabbable(document.getElementById("c")), undefined);
  });
});

describe("core/menubar", async () => {
  const { menubarKey, menubarIndex } = await core("menubar");
  test("teclas en un título", () => {
    assert.deepEqual(menubarKey("ArrowRight", { at: "trigger" }), { type: "move", to: "next" });
    assert.deepEqual(menubarKey("ArrowLeft", { at: "trigger" }), { type: "move", to: "prev" });
    assert.deepEqual(menubarKey("Home", { at: "trigger" }), { type: "move", to: "first" });
    assert.deepEqual(menubarKey("End", { at: "trigger" }), { type: "move", to: "last" });
    for (const key of ["ArrowDown", "Enter", " "]) assert.deepEqual(menubarKey(key, { at: "trigger" }), { type: "open", focus: "first" });
    assert.deepEqual(menubarKey("ArrowUp", { at: "trigger" }), { type: "open", focus: "last" });
    assert.equal(menubarKey("a", { at: "trigger" }), null);
  });
  test("teclas dentro de un menú: izquierda solo en el primer nivel, derecha sin submenú", () => {
    assert.deepEqual(menubarKey("ArrowLeft", { at: "menu", depth: 0 }), { type: "move", to: "prev" });
    assert.equal(menubarKey("ArrowLeft", { at: "menu", depth: 1 }), null);
    assert.deepEqual(menubarKey("ArrowRight", { at: "menu", depth: 2 }), { type: "move", to: "next" });
    assert.equal(menubarKey("ArrowRight", { at: "menu", depth: 0, opensSubmenu: true }), null);
    assert.equal(menubarKey("ArrowDown", { at: "menu" }), null);
  });
  test("índices con vuelta", () => {
    assert.equal(menubarIndex("next", 2, 3), 0);
    assert.equal(menubarIndex("prev", 0, 3), 2);
    assert.equal(menubarIndex("first", 2, 3), 0);
    assert.equal(menubarIndex("last", 0, 3), 2);
    assert.equal(menubarIndex("next", 0, 0), -1);
  });
});

describe("core/place: arrowOffset y core/anchor", async () => {
  const { arrowOffset } = await core("place");
  const anchor = await core("anchor");
  test("la flecha apunta al centro del ancla, acotada a las esquinas y reflejada en RTL", () => {
    const a = { left: 100, top: 100, width: 40, height: 20 };
    assert.equal(arrowOffset(a, { left: 90, top: 130, width: 200, height: 80 }, "bottom"), 30);
    assert.equal(arrowOffset(a, { left: 90, top: 130, width: 200, height: 80 }, "bottom", { rtl: true }), 170);
    assert.equal(arrowOffset(a, { left: 0, top: 130, width: 60, height: 80 }, "top"), 48);
    assert.equal(arrowOffset({ left: 0, top: 0, width: 4, height: 4 }, { left: 0, top: 10, width: 200, height: 80 }, "bottom"), 12);
    assert.equal(arrowOffset(a, { left: 150, top: 60, width: 120, height: 200 }, "right"), 50);
  });
  test("position-area por colocación", () => {
    assert.equal(anchor.positionArea("bottom"), "bottom");
    assert.equal(anchor.positionArea("bottom-start"), "bottom span-x-end");
    assert.equal(anchor.positionArea("top-end"), "top span-x-start");
    assert.equal(anchor.positionArea("right-start"), "right span-bottom");
    assert.equal(anchor.positionArea("left-end"), "left span-top");
  });
  test("lado medido y capa pegada al ancla", () => {
    const a = { left: 100, top: 100, width: 40, height: 20 };
    assert.equal(anchor.sideOf(a, { left: 90, top: 126, width: 100, height: 50 }), "bottom");
    assert.equal(anchor.sideOf(a, { left: 90, top: 40, width: 100, height: 54 }), "top");
    assert.equal(anchor.sideOf(a, { left: 146, top: 90, width: 100, height: 50 }), "right");
    assert.equal(anchor.sideOf(a, { left: 0, top: 90, width: 94, height: 50 }), "left");
    assert.equal(anchor.adjacent(a, { left: 90, top: 126, width: 100, height: 50 }, "bottom", 6), true);
    assert.equal(anchor.adjacent(a, { left: 90, top: 8400, width: 100, height: 50 }, "bottom", 6), false);
    assert.equal(anchor.adjacent(a, { left: 400, top: 126, width: 100, height: 50 }, "bottom", 6), false);
    assert.equal(anchor.adjacent(a, { left: 90, top: 40, width: 100, height: 54 }, "top", 6), true);
    assert.equal(anchor.adjacent(a, { left: 146, top: 90, width: 100, height: 50 }, "right", 6), true);
    assert.equal(anchor.adjacent(a, { left: 0, top: 90, width: 94, height: 50 }, "left", 6), true);
  });
  test("sin soporte de CSS anchor positioning no ancla (respaldo de ./place)", () => {
    const supports = CSS.supports;
    CSS.supports = () => false;
    try {
      const el = mount(`<div><button id="t">t</button><div id="p" popover></div></div>`);
      assert.equal(anchor.supportsAnchor(), false);
      assert.equal(anchor.anchorWithCss(el.querySelector("#p"), el.querySelector("#t"), "bottom", 6), null);
    } finally {
      CSS.supports = supports;
    }
  });
  test("con soporte: escribe el ancla, la mide y la retira", () => {
    const supports = CSS.supports;
    CSS.supports = () => true;
    try {
      const root = mount(`<div><button id="t" style="anchor-name: --app">t</button><div id="p" popover></div></div>`);
      const trigger = root.querySelector("#t");
      const pop = root.querySelector("#p");
      trigger.getBoundingClientRect = () => new DOMRect(100, 100, 40, 20);
      pop.getBoundingClientRect = () => new DOMRect(100, 126, 120, 60);
      const css = anchor.anchorWithCss(pop, trigger, "bottom-start", 6);
      assert.ok(css);
      assert.match(trigger.style.getPropertyValue("anchor-name"), /^--app, --z-anchor-\d+$/);
      assert.equal(pop.style.getPropertyValue("position-area"), "bottom span-x-end");
      assert.equal(pop.style.getPropertyValue("margin-top"), "6px");
      assert.equal(css.measure(), true);
      assert.equal(pop.dataset.side, "bottom");
      assert.equal(pop.style.getPropertyValue("--z-arrow-offset"), "20px");
      css.release();
      assert.equal(trigger.style.getPropertyValue("anchor-name"), "--app");
      assert.equal(pop.hasAttribute("data-anchored"), false);
      assert.equal(pop.style.getPropertyValue("position-area"), "");
    } finally {
      CSS.supports = supports;
    }
  });
});

describe("core/interest", async () => {
  const { createInterest, bridgeTab } = await core("interest");
  test("abre tras el retardo, el foco abre ya, cruzar a la capa no la cierra y Escape cierra", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const log = [];
    const interest = createInterest({ openDelay: 500, closeDelay: 300, onChange: (open) => log.push(open) });
    interest.enter("trigger-pointer");
    t.mock.timers.tick(499);
    assert.deepEqual(log, []);
    t.mock.timers.tick(1);
    assert.deepEqual(log, [true]);
    interest.leave("trigger-pointer");
    t.mock.timers.tick(100);
    interest.enter("content-pointer");
    t.mock.timers.tick(1000);
    assert.equal(interest.isOpen(), true, "el puntero cruzó a la capa");
    interest.leave("content-pointer");
    t.mock.timers.tick(300);
    assert.deepEqual(log, [true, false]);
    interest.enter("trigger-focus");
    assert.deepEqual(log, [true, false, true], "el foco abre sin retardo");
    interest.hide();
    assert.equal(interest.isOpen(), false);
    interest.enter("trigger-pointer");
    interest.leave("trigger-pointer");
    t.mock.timers.tick(1000);
    assert.equal(interest.isOpen(), false, "un paso rápido no abre");
    interest.show();
    assert.equal(interest.isOpen(), true);
    interest.setDelays(0, 0);
    interest.enter("content-focus");
    interest.leave("content-focus");
    assert.equal(interest.isOpen(), false, "sin retardo de cierre");
    interest.dispose();
  });
  test("Tab entre el disparador y una capa montada aparte", () => {
    const root = mount(
      `<div><a id="t" href="#">t</a><div id="c"><button id="a">a</button><button id="b">b</button></div><button id="n">n</button></div>`,
    );
    const [trigger, content, a, b, next] = ["t", "c", "a", "b", "n"].map((id) => root.querySelector(`#${id}`));
    const ctx = { trigger, content, tabbables: [a, b], after: () => next };
    assert.deepEqual(bridgeTab(trigger, false, ctx), { focus: a, close: false });
    assert.equal(bridgeTab(trigger, true, ctx), null);
    assert.deepEqual(bridgeTab(a, true, ctx), { focus: trigger, close: false });
    assert.deepEqual(bridgeTab(b, false, ctx), { focus: next, close: true });
    assert.equal(bridgeTab(a, false, ctx), null);
    assert.equal(bridgeTab(next, false, ctx), null);
    assert.equal(bridgeTab(null, false, ctx), null);
    assert.equal(bridgeTab(trigger, false, { ...ctx, tabbables: [] }), null);
  });
});

describe("core/sheet", async () => {
  const { sheetRelease, snapKey } = await core("sheet");
  test("al soltar: cierra por debajo del menor o va al anclaje más cercano con la inercia", () => {
    const sizes = [400, 850];
    assert.deepEqual(sheetRelease({ offset: 100, velocity: 0, sizes, current: 1 }), { close: false, index: 1 });
    assert.deepEqual(sheetRelease({ offset: 300, velocity: 0, sizes, current: 1 }), { close: false, index: 0 });
    assert.deepEqual(sheetRelease({ offset: 100, velocity: 2, sizes, current: 1 }), { close: false, index: 0 });
    assert.deepEqual(sheetRelease({ offset: 250, velocity: 0, sizes, current: 0 }), { close: true });
    assert.deepEqual(sheetRelease({ offset: -400, velocity: 0, sizes, current: 0 }), { close: false, index: 1 });
    assert.deepEqual(sheetRelease({ offset: 50, velocity: 0, sizes: [300], current: 0 }), { close: false, index: 0 });
    assert.deepEqual(sheetRelease({ offset: 120, velocity: 0, sizes: [300], current: 0 }), { close: true });
    assert.deepEqual(sheetRelease({ offset: 10, velocity: 1, sizes: [300], current: 0 }), { close: true });
  });
  test("teclas del asa según el lado", () => {
    assert.equal(snapKey("ArrowUp", "bottom", 0, 2), 1);
    assert.equal(snapKey("ArrowDown", "bottom", 1, 2), 0);
    assert.equal(snapKey("ArrowDown", "top", 0, 3), 1);
    assert.equal(snapKey("PageUp", "top", 2, 3), 1);
    assert.equal(snapKey("ArrowRight", "left", 0, 2), 1);
    assert.equal(snapKey("ArrowRight", "right", 1, 2), 0);
    assert.equal(snapKey("End", "bottom", 0, 3), 2);
    assert.equal(snapKey("Home", "bottom", 2, 3), 0);
    assert.equal(snapKey("ArrowUp", "bottom", 1, 2), 1);
    assert.equal(snapKey("a", "bottom", 0, 2), undefined);
    assert.equal(snapKey("ArrowUp", "bottom", 0, 0), undefined);
  });
});

describe("core/tour", async () => {
  const tour = await core("tour");
  test("progreso, paso acotado, anillo y centro", () => {
    assert.equal(tour.tourProgress("Step {step} of {count}", 1, 4), "Step 2 of 4");
    assert.equal(tour.clampStep(9, 3), 2);
    assert.equal(tour.clampStep(-1, 3), 0);
    assert.equal(tour.clampStep(0, 0), -1);
    const view = { width: 1000, height: 800 };
    assert.deepEqual(tour.ringBox({ left: 10, top: 20, width: 100, height: 40 }, 6, view), { left: 4, top: 14, width: 112, height: 52 });
    assert.deepEqual(tour.ringBox({ left: 2, top: 2, width: 10, height: 10 }, 6, view), { left: 0, top: 0, width: 18, height: 18 });
    assert.equal(tour.ringBox(null, 6, view), null);
    assert.equal(tour.ringBox({ left: 0, top: 0, width: 0, height: 0 }, 6, view), null);
    assert.equal(tour.ringBox({ left: 2000, top: 20, width: 10, height: 10 }, 6, view), null);
    assert.deepEqual(tour.centerBox(view), { left: 500, top: 800 / 3, width: 0, height: 0 });
  });
  test("teclas laterales, reflejadas en RTL", () => {
    assert.equal(tour.tourKey("ArrowRight"), "next");
    assert.equal(tour.tourKey("ArrowLeft"), "prev");
    assert.equal(tour.tourKey("ArrowLeft", true), "next");
    assert.equal(tour.tourKey("Enter"), null);
  });
});
