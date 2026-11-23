// Binding de React de las piezas de la pantalla `listing` de examples/app: NotificationCenter (abrir, marcar leído,
// marcar todo, acción, Escape devuelve el foco), FilterBar (interruptor, menú con casillas, Clear y recuento),
// ReviewCard (Read more), PriceBreakdown y la rejilla ordenable de FileUpload (teclado, Escape, puntero y portada).
export default function ({ t, assert, poll, visible, gone }) {
  const said = (page) =>
    page.evaluate(() =>
      [...document.querySelectorAll("[data-z-announcer] [aria-live], [data-live]")].map((el) => el.textContent).join(" | "),
    );
  const order = (page) =>
    page
      .locator(`${t("ls-photos")} .z-upload__tile .z-upload__tile-name`)
      .evaluateAll((els) => els.map((el) => el.textContent?.replace(".png", "")));
  const photos = async (page) => {
    await poll(async () => (await page.locator(`${t("ls-photos")} .z-upload__tile`).count()) === 5, "cinco fotos de ejemplo");
  };

  return [
    {
      name: "NotificationCenter (React): campana con recuento, panel por días, marcar leído, acción, marcar todo y Escape",
      async run({ open, shot }) {
        const page = await open("listing");
        const bell = page.locator(`${t("ls-notifications")} .z-notification-center__trigger`);
        assert((await bell.getAttribute("aria-label")) === "Notifications, 2 unread", `nombre: ${await bell.getAttribute("aria-label")}`);
        assert((await bell.getAttribute("aria-expanded")) === "false", "cerrado");
        await bell.click();
        const panel = page.locator(".z-notification-center__panel:popover-open");
        await visible(page, ".z-notification-center__panel:popover-open");
        await poll(async () => (await bell.getAttribute("aria-expanded")) === "true", "aria-expanded al abrir");
        await poll(
          () => page.evaluate(() => document.activeElement?.classList.contains("z-notification-center__panel")),
          "el foco pasa al panel",
        );
        const days = await panel.locator(".z-notification-center__day").allTextContents();
        assert(days[0] === "Today" && days[1] === "Yesterday" && days.length === 3, `días: ${days}`);
        const box = await panel.boundingBox();
        const anchor = await bell.boundingBox();
        assert(box && anchor && box.y >= anchor.y + anchor.height - 1, "el panel se abre bajo la campana");
        await shot(page, "listing-notifications");
        await panel.locator('[data-toggle="n2"]').click();
        await poll(async () => (await bell.getAttribute("aria-label")) === "Notifications, 1 unread", "marcar uno como leído");
        assert((await page.locator(t("ls-badge")).textContent())?.includes("1"), "la aplicación recibe onReadChange");
        await panel.locator('[data-action="view"]').click();
        await poll(async () => (await page.locator(t("ls-log")).textContent()) === "view:n1", "onAction");
        await panel.locator("[data-read-all]").click();
        await poll(async () => (await bell.getAttribute("aria-label")) === "Notifications", "marcar todo");
        await poll(async () => /All notifications marked as read/.test(await said(page)), "se anuncia marcar todo");
        assert((await panel.locator("[data-read-all]").getAttribute("aria-disabled")) === "true", "sin pendientes, aria-disabled");
        await page.keyboard.press("Escape");
        await gone(page, ".z-notification-center__panel:popover-open");
        await poll(
          () => page.evaluate(() => document.activeElement?.classList.contains("z-notification-center__trigger")),
          "Escape devuelve el foco a la campana",
        );
        await poll(async () => (await bell.getAttribute("aria-expanded")) === "false", "aria-expanded al cerrar");
      },
    },
    {
      name: "FilterBar (React): interruptor, menú con opción única, recuento anunciado, Clear con el foco en el primer chip",
      async run({ open }) {
        const page = await open("listing");
        const bar = `${t("ls-filters")} .z-filter-bar`;
        const desc = async () => page.locator(`#${await page.locator(bar).getAttribute("aria-describedby")}`).textContent();
        assert((await desc()) === "1 filter active", `recuento inicial: ${await desc()}`);
        await page.locator(`${bar} [data-toggle="pets"]`).click();
        assert((await page.locator(`${bar} [data-toggle="pets"]`).getAttribute("aria-pressed")) === "true", "aria-pressed");
        await poll(
          async () => (await page.locator(t("ls-stay-s2")).count()) === 1 && (await page.locator(t("ls-stay-s1")).count()) === 0,
          "filtra la lista",
        );
        const price = page.locator(`${bar} [data-filter="price"] .z-chip__main`);
        await price.click();
        await visible(page, '.z-filter-bar__menu[data-filter="price"]:popover-open');
        await poll(
          () => page.evaluate(() => document.activeElement?.matches('.z-filter-bar__menu[data-filter="price"] input')),
          "foco en la primera opción",
        );
        await page.keyboard.press("ArrowDown");
        await poll(
          async () => (await price.locator(".z-chip__count").textContent()) === "€100–€200",
          "la flecha elige la siguiente opción y el chip la dice",
        );
        await page.keyboard.press("Escape");
        await gone(page, ".z-filter-bar__menu:popover-open");
        await poll(
          () => page.evaluate(() => document.activeElement?.closest('[data-filter="price"]') !== null),
          "Escape devuelve el foco al chip",
        );
        await poll(async () => (await desc()) === "3 filters active", "tres activos");
        await poll(async () => /3 filters active/.test(await said(page)), "el recuento se anuncia");
        await page.locator(`${bar} [data-clear]`).click();
        await poll(async () => (await page.locator(`${bar} [data-clear]`).count()) === 0, "Clear desaparece");
        await poll(
          () => page.evaluate((s) => document.activeElement === document.querySelector(`${s} .z-chip__main`), bar),
          "el foco pasa al primer chip",
        );
        assert((await desc()) === "No filters active", "sin filtros");
      },
    },
    {
      name: "FilterBar (React): en un teléfono la fila desplaza en horizontal y difumina solo el borde con chips ocultos",
      async run({ open }) {
        const page = await open("listing", { width: 390, height: 844 });
        const scroller = page.locator(`${t("ls-filters")} .z-filter-bar__scroller`);
        await scroller.scrollIntoViewIfNeeded();
        await poll(async () => (await scroller.getAttribute("data-scroll-edges")) === "end", "al principio, solo el final");
        await scroller.evaluate((el) => el.scrollTo({ left: el.scrollWidth }));
        await poll(async () => (await scroller.getAttribute("data-scroll-edges")) === "start", "al final, solo el principio");
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        assert(overflow <= 0, `sin desbordamiento horizontal de la página: ${overflow}`);
      },
    },
    {
      name: "ReviewCard y PriceBreakdown (React): Read more despliega con aria-expanded y el total cuadra",
      async run({ open }) {
        const page = await open("listing");
        const card = page.locator(t("ls-review"));
        const more = card.locator(".z-review-card__more");
        await more.scrollIntoViewIfNeeded();
        const supported = await page.evaluate(() => "onbeforematch" in HTMLElement.prototype);
        assert(
          (await card.locator(".z-review-card__rest").getAttribute("hidden")) === (supported ? "until-found" : ""),
          "plegado (until-found donde lo hay)",
        );
        assert(!(await card.locator(".z-review-card__rest").isVisible()), "el resto plegado no se ve");
        await more.click();
        assert((await more.getAttribute("aria-expanded")) === "true", "aria-expanded");
        assert((await more.textContent()) === "Show less", "texto del botón");
        assert(await card.locator(".z-review-card__rest").isVisible(), "el resto se ve");
        const total = await page.locator(`${t("ls-price")} .z-summary__row[data-total] .z-summary__value`).textContent();
        assert(total === "€416.97", `total: ${total}`);
        const bars = await page.locator(`${t("ls-summary")} .z-review-summary__row .z-sr-only`).allTextContents();
        assert(bars[0] === "5 stars: 873 reviews, 68%", `barra: ${bars[0]}`);
      },
    },
    {
      name: "FileUpload en rejilla (React): Espacio coge, flechas mueven, Espacio suelta; Escape cancela; con anuncios",
      async run({ open, shot }) {
        const page = await open("listing");
        await photos(page);
        const handle = (i) => page.locator(`${t("ls-photos")} .z-upload__tile[data-index="${i}"] .z-upload__handle`);
        await handle(0).scrollIntoViewIfNeeded();
        assert(
          (await page.locator(`${t("ls-photos")} .z-upload__tile[data-index="0"] .z-upload__cover`).textContent()) === "Cover",
          "portada",
        );
        await handle(0).focus();
        await page.keyboard.press("Space");
        await poll(async () => (await handle(0).getAttribute("aria-pressed")) === "true", "aria-pressed al coger");
        await poll(async () => /living-room.png picked up\. Position 1 of 5/.test(await said(page)), "anuncio al coger");
        await page.keyboard.press("ArrowRight");
        await poll(async () => (await order(page)).join(",") === "kitchen,living-room,bedroom,terrace,view", "la flecha mueve");
        await poll(
          () => page.evaluate(() => document.activeElement?.closest(".z-upload__tile")?.textContent?.includes("living-room")),
          "el foco sigue en el asa movida",
        );
        await page.keyboard.press("ArrowDown");
        await shot(page, "listing-photos-grabbed");
        await page.keyboard.press("Space");
        await poll(async () => /^order:/.test((await page.locator(t("ls-log")).textContent()) ?? ""), "onReorder al soltar");
        const after = await order(page);
        assert(after.indexOf("living-room") > 1, `abajo una fila: ${after}`);
        await poll(async () => /dropped at position/.test(await said(page)), "anuncio al soltar");
        // Escape devuelve la foto a su sitio sin avisar a la aplicación.
        const before = (await order(page)).join(",");
        const log = await page.locator(t("ls-log")).textContent();
        await handle(0).focus();
        await page.keyboard.press("Enter");
        await page.keyboard.press("End");
        await page.keyboard.press("Escape");
        await poll(async () => (await order(page)).join(",") === before, "Escape restaura el orden");
        assert((await page.locator(t("ls-log")).textContent()) === log, "Escape no llama a onReorder");
        await poll(async () => /Reorder cancelled/.test(await said(page)), "anuncio al cancelar");
      },
    },
    {
      name: "FileUpload en rejilla (React): arrastrar el asa con el puntero mueve la foto y Make cover la pone primera",
      async run({ open }) {
        const page = await open("listing");
        await photos(page);
        const tile = (i) => page.locator(`${t("ls-photos")} .z-upload__tile[data-index="${i}"]`);
        await tile(0).scrollIntoViewIfNeeded();
        const from = await tile(0).locator(".z-upload__handle").boundingBox();
        const to = await tile(2).boundingBox();
        await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
        await page.mouse.down();
        await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 });
        await poll(async () => (await tile(2).getAttribute("data-drop-target")) !== null, "destino marcado");
        await page.mouse.up();
        await poll(async () => (await order(page)).join(",") === "kitchen,bedroom,living-room,terrace,view", "soltar mueve");
        await tile(3).locator(".z-upload__make-cover").click();
        await poll(async () => (await order(page))[0] === "terrace", "Make cover la pone primera");
        assert((await tile(0).getAttribute("data-cover")) !== null, "marca de portada");
        await tile(1).locator(".z-upload__remove").click();
        await poll(async () => (await page.locator(`${t("ls-photos")} .z-upload__tile`).count()) === 4, "quitar");
        const progress = await page.locator(`${t("ls-photos")} .z-upload__progress`).getAttribute("aria-label");
        assert(progress === "view.png: 60%", `progreso: ${progress}`);
        const named = await page.locator(`${t("ls-photos")} .z-upload__input`).evaluate((el) => {
          const id = el.getAttribute("aria-labelledby");
          return id ? document.getElementById(id)?.textContent : null;
        });
        assert(named === "Add photos", `nombre del campo: ${named}`);
      },
    },
  ];
}
