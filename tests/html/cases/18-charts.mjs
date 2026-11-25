// Gráficos sin framework: LineChart, BarChart, DonutChart, Sparkline, ScatterChart, RadarChart, ComboChart,
// HeatmapChart, BulletChart, CategoryBar y AnimatedNumber montados desde zui/html.json con zui/dom
// (SVG en su espacio de nombres, foco y flechas entre puntos, tooltip, leyenda que oculta series, tabla alternativa,
// eventos z:pointclick / z:hiddenchange / z:viewchange y RTL).
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const contract = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../../../zui/html.json"), "utf8")).components;

export default async function ({ page, test, ok }) {
  await page.evaluate(() => {
    window.__charts = [];
    for (const name of ["z:pointclick", "z:hiddenchange", "z:viewchange"])
      document.addEventListener(name, (event) => window.__charts.push({ name, detail: JSON.parse(JSON.stringify(event.detail ?? null)) }));
  });
  const events = () => page.evaluate(() => window.__charts.splice(0));
  let seq = 0;
  const inject = async (name, index = 0, dir) => {
    const id = `chart-${name}-${++seq}`;
    await page.evaluate(
      async ([html, wrap, rtl]) => {
        const box = document.createElement("div");
        box.id = wrap;
        box.setAttribute("data-z-dom", "");
        if (rtl) box.setAttribute("dir", rtl);
        box.innerHTML = html;
        // En una capa fija por encima de lo que otros casos dejan en pantalla; la anterior de este archivo se retira.
        for (const old of document.querySelectorAll("[data-w5-layer]")) old.remove();
        box.setAttribute("data-w5-layer", "");
        Object.assign(box.style, {
          position: "fixed",
          insetBlockStart: "0",
          insetInlineStart: "0",
          zIndex: "2147483000",
          inlineSize: "min(640px, 100vw)",
          maxBlockSize: "100vh",
          overflow: "auto",
          background: "Canvas",
        });

        document.querySelector(".page__main").append(box);
        (await import("/zui/dist/zui.dom.js")).hydrate(box);
      },
      [contract[name].examples[index].html, id, dir],
    );
    return page.locator(`#${id}`);
  };
  const active = () => page.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? "");

  await test("LineChart sin React: SVG real, puntos enfocables con nombre, flechas, tooltip y Escape", async () => {
    const box = await inject("LineChart");
    const chart = box.locator(".z-chart");
    ok((await chart.locator("figure figcaption").count()) === 1, "figure + figcaption");
    const ns = await box.evaluate((el) => el.querySelector(".z-chart__line")?.namespaceURI);
    ok(ns === "http://www.w3.org/2000/svg", `trazo en el espacio de nombres SVG: ${ns}`);
    const d = await box.locator(".z-chart__line").first().getAttribute("d");
    ok(/^M0 /.test(d ?? ""), `trazado desde el inicio: ${d}`);
    const hits = box.locator(".z-chart__hit");
    ok((await hits.count()) === 6, "una posición por fila");
    ok((await box.locator('.z-chart__hit[tabindex="0"]').count()) === 1, "una sola parada de Tab");
    await hits.first().focus();
    ok(/January 2026: Revenue \$42,000, Costs \$38,000/.test(await active()), `nombre completo: ${await active()}`);
    await page.keyboard.press("ArrowRight");
    ok(/February 2026/.test(await active()), "→ siguiente");
    await page.keyboard.press("End");
    ok(/June 2026/.test(await active()), "Fin");
    ok(await box.locator(".z-chart__tip").isVisible(), "tooltip al enfocar");
    ok(((await box.locator(".z-chart__tip").textContent()) ?? "").includes("$72,000"), "valor en el tooltip");
    await page.keyboard.press("Enter");
    const log = await events();
    ok(
      log.some((e) => e.name === "z:pointclick" && e.detail.index === 5),
      "Intro → z:pointclick",
    );
    await page.keyboard.press("Escape");
    ok((await box.locator(".z-chart__tip").count()) === 0, "Escape cierra el tooltip");
    const sum = await box.locator(".z-sr-only").first().textContent();
    ok(/Line chart, 2 series: Revenue, Costs\. 6 points/.test(sum ?? ""), `resumen: ${sum}`);
  });

  await test("LineChart sin React: el puntero muestra cruceta y tooltip de la posición más cercana", async () => {
    const box = await inject("LineChart");
    const plot = box.locator(".z-chart__plot");
    await plot.scrollIntoViewIfNeeded();
    const r = await plot.boundingBox();
    await page.mouse.move(r.x + r.width * 0.98, r.y + r.height / 2);
    await page.waitForFunction((id) => document.querySelector(`#${id} .z-chart__cross`), await box.getAttribute("id"));
    ok(((await box.locator(".z-chart__tip-title").textContent()) ?? "").includes("June"), "última posición");
    await page.mouse.move(1, 1);
    await page.waitForFunction((id) => !document.querySelector(`#${id} .z-chart__tip`), await box.getAttribute("id"));
  });

  await test("BarChart sin React: leyenda que oculta series (sin vaciar el gráfico) y tabla alternativa", async () => {
    const box = await inject("BarChart");
    ok((await box.locator(".z-chart__bar").count()) === 6, "3 categorías × 2 series");
    const keys = box.locator(".z-chart__key");
    await keys.first().click();
    ok((await keys.first().getAttribute("aria-pressed")) === "false", "serie oculta");
    ok((await box.locator(".z-chart__bar").count()) === 3, "solo la serie visible");
    ok((await keys.nth(1).getAttribute("aria-disabled")) === "true", "la última visible no se oculta");
    const colors = await box.locator(".z-chart__bar").evaluateAll((els) => [...new Set(els.map((e) => e.dataset.color))]);
    ok(colors.join() === "2", `el color sigue a la serie: ${colors}`);
    await box.locator(".z-chart__toggle").click();
    ok(((await box.locator("table caption").textContent()) ?? "") === "Tasks by team", "caption de la tabla");
    ok((await box.locator("tbody tr").count()) === 3, "una fila por categoría");
    const log = await events();
    ok(
      log.some((e) => e.name === "z:hiddenchange" && e.detail.hidden.join() === "shipped"),
      "z:hiddenchange",
    );
    ok(
      log.some((e) => e.name === "z:viewchange" && e.detail.view === "table"),
      "z:viewchange",
    );
  });

  await test("BarChart horizontal apilado: base recta, extremo redondeado solo en la punta", async () => {
    const box = await inject("BarChart", 1);
    const caps = await box.locator(".z-chart__bar[data-cap]").count();
    ok(caps === 3, `una punta por categoría: ${caps}`);
    const radius = await box
      .locator(".z-chart__bar[data-cap]")
      .first()
      .evaluate((el) => getComputedStyle(el).borderStartEndRadius);
    ok(Number.parseFloat(radius) > 0, `punta redondeada: ${radius}`);
    const base = await box
      .locator(".z-chart__bar:not([data-cap])")
      .first()
      .evaluate((el) => getComputedStyle(el).borderStartStartRadius);
    ok(Number.parseFloat(base) === 0, "base recta");
  });

  await test("DonutChart sin React: sectores enfocables con porcentaje, centro con el sector activo y flechas", async () => {
    const box = await inject("DonutChart");
    const slices = box.locator(".z-chart__slice");
    ok((await slices.count()) === 4, "cuatro sectores");
    await slices.first().focus();
    ok(/Media: 412 GB \(52\.3%\)/.test(await active()), `nombre: ${await active()}`);
    await page.keyboard.press("ArrowRight");
    ok(/Documents/.test(await active()), "→ siguiente sector");
    ok(((await box.locator(".z-chart__center").textContent()) ?? "").includes("Documents"), "centro con el sector activo");
  });

  await test("RTL: las flechas siguen la dirección visual y el trazo se refleja", async () => {
    const box = await inject("LineChart", 0, "rtl");
    const scale = await box.locator(".z-chart__svg").evaluate((el) => getComputedStyle(el).scale);
    ok(scale.startsWith("-1"), `SVG reflejado: ${scale}`);
    await box.locator(".z-chart__hit").first().focus();
    await page.keyboard.press("ArrowLeft");
    ok(/February 2026/.test(await active()), "← avanza en RTL");
    const first = await box.locator(".z-chart__hit").first().boundingBox();
    const last = await box.locator(".z-chart__hit").last().boundingBox();
    ok(first.x > last.x, "la primera posición a la derecha");
  });

  await test("Sparkline sin React: imagen con nombre a partir de data-values", async () => {
    const box = await inject("Sparkline");
    const spark = box.locator(".z-sparkline").first();
    ok((await spark.getAttribute("role")) === "img", "role=img");
    ok(
      (await spark.getAttribute("aria-label")) === "Weekly visits: from 120 to 340, low 101, high 340",
      await spark.getAttribute("aria-label"),
    );
    ok((await box.locator(".z-sparkline rect").count()) === 7, "barras del segundo");
  });
  await test("ScatterChart sin React: puntos con nombre, ←→ por la serie, ↓ a la otra, tendencia y puntero cercano", async () => {
    const box = await inject("ScatterChart");
    const points = box.locator(".z-chart__point");
    ok((await points.count()) === 6, "un punto por fila");
    ok((await box.locator('.z-chart__point[tabindex="0"]').count()) === 1, "una sola parada de Tab");
    ok((await box.locator(".z-chart__trend").count()) === 2, "una recta por serie");
    await points.first().focus();
    ok(/^Acme \(SMB\): Revenue \$12, Margin 18%, Employees 120$/.test(await active()), `nombre: ${await active()}`);
    await page.keyboard.press("ArrowRight");
    ok(/^Birch/.test(await active()), "→ siguiente de la serie");
    await page.keyboard.press("ArrowDown");
    ok(/^Delta \(Enterprise\)/.test(await active()), `↓ a la otra serie: ${await active()}`);
    ok(((await box.locator(".z-chart__tip").textContent()) ?? "").includes("410"), "tooltip con el tamaño");
    await page.keyboard.press("Enter");
    ok(
      (await events()).some((e) => e.name === "z:pointclick" && e.detail.datum?.name === "Delta"),
      "Intro → z:pointclick con la fila",
    );
    await page.keyboard.press("Escape");
    ok((await box.locator(".z-chart__tip").count()) === 0, "Escape");
    const fjord = await points.last().boundingBox();
    await page.mouse.move(fjord.x + fjord.width / 2 + 4, fjord.y + fjord.height / 2 + 4);
    await page.waitForFunction((id) => document.querySelector(`#${id} .z-chart__tip`), await box.getAttribute("id"));
    ok(((await box.locator(".z-chart__tip-title").textContent()) ?? "") === "Fjord", "el puntero activa el punto más cercano");
    await page.mouse.move(1, 1);
    const sum = await box.locator(".z-sr-only").first().textContent();
    ok(/Scatter chart, 2 series: SMB, Enterprise\. 6 points/.test(sum ?? "") && /R²/.test(sum ?? ""), `resumen: ${sum}`);
  });

  await test("RadarChart sin React: cuñas enfocables con los valores, flechas y tabla", async () => {
    const box = await inject("RadarChart");
    const wedges = box.locator(".z-chart__wedge");
    ok((await wedges.count()) === 6, "una cuña por eje");
    const ns = await box.evaluate((el) => el.querySelector(".z-chart__radar")?.namespaceURI);
    ok(ns === "http://www.w3.org/2000/svg", "polígono en SVG");
    await wedges.first().focus();
    ok((await active()) === "Speed: Model A 82, Model B 64", `nombre: ${await active()}`);
    await page.keyboard.press("ArrowRight");
    ok(/^Range/.test(await active()), "→ siguiente eje");
    ok(await box.locator(".z-chart__tip").isVisible(), "tooltip");
    await box.locator(".z-chart__toggle").click();
    ok((await box.locator("tbody tr").count()) === 6, "tabla: un eje por fila");
  });

  await test("ComboChart sin React: barras, línea encima y eje secundario con su formato", async () => {
    const box = await inject("ComboChart");
    ok((await box.locator(".z-chart__bar").count()) === 6, "una barra por mes");
    ok((await box.locator('.z-chart__axis[data-side="end"]').count()) === 1, "eje secundario");
    ok(((await box.locator('.z-chart__axis[data-side="end"]').textContent()) ?? "").includes("%"), "en porcentaje");
    await box.locator(".z-chart__hit").first().focus();
    ok((await active()) === "January 2026: Revenue $42,000, Margin 18%", `nombre: ${await active()}`);
    await box.locator(".z-chart__key").nth(1).click();
    ok((await box.locator('.z-chart__axis[data-side="end"]').count()) === 0, "sin la serie, sin eje secundario");
  });

  await test("HeatmapChart sin React: role=grid, flechas, Inicio/Fin, Ctrl+Fin y nombre de celda", async () => {
    const box = await inject("HeatmapChart");
    ok((await box.locator('[role="grid"]').count()) === 1, "rejilla");
    ok((await box.locator('[role="gridcell"]').count()) === 60, "5 × 12 celdas");
    ok((await box.locator('[role="columnheader"]').count()) === 13, "esquina + 12 columnas");
    ok((await box.locator('[role="gridcell"][tabindex="0"]').count()) === 1, "una sola parada de Tab");
    await box.locator('[role="gridcell"]').first().focus();
    ok(/^Mon, 08: \d+$/.test(await active()), `nombre: ${await active()}`);
    await page.keyboard.press("ArrowDown");
    ok(/^Tue, 08/.test(await active()), "↓ fila siguiente");
    await page.keyboard.press("End");
    ok(/^Tue, 19/.test(await active()), "Fin: final de la fila");
    await page.keyboard.press("Control+End");
    ok(/^Fri, 19/.test(await active()), "Ctrl+Fin: última celda");
    ok(await box.locator(".z-chart__tip").isVisible(), "tooltip");
    await page.keyboard.press("Enter");
    ok(
      (await events()).some((e) => e.name === "z:pointclick" && e.detail.datum?.day === "Fri"),
      "Intro → z:pointclick",
    );
    const diverging = await inject("HeatmapChart", 1);
    ok((await diverging.locator('.z-chart__swatch[data-mark="level"]').count()) === 9, "leyenda divergente de 9 niveles");
    ok((await diverging.locator('.z-chart__cell[data-level="-4"]').count()) >= 1, "nivel negativo extremo");
    ok(((await diverging.locator(".z-chart__cell-value").first().textContent()) ?? "") === "+4%", "showValues");
  });

  await test("HeatmapChart en RTL: → retrocede y la primera columna queda a la derecha", async () => {
    const box = await inject("HeatmapChart", 0, "rtl");
    const cells = box.locator('[role="gridcell"]');
    await cells.nth(1).focus();
    await page.keyboard.press("ArrowRight");
    ok(/^Mon, 08/.test(await active()), `→ retrocede en RTL: ${await active()}`);
    const a = await cells.nth(0).boundingBox();
    const b = await cells.nth(1).boundingBox();
    ok(a.x > b.x, "orden visual de derecha a izquierda");
  });

  await test("BulletChart sin React: filas con objetivo y rango, flechas y vertical", async () => {
    const box = await inject("BulletChart");
    const rows = box.locator(".z-chart__bullet-track");
    ok((await rows.count()) === 4, "una fila por región");
    await rows.first().focus();
    ok((await active()) === "North: 82, target 85, in Good", `nombre: ${await active()}`);
    await page.keyboard.press("ArrowDown");
    ok((await active()) === "South: 64, target 75, in Fair", "↓ siguiente fila");
    ok(((await box.locator(".z-chart__tip").textContent()) ?? "").includes("75"), "tooltip con el objetivo");
    const v = await inject("BulletChart", 1);
    const track = await v.locator(".z-chart__bullet-track").first().boundingBox();
    ok(track.height > track.width, "vertical: columnas");
  });

  await test("CategoryBar sin React: tramos con nombre, flechas, marcador y rótulos", async () => {
    const box = await inject("CategoryBar");
    const segs = box.locator(".z-category-bar__segment");
    ok((await segs.count()) === 4, "cuatro tramos");
    await segs.first().focus();
    ok((await active()) === "Healthy: 40 (40%)", `nombre: ${await active()}`);
    await page.keyboard.press("ArrowRight");
    ok((await active()) === "Watch: 30 (30%)", "→");
    ok(await box.locator(".z-category-bar__tip").isVisible(), "tooltip");
    ok((await box.locator(".z-category-bar__marker").count()) === 1, "marcador");
    const sum = await box.locator(".z-sr-only").first().textContent();
    ok(/Marker: 62/.test(sum ?? ""), `resumen: ${sum}`);
    const h = await segs.first().boundingBox();
    ok(h.height >= 24, `zona de 24 px: ${h.height}`);
  });

  await test("AnimatedNumber sin React: valor final, copia accesible y cuenta al cambiar", async () => {
    const box = await inject("AnimatedNumber");
    const el = box.locator(".z-animated-number");
    ok(((await el.locator(".z-animated-number__value").textContent()) ?? "") === "$48,250", "valor formateado");
    ok((await el.locator(".z-animated-number__value").getAttribute("aria-hidden")) === "true", "el visible no se lee");
    await page.evaluate(
      async (id) => {
        const { setWidgetProps } = await import("/zui/dist/zui.dom.js");
        setWidgetProps(document.querySelector(`#${id} .z-animated-number`), { value: 50000, duration: 400 });
      },
      await box.getAttribute("id"),
    );
    const reduced = await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
    ok(((await el.locator(".z-sr-only").textContent()) ?? "") === "$50,000", "la copia accesible dice ya el final");
    if (!reduced) ok((await el.getAttribute("data-animating")) !== null, "cuenta en curso");
    await page.waitForFunction(
      (id) => document.querySelector(`#${id} .z-animated-number__value`)?.textContent === "$50,000",
      await box.getAttribute("id"),
    );
    const live = await inject("AnimatedNumber", 1);
    ok((await live.locator("[aria-live]").getAttribute("aria-live")) === "polite", "aria-live opcional");
  });

  await page.evaluate(() => {
    for (const old of document.querySelectorAll("[data-w5-layer]")) old.remove();
  });
}
