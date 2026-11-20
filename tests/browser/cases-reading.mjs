// Contenido de lectura en React (pantalla `?screen=content`): Highlight que sigue a la consulta, ScrollArea enfocable,
// formatos con Intl y Marquee con pausa.
export default function ({ t, assert, poll, expectAttr, expectCount }) {
  return [
    {
      name: "Lectura · Highlight, ScrollArea, formatos y Marquee (React)",
      async run({ open }) {
        const page = await open("content");
        await expectCount(page, `${t("c-scroll")} mark`, 1, "«cafe» marca «Café» (sin acentos)");
        await poll(async () => (await page.locator(`${t("c-scroll")} mark`).first().textContent()) === "Café", "texto original");
        await page.fill('input[aria-label="Highlight query"]', "malaga");
        await poll(async () => (await page.locator(`${t("c-scroll")} mark`).first().textContent()) === "Málaga", "nueva consulta");
        await page.focus(t("c-scroll"));
        await page.keyboard.press("End");
        await poll(() => page.locator(t("c-scroll")).evaluate((el) => el.scrollTop > 0), "Fin desplaza la región enfocada");
        const format = (await page.locator(t("c-format")).textContent()) ?? "";
        assert(format.includes("1.3M") && format.includes("MiB") && format.includes("November 20, 2026"), `formatos: ${format}`);
        await page.click(`${t("c-marquee")} .z-marquee__control`);
        await expectAttr(page, t("c-marquee"), "data-paused", "");
      },
    },
  ];
}
