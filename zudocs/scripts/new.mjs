// Crea un documento a partir de una plantilla de templates/, en el área indicada y con el siguiente prefijo numérico.
//   zudocs new [--config <ruta>] <tipo> <area> "<título>" ["<descripción>"]
//   pnpm --filter @zuccadev-labs/zuix-zudocs new -- <tipo> <area> "<título>" ["<descripción>"]
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadZudocs, parseArgs, templateDir as root } from "./config.mjs";

const fail = (message, usage = "") => { process.stderr.write(`✗ ${message}${usage}\n`); process.exit(1); };
let args, ctx;
try { args = parseArgs(); ctx = loadZudocs(args); } catch (e) { fail(e.message); }
const templates = join(root, "templates");
const types = readdirSync(templates).filter((f) => f.endsWith(".md")).map((f) => f.slice(0, -3)).sort();
const areas = ctx.site.docs.areas.map((a) => a.id);
const usage = `\n\nUso: zudocs new [--config <ruta>] <tipo> <area> "<título>" ["<descripción>"]\n  tipos: ${types.join(", ")}\n  áreas: ${areas.join(", ")}`;
const [type, area, rawTitle, rawDescription, ...extra] = args.rest;
// Una línea: un salto dentro del título o la descripción rompería el front matter o el encabezado.
const oneLine = (s) => s?.replace(/\s+/g, " ").trim();
const title = oneLine(rawTitle);
const description = oneLine(rawDescription);

if (!type || !area || !title) fail("Faltan argumentos.", usage);
if (extra.length) fail(`Sobran argumentos: ${extra.join(" ")}. El título y la descripción van entre comillas.`, usage);
if (!types.includes(type)) fail(`Tipo desconocido: "${type}".`, usage);
if (!areas.includes(area)) fail(`El área "${area}" no está declarada en ${ctx.rel(ctx.configPath)}.`, usage);

const dir = join(ctx.docsDir, area);
if (!existsSync(dir)) fail(`No existe la carpeta del área: ${ctx.rel(dir)}. Créala con su README.md.`);

const slug = title.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60).replace(/-+$/, "");
if (!slug) fail("El título no produce un nombre de archivo válido: necesita letras o cifras.");
const files = readdirSync(dir);
const clash = files.find((f) => f.replace(/^\d+-/, "").replace(/\.mdx?$/, "") === slug);
if (clash) fail(`Ya existe un documento con ese nombre en ${area}: ${clash}`);
const last = Math.max(0, ...files.map((f) => Number(f.match(/^(\d{2})-/)?.[1] ?? 0)));
if (last >= 99) fail(`El área ${area} agotó los prefijos de dos dígitos.`);
const file = join(dir, `${String(last + 1).padStart(2, "0")}-${slug}.md`);

const quote = (s) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
// Sustitución en una sola pasada y con función: un título con "$&" o "{{fecha}}" se escribe tal cual.
const values = { titulo: title, descripcion: quote(description ?? ""), fecha: new Date().toISOString().slice(0, 10) };
let text = readFileSync(join(templates, `${type}.md`), "utf8");
if (!description) text = text.replace(/^description: .*\n/m, "");
text = text.replace(/\{\{(titulo|descripcion|fecha)\}\}/g, (_, key) => values[key]);
try { writeFileSync(file, text, { flag: "wx" }); } catch (e) { fail(`No se pudo crear ${ctx.rel(file)}: ${e.message}`); }
process.stdout.write(`✓ ${ctx.rel(file)} (plantilla ${type})\n`);
