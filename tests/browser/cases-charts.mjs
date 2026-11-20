// Gráficos en el binding de React (pantalla `?screen=charts` de examples/app): teclado entre puntos con nombre
// completo, tooltip al enfocar y al pasar, Intro → onPointClick, leyenda controlada (onHiddenChange), tabla
// alternativa, anillo con el sector activo en el centro, minigráficos y StatTile con tendencia.
export default function ({ t, assert, poll, expectAttr, expectText, expectCount }) {
  const screen = (open, options) => open("charts", options);
  const active = (page) => page.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? "");

  return [
    {
      name: "Gráficos · LineChart: una parada de Tab, flechas con nombre completo, tooltip y onPointClick (React)",
      async run({ open }) {
        const page = await screen(open);
        await expectCount(page, '#chart-line .z-chart__hit[tabindex="0"]', 1, "una sola parada de Tab");
        await page.focus('#chart-line .z-chart__hit[tabindex="0"]');
        await poll(async () => /Revenue .*42,000, Costs .*38,000/.test(await active(page)), "nombre del primer punto");
        await page.keyboard.press("ArrowRight");
        await page.keyboard.press("ArrowRight");
        await poll(async () => /Revenue .*45,000/.test(await active(page)), "→ → tercer punto");
        await poll(() => page.locator("#chart-line .z-chart__tip").isVisible(), "tooltip al enfocar");
        await page.keyboard.press("End");
        await page.keyboard.press("Enter");
        await expectText(page, t("chart-last"), "Line: 2026-12", "Intro → onPointClick con el índice");
        await page.keyboard.press("Escape");
        await expectCount(page, "#chart-line .z-chart__tip", 0, "Escape cierra el tooltip");
      },
    },
    {
      name: "Gráficos · puntero: cruceta y tooltip de la posición más cercana; banda en las barras (React)",
      async run({ open }) {
        const page = await screen(open);
        const plot = page.locator("#chart-line .z-chart__plot");
        await plot.scrollIntoViewIfNeeded();
        const r = await plot.boundingBox();
        await page.mouse.move(r.x + r.width * 0.5, r.y + r.height / 2);
        await expectCount(page, "#chart-line .z-chart__cross", 1, "cruceta");
        const title = await page.locator("#chart-line .z-chart__tip-title").innerText();
        assert(title.length > 0, "tooltip con la fecha");
        const bars = page.locator("#chart-bar .z-chart__plot");
        await bars.scrollIntoViewIfNeeded();
        const b = await bars.boundingBox();
        await page.mouse.move(b.x + b.width * 0.15, b.y + b.height * 0.8);
        await expectCount(page, "#chart-bar .z-chart__band", 1, "banda de la categoría");
        await expectText(page, "#chart-bar .z-chart__tip-title", "Design");
      },
    },
    {
      name: "Gráficos · leyenda controlada, el color sigue a la serie y tabla alternativa (React)",
      async run({ open }) {
        const page = await screen(open);
        const key = (n) => `#chart-area .z-chart__key:nth-child(${n})`;
        await page.click(key(1));
        await expectAttr(page, key(1), "aria-pressed", "false", "serie oculta por la prop hidden");
        await expectCount(page, "#chart-area .z-chart__area", 2);
        const colors = await page.locator("#chart-area .z-chart__area").evaluateAll((els) => els.map((e) => e.getAttribute("data-color")));
        assert(colors.join() === "2,3", `los colores de las otras series no cambian: ${colors}`);
        await page.click(key(1));
        await expectCount(page, "#chart-area .z-chart__area", 3);
        await page.click("#chart-line .z-chart__toggle");
        await expectAttr(page, "#chart-line .z-chart__toggle", "aria-pressed", "true");
        await expectCount(page, "#chart-line tbody tr", 12, "una fila por mes");
        await expectText(page, "#chart-line caption", "Revenue and costs");
      },
    },
    {
      name: "Gráficos · anillo: sectores con porcentaje, centro con el sector activo; minigráficos con nombre (React)",
      async run({ open }) {
        const page = await screen(open);
        await page.focus('#chart-donut .z-chart__slice[tabindex="0"]');
        await poll(async () => /^Media: .*\(52\.3%\)$/.test(await active(page)), "nombre del sector");
        await page.keyboard.press("ArrowDown");
        await poll(async () => /^Documents/.test(await active(page)), "↓ siguiente sector");
        await poll(async () => (await page.locator("#chart-donut .z-chart__center").innerText()).includes("Documents"), "centro");
        const spark = page.locator('.app-charts__spark .z-sparkline[role="img"]').first();
        assert(/^Weekly visits: from 120 to 340/.test((await spark.getAttribute("aria-label")) ?? ""), "nombre del minigráfico");
        await expectCount(page, ".z-stat .z-stat__trend", 4, "StatTile con tendencia");
      },
    },
  ];
}
