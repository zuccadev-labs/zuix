// Genera los archivos del sitio que salen de la documentación y la configuración:
//   llms.txt        mapa de la documentación para modelos, con el formato de https://llmstxt.org
//   llms-full.txt   toda la documentación en un archivo (`llms.full`, activo por defecto)
//   <ruta>.md       copia en Markdown de cada documento junto a su página, como pide llmstxt.org
//   robots.txt      permite todo y declara el sitemap, si el proyecto no trae el suyo
// llms.txt del sitio de zuix queda en static/llms.txt (versionado); todo lo demás, y todo lo de otro
// proyecto, en la carpeta de archivos generados (.zudocs/<proyecto>/static), que se vacía en cada ejecución.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { loadZudocs, parseArgs } from "./config.mjs";
import { componentMarkdown, groupsOf, loadCatalog } from "./components.mjs";
import { listDocs, sentence } from "./docs.mjs";

const ctx = loadZudocs(parseArgs());
const { site } = ctx;
const full = site.llms?.full !== false;
const write = (path, text) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
};

rmSync(ctx.generatedStaticDir, { recursive: true, force: true });
mkdirSync(ctx.generatedStaticDir, { recursive: true });

const docs = listDocs(ctx.docsDir).filter((d) => !d.draft);
const byFile = new Map(docs.map((d) => [d.file, d]));
// Con las copias .md, llms.txt enlaza al Markdown: es lo que un modelo lee mejor.
const link = (doc) => ctx.href(full ? `${doc.route}.md` : doc.route);
const inline = (s) => s.replace(/\s+/g, " ").replace(/[[\]]/g, "");

/** Cuerpo del documento con los enlaces relativos a otros documentos convertidos en URL del sitio. */
function portable(doc) {
  return doc.body
    .replace(/(\]\(\s*<?)([^)\s>#]+\.mdx?)(#[^)\s>]*)?/g, (all, open, path, hash = "") => {
      if (/^[a-z][a-z0-9+.-]*:|^\//i.test(path)) return all;
      const target = byFile.get(resolve(dirname(doc.file), decodeURIComponent(path)));
      return target ? `${open}${link(target)}${hash}` : all;
    })
    .trim();
}

let out = `# ${site.name}\n`;
if (site.tagline) out += `\n> ${site.tagline}\n`;
let fullText = out;
for (const area of site.docs.areas) {
  const items = docs.filter((d) => d.area === area.id);
  if (!items.length) continue;
  out += `\n## ${area.label}\n\n`;
  for (const d of items) {
    const note = sentence(d.description || d.summary);
    out += `- [${inline(d.title)}](${link(d)})${note ? `: ${inline(note)}` : ""}\n`;
    const body = portable(d);
    const text = `${/^#\s/m.test(body) ? "" : `# ${d.title}\n\n`}${body}\n`;
    if (full) write(join(ctx.generatedStaticDir, `${d.route}.md`), text);
    fullText += `\n---\n\nFuente: ${ctx.href(d.route)}\n\n${text}`;
  }
}
// Una página por componente (si el sitio publica el catálogo): su copia .md y una línea en llms.txt.
const catalog = ctx.pages.components ? loadCatalog() : [];
for (const g of groupsOf(catalog)) {
  out += `\n## Componentes: ${g.label}\n\n`;
  for (const c of catalog.filter((x) => x.group === g.id)) {
    const route = c.path.replace(/^\//, "");
    out += `- [${c.name}](${ctx.href(full ? `${route}.md` : route)}): ${inline(sentence(c.description))}\n`;
    const text = componentMarkdown(c, { href: ctx.href });
    if (full) write(join(ctx.generatedStaticDir, `${route}.md`), text);
    fullText += `\n---\n\nFuente: ${ctx.href(route)}\n\n${text}`;
  }
}
if (ctx.llmsAppend) out += `\n${readFileSync(ctx.llmsAppend, "utf8").trim()}\n`;
write(ctx.llmsPath, out);
if (full) write(join(ctx.generatedStaticDir, "llms-full.txt"), fullText);

// robots.txt solo cuenta en la raíz del dominio: con un baseUrl distinto de / se genera igual, pero los
// buscadores no lo leen ahí.
const ownRobots = existsSync(join(ctx.staticDir, "robots.txt"));
if (!ownRobots)
  write(join(ctx.generatedStaticDir, "robots.txt"), `User-agent: *\nAllow: /\n${ctx.url ? `\nSitemap: ${ctx.href("sitemap.xml")}\n` : ""}`);

process.stdout.write(
  `✓ ${ctx.rel(ctx.llmsPath)} (${docs.length} documentos${catalog.length ? `, ${catalog.length} componentes` : ""})${full ? ", llms-full.txt y copias .md" : ""}${ownRobots ? "" : ", robots.txt"}\n`,
);
