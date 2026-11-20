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
}
