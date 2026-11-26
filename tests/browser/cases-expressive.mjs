// Binding de React de las variantes de Material 3 Expressive (sección «Material 3 Expressive» de `?screen=inputs`):
// onda quieta con movimiento reducido, grupo conectado que cambia la forma de la pulsada, Slider desde el centro con
// teclado, etiqueta flotante con autocompletado simulado, Modal a pantalla completa en el teléfono y el menú del FAB.
export default function ({ t, assert, poll }) {
  return [
    {
      name: "M3E (React) · Progress ondulado: la onda avanza y se queda quieta con movimiento reducido",
      async run({ open }) {
        let page = await open("inputs");
        const fill = page.locator(`${t("x3-progress")} .z-progress[data-variant="wavy"] .z-progress__fill`).first();
        await fill.scrollIntoViewIfNeeded();
        assert((await fill.evaluate((el) => getComputedStyle(el).animationName)).includes("z-wave-flow"), "la onda avanza");
        page = await open("inputs", { reducedMotion: "reduce" });
        const still = page.locator(`${t("x3-progress")} .z-progress[data-variant="wavy"] .z-progress__fill`).first();
        assert((await still.evaluate((el) => getComputedStyle(el).animationName)) === "none", "quieta con movimiento reducido");
      },
    },
    {
      name: "M3E (React) · ButtonGroup conectado: la pulsada recupera sus esquinas y se rellena; Slider desde el centro con flechas",
      async run({ open }) {
        const page = await open("inputs");
        const group = page.locator(t("x3-group"));
        await group.scrollIntoViewIfNeeded();
        const list = group.locator(".z-btn").first();
        await list.click();
        await poll(async () => (await list.getAttribute("aria-pressed")) === "true", "List pulsada");
        let radius = [];
        await poll(async () => {
          radius = await list.evaluate((el) => [
            parseFloat(getComputedStyle(el).borderStartEndRadius),
            parseFloat(getComputedStyle(el).borderStartStartRadius),
          ]);
          return radius[0] === radius[1];
        }, `la pulsada con sus cuatro esquinas: ${radius}`);
        const grid = group.locator(".z-btn").nth(1);
        const inner = await grid.evaluate((el) => parseFloat(getComputedStyle(el).borderStartStartRadius));
        assert(inner <= 6, `la suelta cierra su esquina interior: ${inner}`);
        const thumb = page.locator(`${t("x3-slider")} .z-slider__thumb`);
        await thumb.focus();
        for (let i = 0; i < 6; i++) await page.keyboard.press("ArrowRight");
        await poll(async () => (await page.locator(t("x3-balance")).textContent()) === "Balance 10", "las flechas cruzan el centro");
        const g = await page.locator(t("x3-slider")).evaluate((root) => {
          const track = root.querySelector(".z-slider__track").getBoundingClientRect();
          const range = root.querySelector(".z-slider__range").getBoundingClientRect();
          return { left: range.left - (track.left + track.width / 2), width: range.width / track.width };
        });
        assert(Math.abs(g.left) < 3 && Math.abs(g.width - 0.1) < 0.02, `la pista va del centro a +10: ${JSON.stringify(g)}`);
      },
    },
    {
      name: "M3E (React) · etiqueta flotante: en medio vacía, arriba con foco, con valor o con un valor puesto sin eventos (autocompletado)",
      async run({ open }) {
        const page = await open("inputs");
        const field = page.locator(`${t("x3-fields")} .z-field`).first();
        await field.scrollIntoViewIfNeeded();
        const input = page.locator(t("x3-email"));
        assert((await input.getAttribute("placeholder")) === " ", "Input pone un marcador vacío");
        const offset = async () => {
          const l = await field.locator(".z-field__label").boundingBox();
          const i = await field.locator(".z-input").boundingBox();
          return l.y + l.height / 2 - (i.y + i.height / 2);
        };
        assert(Math.abs(await offset()) < 3, "vacía: en medio");
        await input.focus();
        await poll(async () => (await offset()) < -8, "con foco: arriba");
        await input.blur();
        await poll(async () => Math.abs(await offset()) < 3, "sin foco y vacía: vuelve");
        await input.evaluate((el) => {
          el.value = "ana@example.com";
        });
        await poll(async () => (await offset()) < -8, "valor puesto sin eventos: arriba");
      },
    },
    {
      name: "M3E (React) · Modal a pantalla completa en el teléfono y menú del FAB que elige con el teclado",
      async run({ open }) {
        const phone = await open("inputs", { width: 390, height: 800 });
        await phone.locator(t("x3-open")).scrollIntoViewIfNeeded();
        await phone.locator(t("x3-open")).click();
        const dialog = phone.locator("dialog.z-modal[open]");
        await poll(async () => (await dialog.count()) === 1, "abre");
        await phone.waitForTimeout(350);
        const r = await dialog.boundingBox();
        assert(Math.abs(r.width - 390) < 2 && Math.abs(r.height - 800) < 2, `ocupa la ventana: ${r.width}×${r.height}`);
        await phone.keyboard.press("Escape");
        const desk = await open("inputs");
        await desk.locator(t("x3-open")).scrollIntoViewIfNeeded();
        await desk.locator(t("x3-open")).click();
        const d = desk.locator("dialog.z-modal[open]");
        await poll(async () => (await d.count()) === 1, "abre en escritorio");
        assert((await d.boundingBox()).width < 700, "en escritorio sigue siendo un diálogo");
        await desk.keyboard.press("Escape");
        const fab = desk.locator(`${t("x3-overlays")} .z-fab`);
        await fab.click();
        await poll(async () => (await fab.getAttribute("aria-expanded")) === "true", "abre el menú");
        await poll(
          async () => (await fab.locator('svg[data-icon="plus"]').evaluate((el) => getComputedStyle(el).rotate)) === "45deg",
          "el «+» gira",
        );
        await desk.keyboard.press("ArrowDown");
        await desk.keyboard.press("Enter");
        await poll(async () => /Created: (doc|image)/.test((await desk.locator(t("x3-action")).textContent()) ?? ""), "elige una acción");
      },
    },
  ];
}
