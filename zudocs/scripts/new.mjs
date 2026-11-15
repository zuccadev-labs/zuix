// Crea un documento a partir de una plantilla de templates/, en el área indicada y con el siguiente prefijo numérico.
//   pnpm --filter @zuccadev-labs/zuix-zudocs new -- <tipo> <area> "<título>" ["<descripción>"]
//   zudocs new --config <ruta> <tipo> <area> "<título>" ["<descripción>"]      en otro proyecto
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { loadZudocs, parseArgs, templateDir as root } from "./config.mjs";

const args = parseArgs();
const ctx = loadZudocs(args);
const { site } = ctx;
const templates = join(root, "templates");
const types = readdirSync(templates).filter((f) => f.endsWith(".md")).map((f) => f.slice(0, -3)).sort();
const areas = site.docs.areas.map((a) => a.id);
const [type, area, title, description] = args.rest;

const fail = (message) => {
  console.error(`${message}\n\nUso: pnpm --filter @zuccadev-labs/zuix-zudocs new -- <tipo> <area> "<título>" ["<descripción>"]\n  tipos: ${types.join(", ")}\n  áreas: ${areas.join(", ")}`);
  process.exit(1);
};
if (!type || !area || !title) fail("Faltan argumentos.");
if (!types.includes(type)) fail(`Tipo desconocido: "${type}".`);
if (!areas.includes(area)) fail(`El área "${area}" no está declarada en ${ctx.rel(ctx.configPath)}.`);

const dir = join(ctx.docsDir, area);
if (!existsSync(dir)) fail(`No existe la carpeta del área: ${dir}`);

const slug = title.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
if (!slug) fail("El título no produce un nombre de archivo válido.");
const files = readdirSync(dir);
const clash = files.find((f) => f.replace(/^\d+-/, "").replace(/\.mdx?$/, "") === slug);
if (clash) fail(`Ya existe un documento con ese nombre en ${area}: ${clash}`);
const last = Math.max(0, ...files.map((f) => Number(f.match(/^(\d{2})-/)?.[1] ?? 0)));
if (last >= 99) fail(`El área ${area} agotó los prefijos de dos dígitos.`);
const file = join(dir, `${String(last + 1).padStart(2, "0")}-${slug}.md`);

const quote = (s) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
let text = readFileSync(join(templates, `${type}.md`), "utf8");
text = description ? text.replace("{{descripcion}}", quote(description)) : text.replace(/^description: .*\n/m, "");
text = text.replaceAll("{{titulo}}", title).replaceAll("{{fecha}}", new Date().toISOString().slice(0, 10));
writeFileSync(file, text, { flag: "wx" });
console.log(`✓ ${ctx.rel(file)} (plantilla ${type})`);
