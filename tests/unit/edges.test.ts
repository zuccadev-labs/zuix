// Bordes de una tira con desplazamiento: qué lado tiene contenido oculto (difuminado de TabStrip, Tabs y Listbox
// en fila). zui y zout llevan la misma lógica; las dos copias deben responder igual.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import fc from "fast-check";
import { scrollEdges } from "../../zui/src/core/edges.ts";
import { scrollEdges as zoutEdges } from "../../zout/src/edges.ts";

describe("bordes de una tira con desplazamiento", () => {
  test("sin desbordar no hay borde; al principio, al final y en medio", () => {
    assert.equal(scrollEdges(0, 300, 300), "");
    assert.equal(scrollEdges(0, 308, 300), "");
    assert.equal(scrollEdges(4, 340, 300), "end");
    assert.equal(scrollEdges(36, 340, 300), "start");
    assert.equal(scrollEdges(0, 400, 300), "end");
    assert.equal(scrollEdges(100, 400, 300), "start");
    assert.equal(scrollEdges(50, 400, 300), "start end");
  });
  test("con holgura de 1 px (tablas), 7 px escondidos ya son un borde", () => {
    assert.equal(scrollEdges(0, 307, 300), "");
    assert.equal(scrollEdges(0, 307, 300, 1), "end");
    assert.equal(scrollEdges(7, 307, 300, 1), "start");
    assert.equal(zoutEdges(0, 307, 300, 1), "end");
  });
  test("zui y zout responden igual y nunca marcan un lado sin desborde", () => {
    fc.assert(
      fc.property(fc.nat(2000), fc.nat(2000), fc.nat(2000), (pos, size, view) => {
        const a = scrollEdges(pos, size, view);
        assert.equal(a, zoutEdges(pos, size, view));
        if (size - view <= 8) assert.equal(a, "");
      }),
    );
  });
});
