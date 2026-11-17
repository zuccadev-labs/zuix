// Layouts de zout sin framework (@zuccadev-labs/zuix-zout/dom): tarjetas del catálogo y la aplicación examples/html/shell.html.
// Shell responsive (acoplado/cajón, foco, Escape, velo), ResizeHandle, SplitPane, TabStrip, Sidebar y móvil.
import { join } from "node:path";

export default async function ({ page, test, ok, card, settle, shots }) {
const until = async (fn, message, arg) => {
  try { await page.waitForFunction(fn, arg, { timeout: 3000 }); }
  catch { throw new Error(message); }
};
const box = async (selector) => (typeof selector === "string" ? page.locator(selector) : selector).boundingBox();
const center = async (selector) => { const b = await box(selector); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
const drag = async (from, to) => {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 4 });
  await page.mouse.move(to.x, to.y, { steps: 4 });
  await page.mouse.up();
};
const width = async (selector) => Math.round((await box(selector)).width);
const size = (w, h = 900) => page.setViewportSize({ width: w, height: h });
// Eventos z:* recibidos en un elemento, para comprobar lo que emite el módulo.
const record = (selector, name) => page.evaluate(([s, n]) => {
  window.__events = [];
  document.querySelector(s).addEventListener(`z:${n}`, (e) => window.__events.push(e.detail ?? null));
}, [selector, name]);
const events = () => page.evaluate(() => window.__events);

/* ───────────── Tarjetas del catálogo (index.html) ───────────── */

await test("layouts · catálogo: TabStrip selecciona, navega con teclado, cierra y añade", async () => {
  const strip = card("TabStrip").locator(".z-tabstrip");
  const tab = (id) => strip.locator(`[data-tab-id="${id}"]`);
  await record("#tabs-demo", "select");
  await tab("readme").click();
  ok(await tab("readme").getAttribute("aria-selected") === "true" && await tab("main").getAttribute("aria-selected") === "false", "el clic no seleccionó");
  ok(await strip.locator(".z-tabstrip__tab[data-selected]").count() === 1, "más de una pestaña marcada");
  ok(await tab("readme").getAttribute("tabindex") === "0" && await tab("main").getAttribute("tabindex") === "-1", "tabindex no sigue a la selección");
  await page.keyboard.press("ArrowRight");
  ok(await tab("config").evaluate((el) => el.getAttribute("aria-selected") === "true" && el === document.activeElement), "ArrowRight no activó ni enfocó");
  await page.keyboard.press("Home");
  ok(await tab("main").getAttribute("aria-selected") === "true", "Home no fue a la primera");
  await page.keyboard.press("ArrowLeft");
  ok(await tab("config").getAttribute("aria-selected") === "true", "ArrowLeft no dio la vuelta");
  ok(JSON.stringify(await events()) === JSON.stringify([{ id: "readme" }, { id: "config" }, { id: "main" }, { id: "config" }]), `z:select: ${JSON.stringify(await events())}`);
  await strip.locator(".z-tabstrip__tab:has([data-tab-id=config]) .z-tabstrip__close").click();
  ok(await tab("config").count() === 0, "cerrar no retiró la pestaña");
  ok(await tab("readme").getAttribute("aria-selected") === "true", "al cerrar la activa no se activó la vecina");
  await strip.locator(".z-tabstrip__add").click();
  ok(await strip.locator(".z-tabstrip__select").count() === 3, "el botón de alta no añadió");
  ok(await strip.locator(".z-tabstrip__tab[data-selected] .z-tabstrip__title").textContent() === "Untitled 3", "la pestaña nueva no quedó activa");
  ok(await strip.locator(".z-tabstrip__tab[data-selected] .z-tabstrip__close svg.z-icon path").count() > 0, "la pestaña nueva no tiene icono de cierre");
});

