// Lógica de zui/dom que hoy es privada o está duplicada en el binding de React: posición de popovers (`place`),
// referencias (`byRef`), dirección (`logicalKey`), ajuste del Slider (`snap`), filtrado del Combobox (`fold`),
// navegación y búsqueda por letra de los listbox (`step`, `typeahead`) y puntuación de la paleta (`score`).
// Lo exportado se llama directamente; lo privado se ejerce con el marcado del contrato y eventos.
import { mount, press, setRect, setViewport, window } from "./helpers/dom.mjs";
import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";
import { contractHtml } from "./helpers/contract.mjs";

document.body.setAttribute("data-z-dom", "");
const dom = await import("../../zui/src/dom/index.ts");
const { byRef, logicalKey, isRtl } = await import("../../zui/src/dom/shared.ts");
const { fold } = await import("../../zui/src/dom/forms-popup.ts");
dom.init();

const type = (input, value) => {
  input.value = value;
  input.dispatchEvent(new window.Event("input", { bubbles: true }));
};

describe("place()", () => {
  const rect = (left, top, width, height) => new window.DOMRect(left, top, width, height);
  let el;
  beforeEach(() => {
    setViewport(1000, 800);
    el = setRect(document.createElement("div"), { width: 200, height: 100 });
  });
  const at = () => ({ left: el.style.left, top: el.style.top, side: el.dataset.side });

  test("bottom-start: bajo el ancla, alineado a su inicio, con la separación", () => {
    dom.place(el, rect(100, 100, 80, 30), "bottom-start", 6);
    assert.deepEqual(at(), { left: "100px", top: "136px", side: "bottom" });
  });
  test("bottom-end y bottom (centrado)", () => {
    dom.place(el, rect(400, 100, 80, 30), "bottom-end", 6);
    assert.deepEqual(at(), { left: "280px", top: "136px", side: "bottom" });
    dom.place(el, rect(400, 100, 80, 30), "bottom", 6);
    assert.equal(el.style.left, "340px");
  });
  test("top, left y right con sus alineaciones", () => {
    dom.place(el, rect(400, 400, 80, 30), "top-start", 6);
    assert.deepEqual(at(), { left: "400px", top: "294px", side: "top" });
    dom.place(el, rect(400, 400, 80, 30), "right-start", 4);
    assert.deepEqual(at(), { left: "484px", top: "400px", side: "right" });
    dom.place(el, rect(400, 400, 80, 30), "left-end", 4);
    assert.deepEqual(at(), { left: "196px", top: "330px", side: "left" });
    dom.place(el, rect(400, 400, 80, 30), "right", 4);
    assert.equal(el.style.top, "365px");
  });
  test("voltea de abajo a arriba solo si arriba cabe", () => {
    dom.place(el, rect(100, 740, 80, 30), "bottom-start", 6);
    assert.deepEqual(at(), { left: "100px", top: "634px", side: "top" });
    // Ventana baja: no cabe ni arriba ni abajo. Se queda abajo y se acota al borde.
    setViewport(1000, 150);
    dom.place(el, rect(100, 60, 80, 30), "bottom-start", 6);
    assert.deepEqual(at(), { left: "100px", top: "42px", side: "bottom" });
  });
  test("voltea de arriba a abajo, de derecha a izquierda y de izquierda a derecha", () => {
    dom.place(el, rect(100, 50, 80, 30), "top", 6);
    assert.equal(el.dataset.side, "bottom");
    dom.place(el, rect(900, 300, 80, 30), "right-start", 4);
    assert.deepEqual(at(), { left: "696px", top: "300px", side: "left" });
    dom.place(el, rect(50, 300, 80, 30), "left-start", 4);
    assert.deepEqual(at(), { left: "134px", top: "300px", side: "right" });
  });
  test("el límite exacto cabe: no voltea", () => {
    // 664 + 30 + 6 + 100 = 800 = alto de la ventana.
    dom.place(el, rect(100, 664, 80, 30), "bottom-start", 6);
    assert.equal(el.dataset.side, "bottom");
    dom.place(el, rect(100, 665, 80, 30), "bottom-start", 6);
    assert.equal(el.dataset.side, "top");
  });
  test("nunca queda a menos de 8 px del borde de la ventana", () => {
    dom.place(el, rect(950, 100, 40, 30), "bottom-start", 6);
    assert.equal(el.style.left, "792px");
    dom.place(el, rect(-50, 100, 40, 30), "bottom-end", 6);
    assert.equal(el.style.left, "8px");
  });
  test("un popup más ancho que la ventana se pega al margen inicial", () => {
    setRect(el, { width: 1200, height: 100 });
    dom.place(el, rect(500, 100, 40, 30), "bottom", 6);
    assert.equal(el.style.left, "8px");
  });
  test("un ancla de tamaño cero (punto del menú contextual) y separación 0", () => {
    dom.place(el, rect(300, 200, 0, 0), "bottom-start", 0);
    assert.deepEqual(at(), { left: "300px", top: "200px", side: "bottom" });
  });
  test("las coordenadas se redondean al píxel", () => {
    dom.place(el, rect(100.4, 100.6, 81, 30), "bottom", 6);
    assert.deepEqual(at(), { left: "41px", top: "137px", side: "bottom" });
  });
});

