// Modo gl del Carousel sin framework: las zonas curvas se dibujan en un lienzo WebGL2 a partir de la imagen
// que declara cada slide (data-raster) o que entrega carousel(el, { rasterize }). Los shaders viven en
// zui/dist/zui.dom.carousel-gl.js y solo se piden cuando un carrusel los necesita.
// Si el motor sin interfaz no da WebGL2, el dibujo no se puede comprobar: el caso se registra como
// "NO VERIFICABLE" y solo se prueba la caída a css.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const GL_FILE = "zui.dom.carousel-gl.js";

export default async function ({ page, test, ok, card, shots, browserName }) {
  const example = JSON.parse(readFileSync(join(root, "zui/html.json"), "utf8")).components.Carousel.examples[2];
  // Con WebGL por software (SwiftShader en Chrome) cada frame es lento y el muelle avanza como mucho 34 ms por frame:
  // las esperas son largas a propósito.
  const until = async (fn, arg, msg, timeout = 30000) => {
    try {
      await page.waitForFunction(fn, arg, { timeout });
    } catch {
      throw new Error(msg);
    }
  };
  const requested = [];
  page.on("request", (r) => {
    if (r.url().endsWith(GL_FILE)) requested.push(r.url());
  });
  const loadedBefore = await page.evaluate((file) => performance.getEntriesByType("resource").some((e) => e.name.endsWith(file)), GL_FILE);

  const support = await page.evaluate((useDebugInfo) => {
    const gl = document.createElement("canvas").getContext("webgl2");
    if (!gl) return null;
    // Firefox avisa por consola de que WEBGL_debug_renderer_info está obsoleta: ahí basta con RENDERER.
    const info = useDebugInfo ? gl.getExtension("WEBGL_debug_renderer_info") : null;
    return String(info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)) || "webgl2";
  }, browserName !== "firefox");

  const covers = "#covers";
  const mode = (sel) => page.evaluate((s) => document.querySelector(s)?.dataset.mode, sel);
  const active = (sel) =>
    page.evaluate((s) => Number(document.querySelector(`${s} .z-carousel__slide[data-active]`)?.dataset.index ?? -1), sel);
  const atRest = (sel, index) =>
    until(
      ([s, i]) => {
        const el = document.querySelector(s);
        const slide = el.querySelector(".z-carousel__slide[data-active]");
        if (!slide || Number(slide.dataset.index) !== i) return false;
        const vp = el.querySelector(".z-carousel__viewport").getBoundingClientRect();
        const r = slide.getBoundingClientRect();
        return (
          Math.abs(r.left + r.width / 2 - (vp.left + vp.width / 2)) < 2 &&
          !el.querySelector(".z-carousel__viewport").hasAttribute("data-dragging")
        );
      },
      [sel, index],
      `el slide ${index} no quedó centrado en ${sel}`,
    );

  // Tercer ejemplo del contrato, insertado después de cargar: hydrate() lo activa y después corre su script
  // tal como está documentado (pinta los lienzos con tokens y llama a refresh()).
  let mounted = false;
  const mount = async () => {
    if (mounted) return;
    mounted = true;
    await page.evaluate(
      async ([html, script]) => {
        const zui = await import("/zui/dist/zui.dom.js");
        const stage = document.querySelector('[data-component="Carousel"] .demo__stage');
        stage.insertAdjacentHTML("beforeend", html);
        window.__coversBefore = document.querySelector("#covers").innerHTML;
        window.__coversChanges = [];
        document.querySelector("#covers").addEventListener("z:change", (e) => window.__coversChanges.push(e.detail.index));
        zui.hydrate(stage);
        new Function("carousel", script)(zui.carousel);
      },
      [example.html, example.script.replace(/^import .*\n+/gm, "")],
    );
    await page.locator(`${covers} .z-carousel__viewport`).evaluate((el) => el.scrollIntoView({ block: "center" }));
  };
  // Carrusel suelto para los casos de caída a css y de la API.
  const inject = (id, slides, attrs = 'data-effect="lens" data-loop') =>
    page.evaluate(
      ([i, s, a]) => {
        const stage = document.querySelector('[data-component="Carousel"] .demo__stage');
        stage.insertAdjacentHTML(
          "beforeend",
          `<div id="${i}" class="z-carousel" data-z-carousel ${a} aria-label="${i}" style="--z-carousel-slide-width:240px">${s}</div>`,
        );
      },
      [id, slides, attrs],
    );
  const remove = (id) =>
    page.evaluate(async (i) => {
      const zui = await import("/zui/dist/zui.dom.js");
      const el = document.getElementById(i);
      if (!el) return;
      zui.carousel(el).destroy();
      el.remove();
    }, id);
  const plainCards = Array.from(
    { length: 4 },
    (_, i) => `<div class="z-card" data-variant="elevated" data-padding="md"><h3 class="z-card__title">Card ${i + 1}</h3></div>`,
  ).join("");
  const lensWarped = (sel) =>
    page
      .locator(`${sel} .z-carousel__slide[data-copy]:not([data-active])`)
      .evaluateAll((list) => list.some((el) => el.style.transform.startsWith("matrix3d")));

  await test("Carousel gl: los shaders no se cargan mientras ningún carrusel los pide", async () => {
    ok(!loadedBefore && requested.length === 0, `${GL_FILE} se pidió sin ningún carrusel en modo gl`);
    ok((await mode("#projects")) === "css", `el carrusel sin data-raster no está en css: ${await mode("#projects")}`);
    ok((await page.locator("#projects canvas").count()) === 0, "se creó un lienzo en un carrusel que no pide gl");
    const bundle = readFileSync(join(root, "zui/dist/zui.dom.js"), "utf8");
    ok(
      !bundle.includes("#version 300 es") && bundle.includes(`import("./${GL_FILE}")`),
      "zui.dom.js incrusta los shaders o no los importa bajo demanda",
    );
  });

  if (!support) {
    console.log(
      `· [${browserName}] no verificable: el motor sin interfaz no ofrece WebGL2 en esta máquina; el dibujo del modo gl no se puede comprobar`,
    );
    await test(`Carousel gl: NO VERIFICABLE en ${browserName} (sin WebGL2); data-raster cae a css`, async () => {
      await mount();
      await until((s) => document.querySelector(s)?.dataset.mode === "css", covers, `modo sin WebGL2: ${await mode(covers)}`);
      ok(await lensWarped(covers), "sin WebGL2 la lente css no deforma los slides laterales");
      await remove("covers");
    });
  } else {
    await test("Carousel gl: data-raster activa el modo gl, carga los shaders bajo demanda y crea el contexto WebGL2", async () => {
      await mount();
      await until(
        (s) => document.querySelector(s)?.dataset.mode === "gl",
        covers,
        `el carrusel con data-raster no entró en modo gl (${await mode(covers)}; WebGL2: ${support})`,
        15000,
      );
      ok(requested.length === 1, `${GL_FILE} pedido ${requested.length} veces`);
      const info = await page.evaluate((s) => {
        const el = document.querySelector(s);
        const canvas = el.querySelector(":scope > .z-carousel__viewport > canvas.z-carousel__canvas");
        const gl = canvas?.getContext("webgl2");
        const stage = el.querySelector(".z-carousel__stage");
        return {
          canvas: !!canvas,
          hidden: canvas?.getAttribute("aria-hidden"),
          gl: !!gl,
          lost: gl?.isContextLost(),
          error: gl?.getError(),
          w: canvas?.width,
          h: canvas?.height,
          visible: canvas && getComputedStyle(canvas).visibility,
          mask: stage.style.getPropertyValue("--z-carousel-lens-left") !== "",
          warped: [...el.querySelectorAll(".z-carousel__slide")].some((x) => x.style.transform),
          clones: el.querySelectorAll('.z-carousel__slide[aria-hidden="true"]').length,
          // La réplica de un <canvas> debe llevar el mismo dibujo que el original.
          cloneDrawn: [...el.querySelectorAll('.z-carousel__slide[aria-hidden="true"] canvas')].every(
            (c) => c.getContext("2d").getImageData(60, 60, 1, 1).data[3] > 0,
          ),
        };
      }, covers);
      ok(info.canvas && info.hidden === "true", "falta el lienzo .z-carousel__canvas o no es aria-hidden");
      ok(info.gl && !info.lost, "contexto WebGL2 perdido o ausente");
      ok(info.error === 0, `gl.getError() = ${info.error}`);
      ok(info.w > 100 && info.h > 100 && info.visible === "visible", `lienzo sin tamaño o no visible: ${JSON.stringify(info)}`);
      ok(info.mask && !info.warped, "en modo gl los slides reales no se deforman y la franja central lleva máscara");
      ok(info.clones >= 12 && info.cloneDrawn, `réplicas: ${info.clones}, con dibujo: ${info.cloneDrawn}`);
      console.log(`· [${browserName}] WebGL2: ${support}`);
    });

    await test("Carousel gl: el lienzo dibuja píxeles en las zonas curvas y gl.getError() sigue en 0", async () => {
      await mount();
      await until((s) => document.querySelector(s)?.dataset.mode === "gl", covers, "no está en modo gl", 15000);
      const start = await active(covers);
      const painted = await page.evaluate(async (s) => {
        const el = document.querySelector(s);
        const canvas = el.querySelector("canvas.z-carousel__canvas");
        // Sin preserveDrawingBuffer el lienzo solo se puede leer en el mismo frame en que se dibuja:
        // se lanza una animación y se muestrea dentro de requestAnimationFrame, tras el dibujo del motor.
        const sample = () => {
          const copy = document.createElement("canvas");
          copy.width = canvas.width;
          copy.height = canvas.height;
          const ctx = copy.getContext("2d");
          ctx.drawImage(canvas, 0, 0);
          const data = ctx.getImageData(0, 0, copy.width, copy.height).data;
          const third = Math.floor(copy.width / 3);
          let side = 0,
            centre = 0;
          for (let i = 0; i < data.length; i += 4 * 97) {
            if (data[i + 3] <= 8) continue;
            const x = (i / 4) % copy.width;
            if (x < third || x > copy.width - third) side++;
            else centre++;
          }
          return { side, centre };
        };
        el.querySelector('.z-carousel__arrow[aria-label="Next slide"]').click();
        let best = { side: 0, centre: 0 };
        for (let i = 0; i < 20; i++) {
          await new Promise((resolve) => requestAnimationFrame(resolve));
          const now = sample();
          if (now.side > best.side) best = now;
        }
        return { ...best, error: canvas.getContext("webgl2").getError() };
      }, covers);
      console.log(
        `· [${browserName}] muestras del lienzo con contenido durante la animación: ${painted.side} en los laterales, ${painted.centre} en el tercio central`,
      );
      ok(painted.side > 0, "el lienzo WebGL no dibujó ningún píxel en las zonas laterales durante la animación");
      ok(painted.error === 0, `gl.getError() tras dibujar = ${painted.error}`);
      await atRest(covers, (start + 1) % 6);
      // La captura es un artefacto, no una comprobación: con la máquina cargada, SwiftShader puede tardar más que el
      // tope de Playwright en dar dos fotogramas iguales, y eso no dice nada del carrusel.
      await card("Carousel")
        .screenshot({ path: join(shots, "carousel-gl.png"), timeout: 30000 })
        .catch(() => {});
    });

    await test("Carousel gl: flechas, teclado, arrastre con inercia y z:change", async () => {
      await mount();
      await until((s) => document.querySelector(s)?.dataset.mode === "gl", covers, "no está en modo gl", 15000);
      const api = await page.evaluateHandle(
        async (s) => (await import("/zui/dist/zui.dom.js")).carousel(document.querySelector(s)),
        covers,
      );
      await api.evaluate((a) => a.goTo(0));
      await atRest(covers, 0);
      await page.evaluate(() => {
        window.__coversChanges.length = 0;
      });
      const next = page.locator(`${covers} .z-carousel__arrow[aria-label="Next slide"]`);
      const prev = page.locator(`${covers} .z-carousel__arrow[aria-label="Previous slide"]`);
      // Activar la flecha sin la espera de «elemento estable» de Playwright (dos fotogramas con la misma caja, que con
      // WebGL por software y la máquina cargada puede pasar de 15 s); lo que se comprueba es el estado al que llega.
      const press = (arrow) => arrow.evaluate((el) => el.click());
      await press(next);
      await atRest(covers, 1);
      await until((s) => document.querySelector(`${s} .z-carousel__counter`)?.textContent === "02/06", covers, "contador tras la flecha");
      ok((await page.locator(`${covers} .z-carousel__live`).textContent()) === "Slide 2 of 6", "anuncio tras la flecha");
      await press(prev);
      await atRest(covers, 0);
      await press(prev);
      await atRest(covers, 5); // bucle
      await next.focus();
      await page.keyboard.press("ArrowRight");
      await atRest(covers, 0);
      await page.keyboard.press("End");
      await atRest(covers, 5);
      await page.keyboard.press("Home");
      await atRest(covers, 0);
      ok((await mode(covers)) === "gl", "la navegación sacó al carrusel del modo gl");

      // Arrastre real con el ratón sobre la franja central.
      await page.locator(`${covers} .z-carousel__viewport`).evaluate((el) => el.scrollIntoView({ block: "center" }));
      const box = await page.locator(`${covers} .z-carousel__viewport`).boundingBox();
      const x = box.x + box.width / 2,
        y = box.y + box.height / 2;
      await page.mouse.move(x, y);
      await page.mouse.down();
      for (let i = 1; i <= 8; i++) {
        await page.mouse.move(x - (360 * i) / 8, y);
        await page.waitForTimeout(12);
      }
      const dragging = await page.locator(`${covers} .z-carousel__viewport`).evaluate((el) => el.hasAttribute("data-dragging"));
      await page.mouse.up();
      ok(dragging, "el arrastre no marcó data-dragging");
      await until(
        (s) => document.querySelector(`${s} .z-carousel__slide[data-active]`)?.dataset.index !== "0",
        covers,
        "el arrastre no cambió de slide",
      );
      await until(
        (s) => {
          const el = document.querySelector(s);
          const slide = el.querySelector(".z-carousel__slide[data-active]");
          const vp = el.querySelector(".z-carousel__viewport").getBoundingClientRect();
          const r = slide.getBoundingClientRect();
          return Math.abs(r.left + r.width / 2 - (vp.left + vp.width / 2)) < 2;
        },
        covers,
        "la tira no se detuvo tras el arrastre",
      );
      const landed = await active(covers);
      ok(landed >= 1 && landed <= 3, `arrastre hacia la izquierda: slide ${landed}`);
      const changes = await page.evaluate(() => window.__coversChanges);
      ok(changes.length >= 6 && changes[changes.length - 1] === landed, `z:change: ${changes}`);
      const state = await page.evaluate((s) => {
        const gl = document.querySelector(`${s} canvas.z-carousel__canvas`).getContext("webgl2");
        return { error: gl.getError(), lost: gl.isContextLost() };
      }, covers);
      ok(state.error === 0 && !state.lost, `WebGL tras navegar: ${JSON.stringify(state)}`);
      ok((await mode(covers)) === "gl", "el arrastre sacó al carrusel del modo gl");
    });

    await test('Carousel gl: carousel(el, { rasterize }) y data-raster="#id" con slides HTML', async () => {
      await mount();
      // Slides con contenido HTML: la imagen sale de un lienzo de la página (por selector) o de rasterize().
      await inject("gl-api", plainCards);
      await inject(
        "gl-ref",
        Array.from(
          { length: 4 },
          () =>
            `<div class="z-card" data-variant="elevated" data-padding="md" data-raster="#covers canvas[data-raster]"><h3 class="z-card__title">Card</h3></div>`,
        ).join(""),
      );
      const calls = await page.evaluate(async () => {
        const zui = await import("/zui/dist/zui.dom.js");
        zui.hydrate(document.querySelector('[data-component="Carousel"] .demo__stage'));
        const source = document.querySelector("#covers canvas[data-raster]");
        window.__glCalls = [];
        const el = document.querySelector("#gl-api");
        const before = zui.carousel(el);
        const after = zui.carousel(el, {
          rasterize: (slide, index, size) => {
            window.__glCalls.push([slide.className, index, size.width > 0 && size.height > 0 && size.scale > 0]);
            return source;
          },
        });
        return before === after;
      });
      ok(calls, "carousel(el, opciones) no devolvió el mismo controlador");
      await until(
        () => document.querySelector("#gl-api")?.dataset.mode === "gl",
        null,
        `carousel(el, { rasterize }) no entró en modo gl (${await mode("#gl-api")})`,
        15000,
      );
      await until(
        () => document.querySelector("#gl-ref")?.dataset.mode === "gl",
        null,
        `data-raster="#selector" no entró en modo gl (${await mode("#gl-ref")})`,
        15000,
      );
      const glCalls = await page.evaluate(() => window.__glCalls);
      ok(
        glCalls.length >= 4 &&
          glCalls.every(([cls, , sized]) => cls.includes("z-carousel__slide") && sized) &&
          [0, 1, 2, 3].every((i) => glCalls.some((c) => c[1] === i)),
        `rasterize(slide, index, size): ${JSON.stringify(glCalls)}`,
      );
      ok(requested.length === 1, `${GL_FILE} pedido ${requested.length} veces: debe cargarse una sola vez`);
      await remove("gl-api");
      await remove("gl-ref");
    });

    await test("Carousel gl: cae a css si falta la textura de un slide o no hay WebGL2; destroy() retira el lienzo", async () => {
      await mount();
      // Un slide apunta a un elemento que no existe y otro carrusel recibe una imagen vacía.
      await inject(
        "gl-missing",
        plainCards
          .replace('data-padding="md"', 'data-padding="md" data-raster="#no-such-image"')
          .replaceAll(
            'class="z-card" data-variant="elevated" data-padding="md">',
            'class="z-card" data-variant="elevated" data-padding="md" data-raster="#covers canvas[data-raster]">',
          ),
      );
      await inject("gl-partial", plainCards.replace('class="z-card"', 'class="z-card" data-raster="#covers canvas[data-raster]"'));
      await inject("gl-nowebgl", plainCards);
      await page.evaluate(async () => {
        const zui = await import("/zui/dist/zui.dom.js");
        for (const id of ["gl-missing", "gl-partial"]) zui.carousel(document.getElementById(id));
        // Sin WebGL2: el lienzo no entrega contexto.
        const original = HTMLCanvasElement.prototype.getContext;
        window.__webgl2Asked = false;
        HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
          if (type === "webgl2") window.__webgl2Asked = true;
          return type === "webgl2" ? null : original.call(this, type, ...rest);
        };
        window.__restoreContext = () => {
          HTMLCanvasElement.prototype.getContext = original;
        };
        zui.carousel(document.getElementById("gl-nowebgl"), { rasterize: () => document.querySelector("#covers canvas[data-raster]") });
      });
      // Se devuelve getContext cuando #gl-nowebgl ya lo pidió (no tras un tiempo fijo): con la máquina cargada la
      // carga de los shaders tarda, y devolverlo antes haría que ese carrusel sí encontrase WebGL2.
      await until(() => window.__webgl2Asked === true, null, "el carrusel sin WebGL2 no llegó a pedir el contexto");
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      await page.evaluate(() => window.__restoreContext());
      for (const id of ["gl-missing", "gl-partial", "gl-nowebgl"]) {
        ok((await mode(`#${id}`)) === "css", `#${id}: modo ${await mode(`#${id}`)}, se esperaba css`);
        ok(await lensWarped(`#${id}`), `#${id}: la lente css no deforma los slides laterales`);
      }
      ok((await page.locator("#gl-partial canvas").count()) === 0, "se creó un lienzo aunque no todos los slides declaran imagen");
      ok(
        (await page.evaluate(() => getComputedStyle(document.querySelector("#gl-missing canvas.z-carousel__canvas")).visibility)) ===
          "hidden",
        "tras caer a css el lienzo sigue visible",
      );
      // Sigue navegando en css.
      await page.locator('#gl-missing .z-carousel__arrow[aria-label="Next slide"]').evaluate((el) => el.click());
      await atRest("#gl-missing", 1);
      for (const id of ["gl-missing", "gl-partial", "gl-nowebgl"]) await remove(id);

      ok(
        await page.evaluate(async () => {
          const zui = await import("/zui/dist/zui.dom.js");
          const el = document.querySelector("#covers");
          zui.carousel(el).destroy();
          const same = el.innerHTML === window.__coversBefore && !el.dataset.mode;
          el.remove();
          return same;
        }),
        "destroy() no devolvió el marcado original (lienzo, réplicas o data-mode)",
      );
    });
  }
}
