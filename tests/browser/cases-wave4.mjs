// Oleada 4 en el binding de React (pantalla `?screen=commands` de examples/app): barras, menús con estado, capas
// ligeras y avisos de aplicación, con teclado y puntero. Se ejecutan también en Firefox y WebKit.
// Exporta una función que recibe los ayudantes de cases.mjs.
export default function ({ t, assert, poll, visible, gone, focusOn, expectAttr, expectText }) {
  const screen = (open) => open("commands");
  const press = async (page, ...keys) => {
    for (const key of keys) await page.keyboard.press(key);
  };
  const activeLabel = (page) =>
    page.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? document.activeElement?.textContent?.trim());
  const expectActive = (page, label, message) => poll(async () => (await activeLabel(page)) === label, message ?? `foco en ${label}`);

  return [
    {
      name: "Oleada 4 · Toolbar: una parada de Tab, flechas entre grupos (ToggleGroup anidado) y aria-disabled sin acción",
      async run({ open }) {
        const page = await screen(open);
        const bar = t("c-toolbar");
        const stops = await page.locator(`${bar} button`).evaluateAll((list) => list.filter((el) => el.tabIndex === 0).length);
        assert(stops === 1, `paradas de Tab: ${stops}`);
        await page.locator(`${bar} [aria-label="Bold"]`).focus();
        await press(page, "ArrowRight", "ArrowRight", "ArrowRight");
        await expectActive(page, "Insert link", "cruza del ToggleGroup al grupo Insert");
        await press(page, "ArrowRight", "ArrowRight");
        await expectActive(page, "Insert code");
        await press(page, "Enter");
        await expectText(page, t("c-last"), "none", "aria-disabled no ejecuta la acción");
        await press(page, "ArrowLeft", "Enter");
        await expectText(page, t("c-last"), "toolbar:image");
        await press(page, "Home", "ArrowRight", " ");
        await expectText(page, t("c-format"), "bold,italic");
        const after = await page.locator(`${bar} button`).evaluateAll((list) => list.filter((el) => el.tabIndex === 0).length);
        assert(after === 1, `una sola parada tras el uso: ${after}`);
        await press(page, "End");
        await expectActive(page, "View");
        await press(page, "ArrowRight");
        await expectActive(page, "Bold", "vuelta al principio");
      },
    },
    {
      name: "Oleada 4 · Menu: casilla con Espacio (sigue abierto) e Intro (cierra), radio excluyente y deshabilitado",
      async run({ open }) {
        const page = await screen(open);
        await page.click(t("c-view"));
        await visible(page, '.z-menu[role="menu"]');
        await focusOn(page, '[role="menuitemcheckbox"]', "foco en la primera casilla");
        await expectAttr(page, '[role="menuitemcheckbox"]', "aria-checked", "true");
        await press(page, " ");
        await expectText(page, t("c-minimap"), "false");
        await visible(page, '.z-menu[role="menu"]', "Espacio deja el menú abierto");
        await expectAttr(page, '[role="menuitemcheckbox"]', "aria-checked", "false");
        await press(page, "ArrowDown", "Enter");
        await gone(page, '.z-menu[role="menu"]', "Intro cierra");
        await expectText(page, t("c-wrap"), "true");
        await focusOn(page, t("c-view"), "el foco vuelve al disparador");
        await press(page, "ArrowDown");
        await visible(page, '.z-menu[role="menu"]');
        const group = await page.locator('.z-menu [role="group"]').getAttribute("aria-labelledby");
        assert(group && (await page.locator(`[id="${group}"]`).textContent()) === "Density", "grupo de radio con nombre");
        await page.click('[role="menuitemradio"]:has-text("Compact")');
        await gone(page, '.z-menu[role="menu"]');
        await expectText(page, t("c-density"), "compact");
        await page.click(t("c-view"));
        const disabled = page.locator('[role="menuitemradio"]:has-text("Spacious")');
        await disabled.click({ force: true });
        await expectText(page, t("c-density"), "compact", "un radio deshabilitado no cambia");
        const link = await page.locator('.z-menu a[role="menuitem"]').getAttribute("href");
        assert(link === "#shortcuts", `entrada enlace: ${link}`);
        await press(page, "Escape");
        await gone(page, '.z-menu[role="menu"]');
      },
    },
    {
      name: "Oleada 4 · Collapsible: aria-expanded, hidden=until-found plegado y colapso parcial que se abre con el foco",
      async run({ open }) {
        const page = await screen(open);
        const trigger = "#c-advanced > .z-collapsible__trigger";
        await expectAttr(page, "#c-advanced-content", "hidden", "until-found");
        await page.click(trigger);
        await expectText(page, t("c-details"), "true");
        await expectAttr(page, trigger, "aria-expanded", "true");
        await press(page, "Enter");
        await expectText(page, t("c-details"), "false");
        await expectAttr(page, "#c-advanced-content", "hidden", "until-found");
        await page.locator("#c-advanced-content").evaluate((el) => el.dispatchEvent(new Event("beforematch", { bubbles: true })));
        await expectText(page, t("c-details"), "true", "beforematch abre");
        await page.locator('#c-notes a[href="#notes"]').focus();
        await expectAttr(page, "#c-notes", "data-state", "open", "el foco en la parte recortada la despliega");
      },
    },
    {
      name: "Oleada 4 · Banner: cierre con nombre, el foco sigue hacia delante",
      async run({ open }) {
        const page = await screen(open);
        const close = `${t("c-banner")} .z-banner__close`;
        await expectAttr(page, close, "aria-label", "Dismiss");
        await page.locator(close).focus();
        await press(page, "Enter");
        await visible(page, t("c-banner-gone"));
        const active = await page.evaluate(() => document.activeElement?.tagName);
        assert(active && active !== "BODY", `el foco no se pierde: ${active}`);
      },
    },
  ];
}