describe("byRef()", () => {
  test("#id con caracteres que en un selector habría que escapar (ids de useId)", () => {
    mount('<div id=":r1:"></div><div id="«r2»"></div><div id="a.b c"></div>');
    assert.equal(byRef("#:r1:")?.id, ":r1:");
    assert.equal(byRef("#«r2»")?.id, "«r2»");
    assert.equal(byRef("#a.b c")?.id, "a.b c");
  });
  test("selector CSS por compatibilidad; espacios alrededor", () => {
    mount('<div class="x" id="one"></div>');
    assert.equal(byRef(".x")?.id, "one");
    assert.equal(byRef("  #one  ")?.id, "one");
  });
  test("vacío, nulo, inexistente o selector inválido: null, sin lanzar", () => {
    mount("<div></div>");
    for (const ref of [null, undefined, "", "   ", "#nope", "[[", "#", "div >"]) assert.equal(byRef(ref), null, String(ref));
  });
});

describe("logicalKey() / isRtl()", () => {
  test("en RTL intercambia solo las flechas horizontales", () => {
    const ltr = mount('<div><span id="t"></span></div>');
    assert.equal(isRtl(ltr), false);
    assert.equal(logicalKey("ArrowLeft", ltr), "ArrowLeft");
    const rtl = mount('<div style="direction: rtl"></div>');
    assert.equal(isRtl(rtl), true);
    assert.equal(logicalKey("ArrowLeft", rtl), "ArrowRight");
    assert.equal(logicalKey("ArrowRight", rtl), "ArrowLeft");
    for (const key of ["ArrowUp", "ArrowDown", "Home", "End", "a"]) assert.equal(logicalKey(key, rtl), key);
  });
});

