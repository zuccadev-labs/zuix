// Autoaloja las fuentes: descarga una hoja de estilo remota (Google Fonts u otra) y sus archivos woff2, y
// escribe una hoja local que el sitio empaqueta. Así ningún visitante hace peticiones a un tercero.
//   zudocs fonts [--config <ruta>] [--out-dir <carpeta>] [<url> …]
// Sin URL usa las hojas remotas de `fonts` en la configuración. Destino por defecto: fonts/ junto a la
// configuración. Solo conserva los subconjuntos latin y latin-ext (ZUDOCS_FONT_SUBSETS los cambia).
// Es el único comando de zudocs que usa la red, y solo se ejecuta a mano: el resultado se versiona.
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { callerDir, loadZudocs, parseArgs } from "./config.mjs";
import { cssComment, fontFaceCss, fontFaces, fontFileName, isWoff2, MAX_FONT_BYTES, MAX_SHEET_BYTES, remoteUrl } from "./font-sheet.mjs";

const fail = (message) => {
  process.stderr.write(`✗ ${message}\n`);
  process.exit(1);
};
let args, ctx;
try {
  args = parseArgs();
  ctx = loadZudocs({ config: args.config });
} catch (e) {
  fail(e.message);
}
const dest = args.outDir ? resolve(callerDir(), args.outDir) : join(ctx.configDir, "fonts");
const subsets = (process.env.ZUDOCS_FONT_SUBSETS ?? "latin,latin-ext").split(",").map((s) => s.trim());
let urls;
try {
  // Las hojas las elige quien ejecuta el comando (argumentos o configuración). Solo https y sin credenciales.
  urls = (args.rest.length ? args.rest : ctx.remoteFonts).map(remoteUrl);
} catch (e) {
  fail(e.message);
}
if (!urls.length) fail('No hay hojas remotas: pasa una URL o declara una en "fonts".');
// Con el agente de un navegador actual, el servidor entrega woff2 y un bloque por subconjunto.
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
/** Descarga una URL ya validada. Una redirección tampoco puede salir de https, y la respuesta tiene un tamaño máximo. */
const get = async (url, maxBytes) => {
  const r = await fetch(url, { headers: { "user-agent": UA } });
  if (!r.ok) throw new Error(`${url.href}: HTTP ${r.status}`);
  remoteUrl(r.url);
  const data = Buffer.from(await r.arrayBuffer());
  if (data.length > maxBytes) throw new Error(`${url.href}: la respuesta pesa más de ${Math.round(maxBytes / 1024)} KB`);
  return data;
};

let css = `/* GENERADO por "zudocs fonts". No editar: vuelve a ejecutar el comando.\n   Origen: ${urls.map((u) => cssComment(u.href)).join("\n           ")}\n   Subconjuntos: ${cssComment(subsets.join(", "))}. Las fuentes conservan su licencia de origen. */\n`;
let bytes = 0;
/** Archivos por escribir: nombre (alfabeto cerrado, sin separadores de ruta) → contenido comprobado. */
const fonts = new Map();
try {
  for (const url of urls) {
    const sheet = (await get(url, MAX_SHEET_BYTES)).toString("utf8");
    for (const face of fontFaces(sheet, subsets)) {
      const data = await get(face.src, MAX_FONT_BYTES);
      if (!isWoff2(data)) throw new Error(`${face.src.href}: no es un archivo WOFF2`);
      const name = fontFileName(face, createHash("sha1").update(data).digest("hex"));
      if (!fonts.has(name)) {
        fonts.set(name, data);
        bytes += data.length;
      }
      css += fontFaceCss(face, name);
    }
  }
} catch (e) {
  fail(`No se pudieron descargar las fuentes: ${e.message}`);
}
if (!fonts.size) fail("La hoja no contiene fuentes woff2 de los subconjuntos pedidos.");
// Se escribe al final, con todo descargado y comprobado: un fallo a mitad no deja la carpeta a medias.
mkdirSync(dest, { recursive: true });
for (const [name, data] of fonts) writeFileSync(join(dest, name), data);
writeFileSync(join(dest, "fonts.css"), css);
process.stdout.write(
  `✓ ${ctx.rel(join(dest, "fonts.css"))}: ${fonts.size} archivos, ${Math.round(bytes / 1024)} KB\n  Declárala en la configuración, relativa a ella: "fonts": ["…/fonts.css"]\n`,
);
