// Lógica compartida de zui (`zui/src/core`): módulos sin React que consumen a la vez el binding de React y
// `@zuccadev-labs/zuix-zui/dom`. Aquí se prueban directamente; su uso desde cada lado lo cubren dom-logic, calendar,
// pagination y datatable (superficie pública) y las suites de navegador.
import { mount, press, setRect, window } from "./helpers/dom.mjs";
import assert from "node:assert/strict";
import { describe, mock, test } from "node:test";

const core = (name) => import(`../../zui/src/core/${name}.ts`);
const { computePlace, submenuAnchor } = await core("place");
const { move, step, moveBoth } = await core("roving");
const { createTypeahead, isPrintable } = await core("typeahead");
const { fold, score } = await core("search");
const { pageRange, pageTotal, clampPage } = await core("pagination");
const { compare, parseNumber, isDate } = await core("compare");
const { matchesAccept } = await core("accept");
const slider = await core("slider");
const date = await core("date");
const { createTimer } = await core("timer");
const { inPolygon, graceArea, createMenuAim } = await core("menu-aim");
const layers = await core("layers");
const focus = await core("focus");
const { afterExit } = await core("presence");
const { lockScroll } = await core("scroll-lock");
const { swipeDirection, swipeToDismiss } = await core("swipe");
const { createLongPress } = await core("long-press");
const { byRef } = await core("ref");
const { occurrenceKeys } = await core("keys");
const { mergeProps } = await import("../../zui/src/primitives/slot.ts");

describe("core/place: computePlace", () => {
  const viewport = { width: 1000, height: 800 };
  const size = { width: 200, height: 100 };
  const at = (anchor, placement, extra = {}) => computePlace({ anchor, size, viewport, placement, gap: 6, ...extra });
  const box = (left, top, width, height) => ({ left, top, width, height });

  test("lado y alineación pedidos", () => {
    assert.deepEqual(at(box(100, 100, 80, 30), "bottom-start"), {
      x: 100,
      y: 136,
      side: "bottom",
      align: "start",
      availableWidth: 984,
      availableHeight: 656,
    });
    assert.equal(at(box(400, 100, 80, 30), "bottom-end").x, 280);
    assert.equal(at(box(400, 100, 80, 30), "bottom").align, "center");
    assert.deepEqual([at(box(400, 300, 80, 30), "right-start").x, at(box(400, 300, 80, 30), "right-start").y], [486, 300]);
  });
  test("en RTL `start` es el borde derecho del ancla y `end` el izquierdo", () => {
    assert.equal(at(box(400, 100, 80, 30), "bottom-start", { rtl: true }).x, 280);
    assert.equal(at(box(400, 100, 80, 30), "bottom-end", { rtl: true }).x, 400);
    assert.equal(at(box(400, 100, 80, 30), "bottom", { rtl: true }).x, 340);
  });
  test("voltea al lado opuesto si no cabe, y `lockSide` lo impide", () => {
    assert.equal(at(box(100, 740, 80, 30), "bottom-start").side, "top");
    assert.equal(at(box(100, 740, 80, 30), "bottom-start", { lockSide: "bottom" }).side, "bottom");
    assert.equal(at(box(100, 50, 80, 30), "top").side, "bottom");
    assert.equal(at(box(900, 300, 80, 30), "right").side, "left");
    assert.equal(at(box(50, 300, 80, 30), "left").side, "right");
  });
  test("hueco disponible: el del lado elegido, sin margen", () => {
    const below = at(box(100, 500, 80, 30), "bottom-start");
    assert.equal(below.availableHeight, 800 - 530 - 6 - 8);
    const above = at(box(100, 740, 80, 30), "bottom-start");
    assert.equal(above.availableHeight, 740 - 6 - 8);
    const right = at(box(400, 300, 80, 30), "right");
    assert.equal(right.availableWidth, 1000 - 480 - 6 - 8);
    assert.equal(right.availableHeight, 800 - 16);
  });
  test("nunca sale de la ventana y redondea al píxel", () => {
    assert.equal(at(box(950, 100, 40, 30), "bottom-start").x, 792);
    assert.equal(at(box(-50, 100, 40, 30), "bottom-end").x, 8);
    assert.equal(at(box(100.4, 100.6, 81, 30), "bottom").y, 137);
  });
  test("submenuAnchor: borde del menú padre a la altura de la entrada", () => {
    assert.deepEqual(submenuAnchor(box(10, 20, 200, 300), box(16, 100, 188, 32), 7), { left: 10, top: 93, width: 200, height: 46 });
  });
});

