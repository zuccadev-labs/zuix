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

  /* ---------- Menu con casillas y radios ---------- */
  await test("Menu: casilla con Espacio (sigue abierto) e Intro (cierra), radios excluyentes con z:change en el grupo", async () => {
    const box = await inject("Menu", 1);
    const trigger = box.locator("[data-z-open]");
    const menu = box.locator("#view-options");
    await trigger.click();
    ok(await menu.isVisible(), "abre");
    ok(await activeIs('#view-options [role="menuitemcheckbox"]'), "foco en la primera entrada");
    await events();
    await press(" ");
    ok(await menu.isVisible(), "Espacio deja el menú abierto");
    ok((await menu.locator('[role="menuitemcheckbox"]').first().getAttribute("aria-checked")) === "false", "Minimap se apaga");
    const log = await events();
    ok(
      log.some((e) => e.name === "z:change" && e.detail.checked === false),
      `z:change: ${JSON.stringify(log)}`,
    );
    const hidden = await menu
      .locator('[role="menuitemcheckbox"]')
      .first()
      .locator("z-icon")
      .evaluate((el) => getComputedStyle(el).visibility);
    ok(hidden === "hidden", `marca oculta sin marcar: ${hidden}`);
    await press("ArrowDown", "Enter");
    ok(await menu.isHidden(), "Intro cierra");
    ok((await menu.locator('[role="menuitemcheckbox"]').nth(1).getAttribute("aria-checked")) === "true", "Word wrap se enciende");
    await trigger.click();
    await menu.locator('[role="menuitemradio"][value="comfortable"]').click();
    ok(await menu.isHidden(), "elegir un radio cierra");
    const radios = await menu.locator('[role="menuitemradio"]').evaluateAll((list) => list.map((el) => el.getAttribute("aria-checked")));
    ok(radios.join() === "false,true", `excluyentes: ${radios}`);
    const change = (await events()).find((e) => e.name === "z:change" && e.detail?.value);
    ok(change?.detail.value === "comfortable" && change.cls.includes("z-menu__group"), `z:change del grupo: ${JSON.stringify(change)}`);
    const dot = await menu
      .locator('[role="menuitemradio"][aria-checked="true"] .z-menu__check')
      .evaluate((el) => getComputedStyle(el, "::before").borderTopStyle);
    ok(dot === "solid", "punto del radio dibujado con borde");
  });

  /* ---------- Menubar ---------- */
  await test("Menubar: una parada de Tab, flechas entre títulos, Flecha abajo abre, y dentro del menú las flechas pasan al vecino", async () => {
    const bar = card("Menubar").locator('[role="menubar"]');
    const file = bar.locator("#mb-file-trigger");
    const stops = await bar.locator('[role="menuitem"]').evaluateAll((list) => list.filter((el) => el.tabIndex === 0).length);
    ok(stops === 1, `paradas: ${stops}`);
    await file.focus();
    await press("ArrowRight");
    ok(await activeIs("#mb-edit-trigger"), "flecha derecha al siguiente título");
    await press("ArrowLeft", "ArrowLeft");
    ok(await activeIs("#mb-view-trigger"), "vuelta al último");
    await press("Home", "ArrowDown");
    ok(await page.locator("#mb-file").isVisible(), "Flecha abajo abre");
    ok((await file.getAttribute("aria-expanded")) === "true", "aria-expanded");
    ok(await activeIs("#mb-file .z-menu__item"), "foco en la primera entrada");
    await press("ArrowRight");
    ok(await page.locator("#mb-edit").isVisible(), "derecha en una entrada sin submenú pasa a Edit");
    ok(await page.locator("#mb-file").isHidden(), "File se cierra");
    ok(await activeIs("#mb-edit .z-menu__item"), "foco en la primera entrada de Edit");
    await press("ArrowLeft");
    ok((await page.locator("#mb-file").isVisible()) && (await page.locator("#mb-edit").isHidden()), "izquierda vuelve a File");
    await press("ArrowDown", "ArrowDown", "ArrowRight");
    ok(await page.locator("#mb-recent").isVisible(), "derecha en una entrada con submenú lo abre");
    await press("ArrowLeft");
    ok(
      (await page.locator("#mb-recent").isHidden()) && (await page.locator("#mb-file").isVisible()),
      "izquierda en el submenú cierra solo ese nivel",
    );
    await press("Escape");
    ok(await page.locator("#mb-file").isHidden(), "Escape cierra");
    ok(await activeIs("#mb-file-trigger"), "foco de vuelta al título");
    await press("ArrowUp");
    ok(await activeIs("#mb-file .z-menu__item:last-of-type"), `Flecha arriba enfoca la última: ${await activeLabel()}`);
    await press("Escape");
  });
  await test("Menubar: con un menú abierto, el puntero sobre otro título lo abre; sin ninguno, no", async () => {
    const bar = card("Menubar").locator('[role="menubar"]');
    await bar.locator("#mb-edit-trigger").hover();
    ok(await page.locator("#mb-edit").isHidden(), "sin menú abierto, hover no abre");
    await bar.locator("#mb-file-trigger").click();
    ok(await page.locator("#mb-file").isVisible(), "clic abre");
    await bar.locator("#mb-view-trigger").hover();
    ok((await page.locator("#mb-view").isVisible()) && (await page.locator("#mb-file").isHidden()), "hover cambia de menú");
    await page.locator("#mb-view [role='menuitemcheckbox']").nth(1).click();
    ok((await page.locator("#mb-view [role='menuitemcheckbox']").nth(1).getAttribute("aria-checked")) === "true", "casilla en la barra");
    await page.keyboard.press("Escape");
  });

  /* ---------- Popover con ancla distinta y flecha ---------- */
  await test("Popover: ancla distinta del disparador, flecha hacia su centro, CSS anchor positioning donde existe y cierre", async () => {
    const box = await inject("Popover", 1);
    const trigger = box.locator("[data-z-open]");
    const panel = page.locator("#dns-help");
    await trigger.click();
    ok(await panel.isVisible(), "abre");
    ok((await trigger.getAttribute("aria-expanded")) === "true", "aria-expanded en el disparador, no en el ancla");
    ok((await box.locator("#dns-field").getAttribute("aria-expanded")) === null, "el ancla no recibe aria-expanded");
    // Firefox aplica el desplazamiento de la página al anclaje CSS con un pequeño retraso: se espera a que se asiente.
    await page
      .waitForFunction(
        () => {
          const a = document.getElementById("dns-field").getBoundingClientRect();
          const r = document.getElementById("dns-help").getBoundingClientRect();
          return Math.abs(r.top - a.bottom) < 40;
        },
        null,
        { timeout: 2000 },
      )
      .catch(() => {});
    const geo = await page.evaluate(() => {
      const a = document.getElementById("dns-field").getBoundingClientRect();
      const p = document.getElementById("dns-help");
      const r = p.getBoundingClientRect();
      const arrow = getComputedStyle(p, "::after");
      return {
        gapTop: r.top - a.bottom,
        startAligned: Math.abs(r.left - a.left),
        side: p.dataset.side,
        offset: parseFloat(p.style.getPropertyValue("--z-arrow-offset")),
        anchorCenter: a.left + a.width / 2 - r.left,
        anchored: p.hasAttribute("data-anchored"),
        supports: CSS.supports("position-area: bottom") && CSS.supports("anchor-name: --a"),
        arrow: arrow.content !== "none" && arrow.content !== "normal",
      };
    });
    ok(geo.side === "bottom" && geo.gapTop >= 8 && geo.gapTop <= 16, `debajo del campo: ${JSON.stringify(geo)}`);
    ok(geo.startAligned <= 1, `alineado al inicio del campo: ${geo.startAligned}`);
    ok(geo.arrow && Math.abs(geo.offset - Math.max(12, geo.anchorCenter)) <= 2, `flecha al centro del ancla: ${JSON.stringify(geo)}`);
    // Donde existe se ancla con CSS; si el motor deja la capa lejos del ancla, vuelve a la colocación propia.
    ok(!geo.anchored || geo.supports, `CSS anchor positioning solo donde existe: ${JSON.stringify(geo)}`);
    await panel.locator(".z-popover__close").click();
    ok(await panel.isHidden(), "el botón de cierre cierra");
    ok(await activeIs("#w4-Popover-1 [data-z-open]"), "el foco vuelve al disparador");
    ok((await page.locator("#dns-help").getAttribute("data-anchored")) === null, "al cerrar se retira el ancla CSS");
  });

  /* ---------- HoverCard ---------- */
  await test("HoverCard: el puntero abre tras el retardo, cruza a la tarjeta sin cerrarla, Escape cierra; describe al enlace", async () => {
    const link = card("HoverCard").locator("[data-z-hovercard]");
    const layer = page.locator("#hc-ana");
    // El retardo se mide con el reloj (bajo carga, una comprobación a los 200 ms no es fiable).
    // La relación está antes de abrir (patrón «hovercard» de modern-web-guidance): la tarjeta oculta describe al enlace.
    ok((await link.getAttribute("aria-describedby")) === "hc-ana", "aria-describedby antes de abrir");
    ok((await layer.getAttribute("role")) === "tooltip", "role=tooltip");
    const started = Date.now();
    await link.hover();
    await layer.waitFor({ state: "visible", timeout: 3000 });
    ok(Date.now() - started >= 450, `abre tras el retardo: ${Date.now() - started} ms`);
    ok((await link.getAttribute("aria-describedby"))?.includes("hc-ana"), "aria-describedby");
    ok((await link.getAttribute("aria-expanded")) === null, "sin aria-expanded en el enlace");
    const box = await layer.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 4 });
    await page.waitForTimeout(500);
    ok(await layer.isVisible(), "sigue abierta con el puntero encima");
    await press("Escape");
    await layer.waitFor({ state: "hidden", timeout: 2000 });
    ok((await link.getAttribute("aria-describedby")) === "hc-ana", "sigue describiendo al enlace al cerrar");
    await page.mouse.move(5, 5);
  });
  await test("HoverCard: con el teclado abre al enfocar; Tab entra en la tarjeta y sale tras el enlace", async () => {
    const link = card("HoverCard").locator("[data-z-hovercard]");
    const layer = page.locator("#hc-ana");
    await link.evaluate((el) => {
      const after = document.createElement("button");
      after.id = "w4-after-hc";
      after.textContent = "After";
      el.closest("p").after(after);
    });
    await page.locator("[data-component='HoverCard'] .demo__head").click();
    await link.focus();
    await press("Shift+Tab", "Tab");
    await layer.waitFor({ state: "visible", timeout: 2000 });
    await press("Tab");
    ok(await activeIs("#hc-ana a"), "Tab entra en la tarjeta");
    await press("Shift+Tab");
    ok(await activeIs("[data-z-hovercard]"), "Mayús+Tab vuelve al enlace");
    await press("Tab", "Tab");
    ok(await activeIs("#w4-after-hc"), "Tab sale hacia lo que sigue al enlace");
    await layer.waitFor({ state: "hidden", timeout: 2000 });
  });

  /* ---------- Toggletip ---------- */
  await test("Toggletip: el clic la fija (aria-expanded) y otro clic la cierra; Escape devuelve el foco", async () => {
    const button = card("Toggletip").locator(".z-toggletip__trigger");
    const layer = page.locator("#tt-shipping");
    await button.click();
    await layer.waitFor({ state: "visible", timeout: 2000 });
    ok((await button.getAttribute("aria-expanded")) === "true", "aria-expanded");
    await page.mouse.move(5, 5);
    await page.waitForTimeout(500);
    ok(await layer.isVisible(), "fijada: no se va al salir el puntero");
    await button.click();
    await layer.waitFor({ state: "hidden", timeout: 2000 });
    ok((await button.getAttribute("aria-expanded")) === "false", "otro clic cierra");
    await button.focus();
    await press("Enter");
    await layer.waitFor({ state: "visible", timeout: 2000 });
    await press("Escape");
    await layer.waitFor({ state: "hidden", timeout: 2000 });
    ok(await activeIs(".z-toggletip__trigger"), "el foco sigue en el botón");
  });
  await test("Toggletip: el puntero la asoma sin fijarla; pulsar fuera la cierra; flecha hacia el botón", async () => {
    const box = await inject("Toggletip", 1);
    const button = box.locator(".z-toggletip__trigger");
    const layer = page.locator("#tt-limits");
    await button.hover();
    await layer.waitFor({ state: "visible", timeout: 2000 });
    const side = await layer.getAttribute("data-side");
    ok(side === "right" || side === "left", `al lado: ${side}`);
    const arrow = await layer.evaluate((el) => getComputedStyle(el, "::after").rotate);
    ok(arrow === "-45deg" || arrow === "135deg", `flecha lateral: ${arrow}`);
    await page.mouse.move(5, 5);
    await layer.waitFor({ state: "hidden", timeout: 2000 });
    await button.click();
    await layer.waitFor({ state: "visible", timeout: 2000 });
    await page.mouse.click(5, 300);
    await layer.waitFor({ state: "hidden", timeout: 2000 });
  });

  /* ---------- Aviso de una promesa ---------- */
  await test("toastPromise: en curso con anillo y aria-busy sin cerrarse, luego éxito o error en el mismo aviso", async () => {
    await page.evaluate(async () => {
      const dom = await import("/zui/dist/zui.dom.js");
      window.__w4resolve = undefined;
      const job = new Promise((resolve, reject) => (window.__w4resolve = { resolve, reject }));
      dom.toastPromise(job, {
        loading: "Deploying…",
        success: (v) => ({ title: "Deployed", description: `Version ${v}` }),
        error: "Deploy failed",
      });
    });
    const item = page.locator(".z-toast", { hasText: "Deploying" });
    await item.waitFor({ state: "visible" });
    ok((await item.getAttribute("aria-busy")) === "true" && (await item.locator(".z-toast__spinner").count()) === 1, "en curso");
    await page.waitForTimeout(5600);
    ok(await item.isVisible(), "no se cierra solo mientras está en curso");
    await page.evaluate(() => window.__w4resolve.resolve("0.3.0"));
    const done = page.locator(".z-toast", { hasText: "Deployed" });
    await done.waitFor({ state: "visible" });
    ok((await done.getAttribute("data-intent")) === "success" && (await done.getAttribute("aria-busy")) === null, "éxito");
    ok((await done.locator(".z-toast__description").textContent()) === "Version 0.3.0", "descripción del valor");
    ok((await done.locator(".z-toast__dot").count()) === 1, "vuelve el punto");
    await page.evaluate(async () => {
      const dom = await import("/zui/dist/zui.dom.js");
      dom.toastPromise(Promise.reject(new Error("x")), { loading: "Saving…", success: "Saved", error: (e) => `Failed: ${e.message}` });
    });
    const failed = page.locator(".z-toast", { hasText: "Failed: x" });
    await failed.waitFor({ state: "visible" });
    ok((await failed.getAttribute("role")) === "alert" && (await failed.getAttribute("data-intent")) === "danger", "error como alerta");
    await failed.locator(".z-toast__close").click();
    await done
      .locator(".z-toast__close")
      .click()
      .catch(() => {});
  });

  /* ---------- Command en línea ---------- */
  await test("Command en línea: filtra, flechas con aria-activedescendant, Intro emite z:select y Escape vacía la búsqueda", async () => {
    const root = card("Command").locator(".z-command");
    const input = root.locator(".z-palette__input");
    ok((await input.getAttribute("aria-activedescendant")) === "project-commands-option-0", "primer comando activo");
    await input.fill("mem");
    const shown = await root.locator(".z-palette__item:not([hidden])").count();
    ok(shown === 1, `filtra: ${shown}`);
    await input.fill("");
    await input.focus();
    await press("ArrowDown", "ArrowDown");
    const active = await input.getAttribute("aria-activedescendant");
    ok((await page.locator(`[id="${active}"]`).textContent()).includes("Settings"), `activo: ${active}`);
    await events();
    await press("Enter");
    const log = await events();
    ok(
      log.some((e) => e.name === "z:select"),
      `z:select: ${JSON.stringify(log)}`,
    );
    ok(await root.isVisible(), "en línea no se cierra");
    await input.fill("dup");
    await press("Escape");
    ok(
      (await input.inputValue()) === "" && (await root.locator(".z-palette__item:not([hidden])").count()) === 4,
      "Escape vacía la búsqueda",
    );
  });

  /* ---------- ActionBar ---------- */
  await test("ActionBar: una parada de Tab (Toolbar), recuento vivo y Escape o el cierre la ocultan con z:close", async () => {
    const box = await inject("ActionBar", 0);
    const bar = box.locator(".z-actionbar");
    ok((await bar.locator(".z-actionbar__count").getAttribute("aria-live")) === "polite", "recuento vivo");
    const stops = await bar.locator("button").evaluateAll((list) => list.filter((el) => el.tabIndex === 0).length);
    ok(stops === 1, `paradas: ${stops}`);
    await bar.locator("button").first().focus();
    await press("End");
    ok(await activeIs(".z-actionbar__close"), "Fin llega al cierre");
    await press("Home", "Escape");
    ok(await bar.isHidden(), "Escape la oculta");
    ok(
      (await events()).some((e) => e.name === "z:close" && e.cls.includes("z-actionbar")),
      "z:close",
    );
  });

  /* ---------- Drawer con anclajes ---------- */
  await test("Drawer: hoja inferior con anclajes (slider con flechas), arrastre al anclaje menor y por debajo cierra", async () => {
    const box = await inject("Drawer", 1);
    await box.locator("[data-z-open]").click();
    const sheet = page.locator("#comments");
    await sheet.waitFor({ state: "visible" });
    await page.waitForTimeout(600);
    const handle = sheet.locator(".z-drawer__handle");
    const tall = (await sheet.boundingBox()).height;
    ok(Math.abs(tall - 0.85 * 1000) < 30, `85 %: ${tall}`);
    await handle.focus();
    await press("ArrowDown");
    ok(
      (await handle.getAttribute("aria-valuenow")) === "0" && (await handle.getAttribute("aria-valuetext")) === "40%",
      "flecha abajo: 40 %",
    );
    await page.waitForTimeout(400);
    const short = (await sheet.boundingBox()).height;
    ok(Math.abs(short - 400) < 30, `40 %: ${short}`);
    await press("End");
    ok((await sheet.getAttribute("data-snap")) === "1", "Fin: el mayor");
    await page.waitForTimeout(600);
    const h = await handle.boundingBox();
    await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
    await page.mouse.down();
    await page.mouse.move(h.x + h.width / 2, h.y + 380, { steps: 8 });
    // Pausa antes de soltar: sin inercia, cuenta solo la posición (la inercia la prueban las unitarias).
    await page.waitForTimeout(150);
    await page.mouse.up();
    ok((await sheet.getAttribute("data-snap")) === "0", "arrastre al anclaje menor");
    await page.waitForTimeout(600);
    const h2 = await handle.boundingBox();
    await page.mouse.move(h2.x + h2.width / 2, h2.y + h2.height / 2);
    await page.mouse.down();
    await page.mouse.move(h2.x + h2.width / 2, h2.y + 330, { steps: 8 });
    // Pausa antes de soltar: sin inercia, cuenta solo la posición (la inercia la prueban las unitarias).
    await page.waitForTimeout(150);
    await page.mouse.up();
    await sheet.waitFor({ state: "hidden", timeout: 2000 });
  });

  /* ---------- Tour ---------- */
  await test("startTour: tarjeta anclada con anillo y foco en Siguiente, flechas, Escape cierra y devuelve el foco", async () => {
    const start = card("Tour").locator("#tour-start");
    await start.focus();
    await page.evaluate(async () => {
      const dom = await import("/zui/dist/zui.dom.js");
      window.__tour = dom.startTour({
        steps: [
          { target: "#tour-start", title: "Create a project", content: "Projects group your files." },
          { target: '[data-component="Toolbar"] [role="toolbar"]', title: "Format text", side: "top" },
          { title: "You are ready" },
        ],
      });
    });
    const tour = page.locator(".z-tour[popover]");
    await tour.waitFor({ state: "visible" });
    ok((await tour.getAttribute("role")) === "dialog", "role=dialog");
    const name = await tour.getAttribute("aria-labelledby");
    ok((await page.locator(`[id="${name}"]`).textContent()) === "Create a project", "nombre del encabezado");
    await page.waitForFunction(() => document.activeElement?.matches(".z-tour .z-tour__primary"), null, { timeout: 2000 }).catch(() => {});
    ok(await activeIs(".z-tour .z-tour__primary"), "el foco entra en Siguiente");
    await page
      .locator(".z-tour__ring")
      .waitFor({ state: "visible", timeout: 2000 })
      .catch(() => {});
    ok(await page.locator(".z-tour__ring").isVisible(), "anillo");
    ok((await tour.locator(".z-tour__progress").textContent()) === "Step 1 of 3", "progreso");
    await press("ArrowRight");
    ok((await tour.locator(".z-tour__title").textContent()) === "Format text", "flecha derecha: paso 2");
    ok((await tour.getAttribute("data-side")) === "top", "lado del paso");
    await press("ArrowRight");
    ok(
      (await tour.locator(".z-tour__primary").textContent()) === "Done" && (await tour.locator(".z-tour__skip").isHidden()),
      "último paso",
    );
    ok((await tour.getAttribute("data-arrow")) === null, "sin elemento: centrado y sin flecha");
    await press("Escape");
    await page.locator(".z-tour[popover]").waitFor({ state: "detached", timeout: 2000 });
    ok(await activeIs("#tour-start"), "el foco vuelve a donde estaba");
  });
}
