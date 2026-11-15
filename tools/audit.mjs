#!/usr/bin/env node
// Auditoría de estilo de la suite. Objetivo: cero en todas las columnas.
// Uso: node tools/audit.mjs [rutas...] [--json]
//   Sin rutas audita zui/src y zout/src. Una aplicación puede auditar sus pantallas: node tools/audit.mjs ../mi-app/src
// Columnas:
//   color   colores literales (#hex, rgb(), hsl()) fuera de los tokens
//   prim    uso directo de primitivos de marca (--zp-*)
//   token   var(--z-*) sin valor de respaldo que no existe en @zuccadev-labs/zuix-tokens ni se declara en lo auditado
//   emoji   emojis usados como iconos
//   inline  style={{…}} con propiedades de apariencia (color, fondo, borde, sombra, radio, fuente)
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { dirname, join, relative, extname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const asJson = args.includes("--json");
const targets = args.filter((a) => !a.startsWith("--"));
const dirs = (targets.length ? targets : ["zui/src", "zout/src"]).map((d) => join(root, d)).filter(existsSync);

const tokens = JSON.parse(readFileSync(join(root, "tokens/dist/tokens.json"), "utf8"));
const known = new Set(["font-display", "font-sans", "font-mono", ...Object.keys(tokens.scale), ...Object.keys(tokens.component), ...Object.keys(tokens.semanticDerived), ...tokens.required]);
for (const b of Object.values(tokens.brands)) for (const k of [...Object.keys(b.scale), ...Object.keys(b.component), ...Object.keys(b.themes.dark), ...Object.keys(b.themes.light)]) known.add(k);

const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? (f === "node_modules" ? [] : walk(p)) : [p]; });
const files = dirs.flatMap(walk).filter((f) => [".ts", ".tsx", ".css", ".jsx", ".js", ".mdx"].includes(extname(f)));
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " ")).replace(/(^|[^:"'`])\/\/[^\n]*/g, (m, p) => p + " ".repeat(m.length - p.length));
const sources = new Map(files.map((f) => [f, strip(readFileSync(f, "utf8"))]));

// Variables locales de componente: cualquier --z-* declarada o asignada dentro de lo auditado.
const local = new Set();
for (const src of sources.values()) for (const m of src.matchAll(/["']?--z-([a-z0-9-]+)["']?\s*:/g)) local.add(m[1]);

const APPEARANCE = /\b(color|background|backgroundColor|backgroundImage|border|borderColor|borderRadius|borderTop|borderBottom|borderLeft|borderRight|boxShadow|fontFamily|fontSize|fontWeight|outline|fill|stroke|backdropFilter)\s*:/;
const lineOf = (src, idx) => src.slice(0, idx).split("\n").length;

function inlineStyles(src) {
  const hits = [];
  for (const m of src.matchAll(/style=\{\{/g)) {
    let depth = 2, i = m.index + m[0].length;
    while (i < src.length && depth > 0) { if (src[i] === "{") depth++; else if (src[i] === "}") depth--; i++; }
    if (APPEARANCE.test(src.slice(m.index, i))) hits.push(m.index);
  }
  return hits;
}

const rows = [];
for (const [file, src] of sources) {
  const find = (re) => [...src.matchAll(re)];
  const r = {
    file: relative(root, file),
    color: find(/#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b(?![0-9a-zA-Z_-])|\b(?:rgba?|hsla?|oklch|oklab)\(/g).map((m) => lineOf(src, m.index)),
    prim: find(/--zp-[a-z0-9-]+/g).map((m) => lineOf(src, m.index)),
    token: find(/var\(\s*--z-([a-z0-9-]+)\s*(?!,)(?=\))/g).filter((m) => !known.has(m[1]) && !local.has(m[1])).map((m) => `${lineOf(src, m.index)}:${m[1]}`),
    emoji: find(/\p{Extended_Pictographic}/gu).filter((m) => !/[©®™↔↕]/.test(m[0])).map((m) => lineOf(src, m.index)),
    inline: inlineStyles(src).map((i) => lineOf(src, i)),
  };
  rows.push(r);
}

const cols = ["color", "prim", "token", "emoji", "inline"];
const total = Object.fromEntries(cols.map((c) => [c, rows.reduce((n, r) => n + r[c].length, 0)]));
const sum = cols.reduce((n, c) => n + total[c], 0);
if (asJson) {
  console.log(JSON.stringify({ files: rows.length, total, offenders: rows.filter((r) => cols.some((c) => r[c].length)) }, null, 2));
} else {
  const bad = rows.filter((r) => cols.some((c) => r[c].length));
  for (const r of bad) {
    console.log(`\n${r.file}`);
    for (const c of cols) if (r[c].length) console.log(`  ${c.padEnd(6)} ${String(r[c].length).padStart(3)}  líneas ${r[c].slice(0, 12).join(", ")}${r[c].length > 12 ? "…" : ""}`);
  }
  console.log(`\n${rows.length} archivos · ${cols.map((c) => `${c} ${total[c]}`).join(" · ")}`);
  console.log(sum ? `✗ ${sum} hallazgos. Objetivo: 0.` : "✓ auditoría limpia");
}
process.exit(sum ? 1 : 0);
