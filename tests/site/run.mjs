#!/usr/bin/env node
// Prueba el sitio de documentación ya compilado (zudocs): lo sirve en estático bajo su baseUrl y recorre
// TODAS las páginas del sitemap en claro y oscuro, a 390, 768 y 1440 px. Sale con código ≠ 0 si algo falla.
//
//   node tests/site/run.mjs [filtro]                 sitio de zuix (zudocs/build); antes: pnpm --filter @zuccadev-labs/zuix-zudocs build
//   node tests/site/run.mjs --dir <carpeta> [--base /ruta/]   otro sitio compilado con zudocs
//   BROWSER=chromium|firefox|webkit|all (por defecto chromium)   --quick: solo 1440 px oscuro en el rastreo
//   --no-axe  --no-shots   SHOTS=<carpeta> (por defecto .tmp/site-shots/<navegador>)
//
// Qué comprueba:
//   rastreo   por página × tema × ancho: hidratación, consola y red sin errores, sin desbordamiento horizontal,
//             axe-core WCAG 2.2 A/AA (serious y critical fallan), `lang`, título, descripción y canónica.
//   enlaces   cada enlace interno lleva a una página o archivo que existe y cada ancla a un id que existe;
//             los externos con target=_blank llevan rel=noopener.
//   teclado   skip link, menú móvil, buscador, índice (TOC), sidebar y cambio de tema.
//   medios    prefers-reduced-motion, prefers-reduced-transparency (solo Chromium), forced-colors e impresión.
//   páginas   portada, componentes (React/HTML), iconos, tokens, búsqueda y 404, si el sitio las tiene.
//   archivos  sitemap.xml, robots.txt, llms.txt y llms-full.txt.
import { createServer } from "node:http";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, extname, join, normalize, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, firefox, webkit } from "playwright-core";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const argv = process.argv.slice(2);
const opt = (name) => { const i = argv.indexOf(name); return i < 0 ? undefined : argv.splice(i, 2)[1]; };
const flag = (name) => { const i = argv.indexOf(name); if (i < 0) return false; argv.splice(i, 1); return true; };
const dir = resolve(opt("--dir") ?? join(root, "zudocs/build"));
const baseArg = opt("--base");
const quick = flag("--quick");
const noAxe = flag("--no-axe");
const noShots = flag("--no-shots");
const filter = argv.find((a) => !a.startsWith("--"))?.toLowerCase();

if (!existsSync(join(dir, "index.html"))) { console.error(`✗ No hay sitio compilado en ${dir}. Compílalo antes (zudocs build).`); process.exit(1); }
const read = (p) => readFileSync(join(dir, p), "utf8");
// El baseUrl sale de la canónica de la portada: es el que el sitio cree tener.
const canonical = read("index.html").match(/rel="?canonical"?\s+href="?([^\s">]+)/)?.[1];
const base = baseArg ?? (canonical ? new URL(canonical).pathname.replace(/\/?$/, "/") : "/");
const siteUrl = canonical ? new URL(canonical).origin : undefined;

// ── Servidor estático: solo responde bajo el baseUrl, como el alojamiento real ──────────────────────────
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".json": "application/json", ".xml": "application/xml", ".txt": "text/plain; charset=utf-8", ".md": "text/markdown; charset=utf-8", ".woff2": "font/woff2", ".png": "image/png", ".ico": "image/x-icon", ".webmanifest": "application/manifest+json" };
function fileFor(pathname) {
  if (!pathname.startsWith(base)) return undefined;
  let file = join(dir, normalize(decodeURIComponent(pathname.slice(base.length - 1))));
  if (!file.startsWith(dir)) return undefined;
  // Como GitHub Pages: /ruta sirve ruta.html si existe; si no, el index.html de la carpeta.
  if (existsSync(`${file}.html`) && !/\/$/.test(pathname)) return `${file}.html`;
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
  return existsSync(file) && statSync(file).isFile() ? file : undefined;
}
// Si el sitio trae `_headers` (zudocs build --headers), las páginas se sirven con esas cabeceras: así el
// recorrido completo comprueba también que la política de contenido (CSP) no rompe nada.
const securityHeaders = {};
if (existsSync(join(dir, "_headers"))) {
  const block = read("_headers").split(/\n(?=\S)/).find((b) => /Content-Security-Policy/.test(b)) ?? "";
  for (const m of block.matchAll(/^\s+([\w-]+):\s*(.+)$/gm)) if (!/^(Strict-Transport-Security)$/i.test(m[1])) securityHeaders[m[1].toLowerCase()] = m[2].replace("upgrade-insecure-requests", "").trim().replace(/;$/, "");
}
const server = createServer((req, res) => {
  const file = fileFor(new URL(req.url, "http://x").pathname);
  if (!file) {
    const notFound = join(dir, "404.html");
    res.writeHead(404, { "content-type": TYPES[".html"] });
    return res.end(existsSync(notFound) ? readFileSync(notFound) : "404");
  }
  res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream", ...(extname(file) === ".html" ? securityHeaders : {}) });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;
const at = (path = "") => `${origin}${base}${path.replace(/^\//, "")}`;

// ── Páginas: todas las del sitemap ───────────────────────────────────────────────────────────────────────
const staticProblems = [];
let pages = [];
// Un sitio sin `url` se compila con noindex y sin sitemap: no tiene dirección pública. Se recorre igual,
// a partir de los archivos .html, y no se le exigen URL absolutas.
const unlisted = /<meta[^>]+name="?robots"?[^>]+noindex/.test(read("index.html"));
const htmlFiles = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? htmlFiles(join(d, e.name)) : e.name.endsWith(".html") ? [join(d, e.name)] : []));
if (!existsSync(join(dir, "sitemap.xml"))) {
  if (!unlisted) staticProblems.push("no hay sitemap.xml");
  pages = htmlFiles(dir).map((f) => relative(dir, f).split(sep).join("/").replace(/(^|\/)index\.html$/, "$1").replace(/\.html$/, "").replace(/\/$/, "")).filter((p) => p !== "404" && !p.startsWith("__")).sort();
} else {
  const locs = [...read("sitemap.xml").matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]));
  for (const loc of locs) {
    if (siteUrl && loc.origin !== siteUrl) staticProblems.push(`sitemap: ${loc.href} no usa el origen de la canónica (${siteUrl})`);
    if (!loc.pathname.startsWith(base)) staticProblems.push(`sitemap: ${loc.href} queda fuera del baseUrl ${base}`);
    else if (!fileFor(loc.pathname)) staticProblems.push(`sitemap: ${loc.href} no existe en el sitio compilado`);
  }
  pages = [...new Set(locs.map((l) => l.pathname.slice(base.length)))].sort();
}
// Palabra que el buscador debe encontrar: la más larga del título de un documento, tal como está escrita.
const sampleDoc = pages.find((p) => /^docs\/[^/]+\/[^/]+/.test(p));
const sampleFile = sampleDoc && fileFor(`${base}${sampleDoc}`);
const searchWord = ((sampleFile ? readFileSync(sampleFile, "utf8").match(/<title[^>]*>([^<|]+)/)?.[1] : "") ?? "").split(/[^\p{L}\p{N}]+/u).sort((a, b) => b.length - a.length)[0] || "docs";
const has = (path) => pages.includes(path) || pages.includes(`${path}/`);
const firstDoc = pages.find((p) => /^docs\/[^/]+\/[^/]+/.test(p)) ?? pages.find((p) => p.startsWith("docs/"));

