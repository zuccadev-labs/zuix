// Botones de menú sin framework: FabMenu, SplitButton y AccountMenu sobre el Menu de `zui/dom` (APG Menu Button).
// Clic, Intro, Espacio y ↓ abren con el foco en la primera entrada; ↑ en la última; Escape cierra y devuelve el foco
// al botón; un clic fuera cierra.

export default async function ({ page, test, ok, card, settle }) {
  const isOpen = (sel) => page.locator(sel).evaluate((el) => el.matches(":popover-open"));
  const focusText = () => page.evaluate(() => document.activeElement?.textContent.trim().replace(/\s+/g, " ") ?? "");
  const focused = (sel) => page.locator(sel).evaluate((el) => el === document.activeElement);
  // Cerrado del todo: fuera de la capa superior y con el botón ya en aria-expanded=false (lo pone el evento `toggle`,
  // que llega después).
  const closed = async (sel) => {
    await page.waitForFunction(
      (s) =>
        !document.querySelector(s).matches(":popover-open") &&
        document.querySelector(`[data-z-open="${s}"]`)?.getAttribute("aria-expanded") === "false",
      sel,
      { timeout: 3000 },
    );
  };

  // Página limpia: los casos anteriores comparten esta página y pueden dejar piezas desplazadas o en la capa superior
  // (la rejilla de FileUpload tras arrastrar) encima de los botones de este archivo.
  const fresh = async () => {
    await page.reload();
    await page.waitForFunction(() => customElements.get("z-icon") && document.querySelector('[data-component="FabMenu"]'));
    await settle();
  };
  let reloaded = false;

  const cases = [
    { name: "FabMenu", menu: "#fab-actions", first: "Document", last: "Folder", side: "top" },
    { name: "SplitButton", menu: "#publish-more", first: "Schedule", last: "Save as draft", side: "bottom" },
    { name: "AccountMenu", menu: "#account", first: "Ana López · ana@example.com", last: "Sign out", side: "bottom" },
  ];

  for (const { name, menu, first, last, side } of cases) {
    await test(`${name} sin React: clic, Intro, ↓ y ↑ abren el menú; Escape y un clic fuera lo cierran`, async () => {
      if (!reloaded) {
        await fresh();
        reloaded = true;
      }
      const button = card(name).locator("[data-z-open]");
      // Lo que dejó abierto un caso anterior se cierra; el botón, en el centro de la ventana (sitio arriba y abajo).
      await page.keyboard.press("Escape");
      await page.mouse.click(5, 5);
      await button.evaluate((el) => el.scrollIntoView({ block: "center" }));
      ok((await button.getAttribute("aria-haspopup")) === "menu", "aria-haspopup=menu");
      ok((await button.getAttribute("aria-expanded")) === "false", "aria-expanded inicial");

      // Clic: abre, coloca el menú del lado que pide el marcado y enfoca la primera entrada.
      await button.click();
      await settle();
      ok(await isOpen(menu), "el clic no abrió el menú");
      ok((await button.getAttribute("aria-expanded")) === "true", "aria-expanded al abrir");
      ok((await focusText()) === first, `primera entrada sin foco: ${await focusText()}`);
      // Del lado que pide el marcado si cabe; si no, del otro. Nunca encima del botón.
      const [b, m] = [await button.boundingBox(), await page.locator(menu).boundingBox()];
      const above = m.y + m.height <= b.y + 1;
      const below = m.y >= b.y + b.height - 1;
      const room = side === "top" ? b.y : (page.viewportSize()?.height ?? 0) - b.y - b.height;
      ok(above || below, `el menú tapa el botón: ${JSON.stringify([b, m])}`);
      ok(room < m.height + 8 || (side === "top" ? above : below), `el menú no sale por ${side}: ${JSON.stringify([b, m])}`);
      await page.keyboard.press("ArrowDown");
      ok((await focusText()) !== first, "↓ no avanza entre entradas");
      await page.keyboard.press("End");
      ok((await focusText()) === last, `Fin no llega a la última: ${await focusText()}`);

      // Escape: cierra y el foco vuelve al botón.
      await page.keyboard.press("Escape");
      await closed(menu);
      ok(await focused(`[data-component="${name}"] [data-z-open]`), "Escape no devolvió el foco al botón");

      // Intro abre por el clic, con el foco en la primera.
      await page.keyboard.press("Enter");
      await settle();
      ok(await isOpen(menu), "Intro no abrió el menú");
      ok((await focusText()) === first, `Intro: primera entrada sin foco: ${await focusText()}`);
      await page.keyboard.press("Escape");
      await closed(menu);

      // ↑ abre con el foco en la última; ↓, en la primera.
      await page.keyboard.press("ArrowUp");
      await settle();
      ok(await isOpen(menu), "↑ no abrió el menú");
      ok((await focusText()) === last, `↑: última entrada sin foco: ${await focusText()}`);
      await page.keyboard.press("Escape");
      await closed(menu);
      await page.keyboard.press("ArrowDown");
      await settle();
      ok(await isOpen(menu), "↓ no abrió el menú");
      ok((await focusText()) === first, `↓: primera entrada sin foco: ${await focusText()}`);

      // Un clic fuera cierra.
      await page.mouse.click(5, 5);
      await closed(menu);
    });
  }

  await test("SplitButton sin React: la acción principal no abre el menú y elegir una alternativa emite z:select y cierra", async () => {
    const main = card("SplitButton").locator(".z-split-button__main");
    await main.click();
    await settle();
    ok(!(await isOpen("#publish-more")), "la acción principal abrió el menú");
    const selected = page.evaluate(
      () =>
        new Promise((resolve) => {
          document.querySelector("#publish-more").addEventListener("z:select", (e) => resolve(e.target.textContent.trim()), { once: true });
        }),
    );
    await card("SplitButton").locator(".z-split-button__toggle").click();
    await settle();
    await page.locator("#publish-more .z-menu__item").nth(1).click();
    ok((await selected) === "Save as draft", "z:select no llegó con la alternativa elegida");
    await closed("#publish-more");
  });

  await test("AccountMenu sin React: cambiar de cuenta y de tema marca un solo radio por grupo y emite z:change", async () => {
    const button = card("AccountMenu").locator("[data-z-open]");
    const changes = [];
    await page.exposeFunction("__accountChange", (value) => changes.push(value)).catch(() => {});
    await page.evaluate(() => {
      document.querySelector("#account").addEventListener("z:change", (e) => window.__accountChange(e.detail.value));
    });
    await button.click();
    await settle();
    await page.locator('#account [role="menuitemradio"][value="work"]').click();
    await closed("#account");
    await button.click();
    await settle();
    await page.locator('#account [role="menuitemradio"][value="light"]').click();
    await closed("#account");
    const checked = await page.evaluate(() =>
      [...document.querySelectorAll('#account [role="menuitemradio"][aria-checked="true"]')].map((el) => el.getAttribute("value")),
    );
    ok(checked.join(",") === "work,light", `radios marcados: ${checked.join(",")}`);
    await page.waitForTimeout(50);
    ok(changes.join(",") === "work,light", `z:change: ${changes.join(",")}`);
  });
}
