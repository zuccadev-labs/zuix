// Contenido de lectura sin framework: FormatNumber, FormatByte, FormatDate, Highlight y Marquee desde zui/html.json con
// zui/dom (texto con Intl, marcas de coincidencias, pausa visible).
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const contract = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../../../zui/html.json"), "utf8")).components;

export default async function ({ page, test, ok }) {
  let seq = 0;
  const inject = async (name, index = 0) => {
    const id = `reading-${name}-${++seq}`;
    await page.evaluate(
      async ([html, wrap]) => {
        const box = document.createElement("div");
        box.id = wrap;
        box.setAttribute("data-z-dom", "");
        box.innerHTML = html;
        document.querySelector(".page__main").append(box);
        (await import("/zui/dist/zui.dom.js")).hydrate(box);
      },
      [contract[name].examples[index].html, id],
    );
    return page.locator(`#${id}`);
  };

  await test("Lectura sin React: formatos con Intl y valor exacto en el marcado", async () => {
    const number = await inject("FormatNumber");
    ok(((await number.textContent()) ?? "").includes("1.3M"), "compacto");
    ok((await number.locator("data").first().getAttribute("value")) === "1250000", "valor exacto");
    const bytes = await inject("FormatByte");
    ok(((await bytes.textContent()) ?? "").includes("1.5 MB"), "decimal");
    ok(((await bytes.textContent()) ?? "").includes("MiB"), "binario");
    const date = await inject("FormatDate");
    ok((await date.locator("time").getAttribute("datetime")) === "2026-11-20", "datetime civil");
    ok(((await date.textContent()) ?? "").includes("November 20, 2026"), "fecha larga");
  });

  await test("Lectura sin React: Highlight marca y vuelve a marcar con otra consulta", async () => {
    const box = await inject("Highlight");
    const marks = () => box.locator("mark").evaluateAll((els) => els.map((e) => e.textContent));
    ok((await marks()).join() === "café,Málaga", `marcas: ${await marks()}`);
    await box.evaluate(async (el) => (await import("/zui/dist/zui.dom.js")).setHighlightQuery(el.querySelector(".z-highlight"), "mar"));
    ok((await marks()).join() === "mar", "nueva consulta");
    ok(((await box.textContent()) ?? "").replace(/\s+/g, " ").includes("Un café en Málaga con vistas al mar"), "el texto no cambia");
  });

  await test("Lectura sin React: Marquee con copias inertes y botón de pausa", async () => {
    const box = await inject("Marquee");
    const groups = box.locator(".z-marquee__group");
    ok((await groups.count()) === 2, "dos copias");
    ok(
      (await groups.nth(1).getAttribute("aria-hidden")) === "true" && (await groups.nth(1).getAttribute("inert")) !== null,
      "copia inerte",
    );
    await box.locator(".z-marquee__control").click();
    ok((await box.locator(".z-marquee").getAttribute("data-paused")) !== null, "pausado");
    ok(((await box.locator(".z-marquee__control").textContent()) ?? "").includes("Play"), "etiqueta Play");
    const state = await box.locator(".z-marquee__track").evaluate((el) => getComputedStyle(el).animationPlayState);
    ok(state === "paused", `animación en pausa: ${state}`);
  });
}
