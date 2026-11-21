// Submenús de Menu y ContextMenu sin framework: `data-z-submenu="#id"` en una entrada abre otro `.z-menu[popover]`.
// Menu declara el submenú fuera del menú (como el portal de React); ContextMenu lo anida en el marcado del menú.
import { join } from "node:path";

export default async function ({ page, test, ok, card, settle, shots, browserName }) {
  const isOpen = (sel, p = page) => p.locator(sel).evaluate((el) => el.matches(":popover-open"));
  const focusText = (p = page) => p.evaluate(() => document.activeElement?.textContent.trim().replace(/\s+/g, " ") ?? "");
  const menuTrigger = card("Menu").locator("[data-z-open]");
  const share = page.locator('#actions [data-z-submenu="#actions-share"]');
  const move = page.locator('#file-menu [data-z-submenu="#file-move"]');
  const closeAll = async () => {
    for (let i = 0; i < 3; i += 1) await page.keyboard.press("Escape");
    await page.mouse.move(5, 5);
    await settle();
  };
  const openContext = async () => {
    const zone = card("ContextMenu").locator("[data-z-context]");
    await zone.scrollIntoViewIfNeeded();
    const b = await zone.boundingBox();
    await page.mouse.click(b.x + 20, b.y + 10, { button: "right" });
    await settle();
    ok(await isOpen("#file-menu"), "el menú contextual no abrió");
  };

  await test("Menu submenú: el disparador declara aria-haspopup, aria-expanded y aria-controls", async () => {
    ok((await share.getAttribute("aria-haspopup")) === "menu", "aria-haspopup");
    ok((await share.getAttribute("aria-expanded")) === "false", "aria-expanded inicial");
    ok((await share.getAttribute("aria-controls")) === "actions-share", "aria-controls");
    ok((await share.locator(".z-menu__chevron svg").count()) === 1, "sin chevron");
    // Marcado dinámico: hydrate() completa los atributos que falten.
    const filled = await page.evaluate(async () => {
      const zui = await import("../../zui/dist/zui.dom.js");
      const host = document.createElement("div");
      host.innerHTML =
        '<div popover class="z-liquid z-menu" role="menu"><button type="button" class="z-menu__item" data-z-submenu="#late-sub">More</button></div><div id="late-sub" popover class="z-liquid z-menu" role="menu"></div>';
      document.body.append(host);
      zui.hydrate(host);
      const t = host.querySelector("[data-z-submenu]");
      const out = [t.getAttribute("aria-haspopup"), t.getAttribute("aria-expanded"), t.getAttribute("aria-controls")];
      host.remove();
      return out.join(",");
    });
    ok(filled === "menu,false,late-sub", `hydrate no completó: ${filled}`);
  });

  await test("Menu submenú: el puntero lo abre a la derecha tras un retardo, sin cerrar el padre ni mover el foco", async () => {
    await menuTrigger.click();
    await settle();
    await share.hover();
    ok(!(await isOpen("#actions-share")), "abrió sin retardo");
    await page.waitForTimeout(300);
    ok(await isOpen("#actions-share"), "el hover no abrió el submenú");
    ok(await isOpen("#actions"), "abrir el submenú cerró el menú padre");
    ok(
      (await share.getAttribute("aria-expanded")) === "true" && (await share.getAttribute("data-state")) === "open",
      "estado del disparador",
    );
    const [m, s, t] = [
      await page.locator("#actions").boundingBox(),
      await page.locator("#actions-share").boundingBox(),
      await share.boundingBox(),
    ];
    ok(Math.abs(s.x - (m.x + m.width + 4)) < 3, `no está a la derecha: ${JSON.stringify([m, s])}`);
    const first = await page.locator("#actions-share .z-menu__item").first().boundingBox();
    ok(Math.abs(first.y - t.y) < 3, `primera entrada desalineada: ${first.y} vs ${t.y}`);
    ok((await page.locator("#actions-share").getAttribute("data-side")) === "right", "data-side");
    ok((await focusText()).startsWith("Share"), `el hover movió el foco: ${await focusText()}`);
    await page.screenshot({ path: join(shots, "submenu.png") });
    // Pasar a una entrada del submenú no lo cierra; pasar a otra entrada del padre sí, tras el retardo.
    await page.locator("#actions-share .z-menu__item").nth(1).hover();
    await page.waitForTimeout(350);
    ok(await isOpen("#actions-share"), "se cerró al entrar en el submenú");
    await page.locator("#actions > .z-menu__item").first().hover();
    await page.waitForTimeout(400);
    ok(!(await isOpen("#actions-share")), "no se cerró al pasar a otra entrada");
    ok(await isOpen("#actions"), "el padre se cerró");
    ok(
      (await share.getAttribute("aria-expanded")) === "false" && (await share.getAttribute("data-state")) === "closed",
      "estado del disparador al cerrar",
    );
    await closeAll();
  });

  await test("Menu submenú: clic abre; elegir una entrada cierra toda la cadena y emite z:select", async () => {
    await page.evaluate(() => {
      window.__picked = [];
      window.__pick ??= document.addEventListener("z:select", (e) => window.__picked?.push(e.target.textContent.trim())) ?? true;
    });
    await menuTrigger.click();
    await settle();
    await share.click();
    await settle();
    ok((await isOpen("#actions-share")) && (await isOpen("#actions")), "el clic no abrió el submenú");
    ok((await page.evaluate(() => window.__picked.length)) === 0, "la entrada con submenú emitió z:select");
    await share.click();
    await settle();
    ok(await isOpen("#actions-share"), "un segundo clic cerró el submenú");
    await page.locator("#actions-share .z-menu__item", { hasText: "Email" }).click();
    await settle();
    ok(!(await isOpen("#actions-share")) && !(await isOpen("#actions")), "elegir no cerró toda la cadena");
    ok(
      (await page.evaluate(() => window.__picked.join("|"))) === "Email",
      `z:select: ${await page.evaluate(() => window.__picked.join("|"))}`,
    );
    ok((await menuTrigger.getAttribute("aria-expanded")) === "false", "aria-expanded del disparador del menú");
    ok(await menuTrigger.evaluate((el) => el === document.activeElement), "el foco no volvió al disparador del menú");
  });

  await test("Menu submenú: clic fuera cierra menú y submenú", async () => {
    await menuTrigger.click();
    await settle();
    await share.click();
    await settle();
    ok(await isOpen("#actions-share"), "no abrió");
    await page.mouse.click(5, 500);
    await settle();
    ok(!(await isOpen("#actions-share")) && !(await isOpen("#actions")), "clic fuera no cerró la cadena");
  });

  await test("Menu submenú: ArrowRight y Enter abren y enfocan; ArrowLeft y Escape cierran solo el submenú", async () => {
    await menuTrigger.click();
    await settle();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    ok((await focusText()).startsWith("Share"), `foco: ${await focusText()}`);
    await page.keyboard.press("ArrowRight");
    await settle();
    ok((await isOpen("#actions-share")) && (await isOpen("#actions")), "ArrowRight no abrió");
    ok((await focusText()) === "Copy link", `ArrowRight no enfocó la primera entrada: ${await focusText()}`);
    await page.keyboard.press("ArrowDown");
    ok((await focusText()) === "Email", "las flechas no recorren el submenú");
    await page.keyboard.press("ArrowLeft");
    await settle();
    ok(!(await isOpen("#actions-share")) && (await isOpen("#actions")), "ArrowLeft no cerró solo el submenú");
    ok((await focusText()).startsWith("Share"), `ArrowLeft no devolvió el foco: ${await focusText()}`);
    ok((await share.getAttribute("aria-expanded")) === "false", "aria-expanded tras ArrowLeft");
    await page.keyboard.press("Enter");
    await settle();
    ok((await isOpen("#actions-share")) && (await focusText()) === "Copy link", `Enter no abrió y enfocó: ${await focusText()}`);
    await page.keyboard.press("Escape");
    await settle();
    ok(!(await isOpen("#actions-share")), "Escape no cerró el submenú");
    ok(await isOpen("#actions"), "Escape cerró también el menú padre");
    ok((await focusText()).startsWith("Share"), `Escape no devolvió el foco: ${await focusText()}`);
    // Con el submenú abierto, mover el foco a otra entrada del padre lo cierra.
    await page.keyboard.press("ArrowRight");
    await settle();
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowRight");
    await settle();
    await page.keyboard.press("Enter");
    await settle();
    ok(!(await isOpen("#actions-share")) && !(await isOpen("#actions")), "Enter en una entrada del submenú no cerró la cadena");
  });

  await test("Menu submenú: voltea a la izquierda si no cabe a la derecha", async () => {
    // El disparador se lleva al borde derecho de la ventana solo durante este caso.
    await menuTrigger.evaluate((el) => {
      el.style.position = "fixed";
      el.style.right = "12px";
      el.style.top = "120px";
      el.style.zIndex = "5";
    });
    try {
      await menuTrigger.click();
      await settle();
      await share.click();
      await settle();
      const [m, s] = [await page.locator("#actions").boundingBox(), await page.locator("#actions-share").boundingBox()];
      ok((await page.locator("#actions-share").getAttribute("data-side")) === "left", "data-side no es left");
      ok(Math.abs(s.x + s.width + 4 - m.x) < 3, `no quedó a la izquierda: ${JSON.stringify([m, s])}`);
      ok(s.x >= 0 && s.x + s.width <= 1440, "se sale de la ventana");
      await page.screenshot({ path: join(shots, "submenu-left.png") });
    } finally {
      await closeAll();
      await menuTrigger.evaluate((el) => {
        for (const p of ["position", "right", "top", "z-index"]) el.style.removeProperty(p);
        if (!el.getAttribute("style")) el.removeAttribute("style");
      });
    }
  });

  await test("Menu: abierto con el teclado bajo un puntero quieto, el foco sigue en la primera entrada", async () => {
    await menuTrigger.click();
    await settle();
    const items = page.locator("#actions > .z-menu__item");
    const last = await items.nth((await items.count()) - 1).boundingBox();
    await closeAll();
    // El puntero queda donde va a aparecer la última entrada; el menú se abre encima con Intro, sin moverlo.
    await page.mouse.move(last.x + last.width / 2, last.y + last.height / 2);
    await settle();
    await menuTrigger.focus();
    await page.keyboard.press("Enter");
    await settle();
    const first = (await items.first().textContent()).trim().replace(/\s+/g, " ");
    ok((await focusText()) === first, `foco: ${await focusText()}`);
    // En cuanto el puntero se mueve, vuelve a resaltar lo que tiene debajo.
    await page.mouse.move(last.x + last.width / 2 + 2, last.y + last.height / 2);
    await settle();
    ok((await focusText()) !== first, "el puntero que se mueve resalta su entrada");
    await closeAll();
  });

  await test("Menu: búsqueda por letra", async () => {
    await menuTrigger.click();
    await settle();
    await page.keyboard.press("d");
    ok((await focusText()).startsWith("Duplicate"), `d: ${await focusText()}`);
    await page.keyboard.press("d");
    ok((await focusText()).startsWith("Delete"), `d d: ${await focusText()}`);
    await page.waitForTimeout(700);
    await page.keyboard.press("s");
    ok((await focusText()).startsWith("Share"), `s: ${await focusText()}`);
    await page.waitForTimeout(700);
    await page.keyboard.type("du");
    ok((await focusText()).startsWith("Duplicate"), `du: ${await focusText()}`);
    ok(await isOpen("#actions"), "teclear cerró el menú");
    await closeAll();
    ok(!(await isOpen("#actions")), "no cerró");
  });

  await test("ContextMenu submenú anidado en el DOM: teclado, puntero y elegir cierra todo", async () => {
    ok(
      await page.evaluate(() => document.querySelector("#file-menu").contains(document.querySelector("#file-move"))),
      "el submenú no está anidado en el marcado",
    );
    await openContext();
    ok((await focusText()).startsWith("Rename"), `foco inicial: ${await focusText()}`);
    // Las flechas del menú padre no entran en las entradas del submenú anidado.
    await page.keyboard.press("End");
    ok((await focusText()).startsWith("Delete"), `End: ${await focusText()}`);
    await page.keyboard.press("ArrowUp");
    ok((await focusText()).startsWith("Move to"), `ArrowUp: ${await focusText()}`);
    await page.keyboard.press("ArrowRight");
    await settle();
    ok((await isOpen("#file-move")) && (await isOpen("#file-menu")), "ArrowRight no abrió");
    ok((await focusText()) === "Documents", `foco: ${await focusText()}`);
    const [m, s] = [await page.locator("#file-menu").boundingBox(), await page.locator("#file-move").boundingBox()];
    ok(Math.abs(s.x - (m.x + m.width + 4)) < 3, `posición: ${JSON.stringify([m, s])}`);
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    ok((await focusText()) === "Documents", `las flechas salieron del submenú: ${await focusText()}`);
    await page.keyboard.press("Escape");
    await settle();
    ok(!(await isOpen("#file-move")) && (await isOpen("#file-menu")), "Escape no cerró solo el submenú");
    ok((await focusText()).startsWith("Move to"), `foco tras Escape: ${await focusText()}`);
    await move.hover();
    await page.waitForTimeout(300);
    ok(await isOpen("#file-move"), "el hover no abrió");
    await page.screenshot({ path: join(shots, "submenu-context.png") });
    const picked = page.evaluate(
      () =>
        new Promise((resolve) =>
          document.querySelector("#file-menu").addEventListener("z:select", (e) => resolve(e.target.textContent.trim()), { once: true }),
        ),
    );
    await page.locator("#file-move .z-menu__item", { hasText: "Archive" }).click();
    await settle();
    ok((await picked) === "Archive", "z:select no burbujeó hasta el menú raíz");
    ok(!(await isOpen("#file-move")) && !(await isOpen("#file-menu")), "elegir no cerró la cadena");
  });

  await test("Menu submenú sin showPopover({ source }): se anida en el DOM y no cierra al padre", async () => {
    // Motor antiguo simulado: showPopover ignora su argumento, así que el submenú externo no queda emparentado.
    const context = await page
      .context()
      .browser()
      .newContext({ viewport: { width: 1440, height: 1000 } });
    const old = await context.newPage();
    try {
      await old.addInitScript(() => {
        const native = HTMLElement.prototype.showPopover;
        HTMLElement.prototype.showPopover = function () {
          return native.call(this);
        };
      });
      await old.goto(page.url());
      await old.waitForFunction(() => customElements.get("z-icon"));
      await old.locator('[data-component="Menu"] [data-z-open]').click();
      await old.waitForTimeout(350);
      await old.keyboard.press("ArrowDown");
      await old.keyboard.press("ArrowDown");
      await old.keyboard.press("ArrowRight");
      await old.waitForTimeout(350);
      ok((await isOpen("#actions", old)) && (await isOpen("#actions-share", old)), "el submenú cerró al padre");
      ok(
        await old.evaluate(() => document.querySelector("#actions").contains(document.querySelector("#actions-share"))),
        "no se anidó en el DOM",
      );
      ok((await focusText(old)) === "Copy link", `foco: ${await focusText(old)}`);
      const [m, s] = [await old.locator("#actions").boundingBox(), await old.locator("#actions-share").boundingBox()];
      ok(Math.abs(s.x - (m.x + m.width + 4)) < 3, `posición: ${JSON.stringify([m, s])}`);
      await old.keyboard.press("ArrowLeft");
      await old.waitForTimeout(350);
      ok((await isOpen("#actions", old)) && !(await isOpen("#actions-share", old)), "ArrowLeft");
      await old.locator("#actions [data-z-submenu]").click();
      await old.waitForTimeout(350);
      await old.locator("#actions-share .z-menu__item").first().click();
      await old.waitForTimeout(350);
      ok(!(await isOpen("#actions", old)), "elegir no cerró la cadena");
    } finally {
      await context.close();
    }
  });
  void browserName;
}