await test("layouts · catálogo: SplitPane con arrastre y flechas en los dos ejes", async () => {
  const row = "#split-demo > .z-split__divider";
  const col = "#split-demo .z-split[data-direction=column] > .z-split__divider";
  const first = "#split-demo > .z-split__pane:first-child";
  await page.locator("#split-demo").scrollIntoViewIfNeeded();
  await record("#split-demo", "resize");
  const before = await width(first);
  const c = await center(row);
  await drag(c, { x: c.x + 40, y: c.y });
  ok(Math.abs((await width(first)) - before - 40) <= 2, `arrastrar 40 px: ${before} → ${await width(first)}`);
  ok(await page.locator(row).evaluate((el) => !el.hasAttribute("data-dragging")), "data-dragging no se limpió");
  const sizes = (await events()).at(-1).sizes;
  ok(Math.abs(sizes[0] + sizes[1] - 1) < 0.001, `las fracciones no suman 1: ${sizes}`);
  await page.locator(row).focus();
  const now = Number(await page.locator(row).getAttribute("aria-valuenow"));
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  ok(Number(await page.locator(row).getAttribute("aria-valuenow")) === now - 4, "dos flechas no restaron un 4 %");
  const top = "#split-demo .z-split[data-direction=column] > .z-split__pane:first-child";
  const h = (await box(top)).height;
  const d = await center(col);
  await drag(d, { x: d.x, y: d.y - 30 });
  ok(Math.abs(h - (await box(top)).height - 30) <= 2, "el divisor horizontal no se arrastró");
  await page.locator(col).focus();
  const v = Number(await page.locator(col).getAttribute("aria-valuenow"));
  await page.keyboard.press("ArrowDown");
  ok(Number(await page.locator(col).getAttribute("aria-valuenow")) === v + 2, "ArrowDown no sumó un 2 %");
});

await test("layouts · catálogo: ResizeHandle con arrastre, límites, teclado y doble clic", async () => {
  const handle = "#resize-demo > .z-resize";
  await page.locator("#resize-demo").scrollIntoViewIfNeeded();
  ok(await width("#resize-demo") === 240, `ancho inicial ${await width("#resize-demo")}`);
  const c = await center(handle);
  await drag(c, { x: c.x + 40, y: c.y });
  ok(await width("#resize-demo") === 280, `arrastrar 40 px: ${await width("#resize-demo")}`);
  ok(await page.locator(handle).getAttribute("aria-valuenow") === "280", "aria-valuenow");
  const c2 = await center(handle);
  await drag(c2, { x: c2.x + 200, y: c2.y });
  ok(await width("#resize-demo") === 320, `máximo: ${await width("#resize-demo")}`);
  await page.locator(handle).focus();
  await page.keyboard.press("ArrowLeft");
  ok(await width("#resize-demo") === 304, `flecha: ${await width("#resize-demo")}`);
  await page.keyboard.press("Home");
  ok(await width("#resize-demo") === 240, "Inicio no restableció");
  const c3 = await center(handle);
  await drag(c3, { x: c3.x - 300, y: c3.y });
  ok(await width("#resize-demo") === 160, `mínimo: ${await width("#resize-demo")}`);
  const c4 = await center(handle);
  await page.mouse.dblclick(c4.x, c4.y);
  ok(await width("#resize-demo") === 240, "doble clic no restableció");
});

await test("layouts · catálogo: Sidebar pliega y abre secciones", async () => {
  const section = card("Sidebar").locator(".z-sidebar__section");
  const fold = section.nth(0).locator(".z-sidebar__fold");
  await fold.click();
  ok(await fold.getAttribute("aria-expanded") === "false" && await section.nth(0).evaluate((el) => !el.hasAttribute("data-open")), "no se plegó");
  ok(await section.nth(0).locator(".z-sidebar__body").evaluate((el) => el.hidden && el.offsetHeight === 0), "el cuerpo sigue visible");
  ok(await fold.locator("z-icon").getAttribute("name") === "chevron-right-small", "el indicador no cambió");
  await fold.focus();
  await page.keyboard.press("Enter");
  ok(await fold.getAttribute("aria-expanded") === "true" && await section.nth(0).getAttribute("data-open") === "true", "Enter no abrió");
  await section.nth(1).locator(".z-sidebar__fold").click();
  ok(await section.nth(1).locator(".z-sidebar__body").evaluate((el) => !el.hidden), "la segunda sección no abrió");
});