describe("core/roving", () => {
  const list = ["a", "b", "c"];
  test("move: flechas del eje con vuelta, Home y End", () => {
    assert.equal(move(list, "a", "ArrowDown", true), "b");
    assert.equal(move(list, "c", "ArrowDown", true), "a");
    assert.equal(move(list, "a", "ArrowUp", true), "c");
    assert.equal(move(list, "b", "ArrowRight", false), "c");
    assert.equal(move(list, "b", "ArrowLeft", false), "a");
    assert.equal(move(list, "b", "Home", false), "a");
    assert.equal(move(list, "b", "End", true), "c");
  });
  test("move: las flechas del otro eje y las demás teclas no navegan", () => {
    assert.equal(move(list, "a", "ArrowRight", true), undefined);
    assert.equal(move(list, "a", "ArrowDown", false), undefined);
    assert.equal(move(list, "a", "x", true), undefined);
    assert.equal(move([], null, "ArrowDown", true), undefined);
  });
  test("move sin vuelta se queda en el extremo; sin elemento actual empieza por el primero o el último", () => {
    assert.equal(move(list, "c", "ArrowDown", true, false), "c");
    assert.equal(move(list, "a", "ArrowUp", true, false), "a");
    assert.equal(move(list, null, "ArrowDown", true, false), "a");
    assert.equal(move(list, null, "ArrowUp", true, false), "c");
  });
  test("step y moveBoth", () => {
    assert.equal(step(list, "c", "ArrowDown", false), "c");
    assert.equal(step(list, "c", "ArrowDown", true), "a");
    assert.equal(moveBoth(list, "a", "ArrowRight"), "b");
    assert.equal(moveBoth(list, "a", "ArrowDown"), "b");
    assert.equal(moveBoth(list, "a", "ArrowLeft"), "c");
  });
});

describe("core/typeahead", () => {
  const labels = ["Apple", "Banana", "Blueberry", "Cherry", "Ábaco"];
  test("una letra va a la siguiente que empieza por ella; repetirla las recorre", () => {
    const now = 0;
    const search = createTypeahead(1000, () => now);
    assert.equal(search(labels, "b", -1), 1);
    assert.equal(search(labels, "b", 1), 2);
    assert.equal(search(labels, "b", 2), 1);
  });
  test("varias letras forman un prefijo y buscan desde la actual", () => {
    let now = 0;
    const search = createTypeahead(1000, () => now);
    assert.equal(search(labels, "b", -1), 1);
    now = 100;
    assert.equal(search(labels, "l", 1), 2);
    assert.equal(search.pending(), true);
  });
  test("pasado el plazo empieza una búsqueda nueva", () => {
    let now = 0;
    const search = createTypeahead(600, () => now);
    search(labels, "b", -1);
    now = 601;
    assert.equal(search.pending(), false);
    assert.equal(search(labels, "c", 1), 3);
    search.reset();
    assert.equal(search.pending(), false);
  });
  test("sin mayúsculas ni acentos; sin coincidencia devuelve -1", () => {
    const search = createTypeahead();
    assert.equal(search(labels, "A", 0), 4);
    search.reset();
    assert.equal(search(labels, "z", 0), -1);
    search.reset();
    assert.equal(search([], "a", -1), -1);
  });
  test("isPrintable", () => {
    const key = (k, mods = {}) => ({ key: k, ctrlKey: false, metaKey: false, altKey: false, ...mods });
    assert.equal(isPrintable(key("a")), true);
    assert.equal(isPrintable(key(" ")), true);
    assert.equal(isPrintable(key("Enter")), false);
    assert.equal(isPrintable(key("a", { ctrlKey: true })), false);
    assert.equal(isPrintable({ ctrlKey: false, metaKey: false, altKey: false }), false);
  });
});

describe("core/search", () => {
  test("fold y score: prefijo > contiene > subsecuencia, sin acentos", () => {
    assert.equal(fold("Configuración"), "configuracion");
    assert.equal(score("conf", "Configuración"), 3);
    assert.equal(score("guracion", "Configuración"), 2);
    assert.equal(score("cfg", "Configuración"), 1);
    assert.equal(score("xyz", "Configuración"), 0);
    assert.equal(score("CONFIGURACIÓN", "configuracion"), 3);
    // La subsecuencia se cuenta por caracteres: un emoji ocupa dos unidades UTF-16.
    assert.equal(score("🚀!", "🚀 despegue!"), 1);
    assert.equal(score("🚀x", "🚀 despegue!"), 0);
  });
});

