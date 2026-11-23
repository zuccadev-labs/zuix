// Binding de React en un navegador sin Popover API (anterior a Chromium 114, Firefox 125 y Safari 17), simulado con
// tests/popover-api.mjs: abrir y cerrar capas no lanza (un error de página hace fallar el caso), y con el polyfill
// (@oddbird/popover-polyfill, simulado) las capas se abren por él y se reconocen abiertas por su clase `:popover-open`.
// Exporta una función que recibe los ayudantes de cases.mjs.
export default function ({ t, assert, until, visible, gone }) {
  /** Abre y cierra las capas de la pantalla de overlays y el cajón del Shell. */
  async function exercise(page) {
    await page.click(t("open-popover"));
    await until(page, () => document.querySelector(".z-popover")?.dataset.state === "open", "el Popover se monta abierto");
    await page.keyboard.press("Escape");
    await page.click(t("open-menu"));
    await until(page, () => document.querySelector(".z-menu[role=menu]") !== null, "el Menu se monta");
    await page.keyboard.press("Escape");
    await page.hover(t("tooltip-trigger"));
    await until(page, () => document.querySelector("[role=tooltip]") !== null, "el Tooltip se monta");
    await page.mouse.move(2, 2);
    await page.click(t("toast-danger"));
    await until(page, () => document.querySelector(".z-toast[data-intent=danger]") !== null, "el aviso se monta");
    // Un <dialog> no depende de la Popover API: el Modal sigue abriendo y cerrando.
    await page.click(t("open-modal"));
    await visible(page, "dialog[open]");
    await page.keyboard.press("Escape");
    await gone(page, "dialog[open]");
    // Escape con un cajón del Shell abierto pasa por la comprobación de capas abiertas del Shell.
    await page.setViewportSize({ width: 1000, height: 900 });
    await page.click(t("toggle-inspector"));
    await visible(page, ".z-shell__inspector.z-shell__drawer");
    await page.keyboard.press("Escape");
    await gone(page, ".z-shell__inspector.z-shell__drawer");
  }

  return [
    {
      name: "Sin Popover API (React): Popover, Menu, Tooltip, Toast, Modal y el cajón del Shell abren y cierran sin lanzar",
      async run({ open }) {
        const page = await open("overlays", { popover: "none" });
        assert((await page.evaluate(() => typeof HTMLElement.prototype.showPopover)) === "undefined", "la página aún tiene showPopover");
        const invalid = await page.evaluate(() => {
          try {
            document.body.matches(":popover-open");
            return false;
          } catch {
            return true;
          }
        });
        assert(invalid, "`:popover-open` sigue siendo un selector válido en la página");
        await exercise(page);
      },
    },
    {
      name: "Con el polyfill de Popover (React): las capas se abren por él y se reconocen abiertas por la clase :popover-open",
      async run({ open }) {
        const page = await open("overlays", { popover: "polyfill" });
        await page.click(t("open-popover"));
        await until(
          page,
          () => document.querySelector(".z-popover")?.classList.contains(":popover-open") ?? false,
          "el Popover lleva la clase del polyfill",
        );
        await page.keyboard.press("Escape");
        await exercise(page);
        const calls = await page.evaluate(() => window.__popoverCalls);
        assert(calls.show >= 4, `el binding abrió las capas con el polyfill (${JSON.stringify(calls)})`);
      },
    },
  ];
}
