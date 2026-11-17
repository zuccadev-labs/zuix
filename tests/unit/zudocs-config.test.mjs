// zudocs/scripts/config.mjs: argumentos, búsqueda y validación de la configuración, y carpeta de salida segura.
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join, parse, resolve } from "node:path";
import { afterEach, beforeEach, describe, test } from "node:test";
import {
  CONFIG_NAME,
  findConfig,
  loadZudocs,
  parseArgs,
  templateDir,
  unsafeOutDir,
  validateSchema,
  ZudocsError,
} from "../../zudocs/scripts/config.mjs";

const ENV = ["INIT_CWD", "ZUDOCS_CONFIG", "ZUDOCS_OUT_DIR", "ZUDOCS_URL", "ZUDOCS_BASE_URL"];
let saved;
let dir;
beforeEach(() => {
  saved = Object.fromEntries(ENV.map((key) => [key, process.env[key]]));
  for (const key of ENV) delete process.env[key];
  dir = realpathSync(mkdtempSync(join(tmpdir(), "zudocs-test-")));
  process.env.INIT_CWD = dir;
});
afterEach(() => {
  for (const key of ENV)
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  rmSync(dir, { recursive: true, force: true });
});

const own = JSON.parse(readFileSync(join(templateDir, CONFIG_NAME), "utf8"));
/** Proyecto externo mínimo: configuración válida y una carpeta docs con un área. */
function project(overrides = {}, name = CONFIG_NAME) {
  mkdirSync(join(dir, "docs/guia"), { recursive: true });
  const config = {
    name: "Mi Sitio Ñ",
    brand: own.brand,
    docs: { path: "docs", areas: [{ ...own.docs.areas[0], id: "guia" }] },
    ...overrides,
  };
  writeFileSync(join(dir, name), JSON.stringify(config));
  return join(dir, name);
}

describe("parseArgs", () => {
  test("opciones con valor en las dos formas, banderas y resto", () => {
    assert.deepEqual(parseArgs(["--config", "a.json", "--out-dir=out", "--strict", "start", "--port", "3000"]), {
      config: "a.json",
      outDir: "out",
      strict: true,
      headers: false,
      help: false,
      rest: ["start", "--port", "3000"],
    });
    assert.deepEqual(parseArgs([]), { config: undefined, outDir: undefined, strict: false, headers: false, help: false, rest: [] });
  });
  test("el separador -- de pnpm se descarta y -h equivale a --help", () => {
    assert.deepEqual(parseArgs(["--", "--config=x", "-h"]).rest, []);
    assert.equal(parseArgs(["-h"]).help, true);
  });
  test("un valor con = dentro se conserva entero", () => {
    assert.equal(parseArgs(["--config=a=b.json"]).config, "a=b.json");
  });
  test("una opción con valor sin su valor es un error, no otro sitio compilado", () => {
    for (const argv of [["--config"], ["--config="], ["--config", "--strict"], ["--out-dir"]])
      assert.throws(() => parseArgs(argv), ZudocsError, argv.join(" "));
  });
  test("la última repetición gana", () => {
    assert.equal(parseArgs(["--config", "a", "--config", "b"]).config, "b");
  });
});

describe("findConfig", () => {
  test("orden: argumento, variable de entorno, carpeta de llamada, plantilla", () => {
    assert.equal(findConfig(), join(templateDir, CONFIG_NAME));
    const local = project();
    assert.equal(findConfig(), local);
    process.env.ZUDOCS_CONFIG = "otro/env.json";
    assert.equal(findConfig(), resolve(dir, "otro/env.json"));
    assert.equal(findConfig("cli.json"), resolve(dir, "cli.json"));
  });
  test("una carpeta vale por su zudocs.config.json", () => {
    mkdirSync(join(dir, "sitio"));
    assert.equal(findConfig("sitio"), join(dir, "sitio", CONFIG_NAME));
  });
  test("una ruta absoluta no se resuelve contra la carpeta de llamada", () => {
    const abs = resolve(parse(dir).root, "x", "c.json");
    assert.equal(findConfig(abs), abs);
  });
});

