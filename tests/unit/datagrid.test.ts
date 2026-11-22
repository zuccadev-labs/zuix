// DataTable avanzado: filtro por columna, CSV seguro, anchos y desplazamiento de columnas fijadas.
import "./helpers/dom.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";
import fc from "fast-check";
import { clampWidth, filterRows, matchesFilter, pinOffsets, toCSV } from "../../zui/src/core/datagrid.ts";
import { cellText, dataTableCSV } from "../../zui/src/components/data/DataTable.tsx";

test("filtro: palabras en cualquier orden, sin acentos ni mayúsculas", () => {
  assert.ok(matchesFilter("Ana Ruiz · Diseño", "diseno ana"));
  assert.ok(!matchesFilter("Ana Ruiz", "ana leo"));
  assert.ok(matchesFilter("x", "   "));
  const rows = [
    { n: "Ana", r: "Owner" },
    { n: "Leo", r: "Editor" },
    { n: "Eva", r: "Editor" },
  ];
  assert.deepEqual(
    filterRows(rows, { r: "edit", n: "" }, (row, k) => (k === "n" ? row.n : row.r)).map((r) => r.n),
    ["Leo", "Eva"],
  );
  assert.equal(filterRows(rows, {}, () => "").length, 3);
});

test("CSV: comillas cuando hace falta, CRLF y fórmulas neutralizadas", () => {
  assert.equal(
    toCSV([
      ["a", 'b "c"', "d,e"],
      [1, null, true],
    ]),
    'a,"b ""c""","d,e"\r\n1,,true',
  );
  assert.equal(toCSV([["=SUM(A1)", "+1", "-2", "@x", 3]]), "'=SUM(A1),'+1,'-2,'@x,3");
  assert.equal(toCSV([[new Date("2026-01-02T00:00:00Z"), new Date("x")]]), "2026-01-02T00:00:00.000Z,");
  assert.equal(toCSV([["a;b", "c"]], ";"), '"a;b";c');
  // Toda celda sin separadores ni comillas sale tal cual y vuelve a partirse igual.
  fc.assert(
    fc.property(
      fc.array(fc.array(fc.stringMatching(/^[a-z0-9 ]{0,8}$/), { minLength: 1, maxLength: 5 }), { minLength: 1, maxLength: 5 }),
      (rows) => {
        const width = rows[0]!.length;
        const table = rows.map((r) => Array.from({ length: width }, (_, i) => r[i] ?? ""));
        return toCSV(table)
          .split("\r\n")
          .map((line) => line.split(","))
          .every((line, i) => line.join("|") === table[i]!.join("|"));
      },
    ),
  );
});

test("anchos acotados y desplazamiento de las columnas fijadas", () => {
  assert.equal(clampWidth(10), 48);
  assert.equal(clampWidth(5000), 1200);
  assert.equal(clampWidth(Number.NaN, 64), 64);
  assert.deepEqual(pinOffsets([40, 180, 120, 90], [true, true, false, true]), [0, 40, 0, 220]);
});

test("texto de celda y CSV de un DataTable desde sus columnas", () => {
  const columns = [
    { key: "name", header: "Name", accessor: (r: { name: string; at: Date; n: number | null }) => r.name },
    { key: "at", header: "Date", accessor: (r: { name: string; at: Date; n: number | null }) => r.at },
    { key: "n", header: "N", accessor: (r: { name: string; at: Date; n: number | null }) => r.n },
    { key: "x", header: "Label", text: (r: { name: string }) => r.name.toUpperCase() },
  ];
  const rows = [{ name: "Ana", at: new Date("2026-03-04T12:00:00Z"), n: null }];
  assert.equal(cellText(columns[1]!, rows[0]!), "2026-03-04");
  assert.equal(cellText(columns[2]!, rows[0]!), "");
  assert.equal(dataTableCSV(rows, columns), "Name,Date,N,Label\r\nAna,2026-03-04,,ANA");
});
