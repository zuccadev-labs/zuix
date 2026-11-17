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
const urls = args.rest.length ? args.rest : ctx.remoteFonts;
if (!urls.length) fail('No hay hojas remotas: pasa una URL o declara una en "fonts".');
for (const u of urls) if (!/^https:\/\//.test(u)) fail(`Solo se descargan URL https: ${u}`);
const dest = args.outDir ? resolve(callerDir(), args.outDir) : join(ctx.configDir, "fonts");
const subsets = (process.env.ZUDOCS_FONT_SUBSETS ?? "latin,latin-ext").split(",").map((s) => s.trim());
// Con el agente de un navegador actual, el servidor entrega woff2 y un bloque por subconjunto.
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const get = async (url) => {
  const r = await fetch(url, { headers: { "user-agent": UA } });
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r;
};

mkdirSync(dest, { recursive: true });
let css = `/* GENERADO por "zudocs fonts". No editar: vuelve a ejecutar el comando.\n   Origen: ${urls.join("\n           ")}\n   Subconjuntos: ${subsets.join(", ")}. Las fuentes conservan su licencia de origen. */\n`;
let files = 0,
  bytes = 0;
const written = new Set();
try {
  for (const url of urls) {
    const sheet = await (await get(url)).text();
    // Cada bloque @font-face viene precedido de un comentario con su subconjunto: /* latin */.
    for (const m of sheet.matchAll(/(?:\/\*\s*([\w-]+)\s*\*\/\s*)?(@font-face\s*\{[^}]*\})/g)) {
      const [, subset, block] = m;
      if (subset && !subsets.includes(subset)) continue;
      const src = block.match(/url\((["']?)(https:\/\/[^)"']+\.woff2)\1\)/)?.[2];
      if (!src) continue;
      const family = (block.match(/font-family:\s*["']?([^;"']+)/)?.[1] ?? "fuente").trim().toLowerCase().replace(/\s+/g, "-");
      const data = Buffer.from(await (await get(src)).arrayBuffer());
      // El nombre sale del contenido: una fuente variable sirve varios pesos con un solo archivo.
      const name = `${family}-${subset ?? "all"}-${createHash("sha1").update(data).digest("hex").slice(0, 8)}.woff2`;
      if (!written.has(name)) {
        writeFileSync(join(dest, name), data);
        written.add(name);
        bytes += data.length;
      }
      files = written.size;
      css += `${subset ? `/* ${subset} */\n` : ""}${block.replace(/src:[^;]+;/, `src: url("./${name}") format("woff2");`)}\n`;
    }
  }
} catch (e) {
  fail(`No se pudieron descargar las fuentes: ${e.message}`);
}
if (!files) fail("La hoja no contiene fuentes woff2 de los subconjuntos pedidos.");
writeFileSync(join(dest, "fonts.css"), css);
process.stdout.write(
  `✓ ${ctx.rel(join(dest, "fonts.css"))}: ${files} archivos, ${Math.round(bytes / 1024)} KB\n  Declárala en la configuración, relativa a ella: "fonts": ["…/fonts.css"]\n`,
);
