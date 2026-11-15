// Capas de compatibilidad: variables CSS antiguas de un proyecto → tokens --z-*.
// Un mapa declarativo por proyecto (compat/<proyecto>.json) produce:
//   dist/compat/<proyecto>.css         alias de cada variable antigua con equivalente
//   dist/compat/<proyecto>.app.css     las que no tienen equivalente, con su valor original (se quedan en la app)
//   dist/compat/<proyecto>.report.md   diferencias de valor por tema, renombres y variables sin equivalente
//
// El inventario del proyecto (qué variables declara su hoja y cuáles usa su código) se lee de sus fuentes,
// que viven fuera de este repositorio y nunca se modifican. Si no están (CI, otra máquina) se usa la
// instantánea compat/<proyecto>.inventory.json. La ruta de las fuentes no se escribe en el mapa: se pasa
// en la variable de entorno que nombra `source.env` (ZUIX_COMPAT_ZUTOOL_ROOT, ZUIX_COMPAT_UI_GLASS_ROOT).
//   ZUIX_COMPAT_<PROYECTO>_ROOT=<ruta> node src/compat.mjs --scan   relee las fuentes y actualiza la instantánea
//   ZUIX_COMPAT_OFFLINE=1                                           usa siempre la instantánea
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const compatDir = join(root, "compat");
const THEMES = ["dark", "light"];
const SCAN_EXT = new Set([".css", ".ts", ".tsx", ".js", ".jsx", ".html", ".vue", ".svelte"]);
const SKIP_DIR = new Set(["node_modules", "dist", "build", "target", "generated", ".git"]);

// ── Inventario del proyecto ───────────────────────────────────────────────────
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));

/** Declaraciones `--x: valor` de una hoja, separadas por tema según el selector. */
function parseSheet(text) {
  const out = { dark: {}, light: {} };
  for (const block of stripComments(text).matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const theme = /data-theme\s*=\s*["']?light/.test(block[1]) ? "light" : "dark";
    for (const d of block[2].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out[theme][d[1]] = d[2].replace(/\s+/g, " ").trim();
  }
  return out;
}

function walk(dir) {
  if (!existsSync(dir)) return [];
  if (statSync(dir).isFile()) return [dir];
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? (SKIP_DIR.has(f) ? [] : walk(p)) : SCAN_EXT.has(extname(f)) ? [p] : [];
  });
}

