#!/usr/bin/env node
// Prueba el contrato HTML sin framework: sirve el repo, abre examples/html/index.html y ejercita
// @zuccadev-labs/zuix-zui/dom y @zuccadev-labs/zuix-zout/dom. Sale con código ≠ 0 si algo falla. Capturas en tests/html/shots/<navegador>/.
// Uso: node tests/html/run.mjs [filtro]      BROWSER=chromium|firefox|webkit|all (por defecto chromium)   NO_WEBGL=1 sin WebGL
// Los casos viven en tests/html/cases/*.mjs: cada archivo exporta `default async (ctx)` y registra casos
// con ctx.test(nombre, fn). ctx = { page, test, ok, card, settle, shots, browserName, note, Unverifiable }.
// `throw new Unverifiable(motivo)` marca el caso como no verificable en ese motor (no cuenta como fallo);
// `note(texto)` deja una observación bajo el caso en curso.
import { createServer } from "node:http";
import { mkdirSync, readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium, firefox, webkit } from "playwright-core";
import { applyNoWebgl, noWebglLaunch } from "../webgl.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const here = dirname(fileURLToPath(import.meta.url));
const filter = process.argv
  .slice(2)
  .find((a) => !a.startsWith("--"))
  ?.toLowerCase();
const TYPES = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".json": "application/json" };
const server = createServer((req, res) => {
  const file = join(root, normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)));
  if (!file.startsWith(root) || !existsSync(file) || statSync(file).isDirectory()) {
    res.writeHead(404);
    return res.end();
  }
  res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const url = `http://127.0.0.1:${server.address().port}/examples/html/index.html`;

// NO_WEBGL=1 lanza los motores sin WebGL, como el Firefox de los runners de CI (tests/webgl.mjs).
const ENGINES = {
  chromium: () => chromium.launch({ channel: "chrome", headless: true, ...noWebglLaunch("chromium") }),
  firefox: () => firefox.launch({ headless: true, ...noWebglLaunch("firefox") }),
  webkit: () => webkit.launch({ headless: true, ...noWebglLaunch("webkit") }),
};
const wanted = (process.env.BROWSER ?? "chromium") === "all" ? Object.keys(ENGINES) : (process.env.BROWSER ?? "chromium").split(",");
const caseFiles = readdirSync(join(here, "cases"))
  .filter((f) => f.endsWith(".mjs"))
  .sort();
let failedTotal = 0;
/** Señal de "no verificable en este motor": el caso no cuenta como fallo. */
class Unverifiable extends Error {}

for (const browserName of wanted) {
  const shots = join(here, "shots", browserName);
  mkdirSync(shots, { recursive: true });
  let browser;
  try {
    browser = applyNoWebgl(await ENGINES[browserName](), browserName);
  } catch (error) {
    console.log(`✗ ${browserName}: no se pudo lanzar (${String(error.message).split("\n")[0]})`);
    failedTotal += 1;
    continue;
  }
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.setDefaultTimeout(15000);
  const problems = [];
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("Failed to load resource")) problems.push(`console: ${m.text()}`);
  });
  page.on("requestfailed", (r) => problems.push(`request: ${r.url()}`));
  page.on("response", (r) => {
    if (r.status() >= 400) problems.push(`${r.status()}: ${r.url()}`);
  });

  const results = [];
  let notes = [];
  const note = (text) => notes.push(text);
  async function test(name, fn) {
    if (filter && !name.toLowerCase().includes(filter)) return;
    notes = [];
    try {
      await fn();
      results.push([true, name, notes]);
    } catch (error) {
      if (error instanceof Unverifiable) {
        results.push([null, `${name} — ${error.message}`, notes]);
        return;
      }
      await page.screenshot({ path: join(shots, `FAIL-${results.length}.png`) }).catch(() => {});
      results.push([
        false,
        `${name} — ${String(error.message)
          .split("\n")
          .slice(0, process.env.DEBUG ? 30 : 1)
          .join("\n")}`,
        notes,
      ]);
      await page.keyboard.press("Escape").catch(() => {});
    }
  }
  const ok = (cond, msg) => {
    if (!cond) throw new Error(msg);
  };
  const card = (name) => page.locator(`[data-component="${name}"]`);
  const settle = () => page.waitForTimeout(350);

  await page.goto(url);
  await page.waitForFunction(() => customElements.get("z-icon"));
  const ctx = { page, test, ok, card, settle, shots, browserName, note, Unverifiable };
  for (const file of caseFiles) await (await import(pathToFileURL(join(here, "cases", file)).href)).default(ctx);
  await page.mouse.move(5, 5);
  await page.screenshot({ path: join(shots, "page-dark.png"), fullPage: true }).catch(() => {});
  await test("sin errores de consola ni de red", async () => ok(problems.length === 0, problems.slice(0, 5).join(" | ")));
  await browser.close();

  for (const [pass, name, extra = []] of results) {
    console.log(`${pass ? "✓" : pass === null ? "–" : "✗"} [${browserName}] ${name}`);
    for (const line of extra) console.log(`      · ${line}`);
  }
  const failed = results.filter(([pass]) => pass === false).length;
  const skipped = results.filter(([pass]) => pass === null).length;
  failedTotal += failed;
  console.log(
    failed
      ? `✗ ${browserName}: ${failed} de ${results.length} fallan`
      : `✓ ${browserName}: ${results.length} casos${skipped ? ` (${skipped} no verificables)` : ""} · contrato HTML sin framework`,
  );
}
server.close();
process.exit(failedTotal ? 1 : 0);
