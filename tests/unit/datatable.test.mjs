// Orden de DataTable. `compare` es privado en los dos lados (DataTable.tsx y dom/collections.ts): se prueba por el
// orden de las filas que pinta React (prop `sort`) y por `sortTable` del comportamiento DOM.
import { click, mount } from "./helpers/dom.mjs";
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { contractHtml } from "./helpers/contract.mjs";
import { render } from "./helpers/react.mjs";

document.body.setAttribute("data-z-dom", "");
const dom = await import("../../zui/src/dom/index.ts");
const { DataTable } = await import("../../zui/src/components/data/DataTable.tsx");
await import("../../zicon/src/all.ts");
dom.init();

/** Ids de las filas tal como las ordena React por la columna `v`. */
function reactOrder(values, direction, extra = {}) {
  const rows = values.map((v, i) => ({ id: `r${i}`, v }));
  const columns = [
    { key: "id", header: "Id", accessor: (row) => row.id },
    { key: "v", header: "V", accessor: (row) => row.v, sortable: true, render: () => "·" },
  ];
  const html = render(DataTable, { rows, columns, rowKey: (row) => row.id, sort: direction ? { key: "v", direction } : null, ...extra });
  return [...html.matchAll(/<td[^>]*>(r\d+)<\/td>/g)].map((m) => Number(m[1].slice(1)));
}

describe("DataTable (React): comparación de valores", () => {
  test("números: orden numérico, no alfabético", () => {
    assert.deepEqual(reactOrder([10, 9, 100, -1, 0], "asc"), [3, 4, 1, 0, 2]);
    assert.deepEqual(reactOrder([10, 9, 100, -1, 0], "desc"), [2, 0, 1, 4, 3]);
  });
  test("texto: sin distinguir mayúsculas ni acentos, con números naturales", () => {
    assert.deepEqual(reactOrder(["item 10", "Item 9", "item 2"], "asc"), [2, 1, 0]);
    assert.deepEqual(reactOrder(["b", "A", "c"], "asc"), [1, 0, 2]);
    // sensitivity "base": "é" y "e" empatan y el orden original desempata.
    assert.deepEqual(reactOrder(["éclair", "eclair", "dune"], "asc"), [2, 0, 1]);
  });
  test("fechas: por instante", () => {
    const d = (iso) => new Date(iso);
    assert.deepEqual(reactOrder([d("2025-03-02"), d("2024-11-30"), d("2026-01-15")], "asc"), [1, 0, 2]);
    assert.deepEqual(reactOrder([d("2025-03-02"), d("2024-11-30"), d("2026-01-15")], "desc"), [2, 0, 1]);
  });
  test("booleanos: false antes que true", () => {
    assert.deepEqual(reactOrder([true, false, true, false], "asc"), [1, 3, 0, 2]);
  });
  test("los vacíos (null, undefined) van al final en los dos sentidos", () => {
    assert.deepEqual(reactOrder([null, 3, undefined, 1], "asc"), [3, 1, 0, 2]);
    assert.deepEqual(reactOrder([null, 3, undefined, 1], "desc"), [1, 3, 0, 2]);
  });
  test("orden estable: los empates conservan el orden original, también en descendente", () => {
    assert.deepEqual(reactOrder([2, 1, 2, 1, 2], "asc"), [1, 3, 0, 2, 4]);
    assert.deepEqual(reactOrder([2, 1, 2, 1, 2], "desc"), [0, 2, 4, 1, 3]);
  });
  test("0 y cadena vacía no son vacíos: se ordenan como valores", () => {
    assert.deepEqual(reactOrder([1, 0, null, -1], "asc"), [3, 1, 0, 2]);
    assert.deepEqual(reactOrder(["b", "", null, "a"], "asc"), [1, 3, 0, 2]);
  });
  test("sin orden, con manualSort o con una columna sin accessor, las filas no se tocan", () => {
    assert.deepEqual(reactOrder([3, 1, 2], null), [0, 1, 2]);
    assert.deepEqual(reactOrder([3, 1, 2], "asc", { manualSort: true }), [0, 1, 2]);
    assert.deepEqual(reactOrder([3, 1, 2], "asc", { sort: { key: "no-existe", direction: "asc" } }), [0, 1, 2]);
  });
  test("no muta el array de filas recibido", () => {
    const rows = [
      { id: "r0", v: 2 },
      { id: "r1", v: 1 },
    ];
    const frozen = Object.freeze([...rows]);
    render(DataTable, {
      rows: frozen,
      columns: [{ key: "v", header: "V", accessor: (row) => row.v, sortable: true }],
      rowKey: (row) => row.id,
      sort: { key: "v", direction: "asc" },
    });
    assert.deepEqual(frozen, rows);
  });
  test("aria-sort refleja la dirección y solo en columnas ordenables", () => {
    const columns = [
      { key: "a", header: "A", accessor: (row) => row.a, sortable: true },
      { key: "b", header: "B", accessor: (row) => row.a },
    ];
    const html = (sort) => render(DataTable, { rows: [{ a: 1 }], columns, rowKey: () => "k", sort });
    assert.equal([...html({ key: "a", direction: "asc" }).matchAll(/aria-sort="(\w+)"/g)].map((m) => m[1]).join(), "ascending");
    assert.match(html({ key: "a", direction: "desc" }), /aria-sort="descending"/);
    assert.match(html(null), /aria-sort="none"/);
  });
  test("sin filas se pinta el estado vacío ocupando todas las columnas", () => {
    const html = render(DataTable, {
      rows: [],
      columns: [
        { key: "a", header: "A" },
        { key: "b", header: "B" },
      ],
      rowKey: () => "k",
    });
    assert.match(html, /<td class="z-table__empty" colSpan="2">No data<\/td>/i);
  });
  test("números NaN no rompen el orden del resto", () => {
    assert.deepEqual(reactOrder([3, Number.NaN, 1, 2], "asc"), [2, 3, 0, 1]);
  });
});

