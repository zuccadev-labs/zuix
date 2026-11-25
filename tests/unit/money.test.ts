// Importes de PriceBreakdown y PriceTag (core/money): formato de moneda con Intl, unidades menores y desglose con
// descuentos e impuestos; y el marcado estático de SummaryList, PriceBreakdown y PriceTag.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import fc from "fast-check";
import { render } from "./helpers/react.mjs";
import { currencyDigits, formatMoney, fromMinor, moneyFormat, summarizePrice, toMinor, type PriceLine } from "../../zui/src/core/money.ts";
import { PriceTag } from "../../zui/src/components/data/PriceTag.tsx";
import { PriceBreakdown, SummaryList } from "../../zui/src/components/data/SummaryList.tsx";

fc.configureGlobal({ seed: Number(process.env.ZUIX_FC_SEED ?? 20261123), numRuns: Number(process.env.ZUIX_FC_RUNS ?? 300) });

describe("moneda", () => {
  test("decimales de cada moneda y formato con Intl", () => {
    assert.equal(currencyDigits("EUR", "en-IE"), 2);
    assert.equal(currencyDigits("JPY", "ja-JP"), 0);
    assert.equal(currencyDigits("KWD", "en"), 3);
    assert.equal(formatMoney(1234.5, { currency: "USD", locale: "en-US" }), "$1,234.50");
    assert.equal(formatMoney(120, { currency: "EUR", locale: "en-IE", trimZeros: true }), "€120");
    assert.equal(formatMoney(120.5, { currency: "EUR", locale: "en-IE", trimZeros: true }), "€120.50");
    assert.equal(formatMoney(-20, { currency: "USD", locale: "en-US", signDisplay: "exceptZero" }), "-$20.00");
    assert.equal(formatMoney(18400, { currency: "JPY", locale: "en-US" }), "¥18,400");
    assert.equal(formatMoney(5, { currency: "USD", locale: "en-US", display: "code" }).replace(/\s/g, " "), "USD 5.00");
  });
  test("una moneda desconocida no lanza: número con el código delante", () => {
    assert.equal(formatMoney(3, { currency: "NOPE!", locale: "en-US" }), "NOPE! 3");
    assert.equal(moneyFormat({ currency: "NOPE!" }).resolvedOptions().style, "decimal");
    assert.equal(formatMoney(1, { currency: "EUR", locale: "not a locale" }).includes("1"), true);
  });
  test("unidades menores: redondeo de factura y sin ruido binario", () => {
    assert.equal(toMinor(1.005, 2), 101);
    assert.equal(toMinor(-1.005, 2), -101);
    assert.equal(toMinor(0.1 + 0.2, 2), 30);
    assert.equal(toMinor(Number.NaN, 2), 0);
    assert.equal(toMinor(-0, 2), 0);
    assert.equal(fromMinor(12345, 2), 123.45);
  });
  test("propiedad: ida y vuelta por unidades menores conserva el importe redondeado", () => {
    fc.assert(
      fc.property(fc.integer({ min: -1e9, max: 1e9 }), fc.constantFrom(0, 2, 3), (minor, digits) => {
        assert.equal(toMinor(fromMinor(minor, digits), digits), minor);
      }),
    );
  });
});

const lines: PriceLine[] = [
  { label: "3 nights", amount: 360 },
  { label: "Cleaning", amount: 45, kind: "fee" },
  { label: "Weekly", amount: 36, kind: "discount" },
  { label: "VAT", rate: 13, kind: "tax" },
];

