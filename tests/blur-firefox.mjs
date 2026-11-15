#!/usr/bin/env node
// ¿Pinta Firefox el desenfoque del cristal (`backdrop-filter`)? El Firefox sin interfaz no lo pinta, así que las
// capturas de las suites muestran el cristal sin desenfocar. Esta prueba lanza el Firefox de Playwright CON ventana
// y lo mide por píxeles, comparándolo con el mismo Firefox sin interfaz.
//
// Uso:  DISPLAY=:0 node tests/blur-firefox.mjs          con una sesión gráfica (se abre una ventana unos segundos)
//       xvfb-run -a node tests/blur-firefox.mjs         con un servidor X virtual (paquete xvfb)
// Sin DISPLAY sale con código 2. Capturas en tests/html/shots/firefox-headed/.
//
// Método: detrás de cada capa se dibuja un rayado vertical de 2 px (el detalle fino de un texto). Se abre un menú,
// un modal y un aviso, se captura la ventana y se mide la "energía de borde" (diferencia media de luminancia entre
// píxeles vecinos) dentro de cada capa. Con desenfoque el rayado se funde y la energía cae; sin él, se conserva.
import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { inflateSync } from "node:zlib";
import { firefox } from "playwright-core";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const shots = join(here, "html", "shots", "firefox-headed");
if (!process.env.DISPLAY) {
  console.error("Sin DISPLAY: no hay pantalla X donde abrir la ventana ni de la que capturar. Usa `xvfb-run -a node tests/blur-firefox.mjs` (paquetes xvfb y x11-apps).");
  process.exit(2);
}
mkdirSync(shots, { recursive: true });

/** PNG de 8 bits sin entrelazar (lo que produce Playwright) → { width, height, at(x, y) → luminancia 0-255 }. */
function decodePng(buffer) {
  let offset = 8;
  let width = 0, height = 0, channels = 0;
  const data = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const chunk = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = chunk.readUInt32BE(0); height = chunk.readUInt32BE(4);
      const [depth, color, , , interlace] = chunk.subarray(8);
      if (depth !== 8 || interlace !== 0 || (color !== 2 && color !== 6)) throw new Error(`PNG no admitido (profundidad ${depth}, color ${color})`);
      channels = color === 6 ? 4 : 3;
    } else if (type === "IDAT") data.push(chunk);
    offset += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(data));
  const stride = width * channels;
  const pixels = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? pixels[y * stride + x - channels] : 0;
      const b = y > 0 ? pixels[(y - 1) * stride + x] : 0;
      const c = x >= channels && y > 0 ? pixels[(y - 1) * stride + x - channels] : 0;
      let predicted = 0;
      if (filter === 1) predicted = a;
      else if (filter === 2) predicted = b;
      else if (filter === 3) predicted = (a + b) >> 1;
      else if (filter === 4) { const p = a + b - c; const [pa, pb, pc] = [Math.abs(p - a), Math.abs(p - b), Math.abs(p - c)]; predicted = pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      pixels[y * stride + x] = (line[x] + predicted) & 255;
    }
  }
  return { width, height, at: (x, y) => { const i = y * stride + x * channels; return 0.2126 * pixels[i] + 0.7152 * pixels[i + 1] + 0.0722 * pixels[i + 2]; } };
}

/**
 * Captura de la pantalla X (`xwd -root`), no de la página: `page.screenshot()` de Firefox vuelve a dibujar el
 * contenido por una vía que no aplica `backdrop-filter`, con o sin ventana, así que no sirve para esta medida.
 */
