// Matemática de fechas de Calendar. Las funciones (parse, addDays, addMonths, daysInMonth…) son privadas y están
// duplicadas en zui/src/dom/forms-calendar.ts y zui/src/components/forms/Calendar.tsx, así que se prueban por su
// superficie pública: la rejilla que dibuja cada implementación y la navegación por teclado del comportamiento DOM.
import { click, mount, press } from "./helpers/dom.mjs";
import assert from "node:assert/strict";
import { after, before, describe, mock, test } from "node:test";
import { render } from "./helpers/react.mjs";

document.body.setAttribute("data-z-dom", "");
const dom = await import("../../zui/src/dom/index.ts");
const { Calendar } = await import("../../zui/src/components/forms/Calendar.tsx");
dom.init();

const attrs = (data) =>
  Object.entries(data)
    .map(([k, v]) => `data-${k}="${v}"`)
    .join(" ");
/** Calendar sin framework con los atributos dados, ya hidratado. */
function domCalendar(data) {
  const cal = mount(`<div class="z-calendar" ${attrs(data)}></div>`);
  dom.hydrate(document.body);
  return cal;
}
const datesOf = (root) => [...root.querySelectorAll("[data-date]")].map((el) => el.getAttribute("data-date"));
const day = (cal, date) => cal.querySelector(`[data-date="${date}"]`);
const disabledOf = (root) => [...root.querySelectorAll('[data-date][aria-disabled="true"]')].map((el) => el.getAttribute("data-date"));
/** Rejilla del binding de React para las mismas opciones. */
function reactDates(props) {
  const html = render(Calendar, { locale: "en-US", ...props });
  return [...html.matchAll(/data-date="(\d{4}-\d{2}-\d{2})"/g)].map((m) => m[1]);
}
/** Pulsa una tecla en el día `from` y devuelve el día que queda con el foco. */
function move(cal, from, key, init) {
  day(cal, from).focus();
  const event = press(day(cal, from), key, init);
  assert.equal(event.defaultPrevented, true, `${key} debe consumirse`);
  return document.activeElement?.getAttribute("data-date");
}

