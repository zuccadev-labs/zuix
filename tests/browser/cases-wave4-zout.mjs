// Oleada 4 de zout en el binding de React (pantalla `?screen=workspace` de examples/app): Sidebar plegable a iconos,
// TabStrip con grupos y reordenación, PaneHeader, FloatingPanel, PaneLayout y Float. Se ejecutan también en Firefox
// y WebKit. Exporta una función que recibe los ayudantes de cases.mjs.
export default function ({ t, assert, poll, visible, gone, focusOn, expectAttr, expectText }) {
  const screen = (open, options) => open("workspace", options);
  const press = async (page, ...keys) => {
    for (const key of keys) await page.keyboard.press(key);
  };

  return [
    {
      name: "Oleada 4 · Sidebar: submenú en su sitio, plegado a iconos con tooltip y submenú flotante",
      async run({ open }) {
        const page = await screen(open);
        const root = t("ws-sidebar");
        const projects = `${root} .z-sidebar__link[data-has-sub]`;
        await expectAttr(page, projects, "aria-expanded", "true");
        await page.click(`${root} .z-sidebar__sub .z-sidebar__link >> text=Atlas`);
        await expectText(page, t("ws-sidebar-value"), "atlas");
        await page.click(projects);
        await expectAttr(page, projects, "aria-expanded", "false");
        const trigger = `${root} .z-sidebar__trigger`;
        await page.click(trigger);
        await expectAttr(page, trigger, "aria-expanded", "false");
        await expectAttr(page, `${root} .z-sidebar`, "data-collapsed", "true");
        // Plegada: el nombre sigue en el árbol accesible y aparece en un tooltip con el foco.
        const inbox = page.locator(`${root} .z-sidebar__link`).nth(1);
        assert((await inbox.textContent()).includes("Inbox"), "el texto sigue en el nombre");
        await inbox.focus();
        await page.keyboard.press("Shift+Tab");
        await page.keyboard.press("Tab");
        await visible(page, ".z-tooltip >> text=Inbox", "tooltip con el nombre al enfocar");
        await page.keyboard.press("Escape");
        await gone(page, ".z-tooltip");
        // El item con submenú abre un panel flotante a su derecha con los subitems.
        await page.click(projects);
        await visible(page, ".z-sidebar__flyout", "panel flotante del submenú");
        const [item, panel] = await Promise.all([page.locator(projects).boundingBox(), page.locator(".z-sidebar__flyout").boundingBox()]);
        assert(panel.x >= item.x + item.width - 2, `flotante a la derecha: ${panel.x} / ${item.x + item.width}`);
        await focusOn(page, ".z-sidebar__flyout .z-sidebar__link", "el foco entra en el panel");
        await page.keyboard.press("Enter");
        await expectText(page, t("ws-sidebar-value"), "atlas");
        await page.keyboard.press("Escape");
        await gone(page, ".z-sidebar__flyout");
        await focusOn(page, projects, "el foco vuelve al item");
        await page.click(trigger);
        await expectAttr(page, trigger, "aria-expanded", "true");
      },
    },
    {
      name: "Oleada 4 · TabStrip: Ctrl+Mayús+flechas reordena con anuncio; arrastrar suelta en el hueco; grupo plegable",
      async run({ open }) {
        const page = await screen(open);
        const root = t("ws-tabs");
        await page.focus(`${root} [data-tab-id="button"]`);
        await press(page, "Control+Shift+ArrowRight");
        await expectText(page, t("ws-tabs-value"), "menu,button,routes,schema,readme");
        await focusOn(page, `${root} [data-tab-id="button"]`, "el foco sigue en la pestaña movida");
        await expectText(page, `${root} .z-tabstrip__status`, "Button.tsx moved to position 2 of 5");
        await press(page, "Control+Shift+Home");
        await expectText(page, t("ws-tabs-value"), "button,menu,routes,schema,readme");
        // Arrastre: sin cambios mientras se mueve; al soltar, en el hueco.
        const from = await page.locator(`${root} [data-tab-id="button"]`).boundingBox();
        const to = await page.locator(`${root} [data-tab-id="schema"]`).locator("..").boundingBox();
        await page.mouse.move(from.x + 10, from.y + from.height / 2);
        await page.mouse.down();
        await page.mouse.move(from.x + 30, from.y + from.height / 2, { steps: 3 });
        await page.mouse.move(to.x + to.width - 4, to.y + to.height / 2, { steps: 8 });
        await poll(async () => (await page.locator(`${root} .z-tabstrip__tab[data-drop]`).count()) === 1, "marca de soltar");
        await expectText(page, t("ws-tabs-value"), "button,menu,routes,schema,readme");
        await page.mouse.up();
        await expectText(page, t("ws-tabs-value"), "menu,routes,schema,button,readme");
        await expectAttr(page, `${root} [data-tab-id="button"]`, "aria-selected", "true");
        // Chip del grupo API: pliega sus pestañas.
        await page.click(`${root} .z-tabstrip__group[data-group-id="api"] .z-tabstrip__chip`);
        await poll(() => page.locator(`${root} [data-tab-id="routes"]`).isHidden(), "routes oculta");
        const described = await page
          .locator(`${root} [data-tab-id="menu"]`)
          .evaluate((el) => document.getElementById(el.getAttribute("aria-describedby"))?.textContent);
        assert(described === "UI", `pestaña descrita por su grupo: ${described}`);
        const name = await page.locator(`${root} [data-tab-id="button"]`).evaluate((el) => el.textContent);
        assert(name.includes("modified"), `cambios sin guardar en el nombre: ${name}`);
      },
    },
  ];
}
