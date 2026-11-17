#!/usr/bin/env node
// Auditoría de estilo de la suite. Objetivo: cero en todas las columnas.
// Uso: node tools/audit.mjs [rutas...] [--json] [--strict]     (--strict: también falla la columna informativa)
//   Sin rutas audita zui/src y zout/src. Una aplicación puede auditar sus pantallas: node tools/audit.mjs ../mi-app/src
// Columnas que hacen fallar la auditoría:
//   color   colores literales fuera de los tokens: #hex y funciones de color (rgb, hsl, hwb, lab, lch, oklab, oklch, color)
//   prim    uso directo de primitivos de marca (--zp-*)
//   token   var(--z-*) sin valor de respaldo que no existe en @zuccadev-labs/zuix-tokens ni se declara en lo auditado
//   emoji   emojis usados como iconos
//   inline  style={{…}} con propiedades de apariencia (color, fondo, borde, sombra, radio, fuente)
// Columnas de hoja CSS que también hacen fallar la auditoría:
//   named      colores con nombre (red, white…) como valor de una propiedad de color
//   important  !important sin justificar. Se justifica con un comentario que nombre `!important` y dé el motivo, dentro
//              de la misma regla, justo antes de ella o justo antes del bloque (@media, @supports, @container) que la contiene
//   zindex     z-index con un número literal en lugar de un token de capa (--z-layer-*)
//   px         una medida escrita a mano donde debe ir un token: radio, tamaño de fuente o interletrado en px, y espacio
//              (margin, padding, gap, inset y desplazamientos) cuyo valor coincide con un token --z-space-*
// Columna informativa (falla solo con --strict):
//   size       el resto de longitudes en px de 3 px o más: dimensiones propias de un componente (ancho, alto, topes) y
//              ajustes de espacio fuera de la escala. Los puntos de corte de @media y @container no cuentan
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const posix = (p) => p.split(sep).join("/");
const EXTENSIONS = [".ts", ".tsx", ".css", ".jsx", ".js", ".mdx"];
export const CORE = ["color", "prim", "token", "emoji", "inline"];
/** Columnas de hoja CSS que bloquean, como las de CORE. */
export const SHEET = ["named", "important", "zindex", "px"];
/** Columnas informativas: solo fallan con --strict. */
export const EXTRA = ["size"];

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
const SIDE = "(?:-(?:top|right|bottom|left|block|inline)(?:-(?:start|end))?)?";
const PX_PROP = `(margin|padding|gap|row-gap|column-gap|inset|top|right|bottom|left|width|height|min-width|max-width|min-height|max-height|border-radius|font-size|line-height|letter-spacing)${SIDE}`;
const PX_DECL = new RegExp(`(?<![\\w-])${PX_PROP}\\s*:([^;{}]*)`, "g");
/** Propiedades cuyo valor en px siempre debe ser un token. */
const TOKEN_ONLY = new Set(["border-radius", "font-size", "letter-spacing"]);
/** Propiedades de espacio: un valor que coincide con la escala debe escribirse con su token. */
const SPACING = new Set(["margin", "padding", "gap", "row-gap", "column-gap", "inset", "top", "right", "bottom", "left"]);

/** Posición de la llave que abre cada bloque que contiene a `index`, de fuera adentro. */
function enclosing(src, index) {
  const stack = [];
  for (let i = 0; i < index; i++) {
    if (src[i] === "{") stack.push(i);
    else if (src[i] === "}") stack.pop();
  }
  return stack;
}
/** Dónde empieza el preludio (selector o regla-arroba) del bloque que abre en `open`. */
const preludeStart = (src, open) =>
  Math.max(src.lastIndexOf("{", open - 1), src.lastIndexOf("}", open - 1), src.lastIndexOf(";", open - 1)) + 1;
/** Verdadero si `index` cae en el preludio de una regla-arroba (`@media (max-width: 640px)`): ahí no cabe un token. */
function inAtPrelude(src, index) {
  const open = src.indexOf("{", index);
  // Una declaración termina en `;` o `}` antes de que se abra otro bloque; un preludio, no.
  if (open === -1 || /[;}]/.test(src.slice(index, open))) return false;
  return src.slice(preludeStart(src, open), open).trimStart().startsWith("@");
}
/**
 * Un `!important` está justificado si un comentario lo nombra dentro de su regla, justo antes de ella o justo antes
 * del bloque condicional que la contiene. `@layer` no cuenta como bloque: un comentario al principio de la hoja no
 * justifica todo lo que hay dentro.
 */
