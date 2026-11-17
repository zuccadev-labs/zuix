// Paginación con elipsis. El cálculo del rango es privado y está duplicado (Pagination.tsx `range`,
// dom/collections.ts `pageRange`): se prueba por el marcado que produce cada lado y se exige que coincidan.
import { click, mount } from "./helpers/dom.mjs";
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { contractHtml } from "./helpers/contract.mjs";
import { render } from "./helpers/react.mjs";

document.body.setAttribute("data-z-dom", "");
const dom = await import("../../zui/src/dom/index.ts");
const { Pagination } = await import("../../zui/src/components/navigation/Pagination.tsx");
await import("../../zicon/src/all.ts");
dom.init();

/** Secuencia que pinta React: números de página y 0 por cada hueco. */
function reactRange(page, pageCount, siblingCount) {
  const html = render(Pagination, { page, pageCount, siblingCount, onPageChange() {} });
  return [...html.matchAll(/<button[^>]*aria-label="Page (\d+)"[^>]*>|<span class="z-pagination__gap"/g)].map((m) =>
    m[1] ? Number(m[1]) : 0,
  );
}
const reactCurrent = (page, pageCount, siblingCount) =>
  render(Pagination, { page, pageCount, siblingCount, onPageChange() {} }).match(/aria-current="page"[^>]*>(\d+)</)?.[1];

/** Navegación sin framework a partir del marcado del contrato, con `count` páginas. */
function domNav(count, siblings) {
  const nav = mount(contractHtml("Pagination"));
  nav.dataset.pageCount = String(count);
  if (siblings !== undefined) nav.dataset.siblings = String(siblings);
  return nav;
}
const domRange = (nav) =>
  [...nav.children].slice(1, -1).map((el) => (el.classList.contains("z-pagination__gap") ? 0 : Number(el.textContent)));
const domCurrent = (nav) => nav.querySelector('[aria-current="page"]')?.textContent;

describe("rango con huecos (React)", () => {
  test("casos de referencia con un vecino", () => {
    assert.deepEqual(reactRange(1, 20, 1), [1, 2, 3, 4, 5, 0, 20]);
    assert.deepEqual(reactRange(5, 20, 1), [1, 0, 4, 5, 6, 0, 20]);
    assert.deepEqual(reactRange(20, 20, 1), [1, 0, 16, 17, 18, 19, 20]);
  });
  test("el hueco aparece justo cuando oculta al menos una página", () => {
    assert.deepEqual(reactRange(3, 20, 1), [1, 2, 3, 4, 5, 0, 20]);
    assert.deepEqual(reactRange(4, 20, 1), [1, 0, 3, 4, 5, 0, 20]);
    assert.deepEqual(reactRange(17, 20, 1), [1, 0, 16, 17, 18, 0, 20]);
    assert.deepEqual(reactRange(18, 20, 1), [1, 0, 16, 17, 18, 19, 20]);
  });
  test("si caben todas no hay huecos (hasta 2·vecinos + 5)", () => {
    assert.deepEqual(reactRange(4, 7, 1), [1, 2, 3, 4, 5, 6, 7]);
    assert.deepEqual(reactRange(4, 8, 1), [1, 0, 3, 4, 5, 0, 8]);
    assert.deepEqual(reactRange(3, 5, 0), [1, 2, 3, 4, 5]);
    assert.deepEqual(reactRange(3, 6, 0), [1, 0, 3, 0, 6]);
  });
  test("sin vecinos y con dos vecinos", () => {
    assert.deepEqual(reactRange(10, 20, 0), [1, 0, 10, 0, 20]);
    assert.deepEqual(reactRange(10, 20, 2), [1, 0, 8, 9, 10, 11, 12, 0, 20]);
  });
  test("una sola página, cero, negativos y fracciones", () => {
    assert.deepEqual(reactRange(1, 1, 1), [1]);
    assert.deepEqual(reactRange(1, 0, 1), [1]);
    assert.deepEqual(reactRange(1, -3, 1), [1]);
    assert.deepEqual(reactRange(1, 3.9, 1), [1, 2, 3]);
  });
  test("la página actual se acota a [1, pageCount]", () => {
    assert.equal(reactCurrent(0, 20, 1), "1");
    assert.equal(reactCurrent(-5, 20, 1), "1");
    assert.equal(reactCurrent(99, 20, 1), "20");
  });
  test("un siblingCount negativo cuenta como 0", () => {
    assert.deepEqual(reactRange(10, 20, -4), reactRange(10, 20, 0));
  });
  test("anterior y siguiente se desactivan en los extremos", () => {
    const first = render(Pagination, { page: 1, pageCount: 3, onPageChange() {} });
    assert.match(first, /aria-label="Previous page" disabled=""/);
    assert.doesNotMatch(first, /aria-label="Next page" disabled/);
    const last = render(Pagination, { page: 3, pageCount: 3, onPageChange() {} });
    assert.match(last, /aria-label="Next page" disabled=""/);
    const only = render(Pagination, { page: 1, pageCount: 1, onPageChange() {} });
    assert.match(only, /aria-label="Previous page" disabled=""/);
    assert.match(only, /aria-label="Next page" disabled=""/);
  });
  test("invariantes para todo (página, total, vecinos)", () => {
    for (let siblings = 0; siblings <= 3; siblings++) {
      const slots = siblings * 2 + 5;
      for (let count = 1; count <= 40; count++) {
        for (let page = 1; page <= count; page++) {
          const range = reactRange(page, count, siblings);
          const where = `página ${page} de ${count}, vecinos ${siblings}: [${range}]`;
          const pages = range.filter((n) => n !== 0);
          assert.equal(pages[0], 1, where);
          assert.equal(pages.at(-1), count, where);
          assert.ok(pages.includes(page), where);
          assert.ok(
            pages.every((n, i) => i === 0 || n > pages[i - 1]),
            `creciente y sin repetir — ${where}`,
          );
          // Ancho constante: con huecos, siempre el mismo número de casillas.
          assert.equal(range.length, Math.min(count, slots), where);
          // Un hueco siempre oculta al menos una página, y nunca hay dos seguidos.
          range.forEach((n, i) => {
            if (n !== 0) return;
            assert.ok(range[i - 1] !== 0 && range[i + 1] !== 0, where);
            assert.ok(range[i + 1] - range[i - 1] > 1, where);
          });
          // Los vecinos de la página actual están a la vista.
          for (let n = Math.max(1, page - siblings); n <= Math.min(count, page + siblings); n++) assert.ok(pages.includes(n), where);
        }
      }
    }
  });
  test("pageCount no numérico (NaN) se trata como una sola página", () => {
    const html = render(Pagination, { page: 1, pageCount: Number.NaN, onPageChange() {} });
    assert.deepEqual(
      [...html.matchAll(/aria-label="Page (\d+)"/g)].map((m) => Number(m[1])),
      [1],
    );
    assert.match(html, /aria-label="Next page" disabled=""/);
  });
  test("una página fraccionaria se redondea, como hace setPage en el comportamiento DOM", () => {
    assert.equal(reactCurrent(2.5, 20, 1), "3");
  });
});

