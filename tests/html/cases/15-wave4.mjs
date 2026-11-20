// Oleada 4 sin framework: capas y navegación de aplicación (Toolbar, Collapsible, Banner, Menubar, HoverCard,
// Toggletip, ActionBar, Popover con flecha, Menu con casillas y radios, Command en línea, Tour, Drawer con
// arrastre y anclajes, aviso de promesa). Puntero y teclado sobre zui/html.json.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const contract = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../../../zui/html.json"), "utf8")).components;

export default async function ({ page, test, ok, card, browserName }) {
  await page.evaluate(() => {
    window.__w4 = [];
    for (const name of ["z:change", "z:open", "z:close", "z:select", "z:dismiss", "z:step"])
      document.addEventListener(name, (event) =>
        window.__w4.push({ name, cls: String(event.target.className ?? ""), detail: JSON.parse(JSON.stringify(event.detail ?? null)) }),
      );
  });
  const events = () => page.evaluate(() => window.__w4.splice(0));
  const press = async (...keys) => {
    for (const key of keys) await page.keyboard.press(key);
  };
  const activeIs = (selector) => page.evaluate((s) => document.activeElement?.matches(s) ?? false, selector);
  const activeLabel = () =>
    page.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? document.activeElement?.textContent?.trim());
  /** Añade un ejemplo del contrato a la tarjeta del componente y lo activa con hydrate(). Devuelve su contenedor. */
  const inject = async (name, index) => {
    const id = `w4-${name}-${index}`;
    await page.evaluate(
      async ([component, html, wrap]) => {
        const stage = document.querySelector(`[data-component="${component}"] .demo__stage`);
        const box = document.createElement("div");
        box.id = wrap;
        box.innerHTML = html;
        stage.append(box);
        (await import("/zui/dist/zui.dom.js")).hydrate(box);
      },
      [name, contract[name].examples[index].html, id],
    );
    return page.locator(`#${id}`);
  };
  void inject;
  void events;
  void browserName;

  /* ---------- Toolbar ---------- */
  await test("Toolbar: una parada de Tab para toda la barra, flechas con vuelta entre grupos y aria-disabled en el recorrido", async () => {
    const bar = card("Toolbar").locator('[role="toolbar"]').first();
    const stops = await bar.evaluate((el) => [...el.querySelectorAll("button")].filter((b) => b.tabIndex === 0).length);
    ok(stops === 1, `paradas de Tab: ${stops}`);
    await bar.locator("button").first().focus();
    ok((await activeLabel()) === "Bold", `empieza en Bold: ${await activeLabel()}`);
    await press("ArrowRight", "ArrowRight", "ArrowRight");
    ok((await activeLabel()) === "Insert link", `cruza al grupo Insert: ${await activeLabel()}`);
    await press("ArrowRight", "ArrowRight");
    ok((await activeLabel()) === "Insert code", "aria-disabled sigue en el recorrido");
    await press("End");
    ok((await activeLabel()) === "Undo", "Fin");
    await press("ArrowRight");
    ok((await activeLabel()) === "Bold", "vuelta al principio");
    await press("ArrowLeft");
    ok((await activeLabel()) === "Undo", "vuelta al final");
    const after = await bar.evaluate((el) =>
      [...el.querySelectorAll("button")].filter((b) => b.tabIndex === 0).map((b) => b.textContent.trim()),
    );
    ok(after.length === 1 && after[0] === "Undo", `la parada sigue al foco: ${after}`);
    // El ToggleGroup anidado no lleva su propia parada: Espacio sigue activando.
    await press("Home", "ArrowRight", " ");
    ok((await bar.locator('[aria-label="Italic"]').getAttribute("aria-pressed")) === "true", "Espacio activa el toggle");
  });
  await test("Toolbar vertical: arriba y abajo; izquierda y derecha no mueven", async () => {
    const bar = (await inject("Toolbar", 2)).locator('[role="toolbar"]');
    await bar.locator("button").first().focus();
    await press("ArrowDown");
    ok((await activeLabel()) === "Pen", `abajo: ${await activeLabel()}`);
    await press("ArrowRight");
    ok((await activeLabel()) === "Pen", "derecha no mueve");
    await press("End");
    ok((await activeLabel()) === "Zoom out", "Fin");
    ok(await activeIs('[role="toolbar"] button'), "foco en la barra");
  });
}
