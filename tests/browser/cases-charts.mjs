// Gráficos en el binding de React (pantalla `?screen=charts` de examples/app): teclado entre puntos con nombre
// completo, tooltip al enfocar y al pasar, Intro → onPointClick, leyenda controlada (onHiddenChange), tabla
// alternativa, anillo con el sector activo en el centro, minigráficos y StatTile con tendencia; dispersión, radar,
// combinado, mapa de calor, bala, barra por categorías y número animado (0.5).
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
        const title = (await page.locator("#chart-line .z-chart__tip-title").textContent()) ?? "";
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
        await poll(async () => ((await page.locator("#chart-donut .z-chart__center").textContent()) ?? "").includes("Documents"), "centro");
        const spark = page.locator('.app-charts__spark .z-sparkline[role="img"]').first();
        assert(/^Weekly visits: from 120 to 340/.test((await spark.getAttribute("aria-label")) ?? ""), "nombre del minigráfico");
        await expectCount(page, ".z-stat .z-stat__trend", 4, "StatTile con tendencia");
      },
    },
    {
      name: "Gráficos · ScatterChart: punto con nombre, ←→ por la serie, ↓ a la otra serie y onPointClick con la fila (React)",
      async run({ open }) {
        const page = await screen(open);
        await expectCount(page, '#chart-scatter .z-chart__point[tabindex="0"]', 1, "una sola parada de Tab");
        await expectCount(page, "#chart-scatter .z-chart__trend", 2, "una recta de tendencia por serie");
        await page.focus('#chart-scatter .z-chart__point[tabindex="0"]');
        await poll(async () => /^Acme \(SMB\): Revenue \$12/.test(await active(page)), "nombre del primer punto");
        await page.keyboard.press("ArrowRight");
        await poll(async () => /^Birch/.test(await active(page)), "→ siguiente de la serie");
        await page.keyboard.press("ArrowDown");
        await poll(async () => /^Delta \(Enterprise\)/.test(await active(page)), "↓ a la otra serie");
        await page.keyboard.press("Enter");
        await expectText(page, t("chart-last"), "Scatter: Delta", "Intro → onPointClick con la fila");
      },
    },
    {
      name: "Gráficos · RadarChart y ComboChart: cuña con todas las series y eje secundario (React)",
      async run({ open }) {
        const page = await screen(open);
        await page.focus('#chart-radar .z-chart__wedge[tabindex="0"]');
        await poll(async () => (await active(page)) === "Speed: Model A 82, Model B 64", "nombre del eje");
        await page.keyboard.press("End");
        await poll(async () => /^Tech/.test(await active(page)), "Fin: último eje");
        await expectCount(page, '#chart-combo .z-chart__axis[data-side="end"]', 1, "eje secundario");
        await page.focus('#chart-combo .z-chart__hit[tabindex="0"]');
        await poll(async () => /^January 2026: Revenue \$42,000, Margin 18%$/.test(await active(page)), "formato por eje");
      },
    },
    {
      name: "Gráficos · HeatmapChart: rejilla con flechas, Ctrl+Fin, onPointClick y escala divergente (React)",
      async run({ open }) {
        const page = await screen(open);
        await expectCount(page, '#chart-heatmap [role="grid"] [role="gridcell"][tabindex="0"]', 1, "una sola parada de Tab");
        await page.focus('#chart-heatmap [role="gridcell"][tabindex="0"]');
        await page.keyboard.press("ArrowRight");
        await poll(async () => /^Mon, 09: \d+$/.test(await active(page)), "→ siguiente columna");
        await page.keyboard.press("Control+End");
        await poll(async () => /^Fri, 19/.test(await active(page)), "Ctrl+Fin");
        await page.keyboard.press("Enter");
        await expectText(page, t("chart-last"), "Heatmap: Fri 19");
        await expectCount(page, '#chart-diverging .z-chart__swatch[data-mark="level"]', 9, "leyenda divergente");
      },
    },
    {
      name: "Gráficos · BulletChart, CategoryBar y AnimatedNumber en StatTile y MetricCard (React)",
      async run({ open }) {
        const page = await screen(open);
        await page.focus('#chart-bullet .z-chart__bullet-track[tabindex="0"]');
        await poll(async () => (await active(page)) === "North: 82, target 85, in Good", "nombre de la fila");
        await page.focus('#chart-category .z-category-bar__segment[tabindex="0"]');
        await page.keyboard.press("ArrowRight");
        await poll(async () => (await active(page)) === "Watch: 30 (30%)", "→ siguiente tramo");
        await expectText(page, "#chart-orders .z-sr-only", "1,284");
        await page.click(t("chart-orders-more"));
        await expectText(page, "#chart-orders .z-sr-only", "1,500", "la copia accesible dice el final de una vez");
        await poll(
          async () => ((await page.locator("#chart-orders .z-animated-number__value").textContent()) ?? "") === "1,500",
          "la cuenta acaba en el valor",
        );
        await poll(
          async () => ((await page.locator("#chart-metric .z-animated-number__value").textContent()) ?? "") === "$130,500",
          "MetricCard con animate",
        );
        const live = await page.locator("#chart-orders [aria-live]").getAttribute("aria-live");
        assert(live === "polite", "aria-live opcional");
      },
    },
  ];
}
