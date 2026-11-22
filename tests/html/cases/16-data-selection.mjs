// Sin framework, datos: DataTable con selección, pie y paginación en el cliente (puntero y teclado), y el
// marcado de Timeline, CircularProgress, Progress (vertical y por tramos), DescriptionList, Item, StatusDot y Chip con
// tono, sobre zui/html.json.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const contract = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../../../zui/html.json"), "utf8")).components;

export default async function ({ page, test, ok }) {
  await page.evaluate(() => {
    window.__w5d = [];
    for (const name of ["z:selectionchange", "z:pagechange"])
      document.addEventListener(name, (event) => window.__w5d.push({ name, detail: JSON.parse(JSON.stringify(event.detail ?? null)) }));
  });
  const events = () => page.evaluate(() => window.__w5d.splice(0));
  let seq = 0;
  const inject = async (name, index) => {
    const id = `w5d-${name}-${index}-${++seq}`;
    await page.evaluate(
      async ([component, html, wrap]) => {
        const stage = document.querySelector(`[data-component="${component}"] .demo__stage`) ?? document.querySelector(".page__main");
        const box = document.createElement("div");
        box.id = wrap;
        box.setAttribute("data-z-dom", "");
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
        stage.append(box);
        (await import("/zui/dist/zui.dom.js")).hydrate(box);
      },
      [name, contract[name].examples[index].html, id],
    );
    return page.locator(`#${id}`);
  };
  const exampleIndex = (name, pattern) => contract[name].examples.findIndex((e) => pattern.test(e.title));

  await test("DataTable: selección con casillas, seleccionar todo de la página, Mayús y conteo (sin React)", async () => {
    const box = await inject("DataTable", exampleIndex("DataTable", /Selecci/));
    const rows = box.locator("tbody tr");
    const visibleKeys = () => box.evaluate((el) => [...el.querySelectorAll("tbody tr")].filter((r) => !r.hidden).map((r) => r.dataset.key));
    ok((await visibleKeys()).join() === "a1,b2,c3", "primera página de 3");
    const all = box.locator("[data-select-all]");
    ok((await all.getAttribute("aria-checked")) === "mixed", "cabecera mixta");
    await events();
    await all.click();
    ok((await all.getAttribute("aria-checked")) === "true", "todas las visibles");
    let log = await events();
    ok(log.at(-1)?.detail.value.join() === "a1,b2,c3", `evento: ${JSON.stringify(log)}`);
    ok((await box.locator(".z-datatable__count").textContent()) === "3 selected", "conteo");
    await all.click();
    ok((await box.locator(".z-datatable__count").textContent()) === "", "sin selección no hay texto");
    await rows.nth(0).locator('[role="checkbox"]').click();
    await rows
      .nth(2)
      .locator('[role="checkbox"]')
      .click({ modifiers: ["Shift"] });
    log = await events();
    ok(log.at(-1)?.detail.value.join() === "a1,b2,c3", `rango con Mayús: ${JSON.stringify(log.at(-1))}`);
    await rows.nth(1).locator('[role="checkbox"]').focus();
    await page.keyboard.press(" ");
    ok((await rows.nth(1).getAttribute("data-selected")) === null, "Espacio desmarca la fila");
  });

  await test("DataTable: paginación en el cliente, rango, orden y teclado (sin React)", async () => {
    const box = await inject("DataTable", exampleIndex("DataTable", /Selecci/));
    await events();
    await box.locator('.z-pagination [aria-label="Page 2"]').click();
    const keys = () =>
      box.evaluate((el) =>
        [...el.querySelectorAll("tbody tr")]
          .filter((r) => !r.hidden)
          .map((r) => r.dataset.key)
          .join(),
      );
    ok((await keys()) === "d4,e5", "segunda página");
    ok((await box.locator(".z-datatable__range").textContent()) === "4–5 of 5", "rango");
    const log = await events();
    ok(
      log.some((e) => e.name === "z:pagechange" && e.detail.value === 2),
      `evento: ${JSON.stringify(log)}`,
    );
    ok((await box.locator("[data-select-all]").getAttribute("aria-checked")) === "false", "la cabecera mira la página");
    await box.locator('th[data-key="seats"] .z-table__sort').click();
    // Ascendente por asientos: 1, 3, 5 | 7, 12 → la página 2 es d4, b2.
    ok((await keys()) === "d4,b2", `la página se recalcula tras ordenar: ${await keys()}`);
    await box.locator('.z-pagination [aria-label="Previous page"]').focus();
    await page.keyboard.press("Enter");
    ok((await box.locator(".z-datatable__range").textContent()) === "1–3 of 5", "Intro en «anterior» vuelve a la 1");
  });

  await test("Datos sin framework: progress nativo del anillo, barras vertical y por tramos, <ol>, <dl> y estados con texto", async () => {
    const ring = await inject("CircularProgress", 0);
    const bar = ring.locator("progress");
    ok((await bar.getAttribute("value")) === "72" && (await bar.getAttribute("aria-label")) === "Upload", "progress con valor y nombre");
    ok((await ring.locator(".z-progress-ring__content").getAttribute("aria-hidden")) === "true", "el centro no se lee dos veces");
    const spin = await inject("CircularProgress", 1);
    ok(await spin.locator("progress").evaluate((p) => p.matches(":indeterminate")), "sin valor, indeterminado");
    const seg = await inject("Progress", exampleIndex("Progress", /tramos/));
    ok((await seg.locator(".z-progress__segment").count()) === 5, "cinco tramos");
    ok((await seg.locator('[role="progressbar"]').getAttribute("aria-valuetext")) === "3 of 5 steps", "aria-valuetext");
    const vertical = await inject("Progress", exampleIndex("Progress", /Vertical/));
    const geo = await vertical
      .locator(".z-progress")
      .first()
      .evaluate((el) => {
        const t = el.querySelector(".z-progress__track").getBoundingClientRect();
        const f = el.querySelector(".z-progress__fill").getBoundingClientRect();
        return { tall: t.height > t.width, anchored: Math.abs(t.bottom - f.bottom) < 1.5, ratio: f.height / t.height };
      });
    ok(geo.tall && geo.anchored && Math.abs(geo.ratio - 0.72) < 0.03, `vertical crece desde abajo: ${JSON.stringify(geo)}`);
    const timeline = await inject("Timeline", 0);
    ok((await timeline.locator("ol.z-timeline-list > li").count()) === 4, "lista ordenada");
    ok((await timeline.locator('li[aria-current="step"]').count()) === 1, "elemento en curso");
    ok((await timeline.locator("time[datetime]").count()) === 2, "horas en <time datetime>");
    const dl = await inject("DescriptionList", 0);
    ok((await dl.locator("dl > div > dt + dd").count()) === 4, "pares dt/dd");
    const status = await inject("StatusDot", 1);
    ok((await status.locator(".z-sr-only").textContent()) === "Connected", "el punto solo lleva el texto para lectores");
    const items = await inject("Item", 0);
    ok((await items.locator('[role="list"] > [role="listitem"]').count()) === 2, "ItemGroup es una lista");
    const link = await inject("Item", 1);
    const covers = await link.locator(".z-item").evaluate((el) => {
      const r = el.getBoundingClientRect();
      return document.elementFromPoint(r.left + r.width - 8, r.top + r.height / 2)?.closest("a") !== null;
    });
    ok(covers, "el enlace cubre toda la fila");
  });
  await page.evaluate(() => {
    for (const old of document.querySelectorAll("[data-w5-layer]")) old.remove();
  });
}
