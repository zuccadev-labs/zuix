// Táctil emulado sobre el contrato HTML: un contexto aparte con `hasTouch`, ventana de teléfono y puntero grueso.
// Chromium usa gestos reales (protocolo de depuración); Firefox y WebKit, toques reales y arrastres con eventos de
// puntero sintéticos de tipo "touch" (ver tests/touch.mjs). Lo que un motor no puede emular se anota o queda
// como no verificable. No sustituye a un dedo en un dispositivo real.
import { join } from "node:path";
import { carouselAtRest } from "../../rest.mjs";
import { touchContext, touchDriver } from "../../touch.mjs";

export default async function ({ page, test, ok, shots, browserName, note, Unverifiable }) {
  const home = page.url();
  const context = await page.context().browser().newContext(touchContext(browserName));
  try {
    const tp = await context.newPage();
    tp.setDefaultTimeout(15000);
    const problems = [];
    tp.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
    tp.on("console", (m) => {
      if (m.type() === "error" && !m.text().includes("Failed to load resource")) problems.push(`console: ${m.text()}`);
    });
    await tp.goto(home);
    await tp.waitForFunction(() => customElements.get("z-icon"));
    const finger = await touchDriver(tp, browserName);
    const settle = (ms = 350) => tp.waitForTimeout(ms);
    const until = async (fn, message, arg) => {
      try {
        await tp.waitForFunction(fn, arg, { timeout: 4000 });
      } catch {
        throw new Error(message);
      }
    };
    /**
     * Espera a que terminen las animaciones de entrada del elemento (y de su subárbol). Una espera fija no basta para
     * medirlo: en un WebKit cargado el reloj de animaciones puede no haber avanzado 350 ms después de insertar el nodo,
     * y la caja sale con la transformación del primer fotograma.
     */
    const rested = async (selector, what) =>
      until(
        (s) => {
          const el = document.querySelector(s);
          if (el === null) return false;
          return el
            .getAnimations({ subtree: true })
            .every((a) => a.playState === "finished" || a.playState === "idle" || a.effect?.getComputedTiming().iterations === Infinity);
        },
        `${what} no terminó su animación de entrada`,
        selector,
      );
    const card = (name) => tp.locator(`[data-component="${name}"]`);
    /** Trae el elemento al centro de la ventana y devuelve su caja. */
    const boxOf = async (selector) => {
      const el = typeof selector === "string" ? tp.locator(selector).first() : selector;
      await el.evaluate((node) => node.scrollIntoView({ block: "center", inline: "nearest" }));
      await settle(120);
      return el.boundingBox();
    };
    const mid = (b) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });
    const coarse = await tp.evaluate(() => matchMedia("(pointer: coarse)").matches && !matchMedia("(hover: hover)").matches);
    const synthetic = "arrastre con eventos de puntero sintéticos: el motor no ofrece gestos táctiles reales";

    await test("táctil · el contexto es un teléfono: puntero grueso, sin hover y 390 px sin desbordamiento", async () => {
      if (!coarse) throw new Unverifiable("el motor no emula (pointer: coarse) ni (hover: none)");
      const over = await tp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      ok(over <= 1, `desborda ${over}px con los controles a tamaño táctil`);
      await tp.screenshot({ path: join(shots, "touch-page.png"), fullPage: true });
    });

    await test("táctil · objetivos de 40 px o más en los controles principales", async () => {
      if (!coarse) throw new Unverifiable("sin (pointer: coarse) los controles conservan el tamaño de ratón");
      // Capas con controles propios: se abren para medirlas.
      const measure = (selectors) =>
        tp.evaluate(async (list) => {
          const MIN = 40;
          const small = [];
          let count = 0;
          for (const selector of list) {
            const seen = new Set();
            for (const el of document.querySelectorAll(selector)) {
              if (el.closest("[hidden], [inert], [aria-hidden=true]") || el.matches(":disabled, [data-disabled], [aria-disabled=true]"))
                continue;
              let r = el.getBoundingClientRect();
              if (!r.width || !r.height) continue;
              const key = `${Math.round(r.width)}x${Math.round(r.height)}`;
              if (seen.has(key)) continue; // un ejemplar por tamaño
              seen.add(key);
              count += 1;
              if (r.width >= MIN && r.height >= MIN) continue;
              // Más pequeño que el objetivo: su zona de pulsación (pseudo-elemento o etiqueta) debe cubrir 40 px.
              el.scrollIntoView({ block: "center", inline: "nearest" });
              await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
              r = el.getBoundingClientRect();
              const [cx, cy] = [r.left + r.width / 2, r.top + r.height / 2];
              const reach = MIN / 2 - 1;
              const points = [];
              if (r.height < MIN) points.push([cx, cy - reach], [cx, cy + reach]);
              if (r.width < MIN) points.push([cx - reach, cy], [cx + reach, cy]);
              const misses = points.filter(([x, y]) => {
                const hit = document.elementFromPoint(x, y);
                return !(hit && (el.contains(hit) || (hit.contains(el) && hit.matches("label"))));
              });
              if (misses.length) small.push(`${selector} ${key}`);
            }
          }
          return { count, small };
        }, selectors);
      const base = await measure([
        ".z-btn",
        ".z-toggle",
        ".z-segmented__item",
        ".z-input",
        ".z-textarea",
        ".z-select__control",
        ".z-tabs__tab",
        ".z-check",
        ".z-radio",
        ".z-switch",
        ".z-slider",
        ".z-accordion__trigger",
        ".z-pagination__btn",
        ".z-carousel__arrow",
        ".z-tree__row",
        ".z-navlink",
        ".z-rail__item",
        ".z-tabstrip__select",
        ".z-tabstrip__add",
        ".z-resize",
        ".z-split__divider",
        ".z-otp__cell",
      ]);
      ok(base.count >= 20, `solo se midieron ${base.count} controles`);
      ok(base.small.length === 0, `por debajo de 40 px: ${base.small.join(", ")}`);
      // Menú, modal y aviso abiertos con un toque.
      await finger.tap(mid(await boxOf(card("Menu").locator("[data-z-open]"))));
      await until(() => document.querySelector("#actions").matches(":popover-open"), "el toque no abrió el menú");
      const menu = await measure(["#actions .z-menu__item"]);
      ok(menu.count > 0 && menu.small.length === 0, `elementos de menú: ${menu.small.join(", ")}`);
      await tp.keyboard.press("Escape");
      await finger.tap(mid(await boxOf(card("Modal").locator("[data-z-open]"))));
      await until(() => document.querySelector("#edit-profile").open, "el toque no abrió el modal");
      await settle();
      const modal = await measure(["#edit-profile .z-overlay-close", "#edit-profile .z-btn", "#edit-profile .z-input"]);
      ok(modal.count > 0 && modal.small.length === 0, `controles del modal: ${modal.small.join(", ")}`);
      await tp.screenshot({ path: join(shots, "touch-modal.png") });
      // El cierre mide 28 px: un toque 16 px por debajo de su centro, ya fuera del dibujo, también cierra.
      const close = await tp.locator("#edit-profile .z-modal__close").boundingBox();
      await finger.tap({ x: close.x + close.width / 2, y: close.y + close.height / 2 + 16 });
      await until(() => !document.querySelector("#edit-profile").open, "un toque en el borde de la zona ampliada no cerró el modal");
      note(
        "no se exigen 40 px a controles secundarios densos: días de Calendar en contenedores estrechos, cierre de pestaña de TabStrip, quitar Chip, estrellas de Rating, copiar de CodeBlock, enlaces en línea y migas",
      );
    });

    await test("táctil · sin hover pegajoso: ninguna regla :hover se aplica sin (hover: hover)", async () => {
      // Estático, igual en los tres motores: cada regla con :hover vive bajo @media (hover: hover), o repite sin :hover el mismo estado.
      const loose = await tp.evaluate(() => {
        const out = [];
        const walk = (rules, guarded) => {
          for (const rule of rules) {
            const inMedia = guarded || (rule instanceof CSSMediaRule && /hover:\s*hover/.test(rule.conditionText));
            if (rule instanceof CSSStyleRule && rule.selectorText.includes(":hover") && !inMedia) {
              // Se admite `x[estado], x[estado]:hover`: el estado gana al hover, no añade estilo propio del hover.
              const parts = rule.selectorText.split(/,\s*(?![^()]*\))/);
              const plain = new Set(parts.filter((p) => !p.includes(":hover")).map((p) => p.trim()));
              const orphan = parts.filter((p) => p.includes(":hover") && ![...plain].some((q) => p.trim().startsWith(q)));
              if (orphan.length) out.push(orphan[0].trim());
            }
            if (rule.cssRules?.length) walk(rule.cssRules, inMedia);
          }
        };
        for (const sheet of document.styleSheets) if (/\/(zui|zout)\.css/.test(sheet.href ?? "")) walk(sheet.cssRules, false);
        return out;
      });
      ok(loose.length === 0, `reglas :hover fuera de @media (hover: hover): ${loose.slice(0, 6).join(" | ")}`);
      if (!coarse) throw new Unverifiable("el motor no emula (hover: none); solo se comprobó la hoja de estilos");
      if (browserName !== "chromium") {
        note("forzar :hover tras un toque solo es posible en Chromium (CSS.forcePseudoState); aquí se comprobó la hoja de estilos");
        return;
      }
      // Chromium: con :hover forzado (lo que deja un toque en un teléfono) el botón no cambia de aspecto.
      const button = card("Button").locator(".z-btn").first();
      await boxOf(button);
      const look = () =>
        button.evaluate((el) => {
          const s = getComputedStyle(el);
          return [s.backgroundColor, s.borderColor, s.color].join();
        });
      const before = await look();
      const cdp = await context.newCDPSession(tp);
      await cdp.send("DOM.enable");
      await cdp.send("CSS.enable");
      const { root } = await cdp.send("DOM.getDocument");
      const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector: '[data-component="Button"] .z-btn' });
      await cdp.send("CSS.forcePseudoState", { nodeId, forcedPseudoClasses: ["hover"] });
      await settle(250);
      ok(await button.evaluate((el) => el.matches(":hover")), "no se pudo forzar :hover");
      const after = await look();
      await cdp.send("CSS.forcePseudoState", { nodeId, forcedPseudoClasses: [] });
      await cdp.detach();
      ok(before === after, `el botón cambia con :hover en un dispositivo sin hover: ${before} → ${after}`);
    });

    await test("táctil · Carousel: arrastre con el dedo, inercia y desplazamiento vertical de la página", async () => {
      const vp = "#projects .z-carousel__viewport";
      ok(
        (await tp.locator(vp).evaluate((el) => getComputedStyle(el).touchAction)) === "pan-y",
        "el viewport debe declarar touch-action: pan-y",
      );
      const b = await boxOf("#projects");
      const y = b.y + b.height / 2;
      const state = () =>
        tp.evaluate(() => {
          const c = document.querySelector("#projects");
          return {
            x: new DOMMatrix(getComputedStyle(c.querySelector(".z-carousel__track")).transform).m41,
            active: c.querySelector(".z-carousel__slide[data-active] .z-card__title")?.textContent,
            scroll: scrollY,
            dragging: c.querySelector(".z-carousel__viewport").hasAttribute("data-dragging"),
          };
        });
      const rest = () => carouselAtRest(tp, "#projects");
      await rest();
      const start = await state();
      // Arrastre lento de 180 px con parada antes de soltar: sin inercia, la tira se ajusta al slide más cercano.
      await finger.swipe({ x: b.x + b.width * 0.8, y }, { x: b.x + b.width * 0.8 - 180, y }, { steps: 12, stepMs: 30, hold: 200 });
      await rest();
      const slow = await state();
      ok(slow.x < start.x - 1 && slow.active !== start.active, `el arrastre no cambió de slide: ${JSON.stringify([start, slow])}`);
      ok(!slow.dragging, "data-dragging no se limpió");
      ok(slow.scroll === start.scroll, "un arrastre horizontal no debe desplazar la página");
      // Lanzamiento: los mismos 180 px en unos 50 ms recorren más que el arrastre lento.
      await finger.swipe({ x: b.x + b.width * 0.8, y }, { x: b.x + b.width * 0.8 - 180, y }, { steps: 4, stepMs: 12 });
      await rest();
      const fling = await state();
      ok(
        slow.x - fling.x > start.x - slow.x + 20,
        `el lanzamiento no añadió inercia: lento ${Math.round(start.x - slow.x)} px, rápido ${Math.round(slow.x - fling.x)} px`,
      );
      // El botón del slide no se activa con el arrastre, y sí con un toque.
      const opened = () => tp.evaluate(() => window.__opened ?? null);
      await tp.evaluate(() =>
        document.querySelector("#projects").addEventListener("click", (e) => {
          const b = e.target.closest("[data-project]");
          if (b) window.__opened = b.dataset.project;
        }),
      );
      const button = await tp.locator("#projects .z-carousel__slide[data-active] [data-project]").boundingBox();
      await finger.swipe(mid(button), { x: mid(button).x - 80, y: mid(button).y }, { hold: 150 });
      await rest();
      ok((await opened()) === null, "arrastrar desde el botón de un slide lo activó");
      await settle(500); // Chromium anula el toque que llega justo después de un lanzamiento
      const target = await tp.locator("#projects .z-carousel__slide[data-active] [data-project]").boundingBox();
      await finger.tap(mid(target));
      await until(() => window.__opened, "un toque en el botón del slide activo no lo activó");
      if (!finger.real) {
        note(`${synthetic}; el desplazamiento vertical nativo sobre el carrusel no se pudo comprobar (touch-action calculado: pan-y)`);
        return;
      }
      // Gesto vertical que empieza sobre el carrusel: la página se desplaza y la tira no se mueve.
      const again = await boxOf("#projects");
      const before = await state();
      await finger.swipe(
        { x: again.x + again.width / 2, y: again.y + again.height / 2 },
        { x: again.x + again.width / 2 + 6, y: again.y + again.height / 2 - 220 },
        { steps: 10 },
      );
      await settle(500);
      const scrolled = await state();
      ok(scrolled.scroll > before.scroll + 100, `el carrusel bloquea el desplazamiento vertical: ${before.scroll} → ${scrolled.scroll}`);
      ok(Math.abs(scrolled.x - before.x) < 2 && scrolled.active === before.active && !scrolled.dragging, "un gesto vertical movió la tira");
    });

    await test("táctil · Toast: deslizar para descartar; un gesto corto o vertical lo conserva", async () => {
      await finger.tap(mid(await boxOf("#save")));
      await until(() => document.querySelectorAll(".z-toast").length === 1, "el toque no mostró el aviso");
      await settle();
      ok(
        (await tp.locator(".z-toast").evaluate((el) => getComputedStyle(el).touchAction)) === "pan-y",
        "el aviso debe declarar touch-action: pan-y",
      );
      const b = await tp.locator(".z-toast").boundingBox();
      const from = { x: b.x + 80, y: b.y + b.height / 2 };
      await finger.swipe(from, { x: from.x + 30, y: from.y });
      await settle();
      ok(
        (await tp.locator(".z-toast").count()) === 1 && (await tp.locator(".z-toast").getAttribute("data-swipe")) === "cancel",
        "30 px no deben descartar",
      );
      ok(Math.abs((await tp.locator(".z-toast").boundingBox()).x - b.x) < 1, "tras cancelar no volvió a su sitio");
      await finger.swipe(from, { x: from.x - 120, y: from.y });
      await settle();
      ok((await tp.locator(".z-toast").count()) === 1, "deslizar hacia la izquierda no debe descartar");
      // A medio gesto el aviso sigue al dedo.
      await finger.down(from);
      for (const dx of [20, 40, 60, 80]) {
        await finger.move({ x: from.x + dx, y: from.y });
        await settle(20);
      }
      const moving = await tp
        .locator(".z-toast")
        .evaluate((el) => [el.dataset.swipe, Math.round(new DOMMatrix(getComputedStyle(el).transform).m41)]);
      ok(moving[0] === "move" && moving[1] >= 60, `el aviso no sigue al dedo: ${moving}`);
      for (const dx of [110, 140]) {
        await finger.move({ x: from.x + dx, y: from.y });
        await settle(20);
      }
      await finger.up();
      await until(() => document.querySelectorAll(".z-toast").length === 0, "deslizar 140 px a la derecha no descartó el aviso");
      // Un aviso nuevo se descarta con un toque en su botón de cierre. La espera es del navegador, no de la suite:
      // Chromium anula el toque que llega en los ~300 ms siguientes a un lanzamiento (lo toma por "parar la inercia").
      await settle(500);
      await finger.tap(mid(await boxOf("#save")));
      await until(() => document.querySelectorAll(".z-toast").length === 1, "no apareció el segundo aviso");
      await settle();
      await finger.tap(mid(await tp.locator(".z-toast__close").boundingBox()));
      await until(() => document.querySelectorAll(".z-toast").length === 0, "un toque en el cierre no descartó el aviso");
      if (!finger.real) note(synthetic);
    });

    await test("táctil · ContextMenu: pulsación larga abre en el dedo y sigue abierto al levantarlo", async () => {
      const zone = card("ContextMenu").locator("[data-z-context]");
      const b = await boxOf(zone);
      const point = { x: b.x + 30, y: b.y + b.height / 2 };
      const open = () => tp.locator("#file-menu").evaluate((el) => el.matches(":popover-open"));
      // Un toque corto no abre.
      await finger.tap(point);
      await settle(200);
      ok(!(await open()), "un toque corto abrió el menú contextual");
      // Mover el dedo antes de tiempo cancela la pulsación larga.
      await finger.down(point);
      await settle(200);
      await finger.move({ x: point.x + 30, y: point.y });
      await settle(700);
      await finger.up();
      ok(!(await open()), "arrastrar no debe abrir el menú contextual");
      let during = false;
      await finger.press(point, 900, async () => {
        during = await open();
      });
      ok(during, "tras 900 ms con el dedo quieto el menú no abrió");
      await settle();
      ok(await open(), "el menú se cerró al levantar el dedo");
      const m = await tp.locator("#file-menu").boundingBox();
      const size = tp.viewportSize();
      ok(Math.abs(m.x - point.x) < 8 || m.x + m.width > size.width - 12, `el menú no nace en el dedo: ${JSON.stringify(m)}`);
      ok(m.x >= 0 && m.x + m.width <= size.width + 1, "el menú se sale de la ventana");
      await tp.screenshot({ path: join(shots, "touch-context-menu.png") });
      // Un toque en un elemento lo ejecuta y cierra; otro abierto se cierra tocando fuera.
      await finger.tap(mid(await tp.locator("#file-menu .z-menu__item").first().boundingBox()));
      await until(() => !document.querySelector("#file-menu").matches(":popover-open"), "tocar un elemento no cerró el menú");
      await finger.press(point, 900);
      await settle();
      ok(await open(), "la segunda pulsación larga no abrió");
      await finger.tap({ x: 8, y: point.y + 120 });
      await until(() => !document.querySelector("#file-menu").matches(":popover-open"), "tocar fuera no cerró el menú");
      if (!finger.real)
        note("pulsación larga con eventos de puntero sintéticos; el `contextmenu` nativo de la plataforma (Android) no se emula");
    });

    await test("táctil · Slider: se arrastra con el dedo y un toque en la pista mueve el tirador", async () => {
      const b = await boxOf("#volume");
      ok(
        (await tp.locator("#volume").evaluate((el) => getComputedStyle(el).touchAction)) === "none",
        "el Slider debe declarar touch-action: none",
      );
      const value = () => tp.locator("#volume [role=slider]").getAttribute("aria-valuenow");
      const y = b.y + b.height / 2;
      const scroll = await tp.evaluate(() => scrollY);
      await finger.tap({ x: b.x + b.width * 0.8, y });
      await until(
        () => document.querySelector("#volume [role=slider]").getAttribute("aria-valuenow") === "80",
        "el toque en el 80 % de la pista no movió el tirador",
      );
      // Arrastre desde el tirador con desvío vertical: sigue al dedo y la página no se desplaza.
      const thumb = mid(await tp.locator("#volume [role=slider]").boundingBox());
      await finger.swipe(thumb, { x: b.x + b.width * 0.25, y: y + 40 }, { steps: 10 });
      ok((await value()) === "25", `arrastrar al 25 %: ${await value()}`);
      ok((await tp.locator('#volume input[type="hidden"]').inputValue()) === "25", "el campo oculto no sigue al valor");
      ok((await tp.evaluate(() => scrollY)) === scroll, "arrastrar el Slider desplazó la página");
      // Toque a 3 px del borde del control: lejos del tirador de 18 px, dentro de la franja táctil de 40 px.
      if (coarse) {
        ok(b.height >= 40, `franja táctil del Slider de ${b.height} px`);
        await finger.tap({ x: b.x + b.width * 0.5, y: b.y + 3 });
        await until(
          () => document.querySelector("#volume [role=slider]").getAttribute("aria-valuenow") === "50",
          "un toque en la zona táctil ampliada de la pista no movió el tirador",
        );
      }
      if (!finger.real) note(synthetic);
    });

    await test("táctil · SplitPane y ResizeHandle: los divisores se arrastran con el dedo", async () => {
      for (const selector of ["#resize-demo > .z-resize", "#split-demo > .z-split__divider"])
        ok(
          (await tp.locator(selector).evaluate((el) => getComputedStyle(el).touchAction)) === "none",
          `${selector} debe declarar touch-action: none`,
        );
      const width = (selector) => tp.locator(selector).evaluate((el) => Math.round(el.getBoundingClientRect().width));
      // ResizeHandle: 240 → 280 con 40 px de arrastre; el dedo se desvía en vertical sin que la página se mueva.
      let b = await boxOf("#resize-demo > .z-resize");
      const scroll = await tp.evaluate(() => scrollY);
      ok((await width("#resize-demo")) === 240, `ancho inicial ${await width("#resize-demo")}`);
      await finger.swipe(mid(b), { x: mid(b).x + 40, y: mid(b).y + 30 });
      ok((await width("#resize-demo")) === 280, `arrastrar 40 px: ${await width("#resize-demo")}`);
      ok((await tp.evaluate(() => scrollY)) === scroll, "arrastrar el tirador desplazó la página");
      // Agarrado 14 px a la derecha del tirador (12 px de ancho): la zona táctil ampliada también arrastra.
      if (coarse) {
        b = await boxOf("#resize-demo > .z-resize");
        const grab = { x: b.x + b.width / 2 + 14, y: mid(b).y };
        await finger.swipe(grab, { x: grab.x - 40, y: grab.y });
        ok((await width("#resize-demo")) === 240, `agarrar por la zona ampliada: ${await width("#resize-demo")}`);
      }
      // SplitPane en los dos ejes.
      const first = "#split-demo > .z-split__pane:first-child";
      b = await boxOf("#split-demo > .z-split__divider");
      const before = await width(first);
      const grab = coarse ? { x: mid(b).x + 14, y: mid(b).y } : mid(b);
      await finger.swipe(grab, { x: grab.x + 30, y: grab.y });
      ok(Math.abs((await width(first)) - before - 30) <= 2, `divisor vertical: ${before} → ${await width(first)}`);
      ok(
        await tp.locator("#split-demo > .z-split__divider").evaluate((el) => !el.hasAttribute("data-dragging")),
        "data-dragging no se limpió",
      );
      const top = "#split-demo .z-split[data-direction=column] > .z-split__pane:first-child";
      const height = () => tp.locator(top).evaluate((el) => Math.round(el.getBoundingClientRect().height));
      const d = await boxOf("#split-demo .z-split[data-direction=column] > .z-split__divider");
      const h = await height();
      await finger.swipe(mid(d), { x: mid(d).x, y: mid(d).y - 30 });
      ok(Math.abs(h - (await height()) - 30) <= 2, `divisor horizontal: ${h} → ${await height()}`);
      if (!finger.real) note(synthetic);
    });

    await test("táctil · controles básicos responden a un toque: Tabs, Switch, Checkbox, Accordion, Select", async () => {
      const tab = card("Tabs").locator(".z-tabs__tab").nth(1);
      await finger.tap(mid(await boxOf(tab)));
      ok((await tab.getAttribute("aria-selected")) === "true", "Tabs");
      for (const [name, selector, attr] of [
        ["Switch", '[role="switch"]', "aria-checked"],
        ["Checkbox", '[role="checkbox"]', "aria-checked"],
      ]) {
        const el = card(name).locator(selector).first();
        const before = await el.getAttribute(attr);
        await finger.tap(mid(await boxOf(el)));
        ok((await el.getAttribute(attr)) !== before, `${name} no cambió con un toque`);
      }
      const item = card("Accordion").locator(".z-accordion__item").nth(1);
      await finger.tap(mid(await boxOf(item.locator(".z-accordion__trigger"))));
      await settle();
      ok(await item.locator(".z-accordion__content").evaluate((el) => !el.hidden), "Accordion");
      const control = card("Select").locator(".z-select__control").first();
      await finger.tap(mid(await boxOf(control)));
      await settle();
      ok((await control.getAttribute("aria-expanded")) === "true", "el toque no abrió el Select");
      const option = tp.locator(".z-listbox__option:visible:not([aria-disabled=true]):not([aria-selected=true])").first();
      const label = (await option.textContent()).trim();
      await finger.tap(mid(await option.boundingBox()));
      await settle();
      ok(
        (await control.getAttribute("aria-expanded")) === "false" && (await control.textContent()).includes(label),
        `el toque no eligió "${label}"`,
      );
    });

    /* ───────────── Aplicación completa (shell.html) ───────────── */

    await tp.goto(new URL("shell.html", home).href);
    await tp.waitForFunction(() => customElements.get("z-icon"));
    await test("táctil · Shell: los cajones se abren con un toque y se cierran tocando el velo", async () => {
      const side = ".z-shell__side";
      const inspector = ".z-shell__inspector";
      await until(() => document.querySelector(".z-shell__side").hidden, "a 390 px la sidebar debe empezar cerrada");
      const toggle = await tp.locator("#toggle-sidebar").boundingBox();
      if (coarse) ok(toggle.width >= 40 && toggle.height >= 40, `botón de la barra de título de ${toggle.width}×${toggle.height}`);
      await finger.tap(mid(toggle));
      await until(
        () => document.querySelector(".z-shell__side.z-shell__drawer[role=dialog]") && document.querySelector(".z-shell__scrim"),
        "el toque no abrió el cajón de la sidebar",
      );
      await rested(side, "el cajón de la sidebar");
      await rested(".z-shell__scrim", "el velo");
      const b = await tp.locator(side).boundingBox();
      const size = tp.viewportSize();
      ok(b.x >= 0 && b.x + b.width <= size.width && b.width < size.width - 40, `el cajón no deja velo que tocar: ${JSON.stringify(b)}`);
      await tp.screenshot({ path: join(shots, "touch-shell-sidebar.png") });
      // Un arrastre vertical dentro del cajón no lo cierra.
      await finger.swipe({ x: b.x + b.width / 2, y: b.y + b.height * 0.6 }, { x: b.x + b.width / 2, y: b.y + b.height * 0.3 });
      ok((await tp.locator(`${side}.z-shell__drawer`).count()) === 1, "desplazar dentro del cajón lo cerró");
      await finger.tap({ x: size.width - 16, y: size.height / 2 });
      await until(
        () => !document.querySelector(".z-shell__drawer") && !document.querySelector(".z-shell__scrim"),
        "tocar el velo no cerró el cajón",
      );
      await finger.tap(mid(await tp.locator("#toggle-inspector").boundingBox()));
      await until(() => document.querySelector(".z-shell__inspector.z-shell__drawer"), "el toque no abrió el cajón del inspector");
      await rested(inspector, "el cajón del inspector");
      const i = await tp.locator(inspector).boundingBox();
      ok(i.x >= 0 && i.x + i.width <= size.width + 1, `el inspector se sale de la ventana: ${JSON.stringify(i)}`);
      await finger.tap(mid(await tp.locator("#close-inspector").boundingBox()));
      await until(() => !document.querySelector(".z-shell__drawer"), "el botón de cierre del inspector no respondió al toque");
      ok(
        await tp.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1),
        "shell.html desborda a 390 px con tamaños táctiles",
      );
    });

    await test("táctil · sin errores de consola", async () => ok(problems.length === 0, problems.slice(0, 5).join(" | ")));
  } finally {
    await context.close();
  }
}