describe("validateSchema", () => {
  const schema = {
    type: "object",
    required: ["name"],
    additionalProperties: false,
    properties: {
      name: { type: "string", minLength: 1, maxLength: 5 },
      mode: { enum: ["a", "b"] },
      fixed: { const: 1 },
      list: { type: "array", minItems: 1, uniqueItems: true, items: { type: "integer" } },
      slug: { type: "string", pattern: "^[a-z]+$", patternHint: "solo minúsculas" },
    },
  };
  test("válido", () => {
    assert.deepEqual(validateSchema({ name: "ab", mode: "a", fixed: 1, list: [1, 2], slug: "abc" }, schema), []);
  });
  test("cada problema lleva la ruta del campo", () => {
    const out = validateSchema({ name: "   ", mode: "c", fixed: 2, list: [1, 1, 1.5], slug: "ABC" }, schema);
    for (const expected of [
      /^\$\.name: no puede estar vacío/,
      /^\$\.mode: debe ser uno de "a", "b" y es "c"/,
      /^\$\.fixed: debe ser 1/,
      /^\$\.list: tiene elementos repetidos/,
      /^\$\.list\[2\]: se esperaba integer y es number/,
      /^\$\.slug: "ABC" no es válido \(solo minúsculas\)/,
    ])
      assert.ok(
        out.some((e) => expected.test(e)),
        `falta ${expected} en:\n${out.join("\n")}`,
      );
  });
  test("longitud máxima, lista vacía y campo obligatorio", () => {
    assert.match(validateSchema({ name: "abcdef" }, schema)[0], /como máximo 5/);
    assert.match(validateSchema({ name: "a", list: [] }, schema)[0], /al menos 1/);
    assert.deepEqual(validateSchema({}, schema), ['$: falta "name"']);
  });
  test("un campo desconocido sugiere el más parecido (errata o mayúsculas)", () => {
    assert.match(validateSchema({ name: "a", mdoe: "a" }, schema)[0], /campo desconocido "mdoe" \(¿"mode"\?\)/);
    assert.match(validateSchema({ name: "a", Name: "a" }, schema)[0], /\(¿"name"\?\)/);
    assert.equal(validateSchema({ name: "a", zzzzzzzz: 1 }, schema)[0], '$: campo desconocido "zzzzzzzz"');
  });
  test("null, array y tipo equivocado", () => {
    assert.match(validateSchema(null, schema)[0], /se esperaba object y es null/);
    assert.match(validateSchema([], schema)[0], /se esperaba object y es array/);
    assert.match(validateSchema({ name: 5 }, schema)[0], /\$\.name: se esperaba string y es number/);
  });
  test("una palabra clave sin soporte se dice, no se ignora", () => {
    assert.match(validateSchema(1, { type: "number", minimum: 5 })[0], /"minimum" sin soporte/);
  });
});

describe("unsafeOutDir", () => {
  test("la raíz, la carpeta personal y una carpeta que contiene algo protegido se rechazan", () => {
    assert.match(unsafeOutDir(parse(dir).root, []), /raíz/);
    assert.match(unsafeOutDir(homedir(), []), /carpeta personal/);
    assert.match(unsafeOutDir(resolve(homedir(), ".."), []), /carpeta personal|raíz/);
    assert.match(unsafeOutDir(dir, [["la documentación", join(dir, "docs")]]), /contiene la documentación/);
    assert.match(unsafeOutDir(dir, [["el proyecto", dir]]), /contiene el proyecto/);
  });
  test("una carpeta nueva, una vacía o un sitio ya compilado valen", () => {
    assert.equal(unsafeOutDir(join(dir, "build"), [["el proyecto", dir]]), undefined);
    mkdirSync(join(dir, "vacia"));
    assert.equal(unsafeOutDir(join(dir, "vacia"), []), undefined);
    mkdirSync(join(dir, "sitio/assets"), { recursive: true });
    writeFileSync(join(dir, "sitio/index.html"), "");
    assert.equal(unsafeOutDir(join(dir, "sitio"), []), undefined);
  });
  test("una carpeta con otra cosa o un archivo se rechazan (build la vaciaría)", () => {
    mkdirSync(join(dir, "fotos"));
    writeFileSync(join(dir, "fotos/a.jpg"), "");
    assert.match(unsafeOutDir(join(dir, "fotos"), []), /no parece un sitio compilado/);
    writeFileSync(join(dir, "archivo"), "");
    assert.match(unsafeOutDir(join(dir, "archivo"), []), /no es una carpeta/);
  });
  test("una carpeta hermana con el mismo prefijo no cuenta como contenida", () => {
    assert.equal(unsafeOutDir(join(dir, "doc"), [["la documentación", join(dir, "docs")]]), undefined);
  });
});

