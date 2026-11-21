// Oleada 7 en el binding de React (pantalla `?screen=media` de examples/app): familia ColorPicker y el resto de piezas
// de medios. Exporta una función que recibe los ayudantes de cases.mjs.
export default function ({ t, assert, poll, expectAttr }) {
  const screen = (open, options) => open("media", options);
  const text = (page, id) => page.locator(t(id)).first().textContent();
  const isOpen = (page, selector) =>
    page
      .locator(selector)
      .first()
      .evaluate((el) => el.matches(":popover-open"));

  return [
    {
      name: "Oleada 7 · CompareSlider: asa role=slider con teclado y pulsación que lleva el divisor (React)",
      async run({ open }) {
        const page = await screen(open);
        const handle = `${t("m-compare")} [role="slider"]`;
        await page.locator(handle).scrollIntoViewIfNeeded();
        await expectAttr(page, handle, "aria-valuetext", "50% Before");
        await page.focus(handle);
        await page.keyboard.press("Shift+ArrowRight");
        await poll(async () => (await text(page, "m-compare-value")) === "60", "Mayús + flecha: diez pasos");
        await page.keyboard.press("Home");
        await poll(async () => (await text(page, "m-compare-value")) === "0", "Inicio");
        const box = await page.locator(`${t("m-compare")} .z-compare`).boundingBox();
        await page.mouse.click(box.x + box.width * 0.75, box.y + box.height / 2);
        await poll(async () => Math.abs(Number(await text(page, "m-compare-value")) - 75) < 1.5, "pulsar lleva el divisor");
        const clip = await page.locator(`${t("m-compare")} .z-compare__before`).evaluate((el) => getComputedStyle(el).clipPath);
        assert(clip.startsWith("inset("), `la capa de antes se recorta: ${clip}`);
      },
    },
    {
      name: "Oleada 7 · CircularSlider: teclado APG, arrastre por el anillo y hueco del arco abierto (React)",
      async run({ open }) {
        const page = await screen(open);
        const thumb = `${t("m-dial")} [role="slider"]`;
        await page.locator(thumb).scrollIntoViewIfNeeded();
        await page.focus(thumb);
        await page.keyboard.press("ArrowUp");
        await poll(async () => (await text(page, "m-dial-value")) === "41", "flecha arriba suma un paso");
        await page.keyboard.press("PageUp");
        await poll(async () => (await text(page, "m-dial-value")) === "51", "Re Pág diez pasos");
        await page.keyboard.press("End");
        await expectAttr(page, thumb, "aria-valuenow", "100");
        await expectAttr(page, thumb, "aria-valuetext", "100 volume");
        const box = await page.locator(`${t("m-dial")} .z-circular`).boundingBox();
        const cx = box.x + box.width / 2;
        const cy = box.y + box.height / 2;
        // Arriba del todo es la mitad del arco de 270°.
        await page.mouse.move(cx, cy - box.height * 0.42);
        await page.mouse.down();
        await page.mouse.up();
        await poll(async () => (await text(page, "m-dial-value")) === "50", "arriba: 50");
        // En el hueco de abajo, a la izquierda: el mínimo.
        await page.mouse.click(cx - 4, cy + box.height * 0.42);
        await poll(async () => (await text(page, "m-dial-value")) === "0", "hueco a la izquierda: mínimo");
        const ring = `${t("m-ring")} [role="slider"]`;
        await page.focus(ring);
        await page.keyboard.press("ArrowRight");
        await expectAttr(page, ring, "aria-valuenow", "225");
        assert((await page.locator(`${t("m-ring")} .z-circular__mark`).count()) === 24, "una marca por paso (sin repetir 360)");
      },
    },
    {
      name: "Oleada 7 · QRCode: imagen con nombre, la versión crece con el texto y el nivel H con icono (React)",
      async run({ open }) {
        const page = await screen(open);
        const qr = `${t("m-qr")} .z-qrcode`;
        await page.locator(qr).scrollIntoViewIfNeeded();
        await expectAttr(page, qr, "role", "img");
        await expectAttr(page, qr, "aria-label", "QR code: https://zuccadev-labs.github.io/zuix/");
        await expectAttr(page, qr, "data-version", "3");
        await page.fill(t("m-qr-input"), "x".repeat(200));
        await poll(async () => Number(await page.locator(qr).getAttribute("data-version")) >= 8, "más texto, versión mayor");
        await page.click(`${t("m-qr")} ~ * [role="radio"]:has-text("H"), [role="radio"]:has-text("H") >> nth=0`);
        await expectAttr(page, qr, "data-level", "H");
        const box = await page.locator(`${qr} svg`).boundingBox();
        assert(Math.abs(box.width - 200) < 2, `200 px: ${box.width}`);
        await expectAttr(page, `${t("m-qr-icon")} .z-qrcode`, "data-level", "H");
        assert((await page.locator(`${t("m-qr-icon")} .z-qrcode__logo svg`).count()) === 1, "icono en el centro");
      },
    },
    {
      name: "Oleada 7 · Carousel: reproducción automática con botón de pausa primero, pausa con el puntero y puntos (React)",
      async run({ open }) {
        const page = await screen(open);
        const root = `${t("m-car-auto")} .z-carousel`;
        await page.locator(root).scrollIntoViewIfNeeded();
        await page.mouse.move(2, 2);
        const first = page.locator(`${root} .z-carousel__controls > button`).first();
        assert((await first.getAttribute("class")).includes("z-carousel__play"), "el botón de pausa es el primer control");
        await expectAttr(page, `${root} .z-carousel__play`, "aria-label", "Pause automatic slide show");
        await expectAttr(page, `${root} .z-carousel__live`, "aria-live", "off");
        const current = () => page.locator(`${root} .z-carousel__dot[aria-current="true"]`).getAttribute("aria-label");
        const start = await current();
        await poll(async () => (await current()) !== start, "avanza solo", 6000);
        // Con el puntero encima se detiene.
        const box = await page.locator(`${root} .z-carousel__viewport`).boundingBox();
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await expectAttr(page, root, "data-autoplay-state", "paused");
        await page.mouse.move(2, 2);
        await expectAttr(page, root, "data-autoplay-state", "playing");
        await page.click(`${root} .z-carousel__play`);
        await page.mouse.move(2, 2);
        await expectAttr(page, `${root} .z-carousel__play`, "aria-label", "Start automatic slide show");
        await expectAttr(page, `${root} .z-carousel__live`, "aria-live", "polite");
        await page.click(`${root} .z-carousel__dot >> nth=3`);
        await expectAttr(page, `${root} .z-carousel__dot >> nth=3`, "aria-current", "true");
        assert((await page.locator(`${root} .z-carousel__dot`).count()) === 6, "un punto por slide");
      },
    },
    {
      name: "Oleada 7 · Carousel: tres por página con barra y vertical con scroll-snap y teclado (React)",
      async run({ open }) {
        const page = await screen(open);
        const root = `${t("m-car-page")} .z-carousel`;
        await page.locator(root).scrollIntoViewIfNeeded();
        await expectAttr(page, root, "data-mode", "snap");
        const widths = await page
          .locator(`${root} .z-carousel__slide`)
          .evaluateAll((els) => els.slice(0, 3).map((el) => el.getBoundingClientRect().width));
        const vp = await page.locator(`${root} .z-carousel__viewport`).boundingBox();
        const sum = widths.reduce((a, b) => a + b, 0);
        assert(sum < vp.width && sum > vp.width * 0.85, `tres slides llenan la vista: ${widths} en ${vp.width}`);
        const next = `${root} .z-carousel__arrow[aria-label="Next slide"]`;
        await page.click(next);
        await poll(
          () => page.locator(`${root} .z-carousel__slide >> nth=1`).evaluate((el) => el.hasAttribute("data-active")),
          "el siguiente pasa a la vista",
        );
        await page.focus(`${root} .z-carousel__viewport`);
        await page.keyboard.press("End");
        await poll(() => page.locator(next).isDisabled(), "en la última posición (sin bucle) siguiente se desactiva");
        const fill = await page.locator(`${root} .z-carousel__bar`).evaluate((el) => el.style.getPropertyValue("--z-carousel-progress"));
        assert(fill === "1", `barra completa: ${fill}`);
        const v = `${t("m-car-vertical")} .z-carousel`;
        await page.locator(v).scrollIntoViewIfNeeded();
        await expectAttr(page, v, "data-orientation", "vertical");
        assert((await page.locator(`${v} .z-carousel__dot`).count()) === 5, "seis slides de dos en dos: cinco posiciones");
        await page.focus(`${v} .z-carousel__viewport`);
        await page.keyboard.press("ArrowDown");
        await poll(
          () => page.locator(`${v} .z-carousel__viewport`).evaluate((el) => el.scrollTop > 40),
          "flecha abajo desplaza en vertical",
        );
        await poll(
          async () => (await page.locator(`${v} .z-carousel__dot >> nth=1`).getAttribute("aria-current")) === "true",
          "el punto sigue al desplazamiento",
        );
      },
    },
    {
      name: "Oleada 7 · Carousel: miniaturas con aria-current que llevan a su slide (React)",
      async run({ open }) {
        const page = await screen(open);
        const root = `${t("m-car-thumbs")} .z-carousel`;
        await page.locator(root).scrollIntoViewIfNeeded();
        assert((await page.locator(`${root} .z-carousel__thumb`).count()) === 6, "una miniatura por slide");
        await expectAttr(page, `${root} .z-carousel__thumb >> nth=0`, "aria-current", "true");
        await page.click(`${root} .z-carousel__thumb >> nth=2`);
        await expectAttr(page, `${root} .z-carousel__thumb >> nth=2`, "aria-current", "true");
        await poll(() => page.locator(`${root} .z-carousel__slide[data-index="2"][data-active]`).count(), "el slide 3 queda centrado");
        assert((await page.locator(`${root} .z-carousel__counter`).count()) === 0, "las miniaturas sustituyen al contador");
      },
    },
    {
      name: "Oleada 7 · ColorPicker: teclado del área y del tono, campo hex, formato y muestrario controlados (React)",
      async run({ open }) {
        const page = await screen(open);
        const root = t("m-picker");
        await page.locator(root).scrollIntoViewIfNeeded();
        const area = `${root} [data-part="area-thumb"]`;
        await page.focus(area);
        const before = await text(page, "m-picker-value");
        await page.keyboard.press("ArrowLeft");
        await poll(async () => (await text(page, "m-picker-value")) !== before, "la flecha cambia el valor controlado");
        await poll(
          async () => (await text(page, "m-picker-end")) === (await text(page, "m-picker-value")),
          "onValueChangeEnd tras la tecla",
        );
        await page.keyboard.press("Home");
        await expectAttr(page, area, "aria-valuenow", "0");
        await poll(async () => /^#([0-9a-f]{2})\1\1$/.test(await text(page, "m-picker-value")), "saturación 0: un gris");
        // El tono no se pierde en el gris: sigue en 217.
        await expectAttr(page, `${root} [data-part="hue-thumb"]`, "aria-valuenow", "217");
        await page.focus(`${root} [data-part="hue-thumb"]`);
        await page.keyboard.press("End");
        await expectAttr(page, `${root} [data-part="hue-thumb"]`, "aria-valuenow", "360");
        const hex = page.locator(`${root} input[data-channel="hex"]`);
        await hex.fill("10b981");
        await poll(async () => (await text(page, "m-picker-value")) === "#10b981", "el campo hex cambia el valor");
        await hex.press("Tab");
        assert((await hex.inputValue()) === "10B981", "al salir se reescribe en mayúsculas");
        await page.selectOption(`${root} select[data-part="format"]`, "rgb");
        await poll(async () => (await text(page, "m-picker-value")) === "rgb(16 185 129)", "cambiar el formato reescribe el valor");
        assert((await page.locator(`${root} input[data-channel="g"]`).inputValue()) === "185", "campos por canal");
        await page.click(`${root} .z-colorpicker__swatch[aria-label="Violet"]`);
        await poll(async () => (await text(page, "m-picker-value")) === "rgb(139 92 246)", "una muestra fija el color");
        await expectAttr(page, `${root} .z-colorpicker__swatch[aria-label="Violet"]`, "aria-checked", "true");
        await page.keyboard.press("ArrowRight");
        await poll(async () => (await text(page, "m-picker-value")) === "rgb(236 72 153)", "flecha en el muestrario: la siguiente");
        assert(
          (await page.locator(`${root} input[type="hidden"][name="brand"]`).inputValue()) === "rgb(236 72 153)",
          "campo oculto del formulario",
        );
      },
    },
    {
      name: "Oleada 7 · ColorPicker: arrastre en el área y en el alfa con el puntero (React)",
      async run({ open }) {
        const page = await screen(open);
        const root = t("m-picker");
        await page.locator(root).scrollIntoViewIfNeeded();
        const box = await page.locator(`${root} .z-colorpicker__area`).boundingBox();
        await page.mouse.move(box.x + 16, box.y + box.height - 16);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 4 });
        await page.mouse.up();
        const sat = Number(await page.locator(`${root} [data-part="area-thumb"]`).getAttribute("aria-valuenow"));
        const valuetext = await page.locator(`${root} [data-part="area-thumb"]`).getAttribute("aria-valuetext");
        assert(
          sat >= 47 && sat <= 53 && /brightness 5\d%|brightness 4[7-9]%/.test(valuetext),
          `el arrastre lleva el punto al centro: ${valuetext}`,
        );
        const alpha = await page.locator(`${root} .z-colorpicker__slider[data-channel="alpha"]`).boundingBox();
        await page.mouse.click(alpha.x + alpha.width / 2, alpha.y + alpha.height / 2);
        await poll(async () => /^#[0-9a-f]{8}$/.test(await text(page, "m-picker-value")), "con alfa el hex lleva 8 cifras");
        const now = Number(await page.locator(`${root} [data-part="alpha-thumb"]`).getAttribute("aria-valuenow"));
        assert(now >= 45 && now <= 55, `alfa a la mitad: ${now}`);
      },
    },
    {
      name: "Oleada 7 · ColorPickerTrigger: popover nativo bajo el botón, foco en el área, Escape devuelve el foco (React)",
      async run({ open }) {
        const page = await screen(open);
        const button = `${t("m-trigger")} .z-colortrigger__button`;
        const panel = `${t("m-trigger")} .z-colortrigger__panel`;
        await page.locator(button).scrollIntoViewIfNeeded();
        await page.click(button);
        await poll(() => isOpen(page, panel), "se abre");
        await expectAttr(page, button, "aria-expanded", "true");
        const p = await page.locator(panel).boundingBox();
        const b = await page.locator(button).boundingBox();
        assert(p.y >= b.y + b.height && p.y - (b.y + b.height) < 16, "el panel queda bajo el botón");
        await poll(
          () => page.evaluate(() => document.activeElement?.getAttribute("data-part") === "area-thumb"),
          "el foco entra en el área",
        );
        await page.keyboard.press("ArrowUp");
        await page.keyboard.press("Escape");
        await poll(async () => !(await isOpen(page, panel)), "Escape cierra");
        await poll(
          () => page.evaluate(() => document.activeElement?.classList.contains("z-colortrigger__button")),
          "el foco vuelve al botón",
        );
        await expectAttr(page, button, "aria-expanded", "false");
      },
    },
    {
      name: "Oleada 7 · ColorSlider y ColorSwatchPicker sueltos: teclado APG y radios (React)",
      async run({ open }) {
        const page = await screen(open);
        const hue = `${t("m-hue")} [role="slider"]`;
        await page.locator(hue).scrollIntoViewIfNeeded();
        await page.focus(hue);
        const start = Number(await page.locator(hue).getAttribute("aria-valuenow"));
        await page.keyboard.press("Shift+ArrowRight");
        await expectAttr(page, hue, "aria-valuenow", String(start + 10));
        await page.keyboard.press("PageDown");
        await expectAttr(page, hue, "aria-valuenow", String(start));
        const alpha = `${t("m-alpha")} [role="slider"]`;
        await expectAttr(page, alpha, "aria-valuenow", "50");
        await expectAttr(page, alpha, "aria-valuetext", "50% opaque");
        const radios = `${t("m-swatches")} [role="radio"]`;
        assert((await page.locator(`${t("m-swatches")} [role="radiogroup"]`).count()) === 1, "radiogroup");
        await expectAttr(page, `${radios}[aria-label="Emerald"]`, "aria-checked", "true");
        assert((await page.locator(`${radios}[tabindex="0"]`).count()) === 1, "una sola parada de Tab");
        await page.focus(`${radios}[aria-label="Emerald"]`);
        await page.keyboard.press("ArrowLeft");
        await expectAttr(page, `${radios}[aria-label="Amber"]`, "aria-checked", "true");
      },
    },
  ];
}
