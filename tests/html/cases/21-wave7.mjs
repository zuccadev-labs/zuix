// Oleada 7 sin React: familia ColorPicker y el resto de piezas de medios (zui/dom), desde el contrato HTML y desde
// marcado mínimo escrito a mano.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const contract = JSON.parse(readFileSync(join(here, "../../../zui/html.json"), "utf8")).components;

export default async function ({ page, test, ok }) {
  let seq = 0;
  const inject = async (raw, width = "min(900px, 100vw)") => {
    const id = `w7-${++seq}`;
    const html = raw.replace(/\bid="([^"]+)"/g, `id="$1-${id}"`).replace(/\bpopovertarget="([^"]+)"/g, `popovertarget="$1-${id}"`);
    await page.evaluate(
      async ([markup, wrap, w]) => {
        for (const old of document.querySelectorAll("[data-w7-layer]")) old.remove();
        const box = document.createElement("div");
        box.id = wrap;
        box.setAttribute("data-z-dom", "");
        box.setAttribute("data-w7-layer", "");
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
        window.__w7 = [];
        for (const type of ["z:change", "z:changeend", "z:formatchange"])
          box.addEventListener(type, (event) => window.__w7.push([type, event.detail?.value ?? event.detail?.format]));
        (await import("/zui/dist/zui.dom.js")).hydrate(box);
      },
      [html, id, width],
    );
    return page.locator(`#${id}`);
  };
  const html = (name, i = 0) => contract[name].examples[i].html;
  const events = () => page.evaluate(() => window.__w7);
  const until = async (fn, message) => {
    for (let i = 0; i < 40; i++) {
      if (await fn()) return;
      await page.waitForTimeout(50);
    }
    ok(false, message);
  };

  await test("Oleada 7 sin React: ColorPicker del contrato con teclado, campos, formato y eventos", async () => {
    const box = await inject(html("ColorPicker", 1));
    const root = box.locator(".z-colorpicker");
    ok(
      (await root.getAttribute("data-value")) === "oklch(62% 0.19 260)" || /^oklch\(/.test(await root.getAttribute("data-value")),
      "formato de partida: oklch",
    );
    const area = root.locator('[data-part="area-thumb"]');
    await area.focus();
    await page.keyboard.press("End");
    await until(async () => (await area.getAttribute("aria-valuenow")) === "100", "Fin: saturación 100");
    await until(
      async () => (await root.evaluate((el) => el.style.getPropertyValue("--z-colorpicker-x"))) === "1",
      "la variable de posición del área sigue al valor",
    );
    const ev = await events();
    ok(ev.some(([t]) => t === "z:change") && ev.some(([t]) => t === "z:changeend"), `z:change y z:changeend: ${JSON.stringify(ev)}`);
    await root.locator('select[data-part="format"]').selectOption("hex");
    await until(async () => /^#[0-9a-f]{6}$/.test(await root.getAttribute("data-value")), "el formato pasa a hex");
    ok(
      (await events()).some(([t, v]) => t === "z:formatchange" && v === "hex"),
      "z:formatchange",
    );
    const hex = root.locator('input[data-channel="hex"]');
    await hex.fill("f00");
    await until(async () => (await root.getAttribute("data-value")) === "#ff0000", "hex corto en el campo");
    await hex.blur();
    await until(async () => (await hex.inputValue()) === "FF0000", "al salir se reescribe");
    await root.locator('.z-colorpicker__swatch[aria-label="#10b981"]').click();
    await until(async () => (await root.getAttribute("data-value")) === "#10b981", "muestra elegida");
    ok((await root.locator('.z-colorpicker__swatch[aria-checked="true"]').count()) === 1, "una muestra marcada");
    const hue = root.locator('[data-part="hue-thumb"]');
    await hue.focus();
    await page.keyboard.press("Home");
    await until(async () => (await hue.getAttribute("aria-valuenow")) === "0", "Inicio: tono 0");
  });

  await test("Oleada 7 sin React: marcado mínimo, RTL invierte las flechas y el campo oculto sigue al valor", async () => {
    const box = await inject(
      '<div dir="rtl"><div class="z-colorpicker" data-value="#808080" data-alpha="false" data-formats="hex" data-name="c" data-eyedropper="false"></div></div>',
    );
    const root = box.locator(".z-colorpicker");
    await until(async () => (await root.locator('[data-part="area-thumb"]').count()) === 1, "se pinta desde el marcado mínimo");
    ok((await root.locator('[data-part="alpha-thumb"]').count()) === 0, "sin alfa");
    ok((await root.locator('select[data-part="format"]').count()) === 0, "un solo formato: sin selector");
    const area = root.locator('[data-part="area-thumb"]');
    const before = Number(await area.getAttribute("aria-valuenow"));
    await area.focus();
    await page.keyboard.press("ArrowLeft");
    await until(
      async () => Number(await area.getAttribute("aria-valuenow")) === before + 1,
      "en RTL la flecha izquierda sube la saturación",
    );
    ok((await root.locator('input[type="hidden"][name="c"]').inputValue()) === (await root.getAttribute("data-value")), "campo oculto");
    ok((await root.locator('input[type="color"]').count()) === 1, "selector del sistema (respaldo nativo)");
  });

  await test("Oleada 7 sin React: ColorPickerTrigger abre el popover nativo y setColorValue cambia el color", async () => {
    const box = await inject(html("ColorPickerTrigger"));
    const button = box.locator(".z-colortrigger__button");
    const panel = box.locator(".z-colortrigger__panel");
    await button.click();
    await until(() => panel.evaluate((el) => el.matches(":popover-open")), "abre");
    await until(async () => (await button.getAttribute("aria-expanded")) === "true", "aria-expanded");
    const p = await panel.boundingBox();
    const b = await button.boundingBox();
    ok(p.y >= b.y + b.height - 1, "bajo el botón");
    await page.keyboard.press("Escape");
    await until(async () => !(await panel.evaluate((el) => el.matches(":popover-open"))), "Escape cierra");
    await page.evaluate(async () => {
      const { setColorValue } = await import("/zui/dist/zui.dom.js");
      setColorValue(document.querySelector("[data-w7-layer] .z-colortrigger"), "rgb(255 0 0)");
    });
    await until(async () => (await box.locator(".z-colortrigger__value").textContent()) === "#ff0000", "setColorValue");
  });

  const carouselHtml = (title) => contract.Carousel.examples.find((e) => e.title.startsWith(title)).html;

  await test("Oleada 7 sin React: Carousel con reproducción automática, botón de pausa primero y puntos", async () => {
    const box = await inject(carouselHtml("Reproducción automática").replace('data-autoplay="6000"', 'data-autoplay="1500"'));
    const root = box.locator(".z-carousel");
    await page.mouse.move(1200, 5);
    await until(async () => (await root.locator(".z-carousel__play").count()) === 1, "botón de reproducción");
    const first = root.locator(".z-carousel__controls > button").first();
    ok((await first.getAttribute("class")).includes("z-carousel__play"), "primer control");
    ok((await root.locator(".z-carousel__dot").count()) === 5, "un punto por slide");
    const current = () => root.locator('.z-carousel__dot[aria-current="true"]').getAttribute("data-index");
    const start = await current();
    for (let i = 0; i < 60 && (await current()) === start; i++) await page.waitForTimeout(100);
    ok((await current()) !== start, "avanza solo");
    ok((await root.locator(".z-carousel__live").getAttribute("aria-live")) === "off", "región viva callada mientras corre");
    await root.locator(".z-carousel__play").click();
    await page.mouse.move(1200, 5);
    await until(async () => (await root.locator(".z-carousel__play").getAttribute("aria-label")) === "Start automatic slide show", "pausa");
    await root.locator(".z-carousel__dot").nth(4).click();
    await until(async () => (await current()) === "4", "un punto lleva a su slide");
  });

  await test("Oleada 7 sin React: Carousel de tres por página (scroll-snap) y vertical con teclado", async () => {
    const box = await inject(carouselHtml("Tres por página"));
    const root = box.locator(".z-carousel");
    await until(async () => (await root.getAttribute("data-mode")) === "snap", "modo snap");
    const vp = root.locator(".z-carousel__viewport");
    ok((await vp.getAttribute("tabindex")) === "0", "vista enfocable");
    const widths = await root
      .locator(".z-carousel__slide")
      .evaluateAll((els) => els.slice(0, 3).map((el) => el.getBoundingClientRect().width));
    const w = (await vp.boundingBox()).width;
    const sum = widths.reduce((a, b) => a + b, 0);
    ok(sum < w && sum > w * 0.85, `tres por vista: ${widths} en ${w}`);
    await vp.focus();
    await page.keyboard.press("End");
    await until(
      async () => (await root.locator(".z-carousel__bar").evaluate((el) => el.style.getPropertyValue("--z-carousel-progress"))) === "1",
      "barra al final",
    );
    ok(await root.locator('.z-carousel__arrow[aria-label="Next slide"]').isDisabled(), "sin bucle: siguiente desactivado al final");
    const vbox = await inject(carouselHtml("Vertical"));
    const v = vbox.locator(".z-carousel");
    await until(async () => (await v.locator(".z-carousel__dot").count()) === 4, "cinco slides de dos en dos: cuatro posiciones");
    await v.locator(".z-carousel__viewport").focus();
    await page.keyboard.press("ArrowDown");
    await until(() => v.locator(".z-carousel__viewport").evaluate((el) => el.scrollTop > 40), "flecha abajo desplaza");
    await until(async () => (await v.locator(".z-carousel__dot").nth(1).getAttribute("aria-current")) === "true", "el punto sigue");
    await v.locator('.z-carousel__arrow[aria-label="Previous slide"]').click();
    await until(async () => (await v.locator(".z-carousel__dot").nth(0).getAttribute("aria-current")) === "true", "anterior vuelve");
    await v.locator('.z-carousel__arrow[aria-label="Previous slide"]').click();
    await until(
      async () => (await v.locator(".z-carousel__dot").nth(3).getAttribute("aria-current")) === "true",
      "con data-loop da la vuelta",
    );
  });

  await test("Oleada 7 sin React: QRCode desde marcado mínimo, nivel y setWidgetProps", async () => {
    const box = await inject('<div class="z-qrcode" data-value="hello" data-level="Q" data-size="120"></div>');
    const qr = box.locator(".z-qrcode");
    await until(async () => (await qr.locator("svg path").count()) === 1, "se dibuja");
    ok((await qr.getAttribute("aria-label")) === "QR code: hello", "nombre accesible");
    ok((await qr.getAttribute("data-version")) === "1", "versión 1");
    const d = await qr.locator("svg path").getAttribute("d");
    ok(d.startsWith("M4 4h7"), `zona de silencio de 4 y patrón de posición de 7: ${d.slice(0, 12)}`);
    const w = (await qr.boundingBox()).width;
    ok(Math.abs(w - 120) < 2, `120 px: ${w}`);
    await page.evaluate(async () => {
      const { setWidgetProps } = await import("/zui/dist/zui.dom.js");
      setWidgetProps(document.querySelector("[data-w7-layer] .z-qrcode"), { value: "x".repeat(100) });
    });
    await until(async () => Number(await qr.getAttribute("data-version")) >= 5, "setWidgetProps cambia el contenido");
  });

  await test("Oleada 7 sin React: CircularSlider del contrato con teclado, formato conservado y eventos", async () => {
    const box = await inject(html("CircularSlider", 1));
    const thumb = box.locator('.z-circular [role="slider"]');
    await until(async () => (await thumb.count()) === 1, "tirador");
    ok((await box.locator(".z-circular__value").textContent()) === "40%", "el formato del valor sobrevive al modo DOM");
    await thumb.focus();
    await page.keyboard.press("Home");
    await until(async () => (await thumb.getAttribute("aria-valuenow")) === "0", "Inicio");
    ok(
      (await events()).some(([t, v]) => t === "z:changeend" && v === 0),
      "z:changeend",
    );
    const x0 = await thumb.evaluate((el) => el.getBoundingClientRect().x);
    await page.keyboard.press("PageUp");
    await until(async () => (await thumb.evaluate((el) => el.getBoundingClientRect().x)) !== x0, "el tirador se mueve");
  });

  await test("Oleada 7 sin React: CompareSlider desde dos hijos recibe divisor y asa, teclado y setCompareValue", async () => {
    const box = await inject(
      '<div class="z-compare" data-value="30" style="block-size:120px"><div style="block-size:120px">A</div><div style="block-size:120px">B</div></div>',
    );
    const handle = box.locator('.z-compare [role="slider"]');
    await until(async () => (await handle.count()) === 1, "asa creada");
    ok((await box.locator(".z-compare__label").count()) === 2, "rótulos");
    ok((await handle.getAttribute("aria-valuenow")) === "30", "valor de partida");
    await handle.focus();
    await page.keyboard.press("End");
    await until(async () => (await handle.getAttribute("aria-valuenow")) === "100", "Fin");
    ok(
      (await events()).some(([t, v]) => t === "z:changeend" && v === 100),
      "z:changeend",
    );
    await page.evaluate(async () => {
      const { setCompareValue } = await import("/zui/dist/zui.dom.js");
      setCompareValue(document.querySelector("[data-w7-layer] .z-compare"), 20);
    });
    await until(
      async () => (await box.locator(".z-compare").evaluate((el) => el.style.getPropertyValue("--z-compare-pos"))) === "20%",
      "setCompareValue",
    );
  });

  await test("Oleada 7 sin React: ImageCropper desde un <img>, teclado con anuncio y cropImageBlob", async () => {
    const box = await inject(html("ImageCropper", 1));
    const root = box.locator(".z-cropper");
    await until(async () => (await root.locator(".z-cropper__area").count()) === 1, "área");
    await until(() => root.locator("img").evaluate((img) => img.complete && img.naturalWidth > 0), "la imagen se conserva y carga");
    const crop = async () => (await root.getAttribute("data-crop")).split(",").map(Number);
    await until(async () => Math.abs((await crop())[2] * 1.6 - (await crop())[3]) < 0.01, "círculo: cuadrado en píxeles");
    await root.locator(".z-cropper__area").focus();
    await page.keyboard.press("End");
    await until(async () => {
      const c = await crop();
      return Math.abs(c[0] + c[2] - 1) < 1e-6;
    }, "Fin lo lleva al borde derecho");
    await until(async () => ((await root.locator("[data-live]").textContent()) ?? "").startsWith("Crop "), "se anuncia");
    ok(
      (await events()).some(([t]) => t === "z:changeend"),
      "z:changeend",
    );
    const size = await page.evaluate(async () => {
      const { cropImageBlob } = await import("/zui/dist/zui.dom.js");
      const el = document.querySelector("[data-w7-layer] .z-cropper");
      const [x, y, width, height] = el.dataset.crop.split(",").map(Number);
      const blob = await cropImageBlob(el.querySelector("img"), { x, y, width, height }, { shape: "circle" });
      const bmp = await createImageBitmap(blob);
      return [bmp.width, bmp.height, blob.type];
    });
    ok(size[0] === size[1] && size[2] === "image/png", `PNG cuadrado: ${size}`);
  });

  await test("Oleada 7 sin React: SignaturePad dibuja, avisa con z:change y exporta SVG y PNG; modo Type desde el contrato", async () => {
    const box = await inject(html("SignaturePad"));
    const root = box.locator(".z-signature");
    const canvas = root.locator("canvas");
    await until(async () => (await canvas.count()) === 1, "lienzo");
    const c = await canvas.boundingBox();
    await page.mouse.move(c.x + 30, c.y + 50);
    await page.mouse.down();
    await page.mouse.move(c.x + 200, c.y + 90, { steps: 12 });
    await page.mouse.up();
    await until(async () => (await events()).some(([t]) => t === "z:change"), "z:change");
    const out = await page.evaluate(async () => {
      const z = await import("/zui/dist/zui.dom.js");
      const el = document.querySelector("[data-w7-layer] .z-signature");
      const v = z.signatureValue(el);
      const blob = await z.signatureBlob(el);
      return [v.empty, v.strokes.length, v.svg.includes("<path"), blob.type];
    });
    ok(out[0] === false && out[1] === 1 && out[2] && out[3] === "image/png", JSON.stringify(out));
    const typed = await inject(html("SignaturePad", 1));
    await until(
      async () => (await typed.locator(".z-signature__preview").textContent()) === "Ana Ruiz",
      "el nombre de partida sobrevive al modo DOM",
    );
    ok((await typed.locator(".z-signature__typed").inputValue()) === "Ana Ruiz", "campo con el nombre");
  });

  await test("Oleada 7 sin React: ShortcutInput graba, normaliza y avisa con z:change", async () => {
    const box = await inject('<div class="z-shortcut" data-value="cmd+option+k" data-platform="apple"></div>');
    const root = box.locator(".z-shortcut");
    const field = root.locator(".z-shortcut__field");
    await until(async () => (await field.count()) === 1, "campo");
    ok((await root.getAttribute("data-value")) === "Alt+Meta+K", "normaliza el valor de partida");
    ok((await root.locator("kbd").allTextContents()).join("") === "⌥⌘K", "teclas de Apple");
    await field.click();
    await page.keyboard.press("Meta+Shift+KeyS");
    await until(async () => (await root.getAttribute("data-value")) === "Mod+Shift+S", "graba con ⌘ como Mod");
    ok(
      (await events()).some(([t, v]) => t === "z:change" && v === "Mod+Shift+S"),
      "z:change",
    );
    await root.locator(".z-shortcut__clear").click();
    await until(async () => (await root.getAttribute("data-value")) === null, "borrar");
  });
}