describe("core/keys", () => {
  test("occurrenceKeys: una clave por elemento, estable al quitar entradas por delante", () => {
    assert.deepEqual(occurrenceKeys(["Ctrl", "Shift", "K"]), ["Ctrl", "Shift", "K"]);
    assert.deepEqual(occurrenceKeys(["a", "b", "a", "a"]), ["a", "b", "a#1", "a#2"]);
    assert.deepEqual(occurrenceKeys(["b", "a"]), ["b", "a"], "«b» conserva su clave al desaparecer la primera entrada");
    assert.equal(new Set(occurrenceKeys(["", "", "x", "x"])).size, 4);
    assert.deepEqual(occurrenceKeys([]), []);
  });
});

describe("core/pagination", () => {
  test("pageTotal y clampPage toleran valores no numéricos", () => {
    assert.equal(pageTotal(Number.NaN), 1);
    assert.equal(pageTotal(0), 1);
    assert.equal(pageTotal(7.9), 7);
    assert.equal(pageTotal(Number.POSITIVE_INFINITY), 1);
    assert.equal(clampPage(2.5, 20), 3);
    assert.equal(clampPage(-4, 20), 1);
    assert.equal(clampPage(1e9, 20), 20);
    assert.equal(clampPage(Number.NaN, 20), 1);
    assert.equal(clampPage(Number.NaN, 20, 5), 5);
    assert.equal(clampPage(Number.POSITIVE_INFINITY, 20), 20);
    assert.equal(clampPage(Number.NaN, 20, Number.NaN), 1);
  });
  test("pageRange", () => {
    assert.deepEqual(pageRange(1, 5, 1), [1, 2, 3, 4, 5]);
    assert.deepEqual(pageRange(1, 20, 1), [1, 2, 3, 4, 5, 0, 20]);
    assert.deepEqual(pageRange(10, 20, 1), [1, 0, 9, 10, 11, 0, 20]);
    assert.deepEqual(pageRange(20, 20, 1), [1, 0, 16, 17, 18, 19, 20]);
  });
});

describe("core/compare", () => {
  test("vacíos, NaN y fechas inválidas al final; el resto por tipo", () => {
    const sorted = [3, Number.NaN, 1, null, 2, undefined].sort(compare);
    assert.deepEqual(sorted.slice(0, 3), [1, 2, 3]);
    assert.equal(compare(null, undefined), 0);
    assert.equal(compare(Number.NaN, 1), 1);
    assert.equal(compare(1, Number.NaN), -1);
    assert.ok(compare(new Date(2020, 0, 1), new Date(2021, 0, 1)) < 0);
    assert.equal(compare(new Date("x"), new Date(2021, 0, 1)), 1);
    assert.equal(compare(false, true), -1);
    assert.ok(compare("item 2", "item 10") < 0);
    assert.equal(compare("ABC", "abc"), 0);
    assert.equal(isDate(new Date()), true);
    assert.equal(isDate("2020-01-01"), false);
  });
  test("parseNumber: sin cifras es vacío, no cero", () => {
    assert.equal(parseNumber("n/d"), null);
    assert.equal(parseNumber("—"), null);
    assert.equal(parseNumber("-"), null);
    assert.equal(parseNumber("$ 1234.5"), 1234.5);
    assert.equal(parseNumber("-5"), -5);
    assert.equal(parseNumber("1.2.3"), null);
    assert.equal(parseNumber("0"), 0);
  });
});

describe("core/accept", () => {
  const file = (name, type) => ({ name, type });
  test("extensiones, tipos MIME y comodines; vacío acepta todo", () => {
    assert.equal(matchesAccept(file("a.PDF", "application/pdf"), ".pdf"), true);
    assert.equal(matchesAccept(file("a.png", "image/png"), "image/*"), true);
    assert.equal(matchesAccept(file("a.png", "image/png"), "image/jpeg, .png"), true);
    assert.equal(matchesAccept(file("a.txt", "text/plain"), "image/*,.pdf"), false);
    assert.equal(matchesAccept(file("a.txt", "text/plain"), ""), true);
    assert.equal(matchesAccept(file("a.txt", "text/plain"), undefined), true);
    assert.equal(matchesAccept(file("a.txt", "text/plain"), " , "), true);
  });
});

