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

  /* ---------- Collapsible ---------- */
  await test("Collapsible: botón con aria-expanded, región hidden=until-found y z:change; Intro y Espacio", async () => {
    const root = card("Collapsible").locator(".z-collapsible").first();
    const trigger = root.locator(".z-collapsible__trigger");
    const content = root.locator(".z-collapsible__content");
    ok((await content.getAttribute("hidden")) === "until-found", `plegado: hidden=${await content.getAttribute("hidden")}`);
    await events();
    await trigger.click();
    ok((await trigger.getAttribute("aria-expanded")) === "true" && (await content.isVisible()), "se abre con clic");
    const log = await events();
    ok(
      log.some((e) => e.name === "z:change" && e.detail.open === true),
      `evento: ${JSON.stringify(log)}`,
    );
    await trigger.focus();
    await press("Enter");
    ok(
      (await trigger.getAttribute("aria-expanded")) === "false" && (await content.getAttribute("hidden")) === "until-found",
      "Intro pliega",
    );
    await press(" ");
    ok((await trigger.getAttribute("aria-expanded")) === "true", "Espacio abre");
  });
  await test("Collapsible: la búsqueda en la página (beforematch) abre la región plegada", async () => {
    const box = await inject("Collapsible", 0);
    const root = box.locator(".z-collapsible");
    const supported = await page.evaluate(() => "onbeforematch" in document.body);
    // Se simula el evento del navegador: el comportamiento es el mismo en los motores que lo emiten.
    await box.locator(".z-collapsible__content").evaluate((el) => el.dispatchEvent(new Event("beforematch", { bubbles: true })));
    ok((await root.getAttribute("data-state")) === "open", `beforematch abre (nativo: ${supported})`);
  });
  await test("Collapsible parcial: se ve el principio, el botón va detrás y el foco dentro lo despliega", async () => {
    const box = await inject("Collapsible", 2);
    const root = box.locator(".z-collapsible");
    const content = root.locator(".z-collapsible__content");
    ok((await content.getAttribute("hidden")) === null, "no se oculta");
    const height = await content.evaluate((el) => el.getBoundingClientRect().height);
    ok(height <= 57, `recortado a 56px: ${height}`);
    const order = await root.evaluate((el) => [...el.children].map((c) => c.className));
    ok(order[1] === "z-collapsible__trigger", `orden: ${order}`);
    await root.locator(".z-collapsible__trigger").click();
    const open = await content.evaluate((el) => el.getBoundingClientRect().height);
    ok(open > height, `se despliega: ${open}`);
  });
  await test("Collapsible deshabilitado: el clic no lo abre", async () => {
    const box = await inject("Collapsible", 3);
    await box.locator(".z-collapsible__trigger").click({ force: true });
    ok((await box.locator(".z-collapsible").getAttribute("data-state")) === "closed", "sigue plegado");
  });

  /* ---------- Banner ---------- */
  await test("Banner: el cierre emite z:dismiss, lo oculta y el foco sigue hacia delante; cancelable", async () => {
    const box = await inject("Banner", 0);
    const banner = box.locator(".z-banner");
    ok((await banner.getAttribute("role")) === null, "sin región viva al llegar con la página");
    await box.evaluate((el) => {
      const after = document.createElement("button");
      after.id = "w4-after-banner";
      after.textContent = "After";
      el.append(after);
      el.querySelector(".z-banner").addEventListener("z:dismiss", (e) => window.__w4block && e.preventDefault());
    });
    await page.evaluate(() => (window.__w4block = true));
    await banner.locator(".z-banner__close").click();
    ok(await banner.isVisible(), "z:dismiss cancelado: sigue visible");
    await page.evaluate(() => (window.__w4block = false));
    await events();
    await banner.locator(".z-banner__close").focus();
    await press("Enter");
    ok(await banner.isHidden(), "cerrado");
    ok(
      (await events()).some((e) => e.name === "z:dismiss"),
      "evento z:dismiss",
    );
    ok(await activeIs("#w4-after-banner"), "el foco sigue al siguiente tabulable");
  });
}
