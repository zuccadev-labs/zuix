// Genera llms.txt: mapa de la documentación para modelos, a partir de la configuración activa y la carpeta de docs.
// En el sitio de zuix queda en static/llms.txt; en otro proyecto, en su carpeta de trabajo (.zudocs/<proyecto>/static).
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { loadZudocs, parseArgs } from "./config.mjs";

const ctx = loadZudocs(parseArgs());
const { site } = ctx;
const slug = (f) => f.replace(/\.mdx?$/, "").replace(/^\d+[-_]/, "").replace(/^(README|index)$/i, "");
// Sin front matter ni comentarios, que no son contenido.
const read = (p) => readFileSync(p, "utf8").replace(/^---\n[\s\S]*?\n---\n/, "").replace(/<!--[\s\S]*?-->/g, "");
const title = (p) => (read(p).match(/^#\s+(.+)$/m)?.[1] ?? p).trim();
const summary = (p) => (read(p).split("\n").find((l) => l.trim() && !/^(#|>|---|\||```|<|import |:::)/.test(l.trim())) ?? "").trim().slice(0, 160);

// Documentos del área en orden de lectura; las subcarpetas van después de los archivos de su nivel.
function list(dir, route) {
  const entries = readdirSync(dir, { withFileTypes: true }).filter((e) => !e.name.startsWith("_")).sort((a, b) => (a.name < b.name ? -1 : 1));
  const files = entries.filter((e) => e.isFile() && /\.mdx?$/.test(e.name)).map((e) => ({ file: join(dir, e.name), route: `${route}/${slug(e.name)}` }));
  return [...files, ...entries.filter((e) => e.isDirectory()).flatMap((e) => list(join(dir, e.name), `${route}/${slug(e.name)}`))];
}

let out = `# ${site.name}\n\n> ${site.tagline ?? ""}\n`;
for (const area of site.docs.areas) {
  const dir = join(ctx.docsDir, area.id);
  if (!existsSync(dir)) continue;
  const docs = list(dir, `${site.baseUrl ?? "/"}docs/${area.id}`);
  if (!docs.length) continue;
  out += `\n## ${area.label}\n\n${area.description ?? ""}\n\n`;
  for (const d of docs) out += `- [${title(d.file)}](${d.route}): ${summary(d.file)}\n`;
}
if (ctx.llmsAppend) out += `\n${readFileSync(ctx.llmsAppend, "utf8").trim()}\n`;
mkdirSync(dirname(ctx.llmsPath), { recursive: true });
writeFileSync(ctx.llmsPath, out);
console.log(`✓ ${ctx.rel(ctx.llmsPath)} (${out.split("\n").length} líneas)`);
