// Layouts adaptativos con React (pantallas `adaptive`, `adaptive-stage` y `adaptive-ssr` de examples/app):
// AdaptiveLayout, sus variantes (AdaptiveTabs, AdaptiveTable, AdaptiveToolbar) y el Shell con la sidebar por clase.
// Exporta una función que recibe los ayudantes de cases.mjs.

/** Clase que corresponde a un ancho (los cortes de SIZE_CLASSES). */
const classFor = (w) => (w < 600 ? "compact" : w < 840 ? "medium" : w < 1200 ? "expanded" : w < 1600 ? "large" : "xlarge");

/** Piezas del layout en el orden del DOM y en el que se ven (fila y, dentro de ella, lado inicial), y su clase. */
const layoutState = (page, selector = '[data-testid="adaptive-layout"]') =>
  page.evaluate((sel) => {
    const layout = document.querySelector(sel);
    const grid = layout.querySelector(":scope > .z-adaptive__grid");
    const rtl = getComputedStyle(layout).direction === "rtl";
    const items = [...grid.children].filter((el) => el.classList.contains("z-adaptive__item"));
    const shown = items.filter((el) => getComputedStyle(el).display !== "none");
    const box = (el) => el.getBoundingClientRect();
    const visual = [...shown]
      .sort((a, b) => {
        const [ra, rb] = [box(a), box(b)];
        if (Math.abs(ra.top - rb.top) > 2) return ra.top - rb.top;
        return rtl ? rb.right - ra.right : ra.left - rb.left;
      })
      .map((el) => el.dataset.item);
    const style = getComputedStyle(layout);
    const width = layout.clientWidth - Number.parseFloat(style.paddingInlineStart) - Number.parseFloat(style.paddingInlineEnd);
    return {
      cls: layout.dataset.sizeClass,
      width,
      dom: items.map((el) => el.dataset.item),
      shownDom: shown.map((el) => el.dataset.item),
      visual,
    };
  }, selector);

