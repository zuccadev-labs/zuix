#!/usr/bin/env node
// Pruebas en navegador de la suite sobre examples/app. Runner propio, sin @playwright/test.
// Uso: node tests/browser/run.mjs [filtro…] [--headed]      BROWSER=chromium|firefox|webkit|all (por defecto chromium)
//   NO_WEBGL=1 lanza los motores sin WebGL, como el Firefox de los runners de CI (tests/webgl.mjs).
//   Levanta Vite en un puerto libre y ejecuta los casos de cases.mjs en cada navegador pedido:
//   chromium es el Chrome del sistema; firefox y webkit son los de Playwright
//   (`pnpm exec playwright-core install firefox webkit`). Termina con código ≠ 0 si algún caso falla
//   en algún navegador. Capturas y results.json en tests/browser/shots/<navegador>/.
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import net from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, firefox, webkit } from "playwright-core";
import { cases } from "./cases.mjs";
import { touchContext, touchDriver } from "../touch.mjs";
import { WEBGL_UNAVAILABLE_WARNING, applyNoWebgl, noWebgl, noWebglLaunch } from "../webgl.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const appDir = join(root, "examples", "app");
const shotsRoot = join(here, "shots");
const args = process.argv.slice(2);
const headed = args.includes("--headed");
const filters = args.filter((a) => !a.startsWith("--")).map((a) => a.toLowerCase());

/** Señal de "no verificable en este entorno": el caso no cuenta como fallo. */
class Unverifiable extends Error {}

// Mezcla las opciones del runner con las de NO_WEBGL (tests/webgl.mjs) y las de una instancia especial (`extra`).
const launchOptions = (browserName, base, extra = {}) => {
  const off = noWebglLaunch(browserName);
  return {
    ...base,
    ...off,
    ...extra,
    args: [...(base.args ?? []), ...(off.args ?? []), ...(extra.args ?? [])],
    firefoxUserPrefs: { ...off.firefoxUserPrefs, ...extra.firefoxUserPrefs },
  };
};
const ENGINES = {
  // SwiftShader permite WebGL2 sin GPU. No se fuerza ANGLE por software para el compositor: con desenfoques de fondo cae a ~1 fps.
  chromium: (extra) =>
    chromium.launch(
      launchOptions(
        "chromium",
        {
          channel: "chrome",
          headless: !headed,
          args: [...(noWebgl ? [] : ["--enable-unsafe-swiftshader"]), "--force-device-scale-factor=1"],
        },
        extra,
      ),
    ),
  firefox: (extra) => firefox.launch(launchOptions("firefox", { headless: !headed }, extra)),
  webkit: (extra) => webkit.launch(launchOptions("webkit", { headless: !headed }, extra)),
};
// Firefox no deja emular `prefers-reduced-transparency` por página: se lanza una segunda instancia con la preferencia activa.
const FIREFOX_REDUCED_TRANSPARENCY = {
  firefoxUserPrefs: { "layout.css.prefers-reduced-transparency.enabled": true, "ui.prefersReducedTransparency": 1 },
};
const requested = (process.env.BROWSER ?? "chromium").toLowerCase();
const wanted =
  requested === "all"
    ? Object.keys(ENGINES)
    : requested
        .split(",")
        .map((name) => name.trim())
        .filter(Boolean);
for (const name of wanted)
  if (!ENGINES[name]) {
    console.error(`BROWSER desconocido: ${name}. Valores: ${Object.keys(ENGINES).join(", ")}, all.`);
    process.exit(2);
  }
const axeSource = readFileSync(join(root, "node_modules", "axe-core", "axe.min.js"), "utf8");

const freePort = () =>
  new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });

async function startServer() {
  const port = await freePort();
  const child = spawn(
    process.execPath,
    [join(appDir, "node_modules", "vite", "bin", "vite.js"), "--port", String(port), "--strictPort", "--host", "127.0.0.1"],
    {
      cwd: appDir,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, NO_COLOR: "1" },
    },
  );
  let log = "";
  child.stdout.on("data", (d) => {
    log += d;
  });
  child.stderr.on("data", (d) => {
    log += d;
  });
  const url = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 30000;
  for (;;) {
    if (child.exitCode !== null) throw new Error(`Vite terminó antes de arrancar:\n${log}`);
    try {
      const res = await fetch(url);
      if (res.ok) break;
    } catch {
      /* aún no escucha */
    }
    if (Date.now() > deadline) {
      child.kill();
      throw new Error(`Vite no respondió en 30 s:\n${log}`);
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  return {
    url,
    pid: child.pid,
    stop: () =>
      new Promise((resolve) => {
        if (child.exitCode !== null) return resolve();
        child.once("exit", resolve);
        child.kill("SIGTERM");
      }),
    log: () => log,
  };
}

// Avisos que no son de la aplicación: React DevTools, HMR de Vite, mensajes de rendimiento del driver GL por software
// y el aviso con el que Firefox responde a `getContext("webgl2")` cuando el equipo no ofrece WebGL (tests/webgl.mjs).
const IGNORED_CONSOLE = [/Download the React DevTools/, /\[vite\]/, /GL Driver Message/, WEBGL_UNAVAILABLE_WARNING];

function makeContext(engine, baseUrl, record, shots) {
  const { browser, browserName } = engine;
  /**
   * Abre una pantalla de la app en una página nueva y vigila consola y errores.
   * `reducedTransparency` emula `prefers-reduced-transparency: reduce` donde el motor lo permite; si no, el caso queda no verificable.
   */
  async function open(
    screen = "overview",
    {
      width = 1440,
      height = 900,
      theme = "dark",
      brand = "dazlabs",
      reducedMotion = "no-preference",
      reducedTransparency = false,
      hasTouch = false,
      touch = false,
      query = "",
    } = {},
  ) {
    let target = browser;
    if (reducedTransparency) {
      if (browserName === "webkit") throw new Unverifiable("WebKit de Playwright no permite emular prefers-reduced-transparency.");
      if (browserName === "firefox") target = engine.reduced ??= await ENGINES.firefox(FIREFOX_REDUCED_TRANSPARENCY);
    }
    // `touch`: contexto de teléfono o tableta (puntero grueso, sin hover). Los gestos salen de `finger(page)`.
    const context = await target.newContext(
      touch
        ? { ...touchContext(browserName, { width, height }), reducedMotion }
        : { viewport: { width, height }, reducedMotion, hasTouch, deviceScaleFactor: 1 },
    );
    const page = await context.newPage();
    if (reducedTransparency && browserName === "chromium") {
      const session = await context.newCDPSession(page);
      await session.send("Emulation.setEmulatedMedia", {
        features: [
          { name: "prefers-reduced-transparency", value: "reduce" },
          { name: "prefers-reduced-motion", value: reducedMotion === "reduce" ? "reduce" : "" },
        ],
      });
    }
    page.on("console", (msg) => {
      if (msg.type() !== "error" && msg.type() !== "warning") return;
      const text = msg.text();
      if (IGNORED_CONSOLE.some((re) => re.test(text))) return;
      record.problems.push(`console.${msg.type()}: ${text}`);
    });
    page.on("pageerror", (error) => record.problems.push(`pageerror: ${error.message}`));
    page.on("requestfailed", (request) => record.problems.push(`requestfailed: ${request.url()} ${request.failure()?.errorText ?? ""}`));
    await page.goto(`${baseUrl}/?screen=${screen}&theme=${theme}&brand=${brand}${query ? `&${query}` : ""}`, { waitUntil: "load" });
    await page.waitForSelector(`[data-testid="screen-${screen}"]`, { timeout: 15000 });
    await page.evaluate(() => document.fonts.ready);
    record.pages.push(context);
    return page;
  }
  const shot = async (page, name, options = {}) => {
    // La captura espera a que terminen las animaciones finitas (entrada de capas).
    await page
      .waitForFunction(
        () => document.getAnimations().every((a) => a.playState !== "running" || a.effect?.getComputedTiming().iterations === Infinity),
        null,
        { timeout: 10000 },
      )
      .catch(() => {});
    await page.screenshot({ path: join(shots, `${name}.png`), ...options });
    record.shots.push(`${name}.png`);
  };
  /** Inyecta axe-core en la página (una vez) y devuelve las violaciones del documento o de `include`. */
  const axe = async (page, { include, rules } = {}) => {
    if (!(await page.evaluate(() => typeof window.axe !== "undefined"))) await page.evaluate(axeSource);
    return page.evaluate(
      async ([scope, ruleOptions]) => {
        const result = await window.axe.run(scope ?? document, { resultTypes: ["violations"], rules: ruleOptions ?? {} });
        return result.violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          help: v.help,
          nodes: v.nodes.map((n) => ({ target: n.target.join(" "), summary: (n.failureSummary ?? "").replace(/\s+/g, " ").slice(0, 300) })),
        }));
      },
      [include ?? null, rules ?? null],
    );
  };
  /** Gestos táctiles sobre una página abierta con `touch: true` (ver tests/touch.mjs). */
  const finger = (page) => touchDriver(page, browserName);
  return { open, shot, axe, finger, browserName, Unverifiable, note: (text) => record.notes.push(text) };
}