function justified(source, src, index) {
  const blocks = enclosing(src, index).reverse();
  const mentions = (from, to) => [...source.slice(from, to).matchAll(/\/\*[\s\S]*?\*\//g)].some((c) => /!\s*important/i.test(c[0]));
  let levels = 0;
  for (const open of blocks) {
    const start = preludeStart(src, open);
    if (src.slice(start, open).trimStart().startsWith("@layer")) break;
    // Dentro del bloque, antes de la declaración; o entre el final de lo anterior y el preludio del bloque.
    if (mentions(open, index) || mentions(start, open)) return true;
    if (++levels === 2) break;
  }
  return false;
}

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
 * lo auditado; `spaces` relaciona cada valor en px de la escala de espacio con su token (`8` → `space-2`); `css` activa
 * las columnas de hoja (`named`, `important`, `zindex`, `px`, `size`), que solo tienen sentido en una hoja de estilos.
 * Cada columna es una lista de líneas (o `línea:token` en `token`).
 */
export function auditSource(source, { known = new Set(), local = new Set(), spaces = new Map(), css = false } = {}) {
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
    size: [],
    /** `!important` justificados con un comentario (no cuentan como hallazgo). */
    justified: [],
  };
  if (css) {
    out.named = lines(
      find(NAMED_DECL).filter((m) => new RegExp(`(?<![\\w-])(${NAMED})(?![\\w-])`, "i").test(withoutVars(m[0].slice(m[0].indexOf(":"))))),
    );
    const important = find(/!\s*important\b/gi);
    out.important = lines(important.filter((m) => !justified(source, src, m.index)));
    out.justified = lines(important.filter((m) => justified(source, src, m.index)));
    out.zindex = lines(find(/(?<![\w-])z-index\s*:\s*-?\d+\b/g));
    // 1px y 2px son trazos (bordes, anillos de foco): no hay token más pequeño que eso.
    for (const m of find(PX_DECL)) {
      if (inAtPrelude(src, m.index)) continue;
      const [, prop, value] = m;
      for (const px of withoutVars(value).matchAll(/(?<![\w.-])-?(\d*\.?\d+)px\b/g)) {
        const n = Number(px[1]);
        if (n < 3) continue;
        const mustBeToken = TOKEN_ONLY.has(prop) || (SPACING.has(prop) && spaces.has(n));
        out[mustBeToken ? "px" : "size"].push(lineOf(src, m.index));
      }
    }
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

  // Escala de espacio: valor en px → token. Un valor de la escala escrito a mano es un hallazgo de `px`.
  const spaces = new Map(
    Object.entries(tokens.scale)
      .filter(([name, value]) => name.startsWith("space-") && /^\d*\.?\d+px$/.test(value))
      .map(([name, value]) => [Number.parseFloat(value), name]),
  );

  const rows = [...sources].map(([file, source]) => ({
    file: posix(relative(root, file)),
    ...auditSource(source, { known, local, spaces, css: extname(file) === ".css" }),
  }));
  const failing = strict ? [...CORE, ...SHEET, ...EXTRA] : [...CORE, ...SHEET];
  const cols = [...CORE, ...SHEET, ...EXTRA];
  const justifiedCount = rows.reduce((n, r) => n + r.justified.length, 0);
  const total = Object.fromEntries(cols.map((c) => [c, rows.reduce((n, r) => n + r[c].length, 0)]));
  const sum = failing.reduce((n, c) => n + total[c], 0);
  const advisory = strict ? 0 : EXTRA.reduce((n, c) => n + total[c], 0);
  if (asJson) {
    console.log(
      JSON.stringify(
        { files: rows.length, strict, total, justified: justifiedCount, offenders: rows.filter((r) => cols.some((c) => r[c].length)) },
        null,
        2,
      ),
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
    console.log(`\n${rows.length} archivos · ${[...CORE, ...SHEET].map((c) => `${c} ${total[c]}`).join(" · ")}`);
    console.log(
      `informativo${strict ? " (--strict: cuenta)" : ""} · ${EXTRA.map((c) => `${c} ${total[c]}`).join(" · ")} · !important justificados ${justifiedCount}${advisory ? " · detalle con --strict o --json" : ""}`,
    );
    console.log(sum ? `✗ ${sum} hallazgos. Objetivo: 0.` : "✓ auditoría limpia");
  }
  process.exit(sum ? 1 : 0);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
