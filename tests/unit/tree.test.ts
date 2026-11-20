// Árbol: casillas en cascada con estado mixto, rangos de selección y profundidad de expansión.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import fc from "fast-check";
import { checkStates, idsToDepth, rangeIds, toggleCheck, type TreeShape } from "../../zui/src/core/tree.ts";

const tree: TreeShape[] = [
  {
    id: "a",
    children: [{ id: "a1" }, { id: "a2", children: [{ id: "a2x" }, { id: "a2y" }] }, { id: "a3", disabled: true }],
  },
  { id: "b" },
];

describe("árbol: casillas", () => {
  test("estado de las ramas deducido de los hijos", () => {
    const s = checkStates(tree, ["a1", "a2x"]);
    assert.equal(s.get("a1"), "true");
    assert.equal(s.get("a2"), "mixed");
    assert.equal(s.get("a"), "mixed");
    assert.equal(s.get("b"), "false");
    const all = checkStates(tree, ["a1", "a2x", "a2y"]);
    assert.equal(all.get("a2"), "true");
    assert.equal(all.get("a"), "true", "el hijo deshabilitado no cuenta");
  });
  test("marcar una rama marca sus hojas habilitadas; desmarcar las quita", () => {
    const on = toggleCheck(tree, [], "a");
    assert.deepEqual(on, ["a", "a1", "a2", "a2x", "a2y"]);
    assert.deepEqual(toggleCheck(tree, on, "a"), []);
    assert.deepEqual(toggleCheck(tree, ["a2x"], "a2"), ["a2", "a2x", "a2y"], "desde mixto, marca");
    assert.deepEqual(toggleCheck(tree, ["b"], "a3"), ["b"], "un nodo deshabilitado no cambia");
    assert.deepEqual(toggleCheck(tree, [], "nope"), []);
  });
  test("propiedad: alternar dos veces una hoja deja lo mismo", () => {
    const leavesIds = ["a1", "a2x", "a2y", "b"];
    fc.assert(
      fc.property(fc.subarray(leavesIds), fc.constantFrom(...leavesIds), (start, leaf) => {
        const once = toggleCheck(tree, start, leaf);
        const twice = toggleCheck(tree, once, leaf);
        const norm = (ids: string[]) => ids.filter((id) => leavesIds.includes(id)).sort();
        assert.deepEqual(norm(twice), [...start].sort());
      }),
    );
  });
});

describe("árbol: rangos y profundidad", () => {
  test("rango en el orden de la lista, en cualquier sentido", () => {
    const visible = ["a", "a1", "a2", "b"];
    assert.deepEqual(rangeIds(visible, "a1", "b"), ["a1", "a2", "b"]);
    assert.deepEqual(rangeIds(visible, "b", "a1"), ["a1", "a2", "b"]);
    assert.deepEqual(rangeIds(visible, "a", "zz"), []);
  });
  test("ramas hasta una profundidad", () => {
    assert.deepEqual(idsToDepth(tree, 1), ["a"]);
    assert.deepEqual(idsToDepth(tree, 2), ["a", "a2"]);
    assert.deepEqual(idsToDepth(tree, 0), []);
  });
});
