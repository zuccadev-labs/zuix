#!/usr/bin/env node
// Comprueba los paquetes de idioma de zui y zout (`pnpm locales`, dentro de `pnpm check`):
//   · cada constante `*_LABELS` del fuente está en el catálogo inglés (`<paquete>/src/locales/en.ts`);
//   · cada idioma tiene exactamente las claves del inglés, con el mismo anidamiento: falla si falta o sobra una;
//   · los huecos (`{name}`, también el número de un plural) son los mismos que en inglés, y cada plural tiene `other`;
//   · cada idioma tiene su entrada `./locales/<id>` en `exports`, en `publishConfig.exports` y en el paraguas.
// Marca, sin fallar, los textos idénticos al inglés que el paquete no declara en `same` (posibles textos sin traducir).
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { tsImport } from "tsx/esm/api";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const LOCALES = ["en", "es", "pt", "fr", "de"];
const PACKAGES = ["zui", "zout"];
const errors = [];
const warnings = [];
const fail = (msg) => errors.push(msg);

const walk = (d) =>
  readdirSync(d).flatMap((f) => {
    const p = join(d, f);
    return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(f) ? [p] : [];
  });
const load = async (file) => (await tsImport(pathToFileURL(file).href, import.meta.url)).default;

const leaves = (o, prefix = "") =>
  Object.entries(o).flatMap(([k, v]) =>
    typeof v === "string" ? [[`${prefix}${k}`, v]] : typeof v === "object" && v ? leaves(v, `${prefix}${k}.`) : [[`${prefix}${k}`, v]],
  );
const groups = (o, prefix = "") =>
  Object.entries(o).flatMap(([k, v]) => (typeof v === "object" && v ? [`${prefix}${k}`, ...groups(v, `${prefix}${k}.`)] : []));

/** Huecos de una plantilla: `{name}` y el número de cada `{n, plural, …}`. */
const holes = (t) => [...new Set([...t.matchAll(/\{(\w+)(?:\}|,\s*plural,)/g)].map((m) => m[1]))].sort().join(",");
/** Plurales sin forma `other`. */
const badPlural = (t) => [...t.matchAll(/\{(\w+),\s*plural,/g)].some((m) => !/\bother\s*\{/.test(t.slice(m.index)));

const suite = JSON.parse(readFileSync(join(root, "suite/package.json"), "utf8"));
let keysTotal = 0;
let marked = 0;

for (const pkg of PACKAGES) {
  const dir = join(root, pkg);
  const src = join(dir, "src");
  const enFile = join(src, "locales/en.ts");
  const enText = readFileSync(enFile, "utf8");

  // Toda constante de textos del fuente entra en el catálogo, y ninguna se queda local en un componente.
  for (const file of walk(src)) {
    if (file.includes(`${join(src, "locales")}`)) continue;
    const text = readFileSync(file, "utf8");
    for (const m of text.matchAll(/^(export )?const ([A-Z][A-Z0-9_]*_LABELS)\b/gm)) {
      const where = relative(root, file);
      if (!m[1]) {
        fail(`${where}: ${m[2]} no se exporta; muévela a core para que entre en los paquetes de idioma`);
        continue;
      }
      const mod = `../${relative(src, file)
        .replace(/\\/g, "/")
        .replace(/\.tsx?$/, "")}`;
      const imported = [...enText.matchAll(/import \{([^}]*)\} from "([^"]+)"/g)].some(
        (i) => i[2] === mod && i[1].split(",").some((n) => n.trim().split(/\s+as\s+/)[0] === m[2]),
      );
      if (!imported) fail(`${where}: ${m[2]} no está en ${relative(root, enFile)}`);
    }
  }

  const en = await load(enFile);
  const enLeaves = new Map(leaves(en.messages));
  const enGroups = new Set(groups(en.messages));
  keysTotal += enLeaves.size;
  const pj = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));

  for (const id of LOCALES) {
    const file = join(src, `locales/${id}.ts`);
    const name = `${pkg}/locales/${id}`;
    if (!pj.exports?.[`./locales/${id}`]) fail(`${pkg}/package.json: falta exports["./locales/${id}"]`);
    if (!pj.publishConfig?.exports?.[`./locales/${id}`]) fail(`${pkg}/package.json: falta publishConfig.exports["./locales/${id}"]`);
    if (!suite.exports?.[`./${pkg}/locales/${id}`]) fail(`suite/package.json: falta exports["./${pkg}/locales/${id}"]`);
    let pack;
    try {
      pack = await load(file);
    } catch (error) {
      fail(`${name}: no se pudo cargar (${String(error.message).split("\n")[0]})`);
      continue;
    }
    if (pack?.id !== id) fail(`${name}: el paquete declara id "${pack?.id}"`);
    if (id === "en") continue;
    const own = new Map(leaves(pack.messages));
    const ownGroups = new Set(groups(pack.messages));
    const same = new Set(pack.same ?? []);
    for (const [key, value] of enLeaves) {
      if (!own.has(key)) {
        fail(`${name}: falta ${key}${ownGroups.has(key) ? " (es un grupo y en inglés es un texto)" : ""}`);
        continue;
      }
      const t = own.get(key);
      if (typeof t !== "string") {
        fail(`${name}: ${key} no es un texto`);
        continue;
      }
      if (holes(t) !== holes(value)) fail(`${name}: ${key} usa {${holes(t)}} y en inglés {${holes(value)}}`);
      if (badPlural(t)) fail(`${name}: ${key} tiene un plural sin forma other`);
      if (t === value && value !== "" && !same.has(key)) {
        warnings.push(`${name}: ${key} = ${JSON.stringify(t)}`);
        marked += 1;
      }
    }
    for (const key of own.keys())
      if (!enLeaves.has(key)) fail(`${name}: sobra ${key}${enGroups.has(key) ? " (en inglés es un grupo)" : ""}`);
    for (const key of same) {
      if (!enLeaves.has(key)) fail(`${name}: same nombra ${key}, que no existe`);
      else if (own.get(key) !== enLeaves.get(key)) warnings.push(`${name}: same nombra ${key}, que ya no coincide con el inglés`);
    }
  }
}

if (warnings.length) {
  console.log(
    `· ${warnings.length} aviso${warnings.length === 1 ? "" : "s"} (textos iguales al inglés sin declarar en same, o same desfasado):`,
  );
  for (const w of warnings) console.log(`  · ${w}`);
}
if (errors.length) {
  for (const e of errors) console.error(`✗ ${e}`);
  console.error(`✗ locales: ${errors.length} error${errors.length === 1 ? "" : "es"}`);
  process.exit(1);
}
console.log(
  `✓ locales · ${LOCALES.length} idiomas en ${PACKAGES.join(" y ")} · ${keysTotal} claves cada uno, sin claves de más ni de menos${marked ? ` · ${marked} textos marcados sin traducir` : ""}`,
);