await test("layouts · catálogo: un Shell estrecho usa cajones dentro de su tarjeta", async () => {
  const shell = card("Shell").locator(".z-shell");
  await shell.scrollIntoViewIfNeeded();
  ok(await shell.locator(".z-shell__side").evaluate((el) => el.hidden && el.dataset.mode === "overlay"), "la sidebar debería empezar cerrada en modo cajón");
  await shell.locator("[data-z-shell-toggle=sidebar]").click();
  ok(await shell.locator(".z-shell__side.z-shell__drawer[role=dialog]").isVisible(), "no abrió como cajón");
  ok(await shell.locator(".z-shell__scrim").count() === 1, "sin velo");
  await page.keyboard.press("Escape");
  ok(await shell.locator(".z-shell__drawer").count() === 0 && await shell.locator(".z-shell__scrim").count() === 0, "Escape no cerró");
});

/* ───────────── Aplicación completa (shell.html) ───────────── */

await page.goto(new URL("shell.html", page.url()).href);
await page.waitForFunction(() => customElements.get("z-icon"));
try {
const side = ".z-shell__side";
const inspector = ".z-shell__inspector";
const hidden = (selector) => page.locator(selector).evaluate((el) => el.hidden);
const inert = (selector) => page.locator(selector).evaluate((el) => el.inert);

await test("layouts · shell.html no usa React y dibuja los iconos", async () => {
  ok(await page.evaluate(() => !window.React && !Object.keys(document.body).some((k) => k.startsWith("__react"))), "hay rastro de React");
  ok(await page.evaluate(() => [...document.querySelectorAll("z-icon")].every((i) => i.querySelector("svg.z-icon path"))), "hay iconos vacíos");
});

await test("layouts · Shell a 1440 px: sidebar e inspector acoplados", async () => {
  await size(1440);
  await until(() => document.querySelector("#modes").textContent === "sidebar docked, inspector docked", "z:modechange no informó de los dos paneles acoplados");
  ok(await page.locator(`${side}[data-mode=docked]`).isVisible() && await page.locator(`${inspector}[data-mode=docked]`).isVisible(), "los paneles no están acoplados");
  ok(await page.locator(".z-shell__scrim, .z-shell__drawer").count() === 0, "no debe haber velo ni cajón");
  ok(!(await inert(".z-shell__main")) && !(await inert(".z-shell__rail")), "el área principal o el rail están inertes");
  ok(await page.locator(side).evaluate((el) => !el.hasAttribute("role") && !el.hasAttribute("aria-modal") && !el.hasAttribute("tabindex")), "un panel acoplado no es un diálogo");
  const b = await page.evaluate(() => Object.fromEntries([".z-titlebar", ".z-rail", ".z-shell__side", ".z-shell__main", ".z-shell__inspector"].map((s) => { const r = document.querySelector(s).getBoundingClientRect(); return [s, { l: Math.round(r.left), r: Math.round(r.right), t: Math.round(r.top), b: Math.round(r.bottom) }]; })));
  ok(b[".z-rail"].r <= b[side].l && b[side].r <= b[".z-shell__main"].l && b[".z-shell__main"].r <= b[inspector].l, `zonas solapadas: ${JSON.stringify(b)}`);
  ok(b[side].r - b[side].l === 224 && b[inspector].r - b[inspector].l === 400, `anchos de panel fuera de token: ${JSON.stringify(b)}`);
  ok(b[".z-titlebar"].b <= b[".z-rail"].t && b[inspector].r <= 1440 && b[".z-shell__main"].b <= 900, `maquetación: ${JSON.stringify(b)}`);
  await page.mouse.move(700, 600);
  await page.screenshot({ path: join(shots, "layouts-shell-1440.png") });
  // Los botones de la barra de título pliegan los paneles acoplados.
  await page.locator("#toggle-sidebar").click();
  ok(await hidden(side) && !(await page.locator(side).isVisible()), "la sidebar no se plegó");
  ok(await page.locator("#toggle-sidebar").getAttribute("aria-expanded") === "false", "aria-expanded del botón");
  await page.locator("#close-inspector").click();
  ok(await hidden(inspector), "el botón del panel no lo cerró");
  await page.screenshot({ path: join(shots, "layouts-shell-1440-collapsed.png") });
  await page.locator("#toggle-sidebar").click();
  await page.locator("#toggle-inspector").click();
  ok(await page.locator(`${side}[data-mode=docked]`).isVisible() && await page.locator(`${inspector}[data-mode=docked]`).isVisible(), "no volvieron a abrirse");
  // Secciones de la sidebar.
  const fold = page.locator('.z-sidebar__fold:has-text("Projects")');
  await fold.click();
  ok(await fold.getAttribute("aria-expanded") === "false" && !(await page.locator('.z-navlink:has-text("Borealis")').isVisible()), "la sección no se plegó");
  await fold.click();
  ok(await page.locator('.z-navlink:has-text("Borealis")').isVisible(), "la sección no volvió a abrirse");
});

await test("layouts · Shell a 1000 px: inspector en cajón; foco, Escape, velo y botón", async () => {
  await size(1000);
  await until(() => document.querySelector("#modes").textContent === "sidebar docked, inspector drawer", "z:modechange no informó del inspector en cajón");
  ok(await page.locator(`${side}[data-mode=docked]`).isVisible(), "la sidebar debe seguir acoplada");
  ok(await hidden(inspector), "el inspector no debe ocupar sitio hasta que se abre");
  ok(await page.locator(".z-shell__scrim").count() === 0, "sin cajón no hay velo");
  await page.screenshot({ path: join(shots, "layouts-shell-1000.png") });
  await page.locator("#toggle-inspector").click();
  ok(await page.locator(`${inspector}.z-shell__drawer[data-mode=overlay][role=dialog][aria-modal=true]`).isVisible(), "no abrió como cajón");
  ok(await page.locator(".z-shell__scrim").isVisible(), "sin velo");
  ok(await inert(".z-shell__main") && await inert(".z-shell__rail") && await inert(side), "el resto no quedó inerte");
  ok(await page.evaluate(() => document.querySelector(".z-shell__inspector").contains(document.activeElement)), "el foco no entró en el cajón");
  await settle();
  const b = await box(inspector);
  ok(Math.abs(b.x + b.width - (1000 - 12)) < 2, `el cajón no está a la derecha: ${JSON.stringify(b)}`);
  ok(await page.evaluate(() => { const r = document.querySelector(".z-shell__inspector").getBoundingClientRect(); return document.elementFromPoint(r.left + r.width / 2, r.top + 20)?.closest(".z-shell__inspector") !== null; }), "el cajón no queda por encima");
  await page.screenshot({ path: join(shots, "layouts-shell-1000-inspector.png") });
  await page.keyboard.press("Escape");
  ok(await hidden(inspector) && await page.locator(".z-shell__scrim").count() === 0, "Escape no cerró");
  ok(await page.evaluate(() => document.activeElement?.id === "toggle-inspector"), "el foco no volvió al botón que abrió el cajón");
  ok(!(await inert(".z-shell__main")) && !(await inert(".z-shell__rail")) && !(await inert(side)), "el resto sigue inerte");

  await page.locator("#toggle-inspector").click();
  await settle();
  await page.mouse.click(400, 500); // sobre el velo
  ok(await hidden(inspector), "el clic en el velo no cerró");
  await page.locator("#toggle-inspector").click();
  await page.locator("#close-inspector").click();
  ok(await hidden(inspector), "el botón de cierre no cerró");
  // El interruptor del cajón sigue funcionando con zui/dom.
  await page.locator("#toggle-inspector").click();
  await page.locator("#notify").click();
  ok(await page.locator("#notify").getAttribute("aria-checked") === "false", "el interruptor dentro del cajón no respondió");
  await page.keyboard.press("Escape");
  ok(await hidden(inspector), "Escape con el foco en un control del cajón no cerró");
});

await test("layouts · Shell a 700 px: los dos paneles en cajón, nunca dos a la vez", async () => {
  await size(700);
  await until(() => document.querySelector("#modes").textContent === "sidebar drawer, inspector drawer", "z:modechange no informó de los dos cajones");
  ok(await hidden(side) && await hidden(inspector), "a 700 px los paneles empiezan cerrados");
  ok(await page.locator(".z-shell__scrim").count() === 0, "sin cajón no hay velo");
  await page.screenshot({ path: join(shots, "layouts-shell-700.png") });
  await page.locator("#toggle-sidebar").click();
  ok(await page.locator(`${side}.z-shell__drawer[data-mode=overlay]`).isVisible() && await page.locator(".z-shell__scrim").isVisible(), "la sidebar no abrió como cajón");
  ok(await page.evaluate(() => document.querySelector(".z-shell__side").contains(document.activeElement)), "el foco no entró en el cajón");
  ok(await page.locator(`${side} > .z-resize`).evaluate((el) => getComputedStyle(el).display === "none"), "un cajón no muestra tirador");
  await settle();
  await page.screenshot({ path: join(shots, "layouts-shell-700-sidebar.png") });
  // Tab dentro del cajón no llega al contenido inerte.
  for (let i = 0; i < 20; i++) {
    await page.keyboard.press("Tab");
    const where = await page.evaluate(() => { const a = document.activeElement; return a?.closest(".z-shell__main") ? "el área principal" : a?.closest(".z-rail") ? "el rail" : "ok"; });
    ok(where === "ok", `con el cajón abierto el foco llegó a ${where}`);
  }
  await page.keyboard.press("Escape");
  ok(await hidden(side), "Escape no cerró la sidebar");
  // Elegir un destino en el cajón navega y lo cierra (data-z-close).
  await page.locator("#toggle-sidebar").click();
  await page.locator(`${side} .z-navlink:has-text("Editor")`).click();
  ok(await hidden(side), "navegar desde el cajón no lo cerró");
  ok(await page.locator("#screen-editor").isVisible(), "no navegó");
  await page.locator('#tabs [data-tab-id="overview"]').click();

  await page.locator("#toggle-inspector").click();
  ok(await page.locator(`${inspector}.z-shell__drawer`).isVisible(), "el inspector no abrió");
  await settle();
  const b = await box(inspector);
  ok(b.x >= 0 && b.x + b.width <= 700, `el cajón se sale de la ventana: ${JSON.stringify(b)}`);
  await page.screenshot({ path: join(shots, "layouts-shell-700-inspector.png") });
  // Abrir la sidebar con el inspector abierto: solo queda un cajón.
  await page.locator("#toggle-sidebar").click();
  ok(await page.locator(`${side}.z-shell__drawer`).isVisible(), "la sidebar no abrió");
  ok(await page.locator(".z-shell__drawer").count() === 1 && await hidden(inspector), "quedan dos cajones abiertos");
  ok(await page.locator(".z-shell__scrim").count() === 1, "debe quedar un solo velo");
  await settle();
  const scrim = await box(".z-shell__scrim");
  await page.mouse.click(scrim.x + scrim.width - 30, scrim.y + scrim.height / 2);
  ok(await page.locator(".z-shell__drawer").count() === 0, "el velo no cerró el cajón");
});

await test("layouts · Shell cambia de modo al redimensionar y recupera los paneles", async () => {
  await size(1440);
  await until(() => !document.querySelector(".z-shell__inspector").hidden && !document.querySelector(".z-shell__side").hidden, "a 1440 px los paneles no volvieron a acoplarse");
  await record("#app", "modechange");
  await size(1000);
  await until(() => document.querySelector(".z-shell__inspector").hidden, "al estrechar, el inspector sigue acoplado");
  ok(await page.locator(`${side}[data-mode=docked]`).isVisible(), "la sidebar debe seguir acoplada");
  await size(700);
  await until(() => document.querySelector(".z-shell__side").hidden, "al estrechar más, la sidebar sigue acoplada");
  ok(await page.locator(".z-shell__scrim").count() === 0, "estrechar la ventana no debe dejar un velo");
  await size(1440);
  await until(() => !document.querySelector(".z-shell__inspector").hidden && !document.querySelector(".z-shell__side").hidden, "al ensanchar no se recuperaron");
  ok(await page.locator(`${side}[data-mode=docked]`).isVisible() && await page.locator(`${inspector}[data-mode=docked]`).isVisible(), "no están acoplados");
  const seen = (await events()).map((m) => `${m.sidebar}/${m.inspector}`);
  ok(JSON.stringify(seen) === JSON.stringify(["docked/overlay", "overlay/overlay", "docked/docked"]), `z:modechange: ${seen}`);
  // Un panel plegado a mano sigue plegado al volver de cajón.
  await page.locator("#toggle-sidebar").click();
  await size(700);
  await until(() => document.querySelector("#modes").textContent.startsWith("sidebar drawer"), "no pasó a cajón");
  await size(1440);
  await until(() => !document.querySelector(".z-shell__inspector").hidden, "el inspector no se recuperó");
  ok(await hidden(side), "la sidebar plegada a mano se abrió sola");
  await page.locator("#toggle-sidebar").click();
});

await test("layouts · ResizeHandle: la sidebar acoplada se redimensiona con arrastre, teclado y doble clic", async () => {
  await size(1440);
  const handle = `${side} > .z-resize`;
  await until(() => !document.querySelector(".z-shell__side").hidden, "la sidebar no está abierta");
  ok(await width(side) === 224, `ancho inicial ${await width(side)}`);
  ok(await page.locator(handle).getAttribute("role") === "separator" && await page.locator(handle).getAttribute("aria-orientation") === "vertical", "el tirador no es un separador vertical");
  await record(side, "resize");
  const mainBefore = (await box(".z-shell__main")).width;
  const c = await center(handle);
  await drag(c, { x: c.x + 80, y: c.y });
  ok(await width(side) === 304, `arrastrar 80 px: ${await width(side)}`);
  ok(await page.locator(handle).getAttribute("aria-valuenow") === "304", "aria-valuenow");
  ok(await page.locator(side).evaluate((el) => el.style.getPropertyValue("--z-shell-panel-width") === "304px"), "no escribió --z-shell-panel-width");
  ok(Math.abs(mainBefore - (await box(".z-shell__main")).width - 80) < 2, "el área principal no cedió el espacio");
  ok((await events()).at(-1).size === 304, `z:resize: ${JSON.stringify((await events()).at(-1))}`);
  await page.screenshot({ path: join(shots, "layouts-shell-sidebar-resized.png") });
  await page.locator(handle).focus();
  await page.keyboard.press("ArrowRight");
  ok(await width(side) === 320, `flecha derecha: ${await width(side)}`);
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  ok(await width(side) === 288, `dos flechas a la izquierda: ${await width(side)}`);
  await page.keyboard.press("Home");
  ok(await width(side) === 224, "Inicio no restableció");
  const c2 = await center(handle);
  await drag(c2, { x: c2.x + 400, y: c2.y });
  ok(await width(side) === 360, `máximo: ${await width(side)}`);
  const c3 = await center(handle);
  await drag(c3, { x: c3.x - 400, y: c3.y });
  ok(await width(side) === 180, `mínimo: ${await width(side)}`);
  const c4 = await center(handle);
  await page.mouse.dblclick(c4.x, c4.y);
  ok(await width(side) === 224, "doble clic no restableció");
});

await test("layouts · SplitPane: divisores con arrastre y flechas en los dos ejes, fracción mínima", async () => {
  await size(1440);
  await page.locator('.z-rail [data-go="editor"]').click();
  ok(await page.locator("#screen-editor").isVisible() && await page.locator("#screen-overview").isHidden(), "el rail no abrió el editor");
  ok(await page.locator('.z-rail [data-go="editor"]').getAttribute("aria-current") === "page", "aria-current en el rail");
  const row = "#split-main > .z-split__divider";
  const col = "#split-inner > .z-split__divider";
  await page.mouse.move(700, 600);
  await page.screenshot({ path: join(shots, "layouts-editor.png") });
  const filesBefore = (await box("#pane-files")).width;
  const restBefore = (await box("#split-inner")).width;
  ok(Math.abs(filesBefore / (filesBefore + restBefore) - 0.25) < 0.01, `reparto inicial 25/75: ${filesBefore}/${restBefore}`);
  await record("#split-main", "resize");
  const c = await center(row);
  await drag(c, { x: c.x + 150, y: c.y });
  ok(Math.abs((await box("#pane-files")).width - filesBefore - 150) < 4, `arrastrar 150 px: ${filesBefore} → ${(await box("#pane-files")).width}`);
  ok(Math.abs((await box("#split-inner")).width - (restBefore - 150)) < 4, "el panel vecino no cedió el mismo espacio");
  ok(await page.locator(row).evaluate((el) => !el.hasAttribute("data-dragging")), "data-dragging no se limpió");
  await page.locator(row).focus();
  const now = Number(await page.locator(row).getAttribute("aria-valuenow"));
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  ok(Number(await page.locator(row).getAttribute("aria-valuenow")) === now - 4, "dos flechas a la izquierda no restaron un 4 %");
  await page.keyboard.press("ArrowRight");
  ok(Number(await page.locator(row).getAttribute("aria-valuenow")) === now - 2, "flecha derecha no sumó un 2 %");
  const c2 = await center(row);
  await drag(c2, { x: 0, y: c2.y });
  const min = (await box("#pane-files")).width;
  const whole = min + (await box("#split-inner")).width;
  ok(min / whole > 0.09 && min / whole < 0.12, `fracción mínima: ${(min / whole).toFixed(3)}`);
  const last = (await events()).at(-1);
  ok(last.index === 0 && Math.abs(last.sizes[0] + last.sizes[1] - 1) < 0.001, `z:resize: ${JSON.stringify(last)}`);
  // Divisor horizontal (dirección column).
  const h = (await box("#pane-editor")).height;
  const d = await center(col);
  await drag(d, { x: d.x, y: d.y - 100 });
  const h2 = (await box("#pane-editor")).height;
  ok(Math.abs(h - h2 - 100) < 4, `arrastre vertical: ${h} → ${h2}`);
  await page.locator(col).focus();
  await page.keyboard.press("ArrowDown");
  ok((await box("#pane-editor")).height > h2 + 5, "ArrowDown no agrandó el panel superior");
  ok(await page.locator(col).getAttribute("aria-orientation") === "horizontal", "orientación del divisor horizontal");
  await page.mouse.move(700, 600);
  await page.screenshot({ path: join(shots, "layouts-editor-resized.png") });
});

await test("layouts · TabStrip: seleccionar, teclado, añadir y cerrar con sus paneles", async () => {
  await size(1440);
  const tab = (id) => page.locator(`#tabs [data-tab-id="${id}"]`);
  await tab("overview").click();
  ok(await page.locator("#screen-overview").isVisible() && await page.locator("#screen-editor").isHidden(), "la pestaña no cambió de panel");
  ok(await page.locator('.z-rail [data-go="overview"]').getAttribute("aria-current") === "page", "z:select no llegó a la aplicación");
  await page.keyboard.press("ArrowRight");
  ok(await tab("editor").evaluate((el) => el.getAttribute("aria-selected") === "true" && el === document.activeElement), "ArrowRight no activó ni enfocó");
  ok(await page.locator("#screen-editor").isVisible(), "el teclado no cambió de panel");
  await page.keyboard.press("Home");
  ok(await tab("overview").getAttribute("aria-selected") === "true", "Home");
  await page.keyboard.press("End");
  ok(await tab("editor").getAttribute("aria-selected") === "true", "End");
  await page.locator("#tabs .z-tabstrip__add").click();
  ok(await tab("draft-1").getAttribute("aria-selected") === "true" && await page.locator("#screen-draft-1").isVisible(), "z:add no creó pestaña y panel");
  ok(await page.locator("#screen-editor").isHidden(), "el panel anterior sigue visible");
  await page.locator('#tabs .z-tabstrip__tab:has([data-tab-id="draft-1"]) .z-tabstrip__close').click();
  ok(await tab("draft-1").count() === 0 && await page.locator("#screen-draft-1").count() === 0, "cerrar no retiró pestaña y panel");
  ok(await tab("editor").getAttribute("aria-selected") === "true" && await page.locator("#screen-editor").isVisible(), "no se activó la vecina");
  await page.locator('#tabs .z-tabstrip__tab:has([data-tab-id="editor"]) .z-tabstrip__close').click();
  ok(await tab("editor").count() === 0 && await page.locator("#screen-editor").isHidden(), "cerrar el editor no ocultó su panel");
  ok(await tab("overview").getAttribute("aria-selected") === "true" && await page.locator("#screen-overview").isVisible(), "no volvió a Overview");
  ok(await page.locator('#tabs .z-tabstrip__tab:has([data-tab-id="overview"]) .z-tabstrip__close').count() === 0, "Overview no debe poder cerrarse");
  // Contrato accesible: el cierre es ayuda de puntero y Supr cierra la pestaña activa.
  ok(await page.evaluate(() => [...document.querySelectorAll("#tabs .z-tabstrip__close")].every((c) => c.getAttribute("aria-hidden") === "true" && c.tabIndex === -1)), "hay cierres enfocables o visibles para lectores");
  const before = await page.locator("#tabs .z-tabstrip__select").count();
  await page.evaluate(() => document.querySelector("#tabs .z-tabstrip__add")?.click());
  await page.locator('#tabs .z-tabstrip__select[aria-selected="true"]').focus();
  await page.keyboard.press("Delete");
  ok(await page.locator("#tabs .z-tabstrip__select").count() === before, "Supr no cerró la pestaña activa");
  ok(await page.evaluate(() => document.activeElement?.classList.contains("z-tabstrip__select")), "el foco no volvió a una pestaña");
  // La aplicación vuelve a abrir una pestaña cerrada con addWorkTab.
  await page.locator('.z-rail [data-go="editor"]').click();
  ok(await tab("editor").getAttribute("aria-selected") === "true" && await page.locator("#screen-editor").isVisible(), "el rail no reabrió el editor");
});

await test("layouts · 390 px: sin desbordamiento, cajón dentro de la ventana y pestaña activa a la vista", async () => {
  await size(390, 844);
  await until(() => document.querySelector("#modes").textContent === "sidebar drawer, inspector drawer", "no pasó a cajón");
  const inView = () => page.evaluate(() => {
    const list = document.querySelector("#tabs .z-tabstrip__list").getBoundingClientRect();
    const tab = document.querySelector("#tabs .z-tabstrip__tab[data-selected]").getBoundingClientRect();
    return tab.left >= list.left - 1 && tab.right <= list.right + 1 && list.right <= innerWidth;
  });
  for (let i = 0; i < 4; i++) await page.locator("#tabs .z-tabstrip__add").click();
  ok(await page.locator("#tabs .z-tabstrip__list").evaluate((el) => el.scrollWidth > el.clientWidth), "la tira debería desbordar para esta prueba");
  ok(await inView(), "la pestaña recién añadida no quedó a la vista");
  await page.locator("#tabs .z-tabstrip__tab[data-selected] .z-tabstrip__select").focus();
  await page.keyboard.press("Home");
  ok(await inView(), "la primera pestaña no quedó a la vista");
  await page.keyboard.press("End");
  ok(await inView(), "la última pestaña no quedó a la vista");
  const overflow = () => page.evaluate(() => {
    const over = document.documentElement.scrollWidth - document.documentElement.clientWidth;
    const wide = [...document.querySelectorAll(".z-shell *")].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && !e.closest(".z-tabstrip__list, [hidden]") && (r.right > innerWidth + 1 || r.left < -1); }).slice(0, 6).map((e) => `${e.tagName.toLowerCase()}.${String(e.className).split(" ")[0]}`);
    return { over, wide };
  });
  let o = await overflow();
  ok(o.over <= 1 && o.wide.length === 0, `desborda ${o.over}px: ${o.wide.join(", ")}`);
  await page.mouse.move(200, 600);
  await page.screenshot({ path: join(shots, "layouts-mobile.png") });
  for (const [toggle, panel] of [["#toggle-sidebar", side], ["#toggle-inspector", inspector]]) {
    await page.locator(toggle).click();
    await settle();
    const b = await box(panel);
    ok(b.x >= 0 && b.x + b.width <= 390, `${panel} se sale de la ventana: ${JSON.stringify(b)}`);
    o = await overflow();
    ok(o.over <= 1 && o.wide.length === 0, `con ${panel} abierto desborda ${o.over}px: ${o.wide.join(", ")}`);
    await page.screenshot({ path: join(shots, `layouts-mobile-${panel === side ? "sidebar" : "inspector"}.png`) });
    await page.keyboard.press("Escape");
    ok(await hidden(panel), `Escape no cerró ${panel}`);
  }
});
} finally {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(new URL("index.html", page.url()).href);
  await page.waitForFunction(() => customElements.get("z-icon"));
}
}
