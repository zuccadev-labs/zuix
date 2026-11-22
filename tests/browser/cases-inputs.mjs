// Binding de React (pantalla `?screen=inputs` de examples/app): acciones y formularios compuestos
// con teclado, puntero y formulario. Los casos de teclado y formulario se ejecutan también en Firefox y WebKit.
// Exporta una función que recibe los ayudantes de cases.mjs.
export default function ({ t, assert, poll, visible, gone, settled, focusOn, expectAttr, expectText, expectCount }) {
  const screen = (open) => open("inputs");
  const press = async (page, ...keys) => {
    for (const key of keys) await page.keyboard.press(key);
  };
  const activeMatches = (page, selector, message) =>
    poll(() => page.evaluate((s) => document.activeElement?.matches(s) ?? false, selector), message ?? `foco en ${selector}`);

  return [
    {
      name: "ToggleGroup y SegmentedControl subrayado: una parada de Tab, flechas y estado",
      async run({ open }) {
        const page = await screen(open);
        const multi = `${t("i-toggle-multi")} .z-toggle`;
        await page.locator(multi).nth(1).click();
        await expectText(page, t("i-toggle-multi-value"), "bold,italic");
        await press(page, "ArrowRight");
        await activeMatches(page, `${multi}[aria-label="Underline"]`, "flecha mueve el foco");
        await press(page, " ");
        await expectText(page, t("i-toggle-multi-value"), "bold,italic,underline");
        const stops = await page.locator(multi).evaluateAll((list) => list.filter((el) => el.tabIndex === 0).length);
        assert(stops === 1, `paradas de Tab: ${stops}`);
        const single = `${t("i-toggle-single")} .z-toggle`;
        await page.locator(single).nth(2).click();
        await expectText(page, t("i-toggle-single-value"), "right");
        await page.locator(single).nth(2).click();
        await expectText(page, t("i-toggle-single-value"), "right", "required: no se vacía");
        const seg = `${t("i-segmented")} [role=radio]`;
        await page.locator(seg).first().focus();
        await press(page, "ArrowRight");
        await expectText(page, t("i-segmented-value"), "activity");
      },
    },
    {
      name: "NumberInput: teclado del spinbutton, botones, lectura del locale y formato de moneda",
      async run({ open }) {
        const page = await screen(open);
        const input = `${t("i-number")} input[role=spinbutton]`;
        await page.focus(input);
        await press(page, "ArrowUp", "ArrowUp");
        await expectText(page, t("i-number-value"), "5");
        await press(page, "End");
        await expectText(page, t("i-number-value"), "10");
        await expectAttr(page, input, "aria-valuenow", "10");
        await press(page, "PageDown");
        await expectText(page, t("i-number-value"), "1");
        await page.click(`${t("i-number")} [data-step="up"]`);
        await expectText(page, t("i-number-value"), "2");
        const money = `${t("i-currency")} input`;
        assert((await page.inputValue(money)) === "$1,250.00", `formato: ${await page.inputValue(money)}`);
        await page.fill(money, "1,500");
        await press(page, "Tab");
        await expectText(page, t("i-currency-value"), "1500");
        assert((await page.inputValue(money)) === "$1,500.00", "vuelve al formato al salir");
      },
    },
    {
      name: "PasswordInput y TagsInput: mostrar con aria-pressed, medidor y etiquetas con teclado",
      async run({ open }) {
        const page = await screen(open);
        const toggle = `${t("i-password")} .z-password__toggle`;
        const field = `${t("i-password")} input.z-input__control`;
        await page.fill(field, "Correct-Horse-9-Battery");
        await page.click(toggle);
        await expectText(page, t("i-password-visible"), "true");
        await expectAttr(page, field, "type", "text");
        await expectAttr(page, toggle, "aria-pressed", "true");
        const score = Number(await page.getAttribute(`${t("i-password")} .z-password__meter`, "data-score"));
        assert(score >= 3, `medidor: ${score}`);
        const tags = `${t("i-tags")} .z-tags__input`;
        await page.click(tags);
        await page.keyboard.type("glass,tokens");
        await press(page, "Enter");
        await expectText(page, t("i-tags-value"), "design,glass,tokens");
        await press(page, "Backspace");
        await activeMatches(page, `${t("i-tags")} .z-tags__tag[data-value="tokens"]`, "Retroceso lleva a la última");
        await press(page, "Backspace");
        await expectText(page, t("i-tags-value"), "design,glass");
      },
    },
    {
      name: "Listbox, Select y Combobox múltiples y autocompletar",
      async run({ open }) {
        const page = await screen(open);
        await page.locator(`${t("i-listbox")} [role=option][aria-selected=true]`).focus();
        await press(page, "ArrowDown", "ArrowDown");
        await expectText(page, t("i-listbox-value"), "sa-east", "la deshabilitada se salta");
        await page
          .locator(`${t("i-listbox-multi")} [role=option]`)
          .nth(1)
          .click();
        await expectText(page, t("i-listbox-multi-value"), "eu-west,us-east");
        await press(page, "Control+a");
        await expectText(page, t("i-listbox-multi-value"), "eu-west,us-east,sa-east");

        await page.click(`${t("i-select-multi")} .z-select__control`);
        const list = ".z-liquid.z-listbox [role=listbox][aria-multiselectable=true]";
        await visible(page, list);
        await page.click(`${list} [role=option]:has-text("Leo Park")`);
        await expectText(page, t("i-select-multi-value"), "ana,leo");
        await visible(page, list);
        await expectAttr(page, `${list} [role=option]:has-text("Mia Chen")`, "aria-disabled", "true");
        await press(page, "Escape");
        await gone(page, list);
        await focusOn(page, `${t("i-select-multi")} .z-select__control`);

        const combo = `${t("i-combo-multi")} input`;
        await page.click(combo);
        await page.keyboard.type("for");
        await press(page, "Enter");
        await expectText(page, t("i-combo-multi-value"), "bug,forms");
        await expectCount(page, `${t("i-combo-multi")} .z-tags__tag`, 2);
        await press(page, "Backspace");
        await expectText(page, t("i-combo-multi-value"), "bug");
        await press(page, "Escape");

        const auto = `${t("i-autocomplete")} input`;
        await page.click(auto);
        await page.keyboard.type("Porto");
        await press(page, "Escape");
        await page.keyboard.type("!");
        await page.fill(auto, "Porto");
        await press(page, "Tab");
        await expectText(page, t("i-autocomplete-value"), "Porto", "texto libre al salir");
      },
    },
    {
      name: "Form: mensajes por ValidityState, foco al primer error y envío válido",
      async run({ open }) {
        const page = await screen(open);
        await page.click(t("i-form-submit"));
        await activeMatches(page, `${t("i-form-email")}`, "foco al primer error");
        await expectAttr(page, t("i-form-email"), "aria-invalid", "true");
        const describedBy = await page.getAttribute(t("i-form-email"), "aria-describedby");
        const message = await page.evaluate(
          (ids) =>
            ids
              .split(" ")
              .map((id) => document.getElementById(id)?.textContent)
              .join("|"),
          describedBy,
        );
        assert(message.includes("Enter your email address."), `mensaje: ${message}`);
        await expectText(page, t("i-form-value"), "none", "no se envía con errores");
        await page.fill(t("i-form-email"), "ana@example.com");
        await poll(async () => (await page.getAttribute(t("i-form-email"), "aria-invalid")) === null, "se quita al corregir");
        await page.fill(`${t("i-form")} input[name=password]`, "short");
        await press(page, "Tab");
        await poll(
          async () => (await page.locator(`${t("i-form")} .z-field__error`).allTextContents()).includes("Use at least 8 characters."),
          "tooShort al salir",
        );
        await page.fill(`${t("i-form")} input[name=password]`, "long-enough-1");
        await page.click(t("i-form-submit"));
        await expectText(page, t("i-form-value"), "ana@example.com|pw");
      },
    },
    {
      name: "CheckboxGroup, Editable, Rating con medias y CopyButton",
      async run({ open, browserName }) {
        const page = await screen(open);
        const all = `${t("i-checkgroup")} [data-select-all]`;
        await expectAttr(page, all, "aria-checked", "mixed");
        await page.click(all);
        await expectText(page, t("i-checkgroup-value"), "mentions,comments,releases");
        await page.click(all);
        await expectText(page, t("i-checkgroup-value"), "none");

        await page.click(`${t("i-editable")} .z-editable__preview`);
        await activeMatches(page, `${t("i-editable")} .z-editable__input`);
        await page.fill(`${t("i-editable")} .z-editable__input`, "Aurora");
        await press(page, "Enter");
        await expectText(page, t("i-editable-value"), "Aurora");
        await activeMatches(page, `${t("i-editable")} .z-editable__preview`, "el foco vuelve al texto");
        await press(page, "Enter");
        await page.fill(`${t("i-editable")} .z-editable__input`, "Nope");
        await press(page, "Escape");
        await expectText(page, t("i-editable-value"), "Aurora", "Escape cancela");

        await page.locator(`${t("i-rating")} [aria-checked=true]`).focus();
        await press(page, "ArrowRight");
        await expectText(page, t("i-rating-value"), "4");
        await press(page, "ArrowLeft", "ArrowLeft", "ArrowLeft");
        await expectText(page, t("i-rating-value"), "2.5");

        if (browserName === "chromium") await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
        await page.click(`${t("i-copy")} .z-copy__button`);
        await poll(async () => (await page.textContent(`${t("i-copy")} .z-copy__status`))?.trim(), "la burbuja anuncia el resultado");
        if (browserName === "chromium") await expectText(page, t("i-copy-value"), "zx_live_4f9c2a");
        await settled(page);
      },
    },
  ];
}