describe("core/slider", () => {
  test("snap: paso desde min, sin ruido de coma flotante; NaN e infinitos acotados", () => {
    assert.equal(slider.snap(0.1 + 0.2, 0, 1, 0.1), 0.3);
    assert.equal(slider.snap(7, 5, 50, 10), 5);
    assert.equal(slider.snap(11, 5, 50, 10), 15);
    assert.equal(slider.snap(999, 0, 100, 5), 100);
    assert.equal(slider.snap(Number.NaN, 10, 100, 5), 10);
    assert.equal(slider.snap(Number.POSITIVE_INFINITY, 10, 100, 5), 100);
    assert.equal(slider.snap(Number.NEGATIVE_INFINITY, 10, 100, 5), 10);
    assert.equal(slider.snap(42.4, 0, 100, 0), 42);
    assert.equal(slider.snap(42.4, 0, 100, Number.NaN), 42);
  });
  test("snap: el tope es el último paso que cabe, y volver a ajustar no mueve el valor", () => {
    assert.equal(slider.snap(11, 0, 10, 3), 9);
    assert.equal(slider.snap(10, 0, 10, 3), 9);
    assert.equal(slider.snap(Number.POSITIVE_INFINITY, 0, 10, 3), 9);
    assert.equal(slider.snap(1, 0, 1, 2), 0);
    assert.equal(slider.snap(0.95, 0, 1, 0.3), 0.9);
    assert.equal(slider.snap(Number.POSITIVE_INFINITY, 0, 1, Number.MIN_VALUE), 1);
  });
  test("percent y valueAt", () => {
    assert.equal(slider.percent(25, 0, 100), 25);
    assert.equal(slider.percent(5, 5, 5), 0);
    assert.equal(slider.valueAt(0.5, 0, 200), 100);
    assert.equal(slider.valueAt(-1, 0, 200), 0);
    assert.equal(slider.valueAt(9, 0, 200), 200);
  });
  test("keyValue: flechas, Inicio/Fin, Re/Av Pág y Mayús; ejes invertidos", () => {
    const k = (key, shift = false, dirX = 1, dirY = 1) => slider.keyValue(key, shift, 50, 0, 100, 5, dirX, dirY);
    assert.equal(k("ArrowRight"), 55);
    assert.equal(k("ArrowLeft"), 45);
    assert.equal(k("ArrowUp"), 55);
    assert.equal(k("ArrowDown"), 45);
    assert.equal(k("ArrowRight", true), 100);
    assert.equal(k("PageUp"), 100);
    assert.equal(k("PageDown"), 0);
    assert.equal(k("Home"), 0);
    assert.equal(k("End"), 100);
    assert.equal(k("ArrowRight", false, -1), 45);
    assert.equal(k("ArrowLeft", false, -1), 55);
    assert.equal(k("ArrowUp", false, 1, -1), 45);
    assert.equal(k("ArrowDown", false, 1, -1), 55);
    assert.equal(k("a"), undefined);
  });
  test("closestThumb y moveThumb: cada tirador se mueve entre sus vecinos", () => {
    assert.equal(slider.closestThumb([20, 80], 30), 0);
    assert.equal(slider.closestThumb([20, 80], 70), 1);
    assert.deepEqual(slider.moveThumb([20, 80], 0, 95, 0, 100, 5), [80, 80]);
    assert.deepEqual(slider.moveThumb([20, 80], 0, 95, 0, 100, 5, 2), [70, 80]);
    assert.deepEqual(slider.moveThumb([20, 80], 1, 5, 0, 100, 5), [20, 20]);
    assert.equal(slider.moveThumb([20, 80], 0, 21, 0, 100, 5), null);
    assert.equal(slider.moveThumb([20, 80], 5, 21, 0, 100, 5), null);
    assert.deepEqual(slider.moveThumb([50], 0, 62, 0, 100, 5), [60]);
  });
});

