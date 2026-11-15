// Verifica el sitio antes de compilar: configuración contra su esquema, áreas, nombres de archivo,
// iconos, marca, páginas y enlaces relativos entre documentos. Sin dependencias.
//   node scripts/verify.mjs [--config <ruta>]            los nombres fuera de convención son avisos
//   node scripts/verify.mjs [--config <ruta>] --strict   los avisos también hacen fallar
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { findConfig, loadZudocs, parseArgs, repoDir as repo, templateDir as root, PAGES } from "./config.mjs";

const args = parseArgs();
const strict = args.strict;
const errors = [];
const warnings = [];
const json = (p) => JSON.parse(readFileSync(p, "utf8"));

// ── 1. Configuración contra el esquema ──────────────────────────────────────
// Validador del subconjunto de JSON Schema que usa zudocs.schema.json.
function validate(value, schema, path) {
  const kind = Array.isArray(value) ? "array" : value === null ? "null" : typeof value;
  if (schema.enum && !schema.enum.includes(value)) errors.push(`config ${path}: debe ser uno de ${schema.enum.join(", ")}`);
  if (schema.type && kind !== schema.type) return void errors.push(`config ${path}: se esperaba ${schema.type} y es ${kind}`);
  if (kind === "string" && schema.minLength && value.length < schema.minLength) errors.push(`config ${path}: vacío`);
  if (kind === "array") {
    if (schema.minItems && value.length < schema.minItems) errors.push(`config ${path}: necesita al menos ${schema.minItems} elemento(s)`);
    if (schema.items) value.forEach((v, i) => validate(v, schema.items, `${path}[${i}]`));
  }
  if (kind === "object") {
    for (const key of schema.required ?? []) if (!(key in value)) errors.push(`config ${path}: falta "${key}"`);
    for (const [key, v] of Object.entries(value)) {
      const sub = schema.properties?.[key];
      if (sub) validate(v, sub, `${path}.${key}`);
      else if (schema.additionalProperties === false) errors.push(`config ${path}: campo desconocido "${key}"`);
    }
  }
}

let site, ctx;
let rel = (p) => p;
try {
  ctx = loadZudocs(args);
  ({ site, rel } = ctx);
  validate(site, json(join(root, "zudocs.schema.json")), "$");
} catch (e) {
  errors.push(`${findConfig(args.config)}: ${e.message}`);
}

if (site?.docs?.path && Array.isArray(site.docs.areas)) {
  const docs = ctx.docsDir;

  // ── 2. Marca ──────────────────────────────────────────────────────────────
  const brands = join(repo, "tokens/brands");
  if (!existsSync(join(brands, `${site.brand}.json`))) {
    const known = existsSync(brands) ? readdirSync(brands).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5)).join(", ") : "ninguna";
    errors.push(`marca "${site.brand}" no existe en tokens/brands/ (disponibles: ${known})`);
  }

  // ── 3. Iconos ─────────────────────────────────────────────────────────────
  const icons = new Set(json(join(repo, "zicon/manifest.json")).icons.map((i) => i.name));
  for (const area of site.docs.areas) if (area.icon && !icons.has(area.icon)) errors.push(`área "${area.id}": el icono "${area.icon}" no existe en zicon/manifest.json`);

  // ── 4. Logo ───────────────────────────────────────────────────────────────
  for (const key of ["src", "srcDark"]) {
    const src = site.logo?.[key];
    if (src && !/^https?:/.test(src) && !existsSync(join(ctx.staticDir, src))) errors.push(`logo.${key}: no existe ${rel(join(ctx.staticDir, src))} (la ruta es relativa a la carpeta de estáticos)`);
  }

  // ── 4b. Páginas opcionales y archivos referenciados ──────────────────────
  for (const [i, item] of (site.navbar ?? []).entries()) {
    const page = PAGES.find((p) => item.to === `/${p}` || item.to?.startsWith(`/${p}/`));
    if (page && !ctx.pages[page]) errors.push(`navbar[${i}] enlaza a ${item.to} pero la página no está activada (pages.${page}: true)`);
    if (!item.to && !item.href) errors.push(`navbar[${i}] ("${item.label}"): falta "to" o "href"`);
  }
  if (ctx.llmsAppend && !existsSync(ctx.llmsAppend)) errors.push(`llms.append: no existe ${rel(ctx.llmsAppend)}`);

  // ── 5. Áreas, nombres y enlaces ───────────────────────────────────────────
  const walk = (dir) => readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : /\.mdx?$/.test(f) ? [p] : [];
  });
  const NAME = /^(\d{2}-[a-z0-9]+(-[a-z0-9]+)*|README)\.mdx?$/;
  const seen = new Set();
  for (const area of site.docs.areas) {
    if (seen.has(area.id)) errors.push(`área "${area.id}" declarada dos veces`);
    seen.add(area.id);
    const dir = join(docs, area.id);
    if (!existsSync(dir)) { errors.push(`área "${area.id}": no existe ${rel(dir)}`); continue; }
    if (!existsSync(join(dir, "README.md")) && !existsSync(join(dir, "README.mdx"))) errors.push(`área "${area.id}": falta README.md`);
    const prefixes = new Map();
    for (const file of walk(dir)) {
      const name = file.split("/").pop();
      if (name.startsWith("_")) continue;
      if (!NAME.test(name)) warnings.push(`${rel(file)}: el nombre no sigue la convención (NN-nombre-en-minusculas.md o README.md)`);
      const prefix = name.match(/^(\d{2})-/)?.[1];
      if (prefix) {
        const key = `${dirname(file)}/${prefix}`;
        if (prefixes.has(key)) warnings.push(`${rel(file)}: prefijo ${prefix} repetido (también en ${prefixes.get(key)})`);
        prefixes.set(key, name);
      }
      if (!/^#\s+\S/m.test(readFileSync(file, "utf8"))) warnings.push(`${rel(file)}: sin título de nivel 1`);
      checkLinks(file);
    }
  }

  // Enlaces relativos a otros .md: el archivo debe existir. Los absolutos (/ruta) los comprueba Docusaurus.
  function checkLinks(file) {
    const text = readFileSync(file, "utf8").replace(/^(```|~~~)[\s\S]*?^\1.*$/gm, "").replace(/`[^`\n]*`/g, "").replace(/<!--[\s\S]*?-->/g, "");
    for (const m of text.matchAll(/\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)|^\[[^\]]+\]:\s*(\S+)/gm)) {
      const href = m[1] ?? m[2];
      if (/^([a-z][a-z0-9+.-]*:|\/|#)/i.test(href)) continue;
      const target = decodeURIComponent(href.split("#")[0].split("?")[0]);
      if (!target) continue;
      const abs = resolve(dirname(file), target);
      const line = text.slice(0, m.index).split("\n").length;
      if (!existsSync(abs)) errors.push(`${rel(file)}:${line}: enlace roto "${href}"`);
      else if (/\.mdx?$/.test(target) && !abs.startsWith(docs + "/")) errors.push(`${rel(file)}:${line}: "${href}" sale de la carpeta de documentación`);
    }
  }
}

for (const w of warnings) console.log(`aviso  ${w}`);
for (const e of errors) console.error(`error  ${e}`);
const failed = errors.length > 0 || (strict && warnings.length > 0);
console.log(`${failed ? "✗" : "✓"} zudocs verify${site?.name ? ` (${site.name})` : ""}: ${errors.length} error(es), ${warnings.length} aviso(s)`);
process.exit(failed ? 1 : 0);