describe("rejilla del mes", () => {
  test("febrero bisiesto (2024) tiene 29 días y empieza en la semana correcta (lunes)", () => {
    const dates = datesOf(domCalendar({ month: "2024-02", "week-start": 1 }));
    assert.equal(dates.length, 35);
    assert.equal(dates[0], "2024-01-29");
    assert.equal(dates.at(-1), "2024-03-03");
    assert.ok(dates.includes("2024-02-29"));
    assert.ok(!dates.includes("2024-02-30"));
  });
  test("febrero no bisiesto: 2023 y los seculares 1900 y 2100; 2000 sí lo es", () => {
    for (const [month, has29] of [
      ["2023-02", false],
      ["1900-02", false],
      ["2100-02", false],
      ["2000-02", true],
    ]) {
      const inMonth = datesOf(domCalendar({ month, "week-start": 1 })).filter((d) => d.startsWith(month));
      assert.equal(inMonth.length, has29 ? 29 : 28, month);
    }
  });
  test("un febrero de 28 días que empieza en el primer día de la semana ocupa exactamente 4 filas", () => {
    // 2026-02-01 es domingo.
    const dates = datesOf(domCalendar({ month: "2026-02", "week-start": 0 }));
    assert.equal(dates.length, 28);
    assert.equal(dates[0], "2026-02-01");
    assert.equal(dates.at(-1), "2026-02-28");
  });
  test("un mes de 31 días que empieza al final de la semana ocupa 6 filas", () => {
    // 2024-03-01 es viernes: con la semana en domingo hacen falta 6 filas.
    const dates = datesOf(domCalendar({ month: "2024-03", "week-start": 0 }));
    assert.equal(dates.length, 42);
    assert.equal(dates[0], "2024-02-25");
    assert.equal(dates.at(-1), "2024-04-06");
  });
  test("weekStart: la primera columna es ese día de la semana, para los 7 valores", () => {
    for (let start = 0; start < 7; start++) {
      const dates = datesOf(domCalendar({ month: "2025-07", "week-start": start }));
      assert.equal(new Date(`${dates[0]}T00:00:00Z`).getUTCDay(), start);
      assert.equal(dates.length % 7, 0);
      assert.ok(dates[0] <= "2025-07-01" && dates.at(-1) >= "2025-07-31");
    }
  });
  test("weekStart fuera de 0..6 se normaliza (−1 → sábado, 8 → lunes) y uno no entero se ignora", () => {
    assert.equal(new Date(`${datesOf(domCalendar({ month: "2025-07", "week-start": -1 }))[0]}T00:00:00Z`).getUTCDay(), 6);
    assert.equal(new Date(`${datesOf(domCalendar({ month: "2025-07", "week-start": 8 }))[0]}T00:00:00Z`).getUTCDay(), 1);
    // "x" no es un entero: decide el locale (en-US empieza en domingo).
    assert.equal(new Date(`${datesOf(domCalendar({ month: "2025-07", "week-start": "x", locale: "en-US" }))[0]}T00:00:00Z`).getUTCDay(), 0);
  });
  test("sin weekStart decide el locale: en-US domingo, es-ES lunes", () => {
    assert.equal(new Date(`${datesOf(domCalendar({ month: "2025-07", locale: "en-US" }))[0]}T00:00:00Z`).getUTCDay(), 0);
    assert.equal(new Date(`${datesOf(domCalendar({ month: "2025-07", locale: "es-ES" }))[0]}T00:00:00Z`).getUTCDay(), 1);
  });
  test("un locale inválido no rompe: se usa el de la plataforma", () => {
    const dates = datesOf(domCalendar({ month: "2025-07", locale: "no_es_un_locale!!" }));
    assert.equal(dates.length % 7, 0);
    assert.ok(dates.includes("2025-07-15"));
  });
  test("cambio de año: diciembre y enero enlazan con el año vecino", () => {
    const december = datesOf(domCalendar({ month: "2024-12", "week-start": 1 }));
    assert.equal(december[0], "2024-11-25");
    assert.equal(december.at(-1), "2025-01-05");
    const january = datesOf(domCalendar({ month: "2025-01", "week-start": 1 }));
    assert.equal(january[0], "2024-12-30");
  });
  test("los días son consecutivos y sin repetir, también en los cambios de hora locales", () => {
    // Las fechas se calculan en UTC: un día de 23 o 25 horas en la zona local no debe saltarse ni repetirse.
    for (const month of ["2024-03", "2024-10", "2024-11", "2025-03"]) {
      const dates = datesOf(domCalendar({ month, "week-start": 1 }));
      for (let i = 1; i < dates.length; i++) {
        assert.equal(
          Date.parse(`${dates[i]}T00:00:00Z`) - Date.parse(`${dates[i - 1]}T00:00:00Z`),
          86_400_000,
          `${dates[i - 1]} → ${dates[i]}`,
        );
      }
    }
  });
  test("outsideDays=false deja celdas vacías en lugar de los días vecinos", () => {
    const cal = domCalendar({ month: "2024-02", "week-start": 1, "outside-days": "false" });
    assert.equal(datesOf(cal).length, 29);
    assert.equal(cal.querySelectorAll("td.z-calendar__cell[data-outside]").length, 6);
  });
  test("un mes inválido en data-month se sustituye por el de la selección", () => {
    const cal = domCalendar({ month: "2024-13", value: "2023-05-10", "week-start": 1 });
    assert.equal(cal.dataset.month, "2023-05");
  });
  test("un valor que no es una fecha real (30 de febrero) se ignora", () => {
    const cal = domCalendar({ month: "2024-02", value: "2024-02-30", "week-start": 1 });
    assert.equal(cal.querySelectorAll("[data-selected]").length, 0);
  });
  test("años de menos de cuatro cifras se rellenan con ceros", () => {
    const dates = datesOf(domCalendar({ month: "0999-12", "week-start": 1 }));
    assert.ok(dates.includes("0999-12-31"));
    assert.ok(dates.includes("1000-01-01") || dates.at(-1) === "0999-12-31");
  });
});

