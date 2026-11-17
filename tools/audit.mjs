#!/usr/bin/env node
// Auditoría de estilo de la suite. Objetivo: cero en todas las columnas.
// Uso: node tools/audit.mjs [rutas...] [--json] [--strict]
//   Sin rutas audita zui/src y zout/src. Una aplicación puede auditar sus pantallas: node tools/audit.mjs ../mi-app/src
// Columnas que hacen fallar la auditoría:
//   color   colores literales fuera de los tokens: #hex y funciones de color (rgb, hsl, hwb, lab, lch, oklab, oklch, color)
//   prim    uso directo de primitivos de marca (--zp-*)
//   token   var(--z-*) sin valor de respaldo que no existe en @zuccadev-labs/zuix-tokens ni se declara en lo auditado
//   emoji   emojis usados como iconos
//   inline  style={{…}} con propiedades de apariencia (color, fondo, borde, sombra, radio, fuente)
// Columnas informativas (solo hojas CSS; fallan con --strict):
//   named      colores con nombre (red, white…) como valor de una propiedad de color
//   important  !important
//   zindex     z-index con un número literal en lugar de un token
//   px         longitudes en px de 3 px o más fuera de var(), en propiedades de espacio, tamaño, radio y fuente
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const posix = (p) => p.split(sep).join("/");
const EXTENSIONS = [".ts", ".tsx", ".css", ".jsx", ".js", ".mdx"];
export const CORE = ["color", "prim", "token", "emoji", "inline"];
export const EXTRA = ["named", "important", "zindex", "px"];

/** Sustituye los comentarios por espacios, conservando las líneas y las columnas. */
export const strip = (s) =>
  s
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:"'`])\/\/[^\n]*/g, (m, p) => p + " ".repeat(m.length - p.length));

const APPEARANCE =
  /\b(color|background|backgroundColor|backgroundImage|border|borderColor|borderRadius|borderTop|borderBottom|borderLeft|borderRight|boxShadow|fontFamily|fontSize|fontWeight|outline|fill|stroke|backdropFilter)\s*:/;
const lineOf = (src, idx) => src.slice(0, idx).split("\n").length;

