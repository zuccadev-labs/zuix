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
    {
      name: "Oleada 4 · Menubar: una parada de Tab, flechas entre títulos y entre menús abiertos, puntero y Escape",
      async run({ open }) {
        const page = await screen(open);
        const bar = '[role="menubar"][aria-label="Application"]';
        const stops = await page.locator(`${bar} [role="menuitem"]`).evaluateAll((list) => list.filter((el) => el.tabIndex === 0).length);
        assert(stops === 1, `paradas: ${stops}`);
        await page.locator(`${bar} [role="menuitem"]`).first().focus();
        await press(page, "ArrowLeft");
        await expectActive(page, "View", "vuelta al último título habilitado (Help está deshabilitado)");
        await press(page, "ArrowRight", "ArrowDown");
        await visible(page, '.z-menu[role="menu"]');
        await focusOn(page, '.z-menu [role="menuitem"]', "foco en New file");
        await press(page, "ArrowRight");
        await focusOn(page, '.z-menu [role="menuitem"]:has-text("Undo")', "derecha pasa al menú Edit");
        await press(page, "ArrowLeft");
        await focusOn(page, '.z-menu [role="menuitem"]:has-text("New file")', "izquierda vuelve a File");
        await press(page, "ArrowDown", "ArrowDown", "ArrowRight");
        await focusOn(page, '.z-menu [role="menuitem"]:has-text("atlas/README.md")', "derecha en Open recent abre el submenú");
        await press(page, "Enter");
        await expectText(page, t("c-last"), "file:readme");
        await focusOn(page, `${bar} [role="menuitem"]:has-text("File")`, "el foco vuelve al título");
        await page.click(`${bar} [role="menuitem"]:has-text("View")`);
        await visible(page, '.z-menu [role="menuitemcheckbox"]');
        await page.hover(`${bar} [role="menuitem"]:has-text("Edit")`);
        await visible(page, '.z-menu [role="menuitem"]:has-text("Redo")', "el puntero cambia de menú");
        await press(page, "Escape");
        await gone(page, '.z-menu[role="menu"]');
      },
    },
    {
      name: "Oleada 4 · HoverCard: puntero con retardo y paso a la tarjeta, teclado con Tab dentro y fuera, Escape",
      async run({ open }) {
        const page = await screen(open);
        const link = t("c-hover-link");
        await page.hover(link);
        await visible(page, ".z-hovercard", "abre al pasar el puntero");
        const described = await page.locator(link).getAttribute("aria-describedby");
        assert(
          described && (await page.locator(`[id="${described}"]`).getAttribute("role")) === "tooltip",
          "la tarjeta describe al enlace",
        );
        assert((await page.locator(link).getAttribute("aria-expanded")) === null, "sin aria-expanded");
        const box = await page.locator(".z-hovercard").boundingBox();
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 4 });
        await page.waitForTimeout(500);
        await visible(page, ".z-hovercard", "sigue abierta con el puntero encima");
        await press(page, "Escape");
        await gone(page, ".z-hovercard");
        await page.mouse.move(5, 5);
        await page.locator(link).focus();
        await press(page, "Shift+Tab", "Tab");
        await visible(page, ".z-hovercard", "abre al enfocar con el teclado");
        await press(page, "Tab");
        await focusOn(page, t("c-hover-projects"), "Tab entra en la tarjeta");
        await press(page, "Tab");
        await focusOn(page, t("c-after-hover"), "Tab sale tras el enlace");
        await gone(page, ".z-hovercard");
      },
    },
    {
      name: "Oleada 4 · Toggletip: clic fija y aria-expanded, Escape cierra, Tab entra en su enlace",
      async run({ open }) {
        const page = await screen(open);
        const button = `${t("c-toggletip")} .z-toggletip__trigger`;
        await expectAttr(page, button, "aria-label", "More about shipping");
        await page.click(button);
        await visible(page, ".z-toggletip");
        await expectAttr(page, button, "aria-expanded", "true");
        await page.mouse.move(5, 5);
        await page.waitForTimeout(400);
        await visible(page, ".z-toggletip", "fijada");
        await page.locator(button).focus();
        await press(page, "Tab");
        await focusOn(page, '.z-toggletip a[href="#shipping"]', "Tab entra en su enlace");
        await press(page, "Escape");
        await gone(page, ".z-toggletip");
        await focusOn(page, button, "Escape devuelve el foco al botón");
        await expectAttr(page, button, "aria-expanded", "false");
      },
    },
    {
      name: "Oleada 4 · Popover: ancla distinta, flecha al centro del ancla y botón de cierre",
      async run({ open }) {
        const page = await screen(open);
        await page.click(t("c-dns"));
        await visible(page, ".z-popover[data-arrow]");
        await page.waitForTimeout(150);
        const geo = await page.evaluate(() => {
          const field = document.querySelector('[data-testid="c-domain"]').getBoundingClientRect();
          const pop = document.querySelector(".z-popover[data-arrow]");
          const r = pop.getBoundingClientRect();
          return {
            side: pop.dataset.side,
            gap: r.top - field.bottom,
            offset: parseFloat(pop.style.getPropertyValue("--z-arrow-offset")),
            center: field.left + field.width / 2 - r.left,
          };
        });
        assert(geo.side === "bottom" && geo.gap > 0 && geo.gap < 20, `bajo el campo: ${JSON.stringify(geo)}`);
        assert(Math.abs(geo.offset - geo.center) <= 2 || geo.offset >= 12, `flecha: ${JSON.stringify(geo)}`);
        await page.click(".z-popover__close");
        await gone(page, ".z-popover[data-arrow]");
        await focusOn(page, t("c-dns"), "el foco vuelve al disparador");
      },
    },
    {
      name: "Oleada 4 · toast.promise: en curso sin cierre automático y resultado en el mismo aviso",
      async run({ open }) {
        const page = await screen(open);
        await page.click(t("c-deploy"));
        await visible(page, '.z-toast[aria-busy="true"]');
        await page.evaluate(() => window.__deploy.resolve("0.3.0"));
        await visible(page, '.z-toast[data-intent="success"]:has-text("Deployed")');
        await expectText(page, '.z-toast[data-intent="success"] .z-toast__description', "Version 0.3.0 is live.");
        const busy = await page.locator(".z-toast[aria-busy]").count();
        assert(busy === 0, "ya no está en curso");
        await page.click(t("c-deploy"));
        await visible(page, '.z-toast[aria-busy="true"]');
        await page.evaluate(() => window.__deploy.reject(new Error("x")));
        await visible(page, '.z-toast[data-intent="danger"][role="alert"]:has-text("Deploy failed")');
      },
    },
    {
      name: "Oleada 4 · Command en línea: filtro, flechas, Intro ejecuta sin cerrar y Escape vacía la búsqueda",
      async run({ open }) {
        const page = await screen(open);
        const input = `${t("c-command")} .z-palette__input`;
        await page.fill(input, "mem");
        await page.keyboard.press("Enter");
        await expectText(page, t("c-last"), "command:members");
        await page.fill(input, "");
        await press(page, "ArrowDown", "ArrowDown", "Enter");
        await expectText(page, t("c-last"), "command:settings");
        await page.fill(input, "dup");
        await press(page, "Escape");
        await poll(async () => (await page.inputValue(input)) === "", "Escape vacía la búsqueda");
        await visible(page, `${t("c-command")} .z-palette__footer`);
      },
    },
    {
      name: "Oleada 4 · ActionBar: aparece con la selección sin robar el foco, recuento, Toolbar y Escape la vacía",
      async run({ open }) {
        const page = await screen(open);
        await page.check(t("c-file-report.pdf"));
        await visible(page, ".z-actionbar");
        await focusOn(page, t("c-file-report.pdf"), "el foco sigue en la casilla");
        await page.check(t("c-file-logo.svg"));
        await expectText(page, ".z-actionbar__count", "2 selected");
        await page.click('.z-actionbar [aria-label="Download"]');
        await expectText(page, t("c-last"), "download:2");
        await press(page, "End");
        await focusOn(page, ".z-actionbar__close", "Fin llega al cierre");
        await press(page, "Escape");
        await gone(page, ".z-actionbar", "Escape vacía la selección");
        assert(!(await page.isChecked(t("c-file-logo.svg"))), "selección vacía");
      },
    },
  ];
}