describe("misma rejilla en el binding de React y en el comportamiento DOM", () => {
  for (const month of ["2024-02", "2023-02", "2024-12", "2025-01", "2026-02", "2024-03"]) {
    for (const start of [0, 1, 6]) {
      test(`${month}, semana desde ${start}`, () => {
        assert.deepEqual(reactDates({ month, weekStartsOn: start }), datesOf(domCalendar({ month, "week-start": start })));
      });
    }
  }
  test("min y max marcan los mismos días como no elegibles", () => {
    const html = render(Calendar, { locale: "en-US", month: "2024-02", weekStartsOn: 1, min: "2024-02-10", max: "2024-02-20" });
    const react = [...html.matchAll(/data-date="([\d-]+)"[^>]*aria-disabled="true"/g)].map((m) => m[1]);
    const cal = domCalendar({ month: "2024-02", "week-start": 1, min: "2024-02-10", max: "2024-02-20" });
    assert.deepEqual(react, disabledOf(cal));
    assert.ok(!react.includes("2024-02-10") && !react.includes("2024-02-20"), "min y max son inclusivos");
    assert.ok(react.includes("2024-02-09") && react.includes("2024-02-21"));
  });
  test("weekStartsOn=7 equivale a domingo en React", () => {
    assert.deepEqual(reactDates({ month: "2025-07", weekStartsOn: 7 }), reactDates({ month: "2025-07", weekStartsOn: 0 }));
  });
  test("React: la selección y el rango se marcan en el HTML del servidor", () => {
    const single = render(Calendar, { locale: "en-US", month: "2024-02", weekStartsOn: 1, value: "2024-02-29" });
    assert.match(single, /data-date="2024-02-29" data-selected=""/);
    const range = render(Calendar, {
      locale: "en-US",
      mode: "range",
      month: "2024-02",
      weekStartsOn: 1,
      value: { from: "2024-02-27", to: "2024-02-29" },
    });
    assert.equal([...range.matchAll(/aria-selected="true"/g)].length, 3);
    assert.match(range, /data-range="start"/);
    assert.match(range, /data-range="middle"/);
    assert.match(range, /data-range="end"/);
  });
  test("React: el HTML del servidor no marca 'hoy' (no depende del reloj)", () => {
    assert.doesNotMatch(render(Calendar, { locale: "en-US", weekStartsOn: 1 }), /data-today|aria-current/);
  });
});

describe("min y max", () => {
  test("los botones de mes se desactivan cuando el mes vecino queda fuera", () => {
    const cal = domCalendar({ month: "2024-02", "week-start": 1, min: "2024-02-01", max: "2024-02-29" });
    const [back, forward] = cal.querySelectorAll(".z-calendar__nav");
    assert.equal(back.disabled, true);
    assert.equal(forward.disabled, true);
  });
  test("si el último día del mes anterior es elegible, se puede retroceder", () => {
    const cal = domCalendar({ month: "2024-02", "week-start": 1, min: "2024-01-31", max: "2024-03-01" });
    const [back, forward] = cal.querySelectorAll(".z-calendar__nav");
    assert.equal(back.disabled, false);
    assert.equal(forward.disabled, false);
  });
  test("un min o max que no es fecha se ignora", () => {
    const cal = domCalendar({ month: "2024-02", "week-start": 1, min: "ayer", max: "2024-02-31" });
    assert.deepEqual(disabledOf(cal), []);
  });
  test("sin mes ni selección, se abre en min si hoy queda antes y en max si queda después", () => {
    assert.equal(domCalendar({ min: "2999-06-15" }).dataset.month, "2999-06");
    assert.equal(domCalendar({ max: "1999-06-15" }).dataset.month, "1999-06");
  });
  test("el teclado no sale de [min, max]: se queda en el límite", () => {
    const cal = domCalendar({ month: "2024-02", "week-start": 1, min: "2024-02-10", max: "2024-02-20" });
    assert.equal(move(cal, "2024-02-12", "ArrowUp"), "2024-02-10");
    assert.equal(move(cal, "2024-02-18", "PageDown"), "2024-02-20");
    assert.equal(cal.dataset.month, "2024-02");
  });
  test("un clic en un día fuera de rango no selecciona ni emite", () => {
    const cal = domCalendar({ month: "2024-02", "week-start": 1, min: "2024-02-10" });
    let events = 0;
    cal.addEventListener("z:change", () => events++);
    click(day(cal, "2024-02-09"));
    assert.equal(cal.dataset.value, undefined);
    assert.equal(events, 0);
    click(day(cal, "2024-02-10"));
    assert.equal(cal.dataset.value, "2024-02-10");
    assert.equal(events, 1);
  });
  test("días de la semana y fechas sueltas desactivados", () => {
    const cal = domCalendar({ month: "2024-02", "week-start": 1, "disabled-weekdays": "0,6", "disabled-dates": "2024-02-14, 2024-02-15" });
    const off = disabledOf(cal).filter((d) => d.startsWith("2024-02"));
    assert.ok(off.includes("2024-02-03") && off.includes("2024-02-04"), "sábado y domingo");
    assert.ok(off.includes("2024-02-14") && off.includes("2024-02-15"));
    assert.ok(!off.includes("2024-02-05"));
  });
});

