// @zuccadev-labs/zuix-tokens: lectura y composición de color, contraste WCAG, validador de esquemas, lector de
// reglas CSS, resolución de referencias y determinismo de la generación.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { build, expandToken, loadAll } from "../../tokens/src/build.mjs";
import { canvasCandidates, contrast, flatten, luminance, over, parseColor, splitTop, toHex } from "../../tokens/src/color.mjs";
import { mdCode, scan } from "../../tokens/src/compat.mjs";
import { parseRules } from "../../tokens/src/pairs.mjs";
import { validate } from "../../tokens/src/schema.mjs";

const tokensDir = fileURLToPath(new URL("../../tokens/", import.meta.url));
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} ≉ ${b}`);
const nearColor = (actual, expected, eps = 1e-6) => {
  assert.ok(actual, "se esperaba un color");
  for (const [i, v] of expected.entries()) near(actual[i], v, eps);
};

describe("parseColor", () => {
  test("hex de 3, 4, 6 y 8 cifras, sin distinguir mayúsculas", () => {
    assert.deepEqual(parseColor("#fff"), [255, 255, 255, 1]);
    assert.deepEqual(parseColor("#F00"), [255, 0, 0, 1]);
    nearColor(parseColor("#0008"), [0, 0, 0, 136 / 255]);
    assert.deepEqual(parseColor("#A1b2C3"), [161, 178, 195, 1]);
    nearColor(parseColor("#a1b2c380"), [161, 178, 195, 128 / 255]);
    assert.deepEqual(parseColor("  #000  "), [0, 0, 0, 1]);
  });
  test("un nombre heredado de Object.prototype o un número que no lo es no es un color", () => {
    for (const bad of ["__proto__", "constructor", "toString", "rgb(0 0 1e999)", "color-mix(in srgb, white ..%, black)"])
      assert.equal(parseColor(bad), null, bad);
  });
  test("hex con longitud o cifras inválidas no es un color", () => {
    for (const bad of ["#ff", "#fffff", "#fffffff", "#ggg", "#", "fff", "#fffffffff"]) assert.equal(parseColor(bad), null, bad);
  });
  test("rgb() y rgba(): comas, espacios, barra, porcentajes", () => {
    assert.deepEqual(parseColor("rgb(255, 0, 10)"), [255, 0, 10, 1]);
    assert.deepEqual(parseColor("rgb(255 0 10)"), [255, 0, 10, 1]);
    assert.deepEqual(parseColor("rgba(0,0,0,.5)"), [0, 0, 0, 0.5]);
    assert.deepEqual(parseColor("rgb(0 0 0 / 25%)"), [0, 0, 0, 0.25]);
    nearColor(parseColor("rgb(100% 50% 0%)"), [255, 127.5, 0, 1]);
    assert.deepEqual(parseColor("RGB(1 2 3)"), [1, 2, 3, 1]);
  });
  test("rgb() incompleto o con tokens sin resolver no es un color", () => {
    for (const bad of ["rgb(1 2)", "rgb()", "rgb(a b c)", "rgb(var(--x) 0 0)"]) assert.equal(parseColor(bad), null, bad);
  });
  test("palabras clave admitidas y valores que no son color", () => {
    assert.deepEqual(parseColor("transparent"), [0, 0, 0, 0]);
    assert.deepEqual(parseColor("White"), [255, 255, 255, 1]);
    for (const bad of ["red", "none", "", "12px", "var(--z-accent)", "hsl(0 0% 0%)", null, undefined, 0])
      assert.equal(parseColor(bad), null, String(bad));
  });
  test("color-mix(in srgb): porcentajes explícitos, omitidos y uno solo", () => {
    nearColor(parseColor("color-mix(in srgb, white 30%, black)"), [76.5, 76.5, 76.5, 1]);
    nearColor(parseColor("color-mix(in srgb, white, black)"), [127.5, 127.5, 127.5, 1]);
    nearColor(parseColor("color-mix(in srgb, white, black 25%)"), [191.25, 191.25, 191.25, 1]);
    nearColor(parseColor("color-mix(in srgb, #ff0000 50%, #0000ff 50%)"), [127.5, 0, 127.5, 1]);
  });
  test("color-mix: si suman menos de 100 % baja el alfa; si suman más, se normalizan", () => {
    nearColor(parseColor("color-mix(in srgb, white 20%, black 20%)"), [127.5, 127.5, 127.5, 0.4]);
    nearColor(parseColor("color-mix(in srgb, white 150%, black 50%)"), [191.25, 191.25, 191.25, 1]);
  });
  test("color-mix con transparente mezcla en alfa premultiplicado (no oscurece)", () => {
    nearColor(parseColor("color-mix(in srgb, #ffffff 40%, transparent)"), [255, 255, 255, 0.4]);
    nearColor(parseColor("color-mix(in srgb, transparent, transparent)"), [0, 0, 0, 0]);
  });
  test("color-mix anidado y con rgb() dentro (comas de segundo nivel)", () => {
    nearColor(parseColor("color-mix(in srgb, color-mix(in srgb, white, black) 50%, rgb(0, 0, 0))"), [63.75, 63.75, 63.75, 1]);
  });
  test("color-mix que no se puede leer: otro espacio, 0 %, un lado sin resolver", () => {
    for (const bad of [
      "color-mix(in oklch, white, black)",
      "color-mix(in srgb, white 0%, black 0%)",
      "color-mix(in srgb, var(--x), black)",
      "color-mix(in srgb, white)",
      "color-mix(white, black)",
    ])
      assert.equal(parseColor(bad), null, bad);
  });
  test("splitTop respeta los paréntesis", () => {
    assert.deepEqual(splitTop("a, f(b, c), d"), ["a", "f(b, c)", "d"]);
    assert.deepEqual(splitTop(""), [""]);
    assert.deepEqual(splitTop("a b / c", "/"), ["a b", "c"]);
  });
});

describe("composición y contraste", () => {
  const white = [255, 255, 255, 1];
  const black = [0, 0, 0, 1];
  test("over: opaco tapa, transparente deja ver, 50 % promedia", () => {
    assert.deepEqual(over([10, 20, 30, 1], white), [10, 20, 30, 1]);
    assert.deepEqual(over([10, 20, 30, 0], white), white);
    nearColor(over([0, 0, 0, 0.5], white), [127.5, 127.5, 127.5, 1]);
  });
  test("over: dos capas translúcidas acumulan alfa; dos transparentes no dividen por cero", () => {
    nearColor(over([255, 0, 0, 0.5], [0, 0, 255, 0.5]), [170, 0, 85, 0.75]);
    assert.deepEqual(over([9, 9, 9, 0], [7, 7, 7, 0]), [0, 0, 0, 0]);
  });
  test("flatten compone de abajo arriba", () => {
    nearColor(flatten([white, [0, 0, 0, 0.5], [255, 255, 255, 0.5]]), [191.25, 191.25, 191.25, 1]);
    assert.deepEqual(flatten([black]), black);
  });
  test("luminancia: extremos y coeficientes de WCAG", () => {
    assert.equal(luminance(black), 0);
    near(luminance(white), 1);
    near(luminance([255, 0, 0, 1]), 0.2126);
    near(luminance([0, 255, 0, 1]), 0.7152);
    near(luminance([0, 0, 255, 1]), 0.0722);
  });
  test("contraste: 21:1 negro/blanco, 1:1 consigo mismo, simétrico", () => {
    near(contrast(black, white), 21);
    near(contrast(white, black), 21);
    near(contrast([120, 130, 140, 1], [120, 130, 140, 1]), 1);
  });
  test("contraste: valores de referencia en el umbral AA", () => {
    // #767676 sobre blanco es el gris más claro que pasa 4.5:1; #777777 ya no llega.
    assert.ok(contrast(parseColor("#767676"), white) >= 4.5);
    assert.ok(contrast(parseColor("#777777"), white) < 4.5);
    near(contrast(parseColor("#767676"), white), 4.54, 0.01);
    // #949494 es el límite de 3:1 (1.4.11).
    assert.ok(contrast(parseColor("#949494"), white) >= 3);
    assert.ok(contrast(parseColor("#959595"), white) < 3);
  });
  test("toHex redondea y acota", () => {
    assert.equal(toHex([255, 127.5, 0, 1]), "#ff8000");
    assert.equal(toHex([-5, 300, 15.4, 1]), "#00ff0f");
  });
  test("canvasCandidates: color plano, paradas opacas y manchas sobre cada parada", () => {
    assert.deepEqual(canvasCandidates(black, undefined), [black]);
    assert.deepEqual(canvasCandidates(null, undefined), []);
    const list = canvasCandidates(
      black,
      "radial-gradient(circle at 10% 10%, rgba(255, 255, 255, 0.5), transparent 60%), linear-gradient(180deg, #000000 0%, #ffffff 100%)",
    );
    assert.equal(list.length, 5);
    nearColor(list.at(-1), [255, 255, 255, 1]);
    nearColor(list[3], [127.5, 127.5, 127.5, 1]);
  });
});

describe("schema.validate", () => {
  const schema = {
    type: "object",
    required: ["name"],
    additionalProperties: false,
    properties: {
      name: { type: "string", pattern: "^[a-z][a-z0-9-]*$", minLength: 1 },
      mode: { enum: ["dark", "light"] },
      size: { type: "number" },
      count: { type: "integer" },
      tags: { type: "array", items: { $ref: "#/$defs/tag" } },
      map: { type: "object", additionalProperties: { type: "string" } },
    },
    $defs: { tag: { type: "string", minLength: 1 } },
  };
  test("un valor válido no da errores", () => {
    assert.deepEqual(validate({ name: "dazlabs", mode: "dark", size: 1.5, count: 2, tags: ["a"], map: { k: "v" } }, schema), []);
  });
  test("informa de todos los problemas con su ruta", () => {
    const errors = validate(
      { name: "Mal Nombre", mode: "sepia", size: "1", count: 1.5, tags: ["", 3], map: { k: 1 }, extra: true },
      schema,
    );
    for (const expected of [
      /^name: .*no cumple/,
      /^mode: "sepia" no es uno de dark, light/,
      /^size: se esperaba number y hay string/,
      /^count: se esperaba integer y hay number/,
      /^tags\[0\]: cadena vacía/,
      /^tags\[1\]: se esperaba string y hay integer/,
      /^map\.k: se esperaba string/,
      /^extra: clave no admitida/,
    ]) {
      assert.ok(
        errors.some((e) => expected.test(e)),
        `falta ${expected} en:\n${errors.join("\n")}`,
      );
    }
    assert.equal(errors.length, 8);
  });
  test("falta un campo obligatorio; null y array no son object", () => {
    assert.deepEqual(validate({}, schema), ['(raíz): falta "name"']);
    assert.match(validate(null, schema)[0], /se esperaba object y hay null/);
    assert.match(validate([], schema)[0], /se esperaba object y hay array/);
  });
  test("un entero vale donde se pide number; un number con decimales no vale como integer", () => {
    assert.deepEqual(validate(3, { type: "number" }), []);
    assert.equal(validate(3.5, { type: "integer" }).length, 1);
    assert.deepEqual(validate("x", { type: ["string", "null"] }), []);
    assert.deepEqual(validate(null, { type: ["string", "null"] }), []);
  });
  test("una palabra clave que el validador no conoce es un error del esquema, no un pase silencioso", () => {
    assert.throws(() => validate(5, { type: "number", minimum: 10 }), /no admitida "minimum"/);
    assert.throws(() => validate("x", { $ref: "#/$defs/nope" }, { $defs: {} }), /\$ref sin destino/);
  });
  test("los esquemas reales aceptan las marcas reales", () => {
    const brandSchema = JSON.parse(readFileSync(join(tokensDir, "schema/brand.schema.json"), "utf8"));
    for (const brand of loadAll().brands) assert.deepEqual(validate(brand, brandSchema), [], brand.name);
    assert.notDeepEqual(validate({ name: "x" }, brandSchema), []);
  });
});

describe("pairs.parseRules", () => {
  test("reglas simples, anidadas en @media y comentarios", () => {
    const rules = parseRules(
      "/* c { color: red } */\n.a, .b { color: var(--z-fg); background: url('a;b{}.png') }\n@media (min-width: 1px) { .c { color: x } }",
      "f.css",
    );
    assert.deepEqual(
      rules.map((r) => r.selector),
      [".a, .b", ".c"],
    );
    assert.equal(rules[0].decls.get("color"), "var(--z-fg)");
    assert.equal(rules[0].decls.get("background"), "url('a;b{}.png')");
    assert.deepEqual(rules[1].at, ["@media (min-width: 1px)"]);
    assert.equal(rules[1].file, "f.css");
  });
  test("@keyframes y @font-face se saltan; la última declaración sin ; cuenta", () => {
    const rules = parseRules("@keyframes spin { from { color: a } to { color: b } }\n@font-face { font-family: X }\n.d { color: y }");
    assert.deepEqual(
      rules.map((r) => r.selector),
      [".d"],
    );
    assert.equal(rules[0].decls.get("color"), "y");
  });
  test("CSS vacío o truncado no lanza", () => {
    assert.deepEqual(parseRules(""), []);
    assert.doesNotThrow(() => parseRules(".a { color: x"));
  });
});

describe("resolución de referencias (expandToken)", () => {
  const { brands } = loadAll();
  const real = brands[0];
  const fake = (themes) => ({
    name: "t",
    primitives: { blue: "#0000ff" },
    fonts: { sans: "S", mono: "M" },
    themes: { dark: themes, light: themes },
  });
  test("todos los tokens obligatorios de cada marca y tema se resuelven sin referencias pendientes", () => {
    const { base } = loadAll();
    for (const brand of brands)
      for (const theme of ["dark", "light"])
        for (const name of base.required) {
          const value = expandToken(name, brand, theme);
          assert.ok(value !== null, `${brand.name}/${theme}: ${name}`);
          assert.doesNotMatch(value, /\{[a-z0-9.-]+\}/i, `${brand.name}/${theme}: ${name} = ${value}`);
        }
  });
  test("referencias a primitivos y en cadena", () => {
    const brand = fake({ a: "{b}", b: "1px solid {p.blue}" });
    assert.equal(expandToken("a", brand, "dark"), "1px solid #0000ff");
  });
  test("un token que no existe es null; una referencia rota se deja a la vista", () => {
    assert.equal(expandToken("no-existe-este-token", real, "dark"), null);
    const brand = fake({ a: "{no-existe-este-token} {p.nope}" });
    assert.equal(expandToken("a", brand, "dark"), "{no-existe-este-token} {p.nope}");
  });
  test("un ciclo lanza un error que nombra el camino", () => {
    assert.throws(() => expandToken("a", fake({ a: "{b}", b: "{c}", c: "{a}" }), "dark"), /referencia circular: a → b → c → a/);
    assert.throws(() => expandToken("a", fake({ a: "x {a}" }), "dark"), /referencia circular: a → a/);
  });
  test("font-display cae en la fuente sans si la marca no la define", () => {
    assert.equal(expandToken("font-display", fake({}), "dark"), "S");
    assert.equal(expandToken("font-mono", fake({}), "dark"), "M");
  });
});

describe("generación (build)", () => {
  test("dos ejecuciones producen exactamente los mismos archivos", () => {
    const [a, b] = [build(), build()];
    assert.deepEqual(Object.keys(a), Object.keys(b));
    for (const file of Object.keys(a)) assert.equal(a[file], b[file], file);
  });
  test("lo generado coincide byte a byte con tokens/dist y usa LF", () => {
    for (const [file, content] of Object.entries(build())) {
      assert.ok(existsSync(join(tokensDir, file)), `${file} no existe: ejecuta pnpm tokens`);
      assert.equal(readFileSync(join(tokensDir, file), "utf8"), content, `tokens/${file} está desactualizado: ejecuta pnpm tokens`);
      assert.doesNotMatch(content, /\r/, file);
    }
  });
  test("tokens.css declara los dos temas y no deja referencias sin resolver", () => {
    const css = build()["dist/tokens.css"];
    assert.match(css, /:root\[data-theme="light"\]/);
    assert.match(css, /color-scheme: dark/);
    assert.doesNotMatch(css, /\{[a-z0-9.-]+\}\s*;/i);
    assert.doesNotMatch(css, /undefined|\[object Object\]|NaN/);
  });
  test("tokens.json es JSON válido con todas las marcas", () => {
    const json = JSON.parse(build()["dist/tokens.json"]);
    assert.deepEqual(
      Object.keys(json.brands).sort(),
      loadAll()
        .brands.map((b) => b.name)
        .sort(),
    );
    assert.ok(json.brands[json.defaultBrand], "la marca por defecto existe");
  });
  test("el script --check pasa con dist/ al día", () => {
    const r = spawnSync(process.execPath, ["src/build.mjs", "--check"], {
      cwd: tokensDir,
      encoding: "utf8",
      env: { ...process.env, ZUIX_COMPAT_OFFLINE: "1" },
    });
    assert.equal(r.status, 0, r.stderr || r.stdout);
  });
});

describe("compat.mdCode (código en una celda de tabla Markdown)", () => {
  test("un valor corriente va entre acentos graves, en una línea", () => {
    assert.equal(mdCode("--ui-accent"), "`--ui-accent`");
    assert.equal(mdCode("rgba(0, 0, 0, .5)"), "`rgba(0, 0, 0, .5)`");
    assert.equal(mdCode("a\n  b"), "`a b`");
    assert.equal(mdCode(12), "`12`");
  });
  test("barra vertical, barra invertida o acento grave: <code> con entidades, sin nada que parta la celda", () => {
    assert.equal(mdCode("a|b"), "<code>a&#124;b</code>");
    assert.equal(mdCode("a\\|b"), "<code>a&#92;&#124;b</code>");
    assert.equal(mdCode("a`b"), "<code>a&#96;b</code>");
    assert.equal(mdCode("ñ 1 *x* <b> & | \\"), "<code>ñ 1 &#42;x&#42; &#60;b&#62; &#38; &#124; &#92;</code>");
    for (const hostile of ["|", "\\|", "\\\\|", "`|`", "</code>|<script>", "a\n|b"])
      assert.doesNotMatch(mdCode(hostile).replace(/^<code>|<\/code>$/g, ""), /[|`\\<>\n*_]/, hostile);
  });
});

describe("compat.scan (inventario de un proyecto externo)", () => {
  const spec = { source: { env: "A5_TEST_COMPAT_ROOT", sheets: ["app.css"], scan: ["src", "app.css"] } };
  const project = (files) => {
    const dir = mkdtempSync(join(tmpdir(), "zuix-compat-"));
    for (const [name, text] of Object.entries(files)) {
      mkdirSync(join(dir, name, ".."), { recursive: true });
      writeFileSync(join(dir, name), text);
    }
    return dir;
  };
  const withRoot = (dir, fn) => {
    const before = { root: process.env.A5_TEST_COMPAT_ROOT, offline: process.env.ZUIX_COMPAT_OFFLINE };
    delete process.env.ZUIX_COMPAT_OFFLINE;
    if (dir === undefined) delete process.env.A5_TEST_COMPAT_ROOT;
    else process.env.A5_TEST_COMPAT_ROOT = dir;
    try {
      return fn();
    } finally {
      if (before.root === undefined) delete process.env.A5_TEST_COMPAT_ROOT;
      else process.env.A5_TEST_COMPAT_ROOT = before.root;
      if (before.offline !== undefined) process.env.ZUIX_COMPAT_OFFLINE = before.offline;
      if (dir) rmSync(dir, { recursive: true, force: true });
    }
  };
  test("sin la variable de entorno o en modo sin conexión devuelve null (se usa la instantánea)", () => {
    assert.equal(
      withRoot(undefined, () => scan(spec)),
      null,
    );
    const dir = project({ "app.css": ":root { --a: 1px; }" });
    process.env.ZUIX_COMPAT_OFFLINE = "1";
    try {
      process.env.A5_TEST_COMPAT_ROOT = dir;
      assert.equal(scan(spec), null);
    } finally {
      delete process.env.ZUIX_COMPAT_OFFLINE;
      delete process.env.A5_TEST_COMPAT_ROOT;
      rmSync(dir, { recursive: true, force: true });
    }
  });
  test("si falta una hoja declarada, el error dice cuál", () => {
    const dir = project({ "src/a.ts": "" });
    assert.throws(() => withRoot(dir, () => scan(spec)), /no contiene app\.css/);
  });
  test("lee las fuentes sin modificarlas y devuelve un inventario serializable", () => {
    const files = {
      "app.css": '/* --ghost: 1px; */\n:root { --bg: #000; --pad: 4px; }\n[data-theme="light"] { --bg: #fff; }\n',
      "src/a.tsx": "const s = { color: 'var(--bg)' };\n// var(--pad)\nconst c = \"bg-(--pad)\";\n",
      "src/node_modules/x/i.js": "var(--bg) var(--bg)",
      "src/notes.txt": "var(--pad)",
    };
    const dir = project(files);
    const before = Object.fromEntries(Object.keys(files).map((f) => [f, readFileSync(join(dir, f), "utf8")]));
    const inv = withRoot(null, () => {
      process.env.A5_TEST_COMPAT_ROOT = dir;
      const result = scan(spec);
      for (const [f, text] of Object.entries(before)) assert.equal(readFileSync(join(dir, f), "utf8"), text, f);
      return result;
    });
    rmSync(dir, { recursive: true, force: true });
    assert.ok(inv && typeof inv === "object");
    assert.deepEqual(JSON.parse(JSON.stringify(inv)), inv);
    const text = JSON.stringify(inv);
    assert.match(text, /--bg/);
    assert.match(text, /--pad/);
    assert.doesNotMatch(text, /--ghost/, "lo comentado no se declara");
    assert.doesNotMatch(text, new RegExp(dir.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), "sin rutas absolutas de la máquina");
  });
});