describe("sortTable (comportamiento DOM)", () => {
  const table = () => mount(contractHtml("DataTable")).querySelector("table");
  const names = (t) => [...t.tBodies[0].rows].map((row) => row.cells[0].textContent);
  const th = (t, key) => t.querySelector(`th[data-key="${key}"]`);

  test("texto ascendente y descendente", () => {
    const t = table();
    dom.sortTable(th(t, "name"), "desc");
    assert.deepEqual(names(t), ["Zoe Katz", "Mia Chen", "Leo Park", "Ana Ruiz"]);
    dom.sortTable(th(t, "name"), "asc");
    assert.deepEqual(names(t), ["Ana Ruiz", "Leo Park", "Mia Chen", "Zoe Katz"]);
  });
  test("data-sort=number ordena 12 después de 7", () => {
    const t = table();
    dom.sortTable(th(t, "seats"), "asc");
    assert.deepEqual(names(t), ["Mia Chen", "Ana Ruiz", "Zoe Katz", "Leo Park"]);
  });
  test("data-sort=date usa data-sort-value, no el texto visible", () => {
    const t = table();
    dom.sortTable(th(t, "joined"), "asc");
    assert.deepEqual(names(t), ["Mia Chen", "Ana Ruiz", "Zoe Katz", "Leo Park"]);
    dom.sortTable(th(t, "joined"), "desc");
    assert.deepEqual(names(t), ["Leo Park", "Zoe Katz", "Ana Ruiz", "Mia Chen"]);
  });
  test("direction null devuelve el orden original del marcado", () => {
    const t = table();
    const original = names(t);
    dom.sortTable(th(t, "seats"), "desc");
    dom.sortTable(th(t, "joined"), "asc");
    dom.sortTable(th(t, "joined"), null);
    assert.deepEqual(names(t), original);
  });
  test("números con separadores y unidades; los vacíos y los que no se pueden leer, al final en ambos sentidos", () => {
    const t = table();
    const cells = [...t.tBodies[0].rows].map((row) => row.cells[1]);
    cells[0].textContent = "1,200 €";
    cells[1].textContent = "1.2.3";
    cells[2].textContent = "";
    cells[3].textContent = "-5";
    dom.sortTable(th(t, "seats"), "asc");
    assert.deepEqual(names(t), ["Zoe Katz", "Ana Ruiz", "Leo Park", "Mia Chen"]);
    dom.sortTable(th(t, "seats"), "desc");
    assert.deepEqual(names(t), ["Ana Ruiz", "Zoe Katz", "Leo Park", "Mia Chen"]);
  });
  test("un texto sin ninguna cifra en una columna numérica cuenta como vacío", () => {
    const t = table();
    const cells = [...t.tBodies[0].rows].map((row) => row.cells[1]);
    cells[1].textContent = "n/d";
    cells[3].textContent = "-5";
    dom.sortTable(th(t, "seats"), "asc");
    assert.equal(names(t).at(-1), "Leo Park");
  });
  test("fechas inválidas van al final", () => {
    const t = table();
    t.tBodies[0].rows[0].cells[2].dataset.sortValue = "no es una fecha";
    dom.sortTable(th(t, "joined"), "asc");
    assert.equal(names(t).at(-1), "Ana Ruiz");
  });
  test("orden estable con empates", () => {
    const t = table();
    for (const row of t.tBodies[0].rows) row.cells[1].textContent = "5";
    const original = names(t);
    dom.sortTable(th(t, "seats"), "asc");
    assert.deepEqual(names(t), original);
    dom.sortTable(th(t, "seats"), "desc");
    assert.deepEqual(names(t), original);
  });
  test("aria-sort y evento z:sort", () => {
    const t = table();
    const events = [];
    t.addEventListener("z:sort", (event) => events.push(event.detail));
    dom.sortTable(th(t, "seats"), "desc");
    assert.equal(th(t, "seats").getAttribute("aria-sort"), "descending");
    assert.equal(th(t, "name").getAttribute("aria-sort"), "none");
    assert.equal(th(t, "seats").querySelector("z-icon").getAttribute("name"), "arrow-down");
    assert.deepEqual(events, [{ key: "seats", direction: "desc", column: 1 }]);
  });
  test("data-manual-sort: cambia la cabecera y emite, pero no reordena", () => {
    const t = table();
    t.setAttribute("data-manual-sort", "");
    const original = names(t);
    dom.sortTable(th(t, "name"), "desc");
    assert.deepEqual(names(t), original);
    assert.equal(th(t, "name").getAttribute("aria-sort"), "descending");
  });
  test("el clic en la cabecera recorre ascendente, descendente y sin orden", () => {
    const t = table();
    const header = th(t, "seats");
    const states = [];
    for (let i = 0; i < 4; i++) {
      click(header.querySelector(".z-table__sort"));
      states.push(header.getAttribute("aria-sort"));
    }
    assert.deepEqual(states, ["ascending", "descending", "none", "ascending"]);
  });
  test("la fila de estado vacío no se ordena ni se pierde", () => {
    const t = table();
    t.tBodies[0].innerHTML = '<tr><td class="z-table__empty" colspan="3">No data</td></tr>';
    dom.sortTable(th(t, "name"), "asc");
    assert.equal(t.tBodies[0].rows.length, 1);
  });
});
