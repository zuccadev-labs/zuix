// Oleada 3 sin framework: acciones (ToggleGroup, CopyButton, Swap) y formularios (InputGroup, PasswordInput,
// NumberInput, Listbox, TagsInput, CheckboxGroup, Field validate y Form, Select y Combobox múltiples, autocompletar,
// Editable, Slider con marcas, Rating con medias y FileUpload con lista). Puntero y teclado sobre zui/html.json.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const contract = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../../../zui/html.json"), "utf8")).components;

export default async function ({ page, test, ok, card, settle, browserName }) {
  await page.evaluate(() => {
    window.__w3 = [];
    for (const name of ["z:change", "z:copy", "z:copyerror", "z:invalid", "z:reject"])
      document.addEventListener(name, (event) =>
        window.__w3.push({ name, cls: event.target.className, detail: JSON.parse(JSON.stringify(event.detail ?? null)) }),
      );
  });
  const events = () => page.evaluate(() => window.__w3.splice(0));
  const press = async (...keys) => {
    for (const key of keys) await page.keyboard.press(key);
  };
  const activeIs = (selector) => page.evaluate((s) => document.activeElement?.matches(s) ?? false, selector);
  /** Añade un ejemplo del contrato a la tarjeta del componente y lo activa con hydrate(). Devuelve su contenedor. */
  const inject = async (name, index) => {
    const id = `inj-${name}-${index}`;
    await page.evaluate(
      async ([component, html, wrap]) => {
        const stage = document.querySelector(`[data-component="${component}"] .demo__stage`);
        const box = document.createElement("div");
        box.id = wrap;
        box.innerHTML = html;
        stage.append(box);
        (await import("/zui/dist/zui.dom.js")).hydrate(box);
      },
      [name, contract[name].examples[index].html, id],
    );
    return page.locator(`#${id}`);
  };

  /* ---------- ToggleGroup ---------- */
  await test("ToggleGroup: múltiple con puntero; una parada de Tab y flechas con vuelta", async () => {
    const group = card("ToggleGroup").locator(".z-toggle-group").first();
    const items = group.locator(".z-toggle");
    await events();
    await items.nth(1).click();
    ok((await items.nth(1).getAttribute("aria-pressed")) === "true", "Italic no se activó");
    const log = await events();
    ok(
      log.some((e) => e.name === "z:change" && JSON.stringify(e.detail.value) === '["bold","italic"]'),
      `evento: ${JSON.stringify(log)}`,
    );
    ok(!log.some((e) => e.cls.includes("z-toggle ")), "el botón suelto no debe emitir su propio z:change");
    const stops = await items.evaluateAll((list) => list.filter((el) => el.tabIndex === 0).length);
    ok(stops === 1, `paradas de Tab: ${stops}`);
    await items.nth(1).focus();
    await press("ArrowRight");
    ok(await page.evaluate(() => document.activeElement?.getAttribute("aria-label") === "Underline"), "flecha derecha");
    await press("ArrowRight");
    ok(await page.evaluate(() => document.activeElement?.getAttribute("aria-label") === "Bold"), "vuelta al principio");
    await press("End", " ");
    ok((await items.nth(2).getAttribute("aria-pressed")) === "true", "Espacio activa");
  });
  await test("ToggleGroup single required: activar otra desactiva la anterior y no queda ninguna vacía", async () => {
    const group = (await inject("ToggleGroup", 2)).locator(".z-toggle-group");
    const items = group.locator(".z-toggle");
    await items.nth(1).click();
    ok(
      (await items.nth(0).getAttribute("aria-pressed")) === "false" && (await items.nth(1).getAttribute("aria-pressed")) === "true",
      "single",
    );
    await items.nth(1).click();
    ok((await items.nth(1).getAttribute("aria-pressed")) === "true", "required: la activa no se apaga");
    ok(await items.nth(2).isDisabled(), "item deshabilitado");
  });

  /* ---------- CopyButton ---------- */
  await test("CopyButton: copia, cambia el icono y anuncia en la región status sin deshabilitarse", async () => {
    if (browserName === "chromium") await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    const button = card("CopyButton").locator(".z-copy__button");
    await events();
    await button.click();
    await page.waitForFunction(() => document.querySelector("[data-component='CopyButton'] .z-copy__status")?.textContent.trim());
    const copied = await button.evaluate((el) => el.hasAttribute("data-copied"));
    const failed = await button.evaluate((el) => el.hasAttribute("data-failed"));
    ok(copied || failed, "sin estado tras copiar");
    ok(!(await button.isDisabled()), "no se deshabilita");
    if (browserName === "chromium") {
      ok(copied, "Chrome con permiso debe copiar");
      ok((await page.evaluate(() => navigator.clipboard.readText())) === "zx_live_4f9c2a", "texto copiado");
      ok(
        (await events()).some((e) => e.name === "z:copy" && e.detail.text === "zx_live_4f9c2a"),
        "z:copy",
      );
    }
    const status = card("CopyButton").locator(".z-copy__status");
    ok((await status.getAttribute("role")) === "status", "región status");
    await page.waitForFunction(() => !document.querySelector("[data-component='CopyButton'] .z-copy__status")?.textContent, null, {
      timeout: 4000,
    });
  });

  /* ---------- Swap ---------- */
  await test("Swap: sigue a aria-pressed del Toggle que lo contiene", async () => {
    const toggle = card("Swap").locator(".z-toggle").first();
    const shown = () =>
      toggle.evaluate((el) =>
        [...el.querySelectorAll(".z-swap__item")].map((i) => Math.round(Number(getComputedStyle(i).opacity))).join(""),
      );
    ok((await shown()) === "10", `reposo: ${await shown()}`);
    await toggle.click();
    await settle();
    ok((await toggle.getAttribute("aria-pressed")) === "true", "Toggle no cambió");
    ok((await shown()) === "01", `activado: ${await shown()}`);
  });

  /* ---------- InputGroup ---------- */
  await test("InputGroup: pulsar en un adorno enfoca el campo; anillo en el recuadro", async () => {
    const group = card("InputGroup").locator(".z-input-group").first();
    await group.locator(".z-input-group__addon").first().click();
    ok(await activeIs("[data-component='InputGroup'] .z-input-group__control"), "el adorno no enfocó el campo");
    const outline = await group.evaluate((el) => getComputedStyle(el).outlineStyle);
    ok(outline === "solid", `sin anillo: ${outline}`);
  });

  /* ---------- PasswordInput ---------- */
  await test("PasswordInput: mostrar/ocultar con aria-pressed y nombre fijo; medidor que no juzga vacío; se oculta al enviar", async () => {
    const box = card("PasswordInput").locator(".z-password");
    const input = box.locator("input.z-input__control");
    const toggle = box.locator(".z-password__toggle");
    ok((await input.getAttribute("autocomplete")) === "current-password", "autocomplete");
    const name = await toggle.getAttribute("aria-label");
    await toggle.click();
    ok((await input.getAttribute("type")) === "text" && (await toggle.getAttribute("aria-pressed")) === "true", "no se mostró");
    ok((await toggle.getAttribute("aria-label")) === name, "el nombre no debe cambiar");
    await toggle.click();
    ok((await input.getAttribute("type")) === "password", "no se ocultó");
    const meter = (await inject("PasswordInput", 1)).locator(".z-password");
    const field = meter.locator("input.z-input__control");
    await field.fill("");
    await field.press("a");
    ok((await meter.locator(".z-password__meter").getAttribute("data-score")) === "1", "una letra: débil");
    await field.fill("Correct-Horse-9-Battery");
    await field.dispatchEvent("input");
    const score = Number(await meter.locator(".z-password__meter").getAttribute("data-score"));
    ok(score >= 3, `fuerte: ${score}`);
    ok(/Strength:/.test(await meter.locator(".z-password__label").textContent()), "texto del medidor");
    await field.fill("");
    await field.dispatchEvent("input");
    ok((await meter.locator(".z-password__meter").getAttribute("data-score")) === null, "vacío no se juzga");
    // Envío: se vuelve a ocultar.
    await page.evaluate(() => {
      const form = document.createElement("form");
      form.id = "pw-form";
      form.addEventListener("submit", (event) => event.preventDefault());
      const box = document.querySelector("[data-component='PasswordInput'] .z-password");
      box.parentElement.insertBefore(form, box);
      form.append(box);
    });
    await toggle.click();
    await page.evaluate(() => document.querySelector("#pw-form").requestSubmit());
    ok((await input.getAttribute("type")) === "password", "no se ocultó al enviar");
  });

  /* ---------- NumberInput ---------- */
  await test("NumberInput: flechas, Re Pág, Inicio/Fin, botones, lectura y formato al salir; topes", async () => {
    const box = card("NumberInput").locator(".z-number");
    const input = box.locator("input[role='spinbutton']");
    ok((await input.inputValue()) === "3" && (await input.getAttribute("aria-valuenow")) === "3", "valor inicial");
    await input.focus();
    await press("ArrowUp", "ArrowUp");
    ok((await input.getAttribute("aria-valuenow")) === "5", "flecha arriba");
    await press("PageUp");
    ok((await input.getAttribute("aria-valuenow")) === "15", `Re Pág: ${await input.getAttribute("aria-valuenow")}`);
    await press("End");
    ok((await input.getAttribute("aria-valuenow")) === "50", "Fin al máximo");
    ok(await box.locator("[data-step='up']").isDisabled(), "botón de subir en el tope");
    await press("Home");
    ok((await input.getAttribute("aria-valuenow")) === "1", "Inicio al mínimo");
    await box.locator("[data-step='up']").click();
    ok((await input.getAttribute("aria-valuenow")) === "2", "botón subir");
    await input.fill("999");
    await press("Tab");
    ok((await input.inputValue()) === "50", `fuera de rango se ajusta al salir: ${await input.inputValue()}`);
    ok((await box.getAttribute("data-value")) === "50", "data-value");
    ok((await input.getAttribute("inputmode")) === "numeric", "inputmode");
    const money = (await inject("NumberInput", 1)).locator(".z-number");
    const field = money.locator("input");
    ok((await field.inputValue()) === "$1,250.00", `formato moneda: ${await field.inputValue()}`);
    await field.fill("2,000.5");
    await field.press("Enter");
    ok((await money.getAttribute("data-value")) === "2000", `lectura del locale y paso de 50: ${await money.getAttribute("data-value")}`);
    ok((await field.inputValue()) === "$2,000.00", "vuelve al formato");
  });

  /* ---------- Listbox ---------- */
  await test("Listbox único: la selección sigue al foco; búsqueda por letra; deshabilitada se salta", async () => {
    const list = card("Listbox").locator("[role='listbox']");
    const option = (label) => list.locator(".z-listbox__option", { hasText: label });
    ok((await option("Board").getAttribute("tabindex")) === "0", "parada de Tab en la elegida");
    await option("Board").focus();
    await events();
    await press("ArrowDown");
    ok((await option("Grid").getAttribute("aria-selected")) === "true", "flecha abajo elige");
    await press("ArrowDown");
    ok(await activeIs("[data-component='Listbox'] .z-listbox__option[data-value='grid']"), "Table deshabilitada: el foco no la pasa");
    await press("l");
    ok((await option("List").getAttribute("aria-selected")) === "true", "letra");
    ok(
      (await events()).some((e) => e.name === "z:change" && e.detail.value === "list"),
      "z:change",
    );
    await option("Board").click();
    ok((await option("Board").getAttribute("aria-selected")) === "true", "clic");
  });
  await test("Listbox múltiple: Espacio, Mayús+flecha, Ctrl+A y campos ocultos", async () => {
    const box = (await inject("Listbox", 1)).locator(".z-listbox");
    const list = box.locator("[role='listbox']");
    ok((await list.getAttribute("aria-multiselectable")) === "true", "aria-multiselectable");
    const opt = (v) => list.locator(`[data-value='${v}']`);
    await opt("eu-west").focus();
    await press("ArrowDown", " ");
    ok((await opt("eu-central").getAttribute("aria-selected")) === "true", "Espacio marca");
    await press("Shift+ArrowDown");
    ok((await opt("us-east").getAttribute("aria-selected")) === "true", "Mayús+flecha extiende");
    await press("Control+a");
    const all = await list.locator("[aria-selected='true']").count();
    ok(all === 4, `Ctrl+A: ${all}`);
    const hidden = await box.locator("input[type='hidden'][name='regions']").count();
    ok(hidden === 4, `campos ocultos: ${hidden}`);
    await press("Control+a");
    ok((await list.locator("[aria-selected='true']").count()) === 0, "Ctrl+A otra vez desmarca");
  });

  /* ---------- TagsInput ---------- */
  await test("TagsInput: Intro y coma crean, pegar una lista, duplicada rechazada, Retroceso y flechas", async () => {
    const box = card("TagsInput").locator(".z-tags");
    const input = box.locator(".z-tags__input");
    const values = () => box.locator(".z-tags__tag").evaluateAll((list) => list.map((t) => t.dataset.value).join(","));
    await input.click();
    await page.keyboard.type("glass");
    await press("Enter");
    await page.keyboard.type("a11y,");
    ok((await values()) === "design,tokens,glass,a11y", `crear: ${await values()}`);
    ok(/a11y added/.test(await box.locator("[role='status']").textContent()), "anuncio");
    await page.keyboard.type("Design");
    await press("Enter");
    ok((await values()) === "design,tokens,glass,a11y", "duplicada");
    ok((await box.getAttribute("data-invalid")) !== null && (await input.inputValue()) === "Design", "queda escrita y marcada");
    await input.fill("");
    await page.evaluate(() => {
      const input = document.querySelector("[data-component='TagsInput'] .z-tags__input");
      const data = new DataTransfer();
      data.setData("text/plain", "one\ntwo, three");
      input.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
    });
    ok((await values()) === "design,tokens,glass,a11y,one,two,three", `pegar: ${await values()}`);
    await input.focus();
    await press("Backspace");
    ok(await activeIs("[data-component='TagsInput'] .z-tags__tag[data-value='three']"), "Retroceso lleva a la última");
    await press("ArrowLeft", "Delete");
    ok((await values()) === "design,tokens,glass,a11y,one,three", `Supr quita la enfocada: ${await values()}`);
    await box.locator(".z-tags__tag[data-value='design'] .z-tags__remove").click();
    ok(!(await values()).startsWith("design"), "botón de quitar");
    ok((await box.locator("input[type='hidden'][name='topics']").count()) === 5, "campos ocultos");
  });

  /* ---------- CheckboxGroup ---------- */
  await test("CheckboxGroup: «todas» indeterminada, marca y desmarca todas; z:change del grupo", async () => {
    const group = card("CheckboxGroup").locator(".z-checkgroup");
    const all = group.locator("[data-select-all]");
    ok((await all.getAttribute("aria-checked")) === "mixed", `inicial: ${await all.getAttribute("aria-checked")}`);
    await events();
    await all.click();
    ok((await group.locator(".z-checkgroup__items [aria-checked='true']").count()) === 3, "todas marcadas");
    const log = await events();
    ok(
      log.some((e) => e.name === "z:change" && e.cls.includes("z-checkgroup") && e.detail.value.length === 3),
      `z:change: ${JSON.stringify(log)}`,
    );
    await all.click();
    ok((await group.locator(".z-checkgroup__items [aria-checked='true']").count()) === 0, "ninguna");
    await group.locator(".z-checkgroup__items [role='checkbox']").first().click();
    ok((await all.getAttribute("aria-checked")) === "mixed", "vuelve a indeterminada");
    ok((await group.evaluate((el) => el.tagName)) === "FIELDSET" && (await group.locator("legend").count()) === 1, "fieldset con legend");
  });

  /* ---------- Field validate y Form ---------- */
  await test("Form: envío con errores muestra mensajes por ValidityState, aria-invalid y foco al primero; se corrigen al escribir", async () => {
    const form = card("Form").locator("form");
    const email = form.locator("input[type='email']");
    await events();
    ok((await email.getAttribute("aria-invalid")) === null, "sin error antes de interactuar");
    await form.locator("button[type='submit']").click();
    ok(await activeIs("[data-component='Form'] input[type='email']"), "foco al primer error");
    const error = form.locator(".z-field__error").first();
    ok((await error.textContent()) === "Enter your email address.", `mensaje propio: ${await error.textContent()}`);
    ok((await email.getAttribute("aria-invalid")) === "true", "aria-invalid");
    ok((await email.getAttribute("aria-describedby"))?.includes(await error.getAttribute("id")), "error enlazado");
    ok(
      (await events()).some((e) => e.name === "z:invalid"),
      "z:invalid",
    );
    await email.fill("ana");
    await email.press("Tab");
    ok(
      (await form.locator(".z-field__error").first().textContent()) === "Enter an email in the format you@example.com.",
      "typeMismatch al salir",
    );
    await email.fill("ana@example.com");
    ok((await email.getAttribute("aria-invalid")) === null, "se quita al corregir");
    const password = form.locator("input[name='password']");
    await password.fill("short");
    await password.press("Tab");
    ok((await form.locator(".z-field__error").first().textContent()) === "Use at least 8 characters.", "tooShort");
  });

  /* ---------- Select y Combobox múltiples ---------- */
  await test("Select múltiple: no cierra al elegir, tope deshabilita, contador y select nativo", async () => {
    const box = await inject("Select", 3);
    const select = box.locator(".z-select");
    const control = select.locator(".z-select__control");
    await control.click();
    await settle();
    const popup = box.locator(".z-listbox");
    ok(await popup.evaluate((el) => el.matches(":popover-open")), "no abrió");
    await events();
    await popup.locator("[data-value='leo']").click();
    ok(await popup.evaluate((el) => el.matches(":popover-open")), "se cerró al elegir");
    ok((await select.getAttribute("data-value")) === "ana,leo", `valor: ${await select.getAttribute("data-value")}`);
    ok((await popup.locator("[data-value='mia']").getAttribute("aria-disabled")) === "true", "tope");
    ok((await select.locator(".z-select__count").textContent()) === "2", "contador");
    ok(
      (await select.locator("select.z-native-input").evaluate((el) => [...el.selectedOptions].map((o) => o.value).join(","))) === "ana,leo",
      "select nativo",
    );
    ok(
      (await events()).some((e) => e.name === "z:change" && JSON.stringify(e.detail.value) === '["ana","leo"]'),
      "z:change",
    );
    await press("Escape");
    await settle();
    ok(await activeIs("#inj-Select-3 .z-select__control"), "Escape devuelve el foco");
  });
  await test("Combobox múltiple: piezas, grupos que se ocultan al filtrar y Retroceso quita la última", async () => {
    const box = await inject("Combobox", 2);
    const combo = box.locator(".z-combobox");
    const input = combo.locator("input.z-input__control");
    ok((await combo.locator(".z-tags__tag").count()) === 1, "pieza inicial");
    await input.click();
    await page.keyboard.type("do");
    await settle();
    const popup = box.locator(".z-listbox");
    ok(
      await popup
        .locator(".z-listbox__group")
        .first()
        .evaluate((g) => g.hidden),
      "el grupo sin coincidencias se oculta",
    );
    await press("Enter");
    ok((await combo.getAttribute("data-value")) === "bug,docs", `valor: ${await combo.getAttribute("data-value")}`);
    ok((await input.inputValue()) === "", "vacía lo escrito");
    ok((await combo.locator(".z-tags__tag").count()) === 2, "dos piezas");
    await press("Backspace");
    ok((await combo.getAttribute("data-value")) === "bug", "Retroceso");
    await combo.locator(".z-tags__remove").click();
    ok(!(await combo.getAttribute("data-value")), "botón de quitar");
  });
  await test("Combobox con texto libre: Intro conserva lo escrito como valor", async () => {
    const box = await inject("Combobox", 3);
    const combo = box.locator(".z-combobox");
    const input = combo.locator("input.z-input__control");
    await events();
    await input.click();
    await page.keyboard.type("Porto");
    await press("Escape");
    await input.focus();
    await page.keyboard.type("x");
    await input.fill("Porto");
    await input.dispatchEvent("input");
    await press("Enter");
    ok((await combo.getAttribute("data-value")) === "Porto", `valor libre: ${await combo.getAttribute("data-value")}`);
    ok(
      (await events()).some((e) => e.name === "z:change" && e.detail.value === "Porto" && e.detail.label === null),
      "z:change libre",
    );
    await input.fill("madrid");
    await input.dispatchEvent("input");
    await press("Tab");
    ok((await combo.getAttribute("data-value")) === "madrid", "coincidencia al salir");
  });

  /* ---------- Editable ---------- */
  await test("Editable: clic edita, Intro guarda, Escape cancela y el foco vuelve al texto", async () => {
    const box = card("Editable").locator(".z-editable");
    const preview = box.locator(".z-editable__preview");
    const field = box.locator(".z-editable__input");
    await preview.click();
    ok(await activeIs("[data-component='Editable'] .z-editable__input"), "no entró a editar");
    await field.fill("Aurora");
    await events();
    await press("Enter");
    ok((await box.getAttribute("data-value")) === "Aurora" && (await preview.textContent()).trim() === "Aurora", "no guardó");
    ok(await activeIs("[data-component='Editable'] .z-editable__preview"), "foco al texto");
    ok(
      (await events()).some((e) => e.name === "z:change" && e.detail.value === "Aurora"),
      "z:change",
    );
    await press("Enter");
    await field.fill("Nope");
    await press("Escape");
    ok((await box.getAttribute("data-value")) === "Aurora", "Escape no cancela");
    const named = await preview.evaluate((el) =>
      el
        .getAttribute("aria-labelledby")
        .split(" ")
        .map((id) => document.getElementById(id).textContent)
        .join(" "),
    );
    ok(named === "Project name Aurora", `nombre: ${named}`);
  });

  /* ---------- Variantes ---------- */
  await test("Slider con marcas: las marcas del rango se pintan al mover el tirador", async () => {
    const box = (await inject("Slider", 2)).locator(".z-slider");
    const thumb = box.locator("[role='slider']");
    ok((await box.locator(".z-slider__mark[data-in-range]").count()) === 3, "marcas en rango al inicio");
    await thumb.focus();
    await press("ArrowRight");
    ok((await thumb.getAttribute("aria-valuenow")) === "75", "paso");
    ok((await box.locator(".z-slider__mark[data-in-range]").count()) === 4, "marca nueva en rango");
    ok((await box.locator(".z-slider__mark-label").count()) === 3, "etiquetas");
  });
  await test("Rating con medias: flechas de 0,5 en 0,5 y relleno a la mitad", async () => {
    const box = (await inject("Rating", 2)).locator(".z-rating__stars");
    const checked = () => box.locator("[aria-checked='true']").getAttribute("data-star");
    ok((await checked()) === "3.5", `inicial: ${await checked()}`);
    await box.locator("[aria-checked='true']").focus();
    await press("ArrowRight");
    ok((await checked()) === "4", `flecha: ${await checked()}`);
    await press("ArrowLeft", "ArrowLeft");
    ok((await checked()) === "3", `atrás: ${await checked()}`);
    await box.locator("[data-star='2.5']").click();
    const clip = await box
      .locator(".z-rating__cell")
      .nth(2)
      .locator(".z-rating__glyph--filled")
      .evaluate((el) => getComputedStyle(el).clipPath);
    ok(clip.includes("50%"), `media estrella: ${clip}`);
  });
  await test("FileUpload con lista: elegir muestra el archivo y quitarlo lo saca del campo", async () => {
    const zone = card("FileUpload").locator(".z-upload");
    await zone.locator(".z-upload__input").setInputFiles([
      { name: "a.png", mimeType: "image/png", buffer: Buffer.from([137, 80, 78, 71]) },
      { name: "b.png", mimeType: "image/png", buffer: Buffer.from([137, 80, 78, 71]) },
    ]);
    ok((await zone.locator(".z-upload__file").count()) === 2, "lista");
    ok((await zone.locator(".z-upload__thumb img").count()) === 2, "miniaturas");
    await zone.locator(".z-upload__remove").first().click();
    ok((await zone.locator(".z-upload__file").count()) === 1, "quitar");
    ok((await zone.locator(".z-upload__input").evaluate((el) => el.files.length)) === 1, "el campo pierde el archivo");
  });
  await test("OTPInput con separador: el separador no es una casilla", async () => {
    const box = (await inject("OTPInput", 2)).locator(".z-otp");
    ok((await box.locator(".z-otp__separator").count()) === 1 && (await box.locator(".z-otp__cell").count()) === 6, "estructura");
    await box.locator(".z-otp__cell").first().click();
    await page.keyboard.type("123456");
    ok((await box.getAttribute("data-value")) === "123456", `valor: ${await box.getAttribute("data-value")}`);
  });
}
