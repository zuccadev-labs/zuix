// Sin React: Navbar, NavigationMenu, SkipLink y BottomNavigation (zout/dom) y DotMatrix, TextEffect y Glow
// (zui/dom), desde el contrato HTML y desde marcado mínimo escrito a mano.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const contract = {
  ...JSON.parse(readFileSync(join(here, "../../../zui/html.json"), "utf8")).components,
  ...JSON.parse(readFileSync(join(here, "../../../zout/html.json"), "utf8")).components,
};

export default async function ({ page, test, ok }) {
  let seq = 0;
  const inject = async (raw, width = "min(1100px, 100vw)") => {
    const id = `w6-${++seq}`;
    // Los id del contrato ya están en la página de ejemplos: cada inyección lleva los suyos.
    const html = raw.replace(/\b(site-menu|site-nav|dock-nav|side-menu)\b/g, `$1-${id}`);
    await page.evaluate(
      async ([markup, wrap, w]) => {
        for (const old of document.querySelectorAll("[data-w6-layer]")) old.remove();
        const box = document.createElement("div");
        box.id = wrap;
        box.setAttribute("data-z-dom", "");
        box.setAttribute("data-w6-layer", "");
        box.innerHTML = markup;
        Object.assign(box.style, {
          position: "fixed",
          insetBlockStart: "0",
          insetInlineStart: "0",
          zIndex: "2147483000",
          inlineSize: w,
          maxBlockSize: "100vh",
          overflow: "auto",
          background: "Canvas",
        });
        document.querySelector(".page__main").append(box);
        (await import("/zui/dist/zui.dom.js")).hydrate(box);
        (await import("/zout/dist/zout.dom.js")).hydrate(box);
      },
      [html, id, width],
    );
    return page.locator(`#${id}`);
  };
  const html = (name, i = 0) => contract[name].examples[i].html;
  const isOpen = (loc) => loc.evaluate((el) => el.matches(":popover-open"));
  const until = async (fn, message) => {
    for (let i = 0; i < 40; i++) {
      if (await fn()) return;
      await page.waitForTimeout(50);
    }
    ok(false, message);
  };

  await test("Sin React: NavigationMenu abre su panel bajo el botón y Escape lo cierra", async () => {
    const box = await inject(html("NavigationMenu"));
    const trigger = box.locator(".z-navmenu__trigger").first();
    const panel = box.locator(".z-navmenu__panel").first();
    ok((await panel.getAttribute("popover")) === "auto", "panel popover");
    await trigger.click();
    await until(() => isOpen(panel), "abre");
    await until(async () => (await trigger.getAttribute("aria-expanded")) === "true", "aria-expanded");
    const p = await panel.boundingBox();
    const b = await trigger.boundingBox();
    ok(p.y >= b.y + b.height, "bajo el botón");
    await page.keyboard.press("Escape");
    await until(async () => !(await isOpen(panel)), "Escape cierra");
    await until(async () => (await trigger.getAttribute("aria-expanded")) === "false", "aria-expanded vuelve");
  });

  await test("Sin React: Navbar en fila si cabe y en cajón si no", async () => {
    const wide = await inject(html("Navbar"));
    await until(async () => (await wide.locator(".z-navbar").getAttribute("data-collapsed")) === null, "en fila a 1100 px");
    ok((await wide.locator(".z-navbar__menu").getAttribute("popover")) === null, "la lista no es popover en fila");
    const narrow = await inject(html("Navbar"), "380px");
    await until(async () => (await narrow.locator(".z-navbar").getAttribute("data-collapsed")) !== null, "plegado a 380 px");
    await narrow.locator(".z-navbar__toggle").click();
    const menu = narrow.locator(".z-navbar__menu");
    await until(() => isOpen(menu), "el cajón abre");
    // aria-expanded sigue al evento `toggle`, que llega en otra tarea: bajo carga, después de abrirse el cajón.
    await until(async () => (await narrow.locator(".z-navbar__toggle").getAttribute("aria-expanded")) === "true", "botón expandido");
    ok((await menu.locator(".z-navmenu").getAttribute("data-orientation")) === "vertical", "menú vertical");
    const group = menu.locator(".z-navmenu__trigger").first();
    await group.click();
    ok((await group.getAttribute("aria-expanded")) === "true", "el grupo se despliega");
    await menu.locator(".z-navbar__close").click();
    await until(async () => !(await isOpen(menu)), "Cerrar");
  });

  await test("Sin React: SkipLink y BottomNavigation de botones", async () => {
    const box = await inject(`${html("SkipLink")}${html("BottomNavigation", 1)}`);
    await box.locator(".z-skiplink").focus();
    await page.keyboard.press("Enter");
    await until(() => page.evaluate(() => document.activeElement?.id === "main-content"), "foco en el destino");
    const detail = page.evaluate(
      () => new Promise((resolve) => document.addEventListener("z:select", (e) => resolve(e.detail.value), { once: true })),
    );
    await box.locator(".z-bottomnav__item").first().click();
    ok((await detail) === "today", "z:select con el valor");
    ok((await box.locator(".z-bottomnav__item").first().getAttribute("aria-current")) === "page", "aria-current se mueve");
    ok((await box.locator('.z-bottomnav__item[aria-current="page"]').count()) === 1, "solo uno actual");
  });

  await test("Sin React: DotMatrix y TextEffect desde marcado mínimo; Glow sigue al puntero", async () => {
    const box = await inject(
      '<span class="z-dotmatrix" data-pattern="spiral" data-cols="4" role="status" aria-label="Loading"></span>' +
        '<p class="z-texteffect" data-effect="reveal" data-by="letter">Hi there</p>' +
        `<div style="inline-size:320px">${html("Glow")}</div>`,
    );
    ok((await box.locator(".z-dotmatrix__dot").count()) === 16, "dibuja 4 × 4 puntos");
    ok((await box.locator(".z-dotmatrix").getAttribute("data-motion")) === "trail", "movimiento del patrón");
    await box.locator(".z-dotmatrix").evaluate(async (el) => (await import("/zui/dist/zui.dom.js")).setDotMatrixPattern(el, "orbit"));
    ok((await box.locator(".z-dotmatrix__dot[data-off]").count()) === 4, "órbita deja quieto el centro");
    ok(((await box.locator(".z-texteffect .z-sr-only").textContent()) ?? "") === "Hi there", "texto entero para lectores");
    ok((await box.locator(".z-texteffect__piece").count()) === 7, "siete letras");
    const glow = box.locator(".z-glow");
    const b = await glow.boundingBox();
    await page.mouse.move(b.x + 10, b.y + 10);
    await page.mouse.move(b.x + 50, b.y + 12);
    await until(async () => (await glow.evaluate((el) => el.style.getPropertyValue("--z-glow-x"))) === "50px", "--z-glow-x");
  });

  await page.evaluate(() => {
    for (const old of document.querySelectorAll("[data-w6-layer]")) old.remove();
  });
}
