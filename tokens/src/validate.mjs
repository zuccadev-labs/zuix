// Verifica el contraste de cada marca y tema (WCAG 2.2). Código de salida 1 si algo no llega a su mínimo.
//   1. Matriz del contrato: cada token de texto sobre cada superficie (1.4.3, 4.5:1) y el texto de `canvas`.
//   2. Pares declarados en src/base.json (`contrast.pairs`).
//   3. Pares reales: los que usan las hojas de zui y zout (se leen de ../zui y ../zout si están; fuera del
//      monorepo este paso se omite). Texto 4.5:1; gráficos (iconos, indicadores) 3:1 (1.4.11).
//   4. No texto (1.4.11, 3:1): bordes de control e indicador de foco frente a la superficie que los rodea.
// Las superficies translúcidas se componen sobre el fondo de aplicación, incluidos los extremos de su degradado
// (cota conservadora). Un par que falla y depende de otra hoja se anota en src/contrast-baseline.json con su
// motivo: no rompe la generación y se lista como pendiente; cuando deja de fallar, un aviso pide quitarlo de ahí.
// Uso: node src/validate.mjs [--verbose] [--json]
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadAll, expandToken } from "./build.mjs";
import { canvasCandidates, contrast, flatten, over, parseColor, toHex } from "./color.mjs";
import { extractUses, parseRules } from "./pairs.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const verbose = process.argv.includes("--verbose");
const asJson = process.argv.includes("--json");
const { base, brands } = loadAll();
const spec = base.contrast;
const baselineFile = join(root, "src/contrast-baseline.json");
const baseline = existsSync(baselineFile) ? JSON.parse(readFileSync(baselineFile, "utf8")).pending : [];
const THEMES = ["dark", "light"];

// Hojas de los componentes, si este paquete está dentro del monorepo.
const sheets = [];
for (const [pkg, dir] of [
  ["zui", "../zui/src/styles"],
  ["zout", "../zout/src/styles"],
]) {
  const abs = join(root, dir);
  if (!existsSync(abs)) continue;
  for (const f of readdirSync(abs)
    .filter((f) => f.endsWith(".css"))
    .sort())
    sheets.push({ pkg, file: `${pkg}/src/styles/${f}`, css: readFileSync(join(abs, f), "utf8") });
}
const rules = sheets.flatMap((s) => parseRules(s.css, s.file));
const isToken = (name) => brands.some((b) => THEMES.some((t) => expandToken(name, b, t) != null));
const uses = extractUses(rules, isToken);
const ignored = (u) => spec.ignore.find((i) => u.selector.includes(i.selector) && (!i.fg || i.fg === u.fg));

const failures = []; // { where, what, ratio, min, key? }
const report = []; // filas para --verbose / --json
let checked = 0;

for (const brand of brands) {
  for (const theme of THEMES) {
    const where = `${brand.name}/${theme}`;
    const color = (name) => {
      const v = expandToken(name, brand, theme);
      return v == null ? null : parseColor(v);
    };
    const need = (name) => {
      const c = color(name);
      if (!c) throw new Error(`${where}: "${name}" no se resuelve a un color (${expandToken(name, brand, theme)})`);
      return c;
    };
    const canvas = canvasCandidates(need("canvas"), expandToken("canvas-gradient", brand, theme));
    // Cada superficie: lista de colores opacos posibles (uno por candidato de fondo de aplicación).
    const surfaces = {};
    for (const [name, s] of Object.entries(spec.surfaces)) {
      const bottoms = s.over === "canvas" ? canvas : [null];
      surfaces[name] = bottoms.map((b) => flatten([...(b ? [b] : []), ...s.layers.map(need)]));
    }
    /** Peor contraste de `fg` (y su fondo propio opcional) sobre una lista de fondos opacos. */
    const worst = (fg, own, backs) => {
      let min = Infinity,
        at = null;
      for (const back of backs) {
        const bg = own ? over(own, back) : back;
        const r = contrast(over(fg, bg), bg);
        if (r < min) {
          min = r;
          at = bg;
        }
      }
      return { ratio: min, bg: at };
    };
    const check = (what, ratio, min, extra = {}) => {
      checked += 1;
      const row = { where, what, ratio: Math.round(ratio * 100) / 100, min, ...extra };
      report.push(row);
      if (ratio < min) failures.push(row);
    };

    // 1. Matriz del contrato.
    for (const token of spec.text)
      for (const [name, backs] of Object.entries(surfaces)) check(`${token} sobre ${name}`, worst(need(token), null, backs).ratio, 4.5);
    for (const token of spec.canvasText) check(`${token} sobre canvas`, worst(need(token), null, canvas).ratio, 4.5);
    // 2. Pares declarados.
    for (const pair of spec.pairs) {
      const bg = need(pair.bg);
      const backs = bg[3] < 1 ? Object.values(surfaces).flat() : [bg];
      check(`${pair.fg} sobre ${pair.bg}`, worst(need(pair.fg), bg[3] < 1 ? bg : null, backs).ratio, pair.min);
    }
    // 3. Pares reales de las hojas.
    const allSurfaces = Object.values(surfaces).flat();
    for (const u of uses.text) {
      if (ignored(u)) continue;
      const fg = color(u.fg),
        own = u.bg ? color(u.bg) : null;
      if (!fg || (u.bg && !own)) continue; // no es un color (p. ej. un degradado): fuera de esta medida
      const onCanvas = spec.canvasText.includes(u.fg);
      if (!u.bg && !onCanvas && spec.text.includes(u.fg)) continue; // ya medido en la matriz
      const backs = own && own[3] === 1 ? [own] : onCanvas ? canvas : allSurfaces;
      const pkg = u.file.split("/")[0];
      check(
        `${u.fg} sobre ${u.bg ?? "la superficie"} · ${u.selector}`,
        worst(fg, own && own[3] < 1 ? own : null, backs).ratio,
        u.graphic ? 3 : 4.5,
        { key: `${pkg}:${u.fg}/${u.bg ?? "*"}`, file: u.file },
      );
    }
    // 4. No texto: bordes de control e indicador de foco, frente a la superficie que los rodea.
    for (const token of spec.nonText) check(`${token} (no texto) frente a la superficie`, worst(need(token), null, allSurfaces).ratio, 3);
    for (const u of uses.borders) {
      if (spec.nonText.includes(u.border)) continue;
      check(`${u.border} (borde) · ${u.selector}`, worst(need(u.border), null, allSurfaces).ratio, 3, {
        key: `${u.file.split("/")[0]}:${u.border}/border`,
        file: u.file,
      });
    }
    if (verbose && !asJson) console.log(`${where}: canvas ${canvas.map(toHex).join(" ")}`);
  }
}

