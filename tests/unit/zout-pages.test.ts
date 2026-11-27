// Layouts de página de zout: avance del pliegue de la AppBar, sección activa del índice de DocsLayout y los
// controladores que los conectan (sobre un DOM mínimo con el desplazamiento fijado a mano).
import "./helpers/dom.mjs";
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import fc from "fast-check";
import { activeSection, appBarProgress } from "../../zout/src/logic.ts";
import { wireAppBar, wireScrollspy } from "../../zout/src/pages.ts";

fc.configureGlobal({ seed: Number(process.env.ZUIX_FC_SEED ?? 20261122), numRuns: Number(process.env.ZUIX_FC_RUNS ?? 300) });
// Dos fotogramas: lo que la pieza pidió con requestAnimationFrame ya corrió (un plazo fijo de 40 ms fallaba con la
// máquina cargada, 1 de cada 3 veces).
const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(undefined))));

describe("lógica", () => {
  test("pliegue de la AppBar", () => {
    assert.equal(appBarProgress(0, 96), 0);
    assert.equal(appBarProgress(48, 96), 0.5);
    assert.equal(appBarProgress(500, 96), 1);
    assert.equal(appBarProgress(10, 0), 1);
    assert.equal(appBarProgress(0, 0), 0);
    fc.assert(
      fc.property(fc.double({ noNaN: true }), fc.double({ noNaN: true, min: 1, max: 1e4 }), (s, d) => {
        const p = appBarProgress(s, d);
        return p >= 0 && p <= 1;
      }),
    );
  });
  test("sección activa del índice", () => {
    assert.equal(activeSection([], 100), -1);
    assert.equal(activeSection([300, 600], 100), 0);
    assert.equal(activeSection([-200, 50, 400], 100), 1);
    assert.equal(activeSection([-200, -100, 400], 100, true), 2);
  });
});

describe("controladores", () => {
  test("AppBar: data-scrolled y respaldo del pliegue con el desplazamiento del contenedor", async () => {
    const scroller = document.createElement("div");
    scroller.style.overflowY = "auto";
    Object.defineProperty(scroller, "scrollHeight", { value: 2000 });
    Object.defineProperty(scroller, "clientHeight", { value: 400 });
    const bar = document.createElement("header");
    bar.className = "z-appbar";
    bar.setAttribute("data-collapse", "");
    bar.dataset.collapseDistance = "100";
    scroller.append(bar);
    document.body.append(scroller);
    // Sin animaciones ligadas al desplazamiento: el respaldo escribe el avance.
    const supports = CSS.supports;
    CSS.supports = () => false;
    const off = wireAppBar(bar);
    CSS.supports = supports;
    assert.equal(bar.hasAttribute("data-scrolled"), false);
    scroller.scrollTop = 50;
    scroller.dispatchEvent(new Event("scroll"));
    await frame();
    assert.equal(bar.hasAttribute("data-scrolled"), true);
    assert.equal(bar.style.getPropertyValue("--z-appbar-progress"), "0.5");
    scroller.scrollTop = 400;
    scroller.dispatchEvent(new Event("scroll"));
    await frame();
    assert.equal(bar.hasAttribute("data-collapsed"), true);
    off();
    scroller.remove();
  });
  test("índice: marca el enlace de la sección que se lee", async () => {
    const layout = document.createElement("div");
    layout.className = "z-docs-layout";
    layout.innerHTML =
      '<article class="z-docs-layout__article"><h2 id="a">A</h2><h2 id="b">B</h2></article><nav class="z-docs-layout__toc"><a href="#a">A</a><a href="#b">B</a></nav>';
    document.body.append(layout);
    const [a, b] = [document.getElementById("a")!, document.getElementById("b")!];
    a.getBoundingClientRect = () => ({ top: -300 }) as DOMRect;
    b.getBoundingClientRect = () => ({ top: 50 }) as DOMRect;
    const seen: string[] = [];
    const off = wireScrollspy(layout.querySelector("nav")!, (id) => seen.push(id));
    const links = layout.querySelectorAll("a");
    assert.equal(links[1]!.getAttribute("aria-current"), "true");
    assert.equal(links[0]!.hasAttribute("aria-current"), false);
    b.getBoundingClientRect = () => ({ top: 900 }) as DOMRect;
    window.dispatchEvent(new Event("scroll"));
    await frame();
    assert.equal(links[0]!.getAttribute("aria-current"), "true");
    assert.deepEqual(seen, ["b", "a"]);
    off();
    layout.remove();
  });
});
