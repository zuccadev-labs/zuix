// Oleada 5 en el binding de React (pantalla `?screen=content` de examples/app): Tree con selección múltiple, casillas y
// renombrar, y las piezas de contenido. Exporta una función que recibe los ayudantes de cases.mjs.
export default function ({ t, assert, poll, expectAttr, expectText }) {
  const screen = (open) => open("content");
  const press = async (page, ...keys) => {
    for (const key of keys) await page.keyboard.press(key);
  };
  const activeMatches = (page, selector, message) =>
    poll(() => page.evaluate((s) => document.activeElement?.matches(s) ?? false, selector), message ?? `foco en ${selector}`);

  return [
    {
      name: "Oleada 5 · Tree: casillas en cascada, selección múltiple y renombrar (React)",
      async run({ open }) {
        const page = await screen(open);
        const item = (id) => `${t("c-tree")} [role=treeitem][data-value="${id}"]`;
        await expectAttr(page, item("photos"), "aria-checked", "mixed");
        await page.click(`${item("photos/2026")} > .z-tree__row .z-tree__check`);
        await expectAttr(page, item("photos"), "aria-checked", "true", "el hijo deshabilitado no cuenta");
        await expectText(page, t("c-tree-checked"), "photos,photos/2025,photos/2026");
        await page.focus(item("photos"));
        await press(page, " ");
        await expectText(page, t("c-tree-checked"), "none");
        await expectAttr(page, `${t("c-tree")} [role=tree]`, "aria-multiselectable", "true");
        await press(page, "ArrowDown", "ArrowUp", "Shift+ArrowDown", "Shift+ArrowDown");
        await expectText(page, t("c-tree-selected"), "photos,photos/2025,photos/2026");
        await page.click(`${item("music")} .z-tree__label`, { modifiers: ["ControlOrMeta"] });
        await expectText(page, t("c-tree-selected"), "photos,photos/2025,photos/2026,music");
        await press(page, "Control+a");
        await expectText(page, t("c-tree-selected"), "photos,photos/2025,photos/2026,music,notes", "Ctrl+A sin el deshabilitado");
        await page.focus(item("notes"));
        await press(page, "F2");
        const input = `${item("notes")} .z-tree__rename`;
        await activeMatches(page, input, "el foco entra en el campo");
        await page.fill(input, "Journal");
        await press(page, "Enter");
        await expectText(page, `${item("notes")} .z-tree__label`, "Journal");
        await activeMatches(page, item("notes"), "el foco vuelve al nodo");
        await page.dblclick(`${item("notes")} .z-tree__label`);
        await page.fill(input, "Nope");
        await press(page, "Escape");
        await expectText(page, `${item("notes")} .z-tree__label`, "Journal", "Escape cancela");
        assert((await page.locator(input).count()) === 0, "el campo se quita");
      },
    },
  ];
}
