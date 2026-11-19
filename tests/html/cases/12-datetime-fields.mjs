// DateField, TimeField y TimePicker sin framework: teclado APG de spinbutton, pegado, validez al salir, formulario,
// RTL y el panel de TimePicker (columnas y franjas), sobre el marcado de zui/html.json.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const contract = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../../../zui/html.json"), "utf8")).components;

export default async function ({ page, test, ok, settle, shots }) {
  await page.evaluate(() => {
    window.__zdate = [];
    document.addEventListener("z:change", (event) => {
      if (event.target.closest?.(".z-datefield")) window.__zdate.push({ id: event.target.id, value: event.detail.value });
    });
  });
  const events = () => page.evaluate(() => window.__zdate.splice(0));
  const press = async (...keys) => {
    for (const key of keys) await page.keyboard.press(key);
  };
  const type = (text) => page.keyboard.type(text);
  const segment = (id, name) => page.locator(`#${id} [data-segment="${name}"]`);
  const texts = (id) => page.locator(`#${id} [data-segment]`).allTextContents();
  const focused = () => page.evaluate(() => document.activeElement?.dataset?.segment ?? document.activeElement?.className ?? null);
  const value = (id) => page.locator(`#${id}`).evaluate((el) => el.dataset.value ?? null);
  const hidden = (id) => page.locator(`#${id} input.z-native-input`).inputValue();
  const invalid = (id) => page.locator(`#${id}`).evaluate((el) => el.hasAttribute("data-invalid"));
  /** Añade marcado (un ejemplo del contrato u otro) a la tarjeta del componente y lo activa con hydrate(). */
  const inject = (name, html) =>
    page.evaluate(
      async ([component, markup]) => {
        const stage = document.querySelector(`[data-component="${component}"] .demo__stage`);
        stage.insertAdjacentHTML("beforeend", markup);
        (await import("/zui/dist/zui.dom.js")).hydrate(stage);
      },
      [name, html],
    );
  const paste = (locator, text) =>
    locator.evaluate((el, data) => {
      el.focus();
      const transfer = new DataTransfer();
      transfer.setData("text", data);
      el.dispatchEvent(
        new ClipboardEvent("paste", { clipboardData: transfer, dataType: "text/plain", data, bubbles: true, cancelable: true }),
      );
    }, text);

  /* ---------- DateField ---------- */

  await test("DateField: flechas con ciclo, dígitos con avance, Retroceso y flechas entre segmentos", async () => {
    ok(JSON.stringify(await texts("deadline")) === '["11","13","2026"]', `orden en-US: ${await texts("deadline")}`);
    ok(
      (await page.locator("#deadline").getAttribute("role")) === "group" &&
        (await segment("deadline", "month").getAttribute("role")) === "spinbutton" &&
        (await segment("deadline", "month").getAttribute("aria-valuetext")) === "11 – November",
      "roles y aria-valuetext",
    );
    const tabbable = await page.locator("#deadline [data-segment]").evaluateAll((list) => list.map((s) => s.tabIndex).join(","));
    ok(tabbable === "0,-1,-1", `una sola parada de Tab: ${tabbable}`);
    await segment("deadline", "month").click();
    await press("ArrowUp");
    ok((await segment("deadline", "month").textContent()) === "12", "flecha arriba");
    await press("ArrowUp");
    ok((await segment("deadline", "month").textContent()) === "01", "ciclo 12 → 1");
    await press("ArrowDown");
    ok((await segment("deadline", "month").textContent()) === "12", "ciclo 1 → 12");
    await type("03");
    ok(
      (await focused()) === "day" && (await segment("deadline", "month").textContent()) === "03",
      `avance tras dos cifras: ${await focused()}`,
    );
    await type("4");
    ok((await focused()) === "year" && (await segment("deadline", "day").textContent()) === "04", "4 no admite otra cifra: avanza");
    await type("2027");
    ok((await value("deadline")) === "2027-03-04" && (await hidden("deadline")) === "2027-03-04", `valor: ${await value("deadline")}`);
    await press("Backspace");
    ok((await segment("deadline", "year").textContent()) === "yyyy" && (await value("deadline")) === null, "Retroceso vacía");
    await press("Backspace");
    ok((await focused()) === "day", "Retroceso en un segmento vacío vuelve al anterior");
    await press("End");
    ok((await segment("deadline", "day").textContent()) === "31", "Fin: máximo del mes");
    await press("Home", "ArrowLeft");
    ok((await focused()) === "month", "flecha izquierda");
    await press("ArrowRight", "ArrowRight");
    ok((await focused()) === "year", "flecha derecha");
    await type("26");
    ok((await segment("deadline", "year").textContent()) === "26", "año con dos cifras mientras se escribe");
    await press("Tab");
    ok(
      (await segment("deadline", "year").textContent()) === "0026" && (await value("deadline")) === "0026-03-01",
      "relleno del año al salir",
    );
    const seen = await events();
    ok(
      seen.length >= 3 && seen.every((e) => e.id === "deadline") && seen.at(-1).value === "0026-03-01",
      `z:change: ${JSON.stringify(seen)}`,
    );
    await page.locator("#deadline").screenshot({ path: join(shots, "datefield.png") });
  });

  await test("DateField: pegar una fecha ISO o en el formato del locale rellena todos los segmentos", async () => {
    await paste(segment("deadline", "day"), "2030-01-02");
    ok((await value("deadline")) === "2030-01-02" && JSON.stringify(await texts("deadline")) === '["01","02","2030"]', "ISO");
    await paste(segment("deadline", "year"), "12/25/2031");
    ok((await value("deadline")) === "2031-12-25", `formato en-US: ${await value("deadline")}`);
    await paste(segment("deadline", "month"), "not a date");
    ok((await value("deadline")) === "2031-12-25", "un texto que no es fecha no cambia nada");
    await events();
  });

  await test("DateField: 31 de febrero se acepta al teclear y se marca inválido al salir; se limpia al corregir", async () => {
    await segment("deadline", "month").click();
    await type("02");
    await type("31");
    ok((await segment("deadline", "day").textContent()) === "31" && !(await invalid("deadline")), "no se marca mientras se teclea");
    ok((await value("deadline")) === null, "sin valor mientras la fecha no existe");
    await press("Tab");
    await settle();
    ok((await invalid("deadline")) && (await segment("deadline", "day").getAttribute("aria-invalid")) === "true", "inválido al salir");
    ok(
      await page
        .locator("#deadline input.z-native-input")
        .evaluate((el) => el.validity.customError && el.validationMessage === "Enter a date that exists."),
      "validez nativa",
    );
    await segment("deadline", "day").click();
    await type("28");
    ok(!(await invalid("deadline")) && (await value("deadline")) === "2031-02-28", "corregido: deja de ser inválido");
    await page.locator("#deadline .z-datefield__clear").click();
    ok((await value("deadline")) === null && (await page.locator("#deadline .z-datefield__clear").isHidden()), "borrar");
    await events();
  });

  await test("DateField: orden y separadores del locale, fecha y hora en 24 h y RTL", async () => {
    await inject("DateField", contract.DateField.examples[1].html);
    ok(JSON.stringify(await texts("meeting")) === '["13","11","2026","09","30"]', `en-GB con hora: ${await texts("meeting")}`);
    await segment("meeting", "hour").click();
    await press("ArrowDown");
    ok((await value("meeting")) === "2026-11-13T08:30", `hora: ${await value("meeting")}`);
    await press("Home");
    ok((await segment("meeting", "hour").textContent()) === "00", "Inicio: 00 en 24 h");
    await inject(
      "DateField",
      `<div dir="rtl">${contract.DateField.examples[0].html.replace(/id="deadline"/, 'id="rtl-date"').replace(/name="deadline"/, "")}</div>`,
    );
    await segment("rtl-date", "month").click();
    await press("ArrowLeft");
    ok((await focused()) === "day", "RTL: la flecha izquierda va al segmento siguiente");
    const [month, day] = [await segment("rtl-date", "month").boundingBox(), await segment("rtl-date", "day").boundingBox()];
    ok(day.x < month.x, "RTL: el segmento siguiente queda a la izquierda");
    await press("ArrowRight");
    ok((await focused()) === "month", "RTL: la flecha derecha vuelve");
    await events();
  });

  await test("DateField: formulario con name y required; form.reset() vuelve al valor inicial", async () => {
    await inject(
      "DateField",
      `<form id="date-form">${contract.DateField.examples[2].html.replace(/start-date/g, "form-date")}<button type="submit" id="date-submit">Send</button></form>`,
    );
    await page.evaluate(() => document.querySelector("#date-form").addEventListener("submit", (event) => event.preventDefault()));
    ok(JSON.stringify(await texts("form-date")) === '["dd","mm","yyyy"]', "orden de alemán y marcadores");
    ok(!(await page.evaluate(() => document.querySelector("#date-form").checkValidity())), "obligatorio vacío no es válido");
    await page.locator("#date-submit").click();
    await settle();
    ok(
      (await focused()) === "day" && (await invalid("form-date")),
      `el envío inválido marca el campo y le lleva el foco: ${await focused()}`,
    );
    await type("1");
    ok(
      await page.evaluate(() => document.querySelector("#form-date input").validationMessage === "Enter a complete date."),
      "incompleto: mensaje propio",
    );
    await type("5");
    await type("06");
    await type("2026");
    const data = await page.evaluate(() => Object.fromEntries(new FormData(document.querySelector("#date-form"))));
    ok(data.start === "2026-06-15", `FormData: ${JSON.stringify(data)}`);
    ok(!(await invalid("form-date")), "completo y válido: sin marca");
    await page.evaluate(() => document.querySelector("#date-form").reset());
    await settle();
    ok((await value("form-date")) === null && JSON.stringify(await texts("form-date")) === '["dd","mm","yyyy"]', "reset");
    await events();
  });

  /* ---------- TimeField ---------- */

  await test("TimeField: 12 h con AM/PM, pasos de minuto y setTimeFieldValue()", async () => {
    ok(JSON.stringify(await texts("alarm")) === '["07","30","AM"]', `12 h: ${await texts("alarm")}`);
    await segment("alarm", "minute").click();
    await press("ArrowUp");
    ok((await value("alarm")) === "07:35", "paso de 5 minutos");
    await press("ArrowDown", "ArrowDown");
    ok((await value("alarm")) === "07:25", "paso hacia abajo");
    await press("ArrowRight");
    await type("p");
    ok((await value("alarm")) === "19:25" && (await segment("alarm", "dayPeriod").textContent()) === "PM", "p: PM");
    await segment("alarm", "hour").click();
    await type("12");
    ok((await value("alarm")) === "12:25", `12 PM es mediodía: ${await value("alarm")}`);
    await segment("alarm", "dayPeriod").click();
    await type("a");
    ok((await value("alarm")) === "00:25", `12 AM es 00: ${await value("alarm")}`);
    await segment("alarm", "minute").click();
    await press("ArrowDown");
    ok((await value("alarm")) === "00:20", "flecha abajo de 5 en 5");
    await page.evaluate(async () => (await import("/zui/dist/zui.dom.js")).setTimeFieldValue(document.querySelector("#alarm"), "13:05"));
    ok(JSON.stringify(await texts("alarm")) === '["01","05","PM"]' && (await hidden("alarm")) === "13:05", "setTimeFieldValue");
    const seen = await events();
    ok(seen.at(-1).value === "13:05", `z:change: ${JSON.stringify(seen)}`);
  });

  await test("TimeField: franja que cruza la medianoche (22:00–02:00) con segundos", async () => {
    await inject("TimeField", contract.TimeField.examples[1].html);
    await segment("night", "hour").click();
    await type("233000");
    ok((await value("night")) === "23:30:00", `valor: ${await value("night")}`);
    await press("Tab");
    await settle();
    ok(!(await invalid("night")), "23:30 está dentro de la franja");
    await segment("night", "hour").click();
    await type("12");
    await press("Tab");
    await settle();
    ok((await invalid("night")) && (await value("night")) === "12:30:00", "12:30 queda fuera");
    ok(
      await page.locator("#night input.z-native-input").evaluate((el) => el.validationMessage === "Enter a time within the allowed range."),
      "mensaje de rango",
    );
    await segment("night", "hour").click();
    await type("01");
    ok(!(await invalid("night")) && (await value("night")) === "01:30:00", "01:30 vuelve a la franja");
    await events();
  });

  /* ---------- TimePicker ---------- */

  const panelOpen = (id) => page.locator(`#${id}-panel`).evaluate((el) => el.matches(":popover-open"));
  const activeOption = () =>
    page.evaluate(() => {
      const el = document.activeElement;
      return el?.getAttribute("role") === "option" ? `${el.closest("[data-column]")?.dataset.column ?? "list"}:${el.textContent}` : null;
    });

  await test("TimePicker: columnas con teclado (flechas, Tab entre columnas, Intro cierra) y botón Now", async () => {
    const trigger = page.locator("#start-time .z-timepicker__trigger");
    await trigger.click();
    await settle();
    ok(await panelOpen("start-time"), "no abrió");
    ok((await trigger.getAttribute("aria-expanded")) === "true", "aria-expanded");
    const labels = await page
      .locator("#start-time-panel [role=listbox]")
      .evaluateAll((l) => l.map((x) => x.getAttribute("aria-label")).join(","));
    ok(labels === "Hours,Minutes,AM/PM", `columnas: ${labels}`);
    ok((await activeOption()) === "hour:09", `foco inicial: ${await activeOption()}`);
    await page.screenshot({ path: join(shots, "timepicker-columns.png") });
    await press("ArrowDown");
    ok((await value("start-time")) === "10:30" && (await activeOption()) === "hour:10", "la selección sigue al foco");
    await press("Tab");
    ok((await activeOption()) === "minute:30", `Tab a la columna de minutos: ${await activeOption()}`);
    await press("ArrowDown");
    ok((await value("start-time")) === "10:35", "minutos de 5 en 5");
    await press("ArrowRight", "ArrowDown");
    ok((await value("start-time")) === "22:35", `PM: ${await value("start-time")}`);
    await press("Enter");
    await settle();
    ok(!(await panelOpen("start-time")), "Intro cierra");
    ok(
      await page.evaluate(() => document.activeElement === document.querySelector("#start-time .z-timepicker__trigger")),
      "el foco vuelve al botón",
    );
    ok(JSON.stringify(await texts("start-time")) === '["10","35","PM"]', "los segmentos siguen al panel");
    // Alt+Flecha abajo desde un segmento abre; Escape cierra sin cambiar.
    await segment("start-time", "minute").click();
    await page.keyboard.press("Alt+ArrowDown");
    await settle();
    ok(await panelOpen("start-time"), "Alt+Flecha abajo abre");
    await press("Escape");
    await settle();
    ok(!(await panelOpen("start-time")) && (await value("start-time")) === "22:35", "Escape cierra sin cambiar");
    await trigger.click();
    await settle();
    await page.locator("#start-time-panel .z-timepicker__now").click();
    await settle();
    ok(!(await panelOpen("start-time")) && /^\d{2}:\d{2}$/.test((await value("start-time")) ?? ""), "Now elige la hora actual");
    await page.evaluate(async () =>
      (await import("/zui/dist/zui.dom.js")).setTimePickerValue(document.querySelector("#start-time"), "06:00"),
    );
    ok((await value("start-time")) === "06:00", "setTimePickerValue");
    await events();
  });

  await test("TimePicker: lista de franjas dentro de min/max, deshabilitadas, filtro al teclear e Intro elige", async () => {
    await inject("TimePicker", contract.TimePicker.examples[1].html);
    await page.locator("#slot .z-timepicker__trigger").click();
    await settle();
    ok(await panelOpen("slot"), "no abrió");
    const options = await page.locator("#slot-panel [role=option]").allTextContents();
    ok(options.length === 17 && options[0] === "09:00" && options.at(-1) === "17:00", `franjas: ${options.join(",")}`);
    ok((await page.locator('#slot-panel [data-value="12:00"]').getAttribute("aria-disabled")) === "true", "12:00 deshabilitada");
    ok((await activeOption()) === "list:09:00", `foco inicial: ${await activeOption()}`);
    await press("ArrowDown", "ArrowDown");
    ok((await activeOption()) === "list:10:00", "flechas mueven sin elegir");
    ok((await value("slot")) === null, "mover no elige");
    await type("14");
    const filtered = await page.locator("#slot-panel [role=option]").allTextContents();
    ok(filtered.join(",") === "14:00,14:30" && (await activeOption()) === "list:14:00", `filtro: ${filtered.join(",")}`);
    await page.screenshot({ path: join(shots, "timepicker-list.png") });
    await press("Escape");
    ok((await panelOpen("slot")) && (await page.locator("#slot-panel [role=option]").count()) === 17, "Escape limpia el filtro sin cerrar");
    await type("143");
    await press("Enter");
    await settle();
    ok(!(await panelOpen("slot")) && (await value("slot")) === "14:30", `Intro elige: ${await value("slot")}`);
    await page.locator("#slot .z-timepicker__trigger").click();
    await settle();
    await page.locator('#slot-panel [data-value="12:00"]').click({ force: true });
    ok((await panelOpen("slot")) && (await value("slot")) === "14:30", "una franja deshabilitada no se elige");
    await page.locator('#slot-panel [data-value="16:00"]').click();
    await settle();
    ok(!(await panelOpen("slot")) && (await value("slot")) === "16:00", "clic elige y cierra");
    await events();
  });
}
