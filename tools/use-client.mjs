#!/usr/bin/env node
// Regla de "use client" (AGENTS.md): un módulo del binding de React con hooks, contexto, primitivas propias
// (`zui/src/primitives`) o manejadores de eventos propios empieza por la directiva `"use client";`. Sin ella, un Server Component que lo importe
// falla al compilar en Next.js. Ningún linter trae esta regla; se ejecuta dentro de `pnpm lint`.
// Uso: node tools/use-client.mjs [rutas...]     Sin rutas revisa zui/src, zout/src y zicon/src.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SKIP_DIR = new Set(["node_modules", "dist", "icons", "dom", "styles"]);

/** Quita comentarios conservando las líneas, para no contar lo que solo se menciona. */
const strip = (source) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:"'`\\])\/\/[^\n]*/g, (m, p) => p + " ".repeat(m.length - p.length));

const HOOK =
  /\buse(?:State|Effect|LayoutEffect|InsertionEffect|Ref|Memo|Callback|Context|Reducer|Id|ImperativeHandle|SyncExternalStore|Transition|DeferredValue|Optimistic|ActionState|FormStatus|EffectEvent)\s*[(<]/;
const REASONS = [
  ["hooks de React", (code) => HOOK.test(code)],
  [
    "hooks propios (use…)",
    (code) => /\buse[A-Z]\w*\s*\(/.test(code.replace(HOOK, "")) && /\bimport\b[^;]*\buse[A-Z]\w*[^;]*\bfrom\b/.test(code),
  ],
  ["createContext", (code) => /\bcreateContext\s*[(<]/.test(code)],
  // Las primitivas propias (capas, diálogo, menú, entradas nativas) llevan estado, contexto y oyentes: quien las importa
  // es un componente de cliente. `slot` es una función pura y no cuenta.
  ["primitivas propias", (code) => /\bfrom\s*["'][^"']*\/primitives\/(?!slot["'])[^"']+["']/.test(code)],
  // Un manejador escrito en el módulo (función en línea). Reenviar una prop (`onClick={onClick}`) no cuenta.
  ["manejadores de eventos", (code) => /\son[A-Z][A-Za-z]*=\{\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/.test(code)],
];

/** Verdadero si el módulo empieza por la directiva (tras comentarios y líneas en blanco). */
export const hasUseClient = (source) => /^\s*["']use client["']\s*;?/.test(strip(source));

/** Motivos por los que un módulo necesita "use client" (lista vacía si no lo necesita). */
export function clientReasons(source) {
  const code = strip(source);
  return REASONS.filter(([, test]) => test(code)).map(([label]) => label);
}

/** Problema del módulo, o `null` si cumple la regla. */
export function checkUseClient(source) {
  if (hasUseClient(source)) return null;
  const reasons = clientReasons(source);
  return reasons.length ? `falta "use client" (${reasons.join(", ")})` : null;
}

function walk(dir) {
  return readdirSync(dir)
    .sort()
    .flatMap((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return SKIP_DIR.has(name) ? [] : walk(path);
      return [".ts", ".tsx"].includes(extname(name)) && !name.endsWith(".d.ts") ? [path] : [];
    });
}

function main(argv) {
  const targets = (argv.length ? argv : ["zui/src", "zout/src", "zicon/src"]).map((t) => resolve(root, t));
  const missing = targets.filter((t) => !existsSync(t));
  if (missing.length) {
    console.error(`✗ no existe: ${missing.join(", ")}`);
    process.exit(2);
  }
  const files = targets.flatMap(walk);
  const problems = files.flatMap((file) => {
    const problem = checkUseClient(readFileSync(file, "utf8"));
    return problem ? [`${relative(root, file).split(sep).join("/")}: ${problem}`] : [];
  });
  for (const problem of problems) console.error(`✗ ${problem}`);
  console.log(
    problems.length
      ? `✗ use-client: ${problems.length} de ${files.length} módulos sin la directiva`
      : `✓ use-client: ${files.length} módulos revisados`,
  );
  process.exit(problems.length ? 1 : 0);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
