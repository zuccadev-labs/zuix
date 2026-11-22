// Sin React: TransferList desde el contrato HTML (elementos en data-props), teclado y z:change.
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
}
