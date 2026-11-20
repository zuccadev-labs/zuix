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
