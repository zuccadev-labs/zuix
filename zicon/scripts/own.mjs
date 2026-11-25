#!/usr/bin/env node
// Convierte los iconos propios (zicon/own/, dibujados con trazo) al formato de zicon: contornos rellenos.
// Escribe icons-own.json, que build.mjs fusiona con icons.json, y svg/<variante>/<nombre>.svg.
// Se ejecuta solo al añadir o retocar un icono propio (`pnpm icons:own`); el build no depende de esto.
//
// Fuente: own/outline/<nombre>.svg y, si el icono tiene macizo, own/solid/<nombre>.svg (sin él, el solid es el
// mismo dibujo). Elementos: path, circle, rect (con rx), line. Un elemento con `stroke` se convierte en el contorno
// de su trazo (uniones y terminaciones redondeadas); uno con `fill` aporta su relleno; los dos se suman. Con
// `data-op="cut"` el elemento se resta de lo anterior en vez de sumarse. Los atributos de la raíz se heredan.
//
// Cada icono se escala para que su dibujo ocupe lo mismo que uno de Dazicon (de 2,36 a 21,64 por fuera, con trazo
// de 1,5) y se centra en la caja. Solid usa la misma transformación que outline.
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const ckFile = require.resolve("canvaskit-wasm/bin/canvaskit.js");
const CK = await require(ckFile)({ locateFile: (f) => join(dirname(ckFile), f) });

const STROKE = 1.5;
const OUTER = 21.64 - 2.36; // ancho exterior de un icono de Dazicon a tamaño completo
const meta = JSON.parse(readFileSync(join(root, "own/own.json"), "utf8"));
const errors = [];

