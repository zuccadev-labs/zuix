// Binding de React de los selectores de 0.5 (pantalla `?screen=pickers`): Cascader (columnas, búsqueda por ruta, carga
// diferida, casillas y nivel en el teléfono), TreeSelect (árbol con aria-activedescendant, búsqueda y estrategia),
// MaskedInput (cursor estable), TimeRangePicker, DateTimeRangePicker con zona, QuarterPicker y el formulario nativo.
export default function ({ t, assert, poll, settled, focusOn, expectText, expectAttr, gone, visible }) {
  const active = (page, input) =>
    page.locator(input).evaluate((el) => {
      const id = el.getAttribute("aria-activedescendant");
      const node = id ? document.getElementById(id) : null;
      return node ? (node.querySelector(".z-listbox__text, .z-tree__label")?.textContent ?? node.textContent ?? "").trim() : "";
    });
  const open = async (openScreen, size) => {
    const page = await openScreen("pickers", size);
    await settled(page);
    return page;
  };
  return [
    {
      name: "Cascader (React): columnas con el teclado, búsqueda por la ruta completa y carga diferida con su estado",
      async run({ open: openScreen, axe }) {
        const page = await open(openScreen);
        const input = `${t("pk-cascader")} .z-cascader__input`;
        await page.locator(input).scrollIntoViewIfNeeded();
        assert((await page.locator(input).getAttribute("role")) === "combobox", "role=combobox");
        assert((await page.locator(input).getAttribute("aria-labelledby")) !== null, "nombre del Field");
        await page.locator(input).focus();
        await page.keyboard.press("ArrowDown");
        await expectAttr(page, input, "aria-expanded", "true");
        await poll(async () => (await active(page, input)) === "Alcalá de Henares", "abre en la ruta elegida");
        assert((await page.locator(input).getAttribute("aria-controls"))?.split(" ").length === 3, "tres columnas");
        await page.keyboard.press("ArrowLeft");
        await poll(async () => (await active(page, input)) === "Madrid", "izquierda vuelve a la región");
        await page.keyboard.press("ArrowDown");
        await page.keyboard.press("ArrowRight");
        await poll(async () => (await active(page, input)) === "Barcelona", "derecha entra en Catalonia");
        await page.keyboard.press("Enter");
        await expectText(page, t("pk-cascader-value"), "es/ct/bcn");
        await expectAttr(page, input, "aria-expanded", "false");
        await focusOn(page, input, "el foco no sale del campo");
        // Búsqueda por la ruta: «sint» encuentra Portugal / Lisbon / Sintra.
        await page.keyboard.type("sint");
        await poll(async () => (await active(page, input)).replace(/\s+/g, " ") === "Portugal / Lisbon / Sintra", "resultado por ruta");
        await page.keyboard.press("Enter");
        await expectText(page, t("pk-cascader-value"), "pt/lis/sin");
        // Carga diferida: France pide sus regiones al abrirla.
        await page.keyboard.press("ArrowDown");
        await page.keyboard.press("ArrowLeft");
        await page.keyboard.press("ArrowLeft");
        await page.keyboard.press("Home");
        await page.keyboard.press("ArrowDown");
        await page.keyboard.press("ArrowDown");
        await poll(async () => (await active(page, input)) === "France", "France activa");
        await page.keyboard.press("ArrowRight");
        await poll(() => page.locator(`${t("pk-cascader")} .z-cascader__option[data-loading]`).count(), "estado de carga en la opción");
        await poll(async () => (await active(page, input)) === "Île-de-France", "tras cargar, el primer hijo");
        await page.keyboard.press("ArrowRight");
        await page.keyboard.press("Enter");
        await expectText(page, t("pk-cascader-value"), "fr/idf/par");
        const violations = (await axe(page, { include: "main" })).filter((v) => v.impact === "serious" || v.impact === "critical");
        assert(!violations.length, `axe: ${violations.map((v) => `${v.id} ${v.nodes[0]?.target}`).join(" · ")}`);
      },
    },
    {
      name: "Cascader (React): casillas con estado mixto en cascada, piezas y Retroceso",
      async run({ open: openScreen }) {
        const page = await open(openScreen);
        const input = `${t("pk-cascader-multi")} .z-cascader__input`;
        await page.locator(input).scrollIntoViewIfNeeded();
        await page.locator(input).focus();
        await page.keyboard.press("ArrowDown");
        await poll(async () => (await active(page, input)) === "Spain", "Spain activa");
        assert(
          (await page
            .locator(`${t("pk-cascader-multi")} .z-cascader__option[data-col="0"][data-value="es"]`)
            .getAttribute("aria-checked")) === "mixed",
          "Spain a medias",
        );
        await page.keyboard.press("Enter");
        await expectText(page, t("pk-cascader-multi-value"), "es", "la rama entera vale como la rama (parent)");
        await page.keyboard.press("ArrowDown");
        await page.keyboard.press("Enter");
        await expectText(page, t("pk-cascader-multi-value"), "es, pt");
        await page.keyboard.press("Escape");
        await expectAttr(page, input, "aria-expanded", "false");
        await page.keyboard.press("Backspace");
        await expectText(page, t("pk-cascader-multi-value"), "es");
        assert((await page.locator(`${t("pk-cascader-multi")} .z-tags__tag`).count()) === 1, "una pieza");
      },
    },
    {
      name: "TreeSelect (React): popup tree con aria-activedescendant, búsqueda que expande, casillas y estrategia parent",
      async run({ open: openScreen }) {
        const page = await open(openScreen);
        const input = `${t("pk-tree")} .z-treeselect__input`;
        await page.locator(input).scrollIntoViewIfNeeded();
        assert((await page.locator(input).getAttribute("aria-haspopup")) === "tree", "aria-haspopup=tree");
        await page.locator(input).focus();
        await page.keyboard.type("infra");
        await poll(async () => (await active(page, input)) === "Infrastructure", "la búsqueda expande Engineering › Platform");
        assert(
          (await page.locator(`${t("pk-tree")} .z-treeselect__item[data-value="platform"]`).getAttribute("aria-expanded")) === "true",
          "Platform abierta",
        );
        await page.keyboard.press("Enter");
        await expectText(page, t("pk-tree-value"), "infra");
        await expectAttr(page, input, "aria-expanded", "false");
        assert((await page.locator(input).inputValue()) === "Infrastructure", "etiqueta en el campo");
        // Casillas: marcar Mobile completa Web+Mobile; con Platform, Engineering entera → «eng».
        const multi = `${t("pk-tree-multi")} .z-treeselect__input`;
        await page.locator(multi).focus();
        await page.keyboard.press("ArrowDown");
        await poll(async () => (await active(page, multi)) === "Web", "abre en lo elegido");
        assert(
          (await page.locator(`${t("pk-tree-multi")} .z-treeselect__item[data-value="eng"]`).getAttribute("aria-checked")) === "mixed",
          "Engineering a medias",
        );
        await page.keyboard.press("ArrowDown");
        await page.keyboard.press("Enter");
        await expectText(page, t("pk-tree-multi-value"), "web, mobile, design");
        await page.keyboard.press("ArrowDown");
        await page.keyboard.press("Enter");
        await expectText(page, t("pk-tree-multi-value"), "eng, design");
        await page.keyboard.press("ArrowLeft");
        await poll(async () => (await active(page, multi)) === "Engineering", "izquierda sube al padre");
        await page.keyboard.press("ArrowLeft");
        await expectAttr(page, `${t("pk-tree-multi")} .z-treeselect__item[data-value="eng"]`, "aria-expanded", "false");
        await page.keyboard.press("Escape");
        await expectAttr(page, multi, "aria-expanded", "false");
      },
    },
    {
      name: "MaskedInput (React): el cursor no salta al teclear y borrar en medio; tarjeta de 15 cifras; formato anunciado",
      async run({ open: openScreen }) {
        const page = await open(openScreen);
        const phone = `${t("pk-phone")} input.z-input__control`;
        await page.locator(phone).scrollIntoViewIfNeeded();
        const described = await page.locator(phone).evaluate((el) =>
          (el.getAttribute("aria-describedby") ?? "")
            .split(" ")
            .map((id) => document.getElementById(id)?.textContent ?? "")
            .join(" "),
        );
        assert(described.includes("Format: (___) ___-____"), `formato anunciado: ${described}`);
        assert((await page.locator(phone).getAttribute("inputmode")) === "numeric", "teclado numérico");
        await page.locator(phone).click();
        // «(555) 1|23-4567»: teclear 9 entre el 1 y el 2.
        await page.locator(phone).evaluate((el) => el.setSelectionRange(7, 7));
        await page.keyboard.type("9");
        assert((await page.locator(phone).inputValue()) === "(555) 192-3456", `valor: ${await page.locator(phone).inputValue()}`);
        assert((await page.locator(phone).evaluate((el) => el.selectionStart)) === 8, "cursor tras el 9");
        await expectText(page, t("pk-phone-value"), "5551923456");
        await page.keyboard.press("Backspace");
        assert((await page.locator(phone).inputValue()) === "(555) 123-456", "Retroceso");
        assert((await page.locator(phone).evaluate((el) => el.selectionStart)) === 7, "el cursor queda donde estaba lo borrado");
        // Pegar con formato o sin él.
        await page.locator(phone).evaluate((el) => el.select());
        await page.keyboard.insertText("415 555 0199");
        assert((await page.locator(phone).inputValue()) === "(415) 555-0199", "pegar texto");
        const card = `${t("pk-card")} input.z-input__control`;
        await page.locator(card).click();
        await page.keyboard.type("378282246310005");
        assert((await page.locator(card).inputValue()) === "3782 822463 10005", "American Express en 4-6-5");
        await page.locator(t("pk-plate")).locator("input.z-input__control").click();
        await page.keyboard.type("ab1c1234");
        assert(
          (await page.locator(`${t("pk-plate")} input.z-input__control`).inputValue()) === "ABC-1234",
          "letras en mayúsculas; la cifra fuera de sitio no entra",
        );
      },
    },
    {
      name: "Rangos (React): turno de noche con indicador, fin anterior al inicio no vale y DateTimeRangePicker con zona",
      async run({ open: openScreen }) {
        const page = await open(openScreen);
        const shift = t("pk-shift");
        await page.locator(shift).scrollIntoViewIfNeeded();
        assert((await page.locator(`${shift} .z-timerange__overnight`).count()) === 1, "indicador +1 day");
        assert((await page.locator(`${shift} .z-timerange__duration`).textContent())?.includes("8"), "duración");
        // Opening hours: el fin antes del inicio marca el grupo como inválido.
        const end = `${t("pk-office")} .z-timefield:nth-of-type(2) [data-segment="hour"]`;
        await page.locator(end).click();
        await page.keyboard.type("08");
        await page.keyboard.press("ArrowRight");
        await page.keyboard.type("a");
        await expectText(page, t("pk-office-value"), "09:00/08:30");
        await poll(
          () => page.locator(`${t("pk-office")} .z-timerange`).evaluate((el) => el.hasAttribute("data-invalid")),
          "el grupo, inválido",
        );
        assert(
          (await page.locator(`${t("pk-office")} .z-timerange > input.z-native-input`).evaluate((el) => el.validationMessage)) ===
            "The end time must be after the start time",
          "mensaje de validez",
        );
        // DateTimeRangePicker: el panel con calendario de rango, horas y zona; «Apply» cambia el valor.
        const trigger = `${t("pk-window")} .z-select__control`;
        await page.locator(trigger).scrollIntoViewIfNeeded();
        assert((await page.locator(trigger).textContent())?.includes("Madrid"), "la zona en el campo");
        await page.locator(trigger).click();
        await visible(page, ".z-dtrange__panel .z-calendar__grid");
        await page.locator(".z-dtrange__panel select").selectOption("Asia/Tokyo");
        await page.locator(".z-dtrange__panel .z-calendar__apply").click();
        await gone(page, ".z-dtrange__panel");
        await poll(async () => (await page.locator(t("pk-window-value")).textContent())?.endsWith("Asia/Tokyo"), "zona nueva");
        await page.locator(trigger).click();
        await visible(page, ".z-dtrange__panel .z-calendar__grid");
        await page.locator(".z-dtrange__panel .z-calendar__preset", { hasText: "Today" }).click();
        await page.locator(".z-dtrange__panel .z-calendar__apply").click();
        await gone(page, ".z-dtrange__panel");
        await poll(
          async () => /T00:00\/\d{4}-\d{2}-\d{2}T23:59 Asia\/Tokyo$/.test((await page.locator(t("pk-window-value")).textContent()) ?? ""),
          "preajuste Today",
        );
        await focusOn(page, trigger, "el foco vuelve al botón");
      },
    },
    {
      name: "QuarterPicker (React): rejilla de 2 × 2 con foco itinerante, límites y foco de vuelta",
      async run({ open: openScreen }) {
        const page = await open(openScreen);
        const trigger = `${t("pk-quarter")} .z-select__control`;
        await page.locator(trigger).scrollIntoViewIfNeeded();
        await page.locator(trigger).click();
        await focusOn(page, '.z-quarterpicker__unit[data-value="2026-Q4"]', "foco en el elegido");
        await page.keyboard.press("ArrowUp");
        await focusOn(page, '.z-quarterpicker__unit[data-value="2026-Q2"]', "arriba: dos trimestres");
        await page.keyboard.press("PageDown");
        await focusOn(page, '.z-quarterpicker__unit[data-value="2027-Q2"]', "Av Pág: año siguiente");
        await page.keyboard.press("PageDown");
        await focusOn(page, '.z-quarterpicker__unit[data-value="2027-Q4"]', "el límite max");
        await page.keyboard.press("ArrowLeft");
        await page.keyboard.press("Enter");
        await expectText(page, t("pk-quarter-value"), "2027-Q3");
        await focusOn(page, trigger, "el foco vuelve al botón");
        assert((await page.locator(trigger).textContent())?.includes("Q3 2027"), "valor en el botón");
      },
    },
    {
      name: "Formulario nativo (React): FormData con cada valor, required lleva el foco y reset devuelve los iniciales",
      async run({ open: openScreen }) {
        const page = await open(openScreen);
        await page.locator(t("pk-submit")).scrollIntoViewIfNeeded();
        await page.click(t("pk-submit"));
        await poll(async () => (await page.locator(t("pk-sent")).textContent()) !== "none", "envío");
        const sent = JSON.parse((await page.locator(t("pk-sent")).textContent()) ?? "{}");
        assert(sent.location === "es/md/alc", `location: ${sent.location}`);
        assert(sent.coverage === "es/ct", `coverage: ${sent.coverage}`);
        assert(JSON.stringify(sent.teams) === JSON.stringify(["web", "design"]), `teams: ${sent.teams}`);
        assert(sent.phone === "5551234567", `phone crudo: ${sent.phone}`);
        assert(sent.shift === "22:00/06:00", `shift: ${sent.shift}`);
        assert(sent.window === "2026-11-28T22:00+01:00[Europe/Madrid]/2026-11-29T02:00+01:00[Europe/Madrid]", `window: ${sent.window}`);
        assert(sent.quarter === "2026-Q4", `quarter: ${sent.quarter}`);
        // Sin ubicación (obligatoria), el envío no pasa y el foco va al campo.
        const input = `${t("pk-cascader")} .z-cascader__input`;
        await page.locator(`${t("pk-cascader")} .z-input__action[aria-label="Clear selection"]`).click();
        await expectText(page, t("pk-cascader-value"), "none");
        await page.evaluate(() => {
          document.querySelector('[data-testid="pk-sent"]').textContent = "none";
        });
        await page.click(t("pk-submit"));
        await focusOn(page, input, "required lleva el foco al Cascader");
        assert((await page.locator(t("pk-sent")).textContent()) === "none", "no se envía");
        // `reset` devuelve a cada uno el valor con el que se montó (y la aplicación se entera).
        await page.locator(`${t("pk-phone")} input.z-input__control`).fill("");
        await page.click(t("pk-reset"));
        await expectText(page, t("pk-cascader-value"), "es/md/alc");
        await expectText(page, t("pk-phone-value"), "5551234567");
        await expectText(page, t("pk-quarter-value"), "2026-Q4");
      },
    },
    {
      name: "Cascader a 390 px (React): una columna cada vez con «Back» al nivel anterior",
      async run({ open: openScreen }) {
        const page = await open(openScreen, { width: 390, height: 844 });
        const input = `${t("pk-cascader")} .z-cascader__input`;
        await page.locator(input).scrollIntoViewIfNeeded();
        await page.locator(input).click();
        await visible(page, `${t("pk-cascader")} .z-cascader__back`);
        const shown = await page.evaluate(
          () =>
            [...document.querySelectorAll('[data-testid="pk-cascader"] .z-cascader__column')].filter(
              (c) => c.getBoundingClientRect().width > 0,
            ).length,
        );
        assert(shown === 1, `una columna visible (${shown})`);
        await page.locator(`${t("pk-cascader")} .z-cascader__back`).click();
        await poll(async () => (await page.locator(`${t("pk-cascader")} .z-cascader__crumb`).textContent()) === "Spain", "nivel anterior");
        await page.locator(`${t("pk-cascader")} .z-cascader__back`).click();
        await gone(page, `${t("pk-cascader")} .z-cascader__back`);
        await page.locator(`${t("pk-cascader")} .z-cascader__option[data-value="pt"]`).click();
        await poll(
          async () => (await page.locator(`${t("pk-cascader")} .z-cascader__crumb`).textContent()) === "Portugal",
          "entra en Portugal",
        );
        const overflow = await page.evaluate(() => {
          const r = document.querySelector('[data-testid="pk-cascader"] .z-cascader__popup').getBoundingClientRect();
          return r.left < 0 || r.right > innerWidth;
        });
        assert(!overflow, "el panel cabe en la ventana");
      },
    },
  ];
}
