// Sin React, idiomas: los paquetes se cargan bajo demanda desde el bundle (zui.locale.<id>.js), el `lang` heredado
// elige los textos de cada sección, setLocale() escribe `lang` en <html> y vuelve a pintar lo montado, y las `labels`
// propias siguen mandando. Plurales con la regla del idioma.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const contract = JSON.parse(readFileSync(join(here, "../../../zui/html.json"), "utf8")).components;

export default async function ({ page, test, ok }) {
  const html = (name, i = 0) => contract[name].html?.[i]?.code ?? contract[name].examples[i].html;
  const inject = async (markup, lang) => {
    await page.evaluate(
      async ([raw, l]) => {
        for (const old of document.querySelectorAll("[data-locale-layer]")) old.remove();
        const box = document.createElement("div");
        box.id = "locale-box";
        if (l) box.lang = l;
        box.setAttribute("data-z-dom", "");
        box.setAttribute("data-locale-layer", "");
        box.innerHTML = raw;
        Object.assign(box.style, {
          position: "fixed",
          inset: "0",
          zIndex: "2147483000",
          overflow: "auto",
          padding: "24px",
          background: "Canvas",
        });
        document.querySelector(".page__main").append(box);
        // Lo que dicen las regiones vivas del anunciador, también lo que otro anuncio pisa después.
        window.__said = [];
        window.__saidObserver?.disconnect();
        window.__saidObserver = new MutationObserver(() => {
          for (const r of document.querySelectorAll("[data-z-announcer] [aria-live]")) if (r.textContent) window.__said.push(r.textContent);
        });
        window.__saidObserver.observe(document.body, { subtree: true, childList: true, characterData: true });
        (await import("/zui/dist/zui.dom.js")).hydrate(box);
      },
      [markup, lang],
    );
    return page.locator("#locale-box");
  };
  const until = async (fn, message, tries = 60) => {
    for (let i = 0; i < tries; i++) {
      if (await fn()) return;
      await page.waitForTimeout(50);
    }
    ok(false, message);
  };
  const search = (box) => box.locator(".z-conversation-list__search input").getAttribute("placeholder");

  await test("Idiomas sin React: lang heredado, carga bajo demanda, plurales y setLocale() que vuelve a pintar y escribe <html lang>", async () => {
    const before = await page.evaluate(() => document.documentElement.lang);
    const requested = [];
    const onRequest = (r) => /zui\.locale\.\w+\.js/.test(r.url()) && requested.push(r.url().split("/").pop());
    page.on("request", onRequest);
    try {
      // Sin paquete cargado, una sección en francés sigue en inglés.
      let box = await inject(html("ConversationList", 0), "fr");
      ok((await search(box)) === "Search chats", `sin paquete, inglés: ${await search(box)}`);
      // Con el paquete francés, la sección `lang="fr"` pasa a francés; fuera de ella, nada cambia.
      await page.evaluate(async () => (await import("/zui/dist/zui.dom.js")).loadLocale("fr"));
      ok(requested.includes("zui.locale.fr.js") && !requested.includes("zui.locale.es.js"), `solo se descarga el francés: ${requested}`);
      box = await inject(html("ConversationList", 0), "fr");
      ok((await search(box)) === "Rechercher dans les discussions", `francés por lang: ${await search(box)}`);
      // Plural: «1 discussion», con la regla del francés.
      await box.locator(".z-conversation-list__search input").fill("lopez");
      await until(
        async () => (await page.evaluate(() => window.__said.join(" | "))).includes("1 discussion"),
        "anuncia «1 discussion»",
        160,
      );
      // `labels` propias mandan sobre el paquete.
      box = await inject(html("ConversationList", 0).replace("data-props>{", 'data-props>{"labels":{"search":"Buscar aquí"},'), "fr");
      ok((await search(box)) === "Buscar aquí", `las labels propias mandan: ${await search(box)}`);
      // setLocale("de"): lo montado sin lang propio pasa a alemán y <html lang> dice "de".
      box = await inject(html("ConversationList", 0));
      ok((await search(box)) === "Search chats", "sin lang propio, inglés");
      await page.evaluate(async () => (await import("/zui/dist/zui.dom.js")).setLocale("de"));
      ok((await page.evaluate(() => document.documentElement.lang)) === "de", "setLocale escribe lang en <html>");
      await until(async () => (await search(box)) === "Chats durchsuchen", "vuelve a pintar en alemán");
    } finally {
      page.off("request", onRequest);
      await page.evaluate(async (lang) => {
        const zui = await import("/zui/dist/zui.dom.js");
        await zui.setLocale("en");
        document.documentElement.lang = lang;
        for (const old of document.querySelectorAll("[data-locale-layer]")) old.remove();
        window.__saidObserver?.disconnect();
      }, before);
    }
  });
}
