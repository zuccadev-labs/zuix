// Familia de fecha sin framework: variantes del Calendar (varios meses, múltiple, desplegables, preajustes,
// reservadas, vistas) y los selectores de rango con confirmación, mes, año y semana, sobre zui/html.json.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const contract = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../../../zui/html.json"), "utf8")).components;

export default async function ({ page, test, ok, settle, shots }) {
  /** Añade un ejemplo del contrato a la tarjeta de su componente y lo activa con hydrate(). */
  const inject = (name, title) =>
    page.evaluate(
      async ([component, html]) => {
        const stage = document.querySelector(`[data-component="${component}"] .demo__stage`);
        stage.insertAdjacentHTML("beforeend", html);
        (await import("/zui/dist/zui.dom.js")).hydrate(stage);
      },
      [name, contract[name].examples.find((e) => e.title === title).html],
    );
  const changes = () =>
    page.evaluate(() => {
      window.__zdates ??= [];
      return window.__zdates.splice(0);
    });
  await page.evaluate(() => {
    window.__zdates = [];
    document.addEventListener("z:change", (event) =>
      window.__zdates.push({ id: event.target.id, value: JSON.parse(JSON.stringify(event.detail?.value ?? null)) }),
    );
  });
  const active = () => page.evaluate(() => document.activeElement?.dataset?.date ?? document.activeElement?.dataset?.value ?? null);
  const isOpen = (selector) => page.locator(selector).evaluate((el) => el.matches(":popover-open"));
  const day = (root, date) => page.locator(`${root} .z-calendar__day[data-date="${date}"]:not([data-outside])`);

  await test("Calendar: dos meses, teclado continuo entre rejillas y rango que cruza el mes", async () => {
    await inject("Calendar", "Dos meses");
    const root = "#trip-calendar";
    await page.locator(root).scrollIntoViewIfNeeded();
    ok((await page.locator(`${root} [role=grid]`).count()) === 2, "dos rejillas");
    ok((await page.locator(`${root} .z-calendar__grid [tabindex="0"]`).count()) === 1, "una sola parada de tabulación");
    ok((await page.locator(`${root} .z-calendar__cell[data-range="middle"]`).count()) === 7, "banda del rango");
    await day(root, "2026-11-30").focus();
    await page.keyboard.press("ArrowRight");
    ok(
      (await active()) === "2026-12-01" && (await page.getAttribute(root, "data-month")) === "2026-11",
      "cruza al segundo mes sin mover la vista",
    );
    await page.keyboard.press("PageDown");
    ok((await active()) === "2027-01-01" && (await page.getAttribute(root, "data-month")) === "2026-12", "al salir, la vista avanza");
    await page.screenshot({ path: join(shots, "calendar-two-months.png") });
  });

  await test("Calendar: varias fechas con clic y teclado", async () => {
    await inject("Calendar", "Varias fechas");
    const root = "#meetings-calendar";
    await page.locator(root).scrollIntoViewIfNeeded();
    await changes();
    await day(root, "2026-11-11").click();
    await day(root, "2026-11-25").click();
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("Enter");
    const seen = await changes();
    ok(seen.length === 3 && seen.at(-1).value.join() === "2026-11-04,2026-11-18,2026-11-24,2026-11-25", `z:change ${JSON.stringify(seen)}`);
    ok((await page.locator(`${root} [role=grid]`).getAttribute("aria-multiselectable")) === "true", "aria-multiselectable");
  });

  await test("Calendar: desplegables nativos de mes y año", async () => {
    await inject("Calendar", "Selectores de mes y año");
    const root = "#caption-calendar";
    await page.locator(root).scrollIntoViewIfNeeded();
    await page.selectOption(`${root} select[data-part="month"]`, "2026-02");
    ok((await page.getAttribute(root, "data-month")) === "2026-02", "mes");
    ok((await page.evaluate(() => document.activeElement?.dataset?.part)) === "month", "el foco sigue en el select");
    await page.selectOption(`${root} select[data-part="year"]`, "2030");
    ok((await page.getAttribute(root, "data-month")) === "2030-02", "año");
    ok(
      (await page.locator(`${root} .z-calendar__title`).textContent()) === "February 2030",
      "el título (oculto) se actualiza para el lector",
    );
  });

  await test("Calendar: preajustes relativos a hoy y reservadas con leyenda", async () => {
    await inject("Calendar", "Con preajustes");
    const root = "#preset-calendar";
    await page.locator(root).scrollIntoViewIfNeeded();
    await page.locator(`${root} .z-calendar__preset`, { hasText: "Next 7 days" }).click();
    const today = await page.evaluate(() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    });
    const value = await page.getAttribute(root, "data-value");
    ok(value?.startsWith(`${today}/`), `preajuste desde hoy: ${value}`);
    ok((await page.locator(`${root} .z-calendar__preset[aria-pressed="true"]`).textContent()) === "Next 7 days", "aria-pressed");

    await inject("Calendar", "Fechas reservadas");
    const booked = "#booking-calendar";
    await page.locator(booked).scrollIntoViewIfNeeded();
    const cell = day(booked, "2026-11-21");
    ok((await cell.getAttribute("aria-label")).endsWith(", booked") && (await cell.getAttribute("aria-disabled")) === "true", "reservada");
    ok((await cell.evaluate((b) => getComputedStyle(b).textDecorationLine)) === "line-through", "tachada");
    await changes();
    await cell.click({ force: true });
    ok((await changes()).length === 0, "una reservada no se elige");
    ok((await page.locator(`${booked} .z-calendar__legend li`).count()) === 3, "leyenda");
    await page.locator(booked).screenshot({ path: join(shots, "calendar-booked.png") });
  });

  await test("Calendar: vistas de mes y año con teclado, Escape vuelve a los días; semanas numeradas y Hoy", async () => {
    await inject("Calendar", "Semanas numeradas, semanas fijas y botón Hoy");
    const root = "#week-calendar";
    await page.locator(root).scrollIntoViewIfNeeded();
    ok(
      (await page.locator(`${root} tbody tr`).count()) === 6 && (await page.locator(`${root} .z-calendar__week-number`).count()) === 6,
      "semanas fijas numeradas",
    );
    ok((await page.locator(`${root} .z-calendar__week-number`).first().getAttribute("aria-label")) === "Week 44", "Week 44");
    await page.locator(`${root} .z-calendar__view`).click();
    ok((await page.locator(`${root} [role=grid]`).getAttribute("aria-label")) === "Choose month", "vista de meses");
    ok((await active()) === "2026-11", "foco en el mes visible");
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("Enter");
    ok(
      (await page.getAttribute(root, "data-view")) === "day" && (await page.getAttribute(root, "data-month")) === "2026-08",
      "Intro baja a los días",
    );
    await page.locator(`${root} .z-calendar__view`).click();
    await page.locator(`${root} .z-calendar__view`).click();
    ok((await page.locator(`${root} .z-calendar__title`).textContent()) === "2020 – 2029", "década");
    await page.keyboard.press("Escape");
    ok((await page.getAttribute(root, "data-view")) === "day", "Escape vuelve a los días");
    await page.locator(`${root} .z-calendar__today`).click();
    const today = await page.evaluate(() => new Date().toISOString().slice(0, 7));
    ok((await page.getAttribute(root, "data-month")) === today, "Hoy lleva al mes actual");
  });

  await test("DatePicker: rango con dos meses, preajustes y confirmación (Cancelar descarta, Aplicar guarda)", async () => {
    const picker = "#trip";
    await inject("DatePicker", "Rango con dos meses, preajustes y confirmación");
    await page.locator(picker).scrollIntoViewIfNeeded();
    await page.locator(`${picker} .z-select__control`).click();
    await settle();
    ok(await isOpen("#trip-panel"), "abre");
    ok((await page.locator("#trip-panel [role=grid]").count()) === 2, "dos meses");
    await page.locator("#trip-panel .z-calendar__preset", { hasText: "This month" }).click();
    ok((await page.locator('#trip input[type="hidden"]').inputValue()) === "", "sin aplicar no cambia el campo");
    await page.locator("#trip-panel .z-calendar__cancel").click();
    await settle();
    ok(!(await isOpen("#trip-panel")) && (await page.locator('#trip input[type="hidden"]').inputValue()) === "", "Cancelar descarta");
    await page.locator(`${picker} .z-select__control`).click();
    await settle();
    await page.locator("#trip-panel .z-calendar__preset", { hasText: "This month" }).click();
    await changes();
    await page.locator("#trip-panel .z-calendar__apply").click();
    await settle();
    const value = await page.locator('#trip input[type="hidden"]').inputValue();
    ok(!(await isOpen("#trip-panel")) && /^\d{4}-\d{2}-01\/\d{4}-\d{2}-\d{2}$/.test(value), `Aplicar guarda: ${value}`);
    const seen = await changes();
    ok(seen.length === 1 && seen[0].id === "trip", `z:change en el campo: ${JSON.stringify(seen)}`);
  });

  await test("MonthPicker, YearPicker y WeekPicker: valor YYYY-MM, YYYY y YYYY-Www", async () => {
    await page
      .locator("#billing .z-select__control")
      .scrollIntoViewIfNeeded()
      .catch(() => {});
    for (const [name, title] of [
      ["MonthPicker", "Mes de facturación"],
      ["YearPicker", "Año de fabricación"],
      ["WeekPicker", "Semana del informe"],
    ]) {
      if (!(await page.locator(`[data-component="${name}"] .z-datepicker`).count())) await inject(name, title);
    }
    await page.locator("#billing .z-select__control").click();
    await settle();
    ok((await active()) === "2026-11", "foco en el mes");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Enter");
    await settle();
    ok((await page.locator('#billing input[type="hidden"]').inputValue()) === "2026-12", "mes elegido");
    ok((await page.locator("#billing .z-select__value").textContent()) === "December 2026", "texto del mes");

    await page.locator("#model-year .z-select__control").click();
    await settle();
    ok((await active()) === "2024", "foco en el año");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await settle();
    ok((await page.locator('#model-year input[type="hidden"]').inputValue()) === "2027", "año elegido");

    await page.locator("#report-week .z-select__control").click();
    await settle();
    ok((await page.locator('#report-week-panel td[aria-selected="true"]').count()) === 7, "semana entera");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await settle();
    ok((await page.locator('#report-week input[type="hidden"]').inputValue()) === "2026-W48", "semana ISO");
    ok((await page.locator("#report-week .z-select__value").textContent()) === "Week 48, 2026", "texto de la semana");
  });
}
