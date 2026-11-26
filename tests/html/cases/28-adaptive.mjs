// Layouts adaptativos sin framework (@zuccadev-labs/zuix-zout/dom): AdaptiveLayout (la hoja coloca por clase; el módulo
// mide, emite z:sizeclass, reordena el DOM en modo dom y avisa en modo visual), edición en vivo con setAdaptiveItem,
// AdaptiveSwitch, RTL y el Shell con la sidebar por clase.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const contract = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../../../zout/html.json"), "utf8")).components;

export default async function ({ page, test, ok }) {
  const until = async (fn, message, arg) => {
    try {
      await page.waitForFunction(fn, arg, { timeout: 3000 });
    } catch {
      throw new Error(message);
    }
  };
  /** Inyecta un ejemplo del contrato en una caja de ancho fijo y lo activa. */
  const inject = async (name, index, width, extra = {}) => {
    const id = `zad-${name}-${index}`;
    await page.evaluate(
      async ([html, wrap, w, dir]) => {
        document.getElementById(wrap)?.remove();
        // Al final del documento, fuera de la tarjeta (que se estrecha): el ancho de la caja es el que se pide.
        const box = document.createElement("div");
        box.id = wrap;
        box.style.inlineSize = `${w}px`;
        if (dir) box.dir = dir;
        box.innerHTML = html;
        window.__sizeEvents = [];
        box.addEventListener("z:sizeclass", (e) => window.__sizeEvents.push(e.detail.sizeClass));
        document.querySelector("[data-z-dom]").append(box);
        (await import("/zui/dist/zui.dom.js")).hydrate(box);
        (await import("/zout/dist/zout.dom.js")).hydrate(box);
      },
      [contract[name].examples[index].html, id, width, extra.dir ?? ""],
    );
    return id;
  };
  const resize = (id, width) => page.evaluate(([i, w]) => (document.getElementById(i).style.inlineSize = `${w}px`), [id, width]);
  const state = (id) =>
    page.evaluate((i) => {
      const layout = document.querySelector(`#${i} .z-adaptive`);
      const items = [...layout.querySelectorAll(":scope > .z-adaptive__grid > .z-adaptive__item")];
      const shown = items.filter((el) => getComputedStyle(el).display !== "none");
      const rtl = getComputedStyle(layout).direction === "rtl";
      const visual = [...shown]
        .sort((a, b) => {
          const [ra, rb] = [a.getBoundingClientRect(), b.getBoundingClientRect()];
          if (Math.abs(ra.top - rb.top) > 2) return ra.top - rb.top;
          return rtl ? rb.right - ra.right : ra.left - rb.left;
        })
        .map((el) => el.dataset.item);
      return { cls: layout.dataset.sizeClass, dom: shown.map((el) => el.dataset.item), visual };
    }, id);

  await test("AdaptiveLayout: la clase sale del contenedor, emite z:sizeclass y el DOM sigue el orden visual", async () => {
    const id = await inject("AdaptiveLayout", 0, 400);
    let s = await state(id);
    ok(s.cls === "compact", `400 px: compact (${s.cls})`);
    ok(s.dom.join() === "header,main,aside", `compacto, sin navegación: ${s.dom}`);
    await resize(id, 700);
    await until((i) => document.querySelector(`#${i} .z-adaptive`).dataset.sizeClass === "medium", "no pasó a medium", id);
    await resize(id, 1000);
    await until((i) => document.querySelector(`#${i} .z-adaptive`).dataset.sizeClass === "expanded", "no pasó a expanded", id);
    s = await state(id);
    ok(s.visual.join() === "nav,header,main,aside", `expanded: navegación a la izquierda (${s.visual})`);
    ok(s.dom.join() === s.visual.join(), `el DOM se reordena: ${s.dom}`);
    const events = await page.evaluate(() => window.__sizeEvents);
    ok(events.join() === "compact,medium,expanded", `z:sizeclass: ${events}`);
    // El foco recorre en el orden visual: el enlace de la navegación va antes que el botón de la columna lateral.
    await page.locator(`#${id} [data-item="nav"] button`).focus();
    await page.keyboard.press("Tab");
    ok(
      await page.evaluate((i) => document.activeElement === document.querySelector(`#${i} [data-item="aside"] button`), id),
      "Tab va de la navegación a Export",
    );
  });

  await test("AdaptiveLayout: la colocación ya está antes de JavaScript (solo CSS)", async () => {
    const box = await page.evaluate(
      ([html]) => {
        const wrap = document.createElement("div");
        wrap.style.inlineSize = "1000px";
        wrap.innerHTML = html;
        document.querySelector("[data-z-dom]").append(wrap);
        const r = (sel) => wrap.querySelector(sel).getBoundingClientRect();
        const out = {
          nav: r('[data-item="nav"]').left - r(".z-adaptive").left,
          main: r('[data-item="main"]').left - r(".z-adaptive").left,
          dom: [...wrap.querySelectorAll(".z-adaptive__item")].map((el) => el.dataset.item).join(),
        };
        wrap.remove();
        return out;
      },
      [contract.AdaptiveLayout.examples[0].html],
    );
    ok(box.nav < 2 && box.main > 150, `sin hidratar, nav a la izquierda y main a su lado: ${JSON.stringify(box)}`);
    ok(box.dom === "header,nav,main,aside", "sin JavaScript el DOM no se toca");
  });

  await test("AdaptiveLayout modo visual: z:ordermismatch y DOM intacto; setAdaptiveItem edita en vivo", async () => {
    const id = await inject("AdaptiveLayout", 0, 1000);
    await page.evaluate((i) => {
      const layout = document.querySelector(`#${i} .z-adaptive`);
      window.__mismatch = [];
      layout.addEventListener("z:ordermismatch", (e) => {
        e.preventDefault();
        window.__mismatch.push(e.detail.visual.join());
      });
      layout.dataset.reorder = "visual";
    }, id);
    // Se rehidrata para que el modo nuevo cuente.
    await page.evaluate(async (i) => (await import("/zout/dist/zout.dom.js")).hydrate(document.getElementById(i)), id);
    let s = await state(id);
    ok(s.dom.join() === "header,nav,main,aside", `modo visual: DOM de origen (${s.dom})`);
    ok((await page.evaluate(() => window.__mismatch)).includes("nav,header,main,aside"), "z:ordermismatch con el orden visual");
    // Editar: el aside pasa al área de la navegación desde expanded y la navegación se oculta ahí.
    await page.evaluate(async (i) => {
      const { setAdaptiveItem } = await import("/zout/dist/zout.dom.js");
      const root = document.getElementById(i);
      root.querySelector(".z-adaptive").dataset.reorder = "dom";
      setAdaptiveItem(root.querySelector('[data-item="nav"]'), { area: "nav", adaptive: { compact: { hidden: true } } });
      setAdaptiveItem(root.querySelector('[data-item="aside"]'), { area: "aside", adaptive: { expanded: { area: "nav" } } });
    }, id);
    s = await state(id);
    ok(s.visual.join() === "aside,header,main", `aside en el área nav y nav oculta: ${s.visual}`);
    ok(s.dom.join() === s.visual.join(), `DOM reordenado: ${s.dom}`);
  });

  await test("AdaptiveLayout en RTL: columnas reflejadas, mismo orden de lectura", async () => {
    const id = await inject("AdaptiveLayout", 0, 1000, { dir: "rtl" });
    const s = await state(id);
    ok(s.visual.join() === "nav,header,main,aside" && s.dom.join() === s.visual.join(), `orden lógico en RTL: ${s.visual}`);
    const [nav, main] = await Promise.all(["nav", "main"].map((k) => page.locator(`#${id} [data-item="${k}"]`).boundingBox()));
    ok(nav.x > main.x, `en RTL la navegación queda a la derecha: ${nav.x} > ${main.x}`);
  });

  await test("AdaptiveSwitch: la hoja muestra una variante por clase y z:sizeclass dice cuál", async () => {
    const id = await inject("AdaptiveSwitch", 0, 400);
    const visible = () =>
      page.evaluate(
        (i) =>
          [...document.querySelectorAll(`#${i} .z-adaptive-switch__variant`)]
            .filter((v) => v.firstElementChild?.checkVisibility())
            .map((v) => v.dataset.variant),
        id,
      );
    ok((await visible()).join() === "icon", `400 px: solo el icono (${await visible()})`);
    await page.locator(`#${id} button`).first().focus();
    await resize(id, 800);
    await until((i) => document.querySelector(`#${i} .z-adaptive-switch`).dataset.variant === "text", "no cambió a texto", id);
    ok((await visible()).join() === "text", `800 px: el botón con texto (${await visible()})`);
    await until(
      (i) => document.activeElement === document.querySelector(`#${i} .z-adaptive-switch__variant[data-variant="text"] button`),
      "el foco no pasó a la variante visible",
      id,
    );
  });

  await test("Shell con ajustes por clase: cajón, rail y acoplado sin framework", async () => {
    const id = await inject("Shell", 0, 1300);
    const ready = await page.evaluate(async (i) => {
      const root = document.getElementById(i);
      const side = root.querySelector(".z-shell__side");
      if (!side?.querySelector(".z-sidebar")) return false;
      side.setAttribute("data-adaptive", "");
      side.setAttribute("data-drawer-in", "compact");
      side.setAttribute("data-rail-in", "medium");
      (await import("/zout/dist/zout.dom.js")).hydrate(root);
      return true;
    }, id);
    ok(ready, "el ejemplo del Shell lleva una sidebar");
    const shell = `#${id} .z-shell`;
    await resize(id, 700);
    await until((s) => document.querySelector(s).dataset.sizeClass === "medium", "no pasó a medium", shell);
    ok(await page.locator(`${shell} .z-sidebar[data-collapsed]`).count(), "medium: la sidebar se pliega a rail");
    await resize(id, 500);
    await until((s) => document.querySelector(s).dataset.sizeClass === "compact", "no pasó a compact", shell);
    ok(await page.locator(`${shell} .z-shell__side`).isHidden(), "compact: cajón cerrado");
    await resize(id, 1000);
    await until((s) => document.querySelector(s).dataset.sizeClass === "expanded", "no pasó a expanded", shell);
    ok((await page.locator(`${shell} .z-sidebar[data-collapsed]`).count()) === 0, "expanded: se despliega al salir de rail");
  });

  await test("AdaptiveLayout acepta el marcado del editor visual (--z-adaptive-areas-* y data-z-adaptive)", async () => {
    const r = await page.evaluate(async () => {
      document.getElementById("zad-editor")?.remove();
      const box = document.createElement("div");
      box.id = "zad-editor";
      box.style.inlineSize = "1000px";
      box.innerHTML = `<div class="z-adaptive" data-measure="container" style='--z-adaptive-areas-compact: "a" "b"; --z-adaptive-areas-expanded: "b a"'>
        <div class="z-adaptive__grid">
          <div class="z-adaptive__item" data-item="a" data-z-adaptive='{"compact":{"area":"a"}}'><button type="button">A</button></div>
          <div class="z-adaptive__item" data-item="b" data-z-adaptive='{"compact":{"area":"b"},"medium":{"hidden":true},"expanded":{"hidden":false}}'><button type="button">B</button></div>
        </div></div>`;
      document.querySelector("[data-z-dom]").append(box);
      (await import("/zout/dist/zout.dom.js")).hydrate(box);
      const [a, b] = ["a", "b"].map((k) => box.querySelector(`[data-item="${k}"]`));
      return {
        cls: box.querySelector(".z-adaptive").dataset.sizeClass,
        bLeft: b.getBoundingClientRect().left < a.getBoundingClientRect().left,
        dom: [...box.querySelectorAll(".z-adaptive__item")].map((el) => el.dataset.item).join(),
        hiddenIn: b.getAttribute("data-hidden-in"),
      };
    });
    ok(r.cls === "expanded" && r.bLeft, `expanded: b a la izquierda de a (${JSON.stringify(r)})`);
    ok(r.dom === "b,a", `el DOM sigue el orden visual: ${r.dom}`);
    ok(r.hiddenIn === "medium", `oculto en medium: ${r.hiddenIn}`);
  });
}
