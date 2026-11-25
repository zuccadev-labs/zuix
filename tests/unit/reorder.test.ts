// Reordenar en rejilla (core/reorder): mover un elemento, destino de cada tecla (también en RTL y con la última fila
// incompleta), columnas medidas y casilla más cercana al puntero; y el marcado de FileUpload en rejilla.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import fc from "fast-check";
import { columnsOf, gridTarget, moveItem, nearestIndex, REORDER_LABELS } from "../../zui/src/core/reorder.ts";
import { FileUpload } from "../../zui/src/components/forms/FileUpload.tsx";
import { render } from "./helpers/react.mjs";

fc.configureGlobal({ seed: Number(process.env.ZUIX_FC_SEED ?? 20261123), numRuns: Number(process.env.ZUIX_FC_RUNS ?? 300) });

describe("mover", () => {
  test("lleva un elemento a otra posición y deja el resto en su orden", () => {
    assert.deepEqual(moveItem(["a", "b", "c", "d"], 0, 2), ["b", "c", "a", "d"]);
    assert.deepEqual(moveItem(["a", "b", "c", "d"], 3, 0), ["d", "a", "b", "c"]);
    assert.deepEqual(moveItem(["a", "b"], 0, 9), ["b", "a"], "destino fuera: al final");
    assert.deepEqual(moveItem(["a", "b"], 5, 0), ["a", "b"], "origen fuera: igual");
  });
  test("propiedad: es una permutación, el elemento queda en el destino y volver lo deshace", () => {
    fc.assert(
      fc.property(
        fc
          .array(fc.integer(), { minLength: 1, maxLength: 30 })
          .chain((list) => fc.tuple(fc.constant(list), fc.nat({ max: list.length - 1 }), fc.nat({ max: list.length - 1 }))),
        ([list, from, to]) => {
          const out = moveItem(list, from, to);
          assert.deepEqual([...out].sort(), [...list].sort());
          assert.equal(out[to], list[from]);
          assert.deepEqual(moveItem(out, to, from), list);
        },
      ),
    );
  });
});

describe("teclas en rejilla", () => {
  const o = { count: 7, columns: 3 };
  test("flechas por filas, RTL, Inicio, Fin y bordes", () => {
    assert.equal(gridTarget(1, "ArrowRight", o), 2);
    assert.equal(gridTarget(1, "ArrowLeft", o), 0);
    assert.equal(gridTarget(1, "ArrowRight", { ...o, rtl: true }), 0, "en RTL la derecha es antes");
    assert.equal(gridTarget(1, "ArrowLeft", { ...o, rtl: true }), 2);
    assert.equal(gridTarget(1, "ArrowDown", o), 4);
    assert.equal(gridTarget(4, "ArrowUp", o), 1);
    assert.equal(gridTarget(1, "ArrowUp", o), null);
    assert.equal(gridTarget(5, "ArrowDown", o), 6, "a la última fila incompleta: al último sitio");
    assert.equal(gridTarget(6, "ArrowDown", o), null);
    assert.equal(gridTarget(4, "Home", o), 0);
    assert.equal(gridTarget(4, "End", o), 6);
    assert.equal(gridTarget(0, "Home", o), null);
    assert.equal(gridTarget(0, "a", o), null);
    assert.equal(gridTarget(9, "ArrowLeft", o), null);
    assert.equal(gridTarget(0, "ArrowDown", { count: 3, columns: 0 }), 1, "columnas mínimas: 1");
  });
  test("propiedad: el destino está dentro, es otro sitio y ida y vuelta lateral regresa", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 40 }), fc.integer({ min: 1, max: 8 }), fc.boolean(), fc.nat(), (count, columns, rtl, seed) => {
        const index = seed % count;
        for (const key of ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"]) {
          const to = gridTarget(index, key, { count, columns, rtl });
          if (to === null) continue;
          assert.ok(to >= 0 && to < count && to !== index);
        }
        const right = gridTarget(index, "ArrowRight", { count, columns, rtl });
        if (right !== null) assert.equal(gridTarget(right, "ArrowLeft", { count, columns, rtl }), index);
      }),
    );
  });
});

describe("medidas", () => {
  const box = (left: number, top: number) => ({ left, top, width: 100, height: 100 });
  test("columnas de la primera fila y casilla del puntero", () => {
    const rects = [box(0, 0), box(110, 0), box(220, 0), box(0, 110), box(110, 110)];
    assert.equal(columnsOf(rects), 3);
    assert.equal(columnsOf([]), 1);
    assert.equal(nearestIndex(150, 150, rects), 4, "dentro");
    assert.equal(nearestIndex(105, 50, rects), 0, "en el hueco: el centro más cercano");
    assert.equal(nearestIndex(500, 500, rects), 4);
    assert.equal(nearestIndex(0, 0, []), -1);
  });
});

describe("FileUpload en rejilla", () => {
  test("zona con rejilla, nombre del campo solo con el texto principal y textos de reordenar", () => {
    const html = render(FileUpload, {
      onFiles: () => {},
      layout: "grid",
      sortable: true,
      cover: true,
      multiple: true,
      label: "Add photos",
      id: "ph",
    });
    assert.match(html, /<label class="z-upload" data-layout="grid"/);
    assert.match(html, /aria-labelledby="[^"]+"/);
    assert.match(html, /<ul class="z-upload__files z-upload__grid"><\/ul>/);
    assert.match(html, new RegExp(`<span class="z-sr-only" id="[^"]+">${REORDER_LABELS.hint}</span>`));
    const list = render(FileUpload, { onFiles: () => {} });
    assert.doesNotMatch(list, /aria-labelledby|z-upload__grid|data-layout/);
  });
});
