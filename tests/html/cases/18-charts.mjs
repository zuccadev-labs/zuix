// Gráficos sin framework: LineChart, BarChart, DonutChart y Sparkline montados desde zui/html.json con zui/dom
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
        box.style.inlineSize = "640px";
        box.innerHTML = html;
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
    ok((await box.locator(".z-chart__tip").innerText()).includes("$72,000"), "valor en el tooltip");
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
    ok((await box.locator(".z-chart__tip-title").innerText()).includes("June"), "última posición");
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
    ok((await box.locator("table caption").innerText()) === "Tasks by team", "caption de la tabla");
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
    ok((await box.locator(".z-chart__center").innerText()).includes("Documents"), "centro con el sector activo");
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
}