function grabScreen() {
  const r = spawnSync("xwd", ["-root", "-silent", "-display", process.env.DISPLAY], { maxBuffer: 256 * 1024 * 1024 });
  if (r.status !== 0 || !r.stdout?.length) throw new Error(`xwd no pudo capturar la pantalla ${process.env.DISPLAY} (paquete x11-apps): ${String(r.stderr ?? r.error ?? "").trim().split("\n")[0]}`);
  const b = r.stdout;
  const field = (i) => b.readUInt32BE(i * 4);
  const [headerSize, , , , width, height, , byteOrder, , , , bitsPerPixel, bytesPerLine, , redMask, greenMask, blueMask, , , colors] = Array.from({ length: 20 }, (_, i) => field(i));
  if (bitsPerPixel !== 32 && bitsPerPixel !== 24) throw new Error(`pantalla de ${bitsPerPixel} bits por píxel: se esperaba color verdadero`);
  const start = headerSize + colors * 12;
  const bytes = bitsPerPixel / 8;
  const shift = (mask) => Math.log2(mask & -mask);
  const [rs, gs, bs] = [shift(redMask), shift(greenMask), shift(blueMask)];
  return {
    width, height,
    at: (x, y) => {
      const i = start + y * bytesPerLine + x * bytes;
      const pixel = byteOrder === 0 ? b.readUIntLE(i, bytes) : b.readUIntBE(i, bytes);
      return 0.2126 * ((pixel >>> rs) & 255) + 0.7152 * ((pixel >>> gs) & 255) + 0.0722 * ((pixel >>> bs) & 255);
    },
  };
}

/** Diferencia media de luminancia entre píxeles vecinos en horizontal dentro de la caja. */
function edgeEnergy(image, box) {
  const [x0, y0, x1, y1] = [Math.max(0, Math.round(box.x)), Math.max(0, Math.round(box.y)), Math.round(box.x + box.width), Math.round(box.y + box.height)];
  let sum = 0, count = 0;
  for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x++) { sum += Math.abs(image.at(x + 1, y) - image.at(x, y)); count += 1; }
  return count ? sum / count : 0;
}

const TYPES = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".json": "application/json" };
const server = createServer((req, res) => {
  const file = join(root, normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)));
  if (!file.startsWith(root) || !existsSync(file) || statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
  res.end(readFileSync(file));
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const url = `http://127.0.0.1:${server.address().port}/examples/html/index.html`;

async function measure(headless) {
  const browser = await firefox.launch({ headless });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
    await page.goto(url);
    await page.waitForFunction(() => customElements.get("z-icon"));
    const settle = () => page.waitForTimeout(450);
    // Rayado fijo sobre la página y bajo la capa superior. Colores del sistema: sin literales.
    await page.evaluate(() => {
      const stripes = document.createElement("div");
      stripes.id = "stripes";
      stripes.style.cssText = "position:fixed;inset:0;z-index:2147483647;pointer-events:none;background:repeating-linear-gradient(90deg, CanvasText 0 2px, Canvas 2px 4px)";
      document.body.append(stripes);
    });
    // Sin interfaz: captura de la página. Con ventana: captura de la pantalla, con las cajas llevadas a coordenadas de pantalla.
    const origin = headless ? { x: 0, y: 0 } : await page.evaluate(() => ({ x: window.mozInnerScreenX, y: window.mozInnerScreenY }));
    const shoot = async (name) => {
      const png = await page.screenshot({ path: join(shots, `${name}-${headless ? "headless" : "headed-page"}.png`) });
      const image = headless ? decodePng(png) : grabScreen();
      // Evidencia visual (opcional, con ImageMagick): solo el recorte de la ventana de Firefox, nunca el resto de la pantalla.
      if (!headless) spawnSync("import", ["-display", process.env.DISPLAY, "-window", "root", "-crop", `1280x800+${Math.round(origin.x)}+${Math.round(origin.y)}`, "+repage", join(shots, `${name}-headed-screen.png`)], { timeout: 20000 });
      return { width: image.width, height: image.height, at: (x, y) => image.at(x + Math.round(origin.x), y + Math.round(origin.y)) };
    };
    const out = { filter: {} };

    // Referencia: el rayado sin nada encima.
    out.reference = edgeEnergy(await shoot("stripes"), { x: 40, y: 300, width: 300, height: 200 });

    // Menú sobre contenido: cristal con blur(--z-glass-blur).
    await page.locator('[data-component="Menu"] [data-z-open]').click();
    await settle();
    out.filter.menu = await page.locator("#actions").evaluate((el) => getComputedStyle(el).backdropFilter);
    // Franja del relleno superior del menú: dentro no hay texto ni iconos que aporten bordes propios.
    const menu = await page.locator("#actions").boundingBox();
    out.menu = edgeEnergy(await shoot("menu"), { x: menu.x + 14, y: menu.y + 1, width: menu.width - 28, height: 4 });
    await page.keyboard.press("Escape");

    // Modal: panel de cristal y velo con blur(3px).
    await page.locator('[data-component="Modal"] [data-z-open]').click();
    await settle();
    out.filter.modal = await page.locator("#edit-profile").evaluate((el) => getComputedStyle(el).backdropFilter);
    out.filter.scrim = await page.locator("#edit-profile").evaluate((el) => getComputedStyle(el, "::backdrop").backdropFilter);
    const modalShot = await shoot("modal");
    const modal = await page.locator("#edit-profile").boundingBox();
    // Solo la franja superior del panel, sobre el título: el cuerpo tiene campos con borde propio.
    out.modal = edgeEnergy(modalShot, { x: modal.x + 14, y: modal.y + 4, width: modal.width - 28, height: 8 });
    out.scrim = edgeEnergy(modalShot, { x: 20, y: 20, width: Math.max(40, modal.x - 60), height: 300 });
    await page.keyboard.press("Escape");
    await settle();

    // Aviso (toast): cristal en la capa superior.
    await page.locator("#save").click();
    await settle();
    const toast = await page.locator(".z-toast").boundingBox();
    out.toast = edgeEnergy(await shoot("toast"), { x: toast.x + 14, y: toast.y + 3, width: toast.width - 28, height: 6 });
    out.version = browser.version();
    return out;
  } finally {
    await browser.close();
  }
}

