// Modo compat (tools/compat.mjs): las piezas por separado y las hojas reales, generadas aquí mismo desde el fuente y
// vueltas a pasar por lightningcss con el objetivo (Chromium 109, Safari 15.4, Firefox 115). También la matriz de
// soporte (tools/compat-matrix.mjs).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { transform } from "lightningcss";
import { render, support, updateDoc } from "../../tools/compat-matrix.mjs";
import {
  approximate,
  calls,
  compatSheets,
  compatTokens,
  evaluateMix,
  flattenLayers,
  foldCalc,
  hasFallback,
  hoistMixes,
  matchRoot,
  parseTokens,
  propertyDefaults,
  rewriteSelectors,
  rootSpecificity,
  SHEETS,
  substitute,
  TARGET,
  targets,
} from "../../tools/compat.mjs";

const root = fileURLToPath(new URL("../..", import.meta.url));
const read = (p) => readFileSync(join(root, p), "utf8");

/** Reglas de estilo de una hoja, con la cascada mínima que hace falta para comprobar el resultado. */
const rulesOf = (css) => {
  const out = [];
  transform({
    filename: "t.css",
    code: Buffer.from(css),
    visitor: {
      Rule: {
        style(rule) {
          out.push(rule);
        },
      },
    },
  });
  return out;
};

