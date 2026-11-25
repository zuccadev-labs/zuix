// Selección y paginación de DataTable: la lógica pura (core/selection), el marcado de React y el modo DOM
// (dom/datatable) sobre el contrato HTML.
import { click, mount, window } from "./helpers/dom.mjs";
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { contractHtml } from "./helpers/contract.mjs";
import { render } from "./helpers/react.mjs";

document.body.setAttribute("data-z-dom", "");
const dom = await import("../../zui/src/dom/index.ts");
const sel = await import("../../zui/src/core/selection.ts");
const { DataTable } = await import("../../zui/src/components/data/DataTable.tsx");
await import("../../zicon/src/all.ts");
dom.init();

describe("core/selection", () => {
  const order = ["a", "b", "c", "d", "e"];
  test("toggleKey alterna y respeta el orden de las filas", () => {
    assert.deepEqual(sel.toggleKey(["c"], "a", order), ["a", "c"]);
    assert.deepEqual(sel.toggleKey(["a", "c"], "a", order), ["c"]);
    assert.deepEqual(sel.toggleKey(["z"], "a", order), ["a", "z"]);
  });
  test("rangeKeys marca o desmarca entre el ancla y el objetivo, saltando las no seleccionables", () => {
    assert.deepEqual(sel.rangeKeys([], order, "b", "d"), ["b", "c", "d"]);
    assert.deepEqual(sel.rangeKeys([], order, "d", "b"), ["b", "c", "d"]);
    assert.deepEqual(
      sel.rangeKeys([], order, "a", "e", (k) => k !== "c"),
      ["a", "b", "d", "e"],
    );
    // El objetivo estaba marcado: el rango se desmarca.
    assert.deepEqual(sel.rangeKeys(["a", "b", "c", "d"], order, "a", "c"), ["d"]);
    // Sin ancla (o fuera de la vista), alterna el objetivo.
    assert.deepEqual(sel.rangeKeys(["a"], order, null, "c"), ["a", "c"]);
    assert.deepEqual(sel.rangeKeys(["a"], order, "x", "c"), ["a", "c"]);
  });
  test("headerState: sin marcar, indeterminada y marcada frente a lo visible", () => {
    assert.equal(sel.headerState([], ["a"]), "unchecked");
    assert.equal(sel.headerState(["a", "b"], []), "unchecked");
    assert.equal(sel.headerState(["a", "b"], ["b", "z"]), "indeterminate");
    assert.equal(sel.headerState(["a", "b"], ["a", "b"]), "checked");
  });
  test("toggleAll marca lo visible o lo desmarca, conservando el resto", () => {
    assert.deepEqual(sel.toggleAll(["z"], ["a", "b"], ["a", "b", "z"]), ["a", "b", "z"]);
    assert.deepEqual(sel.toggleAll(["a", "b", "z"], ["a", "b"], ["a", "b", "z"]), ["z"]);
    assert.deepEqual(sel.toggleAll(["a"], ["a", "b"]), ["a", "b"]);
  });
  test("pageSlice y pageCountOf", () => {
    assert.deepEqual(sel.pageSlice(42, 1, 10), { start: 0, end: 10, from: 1, to: 10 });
    assert.deepEqual(sel.pageSlice(42, 5, 10), { start: 40, end: 42, from: 41, to: 42 });
    assert.deepEqual(sel.pageSlice(42, 99, 10), { start: 40, end: 42, from: 41, to: 42 });
    assert.deepEqual(sel.pageSlice(42, Number.NaN, 10), { start: 0, end: 10, from: 1, to: 10 });
    assert.deepEqual(sel.pageSlice(0, 1, 10), { start: 0, end: 0, from: 0, to: 0 });
    assert.deepEqual(sel.pageSlice(5, 1, 0), { start: 0, end: 5, from: 1, to: 5 });
    assert.equal(sel.pageCountOf(42, 10), 5);
    assert.equal(sel.pageCountOf(0, 10), 1);
    assert.equal(sel.pageCountOf(10, 0), 1);
  });
});

const members = [
  { id: "a1", name: "Ana", seats: 3 },
  { id: "b2", name: "Leo", seats: 12 },
  { id: "c3", name: "Mia", seats: 1 },
  { id: "d4", name: "Zoe", seats: 7 },
  { id: "e5", name: "Iker", seats: 5 },
];
const columns = [
  { key: "name", header: "Name", accessor: (r) => r.name, sortable: true, footer: "Total" },
  { key: "seats", header: "Seats", accessor: (r) => r.seats, footer: (all) => all.reduce((s, r) => s + r.seats, 0) },
];
const html = (props) => render(DataTable, { rows: members, columns, rowKey: (r) => r.id, ...props });

