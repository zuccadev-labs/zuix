// Verifica el sitio antes de compilar. Sin dependencias.
//   node scripts/verify.mjs [--config <ruta>]            los avisos no hacen fallar
//   node scripts/verify.mjs [--config <ruta>] --strict   los avisos también hacen fallar
//
// Errores: configuración contra su esquema, marca, iconos, logo, favicon e imagen social, navbar, llms.append,
// fuentes locales, áreas con carpeta y README, front matter, rutas repetidas, enlaces relativos, anclas e
// imágenes que no existen, e iconos desconocidos en .mdx.
// Avisos: nombres fuera de convención, prefijos repetidos, sin título o con varios, títulos vacíos o repetidos,
// documentos fuera de toda área, marcadores de plantilla sin rellenar, imágenes sin texto alternativo,
// fuentes servidas por un tercero y sitio sin `url`.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { findConfig, loadZudocs, parseArgs, PAGES, repoDir as repo } from "./config.mjs";
import { listDocs, stripCode } from "./docs.mjs";

const errors = [];
const warnings = [];
const json = (p) => JSON.parse(readFileSync(p, "utf8"));
const print = (line) => process.stdout.write(`${line}\n`);

let args = { strict: false };
let ctx;
try {
  args = parseArgs();
  if (args.rest.length) throw new Error(`argumento desconocido: ${args.rest.join(" ")}`);
  ctx = loadZudocs(args);
} catch (e) {
  // loadZudocs ya nombra el archivo; un error de argumentos no depende de él.
  errors.push(...String(e.message).split("\n").map((l, i) => (i === 0 && !l.includes(findConfig(args.config)) ? l : l.trimEnd())));
}

