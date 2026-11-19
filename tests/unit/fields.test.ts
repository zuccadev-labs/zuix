// Lógica de los campos de la oleada 3: números por locale y por pasos, fortaleza de contraseña y portapapeles.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import fc from "fast-check";
import { announceText, copyText } from "../../zui/src/core/clipboard.ts";
import { clampNumber, decimalsOf, formatNumber, numberSymbols, parseNumber, stepNumber } from "../../zui/src/core/number.ts";
import { passwordStrength } from "../../zui/src/core/password.ts";

describe("números", () => {
  test("separadores del locale", () => {
    assert.deepEqual(numberSymbols("en-US"), { group: ",", decimal: ".", minus: "-" });
    assert.equal(numberSymbols("de-DE").decimal, ",");
    assert.equal(numberSymbols("de-DE"), numberSymbols("de-DE"), "en caché");
  });
  test("leer en el formato de cada locale", () => {
    assert.equal(parseNumber("1,234.5", "en-US"), 1234.5);
    assert.equal(parseNumber("1.234,5", "de-DE"), 1234.5);
    assert.equal(parseNumber("1 234,5", "fr-FR"), 1234.5);
    assert.equal(parseNumber("1 234,5", "fr-FR"), 1234.5);
    assert.equal(parseNumber("1.5", "es-ES"), 1.5, "el punto suelto del locale como decimal");
    assert.equal(parseNumber("1.500", "es-ES"), 1500);
    assert.equal(parseNumber("−12", "en-US"), -12);
    assert.equal(parseNumber("$1,200", "en-US"), 1200);
    assert.equal(parseNumber("1'000", "de-CH"), 1000);
    assert.equal(parseNumber("25%", "en-US", true), 0.25);
    for (const bad of ["", "abc", "-", "1.2.3", "+"]) assert.equal(parseNumber(bad, "en-US"), null, bad);
  });
  test("formato y vuelta", () => {
    assert.equal(formatNumber(1250, "en-US", { style: "currency", currency: "USD" }), "$1,250.00");
    assert.equal(formatNumber(null), "");
    assert.equal(formatNumber(Number.NaN), "");
    fc.assert(
      fc.property(fc.integer({ min: -1e9, max: 1e9 }), fc.constantFrom("en-US", "de-DE", "fr-FR", "es-ES", "ja-JP"), (n, locale) => {
        assert.equal(parseNumber(formatNumber(n, locale), locale), n);
      }),
    );
  });
  test("decimales", () => {
    assert.equal(decimalsOf(0.25), 2);
    assert.equal(decimalsOf(3), 0);
    assert.equal(decimalsOf(1e-7), 7);
    assert.equal(decimalsOf(Number.POSITIVE_INFINITY), 0);
  });
  test("rango y paso", () => {
    assert.equal(clampNumber(0.30000000004, { step: 0.1 }), 0.3);
    assert.equal(clampNumber(7, { min: 0, max: 5 }), 5);
    assert.equal(clampNumber(-2, { min: 0 }), 0);
    assert.equal(clampNumber(13, { min: 1, step: 5 }), 11);
    assert.equal(clampNumber(4.2), 4.2);
  });
  test("flechas", () => {
    assert.equal(stepNumber(0.1, 2, { step: 0.1 }), 0.3);
    assert.equal(stepNumber(null, 1, { min: 5 }), 5);
    assert.equal(stepNumber(null, -1, { max: 9 }), 9);
    assert.equal(stepNumber(null, 1), 0);
    assert.equal(stepNumber(3.3, 1, { step: 1 }), 4);
    assert.equal(stepNumber(3.3, -1, { step: 1 }), 3);
    assert.equal(stepNumber(10, 1, { max: 10 }), 10);
    assert.equal(stepNumber(0, -1, { min: 0 }), 0);
    fc.assert(
      fc.property(fc.integer({ min: -100, max: 100 }), fc.integer({ min: -5, max: 5 }), (v, d) => {
        const next = stepNumber(v / 10, d, { min: -5, max: 5, step: 0.1 });
        assert.ok(next >= -5 && next <= 5);
        assert.equal(decimalsOf(next) <= 1, true);
      }),
    );
  });
});

describe("contraseña", () => {
  test("puntuación de 0 a 4", () => {
    assert.equal(passwordStrength("").score, 0);
    assert.equal(passwordStrength("abc").score, 1);
    assert.equal(passwordStrength("aaaaaaaaaaaa").score, 1, "repeticiones");
    assert.ok(passwordStrength("Password1").score >= 2);
    assert.equal(passwordStrength("Tr0ub4dor&3xyz!LONG").score, 4);
    assert.ok(passwordStrength("Correct-Horse-9").score > passwordStrength("password").score);
  });
  test("comprobaciones", () => {
    assert.deepEqual(passwordStrength("aB3$xxxx").checks, { length: true, lower: true, upper: true, digit: true, symbol: true });
    assert.equal(passwordStrength("ábc", 3).checks.length, true);
  });
});

describe("portapapeles", () => {
  test("API asíncrona", async () => {
    let written = "";
    assert.equal(await copyText("hola", { writeText: async (t) => void (written = t) }, undefined), true);
    assert.equal(written, "hola");
    assert.equal(await copyText("", { writeText: async () => {} }, undefined), false);
  });
  test("rechazo sin documento: falla", async () => {
    assert.equal(await copyText("x", { writeText: async () => Promise.reject(new Error("denied")) }, undefined), false);
    assert.equal(await copyText("x", undefined, undefined), false);
  });
  test("copia heredada cuando la API falla", async () => {
    const removed: string[] = [];
    const doc = {
      execCommand: (cmd: string) => cmd === "copy",
      createElement: () => ({ value: "", style: {}, setAttribute() {}, select() {}, remove: () => removed.push("x") }),
      body: { append() {} },
    } as unknown as Document;
    assert.equal(await copyText("x", undefined, doc), true);
    assert.deepEqual(removed, ["x"]);
    const broken = {
      ...doc,
      execCommand: () => {
        throw new Error("no");
      },
    } as unknown as Document;
    assert.equal(await copyText("x", undefined, broken), false);
  });
  test("mensaje repetido se distingue", () => {
    const a = announceText("Copied");
    const b = announceText("Copied");
    assert.notEqual(a, b);
    assert.equal(b.trim(), "Copied");
    assert.equal(announceText("Copy failed"), "Copy failed");
  });
});