describe("core/date", () => {
  test("valid, addDays, addMonths, daysInMonth", () => {
    assert.equal(date.valid("2026-02-28"), true);
    assert.equal(date.valid("2026-02-30"), false);
    assert.equal(date.valid("2026-2-3"), false);
    assert.equal(date.valid(null), false);
    assert.equal(date.addDays("2026-12-31", 1), "2027-01-01");
    assert.equal(date.addDays("2024-03-01", -1), "2024-02-29");
    assert.equal(date.addMonths("2026-01-31", 1), "2026-02-28");
    assert.equal(date.addMonths("2024-01-31", 1), "2024-02-29");
    assert.equal(date.addMonths("2026-03-15", -3), "2025-12-15");
    assert.equal(date.daysInMonth(2024, 1), 29);
    assert.equal(date.monthOf("2026-11-17"), "2026-11");
    assert.equal(date.MONTH.test("2026-13"), false);
    assert.equal(date.format(date.parse("0099-01-01")), "0099-01-01");
  });
  test("todayISO usa la fecha local", () => {
    mock.timers.enable({ apis: ["Date"], now: new Date(2026, 10, 17, 23, 30) });
    assert.equal(date.todayISO(), "2026-11-17");
    mock.timers.reset();
  });
  test("parseRange, rangeText, safeLocale y localeWeekStart", () => {
    assert.deepEqual(date.parseRange("2026-11-09/2026-11-14"), { from: "2026-11-09", to: "2026-11-14" });
    assert.deepEqual(date.parseRange("2026-11-09/"), { from: "2026-11-09", to: null });
    assert.deepEqual(date.parseRange("nope/2026-99-99"), { from: null, to: null });
    assert.deepEqual(date.parseRange(undefined), { from: null, to: null });
    assert.equal(date.rangeText({ from: "2026-11-09", to: null }), "2026-11-09/");
    assert.equal(date.rangeText({ from: null, to: "2026-11-09" }), "");
    assert.equal(date.rangeText(null), "");
    assert.equal(date.safeLocale("en-US"), "en-US");
    assert.equal(date.safeLocale(undefined), undefined);
    assert.equal(date.safeLocale("no es un locale"), undefined);
    assert.equal(date.localeWeekStart("en-US"), 0);
    assert.equal(date.localeWeekStart("es-ES"), 1);
    assert.equal(date.localeWeekStart("***"), 1);
    assert.ok(date.localeWeekStart() >= 0);
  });
});

describe("core/timer", () => {
  test("corre, se detiene con cada motivo de pausa y continúa con lo que quedaba", () => {
    mock.timers.enable({ apis: ["setTimeout", "Date"], now: 0 });
    let done = 0;
    const timer = createTimer(1000, () => done++);
    timer.start();
    mock.timers.tick(400);
    timer.hold("pointer");
    timer.hold("focus");
    mock.timers.tick(5000);
    assert.equal(done, 0);
    timer.release("pointer");
    mock.timers.tick(5000);
    assert.equal(done, 0, "sigue en pausa mientras quede un motivo");
    timer.release("focus");
    timer.release("focus");
    mock.timers.tick(599);
    assert.equal(done, 0);
    mock.timers.tick(1);
    assert.equal(done, 1);
    mock.timers.reset();
  });
  test("duración 0 o no finita no cierra nunca; stop cancela", () => {
    mock.timers.enable({ apis: ["setTimeout", "Date"], now: 0 });
    let done = 0;
    for (const duration of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) createTimer(duration, () => done++).start();
    const timer = createTimer(100, () => done++);
    timer.start();
    timer.stop();
    timer.start();
    mock.timers.tick(10000);
    assert.equal(done, 0);
    mock.timers.reset();
  });
});

describe("core/menu-aim", () => {
  const sub = { left: 200, top: 100, width: 150, height: 200 };
  test("inPolygon y graceArea", () => {
    const area = graceArea({ x: 150, y: 150 }, sub, "right");
    assert.equal(area.length, 5);
    assert.equal(inPolygon({ x: 180, y: 150 }, area), true);
    assert.equal(inPolygon({ x: 250, y: 150 }, area), true);
    assert.equal(inPolygon({ x: 160, y: 290 }, area), false);
    assert.equal(inPolygon({ x: 100, y: 150 }, area), false);
    const left = graceArea({ x: 400, y: 150 }, sub, "left");
    assert.equal(inPolygon({ x: 370, y: 150 }, left), true);
  });
  test("protege mientras el puntero avanza hacia el submenú dentro de la zona; caduca y se rinde al retroceder", () => {
    let now = 0;
    const aim = createMenuAim(300, () => now);
    assert.equal(aim.blocks({ x: 160, y: 150 }), false, "sin submenú abierto no protege");
    aim.start({ x: 150, y: 150 }, sub, "right");
    assert.equal(aim.blocks({ x: 165, y: 160 }), true);
    assert.equal(aim.blocks({ x: 180, y: 170 }), true);
    assert.equal(aim.blocks({ x: 170, y: 170 }), false, "retrocede: deja de proteger");
    assert.equal(aim.blocks({ x: 185, y: 170 }), false, "y no vuelve hasta la siguiente salida");
    aim.start({ x: 150, y: 150 }, sub, "right");
    now = 301;
    assert.equal(aim.blocks({ x: 165, y: 160 }), false, "caducada");
    aim.start({ x: 150, y: 150 }, sub, "right");
    aim.clear();
    assert.equal(aim.blocks({ x: 165, y: 160 }), false);
    aim.start({ x: 400, y: 150 }, sub, "left");
    assert.equal(aim.blocks({ x: 380, y: 150 }), true);
    assert.equal(aim.blocks({ x: 390, y: 150 }), false);
  });
});