function inlineStyles(src) {
  const hits = [];
  for (const m of src.matchAll(/style=\{\{/g)) {
    let depth = 2,
      i = m.index + m[0].length;
    while (i < src.length && depth > 0) {
      if (src[i] === "{") depth++;
      else if (src[i] === "}") depth--;
      i++;
    }
    if (APPEARANCE.test(src.slice(m.index, i))) hits.push(m.index);
  }
  return hits;
}

/** Texto entre el paréntesis que abre en `open` y su cierre. */
function args(src, open) {
  let depth = 1,
    i = open + 1;
  while (i < src.length && depth > 0) {
    if (src[i] === "(") depth++;
    else if (src[i] === ")") depth--;
    i++;
  }
  return src.slice(open + 1, i - 1);
}

// Funciones de color de CSS Color 4. `color-mix()` y `light-dark()` no se listan: combinan otros colores, y si
// alguno es literal se detecta por sí mismo. Una función cuyos canales vienen de tokens (rgb(var(--z-x) / 50%),
// sintaxis relativa `from var(--z-x)`) no es un literal.
// `color(` solo se busca en hojas CSS: en TypeScript es un nombre de función corriente.
const COLOR_FN = /(?<![\w-])(rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(/g;
const COLOR_SPACE_FN = /(?<![\w-])color\(/g;
const HEX = /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b(?![0-9a-zA-Z_-])/g;
const NAMED =
  "black|white|red|green|blue|yellow|orange|purple|pink|gray|grey|silver|maroon|navy|teal|aqua|cyan|magenta|fuchsia|lime|olive|brown|gold|indigo|violet|crimson|coral|salmon|khaki|beige|ivory|tomato|orchid|plum|tan|turquoise|lavender|rebeccapurple";
const COLOR_PROP =
  "(?:color|background(?:-color)?|border(?:-(?:top|right|bottom|left|block|inline)(?:-(?:start|end))?)?(?:-color)?|outline(?:-color)?|fill|stroke|box-shadow|text-shadow|caret-color|accent-color|text-decoration(?:-color)?|column-rule(?:-color)?)";
const NAMED_DECL = new RegExp(`(?<![\\w-])${COLOR_PROP}\\s*:[^;{}]*?(?<![\\w-])(${NAMED})(?![\\w-])`, "gi");
const PX_PROP =
  "(?:margin|padding|gap|row-gap|column-gap|inset|top|right|bottom|left|width|height|min-width|max-width|min-height|max-height|border-radius|font-size|line-height|letter-spacing)(?:-(?:top|right|bottom|left|block|inline)(?:-(?:start|end))?)?";
const PX_DECL = new RegExp(`(?<![\\w-])${PX_PROP}\\s*:([^;{}]*)`, "g");

/** Quita los `var(…)` (con su valor de respaldo) y los `url(…)` de un valor. */
function withoutVars(value) {
  let out = "";
  for (let i = 0; i < value.length; i++) {
    const m = /^(?:var|url|env)\(/.exec(value.slice(i, i + 4));
    if (m && !/[\w-]/.test(value[i - 1] ?? "")) {
      const inner = args(value, i + m[0].length - 1);
      out += " ".repeat(m[0].length + inner.length + 1);
      i += m[0].length + inner.length;
    } else out += value[i];
  }
  return out;
}

/**
 * Hallazgos de una fuente. `known` y `local` son los nombres de token (sin `--z-`) del contrato y los que declara
 * lo auditado; `css` activa las columnas informativas, que solo tienen sentido en una hoja de estilos.
 * Cada columna es una lista de líneas (o `línea:token` en `token`).
 */
export function auditSource(source, { known = new Set(), local = new Set(), css = false } = {}) {
  const src = strip(source);
  const find = (re) => [...src.matchAll(re)];
  const literalFn = (m) => !/\bvar\(|\bfrom\s/.test(args(src, m.index + m[0].length - 1));
  const lines = (matches) => matches.map((m) => lineOf(src, m.index));
  const out = {
    color: [...find(HEX), ...find(COLOR_FN).filter(literalFn), ...(css ? find(COLOR_SPACE_FN).filter(literalFn) : [])]
      .sort((a, b) => a.index - b.index)
      .map((m) => lineOf(src, m.index)),
    prim: lines(find(/--zp-[a-z0-9-]+/g)),
    token: find(/var\(\s*--z-([a-z0-9-]+)\s*(?!,)(?=\))/g)
      .filter((m) => !known.has(m[1]) && !local.has(m[1]))
      .map((m) => `${lineOf(src, m.index)}:${m[1]}`),
    emoji: lines(find(/\p{Extended_Pictographic}/gu).filter((m) => !/[©®™↔↕]/.test(m[0]))),
    inline: inlineStyles(src).map((i) => lineOf(src, i)),
    named: [],
    important: [],
    zindex: [],
    px: [],
  };
  if (css) {
    out.named = lines(
      find(NAMED_DECL).filter((m) => new RegExp(`(?<![\\w-])(${NAMED})(?![\\w-])`, "i").test(withoutVars(m[0].slice(m[0].indexOf(":"))))),
    );
    out.important = lines(find(/!\s*important\b/gi));
    out.zindex = lines(find(/(?<![\w-])z-index\s*:\s*-?\d+\b/g));
    // 1px y 2px son trazos (bordes, anillos de foco): no hay token más pequeño que eso.
    out.px = find(PX_DECL).flatMap((m) =>
      [...withoutVars(m[1]).matchAll(/(?<![\w.-])-?(\d*\.?\d+)px\b/g)].filter((px) => Number(px[1]) >= 3).map(() => lineOf(src, m.index)),
    );
  }
  return out;
}

/** Nombres `--z-*` que declara o asigna una fuente (variables locales de componente). */
export const localNames = (source) => [...strip(source).matchAll(/["']?--z-([a-z0-9-]+)["']?\s*:/g)].map((m) => m[1]);

function main(argv) {
  const asJson = argv.includes("--json");
  const strict = argv.includes("--strict");
  const unknown = argv.filter((a) => a.startsWith("--") && !["--json", "--strict"].includes(a));
  if (unknown.length) {
    console.error(`✗ opción desconocida: ${unknown.join(", ")}\nuso: node tools/audit.mjs [rutas...] [--json] [--strict]`);
    process.exit(2);
  }
  const targets = argv.filter((a) => !a.startsWith("--"));
  const dirs = (targets.length ? targets : ["zui/src", "zout/src"]).map((d) => resolve(root, d));
  // Una ruta mal escrita no puede dar una auditoría limpia de cero archivos.
  const missing = dirs.filter((d) => !existsSync(d));
  if (missing.length) {
    console.error(`✗ no existe: ${missing.map((d) => posix(relative(root, d))).join(", ")}`);
    process.exit(2);
  }

  const tokensFile = join(root, "tokens/dist/tokens.json");
  if (!existsSync(tokensFile)) {
    console.error("✗ falta tokens/dist/tokens.json. Ejecuta: pnpm tokens");
    process.exit(2);
  }
  const tokens = JSON.parse(readFileSync(tokensFile, "utf8"));
  const known = new Set([
    "font-display",
    "font-sans",
    "font-mono",
    ...Object.keys(tokens.scale),
    ...Object.keys(tokens.component),
    ...Object.keys(tokens.semanticDerived),
    ...tokens.required,
  ]);
  for (const b of Object.values(tokens.brands))
    for (const k of [...Object.keys(b.scale), ...Object.keys(b.component), ...Object.keys(b.themes.dark), ...Object.keys(b.themes.light)])
      known.add(k);

  const walk = (d) =>
    statSync(d).isDirectory()
      ? readdirSync(d)
          .sort()
          .flatMap((f) => (f === "node_modules" ? [] : walk(join(d, f))))
      : [d];
  const files = dirs.flatMap(walk).filter((f) => EXTENSIONS.includes(extname(f)));
  const sources = new Map(files.map((f) => [f, readFileSync(f, "utf8")]));
  // Variables locales de componente: cualquier --z-* declarada o asignada dentro de lo auditado.
  const local = new Set([...sources.values()].flatMap(localNames));

  const rows = [...sources].map(([file, source]) => ({
    file: posix(relative(root, file)),
    ...auditSource(source, { known, local, css: extname(file) === ".css" }),
  }));
  const failing = strict ? [...CORE, ...EXTRA] : CORE;
  const cols = [...CORE, ...EXTRA];
  const total = Object.fromEntries(cols.map((c) => [c, rows.reduce((n, r) => n + r[c].length, 0)]));
  const sum = failing.reduce((n, c) => n + total[c], 0);
  const advisory = strict ? 0 : EXTRA.reduce((n, c) => n + total[c], 0);
  if (asJson) {
    console.log(
      JSON.stringify({ files: rows.length, strict, total, offenders: rows.filter((r) => cols.some((c) => r[c].length)) }, null, 2),
    );
  } else {
    for (const r of rows.filter((r) => failing.some((c) => r[c].length))) {
      console.log(`\n${r.file}`);
      for (const c of failing)
        if (r[c].length)
          console.log(
            `  ${c.padEnd(9)} ${String(r[c].length).padStart(3)}  líneas ${r[c].slice(0, 12).join(", ")}${r[c].length > 12 ? "…" : ""}`,
          );
    }
    console.log(`\n${rows.length} archivos · ${CORE.map((c) => `${c} ${total[c]}`).join(" · ")}`);
    console.log(
      `informativo${strict ? " (--strict: cuenta)" : ""} · ${EXTRA.map((c) => `${c} ${total[c]}`).join(" · ")}${advisory ? " · detalle con --strict o --json" : ""}`,
    );
    console.log(sum ? `✗ ${sum} hallazgos. Objetivo: 0.` : "✓ auditoría limpia");
  }
  process.exit(sum ? 1 : 0);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
