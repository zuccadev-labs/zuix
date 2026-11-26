// Idiomas: plantillas con plurales de ICU, registro y mezcla de paquetes sobre los textos en inglés, ámbito de idioma,
// formato con Intl y una pasada por todos los paquetes de zui y zout (cada plural se resuelve en cada idioma).
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  currentLocale,
  defaultLocale,
  format,
  formatDate,
  formatList,
  formatNumber,
  localize,
  onLocaleChange,
  placeholders,
  registerLocale,
  registeredLocales,
  resolveLocale,
  setDefaultLocale,
  withLocale,
  type LocalePack,
} from "../../zui/src/core/locale.ts";
import { CASCADER_LABELS } from "../../zui/src/core/cascader-widget.ts";
import { EMOJI_PICKER_LABELS } from "../../zui/src/core/emoji-picker-widget.ts";
import { TIMELINE_LABELS } from "../../zui/src/core/timeline-view.ts";
import { loadLocale, LOCALES } from "../../zui/src/locales/load.ts";
import enZui from "../../zui/src/locales/en.ts";
import enZout from "../../zout/src/locales/en.ts";

describe("format", () => {
  test("sin plurales es un reemplazo simple, y un hueco sin valor se queda", () => {
    assert.equal(format("{a} y {b}", { a: 1, b: "dos" }), "1 y dos");
    assert.equal(format("{a} y {b}", { a: 1 }), "1 y {b}");
    assert.equal(format("{a} y {b}", { a: 1 }, { missing: () => "" }), "1 y ");
  });
  test("elige la forma con la regla de su idioma y escribe el número con Intl", () => {
    const t = "{n, plural, one {# día} other {# días}}";
    assert.equal(format(t, { n: 1 }, { locale: "es" }), "1 día");
    assert.equal(format(t, { n: 0 }, { locale: "es" }), "0 días");
    assert.equal(format(t, { n: 1234 }, { locale: "es" }), "1234 días");
    assert.equal(format(t, { n: 12345 }, { locale: "de" }), "12.345 días");
    // En francés el 0 es singular.
    assert.equal(format("{n, plural, one {# jour} other {# jours}}", { n: 0 }, { locale: "fr" }), "0 jour");
  });
  test("forma exacta, huecos dentro de una forma, varios plurales y texto alrededor", () => {
    const t = "{name}: {n, plural, =0 {nada} one {# nodo de {name}} other {# nodos}} y {m, plural, one {# más} other {# más}}.";
    assert.equal(format(t, { name: "A", n: 0, m: 2 }, { locale: "es" }), "A: nada y 2 más.");
    assert.equal(format(t, { name: "A", n: 1, m: 1 }, { locale: "es" }), "A: 1 nodo de A y 1 más.");
  });
  test("un valor que no es número cae en other y se escribe tal cual", () => {
    assert.equal(format("{n, plural, one {uno} other {# varios}}", { n: "muchos" }, { locale: "es" }), "muchos varios");
  });
  test("placeholders lista también el número de un plural", () => {
    assert.deepEqual(placeholders("{a} {n, plural, one {# {b}} other {#}}"), ["a", "b", "n"]);
  });
});

