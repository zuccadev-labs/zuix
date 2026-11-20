// Oleada 4 de zout sin framework (@zuccadev-labs/zuix-zout/dom con @zuccadev-labs/zuix-zui/dom): Sidebar plegable a
// iconos con submenús, TabStrip con grupos y reordenación, PaneHeader, FloatingPanel, PaneLayout y Float.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const contract = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../../../zout/html.json"), "utf8")).components;

export default async function ({ page, test, ok, card }) {
  const press = async (...keys) => {
    for (const key of keys) await page.keyboard.press(key);
  };
  const until = async (fn, message, arg) => {
    try {
      await page.waitForFunction(fn, arg, { timeout: 3000 });
    } catch {
      throw new Error(message);
    }
  };
  /** Añade un ejemplo del contrato de zout a la tarjeta del componente y lo activa. Devuelve su contenedor. */
  const inject = async (name, index) => {
    const id = `zw4-${name}-${index}`;
    await page.evaluate(
      async ([component, html, wrap]) => {
        document.getElementById(wrap)?.remove();
        const stage = document.querySelector(`[data-component="${component}"] .demo__stage`);
        const box = document.createElement("div");
        box.id = wrap;
        box.innerHTML = html;
        stage.append(box);
        (await import("/zui/dist/zui.dom.js")).hydrate(box);
        (await import("/zout/dist/zout.dom.js")).hydrate(box);
      },
      [name, contract[name].examples[index].html, id],
    );
    return page.locator(`#${id}`);
  };
  void card;

  /* ---------- Sidebar ---------- */
  await test("Sidebar: submenú en disclosure, plegado a iconos con tooltip y submenú flotante, y vuelta", async () => {
    const root = await inject("Sidebar", 1);
    const projects = root.locator(".z-sidebar__link[data-has-sub]");
    const sub = root.locator(".z-sidebar__sub");
    ok((await projects.getAttribute("aria-expanded")) === "true", "Projects abierto de partida");
    await projects.click();
    ok((await projects.getAttribute("aria-expanded")) === "false" && (await sub.isHidden()), "el clic pliega el submenú");
    await projects.press("Enter");
    ok((await projects.getAttribute("aria-expanded")) === "true" && (await sub.isVisible()), "Intro lo abre");
    const trigger = root.locator(".z-sidebar__trigger");
    await trigger.click();
    ok((await root.locator(".z-sidebar").getAttribute("data-collapsed")) !== null, "plegada");
    ok((await trigger.getAttribute("aria-expanded")) === "false", "aria-expanded del disparador");
    ok((await root.locator('.z-sidebar__link[href="/inbox"]').getAttribute("data-z-tooltip")) === "Inbox", "tooltip con el nombre");
    const inbox = root.locator('.z-sidebar__link[href="/inbox"]');
    const label = await inbox.evaluate((el) => el.querySelector(".z-sidebar__label").getBoundingClientRect().width);
    ok(label <= 1, `el texto queda oculto a la vista: ${label}`);
    ok(await sub.isHidden(), "plegada, el submenú no se ve en su sitio");
    await projects.click();
    await until(() => document.querySelector("#zw4-Sidebar-1 .z-sidebar__sub")?.matches(":popover-open"), "el submenú no abrió flotante");
    const [link, panel] = await Promise.all([projects.boundingBox(), sub.boundingBox()]);
    ok(panel.x >= link.x + link.width - 2, `flotante a la derecha del item: ${panel.x} vs ${link.x + link.width}`);
    await press("Escape");
    await until(() => !document.querySelector("#zw4-Sidebar-1 .z-sidebar__sub")?.matches(":popover-open"), "Escape no lo cerró");
    // Atajo Ctrl+B (el disparador lleva data-shortcut): despliega y el submenú vuelve a su sitio, abierto como estaba.
    await page.locator("body").focus();
    await press("Control+b");
    ok((await root.locator(".z-sidebar").getAttribute("data-collapsed")) === null, "Ctrl+B despliega");
    ok((await sub.isVisible()) && (await projects.getAttribute("aria-expanded")) === "true", "submenú en su sitio y abierto");
    ok((await inbox.getAttribute("data-z-tooltip")) === null, "sin tooltip desplegada");
  });

  /* ---------- TabStrip ---------- */
  await test("TabStrip: Ctrl+Mayús+flechas mueve la pestaña activa y lo anuncia; el chip pliega su grupo", async () => {
    const root = await inject("TabStrip", 1);
    const order = () => root.locator(".z-tabstrip__select").evaluateAll((list) => list.map((el) => el.dataset.tabId));
    await page.evaluate(() => {
      window.__reorder = [];
      document.querySelector("#zw4-TabStrip-1 .z-tabstrip").addEventListener("z:reorder", (e) => window.__reorder.push(e.detail.ids));
    });
    await root.locator('[data-tab-id="button"]').focus();
    await press("Control+Shift+ArrowRight");
    ok((await order()).join() === "menu,button,routes,readme", `orden: ${await order()}`);
    ok(await page.evaluate(() => document.activeElement?.dataset.tabId === "button"), "el foco sigue en la pestaña movida");
    const status = await root.locator(".z-tabstrip__status").textContent();
    ok(status === "Button.tsx moved to position 2 of 4", `anuncio: ${status}`);
    // El chip del grupo sigue delante de su primera pestaña.
    const chipNext = await root
      .locator('.z-tabstrip__group[data-group-id="ui"]')
      .evaluate((el) => el.nextElementSibling?.querySelector("[data-tab-id]")?.dataset.tabId);
    ok(chipNext === "menu", `chip antes de la primera del grupo: ${chipNext}`);
    await press("Control+Shift+End");
    ok((await order()).at(-1) === "button", "Fin la lleva al final");
    ok((await page.evaluate(() => window.__reorder.length)) === 2, "z:reorder por cada movimiento");
    // Las flechas solas siguen cambiando de pestaña.
    await press("ArrowLeft");
    ok(await page.evaluate(() => document.activeElement?.dataset.tabId === "readme"), "flecha izquierda selecciona la anterior");
    // Plegar el grupo API oculta sus pestañas no activas.
    await root.locator('.z-tabstrip__group[data-group-id="api"] .z-tabstrip__chip').click();
    ok(await root.locator('[data-tab-id="routes"]').isHidden(), "routes oculta con el grupo plegado");
    ok(
      (await root.locator('.z-tabstrip__group[data-group-id="api"] .z-tabstrip__chip').getAttribute("aria-expanded")) === "false",
      "chip plegado",
    );
  });
  await test("TabStrip: arrastrar una pestaña con el puntero la suelta en el hueco marcado", async () => {
    const root = await inject("TabStrip", 1);
    const order = () => root.locator(".z-tabstrip__select").evaluateAll((list) => list.map((el) => el.dataset.tabId));
    const from = await root.locator('[data-tab-id="button"]').boundingBox();
    const to = await root.locator('[data-tab-id="routes"]').locator("..").boundingBox();
    await page.mouse.move(from.x + 10, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + 30, from.y + from.height / 2, { steps: 3 });
    await page.mouse.move(to.x + to.width - 4, to.y + to.height / 2, { steps: 6 });
    const marked = await root.locator(".z-tabstrip__tab[data-drop]").count();
    ok(marked === 1, `una marca de soltar: ${marked}`);
    ok((await order()).join() === "button,menu,routes,readme", "no reordena mientras se arrastra");
    await page.mouse.up();
    ok((await order()).join() === "menu,routes,button,readme", `orden al soltar: ${await order()}`);
    ok((await root.locator('[data-tab-id="button"]').getAttribute("aria-selected")) === "true", "el clic de soltar no selecciona otra");
  });
}