async function runBrowser(browserName, server, selected) {
  const shots = join(shotsRoot, browserName);
  rmSync(shots, { recursive: true, force: true });
  mkdirSync(shots, { recursive: true });
  const results = [];
  const engine = { browserName, browser: null, reduced: null };
  try {
    try {
      engine.browser = applyNoWebgl(await ENGINES[browserName](), browserName);
    } catch (error) {
      const reason = String(error.message).split("\n")[0];
      console.log(`FAIL [${browserName}] no se pudo lanzar el navegador: ${reason}`);
      return [{ name: "lanzar el navegador", status: "fail", ms: 0, detail: reason, notes: [], shots: [] }];
    }
    console.log(`\n── ${browserName} ${engine.browser.version()} ──`);
    // Primera carga: Vite optimiza dependencias y puede recargar la página. Se descarta.
    {
      const warm = await engine.browser.newPage();
      await warm.goto(server.url, { waitUntil: "load" });
      await warm.waitForSelector('[data-testid="screen-overview"]', { timeout: 60000 });
      await warm.waitForTimeout(500);
      await warm.close();
    }

    for (const testCase of selected) {
      const record = { problems: [], notes: [], shots: [], pages: [] };
      const ctx = makeContext(engine, server.url, record, shots);
      const started = Date.now();
      let status = "pass";
      let detail = "";
      try {
        await testCase.run(ctx);
        // `expectConsole`: mensajes de consola que el caso provoca a propósito (un límite de errores de React).
        if (testCase.expectConsole) record.problems = record.problems.filter((problem) => !testCase.expectConsole.test(problem));
        if (record.problems.length) {
          status = "fail";
          detail = `Errores de consola o de página:\n  ${[...new Set(record.problems)].join("\n  ")}`;
        }
      } catch (error) {
        if (error instanceof Unverifiable) {
          status = "unverifiable";
          detail = error.message;
        } else {
          status = "fail";
          detail = error?.stack ?? String(error);
          if (record.problems.length) detail += `\nErrores de consola o de página:\n  ${[...new Set(record.problems)].join("\n  ")}`;
          // Captura del estado en el momento del fallo.
          let n = 0;
          for (const context of record.pages)
            for (const page of context.pages()) {
              try {
                await page.screenshot({ path: join(shots, `FAIL-${testCase.name.replace(/[^a-z0-9]+/gi, "-")}-${n++}.png`) });
              } catch {
                /* página cerrada */
              }
            }
        }
      }
      for (const context of record.pages) await context.close().catch(() => {});
      const ms = Date.now() - started;
      results.push({ name: testCase.name, status, ms, detail, notes: record.notes, shots: record.shots });
      const mark = status === "pass" ? "ok  " : status === "fail" ? "FAIL" : "n/v ";
      console.log(`${mark} [${browserName}] ${testCase.name} (${ms} ms)`);
      for (const note of record.notes) console.log(`       · ${note}`);
      if (detail)
        console.log(
          detail
            .split("\n")
            .map((l) => `       ${l}`)
            .join("\n"),
        );
    }
  } finally {
    await engine.reduced?.close().catch(() => {});
    await engine.browser?.close().catch(() => {});
  }
  writeFileSync(join(shots, "results.json"), JSON.stringify({ date: new Date().toISOString(), browser: browserName, results }, null, 2));
  return results;
}

async function main() {
  const selected = cases.filter((c) => filters.length === 0 || filters.some((f) => c.name.toLowerCase().includes(f)));
  if (selected.length === 0) {
    console.error("Ningún caso coincide con el filtro.");
    process.exit(2);
  }

  const server = await startServer();
  console.log(`Vite en ${server.url} (pid ${server.pid})`);
  const summary = [];
  try {
    for (const browserName of wanted) summary.push([browserName, await runBrowser(browserName, server, selected)]);
  } finally {
    await server.stop();
  }

  console.log("");
  let failed = 0;
  for (const [browserName, results] of summary) {
    const count = (s) => results.filter((r) => r.status === s).length;
    failed += count("fail");
    console.log(
      `${browserName}: ${results.length} casos · ${count("pass")} correctos · ${count("fail")} fallidos · ${count("unverifiable")} no verificables`,
    );
    for (const r of results)
      if (r.status !== "pass")
        console.log(`  ${r.status === "fail" ? "FAIL" : "n/v "} ${r.name}${r.status === "unverifiable" ? ` — ${r.detail}` : ""}`);
  }
  process.exit(failed ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
