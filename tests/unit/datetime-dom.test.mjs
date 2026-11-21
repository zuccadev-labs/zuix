// DateField, TimeField y TimePicker: el modo DOM (zui/src/dom/forms-datefield.ts) sobre happy-dom y la paridad con
// el marcado del binding de React. La interacción real (foco, capa superior, validación nativa) se prueba en
// navegador: tests/html/cases/12-datetime-fields.mjs y tests/browser/cases.mjs.
import { click, mount, press } from "./helpers/dom.mjs";
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { render } from "./helpers/react.mjs";

document.body.setAttribute("data-z-dom", "");
const dom = await import("../../zui/src/dom/index.ts");
const { DateField } = await import("../../zui/src/components/forms/DateField.tsx");
const { TimeField } = await import("../../zui/src/components/forms/TimeField.tsx");
const { TimePicker } = await import("../../zui/src/components/forms/TimePicker.tsx");
dom.init();

const segments = (root) => [...root.querySelectorAll("[data-segment]")];
const texts = (root) => segments(root).map((s) => s.textContent);
const seg = (root, type) => root.querySelector(`[data-segment="${type}"]`);
/** Monta marcado y lo hidrata; devuelve el primer elemento y los z:change que emite. */
function setup(html) {
  const el = mount(html);
  dom.hydrate(document.body);
  const changes = [];
  el.addEventListener("z:change", (event) => changes.push(event.detail.value));
  return { el, changes };
}
const keyOn = (el, ...keys) => {
  for (const key of keys) press(document.activeElement ?? el, key);
};

describe("paridad con el binding de React", () => {
  test("el modo DOM pinta los mismos segmentos que el render de React (orden, textos y ARIA)", () => {
    for (const props of [
      { locale: "en-US", defaultValue: "2026-11-13" },
      { locale: "de", granularity: "minute", defaultValue: "2026-11-13T21:05" },
      { locale: "ja" },
      { locale: "en-US", granularity: "second", hourCycle: 24, defaultValue: "2026-01-02T03:04:05" },
    ]) {
      const html = render(DateField, { "aria-label": "Date", ...props });
      const fromReact = mount(html);
      const reactView = segments(fromReact).map((s) => [s.dataset.segment, s.textContent, s.getAttribute("aria-valuetext")]);
      const attrs = [
        `data-locale="${props.locale}"`,
        props.granularity ? `data-granularity="${props.granularity}"` : "",
        props.hourCycle ? `data-hour-cycle="${props.hourCycle}"` : "",
        props.defaultValue ? `data-value="${props.defaultValue}"` : "",
      ].join(" ");
      const { el } = setup(`<div class="z-input z-datefield" role="group" aria-label="Date" ${attrs}><input class="z-native-input"></div>`);
      const domView = segments(el).map((s) => [s.dataset.segment, s.textContent, s.getAttribute("aria-valuetext")]);
      assert.deepEqual(domView, reactView, JSON.stringify(props));
      assert.equal(el.querySelector(".z-native-input").value, props.defaultValue ?? "");
    }
  });
  test("TimeField y TimePicker: mismas clases y atributos de configuración", () => {
    const time = render(TimeField, { "aria-label": "T", locale: "en-US", showSeconds: true, minuteStep: 5 });
    assert.match(time, /class="z-input z-datefield z-timefield"/);
    assert.match(time, /data-granularity="second"/);
    assert.match(time, /data-minute-step="5"/);
    const picker = render(TimePicker, { "aria-label": "T", locale: "en-GB", variant: "list", step: 15, showNow: true, nowLabel: "Ahora" });
    assert.match(picker, /class="z-input z-datefield z-timefield z-timepicker"/);
    assert.match(picker, /data-variant="list"/);
    assert.match(picker, /data-step="15"/);
    assert.match(picker, /data-show-now=""/);
    assert.match(picker, /data-now-label="Ahora"/);
    assert.match(picker, /class="z-input__action z-timepicker__trigger"[^>]*aria-haspopup="dialog" aria-expanded="false"/);
  });
});

