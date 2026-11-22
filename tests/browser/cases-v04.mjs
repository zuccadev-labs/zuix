// v0.4, oleada 1, en el binding de React (pantalla `?screen=carousels` de examples/app): Prisma con bucle sin réplicas,
// progreso del pase automático, multi-browse, mazo, Stories, Gallery con Lightbox y skeletons.
export default function ({ t, assert, poll }) {
  const screen = (open, options) => open("carousels", options);
  const activeOf = (page, id) =>
    page
      .locator(`${t(id)} .z-carousel__slide[data-active]`)
      .first()
      .getAttribute("data-index");

  return [
    {
      name: "v0.4 · Carousel prism: bucle sin réplicas con order, anuncio tras asentarse y teclado (React)",
      async run({ open }) {
        const page = await screen(open);
        const root = `${t("c-prism")} .z-carousel`;
        await page.locator(root).scrollIntoViewIfNeeded();
        assert((await page.locator(`${root} .z-carousel__slide`).count()) === 6, "sin réplicas");
        assert((await page.locator(`${root} [inert]`).count()) === 0, "ningún slide inerte");
        assert((await page.getAttribute(root, "data-effect")) === "prism", "efecto");
        const order = await page
          .locator(`${root} .z-carousel__slide`)
          .evaluateAll((els) => els.map((el) => getComputedStyle(el).order).join(","));
        assert(order === "0,0,0,0,0,-1", `el último aparcado delante: ${order}`);
        await page.click(`${root} .z-carousel__arrow[aria-label="Previous slide"]`);
        await poll(async () => (await activeOf(page, "c-prism")) === "5", "anterior desde el primero lleva al último");
        await poll(
          async () => (await page.locator(`${root} .z-carousel__live`).textContent()) === "Slide 6 of 6",
          "anuncia tras asentarse",
        );
        await poll(async () => (await page.locator(t("c-prism-index")).textContent()) === "Index 5", "onIndexChange");
        await page.locator(`${root} .z-carousel__viewport`).focus();
        await page.keyboard.press("ArrowRight");
        await poll(async () => (await activeOf(page, "c-prism")) === "0", "flecha derecha da la vuelta al primero");
        await page.keyboard.press("End");
        await poll(async () => (await activeOf(page, "c-prism")) === "5", "Fin");
        const reduced = await screen(open, { reducedMotion: "reduce" });
        const r = `${t("c-prism")} .z-carousel__slide[data-active] .z-carousel__face`;
        await reduced.locator(r).scrollIntoViewIfNeeded();
        const transform = await reduced
          .locator(`${t("c-prism")} .z-carousel__face`)
          .nth(1)
          .evaluate((el) => getComputedStyle(el).transform);
        assert(transform === "none", `con movimiento reducido, sin giro: ${transform}`);
      },
    },
    {
      name: "v0.4 · Carousel indicators=progress: el punto actual crece y se llena durante el intervalo (React)",
      async run({ open }) {
        const page = await screen(open);
        const root = `${t("c-progress")} .z-carousel`;
        await page.locator(root).scrollIntoViewIfNeeded();
        await page.mouse.move(5, 5);
        await poll(async () => (await page.getAttribute(root, "data-autoplay-state")) === "playing", "en marcha");
        const fill = () =>
          page.locator(`${root} .z-carousel__dot[aria-current="true"]`).evaluate((el) => getComputedStyle(el, "::before").backgroundImage);
        const a = await fill();
        await page.waitForTimeout(400);
        const b = await fill();
        assert(a !== b, "el llenado avanza");
        const start = await activeOf(page, "c-progress");
        await poll(async () => (await activeOf(page, "c-progress")) !== start, "avanza solo", 6000);
      },
    },
    {
      name: "v0.4 · Carousel multi-browse: máscaras por keylines y final alcanzable (React)",
      async run({ open }) {
        const page = await screen(open);
        const root = `${t("c-browse")} .z-carousel`;
        await page.locator(root).scrollIntoViewIfNeeded();
        await poll(
          async () =>
            (await page
              .locator(`${root} .z-carousel__slide`)
              .last()
              .evaluate((el) => Number.parseFloat(el.style.getPropertyValue("--z-kl-inset")))) > 0,
          "el último recortado",
        );
        await page.locator(`${root} .z-carousel__viewport`).focus();
        await page.keyboard.press("End");
        await poll(
          () => page.locator(`${root} .z-carousel__arrow[aria-label="Next slide"]`).isDisabled(),
          "siguiente desactivado al final",
        );
      },
    },
    {
      name: "v0.4 · Carousel stack: solo la tarjeta de arriba es interactiva; flechas la cambian (React)",
      async run({ open }) {
        const page = await screen(open);
        const root = `${t("c-stack")} .z-carousel`;
        await page.locator(root).scrollIntoViewIfNeeded();
        const inert = () => page.locator(`${root} .z-carousel__slide`).evaluateAll((els) => els.map((el) => (el.inert ? 1 : 0)).join(""));
        await poll(async () => (await inert()) === "011", "las de detrás, inertes");
        await page.click(`${root} .z-carousel__arrow[aria-label="Next slide"]`);
        await poll(async () => (await inert()) === "101", "siguiente");
        await poll(async () => (await page.locator(`${root} .z-carousel__live`).textContent()) === "Slide 2 of 3", "anuncio");
      },
    },
    {
      name: "v0.4 · Stories: avanzan solas, pausa con aria-pressed, salto de persona y región central (React)",
      async run({ open }) {
        const page = await screen(open);
        const root = `${t("c-stories")} .z-stories`;
        await page.locator(root).scrollIntoViewIfNeeded();
        const item = () =>
          page.locator(root).evaluate((el) => {
            const g = el.querySelector(".z-stories__group[data-active]");
            return `${g?.dataset.author}:${[...(g?.querySelectorAll(".z-stories__item") ?? [])].findIndex((i) => i.hasAttribute("data-active"))}`;
          });
        await poll(async () => (await item()) === "Ana:1", "pasa sola", 4000);
        await page.click(`${root} [data-stories-action="pause"]`);
        await poll(async () => (await page.getAttribute(`${root} [data-stories-action="pause"]`, "aria-pressed")) === "true", "pausa");
        await page.click(`${root} [data-stories-action="next-group"]`);
        await poll(async () => (await item()) === "Leo:0", "siguiente persona");
        await poll(
          async () => (await page.locator("[data-z-announcer] [role=status]").first().textContent()) === "Story 1 of 3, Leo",
          "anuncio central",
        );
        const reduced = await screen(open, { reducedMotion: "reduce" });
        await reduced.locator(root).scrollIntoViewIfNeeded();
        await reduced.waitForTimeout(1500);
        assert((await reduced.getAttribute(root, "data-state")) === "paused", "con movimiento reducido empieza en pausa");
      },
    },
    {
      name: "v0.4 · Gallery + Lightbox: abre en la imagen actual, flechas, zoom y Escape devuelve el foco (React)",
      async run({ open }) {
        const page = await screen(open);
        const root = t("c-gallery");
        await page.locator(root).scrollIntoViewIfNeeded();
        await page.click(`${root} .z-carousel__thumb >> nth=2`);
        await poll(async () => (await page.getAttribute(`${root} .z-carousel__thumb >> nth=2`, "aria-current")) === "true", "miniatura");
        await page.click(`${root} .z-gallery__expand`);
        await poll(() => page.locator("dialog.z-lightbox").evaluate((d) => d.open && d.matches(":modal")), "visor modal");
        await poll(async () => (await page.locator(".z-lightbox__counter").textContent()) === "3 / 6", "imagen actual");
        await page.keyboard.press("ArrowRight");
        await poll(async () => (await page.locator(".z-lightbox__counter").textContent()) === "4 / 6", "flecha");
        await page.keyboard.press("+");
        await poll(async () => (await page.locator("dialog.z-lightbox").getAttribute("data-zoomed")) !== null, "zoom");
        await page.keyboard.press("Escape");
        await poll(async () => (await page.locator("dialog.z-lightbox").count()) === 0, "cierra");
        await poll(() => page.locator(`${root} .z-gallery__expand`).evaluate((el) => el === document.activeElement), "foco al botón");
      },
    },
    {
      name: "v0.4 · Skeletons: aria-busy en el grupo, huesos ocultos, contenido envuelto con su tamaño (React)",
      async run({ open }) {
        const page = await screen(open);
        const group = t("c-skeletons");
        await page.locator(group).scrollIntoViewIfNeeded();
        assert((await page.getAttribute(group, "aria-busy")) === "true", "aria-busy");
        assert((await page.locator(`${group} .z-skeleton-pattern[aria-hidden="true"]`).count()) === 3, "tres patrones ocultos");
        const wrapper = `${group} .z-skeleton[data-loading]`;
        assert((await page.getAttribute(wrapper, "aria-hidden")) === "true", "envoltorio oculto");
        const box = await page.locator(wrapper).boundingBox();
        await page.click(t("c-skeleton-toggle"));
        await poll(async () => (await page.getAttribute(group, "aria-busy")) === null, "sin aria-busy al cargar");
        const real = await page.locator(t("c-skeleton-wrapped")).boundingBox();
        assert(Math.abs(real.width - box.width) < 1 && Math.abs(real.height - box.height) < 1, "mismo tamaño: sin saltos");
        const reduced = await screen(open, { reducedMotion: "reduce" });
        const anim = await reduced
          .locator(`${group} .z-skeleton`)
          .first()
          .evaluate((el) => getComputedStyle(el).animationName);
        assert(anim === "none", `sin brillo con movimiento reducido: ${anim}`);
      },
    },
  ];
}
