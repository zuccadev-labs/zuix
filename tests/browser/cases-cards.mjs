// Binding de React de la pantalla `cards` de examples/app: enlace extendido de las tarjetas (toda la tarjeta lleva al
// destino y los controles de dentro siguen funcionando), portadas con semilla, Suggestions en lista con teclado,
// PromptInput con cita y contextos, y ModelPicker con interruptores que no cierran el menú.
export default function ({ assert, poll, visible }) {
  return [
    {
      name: "Tarjetas (React): enlace extendido, controles por encima, foco en la tarjeta y portadas con semilla",
      async run({ open, shot }) {
        const page = await open("cards");
        const feature = page.locator(".z-feature-card").first();
        await feature.scrollIntoViewIfNeeded();
        const tile = await feature.evaluate((el) => getComputedStyle(el.querySelector(".z-backdrop")).getPropertyValue("--z-pattern-tile"));
        assert(tile.includes("data:image/svg+xml"), "la portada lleva la tesela de su semilla");
        const box = await feature.boundingBox();
        // Un clic en la portada (lejos del título) sigue el enlace del título.
        await page.mouse.click(box.x + box.width * 0.8, box.y + box.height * 0.2);
        await poll(() => page.evaluate(() => location.hash === "#pattern-stars"), "la tarjeta entera lleva a su destino");
        // El favorito de una tarjeta con enlace funciona y no navega.
        const lake = page.locator(".z-product-card", { hasText: "Lake House" });
        const heart = lake.locator(".z-card__corner button");
        await heart.click();
        await poll(async () => (await heart.getAttribute("aria-pressed")) === "true", "el favorito se marca");
        assert(await page.evaluate(() => location.hash === "#pattern-stars"), "el favorito no sigue el enlace de la tarjeta");
        // El foco del enlace se dibuja en la tarjeta.
        await lake.locator(".z-card__link").focus();
        await page.keyboard.press("Shift+Tab");
        await page.keyboard.press("Tab");
        const ring = await lake.evaluate((el) => getComputedStyle(el).outlineStyle);
        assert(ring === "solid", `contorno de foco en la tarjeta: ${ring}`);
        await shot(page, "cards-link");
      },
    },
    {
      name: "Suggestions en lista (React): ↓ ↑ Fin recorren las sugerencias y Intro elige",
      async run({ open }) {
        const page = await open("cards");
        const items = page.locator("#cd-suggestions .z-suggestion");
        assert((await items.count()) === 3, "tres sugerencias");
        assert(
          (await page.locator("#cd-suggestions .z-suggestions__hints").getAttribute("aria-hidden")) === "true",
          "pistas ocultas al lector",
        );
        await items.first().focus();
        await page.keyboard.press("ArrowDown");
        await poll(() => page.evaluate(() => document.activeElement?.textContent?.includes("build trust")), "↓ a la segunda");
        await page.keyboard.press("End");
        await poll(() => page.evaluate(() => document.activeElement?.textContent?.includes("feel reliable")), "Fin a la última");
        await page.keyboard.press("ArrowDown");
        await poll(() => page.evaluate(() => document.activeElement?.textContent?.includes("show uncertainty")), "↓ vuelve a la primera");
        await page.keyboard.press("ArrowUp");
        await poll(() => page.evaluate(() => document.activeElement?.textContent?.includes("feel reliable")), "↑ da la vuelta");
      },
    },
    {
      name: "PromptInput (React): cita con Quitar (el foco vuelve al campo) y contextos que se quitan uno a uno",
      async run({ open }) {
        const page = await open("cards");
        const prompt = page.locator("#cd-prompt");
        const quote = prompt.locator(".z-composer__context[data-quote]");
        await visible(page, "#cd-prompt .z-composer__context[data-quote]");
        assert((await quote.textContent())?.includes("enhance user confidence"), "texto citado");
        const remove = quote.locator(".z-composer__cancel-context");
        assert((await remove.getAttribute("aria-label")) === "Remove quote", "Quitar con nombre");
        await remove.click();
        await poll(async () => (await quote.count()) === 0, "la cita se va");
        await poll(() => page.evaluate(() => document.activeElement?.classList.contains("z-composer__input")), "el foco vuelve al campo");
        const chip = prompt.locator(".z-composer__context-chip");
        assert((await chip.count()) === 1, "un contexto");
        assert((await chip.locator("button").getAttribute("aria-label")) === "Remove Project kickoff", "Quitar el contexto con su nombre");
        await chip.locator("button").click();
        await poll(async () => (await chip.count()) === 0, "el contexto se va");
      },
    },
    {
      name: "ModelPicker (React): interruptores con Espacio sin cerrar, modelo elegido con su marca al final",
      async run({ open, shot }) {
        const page = await open("cards");
        const trigger = page.locator("button.cd-model");
        const name = async () => (await trigger.textContent())?.replace(/\s+/g, " ").trim();
        assert((await name()) === "Model: Aurora 3 Beta", `nombre: ${await name()}`);
        await trigger.click();
        await visible(page, ".z-model-picker__menu:popover-open");
        const menu = page.locator(".z-model-picker__menu:popover-open");
        const auto = menu.locator('[role="menuitemcheckbox"]', { hasText: "Auto" });
        assert((await auto.getAttribute("aria-checked")) === "false", "Auto apagado");
        assert((await auto.locator(".z-menu__switch").count()) === 1, "interruptor");
        await auto.focus();
        await page.keyboard.press(" ");
        await poll(async () => (await auto.getAttribute("aria-checked")) === "true", "Espacio enciende Auto");
        assert((await page.locator(".z-model-picker__menu:popover-open").count()) === 1, "el menú sigue abierto");
        const chosen = menu.locator('[role="menuitemradio"][aria-checked="true"]');
        assert((await chosen.textContent())?.includes("Aurora 3"), "el elegido");
        assert((await chosen.locator(".z-menu__check[data-end]").count()) === 1, "marca al final");
        await shot(page, "cards-model-picker");
        await menu.locator('[role="menuitemradio"]', { hasText: "Orbit 5" }).click();
        await poll(async () => (await name()) === "Model: Orbit 5", "elegir cierra y cambia el botón");
      },
    },
  ];
}
