#!/usr/bin/env node
// Reúne y valida los manifiestos de zui y zout. Escribe <paquete>/manifest.json.
// Falla si: falta un campo obligatorio, un token no existe, un icono de un ejemplo no existe,
// o un componente exportado no está cubierto por ningún manifiesto.
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => {
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch (error) {
    console.error(
      `✗ ${relative(root, p).split(sep).join("/")}: ${error.code === "ENOENT" ? "no existe (¿falta pnpm tokens o pnpm icons?)" : `JSON no válido: ${error.message}`}`,
    );
    process.exit(1);
  }
};
// Orden fijo y rutas con "/" en cualquier sistema: manifest.json sale igual, byte a byte, en Linux, macOS y Windows.
const walk = (d) =>
  readdirSync(d)
    .sort()
    .flatMap((f) => {
      const p = join(d, f);
      return statSync(p).isDirectory() ? walk(p) : [p];
    });
const rel = (p) => relative(root, p).split(sep).join("/");
const tokens = read(join(root, "tokens/dist/tokens.json"));
const known = new Set([
  "font-display",
  "font-sans",
  "font-mono",
  ...Object.keys(tokens.scale),
  ...Object.keys(tokens.component),
  ...Object.keys(tokens.semanticDerived),
  ...tokens.required,
]);
for (const b of Object.values(tokens.brands)) for (const t of Object.values(b.themes)) for (const k of Object.keys(t)) known.add(k);
const icons = new Set(read(join(root, "zicon/manifest.json")).icons.map((i) => i.name));
const REQUIRED = ["name", "group", "description", "import", "props", "tokens", "classes", "examples"];
const errors = [];
let total = 0;

for (const pkg of ["zui", "zout"]) {
  const src = join(root, pkg, "src");
  if (!existsSync(src)) continue;
  const files = walk(src);
  const manifests = files
    .filter((f) => f.endsWith(".manifest.json"))
    .map((f) => ({ file: rel(f), ...read(f) }))
    .sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0));
  const covered = new Set();
  for (const m of manifests) {
    for (const k of REQUIRED)
      if (m[k] === undefined || (Array.isArray(m[k]) && k !== "props" && m[k].length === 0)) errors.push(`${m.file}: falta "${k}"`);
    for (const t of m.tokens ?? []) if (!known.has(t)) errors.push(`${m.file}: el token "${t}" no existe`);
    for (const ex of m.examples ?? []) {
      if (!ex.title || !ex.code) errors.push(`${m.file}: ejemplo sin title o code`);
      for (const hit of (ex.code ?? "").matchAll(/\b(?:icon|name|leadingIcon|trailingIcon|iconRight|iconLeft)=["']([a-z0-9-]+)["']/g))
        if (/\bicon/i.test(hit[0]) && !icons.has(hit[1])) errors.push(`${m.file}: el ejemplo usa el icono inexistente "${hit[1]}"`);
    }
    for (const e of [m.name, ...(m.exports ?? [])]) covered.add(e);
  }
  // Componentes exportados: funciones/constantes con mayúscula inicial en archivos .tsx de componentes y layouts.
  for (const f of files.filter((f) => f.endsWith(".tsx") && /[\\/](components|layouts)[\\/]/.test(f) && !/internal/.test(f))) {
    const code = readFileSync(f, "utf8");
    for (const hit of code.matchAll(/^export (?:function|const|class) ([A-Z][A-Za-z0-9]*)/gm))
      if (!covered.has(hit[1])) errors.push(`${rel(f)}: "${hit[1]}" se exporta pero ningún manifiesto lo cubre (name o exports)`);
  }
  const groups = {};
  for (const m of manifests) {
    groups[m.group] ??= [];
    groups[m.group].push(m.name);
  }
  writeFileSync(
    join(root, pkg, "manifest.json"),
    `${JSON.stringify({ name: `@zuccadev-labs/zuix-${pkg}`, count: manifests.length, groups, components: manifests.map(({ file, ...m }) => ({ ...m, file })) }, null, 1)}\n`,
  );
  total += manifests.length;
  console.log(
    `${pkg}: ${manifests.length} manifiestos · ${Object.entries(groups)
      .map(([g, n]) => `${g} ${n.length}`)
      .join(" · ")}`,
  );
}
if (errors.length) {
  console.error(errors.map((e) => `✗ ${e}`).join("\n"));
  console.error(`✗ ${errors.length} problemas`);
  process.exit(1);
}
console.log(`✓ ${total} manifiestos válidos`);