describe("Slider: snap", () => {
  const slider = (data) => {
    const el = mount(contractHtml("Slider"));
    for (const [key, value] of Object.entries(data)) el.dataset[key] = String(value);
    dom.hydrate(document.body);
    return el;
  };
  const set = (el, value) => {
    dom.setSliderValue(el, value);
    return el.dataset.value;
  };
  test("ajusta al paso más cercano y acota a [min, max]", () => {
    const el = slider({ min: 0, max: 100, step: 5, value: 60 });
    assert.equal(set(el, 62), "60");
    assert.equal(set(el, 63), "65");
    assert.equal(set(el, 62.5), "65");
    assert.equal(set(el, -40), "0");
    assert.equal(set(el, 1e9), "100");
  });
  test("pasos decimales sin ruido de coma flotante (0.1 + 0.2)", () => {
    const el = slider({ min: 0, max: 1, step: 0.1, value: 0 });
    assert.equal(set(el, 0.30000000000000004), "0.3");
    assert.equal(set(el, 0.7), "0.7");
    assert.equal(set(el, 0.349), "0.3");
  });
  test("el paso se cuenta desde min, no desde 0", () => {
    const el = slider({ min: 3, max: 20, step: 5, value: 3 });
    assert.equal(set(el, 9), "8");
    assert.equal(set(el, 12), "13");
    // 18 es el último múltiplo alcanzable; 20 queda acotado por max.
    assert.equal(set(el, 20), "18");
  });
  test("min negativo y decimal", () => {
    const el = slider({ min: -1.5, max: 1.5, step: 0.5, value: 0 });
    assert.equal(set(el, -1.3), "-1.5");
    assert.equal(set(el, 0.26), "0.5");
  });
  test("paso 0, negativo o no numérico no bloquea ni divide por cero", () => {
    for (const step of [0, -5, "abc"]) {
      const el = slider({ min: 0, max: 100, step, value: 10 });
      const value = Number(set(el, 42));
      assert.ok(Number.isFinite(value) && value >= 0 && value <= 100, `step=${step} → ${value}`);
    }
  });
  test("max menor que min: el rango se reduce a min", () => {
    const el = slider({ min: 50, max: 10, step: 1, value: 50 });
    assert.equal(set(el, 30), "50");
  });
  test("emite z:change solo si el valor cambia, y actualiza aria-valuenow y el campo oculto", () => {
    const el = slider({ min: 0, max: 100, step: 5, value: 60 });
    const values = [];
    el.addEventListener("z:change", (event) => values.push(event.detail.value));
    dom.setSliderValue(el, 61);
    dom.setSliderValue(el, 80);
    assert.deepEqual(values, [80]);
    assert.equal(el.querySelector(".z-slider__thumb").getAttribute("aria-valuenow"), "80");
    assert.equal(el.querySelector("input").value, "80");
  });
  test("NaN no deja el Slider sin valor", () => {
    const el = slider({ min: 0, max: 100, step: 5, value: 60 });
    const value = Number(set(el, Number.NaN));
    assert.ok(Number.isFinite(value), `data-value=${el.dataset.value}`);
  });
});

describe("Combobox: filtrado sin acentos ni mayúsculas", () => {
  test("fold: quita diacríticos y mayúsculas; no toca ñ→n más allá de la tilde", () => {
    assert.equal(fold("MÉXICO"), "mexico");
    assert.equal(fold("Perú"), "peru");
    assert.equal(fold("Ñandú"), "nandu");
    assert.equal(fold("Ångström"), "angstrom");
    // Forma descompuesta (NFD) y precompuesta (NFC) dan lo mismo.
    assert.equal(fold("é"), fold("é"));
    assert.equal(fold(""), "");
    // Letras que no son base + diacrítico no se transliteran.
    assert.equal(fold("Straße"), "straße");
  });
  const combo = () => {
    const root = mount(`<div>${contractHtml("Combobox")}</div>`);
    dom.hydrate(document.body);
    const el = root.querySelector(".z-combobox");
    return { el, input: el.querySelector("input.z-input__control"), popup: root.querySelector(".z-listbox") };
  };
  const shown = (popup) => [...popup.querySelectorAll(".z-listbox__option")].filter((o) => !o.hidden).map((o) => o.textContent.trim());

  test("escribir sin tilde encuentra la opción con tilde, y al revés", () => {
    const { input, popup } = combo();
    type(input, "mex");
    assert.deepEqual(shown(popup), ["México"]);
    type(input, "PERU");
    assert.deepEqual(shown(popup), ["Perú"]);
    type(input, "Árg");
    assert.deepEqual(shown(popup), ["Argentina"]);
  });
  test("coincide en cualquier posición e ignora los espacios de los extremos", () => {
    const { input, popup } = combo();
    type(input, "  gua ");
    assert.deepEqual(shown(popup), ["Paraguay", "Uruguay"]);
  });
  test("sin coincidencias aparece el estado vacío; al borrar vuelven todas", () => {
    const { input, popup } = combo();
    const total = shown(popup).length;
    type(input, "zzz");
    assert.deepEqual(shown(popup), []);
    assert.equal(popup.querySelector(".z-listbox__empty")?.textContent, "No results");
    type(input, "");
    assert.equal(shown(popup).length, total);
    assert.equal(popup.querySelector(".z-listbox__empty"), null);
  });
  test("data-filter=false (filtrado en servidor) no oculta nada", () => {
    const { el, input, popup } = combo();
    el.dataset.filter = "false";
    const total = shown(popup).length;
    type(input, "mex");
    assert.equal(shown(popup).length, total);
  });
  test("solo espacios no filtra", () => {
    const { input, popup } = combo();
    const total = shown(popup).length;
    type(input, "   ");
    assert.equal(shown(popup).length, total);
  });
});