describe("tools/compat.mjs: piezas", () => {
  test("calls: llamadas de primer nivel, con paréntesis anidados", () => {
    const text = "a color-mix(in srgb, var(--x) 10%, rgb(0 0 0)) b color-mix(in srgb, red, blue)";
    assert.deepEqual(
      calls(text, "color-mix").map((c) => c.text),
      ["color-mix(in srgb, var(--x) 10%, rgb(0 0 0))", "color-mix(in srgb, red, blue)"],
    );
    assert.throws(() => calls("color-mix(in srgb", "color-mix"), /sin cerrar/);
  });

  test("substitute: valores, respaldos, recursión y ciclos", () => {
    const vars = { "--a": "var(--b)", "--b": "red", "--loop": "var(--loop)" };
    const lookup = (n) => vars[n];
    assert.equal(substitute("x var(--a) y", lookup), "x red y");
    assert.equal(substitute("var(--nada, var(--b))", lookup), "red");
    assert.throws(() => substitute("var(--nada)", lookup), /no tiene valor/);
    assert.throws(() => substitute("var(--loop)", lookup), /no tiene valor/);
  });

  test("foldCalc: solo calc() numérico", () => {
    assert.equal(foldCalc("calc(8% * 0.55)"), "4.4%");
    assert.equal(foldCalc("calc((2 + 1) * -2)"), "-6");
    assert.equal(foldCalc("calc(1px + 2px)"), "calc(1px + 2px)");
    assert.equal(foldCalc("calc(1 +)"), "calc(1 +)");
  });

  test("approximate: el color que más pesa; rgb(var()) con transparent es exacto", () => {
    assert.equal(approximate("color-mix(in srgb, var(--a) 20%, transparent)"), "transparent");
    assert.equal(approximate("color-mix(in srgb, var(--a) 80%, white)"), "var(--a)");
    assert.equal(approximate("color-mix(in srgb, var(--a), var(--b))"), "var(--a)");
    assert.equal(approximate("color-mix(in srgb, var(--a), var(--b) 70%)"), "var(--b)");
    assert.equal(approximate("color-mix(in oklab, rgb(var(--c)) 28%, transparent)"), "rgb(var(--c) / 28%)");
    assert.equal(approximate("color-mix(in srgb, color-mix(in srgb, var(--a) 90%, black) 60%, white)"), "var(--a)");
  });

  test("evaluateMix: sRGB y oklab a un color estático; lo que no se puede calcular lanza", () => {
    assert.equal(evaluateMix("color-mix(in srgb, #ff0000 50%, #0000ff)"), "purple");
    assert.match(evaluateMix("color-mix(in oklab, #22c55e 28%, transparent)"), /^#[0-9a-f]{8}$/);
    assert.equal(evaluateMix("color-mix(in srgb, #000 calc(10% * 2), transparent)"), "#0003");
    assert.throws(() => evaluateMix("color-mix(in srgb, Highlight 50%, red)"), /de antemano/);
  });

  test("matchRoot: :root, atributos y :not()", () => {
    assert.equal(matchRoot(':root[data-theme="dark"]', { "data-theme": "dark" }), true);
    assert.equal(matchRoot(':root[data-theme="dark"]', {}), false);
    assert.equal(matchRoot(":root:not([data-theme])", {}), true);
    assert.equal(matchRoot(":root:not([data-theme])", { "data-theme": "x" }), false);
    assert.throws(() => matchRoot(".x", {}), /fuera de :root/);
    assert.throws(() => matchRoot(":root .x", {}), /no admitido/);
  });

  test("rewriteSelectors: clase del polyfill de popover y :dir(rtl) sin :dir()", () => {
    assert.equal(rewriteSelectors("[popover]:popover-open{}"), "[popover]:is(:popover-open, .\\:popover-open){}");
    assert.equal(rewriteSelectors(".\\:popover-open{}"), ".\\:popover-open{}");
    assert.equal(rewriteSelectors(".a:dir(rtl){}"), '.a:is([dir="rtl"], [dir="rtl"] *){}');
    assert.equal(rewriteSelectors(".a:dir(ltr){}"), '.a:not(:is([dir="rtl"], [dir="rtl"] *)){}');
  });

  test("propertyDefaults: :root para las que se heredan, cada elemento para las que no", () => {
    const css = `@property --a { syntax: "<number>"; inherits: true; initial-value: 0; }
      @property --b { syntax: "<length>"; inherits: false; initial-value: 1px; }
      @property --c { syntax: "*"; inherits: false; }`;
    assert.equal(propertyDefaults(css), ":root {\n  --a: 0;\n}\n*, ::before, ::after {\n  --b: 1px;\n}\n");
    assert.equal(propertyDefaults(".x{}"), "");
  });

  test("hasFallback: anillo de foco de contenedor con :focus-within, solo sin :has()", () => {
    const css = `.card:has(a:focus-visible) { outline: 2px solid red; }
      .x:has(.y:focus-visible) { outline-color: Highlight; }
      .z:has(.y) { color: red; }`;
    assert.equal(hasFallback(css), "@supports not selector(:has(a)) {\n  .card:focus-within { outline: 2px solid red;\n  }\n}\n");
    assert.equal(hasFallback(".z:has(.y) { color: red; }"), "");
  });

  test("flattenLayers: orden de capas, subcapas antes que la capa, sin capa al final, !important al revés", () => {
    const css = `@layer a, b;
      .u { color: black; }
      @layer b { .x { color: red; } }
      @layer a { .x { color: blue; } .y { color: green !important; } }
      @layer b { .y { color: olive !important; } }
      @layer a.sub { .z { color: gray; } }
      @media (min-width: 1px) { @layer b { .w { color: pink; } } }`;
    const out = flattenLayers(css);
    assert.doesNotMatch(out, /@layer/);
    // Orden de aparición de cada selector y, por selector, el último color normal y el último !important.
    const seen = [];
    const last = {};
    for (const r of rulesOf(out)) {
      const name = r.value.selectors[0][0].name;
      if (!seen.includes(name)) seen.push(name);
      const color = (list) => list.find((d) => d.property === "color")?.value;
      const hex = (c) => c && `${c.r},${c.g},${c.b}`;
      last[name] ??= {};
      if (color(r.value.declarations.declarations)) last[name].normal = hex(color(r.value.declarations.declarations));
      if (color(r.value.declarations.importantDeclarations)) last[name].important = hex(color(r.value.declarations.importantDeclarations));
    }
    // a.sub antes que a; b después; lo que no tiene capa, detrás; los !important (aquí, solo .y), al final.
    assert.deepEqual(seen, ["z", "x", "w", "u", "y"]);
    // Las consultas salen en la sintaxis del objetivo (Safari 15.4 no entiende las de rango).
    assert.match(out, /@media \(min-width: 1px\)/);
    assert.equal(last.x.normal, "255,0,0", "gana la capa posterior (b, rojo)");
    assert.equal(last.y.important, "0,128,0", "con !important gana la capa anterior (a, verde)");
  });

  test("compatTokens: cada marca, tema y preferencia con su color; sin color-mix", () => {
    const css = `:root, :root[data-theme="dark"] { --fg: #ffffff; --soft: color-mix(in srgb, var(--fg) 50%, transparent); }
:root[data-theme="light"] { --fg: #000000; }
:root[data-brand="b"] { --fg: #ff0000; }
@media (prefers-color-scheme: light) {
  :root:not([data-theme]) { --fg: #000000; }
}
@media (prefers-contrast: more) {
  :root { --soft: var(--fg); }
}`;
    const out = compatTokens(css, { "--z-compat-x": "color-mix(in srgb, var(--fg) 10%, black)" });
    assert.doesNotMatch(out, /color-mix/);
    // Cascada sobre la salida: en cada contexto debe ganar el color calculado.
    const parsed = parseTokens(out);
    const check = (attrs, media, prop, expected) => {
      let best = null;
      for (const [order, rule] of parsed.entries()) {
        if (rule.media && !rule.media.split(" and ").every((m) => media.includes(m))) continue;
        const spec = Math.max(-1, ...rule.selectors.filter((s) => matchRoot(s, attrs)).map(rootSpecificity));
        if (spec < 0) continue;
        for (const d of rule.decls)
          if (d.prop === prop && (!best || spec > best.spec || (spec === best.spec && order >= best.order)))
            best = { spec, order, value: d.value };
      }
      assert.equal(best?.value, expected, `${prop} en ${JSON.stringify(attrs)} ${media.join(" ")}`);
    };
    check({}, [], "--soft", "#ffffff80");
    check({ "data-theme": "dark" }, [], "--soft", "#ffffff80");
    check({ "data-theme": "otro" }, [], "--soft", "#ffffff80");
    check({ "data-theme": "light" }, [], "--soft", "#00000080");
    check({}, ["(prefers-color-scheme: light)"], "--soft", "#00000080");
    check({ "data-theme": "dark" }, ["(prefers-color-scheme: light)"], "--soft", "#ffffff80");
    check({ "data-brand": "b" }, [], "--soft", "#ff000080");
    check({}, ["(prefers-contrast: more)"], "--soft", "var(--fg)");
    check({ "data-theme": "light" }, [], "--z-compat-x", "#000");
    check({ "data-brand": "b" }, [], "--z-compat-x", "#1a0000");
    assert.throws(() => compatTokens("@media (a: b) and (c: d) { :root { --x: red; } }"), /compuesta/);
    assert.throws(() => compatTokens(":root { --x: color-mix(in srgb, var(--nada) 10%, red); }"), /no tiene valor/);
  });

  test("hoistMixes: mezcla de tokens a variable de :root; mezcla de una variable local, junto a cada asignación", () => {
    const globals = new Set(["--z-accent", "--z-danger", "--z-fg"]);
    const locals = new Set(["--tone", "--k"]);
    const css = `.a { color: color-mix(in srgb, var(--z-accent) 20%, transparent); }
.b { --tone: var(--z-danger); }
.b[data-x] { --tone: var(--otro); }
.c { border-color: color-mix(in srgb, var(--tone) 40%, transparent); }
.d { background: color-mix(in srgb, var(--tone) 40%, var(--k)); }
.e { --k: 0.5; background: color-mix(in srgb, #000 calc(10% * var(--k)), transparent); }`;
    const { css: out, mixes } = hoistMixes(css, globals, locals);
    assert.doesNotMatch(out, /color-mix/);
    const names = Object.keys(mixes);
    assert.ok(names.every((n) => n.startsWith("--z-compat-")));
    assert.ok(Object.values(mixes).includes("color-mix(in srgb, var(--z-accent) 20%, transparent)"));
    assert.ok(Object.values(mixes).includes("color-mix(in srgb, var(--z-danger) 40%, transparent)"));
    assert.match(out, /\.a \{ color: var\(--z-compat-[0-9a-f]{8}, transparent\); \}/);
    // Junto a `--tone: var(--z-danger)`, la mezcla con ese tono; junto al tono que no se puede resolver, `initial`.
    assert.match(out, /\.b \{ --tone: var\(--z-danger\); (--z-compat-[0-9a-f]{8}): var\(--z-compat-[0-9a-f]{8}\); \}/);
    assert.match(out, /\.b\[data-x\] \{ --tone: var\(--otro\); --z-compat-[0-9a-f]{8}: initial; \}/);
    assert.match(out, /\.c \{ border-color: var\(--z-compat-[0-9a-f]{8}, transparent\); \}/);
    // Dos variables locales en una mezcla: solo la aproximación.
    assert.match(out, /\.d \{ background: var\(--k\); \}/);
    // Un valor literal se calcula del todo.
    assert.match(out, /\.e \{ --k: 0\.5; --z-compat-[0-9a-f]{8}: #0000000d; background: var\(--z-compat-[0-9a-f]{8}, #000\); \}/);
  });
});

/** Hojas normales empaquetadas en memoria, como las escribe tools/dist.mjs. */
async function bundled() {
  const sheets = {};
  for (const [from] of SHEETS.tokens) sheets[from] = read(from);
  for (const [entry, from] of [
    ["zui/src/styles/index.css", "zui/dist/zui.css"],
    ["zout/src/styles/index.css", "zout/dist/zout.css"],
  ]) {
    const r = await build({ entryPoints: [join(root, entry)], bundle: true, write: false, logLevel: "silent" });
    sheets[from] = r.outputFiles[0].text;
  }
  return sheets;
}

describe("hojas compat publicadas", async () => {
  const { sheets } = compatSheets(await bundled());

  test("hay una hoja compat por cada hoja de SHEETS", () => {
    assert.deepEqual(Object.keys(sheets).sort(), [...SHEETS.components, ...SHEETS.tokens].map(([, to]) => to).sort());
  });

  for (const [name, css] of Object.entries(sheets)) {
    test(`${name}: lightningcss la lee con el objetivo sin errores ni avisos, y no queda nada que bajar`, () => {
      assert.doesNotMatch(css, /@layer\b/, "@layer");
      assert.doesNotMatch(css, /color-mix\(/i, "color-mix()");
      assert.doesNotMatch(css, /:dir\(/, ":dir()");
      // En @container el rango es la sintaxis de siempre: quien entiende @container lo entiende.
      assert.doesNotMatch(css, /@media[^{]*[<>]/, "consultas @media de rango");
      assert.doesNotMatch(css, /(?<![\\.(]):popover-open\b(?!, \.\\:popover-open\))/, ":popover-open sin la clase del polyfill");
      let nested = 0;
      const r = transform({
        filename: name,
        code: Buffer.from(css),
        targets,
        errorRecovery: false,
        visitor: {
          Rule: {
            style(rule) {
              if (rule.value.rules?.length) nested += 1;
            },
          },
        },
      });
      assert.deepEqual(r.warnings, []);
      assert.equal(nested, 0, "reglas anidadas");
    });
  }

  test("cada --z-compat-* que usan los componentes lo definen los tokens compat de cada marca o la propia hoja", () => {
    const used = new Set();
    const local = new Set();
    for (const [, to] of SHEETS.components) {
      for (const m of sheets[to].matchAll(/var\((--z-compat-[0-9a-f]{8})/g)) used.add(m[1]);
      for (const m of sheets[to].matchAll(/(--z-compat-[0-9a-f]{8}):/g)) local.add(m[1]);
    }
    assert.ok(used.size > 100, `${used.size} mezclas`);
    assert.ok(local.size > 10, `${local.size} mezclas junto a una asignación`);
    for (const [, to] of SHEETS.tokens) {
      const defined = new Set([...local, ...[...sheets[to].matchAll(/(--z-compat-[0-9a-f]{8}):/g)].map((m) => m[1])]);
      const missing = [...used].filter((n) => !defined.has(n));
      assert.deepEqual(missing, [], to);
    }
  });

  test("el objetivo es el documentado", () => {
    assert.deepEqual(TARGET, { chrome: "109", edge: "109", firefox: "115", safari: "15.4", ios_saf: "15.4" });
  });
});

describe("tools/compat-matrix.mjs", () => {
  test("support: versiones de web-features; Edge solo si llega después que Chrome", () => {
    const { name, out } = support("popover");
    assert.equal(name, "Popover");
    assert.deepEqual(out, { chrome: "116", firefox: "125", safari: "17", safari_ios: "18.3", edge: null });
    assert.equal(support("dialog").out.edge, "79");
    assert.throws(() => support("no-existe"), /no tiene/);
  });

  test("render y updateDoc: el bloque entre las marcas se sustituye entero", () => {
    const rows = [
      { id: "popover", name: "Popover", what: "Capas", uses: 3, effect: "roto", below: "No se abren", out: support("popover").out },
    ];
    const block = render({ rows, floor: { chrome: "116", firefox: "125", safari: "17", safari_ios: "18.3" } });
    assert.match(block, /\| \[Popover\]\(.*\/popover\/\) \| Capas \(3\) \| 116 \| 125 \| 17 \| 18\.3 \| \*\*Roto\.\*\* No se abren \|/);
    assert.match(block, /\| Hoja compat .* \| 109 \| 115 \| 15\.4 \| 15\.4 \|/);
    const [start, end] = [block.split("\n")[0], block.split("\n").at(-1)];
    const doc = `antes\n${start}\nviejo\n${end}\ndespués`;
    assert.equal(updateDoc(doc, block), `antes\n${block}\ndespués`);
    assert.throws(() => updateDoc("sin marcas", block), /faltan las marcas/);
  });

  test("la matriz de docs/users/10-compatibilidad.md trae las marcas y la fila de Popover", () => {
    const doc = read("docs/users/10-compatibilidad.md");
    assert.match(doc, /<!-- matriz: la genera tools\/compat-matrix\.mjs/);
    assert.match(doc, /\| \[Popover\]/);
  });
});
