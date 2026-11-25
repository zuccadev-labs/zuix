// zout sin framework (@zuccadev-labs/zuix-zout/dom con @zuccadev-labs/zuix-zui/dom): Sidebar plegable a
// iconos con submenús, TabStrip con grupos y reordenación, PaneHeader, FloatingPanel, PaneLayout y Float.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const contract = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../../../zout/html.json"), "utf8")).components;

export default async function ({ page, test, ok, card, settle }) {
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
    await root.scrollIntoViewIfNeeded();
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

  /* ---------- PaneHeader ---------- */
  await test("PaneHeader: acciones y menú en una barra con una sola parada de Tab", async () => {
    const bar = card("PaneHeader").locator('.z-paneheader [role="toolbar"]');
    ok((await bar.getAttribute("aria-label")) === "Editor actions", "barra con nombre");
    const stops = await bar.evaluate((el) => [...el.querySelectorAll("button")].filter((b) => b.tabIndex === 0).length);
    ok(stops === 1, `paradas de Tab: ${stops}`);
    await bar.locator("button").first().focus();
    await press("End");
    ok(await page.evaluate(() => document.activeElement?.getAttribute("aria-label") === "More actions"), "Fin llega al menú");
  });

  /* ---------- FloatingPanel ---------- */
  await test("FloatingPanel: arrastre por la cabecera, flechas en el asa y en la esquina, acotado a su contenedor, Escape y reapertura", async () => {
    const panel = card("FloatingPanel").locator(".z-floatpanel");
    const rect = () => panel.evaluate((el) => ({ x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight }));
    await panel.scrollIntoViewIfNeeded();
    const before = await rect();
    const head = await panel.locator(".z-floatpanel__title").boundingBox();
    await page.mouse.move(head.x + 20, head.y + 5);
    await page.mouse.down();
    await page.mouse.move(head.x + 50, head.y + 25, { steps: 5 });
    await page.mouse.up();
    const moved = await rect();
    ok(moved.x === before.x + 30 && moved.y === before.y + 20, `arrastre: ${JSON.stringify(before)} → ${JSON.stringify(moved)}`);
    await panel.locator(".z-floatpanel__handle").focus();
    await press("ArrowLeft", "ArrowDown");
    const keyed = await rect();
    ok(keyed.x === moved.x - 10 && keyed.y === moved.y + 10, `flechas: ${JSON.stringify(keyed)}`);
    // Mayús + flecha muchas veces: no sale del contenedor (margen de 8 px).
    for (let i = 0; i < 6; i++) await press("Shift+ArrowLeft");
    ok((await rect()).x === 8, `acotado al borde: ${(await rect()).x}`);
    await panel.locator(".z-floatpanel__resize").focus();
    await press("ArrowRight", "ArrowRight", "ArrowUp");
    const sized = await rect();
    ok(sized.w === keyed.w + 20 && sized.h === keyed.h - 10, `redimensionar: ${JSON.stringify(sized)}`);
    for (let i = 0; i < 10; i++) await press("Shift+ArrowUp");
    ok((await rect()).h === 120, `alto mínimo: ${(await rect()).h}`);
    // El arrastre baja 52 px desde la esquina: con el panel al pie de la ventana el puntero se saldría de ella
    // (en Firefox, tras los casos anteriores, el alto se quedaba en 152).
    await panel.evaluate((el) => el.scrollIntoView({ block: "center", behavior: "instant" }));
    await settle();
    const corner = await panel.locator(".z-floatpanel__resize").boundingBox();
    await page.mouse.move(corner.x + 12, corner.y + 12);
    await page.mouse.down();
    await page.mouse.move(corner.x + 42, corner.y + 52, { steps: 5 });
    await page.mouse.up();
    const dragged = await rect();
    // El arrastre pide +30 × +40; el contenedor (margen de 8 px) puede acotarlo según el ancho que deje la página.
    const room = await panel.evaluate((el) => ({
      w: el.offsetParent.clientWidth - el.offsetLeft - 8,
      h: el.offsetParent.clientHeight - el.offsetTop - 8,
    }));
    const want = { w: Math.min(sized.w + 30, room.w), h: Math.min(160, room.h) };
    ok(dragged.w === want.w && dragged.h === want.h, `esquina con puntero: ${JSON.stringify(dragged)}, esperado ${JSON.stringify(want)}`);
    await press("Escape");
    ok(await panel.isHidden(), "Escape lo cierra");
    const opener = card("FloatingPanel").locator("[data-z-panel]");
    await opener.click();
    ok(await panel.isVisible(), "el botón lo vuelve a abrir");
    ok(await page.evaluate(() => document.activeElement?.classList.contains("z-floatpanel")), "el foco entra en el panel");
    await panel.locator(".z-floatpanel__close").click();
    ok(await page.evaluate(() => document.activeElement?.hasAttribute("data-z-panel")), "el foco vuelve al botón");
    await opener.click();
  });

  /* ---------- PaneLayout ---------- */
  await test("PaneLayout: menú del panel (mover y cerrar), arrastre al borde de otro panel y divisores", async () => {
    const root = card("PaneLayout").locator(".z-panelayout");
    await root.scrollIntoViewIfNeeded();
    const ids = () => root.locator("[data-pane-id]").evaluateAll((list) => list.map((el) => el.dataset.paneId).join(","));
    ok((await ids()) === "editor,preview,terminal", `orden inicial: ${await ids()}`);
    // Teclado: el menú de Editor, «Move right» lo intercambia con su vecino de la derecha.
    const trigger = root.locator('[data-pane-id="editor"] .z-panelayout__menu');
    await trigger.focus();
    await press("Enter");
    await until(() => document.querySelector("#pl-editor-menu")?.matches(":popover-open"), "el menú no abrió");
    await press("ArrowDown", "Enter");
    ok((await ids()) === "preview,editor,terminal", `mover a la derecha: ${await ids()}`);
    ok((await root.locator(".z-panelayout__status").textContent()) === "Editor moved", "anuncio del movimiento");
    // Puntero: arrastrar Terminal sobre el borde superior de Preview lo pone encima.
    const grab = await root.locator('[data-pane-id="terminal"] .z-paneheader__title').boundingBox();
    const target = await root.locator('[data-pane-id="preview"]').boundingBox();
    await page.mouse.move(grab.x + 10, grab.y + 5);
    await page.mouse.down();
    await page.mouse.move(grab.x + 30, grab.y + 20, { steps: 3 });
    await page.mouse.move(target.x + target.width / 2, target.y + 12, { steps: 8 });
    ok((await root.locator('.z-panelayout__drop[data-edge="block-start"]').count()) === 1, "zona de soltar arriba");
    ok((await ids()) === "preview,editor,terminal", "nada cambia mientras se arrastra");
    await page.mouse.up();
    ok((await ids()) === "terminal,preview,editor", `soltar arriba: ${await ids()}`);
    const column = await root
      .locator(":scope > .z-split > .z-split__pane")
      .first()
      .locator(":scope > .z-split")
      .getAttribute("data-direction");
    ok(column === "column", `división en columna: ${column}`);
    // El divisor nuevo funciona con teclado.
    const divider = root.locator(":scope > .z-split > .z-split__divider");
    const before = await divider.getAttribute("aria-valuenow");
    await divider.focus();
    await press("ArrowRight");
    ok((await divider.getAttribute("aria-valuenow")) !== before, "el divisor se mueve con flechas");
    // Cerrar desde el menú.
    await root.locator('[data-pane-id="preview"] .z-panelayout__menu').click();
    await page.locator('#pl-preview-menu [data-pane-action="close"]').click();
    ok((await ids()) === "terminal,editor", `cerrar: ${await ids()}`);
  });

  /* ---------- Float ---------- */
  await test("Float: la insignia queda centrada en la esquina final, también en RTL", async () => {
    const float = card("Float").locator(".z-float").first();
    await float.scrollIntoViewIfNeeded();
    const measure = () =>
      float.evaluate((el) => {
        const a = el.firstElementChild.getBoundingClientRect();
        const b = el.querySelector(".z-float__item").getBoundingClientRect();
        return { ax: a.right, al: a.left, ay: a.top, cx: b.left + b.width / 2, cy: b.top + b.height / 2 };
      });
    const ltr = await measure();
    ok(Math.abs(ltr.cx - ltr.ax) <= 1 && Math.abs(ltr.cy - ltr.ay) <= 1, `centro en la esquina superior derecha: ${JSON.stringify(ltr)}`);
    await float.evaluate((el) => el.closest(".demo__stage").setAttribute("dir", "rtl"));
    const rtl = await measure();
    await float.evaluate((el) => el.closest(".demo__stage").removeAttribute("dir"));
    ok(Math.abs(rtl.cx - rtl.al) <= 1, `en RTL, la esquina superior izquierda: ${JSON.stringify(rtl)}`);
  });
}
