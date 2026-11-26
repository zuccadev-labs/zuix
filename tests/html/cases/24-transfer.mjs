// Sin React: TransferList desde el contrato HTML (elementos en data-props), teclado y z:change; DataTable con filtros,
// ancho de columna, columna fijada y exportar a CSV.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const contract = JSON.parse(readFileSync(join(here, "../../../zui/html.json"), "utf8")).components;

export default async function ({ page, test, ok }) {
  await test("TransferList sin React · teclado, mover con Intro, botones y z:change", async () => {
    await page.evaluate(async (markup) => {
      for (const old of document.querySelectorAll("[data-tr-layer]")) old.remove();
      const box = document.createElement("div");
      box.setAttribute("data-z-dom", "");
      box.setAttribute("data-tr-layer", "");
      box.innerHTML = markup;
      Object.assign(box.style, {
        position: "fixed",
        insetBlockStart: "0",
        insetInlineStart: "0",
        zIndex: "2147483000",
        inlineSize: "min(720px, 100vw)",
        padding: "16px",
        background: "Canvas",
      });
      document.querySelector(".page__main").append(box);
      window.__tr = [];
      box.addEventListener("z:change", (event) => window.__tr.push(event.detail.value));
      (await import("/zui/dist/zui.dom.js")).hydrate(box);
    }, contract.TransferList.examples[0].html);
    const box = page.locator("[data-tr-layer]");
    ok((await box.locator(".z-transfer__option").count()) === 6, "seis opciones pintadas desde data-props");
    ok((await box.locator('.z-transfer__list[data-side="source"] .z-transfer__title').textContent()) === "People", "etiquetas del JSON");
    const source = box.locator('.z-transfer__options[data-side="source"]');
    await source.focus();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Space");
    await page.keyboard.press("Enter");
    const changes = await page.evaluate(() => window.__tr.splice(0));
    ok(JSON.stringify(changes) === JSON.stringify([["chen", "ben"]]), `z:change: ${JSON.stringify(changes)}`);
    ok((await box.locator('input[type=hidden][name="members"]').count()) === 2, "inputs ocultos");
    await box.locator('[data-transfer-action="all-source"]').click();
    ok((await box.locator('.z-transfer__options[data-side="target"] .z-transfer__option').count()) === 0, "mover todo de vuelta");
  });

  await test("DataTable sin React · filtro por columna, ancho con flechas, columna fijada y CSV", async () => {
    const markup = contract.DataTable.examples.find((e) => e.title.startsWith("Filtros, ancho")).html;
    await page.evaluate(async (html) => {
      for (const old of document.querySelectorAll("[data-tr-layer]")) old.remove();
      const box = document.createElement("div");
      box.setAttribute("data-z-dom", "");
      box.setAttribute("data-tr-layer", "");
      box.innerHTML = html;
      Object.assign(box.style, {
        position: "fixed",
        insetBlockStart: "0",
        insetInlineStart: "0",
        zIndex: "2147483000",
        inlineSize: "min(520px, 100vw)",
        padding: "16px",
        background: "Canvas",
      });
      document.querySelector(".page__main").append(box);
      window.__dg = [];
      for (const type of ["z:filterchange", "z:columnresize"])
        box.addEventListener(type, (event) => window.__dg.push([type, event.detail]));
      (await import("/zui/dist/zui.dom.js")).hydrate(box);
    }, markup);
    const box = page.locator("[data-tr-layer]");
    await box.locator('input[aria-label="Filter Team"]').fill("engin");
    const visible = () => box.locator("tbody tr:not([hidden])").count();
    ok((await visible()) === 2, `filtra: ${await visible()}`);
    const csv = await box.evaluate(async (el) =>
      (await import("/zui/dist/zui.dom.js")).dataTableCSVFromDom(el.querySelector(".z-datatable")),
    );
    ok(csv === "Name,Team,Seats\r\nBen Okafor,Engineering,12\r\nChen Wei,Engineering,7", `CSV: ${JSON.stringify(csv)}`);
    await box.locator('.z-table__resize[aria-label="Resize Team"]').focus();
    await page.keyboard.press("ArrowRight");
    const events = await page.evaluate(() => window.__dg.splice(0));
    ok(
      events.some(([type, d]) => type === "z:filterchange" && d.value.team === "engin"),
      "z:filterchange",
    );
    ok(
      events.some(([type, d]) => type === "z:columnresize" && d.key === "team" && d.width > 0),
      "z:columnresize",
    );
    const position = await box
      .locator("tbody td[data-pinned]")
      .first()
      .evaluate((el) => getComputedStyle(el).position);
    ok(position === "sticky", `columna fijada: ${position}`);
  });
}