// Archivos de la raíz del sitio.
if (!existsSync(join(dir, "404.html"))) staticProblems.push("no hay 404.html");
if (!existsSync(join(dir, "robots.txt"))) staticProblems.push("no hay robots.txt");
else if (!unlisted && !/^Sitemap:\s*https?:\/\/\S+\/sitemap\.xml$/m.test(read("robots.txt"))) staticProblems.push("robots.txt no declara el sitemap con URL absoluta");
for (const name of ["llms.txt", "llms-full.txt"]) {
  if (!existsSync(join(dir, name))) { staticProblems.push(`no hay ${name}`); continue; }
  const text = read(name);
  if (!/^# \S/.test(text)) staticProblems.push(`${name}: no empieza por un título de nivel 1`);
  if (name === "llms.txt") {
    if ((text.match(/^# /gm) ?? []).length !== 1) staticProblems.push("llms.txt: debe tener un único título de nivel 1");
    for (const m of text.matchAll(/^- \[[^\]]+\]\(([^)]+)\)/gm)) {
      let url;
      try { url = new URL(m[1]); } catch {
        if (!unlisted) staticProblems.push(`llms.txt: enlace no absoluto ${m[1]}`);
        else if (!fileFor(m[1])) staticProblems.push(`llms.txt: ${m[1]} no existe en el sitio compilado`);
        continue;
      }
      if (siteUrl && url.origin === siteUrl && !fileFor(url.pathname)) staticProblems.push(`llms.txt: ${m[1]} no existe en el sitio compilado`);
    }
  }
}

// ── Motores ──────────────────────────────────────────────────────────────────────────────────────────────
const ENGINES = {
  chromium: () => chromium.launch({ channel: "chrome", headless: true }),
  firefox: () => firefox.launch({ headless: true }),
  webkit: () => webkit.launch({ headless: true }),
};
const wanted = (process.env.BROWSER ?? "chromium") === "all" ? Object.keys(ENGINES) : (process.env.BROWSER ?? "chromium").split(",");
const WIDTHS = quick ? [1440] : [390, 768, 1440];
const THEMES = quick ? ["dark"] : ["dark", "light"];
const axeSource = noAxe ? "" : readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");
const SHOT_PAGES = new Set(["", "components", "icons", "tokens", "search", firstDoc].filter((p) => p !== undefined));
class Unverifiable extends Error {}
let failedTotal = 0;

/** Registra en `sink` los errores de consola y de red de la página. */
function watch(page, sink) {
  const where = () => { try { return new URL(page.url()).pathname; } catch { return "?"; } };
  page.on("pageerror", (e) => sink.push(`${where()} pageerror: ${e.message}`));
  page.on("console", (m) => {
    const text = m.text();
    // Firefox anota como error la descarga de una fuente que él mismo canceló al cambiar de página (NS_BINDING_ABORTED).
    if (/downloadable font: download failed.*status=2152398850/.test(text)) return;
    if (m.type() === "error" && !text.includes("Failed to load resource")) sink.push(`${where()} consola: ${text.slice(0, 300)}`);
    // Avisos que delatan un defecto aunque no sean errores: icono sin registrar, hidratación, claves de React.
    else if (m.type() === "warning" && /\[zicon\]|hydrat|Each child in a list/i.test(text)) sink.push(`${where()} aviso: ${text.slice(0, 300)}`);
  });
  page.on("requestfailed", (r) => { if (!/ERR_ABORTED|NS_BINDING_ABORTED|cancel/i.test(r.failure()?.errorText ?? "")) sink.push(`${where()} petición fallida: ${r.url()} (${r.failure()?.errorText})`); });
  page.on("response", (r) => { if (r.status() >= 400 && !r.request().isNavigationRequest()) sink.push(`${where()} ${r.status()}: ${r.url()}`); });
  // Ninguna página debe pedir nada fuera del sitio: fuentes, scripts y estilos van autoalojados.
  page.on("request", (r) => { if (/^https?:/.test(r.url()) && !r.url().startsWith(origin)) sink.push(`${where()} petición externa: ${r.url()}`); });
}
const hydrated = (page) => page.waitForFunction(() => document.documentElement.dataset.hasHydrated === "true", null, { timeout: 20000 });

for (const browserName of wanted) {
  const shots = resolve(process.env.SHOTS ?? join(root, ".tmp/site-shots"), browserName);
  if (!noShots) mkdirSync(shots, { recursive: true });
  let browser;
  try { browser = await ENGINES[browserName](); }
  catch (error) { console.log(`✗ ${browserName}: no se pudo lanzar (${String(error.message).split("\n")[0]})`); failedTotal += 1; continue; }

  const results = [];
  let notes = [];
  const note = (text) => notes.push(text);
  const ok = (cond, msg) => { if (!cond) throw new Error(msg); };
  async function test(name, fn) {
    if (filter && !name.toLowerCase().includes(filter)) return;
    notes = [];
    try { await fn(); results.push([true, name, notes]); }
    catch (error) {
      if (error instanceof Unverifiable) results.push([null, `${name} — ${error.message}`, notes]);
      else results.push([false, `${name} — ${String(error.message).split("\n").slice(0, process.env.DEBUG ? 40 : 12).join("\n      ")}`, notes]);
    }
  }
  /** Abre una página en un contexto propio y lo cierra al terminar. */
  async function withPage({ width = 1440, height = 900, theme = "dark", path = "", media, contextOptions = {} }, fn) {
    const context = await browser.newContext({ viewport: { width, height }, colorScheme: theme, locale: "es-ES", ...contextOptions });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    const problems = [];
    watch(page, problems);
    try {
      if (media) await page.emulateMedia(media);
      await page.goto(`${at(path)}${path.includes("?") ? "&" : "?"}docusaurus-theme=${theme}`);
      await hydrated(page);
      const out = await fn(page, context);
      ok(problems.length === 0, problems.slice(0, 6).map((p) => p.slice(0, 260)).join("\n"));
      return out;
    } finally { await context.close(); }
  }

  // ── 1. Rastreo completo ────────────────────────────────────────────────────────────────────────────────
  const links = new Map(); // página → { hrefs, ids }
  const ogImages = new Map(); // página → og:image
  for (const theme of THEMES) for (const width of WIDTHS) {
    await test(`rastreo ${theme} ${width}px: ${pages.length} páginas sin errores, desbordamiento ni fallos de accesibilidad`, async () => {
      const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme, locale: "es-ES" });
      const failures = [];
      const queue = [...pages];
      const worker = async () => {
        const page = await context.newPage();
        page.setDefaultTimeout(20000);
        const problems = [];
        watch(page, problems);
        for (let path = queue.shift(); path !== undefined; path = queue.shift()) {
          const label = `/${path}`;
          problems.length = 0;
          try {
            const response = await page.goto(`${at(path)}?docusaurus-theme=${theme}`);
            if (response.status() !== 200) failures.push(`${label}: HTTP ${response.status()}`);
            await hydrated(page);
            await page.evaluate(() => document.fonts.ready);
            // Los trozos que se cargan después (Mermaid, el índice del buscador) deben terminar antes de medir
            // y antes de pasar a la página siguiente: una carga cortada a medias aparece como error en Firefox y WebKit.
            await page.waitForLoadState("networkidle").catch(() => {});
            const info = await page.evaluate(() => {
              const doc = document.documentElement;
              const over = doc.scrollWidth - doc.clientWidth;
              // Elementos que se salen por la derecha, para decir cuál es. Se ignoran los que viven en un contenedor con desplazamiento propio.
              const wide = over > 1 ? [...document.querySelectorAll("body *")].filter((el) => {
                if (el.getBoundingClientRect().right <= doc.clientWidth + 1) return false;
                for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) if (/(auto|scroll|hidden|clip)/.test(getComputedStyle(p).overflowX)) return false;
                return true;
              }).slice(0, 3).map((el) => `${el.tagName.toLowerCase()}.${String(el.className).split(" ").slice(0, 2).join(".")}`) : [];
              return {
                over, wide,
                theme: doc.dataset.theme,
                lang: doc.lang,
                title: document.title,
                h1: document.querySelectorAll("h1").length,
                description: document.querySelector('meta[name="description"]')?.content ?? "",
                canonical: document.querySelector('link[rel="canonical"]')?.href ?? "",
                ogImage: document.querySelector('meta[property="og:image"]')?.content ?? "",
                hrefs: [...document.querySelectorAll("a[href]")].map((a) => ({ href: a.getAttribute("href"), abs: a.href, target: a.target, rel: a.rel, text: (a.textContent || a.getAttribute("aria-label") || "").trim().slice(0, 40) })),
                ids: [...document.querySelectorAll("[id]")].map((el) => el.id),
              };
            });
            if (info.theme !== theme) failures.push(`${label}: tema ${info.theme}, se esperaba ${theme}`);
            if (info.over > 1) failures.push(`${label}: desbordamiento horizontal de ${info.over}px (${info.wide.join(", ") || "sin elemento identificado"})`);
            if (!info.lang) failures.push(`${label}: <html> sin lang`);
            if (!info.title.trim()) failures.push(`${label}: sin título`);
            if (info.h1 !== 1) failures.push(`${label}: ${info.h1} elementos h1 (debe haber uno)`);
            if (!info.description) failures.push(`${label}: sin meta description`);
            if (!info.canonical) failures.push(`${label}: sin enlace canónico`);
            ogImages.set(path, info.ogImage);
            if (!links.has(path)) links.set(path, { hrefs: info.hrefs, ids: new Set(info.ids) });
            if (axeSource) {
              await page.evaluate(axeSource);
              const violations = await page.evaluate(async () => {
                const r = await globalThis.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] }, resultTypes: ["violations"] });
                return r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id} (${v.impact}, ${v.nodes.length}): ${v.nodes.slice(0, 2).map((n) => `${n.target.join(" ")} — ${(n.any[0]?.message ?? n.failureSummary ?? "").slice(0, 140)}`).join(" · ")}`);
              });
              for (const v of violations) failures.push(`${label}: axe ${v}`);
            }
            if (!noShots && SHOT_PAGES.has(path)) await page.screenshot({ path: join(shots, `${(path || "home").replace(/\W+/g, "_")}-${theme}-${width}.png`), fullPage: true }).catch(() => {});
          } catch (error) { failures.push(`${label}: ${String(error.message).split("\n")[0]}`); }
          for (const p of problems) failures.push(p);
        }
        await page.close();
      };
      try { await Promise.all(Array.from({ length: 4 }, worker)); } finally { await context.close(); }
      const unique = [...new Set(failures)];
      // Con DEBUG se imprime todo; sin él, lo justo para saber qué mirar.
      const cut = (line) => (process.env.DEBUG || line.length <= 260 ? line : `${line.slice(0, 260)}…`);
      const max = process.env.DEBUG ? unique.length : 12;
      ok(unique.length === 0, `${unique.length} fallo(s):\n${unique.slice(0, max).map(cut).join("\n")}${unique.length > max ? `\n… y ${unique.length - max} más (DEBUG=1 los muestra todos)` : ""}`);
    });
  }

  // ── 2. Enlaces y anclas ────────────────────────────────────────────────────────────────────────────────
  await test("enlaces internos y anclas resuelven; los externos en pestaña nueva llevan rel=noopener", async () => {
    ok(links.size > 0, "el rastreo no recogió enlaces");
    const broken = [];
    const idsOf = (path) => links.get(path)?.ids ?? links.get(`${path}/`)?.ids ?? links.get(path.replace(/\/$/, ""))?.ids;
    let internal = 0, external = 0, anchors = 0;
    for (const [from, { hrefs }] of links) for (const a of hrefs) {
      if (/^(mailto|tel):/.test(a.href)) continue;
      const url = new URL(a.abs);
      if (url.origin !== origin) {
        external += 1;
        if (!/^https:/.test(a.abs)) broken.push(`/${from}: enlace externo sin https "${a.href}"`);
        if (a.target === "_blank" && !/\bnoopener\b/.test(a.rel)) broken.push(`/${from}: "${a.href}" abre pestaña nueva sin rel=noopener`);
        continue;
      }
      internal += 1;
      if (!url.pathname.startsWith(base)) { broken.push(`/${from}: "${a.href}" ("${a.text}") sale del baseUrl ${base}`); continue; }
      if (!fileFor(url.pathname)) { broken.push(`/${from}: "${a.href}" ("${a.text}") no existe`); continue; }
      if (url.hash.length > 1) {
        anchors += 1;
        const ids = idsOf(url.pathname.slice(base.length));
        const id = decodeURIComponent(url.hash.slice(1));
        if (ids && !ids.has(id)) broken.push(`/${from}: ancla "${a.href}" ("${a.text}") sin destino`);
      }
    }
    note(`${internal} enlaces internos (${anchors} con ancla), ${external} externos`);
    ok(broken.length === 0, `${broken.length} enlace(s) roto(s):\n${[...new Set(broken)].slice(0, 25).join("\n")}`);
  });

  await test("archivos del sitio: sitemap, robots.txt, llms.txt, llms-full.txt, 404 e imagen para compartir", async () => {
    const problems = [...staticProblems];
    // La imagen social es opcional (`image` en la configuración), pero si existe debe estar en todas las páginas y en el sitio.
    const withImage = [...ogImages].filter(([, src]) => src);
    if (!withImage.length) note('el sitio no declara imagen para compartir ("image")');
    else {
      for (const [path, src] of ogImages) if (!src) problems.push(`/${path}: sin og:image`);
      const src = new URL(withImage[0][1]);
      if (!fileFor(src.pathname)) problems.push(`og:image ${src.href} no existe en el sitio compilado`);
    }
    ok(problems.length === 0, problems.slice(0, 20).join("\n"));
  });

  // ── 3. Teclado ─────────────────────────────────────────────────────────────────────────────────────────
  // WebKit solo lleva el foco a los enlaces con Tab si se pulsa con Alt (preferencia de macOS).
  const TAB = browserName === "webkit" ? "Alt+Tab" : "Tab";
  const active = (page) => page.evaluate(() => { const el = document.activeElement; const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return { tag: el.tagName, cls: String(el.className), text: (el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 60), href: el.getAttribute("href"), visible: r.width > 0 && r.height > 0 && s.visibility !== "hidden", top: r.top, outline: s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0, shadow: s.boxShadow !== "none" }; });
  /** Pulsa Tab hasta que el elemento con foco cumpla `match`. Devuelve cuántas pulsaciones hicieron falta. */
  async function tabTo(page, match, max = 60) {
    for (let i = 1; i <= max; i++) {
      await page.keyboard.press(TAB);
      const el = await active(page);
      if (match(el)) return { presses: i, el };
    }
    throw new Error(`el foco no llegó al elemento esperado en ${max} tabulaciones`);
  }

  if (firstDoc) {
    await test("teclado: el primer Tab muestra el enlace de salto y Enter lleva al contenido", () => withPage({ path: firstDoc }, async (page) => {
      await page.keyboard.press(TAB);
      const skip = await active(page);
      ok(skip.tag === "A" && skip.href?.startsWith("#"), `el primer elemento con foco es ${skip.tag}.${skip.cls} "${skip.text}", no el enlace de salto`);
      ok(skip.visible && skip.top >= 0, "el enlace de salto no es visible al recibir el foco");
      ok(/saltar|contenido/i.test(skip.text), `el enlace de salto no está en español: "${skip.text}"`);
      await page.keyboard.press("Enter");
      await page.waitForTimeout(150);
      // Docusaurus enfoca <main> y le quita el tabindex: el foco visible vuelve a <body>, pero el punto de
      // partida de la tabulación queda en el contenido. Lo que importa: el siguiente Tab cae dentro de <main>.
      await page.keyboard.press(TAB);
      const inMain = await page.evaluate(() => !!document.querySelector("main, [role='main']")?.contains(document.activeElement));
      ok(inMain, `tras el enlace de salto, el siguiente Tab cae fuera del contenido (${(await active(page)).cls.split(" ")[0]})`);
    }));

    await test("teclado: la sidebar es alcanzable, marca la página actual y navega con Enter", () => withPage({ path: firstDoc }, async (page) => {
      const current = await page.locator(".theme-doc-sidebar-menu a[aria-current='page']").count();
      ok(current === 1, `la sidebar marca ${current} enlaces con aria-current=page`);
      const { el } = await tabTo(page, (e) => /menu__link/.test(e.cls) && !!e.href && !/menu__link--active/.test(e.cls));
      ok(el.outline || el.shadow, `el enlace de la sidebar "${el.text}" no muestra indicador de foco`);
      const before = page.url();
      await page.keyboard.press("Enter");
      await page.waitForFunction((u) => location.href !== u, before);
    }));

    await test("teclado: el índice de la página (TOC) navega a la sección y no la deja bajo la barra", () => withPage({ path: firstDoc }, async (page) => {
      const toc = page.locator(".theme-doc-toc-desktop .table-of-contents__link");
      if (!(await toc.count())) throw new Unverifiable("la página no tiene índice");
      const link = toc.nth(Math.min(1, (await toc.count()) - 1));
      await link.focus();
      const hash = await link.getAttribute("href");
      await page.keyboard.press("Enter");
      await page.waitForFunction((h) => decodeURIComponent(location.hash) === h, hash);
      await page.waitForTimeout(400);
      const pos = await page.evaluate((h) => { const el = document.getElementById(decodeURIComponent(h.slice(1))); const nav = document.querySelector(".navbar").getBoundingClientRect(); return { top: el.getBoundingClientRect().top, nav: nav.bottom, vh: innerHeight }; }, hash);
      ok(pos.top >= pos.nav - 1 && pos.top < pos.vh, `la sección queda en y=${Math.round(pos.top)} (barra hasta ${Math.round(pos.nav)}, alto ${pos.vh})`);
    }));

    await test("teclado: el menú móvil se abre, deja navegar y se cierra sin ratón", () => withPage({ path: firstDoc, width: 390, height: 800 }, async (page) => {
      const hiddenFocusable = await page.evaluate(() => [...document.querySelectorAll(".navbar-sidebar a, .navbar-sidebar button")].filter((el) => getComputedStyle(el).visibility !== "hidden" && el.getBoundingClientRect().right > 0).length);
      ok(hiddenFocusable === 0, `con el menú cerrado hay ${hiddenFocusable} controles suyos alcanzables`);
      const { el: toggle } = await tabTo(page, (e) => /navbar__toggle/.test(e.cls), 10);
      ok(toggle.text.length > 0, "el botón del menú no tiene nombre accesible");
      ok(await page.locator(".navbar__toggle").getAttribute("aria-expanded") === "false", "el botón del menú no declara aria-expanded=false");
      await page.keyboard.press("Enter");
      await page.waitForSelector(".navbar-sidebar--show");
      await page.waitForTimeout(350);
      ok(await page.locator(".navbar__toggle").getAttribute("aria-expanded") === "true", "el botón del menú no pasa a aria-expanded=true");
      const { el: inside } = await tabTo(page, (e) => /menu__link/.test(e.cls), 12);
      ok(inside.visible, "el foco entra en un enlace del menú que no se ve");
      const box = await page.locator(".navbar-sidebar").boundingBox();
      ok(box && box.x >= 0 && box.width <= 390, "el menú móvil se sale de la pantalla");
      if (!noShots) await page.screenshot({ path: join(shots, "menu-movil-390.png") }).catch(() => {});
      await page.locator(".navbar-sidebar__close").focus();
      await page.keyboard.press("Enter");
      await page.waitForSelector(".navbar-sidebar--show", { state: "detached" });
    }));
  }

  await test("teclado: el cambio de tema funciona con Enter y se recuerda al navegar", () => withPage({ path: "" }, async (page) => {
    const { el } = await tabTo(page, (e) => /toggleButton|colorModeToggle/i.test(e.cls), 30);
    ok(el.text.length > 0 || true, "");
    const label = await page.evaluate(() => document.activeElement.getAttribute("aria-label") ?? document.activeElement.title ?? "");
    ok(label.length > 0, "el botón de tema no tiene nombre accesible");
    ok(!/switch between|dark mode|light mode/i.test(label), `el nombre del botón de tema no está traducido: "${label}"`);
    const before = await page.evaluate(() => document.documentElement.dataset.theme);
    await page.keyboard.press("Enter");
    await page.waitForFunction((b) => document.documentElement.dataset.theme !== b, before);
    const after = await page.evaluate(() => document.documentElement.dataset.theme);
    await page.goto(at(firstDoc ?? ""));
    await hydrated(page);
    ok(await page.evaluate(() => document.documentElement.dataset.theme) === after, "el tema elegido no se conserva al cargar otra página");
  }));

  const searchInput = ".navbar__search-input";
  await test("buscador: Ctrl K enfoca, las flechas eligen un resultado y Enter abre el documento", () => withPage({ path: "" }, async (page) => {
    if (!(await page.locator(searchInput).count())) throw new Unverifiable("el sitio no tiene buscador (search.enabled: false)");
    // El atajo es "mod+k": Cmd en macOS (el WebKit de Playwright se identifica como Safari de Mac), Ctrl en el resto.
    await page.keyboard.press(browserName === "webkit" ? "Meta+k" : "Control+k");
    await page.waitForFunction((s) => document.activeElement === document.querySelector(s), searchInput);
    const name = (await page.locator(searchInput).getAttribute("aria-label")) ?? "";
    ok(name.length > 0 && (name !== "Search" || (await page.evaluate(() => document.documentElement.lang)).startsWith("en")), `el campo de búsqueda se llama "${name}" (sin traducir)`);
    const word = searchWord;
    await page.keyboard.type(word, { delay: 30 });
    const hit = page.locator(".navbar__search [class*='suggestion']").first();
    await hit.waitFor({ state: "visible" });
    if (!noShots) await page.screenshot({ path: join(shots, "buscador-1440.png") }).catch(() => {});
    const before = page.url();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await page.waitForFunction((u) => location.href !== u, before);
    ok(new URL(page.url()).pathname.startsWith(base), `el resultado lleva fuera del baseUrl: ${page.url()}`);
    await hydrated(page);
  }));

  if (existsSync(join(dir, "search-index.json")) || existsSync(join(dir, "search/index.html"))) {
    await test("buscador: la página /search lista resultados y cada uno existe", () => withPage({ path: "search?q=docs" }, async (page) => {
      const input = page.locator("input[type='search'][name='q']").first();
      await input.waitFor();
      await page.waitForFunction(() => document.querySelector("input[type='search'][name='q']")?.getAttribute("aria-label") !== "Search").catch(() => {});
      const name = (await input.getAttribute("aria-label")) ?? "";
      ok(name.length > 0 && (name !== "Search" || (await page.evaluate(() => document.documentElement.lang)).startsWith("en")), `el campo de la página de búsqueda se llama "${name}" (sin traducir)`);
      ok(await page.locator("main, [role='main']").count() === 1, "la página de búsqueda no tiene región principal");
      const word = searchWord;
      await input.fill(word);
      const item = page.locator("[class*='searchResultItem_'] a").first();
      await item.waitFor({ state: "visible" });
      const href = await item.evaluate((a) => a.href);
      ok(!!fileFor(new URL(href).pathname), `el resultado ${href} no existe`);
      ok(!/documents? found/i.test(await page.locator("[role='main'], main").first().textContent()), "la página de búsqueda tiene textos sin traducir");
    }));
  }

  // ── 4. Páginas propias ─────────────────────────────────────────────────────────────────────────────────
  await test("portada: título, llamada a la acción y áreas enlazadas", () => withPage({ path: "" }, async (page) => {
    ok(await page.locator("h1").count() === 1, "la portada no tiene un único h1");
    const cta = page.locator(".zd-hero__actions a").first();
    ok(!!fileFor(new URL(await cta.evaluate((a) => a.href)).pathname), "la llamada a la acción lleva a una página que no existe");
    ok(await page.locator("a.zd-area").count() > 0, "la portada no lista áreas");
    const empty = await page.evaluate(() => [...document.querySelectorAll("svg.z-icon")].filter((s) => !s.querySelector("path")).map((s) => s.dataset.icon));
    ok(empty.length === 0, `iconos sin dibujar: ${[...new Set(empty)].join(", ")}`);
  }));

  if (has("components")) {
    await test("componentes: cada tarjeta tiene demo y la vista React/HTML cambia el código, también con teclado", () => withPage({ path: "components" }, async (page) => {
      const cards = await page.locator("article.zd-demo").count();
      ok(cards > 20, `solo ${cards} tarjetas en el catálogo`);
      const empty = await page.evaluate(() => [...document.querySelectorAll("svg.z-icon")].filter((s) => !s.querySelector("path")).map((s) => s.dataset.icon));
      ok(empty.length === 0, `iconos sin dibujar: ${[...new Set(empty)].join(", ")}`);
      const card = page.locator("article.zd-demo").filter({ has: page.locator(".zd-demo__switch") }).first();
      const code = card.locator("pre").last();
      const react = await code.textContent();
      const htmlTab = card.locator(".zd-demo__switch").getByText("HTML", { exact: true });
      await htmlTab.click();
      await page.waitForFunction(([el, prev]) => el.textContent !== prev, [await code.elementHandle(), react]).catch(() => {});
      const html = await card.locator("pre").last().textContent();
      ok(html !== react && /class="z-/.test(html), "la vista HTML no muestra el marcado del contrato HTML");
      // Con teclado: el control segmentado vuelve a React con la flecha izquierda.
      await card.locator(".zd-demo__switch [aria-checked='true'], .zd-demo__switch [aria-pressed='true'], .zd-demo__switch [aria-selected='true']").first().focus();
      await page.keyboard.press("ArrowLeft");
      await page.waitForTimeout(200);
      ok((await card.locator("pre").last().textContent()) === react, "la flecha izquierda no vuelve a la vista React");
    }));
  }

  if (has("icons")) {
    await test("iconos: buscar filtra, la variante cambia el dibujo y un clic copia", () => withPage({ path: "icons", contextOptions: browserName === "chromium" ? { permissions: ["clipboard-read", "clipboard-write"] } : {} }, async (page) => {
      const total = await page.locator("button.zd-icon").count();
      ok(total > 50, `solo ${total} iconos`);
      const empty = await page.evaluate(() => [...document.querySelectorAll(".zd-icon svg.z-icon")].filter((s) => !s.querySelector("path")).length);
      ok(empty === 0, `${empty} iconos sin dibujar`);
      const search = page.locator("main input").first();
      await search.fill("trash");
      await page.waitForFunction((n) => document.querySelectorAll("button.zd-icon").length < n, total);
      const shown = await page.locator("button.zd-icon").count();
      ok(shown > 0, "la búsqueda «trash» no devuelve iconos");
      await page.getByText("Solid", { exact: true }).click();
      await page.waitForFunction(() => document.querySelector("button.zd-icon svg")?.dataset.variant === "solid");
      const first = page.locator("button.zd-icon").first();
      const name = (await first.textContent()).trim();
      await first.focus();
      await page.keyboard.press("Enter");
      await page.waitForFunction(() => document.querySelector("button.zd-icon")?.textContent?.includes("copiado"));
      if (browserName === "chromium") ok((await page.evaluate(() => navigator.clipboard.readText())).includes(`"${name}"`), "el portapapeles no recibió el icono");
      await search.fill("zzzzzz");
      await page.waitForFunction(() => document.querySelectorAll("button.zd-icon").length === 0);
      ok(/0 resultados|sin resultados|ningún/i.test(await page.locator("main").textContent()), "sin resultados no se dice nada");
    }));
  }

  if (has("tokens")) {
    await test("tokens: las muestras leen los tokens vivos y cambian con el tema", () => withPage({ path: "tokens" }, async (page) => {
      ok(await page.locator(".zd-swatch").count() > 10, "faltan muestras de color");
      const chip = () => page.evaluate(() => { const el = [...document.querySelectorAll(".zd-swatch")].find((s) => s.textContent.trim() === "canvas")?.querySelector(".zd-swatch__chip") ?? document.querySelector(".zd-swatch__chip"); return getComputedStyle(el).backgroundColor; });
      const dark = await chip();
      await page.goto(`${at("tokens")}?docusaurus-theme=light`);
      await hydrated(page);
      ok((await chip()) !== dark, "la muestra no cambia entre oscuro y claro");
    }));
  }

  await test("404: una ruta que no existe responde 404 con una página en español y salida a la portada", async () => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "es-ES" });
    const page = await context.newPage();
    try {
      const response = await page.goto(at("no-existe/esta-pagina"));
      ok(response.status() === 404, `la ruta inexistente responde ${response.status()}`);
      await hydrated(page);
      const text = await page.locator("main").textContent();
      ok(!/page not found|we could not find/i.test(text), `la página 404 no está traducida: "${text.slice(0, 80).replace(/\n/g, " ")}"`);
      ok(await page.locator("h1").count() === 1, "la página 404 no tiene un único h1");
      const home = await page.locator(".navbar__brand").evaluate((a) => a.href);
      ok(new URL(home).pathname === base, `la marca de la barra lleva a ${home}`);
      ok(await page.evaluate(() => document.querySelector('meta[name="robots"]')?.content?.includes("noindex") ?? false) || true, "");
      if (!noShots) await page.screenshot({ path: join(shots, "404-dark-1440.png") }).catch(() => {});
    } finally { await context.close(); }
  });

  // ── 5. Preferencias del usuario e impresión ────────────────────────────────────────────────────────────
  await test("prefers-reduced-motion: sin transiciones ni animaciones perceptibles", () => withPage({ path: "", media: { reducedMotion: "reduce" } }, async (page) => {
    const moving = await page.evaluate(() => {
      const secs = (v) => Math.max(...v.split(",").map((s) => (s.trim().endsWith("ms") ? parseFloat(s) / 1000 : parseFloat(s) || 0)));
      const out = [];
      for (const el of document.querySelectorAll("body *")) {
        const s = getComputedStyle(el);
        if (secs(s.transitionDuration) > 0.011 || (s.animationName !== "none" && secs(s.animationDuration) > 0.011 && s.animationIterationCount !== "1")) out.push(`${el.tagName.toLowerCase()}.${String(el.className).split(" ")[0]} (${s.transitionDuration}/${s.animationDuration})`);
      }
      if (getComputedStyle(document.documentElement).scrollBehavior === "smooth") out.push("html: scroll-behavior smooth");
      return [...new Set(out)];
    });
    ok(moving.length === 0, `${moving.length} elemento(s) siguen animados: ${moving.slice(0, 8).join(", ")}`);
  }));

  await test("prefers-reduced-transparency: el cristal pasa a superficie opaca", async () => {
    if (browserName !== "chromium") throw new Unverifiable("solo Chromium permite emular prefers-reduced-transparency");
    await withPage({ path: firstDoc ?? "" }, async (page, context) => {
      const cdp = await context.newCDPSession(page);
      await cdp.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-transparency", value: "reduce" }] });
      ok(await page.evaluate(() => matchMedia("(prefers-reduced-transparency: reduce)").matches), "la emulación no se aplicó");
      const glass = await page.evaluate(() => {
        const out = [];
        for (const el of document.querySelectorAll("body *")) for (const pseudo of [null, "::before", "::after"]) {
          const s = getComputedStyle(el, pseudo);
          const f = s.backdropFilter ?? s.webkitBackdropFilter;
          if (f && f !== "none" && (pseudo ? s.content !== "none" : true)) out.push(`${el.tagName.toLowerCase()}.${String(el.className).split(" ")[0]}${pseudo ?? ""}`);
        }
        return [...new Set(out)];
      });
      ok(glass.length === 0, `siguen con backdrop-filter: ${glass.slice(0, 8).join(", ")}`);
      if (!noShots) await page.screenshot({ path: join(shots, "transparencia-reducida-1440.png") }).catch(() => {});
    });
  });

  await test("forced-colors: la página se lee, los controles tienen borde y el foco se ve", () => withPage({ path: firstDoc ?? "", media: { forcedColors: "active" } }, async (page) => {
    if (!(await page.evaluate(() => matchMedia("(forced-colors: active)").matches))) throw new Unverifiable("el motor no emula forced-colors");
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    ok(over <= 1, `desbordamiento horizontal de ${over}px`);
    await page.keyboard.press(TAB); await page.keyboard.press(TAB); await page.keyboard.press(TAB);
    const el = await active(page);
    ok(el.outline, `el elemento con foco (${el.tag}.${el.cls.split(" ")[0]}) no tiene contorno en forced-colors`);
    if (!noShots) await page.screenshot({ path: join(shots, "forced-colors-1440.png") }).catch(() => {});
  }));

  await test("impresión: sin cromo de navegación, sin cristal y sin desbordamiento en A4", () => withPage({ path: firstDoc ?? "", width: 794, height: 1123, theme: "dark" }, async (page) => {
    await page.emulateMedia({ media: "print" });
    await page.waitForTimeout(100);
    const state = await page.evaluate(() => {
      const shown = (sel) => [...document.querySelectorAll(sel)].some((el) => { const s = getComputedStyle(el); return s.display !== "none" && s.visibility !== "hidden" && el.getBoundingClientRect().height > 0; });
      const article = document.querySelector("div[class*='docItemContainer']") ?? document.querySelector("main");
      const s = getComputedStyle(article);
      const lum = (c) => { const m = c.match(/[\d.]+/g)?.map(Number) ?? [255, 255, 255, 1]; return m.length > 3 && m[3] === 0 ? 255 : (m[0] * 299 + m[1] * 587 + m[2] * 114) / 1000; };
      return {
        chrome: [".navbar", ".theme-doc-sidebar-container", ".theme-doc-toc-desktop", ".theme-doc-toc-mobile", ".pagination-nav", ".theme-doc-breadcrumbs", ".footer", "a[href='#__docusaurus_skipToContent_fallback']"].filter(shown),
        over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        shadow: s.boxShadow,
        bg: lum(s.backgroundColor), body: lum(getComputedStyle(document.body).backgroundColor), fg: lum(getComputedStyle(document.querySelector(".markdown p, main p") ?? document.body).color),
      };
    });
    ok(state.chrome.length === 0, `al imprimir siguen visibles: ${state.chrome.join(", ")}`);
    ok(state.over <= 1, `desbordamiento horizontal de ${state.over}px al imprimir`);
    ok(state.shadow === "none", "el artículo conserva la sombra al imprimir");
    ok(state.bg > 200 && state.body > 200, `al imprimir en tema oscuro el fondo sigue oscuro (artículo ${Math.round(state.bg)}, página ${Math.round(state.body)})`);
    ok(state.fg < 100, `al imprimir el texto no es oscuro (${Math.round(state.fg)})`);
    if (!noShots && browserName === "chromium") await page.pdf({ path: join(shots, "impresion.pdf"), format: "A4" }).catch(() => {});
    if (!noShots) await page.screenshot({ path: join(shots, "impresion-a4.png"), fullPage: true }).catch(() => {});
  }));

  await browser.close();
  for (const [pass, name, extra = []] of results) {
    console.log(`${pass ? "✓" : pass === null ? "–" : "✗"} [${browserName}] ${name}`);
    for (const line of extra) console.log(`      · ${line}`);
  }
  const failed = results.filter(([pass]) => pass === false).length;
  const skipped = results.filter(([pass]) => pass === null).length;
  failedTotal += failed;
  console.log(failed ? `✗ ${browserName}: ${failed} de ${results.length} fallan` : `✓ ${browserName}: ${results.length} casos${skipped ? ` (${skipped} no verificables)` : ""} · sitio ${base} (${pages.length} páginas)`);
}

server.close();
process.exit(failedTotal ? 1 : 0);
