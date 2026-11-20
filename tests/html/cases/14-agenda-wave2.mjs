// Agenda, oleada 2, sin framework (zui/html.json): año perpetuo, línea temporal (Gantt y recursos), buscar hueco,
// franjas de cita, mapa de calor y rachas, montados por @zuccadev-labs/zuix-zui/dom con el mismo árbol que el binding
// de React; teclado, eventos z:* y nombres accesibles. También la agenda en RTL, la vista de año y el perpetuo dentro
// del EventCalendar, y renderEvent/loadEvents con setAgendaOptions.

export default async function ({ page, test, ok, settle }) {
  await page.evaluate(() => {
    window.__zwave2 = [];
    for (const name of [
      "highlightchange",
      "taskchange",
      "taskclick",
      "grouptoggle",
      "scalechange",
      "eventchange",
      "select",
      "confirm",
      "datechange",
      "dayclick",
      "viewchange",
      "rangechange",
      "flexibilitychange",
    ])
      document.addEventListener(`z:${name}`, (event) =>
        window.__zwave2.push({ name, detail: JSON.parse(JSON.stringify(event.detail ?? null)) }),
      );
  });
  const events = () => page.evaluate(() => window.__zwave2.splice(0));
  const wait = async (fn, message, timeout = 4000) => {
    const start = Date.now();
    for (;;) {
      if (await fn()) return;
      if (Date.now() - start > timeout) throw new Error(`No se cumplió: ${message}`);
      await page.waitForTimeout(50);
    }
  };
  const focused = (selector) => page.locator(selector).evaluate((el) => el === document.activeElement);

  await test("PerpetualYear: tabla con caption, cruz del día y buscador con respuesta en texto", async () => {
    const root = "#perpetual-2026";
    await page.locator(root).scrollIntoViewIfNeeded();
    await settle();
    ok((await page.locator(`${root} table caption`).textContent()).includes("2026"), "caption con el año");
    ok((await page.locator(`${root} td[data-hit]`).textContent()).trim().length > 0, "cruce resaltado");
    ok((await page.locator(`${root} td[data-hit] abbr`).getAttribute("title")) === "Thursday", "19 nov 2026 → jueves");
    ok((await page.locator(`${root} .z-perpetual__result`).textContent()).includes("Thursday"), "respuesta en texto");
    const describedby = await page.locator(`${root} table`).getAttribute("aria-describedby");
    ok((await page.locator(`#${describedby}`).count()) === 1, "instrucciones enlazadas");
    await page.fill(`${root} .z-perpetual__input`, "2026-02-14");
    await page.locator(`${root} .z-perpetual__input`).dispatchEvent("change");
    await wait(async () => (await page.locator(`${root} .z-perpetual__result`).textContent()).includes("Saturday"), "14 feb → sábado");
    ok(
      (await events()).some((e) => e.name === "highlightchange" && e.detail.date === "2026-02-14"),
      "z:highlightchange",
    );
  });

  await test("TimelineView (Gantt): treegrid, una parada de Tab, plegar, agarrar y mover con teclado", async () => {
    const root = "#plan-gantt";
    await page.locator(root).scrollIntoViewIfNeeded();
    await settle();
    ok((await page.locator(`${root} [role=treegrid]`).count()) === 1, "treegrid");
    ok((await page.locator(`${root} [role=treegrid] [tabindex="0"]`).count()) === 1, "una parada de Tab");
    const bar = `${root} [data-task="tokens"]`;
    const name = await page.locator(bar).textContent();
    ok(name.includes("Tokens v2") && name.includes("80% complete"), `nombre: ${name}`);
    const dep = await page.locator(`${root} [data-task="docs"]`).getAttribute("aria-describedby");
    ok((await page.locator(`#${dep}`).textContent()) === "Depends on Tokens v2", "dependencia en texto");
    ok((await page.locator(`${root} .z-timeline__deps path[d]`).count()) >= 2, "rutas de dependencias");
    await page.locator(bar).focus();
    await page.keyboard.press("ArrowUp");
    ok(await focused(`${root} .z-timeline__toggle[data-group-id="ds"]`), "↑ lleva a la fase");
    await page.keyboard.press("ArrowLeft");
    await wait(
      async () => (await page.locator(`${root} .z-timeline__toggle[data-group-id="ds"]`).getAttribute("aria-expanded")) === "false",
      "plegada",
    );
    ok((await page.locator(bar).count()) === 0, "sus tareas se ocultan");
    await page.keyboard.press("ArrowRight");
    await wait(async () => (await page.locator(bar).count()) === 1, "desplegada");
    ok((await events()).filter((e) => e.name === "grouptoggle").length === 2, "z:grouptoggle ×2");
    await page.locator(`${root} .z-timeline__toggle[data-group-id="ds"]`).focus();
    await page.keyboard.press("ArrowDown");
    ok(await focused(bar), "↓ vuelve a la tarea");
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    await wait(async () => (await page.getAttribute(bar, "aria-pressed")) === "true", "agarrada");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Shift+ArrowRight");
    await page.keyboard.press("Enter");
    const change = (await events()).find((e) => e.name === "taskchange");
    ok(change?.detail.start === "2026-11-18" && change.detail.end === "2026-11-27", `z:taskchange ${JSON.stringify(change?.detail)}`);
    await wait(async () => (await page.locator(`${root} [data-live]`).textContent()).startsWith("Moved Tokens v2"), "anuncio");
    await page.click(`${root} [data-scale-option="week"]`);
    ok((await page.getAttribute(root, "data-scale")) === "week", "zoom semanas");
    ok(
      (await events()).some((e) => e.name === "scalechange" && e.detail.scale === "week"),
      "z:scalechange",
    );
  });

  await test("TimelineView (recursos): grid con conflicto en texto y navegación espacial", async () => {
    const root = "#plan-rooms";
    await page.locator(root).scrollIntoViewIfNeeded();
    await settle();
    ok((await page.locator(`${root} [role=grid] [role=rowheader]`).count()) === 3, "cabecera + dos salas");
    const conflict = `${root} .z-timeline__booking[data-conflict]`;
    ok((await page.locator(conflict).count()) === 2, "dos reservas en conflicto");
    ok((await page.locator(conflict).first().textContent()).includes("Overlaps"), "«Overlaps» en el nombre");
    const first = `${root} .z-timeline__booking[data-key="a@atlas"]`;
    await page.locator(first).focus();
    await page.keyboard.press("ArrowDown");
    await wait(async () => (await page.evaluate(() => document.activeElement?.dataset.key ?? "")).endsWith("@kepler"), "↓ a Kepler");
  });

  await test("FreeBusy: franja común en texto y «Use …» emite z:select", async () => {
    const root = "#find-time";
    await page.locator(root).scrollIntoViewIfNeeded();
    await settle();
    const status = await page.locator(`${root} [role=status]`).textContent();
    ok(status.startsWith("All 2 free"), `estado: ${status}`);
    ok((await page.locator(`${root} .z-freebusy__block`).first().textContent()).includes("Busy"), "ocupado en texto");
    await page.click(`${root} .z-freebusy__next`);
    await page.click(`${root} .z-freebusy__use`);
    const select = (await events()).find((e) => e.name === "select");
    ok(select && /^2026-11-19T\d\d:\d\d$/.test(select.detail.start), `z:select ${JSON.stringify(select?.detail)}`);
  });

  await test("SlotPicker: días con hueco, listbox de horas, 12/24 h y «Next»", async () => {
    const root = "#intro-call";
    await page.locator(root).scrollIntoViewIfNeeded();
    await settle();
    ok((await page.locator(`${root} .z-calendar__day[data-available]`).count()) > 3, "días con hueco realzados");
    const off = await page.locator(`${root} .z-calendar__day[data-date="2026-11-21"]`).getAttribute("aria-label");
    ok(off.includes("no times available"), `sábado: ${off}`);
    ok((await page.locator(`${root} [role=listbox] [role=option]`).count()) > 0, "horas del día");
    const option = page.locator(`${root} [role=option]`).first();
    await option.focus();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await wait(async () => (await page.locator(`${root} [role=option][aria-selected="true"]`).count()) === 1, "elegida");
    ok(
      (await events()).some((e) => e.name === "select"),
      "z:select",
    );
    await page.click(`${root} [data-cycle="h12"]`);
    await wait(async () => /[AP]M/i.test(await page.locator(`${root} [role=option]`).first().textContent()), "12 h");
    await page.click(`${root} .z-slotpicker__next`);
    ok(
      (await events()).some((e) => e.name === "confirm"),
      "z:confirm",
    );
    await page.click(`${root} .z-calendar__day[data-date="2026-11-24"]`);
    await wait(async () => (await page.locator(`${root} .z-slotpicker__day`).textContent()).includes("24"), "otro día");
  });

  await test("CalendarHeatmap: nombre por celda, etiqueta al enfocar, flechas y tabla alternativa", async () => {
    const root = "#commits";
    await page.locator(root).scrollIntoViewIfNeeded();
    await settle();
    const cell = `${root} .z-heatmap__cell[data-date="2026-11-12"]`;
    ok((await page.getAttribute(cell, "aria-label")) === "14 contributions on Thursday 12 November", "nombre de la celda");
    ok((await page.getAttribute(cell, "data-level")) === "4", "nivel máximo");
    await page.locator(cell).focus();
    await wait(async () => (await page.locator(`${root} .z-heatmap__tip`).count()) === 1, "etiqueta visible");
    await page.keyboard.press("ArrowRight");
    ok(await focused(`${root} .z-heatmap__cell[data-date="2026-11-19"]`), "→ una semana");
    await page.keyboard.press("ArrowUp");
    ok(await focused(`${root} .z-heatmap__cell[data-date="2026-11-18"]`), "↑ un día");
    await page.click(`${root} .z-heatmap__toggle`);
    ok((await page.locator(`${root} table caption`).count()) === 1, "tabla alternativa");
    ok((await page.getAttribute(`${root} .z-heatmap__table-wrap`, "tabindex")) === "0", "región desplazable enfocable");
    await page.click(`${root} .z-heatmap__toggle`);
  });

  await test("HabitCalendar: estados en el nombre, banda de la racha y teclado por días", async () => {
    const root = "#reading-habit";
    await page.locator(root).scrollIntoViewIfNeeded();
    await settle();
    ok((await page.getAttribute(`${root} .z-habit__day[data-date="2026-11-14"]`, "aria-label")).endsWith("Missed"), "fallado en el nombre");
    ok((await page.getAttribute(`${root} .z-habit__day[data-date="2026-11-19"]`, "aria-label")).endsWith("Today 60%"), "hoy en curso");
    ok((await page.locator(`${root} .z-habit__cell[data-band]`).count()) === 3, "banda de 16 a 18");
    ok((await page.locator(`${root} .z-habit__count`).textContent()) === "3 days", "racha");
    await page.locator(`${root} .z-habit__day[data-date="2026-11-19"]`).focus();
    await page.keyboard.press("PageDown");
    ok(await focused(`${root} .z-habit__day[data-date="2026-12-19"]`), "RePág: mes siguiente");
  });

  await test("EventCalendar sin framework: año y perpetuo, renderEvent y loadEvents con setAgendaOptions", async () => {
    const root = "#team-agenda";
    await page.locator(root).scrollIntoViewIfNeeded();
    await page.evaluate(async (sel) => {
      const el = document.querySelector(sel);
      el.dataset.views = "day,week,month,agenda,year,perpetual,timeline";
      const dom = await import("/zui/dist/zui.dom.js");
      dom.setAgendaView(el, { view: "year" });
    }, root);
    await wait(async () => (await page.locator(`${root} .z-yeargrid`).count()) === 1, "vista de año");
    ok((await page.locator(`${root} .z-yeargrid__table[role=grid]`).count()) === 12, "12 rejillas");
    const day = `${root} .z-yeargrid__day[data-date="2026-11-19"]`;
    ok((await page.getAttribute(day, "aria-label")).includes("event"), "densidad en el nombre");
    await page.locator(day).focus();
    await page.keyboard.press("Enter");
    await wait(async () => (await page.getAttribute(root, "data-view")) === "day", "Intro abre el día");
    await page.click(`${root} .z-agenda__views [data-view="perpetual"]`);
    await wait(async () => (await page.locator(`${root} .z-perpetual__table`).count()) === 1, "perpetuo");
    await page.click(`${root} .z-agenda__views [data-view="week"]`);
    await events();
    // renderEvent y loadEvents.
    await page.evaluate(async (sel) => {
      const el = document.querySelector(sel);
      const dom = await import("/zui/dist/zui.dom.js");
      dom.setAgendaOptions(el, {
        renderEvent: (d) => `★ ${d.event.title}`,
        loadEvents: async ({ from }) => [
          { id: "loaded", title: "Loaded", start: `${from}T12:00`, end: `${from}T13:00`, timeZone: "Europe/Madrid", calendarId: "work" },
        ],
      });
    }, root);
    await wait(async () => (await page.locator(`${root} .z-event[data-key="loaded"]`).count()) === 1, "evento cargado");
    ok((await page.locator(`${root} .z-event[data-key="a"] .z-event__custom`).textContent()) === "★ Design review", "contenido propio");
    ok((await page.locator(`${root} .z-event[data-key="a"]`).textContent()).includes("Thursday 19 November"), "nombre completo");
    ok(
      (await events()).some((e) => e.name === "rangechange"),
      "z:rangechange",
    );
    await page.evaluate(async (sel) => {
      const el = document.querySelector(sel);
      (await import("/zui/dist/zui.dom.js")).setAgendaOptions(el, { renderEvent: undefined, loadEvents: undefined });
    }, root);
  });

  await test("Calendar de estancia sin framework: noches, solo salida y ajuste ±1", async () => {
    await page.evaluate(async () => {
      const stage = document.createElement("div");
      stage.id = "stay-stage";
      stage.innerHTML =
        '<div class="z-calendar" id="stay-cal" data-mode="range" data-range-unit="nights" data-min-range="2" data-months="2" data-month="2026-11" data-today="2026-11-19" data-locale="en-GB" data-week-start="1" data-unavailable-dates="2026-11-20,2026-11-21,2026-11-22" data-checkout-only-dates="2026-12-04" data-length-stepper data-flexibility="1" data-value="2026-11-24/2026-11-29"></div>';
      document.querySelector("[data-z-dom]").append(stage);
      (await import("/zui/dist/zui.dom.js")).hydrate(stage);
    });
    const cal = "#stay-cal";
    await page.locator(cal).scrollIntoViewIfNeeded();
    ok((await page.locator(`${cal} .z-calendar__length`).textContent()) === "5 nights", "5 noches");
    ok(
      (await page.getAttribute(`${cal} .z-calendar__day[data-date="2026-12-04"]`, "aria-label")).includes("check-out only"),
      "solo salida",
    );
    ok((await page.getAttribute(`${cal} .z-calendar__day[data-date="2026-12-04"]`, "aria-disabled")) === "true", "no empieza un rango");
    await page.click(`${cal} .z-calendar__stepper-btn[data-step="1"]`);
    await wait(async () => (await page.locator(`${cal} .z-calendar__length`).textContent()) === "6 nights", "+1 noche");
    await page.click(`${cal} .z-calendar__flex-chip[data-flexibility-option="3"]`);
    ok(
      (await events()).some((e) => e.name === "flexibilitychange" && e.detail.flexibility === 3),
      "z:flexibilitychange",
    );
    await page.click(`${cal} .z-calendar__day[data-date="2026-11-24"]`);
    const below = await page.getAttribute(`${cal} .z-calendar__day[data-date="2026-11-25"]`, "aria-label");
    ok(
      below.includes("2-night minimum") &&
        (await page.getAttribute(`${cal} .z-calendar__day[data-date="2026-11-25"]`, "aria-disabled")) === "true",
      `mínimo: ${below}`,
    );
    await page.evaluate(() => document.getElementById("stay-stage")?.remove());
  });

  await test("Agenda en RTL: las flechas se invierten y la rejilla sigue al orden de lectura", async () => {
    const root = "#team-agenda";
    await page.evaluate((sel) => {
      document.querySelector(sel).setAttribute("dir", "rtl");
    }, root);
    await page.click(`${root} .z-agenda__views [data-view="month"]`);
    await wait(async () => (await page.locator(`${root} .z-monthgrid`).count()) === 1, "mes");
    await page.locator(`${root} .z-monthgrid__cell[data-date="2026-11-19"]`).focus();
    await page.keyboard.press("ArrowLeft");
    ok(await focused(`${root} .z-monthgrid__cell[data-date="2026-11-20"]`), "← en RTL avanza un día");
    const a = await page.locator(`${root} .z-monthgrid__cell[data-date="2026-11-19"]`).boundingBox();
    const b = await page.locator(`${root} .z-monthgrid__cell[data-date="2026-11-20"]`).boundingBox();
    ok(b.x < a.x, "el día siguiente queda a la izquierda");
    await page.evaluate((sel) => document.querySelector(sel).removeAttribute("dir"), root);
    await page.click(`${root} .z-agenda__views [data-view="week"]`);
    await events();
  });
}
