// Auditoría previa a la 0.2.0 del CSS de zui sobre la página sin framework: colores forzados, más contraste,
// RTL y tamaño de objetivo (WCAG 2.2, 2.5.8). Cada caso deja la página como la encontró.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Los layouts de zout comparten página pero no son de este frente: su tamaño de objetivo se anota, no se exige aquí.
const ZOUT = Object.keys(
  JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../../../zout/html.json"), "utf8")).components,
);

export default async function ({ page, test, ok, settle, browserName, note, Unverifiable }) {
  const media = async (features) => {
    try {
      await page.emulateMedia(features);
    } catch (error) {
      throw new Unverifiable(`${browserName} no emula ${Object.keys(features).join(", ")}: ${String(error.message).split("\n")[0]}`);
    }
  };
  const reset = () => page.emulateMedia({ forcedColors: null, contrast: null }).catch(() => {});

  await test("forced-colors: el foco de teclado se ve en todos los controles y los estados no dependen solo del fondo", async () => {
    await media({ forcedColors: "active" });
    try {
      if (!(await page.evaluate(() => matchMedia("(forced-colors: active)").matches)))
        throw new Unverifiable(`${browserName} no aplica forced-colors emulado`);
      const report = await page.evaluate(() => {
        const visible = (el) => {
          const r = el.getBoundingClientRect();
          return (
            r.width > 0 &&
            r.height > 0 &&
            getComputedStyle(el).visibility !== "hidden" &&
            !el.closest("[hidden], [inert], dialog:not([open]), [popover]:not(:popover-open)")
          );
        };
        const focusable = [
          ...document.querySelectorAll("main :is(button, a[href], input:not([type=hidden]), select, textarea, [tabindex='0'])"),
        ].filter((el) => !el.disabled && visible(el) && !el.classList.contains("z-sr-only"));
        const missing = [];
        let checked = 0;
        for (const el of focusable) {
          el.focus({ preventScroll: true, focusVisible: true });
          if (document.activeElement !== el || !el.matches(":focus-visible")) continue;
          checked += 1;
          // El anillo puede llevarlo el control o su envoltura (campo de texto, select).
          const ring = [el, el.closest(".z-input, .z-select, .z-upload")].filter(Boolean).some((node) => {
            const s = getComputedStyle(node);
            return s.outlineStyle !== "none" && parseFloat(s.outlineWidth) >= 2;
          });
          if (!ring)
            missing.push(`${el.closest("[data-component]")?.dataset.component}: <${el.tagName.toLowerCase()} class="${el.className}">`);
        }
        document.activeElement?.blur();
        const bg = (el) => (el ? getComputedStyle(el).backgroundColor : null);
        const pairs = {
          tabs: [
            bg(document.querySelector('.z-tabs__tab[data-state="active"]')),
            bg(document.querySelector('.z-tabs__tab[data-state="inactive"]')),
          ],
          segmented: [
            bg(document.querySelector('.z-segmented__item[data-state="on"]')),
            bg(document.querySelector('.z-segmented__item[data-state="off"]')),
          ],
          switch: [
            bg(document.querySelector('.z-switch__track[data-state="checked"]')),
            bg(document.querySelector('.z-switch__track[data-state="unchecked"]')),
          ],
          pagination: [
            bg(document.querySelector('.z-pagination__btn[aria-current="page"]')),
            bg(document.querySelector(".z-pagination__btn:not([aria-current])")),
          ],
        };
        const same = Object.entries(pairs)
          .filter(([, [on, off]]) => on && off && on === off)
          .map(([name]) => name);
        const fill = document.querySelector(".z-progress__fill, .z-meter__fill");
        return { total: checked, missing: [...new Set(missing)], same, fill: fill ? bg(fill) !== bg(fill.parentElement) : true };
      });
      if (report.total < 50)
        throw new Unverifiable(
          `${browserName} no deja forzar :focus-visible por código (focus({ focusVisible })): solo ${report.total} controles comprobados`,
        );
      note(`${report.total} controles enfocables comprobados`);
      ok(
        report.missing.length === 0,
        `${report.missing.length} controles sin anillo de foco en colores forzados: ${report.missing.slice(0, 20).join(" ‖ ")}`,
      );
      ok(report.same.length === 0, `estados que no se distinguen en colores forzados: ${report.same.join(", ")}`);
      ok(report.fill, "el relleno de Progress/Meter no se distingue de su pista");
    } finally {
      await reset();
    }
  });

  await test("prefers-contrast: more → el cristal pasa a superficie sólida y el foco engorda", async () => {
    await media({ contrast: "more" });
    try {
      if (!(await page.evaluate(() => matchMedia("(prefers-contrast: more)").matches)))
        throw new Unverifiable(`${browserName} no aplica prefers-contrast emulado`);
      const state = await page.evaluate(() => {
        const glass = document.querySelector(".z-liquid");
        const style = getComputedStyle(glass);
        const button = document.querySelector("main .z-btn");
        button.focus({ focusVisible: true });
        const width = getComputedStyle(button).outlineWidth;
        button.blur();
        return { filter: style.backdropFilter || style.webkitBackdropFilter, width };
      });
      ok(state.filter === "none", `con más contraste el cristal no debe desenfocar (${state.filter})`);
      ok(parseFloat(state.width) >= 3, `con más contraste el anillo de foco debe medir al menos 3 px (${state.width})`);
    } finally {
      await reset();
    }
  });

  await test("RTL: sin desbordamiento, cierre del diálogo al final de la línea e iconos direccionales reflejados", async () => {
    await page.evaluate(() => {
      document.documentElement.dir = "rtl";
    });
    try {
      await settle();
      const state = await page.evaluate(() => {
        const flipped = (selector) => {
          const el = document.querySelector(selector);
          return el ? new DOMMatrix(getComputedStyle(el).transform).a < 0 : null;
        };
        return {
          overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
          breadcrumb: flipped(".z-breadcrumb__separator svg.z-icon"),
          pagination: flipped(".z-pagination__btn svg.z-icon"),
          callout: (() => {
            const el = document.querySelector(".z-callout");
            if (!el) return null;
            const s = getComputedStyle(el);
            return parseFloat(s.borderRightWidth) > parseFloat(s.borderLeftWidth);
          })(),
          align: getComputedStyle(document.querySelector(".z-menu__text, .z-navlink") ?? document.body).textAlign,
        };
      });
      ok(!state.overflow, "desbordamiento horizontal en RTL");
      ok(state.breadcrumb !== false && state.pagination !== false, `iconos direccionales sin reflejar: ${JSON.stringify(state)}`);
      ok(state.callout !== false, "el borde de acento del Callout debe quedar al inicio de la línea (derecha en RTL)");
      ok(["start", "right"].includes(state.align), `alineación de texto física en RTL (${state.align})`);
      await page.locator("[data-z-open='#edit-profile']").click();
      await settle();
      const close = await page.evaluate(() => {
        const d = document.querySelector("#edit-profile").getBoundingClientRect();
        const c = document.querySelector("#edit-profile .z-modal__close").getBoundingClientRect();
        return c.left - d.left < d.right - c.right;
      });
      await page.keyboard.press("Escape");
      await settle();
      ok(close, "en RTL el botón de cierre del Modal debe quedar a la izquierda");
    } finally {
      await page.evaluate(() => {
        document.documentElement.removeAttribute("dir");
      });
      await settle();
    }
  });

  await test("WCAG 2.5.8: todo objetivo de puntero mide 24 × 24 px CSS o cumple la excepción de espaciado", async () => {
    const small = await page.evaluate((zout) => {
      const visible = (el) => {
        const r = el.getBoundingClientRect();
        return (
          r.width > 0 &&
          r.height > 0 &&
          getComputedStyle(el).visibility !== "hidden" &&
          !el.closest("[hidden], [inert], dialog:not([open]), [popover]:not(:popover-open)")
        );
      };
      const targets = [
        ...document.querySelectorAll(
          "main :is(button, a[href], input:not([type=hidden]), select, textarea, [role='slider'], [role='treeitem'] > .z-tree__row, label.z-check, label.z-radio, label.z-switch, label.z-upload)",
        ),
      ].filter((el) => visible(el) && !el.classList.contains("z-sr-only") && !el.disabled);
      // Un control dentro de una etiqueta que lo activa comparte objetivo con ella.
      const box = (el) => (el.closest("label.z-check, label.z-radio, label.z-switch") ?? el).getBoundingClientRect();
      const failing = [];
      for (const el of targets) {
        const r = box(el);
        if (r.width >= 23.5 && r.height >= 23.5) continue;
        // Excepción "en línea": enlaces dentro de una frase.
        if (
          el.matches("a") &&
          getComputedStyle(el).display.startsWith("inline") &&
          el.parentElement.textContent.trim() !== el.textContent.trim()
        )
          continue;
        // Excepción de espaciado: un círculo de 24 px centrado en el objetivo no toca otro objetivo ni su círculo.
        const cx = r.left + r.width / 2,
          cy = r.top + r.height / 2;
        const clash = targets.some((other) => {
          if (other === el || other.contains(el) || el.contains(other) || box(other) === r) return false;
          const o = box(other);
          if (o.left === r.left && o.top === r.top && o.width === r.width) return false;
          const small = o.width < 24 || o.height < 24;
          const ox = o.left + o.width / 2,
            oy = o.top + o.height / 2;
          if (small) return Math.hypot(cx - ox, cy - oy) < 24;
          const dx = Math.max(o.left - cx, 0, cx - o.right),
            dy = Math.max(o.top - cy, 0, cy - o.bottom);
          return Math.hypot(dx, dy) < 12;
        });
        if (clash)
          failing.push(
            `${el.closest("[data-component]")?.dataset.component}: <${el.tagName.toLowerCase()} class="${el.className}"> ${Math.round(r.width)}×${Math.round(r.height)}`,
          );
      }
      const own = (line) => !zout.includes(line.split(":")[0]);
      return {
        total: targets.length,
        failing: [...new Set(failing)].filter(own),
        other: [...new Set(failing)].filter((line) => !own(line)),
      };
    }, ZOUT);
    note(`${small.total} objetivos medidos`);
    for (const line of small.other) note(`zout (otro frente): ${line}`);
    ok(
      small.failing.length === 0,
      `${small.failing.length} objetivos menores de 24 px sin espacio suficiente: ${small.failing.slice(0, 25).join(" ‖ ")}`,
    );
  });
}
