#!/usr/bin/env node
// Comprueba que todo componente con manifiesto se puede importar desde la raíz de su paquete.
// Un manifiesto (`<Nombre>.manifest.json`) declara un componente público: lo que declara (`exports`, o `name` si no
// hay `exports`, y los nombres de su línea `import`) debe salir, como valor, del barrel de su carpeta (`index.ts`) y de
// ahí del `index.ts` de `src/`. La dirección contraria (un componente exportado sin manifiesto) la comprueba
// `tools/manifest.mjs`. Sin esta comprobación, un componente nuevo con su
// manifiesto, su documentación y su hoja de estilos puede publicarse sin que nadie pueda importarlo: `tsc` no lo
// nota, porque un archivo que nadie importa no es un error de tipos.
// Uso: node tools/check-barrels.mjs [paquete...]     Sin argumentos revisa zui y zout.
// No tiene dependencias: lee las sentencias `export` de cada barrel. Las colisiones de nombre entre barrels las
// detecta `tsc` (TS2308).
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const posix = (p) => p.split(sep).join("/");

/** Sustituye los comentarios por espacios: un `export` comentado no exporta nada. */
const strip = (source) => source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");

/** Archivo al que apunta un especificador relativo (`./Button`, `./components/actions`), o `null` si no existe. */
export function resolveModule(from, specifier) {
  const base = resolve(dirname(from), specifier);
  const candidates = [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")];
  return candidates.find((file) => existsSync(file) && statSync(file).isFile()) ?? null;
}

/**
 * Nombres que un módulo exporta como valor (no los `type`), siguiendo `export * from` y `export { … } from`.
 * `seen` evita ciclos entre barrels.
 */
export function exportedNames(file, seen = new Set()) {
  const names = new Set();
  if (seen.has(file) || !existsSync(file)) return names;
  seen.add(file);
  const source = strip(readFileSync(file, "utf8"));
  // export function X, export const X, export class X, export enum X (también `export async function` y `export default` no cuenta).
  for (const m of source.matchAll(
    /^\s*export\s+(?:declare\s+)?(?:async\s+)?(?:function\*?|const|let|var|class|enum)\s+([A-Za-z_$][\w$]*)/gm,
  ))
    names.add(m[1]);
  // export { A, B as C, type D } [from "./x"]   ·   `export type { … }` no exporta valores.
  for (const m of source.matchAll(/^\s*export\s+(type\s+)?\{([^}]*)\}/gm)) {
    if (m[1]) continue;
    for (const part of m[2].split(",")) {
      const item = part.trim();
      if (!item || /^type\s/.test(item)) continue;
      const exported = /\sas\s+([A-Za-z_$][\w$]*)$/.exec(item)?.[1] ?? item;
      if (exported !== "default") names.add(exported);
    }
  }
  // export * from "./x"   ·   `export * as ns from` exporta solo el espacio de nombres.
  for (const m of source.matchAll(/^\s*export\s+\*\s+(?:as\s+([A-Za-z_$][\w$]*)\s+)?from\s+["']([^"']+)["']/gm)) {
    if (m[1]) {
      names.add(m[1]);
      continue;
    }
    if (!m[2].startsWith(".")) continue;
    const target = resolveModule(file, m[2]);
    if (target) for (const name of exportedNames(target, seen)) names.add(name);
  }
  return names;
}

const walk = (dir) =>
  readdirSync(dir)
    .sort()
    .flatMap((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return name === "node_modules" || name === "dist" ? [] : walk(path);
      return name.endsWith(".manifest.json") ? [path] : [];
    });

/** Nombres de valor de una línea `import { A, type B, C as D } from "…"` (los `type` no cuentan). */
export const importedNames = (line) =>
  (/\{([^}]*)\}/.exec(line ?? "")?.[1] ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part && !/^type\s/.test(part))
    .map((part) => part.split(/\s+as\s+/)[0]);

/** Lo que un manifiesto declara como importable: `exports` (o `name`) y los nombres de su línea `import`. */
export function declaredNames(manifest) {
  const own = Array.isArray(manifest.exports) && manifest.exports.length ? manifest.exports : [manifest.name];
  return [...new Set([...own, ...importedNames(manifest.import)])].filter((name) => typeof name === "string" && name);
}

/**
 * Problemas de un paquete (`dir` es su carpeta, con `src/index.ts`). Cada problema es un texto con la ruta del
 * manifiesto, relativa a `base`.
 */
export function checkBarrels(dir, base = dir) {
  const rel = (path) => posix(relative(base, path));
  const src = join(dir, "src");
  const entry = join(src, "index.ts");
  if (!existsSync(entry)) return [`${rel(entry)}: no existe el punto de entrada del paquete`];
  const fromEntry = exportedNames(entry);
  const problems = [];
  for (const manifest of walk(src)) {
    let declared;
    try {
      declared = declaredNames(JSON.parse(readFileSync(manifest, "utf8")));
    } catch (error) {
      problems.push(`${rel(manifest)}: JSON no válido (${error.message})`);
      continue;
    }
    if (declared.length === 0) {
      problems.push(`${rel(manifest)}: el manifiesto no declara ningún nombre ("name" o "exports")`);
      continue;
    }
    // El barrel del grupo es el index.ts de la carpeta del manifiesto; sin él, el grupo se exporta desde la raíz.
    const barrel = join(dirname(manifest), "index.ts");
    const grouped = existsSync(barrel) && barrel !== entry;
    const fromBarrel = grouped ? exportedNames(barrel) : fromEntry;
    for (const name of declared) {
      if (!fromBarrel.has(name)) problems.push(`${rel(manifest)}: ${rel(grouped ? barrel : entry)} no reexporta "${name}"`);
      else if (!fromEntry.has(name))
        problems.push(
          `${rel(manifest)}: ${rel(entry)} no reexporta la carpeta de ${rel(barrel)} ("${name}" no se puede importar del paquete)`,
        );
    }
  }
  return problems;
}

function main(argv) {
  const packages = argv.length ? argv : ["zui", "zout"];
  const missing = packages.filter((pkg) => !existsSync(join(root, pkg, "src")));
  if (missing.length) {
    console.error(`✗ no existe: ${missing.map((pkg) => `${pkg}/src`).join(", ")}`);
    process.exit(2);
  }
  const problems = packages.flatMap((pkg) => checkBarrels(join(root, pkg), root));
  for (const problem of problems) console.error(`✗ ${problem}`);
  const count = packages.reduce((n, pkg) => n + walk(join(root, pkg, "src")).length, 0);
  console.log(
    problems.length
      ? `✗ barrels: ${problems.length} de ${count} componentes con manifiesto no se pueden importar de su paquete`
      : `✓ barrels: ${count} componentes con manifiesto exportados (${packages.join(", ")})`,
  );
  process.exit(problems.length ? 1 : 0);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