const attrs = (tag) => Object.fromEntries([...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map((m) => [m[1], m[2]]));
const num = (v, d = 0) => (v === undefined ? d : Number(v));

function geometry(el, a) {
  if (el === "path") return a.d;
  if (el === "line") return `M${a.x1} ${a.y1}L${a.x2} ${a.y2}`;
  if (el === "circle") {
    const [cx, cy, r] = [num(a.cx), num(a.cy), num(a.r)];
    return `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;
  }
  if (el === "rect") {
    const [x, y, w, h] = [num(a.x), num(a.y), num(a.width), num(a.height)];
    const r = Math.min(num(a.rx, num(a.ry)), w / 2, h / 2);
    if (!r) return `M${x} ${y}h${w}v${h}h${-w}Z`;
    return `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}h${-(w - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${-r}v${-(h - 2 * r)}a${r} ${r} 0 0 1 ${r} ${-r}Z`;
  }
  return null;
}

// Elementos del archivo fuente con sus atributos efectivos (heredados de la raíz).
function parse(file) {
  const svg = readFileSync(file, "utf8");
  const rootAttrs = attrs(/<svg\b[^>]*>/.exec(svg)[0]);
  delete rootAttrs.viewBox;
  delete rootAttrs.xmlns;
  const out = [];
  for (const m of svg.matchAll(/<(path|circle|rect|line)\b([^>]*?)\/?>/g)) {
    const a = { ...rootAttrs, ...attrs(m[2]) };
    const d = geometry(m[1], a);
    const path = d && CK.Path.MakeFromSVGString(d);
    if (!path) {
      errors.push(`${file}: no se puede leer <${m[1]}${m[2]}>`);
      continue;
    }
    out.push({ path, a });
  }
  return out;
}

const transformed = (path, m) => new CK.PathBuilder(path).transform(m).detachAndDelete();
const union = (a, b) => (a ? CK.Path.MakeFromOp(a, b, CK.PathOp.Union) : b);

function shape(elements, m) {
  let acc = null;
  for (const { path, a } of elements) {
    const p = transformed(path, m);
    let part = null;
    if (a.fill && a.fill !== "none") part = p;
    if (a.stroke && a.stroke !== "none") {
      const s = p.makeStroked({
        width: num(a["stroke-width"], STROKE),
        cap: a["stroke-linecap"] === "butt" ? CK.StrokeCap.Butt : CK.StrokeCap.Round,
        join: a["stroke-linejoin"] === "miter" ? CK.StrokeJoin.Miter : CK.StrokeJoin.Round,
      });
      part = union(part, s);
    }
    if (!part) continue;
    if (a["data-op"] === "cut") acc = acc && CK.Path.MakeFromOp(acc, part, CK.PathOp.Difference);
    else acc = union(acc, part);
  }
  return acc?._makeSimplified() ?? acc;
}

const fmt = (v) => {
  const s = v.toFixed(2).replace(/\.?0+$/, "");
  return s === "-0" || s === "" ? "0" : s;
};

// Comandos de Skia a M, L, Q, C y Z. Las cónicas (arcos) pasan a cúbicas: con peso w, los puntos de control quedan
// a 4w / (3(1 + w)) del extremo hacia el punto de control de la cónica (exacto en la circunferencia a esta escala).
function toD(path) {
  const c = path.toCmds();
  let d = "";
  let i = 0;
  let last = [0, 0];
  const pt = (x, y) => `${fmt(x)} ${fmt(y)}`;
  while (i < c.length) {
    const verb = c[i++];
    if (verb === CK.MOVE_VERB) {
      last = [c[i], c[i + 1]];
      d += `M${pt(c[i], c[i + 1])}`;
      i += 2;
    } else if (verb === CK.LINE_VERB) {
      last = [c[i], c[i + 1]];
      d += `L${pt(c[i], c[i + 1])}`;
      i += 2;
    } else if (verb === CK.QUAD_VERB) {
      d += `Q${pt(c[i], c[i + 1])} ${pt(c[i + 2], c[i + 3])}`;
      last = [c[i + 2], c[i + 3]];
      i += 4;
    } else if (verb === CK.CONIC_VERB) {
      const [x1, y1, x2, y2, w] = [c[i], c[i + 1], c[i + 2], c[i + 3], c[i + 4]];
      const k = (4 * w) / (3 * (1 + w));
      d += `C${pt(last[0] + k * (x1 - last[0]), last[1] + k * (y1 - last[1]))} ${pt(x2 + k * (x1 - x2), y2 + k * (y1 - y2))} ${pt(x2, y2)}`;
      last = [x2, y2];
      i += 5;
    } else if (verb === CK.CUBIC_VERB) {
      d += `C${pt(c[i], c[i + 1])} ${pt(c[i + 2], c[i + 3])} ${pt(c[i + 4], c[i + 5])}`;
      last = [c[i + 4], c[i + 5]];
      i += 6;
    } else if (verb === CK.CLOSE_VERB) d += "Z";
    else throw new Error(`verbo de trazado desconocido: ${verb}`);
  }
  return d;
}

const svg = (paths) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="currentColor">${paths
    .map(([rule, d]) => (rule === "nonzero" ? `<path d="${d}"/>` : `<path fill-rule="evenodd" clip-rule="evenodd" d="${d}"/>`))
    .join("")}</svg>\n`;

const icons = [];
const files = readdirSync(join(root, "own/outline"))
  .filter((f) => f.endsWith(".svg"))
  .sort();
for (const file of files) {
  const name = file.slice(0, -4);
  if (!(name in meta.icons)) errors.push(`${name}: falta en own/own.json`);
  const outline = parse(join(root, "own/outline", file));
  const solidFile = join(root, "own/solid", file);
  const solid = existsSync(solidFile) ? parse(solidFile) : outline;
  // Escala y centrado a partir del dibujo outline (línea central y rellenos, sin los recortes).
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const { path, a } of outline) {
    if (a["data-op"] === "cut") continue;
    const [l, t, r, btm] = path.computeTightBounds();
    [x0, y0, x1, y1] = [Math.min(x0, l), Math.min(y0, t), Math.max(x1, r), Math.max(y1, btm)];
  }
  const scale = Math.min(1, (OUTER - STROKE) / Math.max(x1 - x0, y1 - y0));
  const m = [scale, 0, 12 - (scale * (x0 + x1)) / 2, 0, scale, 12 - (scale * (y0 + y1)) / 2, 0, 0, 1];
  const variants = {};
  for (const [variant, elements] of [
    ["outline", outline],
    ["solid", solid],
  ]) {
    const result = shape(elements, m);
    if (!result || result.isEmpty()) {
      errors.push(`${name}/${variant}: el dibujo queda vacío`);
      continue;
    }
    const rule = result.getFillType() === CK.FillType.EvenOdd ? "evenodd" : "nonzero";
    variants[variant] = [[rule, toD(result)]];
    writeFileSync(join(root, "svg", variant, file), svg(variants[variant]));
  }
  icons.push({ name, category: meta.icons[name], variants });
}
for (const name of Object.keys(meta.icons))
  if (!files.includes(`${name}.svg`)) errors.push(`own/own.json: no existe own/outline/${name}.svg`);
if (errors.length) {
  console.error(errors.map((e) => `✗ ${e}`).join("\n"));
  process.exit(1);
}
writeFileSync(join(root, "icons-own.json"), `${JSON.stringify({ source: "own", box: 24, categories: meta.categories, icons }, null, 0)}\n`);
console.log(`✓ ${icons.length} iconos propios × 2 variantes → icons-own.json y svg/`);