describe("Select: navegación (step) y búsqueda por letra (typeahead)", () => {
  const select = () => {
    const root = mount(`<div>${contractHtml("Select")}</div>`);
    dom.hydrate(document.body);
    const el = root.querySelector(".z-select");
    const popup = root.querySelector(".z-listbox");
    const options = [...popup.querySelectorAll(".z-listbox__option")].filter(
      (o) => !o.hasAttribute("data-disabled") && o.getAttribute("aria-disabled") !== "true",
    );
    return { el, control: el.querySelector(".z-select__control"), popup, options };
  };
  const active = (popup) => popup.querySelector("[data-highlighted]");

  test("ArrowDown abre en la primera opción y no da la vuelta al llegar al final", () => {
    const { control, popup, options } = select();
    press(control, "ArrowDown");
    assert.equal(active(popup), options[0]);
    for (let i = 0; i < options.length + 3; i++) press(active(popup), "ArrowDown");
    assert.equal(active(popup), options.at(-1));
    for (let i = 0; i < options.length + 3; i++) press(active(popup), "ArrowUp");
    assert.equal(active(popup), options[0]);
  });
  test("Home y End", () => {
    const { control, popup, options } = select();
    press(control, "ArrowDown");
    press(active(popup), "End");
    assert.equal(active(popup), options.at(-1));
    press(active(popup), "Home");
    assert.equal(active(popup), options[0]);
  });
  test("las opciones desactivadas se saltan", () => {
    const { control, popup, options } = select();
    press(control, "ArrowDown");
    const seen = new Set();
    for (let i = 0; i < 20; i++) {
      seen.add(active(popup));
      press(active(popup), "ArrowDown");
    }
    assert.deepEqual([...seen], options);
  });
  test("búsqueda por letra: va a la primera opción que empieza por lo tecleado, sin distinguir mayúsculas", () => {
    const { control, popup, options } = select();
    press(control, "ArrowDown");
    const target = options.at(-1);
    const label = target.textContent.trim();
    // Con el prefijo completo solo puede quedar una opción que empiece así.
    for (const ch of label.toUpperCase()) press(active(popup), ch);
    assert.equal(active(popup).textContent.trim().toLowerCase().startsWith(label.toLowerCase()), true);
  });
});

describe("CommandPalette: puntuación (score) y orden", () => {
  const palette = () => {
    const root = mount(`<div>${contractHtml("CommandPalette")}</div>`);
    dom.hydrate(document.body);
    const dialog = root.querySelector("dialog.z-palette");
    return { dialog, input: dialog.querySelector(".z-palette__input") };
  };
  const visible = (dialog) =>
    [...dialog.querySelectorAll(".z-palette__item")]
      .filter((item) => !item.hidden && !item.closest("[hidden]"))
      .map((item) => item.querySelector(".z-palette__item-label")?.textContent.trim() ?? item.textContent.trim());

  test("sin consulta se ven todos en el orden del marcado", () => {
    const { dialog, input } = palette();
    const all = visible(dialog);
    type(input, "set");
    type(input, "");
    assert.deepEqual(visible(dialog), all);
  });
  test("prefijo gana a contiene, y contiene gana a subsecuencia", () => {
    const { dialog, input } = palette();
    dialog.querySelector(".z-palette__list").innerHTML = ["xx settings", "s-e-t dispersas", "Settings", "otra cosa"]
      .map(
        (label, i) =>
          `<div role="option" class="z-palette__item" data-value="v${i}"><span class="z-palette__item-label">${label}</span></div>`,
      )
      .join("");
    type(input, "set");
    assert.deepEqual(visible(dialog), ["Settings", "xx settings", "s-e-t dispersas"]);
  });
  test("las palabras clave y la pista también cuentan, con menos peso que la etiqueta", () => {
    const { dialog, input } = palette();
    dialog.querySelector(".z-palette__list").innerHTML =
      '<div role="option" class="z-palette__item" data-keywords="preferences, config"><span class="z-palette__item-label">Open settings</span></div><div role="option" class="z-palette__item"><span class="z-palette__item-label">Preferences</span></div><div role="option" class="z-palette__item"><span class="z-palette__item-label">Home</span><span class="z-palette__item-hint">/pref</span></div>';
    type(input, "pref");
    // Etiqueta por prefijo (3) > palabra clave por prefijo (3 × 0.8) > pista que lo contiene (2 × 0.9).
    assert.deepEqual(visible(dialog), ["Preferences", "Open settings", "Home"]);
  });
  test("sin resultados se muestra el estado vacío", () => {
    const { dialog, input } = palette();
    type(input, "qqqqzzzz");
    assert.deepEqual(visible(dialog), []);
    assert.equal(dialog.querySelector(".z-palette__empty").hidden, false);
  });
  test("ignora los acentos, igual que el Combobox", () => {
    const { dialog, input } = palette();
    dialog.querySelector(".z-palette__list").innerHTML =
      '<div role="option" class="z-palette__item"><span class="z-palette__item-label">Configuración</span></div>';
    type(input, "configuracion");
    assert.deepEqual(visible(dialog), ["Configuración"]);
  });
});

