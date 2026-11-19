// Agenda (EventCalendar), Timer y el cierre de la familia de fecha sin framework, sobre el marcado de zui/html.json:
// la agenda se pinta con el mismo árbol que el binding de React; teclado, agarrar–mover–soltar, arrastre con
// puntero, «Move to…» y eventos z:*; el Timer con pausa y anuncios; WeekPicker de rango y número de semana pulsable.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const contract = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../../../zui/html.json"), "utf8")).components;

export default async function ({ page, test, ok, settle }) {
  const inject = (name, title) =>
    page.evaluate(
      async ([component, html]) => {
        const stage = document.querySelector(`[data-component="${component}"] .demo__stage`);
        stage.insertAdjacentHTML("beforeend", html);
        (await import("/zui/dist/zui.dom.js")).hydrate(stage);
      },
      [name, contract[name].examples.find((e) => e.title === title).html],
    );
  await page.evaluate(() => {
    window.__zagenda = [];
    for (const name of ["eventchange", "eventclick", "selectslot", "datechange", "viewchange", "statechange", "complete", "week"])
      document.addEventListener(`z:${name}`, (event) =>
        window.__zagenda.push({ name, detail: JSON.parse(JSON.stringify(event.detail ?? null)) }),
      );
  });
  const events = () => page.evaluate(() => window.__zagenda.splice(0));
  const wait = async (fn, message, timeout = 4000) => {
    const start = Date.now();
    for (;;) {
      if (await fn()) return;
      if (Date.now() - start > timeout) throw new Error(`No se cumplió: ${message}`);
      await page.waitForTimeout(50);
    }
  };
  const root = "#team-agenda";

  await test("EventCalendar: se pinta desde los datos, una parada de Tab y vistas", async () => {
    await page.locator(root).scrollIntoViewIfNeeded();
    await settle();
    ok((await page.locator(`${root} .z-timegrid[role=grid]`).count()) === 1, "rejilla de horas");
    ok((await page.locator(`${root} .z-timegrid__dayhead`).count()) === 7, "siete días");
    ok((await page.locator(`${root} .z-agenda__view [tabindex="0"]`).count()) === 1, "una sola parada de Tab");
    const label = await page.getAttribute(`${root} .z-event[data-key="a"]`, "aria-label");
    ok(label?.startsWith("Design review, Thursday 19 November") && label.includes("Work"), `nombre: ${label}`);
    ok((await page.locator(`${root} .z-agenda__minical .z-calendar__grid`).count()) === 1, "minicalendario del modo DOM");
    await page.click(`${root} .z-agenda__views [data-view="month"]`);
    ok((await page.locator(`${root} .z-monthgrid[role=grid]`).count()) === 1, "mes");
    const fired = await events();
    ok(
      fired.some((e) => e.name === "viewchange" && e.detail.view === "month"),
      "z:viewchange",
    );
    await page.click(`${root} .z-agenda__views [data-view="week"]`);
    await events();
  });

  await test("EventCalendar: agarrar con teclado, mover y soltar emite z:eventchange", async () => {
    const ev = `${root} .z-agenda__view .z-event[data-key="a"]`;
    await page.locator(ev).focus();
    await page.keyboard.press("Enter");
    await wait(() => page.locator(`${root} .z-agenda__detail`).evaluate((el) => el.matches(":popover-open")), "detalle abierto");
    await page.keyboard.press("Escape");
    await page.locator(ev).focus();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Escape");
    await page.locator(ev).focus();
    await page.keyboard.press("Enter");
    ok((await page.getAttribute(ev, "aria-pressed")) === "true", "agarrado");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowRight");
    ok(await page.locator(ev).evaluate((el) => el === document.activeElement), "el foco sigue al evento");
    await page.keyboard.press("Enter");
    const change = (await events()).find((e) => e.name === "eventchange");
    ok(
      change?.detail.start === "2026-11-20T10:15" && change.detail.end === "2026-11-20T11:15",
      `cambio: ${JSON.stringify(change?.detail)}`,
    );
    await wait(async () => (await page.locator(`${root} .z-agenda__live`).textContent()).startsWith("Moved Design review"), "anuncio");
  });

  await test("EventCalendar: arrastre con puntero y «Move to…»", async () => {
    // La aplicación aplica el cambio: datos nuevos con setAgendaEvents.
    const ev = `${root} .z-agenda__view .z-event[data-key="a"]`;
    await page.locator(ev).evaluate((el) => el.scrollIntoView({ block: "center" }));
    const box = await page.locator(ev).boundingBox();
    const x = box.x + box.width / 2;
    const y = box.y + 8;
    await page.mouse.move(x, y);
    await page.mouse.down();
    for (let i = 1; i <= 8; i++) await page.mouse.move(x, y + 6 * i);
    await page.mouse.up();
    const change = (await events()).find((e) => e.name === "eventchange");
    ok(change?.detail.start === "2026-11-19T11:00" && change.detail.kind === "move", `arrastre: ${JSON.stringify(change?.detail)}`);
    await page.click(ev);
    await page.click(`${root} .z-agenda__move-open`);
    await wait(() => page.locator(`${root} dialog.z-agenda__move`).evaluate((d) => d.open), "diálogo abierto");
    await page.fill(`${root} dialog.z-agenda__move input[name="date"]`, "2026-11-21");
    await page.click(`${root} .z-agenda__move-apply`);
    const moved = (await events()).find((e) => e.name === "eventchange");
    ok(moved?.detail.start === "2026-11-21T10:00", `Move to…: ${JSON.stringify(moved?.detail)}`);
  });

  await test("Timer: inicia, pausa con anuncio, reinicia", async () => {
    const timer = '[data-component="Timer"] .z-timer[aria-label="Break"]';
    await page.locator(timer).scrollIntoViewIfNeeded();
    ok((await page.locator(`${timer} [role=timer]`).textContent()) === "05:00", "pantalla inicial");
    await page.click(`${timer} .z-timer__toggle`);
    ok((await page.getAttribute(timer, "data-state")) === "running", "corre");
    await page.waitForTimeout(1200);
    await page.click(`${timer} .z-timer__toggle`);
    ok((await page.getAttribute(timer, "data-state")) === "paused", "en pausa");
    await wait(
      async () => (await page.locator(`${timer} .z-timer__status`).textContent()).startsWith("Paused, 4 "),
      "anuncio de pausa",
    ).catch(async (e) => {
      throw new Error(`${e.message}: «${await page.locator(`${timer} .z-timer__status`).textContent()}»`);
    });
    ok((await page.locator(`${timer} .z-timer__toggle`).textContent()) === "Resume", "botón Reanudar");
    await page.click(`${timer} .z-timer__reset`);
    ok((await page.locator(`${timer} [role=timer]`).textContent()) === "05:00", "reinicia");
    const states = (await events()).filter((e) => e.name === "statechange").map((e) => e.detail.state);
    ok(states.join(",") === "running,paused,idle", `z:statechange: ${states}`);
  });

  await test("WeekPicker de rango y número de semana pulsable", async () => {
    const picker = "#sprint-weeks";
    if (!(await page.locator(picker).count())) await inject("WeekPicker", "Rango de semanas");
    await page.locator(picker).scrollIntoViewIfNeeded();
    ok((await page.locator(`${picker} .z-select__value`).textContent()) === "Week 46–48, 2026", "texto del rango");
    await page.click(`${picker} button.z-select__control`);
    const panel = "#sprint-weeks-panel";
    await page.click(`${panel} .z-calendar__day[data-date="2026-11-03"]:not([data-outside])`);
    await page.click(`${panel} .z-calendar__day[data-date="2026-11-17"]:not([data-outside])`);
    ok((await page.locator(`${picker} input[type=hidden]`).inputValue()) === "2026-W45/2026-W47", "valor del formulario");
    // Calendar con data-week-select: el número de semana elige la semana entera.
    await page.evaluate(async () => {
      const stage = document.querySelector('[data-component="Calendar"] .demo__stage');
      stage.insertAdjacentHTML(
        "beforeend",
        '<div class="z-calendar" id="weeks-cal" data-mode="range" data-month="2026-11" data-today="2026-11-19" data-week-start="1" data-week-numbers data-week-select data-locale="en-GB"></div>',
      );
      (await import("/zui/dist/zui.dom.js")).hydrate(stage);
    });
    await events();
    await page.locator("#weeks-cal .z-calendar__week-button").nth(3).click();
    const fired = await events();
    ok(
      fired.some((e) => e.name === "week" && e.detail.from === "2026-11-16"),
      `z:week: ${JSON.stringify(fired)}`,
    );
    ok((await page.getAttribute("#weeks-cal", "data-value")) === "2026-11-16/2026-11-22", "rango de la semana");
  });
}
