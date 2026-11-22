// Binding de React (pantallas `?screen=time` y `?screen=terminal` de examples/app): relojes, cuenta atrás, duración y
// zona; terminal, consola de logs, visor de código y diff. Exporta una función que recibe los ayudantes de cases.mjs.
export default function ({ t, assert, poll }) {
  const text = (page, id) => page.locator(t(id)).first().textContent();

  return [
    {
      name: "Relojes (React): avanzan solos, <time> con desfase, esfera con nombre por minuto y ciudades como frases",
      async run({ open }) {
        const page = await open("time");
        const clock = page.locator(`${t("t-clock")} .z-clock__time`);
        const first = await clock.textContent();
        await poll(async () => (await clock.textContent()) !== first, "el reloj avanza");
        assert(
          (await page.locator(`${t("t-clock-fixed")} .z-clock__time`).getAttribute("datetime")) === "2026-11-21T18:42+09:00",
          "instante fijo en Tokio",
        );
        assert((await page.locator(`${t("t-clock")} [aria-live], ${t("t-clock")} [role=status]`).count()) === 0, "sin región viva");
        const name = await page.locator(`${t("t-analog")} [role=img]`).getAttribute("aria-label");
        assert(/^\d\d:\d\d.*, Madrid$/.test(name ?? ""), `nombre de la esfera: ${name}`);
        const sentence = await page
          .locator(`${t("t-world")} .z-world-clock__city .z-sr-only`)
          .nth(4)
          .textContent();
        assert(/^Tokyo, .+, 8 hours ahead/.test(sentence ?? ""), `frase: ${sentence}`);
      },
    },
    {
      name: "WorldClock (React): quitar una ciudad avisa con onRemove y deja el foco en la siguiente",
      async run({ open }) {
        const page = await open("time");
        const remove = page.locator(`${t("t-world")} .z-world-clock__remove`).nth(1);
        await remove.scrollIntoViewIfNeeded();
        assert((await remove.getAttribute("aria-label")) === "Remove New York", "el botón dice qué ciudad quita");
        await remove.focus();
        await page.keyboard.press("Enter");
        await poll(async () => (await text(page, "t-world-removed")) === "Removed America/New_York", "onRemove");
        await poll(async () => (await page.locator(`${t("t-world")} .z-world-clock__city`).count()) === 5, "quedan cinco");
        await poll(
          () => page.evaluate(() => document.activeElement?.getAttribute("aria-label") === "Remove Madrid"),
          "el foco pasa a la ciudad siguiente",
        );
      },
    },
    {
      name: "Countdown (React): role=timer con nombre, cifras que giran y onComplete una sola vez",
      async run({ open }) {
        const page = await open("time");
        const timer = page.locator(`${t("t-countdown")} [role=timer]`);
        assert(
          /^Launch countdown: 3 days, 5 hours, 4\d minutes$/.test((await timer.getAttribute("aria-label")) ?? ""),
          "nombre del temporizador",
        );
        await page.locator(t("t-soon-start")).scrollIntoViewIfNeeded();
        await page.click(t("t-soon-start"));
        await poll(async () => (await page.locator(`${t("t-soon")} .z-countdown__digit`).count()) === 4, "cuatro cifras");
        await poll(async () => (await page.locator(`${t("t-soon")} .z-countdown`).getAttribute("data-state")) === "done", "termina", 6000);
        await poll(async () => (await text(page, "t-soon-done")) === "1 completed", "onComplete");
        await poll(async () => (await page.locator(`${t("t-soon")} .z-countdown__live`).textContent()) === "Lift-off", "anuncia el final");
        await page.waitForTimeout(1200);
        assert((await text(page, "t-soon-done")) === "1 completed", "solo una vez");
      },
    },
    {
      name: "DurationField (React): controlado, flechas, cifras, preajustes y FormatDuration",
      async run({ open }) {
        const page = await open("time");
        const minutes = page.locator(`${t("t-duration")} [role=spinbutton][data-unit="minutes"]`);
        await minutes.scrollIntoViewIfNeeded();
        await minutes.focus();
        await page.keyboard.press("ArrowUp");
        await poll(async () => (await text(page, "t-duration-value")).startsWith("PT50M"), "↑ suma el paso");
        await page.keyboard.press("ArrowLeft");
        await page.keyboard.type("2");
        await poll(async () => (await text(page, "t-duration-value")).startsWith("PT2H50M"), "teclear horas");
        assert(/2 hours, 50 minutes/.test(await text(page, "t-duration-value")), "FormatDuration largo");
        await page.locator(`${t("t-duration")} .z-duration-field__preset`, { hasText: "1 hr" }).click();
        await poll(async () => (await text(page, "t-duration-value")).startsWith("PT1H ·"), "preajuste");
        assert((await page.locator(`${t("t-duration")} input[name="length"]`).inputValue()) === "PT1H", "campo del formulario");
      },
    },
    {
      name: "TimeZoneSelect (React): busca por desfase y elige",
      async run({ open }) {
        const page = await open("time");
        const input = page.locator(`${t("t-zone")} input[role=combobox]`);
        await input.scrollIntoViewIfNeeded();
        await input.fill("tokyo");
        const option = page.locator(".z-listbox__option", { hasText: "Tokyo" }).first();
        await poll(() => option.isVisible(), "aparece Tokyo");
        assert(/Tokyo · GMT\+9 · \d\d:\d\d/.test((await option.textContent()) ?? ""), "ciudad, desfase y hora");
        await option.click();
        await poll(async () => (await text(page, "t-zone-value")) === "Asia/Tokyo", "onValueChange");
      },
    },
    {
      name: "Terminal (React): orden con salida en streaming, historial, Tab, Ctrl+C, ref.write y copiar",
      async run({ open }) {
        const page = await open("terminal");
        await page
          .context()
          .grantPermissions(["clipboard-read", "clipboard-write"])
          .catch(() => {});
        const term = t("x-terminal");
        const field = page.locator(`${term} .z-terminal__field`);
        await field.fill("he");
        await page.keyboard.press("Tab");
        await poll(async () => (await field.inputValue()) === "help", "Tab completa");
        await page.keyboard.press("Enter");
        await poll(
          async () =>
            (await page.locator(`${term} .z-terminal__line`).last().textContent()) ===
            "commands: help, build, clear, deploy, describe, colors",
          "salida",
        );
        await poll(async () => (await page.locator(`${term} .z-terminal__live`).textContent()) === "Command finished", "anuncia el final");
        await field.fill("colors");
        await page.keyboard.press("Enter");
        await poll(async () => (await page.locator(`${term} .z-ansi[data-fg="rgb"]`).count()) === 3, "256 colores");
        await field.fill("build");
        await page.keyboard.press("Enter");
        await poll(
          async () => (await page.locator(`${term} .z-terminal__line`).last().textContent())?.startsWith("✓ built"),
          "la barra de progreso se reescribe y termina",
        );
        assert((await page.locator(`${term} .z-terminal__line`, { hasText: "building" }).count()) === 1, "una sola línea para la barra");
        await field.fill("build");
        await page.keyboard.press("Enter");
        await poll(async () => (await page.locator(term).locator(".z-terminal").getAttribute("data-busy")) === "", "ocupada");
        await page.keyboard.press("Control+c");
        await poll(async () => (await text(page, "x-interrupts")) === "1 interrupts", "onInterrupt");
        await page.keyboard.press("ArrowUp");
        assert((await field.inputValue()) === "build", "↑ trae la última");
        await page.click(t("x-write"));
        await poll(
          async () => (await page.locator(`${term} .z-terminal__line`).last().textContent()) === "hello from the app",
          "ref.writeln",
        );
        await page.click(`${term} .z-terminal__copy`);
        await poll(async () => (await page.locator(`${term} .z-terminal__copy`).getAttribute("data-copied")) === "", "copiado");
        const clip = await page.evaluate(() => navigator.clipboard.readText()).catch(() => null);
        if (clip !== null) assert(clip.includes("zuix shell") && clip.includes("hello from the app"), "texto plano de la salida");
      },
    },
    {
      name: "LogConsole (React): 2400 entradas por ventana, filtros, búsqueda, seguir el final y añadir",
      async run({ open }) {
        const page = await open("terminal");
        const logs = t("x-logs");
        await page.locator(logs).scrollIntoViewIfNeeded();
        assert((await page.locator(`${logs} [role=grid]`).getAttribute("aria-rowcount")) === "2401", "aria-rowcount");
        const rows = await page.locator(`${logs} .z-log-console__body [role=row]`).count();
        assert(rows < 60, `solo la ventana: ${rows}`);
        await poll(
          () => page.locator(`${logs} .z-log-console__viewport`).evaluate((el) => el.scrollTop + el.clientHeight >= el.scrollHeight - 2),
          "sigue el final",
        );
        await page.locator(`${logs} .z-log-console__level[data-level="info"]`).click();
        await page.locator(`${logs} .z-log-console__level[data-level="debug"]`).click();
        await page.locator(`${logs} .z-log-console__search`).fill("export-11");
        await poll(async () => (await page.locator(`${logs} mark`).count()) >= 1, "coincidencia marcada");
        await poll(
          async () => (await page.locator(`${logs} .z-log-console__live`).textContent())?.endsWith("matches"),
          "anuncia el número",
        );
        await page.locator(`${logs} .z-log-console__search`).fill("");
        await page.locator(`${logs} .z-log-console__viewport`).evaluate((el) => {
          el.scrollTop = 0;
        });
        await poll(
          async () => (await page.locator(`${logs} .z-log-console__follow`).getAttribute("aria-pressed")) === "false",
          "subir deja de seguir",
        );
        const count = Number(await page.locator(`${logs} [role=grid]`).getAttribute("aria-rowcount"));
        await page.click(t("x-logs-add"));
        await poll(
          async () => Number(await page.locator(`${logs} [role=grid]`).getAttribute("aria-rowcount")) === count + 1,
          "entrada añadida (un aviso)",
        );
      },
    },
    {
      name: "CodeViewer y DiffViewer (React): pestañas con flechas, números fuera de la copia, vista lado a lado y hueco plegado",
      async run({ open }) {
        const page = await open("terminal");
        const code = t("x-code");
        await page.locator(code).scrollIntoViewIfNeeded();
        assert((await page.locator(`${code} [data-highlighted]`).count()) === 4, "cuatro líneas resaltadas");
        await page.locator(`${code} [role=tab]`).first().focus();
        await page.keyboard.press("ArrowRight");
        await poll(
          async () => (await page.locator(`${code} [role=tab][aria-selected="true"]`).textContent()) === "styles.css",
          "→ cambia de archivo",
        );
        const selectable = await page
          .locator(`${code} .z-code-viewer__number`)
          .first()
          .evaluate((el) => getComputedStyle(el).userSelect);
        assert(selectable === "none", "los números no se seleccionan");
        const diff = t("x-diff");
        assert((await page.locator(`${diff} .z-diff__word`).count()) === 3, "palabras cambiadas");
        await page.locator(`${diff} .z-diff__mode[data-mode="split"]`).click();
        await poll(async () => (await page.locator(`${diff} table[data-mode="split"]`).count()) === 1, "lado a lado");
      },
    },
  ];
}
