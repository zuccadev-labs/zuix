// Sin React, variantes de Material 3 Expressive desde el contrato HTML: Progress y CircularProgress ondulados (y quietos
// con movimiento reducido), botón tonal, ButtonGroup conectado, Slider desde el centro (también en RTL), etiqueta
// flotante (vacía, con foco, con valor y con un valor puesto sin eventos, como el autocompletado), Modal a pantalla
// completa solo en ventanas compactas y el menú del FAB.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const contract = JSON.parse(readFileSync(join(here, "../../../zui/html.json"), "utf8")).components;

export default async function ({ page, test, ok }) {
  const example = (name, title) => {
    const c = contract[name];
    const hit = (c.html ?? []).find((h) => h.title === title) ?? c.examples.find((e) => e.title === title);
    if (!hit) throw new Error(`${name}: no hay ejemplo «${title}»`);
    return hit.code ?? hit.html;
  };
  const inject = async (markup, dir = "ltr") => {
    await page.evaluate(
      async ([raw, d]) => {
        for (const old of document.querySelectorAll("[data-x3-layer]")) old.remove();
        const box = document.createElement("div");
        box.id = "x3-box";
        box.dir = d;
        box.setAttribute("data-z-dom", "");
        box.setAttribute("data-x3-layer", "");
        box.innerHTML = raw;
        Object.assign(box.style, {
          position: "fixed",
          inset: "0",
          zIndex: "2147483000",
          overflow: "auto",
          padding: "24px",
          background: "Canvas",
        });
        document.querySelector(".page__main").append(box);
        (await import("/zui/dist/zui.dom.js")).hydrate(box);
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      },
      [markup, dir],
    );
    return page.locator("#x3-box");
  };
  const until = async (fn, message, tries = 60) => {
    for (let i = 0; i < tries; i++) {
      if (await fn()) return;
      await page.waitForTimeout(50);
    }
    ok(false, message);
  };

  await test("M3E sin React · Progress y CircularProgress ondulados: onda con máscara que avanza, hueco antes de lo que falta, y quietos con movimiento reducido", async () => {
    const box = await inject(`${example("Progress", "Ondulada")}${example("CircularProgress", "Ondulado")}`);
    const bar = box.locator('.z-progress[data-variant="wavy"]').first();
    const fill = bar.locator(".z-progress__fill");
    const info = await fill.evaluate((el) => {
      const cs = getComputedStyle(el);
      const track = el.parentElement.getBoundingClientRect();
      const rest = getComputedStyle(el.parentElement, "::before");
      return {
        mask: cs.maskImage,
        anim: cs.animationName,
        width: el.getBoundingClientRect().width / track.width,
        rest: rest.insetInlineStart,
      };
    });
    ok(/radial-gradient/.test(info.mask), `la onda es una máscara: ${info.mask.slice(0, 60)}`);
    ok(info.anim.includes("z-wave-flow"), `la onda avanza: ${info.anim}`);
    ok(Math.abs(info.width - 0.64) < 0.02, `lo hecho mide el 64 %: ${info.width}`);
    ok(/calc|px/.test(info.rest) && parseFloat(info.rest) > 0, `lo que falta empieza tras el hueco: ${info.rest}`);
    const ring = box.locator('.z-progress-ring[data-variant="wavy"]').first();
    ok((await ring.locator("progress").getAttribute("aria-label")) === "Upload", "el <progress> sigue siendo el control con nombre");
    const dash = await ring.locator(".z-progress-ring__arc").evaluate((el) => getComputedStyle(el).strokeDasharray);
    ok(/^72(px)?,?\s/.test(dash), `el arco ondulado mide 72 de 100: ${dash}`);
    await page.emulateMedia({ reducedMotion: "reduce" });
    try {
      ok((await fill.evaluate((el) => getComputedStyle(el).animationName)) === "none", "con movimiento reducido la onda se queda quieta");
    } finally {
      await page.emulateMedia({ reducedMotion: "no-preference" });
    }
  });

  await test("M3E sin React · botón tonal y grupo conectado: esquinas interiores cerradas, 2 px entre piezas y la pulsada con sus cuatro esquinas y relleno", async () => {
    const box = await inject(`${example("Button", "Tonal")}${example("ButtonGroup", "Conectado")}`);
    const tonal = box.locator(".z-btn--tonal");
    const secondary = box.locator(".z-btn--secondary").first();
    const [tb, sb] = await Promise.all([
      tonal.evaluate((el) => getComputedStyle(el).backgroundColor),
      secondary.evaluate((el) => getComputedStyle(el).backgroundColor),
    ]);
    ok(tb !== sb, `el tonal tiene su relleno: ${tb} frente a ${sb}`);
    const pieces = box.locator(".z-btn-group[data-connected] > .z-btn");
    const shape = await pieces.evaluateAll((els) =>
      els.map((el) => {
        const cs = getComputedStyle(el);
        return {
          start: parseFloat(cs.borderStartStartRadius),
          end: parseFloat(cs.borderStartEndRadius),
          pressed: el.getAttribute("aria-pressed"),
          x: el.getBoundingClientRect(),
        };
      }),
    );
    ok(shape[0].end < shape[0].start, `la primera cierra su esquina interior: ${JSON.stringify(shape[0])}`);
    ok(
      shape[1].pressed === "true" && shape[1].start === shape[1].end && shape[1].start === shape[0].start,
      `la pulsada recupera sus esquinas: ${JSON.stringify(shape)}`,
    );
    ok(Math.round(shape[1].x.left - shape[0].x.right) === 2, `2 px entre piezas: ${shape[1].x.left - shape[0].x.right}`);
  });

  await test("M3E sin React · Slider desde el centro: la pista va del punto medio al valor, cruza el centro con el teclado y se refleja en RTL", async () => {
    for (const dir of ["ltr", "rtl"]) {
      const box = await inject(example("Slider", "Desde el centro"), dir);
      const geometry = () =>
        box.evaluate((root) => {
          const track = root.querySelector(".z-slider__track").getBoundingClientRect();
          const range = root.querySelector(".z-slider__range").getBoundingClientRect();
          const mid = track.left + track.width / 2;
          return {
            left: range.left - mid,
            right: range.right - mid,
            width: track.width,
            value: root.querySelector(".z-slider").dataset.value,
          };
        });
      let g = await geometry();
      // -20 de -50…50: un 20 % del ancho hacia el lado del mínimo (izquierda en LTR, derecha en RTL).
      const side = dir === "ltr" ? -1 : 1;
      ok(
        Math.abs((dir === "ltr" ? g.left : g.right) - side * 0.2 * g.width) < 3 && Math.abs(dir === "ltr" ? g.right : g.left) < 3,
        `${dir}: del centro al valor ${JSON.stringify(g)}`,
      );
      await box.locator(".z-slider__thumb").focus();
      for (let i = 0; i < 8; i++) await page.keyboard.press(dir === "ltr" ? "ArrowRight" : "ArrowLeft");
      await until(async () => {
        g = await geometry();
        return g.value === "20";
      }, `${dir}: el teclado lleva a 20`);
      ok(
        Math.abs((dir === "ltr" ? g.right : g.left) - -side * 0.2 * g.width) < 3,
        `${dir}: tras cruzar el centro, al otro lado ${JSON.stringify(g)}`,
      );
    }
  });

  await test("M3E sin React · etiqueta flotante: dentro del campo vacío, arriba con foco, con valor o con un valor puesto sin eventos (autocompletado), y sigue nombrando al control", async () => {
    const box = await inject(example("Field", "Etiqueta flotante con autocompletado"));
    const field = box.locator(".z-field").first();
    const label = field.locator(".z-field__label");
    const input = field.locator("input");
    const where = async () => {
      const l = await label.boundingBox();
      const i = await field.locator(".z-input").boundingBox();
      return {
        center: l.y + l.height / 2 - (i.y + i.height / 2),
        size: await label.evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
      };
    };
    const rest = await where();
    ok(Math.abs(rest.center) < 3, `vacío y sin foco: la etiqueta en medio del campo (${rest.center})`);
    await input.focus();
    await until(async () => (await where()).center < -8, "con foco, la etiqueta sube");
    const up = await where();
    ok(up.size < rest.size, `arriba, más pequeña: ${up.size} < ${rest.size}`);
    await page.keyboard.type("ana@example.com");
    await input.blur();
    await until(async () => (await where()).center < -8, "con valor, sigue arriba");
    await input.fill("");
    await input.blur();
    await until(async () => Math.abs((await where()).center) < 3, "vacía otra vez, vuelve al medio");
    // El autocompletado escribe el valor sin teclado: se simula fijando `value` desde fuera.
    await input.evaluate((el) => {
      el.value = "ana@example.com";
    });
    await until(async () => (await where()).center < -8, "un valor puesto sin eventos sube la etiqueta");
    const linked = await label.evaluate((el, id) => el.htmlFor === id && el.tagName === "LABEL", await input.getAttribute("id"));
    ok(linked && (await label.textContent()).trim() === "Email", "el <label for> sigue nombrando al control");
    const icon = box.locator(".z-field").nth(1);
    const [lb, ib] = await Promise.all([icon.locator(".z-field__label").boundingBox(), icon.locator(".z-input__icon").boundingBox()]);
    ok(lb.x >= ib.x + ib.width, "con icono, la etiqueta empieza tras él");
  });

  await test("M3E sin React · Modal a pantalla completa solo en ventana compacta, y menú del FAB sin panel con el «+» que gira", async () => {
    const viewport = page.viewportSize();
    try {
      for (const width of [390, 1000]) {
        await page.setViewportSize({ width, height: 800 });
        const box = await inject(example("Modal", "A pantalla completa en el teléfono"));
        await box.locator("[data-z-open]").click();
        const dialog = page.locator("#new-event");
        await until(async () => await dialog.evaluate((el) => el.open), `${width}: abre`);
        await page.waitForTimeout(350);
        const r = await dialog.boundingBox();
        const full = Math.abs(r.width - width) < 2 && Math.abs(r.height - 800) < 2;
        ok(
          width === 390 ? full : !full,
          `${width}: ${width === 390 ? "ocupa toda la ventana" : "sigue siendo un diálogo"} (${r.width}×${r.height})`,
        );
        const footer = await dialog.locator(".z-modal__footer").boundingBox();
        if (width === 390) ok(Math.abs(footer.y + footer.height - 800) < 2, "el pie queda abajo");
        await page.keyboard.press("Escape");
        await until(async () => !(await dialog.evaluate((el) => el.open)), `${width}: cierra`);
      }
    } finally {
      await page.setViewportSize(viewport);
    }
    const box = await inject(example("FabMenu", "Crear").replaceAll("fab-actions", "x3-fab-actions"));
    const fab = box.locator(".z-fab");
    await fab.click();
    const menu = box.locator(".z-fab-menu");
    await until(async () => await menu.evaluate((el) => el.matches(":popover-open")), "abre el menú");
    const look = await menu.evaluate((el) => {
      const item = el.querySelector(".z-menu__item");
      const cs = getComputedStyle(item);
      return {
        panel: getComputedStyle(el).backgroundColor,
        radius: parseFloat(cs.borderTopLeftRadius),
        height: item.getBoundingClientRect().height,
        bg: cs.backgroundColor,
      };
    });
    ok(look.panel === "rgba(0, 0, 0, 0)", `sin panel: ${look.panel}`);
    ok(look.radius > 4 && look.radius < look.height / 2, `acciones con esquinas redondeadas, no píldora: ${look.radius} en ${look.height}`);
    ok(look.bg !== "rgba(0, 0, 0, 0)", "cada acción con su relleno opaco");
    const rotate = await fab.locator('svg[data-icon="plus"]').evaluate((el) => getComputedStyle(el).rotate);
    ok(rotate === "45deg", `el «+» gira a cierre: ${rotate}`);
    await page.keyboard.press("Escape");
  });
}
