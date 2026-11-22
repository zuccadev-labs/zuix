// Binding de React (pantalla `?screen=media` de examples/app): familia ColorPicker y el resto de piezas
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
      name: "Confetti: lienzo fijo aria-hidden que no captura el puntero y se quita al terminar; nada con movimiento reducido (React)",
      async run({ open }) {
        const page = await screen(open);
        await page.locator(t("m-confetti")).scrollIntoViewIfNeeded();
        await page.click(t("m-confetti"));
        await poll(async () => (await page.locator("canvas.z-confetti").count()) === 1, "aparece el lienzo");
        const info = await page.locator("canvas.z-confetti").evaluate((el) => {
          const s = getComputedStyle(el);
          return [s.position, s.pointerEvents, el.getAttribute("aria-hidden")];
        });
        assert(info.join() === "fixed,none,true", `fijo, sin puntero y oculto: ${info}`);
        await poll(async () => (await page.locator("canvas.z-confetti").count()) === 0, "se quita al terminar", 6000);
        await poll(async () => (await text(page, "m-confetti-done")).includes("1 bursts finished"), "onComplete");
        const reduced = await screen(open, { reducedMotion: "reduce" });
        await reduced.locator(t("m-confetti")).scrollIntoViewIfNeeded();
        await reduced.click(t("m-confetti"));
        await reduced.waitForTimeout(300);
        assert((await reduced.locator("canvas.z-confetti").count()) === 0, "con movimiento reducido no hay confeti");
      },
    },
    {
      name: "DownloadTrigger: descarga un SVG generado al pulsar y muestra carga con una promesa (React)",
      async run({ open }) {
        const page = await screen(open);
        await page.locator(t("m-download-qr")).scrollIntoViewIfNeeded();
        const [file] = await Promise.all([page.waitForEvent("download"), page.click(t("m-download-qr"))]);
        assert(file.suggestedFilename() === "zuix-qr.svg", file.suggestedFilename());
        await poll(async () => (await text(page, "m-download-out")).startsWith("image/svg+xml "), "Blob SVG");
        const slow = t("m-download-slow");
        const waiting = page.waitForEvent("download");
        await page.click(slow);
        await expectAttr(page, slow, "aria-busy", "true");
        assert((await page.locator(`${slow} .z-btn__spinner`).count()) === 1, "indicador de carga");
        const notes = await waiting;
        assert(notes.suggestedFilename() === "notes.txt", notes.suggestedFilename());
        await expectAttr(page, slow, "aria-busy", null);
      },
    },
    {
      name: "ShortcutInput: graba con modificadores, exige uno, Escape cancela, Retroceso borra y Tab no queda atrapado (React)",
      async run({ open }) {
        const page = await screen(open);
        const field = `${t("m-shortcut")} .z-shortcut__field`;
        await page.locator(field).scrollIntoViewIfNeeded();
        await page.focus(field);
        await page.keyboard.press("Enter");
        await expectAttr(page, t("m-shortcut") + " .z-shortcut", "data-recording", "");
        assert((await page.locator(`${field}`).textContent()).includes("Press keys"), "el contenido dice que graba");
        await page.keyboard.press("Control+Shift+KeyP");
        await poll(async () => (await text(page, "m-shortcut-value")) === "Mod+Shift+P", "graba la combinación");
        await expectAttr(page, t("m-shortcut") + " .z-shortcut", "data-recording", null);
        assert(
          (await page.locator(`${field} .z-sr-only`).textContent()).startsWith("Open command palette: Ctrl Shift P"),
          "nombre con el atajo (por contenido)",
        );
        await page.keyboard.press("Enter");
        await page.keyboard.press("KeyJ");
        await poll(async () => (await page.locator(`${t("m-shortcut")} .z-shortcut__hint`).count()) === 1, "sin modificador: aviso");
        await page.keyboard.press("Escape");
        await expectAttr(page, t("m-shortcut") + " .z-shortcut", "data-recording", null);
        assert((await text(page, "m-shortcut-value")) === "Mod+Shift+P", "Escape no cambia el valor");
        await page.keyboard.press("Enter");
        await page.keyboard.press("Backspace");
        await poll(async () => (await text(page, "m-shortcut-value")) === "none", "Retroceso borra");
        await poll(
          async () => ((await page.locator(`${t("m-shortcut")} [data-live]`).textContent()) ?? "") === "Shortcut cleared",
          "se anuncia",
        );
        await page.keyboard.press("Enter");
        await page.keyboard.press("Tab");
        await poll(() => page.evaluate(() => !document.activeElement?.closest(".z-shortcut")), "Tab sale del campo");
      },
    },
    {
      name: "SignaturePad: dibujar, deshacer, borrar, escribir el nombre como alternativa y exportar PNG (React)",
      async run({ open }) {
        const page = await screen(open);
        const root = `${t("m-signature")} .z-signature`;
        await page.locator(root).scrollIntoViewIfNeeded();
        await expectAttr(page, `${root} .z-signature__undo`, "disabled", "");
        const c = await page.locator(`${root} canvas`).boundingBox();
        const stroke = async (y) => {
          await page.mouse.move(c.x + 40, c.y + y);
          await page.mouse.down();
          for (let i = 1; i <= 12; i++) await page.mouse.move(c.x + 40 + i * 15, c.y + y + (i % 2 ? 10 : -10));
          await page.mouse.up();
        };
        await stroke(60);
        await stroke(100);
        await poll(async () => (await text(page, "m-signature-state")) === "draw:2", "dos trazos");
        const ink = await page.locator(`${root} canvas`).evaluate((el) => {
          const d = el.getContext("2d").getImageData(0, 0, el.width, el.height).data;
          let n = 0;
          for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
          return n;
        });
        assert(ink > 100, `el lienzo tiene tinta: ${ink}`);
        await page.click(`${root} .z-signature__undo`);
        await poll(async () => (await text(page, "m-signature-state")) === "draw:1", "deshacer quita un trazo");
        await page.click(t("m-signature-export"));
        await poll(async () => (await text(page, "m-signature-png")) === "image/png ok", "PNG");
        assert(
          (await page.locator(`${root} input[type="hidden"][name="signature"]`).inputValue()).startsWith("<svg"),
          "campo oculto con el SVG",
        );
        await page.click(`${root} .z-signature__clear`);
        await poll(async () => (await text(page, "m-signature-state")) === "empty", "borrar");
        await page.click(`${root} .z-signature__mode[data-mode="type"]`);
        await expectAttr(page, `${root} .z-signature__mode[data-mode="type"]`, "aria-checked", "true");
        await page.locator(`${root} .z-signature__typed`).fill("Ana Ruiz");
        await poll(async () => (await text(page, "m-signature-state")) === "type:Ana Ruiz", "el nombre escrito firma");
        assert((await page.locator(`${root} .z-signature__preview`).textContent()) === "Ana Ruiz", "vista del nombre");
        const label = await page.locator(`${root} .z-signature__typed`).evaluate((el) => el.labels?.[0]?.textContent ?? "");
        assert(label.includes("Type your full name"), "el campo tiene etiqueta");
      },
    },
    {
      name: "ImageCropper: teclado (mover, redimensionar con Mayús), asa de esquina con relación 1:1 y exportación a PNG (React)",
      async run({ open }) {
        const page = await screen(open);
        const root = `${t("m-cropper")} .z-cropper`;
        await page.locator(root).scrollIntoViewIfNeeded();
        await poll(() => page.locator(`${root} img`).evaluate((img) => img.complete && img.naturalWidth > 0), "la imagen carga");
        const area = `${root} .z-cropper__area`;
        const crop = () =>
          page
            .locator(root)
            .getAttribute("data-crop")
            .then((v) => v.split(",").map(Number));
        await poll(async () => Math.abs((await crop())[2] * 1.6 - (await crop())[3]) < 0.01, "cuadrado en píxeles sobre una imagen 16:10");
        const [x0] = await crop();
        await page.focus(area);
        await page.keyboard.press("ArrowLeft");
        await poll(async () => Math.abs((await crop())[0] - (x0 - 0.01)) < 1e-6, "flecha izquierda mueve un 1 %");
        const [, , w0, h0] = await crop();
        await page.keyboard.press("Shift+ArrowUp");
        await poll(async () => (await crop())[3] < h0, "Mayús + flecha arriba encoge");
        const [, , w1, h1] = await crop();
        assert(Math.abs(w1 * 1.6 - h1) < 0.01, "conserva la relación");
        assert(w1 < w0, "encoge también el ancho");
        await poll(
          async () => ((await page.locator(`${root} [data-live]`).textContent()) ?? "").startsWith("Crop "),
          "se anuncia el recorte",
        );
        const handle = await page.locator(`${root} .z-cropper__handle[data-handle="se"]`).boundingBox();
        await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
        await page.mouse.down();
        await page.mouse.move(handle.x + handle.width / 2 - 40, handle.y + handle.height / 2 - 40, { steps: 4 });
        await page.mouse.up();
        const after = await crop();
        assert(after[2] < w1 && Math.abs(after[2] * 1.6 - after[3]) < 0.01, `asa de esquina encoge con la relación: ${after}`);
        await page.click(t("m-crop-export"));
        await poll(async () => /^(\d+)×\1 image\/png$/.test(await text(page, "m-crop-out")), "PNG cuadrado");
        const side = Number((await text(page, "m-crop-out")).split("×")[0]);
        assert(side > 50 && side <= 256, `lado acotado a 256: ${side}`);
      },
    },
    {
      name: "CompareSlider: asa role=slider con teclado y pulsación que lleva el divisor (React)",
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
      name: "CircularSlider: teclado APG, arrastre por el anillo y hueco del arco abierto (React)",
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
      name: "QRCode: imagen con nombre, la versión crece con el texto y el nivel H con icono (React)",
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
      name: "Carousel: reproducción automática con botón de pausa primero, pausa con el puntero y puntos (React)",
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
      name: "Carousel: tres por página con barra y vertical con scroll-snap y teclado (React)",
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
      name: "Carousel: miniaturas con aria-current que llevan a su slide (React)",
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
      name: "ColorPicker: teclado del área y del tono, campo hex, formato y muestrario controlados (React)",
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
      name: "ColorPicker: arrastre en el área y en el alfa con el puntero (React)",
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
      name: "ColorPickerTrigger: popover nativo bajo el botón, foco en el área, Escape devuelve el foco (React)",
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
      name: "ColorSlider y ColorSwatchPicker sueltos: teclado APG y radios (React)",
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
