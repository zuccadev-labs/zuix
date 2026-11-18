// Grupo forms sin framework: Select, Combobox, Calendar, DatePicker, Slider, OTPInput y FileUpload.
// Cada componente se ejercita con puntero y con teclado sobre el marcado de zui/html.json.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const contract = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../../../zui/html.json"), "utf8")).components;

export default async function ({ page, test, ok, settle, shots }) {
  // Registro de eventos z:change y z:input, para comprobar qué se emite y dónde.
  await page.evaluate(() => {
    window.__zforms = [];
    const plain = (detail) => JSON.parse(JSON.stringify(detail ?? null, (_key, value) => (value instanceof File ? value.name : value)));
    for (const name of ["z:change", "z:input"])
      document.addEventListener(name, (event) => window.__zforms.push({ name, id: event.target.id, detail: plain(event.detail) }));
  });
  const events = () => page.evaluate(() => window.__zforms.splice(0));
  const isOpen = (selector) => page.locator(selector).evaluate((el) => el.matches(":popover-open"));
  const focusedText = () => page.evaluate(() => document.activeElement?.textContent.trim());
  const focusedIs = (selector) => page.evaluate((s) => document.activeElement === document.querySelector(s), selector);
  // Añade a la tarjeta otro ejemplo del contrato y lo activa con hydrate(), como haría una aplicación.
  const inject = (name, index) =>
    page.evaluate(
      async ([component, html]) => {
        const stage = document.querySelector(`[data-component="${component}"] .demo__stage`);
        stage.insertAdjacentHTML("beforeend", html);
        (await import("/zui/dist/zui.dom.js")).hydrate(stage);
      },
      [name, contract[name].examples[index].html],
    );
  const press = async (...keys) => {
    for (const key of keys) await page.keyboard.press(key);
  };

  /* ---------- Select ---------- */

  await test("Select: clic abre anclado al campo, elegir actualiza texto, icono y campo oculto", async () => {
    const control = page.locator("#view .z-select__control");
    await control.click();
    await settle();
    ok(await isOpen("#view-list"), "no abrió");
    ok(
      (await control.getAttribute("aria-expanded")) === "true" && (await control.getAttribute("data-state")) === "open",
      "estado del botón al abrir",
    );
    const [c, p] = [await control.boundingBox(), await page.locator("#view-list").boundingBox()];
    ok(
      Math.abs(p.x - c.x) < 2 && (Math.abs(p.y - (c.y + c.height + 4)) < 2 || Math.abs(p.y + p.height + 4 - c.y) < 2),
      `mal anclado: ${JSON.stringify([c, p])}`,
    );
    ok(p.width >= c.width - 1, `más estrecho que el campo: ${p.width} < ${c.width}`);
    ok(await page.locator("#view-list").evaluate((el) => getComputedStyle(el).paddingTop === "0px"), "relleno del navegador en el popup");
    await page.screenshot({ path: join(shots, "select.png") });
    await page.locator("#view-list .z-listbox__option", { hasText: "Grid" }).click();
    await settle();
    ok(!(await isOpen("#view-list")), "no cerró al elegir");
    ok((await page.locator("#view .z-select__value").textContent()) === "Grid", "texto del valor");
    ok((await page.locator("#view .z-select__control .z-select__icon svg").count()) === 1, "sin icono de la opción elegida");
    ok((await page.locator('#view input[type="hidden"]').inputValue()) === "grid", "campo oculto");
    ok(!(await control.evaluate((el) => el.hasAttribute("data-placeholder"))), "sigue como placeholder");
    ok((await page.locator('#view-list [data-value="grid"]').getAttribute("aria-selected")) === "true", "aria-selected");
    ok(
      (await control.getAttribute("aria-expanded")) === "false" && (await control.getAttribute("data-state")) === "closed",
      "estado del botón al cerrar",
    );
    ok(await focusedIs("#view .z-select__control"), "no devolvió el foco");
    const seen = await events();
    ok(seen.length === 1 && seen[0].id === "view" && seen[0].detail.value === "grid", `z:change: ${JSON.stringify(seen)}`);
  });
  await test("Select: opción deshabilitada no se elige; clic fuera cierra", async () => {
    await page.locator("#view .z-select__control").click();
    await settle();
    await page.locator('#view-list [data-value="board"]').click({ force: true });
    await settle();
    ok(await isOpen("#view-list"), "cerró con una opción deshabilitada");
    await page.mouse.click(5, 500);
    await settle();
    ok(!(await isOpen("#view-list")), "clic fuera no cerró");
    ok((await page.locator('#view input[type="hidden"]').inputValue()) === "grid" && (await events()).length === 0, "cambió el valor");
    ok(await focusedIs("#view .z-select__control"), "el foco no volvió al campo");
  });
  await test("Select: flechas, Home/End, letra, Enter, Espacio, Escape y Tab", async () => {
    const control = page.locator("#view .z-select__control");
    await control.focus();
    await press("ArrowDown");
    await settle();
    ok((await isOpen("#view-list")) && (await focusedText()) === "Grid", `abre en la opción elegida: ${await focusedText()}`);
    await press("ArrowDown");
    ok((await focusedText()) === "Calendar", `no saltó la deshabilitada: ${await focusedText()}`);
    ok((await page.locator("#view-list [data-highlighted]").count()) === 1, "más de una opción activa");
    await press("End");
    ok((await focusedText()) === "Gallery", "End");
    await press("ArrowDown");
    ok((await focusedText()) === "Gallery", "la flecha no debe dar la vuelta");
    await press("Home");
    ok((await focusedText()) === "List", "Home");
    await press("Tab");
    ok((await isOpen("#view-list")) && (await focusedText()) === "List", "Tab salió de la lista");
    await page.keyboard.type("ca");
    ok((await focusedText()) === "Calendar", `búsqueda por letra: ${await focusedText()}`);
    await press("Enter");
    await settle();
    ok(!(await isOpen("#view-list")) && (await page.locator('#view input[type="hidden"]').inputValue()) === "calendar", "Enter no eligió");
    ok(await focusedIs("#view .z-select__control"), "foco tras elegir");
    await page.waitForTimeout(1100);
    await press("Space");
    await settle();
    ok((await isOpen("#view-list")) && (await focusedText()) === "Calendar", "Espacio no abrió");
    await press("ArrowUp", "Escape");
    await settle();
    ok(!(await isOpen("#view-list")) && (await focusedIs("#view .z-select__control")), "Escape no cerró o no devolvió el foco");
    ok((await page.locator('#view input[type="hidden"]').inputValue()) === "calendar", "Escape cambió el valor");
    await events();
    // Cerrado: la letra cambia el valor sin abrir.
    await page.keyboard.type("l");
    await settle();
    ok(
      !(await isOpen("#view-list")) && (await page.locator("#view .z-select__value").textContent()) === "List",
      "letra con la lista cerrada",
    );
    const seen = await events();
    ok(seen.length === 1 && seen[0].detail.value === "list", `z:change por letra: ${JSON.stringify(seen)}`);
    await page.waitForTimeout(1100);
  });
  await test("Select: grupos y valor inicial desde data-value", async () => {
    await inject("Select", 1);
    ok((await page.locator('#region-list [data-value="eu-west"]').getAttribute("data-state")) === "checked", "valor inicial sin marcar");
    await page.locator("#region .z-select__control").click();
    await settle();
    ok((await focusedText()) === "Ireland", "no enfocó la opción elegida");
    await press("ArrowDown", "ArrowDown", "Space");
    await settle();
    ok(
      (await page.locator("#region .z-select__value").textContent()) === "Virginia" &&
        (await page.locator("#region").getAttribute("data-value")) === "us-east",
      "no eligió a través de grupos",
    );
    await events();
  });

  await test("Select dentro de un Modal: la lista queda por encima y Escape cierra solo la lista", async () => {
    await page.evaluate(async (html) => {
      const dialog = document.createElement("dialog");
      dialog.id = "forms-dialog";
      dialog.className = "z-liquid z-modal";
      dialog.dataset.size = "sm";
      dialog.setAttribute("aria-label", "Rows");
      dialog.innerHTML = `<div class="z-modal__body">${html}</div>`;
      document.body.append(dialog);
      const dom = await import("/zui/dist/zui.dom.js");
      dom.hydrate(dialog);
      dom.openDialog(dialog);
    }, contract.Select.examples[2].html);
    await settle();
    await page.locator("#rows .z-select__control").click();
    await settle();
    ok((await isOpen("#rows-list")) && (await focusedText()) === "25", "no abrió dentro del diálogo");
    await page.locator("#rows-list .z-listbox__option", { hasText: "50" }).click();
    await settle();
    ok((await page.locator("#rows .z-select__value").textContent()) === "50", "la lista no recibe clics sobre el diálogo");
    await page.locator("#rows .z-select__control").press("ArrowDown");
    await settle();
    await press("Escape");
    await settle();
    ok(
      !(await isOpen("#rows-list")) && (await page.locator("#forms-dialog").evaluate((d) => d.open)),
      "Escape cerró el diálogo junto con la lista",
    );
    ok(await focusedIs("#rows .z-select__control"), "foco tras Escape");
    await press("Escape");
    await page.waitForTimeout(500);
    ok(await page.locator("#forms-dialog").evaluate((d) => !d.open), "el segundo Escape no cerró el diálogo");
    await page.evaluate(() => document.querySelector("#forms-dialog").remove());
    await events();
  });

  /* ---------- Combobox ---------- */

  const combo = page.locator("#country input.z-input__control");
  const visibleOptions = () =>
    page
      .locator("#country-list .z-listbox__option:visible")
      .allTextContents()
      .then((list) => list.map((t) => t.trim()));
  const activeOption = () =>
    page.evaluate(
      () =>
        document
          .getElementById(document.querySelector("#country input.z-input__control").getAttribute("aria-activedescendant") ?? "")
          ?.textContent.trim() ?? null,
    );

  await test("Combobox: filtra sin mayúsculas ni acentos, Enter elige y el foco no sale del campo", async () => {
    await combo.click();
    await settle();
    const popup = page.locator("#country-list").locator("xpath=..");
    ok(await popup.evaluate((el) => el.matches(":popover-open")), "clic no abrió");
    ok((await visibleOptions()).length === 8, "no muestra todas las opciones");
    ok(
      (await page.locator("#country").getAttribute("data-state")) === "open" && (await combo.getAttribute("aria-expanded")) === "true",
      "estado abierto",
    );
    const [c, p] = [await page.locator("#country").boundingBox(), await popup.boundingBox()];
    ok(Math.abs(p.x - c.x) < 2 && p.width >= c.width - 1, `mal anclado: ${JSON.stringify([c, p])}`);
    await page.keyboard.type("PERU");
    ok(JSON.stringify(await visibleOptions()) === '["Perú"]', `filtro: ${JSON.stringify(await visibleOptions())}`);
    ok((await activeOption()) === "Perú", "la primera coincidencia no quedó activa");
    await page.screenshot({ path: join(shots, "combobox.png") });
    await press("Enter");
    await settle();
    ok(!(await popup.evaluate((el) => el.matches(":popover-open"))), "Enter no cerró");
    ok(
      (await combo.inputValue()) === "Perú" && (await page.locator('#country input[type="hidden"]').inputValue()) === "pe",
      "valor tras elegir",
    );
    ok(await focusedIs("#country input.z-input__control"), "el foco salió del campo");
    ok(await page.locator("#country .z-input__action:not(.z-combobox__toggle)").isVisible(), "no aparece el botón de limpiar");
    ok(
      (await combo.getAttribute("aria-activedescendant")) === null && (await combo.getAttribute("aria-expanded")) === "false",
      "estado cerrado",
    );
    const seen = await events();
    ok(
      seen.some((e) => e.name === "z:input" && e.detail.value === "PERU"),
      "sin z:input",
    );
    const changes = seen.filter((e) => e.name === "z:change");
    ok(
      changes.length === 1 && changes[0].id === "country" && changes[0].detail.value === "pe" && changes[0].detail.label === "Perú",
      `z:change: ${JSON.stringify(changes)}`,
    );
  });
  await test("Combobox: flechas, Home/End, estado vacío y Escape", async () => {
    await combo.focus();
    await press("ArrowDown");
    await settle();
    ok((await activeOption()) === "Perú", `abre en la opción elegida: ${await activeOption()}`);
    await press("ArrowUp");
    ok((await activeOption()) === "México", `no saltó la deshabilitada: ${await activeOption()}`);
    await press("Home");
    ok((await activeOption()) === "Argentina", "Home");
    await press("ArrowUp");
    ok((await activeOption()) === "Uruguay", "la flecha no dio la vuelta");
    await press("End", "ArrowDown");
    ok((await activeOption()) === "Argentina", "End y vuelta");
    await combo.fill("zzz");
    ok((await visibleOptions()).length === 0, "siguen visibles opciones");
    const empty = page.locator("#country-list").locator("xpath=..").locator(".z-listbox__empty");
    ok(
      (await empty.count()) === 1 && (await empty.textContent()) === "No results" && (await empty.getAttribute("role")) === "status",
      "sin estado vacío",
    );
    ok(await page.locator("#country-list").isHidden(), "la lista vacía sigue ocupando espacio");
    await press("Escape");
    await settle();
    ok((await combo.inputValue()) === "Perú", `Escape no restauró el texto: ${await combo.inputValue()}`);
    ok((await page.locator('#country input[type="hidden"]').inputValue()) === "pe", "Escape cambió el valor");
    ok((await empty.count()) === 0, "el estado vacío no se retiró");
    await events();
  });
  await test("Combobox: botón de lista, clic en opción y limpiar", async () => {
    await page.locator("#country .z-combobox__toggle").click();
    await settle();
    ok((await visibleOptions()).length === 8 && (await focusedIs("#country input.z-input__control")), "el botón no abrió o robó el foco");
    ok((await page.locator("#country .z-combobox__toggle").getAttribute("aria-expanded")) === "true", "aria-expanded del botón");
    await page.locator("#country-list .z-listbox__option", { hasText: "Paraguay" }).click({ force: true });
    await settle();
    ok((await visibleOptions()).length === 8, "eligió una opción deshabilitada");
    await page.locator("#country-list .z-listbox__option", { hasText: "Chile" }).hover();
    ok((await activeOption()) === "Chile", "el puntero no marca la opción activa");
    await page.locator("#country-list .z-listbox__option", { hasText: "Chile" }).click();
    await settle();
    ok((await combo.inputValue()) === "Chile" && (await focusedIs("#country input.z-input__control")), "clic en opción");
    ok((await page.locator("#country-chile, #country-cl").getAttribute("aria-selected")) === "true", "aria-selected");
    await page.locator("#country .z-input__action:not(.z-combobox__toggle)").click();
    await settle();
    ok((await combo.inputValue()) === "" && (await page.locator('#country input[type="hidden"]').inputValue()) === "", "limpiar no vació");
    ok(await page.locator("#country .z-input__action:not(.z-combobox__toggle)").isHidden(), "el botón de limpiar sigue visible");
    ok(await focusedIs("#country input.z-input__control"), "limpiar no devolvió el foco");
    const changes = (await events()).filter((e) => e.name === "z:change").map((e) => e.detail.value);
    ok(JSON.stringify(changes) === '["cl",null]', `z:change: ${JSON.stringify(changes)}`);
    await page.locator("#country .z-combobox__toggle").click();
    await settle();
    await page.mouse.click(5, 500);
    await settle();
    ok((await page.locator("#country").getAttribute("data-state")) === "closed", "clic fuera no cerró");
    ok(!(await focusedIs("#country input.z-input__control")), "el campo recuperó el foco tras un clic fuera");
    await combo.focus();
    await press("ArrowDown", "Tab");
    await settle();
    ok(
      (await page.locator("#country").getAttribute("data-state")) === "closed" && (await combo.getAttribute("aria-expanded")) === "false",
      "salir con Tab no cerró",
    );
  });
  await test("Combobox: carga asíncrona con z:input, setComboboxLoading y setComboboxOptions", async () => {
    await inject("Combobox", 1);
    const input = page.locator("#repo input.z-input__control");
    await input.click();
    await page.keyboard.type("zu");
    await settle();
    ok(
      (await events()).some((e) => e.name === "z:input" && e.id === "repo" && e.detail.value === "zu"),
      "sin z:input",
    );
    const popup = page.locator("#repo-list").locator("xpath=..");
    ok((await popup.locator(".z-listbox__empty").textContent()) === "No repositories", "texto vacío propio");
    await page.evaluate(async () => (await import("/zui/dist/zui.dom.js")).setComboboxLoading(document.querySelector("#repo"), true));
    ok(
      (await popup.locator(".z-listbox__empty").textContent()) === "Searching" && (await input.getAttribute("aria-busy")) === "true",
      "estado de carga",
    );
    ok((await page.locator("#repo .z-input__spinner").count()) === 1, "sin anillo de carga");
    await page.evaluate(async () => {
      const dom = await import("/zui/dist/zui.dom.js");
      const repo = document.querySelector("#repo");
      dom.setComboboxOptions(repo, [
        { value: "zui", label: "zuix/zui", icon: "folder" },
        { value: "zout", label: "zuix/zout", icon: "folder" },
        { value: "old", label: "archive", disabled: true },
      ]);
      dom.setComboboxLoading(repo, false);
    });
    await settle();
    // data-filter="false": las opciones llegan filtradas y no se vuelven a filtrar por "zu".
    ok((await page.locator("#repo-list .z-listbox__option:visible").count()) === 3, "opciones nuevas filtradas o ausentes");
    ok(
      (await popup.locator(".z-listbox__empty").count()) === 0 && (await page.locator("#repo .z-input__spinner").count()) === 0,
      "queda estado de carga",
    );
    ok(
      (await page.locator("#repo-list .z-listbox__icon svg").count()) === 2 &&
        (await page.locator("#repo-list .z-listbox__check svg").count()) === 3,
      "iconos de las opciones",
    );
    await press("ArrowDown", "Enter");
    await settle();
    ok(
      (await input.inputValue()) === "zuix/zout" && (await page.locator("#repo").getAttribute("data-value")) === "zout",
      "no eligió la opción cargada",
    );
    ok((await page.locator("#repo > .z-input__icon svg").count()) === 1, "sin icono de la selección");
    await events();
  });

  /* ---------- Calendar ---------- */

  const cal = page.locator("#due-calendar");
  const day = (root, date) => page.locator(`${root} [data-date="${date}"]`);
  const focusedDate = () => page.evaluate(() => document.activeElement?.dataset?.date ?? null);

  await test("Calendar: rejilla generada con el marcado del contrato, límites y navegación con puntero", async () => {
    ok((await cal.locator(".z-calendar__title").textContent()) === "November 2026", "título");
    ok(
      JSON.stringify(await cal.locator("th.z-calendar__weekday").allTextContents()) === '["Sun","Mon","Tue","Wed","Thu","Fri","Sat"]',
      "días de la semana",
    );
    ok(
      (await cal.locator(".z-calendar__day:not([data-outside])").count()) === 30 && (await cal.locator("tbody tr").count()) === 5,
      "días del mes",
    );
    ok(
      (await cal.locator('.z-calendar__grid[role="grid"]').getAttribute("aria-labelledby")) ===
        (await cal.locator(".z-calendar__title").getAttribute("id")),
      "la rejilla no está etiquetada por el título",
    );
    const picked = day("#due-calendar", "2026-11-13");
    ok(
      (await picked.getAttribute("data-selected")) === "" &&
        (await picked.getAttribute("tabindex")) === "0" &&
        (await picked.getAttribute("aria-label")) === "Friday, November 13, 2026",
      "día elegido",
    );
    ok((await cal.locator('.z-calendar__day[tabindex="0"]').count()) === 1, "más de un día en el orden de tabulación");
    ok((await cal.locator('td[aria-selected="true"]').count()) === 1, "aria-selected de la celda");
    ok(
      (await day("#due-calendar", "2026-11-04").getAttribute("aria-disabled")) === "true" &&
        (await day("#due-calendar", "2026-11-05").getAttribute("aria-disabled")) === null,
      "mínimo",
    );
    const [back, forward] = [cal.locator(".z-calendar__nav").first(), cal.locator(".z-calendar__nav").last()];
    ok((await back.isDisabled()) && !(await forward.isDisabled()), "botones de mes según los límites");
    const bg = await picked.evaluate((el) => getComputedStyle(el).backgroundColor);
    ok(bg !== "rgba(0, 0, 0, 0)", "el día elegido no tiene fondo");
    await day("#due-calendar", "2026-11-03").click({ force: true });
    ok((await cal.getAttribute("data-value")) === "2026-11-13" && (await events()).length === 0, "eligió un día fuera de límites");
    await day("#due-calendar", "2026-11-20").click();
    ok(
      (await cal.getAttribute("data-value")) === "2026-11-20" &&
        (await day("#due-calendar", "2026-11-13").getAttribute("data-selected")) === null,
      "el clic no eligió",
    );
    const seen = await events();
    ok(seen.length === 1 && seen[0].id === "due-calendar" && seen[0].detail.value === "2026-11-20", `z:change: ${JSON.stringify(seen)}`);
    await forward.click();
    ok(
      (await cal.locator(".z-calendar__title").textContent()) === "December 2026" && (await cal.getAttribute("data-month")) === "2026-12",
      "mes siguiente",
    );
    ok((await forward.isDisabled()) && (await day("#due-calendar", "2026-12-21").getAttribute("aria-disabled")) === "true", "máximo");
    await back.click();
    ok((await cal.locator(".z-calendar__title").textContent()) === "November 2026", "mes anterior");
    await page.mouse.move(5, 5);
    await cal.screenshot({ path: join(shots, "calendar.png") });
  });
  await test("Calendar: flechas, Home/End, Re/Av Pág con y sin Mayús, Enter y Espacio", async () => {
    await day("#due-calendar", "2026-11-20").focus();
    await press("ArrowRight");
    ok((await focusedDate()) === "2026-11-21", `ArrowRight: ${await focusedDate()}`);
    await press("ArrowRight");
    ok((await focusedDate()) === "2026-11-22", "cambio de semana");
    await press("ArrowDown");
    ok((await focusedDate()) === "2026-11-29", "ArrowDown");
    await press("End");
    ok(
      (await focusedDate()) === "2026-12-05" && (await cal.locator(".z-calendar__title").textContent()) === "December 2026",
      `End cruza de mes: ${await focusedDate()}`,
    );
    await press("Home");
    ok((await focusedDate()) === "2026-11-29" && (await cal.locator(".z-calendar__title").textContent()) === "November 2026", "Home");
    await press("ArrowUp", "ArrowLeft");
    ok((await focusedDate()) === "2026-11-21", "ArrowUp y ArrowLeft");
    ok(
      (await cal.locator('.z-calendar__day[tabindex="0"]').count()) === 1 &&
        (await day("#due-calendar", "2026-11-21").getAttribute("tabindex")) === "0",
      "foco itinerante",
    );
    await press("PageDown");
    ok((await focusedDate()) === "2026-12-20", `Av Pág debe acotarse al máximo: ${await focusedDate()}`);
    await press("PageUp");
    ok((await focusedDate()) === "2026-11-20", "Re Pág");
    await press("Shift+PageUp");
    ok((await focusedDate()) === "2026-11-05", `Mayús+Re Pág debe acotarse al mínimo: ${await focusedDate()}`);
    await press("ArrowLeft");
    ok((await focusedDate()) === "2026-11-05", "salió de los límites");
    await press("ArrowRight", "Enter");
    ok((await cal.getAttribute("data-value")) === "2026-11-06", "Enter no eligió");
    await press("ArrowDown", "Space");
    ok((await cal.getAttribute("data-value")) === "2026-11-13" && (await focusedDate()) === "2026-11-13", "Espacio no eligió");
    const values = (await events()).map((e) => e.detail.value);
    ok(JSON.stringify(values) === '["2026-11-06","2026-11-13"]', `z:change: ${JSON.stringify(values)}`);
  });
  await test("Calendar: rango con vista previa, semana desde lunes y días deshabilitados por atributo", async () => {
    await inject("Calendar", 1);
    await inject("Calendar", 2);
    const range = page.locator("#stay-calendar");
    ok((await range.locator("th.z-calendar__weekday").first().textContent()) === "Mon", "data-week-start");
    ok((await range.locator(".z-calendar__grid").getAttribute("aria-multiselectable")) === "true", "aria-multiselectable");
    const part = (date) => day("#stay-calendar", date).locator("xpath=..").getAttribute("data-range");
    ok(
      (await part("2026-11-09")) === "start" &&
        (await part("2026-11-11")) === "middle" &&
        (await part("2026-11-14")) === "end" &&
        (await part("2026-11-15")) === null,
      "banda del rango inicial",
    );
    ok(
      (await range.locator('td[aria-selected="true"]').count()) === 6 &&
        (await range.locator(".z-calendar__day[data-selected]").count()) === 2,
      "selección del rango",
    );
    await range.screenshot({ path: join(shots, "calendar-range.png") });
    await day("#stay-calendar", "2026-11-17").click();
    ok((await range.getAttribute("data-value")) === "2026-11-17/" && (await part("2026-11-17")) === "single", "inicio de un rango nuevo");
    await day("#stay-calendar", "2026-11-20").hover();
    ok(
      (await part("2026-11-19")) === "middle" &&
        (await day("#stay-calendar", "2026-11-19").locator("xpath=..").getAttribute("data-preview")) === "",
      "sin vista previa",
    );
    await day("#stay-calendar", "2026-11-20").click();
    ok(
      (await range.getAttribute("data-value")) === "2026-11-17/2026-11-20" && (await range.locator("td[data-preview]").count()) === 0,
      "fin del rango",
    );
    // Un final anterior al inicio invierte el rango.
    await day("#stay-calendar", "2026-11-25").click();
    await day("#stay-calendar", "2026-11-23").click();
    ok((await range.getAttribute("data-value")) === "2026-11-23/2026-11-25", "rango invertido");
    const seen = (await events()).filter((e) => e.id === "stay-calendar").map((e) => e.detail.value);
    ok(
      seen.length === 4 && seen[1].from === "2026-11-17" && seen[1].to === "2026-11-20" && seen[2].to === null,
      `z:change: ${JSON.stringify(seen)}`,
    );
    // Teclado en rango: el foco hace de vista previa.
    await day("#stay-calendar", "2026-11-03").click();
    await press("ArrowRight", "ArrowRight");
    ok((await part("2026-11-04")) === "middle" && (await part("2026-11-05")) === "end", "vista previa con teclado");
    await press("Enter");
    ok((await range.getAttribute("data-value")) === "2026-11-03/2026-11-05", "rango por teclado");
    // Día de otro mes: se elige y el calendario muestra su mes.
    await day("#stay-calendar", "2026-10-28").click();
    ok(
      (await range.locator(".z-calendar__title").textContent()) === "October 2026" && (await focusedDate()) === "2026-10-28",
      "día de un mes vecino",
    );
    const work = page.locator("#workdays");
    ok(
      (await day("#workdays", "2026-11-07").getAttribute("aria-disabled")) === "true" &&
        (await day("#workdays", "2026-11-09").getAttribute("aria-disabled")) === null,
      "data-disabled-weekdays",
    );
    await day("#workdays", "2026-11-08").click({ force: true });
    ok((await work.getAttribute("data-value")) === null, "eligió un fin de semana");
    await events();
  });
  await test("Calendar: setCalendarValue() muestra el mes del valor", async () => {
    await page.evaluate(async () =>
      (await import("/zui/dist/zui.dom.js")).setCalendarValue(document.querySelector("#workdays"), "2027-02-10"),
    );
    ok(
      (await page.locator("#workdays .z-calendar__title").textContent()) === "February 2027" &&
        (await day("#workdays", "2027-02-10").getAttribute("data-selected")) === "",
      "valor imperativo",
    );
    ok((await page.locator("#workdays .z-calendar__day:not([data-outside])").count()) === 28, "días de febrero");
    await events();
  });

  /* ---------- DatePicker ---------- */

  await test("DatePicker: abre con el foco en el día elegido, teclado elige, cierra y devuelve el foco", async () => {
    const control = page.locator("#due .z-select__control");
    await control.click();
    await settle();
    ok(await isOpen("#due-panel"), "no abrió");
    const [c, p] = [await control.boundingBox(), await page.locator("#due-panel").boundingBox()];
    ok(
      Math.abs(p.x - c.x) < 2 && (Math.abs(p.y - (c.y + c.height + 4)) < 2 || Math.abs(p.y + p.height + 4 - c.y) < 2),
      `mal anclado: ${JSON.stringify([c, p])}`,
    );
    ok((await focusedDate()) === "2026-11-13", `foco inicial: ${await focusedDate()}`);
    ok((await control.getAttribute("aria-expanded")) === "true" && (await control.getAttribute("data-state")) === "open", "estado abierto");
    ok(
      (await page.locator("#due-panel .z-calendar__title").textContent()) === "November 2026" &&
        (await page.locator("#due-panel th").first().textContent()) === "Sun",
      "el calendario no heredó locale y semana",
    );
    await page.screenshot({ path: join(shots, "datepicker.png") });
    await press("ArrowRight", "Enter");
    await settle();
    ok(!(await isOpen("#due-panel")), "no cerró al elegir");
    ok(
      (await page.locator("#due .z-select__value").textContent()) === "Nov 14, 2026",
      `texto: ${await page.locator("#due .z-select__value").textContent()}`,
    );
    ok(
      (await page.locator('#due input[type="hidden"]').inputValue()) === "2026-11-14" &&
        (await page.locator("#due").getAttribute("data-value")) === "2026-11-14",
      "valor",
    );
    ok(
      (await focusedIs("#due .z-select__control")) &&
        (await control.getAttribute("aria-expanded")) === "false" &&
        (await control.getAttribute("data-state")) === "closed",
      "foco y estado tras elegir",
    );
    const seen = await events();
    ok(
      seen.length === 1 && seen[0].id === "due" && seen[0].detail.value === "2026-11-14",
      `un solo z:change, en el campo: ${JSON.stringify(seen)}`,
    );
  });
  await test("DatePicker: clic en un día, Escape, clic fuera y segundo clic en el campo", async () => {
    const control = page.locator("#due .z-select__control");
    await control.click();
    await settle();
    await day("#due-panel", "2026-11-25").click();
    await settle();
    ok(!(await isOpen("#due-panel")) && (await page.locator("#due .z-select__value").textContent()) === "Nov 25, 2026", "clic en un día");
    await control.press("Enter");
    await settle();
    ok((await isOpen("#due-panel")) && (await focusedDate()) === "2026-11-25", "Enter no abrió en el día elegido");
    await press("PageDown", "Escape");
    await settle();
    ok(!(await isOpen("#due-panel")) && (await focusedIs("#due .z-select__control")), "Escape no cerró o no devolvió el foco");
    ok((await page.locator('#due input[type="hidden"]').inputValue()) === "2026-11-25", "Escape cambió el valor");
    await control.click();
    await settle();
    ok((await page.locator("#due-panel .z-calendar__title").textContent()) === "November 2026", "no reabrió en el mes del valor");
    await page.mouse.click(5, 500);
    await settle();
    ok(!(await isOpen("#due-panel")), "clic fuera no cerró");
    await control.click();
    await settle();
    await control.click();
    await settle();
    ok(!(await isOpen("#due-panel")), "el segundo clic no cerró");
    await events();
  });
  await test("DatePicker: rango, sigue abierto hasta completar y envía desde/hasta", async () => {
    await inject("DatePicker", 1);
    ok((await page.locator("#stay .z-select__value").textContent()) === "Nov 9, 2026 – Nov 14, 2026", "texto inicial");
    await page.locator("#stay .z-select__control").click();
    await settle();
    ok(
      (await focusedDate()) === "2026-11-09" && (await page.locator("#stay-panel th").first().textContent()) === "Mon",
      "foco inicial o semana",
    );
    ok(await page.locator("#stay-panel .z-calendar__nav").first().isDisabled(), "no heredó el mínimo");
    await day("#stay-panel", "2026-11-03").click();
    await settle();
    ok(
      (await isOpen("#stay-panel")) && (await page.locator("#stay .z-select__value").textContent()) === "Nov 3, 2026 – …",
      "cerró con el rango a medias",
    );
    await day("#stay-panel", "2026-11-06").click();
    await settle();
    ok(!(await isOpen("#stay-panel")), "no cerró con el rango completo");
    ok(
      (await page.locator("#stay .z-select__value").textContent()) === "Nov 3, 2026 – Nov 6, 2026" &&
        (await page.locator('#stay input[type="hidden"]').inputValue()) === "2026-11-03/2026-11-06",
      "valor del rango",
    );
    const seen = (await events()).filter((e) => e.id === "stay");
    ok(seen.length === 2 && seen[1].detail.value.to === "2026-11-06", `z:change: ${JSON.stringify(seen)}`);
  });

  /* ---------- Slider ---------- */

  const thumb = page.locator("#volume .z-slider__thumb");
  const now = (locator = thumb) => locator.getAttribute("aria-valuenow");

  await test("Slider: posición inicial del tirador y del tramo", async () => {
    const [s, t, r] = [
      await page.locator("#volume").boundingBox(),
      await thumb.boundingBox(),
      await page.locator("#volume .z-slider__range").boundingBox(),
    ];
    // El tirador recorre el ancho menos su tamaño: al 60 % su centro queda a 0.6 * (ancho - tirador) + medio tirador.
    const centre = s.x + 0.6 * (s.width - t.width) + t.width / 2;
    ok(Math.abs(t.x + t.width / 2 - centre) < 1.5, `tirador mal colocado: ${t.x + t.width / 2} ≠ ${centre}`);
    ok(Math.abs(t.y + t.height / 2 - (s.y + s.height / 2)) < 1.5, "tirador sin centrar en vertical");
    ok(Math.abs(r.x - s.x) < 1 && Math.abs(r.width - s.width * 0.6) < 1.5, `tramo: ${JSON.stringify(r)}`);
    await page.locator("#volume").screenshot({ path: join(shots, "slider.png") });
  });
  await test("Slider: flechas, Inicio, Fin, Re/Av Pág y Mayús", async () => {
    await thumb.focus();
    await press("ArrowRight");
    ok((await now()) === "65", `ArrowRight: ${await now()}`);
    await press("ArrowUp", "ArrowLeft", "ArrowDown");
    ok((await now()) === "60", "flechas");
    await press("Home");
    ok((await now()) === "0", "Inicio");
    await press("ArrowLeft");
    ok((await now()) === "0", "bajó del mínimo");
    await press("End");
    ok((await now()) === "100", "Fin");
    await press("PageDown");
    ok((await now()) === "50", "Av Pág");
    await press("Shift+ArrowRight");
    ok((await now()) === "100", "Mayús+flecha");
    await press("PageDown", "ArrowLeft");
    ok(
      (await now()) === "45" &&
        (await page.locator("#volume").getAttribute("data-value")) === "45" &&
        (await page.locator("#volume input").inputValue()) === "45",
      "valor reflejado",
    );
    ok(
      await page.locator("#volume .z-slider__range").evaluate((el) => el.style.right === "55%" && el.style.left === "0%"),
      "tramo sin actualizar",
    );
    const seen = await events();
    ok(seen.length === 10 && seen.every((e) => e.id === "volume") && seen[9].detail.value === 45, `z:change: ${seen.length}`);
  });
  await test("Slider: clic en la pista y arrastre con puntero", async () => {
    const s = await page.locator("#volume").boundingBox();
    await page.mouse.click(s.x + s.width * 0.25, s.y + s.height / 2);
    ok((await now()) === "25", `clic en la pista: ${await now()}`);
    ok(await focusedIs("#volume .z-slider__thumb"), "el tirador no recibió el foco");
    const t = await thumb.boundingBox();
    await page.mouse.move(t.x + t.width / 2, t.y + t.height / 2);
    await page.mouse.down();
    ok((await now()) === "25", "pulsar el tirador no debe moverlo");
    await page.mouse.move(s.x + s.width * 0.5, s.y + 40, { steps: 4 });
    ok((await now()) === "50", `arrastre: ${await now()}`);
    await page.mouse.move(s.x + s.width + 80, s.y, { steps: 4 });
    ok((await now()) === "100", "arrastre más allá del final");
    await page.mouse.move(s.x + s.width * 0.8, s.y, { steps: 2 });
    await page.mouse.up();
    ok((await now()) === "80", `al soltar: ${await now()}`);
    await page.mouse.move(s.x + s.width * 0.1, s.y + s.height / 2);
    ok((await now()) === "80", "siguió arrastrando tras soltar");
    await events();
  });
  await test("Slider: dos tiradores no se cruzan; setSliderValue()", async () => {
    await inject("Slider", 1);
    const [low, high] = [page.locator("#price .z-slider__thumb").first(), page.locator("#price .z-slider__thumb").last()];
    const r = await page.locator("#price .z-slider__range").evaluate((el) => [el.style.left, el.style.right]);
    ok(r[0] === "24%" && r[1] === "24%", `tramo entre tiradores: ${r}`);
    await low.focus();
    await press("End");
    ok((await now(low)) === "380" && (await now(high)) === "380", "el mínimo cruzó al máximo");
    await high.focus();
    await press("Home", "ArrowRight");
    ok((await now(high)) === "390", "el máximo cruzó al mínimo");
    const s = await page.locator("#price").boundingBox();
    await page.mouse.click(s.x + s.width * 0.1, s.y + s.height / 2);
    ok(
      (await now(low)) === "50" && (await now(high)) === "390",
      `la pista mueve el tirador más cercano: ${await now(low)}, ${await now(high)}`,
    );
    const last = (await events()).pop();
    ok(
      last.id === "price" && JSON.stringify(last.detail.value) === "[50,390]" && last.detail.index === 0,
      `z:change: ${JSON.stringify(last)}`,
    );
    await page.evaluate(async () => (await import("/zui/dist/zui.dom.js")).setSliderValue(document.querySelector("#price"), [100, 200]));
    ok((await page.locator("#price").getAttribute("data-value")) === "100,200" && (await events()).length === 1, "setSliderValue");
  });

  /* ---------- OTPInput ---------- */

  const cell = (i) => page.locator("#code .z-otp__cell").nth(i);
  const code = () => page.locator("#code .z-otp__cell").evaluateAll((list) => list.map((el) => el.value || "_").join(""));
  const focusedCell = () => page.evaluate(() => [...document.querySelectorAll("#code .z-otp__cell")].indexOf(document.activeElement));

  await test("OTPInput: avance automático, solo dígitos, retroceso y flechas", async () => {
    await cell(0).click();
    await page.keyboard.type("12a3");
    ok((await code()) === "123___" && (await focusedCell()) === 3, `avance: ${await code()} foco ${await focusedCell()}`);
    await press("Backspace");
    ok(
      (await code()) === "12____" && (await focusedCell()) === 2,
      `retroceso en casilla vacía: ${await code()} foco ${await focusedCell()}`,
    );
    await press("ArrowLeft");
    ok((await focusedCell()) === 1, "flecha izquierda");
    await page.keyboard.type("9");
    ok((await code()) === "19____" && (await focusedCell()) === 2, `sustituir un carácter: ${await code()}`);
    await press("ArrowLeft", "ArrowLeft", "Backspace");
    ok((await code()) === "9_____" && (await focusedCell()) === 0, `retroceso en casilla llena: ${await code()}`);
    await press("ArrowRight", "ArrowRight", "ArrowRight");
    ok((await focusedCell()) === 1, "la flecha no debe pasar de la primera casilla vacía");
    ok(
      (await page.locator('#code input[type="hidden"]').inputValue()) === "9" &&
        (await page.locator("#code").getAttribute("data-value")) === "9",
      "valor reflejado",
    );
    const seen = await events();
    ok(
      seen.length === 6 && seen.every((e) => e.id === "code" && e.detail.complete === false),
      `z:change: ${JSON.stringify(seen.map((e) => e.detail.value))}`,
    );
  });
  await test("OTPInput: pegar el código completo y setOtpValue()", async () => {
    await cell(0).evaluate((el) => {
      el.focus();
      const data = new DataTransfer();
      data.setData("text", " 48-15 16 ");
      // Firefox no acepta clipboardData al construir el evento: usa dataType y data.
      el.dispatchEvent(
        new ClipboardEvent("paste", { clipboardData: data, dataType: "text/plain", data: " 48-15 16 ", bubbles: true, cancelable: true }),
      );
    });
    ok((await code()) === "481516" && (await focusedCell()) === 5, `pegado: ${await code()} foco ${await focusedCell()}`);
    const seen = await events();
    ok(
      seen.length === 1 && seen[0].detail.value === "481516" && seen[0].detail.complete === true,
      `z:change al completar: ${JSON.stringify(seen)}`,
    );
    await page.locator("#code").screenshot({ path: join(shots, "otp.png") });
    await page.evaluate(async () => (await import("/zui/dist/zui.dom.js")).setOtpValue(document.querySelector("#code"), "42"));
    ok((await code()) === "42____" && (await page.locator('#code input[type="hidden"]').inputValue()) === "42", "setOtpValue");
    await events();
  });

  /* ---------- FileUpload ---------- */

  await test("FileUpload: elegir archivos filtra por accept, llena la lista y emite z:change", async () => {
    await page.locator("#images .z-upload__input").setInputFiles([
      { name: "cover.png", mimeType: "image/png", buffer: Buffer.alloc(2048) },
      { name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("x") },
    ]);
    ok(JSON.stringify(await page.locator("#images .z-upload__file-name").allTextContents()) === '["cover.png"]', "lista de archivos");
    ok(
      (await page.locator("#images .z-upload__file-size").textContent()) === "2.0 kB",
      `tamaño: ${await page.locator("#images .z-upload__file-size").textContent()}`,
    );
    ok(
      await page.locator("#images .z-upload__input").evaluate((el) => el.files.length === 1 && el.files[0].name === "cover.png"),
      "el campo conserva lo rechazado",
    );
    const seen = await events();
    ok(
      seen.length === 1 && seen[0].id === "images" && JSON.stringify(seen[0].detail) === '{"files":["cover.png"],"rejected":["notes.txt"]}',
      `z:change: ${JSON.stringify(seen)}`,
    );
  });
  await test("FileUpload: arrastrar marca la zona, soltar entrega y respeta el tamaño máximo", async () => {
    const zone = page.locator("#images");
    const state = await zone.evaluate((el) => {
      const data = new DataTransfer();
      data.items.add(new File([new Uint8Array(1500)], "one.jpg", { type: "image/jpeg" }));
      data.items.add(new File([new Uint8Array(300)], "two.png", { type: "image/png" }));
      data.items.add(new File([new Uint8Array(6 * 1024 * 1024)], "huge.png", { type: "image/png" }));
      const fire = (type) =>
        el.querySelector(".z-upload__label").dispatchEvent(new DragEvent(type, { dataTransfer: data, bubbles: true, cancelable: true }));
      const overPrevented = !fire("dragover");
      const dragging = el.getAttribute("data-dragging");
      const dropPrevented = !fire("drop");
      return { overPrevented, dragging, dropPrevented, after: el.getAttribute("data-dragging") };
    });
    ok(state.overPrevented && state.dropPrevented, "no se anuló el comportamiento del navegador al soltar");
    ok(state.dragging === "true" && state.after === null, `data-dragging: ${JSON.stringify(state)}`);
    ok(
      JSON.stringify(await page.locator("#images .z-upload__file-name").allTextContents()) === '["one.jpg","two.png"]',
      "lista tras soltar",
    );
    ok(await page.locator("#images .z-upload__input").evaluate((el) => el.files.length === 2), "el campo no recibió los archivos soltados");
    const seen = await events();
    ok(seen.length === 1 && JSON.stringify(seen[0].detail.rejected) === '["huge.png"]', `z:change: ${JSON.stringify(seen)}`);
    const box = await zone.boundingBox();
    const list = await page.locator("#images .z-upload__files").boundingBox();
    ok(list.x >= box.x && list.x + list.width <= box.x + box.width + 1, "la lista se sale de la zona");
    await zone.screenshot({ path: join(shots, "upload.png") });
  });
  await test("FileUpload: sin multiple solo entra un archivo", async () => {
    await inject("FileUpload", 1);
    const names = await page.locator("#contract").evaluate((el) => {
      const data = new DataTransfer();
      data.items.add(new File(["a"], "a.pdf", { type: "application/pdf" }));
      data.items.add(new File(["b"], "b.pdf", { type: "application/pdf" }));
      el.dispatchEvent(new DragEvent("drop", { dataTransfer: data, bubbles: true, cancelable: true }));
      return [...el.querySelector("input").files].map((f) => f.name);
    });
    ok(JSON.stringify(names) === '["a.pdf"]', `archivos: ${names}`);
    const seen = await events();
    ok(seen.length === 1 && JSON.stringify(seen[0].detail) === '{"files":["a.pdf"],"rejected":[]}', `z:change: ${JSON.stringify(seen)}`);
  });
}
