// Sin React: NotificationCenter, FilterBar, ReviewCard, la rejilla ordenable de FileUpload y el marcado de
// ReviewSummary, PriceBreakdown, PriceTag, NotificationBadge y Container, desde el contrato de zui/html.json y
// zout/html.json.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const zui = JSON.parse(readFileSync(join(here, "../../../zui/html.json"), "utf8")).components;
const zout = JSON.parse(readFileSync(join(here, "../../../zout/html.json"), "utf8")).components;

export default async function ({ page, test, ok }) {
  let seq = 0;
  const inject = async (raw, width = "min(1100px, 100vw)") => {
    const id = `ls-${++seq}`;
    const html = raw.replace(/(?<![\w-])id="([^"]+)"/g, `id="$1-${id}"`).replace(
      /\b(aria-controls|aria-describedby|aria-labelledby)="([^"]+)"/g,
      (_, a, v) =>
        `${a}="${v
          .split(/\s+/)
          .map((x) => `${x}-${id}`)
          .join(" ")}"`,
    );
    await page.evaluate(
      async ([markup, wrap, w]) => {
        for (const old of document.querySelectorAll("[data-ls-layer]")) old.remove();
        const box = document.createElement("div");
        box.id = wrap;
        box.setAttribute("data-z-dom", "");
        box.setAttribute("data-ls-layer", "");
        box.innerHTML = markup;
        Object.assign(box.style, {
          position: "fixed",
          insetBlockStart: "0",
          insetInlineStart: "0",
          zIndex: "2147483000",
          inlineSize: w,
          maxBlockSize: "100vh",
          overflow: "auto",
          padding: "24px",
          background: "Canvas",
        });
        document.querySelector(".page__main").append(box);
        window.__ls = [];
        for (const type of ["z:readchange", "z:readall", "z:action", "z:openchange", "z:change", "z:reorder", "z:cover", "z:photoselect"])
          box.addEventListener(type, (event) =>
            window.__ls.push([type, JSON.parse(JSON.stringify(event.detail ?? null, (_k, v) => (v instanceof File ? v.name : v)))]),
          );
        (await import("/zui/dist/zui.dom.js")).hydrate(box);
      },
      [html, id, width],
    );
    return page.locator(`#${id}`);
  };
  const ui = (name, i = 0) => zui[name].examples[i].html;
  const events = () => page.evaluate(() => window.__ls.splice(0));
  const said = () =>
    page.evaluate(() =>
      [...document.querySelectorAll("[data-z-announcer] [aria-live], [data-live]")].map((el) => el.textContent).join(" | "),
    );
  const until = async (fn, message, tries = 80) => {
    for (let i = 0; i < tries; i++) {
      if (await fn()) return;
      await page.waitForTimeout(50);
    }
    ok(false, message);
  };

  await test("Listing · NotificationCenter sin React: campana con recuento, panel por días, marcar leído, todo y Escape", async () => {
    const box = await inject(ui("NotificationCenter"));
    const bell = box.locator(".z-notification-center__trigger");
    ok((await bell.getAttribute("aria-label")) === "Notifications, 2 unread", `nombre: ${await bell.getAttribute("aria-label")}`);
    await bell.click();
    const panel = box.locator(".z-notification-center__panel");
    await until(() => panel.evaluate((el) => el.matches(":popover-open")), "el panel se abre");
    await until(async () => (await bell.getAttribute("aria-expanded")) === "true", "aria-expanded");
    ok(
      (await panel.locator(".z-notification-center__day").allTextContents()).join(",") === "Today,Yesterday,Wednesday 18 November",
      "días",
    );
    await panel.locator('[data-toggle="n1"]').click();
    await until(async () => (await bell.getAttribute("aria-label")) === "Notifications, 1 unread", "marcar uno");
    await panel.locator('[data-action="retry"]').click();
    await panel.locator("[data-read-all]").click();
    await until(async () => (await bell.getAttribute("aria-label")) === "Notifications", "marcar todo");
    await until(async () => /All notifications marked as read/.test(await said()), "anuncio de marcar todo");
    const got = (await events()).map(([type, detail]) => `${type}:${JSON.stringify(detail)}`);
    ok(
      got.includes('z:readchange:{"id":"n1","read":true}') &&
        got.includes('z:action:{"id":"n4","action":"retry"}') &&
        got.includes('z:readall:{"ids":["n2"]}'),
      `eventos: ${got}`,
    );
    await page.keyboard.press("Escape");
    await until(() => panel.evaluate((el) => !el.matches(":popover-open")), "Escape cierra");
    await until(
      () => page.evaluate(() => document.activeElement?.classList.contains("z-notification-center__trigger")),
      "el foco vuelve a la campana",
    );
    // Un aviso nuevo por propiedad: se cuenta y se anuncia.
    await page.evaluate(
      async (sel) => {
        const el = document.querySelector(sel);
        const { setWidgetProps } = await import("/zui/dist/zui.dom.js");
        setWidgetProps(el, { notifications: [{ id: "x", title: "Message from Yuki", time: "2026-11-23T11:59:00Z" }] });
      },
      `#${await box.getAttribute("id")} .z-notification-center`,
    );
    await until(async () => (await bell.getAttribute("aria-label")) === "Notifications, 1 unread", "aviso nuevo contado");
    await until(async () => /New notification: Message from Yuki/.test(await said()), "aviso nuevo anunciado");
    const empty = await inject(ui("NotificationCenter", 1));
    await empty.locator(".z-notification-center__trigger").click();
    await until(async () => (await empty.locator(".z-notification-center__empty-title").textContent()) === "You're all caught up", "vacío");
    await page.keyboard.press("Escape");
  });

  await test("Listing · FilterBar sin React: interruptor, menú con casillas, recuento, Clear y borde difuminado", async () => {
    const box = await inject(ui("FilterBar"), "360px");
    const bar = box.locator(".z-filter-bar");
    const desc = async () => box.locator(`#${await bar.getAttribute("aria-describedby")}`).textContent();
    ok((await desc()) === "2 filters active", `recuento: ${await desc()}`);
    ok((await bar.locator('[data-filter="type"] .z-chip__count').textContent()) === "Entire home", "el chip dice la opción");
    const scroller = bar.locator(".z-filter-bar__scroller");
    await until(async () => (await scroller.getAttribute("data-scroll-edges")) === "end", "al principio, solo se difumina el final");
    await bar.locator('[data-toggle="pets"]').click();
    await until(async () => (await desc()) === "3 filters active", "interruptor");
    const chip = bar.locator('[data-filter="type"] .z-chip__main');
    await chip.click();
    const menu = box.locator('.z-filter-bar__menu[data-filter="type"]');
    await until(() => menu.evaluate((el) => el.matches(":popover-open")), "el menú se abre");
    await menu.locator('input[value="room"]').check();
    await until(async () => (await bar.locator('[data-filter="type"] .z-chip__count').textContent()) === "2", "dos opciones");
    ok(await menu.locator('input[value="entire"]').isChecked(), "la primera sigue marcada");
    await page.keyboard.press("Escape");
    await until(
      () => page.evaluate(() => document.activeElement?.closest('[data-filter="type"]') !== null),
      "Escape devuelve el foco al chip",
    );
    await until(async () => /3 filters active/.test(await said()), "recuento anunciado");
    await bar.locator("[data-clear]").click();
    await until(async () => (await desc()) === "No filters active", "Clear");
    ok((await bar.locator("[data-clear]").count()) === 0, "Clear desaparece");
    const last = (await events()).filter(([t]) => t === "z:change").pop();
    ok(JSON.stringify(last?.[1]) === '{"value":{},"id":""}', `z:change: ${JSON.stringify(last)}`);
  });

  await test("Listing · ReviewCard sin React: Read more, Show less y búsqueda en la página; resumen y precios", async () => {
    const box = await inject(
      `${ui("ReviewCard")}${ui("ReviewSummary")}${ui("PriceBreakdown")}${ui("PriceTag")}${ui("NotificationBadge")}${zout.Container.examples[0].html}`,
    );
    const card = box.locator(".z-review-card").first();
    const more = card.locator(".z-review-card__more");
    const rest = card.locator(".z-review-card__rest");
    ok(!(await rest.isVisible()), "plegado");
    await more.click();
    ok((await more.getAttribute("aria-expanded")) === "true" && (await more.textContent()) === "Show less", "desplegado");
    ok(await rest.isVisible(), "el resto se ve");
    await more.click();
    ok(!(await rest.isVisible()), "pliega otra vez");
    const supported = await page.evaluate(() => "onbeforematch" in HTMLElement.prototype);
    if (supported) {
      await rest.evaluate((el) => el.dispatchEvent(new Event("beforematch", { bubbles: true })));
      ok((await card.getAttribute("data-state")) === "open", "beforematch abre");
    }
    await card.locator('button.z-review-card__photo[data-index="1"]').click();
    ok(
      (await events()).some(([t, d]) => t === "z:photoselect" && d.index === 1),
      "z:photoselect",
    );
    ok((await box.locator(".z-review-summary__row .z-sr-only").first().textContent()) === "5 stars: 873 reviews, 68%", "barra hablada");
    ok((await box.locator(".z-summary__row[data-total] .z-summary__value").first().textContent())?.trim() === "€416.97", "total");
    ok((await box.locator(".z-price__previous .z-sr-only").textContent()) === "Previous price: ", "anterior con prefijo");
    ok((await box.locator(".z-notification-badge .z-sr-only").first().textContent()) === "12 unread", "contador hablado");
    const pad = await box.locator(".z-container").evaluate((el) => getComputedStyle(el).paddingInlineStart);
    ok(Number.parseFloat(pad) >= 16 && Number.parseFloat(pad) <= 40, `margen fluido: ${pad}`);
  });

  await test("Listing · FileUpload en rejilla sin React: miniaturas, teclado con anuncio, Escape, portada y quitar", async () => {
    const box = await inject(ui("FileUpload", 2));
    const zone = box.locator(".z-upload");
    const png = (name) => ({
      name,
      mimeType: "image/png",
      buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"),
    });
    await zone.locator(".z-upload__input").setInputFiles([png("a.png"), png("b.png"), png("c.png")]);
    const names = () => zone.locator(".z-upload__tile-name").allTextContents();
    await until(async () => (await names()).join(",") === "a.png,b.png,c.png", "tres casillas");
    ok((await zone.locator('.z-upload__tile[data-index="0"] .z-upload__cover').textContent()) === "Cover", "portada");
    await until(async () => (await zone.locator(".z-upload__preview canvas").count()) === 3, "miniaturas en lienzo");
    // Añadir más suma (rejilla con multiple).
    await zone.locator(".z-upload__input").setInputFiles([png("d.png")]);
    await until(async () => (await names()).length === 4, "lo elegido se suma");
    const handle = (i) => zone.locator(`.z-upload__tile[data-index="${i}"] .z-upload__handle`);
    await handle(0).focus();
    await page.keyboard.press("Space");
    await until(async () => (await handle(0).getAttribute("aria-pressed")) === "true", "coger");
    await until(async () => /a.png picked up/.test(await said()), "anuncio al coger");
    await page.keyboard.press("ArrowRight");
    await until(async () => (await names()).join(",") === "b.png,a.png,c.png,d.png", "mover");
    await until(
      () => page.evaluate(() => document.activeElement?.closest(".z-upload__tile")?.textContent?.includes("a.png")),
      "el foco sigue al asa",
    );
    await page.keyboard.press("Space");
    await until(async () => (await events()).some(([t, d]) => t === "z:reorder" && d.from === 0 && d.to === 1), "z:reorder al soltar");
    await until(async () => /dropped at position 2 of 4/.test(await said()), "anuncio al soltar");
    await handle(1).focus();
    await page.keyboard.press("Enter");
    await page.keyboard.press("End");
    await page.keyboard.press("Escape");
    await until(async () => (await names()).join(",") === "b.png,a.png,c.png,d.png", "Escape restaura");
    await zone.locator('.z-upload__tile[data-index="2"] .z-upload__make-cover').click();
    await until(async () => (await names())[0] === "c.png", "portada nueva");
    ok(
      (await events()).some(([t, d]) => t === "z:cover" && d.file === "c.png"),
      "z:cover",
    );
    await zone.locator('.z-upload__tile[data-index="3"] .z-upload__remove').click();
    await until(async () => (await names()).length === 3, "quitar");
    const files = await zone.locator(".z-upload__input").evaluate((el) => [...el.files].map((f) => f.name).join(","));
    ok(files === "c.png,b.png,a.png", `el campo sigue el orden: ${files}`);
  });
}