describe("navegación por teclado (addDays / addMonths)", () => {
  const open = (month, extra = {}) => domCalendar({ month, "week-start": 1, ...extra });
  test("flechas: un día y una semana", () => {
    const cal = open("2024-02");
    assert.equal(move(cal, "2024-02-15", "ArrowRight"), "2024-02-16");
    assert.equal(move(cal, "2024-02-15", "ArrowLeft"), "2024-02-14");
    assert.equal(move(cal, "2024-02-15", "ArrowDown"), "2024-02-22");
    assert.equal(move(cal, "2024-02-15", "ArrowUp"), "2024-02-08");
  });
  test("cruzar el final del mes cambia el mes visible", () => {
    const cal = open("2024-02");
    assert.equal(move(cal, "2024-02-29", "ArrowRight"), "2024-03-01");
    assert.equal(cal.dataset.month, "2024-03");
  });
  test("cruzar el fin de año en los dos sentidos", () => {
    let cal = open("2024-12");
    assert.equal(move(cal, "2024-12-31", "ArrowRight"), "2025-01-01");
    assert.equal(cal.dataset.month, "2025-01");
    cal = open("2025-01");
    assert.equal(move(cal, "2025-01-01", "ArrowLeft"), "2024-12-31");
    assert.equal(cal.dataset.month, "2024-12");
    cal = open("2024-12");
    assert.equal(move(cal, "2024-12-28", "ArrowDown"), "2025-01-04");
  });
  test("Home y End van al primer y último día de la semana según weekStart", () => {
    // 2024-02-14 es miércoles.
    let cal = open("2024-02");
    assert.equal(move(cal, "2024-02-14", "Home"), "2024-02-12");
    assert.equal(move(cal, "2024-02-14", "End"), "2024-02-18");
    cal = open("2024-02", { "week-start": 0 });
    assert.equal(move(cal, "2024-02-14", "Home"), "2024-02-11");
    assert.equal(move(cal, "2024-02-14", "End"), "2024-02-17");
    cal = open("2024-02", { "week-start": 3 });
    assert.equal(move(cal, "2024-02-14", "Home"), "2024-02-14");
    assert.equal(move(cal, "2024-02-14", "End"), "2024-02-20");
  });
  test("PageDown/PageUp: un mes, conservando el día", () => {
    const cal = open("2024-02");
    assert.equal(move(cal, "2024-02-15", "PageDown"), "2024-03-15");
    assert.equal(move(cal, "2024-03-15", "PageUp"), "2024-02-15");
  });
  test("el día 31 cae en el último día de un mes más corto", () => {
    let cal = open("2024-01");
    assert.equal(move(cal, "2024-01-31", "PageDown"), "2024-02-29");
    cal = open("2023-01");
    assert.equal(move(cal, "2023-01-31", "PageDown"), "2023-02-28");
    cal = open("2024-03");
    assert.equal(move(cal, "2024-03-31", "PageUp"), "2024-02-29");
    cal = open("2024-05");
    assert.equal(move(cal, "2024-05-31", "PageDown"), "2024-06-30");
  });
  test("PageDown en diciembre y PageUp en enero cambian de año", () => {
    let cal = open("2024-12");
    assert.equal(move(cal, "2024-12-31", "PageDown"), "2025-01-31");
    cal = open("2025-01");
    assert.equal(move(cal, "2025-01-15", "PageUp"), "2024-12-15");
  });
  test("Mayús+PageDown/PageUp: un año; el 29 de febrero cae en el 28", () => {
    let cal = open("2024-02");
    assert.equal(move(cal, "2024-02-29", "PageDown", { shiftKey: true }), "2025-02-28");
    cal = open("2024-02");
    assert.equal(move(cal, "2024-02-29", "PageUp", { shiftKey: true }), "2023-02-28");
    cal = open("2023-02");
    assert.equal(move(cal, "2023-02-28", "PageDown", { shiftKey: true }), "2024-02-28");
  });
  test("una tecla que no navega no se consume", () => {
    const cal = open("2024-02");
    day(cal, "2024-02-15").focus();
    assert.equal(press(day(cal, "2024-02-15"), "a").defaultPrevented, false);
  });
});