export default function ({ t, assert, poll }) {
  const frame = async (page, label) => {
    await page.getByRole("radio", { name: label, exact: true }).click();
    await page.waitForTimeout(450);
  };

  return [
    {
      name: "AdaptiveLayout: cambia de clase al redimensionar el contenedor y el DOM sigue el orden visual (React)",
      async run({ open, shot }) {
        const page = await open("adaptive", { width: 1440, height: 1000 });
        const seen = new Set();
        const trail = [];
        for (const label of ["390", "820", "1180", "1600", "1960", "Fit"]) {
          await frame(page, label);
          const s = await poll(async () => {
            const st = await layoutState(page);
            return st.cls === classFor(st.width) ? st : null;
          }, `la clase del layout corresponde a su ancho (marco ${label})`);
          seen.add(s.cls);
          trail.push(`${label}:${s.cls}:${Math.round(s.width)}`);
          // Con view transitions el cambio de orden se aplica al terminar de capturar: se espera a él.
          await poll(async () => {
            const st = await layoutState(page);
            return st.shownDom.join() === st.visual.join();
          }, `marco ${label} (${s.cls}): el DOM sigue el orden visual`);
          const status = await page.locator(t("adaptive-class")).textContent();
          assert(status === s.cls, `el estado dice ${status}, el layout ${s.cls}`);
          if (label === "1600") await shot(page, "adaptive-frame-1600");
        }
        assert(seen.size === 5, `el marco recorre las cinco clases: ${trail.join(" ")}`);
      },
    },
    {
      name: "AdaptiveLayout domOrder: Tab recorre las piezas en el orden en que se ven (React)",
      async run({ open }) {
        const page = await open("adaptive-stage", { width: 1440, height: 1000 });
        const s = await layoutState(page);
        assert(s.cls === "large", `a 1440 la página es large: ${s.cls}`);
        assert(s.visual.indexOf("activity") < s.visual.indexOf("main"), `en large la actividad va antes que el trabajo: ${s.visual}`);
        // Se recorre con Tab desde el primer control de la cabecera y se anota la pieza de cada parada.
        await page.locator('[data-item="header"] .z-toolbar button').first().focus();
        // Una sola pasada: se para al salir del layout.
        const pieces = [];
        for (let i = 0; i < 60; i++) {
          const piece = await page.evaluate(() => document.activeElement?.closest(".z-adaptive__item")?.dataset.item ?? null);
          if (!piece) break;
          if (pieces.at(-1) !== piece) pieces.push(piece);
          await page.keyboard.press("Tab");
        }
        const expected = s.visual.filter((id) => pieces.includes(id));
        assert(pieces.join() === expected.join(), `orden de foco ${pieces} frente al visual ${expected}`);
        assert(pieces.includes("main") && pieces.includes("activity"), `el recorrido pasa por la actividad y el trabajo: ${pieces}`);
      },
    },
    {
      name: "AdaptiveLayout visual: el DOM vuelve al orden de origen y se avisa del desorden (React)",
      async run({ open }) {
        const page = await open("adaptive", { width: 1440, height: 1000 });
        await frame(page, "1180");
        await poll(async () => {
          const before = await layoutState(page);
          return before.cls === "expanded" && before.dom.indexOf("activity") < before.dom.indexOf("main");
        }, "en modo DOM la actividad se mueve delante del trabajo");
        await page.getByRole("radio", { name: "Visual only" }).click();
        await poll(
          async () => (await layoutState(page)).dom.join() === "header,stats,main,activity,help",
          "el DOM vuelve al orden de origen",
        );
        await poll(() => page.locator(t("adaptive-mismatch")).isVisible(), "se avisa de que el orden visual y el del DOM se separan");
        const visual = await layoutState(page);
        assert(visual.visual.indexOf("activity") < visual.visual.indexOf("main"), "la colocación visual no cambia");
        await page.getByRole("radio", { name: "DOM order" }).click();
        await poll(async () => (await layoutState(page)).dom.indexOf("activity") < 3, "de vuelta a DOM, se reordena otra vez");
      },
    },
    {
      name: "Editor en vivo: área, orden y visibilidad por clase (React)",
      async run({ open, shot }) {
        const page = await open("adaptive", { width: 1440, height: 1000 });
        await frame(page, "390");
        await poll(async () => (await layoutState(page)).cls === "compact", "marco compacto");
        // El selector de clase también es adaptativo: radios en un panel ancho, un select en uno estrecho.
        const radio = page.getByRole("radio", { name: "compact", exact: true });
        if (await radio.count()) await radio.click();
        else await page.getByRole("combobox", { name: "Size class to edit" }).selectOption("compact");
        // Intercambiar las áreas de las métricas y la actividad.
        await page.locator(t("area-stats")).selectOption("activity");
        await page.locator(t("area-activity")).selectOption("stats");
        await poll(async () => {
          const s = await layoutState(page);
          return s.visual.join() === "header,activity,main,stats" && s.shownDom.join() === s.visual.join();
        }, "la actividad sube al sitio de las métricas y el DOM la sigue");
        // Mostrar los consejos en compacto: sin área en la plantilla, van en flujo detrás.
        await page.locator(t("visible-help")).click();
        await poll(async () => (await layoutState(page)).visual.at(-1) === "help", "los consejos aparecen al final");
        // El cambio es solo de compact: en otra clase nada se movió.
        await frame(page, "1600");
        await poll(async () => (await layoutState(page)).cls === "large", "marco large");
        const large = await layoutState(page);
        assert(large.visual.indexOf("stats") < large.visual.indexOf("main"), `en large las métricas siguen arriba: ${large.visual}`);
        await shot(page, "adaptive-editor");
        // Un área que no existe en esa clase se ve en el panel, no en la consola.
        await page.getByRole("button", { name: "Reset" }).click();
        await poll(async () => (await layoutState(page)).visual.includes("stats"), "Reset devuelve las piezas");
      },
    },
    {
      name: "AdaptiveLayout: sin saltos al hidratar en las cinco clases (React)",
      async run({ open }) {
        for (const width of [390, 768, 1024, 1440, 1920]) {
          const page = await open("adaptive-ssr", { width, height: 900 });
          await poll(() => page.evaluate(() => window.__adaptiveSsr), `la prueba de hidratación termina a ${width}`);
          const r = await page.evaluate(() => window.__adaptiveSsr);
          assert(r.recoverable.length === 0, `${width}: errores de hidratación: ${r.recoverable.join(" | ")}`);
          assert(
            r.moved.length === 0,
            `${width}: piezas que se movieron al hidratar: ${r.moved} ${JSON.stringify(r.before)} → ${JSON.stringify(r.after)}`,
          );
          assert(r.sizeClass === classFor(width), `${width}: clase ${r.sizeClass}`);
          await page.context().close();
        }
      },
    },
    {
      name: "AdaptiveLayout en RTL: las columnas se reflejan y el orden de lectura no cambia (React)",
      async run({ open, shot }) {
        const ltr = await layoutState(await open("adaptive-stage", { width: 1440, height: 1000 }));
        const page = await open("adaptive-stage", { width: 1440, height: 1000, query: "dir=rtl" });
        const rtl = await layoutState(page);
        assert(rtl.dom.join() === ltr.dom.join(), `mismo orden de DOM en RTL: ${rtl.dom} / ${ltr.dom}`);
        assert(rtl.visual.join() === ltr.visual.join(), `mismo orden de lectura en RTL: ${rtl.visual} / ${ltr.visual}`);
        const [main, activity] = await Promise.all(["main", "activity"].map((id) => page.locator(`[data-item="${id}"]`).boundingBox()));
        assert(activity.x < main.x, `en RTL la actividad queda a la izquierda del trabajo: ${activity.x} < ${main.x}`);
        const side = await page.locator(".z-shell__side").boundingBox();
        assert(side.x > main.x, "la sidebar va a la derecha");
        await shot(page, "adaptive-rtl");
      },
    },
    {
      name: "Variantes adaptativas: pestañas ↔ select, tabla ↔ tarjetas, barra ↔ menú y sidebar ↔ cajón ↔ rail (React)",
      async run({ open, shot }) {
        const wide = await open("adaptive-stage", { width: 1440, height: 1000 });
        assert((await wide.locator('[role="tablist"][aria-label="Work"]').count()) === 1, "large: pestañas");
        assert((await wide.locator('[data-item="main"] table').count()) === 1, "large: tabla");
        assert(await wide.getByRole("button", { name: "Print" }).isVisible(), "large: Print en la barra");
        assert((await wide.locator(".z-shell__side .z-sidebar[data-collapsed]").count()) === 0, "large: sidebar acoplada y desplegada");

        const tablet = await open("adaptive-stage", { width: 768, height: 1000 });
        assert((await tablet.locator(".z-shell__side .z-sidebar[data-collapsed]").count()) === 1, "medium: sidebar como rail");
        assert(await tablet.getByRole("button", { name: "Export" }).isVisible(), "medium: Export en la barra");
        assert((await tablet.getByRole("button", { name: "Print" }).count()) === 0, "medium: Print pasa al menú");

        const phone = await open("adaptive-stage", { width: 390, height: 844 });
        assert((await phone.locator(".z-shell__side").count()) === 0, "compact: la sidebar es un cajón cerrado");
        assert((await phone.locator('[role="tablist"]').count()) === 0, "compact: sin lista de pestañas");
        const select = phone.getByRole("combobox", { name: "Work" });
        await select.selectOption("milestones");
        await poll(() => phone.getByRole("region", { name: "Milestones" }).isVisible(), "el select cambia la sección");
        await select.selectOption("projects");
        assert((await phone.locator('[data-item="main"] .z-adaptive-card').count()) === 4, "compact: tarjetas");
        assert((await phone.locator('[data-item="main"] table').count()) === 0, "compact: sin tabla");
        await phone.getByRole("button", { name: "More actions" }).click();
        const items = await phone.getByRole("menuitem").allTextContents();
        assert(items.map((s) => s.trim()).join() === "Export,Print,Archive", `menú «más»: ${items}`);
        await phone.keyboard.press("Escape");
        await phone.getByRole("button", { name: "Open navigation" }).click();
        await poll(() => phone.getByRole("dialog", { name: "Navigation" }).isVisible(), "el cajón se abre");
        await shot(phone, "adaptive-compact-drawer");
        await phone.keyboard.press("Escape");
        await poll(async () => (await phone.locator(".z-shell__side").count()) === 0, "Escape cierra el cajón");
      },
    },
    {
      name: "AdaptiveSwitch: el foco pasa a la variante nueva cuando la suya desaparece (React)",
      async run({ open }) {
        const page = await open("adaptive-stage", { width: 1440, height: 1000 });
        await page.getByRole("tab", { name: "Milestones" }).focus();
        await page.setViewportSize({ width: 390, height: 900 });
        await poll(
          () => page.evaluate(() => document.activeElement?.matches('select[aria-label="Work"]') ?? false),
          "el foco pasa al select de la variante compacta",
        );
        assert((await page.getByRole("combobox", { name: "Work" }).inputValue()) === "projects", "la selección se conserva");
      },
    },
  ];
}