/** Lee las fuentes del proyecto. Devuelve null si no están disponibles. */
export function scan(spec) {
  const from = process.env[spec.source.env];
  if (process.env.ZUIX_COMPAT_OFFLINE || !from) return null;
  const base = resolve(from);
  const sheets = spec.source.sheets.map((s) => join(base, s));
  if (!sheets.every(existsSync)) throw new Error(`${spec.source.env}=${from}: no contiene ${spec.source.sheets.filter((s, i) => !existsSync(sheets[i])).join(", ")}`);
  const declared = {};
  const conflicts = [];
  for (const sheet of sheets) {
    const parsed = parseSheet(readFileSync(sheet, "utf8"));
    for (const theme of THEMES) for (const [name, value] of Object.entries(parsed[theme])) {
      const entry = (declared[name] ??= {});
      if (entry[theme] !== undefined && entry[theme] !== value) conflicts.push(`${name} (${theme}): "${entry[theme]}" y "${value}" según la hoja`);
      entry[theme] = value;
    }
  }
  // Uso: var(--x), nombres entre comillas ("--x") y la forma corta de Tailwind v4 (bg-(--x)).
  const used = {};
  const locations = {};
  const elsewhere = new Set();
  const sheetSet = new Set(sheets.map((s) => resolve(s)));
  for (const file of spec.source.scan.flatMap((d) => walk(join(base, d))).sort()) {
    const isSheet = sheetSet.has(resolve(file));
    const text = stripComments(readFileSync(file, "utf8"));
    if (!isSheet) for (const m of text.matchAll(/(?:^|[\s;{"'`(])(--[a-z][\w-]*)\s*:/g)) elsewhere.add(m[1]);
    if (isSheet) continue;
    for (const m of text.matchAll(/var\(\s*(--[a-z][\w-]*)|["'`](--[a-z][\w-]*)["'`$]|-[\[(](--[a-z][\w-]*)[\])]/g)) {
      const name = m[1] ?? m[2] ?? m[3];
      // Un nombre que acaba en guion viene de una plantilla (`--tone-${x}`): cuenta para todas las que empiezan así.
      const names = name.endsWith("-") ? Object.keys(declared).filter((d) => d.startsWith(name)) : [name];
      for (const n of names) {
        used[n] = (used[n] ?? 0) + 1;
        if (n.startsWith("--z-")) (locations[n] ??= []).push(`${relative(base, file).split("\\").join("/")}:${text.slice(0, m.index).split("\n").length}`);
      }
    }
  }
  const sort = (o) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : 1)));
  const local = Object.keys(used).filter((n) => !(n in declared));
  return {
    sheets: spec.source.sheets,
    conflicts,
    declared: sort(declared),
    used: sort(Object.fromEntries(Object.entries(used).filter(([n]) => n in declared))),
    locations: sort(locations),
    /** Variables usadas que la hoja no declara: locales de la aplicación (no dependen de la hoja). */
    usedLocal: local.filter((n) => elsewhere.has(n)).sort(),
    /** Variables usadas que nadie declara en lo escaneado: ya estaban sin definir antes de migrar. */
    usedUndefined: local.filter((n) => !elsewhere.has(n)).sort(),
  };
}

// ── Valores resueltos ─────────────────────────────────────────────────────────
function parseColor(v) {
  v = v.trim();
  let m = v.match(/^#([0-9a-f]{6})([0-9a-f]{2})?$/i);
  if (m) { const n = parseInt(m[1], 16); return [n >> 16, (n >> 8) & 255, n & 255, m[2] ? parseInt(m[2], 16) / 255 : 1]; }
  m = v.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i);
  if (m) return [...m.slice(1, 4).map((h) => parseInt(h + h, 16)), 1];
  m = v.match(/^rgba?\(([^()]+)\)$/i);
  if (m) { const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number); return p.length >= 3 && p.every((x) => !Number.isNaN(x)) ? [p[0], p[1], p[2], p[3] ?? 1] : null; }
  m = v.match(/^color-mix\(in srgb,\s*(.+?)\s+([\d.]+)%,\s*(transparent|white|black)\)$/i);
  if (m) {
    const c = parseColor(m[1]);
    if (!c) return null;
    const p = Number(m[2]) / 100;
    if (m[3] === "transparent") return [c[0], c[1], c[2], c[3] * p];
    const other = m[3] === "white" ? 255 : 0;
    return [0, 1, 2].map((i) => c[i] * p + other * (1 - p)).concat(c[3]);
  }
  return null;
}
const showColor = (c) => (c[3] >= 0.999 ? `#${c.slice(0, 3).map((x) => Math.round(x).toString(16).padStart(2, "0")).join("")}` : `rgba(${c.slice(0, 3).map((x) => Math.round(x)).join(", ")}, ${Number(c[3].toFixed(3))})`);
const normalize = (v) => v.toLowerCase().replace(/\s+/g, " ").replace(/\s*([(),/])\s*/g, "$1").replace(/(\d)\.0+(?=\D|$)/g, "$1").replace(/(\.\d*?[1-9])0+(?=\D|$)/g, "$1").replace(/(^|[^\d])0+\.(?=\d)/g, "$1.").replace(/["']/g, "").trim();
/** ¿Se ven igual dos valores CSS ya resueltos? Los colores se comparan por canal, con tolerancia de redondeo. */
function same(a, b) {
  const ca = parseColor(a), cb = parseColor(b);
  if (ca && cb) return [0, 1, 2].every((i) => Math.abs(ca[i] - cb[i]) <= 1.5) && Math.abs(ca[3] - cb[3]) <= 0.006;
  return normalize(a) === normalize(b);
}
const show = (v) => { const c = parseColor(v); return c ? showColor(c) : v; };

/** Valor antiguo resuelto: sigue los var() dentro de la hoja del proyecto. */
function resolveOld(name, theme, declared, depth = 0) {
  const entry = declared[name];
  const raw = entry?.[theme] ?? entry?.dark;
  if (raw === undefined || depth > 10) return undefined;
  return raw.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*(?:\([^()]*\))?[^()]*))?\)/g, (all, ref, fallback) => resolveOld(ref, theme, declared, depth + 1) ?? fallback ?? all);
}

/** Valor nuevo resuelto de una expresión del mapa (`{token}`, `{p.primitivo}` o literal) para una marca y un tema. */
function resolveNew(expr, theme, brand, base, depth = 0) {
  const fonts = { "font-display": brand.fonts.display ?? brand.fonts.sans, "font-sans": brand.fonts.sans, "font-mono": brand.fonts.mono };
  const lookup = (k) => brand.themes[theme][k] ?? brand.component?.[k] ?? brand.scale?.[k] ?? base.component[k] ?? base.semantic[k] ?? base.scale[k] ?? fonts[k];
  return String(expr).replace(/\{([a-z0-9.-]+)\}/gi, (all, ref) => {
    if (depth > 10) return all;
    const raw = ref.startsWith("p.") ? brand.primitives[ref.slice(2)] : lookup(ref);
    return raw === undefined ? all : resolveNew(raw, theme, brand, base, depth + 1);
  });
}

// ── Construcción ──────────────────────────────────────────────────────────────
const matcher = (pattern) => (pattern.endsWith("*") ? (n) => n.startsWith(pattern.slice(0, -1)) : (n) => n === pattern);

/**
 * Genera los archivos de todas las capas.
 * @returns {{ files: Record<string, string>, errors: string[], warnings: string[], summaries: string[] }}
 */
export function buildCompat({ base, brands, css, knownNames, header }) {
  const files = {}, errors = [], warnings = [], summaries = [];
  if (!existsSync(compatDir)) return { files, errors, warnings, summaries };
  for (const file of readdirSync(compatDir).filter((f) => f.endsWith(".json") && !f.endsWith(".inventory.json")).sort()) {
    const spec = JSON.parse(readFileSync(join(compatDir, file), "utf8"));
    const id = file.slice(0, -5);
    const fail = (m) => errors.push(`compat/${file}: ${m}`);
    const brand = brands.find((b) => b.name === spec.brand);
    if (!brand) { fail(`la marca "${spec.brand}" no existe en brands/`); continue; }
    const snapshotPath = join(compatDir, `${id}.inventory.json`);
    const snapshot = existsSync(snapshotPath) ? JSON.parse(readFileSync(snapshotPath, "utf8")) : null;
    let live = null;
    try { live = scan(spec); } catch (error) { fail(error.message); continue; }
    const inv = live ?? snapshot;
    if (!inv) { fail(`no hay instantánea ${id}.inventory.json; define ${spec.source.env} con la ruta del proyecto y ejecuta: pnpm --filter @zuccadev-labs/zuix-tokens compat:scan`); continue; }
    if (live && JSON.stringify(live) !== JSON.stringify(snapshot)) warnings.push(`compat/${id}: las fuentes del proyecto cambiaron respecto a la instantánea; ejecuta: pnpm --filter @zuccadev-labs/zuix-tokens compat:scan`);
    for (const c of inv.conflicts) fail(`las hojas del proyecto no coinciden en ${c}`);

    const names = knownNames(brand);
    const map = spec.map ?? {}, rename = spec.rename ?? {}, keep = Object.entries(spec.keep ?? {}).map(([pattern, reason]) => ({ pattern, reason, test: matcher(pattern) }));
    const declared = Object.keys(inv.declared);
    const kept = [];

    // 1. Cada variable que declara la hoja antigua tiene exactamente un destino.
    const unmapped = [];
    for (const name of declared) {
      const where = [name in map && "map", name in rename && "rename", keep.some((k) => k.test(name)) && "keep"].filter(Boolean);
      if (where.length > 1) fail(`${name} aparece en ${where.join(" y ")}; debe estar en uno solo`);
      if (!where.length) unmapped.push(`${name}${inv.used[name] ? ` (${inv.used[name]} usos)` : " (sin usos)"}`);
      if (where[0] === "keep") kept.push(name);
      // Una variable antigua con el nombre de un token de zuix significa otra cosa: no se puede redefinir.
      if (name.startsWith("--z-") && names.has(name.slice(4)) && where[0] !== "rename") fail(`${name} choca con el token de zuix del mismo nombre; decláralo en "rename" con el token que lo sustituye`);
    }
    if (unmapped.length) fail(`${unmapped.length} variable(s) de ${spec.project} sin destino. Añádelas a "map" (token equivalente) o a "keep" (sin equivalente, con motivo):\n    ${unmapped.join("\n    ")}`);
    for (const name of [...Object.keys(map), ...Object.keys(rename)]) if (!(name in inv.declared)) warnings.push(`compat/${id}: ${name} está en el mapa pero el proyecto ya no la declara`);
    for (const k of keep) if (!declared.some(k.test)) warnings.push(`compat/${id}: "${k.pattern}" (keep) no coincide con ninguna variable del proyecto`);

    // 2. Los destinos existen.
    const alias = Object.entries(map).map(([name, target]) => [name, css(target, brand, `compat/${id} ${name}`)]);
    for (const [name, r] of Object.entries(rename)) {
      if (!/^--z-/.test(r.to) || !names.has(r.to.slice(4))) fail(`rename ${name}: el token destino ${r.to} no existe`);
      if (!r.reason) fail(`rename ${name}: falta "reason"`);
    }
    // 3. Lo que se queda en la app solo puede depender de variables que sigan existiendo.
    for (const name of kept) for (const theme of THEMES) for (const ref of (inv.declared[name][theme] ?? "").matchAll(/var\(\s*(--[\w-]+)/g)) {
      if (!(ref[1] in map) && !kept.includes(ref[1])) fail(`${name} se queda en la app pero depende de ${ref[1]}, que no está en "map" ni en "keep"`);
    }

    // 4. Diferencias visibles: valor antiguo resuelto contra el del token, por tema.
    const hasLight = declared.some((n) => inv.declared[n].light !== undefined);
    const themes = hasLight ? THEMES : ["dark"];
    const diffs = [];
    let equal = 0;
    for (const [name, target] of Object.entries(map)) {
      if (!(name in inv.declared)) continue;
      const expr = target;
      const rows = themes.map((theme) => ({ theme, old: resolveOld(name, theme, inv.declared), now: resolveNew(expr, theme, brand, base) }));
      const changed = rows.filter((r) => !same(r.old, r.now));
      equal += rows.length - changed.length;
      if (changed.length) diffs.push({ name, token: expr, uses: inv.used[name] ?? 0, note: spec.notes?.[name] ?? "", rows: changed, all: changed.length === rows.length && rows.length > 1 && same(rows[0].old, rows[1].old) && same(rows[0].now, rows[1].now) });
    }

    // Una variable que se queda en la app puede depender de otra que sí cambia: hereda la diferencia.
    const keptNow = (name, theme, depth = 0) => (inv.declared[name][theme] ?? inv.declared[name].dark).replace(/var\(\s*(--[\w-]+)\s*\)/g, (all, ref) =>
      (ref in map ? resolveNew(map[ref], theme, brand, base) : kept.includes(ref) && depth < 10 ? keptNow(ref, theme, depth + 1) : all));
    for (const name of kept) {
      const refs = [...(inv.declared[name].dark + (inv.declared[name].light ?? "")).matchAll(/var\(\s*(--[\w-]+)/g)].map((m) => m[1]);
      if (!refs.length) continue;
      const rows = themes.map((theme) => ({ theme, old: resolveOld(name, theme, inv.declared), now: keptNow(name, theme) })).filter((r) => !same(r.old, r.now));
      if (rows.length) diffs.push({ name, token: "se queda en la app", uses: inv.used[name] ?? 0, note: `Hereda el cambio de ${[...new Set(refs)].map((r) => `\`${r}\``).join(", ")}.`, rows, all: false });
    }

    // 5. Archivos.
    const title = `${spec.label ?? spec.project} → @zuccadev-labs/zuix-tokens, marca ${brand.name}`;
    files[`dist/compat/${id}.css`] = [
      header.trimEnd(),
      `/* Capa de compatibilidad: ${title}.`,
      `   Importar después de @zuccadev-labs/zuix-tokens/css/${brand.name}.css (o de tokens.css con data-brand="${brand.name}" en <html>).`,
      `   Cada variable antigua apunta a su token; el tema y la marca los sigue el token. Fuente: compat/${file}. */`,
      `:root {`,
      ...alias.map(([name, value]) => `  ${name}: ${value};`),
      `}`, "",
    ].join("\n");

    const block = (selector, theme, indent = "") => {
      const lines = kept.filter((n) => inv.declared[n][theme] !== undefined).map((n) => `${indent}  ${n}: ${inv.declared[n][theme]};`);
      return lines.length ? `${indent}${selector} {\n${lines.join("\n")}\n${indent}}` : "";
    };
    files[`dist/compat/${id}.app.css`] = [
      header.trimEnd(),
      `/* Variables de ${spec.project} sin equivalente en @zuccadev-labs/zuix-tokens, con su valor original.`,
      `   Son de la aplicación: al migrar, este archivo sustituye a su hoja de tokens y pasa a ser suyo.`,
      `   Importar después de la capa de compatibilidad (${id}.css), de la que dependen algunas. */`,
      block(`:root,\n:root[data-theme="dark"]`, "dark"),
      hasLight ? block(`:root[data-theme="light"]`, "light") : "",
      // Sin data-theme, @zuccadev-labs/zuix-tokens sigue la preferencia del sistema; estas variables hacen lo mismo.
      hasLight && block("x", "light") ? `@media (prefers-color-scheme: light) {\n${block(":root:not([data-theme])", "light", "  ")}\n}` : "",
      "",
    ].filter((s, i, a) => s !== "" || i === a.length - 1).join("\n");

    files[`dist/compat/${id}.report.md`] = report({ spec, id, brand, inv, diffs, equal, themes, kept, keep, rename });
    summaries.push(`compat/${id}: ${alias.length} alias, ${kept.length} sin equivalente, ${Object.keys(rename).length} renombre(s), ${diffs.length} con diferencia visible (${live ? "fuentes" : "instantánea"})`);
  }
  return { files, errors, warnings, summaries };
}

function report({ spec, id, brand, inv, diffs, equal, themes, kept, keep, rename }) {
  const code = (s) => `\`${String(s).replace(/\|/g, "\\|")}\``;
  const short = (v) => { const s = show(v ?? "sin definir"); return s.length > 64 ? `${s.slice(0, 61)}…` : s; };
  const lines = [
    `<!-- GENERADO por @zuccadev-labs/zuix-tokens (src/compat.mjs) a partir de compat/${id}.json. No editar. -->`,
    `# Capa de compatibilidad: ${spec.label ?? spec.project}`, "",
    `Marca: \`${brand.name}\`. Hojas del proyecto: ${inv.sheets.map(code).join(", ")}.`, "",
    `- Variables que declara la hoja antigua: ${Object.keys(inv.declared).length}`,
    `- Con alias a un token: ${Object.keys(spec.map ?? {}).length}`,
    `- Sin equivalente (se quedan en la app): ${kept.length}`,
    `- A renombrar en el código: ${Object.keys(rename).length}`,
    `- Comparaciones de valor iguales: ${equal}; con diferencia visible: ${diffs.reduce((a, d) => a + d.rows.length, 0)} (${themes.map((t) => (t === "dark" ? "oscuro" : "claro")).join(" y ")})`, "",
    `## Diferencias visibles`, "",
    diffs.length ? `| Variable | Usos | Token | Tema | Antes | Después | Nota |\n|---|---|---|---|---|---|---|` : "Ninguna.",
    ...diffs.flatMap((d) => (d.all ? [{ ...d.rows[0], theme: "ambos" }] : d.rows).map((r) => `| ${code(d.name)} | ${d.uses} | ${code(d.token)} | ${r.theme === "dark" ? "oscuro" : r.theme === "light" ? "claro" : r.theme} | ${code(short(r.old))} | ${code(short(r.now))} | ${d.note} |`)),
    "", `## A renombrar en el código`, "",
    Object.keys(rename).length ? `| Variable | Sustituir por | Motivo | Dónde |\n|---|---|---|---|` : "Ninguna.",
    ...Object.entries(rename).map(([n, r]) => `| ${code(n)} | ${code(r.to)} | ${r.reason} | ${(inv.locations[n] ?? []).map(code).join(", ") || "sin usos"} |`),
    "", `## Sin equivalente`, "",
    `| Variables | Usos | Motivo |\n|---|---|---|`,
    ...keep.map((k) => { const mine = kept.filter(k.test); return `| ${mine.map(code).join(", ")} | ${mine.reduce((a, n) => a + (inv.used[n] ?? 0), 0)} | ${k.reason} |`; }),
    "", `## Variables que la hoja no declara`, "",
    `Usadas y declaradas en otro archivo del proyecto (no dependen de la hoja): ${inv.usedLocal.length}.`, "",
    inv.usedUndefined.length ? `Usadas sin declaración estática en lo escaneado (se fijan desde JavaScript o llevan valor de respaldo; ya estaban así antes de migrar): ${inv.usedUndefined.map(code).join(", ")}.` : "Ninguna variable usada queda sin declarar.",
    "",
  ];
  return lines.join("\n");
}

// ── node src/compat.mjs --scan ────────────────────────────────────────────────
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (!process.argv.includes("--scan")) { console.error("Uso: node src/compat.mjs --scan"); process.exit(1); }
  for (const file of readdirSync(compatDir).filter((f) => f.endsWith(".json") && !f.endsWith(".inventory.json")).sort()) {
    const spec = JSON.parse(readFileSync(join(compatDir, file), "utf8"));
    let inv = null;
    try { inv = scan(spec); } catch (error) { console.error(`✗ ${file}: ${error.message}`); process.exitCode = 1; continue; }
    if (!inv) { console.log(`-  ${file}: ${spec.source.env} sin definir; se conserva la instantánea`); continue; }
    writeFileSync(join(compatDir, `${file.slice(0, -5)}.inventory.json`), `${JSON.stringify(inv, null, 2)}\n`);
    console.log(`✓ ${file.slice(0, -5)}.inventory.json: ${Object.keys(inv.declared).length} variables declaradas, ${Object.keys(inv.used).length} en uso`);
  }
}
