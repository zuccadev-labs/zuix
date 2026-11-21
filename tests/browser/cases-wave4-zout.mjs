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
    {
      name: "Oleada 4 · PaneHeader y FloatingPanel: barra de acciones, arrastre, flechas, límites, Escape y foco",
      async run({ open }) {
        const page = await screen(open);
        const bar = `${t("ws-paneheader")} [role=toolbar]`;
        await expectAttr(page, bar, "aria-label", "Editor actions");
        await page.focus(`${bar} button >> nth=0`);
        await press(page, "End");
        await focusOn(page, `${bar} [aria-label="More actions"]`, "Fin en la barra");
        const value = t("ws-float-value");
        const initial = await page.locator(value).textContent();
        assert(initial === "16,16,220,180", `valor inicial: ${initial}`);
        const area = page.locator(t("ws-float"));
        await area.scrollIntoViewIfNeeded();
        const title = await page.locator(`${t("ws-float")} .z-floatpanel__title`).boundingBox();
        await page.mouse.move(title.x + 20, title.y + 5);
        await page.mouse.down();
        await page.mouse.move(title.x + 40, title.y + 25, { steps: 6 });
        await page.mouse.up();
        const afterDrag = await page.locator(value).textContent();
        assert(afterDrag === "36,36,220,180", `tras arrastrar: ${afterDrag} (cabecera ${JSON.stringify(title)})`);
        // Al estrecharse el área, el redimensionado de la ventana acota la posición actual (no la del montaje).
        await area.evaluate((el) => {
          el.style.inlineSize = "250px"; // 248 px por dentro: x = 248 − 220 − 8
          window.dispatchEvent(new Event("resize"));
        });
        await expectText(page, value, "20,36,220,180");
        await area.evaluate((el) => {
          el.style.inlineSize = "";
          window.dispatchEvent(new Event("resize"));
        });
        await page.focus(`${t("ws-float")} .z-floatpanel__handle`);
        await press(page, "ArrowUp", "Shift+ArrowLeft");
        await expectText(page, value, "8,26,220,180");
        await page.focus(`${t("ws-float")} .z-floatpanel__resize`);
        await press(page, "ArrowRight", "ArrowDown");
        await expectText(page, value, "8,26,230,190");
        for (let i = 0; i < 4; i++) await press(page, "Shift+ArrowDown");
        const [, , , h] = (await page.locator(value).textContent()).split(",").map(Number);
        const max = await area.evaluate((el) => el.clientHeight - 26 - 8);
        assert(h === max, `alto acotado al área: ${h} / ${max}`);
        await press(page, "Escape");
        await expectText(page, value, "closed");
        await page.click(t("ws-float-toggle"));
        await focusOn(page, `${t("ws-float")} .z-floatpanel`, "el foco entra al abrir");
        await expectAttr(page, `${t("ws-float")} .z-floatpanel`, "role", "dialog");
        await page.click(`${t("ws-float")} .z-floatpanel__close`);
        await expectText(page, value, "closed");
        await focusOn(page, t("ws-float-toggle"), "el foco vuelve al botón");
        void gone;
        void visible;
      },
    },
    {
      name: "Oleada 4 · PaneLayout: menú (dividir, mover, cerrar), arrastre al borde con zona de soltar y foco",
      async run({ open }) {
        const page = await screen(open);
        const root = t("ws-panelayout");
        const ids = () => page.locator(`${root} [data-pane-id]`).evaluateAll((list) => list.map((el) => el.dataset.paneId).join(","));
        await page.locator(root).scrollIntoViewIfNeeded();
        assert((await ids()) === "editor,preview,terminal", `inicial: ${await ids()}`);
        // Menú de Editor con teclado: Split right crea un panel nuevo a su derecha.
        await page.focus(`${root} [data-pane-id="editor"] .z-panelayout__menu`);
        await press(page, "Enter");
        await visible(page, ".z-menu[role=menu]");
        await press(page, "Enter");
        await poll(async () => (await ids()) === "editor,notes-1,preview,terminal", "split right");
        // Move right: intercambia Editor con su vecino de la derecha y lo anuncia.
        await page.focus(`${root} [data-pane-id="editor"] .z-panelayout__menu`);
        await press(page, "Enter");
        await visible(page, ".z-menu[role=menu]");
        await page.click(".z-menu[role=menu] >> text=Move right");
        await poll(async () => (await ids()) === "notes-1,editor,preview,terminal", "move right");
        await expectText(page, `${root} .z-panelayout__status`, "Editor moved");
        // Arrastrar Terminal al borde izquierdo de Notes 1.
        const grab = await page.locator(`${root} [data-pane-id="terminal"] .z-paneheader__title`).boundingBox();
        const target = await page.locator(`${root} [data-pane-id="notes-1"]`).boundingBox();
        await page.mouse.move(grab.x + 10, grab.y + 5);
        await page.mouse.down();
        await page.mouse.move(grab.x + 40, grab.y + 30, { steps: 4 });
        await page.mouse.move(target.x + 10, target.y + target.height / 2, { steps: 8 });
        await visible(page, `${root} .z-panelayout__drop[data-edge="inline-start"]`, "zona de soltar a la izquierda");
        assert((await ids()) === "notes-1,editor,preview,terminal", "nada cambia mientras se arrastra");
        await page.mouse.up();
        await poll(async () => (await ids()) === "terminal,notes-1,editor,preview", `soltar: ${await ids()}`);
        await gone(page, `${root} .z-panelayout__drop`);
        // Cerrar Notes 1 desde su menú.
        await page.click(`${root} [data-pane-id="notes-1"] .z-panelayout__menu`);
        await page.click(".z-menu[role=menu] >> text=Close pane");
        await poll(async () => (await ids()) === "terminal,editor,preview", `cerrar: ${await ids()}`);
        // El panel pulsado pasa a tener el foco visual.
        await page.click(`${root} [data-pane-id="preview"] .z-pane__body`);
        await expectAttr(page, `${root} [data-pane-id="preview"] .z-pane`, "data-focused", "true");
      },
    },
  ];
}
