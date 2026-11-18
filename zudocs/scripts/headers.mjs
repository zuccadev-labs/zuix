// Escribe `_headers` en el sitio compilado: cabeceras de seguridad y de caché con el formato de Netlify y
// Cloudflare Pages, y como referencia para cualquier otro servidor.
//   zudocs headers [--config <ruta>] [--out-dir <ruta>]        o   zudocs build --headers
// La política de contenido (CSP) no usa 'unsafe-inline' para scripts: los scripts en línea que genera
// Docusaurus (tema inicial, datos de la página) se autorizan por su hash SHA-256, calculado sobre el HTML
// ya compilado. Por eso se ejecuta después de build y hay que repetirlo en cada compilación.
// GitHub Pages no aplica cabeceras propias: allí el archivo no tiene efecto.
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadZudocs, parseArgs } from "./config.mjs";

const fail = (message) => {
  process.stderr.write(`✗ ${message}\n`);
  process.exit(1);
};
let ctx;
try {
  ctx = loadZudocs(parseArgs());
} catch (e) {
  fail(e.message);
}
if (!existsSync(join(ctx.outDir, "index.html"))) fail(`No hay sitio compilado en ${ctx.rel(ctx.outDir)}. Ejecuta antes "zudocs build".`);

const html = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? html(join(dir, e.name)) : e.name.endsWith(".html") ? [join(dir, e.name)] : [],
  );
// Solo se autorizan los scripts en línea que están en TODAS las páginas: los de la plantilla de Docusaurus.
// Uno que aparece solo en algunas viene del contenido (un <script> en un documento) y la política lo bloquea.
const seen = new Map();
const origins = { script: new Set(), style: new Set(), font: new Set(), img: new Set(), frame: new Set() };
const parse = (u) => {
  try {
    return new URL(u);
  } catch {
    return undefined;
  }
};
const origin = (u) => parse(u)?.origin;
for (const file of html(ctx.outDir)) {
  const text = readFileSync(file, "utf8");
  // Como las lee un navegador: sin distinguir mayúsculas y con la etiqueta de cierre en cualquiera de sus formas
  // (`</SCRIPT>`, `</script >`). Un script que este patrón no viera quedaría sin hash y sin aviso.
  for (const m of text.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\b[^>]*>/gi)) {
    const src = m[1].match(/\ssrc\s*=\s*["']?([^\s"'>]+)/i)?.[1];
    if (src) {
      if (/^https?:/i.test(src)) origins.script.add(origin(src));
    }
    // Los bloques de datos (JSON-LD) no se ejecutan y no necesitan hash.
    else if (m[2].trim() && !/\stype\s*=\s*["']?application\/(ld\+)?json\b/i.test(m[1])) {
      const h = `'sha256-${createHash("sha256").update(m[2]).digest("base64")}'`;
      if (!seen.has(h)) seen.set(h, new Set());
      seen.get(h).add(file);
    }
  }
  for (const m of text.matchAll(/<link\b[^>]*rel=["']?stylesheet[^>]*>/g)) {
    const href = m[0].match(/href=["']?([^\s"'>]+)/)?.[1];
    if (href && /^https?:/.test(href)) origins.style.add(origin(href));
  }
  // Imágenes y marcos de otros orígenes salen del contenido: solo se autorizan si los documentos son de confianza.
  if (ctx.site.markdown?.untrusted !== true)
    for (const m of text.matchAll(/<(img|iframe)\b[^>]*\ssrc=["']?(https?:[^\s"'>]+)/g))
      origins[m[1] === "img" ? "img" : "frame"].add(origin(m[2]));
}
const pages = html(ctx.outDir).length;
const hashes = new Set([...seen].filter(([, files]) => files.size === pages).map(([h]) => h));
const blocked = [...new Set([...seen].filter(([, files]) => files.size !== pages).flatMap(([, files]) => [...files]))];
// Una hoja de fuentes remota (Google Fonts) trae sus archivos de otro origen.
for (const font of ctx.remoteFonts) {
  origins.style.add(origin(font));
  if (parse(font)?.hostname === "fonts.googleapis.com") origins.font.add("https://fonts.gstatic.com");
}
const list = (set) => [...set].filter(Boolean).sort().join(" ");

const csp = [
  "default-src 'self'",
  `script-src 'self' ${[...hashes].sort().join(" ")} ${list(origins.script)}`.trim(),
  // Los componentes fijan variables CSS con el atributo style, y Mermaid inyecta estilos en sus SVG.
  `style-src 'self' 'unsafe-inline' ${list(origins.style)}`.trim(),
  `img-src 'self' data: ${list(origins.img)}`.trim(),
  `font-src 'self' ${list(origins.font)}`.trim(),
  "connect-src 'self'",
  "worker-src 'self' blob:",
  origins.frame.size ? `frame-src ${list(origins.frame)}` : "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const base = ctx.baseUrl;
const out = `# GENERADO por "zudocs headers". Se recalcula en cada compilación: los hashes dependen del HTML.
${base}*
  Content-Security-Policy: ${csp}
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()
  Cross-Origin-Opener-Policy: same-origin
  X-Frame-Options: DENY
  Strict-Transport-Security: max-age=63072000; includeSubDomains

# Los archivos de assets/ llevan el hash de su contenido en el nombre.
${base}assets/*
  Cache-Control: public, max-age=31536000, immutable
`;
writeFileSync(join(ctx.outDir, "_headers"), out);
if (blocked.length)
  process.stdout.write(
    `aviso  ${blocked.length} página(s) llevan un script en línea que no es de la plantilla y la política lo bloqueará: ${blocked
      .slice(0, 5)
      .map((f) => ctx.rel(f))
      .join(", ")}${blocked.length > 5 ? "…" : ""}\n`,
  );
process.stdout.write(
  `✓ ${ctx.rel(join(ctx.outDir, "_headers"))}: CSP con ${hashes.size} hash(es) de script${[...origins.script, ...origins.style, ...origins.font].filter(Boolean).length ? " y orígenes externos" : ", sin orígenes externos"}\n`,
);