describe("SegmentedControl sin framework: foco itinerante", () => {
  test("una sola parada de tabulación; las flechas mueven el foco y la selección, reflejadas en RTL", () => {
    const root = mount(`<div>${contractHtml("SegmentedControl")}</div>`);
    dom.hydrate(document.body);
    const group = root.querySelector(".z-segmented");
    const items = [...group.querySelectorAll(".z-segmented__item")];
    assert.deepEqual(items.map((item) => item.tabIndex), [0, ...items.slice(1).map(() => -1)], "sin elección, la primera opción es la parada");
    const values = [];
    group.addEventListener("z:change", () => values.push(items.findIndex((item) => item.getAttribute("aria-checked") === "true")));
    items[0].focus();
    assert.equal(press(items[0], "ArrowRight").defaultPrevented, true);
    assert.equal(document.activeElement, items[1]);
    assert.equal(items[1].dataset.state, "on");
    assert.deepEqual(items.map((item) => item.tabIndex), items.map((_, i) => (i === 1 ? 0 : -1)));
    press(items[1], "ArrowDown");
    assert.equal(document.activeElement, items[(2) % items.length]);
    press(document.activeElement, "Home");
    assert.equal(document.activeElement, items[0]);
    press(items[0], "ArrowLeft");
    assert.equal(document.activeElement, items[items.length - 1], "da la vuelta");
    assert.ok(values.length >= 4);
    group.style.direction = "rtl";
    items[0].focus();
    items[0].click();
    press(items[0], "ArrowLeft");
    assert.equal(document.activeElement, items[1], "en RTL la flecha izquierda avanza");
  });
});

describe("init() y destroy()", () => {
  const tabs = () => {
    const root = mount(`<div>${contractHtml("Tabs")}</div>`);
    dom.hydrate(document.body);
    return [...root.querySelectorAll(".z-tabs__tab")];
  };
  test("init() es idempotente y devuelve destroy", () => {
    assert.equal(dom.init(), dom.destroy);
  });
  test("destroy() retira los listeners del documento; init() los vuelve a poner", () => {
    let list = tabs();
    list[1].click();
    assert.equal(list[1].getAttribute("aria-selected"), "true");
    dom.destroy();
    dom.destroy();
    list = tabs();
    list[1].click();
    assert.equal(list[1].getAttribute("aria-selected"), "false", "sin listeners el clic no activa la pestaña");
    press(list[0], "ArrowRight");
    assert.equal(list[0].getAttribute("aria-selected"), "true");
    dom.init();
    list[1].click();
    assert.equal(list[1].getAttribute("aria-selected"), "true");
    list[2].click();
    assert.equal(list.filter((tab) => tab.getAttribute("aria-selected") === "true").length, 1, "un solo juego de listeners tras volver a iniciar");
  });
});
