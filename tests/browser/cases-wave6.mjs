// Oleada 6 en el binding de React (pantalla `?screen=site` de examples/app): Navbar, NavigationMenu, SkipLink,
// BottomNavigation, DotMatrix, Spinner con formas y efectos. Exporta una función que recibe los ayudantes de cases.mjs.
export default function ({ t, assert, poll, expectAttr, expectText }) {
  const screen = (open, options) => open("site", options);
  const isOpen = (page, selector) =>
    page
      .locator(selector)
      .first()
      .evaluate((el) => el.matches(":popover-open"));
  const focusMatches = (page, selector) => page.evaluate((s) => document.activeElement?.matches(s) ?? false, selector);

  return [
    {
      name: "Oleada 6 · NavigationMenu: panel popover con aria-expanded, Escape devuelve el foco y salir lo cierra (React)",
      async run({ open }) {
        const page = await screen(open);
        const trigger = `${t("s-navmenu")} .z-navmenu__trigger >> nth=0`;
        await page.locator(t("s-navmenu")).scrollIntoViewIfNeeded();
        await page.focus(trigger);
        await page.keyboard.press("Enter");
        const panel = `${t("s-navmenu")} .z-navmenu__panel >> nth=0`;
        await poll(() => isOpen(page, panel), "el panel se abre");
        await expectAttr(page, trigger, "aria-expanded", "true");
        const box = await page.locator(panel).boundingBox();
        const tb = await page.locator(trigger).boundingBox();
        assert(box && tb && box.y >= tb.y + tb.height && box.y - (tb.y + tb.height) < 16, "el panel queda bajo su botón");
        await page.keyboard.press("Tab");
        assert(await focusMatches(page, ".z-navmenu__card"), "Tab entra en los enlaces del panel");
        await page.keyboard.press("Escape");
        await poll(async () => !(await isOpen(page, panel)), "Escape cierra");
        await poll(() => focusMatches(page, ".z-navmenu__trigger"), "el foco vuelve al botón");
        await expectAttr(page, trigger, "aria-expanded", "false");
        assert((await page.locator(`${t("s-navmenu")} [role=menu], ${t("s-navmenu")} [role=menuitem]`).count()) === 0, "sin roles de menú");
      },
    },
    {
      name: "Oleada 6 · Navbar: en fila a 1440 y en cajón a 390, con el NavigationMenu en vertical (React)",
      async run({ open }) {
        const wide = await screen(open);
        await expectAttr(wide, `${t("s-navbar")} .z-navbar`, "data-collapsed", null);
        assert(!(await wide.locator(`${t("s-navbar")} .z-navbar__toggle`).isVisible()), "sin botón de menú en ancho");
        const page = await screen(open, { width: 390, height: 800 });
        const nav = `${t("s-navbar")} .z-navbar`;
        await poll(async () => (await page.locator(nav).getAttribute("data-collapsed")) !== null, "plegado en estrecho");
        const toggle = `${t("s-navbar")} .z-navbar__toggle`;
        await page.click(toggle);
        const menu = `${t("s-navbar")} .z-navbar__menu`;
        await poll(() => isOpen(page, menu), "el cajón se abre");
        await expectAttr(page, toggle, "aria-expanded", "true");
        await expectAttr(page, `${menu} .z-navmenu`, "data-orientation", "vertical");
        const group = `${menu} .z-navmenu__trigger >> nth=0`;
        await page.click(group);
        await expectAttr(page, group, "aria-expanded", "true");
        assert(await page.locator(`${menu} .z-navmenu__card >> nth=0`).isVisible(), "el grupo se despliega en su sitio");
        await page.click(`${menu} .z-navmenu__card >> nth=0`);
        await poll(async () => !(await isOpen(page, menu)), "seguir un enlace cierra el cajón");
        await expectAttr(page, toggle, "aria-expanded", "false");
      },
    },
    {
      name: "Oleada 6 · SkipLink visible con el foco y lleva el foco al contenido; BottomNavigation mueve aria-current (React)",
      async run({ open }) {
        const page = await screen(open);
        const skip = t("s-skip");
        await page.focus(skip);
        await poll(async () => (await page.locator(skip).evaluate((el) => getComputedStyle(el).opacity)) === "1", "visible al enfocarse");
        await page.keyboard.press("Enter");
        await poll(() => page.evaluate(() => document.activeElement?.id === "site-main"), "el foco entra en el destino");
        await expectAttr(page, "#site-main", "tabindex", "-1");
        const items = `${t("s-bottomnav")} .z-bottomnav__item`;
        await expectAttr(page, `${items} >> nth=0`, "aria-current", "page");
        await page.click(`${items} >> nth=1`);
        await expectText(page, t("s-tab"), "search");
        await expectAttr(page, `${items} >> nth=1`, "aria-current", "page");
        await expectAttr(page, `${items} >> nth=0`, "aria-current", null);
        const name = await page.locator(`${items} >> nth=2`).evaluate((el) => el.textContent);
        assert(name.includes("3 unread"), `insignia con texto para lectores: ${name}`);
      },
    },
    {
      name: "Oleada 6 · DotMatrix y Spinner: estado con nombre, animación solo sin movimiento reducido (React)",
      async run({ open }) {
        const page = await screen(open);
        const mats = page.locator(`${t("s-dots")} .z-dotmatrix`);
        assert((await mats.count()) === 12, "12 patrones");
        assert((await mats.first().getAttribute("role")) === "status", "role=status");
        assert((await mats.first().locator(".z-dotmatrix__dot").count()) === 25, "rejilla 5 × 5");
        const running = (p) =>
          p
            .locator(`${t("s-dots")} .z-dotmatrix__dot:not([data-off])`)
            .first()
            .evaluate((el) => el.getAnimations().length);
        assert((await running(page)) > 0, "anima sin preferencia");
        const still = await screen(open, { reducedMotion: "reduce" });
        assert((await running(still)) === 0, "quieto con movimiento reducido");
        const rest = await still
          .locator(`${t("s-dots")} .z-dotmatrix__dot`)
          .evaluateAll((els) => new Set(els.slice(0, 25).map((e) => getComputedStyle(e).opacity)).size);
        assert(rest > 1, "el fotograma quieto conserva el dibujo del patrón");
      },
    },
    {
      name: "Oleada 6 · Efectos: texto entero para lectores, capas aria-hidden y pausa fuera de pantalla (React)",
      async run({ open }) {
        const page = await screen(open, { height: 400 });
        const text = t("s-text");
        await expectText(page, `${text} .z-sr-only`, "Interfaces that feel native");
        await expectAttr(page, `${text} .z-texteffect__text`, "aria-hidden", "true");
        await expectAttr(page, `${t("s-beam")} .z-beam__ring`, "aria-hidden", "true");
        await expectAttr(page, `${t("s-backdrop")} .z-backdrop__layer`, "aria-hidden", "true");
        await page.locator(t("s-navbar")).scrollIntoViewIfNeeded();
        await poll(async () => (await page.locator(t("s-beam")).getAttribute("data-offscreen")) !== null, "en pausa fuera de pantalla");
        await page.locator(t("s-beam")).scrollIntoViewIfNeeded();
        await poll(async () => (await page.locator(t("s-beam")).getAttribute("data-offscreen")) === null, "se reanuda al verse");
        const glow = page.locator(t("s-glow"));
        const b = await glow.boundingBox();
        await page.mouse.move(b.x + 30, b.y + 20);
        await page.mouse.move(b.x + 40, b.y + 24);
        await poll(
          async () => (await glow.evaluate((el) => el.style.getPropertyValue("--z-glow-x"))) === "40px",
          "el brillo sigue al puntero",
        );
      },
    },
  ];
}