// Pendientes conocidos (otra hoja tiene que cambiar) frente a fallos nuevos.
const pendingKeys = new Map(baseline.map((b) => [b.key, b]));
const pending = failures.filter((f) => f.key && pendingKeys.has(f.key));
const broken = failures.filter((f) => !(f.key && pendingKeys.has(f.key)));
const stale = baseline.filter((b) => !failures.some((f) => f.key === b.key));

if (asJson) {
  console.log(
    JSON.stringify(
      { checked, sheets: sheets.map((s) => s.file), failures: broken, pending, stale: stale.map((s) => s.key), rows: report },
      null,
      1,
    ),
  );
} else {
  if (verbose)
    for (const r of report) console.log(`  ${r.ratio >= r.min ? "✓" : "✗"}  ${r.where} · ${r.what}: ${r.ratio.toFixed(2)} (mín. ${r.min})`);
  const group = (list) => {
    const by = new Map();
    for (const f of list) {
      const e = by.get(f.what) ?? { min: f.min, rows: [] };
      e.rows.push(`${f.where} ${f.ratio.toFixed(2)}`);
      by.set(f.what, e);
    }
    return [...by].map(([what, e]) => `  ${what} (mín. ${e.min}): ${e.rows.join(" · ")}`).join("\n");
  };
  console.log(
    `contraste: ${checked} comprobaciones en ${brands.length} marcas × ${THEMES.length} temas · ${uses.text.length} usos de texto y ${uses.borders.length} bordes de control leídos de ${sheets.length} hojas${sheets.length ? "" : " (fuera del monorepo: solo el contrato de tokens)"}`,
  );
  if (pending.length) {
    console.log(`\n– ${new Set(pending.map((p) => p.key)).size} pares pendientes, anotados en src/contrast-baseline.json:`);
    for (const b of baseline.filter((b) => pending.some((p) => p.key === b.key))) {
      const rows = pending.filter((p) => p.key === b.key);
      console.log(
        `  ${b.key}: peor ${Math.min(...rows.map((r) => r.ratio)).toFixed(2)} (mín. ${rows[0].min}) en ${new Set(rows.map((r) => r.where)).size} temas · ${b.fix}`,
      );
    }
  }
  if (stale.length)
    console.log(
      `\naviso  src/contrast-baseline.json: estos pares ya llegan a su mínimo; quita su entrada: ${stale.map((s) => s.key).join(", ")}`,
    );
  if (broken.length) console.log(`\n✗ ${broken.length} comprobaciones por debajo del mínimo:\n${group(broken)}`);
  if (!broken.length)
    console.log(`\n✓ contraste correcto en todas las marcas y temas${pending.length ? " (salvo los pendientes anotados)" : ""}`);
}
process.exit(broken.length ? 1 : 0);