describe("desglose", () => {
  test("descuentos restan, el impuesto va sobre la base con descuentos y el total cuadra", () => {
    const s = summarizePrice(lines, "EUR", "en-IE");
    assert.deepEqual(
      s.lines.map((l) => l.minor),
      [36000, 4500, -3600, 4797],
    );
    assert.equal(s.subtotal, 40500);
    assert.equal(s.discounts, -3600);
    assert.equal(s.taxes, 4797);
    assert.equal(s.total, 41697);
    // Un descuento con signo negativo también resta, y un crédito igual.
    assert.equal(
      summarizePrice(
        [
          { label: "a", amount: 10 },
          { label: "b", amount: -3, kind: "credit" },
        ],
        "USD",
      ).total,
      700,
    );
    // Un impuesto sin porcentaje usa su importe; un rate no finito también.
    assert.equal(
      summarizePrice(
        [
          { label: "a", amount: 10 },
          { label: "t", amount: 1, kind: "tax", rate: Number.NaN },
        ],
        "USD",
      ).taxes,
      100,
    );
    assert.equal(summarizePrice([], "USD").total, 0);
  });
  const line = fc.record({
    label: fc.string({ maxLength: 4 }),
    amount: fc.double({ min: -1e6, max: 1e6, noNaN: true }),
    kind: fc.constantFrom("item", "fee", "discount", "credit", "tax"),
    rate: fc.option(fc.double({ min: 0, max: 50, noNaN: true }), { nil: undefined }),
  });
  test("propiedad: el total es la suma exacta de las filas y descontar nunca encarece", () => {
    fc.assert(
      fc.property(fc.array(line, { maxLength: 12 }), fc.constantFrom("EUR", "JPY", "KWD"), (ls, currency) => {
        const s = summarizePrice(ls as PriceLine[], currency, "en");
        const sum = s.lines.reduce((a, l) => a + l.minor, 0);
        assert.equal(s.total, sum);
        assert.equal(s.total, s.subtotal + s.discounts + s.taxes);
        for (const l of s.lines) {
          assert.ok(Number.isInteger(l.minor));
          if (l.kind === "discount" || l.kind === "credit") assert.ok(l.minor <= 0);
        }
      }),
    );
  });
});

describe("marcado", () => {
  test("SummaryList: un dl con filas, tono, separador y total", () => {
    const html = render(SummaryList, {
      items: [
        { label: "Plan", value: "Team", hint: "Yearly" },
        { label: "Off", value: "-$1.00", tone: "success", separated: true },
        { label: "Plain", value: "x", tone: "default" },
        { label: "Total", value: "$9.00", total: true },
      ],
    });
    assert.match(html, /^<dl class="z-summary" data-size="md">/);
    assert.match(html, /<span class="z-summary__hint">Yearly<\/span>/);
    assert.match(html, /data-tone="success" data-separated="true"/);
    assert.doesNotMatch(html, /data-tone="default"/);
    assert.match(html, /data-total="true"><dt class="z-summary__label">Total/);
  });
  test("PriceBreakdown: subtotal, descuento con signo y total formateado", () => {
    const html = render(PriceBreakdown, { currency: "EUR", locale: "en-IE", subtotal: true, lines, totalHint: "No charge yet" });
    assert.match(html, /Subtotal<\/dt><dd class="z-summary__value">€405.00/);
    assert.match(html, /data-tone="success"><dt class="z-summary__label">Weekly<\/dt><dd class="z-summary__value">-€36.00/);
    assert.match(html, /data-tone="muted"><dt class="z-summary__label">VAT<\/dt><dd class="z-summary__value">€47.97/);
    assert.match(html, /Total<span class="z-summary__hint">No charge yet<\/span><\/dt><dd class="z-summary__value">€416.97/);
    const plain = render(PriceBreakdown, { currency: "USD", locale: "en-US", lines });
    assert.match(plain, /data-tone="success" data-separated="true"/, "sin subtotal, el primer descuento separa");
  });
  test("PriceTag: anterior tachado con prefijo oculto y unidad", () => {
    const html = render(PriceTag, { amount: 120, previous: 150, currency: "EUR", locale: "en-IE", unit: "/ night", trimZeros: true });
    assert.equal(
      html,
      '<span class="z-price" data-size="md" data-discounted=""><s class="z-price__previous"><span class="z-sr-only">Previous price: </span>€150</s><span class="z-price__current"><span class="z-sr-only">Current price: </span>€120</span><span class="z-price__unit">/ night</span></span>',
    );
    const same = render(PriceTag, { amount: 5, previous: 5, currency: "USD", locale: "en-US" });
    assert.doesNotMatch(same, /previous|sr-only/);
  });
});
