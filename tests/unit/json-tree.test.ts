// JSON Tree View: tipos, vista previa, rutas, Map y Set, truncado y referencias circulares.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { jsonKind, jsonNodes, pathSegment } from "../../zui/src/core/json-tree.ts";

describe("json-tree", () => {
  test("tipos", () => {
    assert.equal(jsonKind(null), "null");
    assert.equal(jsonKind([]), "array");
    assert.equal(jsonKind(new Map()), "map");
    assert.equal(jsonKind(new Set()), "set");
    assert.equal(jsonKind(new Date(0)), "date");
    assert.equal(jsonKind({}), "object");
    assert.equal(jsonKind(1n), "bigint");
    assert.equal(jsonKind(undefined), "undefined");
    assert.equal(
      jsonKind(() => 0),
      "function",
    );
  });
  test("segmentos de ruta", () => {
    assert.equal(pathSegment("name", "object"), ".name");
    assert.equal(pathSegment("with space", "object"), '["with space"]');
    assert.equal(pathSegment(2, "array"), "[2]");
    assert.equal(pathSegment("k", "map"), '.get("k")');
    assert.equal(pathSegment("0", "set"), "[0]");
  });
  test("árbol con rutas, vistas previas y hojas", () => {
    const [root] = jsonNodes({ id: 1, tags: ["a"], owner: null, big: 2n, ok: false, "a b": "x" });
    assert.equal(root.id, "$");
    assert.equal(root.key, null);
    assert.equal(root.preview, "{6}");
    const byKey = Object.fromEntries(root.children!.map((c) => [c.key, c]));
    assert.equal(byKey.id.preview, "1");
    assert.equal(byKey.tags.preview, "Array(1)");
    assert.equal(byKey.tags.children![0].id, "$.tags[0]");
    assert.equal(byKey.tags.children![0].preview, '"a"');
    assert.equal(byKey.owner.kind, "null");
    assert.equal(byKey.big.preview, "2n");
    assert.equal(byKey.ok.preview, "false");
    assert.equal(byKey["a b"].id, '$["a b"]');
  });
  test("Map, Set, fechas, funciones y raíz con nombre", () => {
    const [root] = jsonNodes(
      { m: new Map([["k", 1]]), s: new Set(["x"]), d: new Date("2026-11-20T00:00:00Z"), bad: new Date("nope"), f: function named() {} },
      { rootName: "data" },
    );
    const byKey = Object.fromEntries(root.children!.map((c) => [c.key, c]));
    assert.equal(byKey.m.preview, "Map(1)");
    assert.equal(byKey.m.children![0].id, 'data.m.get("k")');
    assert.equal(byKey.s.preview, "Set(1)");
    assert.equal(byKey.s.children![0].id, "data.s[0]");
    assert.equal(byKey.d.preview, "2026-11-20T00:00:00.000Z");
    assert.equal(byKey.bad.preview, "Invalid Date");
    assert.equal(byKey.f.preview, "ƒ named()");
  });
  test("cadenas largas truncadas con el texto completo aparte", () => {
    const long = "x".repeat(50);
    const [node] = jsonNodes(long, { maxStringLength: 10 });
    assert.equal(node.preview.length, 10);
    assert.ok(node.preview.endsWith('…"'));
    assert.equal(node.full, JSON.stringify(long));
    assert.equal(jsonNodes("short", { maxStringLength: 10 })[0].full, undefined);
  });
  test("referencias circulares cortadas; una referencia compartida no lo es", () => {
    const shared = { v: 1 };
    const loop: Record<string, unknown> = { a: shared, b: shared };
    loop.self = loop;
    const [root] = jsonNodes(loop);
    const byKey = Object.fromEntries(root.children!.map((c) => [c.key, c]));
    assert.equal(byKey.self.kind, "circular");
    assert.equal(byKey.b.kind, "object");
  });
});
