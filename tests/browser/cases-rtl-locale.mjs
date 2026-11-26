// Binding de React de derecha a izquierda (`?dir=rtl` de examples/app) en las familias de la 0.4: chat, IA, dashboard,
// personas, nodos, terminal y tiempo. Las flechas llevan al elemento que está en ese lado de la pantalla, los iconos con
// sentido se reflejan y el código sigue en LTR. Y los idiomas (`?lang=`): LocaleProvider carga el paquete al montar,
// los layouts de zout traen el suyo y los plurales siguen la regla del idioma.
export default function ({ assert, poll }) {
  const focusX = (page) =>
    page.evaluate(() => {
      const r = document.activeElement?.getBoundingClientRect();
      return r ? r.left + r.width / 2 : Number.NaN;
    });
  const centerX = async (loc) => {
    const b = await loc.boundingBox();
    return b.x + b.width / 2;
  };
  const step = async (page, key) => {
    const before = await focusX(page);
    await page.keyboard.press(key);
    await page.waitForTimeout(80);
    const after = await focusX(page);
    return after < before - 1 ? "left" : after > before + 1 ? "right" : "none";
  };
  const mirrored = (loc) => loc.evaluate((el) => getComputedStyle(el).scale === "-1 1");
  const rtl = { query: "dir=rtl" };

  return [
    {
      name: "RTL (React) · Chat: filtros con ← al siguiente, hora al final del texto sin taparlo y responder reflejado",
      async run({ open }) {
        const page = await open("chat", rtl);
        const filter = (f) => page.locator(`.z-conversation-list__filter[data-filter="${f}"]`).first();
        assert((await centerX(filter("all"))) > (await centerX(filter("unread"))), "«All» a la derecha de «Unread»");
        await filter("all").focus();
        assert((await step(page, "ArrowLeft")) === "left", "← al filtro de la izquierda");
        await filter("all").click();
        const hits = await page.locator(".z-message__bubble").evaluateAll((bubbles) =>
          bubbles
            .filter((b) => b.querySelector(".z-message__text") && b.querySelector(".z-message__meta"))
            .map((b) => {
              const meta = b.querySelector(".z-message__meta").getBoundingClientRect();
              const range = document.createRange();
              range.selectNodeContents(b.querySelector(".z-message__text"));
              return [...range.getClientRects()].some(
                (l) => l.left < meta.right && l.right > meta.left && l.top < meta.bottom && l.bottom > meta.top,
              );
            }),
        );
        assert(hits.length > 0 && hits.every((h) => !h), `ninguna hora tapa su texto: ${JSON.stringify(hits)}`);
        const reply = page.locator('.z-message-list svg[data-icon="arrow-turn-up-left"]').first();
        if (await reply.count()) assert(await mirrored(reply), "responder se refleja");
      },
    },
    {
      name: "RTL (React) · Asistente: el código de las herramientas sigue en LTR y «siguiente» de las ramas queda a la izquierda",
      async run({ open }) {
        const page = await open("assistant", rtl);
        await page.locator('[data-testid="a-suggestions"] .z-suggestion').first().click();
        const answer = page.locator('[data-testid="a-answer"] .z-assistant-message').last();
        await poll(async () => (await answer.getAttribute("data-state")) === "done", "la respuesta termina", 15000);
        const tool = answer.locator(".z-tool-call").first();
        if ((await tool.getAttribute("open")) === null && (await tool.locator("summary, .z-tool-call__head").count()))
          await tool.locator("summary, .z-tool-call__head").first().click();
        const code = page.locator(".z-tool-call__code").first();
        await poll(async () => (await code.count()) > 0, "hay una herramienta con código");
        assert((await code.evaluate((el) => getComputedStyle(el).direction)) === "ltr", "código LTR");
        const picker = page.locator(".z-branch-picker").first();
        if (await picker.count()) {
          const buttons = picker.locator(".z-branch-picker__button");
          assert((await centerX(buttons.first())) > (await centerX(buttons.last())), "anterior a la derecha, siguiente a la izquierda");
        }
      },
    },
    {
      name: "RTL (React) · Dashboard y tablero: el Tracker y la rejilla siguen a la pantalla y el kanban mueve con ← a la columna de la izquierda",
      async run({ open }) {
        let page = await open("dashboard", rtl);
        const bars = page.locator(".z-tracker__bar");
        assert((await centerX(bars.first())) > (await centerX(bars.last())), "el primer día a la derecha");
        await bars.first().focus();
        assert((await step(page, "ArrowLeft")) === "left", "← al día de la izquierda");
        page = await open("kanban", rtl);
        const card = page.locator(".z-kanban__card").first();
        const id = await card.getAttribute("data-id");
        const from = await centerX(card);
        await card.focus();
        await page.keyboard.press("Space");
        await page.keyboard.press("ArrowLeft");
        await page.keyboard.press("Enter");
        await poll(
          async () => (await centerX(page.locator(`.z-kanban__card[data-id="${id}"]`))) < from - 40,
          "la tarjeta pasa a la columna de la izquierda",
        );
      },
    },
    {
      name: "RTL (React) · Personas: «Salir» del menú de cuenta se refleja y el avatar abre cada fila de miembros",
      async run({ open }) {
        const page = await open("profile", rtl);
        const trigger = page.locator(".z-account-menu").first();
        await trigger.click();
        const out = page.locator('svg[data-icon="arrow-right-start-on-rectangle"]').first();
        await poll(async () => (await out.count()) > 0 && (await out.isVisible()), "el menú abre con «Salir»");
        assert(await mirrored(out), "el icono de salir apunta a la izquierda");
        await page.keyboard.press("Escape");
        const row = page.locator(".z-member-list__row").first();
        const avatar = await row.locator(".z-avatar").first().boundingBox();
        const name = await row.locator(".z-persona__name").first().boundingBox();
        assert(avatar.x > name.x, "avatar a la derecha del nombre");
      },
    },
    {
      name: "RTL (React) · Flujos: deshacer y rehacer se reflejan y el lienzo sigue siendo espacial (→ al nodo de la derecha)",
      async run({ open }) {
        const page = await open("flows", rtl);
        for (const name of ["arrow-uturn-up-left", "arrow-uturn-up-right"]) {
          const icon = page.locator(`.z-node-controls svg[data-icon="${name}"]`).first();
          assert(await mirrored(icon), `${name} reflejado`);
        }
        const nodes = page.locator(".z-node-canvas .z-node");
        await poll(async () => (await nodes.count()) >= 2, "hay nodos");
        const xs = await nodes.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().left));
        await nodes.nth(xs.indexOf(Math.min(...xs))).focus();
        assert((await step(page, "ArrowRight")) === "right", "→ al nodo de la derecha");
      },
    },
    {
      name: "RTL (React) · Terminal: registro y código en LTR, y las pestañas de archivos van con la lectura",
      async run({ open }) {
        const page = await open("terminal", rtl);
        assert(
          (await page
            .locator(".z-log-console__grid")
            .first()
            .evaluate((el) => getComputedStyle(el).direction)) === "ltr",
          "registro LTR",
        );
        const cell = page.locator(".z-log-console__body .z-log-console__cell").first();
        await cell.click();
        assert((await step(page, "ArrowRight")) === "right", "→ a la celda de la derecha");
        const tabs = page.locator(".z-code-viewer__tab");
        if ((await tabs.count()) > 1) {
          assert((await centerX(tabs.first())) > (await centerX(tabs.last())), "el primer archivo a la derecha");
          await tabs.first().focus();
          assert((await step(page, "ArrowLeft")) === "left", "← al archivo de la izquierda");
        }
      },
    },
    {
      name: "RTL (React) · Tiempo: unidades de la cuenta atrás y ciudades de derecha a izquierda; la duración se escribe como una hora",
      async run({ open }) {
        const page = await open("time", rtl);
        const units = page.locator('[data-testid="t-countdown"] .z-countdown__unit');
        assert((await centerX(units.first())) > (await centerX(units.last())), "los días a la derecha");
        const cities = page.locator('[data-testid="t-world"] .z-world-clock__city');
        assert((await centerX(cities.first())) > (await centerX(cities.nth(1))), "la primera ciudad a la derecha");
        const segments = page.locator('[data-testid="t-duration"] .z-duration-field__segment');
        await segments.first().focus();
        assert((await step(page, "ArrowRight")) === "right", "→ al segmento de la derecha");
      },
    },
    {
      name: "Idiomas (React) · LocaleProvider carga el español al montar, ChatLayout trae sus textos de zout y los plurales siguen al idioma",
      async run({ open }) {
        const page = await open("chat", { query: "lang=es" });
        const search = page.locator(".z-conversation-list__search input").first();
        await poll(async () => (await search.getAttribute("placeholder")) === "Buscar chats", "la búsqueda en español");
        await poll(
          async () => (await page.locator(".z-chat-layout [aria-label='Conversación'], .z-chat-layout [aria-label='Chats']").count()) > 0,
          "las regiones de ChatLayout en español",
        );
        assert((await page.evaluate(() => document.documentElement.lang)) === "es", "<html lang> es");
        const fr = await open("profile", { query: "lang=fr" });
        const count = fr.locator(".z-member-list__count").first();
        await poll(async () => /^\d+ membres?$/.test(((await count.textContent()) ?? "").trim()), "MemberList cuenta en francés").catch(
          async (e) => {
            throw new Error(
              `${e.message}: «${await count.textContent()}» · ${await fr.locator(".z-member-list__search input, [data-search]").first().getAttribute("placeholder")}`,
            );
          },
        );
      },
    },
  ];
}