describe("core/layers", () => {
  const key = (init = {}) => new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true, ...init });
  const pointer = (target) => target.dispatchEvent(new window.MouseEvent("pointerdown", { bubbles: true }));

  test("Escape cierra solo la capa de arriba y respeta un evento ya cancelado", () => {
    const calls = [];
    const offA = layers.pushLayer({ contains: () => false, onEscape: () => calls.push("a") });
    const b = { contains: () => false, onEscape: () => calls.push("b") };
    const offB = layers.pushLayer(b);
    assert.equal(layers.isTopLayer(b), true);
    const event = press(document.body, "Escape");
    assert.deepEqual(calls, ["b"]);
    assert.equal(event.defaultPrevented, true);
    const cancelled = key();
    cancelled.preventDefault();
    assert.equal(layers.escapeTop(cancelled), false);
    assert.equal(layers.escapeTop(key({ key: "a" })), false);
    offB();
    press(document.body, "Escape");
    assert.deepEqual(calls, ["b", "a"]);
    offA();
    offA();
    press(document.body, "Escape");
    assert.deepEqual(calls, ["b", "a"], "sin capas no queda ningún listener");
  });
  test("una capa sin onEscape deja pasar la tecla, sin cerrar la de debajo", () => {
    const calls = [];
    const offA = layers.pushLayer({ contains: () => false, onEscape: () => calls.push("a") });
    const offB = layers.pushLayer({ contains: () => false });
    assert.equal(press(document.body, "Escape").defaultPrevented, false);
    assert.deepEqual(calls, []);
    offB();
    offA();
  });
  test("pulsación y foco fuera: de arriba abajo hasta la capa que contiene el destino; una modal corta", () => {
    const root = mount(
      '<div><div id="a"><button id="in-a"></button></div><div id="b"><button id="in-b"></button></div><button id="out"></button></div>',
    );
    const a = root.querySelector("#a");
    const b = root.querySelector("#b");
    const calls = [];
    const offA = layers.pushLayer({
      contains: (t) => a.contains(t),
      onPointerOutside: () => calls.push("a"),
      onFocusOutside: () => calls.push("fa"),
    });
    const offB = layers.pushLayer({
      contains: (t) => b.contains(t),
      onPointerOutside: () => calls.push("b"),
      onFocusOutside: () => calls.push("fb"),
    });
    pointer(root.querySelector("#in-b"));
    assert.deepEqual(calls, []);
    pointer(root.querySelector("#in-a"));
    assert.deepEqual(calls, ["b"]);
    pointer(root.querySelector("#out"));
    assert.deepEqual(calls, ["b", "b", "a"]);
    root.querySelector("#out").dispatchEvent(new window.FocusEvent("focusin", { bubbles: true }));
    assert.deepEqual(calls.slice(3), ["fb", "fa"]);
    offB();
    const modal = { contains: () => false, modal: true, onPointerOutside: () => calls.push("m") };
    const offM = layers.pushLayer(modal);
    assert.equal(layers.topModal(), modal);
    calls.length = 0;
    pointer(root.querySelector("#out"));
    assert.deepEqual(calls, ["m"], "lo que queda bajo una capa modal no se evalúa");
    offM();
    offA();
    assert.equal(layers.topModal(), undefined);
  });
  test("pressedOnBackdrop: el clic empieza y termina en el velo", () => {
    const dialog = setRect(mount("<dialog><p>x</p></dialog>"), { left: 100, top: 100, width: 200, height: 200 });
    const inside = dialog.querySelector("p");
    layers.notePress({ target: dialog, clientX: 10, clientY: 10 });
    assert.equal(layers.pressedOnBackdrop(dialog, { target: dialog, clientX: 10, clientY: 10 }), true);
    assert.equal(layers.pressedOnBackdrop(dialog, { target: dialog, clientX: 150, clientY: 150 }), false, "dentro de la caja");
    assert.equal(layers.pressedOnBackdrop(dialog, { target: inside, clientX: 10, clientY: 10 }), false, "el destino no es el diálogo");
    layers.notePress({ target: inside, clientX: 150, clientY: 150 });
    assert.equal(layers.pressedOnBackdrop(dialog, { target: dialog, clientX: 10, clientY: 10 }), false, "empezó dentro");
  });
});