if (ctx) {
  const { site, rel, docsDir: docs } = ctx;

  // ── 1. Marca ──────────────────────────────────────────────────────────────
  const brands = join(repo, "tokens/brands");
  if (!existsSync(join(brands, `${site.brand}.json`))) {
    const known = existsSync(brands) ? readdirSync(brands).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5)).join(", ") : "ninguna";
    errors.push(`marca "${site.brand}" no existe en tokens/brands/ (disponibles: ${known})`);
  }

  // ── 2. Iconos de las áreas ────────────────────────────────────────────────
  const icons = new Set(json(join(repo, "zicon/manifest.json")).icons.map((i) => i.name));
  for (const area of site.docs.areas) if (area.icon && !icons.has(area.icon)) errors.push(`área "${area.id}": el icono "${area.icon}" no existe en zicon/manifest.json`);

  // ── 3. Archivos que nombra la configuración ───────────────────────────────
  const inStatic = (field, src) => { if (src && !/^https?:/.test(src) && !existsSync(join(ctx.staticDir, src))) errors.push(`${field}: no existe ${rel(join(ctx.staticDir, src))} (la ruta es relativa a la carpeta de estáticos)`); };
  inStatic("logo.src", site.logo?.src);
  inStatic("logo.srcDark", site.logo?.srcDark);
  inStatic("favicon", site.favicon);
  inStatic("image", site.image);
  if (ctx.llmsAppend && !existsSync(ctx.llmsAppend)) errors.push(`llms.append: no existe ${rel(ctx.llmsAppend)}`);
  for (const font of ctx.localFonts) if (!existsSync(font)) errors.push(`fonts: no existe ${rel(font)} (una hoja local es relativa a la configuración)`);
  for (const font of ctx.remoteFonts) warnings.push(`fonts: ${new URL(font).host} recibe una petición de cada visitante. Autoalójalas con "zudocs fonts" y pon la hoja local en "fonts"`);
  if (!ctx.url) warnings.push('sin "url": el sitio se compila con https://example.com en canónicas y sitemap, y llms.txt lleva rutas en vez de URL');
  if (!site.image) warnings.push('sin "image": al compartir un enlace no habrá imagen de vista previa (og:image)');

  // ── 4. Navbar ─────────────────────────────────────────────────────────────
  for (const [i, item] of (site.navbar ?? []).entries()) {
    const page = PAGES.find((p) => item.to === `/${p}` || item.to?.startsWith(`/${p}/`));
    if (page && !ctx.pages[page]) errors.push(`navbar[${i}] enlaza a ${item.to} pero la página no está activada (pages.${page}: true)`);
    if (!item.to && !item.href) errors.push(`navbar[${i}] ("${item.label}"): falta "to" o "href"`);
    if (item.to && item.href) errors.push(`navbar[${i}] ("${item.label}"): lleva "to" y "href"; solo uno`);
  }

  // ── 5. Áreas ──────────────────────────────────────────────────────────────
  const seen = new Set();
  for (const area of site.docs.areas) {
    if (seen.has(area.id)) errors.push(`área "${area.id}" declarada dos veces`);
    seen.add(area.id);
    const dir = join(docs, area.id);
    if (!existsSync(dir)) errors.push(`área "${area.id}": no existe ${rel(dir)}`);
    else if (!existsSync(join(dir, "README.md")) && !existsSync(join(dir, "README.mdx"))) errors.push(`área "${area.id}": falta README.md`);
  }

  // ── 6. Documentos ─────────────────────────────────────────────────────────
  const all = listDocs(docs);
  const byFile = new Map(all.map((d) => [d.file, d]));
  const NAME = /^(\d{2}-[a-z0-9]+(-[a-z0-9]+)*|README)\.mdx?$/;
  const routes = new Map();
  const titles = new Map();
  const prefixes = new Map();
  const staticDirs = [ctx.staticDir, ctx.generatedStaticDir];

  for (const doc of all) {
    const where = rel(doc.file);
    const name = doc.rel.split("/").pop();
    for (const p of doc.problems) errors.push(`${where}: ${p}`);

    if (!seen.has(doc.area)) warnings.push(`${where}: fuera de toda área declarada: se publica en /${doc.route} pero ninguna barra lateral lo enlaza`);
    if (!NAME.test(name)) warnings.push(`${where}: el nombre no sigue la convención (NN-nombre-en-minusculas.md o README.md)`);
    const prefix = name.match(/^(\d{2})-/)?.[1];
    if (prefix) {
      const key = `${dirname(doc.file)}/${prefix}`;
      if (prefixes.has(key)) warnings.push(`${where}: prefijo ${prefix} repetido (también en ${prefixes.get(key)})`);
      prefixes.set(key, name);
    }

    if (routes.has(doc.route)) errors.push(`${where}: se publica en /${doc.route}, la misma ruta que ${rel(routes.get(doc.route).file)}`);
    else routes.set(doc.route, doc);

    const h1 = doc.headings.filter((h) => h.level === 1);
    if (!h1.length && !doc.data.title) warnings.push(`${where}: sin título de nivel 1`);
    if (h1.length > 1) warnings.push(`${where}:${h1[1].line + doc.bodyOffset}: más de un título de nivel 1`);
    for (const h of doc.headings) if (!h.title) warnings.push(`${where}:${h.line + doc.bodyOffset}: título vacío`);
    const key = doc.title.toLowerCase();
    if (titles.has(key)) warnings.push(`${where}: título "${doc.title}" repetido (también en ${rel(titles.get(key).file)}): el buscador y llms.txt no los distinguen`);
    else titles.set(key, doc);

    const left = `${Object.values(doc.data).join("\n")}\n${stripCode(doc.body)}`.match(/\{\{(titulo|descripcion|fecha)\}\}/);
    if (left) warnings.push(`${where}: marcador de plantilla sin rellenar ${left[0]}`);
    if (doc.data.sidebar_position !== undefined && !/^-?\d+(\.\d+)?$/.test(doc.data.sidebar_position)) errors.push(`${where}: sidebar_position debe ser un número`);
    if (doc.data.slug !== undefined && /\s|^$/.test(doc.data.slug)) errors.push(`${where}: slug no válido "${doc.data.slug}"`);
    checkLinks(doc);
    checkTrust(doc);
    if (doc.file.endsWith(".mdx")) checkIcons(doc);
  }

  /** Enlaces e imágenes: el archivo debe existir, quedar dentro de la documentación y tener el ancla pedida. */
  function checkLinks(doc) {
    const text = stripCode(doc.body);
    const where = (index) => `${rel(doc.file)}:${text.slice(0, index).split("\n").length + doc.bodyOffset}`;
    const own = new Set(doc.headings.map((h) => h.id));
    const htmlIds = (d) => new Set([...d.body.matchAll(/\sid=["']([^"']+)["']/g)].map((m) => m[1]));
    const pattern = /(!?)\[([^\]]*)\]\(\s*<?([^)\s>]+)>?(?:\s+["'(][^)]*)?\s*\)|^[ \t]*\[[^\]]+\]:\s*<?([^\s>]+)|<(a|img|iframe|script)\b[^>]*?\s(?:href|src)=(?:["']([^"']+)["']|([^\s>"']+))/gim;
    for (const m of text.matchAll(pattern)) {
      const tag = m[5]?.toLowerCase();
      const image = m[1] === "!" || tag === "img";
      const href = m[3] ?? m[4] ?? m[6] ?? m[7];
      if (m[1] === "!" && !m[2].trim()) warnings.push(`${where(m.index)}: imagen sin texto alternativo "${href}"`);
      if (/^[a-z][a-z0-9+.-]*:/i.test(href)) {
        if (/^(javascript|vbscript|data):/i.test(href) && !image) errors.push(`${where(m.index)}: enlace con esquema no permitido "${href.slice(0, 40)}"`);
        continue;
      }
      let path;
      try { path = decodeURIComponent(href.split("#")[0].split("?")[0]); } catch { errors.push(`${where(m.index)}: enlace mal codificado "${href}"`); continue; }
      const anchor = href.includes("#") ? decodeURIComponent(href.slice(href.indexOf("#") + 1)) : "";
      if (path.startsWith("/")) {
        // Ruta del sitio: las páginas las comprueba Docusaurus al compilar; un archivo estático, aquí.
        if (image && !staticDirs.some((d) => existsSync(join(d, path)))) errors.push(`${where(m.index)}: la imagen "${href}" no existe en la carpeta de estáticos`);
        continue;
      }
      if (!path) {
        if (anchor && !own.has(anchor) && !htmlIds(doc).has(anchor)) errors.push(`${where(m.index)}: ancla rota "${href}" (no hay un título con ese id en el documento)`);
        continue;
      }
      // Docusaurus resuelve las rutas relativas de la sintaxis Markdown, no las de una etiqueta HTML escrita a mano.
      if (tag) { errors.push(`${where(m.index)}: <${tag}> con ruta relativa "${href}": no se resuelve al compilar. Usa la sintaxis de Markdown o una ruta de estáticos que empiece por /`); continue; }
      const abs = resolve(dirname(doc.file), path);
      if (!existsSync(abs)) { errors.push(`${where(m.index)}: ${image ? "imagen rota" : "enlace roto"} "${href}"`); continue; }
      if (!/\.mdx?$/.test(path)) continue;
      if (!abs.startsWith(docs + sep)) { errors.push(`${where(m.index)}: "${href}" sale de la carpeta de documentación`); continue; }
      const target = byFile.get(abs);
      if (!target) { errors.push(`${where(m.index)}: "${href}" apunta a un documento que no se publica (su nombre o su carpeta empiezan por _)`); continue; }
      if (anchor && !target.headings.some((h) => h.id === anchor) && !htmlIds(target).has(anchor)) errors.push(`${where(m.index)}: ancla rota "${href}" (${rel(target.file)} no tiene un título con ese id)`);
    }
  }

  /**
   * Contenido activo. Un .mdx es código: se ejecuta al compilar y en el navegador. Un .md no evalúa JSX ni
   * expresiones, pero su HTML llega tal cual a la página: un <script> se ejecuta en el navegador del visitante.
   * Con `markdown.untrusted` todo esto es un error; sin él, el HTML activo de un .md es un aviso.
   */
  function checkTrust(doc) {
    const untrusted = site.markdown?.untrusted === true;
    const at = rel(doc.file);
    if (doc.file.endsWith(".mdx")) {
      if (untrusted) errors.push(`${at}: un archivo .mdx ejecuta código y la configuración declara los documentos no confiables (markdown.untrusted). Conviértelo a .md`);
      return;
    }
    const text = stripCode(doc.body);
    for (const m of text.matchAll(/<(script|iframe|object|embed|style|link|meta|base|form)\b|<[a-z][^>]*\son[a-z]+\s*=/gi)) {
      const line = text.slice(0, m.index).split("\n").length + doc.bodyOffset;
      const what = m[1] ? `<${m[1].toLowerCase()}>` : "un atributo on*";
      (untrusted ? errors : warnings).push(`${at}:${line}: HTML activo (${what}): llega tal cual a la página${m[1]?.toLowerCase() === "script" ? " y se ejecuta en el navegador del visitante" : ""}`);
    }
  }

  /** En .mdx, el nombre de un icono debe ser literal y existir: el sitio solo empaqueta los que encuentra aquí. */
  function checkIcons(doc) {
    const text = stripCode(doc.body);
    for (const m of text.matchAll(/<Icon\b[^>]*?\sname=(?:"([^"]*)"|'([^']*)'|\{)/g)) {
      const name = m[1] ?? m[2];
      const at = `${rel(doc.file)}:${text.slice(0, m.index).split("\n").length + doc.bodyOffset}`;
      if (name === undefined) errors.push(`${at}: <Icon name={…}> con una expresión: escribe el nombre literal para que el icono entre en el sitio`);
      else if (!icons.has(name)) errors.push(`${at}: el icono "${name}" no existe en zicon/manifest.json`);
    }
  }
}

for (const w of warnings) print(`aviso  ${w}`);
for (const e of errors) process.stderr.write(`error  ${e}\n`);
const failed = errors.length > 0 || (args.strict && warnings.length > 0);
print(`${failed ? "✗" : "✓"} zudocs verify${ctx ? ` (${ctx.site.name})` : ""}: ${errors.length} error(es), ${warnings.length} aviso(s)${args.strict && warnings.length && !errors.length ? " — con --strict los avisos fallan" : ""}`);
process.exit(failed ? 1 : 0);
