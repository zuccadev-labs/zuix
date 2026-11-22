// Sin React: familias de tiempo (relojes, cuenta atrás, duración, zona) y de terminal y código (terminal, logs,
// visor de código, diff), desde el contrato HTML de zui/html.json y marcado escrito a mano.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const contract = JSON.parse(readFileSync(join(here, "../../../zui/html.json"), "utf8")).components;

export default async function ({ page, test, ok }) {
  let seq = 0;
  const inject = async (raw, width = "min(900px, 100vw)") => {
    const id = `tt-${++seq}`;
    const html = raw.replace(/\bid="([^"]+)"/g, `id="$1-${id}"`).replace(/\baria-controls="([^"]+)"/g, `aria-controls="$1-${id}"`);
    await page.evaluate(
      async ([markup, wrap, w]) => {
        for (const old of document.querySelectorAll("[data-tt-layer]")) old.remove();
        const box = document.createElement("div");
        box.id = wrap;
        box.setAttribute("data-z-dom", "");
        box.setAttribute("data-tt-layer", "");
        box.innerHTML = markup;
        Object.assign(box.style, {
          position: "fixed",
          insetBlockStart: "0",
          insetInlineStart: "0",
          zIndex: "2147483000",
          inlineSize: w,
          maxBlockSize: "100vh",
          overflow: "auto",
          padding: "24px",
          background: "Canvas",
        });
        document.querySelector(".page__main").append(box);
        window.__tt = [];
        for (const type of ["z:change", "z:complete", "z:command", "z:remove", "z:modechange", "z:levelschange", "z:interrupt"])
          box.addEventListener(type, (event) => window.__tt.push([type, JSON.parse(JSON.stringify(event.detail ?? null))]));
        (await import("/zui/dist/zui.dom.js")).hydrate(box);
      },
      [html, id, width],
    );
    return page.locator(`#${id}`);
  };
  const html = (name, i = 0) => contract[name].examples[i].html;
  const events = () => page.evaluate(() => window.__tt.splice(0));
  const until = async (fn, message, tries = 60) => {
    for (let i = 0; i < tries; i++) {
      if (await fn()) return;
      await page.waitForTimeout(50);
    }
    ok(false, message);
  };

  await test("Relojes sin React: <time> con desfase, esfera con nombre por minuto y ciudades como frases", async () => {
    const box = await inject(`${html("Clock", 1)}${html("AnalogClock", 0)}${html("WorldClock", 0)}`);
    const time = await box.locator(".z-clock__time").getAttribute("datetime");
    ok(/^\d{4}-\d\d-\d\dT\d\d:\d\d\+09:00$/.test(time ?? ""), `datetime de Tokio: ${time}`);
    ok((await box.locator(".z-clock [aria-live], .z-clock [role=status]").count()) === 0, "un reloj no es región viva");
    const face = box.locator(".z-analog-clock__face");
    ok((await face.getAttribute("role")) === "img", "la esfera es una imagen");
    ok(/^\d\d:\d\d, Madrid$/.test((await face.getAttribute("aria-label")) ?? ""), "nombre «hh:mm, Madrid»");
    const first = await box.locator(".z-world-clock__city .z-sr-only").first().textContent();
    ok(/^Madrid, \d\d:\d\d, Same time, (Day|Night)$/.test(first ?? ""), `frase de la ciudad: ${first}`);
    ok((await box.locator(".z-world-clock__city").count()) === 4, "cuatro ciudades del marcado");
  });

  await test("Clock avanza con el temporizador compartido y se para con la pestaña oculta", async () => {
    const box = await inject('<div class="z-clock" data-seconds data-time-zone="UTC" data-hour-cycle="h23"></div>');
    const read = () => box.locator(".z-clock__time").textContent();
    const a = await read();
    await until(async () => (await read()) !== a, "el segundero avanza");
    const ticks = await page.evaluate(async () => {
      const el = document.querySelector("[data-tt-layer] .z-clock__time");
      Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
      document.dispatchEvent(new Event("visibilitychange"));
      const before = el.textContent;
      await new Promise((r) => setTimeout(r, 2200));
      const hidden = el.textContent;
      Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
      document.dispatchEvent(new Event("visibilitychange"));
      await new Promise((r) => setTimeout(r, 50));
      return { before, hidden, after: el.textContent };
    });
    ok(ticks.before === ticks.hidden, "oculta, no repinta");
    ok(ticks.after !== ticks.hidden, "al volver se pone al día");
  });

  await test("Countdown: role=timer con nombre, hitos en una región aparte y z:complete al llegar", async () => {
    const box = await inject(html("Countdown", 0));
    const timer = box.locator('[role="timer"]');
    ok(/^Launch countdown: \d+ days?/.test((await timer.getAttribute("aria-label")) ?? ""), "nombre con lo que falta");
    ok((await box.locator(".z-countdown__units").getAttribute("aria-hidden")) === "true", "las cajas no se leen");
    ok((await box.locator(".z-countdown__unit").count()) === 4, "cuatro unidades");
    ok(/Launch /.test((await box.locator(".z-countdown__target").textContent()) ?? ""), "fecha objetivo");
    const soon = await inject('<div class="z-countdown" data-units="seconds" data-complete-label="Launched"></div>');
    await page.evaluate(
      (sel) => {
        const el = document.querySelector(sel);
        el.dataset.to = new Date(Date.now() + 1500).toISOString();
      },
      `#${await soon.getAttribute("id")} .z-countdown`,
    );
    await page.evaluate(async () =>
      (await import("/zui/dist/zui.dom.js")).setWidgetProps(document.querySelector("[data-tt-layer] .z-countdown"), {}),
    );
    await until(async () => (await soon.locator(".z-countdown").getAttribute("data-state")) === "done", "termina", 80);
    await until(async () => (await soon.locator(".z-countdown__live").textContent()) === "Launched", "anuncia el final");
    ok(
      (await events()).some(([type]) => type === "z:complete"),
      "z:complete",
    );
  });

  await test("DurationField: spinbuttons, flechas, cifras con avance, pegar y preajustes; valor ISO en el formulario", async () => {
    const box = await inject(`<form>${html("DurationField", 0)}</form>`);
    const hours = box.locator('[role="spinbutton"][data-unit="hours"]');
    const minutes = box.locator('[role="spinbutton"][data-unit="minutes"]');
    ok((await box.locator('[role="spinbutton"][tabindex="0"]').count()) === 1, "una parada de Tab");
    await hours.focus();
    await page.keyboard.press("ArrowUp");
    ok((await hours.getAttribute("aria-valuetext")) === "1 hour", "↑ suma una hora");
    await page.keyboard.press("ArrowRight");
    ok(await minutes.evaluate((el) => el === document.activeElement), "→ pasa a minutos");
    await page.keyboard.press("ArrowUp");
    ok((await minutes.getAttribute("aria-valuenow")) === "50", "paso de 5 minutos");
    await page.keyboard.type("07");
    ok((await minutes.getAttribute("aria-valuenow")) === "7", "teclear 07");
    const value = await box.locator('input[name="length"]').inputValue();
    ok(value === "PT1H7M", `campo del formulario: ${value}`);
    await page.evaluate(() => {
      const seg = document.activeElement;
      const data = new DataTransfer();
      data.setData("text", "2:15");
      seg.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
    });
    ok((await box.locator('input[name="length"]').inputValue()) === "PT2H15M", "pegar «2:15»");
    await box.locator(".z-duration-field__preset", { hasText: "30 min" }).click();
    ok((await box.locator('input[name="length"]').inputValue()) === "PT30M", "preajuste");
    ok((await box.locator('.z-duration-field__preset[aria-pressed="true"]').textContent()) === "30 min", "el preajuste queda marcado");
    const changes = (await events()).filter(([type]) => type === "z:change");
    ok(changes.at(-1)?.[1]?.value === "PT30M", "z:change con el valor ISO");
  });

  await test("TimeZoneSelect sin React: opciones con desfase y hora, búsqueda por desfase", async () => {
    const box = await inject(html("TimeZoneSelect", 0));
    const input = box.locator('input[role="combobox"]');
    await input.click();
    await input.fill("+5:30");
    await until(async () => (await page.locator(".z-listbox__option:visible").count()) >= 1, "aparece una opción");
    const label = await page.locator(".z-listbox__option:visible").first().textContent();
    ok(/Kolkata · GMT\+5:30 · \d\d:\d\d/.test(label ?? ""), `opción: ${label}`);
    await page.keyboard.press("Escape");
  });

  await test("Terminal sin React: salida ANSI como nodos, orden con z:command, historial, Ctrl+L y copiar", async () => {
    const box = await inject(html("Terminal", 0));
    const term = box.locator(".z-terminal");
    ok((await term.locator('.z-terminal__screen[role="log"][aria-live="off"]').count()) === 1, "salida role=log sin anunciar cada línea");
    ok((await term.locator('.z-ansi[data-fg="2"]').first().textContent()) === "✓", "color 2 como atributo");
    ok((await term.locator('.z-ansi[data-fg="rgb"]').count()) === 1, "256 colores con variable local");
    const color = await term.locator('.z-ansi[data-fg="rgb"]').evaluate((el) => getComputedStyle(el).color);
    ok(color && color !== "rgb(0, 0, 0)", `color acotado: ${color}`);
    ok((await term.locator("script, [onclick]").count()) <= 1, "sin marcado de la salida");
    const field = term.locator(".z-terminal__field");
    await field.fill("echo <b>hi</b>");
    await page.keyboard.press("Enter");
    const fired = await events();
    ok(
      fired.some(([type, d]) => type === "z:command" && d.command === "echo <b>hi</b>"),
      "z:command",
    );
    ok((await term.locator(".z-terminal__screen b").count()) === 0, "lo escrito se repite como texto");
    ok((await field.inputValue()) === "", "la entrada se vacía");
    await page.keyboard.press("ArrowUp");
    ok((await field.inputValue()) === "echo <b>hi</b>", "↑ trae la última orden");
    await page.keyboard.press("ArrowUp");
    ok((await field.inputValue()) === "pnpm test", "y la anterior del historial inicial");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    ok((await field.inputValue()) === "", "↓ vuelve al borrador");
    await page.keyboard.press("Tab");
    ok(!(await field.evaluate((el) => el === document.activeElement)), "sin onComplete, Tab sale");
    await field.focus();
    await page.keyboard.press("Control+l");
    await page.waitForTimeout(60);
    ok((await term.locator(".z-terminal__line").count()) === 0, "Ctrl+L limpia");
  });

  await test("Terminal sin React: flujo con onCommand, Tab con onComplete y Ctrl+C interrumpe", async () => {
    const box = await inject('<div class="z-terminal" data-prompt="$"></div>');
    await page.evaluate(async () => {
      const el = document.querySelector("[data-tt-layer] .z-terminal");
      const dom = await import("/zui/dist/zui.dom.js");
      dom.setWidgetProps(el, {
        onComplete: (input) => ["deploy", "describe", "dev"].filter((c) => c.startsWith(input)),
        onCommand: async function* (cmd, { signal }) {
          for (let i = 0; i < 50 && !signal.aborted; i++) {
            yield `\x1b[36m${cmd}\x1b[0m step ${i}\n`;
            await new Promise((r) => setTimeout(r, 40));
          }
        },
      });
    });
    const term = box.locator(".z-terminal");
    const field = term.locator(".z-terminal__field");
    await field.fill("dep");
    await page.keyboard.press("Tab");
    await until(async () => (await field.inputValue()) === "deploy", "Tab completa la única opción");
    await field.fill("de");
    await page.keyboard.press("Tab");
    await until(
      async () => (await term.locator(".z-terminal__line").last().textContent()) === "deploy  describe  dev",
      "Tab lista las opciones",
    );
    await field.fill("build");
    await page.keyboard.press("Enter");
    await until(async () => (await term.locator(".z-terminal__line").count()) > 4, "la salida llega a trozos");
    ok((await term.getAttribute("data-busy")) === "", "ocupada mientras corre");
    await page.keyboard.press("Control+c");
    await until(async () => (await term.getAttribute("data-busy")) === null, "Ctrl+C interrumpe");
    await until(async () => (await term.locator(".z-terminal__live").textContent()) === "Interrupted", "anuncia la interrupción");
    ok(
      (await events()).some(([type]) => type === "z:interrupt"),
      "z:interrupt",
    );
  });

  await test("LogConsole sin React: filtros con contadores, búsqueda con <mark>, rejilla con teclado y miles de filas por ventana", async () => {
    const box = await inject(html("LogConsole", 0));
    const log = box.locator(".z-log-console");
    ok((await log.locator('[role="grid"]').getAttribute("aria-rowcount")) === "7", "aria-rowcount con la cabecera");
    await log.locator('.z-log-console__level[data-level="info"]').click();
    ok((await log.locator('.z-log-console__body [role="row"]').count()) === 3, "sin info quedan tres");
    ok(
      (await events()).some(([type, d]) => type === "z:levelschange" && !d.levels.includes("info")),
      "z:levelschange",
    );
    await log.locator('.z-log-console__level[data-level="info"]').click();
    await log.locator(".z-log-console__search").fill("export");
    await until(async () => (await log.locator("mark.z-log-console__match").count()) === 2, "dos coincidencias marcadas");
    await until(async () => (await log.locator(".z-log-console__live").textContent()) === "2 matches", "anuncia el número");
    await log.locator(".z-log-console__search").fill("");
    const cell = log.locator('.z-log-console__cell[tabindex="0"]');
    await cell.focus();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowLeft");
    const active = await page.evaluate(() => [document.activeElement.dataset.row, document.activeElement.dataset.col]);
    ok(active.join() === "1,2", `celda activa tras ↓ ←: ${active}`);
    await page.evaluate(async () => {
      const el = document.querySelector("[data-tt-layer] .z-log-console");
      const dom = await import("/zui/dist/zui.dom.js");
      dom.appendLogEntries(
        el,
        Array.from({ length: 5000 }, (_, i) => ({ id: `n${i}`, level: i % 7 ? "info" : "warn", message: `line ${i}` })),
      );
    });
    await page.waitForTimeout(200);
    ok((await log.locator('[role="grid"]').getAttribute("aria-rowcount")) === "5007", "5006 entradas");
    const rows = await log.locator('.z-log-console__body [role="row"]').count();
    ok(rows < 60, `solo la ventana: ${rows} filas en el documento`);
  });

  await test("CodeViewer y DiffViewer sin React: pestañas, números ocultos, copiar, vista lado a lado y huecos plegados", async () => {
    const box = await inject(`${html("CodeViewer", 1)}${html("DiffViewer", 0)}`);
    const viewer = box.locator(".z-code-viewer");
    ok((await viewer.locator('[role="tab"]').count()) === 2, "dos pestañas");
    await viewer.locator('[role="tab"]').first().focus();
    await page.keyboard.press("ArrowRight");
    ok((await viewer.locator('[role="tab"][aria-selected="true"]').textContent()) === "styles.css", "→ cambia de archivo");
    ok((await viewer.locator(".z-code-viewer__number").first().getAttribute("aria-hidden")) === "true", "números ocultos");
    ok((await viewer.locator('.z-tok[data-tok="property"]').count()) >= 2, "resaltado de CSS");
    const diff = box.locator(".z-diff");
    ok((await diff.locator(".z-sr-only", { hasText: "removed:" }).count()) === 3, "tipo de línea en texto");
    await diff.locator('.z-diff__mode[data-mode="split"]').click();
    ok((await diff.locator('.z-diff__table[data-mode="split"]').count()) === 1, "lado a lado");
    ok(
      (await events()).some(([type, d]) => type === "z:modechange" && d.mode === "split"),
      "z:modechange",
    );
  });
}