describe("loadZudocs", () => {
  test("la configuración de la plantilla carga y sus rutas salen del archivo", () => {
    const ctx = loadZudocs({ config: join(templateDir, CONFIG_NAME) });
    assert.equal(ctx.isDefault, true);
    assert.equal(ctx.docsDir, resolve(templateDir, own.docs.path));
    assert.ok(ctx.areas.length > 0);
    assert.equal(ctx.baseUrl, own.baseUrl ?? "/");
  });
  test("proyecto externo: rutas relativas al archivo, carpeta de trabajo propia y slug estable", () => {
    const path = project();
    const ctx = loadZudocs({});
    assert.equal(ctx.configPath, path);
    assert.equal(ctx.isDefault, false);
    assert.equal(ctx.docsDir, join(dir, "docs"));
    assert.equal(ctx.outDir, join(dir, "build"));
    assert.match(ctx.slug, /^mi-sitio-n-[0-9a-f]{8}$/);
    assert.ok(ctx.workDir.startsWith(join(templateDir, ".zudocs")));
    assert.equal(loadZudocs({}).slug, ctx.slug);
    assert.deepEqual(
      ctx.areas.map((a) => a.id),
      ["guia"],
    );
  });
  test("outDir: argumento > ZUDOCS_OUT_DIR > configuración, relativos a la carpeta de llamada", () => {
    project({ outDir: "public" });
    assert.equal(loadZudocs({}).outDir, join(dir, "public"));
    process.env.ZUDOCS_OUT_DIR = "env-out";
    assert.equal(loadZudocs({}).outDir, join(dir, "env-out"));
    assert.equal(loadZudocs({ outDir: "cli-out" }).outDir, join(dir, "cli-out"));
  });
  test("url y baseUrl se normalizan; ZUDOCS_URL y ZUDOCS_BASE_URL los sustituyen", () => {
    project({ url: "https://docs.example.com", baseUrl: "/manual/" });
    let ctx = loadZudocs({});
    assert.equal(ctx.href("/guia/intro"), "https://docs.example.com/manual/guia/intro");
    assert.equal(ctx.href(), "https://docs.example.com/manual/");
    process.env.ZUDOCS_URL = "https://preview.example.com///";
    process.env.ZUDOCS_BASE_URL = "pr-12";
    ctx = loadZudocs({});
    assert.equal(ctx.url, "https://preview.example.com");
    assert.equal(ctx.baseUrl, "/pr-12/");
  });
  test("una URL con ruta se rechaza: la ruta va en baseUrl", () => {
    project();
    process.env.ZUDOCS_URL = "https://example.com/docs";
    assert.throws(() => loadZudocs({}), /URL del sitio no válida/);
  });
  test("errores legibles: no existe, es una carpeta sin configuración, JSON roto con su línea, esquema", () => {
    assert.throws(
      () => loadZudocs({ config: "nope.json" }),
      (e) => e instanceof ZudocsError && /No existe la configuración/.test(e.message),
    );
    mkdirSync(join(dir, "vacio"));
    assert.throws(() => loadZudocs({ config: "vacio" }), ZudocsError);
    writeFileSync(join(dir, "roto.json"), '{\n  "name": "x",\n  "docs": \n}');
    assert.throws(
      () => loadZudocs({ config: "roto.json" }),
      (e) => e instanceof ZudocsError && /no es JSON válido/.test(e.message),
    );
    project({ nmae: "errata" });
    assert.throws(
      () => loadZudocs({}),
      (e) => e instanceof ZudocsError && /no cumple el esquema/.test(e.message) && /nmae/.test(e.message),
    );
  });
  test("un BOM al principio del JSON no rompe la carga", () => {
    const path = project();
    writeFileSync(path, `﻿${readFileSync(path, "utf8")}`);
    assert.equal(loadZudocs({}).site.name, "Mi Sitio Ñ");
  });
  test("la carpeta de documentación debe existir", () => {
    project({ docs: { path: "no-hay", areas: [{ ...own.docs.areas[0], id: "guia" }] } });
    assert.throws(() => loadZudocs({}), /docs\.path/);
  });
});
