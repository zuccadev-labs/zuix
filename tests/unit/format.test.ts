// Formato de números, bytes y fechas con Intl, y resaltado de coincidencias (core/format).
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import fc from "fast-check";
import { byteParts, formatByte, formatDate, formatNumber, highlightParts, toDate } from "../../zui/src/core/format.ts";

describe("formato", () => {
  test("números con Intl: compacto, moneda, porcentaje y vacío", () => {
    assert.equal(formatNumber(1234.5, "en-US"), "1,234.5");
    assert.equal(formatNumber(1_250_000, "en-US", { notation: "compact" }), "1.3M");
    assert.equal(formatNumber(9.5, "en-US", { style: "currency", currency: "EUR" }), "€9.50");
    assert.equal(formatNumber(0.25, "en-US", { style: "percent" }), "25%");
    assert.equal(formatNumber(Number.NaN, "en-US"), "");
    assert.equal(formatNumber(null), "");
  });
  test("bytes decimales con unidades de Intl y binarios con símbolo IEC", () => {
    assert.deepEqual(byteParts(1500), { value: 1.5, exponent: 1 });
    assert.deepEqual(byteParts(1024, "binary"), { value: 1, exponent: 1 });
    assert.equal(formatByte(512, "en-US"), "512 byte");
    assert.equal(formatByte(1_500_000, "en-US"), "1.5 MB");
    assert.equal(formatByte(1_500_000, "en-US", { unitDisplay: "long" }), "1.5 megabytes");
    assert.equal(formatByte(1_572_864, "en-US", { system: "binary" }), "1.5 MiB");
    assert.equal(formatByte(3e18, "en-US"), "3,000 PB", "tope en petabytes");
    assert.equal(formatByte(undefined), "");
  });
  test("propiedad: el valor reducido queda por debajo de la base", () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 1e15, noNaN: true }), (b) => {
        const { value } = byteParts(b);
        assert.ok(value < 1000 || b >= 1e15);
      }),
    );
  });
  test("fechas: civil a mediodía UTC, instante y datetime", () => {
    assert.equal(toDate("2026-11-20")?.toISOString(), "2026-11-20T12:00:00.000Z");
    assert.equal(toDate("nope"), null);
    assert.equal(toDate(null), null);
    assert.equal(toDate(0)?.getTime(), 0);
    assert.deepEqual(formatDate("2026-11-20", "en-US"), { text: "Nov 20, 2026", datetime: "2026-11-20" });
    assert.equal(formatDate(Date.UTC(2026, 0, 2), "en-US", { dateStyle: "long", timeZone: "UTC" }).datetime, "2026-01-02T00:00:00.000Z");
    assert.equal(formatDate(new Date(Date.UTC(2026, 0, 2)), "bad locale!!", { year: "numeric", timeZone: "UTC" }).text, "2026");
    assert.deepEqual(formatDate("x"), { text: "", datetime: "" });
  });
});

describe("resaltado", () => {
  const marked = (parts: { text: string; match: boolean }[]) => parts.filter((p) => p.match).map((p) => p.text);
  test("varias consultas, sin mayúsculas, solapes unidos", () => {
    assert.deepEqual(marked(highlightParts("The quick brown fox", ["QUICK", "fox"])), ["quick", "fox"]);
    assert.deepEqual(marked(highlightParts("abcdef", ["bcd", "cde"])), ["bcde"]);
    assert.deepEqual(
      highlightParts("abc", "b")
        .map((p) => p.text)
        .join(""),
      "abc",
    );
    assert.deepEqual(highlightParts("Case", "case", { ignoreCase: false }), [{ text: "Case", match: false }]);
    assert.deepEqual(highlightParts("", "x"), []);
    assert.deepEqual(highlightParts("abc", ["", " "]), [{ text: "abc", match: false }]);
  });
  test("sin acentos y palabras completas, con el texto original", () => {
    assert.deepEqual(marked(highlightParts("Un café en Málaga", ["cafe", "malaga"], { ignoreAccents: true })), ["café", "Málaga"]);
    assert.deepEqual(marked(highlightParts("cat category cat", "cat", { wholeWord: true })), ["cat", "cat"]);
  });
  test("propiedad: los trozos reconstruyen el texto", () => {
    fc.assert(
      fc.property(fc.string(), fc.array(fc.string({ maxLength: 3 }), { maxLength: 3 }), fc.boolean(), (text, qs, accents) => {
        assert.equal(
          highlightParts(text, qs, { ignoreAccents: accents })
            .map((p) => p.text)
            .join(""),
          text,
        );
      }),
    );
  });
});
