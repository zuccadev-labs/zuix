// Sin framework, contenido y navegación: Tree (selección múltiple, casillas en cascada, renombrar) y las
// piezas de contenido. Puntero y teclado sobre zui/html.json.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const contract = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../../../zui/html.json"), "utf8")).components;

export default async function ({ page, test, ok }) {
  await page.evaluate(() => {
    window.__w5c = [];
    for (const name of ["z:change", "z:rename", "z:copy", "z:select"])
      document.addEventListener(name, (event) =>
        window.__w5c.push({ name, cls: String(event.target.className), detail: JSON.parse(JSON.stringify(event.detail ?? null)) }),
      );
  });
  const events = () => page.evaluate(() => window.__w5c.splice(0));
  const press = async (...keys) => {
    for (const key of keys) await page.keyboard.press(key);
  };
  /** Añade un ejemplo del contrato a la tarjeta del componente y lo activa con hydrate(). Devuelve su contenedor. */
  const inject = async (name, index) => {
    const id = `w5c-${name}-${index}`;
    const example = contract[name].examples[index];
    await page.evaluate(
      async ([component, html, wrap]) => {
        const stage = document.querySelector(`[data-component="${component}"] .demo__stage`) ?? document.querySelector(".page__main");
        const box = document.createElement("div");
        box.id = wrap;
        box.innerHTML = html;
        stage.append(box);
        (await import("/zui/dist/zui.dom.js")).hydrate(box);
      },
      [name, example.html, id],
    );
    return page.locator(`#${id}`);
  };
  const exampleIndex = (name, pattern) => contract[name].examples.findIndex((e) => pattern.test(e.title));

  /* ---------- Tree ---------- */
  await test("Tree: casillas en cascada con estado mixto y Espacio", async () => {
    const box = await inject("Tree", exampleIndex("Tree", /casillas/));
    const items = box.locator('[role="treeitem"]');
    const photos = items.nth(0);
    ok((await photos.getAttribute("aria-checked")) === "mixed", "la rama empieza mixta");
    await events();
    await box.locator('[data-value="photos/2026"] > .z-tree__row .z-tree__check').click();
    ok((await photos.getAttribute("aria-checked")) === "true", "con los dos hijos marcados, la rama pasa a true");
    const log = await events();
    ok(
      log.some((e) => e.name === "z:change" && JSON.stringify(e.detail.checked) === '["photos","photos/2025","photos/2026"]'),
      `evento: ${JSON.stringify(log)}`,
    );
    await photos.focus();
    await press(" ");
    ok((await photos.getAttribute("aria-checked")) === "false", "Espacio en la rama desmarca todo");
    ok((await items.nth(1).getAttribute("aria-checked")) === "false", "y los hijos");
    ok(
      (await box.locator('[data-value="photos"] > .z-tree__row .z-tree__check').getAttribute("data-state")) === "unchecked",
      "la casilla visible sigue al estado",
    );
  });
  await test("Tree: selección múltiple con Ctrl, Mayús y Ctrl+A", async () => {
    const box = page.locator(`#w5c-Tree-${exampleIndex("Tree", /casillas/)}`);
    const tree = box.locator('[role="tree"]');
    ok((await tree.getAttribute("aria-multiselectable")) === "true", "aria-multiselectable");
    const rows = box.locator(".z-tree__label");
    await rows.nth(1).click();
    await rows.nth(3).click({ modifiers: ["Shift"] });
    const selected = () => box.locator('[role="treeitem"][aria-selected="true"]').evaluateAll((l) => l.map((e) => e.dataset.value));
    ok(JSON.stringify(await selected()) === '["photos/2025","photos/2026","music"]', `rango con Mayús: ${await selected()}`);
    await rows.nth(2).click({ modifiers: ["ControlOrMeta"] });
    ok(JSON.stringify(await selected()) === '["photos/2025","music"]', `Ctrl alterna: ${await selected()}`);
    await box.locator('[data-value="music"]').focus();
    await press("Control+a");
    ok((await selected()).length === 4, "Ctrl+A selecciona todo lo visible");
    await box.locator('[data-value="photos"]').focus();
    await press("ArrowDown", "ArrowUp", "Shift+ArrowDown");
    ok(JSON.stringify(await selected()) === '["photos","photos/2025"]', `Mayús+flecha extiende desde el ancla: ${await selected()}`);
  });
  await test("Tree: renombrar con F2 (Intro confirma, Escape cancela) y doble clic", async () => {
    const box = page.locator(`#w5c-Tree-${exampleIndex("Tree", /casillas/)}`);
    const music = box.locator('[data-value="music"]');
    await music.focus();
    await events();
    await press("F2");
    const input = music.locator(".z-tree__rename");
    ok(await input.isVisible(), "aparece el campo");
    ok((await input.getAttribute("aria-label")) === "Rename", "con nombre accesible");
    await input.fill("Songs");
    await press("Enter");
    ok((await music.locator(".z-tree__label").textContent()) === "Songs", "Intro confirma");
    ok(await page.evaluate(() => document.activeElement?.dataset.value === "music"), "el foco vuelve al nodo");
    const log = await events();
    ok(
      log.some((e) => e.name === "z:rename" && e.detail.label === "Songs" && e.detail.value === "music"),
      JSON.stringify(log),
    );
    await music.locator(".z-tree__label").dblclick();
    await music.locator(".z-tree__rename").fill("Nope");
    await press("Escape");
    ok((await music.locator(".z-tree__label").textContent()) === "Songs", "Escape cancela");
    ok((await music.locator(".z-tree__rename").count()) === 0, "sin campo");
  });

  /* ---------- JsonTree ---------- */
  await test("JsonTree: pinta desde el script, tipos, profundidad, teclado de Tree y copia de la ruta", async () => {
    const box = await inject("JsonTree", exampleIndex("JsonTree", /script JSON/));
    const tree = box.locator('[role="tree"]');
    ok((await tree.getAttribute("aria-label")) === "Response", "nombre accesible");
    ok((await box.locator('[data-value="$.tags"]').getAttribute("aria-expanded")) === "true", "profundidad 2 expandida");
    ok((await box.locator('[data-value="$.stats"] > .z-tree__group').isHidden()) === false, "stats visible");
    ok((await box.locator('[data-value="$.name"] .z-jsontree__value').textContent()) === '"Atlas"', "cadena con comillas");
    ok((await box.locator('[data-value="$.owner"] .z-jsontree__value').getAttribute("data-type")) === "null", "tipo null");
    const root = box.locator('[data-value="$"]');
    await root.focus();
    await press("ArrowDown");
    ok(await page.evaluate(() => document.activeElement?.dataset.value === "$.id"), "flecha abajo baja a la primera clave");
    await events();
    await press("Enter");
    await page.waitForTimeout(150);
    const log = await events();
    ok(
      log.some((e) => e.name === "z:select" && e.detail.value === "$.id"),
      `z:select con la ruta: ${JSON.stringify(log)}`,
    );
    await page.evaluate(
      async (id) => {
        const el = document.querySelector(`#${id} .z-jsontree`);
        (await import("/zui/dist/zui.dom.js")).setJsonTreeValue(el, { roles: new Set(["admin"]), limits: new Map([["api", 10n]]) });
      },
      await box.getAttribute("id"),
    );
    ok((await box.locator('[data-value="$.roles"] .z-jsontree__value').first().textContent()) === "Set(1)", "Set");
    ok((await box.locator("[data-value='$.limits.get(\"api\")'] .z-jsontree__value").textContent()) === "10n", "Map con bigint");
  });

  /* ---------- Stepper con paneles ---------- */
  await test("Stepper con paneles: Siguiente, Anterior, foco al panel, marcas y fin", async () => {
    const box = await inject("Stepper", exampleIndex("Stepper", /paneles/));
    const root = box.locator(".z-stepper-panels");
    const panels = box.locator(".z-stepper__panel");
    const next = box.locator('[data-step="next"]');
    const prev = box.locator('[data-step="prev"]');
    ok(await prev.isDisabled(), "Anterior desactivado en el primer paso");
    await events();
    await next.click();
    ok((await root.getAttribute("data-current")) === "1", "paso 1");
    ok(await panels.nth(1).isVisible(), "panel 2 visible");
    ok(await panels.nth(0).isHidden(), "panel 1 oculto");
    ok(await page.evaluate(() => document.activeElement?.classList.contains("z-stepper__panel")), "foco en el panel");
    ok((await box.locator(".z-stepper__step").nth(0).getAttribute("data-state")) === "complete", "paso 1 completo");
    ok((await box.locator(".z-stepper__step").nth(0).locator(".z-stepper__marker svg").count()) === 1, "marca de hecho");
    ok((await box.locator(".z-stepper__step").nth(1).getAttribute("aria-current")) === "step", "aria-current");
    const log = await events();
    ok(
      log.some((e) => e.name === "z:change" && e.detail.value === 1),
      JSON.stringify(log),
    );
    await next.click();
    ok((await next.textContent()) === "Finish", "último paso: Finish");
    await prev.click();
    await prev.click();
    ok((await box.locator(".z-stepper__step").nth(0).locator('.z-stepper__marker z-icon[name="user"]').count()) === 1, "el icono vuelve");
    ok((await box.locator(".z-stepper__step").nth(0).locator(".z-sr-only").textContent()) === "Current", "estado leído");
    await next.click();
    await next.click();
    await next.click();
    ok(await box.locator(".z-stepper__panel[data-completed]").isVisible(), "panel final");
    ok(await box.locator(".z-stepper__nav").isHidden(), "sin botones al terminar");
  });

  /* ---------- Breadcrumb colapsado ---------- */
  await test("Breadcrumb colapsado: «…» abre el menú con las migas del medio, flechas y Escape", async () => {
    // El ejemplo colapsado es el segundo del contrato: se inyecta con ids propios (el menú se busca por id).
    const html = contract.Breadcrumb.examples[exampleIndex("Breadcrumb", /Colapsada con menú/)].html.replaceAll(
      "crumbs-more",
      "w5c-crumbs",
    );
    await page.evaluate(async (markup) => {
      const box = document.createElement("div");
      box.id = "w5c-breadcrumb";
      box.innerHTML = markup;
      document.querySelector(".page__main").append(box);
      (await import("/zui/dist/zui.dom.js")).hydrate(box);
    }, html);
    const box = page.locator("#w5c-breadcrumb");
    const more = box.locator(".z-breadcrumb__more");
    ok((await more.getAttribute("aria-label")) === "Show more breadcrumbs", "nombre accesible");
    await more.click();
    const menu = box.locator(".z-menu");
    ok(await menu.isVisible(), "menú abierto");
    ok((await more.getAttribute("aria-expanded")) === "true", "aria-expanded");
    await page.waitForFunction(() => document.activeElement?.matches?.(".z-breadcrumb .z-menu__item"));
    await press("ArrowDown");
    ok(await page.evaluate(() => document.activeElement?.textContent === "Projects"), "flecha abajo");
    await press("Escape");
    ok(await menu.isHidden(), "Escape cierra");
    ok(await page.evaluate(() => document.activeElement?.classList.contains("z-breadcrumb__more")), "el foco vuelve al botón");
    ok((await box.locator(".z-breadcrumb__separator").first().textContent()) === "/", "separador propio");
  });

  /* ---------- Accordion tarjeta ---------- */
  await test("Accordion tarjeta: collapsible=false bloquea la abierta, flechas la incluyen e item deshabilitado", async () => {
    const box = await inject("Accordion", exampleIndex("Accordion", /Tarjeta/));
    const triggers = box.locator(".z-accordion__trigger");
    ok((await triggers.nth(0).getAttribute("aria-disabled")) === "true", "la abierta lleva aria-disabled");
    // aria-disabled: Playwright no pulsa lo que se anuncia deshabilitado; se fuerza el clic.
    await triggers.nth(0).click({ force: true });
    ok((await triggers.nth(0).getAttribute("aria-expanded")) === "true", "no se cierra");
    await triggers.nth(1).click();
    ok((await triggers.nth(1).getAttribute("aria-expanded")) === "true", "abre la segunda");
    ok((await triggers.nth(0).getAttribute("aria-expanded")) === "false", "cierra la primera");
    ok((await triggers.nth(1).getAttribute("aria-disabled")) === "true", "el bloqueo pasa a la abierta");
    ok((await triggers.nth(0).getAttribute("aria-disabled")) === null, "la cerrada se libera");
    await triggers.nth(0).focus();
    await press("ArrowDown");
    ok(await page.evaluate(() => document.activeElement?.textContent.includes("Seats")), "la bloqueada sigue en las flechas");
    await press("ArrowDown");
    ok(await page.evaluate(() => document.activeElement?.textContent.includes("Plan")), "salta la deshabilitada y vuelve");
    const radius = await box
      .locator(".z-accordion__item")
      .first()
      .evaluate((el) => getComputedStyle(el).borderTopLeftRadius);
    ok(radius !== "0px", `tarjeta con radio: ${radius}`);
  });

  /* ---------- CardMedia y AspectRatio ---------- */
  await test("CardMedia a sangre con el radio de la tarjeta y AspectRatio con su proporción", async () => {
    const media = page.locator('[data-component="CardMedia"] .z-card__media');
    const card = page.locator('[data-component="CardMedia"] .z-card');
    const [m, c] = [await media.boundingBox(), await card.boundingBox()];
    ok(Math.abs(m.x - c.x) <= 1.5 && Math.abs(m.width - c.width) <= 3, `a sangre: ${JSON.stringify([m, c])}`);
    ok(Math.abs(m.width / m.height - 16 / 9) < 0.02, `16:9: ${m.width / m.height}`);
    const radius = await media.evaluate((el) => getComputedStyle(el).borderStartStartRadius);
    ok(Number.parseFloat(radius) > 10, `radio interior: ${radius}`);
    const box = await page.locator('[data-component="AspectRatio"] .z-aspect').boundingBox();
    ok(Math.abs(box.width / box.height - 3 / 4) < 0.02, `3:4: ${box.width / box.height}`);
  });
}