let code = 0;
try {
  const headless = await measure(true);
  const headed = await measure(false);
  const row = (name) => `${name.padEnd(10)} ${headless[name].toFixed(1).padStart(8)} ${headed[name].toFixed(1).padStart(8)}`;
  console.log(`Firefox ${headed.version} · energía de borde del rayado (0 = fundido, ~100 = nítido)`);
  console.log(`${"".padEnd(10)} ${"sin vent.".padStart(8)} ${"ventana".padStart(8)}`);
  for (const name of ["reference", "menu", "modal", "toast", "scrim"]) console.log(row(name));
  console.log(`backdrop-filter calculado: menú ${headed.filter.menu} · modal ${headed.filter.modal} · velo ${headed.filter.scrim}`);
  const failures = [];
  if (headed.reference < 40) failures.push(`el rayado de referencia no es nítido (${headed.reference.toFixed(1)}): la medida no es fiable`);
  // Cristal (blur de 36 px): el rayado debe desaparecer. Velo (blur de 3 px): debe caer a menos de la mitad.
  for (const name of ["menu", "modal", "toast"]) if (headed[name] > 3) failures.push(`${name}: el rayado se sigue viendo a través del cristal (${headed[name].toFixed(1)})`);
  if (headed.scrim > headed.reference * 0.25) failures.push(`velo: el rayado no se funde (${headed.scrim.toFixed(1)} frente a ${headed.reference.toFixed(1)} de referencia)`);
  const paintedHeadless = ["menu", "modal", "toast"].every((name) => headless[name] <= 3);
  console.log(paintedHeadless
    ? "· El Firefox sin interfaz también fundió el rayado en esta máquina."
    : "· El Firefox sin interfaz NO desenfoca (el rayado se ve a través de las capas): sus capturas no sirven para juzgar el cristal.");
  if (failures.length) { code = 1; for (const f of failures) console.log(`✗ ${f}`); }
  else console.log("✓ Firefox con ventana pinta backdrop-filter: menú, modal, aviso y velo desenfocan lo que tienen detrás");
} catch (error) {
  code = 1;
  console.error(`✗ ${String(error.message).split("\n")[0]}`);
} finally {
  server.close();
}
process.exit(code);