describe("registro y mezcla", () => {
  const pack: LocalePack = {
    id: "xx",
    messages: {
      cascader: { results: "{count, plural, one {# cosa} other {# cosas}}", nueva: "no existe en inglés" },
      emojiPicker: { tones: ["T0", "T1"] },
      timeline: { scales: { day: "Jours" } },
    },
  };
  registerLocale(pack);
  test("resuelve la etiqueta exacta o su idioma base; el inglés siempre", () => {
    assert.equal(resolveLocale("xx-YY"), "xx");
    assert.equal(resolveLocale("XX"), "xx");
    assert.equal(resolveLocale("en-GB"), "en");
    assert.equal(resolveLocale("zz"), undefined);
    assert.equal(resolveLocale(undefined), undefined);
    assert.ok(registeredLocales().includes("xx"));
  });
  test("mezcla sobre el inglés, ignora claves que el inglés no tiene y conserva la referencia", () => {
    const a = localize("cascader", CASCADER_LABELS, "xx");
    assert.equal(a.placeholder, CASCADER_LABELS.placeholder);
    assert.equal(format(a.results, { count: 1 }), "1 cosa");
    assert.equal("nueva" in a, false);
    assert.equal(localize("cascader", CASCADER_LABELS, "xx"), a);
    assert.equal(localize("cascader", CASCADER_LABELS, "en"), CASCADER_LABELS);
    assert.equal(localize("cascader", CASCADER_LABELS, "zz"), CASCADER_LABELS);
    assert.equal(localize("nada", CASCADER_LABELS, "xx"), CASCADER_LABELS);
  });
  test("grupos anidados y listas", () => {
    const t = localize("timeline", TIMELINE_LABELS, "xx");
    assert.equal(t.scales.day, "Jours");
    assert.equal(t.scales.week, TIMELINE_LABELS.scales.week);
    const e = localize("emojiPicker", EMOJI_PICKER_LABELS, "xx");
    assert.deepEqual(e.tones.slice(0, 3), ["T0", "T1", EMOJI_PICKER_LABELS.tones[2]]);
  });
  test("ámbito de idioma: se restaura al salir, también si lanza", () => {
    setDefaultLocale(undefined);
    assert.equal(currentLocale(), undefined);
    assert.equal(
      withLocale("xx", () => currentLocale()),
      "xx",
    );
    assert.throws(() =>
      withLocale("xx", () => {
        throw new Error("x");
      }),
    );
    assert.equal(currentLocale(), undefined);
    assert.equal(
      withLocale("xx", () => localize("cascader", CASCADER_LABELS).results),
      pack.messages.cascader!.results,
    );
  });
  test("idioma por defecto con aviso a los suscriptores", () => {
    const seen: (string | undefined)[] = [];
    const off = onLocaleChange((id) => seen.push(id));
    setDefaultLocale("XX");
    setDefaultLocale("xx");
    setDefaultLocale(undefined);
    off();
    setDefaultLocale("xx");
    assert.deepEqual(seen, ["xx", undefined]);
    assert.equal(defaultLocale(), "xx");
    assert.equal(
      withLocale(undefined, () => currentLocale()),
      "xx",
    );
    setDefaultLocale(undefined);
  });
});

describe("Intl", () => {
  test("números, fechas y listas en el idioma pedido", () => {
    assert.equal(formatNumber(1234.5, undefined, "de"), "1.234,5");
    assert.equal(formatDate(Date.UTC(2026, 0, 5), { timeZone: "UTC", month: "long" }, "es"), "enero");
    assert.equal(formatList(["A", "B", "C"], undefined, "es"), "A, B y C");
    assert.equal(formatList(["A", "B"], undefined, "pt-BR"), "A e B");
    // El inglés conserva la lista con comas de siempre.
    assert.equal(formatList(["A", "B", "C"], undefined, "en"), "A, B, C");
    assert.equal(formatList(["A", "B", "C"]), "A, B, C");
    // Una etiqueta no válida no lanza.
    assert.equal(formatNumber(1, undefined, "no válida"), "1");
  });
});

describe("paquetes de zui y zout", () => {
  const leaves = (o: unknown, p = ""): [string, string][] =>
    Object.entries(o as Record<string, unknown>).flatMap(([k, v]) =>
      typeof v === "string" ? [[`${p}${k}`, v] as [string, string]] : leaves(v, `${p}${k}.`),
    );
  test("cada idioma carga bajo demanda y cada plantilla se resuelve sin restos de sintaxis", async () => {
    assert.deepEqual([...LOCALES], ["en", "es", "pt", "fr", "de"]);
    const en = new Map([...leaves(enZui.messages), ...leaves(enZout.messages)]);
    for (const id of LOCALES) {
      const [zui] = await loadLocale(id);
      const zout = (await import(`../../zout/src/locales/${id}.ts`)).default as LocalePack;
      assert.equal(zui!.id, id);
      for (const [key, t] of [...leaves(zui!.messages), ...leaves(zout.messages)]) {
        assert.ok(en.has(key), `${id}: ${key}`);
        for (const n of [0, 1, 2, 5, 21]) {
          const values = Object.fromEntries(placeholders(t).map((p) => [p, n]));
          const out = format(t, values, { locale: id });
          assert.ok(!/[{}#]|plural/.test(out.replace(/[\]\[]/g, "")), `${id}: ${key} con ${n} → ${out}`);
        }
      }
    }
    assert.deepEqual(await loadLocale("zz"), []);
  });
});
