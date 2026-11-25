// Sin React: carruseles nuevos (Prisma con bucle sin réplicas, multi-browse, fundido, mazo, rueda),
// Stories, Lightbox, Gallery, skeletons por patrón y el anunciador central, desde el contrato HTML (zui/dom).
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const contract = JSON.parse(readFileSync(join(here, "../../../zui/html.json"), "utf8")).components;

export default async function ({ page, test, ok }) {
  let seq = 0;
  const inject = async (raw, width = "min(900px, 100vw)") => {
    const id = `car-${++seq}`;
    const html = raw.replace(/\bid="([^"]+)"/g, `id="$1-${id}"`);
    await page.evaluate(
      async ([markup, wrap, w]) => {
        for (const old of document.querySelectorAll("[data-car-layer]")) old.remove();
        const box = document.createElement("div");
        box.id = wrap;
        box.setAttribute("data-z-dom", "");
        box.setAttribute("data-car-layer", "");
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
        window.__carChanges = [];
        box.addEventListener("z:change", (event) => window.__carChanges.push(event.detail));
        (await import("/zui/dist/zui.dom.js")).hydrate(box);
      },
      [html, id, width],
    );
    return page.locator(`#${id}`);
  };
  const html = (name, title) => (title ? contract[name].examples.find((e) => e.title.startsWith(title)) : contract[name].examples[0]).html;
  const until = async (fn, message, tries = 60) => {
    for (let i = 0; i < tries; i++) {
      if (await fn()) return;
      await page.waitForTimeout(50);
    }
    ok(false, message);
  };
  const active = (root) => root.locator(".z-carousel__slide[data-active]").first().getAttribute("data-index");
  const live = (root) => root.locator(".z-carousel__live").textContent();

  await test("Sin React: Prisma da la vuelta sin réplicas (order), anuncia tras asentarse y el punto progress crece", async () => {
    const box = await inject(html("Carousel", "Prisma"));
    const root = box.locator(".z-carousel");
    await until(async () => (await root.getAttribute("data-mode")) === "snap", "modo nativo");
    ok((await root.getAttribute("data-align")) === "center", "ajuste al centro");
    ok((await root.locator(".z-carousel__face").count()) === 5, "una cara por slide (la transformación no mueve el ajuste)");
    ok((await root.locator(".z-carousel__slide").count()) === 5, "sin réplicas");
    await root.locator(".z-carousel__play").click();
    await page.mouse.move(1200, 5);
    // El último está aparcado delante del primero: el orden visual cambia, el DOM no.
    const order = await root.locator(".z-carousel__slide").evaluateAll((els) => els.map((el) => getComputedStyle(el).order).join(","));
    ok(order === "0,0,0,0,-1", `aparcado el último: ${order}`);
    ok((await live(root)) === "", "nada al cargar");
    const next = root.locator('.z-carousel__arrow[aria-label="Next slide"]');
    const prev = root.locator('.z-carousel__arrow[aria-label="Previous slide"]');
    await prev.click();
    await until(async () => (await active(root)) === "4", "anterior desde el primero lleva al último");
    await until(async () => (await live(root)) === "Slide 5 of 5", "anuncio tras asentarse");
    await next.click();
    await until(async () => (await active(root)) === "0", "siguiente vuelve al primero");
    for (let i = 0; i < 5; i++) {
      await next.click();
      await page.waitForTimeout(700);
    }
    await until(async () => (await active(root)) === "0", "cinco pasos dan la vuelta entera");
    const dot = await root.locator('.z-carousel__dot[aria-current="true"]').evaluate((el) => el.getBoundingClientRect().width);
    const other = await root
      .locator('.z-carousel__dot:not([aria-current="true"])')
      .first()
      .evaluate((el) => el.getBoundingClientRect().width);
    ok(dot > other, `el punto actual es más ancho (no solo color): ${dot} > ${other}`);
    await root.locator(".z-carousel__dot").nth(3).click();
    await until(async () => (await active(root)) === "3", "un punto lleva a su slide en orden");
    const labels = await root.locator(".z-carousel__slide").evaluateAll((els) => els.map((el) => el.getAttribute("aria-label")).join("|"));
    ok(labels === "Slide 1 of 5|Slide 2 of 5|Slide 3 of 5|Slide 4 of 5|Slide 5 of 5", "la posición original no cambia al aparcar");
  });

  await test("Sin React: multi-browse recorta con máscaras y llega al final; el teclado lo mueve", async () => {
    const box = await inject(html("Carousel", "Multi-browse"));
    const root = box.locator(".z-carousel");
    await until(async () => (await root.getAttribute("data-mode")) === "snap", "modo nativo");
    const insets = await root
      .locator(".z-carousel__slide")
      .evaluateAll((els) => els.map((el) => Number.parseFloat(el.style.getPropertyValue("--z-kl-inset")) || 0));
    ok(insets[0] === 0 && insets.at(-1) > 0, `el primero entero, los últimos recortados: ${insets}`);
    await root.locator(".z-carousel__viewport").focus();
    await page.keyboard.press("End");
    await until(
      async () => await root.locator('.z-carousel__arrow[aria-label="Next slide"]').isDisabled(),
      "al final, siguiente desactivado",
    );
    await until(
      async () =>
        (await root
          .locator(".z-carousel__slide")
          .last()
          .evaluate((el) => Number.parseFloat(el.style.getPropertyValue("--z-kl-inset")))) < 1,
      "al final el último llega entero",
    );
    await page.keyboard.press("Home");
    await until(async () => (await root.locator(".z-carousel__dot").first().getAttribute("aria-current")) === "true", "Inicio vuelve");
  });

  await test("Sin React: fundido y mazo dejan inertes los slides de detrás; el mazo se arrastra", async () => {
    const box = await inject(html("Carousel", "Fundido"));
    const root = box.locator(".z-carousel");
    await until(async () => (await root.getAttribute("data-mode")) === "deck", "mazo");
    const states = () => root.locator(".z-carousel__slide").evaluateAll((els) => els.map((el) => (el.inert ? "i" : "a")).join(""));
    ok((await states()) === "aiiii", `solo el actual es interactivo: ${await states()}`);
    await root.locator('.z-carousel__arrow[aria-label="Previous slide"]').click();
    await until(async () => (await states()) === "iiiia", "con bucle, anterior va al último");
    await until(async () => (await live(root)) === "Slide 5 of 5", "anuncia");
    const sbox = await inject(html("Carousel", "Mazo"));
    const stack = sbox.locator(".z-carousel");
    await until(async () => (await stack.getAttribute("data-layout")) === "stack", "mazo de tarjetas");
    const vp = stack.locator(".z-carousel__viewport");
    const r = await vp.boundingBox();
    await page.mouse.move(r.x + r.width * 0.8, r.y + 30);
    await page.mouse.down();
    await page.mouse.move(r.x + r.width * 0.5, r.y + 30, { steps: 6 });
    await page.mouse.move(r.x + r.width * 0.1, r.y + 30, { steps: 6 });
    await page.mouse.up();
    await until(async () => (await active(stack)) === "1", "arrastrar descarta la tarjeta");
    await vp.focus();
    await page.keyboard.press("ArrowLeft");
    await until(async () => (await active(stack)) === "0", "flecha atrás la recupera");
  });

  await test("Sin React: rueda vertical centrada con flechas arriba y abajo", async () => {
    const box = await inject(html("Carousel", "Rueda"), "320px");
    const root = box.locator(".z-carousel");
    await until(async () => (await root.getAttribute("data-orientation")) === "vertical", "vertical");
    const vp = root.locator(".z-carousel__viewport");
    await vp.focus();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await until(async () => (await active(root)) === "2", "dos abajo");
    const centered = () =>
      root.locator(".z-carousel__slide[data-active]").evaluate((el) => {
        const a = el.getBoundingClientRect();
        const v = el.closest(".z-carousel__viewport").getBoundingClientRect();
        return Math.abs(a.top + a.height / 2 - (v.top + v.height / 2));
      });
    await until(async () => (await centered()) < 3, "el activo queda en el centro");
  });

  await test("Sin React: Stories avanzan con el reloj, se pausan, saltan de persona y anuncian en la región central", async () => {
    const box = await inject(html("Stories").replace(/data-duration="5000"/g, 'data-duration="1000"'));
    const root = box.locator(".z-stories");
    await until(async () => (await root.getAttribute("data-state")) === "playing", "en marcha");
    ok((await root.locator(".z-stories__bar").count()) === 5, "una barra por historia");
    ok((await root.locator(".z-stories__bars").first().getAttribute("aria-hidden")) === "true", "barras decorativas");
    const item = () =>
      root.evaluate((el) => {
        const g = el.querySelector(".z-stories__group[data-active]");
        return `${g.dataset.author}:${[...g.querySelectorAll(".z-stories__item")].findIndex((i) => i.hasAttribute("data-active"))}`;
      });
    await until(async () => (await item()) === "Ana:1", "pasa sola a la segunda", 60);
    await root.locator('[data-stories-action="pause"]').click();
    ok((await root.getAttribute("data-state")) === "paused", "pausa");
    ok((await root.locator('[data-stories-action="pause"]').getAttribute("aria-pressed")) === "true", "botón conmutador");
    const fill = await root
      .locator(".z-stories__group[data-active] .z-stories__fill")
      .nth(1)
      .evaluate((el) => el.style.getPropertyValue("--z-story-fill"));
    await page.waitForTimeout(400);
    const same = await root
      .locator(".z-stories__group[data-active] .z-stories__fill")
      .nth(1)
      .evaluate((el) => el.style.getPropertyValue("--z-story-fill"));
    ok(fill === same, "en pausa la barra no se mueve");
    await root.locator('[data-stories-action="next-group"]').click();
    ok((await item()) === "Leo:0", "siguiente persona");
    await until(
      async () => (await page.locator("[data-z-announcer] [role=status]").first().textContent()) === "Story 1 of 3, Leo",
      "anuncio en la región central",
    );
    ok(await root.locator('[data-stories-action="next-group"]').isDisabled(), "última persona: sin siguiente");
    await root.locator(".z-stories__nav[data-dir=next]").click();
    ok((await item()) === "Leo:1", "zona de paso avanza");
    await root.locator(".z-stories__nav[data-dir=prev]").click();
    ok((await item()) === "Leo:0", "zona de paso retrocede");
  });

  await test("Sin React: Lightbox con contador, flechas, zoom y Escape que devuelve el foco", async () => {
    const box = await inject(html("Lightbox"));
    await box
      .locator("#open-viewer-car-6, [id^=open-viewer]")
      .first()
      .evaluate((button) => {
        button.addEventListener("click", async () =>
          (await import("/zui/dist/zui.dom.js")).openLightbox(document.querySelector("[id^=viewer]"), 1),
        );
      });
    const opener = box.locator("[id^=open-viewer]");
    await opener.click();
    const dialog = page.locator("dialog.z-lightbox[open]");
    await until(async () => (await dialog.count()) === 1, "se abre");
    ok((await dialog.locator(".z-lightbox__counter").textContent()) === "2 / 3", "contador en la imagen pedida");
    await page.keyboard.press("ArrowRight");
    ok((await dialog.locator(".z-lightbox__counter").textContent()) === "3 / 3", "flecha derecha");
    await page.keyboard.press("ArrowRight");
    ok((await dialog.locator(".z-lightbox__counter").textContent()) === "1 / 3", "con bucle vuelve a la primera");
    await page.keyboard.press("+");
    ok((await dialog.getAttribute("data-zoomed")) !== null, "+ amplía");
    ok(!(await dialog.locator('[data-lightbox-action="zoom-out"]').isDisabled()), "reducir activo con zoom");
    await page.keyboard.press("0");
    ok((await dialog.getAttribute("data-zoomed")) === null, "0 restablece");
    await page.keyboard.press("Escape");
    await until(async () => (await page.locator("dialog.z-lightbox[open]").count()) === 0, "Escape cierra");
    await until(() => opener.evaluate((el) => el === document.activeElement), "el foco vuelve al disparador");
  });

  await test("Sin React: Gallery sincroniza miniaturas y abre el visor en la imagen actual", async () => {
    const box = await inject(html("Gallery"));
    const gallery = box.locator(".z-gallery");
    await until(async () => (await gallery.locator(".z-gallery__expand").count()) === 1, "botón de pantalla completa");
    await gallery.locator(".z-carousel__thumb").nth(2).click();
    await until(
      async () => (await gallery.locator(".z-carousel__thumb").nth(2).getAttribute("aria-current")) === "true",
      "miniatura actual",
    );
    await gallery.locator(".z-gallery__expand").click();
    const dialog = page.locator("dialog.z-lightbox[open]");
    await until(async () => (await dialog.count()) === 1, "visor abierto");
    ok((await dialog.locator(".z-lightbox__counter").textContent()) === "3 / 3", "en la imagen del carrusel");
    await page.keyboard.press("Escape");
    await until(async () => (await page.locator("dialog.z-lightbox[open]").count()) === 0, "cierra");
  });

  await test("Sin React: un patrón de skeleton vacío se expande, oculto a lectores y estable", async () => {
    const box = await inject(
      '<div aria-busy="true"><div class="z-skeleton-pattern" data-pattern="list" data-rows="3" data-avatar="false"></div><div class="z-skeleton-pattern" data-pattern="calendar"></div></div>',
    );
    const list = box.locator('[data-pattern="list"]');
    ok((await list.locator(".z-skeleton-pattern__row").count()) === 3, "tres filas");
    ok((await list.locator(".z-skeleton-pattern__avatar").count()) === 0, "sin avatar");
    ok((await list.getAttribute("aria-hidden")) === "true", "aria-hidden");
    ok((await box.locator('[data-pattern="calendar"] .z-skeleton-pattern__day').count()) === 42, "6 × 7 días");
    const contractList = contract.Skeleton.examples.find((e) => e.title === "Lista").html;
    const again = await inject('<div class="z-skeleton-pattern" data-pattern="list" data-rows="4"></div>');
    const expanded = await again.locator(".z-skeleton-pattern").evaluate((el) => el.innerHTML);
    const flat = (s) => s.replace(/\s+/g, "");
    ok(flat(contractList).includes(flat(expanded)), "el modo DOM da el mismo marcado que el contrato (React)");
  });
}