describe("comportamiento DOM (setPage) y paridad con React", () => {
  test("el marcado del contrato equivale a la página 1 de 20", () => {
    assert.deepEqual(domRange(domNav(20)), reactRange(1, 20, 1));
  });
  test("mismo rango que React en todo el recorrido, hacia delante y hacia atrás", () => {
    for (const siblings of [0, 1, 2]) {
      for (const count of [1, 2, 5, 6, 7, 8, 9, 20, 33]) {
        const nav = domNav(count, siblings);
        const order = [...Array.from({ length: count }, (_, i) => i + 1), ...Array.from({ length: count }, (_, i) => count - i)];
        for (const page of order) {
          dom.setPage(nav, page);
          assert.deepEqual(domRange(nav), reactRange(page, count, siblings), `página ${page} de ${count}, vecinos ${siblings}`);
          assert.equal(domCurrent(nav), String(page));
        }
      }
    }
  });
  test("saltos arbitrarios reutilizan botones sin dejar duplicados ni huecos sueltos", () => {
    const nav = domNav(50, 1);
    for (const page of [25, 1, 50, 2, 49, 26, 24, 4, 47, 5]) {
      dom.setPage(nav, page);
      assert.deepEqual(domRange(nav), reactRange(page, 50, 1), `página ${page}`);
      assert.equal(nav.querySelectorAll('[aria-current="page"]').length, 1);
    }
  });
  test("emite z:change solo cuando la página cambia de verdad", () => {
    const nav = domNav(20);
    const values = [];
    nav.addEventListener("z:change", (event) => values.push(event.detail.value));
    dom.setPage(nav, 1);
    dom.setPage(nav, 7);
    dom.setPage(nav, 7);
    dom.setPage(nav, 999);
    dom.setPage(nav, 20);
    assert.deepEqual(values, [7, 20]);
  });
  test("acota fuera de rango y redondea fracciones y valores no numéricos", () => {
    const nav = domNav(20);
    dom.setPage(nav, -3);
    assert.equal(domCurrent(nav), "1");
    dom.setPage(nav, 3.6);
    assert.equal(domCurrent(nav), "4");
    dom.setPage(nav, 1e9);
    assert.equal(domCurrent(nav), "20");
  });
  test("setPage(NaN) no deja la navegación sin página actual", () => {
    const nav = domNav(20);
    dom.setPage(nav, 5);
    dom.setPage(nav, Number.NaN);
    assert.equal(nav.querySelectorAll('[aria-current="page"]').length, 1);
  });
  test("anterior y siguiente por clic; desactivados en los extremos", () => {
    const nav = domNav(3);
    dom.setPage(nav, 1);
    const [previous, next] = [nav.firstElementChild, nav.lastElementChild];
    assert.equal(previous.disabled, true);
    click(next);
    assert.equal(domCurrent(nav), "2");
    click(next);
    assert.equal(domCurrent(nav), "3");
    assert.equal(next.disabled, true);
    click(previous);
    assert.equal(domCurrent(nav), "2");
  });
  test("las páginas nuevas heredan el nombre accesible del patrón", () => {
    const nav = domNav(20);
    dom.setPage(nav, 10);
    assert.equal(nav.querySelector('[aria-current="page"]').getAttribute("aria-label"), "Page 10");
    nav.dataset.pageLabel = "Ir a la página {page}";
    dom.setPage(nav, 15);
    assert.equal(nav.querySelector('[aria-current="page"]').getAttribute("aria-label"), "Ir a la página 15");
  });
  test("sin data-page-count el total sale del mayor número pintado", () => {
    const nav = mount(contractHtml("Pagination"));
    delete nav.dataset.pageCount;
    dom.setPage(nav, 999);
    assert.equal(domCurrent(nav), "20");
  });
});