describe("core/focus", () => {
  test("tabbable: en orden, sin deshabilitados, ocultos, inertes ni tabindex negativo", () => {
    const root = mount(
      '<div><button id="a">a</button><button disabled>b</button><a href="#" id="c">c</a><span tabindex="-1">d</span><div hidden><button>e</button></div><div inert><button>f</button></div><input type="hidden"><input id="g"><span tabindex="0" id="h">h</span></div>',
    );
    for (const el of root.querySelectorAll("*")) el.checkVisibility = () => true;
    assert.deepEqual(
      focus.tabbable(root).map((el) => el.id),
      ["a", "c", "g", "h"],
    );
  });
  test("focusInto, focusQuiet, activeElement y trapTab", () => {
    const root = mount('<div id="box"><button id="a">a</button><button id="b">b</button></div>');
    for (const el of root.querySelectorAll("*")) el.checkVisibility = () => true;
    const [a, b] = root.querySelectorAll("button");
    assert.equal(focus.activeElement(), null);
    focus.focusInto(root);
    assert.equal(document.activeElement, a);
    assert.equal(focus.activeElement(), a);
    focus.focusInto(root);
    assert.equal(document.activeElement, a, "con el foco ya dentro no lo mueve");
    assert.equal(focus.trapTab(root, { key: "Tab", shiftKey: true }), true);
    assert.equal(document.activeElement, b);
    assert.equal(focus.trapTab(root, { key: "Tab", shiftKey: false }), true);
    assert.equal(document.activeElement, a);
    assert.equal(focus.trapTab(root, { key: "Tab", shiftKey: false }), false, "en medio, el navegador sigue");
    assert.equal(focus.trapTab(root, { key: "Enter", shiftKey: false }), false);
    assert.equal(focus.focusQuiet(null), false);
    const detached = document.createElement("button");
    assert.equal(focus.focusQuiet(detached), false);
    const empty = mount('<div id="empty"></div>');
    focus.focusInto(empty);
    assert.equal(document.activeElement, empty);
    assert.equal(empty.tabIndex, -1);
    assert.equal(focus.trapTab(empty, { key: "Tab", shiftKey: false }), true);
  });
});