describe("selección", () => {
  test("rango: el segundo clic anterior al primero invierte el rango", () => {
    const cal = domCalendar({ month: "2024-02", "week-start": 1, mode: "range" });
    const values = [];
    cal.addEventListener("z:change", (event) => values.push(event.detail.value));
    click(day(cal, "2024-02-20"));
    assert.equal(cal.dataset.value, "2024-02-20/");
    click(day(cal, "2024-02-10"));
    assert.equal(cal.dataset.value, "2024-02-10/2024-02-20");
    assert.deepEqual(values, [
      { from: "2024-02-20", to: null },
      { from: "2024-02-10", to: "2024-02-20" },
    ]);
    // Con el rango completo, el siguiente clic empieza uno nuevo.
    click(day(cal, "2024-02-05"));
    assert.equal(cal.dataset.value, "2024-02-05/");
  });
  test("rango de un solo día (mismo día dos veces)", () => {
    const cal = domCalendar({ month: "2024-02", "week-start": 1, mode: "range" });
    click(day(cal, "2024-02-20"));
    click(day(cal, "2024-02-20"));
    assert.equal(cal.dataset.value, "2024-02-20/2024-02-20");
    assert.equal(cal.querySelectorAll('td[aria-selected="true"]').length, 1);
  });
  test("un rango entre dos meses marca inicio, medio y fin", () => {
    const cal = domCalendar({ month: "2024-02", "week-start": 1, mode: "range", value: "2024-02-27/2024-03-02" });
    assert.equal(day(cal, "2024-02-27").parentElement.dataset.range, "start");
    assert.equal(day(cal, "2024-02-29").parentElement.dataset.range, "middle");
    assert.equal(day(cal, "2024-03-02").parentElement.dataset.range, "end");
    assert.equal(day(cal, "2024-03-03").parentElement.dataset.range, undefined);
  });
  test("un clic en un día de otro mes selecciona y muestra ese mes", () => {
    const cal = domCalendar({ month: "2024-02", "week-start": 1 });
    click(day(cal, "2024-03-02"));
    assert.equal(cal.dataset.value, "2024-03-02");
    assert.equal(cal.dataset.month, "2024-03");
  });
  test("setCalendarValue: fija el valor, muestra su mes y emite z:change; null lo borra", () => {
    const cal = domCalendar({ month: "2024-02", "week-start": 1 });
    const values = [];
    cal.addEventListener("z:change", (event) => values.push(event.detail.value));
    dom.setCalendarValue(cal, "2025-12-31");
    assert.equal(cal.dataset.month, "2025-12");
    assert.ok(day(cal, "2025-12-31").hasAttribute("data-selected"));
    dom.setCalendarValue(cal, null);
    assert.equal(cal.dataset.value, undefined);
    assert.deepEqual(values, ["2025-12-31", null]);
  });
});

describe("hoy (zona horaria local)", () => {
  const zone = process.env.TZ;
  before(() => mock.timers.enable({ apis: ["Date"], now: Date.parse("2024-03-01T03:30:00Z") }));
  after(() => {
    mock.timers.reset();
    if (zone === undefined) delete process.env.TZ;
    else process.env.TZ = zone;
  });
  test("al oeste de UTC todavía es el día anterior: hoy es 29 de febrero", () => {
    process.env.TZ = "America/New_York";
    const cal = domCalendar({ month: "2024-02", "week-start": 1 });
    assert.equal(cal.querySelector("[data-today]").dataset.date, "2024-02-29");
    assert.equal(cal.querySelector('[aria-current="date"]').dataset.date, "2024-02-29");
  });
  test("al este de UTC ya es 1 de marzo, y la rejilla no cambia", () => {
    process.env.TZ = "Pacific/Kiritimati";
    const cal = domCalendar({ month: "2024-03", "week-start": 1 });
    assert.equal(cal.querySelector("[data-today]").dataset.date, "2024-03-01");
    assert.equal(datesOf(cal)[0], "2024-02-26");
  });
  test("sin data-month se abre en el mes de hoy (local)", () => {
    process.env.TZ = "America/New_York";
    assert.equal(domCalendar({}).dataset.month, "2024-02");
  });
});
