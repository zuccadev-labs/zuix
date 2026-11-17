// Casos base del contrato HTML: iconos, tokens, overlays, pestañas, acordeón, controles, tema y móvil.
import { join } from "node:path";

export default async function ({ page, test, ok, card, settle, shots }) {
await test("no usa React", async () => ok(await page.evaluate(() => !document.querySelector("[data-reactroot]") && !window.React && !Object.keys(document.body).some((k) => k.startsWith("__react"))), "hay rastro de React"));
await test("<z-icon> dibuja SVG con trazados", async () => ok(await page.evaluate(() => [...document.querySelectorAll("z-icon")].every((i) => i.querySelector("svg.z-icon path"))), "hay iconos vacíos"));
await test("tokens aplicados al botón primario", async () => {
  const bg = await card("Button").locator(".z-btn--primary").first().evaluate((el) => getComputedStyle(el).backgroundColor);
  ok(bg !== "rgba(0, 0, 0, 0)" && bg !== "rgb(239, 239, 239)", `fondo sin token: ${bg}`);
});
await test("Modal: abre, atrapa foco, Escape cierra y devuelve foco", async () => {
  const trigger = card("Modal").locator("[data-z-open]");
  await trigger.click(); await settle();
  ok(await page.locator("#edit-profile").evaluate((d) => d.open && d.matches(":modal")), "no abrió como modal");
  ok(await page.evaluate(() => document.querySelector("#edit-profile").contains(document.activeElement)), "foco fuera del diálogo");
  await page.screenshot({ path: join(shots, "modal.png") });
  await page.keyboard.press("Escape"); await settle();
  ok(await page.locator("#edit-profile").evaluate((d) => !d.open), "Escape no cerró");
  ok(await trigger.evaluate((el) => el === document.activeElement), "no devolvió el foco");
});
await test("Modal: clic en el velo cierra; botón de cierre cierra", async () => {
  await card("Modal").locator("[data-z-open]").click(); await settle();
  await page.mouse.click(10, 10); await settle();
  ok(await page.locator("#edit-profile").evaluate((d) => !d.open), "el velo no cerró");
  await card("Modal").locator("[data-z-open]").click(); await settle();
  await page.locator("#edit-profile .z-modal__close").click(); await settle();
  ok(await page.locator("#edit-profile").evaluate((d) => !d.open), "el botón no cerró");
});
await test("Drawer: abre a la derecha y cierra", async () => {
  await card("Drawer").locator("[data-z-open]").click(); await settle();
  const box = await page.locator("#filters").boundingBox();
  ok(box && box.x + box.width > 1440 - 40 && box.x > 700, `no está a la derecha: ${JSON.stringify(box)}`);
  await page.screenshot({ path: join(shots, "drawer.png") });
  await page.keyboard.press("Escape"); await settle();
  ok(await page.locator("#filters").evaluate((d) => !d.open), "no cerró");
});
await test("Menu: abre anclado, flechas, Enter selecciona y cierra", async () => {
  const trigger = card("Menu").locator("[data-z-open]");
  await trigger.click(); await settle();
  const [t, m] = [await trigger.boundingBox(), await page.locator("#actions").boundingBox()];
  ok(m && Math.abs(m.x - t.x) < 4 && (Math.abs(m.y - (t.y + t.height + 6)) < 3 || Math.abs(m.y + m.height + 6 - t.y) < 3), `mal anclado: ${JSON.stringify([t, m])}`);
  ok(await trigger.getAttribute("aria-expanded") === "true", "aria-expanded");
  await page.screenshot({ path: join(shots, "menu.png") });
  await page.keyboard.press("ArrowDown");
  ok(await page.evaluate(() => document.activeElement?.textContent.includes("Duplicate")), "la flecha no movió el foco");
  await page.keyboard.press("Enter"); await settle();
  ok(await page.locator("#actions").evaluate((el) => !el.matches(":popover-open")), "no cerró al elegir");
  ok(await trigger.getAttribute("aria-expanded") === "false", "aria-expanded tras cerrar");
});
await test("ContextMenu: clic derecho abre en el puntero", async () => {
  const zone = card("ContextMenu").locator("[data-z-context]");
  // El clic va por coordenadas: la zona tiene que estar dentro de la ventana (el orden de las tarjetas no garantiza que lo esté).
  await zone.scrollIntoViewIfNeeded();
  const b = await zone.boundingBox();
  await page.mouse.click(b.x + 20, b.y + 10, { button: "right" }); await settle();
  const m = await page.locator("#file-menu").boundingBox();
  ok(m && Math.abs(m.x - (b.x + 20)) < 6, `posición: ${JSON.stringify(m)}`);
  await page.keyboard.press("Escape"); await settle();
  ok(await page.locator("#file-menu").evaluate((el) => !el.matches(":popover-open")), "Escape no cerró");
});
await test("Popover: abre y cierra con clic fuera", async () => {
  await card("Popover").locator("[data-z-open]").click(); await settle();
  ok(await page.locator("#usage").evaluate((el) => el.matches(":popover-open")), "no abrió");
  await page.mouse.click(5, 500); await settle();
  ok(await page.locator("#usage").evaluate((el) => !el.matches(":popover-open")), "no cerró");
});
await test("Tooltip: aparece al pasar el puntero", async () => {
  await card("Tooltip").locator("[data-z-tooltip]").hover(); await page.waitForTimeout(600);
  ok(await page.locator(".z-tooltip").count() === 1, "sin tooltip");
  ok((await page.locator(".z-tooltip").textContent()) === "Copy link", "texto");
  await page.mouse.move(5, 5); await settle();
  ok(await page.locator(".z-tooltip").count() === 0, "no se retiró");
});
await test("Toast: aparece y se descarta", async () => {
  await page.locator("#save").click(); await settle();
  ok(await page.locator(".z-toast").count() === 1, "sin aviso");
  const box = await page.locator(".z-toast").boundingBox();
  ok(box.x > 900 && box.y > 700, `posición: ${JSON.stringify(box)}`);
  await page.screenshot({ path: join(shots, "toast.png") });
  await page.locator(".z-toast__close").click(); await page.waitForTimeout(500);
  ok(await page.locator(".z-toast").count() === 0, "no se descartó");
});
await test("confirm(): resuelve y el aviso queda sobre la página", async () => {
  await page.locator("#delete").click(); await settle();
  ok(await page.locator("dialog.z-confirm").evaluate((d) => d.open), "no abrió");
  await page.screenshot({ path: join(shots, "confirm.png") });
  // Nombre y descripción accesibles, como el ConfirmDialog de React (APG alertdialog).
  ok(await page.locator("dialog.z-confirm").evaluate((d) => d.getAttribute("role") === "alertdialog" && document.getElementById(d.getAttribute("aria-labelledby"))?.textContent === "Delete project?" && document.getElementById(d.getAttribute("aria-describedby"))?.textContent === "This cannot be undone."), "alertdialog sin aria-labelledby o aria-describedby");
  // El velo no cierra una confirmación.
  await page.mouse.click(5, 500); await settle();
  ok(await page.locator("dialog.z-confirm").evaluate((d) => d.open), "un clic en el velo no debe cerrar una confirmación");
  // Escape cancela (igual que ConfirmDialog en React y que el patrón de diálogo modal de APG): se cierra sin ejecutar la acción.
  await page.keyboard.press("Escape"); await page.waitForTimeout(500);
  ok(await page.locator("dialog.z-confirm").count() === 0, "Escape debe cancelar la confirmación");
  ok(await page.locator(".z-toast").count() === 0, "cancelar con Escape no debe ejecutar la acción");
  ok(await page.evaluate(() => document.activeElement?.id === "delete"), "al cancelar el foco vuelve al disparador");
  await page.locator("#delete").click(); await settle();
  await page.locator("dialog.z-confirm .z-dialog-btn[data-variant='danger']").click(); await page.waitForTimeout(500);
  ok(await page.locator("dialog.z-confirm").count() === 0, "no se retiró");
  ok(await page.locator(".z-toast").count() === 1, "la confirmación no ejecutó la acción");
  await page.locator(".z-toast__close").click(); await page.waitForTimeout(400);
});
await test("Tabs: clic y flechas cambian de panel", async () => {
  const tabs = card("Tabs").locator(".z-tabs").first();
  const tab = tabs.locator(".z-tabs__tab");
  await tab.nth(1).click();
  ok(await tab.nth(1).getAttribute("data-state") === "active" && await tab.nth(0).getAttribute("data-state") === "inactive", "el clic no activó");
  await page.keyboard.press("ArrowRight");
  ok(await tab.nth(2).getAttribute("aria-selected") === "true", "la flecha no activó");
  ok(await tabs.locator(".z-tabs__panel:not([hidden])").count() === 1, "paneles visibles ≠ 1");
});
await test("Accordion: abre una sección y cierra la otra", async () => {
  const items = card("Accordion").locator(".z-accordion__item");
  await items.nth(1).locator(".z-accordion__trigger").click(); await settle();
  ok(await items.nth(1).locator(".z-accordion__content").evaluate((el) => !el.hidden && el.offsetHeight > 0), "no abrió");
  ok(await items.nth(0).locator(".z-accordion__content").evaluate((el) => el.hidden), "no cerró la anterior");
});
await test("Switch, Checkbox, Radio, Toggle, SegmentedControl cambian de estado", async () => {
  for (const [name, sel, attr] of [["Switch", '[role="switch"]', "data-state"], ["Checkbox", '[role="checkbox"]', "aria-checked"], ["Toggle", "[aria-pressed]", "aria-pressed"]]) {
    const el = card(name).locator(sel).first();
    const before = await el.getAttribute(attr);
    await el.click();
    ok(await el.getAttribute(attr) !== before, `${name} no cambió`);
  }
  const box = card("Checkbox").locator('[role="checkbox"]').first();
  ok((await box.getAttribute("aria-checked")) === "false" && await box.locator(".z-check__mark").count() === 0, "la marca no se retiró");
  await card("Checkbox").locator(".z-check__label").first().click();
  ok(await box.locator(".z-check__mark").count() === 1, "clic en la etiqueta no marcó");
  for (const name of ["RadioGroup", "SegmentedControl"]) {
    const radios = card(name).locator('[role="radio"]:not([disabled])');
    await radios.first().click();
    ok(await radios.first().getAttribute("aria-checked") === "true", `${name} no seleccionó`);
    ok(await card(name).locator('[role="radio"][aria-checked="true"]').count() === 1, `${name}: más de uno seleccionado`);
  }
});
await test("tema claro y marca zutool cambian los tokens", async () => {
  const read = () => page.evaluate(() => { const s = getComputedStyle(document.documentElement); return [s.getPropertyValue("--z-accent").trim(), s.getPropertyValue("--z-canvas").trim()]; });
  const [accent, canvas] = await read();
  await page.locator("#theme").click();
  ok((await read())[1] !== canvas, "el tema no cambió el lienzo");
  await page.mouse.move(5, 5); await settle();
  await page.screenshot({ path: join(shots, "page-light.png"), fullPage: true });
  await page.locator("#brand").click();
  ok((await read())[0] !== accent, "la marca no cambió el acento");
  await page.mouse.move(5, 5); await settle();
  await page.screenshot({ path: join(shots, "page-zutool-light.png"), fullPage: true });
  await page.locator("#theme").click(); await page.locator("#brand").click();
});
await test("sin desbordamiento horizontal a 390 px", async () => {
  await page.setViewportSize({ width: 390, height: 844 });
  await settle();
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  const wide = await page.evaluate(() => [...document.querySelectorAll("[data-component]")].filter((c) => c.getBoundingClientRect().right > innerWidth + 1).map((c) => c.dataset.component).concat([...document.querySelectorAll("body *")].filter((e) => e.getBoundingClientRect().right > innerWidth + 1 && !e.closest(".demo__stage")).slice(0, 6).map((e) => `${e.tagName}.${e.className}`)));
  await page.screenshot({ path: join(shots, "page-mobile.png"), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  ok(over <= 1, `desborda ${over}px: ${wide.join(", ")}`);
});
}