describe("DataTable (React): selección, pie y paginación", () => {
  test("sin las props nuevas el marcado no cambia de forma (sin envoltorio ni casillas)", () => {
    const out = html({ columns: columns.map(({ footer, ...c }) => c) });
    assert.doesNotMatch(out, /z-datatable|z-table__select|<tfoot/);
  });
  test("casillas con nombre propio, cabecera indeterminada y conteo anunciado", () => {
    const out = html({ selectable: true, defaultSelectedKeys: ["b2"] });
    assert.match(out, /class="z-datatable"/);
    assert.match(out, /aria-label="Select all rows"[^>]*aria-checked="mixed"/);
    assert.match(out, /aria-label="Select row 2"[^>]*aria-checked="true"/);
    assert.match(out, /data-key="b2" data-selected="true"/);
    assert.match(out, /role="status"[^>]*>1 selected</);
  });
  test("todas seleccionadas: cabecera marcada; una fila no seleccionable queda fuera y deshabilitada", () => {
    const out = html({ selectable: true, selectedKeys: ["a1", "b2", "c3", "d4"], isRowSelectable: (r) => r.id !== "e5" });
    assert.match(out, /aria-label="Select all rows"[^>]*aria-checked="true"/);
    assert.match(out, /aria-label="Select row 5"[^>]*disabled=""/);
  });
  test("pie con contenido fijo y calculado sobre todas las filas", () => {
    const out = html({ pageSize: 2 });
    assert.match(out, /<tfoot><tr><td>Total<\/td><td>28<\/td><\/tr><\/tfoot>/);
  });
  test("paginación: porción de las filas ordenadas, rango y página acotada", () => {
    const out = html({ pageSize: 2, page: 2, sort: { key: "name", direction: "asc" } });
    const names = [...out.matchAll(/<td>([A-Z][a-z]+)<\/td>/g)].map((m) => m[1]).filter((n) => n !== "Total");
    assert.deepEqual(names, ["Leo", "Mia"]);
    assert.match(out, /class="z-datatable__range">3–4 of 5</);
    assert.match(out, /aria-current="page"[^>]*>2</);
    assert.match(html({ pageSize: 2, page: 9 }), /5–5 of 5/);
  });
  test("paginación en servidor: las filas recibidas son la página y rowCount el total", () => {
    const out = html({ pageSize: 2, page: 3, manualPagination: true, rowCount: 40, rows: members.slice(0, 2) });
    assert.match(out, /5–6 of 40/);
    const body = /<tbody>([\s\S]*)<\/tbody>/.exec(out)?.[1] ?? "";
    assert.equal([...body.matchAll(/<tr\b/g)].length, 2);
  });
  test("sin filas: el vacío ocupa también la columna de casillas y la cabecera queda deshabilitada", () => {
    const out = html({ rows: [], selectable: true, pageSize: 5 });
    assert.match(out, /colSpan="3"/i);
    assert.match(out, /aria-label="Select all rows"[^>]*disabled=""/);
    assert.match(out, /0–0 of 0/);
  });
});

describe("DataTable (modo DOM): selección y paginación", () => {
  const table = () => {
    const root = mount(contractHtml("DataTable", 1));
    dom.hydrate(root.parentElement);
    return root;
  };
  const visible = (root) => [...root.querySelectorAll("tbody tr")].filter((row) => !row.hidden).map((row) => row.dataset.key);
  const box = (root, key) => root.querySelector(`tr[data-key="${key}"] [role="checkbox"]`);
  const all = (root) => root.querySelector("[data-select-all]");

  test("pagina en el cliente y pinta el rango", () => {
    const root = table();
    assert.deepEqual(visible(root), ["a1", "b2", "c3"]);
    assert.equal(root.querySelector(".z-datatable__range").textContent, "1–3 of 5");
    const events = [];
    root.addEventListener("z:pagechange", (e) => events.push(e.detail.value));
    dom.setDataTablePage(root, 2);
    assert.deepEqual(visible(root), ["d4", "e5"]);
    assert.equal(root.querySelector(".z-datatable__range").textContent, "4–5 of 5");
    assert.equal(root.querySelector('.z-pagination [aria-current="page"]').textContent, "2");
    assert.deepEqual(events, [2]);
    // Clic en «Previous page»: vuelve a la 1.
    click(root.querySelector('.z-pagination [aria-label="Previous page"]'));
    assert.deepEqual(visible(root), ["a1", "b2", "c3"]);
  });
  test("una casilla de fila marca la fila, la cabecera y el conteo; emite z:selectionchange", () => {
    const root = table();
    const events = [];
    root.addEventListener("z:selectionchange", (e) => events.push(e.detail.value));
    click(box(root, "a1"));
    assert.equal(box(root, "a1").getAttribute("aria-checked"), "true");
    assert.ok(root.querySelector('tr[data-key="a1"]').hasAttribute("data-selected"));
    assert.equal(all(root).getAttribute("aria-checked"), "mixed");
    assert.equal(root.querySelector(".z-datatable__count").textContent, "2 selected");
    assert.deepEqual(events.at(-1), ["a1", "b2"]);
    assert.deepEqual(dom.dataTableSelection(root), ["a1", "b2"]);
  });
  test("seleccionar todo actúa sobre la página y conserva el resto", () => {
    const root = table();
    dom.setDataTableSelection(root, ["e5"]);
    click(all(root));
    assert.deepEqual(dom.dataTableSelection(root), ["a1", "b2", "c3", "e5"]);
    assert.equal(all(root).getAttribute("aria-checked"), "true");
    click(all(root));
    assert.deepEqual(dom.dataTableSelection(root), ["e5"]);
    assert.equal(all(root).getAttribute("aria-checked"), "false");
    assert.ok(root.querySelector(".z-datatable__count").hasAttribute("data-empty") === false);
  });
  test("Mayús + clic marca un rango desde la última casilla", () => {
    const root = table();
    dom.setDataTableSelection(root, []);
    click(box(root, "a1"));
    const event = new window.MouseEvent("click", { bubbles: true, cancelable: true, shiftKey: true });
    box(root, "c3").dispatchEvent(event);
    assert.deepEqual(dom.dataTableSelection(root), ["a1", "b2", "c3"]);
    click(box(root, "b2"));
    assert.deepEqual(dom.dataTableSelection(root), ["a1", "c3"]);
    assert.equal(root.querySelector(".z-datatable__count").textContent, "2 selected");
    dom.setDataTableSelection(root, []);
    assert.equal(root.querySelector(".z-datatable__count").textContent, "");
  });
  test("ordenar conserva la página y la recalcula sobre el orden nuevo", () => {
    const root = table();
    dom.sortTable(root.querySelector('th[data-key="seats"]'), "desc");
    assert.deepEqual(visible(root), ["b2", "d4", "e5"]);
  });
});
