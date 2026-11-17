// Genera el paquete a partir de icons.json (salida de extract.py) y scripts/keywords.json.
// Escribe: src/icons/<nombre>.ts, src/names.ts, src/all.ts, manifest.json y la tabla de AGENTS.md.
// Falla si un alias o un emoji apunta a un icono que no existe.
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(readFileSync(join(root, p), "utf8"));
const { icons, categories, box } = read("icons.json");
const { words, aliases, emoji } = read("scripts/keywords.json");
const names = new Set(icons.map((i) => i.name));
const errors = [];
for (const k of Object.keys(aliases)) if (!names.has(k)) errors.push(`aliases: no existe el icono "${k}"`);
for (const [e, k] of Object.entries(emoji)) if (!names.has(k)) errors.push(`emoji ${e}: no existe el icono "${k}"`);
const camel0 = (n) => n.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase()).replace(/^(\d)/, "_$1");
// Cada icono: nombre normalizado, las dos variantes con trazados dentro de la caja, identificador de módulo único
// y válido, categoría existente. Alias sin repetir dentro de un icono.
const RESERVED = new Set("break case catch class const continue debugger default delete do else enum export extends false finally for function if import in instanceof new null return super switch this throw true try typeof var void while with yield let static await package interface".split(" "));
const seenIds = new Map();
for (const icon of icons) {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(icon.name)) errors.push(`${icon.name}: nombre no normalizado`);
  const id = camel0(icon.name);
  if (seenIds.has(id)) errors.push(`${icon.name}: su identificador "${id}" choca con el de ${seenIds.get(id)}`);
  if (RESERVED.has(id)) errors.push(`${icon.name}: "${id}" es una palabra reservada de JavaScript`);
  seenIds.set(id, icon.name);
  if (!(icon.category in categories)) errors.push(`${icon.name}: la categoría "${icon.category}" no existe`);
  for (const variant of ["outline", "solid"]) {
    const paths = icon.variants?.[variant];
    if (!Array.isArray(paths) || paths.length === 0) { errors.push(`${icon.name}: falta la variante ${variant}`); continue; }
    for (const [rule, d] of paths) {
      if (rule !== "nonzero" && rule !== "evenodd") errors.push(`${icon.name}/${variant}: regla de relleno desconocida "${rule}"`);
      if (!/^M[\d\s.,MLQCZ-]+$/.test(d)) errors.push(`${icon.name}/${variant}: el trazado contiene algo que no son comandos M, L, Q, C, Z y números`);
      const numbers = (d.match(/-?\d*\.?\d+/g) ?? []).map(Number);
      if (numbers.some((n) => n < 0 || n > box)) errors.push(`${icon.name}/${variant}: el trazado se sale de la caja de ${box} × ${box}`);
    }
  }
}
for (const [name, list] of Object.entries(aliases)) if (new Set(list).size !== list.length) errors.push(`aliases: "${name}" repite algún alias`);
if (errors.length) { console.error(errors.map((e) => `✗ ${e}`).join("\n")); process.exit(1); }

const camel = (n) => n.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase()).replace(/^(\d)/, "_$1");
const enc = (paths) => paths.map(([rule, d]) => (rule === "evenodd" ? `E:${d}` : d));
const untranslated = new Set();

rmSync(join(root, "src/icons"), { recursive: true, force: true });
mkdirSync(join(root, "src/icons"), { recursive: true });
const HEADER = "// GENERADO por scripts/build.mjs. No editar.\n";
const manifest = [];
for (const icon of icons) {
  const id = camel(icon.name);
  writeFileSync(join(root, "src/icons", `${icon.name}.ts`),
    `${HEADER}import type { IconDef } from "../types";\n\nexport const ${id}: IconDef = ${JSON.stringify({ name: icon.name, o: enc(icon.variants.outline), s: enc(icon.variants.solid) })};\n`);
  const parts = icon.name.split("-");
  const es = [...new Set(parts.map((w) => { if (!(w in words)) untranslated.add(w); return words[w]; }).filter(Boolean))];
  const al = aliases[icon.name] ?? [];
  manifest.push({
    name: icon.name, category: icon.category, variants: ["outline", "solid"],
    keywords: [...new Set([...parts, ...es, ...al])],
    emoji: Object.entries(emoji).filter(([, k]) => k === icon.name).map(([e]) => e),
  });
}
if (untranslated.size) { console.error(`✗ palabras sin traducción en keywords.json: ${[...untranslated].join(", ")}`); process.exit(1); }

writeFileSync(join(root, "src/names.ts"),
  `${HEADER}export const iconNames = ${JSON.stringify(icons.map((i) => i.name))} as const;\n\nexport type IconName = (typeof iconNames)[number];\n`);
writeFileSync(join(root, "src/all.ts"),
  `${HEADER}// Registra el set completo. Una aplicación lo importa una vez: import "@zuccadev-labs/zuix-zicon/all".\nimport { registerIcons } from "./registry";\n${icons.map((i) => `import { ${camel(i.name)} } from "./icons/${i.name}";`).join("\n")}\n\nexport const allIcons = [${icons.map((i) => camel(i.name)).join(", ")}];\n\nregisterIcons(allIcons);\n`);
writeFileSync(join(root, "manifest.json"), `${JSON.stringify({
  name: "@zuccadev-labs/zuix-zicon", source: "Dazicon", box, count: icons.length, variants: ["outline", "solid"],
  usage: 'import { Icon } from "@zuccadev-labs/zuix-zicon"; <Icon name="magnifying-glass" size={16} />',
  categories, icons: manifest, emoji,
}, null, 1)}\n`);

// Tabla de sustitución para agentes, dentro de AGENTS.md entre marcadores.
const agents = join(root, "AGENTS.md");
if (existsSync(agents)) {
  const byIcon = new Map();
  for (const [e, k] of Object.entries(emoji)) byIcon.set(k, [...(byIcon.get(k) ?? []), e]);
  const rows = [...byIcon].sort(([a], [b]) => a.localeCompare(b)).map(([k, es]) => `| ${es.join(" ")} | \`${k}\` |`).join("\n");
  const catRows = Object.entries(categories).map(([k, l]) => `| \`${k}\` | ${l.es} | ${icons.filter((i) => i.category === k).length} |`).join("\n");
  let md = readFileSync(agents, "utf8");
  md = md.replace(/<!-- emoji:start -->[\s\S]*<!-- emoji:end -->/, `<!-- emoji:start -->\n| Emoji | Icono |\n|---|---|\n${rows}\n<!-- emoji:end -->`);
  md = md.replace(/<!-- categories:start -->[\s\S]*<!-- categories:end -->/, `<!-- categories:start -->\n| Clave | Categoría | Iconos |\n|---|---|---|\n${catRows}\n<!-- categories:end -->`);
  writeFileSync(agents, md);
}
console.log(`✓ ${icons.length} iconos · ${Object.keys(emoji).length} emojis mapeados · ${Object.keys(aliases).length} iconos con alias de uso`);
