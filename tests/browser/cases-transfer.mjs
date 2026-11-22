// Binding de React de TransferList (pantalla `?screen=inputs`): teclado de cada listbox, mover con Intro, botones,
// búsqueda, doble clic y anuncio.
export default function ({ t, assert, poll }) {
  const root = '[data-testid="i-transfer"]';
  const value = (page) => page.locator(t("i-transfer-value")).textContent();
  return [
    {
      name: "TransferList (React): Espacio marca, Mayús+flecha extiende, Intro mueve, botones, búsqueda y doble clic",
      async run({ open }) {
        const page = await open("inputs");
        const source = page.locator(`${root} .z-transfer__options[data-side="source"]`);
        await source.scrollIntoViewIfNeeded();
        assert((await source.getAttribute("aria-multiselectable")) === "true", "listbox múltiple");
        await source.focus();
        await poll(async () => !!(await source.getAttribute("aria-activedescendant")), "foco activo en la primera");
        await page.keyboard.press("Space");
        await page.keyboard.press("Shift+ArrowDown");
        await poll(async () => (await page.locator(`${root} [data-side="source"] [aria-selected="true"]`).count()) === 2, "dos marcadas");
        assert(/2 of 6 selected/.test(await page.locator(`${root} [data-side="source"] .z-transfer__count`).textContent()), "recuento");
        await page.keyboard.press("Enter");
        await poll(async () => (await value(page)) === "Team: chen, ana, ben", "Intro mueve lo marcado");
        await poll(
          () =>
            page.evaluate(() =>
              [...document.querySelectorAll("[data-z-announcer] [aria-live], .z-transfer [data-live]")].some(
                (r) => r.textContent === "2 moved to Team",
              ),
            ),
          "anuncio",
        );
        await page.locator(`${root} input[data-transfer-search="source"]`).fill("sales");
        await poll(async () => (await page.locator(`${root} [data-side="source"] .z-transfer__option`).count()) === 1, "búsqueda");
        await page.click(`${root} [data-transfer-action="all-target"]`);
        await poll(async () => (await value(page)) === "Team: chen, ana, ben, femi", "mover todo lo visible");
        await page.locator(`${root} [data-side="target"] .z-transfer__option[data-value="ana"]`).dblclick();
        await poll(async () => (await value(page)) === "Team: chen, ben, femi", "doble clic devuelve");
        assert((await page.locator(`${root} input[type=hidden][name=team]`).count()) === 3, "inputs ocultos del formulario");
      },
    },
  ];
}