describe("modo DOM", () => {
  test("teclado: flechas, dígitos con avance, Retroceso; z:change con el valor o null", () => {
    const { el, changes } = setup(
      '<div class="z-input z-datefield" role="group" aria-label="Date" data-locale="en-US" data-value="2026-11-13"><input class="z-native-input"></div>',
    );
    assert.deepEqual(texts(el), ["11", "13", "2026"]);
    assert.deepEqual(
      segments(el).map((s) => s.tabIndex),
      [0, -1, -1],
    );
    seg(el, "month").focus();
    keyOn(el, "ArrowUp");
    assert.equal(el.dataset.value, "2026-12-13");
    keyOn(el, "0", "2");
    assert.equal(document.activeElement, seg(el, "day"));
    keyOn(el, "3", "1");
    assert.equal(el.dataset.value, undefined, "31 de febrero: sin valor");
    assert.equal(el.querySelector(".z-native-input").value, "");
    keyOn(el, "Backspace");
    assert.equal(seg(el, "year").textContent, "yyyy");
    assert.ok(seg(el, "year").hasAttribute("data-placeholder"));
    keyOn(el, "Backspace");
    assert.equal(document.activeElement, seg(el, "day"));
    keyOn(el, "ArrowLeft");
    assert.equal(document.activeElement, seg(el, "month"));
    // Cada cifra que cambia el valor lo emite: «0» deja el mes a medias (null), «2» completa febrero, «3» y «31».
    assert.deepEqual(changes, ["2026-12-13", null, "2026-02-13", "2026-02-03", null]);
  });
  test("pegar y setDateFieldValue()", () => {
    const { el, changes } = setup(
      '<div class="z-input z-datefield" role="group" aria-label="Date" data-locale="en-GB" data-granularity="minute"><input class="z-native-input"></div>',
    );
    const paste = new window.Event("paste", { bubbles: true, cancelable: true });
    paste.clipboardData = { getData: () => "13/11/2026, 21:05" };
    seg(el, "day").dispatchEvent(paste);
    assert.ok(paste.defaultPrevented);
    assert.equal(el.dataset.value, "2026-11-13T21:05");
    dom.setDateFieldValue(el, "2027-01-02T03:04");
    assert.deepEqual(texts(el), ["02", "01", "2027", "03", "04"]);
    dom.setDateFieldValue(el, null);
    assert.equal(el.dataset.value, undefined);
    assert.deepEqual(changes, ["2026-11-13T21:05", "2027-01-02T03:04", null]);
  });
  test("segmentos que no siguen el locale se rehacen con sus nombres; borrar vacía", () => {
    const { el } =
      setup(`<div class="z-input z-datefield" role="group" aria-label="Fecha" data-locale="de" data-value="2026-11-13" data-clearable>
      <span class="z-datefield__input"><span class="z-datefield__segment" data-segment="year" role="spinbutton" aria-label="Año">2026</span></span>
      <button type="button" class="z-input__action z-datefield__clear" aria-label="Borrar"></button><input class="z-native-input"></div>`);
    assert.deepEqual(
      segments(el).map((s) => s.dataset.segment),
      ["day", "month", "year"],
    );
    assert.equal(seg(el, "year").getAttribute("aria-label"), "Año", "conserva el nombre de la aplicación");
    assert.equal(seg(el, "day").getAttribute("aria-label"), "Day");
    assert.equal(el.querySelector(".z-datefield__literal").textContent, ".");
    const clear = el.querySelector(".z-datefield__clear");
    assert.equal(clear.hidden, false);
    click(clear);
    assert.equal(el.dataset.value, undefined);
    assert.equal(clear.hidden, true);
  });
  test("solo lectura, deshabilitado y validez nativa", () => {
    const { el } = setup(
      '<div class="z-input z-datefield z-timefield" role="group" aria-label="T" data-locale="en-GB" data-value="10:00" data-readonly data-min="09:00" data-max="09:30"><input class="z-native-input"></div>',
    );
    seg(el, "hour").focus();
    keyOn(el, "ArrowUp", "5");
    assert.equal(el.dataset.value, "10:00", "solo lectura");
    assert.equal(seg(el, "hour").getAttribute("aria-readonly"), "true");
    assert.equal(el.querySelector(".z-native-input").validationMessage, "Enter a time within the allowed range.");
    const off = setup('<div class="z-input z-datefield" role="group" aria-label="D" data-disabled><input class="z-native-input"></div>').el;
    assert.ok(segments(off).every((s) => !s.hasAttribute("tabindex") && s.getAttribute("aria-disabled") === "true"));
  });
  test("TimeField: AM/PM y pasos; setTimeFieldValue()", () => {
    const { el } = setup(
      '<div class="z-input z-datefield z-timefield" role="group" aria-label="T" data-locale="en-US" data-minute-step="15" data-value="09:10"><input class="z-native-input"></div>',
    );
    assert.deepEqual(texts(el), ["09", "10", "AM"]);
    seg(el, "minute").focus();
    keyOn(el, "ArrowUp");
    assert.equal(el.dataset.value, "09:15");
    seg(el, "dayPeriod").focus();
    keyOn(el, "p");
    assert.equal(el.dataset.value, "21:15");
    dom.setTimeFieldValue(el, "00:30");
    assert.deepEqual(texts(el), ["12", "30", "AM"]);
  });
  test("TimePicker: columnas y lista se rellenan al abrir; elegir actualiza el campo", () => {
    const html = (variant, extra = "") =>
      `<div><div class="z-input z-datefield z-timefield z-timepicker" role="group" aria-label="T" id="tp" data-locale="en-GB" data-variant="${variant}" ${extra}>
        <button type="button" class="z-input__action z-timepicker__trigger" aria-label="Choose time" aria-controls="tp-panel" aria-expanded="false"></button>
        <input class="z-native-input"></div>
        <div id="tp-panel" popover="manual" class="z-popover z-timepicker__panel" role="dialog" aria-label="Choose time"></div></div>`;
    const root = mount(html("columns", 'data-value="09:30" data-minute-step="15" data-show-now'));
    dom.hydrate(document.body);
    const field = root.querySelector("#tp");
    const panel = root.querySelector("#tp-panel");
    click(field.querySelector(".z-timepicker__trigger"));
    assert.equal(field.querySelector(".z-timepicker__trigger").getAttribute("aria-expanded"), "true");
    assert.deepEqual(
      [...panel.querySelectorAll("[role=listbox]")].map((l) => l.getAttribute("aria-label")),
      ["Hours", "Minutes"],
    );
    assert.equal(panel.querySelector('[data-column="hour"] [aria-selected="true"]').textContent, "09");
    assert.ok(panel.querySelector(".z-timepicker__now"));
    click(panel.querySelector('[data-column="minute"] [data-value="45"]'));
    assert.equal(field.dataset.value, "09:45");
    assert.equal(panel.querySelector('[data-column="minute"] [aria-selected="true"]').textContent, "45", "el panel sigue al valor");
    const hour = panel.querySelector('[data-column="hour"] [data-value="9"]');
    hour.focus();
    press(hour, "ArrowDown");
    assert.equal(field.dataset.value, "10:45", "la selección sigue al foco");
    dom.setTimePickerValue(field, "07:00");
    assert.equal(panel.querySelector('[data-column="hour"] [aria-selected="true"]').textContent, "07");
    click(panel.querySelector(".z-timepicker__now"));
    assert.match(field.dataset.value, /^\d{2}:\d{2}$/);

    const list = mount(html("list", 'data-step="60" data-min="09:00" data-max="12:00" data-disabled-times="10:00"'));
    dom.hydrate(document.body);
    const listField = list.querySelector("#tp");
    const listPanel = list.querySelector("#tp-panel");
    click(listField.querySelector(".z-timepicker__trigger"));
    const options = [...listPanel.querySelectorAll("[role=option]")];
    assert.deepEqual(
      options.map((o) => o.textContent),
      ["09:00", "10:00", "11:00", "12:00"],
    );
    assert.equal(options[1].getAttribute("aria-disabled"), "true");
    click(options[1]);
    assert.equal(listField.dataset.value, undefined, "deshabilitada: no se elige");
    options[0].focus();
    press(options[0], "1");
    assert.deepEqual(
      [...listPanel.querySelectorAll("[role=option]")].map((o) => o.textContent),
      ["10:00", "11:00", "12:00"],
    );
    assert.equal(listPanel.querySelector(".z-timepicker__query").textContent, "1");
    press(document.activeElement, "Escape");
    assert.equal(listPanel.querySelectorAll("[role=option]").length, 4, "Escape limpia el filtro");
    const eleven = listPanel.querySelector('[data-value="11:00"]');
    eleven.focus();
    press(eleven, "Enter");
    assert.equal(listField.dataset.value, "11:00");
  });
});