describe("core/presence, scroll-lock, swipe, long-press, ref", () => {
  test("afterExit: espera animationend o el plazo; se puede cancelar", () => {
    mock.timers.enable({ apis: ["setTimeout"] });
    const el = mount("<div></div>");
    let done = 0;
    afterExit(el, () => done++);
    el.dispatchEvent(new window.Event("animationend", { bubbles: true }));
    assert.equal(done, 1);
    mock.timers.tick(1000);
    assert.equal(done, 1, "no se llama dos veces");
    afterExit(el, () => done++, 100);
    mock.timers.tick(100);
    assert.equal(done, 2);
    const cancel = afterExit(el, () => done++, 100);
    cancel();
    mock.timers.tick(1000);
    assert.equal(done, 2);
    mock.timers.reset();
  });
  test("lockScroll cuenta usos y restaura al liberar el último", () => {
    const root = document.documentElement;
    root.style.overflow = "auto";
    const first = lockScroll();
    const second = lockScroll();
    assert.equal(root.style.overflow, "hidden");
    first();
    first();
    assert.equal(root.style.overflow, "hidden", "queda otro diálogo abierto");
    second();
    assert.equal(root.style.overflow, "auto");
  });
  test("swipeDirection", () => {
    assert.equal(swipeDirection("bottom-right"), "right");
    assert.equal(swipeDirection("top-right"), "right");
    assert.equal(swipeDirection("top-center"), "up");
    assert.equal(swipeDirection("bottom-center"), "down");
  });
  test("swipeToDismiss: supera el umbral y descarta; si no, cancela; solo cuenta la dirección de descarte", () => {
    const el = mount("<div></div>");
    const calls = [];
    const off = swipeToDismiss(el, {
      direction: "right",
      onStart: () => calls.push("start"),
      onCancel: () => calls.push("cancel"),
      onDismiss: () => calls.push("dismiss"),
    });
    const fire = (type, x, y = 0) => {
      const event = new window.MouseEvent(type, { bubbles: true, clientX: x, clientY: y, button: 0 });
      Object.defineProperty(event, "pointerId", { value: 1 });
      Object.defineProperty(event, "pointerType", { value: "mouse" });
      el.dispatchEvent(event);
    };
    fire("pointerdown", 0);
    fire("pointermove", 30);
    assert.equal(el.dataset.swipe, "move");
    assert.equal(el.style.getPropertyValue("--z-toast-swipe-move-x"), "30px");
    fire("pointerup", 30);
    assert.equal(el.dataset.swipe, "cancel");
    fire("pointerdown", 0);
    fire("pointermove", -80);
    fire("pointerup", -80);
    assert.deepEqual(calls, ["start", "cancel"], "hacia el otro lado no empieza");
    fire("pointerdown", 0);
    fire("pointermove", 80);
    fire("pointerup", 80);
    assert.equal(el.dataset.swipe, "end");
    assert.equal(el.style.getPropertyValue("--z-toast-swipe-end-x"), "80px");
    assert.deepEqual(calls, ["start", "cancel", "start", "dismiss"]);
    off();
    fire("pointerdown", 0);
    fire("pointermove", 80);
    fire("pointerup", 80);
    assert.equal(calls.length, 4, "desconectado");
  });
  test("createLongPress: vence a los 600 ms; el ratón, moverse o soltar la cancelan", () => {
    mock.timers.enable({ apis: ["setTimeout", "Date"], now: 10_000 });
    const fired = [];
    const press = createLongPress((point) => fired.push(point));
    const event = (pointerType, x = 5, y = 5) => ({ pointerType, pointerId: 1, clientX: x, clientY: y });
    assert.equal(press.sinceFired(), Number.POSITIVE_INFINITY);
    press.down(event("mouse"));
    assert.equal(press.pending(), false);
    press.down(event("touch"));
    assert.equal(press.pending(), true);
    press.move(event("touch", 8, 8));
    mock.timers.tick(600);
    assert.deepEqual(fired, [{ x: 5, y: 5 }]);
    assert.equal(press.pending(), false);
    assert.equal(press.sinceFired(), 0);
    press.down(event("touch"));
    press.move(event("touch", 40, 5));
    mock.timers.tick(600);
    press.down(event("pen"));
    press.cancel();
    mock.timers.tick(600);
    assert.equal(fired.length, 1);
    mock.timers.reset();
  });
  test("byRef", () => {
    mount('<div id=":r1:"></div><p class="x"></p>');
    assert.equal(byRef("#:r1:")?.id, ":r1:");
    assert.equal(byRef(".x")?.tagName, "P");
    assert.equal(byRef("#nope"), null);
    assert.equal(byRef("((("), null);
    assert.equal(byRef(null), null);
  });
});

describe("primitives/slot: mergeProps", () => {
  test("clases, estilos, refs y manejadores se combinan; en el resto gana la primitiva", () => {
    const calls = [];
    const childRef = { current: null };
    const slotRef = { current: null };
    const merged = mergeProps(
      {
        className: "z-navlink",
        style: { width: 1 },
        ref: slotRef,
        onClick: () => calls.push("slot"),
        "aria-expanded": true,
        title: undefined,
        id: "slot",
      },
      {
        className: "app",
        style: { width: 2, height: 3 },
        ref: childRef,
        onClick: () => calls.push("child"),
        "aria-expanded": false,
        title: "child",
        id: "child",
        href: "/x",
      },
    );
    assert.equal(merged.className, "z-navlink app");
    assert.deepEqual(merged.style, { width: 1, height: 3 });
    assert.equal(merged["aria-expanded"], true);
    assert.equal(merged.title, "child", "undefined no pisa");
    assert.equal(merged.id, "slot");
    assert.equal(merged.href, "/x");
    merged.onClick({ defaultPrevented: false });
    assert.deepEqual(calls, ["child", "slot"]);
    const node = {};
    const cleanup = merged.ref(node);
    assert.equal(childRef.current, node);
    assert.equal(slotRef.current, node);
    cleanup();
    assert.equal(childRef.current, null);
  });
  test("si el hijo cancela el evento, la primitiva no actúa", () => {
    const calls = [];
    const merged = mergeProps({ onClick: () => calls.push("slot") }, { onClick: (event) => event.preventDefault() });
    const event = {
      defaultPrevented: false,
      preventDefault() {
        this.defaultPrevented = true;
      },
    };
    merged.onClick(event);
    assert.deepEqual(calls, []);
    assert.equal(mergeProps({ ref: "r" }, {}).ref, "r");
  });
});
