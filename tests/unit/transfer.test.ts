// TransferList: reparto entre disponibles y elegidos, filtro, mover y rango, más el árbol del widget.
import "./helpers/dom.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";
import fc from "fast-check";
import { filterTransfer, moveTransfer, rangeTransfer, splitTransfer, type TransferItem } from "../../zui/src/core/transfer.ts";
import { transferListWidget } from "../../zui/src/core/transfer-widget.ts";
import { toHTML } from "../../zui/src/core/vnode.ts";

const items: TransferItem[] = [
  { value: "a", label: "Ána", description: "Design" },
  { value: "b", label: "Ben" },
  { value: "c", label: "Chen", disabled: true },
  { value: "d", label: "Dara" },
];

test("reparto: disponibles en el orden de items, elegidos en el de value, sin desconocidos ni repetidos", () => {
  const { source, target } = splitTransfer(items, ["d", "a", "zz", "d"]);
  assert.deepEqual(
    source.map((i) => i.value),
    ["b", "c"],
  );
  assert.deepEqual(
    target.map((i) => i.value),
    ["d", "a"],
  );
});

test("filtro sin acentos ni mayúsculas, en etiqueta y descripción", () => {
  assert.deepEqual(
    filterTransfer(items, "ana").map((i) => i.value),
    ["a"],
  );
  assert.deepEqual(
    filterTransfer(items, "DESIGN").map((i) => i.value),
    ["a"],
  );
  assert.equal(filterTransfer(items, "  ").length, 4);
});

test("mover: añade al final en orden de items, no mueve deshabilitados y vuelve atrás", () => {
  assert.deepEqual(moveTransfer(items, ["d"], ["b", "a", "c"], "target"), ["d", "a", "b"]);
  assert.deepEqual(moveTransfer(items, ["d", "a"], ["d"], "source"), ["a"]);
  fc.assert(
    fc.property(fc.subarray(["a", "b", "c", "d"]), fc.subarray(["a", "b", "c", "d"]), (value, keys) => {
      const there = moveTransfer(items, value, keys, "target");
      const back = moveTransfer(items, there, keys, "source");
      const movable = keys.filter((k) => k !== "c");
      // Ida y vuelta: queda lo que había menos lo que se movió (y sin duplicados).
      return new Set(there).size === there.length && back.every((v) => value.includes(v) && !movable.includes(v));
    }),
  );
});

test("rango con Mayús entre el ancla y el destino, sin deshabilitados", () => {
  assert.deepEqual(rangeTransfer(items, "a", "d"), ["a", "b", "d"]);
  assert.deepEqual(rangeTransfer(items, "d", "b"), ["b", "d"]);
  assert.deepEqual(rangeTransfer(items, null, "b"), ["b"]);
  assert.deepEqual(rangeTransfer(items, "a", "zz"), []);
});

test("árbol: dos listbox de selección múltiple, recuento y botones deshabilitados cuando no hay qué mover", () => {
  const config = transferListWidget.configure({ items, defaultValue: ["d"], searchable: true, name: "team" });
  const state = transferListWidget.initial(config);
  const html = toHTML(transferListWidget.tree(config, { ...state, checked: { source: ["a"], target: [] } }, "t"));
  assert.equal((html.match(/role="listbox" aria-multiselectable="true"/g) ?? []).length, 2);
  assert.match(html, /1 of 3 selected/);
  assert.match(html, /data-transfer-action="to-target"[^>]*>/);
  assert.match(html, /data-transfer-action="to-source"[^>]*disabled/);
  assert.match(html, /<input type="hidden" name="team" value="d">/);
  assert.match(html, /type="search"/);
  const empty = toHTML(
    transferListWidget.tree(config, { ...state, value: ["a", "b", "c", "d"], query: { source: "", target: "zz" } }, "t"),
  );
  assert.match(empty, /No items/);
  assert.match(empty, /No matches/);
  const controlled = transferListWidget.control!(transferListWidget.configure({ items, value: ["b"] }), state);
  assert.deepEqual(controlled.value, ["b"]);
});
