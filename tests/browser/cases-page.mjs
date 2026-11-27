// Binding de React de las piezas de la 0.5 en las pantallas `page` y `studio` de examples/app: el índice de DocsLayout
// (TableOfContents), Affix, BackToTop, TopProgress con su controlador, DataView con persistencia, OverflowList, Mentions
// con carga asíncrona sobre un Textarea controlado, SearchView, Popconfirm con confirmación asíncrona, ChatSearch sobre
// MessageList, Checkpoint, WebPreview, VoiceInput (con un micrófono de prueba), StackTrace, AudioPlayer con la onda
// calculada, Waveform controlada y Widget dentro de DashboardGrid.
export default function ({ t, assert, poll, visible, gone }) {
  const said = (page) => page.evaluate(() => [...document.querySelectorAll("[data-z-announcer] [aria-live]")].map((r) => r.textContent).join(" | "));
  const focused = (page, selector) => page.evaluate((s) => document.activeElement?.matches(s) ?? false, selector);
  const scrollPage = (page, to) =>
    page.evaluate((y) => {
      const el = document.querySelector(".z-page");
      el.scrollTop = y === "end" ? el.scrollHeight : y;
    }, to);

  return [
    {
      name: "TableOfContents en DocsLayout (React): el desplazamiento marca la sección, el clic lleva y enfoca; Affix se pega",
      async run({ open, shot }) {
        const page = await open("page");
        const toc = page.locator(".z-docs-layout .z-toc").first();
        await visible(page, ".z-docs-layout .z-toc");
        await poll(async () => (await toc.locator(".z-toc__summary-current").textContent()) === "Loading bar", "primera sección");
        await page.evaluate(() => document.getElementById("pg-overflow").scrollIntoView({ block: "start" }));
        await poll(async () => (await toc.locator(".z-toc__summary-current").textContent()) === "Overflow", "sigue al desplazamiento");
        // Al final del documento manda la última sección, aunque sea corta y no llegue a la línea de lectura.
        await scrollPage(page, "end");
        await poll(async () => (await toc.locator(".z-toc__summary-current").textContent()) === "Contents", "al final, la última");
        await page.evaluate(() => document.getElementById("pg-overflow").scrollIntoView({ block: "start" }));
        await poll(() => page.evaluate(() => document.querySelector('[data-testid="pg-affix"]')?.hasAttribute("data-stuck")), "Affix pegado");
        await shot(page, "page-toc-affix");
        await toc.locator("summary").click();
        await toc.locator('a[href="#pg-views"]').click();
        await poll(() => focused(page, "#pg-views"), "el foco va a la sección");
        await poll(async () => (await toc.locator('[aria-current="true"]').textContent()) === "List or grid", "aria-current en la elegida");
        assert(!(await toc.locator("details").evaluate((d) => d.open)), "el compacto se cierra al elegir");
        await scrollPage(page, 0);
        await poll(() => page.evaluate(() => !document.querySelector('[data-testid="pg-affix"]')?.hasAttribute("data-stuck")), "Affix suelto arriba");
      },
    },
    {
      name: "TableOfContents (React) con movimiento reducido: el salto es instantáneo",
      async run({ open }) {
        const page = await open("page", { reducedMotion: "reduce" });
        const toc = page.locator("#pg-toc-compact");
        await toc.scrollIntoViewIfNeeded();
        await toc.locator("summary").click();
        await toc.locator('a[href="#pg-overflow"]').click();
        const top = await page.evaluate(() => document.getElementById("pg-overflow").getBoundingClientRect().top - document.querySelector(".z-page").getBoundingClientRect().top);
        assert(Math.abs(top) < 4, `ya está arriba sin esperar: ${top}`);
      },
    },
    {
      name: "BackToTop (React): aparece al desplazar, sube y deja el foco en la página",
      async run({ open }) {
        const page = await open("page");
        const button = page.locator(".z-back-to-top__button");
        assert(!(await button.isVisible()), "oculto arriba");
        await scrollPage(page, 900);
        await poll(() => button.isVisible(), "visible al desplazar");
        await button.click();
        await poll(() => page.evaluate(() => document.querySelector(".z-page").scrollTop === 0), "sube");
        await poll(() => focused(page, ".z-page"), "el foco va al desplazador");
      },
    },
    {
      name: "TopProgress (React): start, goteo, set y done del controlador, con anuncio",
      async run({ open }) {
        const page = await open("page");
        const bar = page.locator(".z-top-progress:not([data-inline])");
        assert((await bar.getAttribute("data-state")) === "idle", "reposo");
        await page.locator(t("pg-start")).click();
        await poll(async () => (await bar.getAttribute("data-state")) === "loading", "en marcha");
        const first = Number(await bar.getAttribute("aria-valuenow"));
        await page.waitForTimeout(700);
        assert(Number(await bar.getAttribute("aria-valuenow")) > first, "gotea");
        await page.locator(t("pg-half")).click();
        await poll(async () => (await bar.getAttribute("aria-valuenow")) === "50", "set(0.5)");
        await page.locator(t("pg-done")).click();
        await poll(async () => (await bar.getAttribute("data-state")) === "idle", "se oculta tras terminar");
        await poll(async () => /Loaded/.test(await said(page)), "anuncia el final");
      },
    },
    {
      name: "DataView (React): lista o rejilla con el conmutador, guardado y recuperado al volver",
      async run({ open }) {
        const page = await open("page");
        await page.evaluate(() => localStorage.removeItem("zuix-demo-projects-layout"));
        const view = () => page.locator(".z-dataview").first();
        assert((await view().getAttribute("data-layout")) === "list", "lista por defecto");
        await view().getByRole("radio", { name: "Grid" }).click();
        await poll(async () => (await view().getAttribute("data-layout")) === "grid", "rejilla");
        const columns = await view().locator(".z-dataview__items").evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").length);
        assert(columns > 1, `varias columnas: ${columns}`);
        await page.keyboard.press("ArrowLeft");
        await poll(async () => (await view().getAttribute("data-layout")) === "list", "flechas del radiogroup");
        await page.keyboard.press("ArrowRight");
        await poll(async () => (await page.evaluate(() => localStorage.getItem("zuix-demo-projects-layout"))) === "grid", "guardado");
        // Cada open() es un contexto nuevo (sin el almacenamiento de antes): se recarga la misma página.
        await page.reload();
        await poll(async () => (await view().getAttribute("data-layout")) === "grid", "recuperado tras montar");
        await page.evaluate(() => localStorage.removeItem("zuix-demo-projects-layout"));
      },
    },
    {
      name: "OverflowList (React): lo que no cabe pasa al menú «+N» y elegirlo actúa",
      async run({ open }) {
        const page = await open("page", { width: 900 });
        const list = page.locator(`${t("pg-overflow")} .z-overflow-list`);
        await list.scrollIntoViewIfNeeded();
        const more = list.locator(".z-overflow-list__more");
        await poll(async () => !(await more.evaluate((el) => el.hasAttribute("data-overflow"))), "hay «+N»");
        const hidden = await list.locator(".z-overflow-list__item[data-overflow]").count();
        assert(hidden > 0 && (await more.getAttribute("aria-label")) === `${hidden} more`, `nombre: ${await more.getAttribute("aria-label")}`);
        await more.click();
        await visible(page, ".z-menu:popover-open");
        const entries = await page.locator(".z-menu:popover-open [role=menuitem]").allTextContents();
        assert(entries.length === hidden && entries.at(-1)?.includes("Audit log"), `entradas: ${entries}`);
        await page.locator(".z-menu:popover-open [role=menuitem]").last().click();
        await poll(async () => (await page.locator(t("pg-log")).textContent()) === "Opened Audit log", "onSelect del oculto");
      },
    },
    {
      name: "Mentions (React): @ con lista fija y # con carga asíncrona sobre un Textarea controlado; el texto se codifica",
      async run({ open }) {
        const page = await open("page");
        const area = page.locator(t("pg-comment"));
        await area.scrollIntoViewIfNeeded();
        await area.click();
        await page.keyboard.type("Ping @an");
        const list = page.locator(".z-mentions__popup");
        await poll(() => list.evaluate((el) => el.matches(":popover-open")), "abre");
        assert((await list.locator("[role=option]").count()) >= 1, "Ana");
        await page.keyboard.press("Enter");
        await poll(async () => (await area.inputValue()) === "Ping @Ana López ", `insertado: ${await area.inputValue()}`);
        await page.keyboard.type("in #rel");
        await poll(async () => (await list.getAttribute("aria-busy")) === "true" || (await list.locator("[role=option]").count()) === 1, "carga");
        await poll(async () => (await list.locator("[role=option]").count()) === 1, "canal del servidor");
        await page.keyboard.press("Tab");
        await poll(async () => (await area.inputValue()) === "Ping @Ana López in #releases ", `segunda: ${await area.inputValue()}`);
        assert(await focused(page, t("pg-comment")), "el foco sigue en el campo");
        await page.getByRole("button", { name: "Post" }).click();
        await poll(async () => (await page.locator(t("pg-sent")).textContent())?.includes("Ping <@u1> in <#c1>"), "texto codificado");
      },
    },
    {
      name: "SearchView (React): la barra abre la vista modal, filtra con el valor controlado y Escape devuelve el foco",
      async run({ open, shot }) {
        const page = await open("page");
        const bar = page.locator("#pg-searchview .z-searchview__bar");
        await bar.scrollIntoViewIfNeeded();
        await bar.click();
        await visible(page, "#pg-searchview dialog:modal");
        await poll(() => focused(page, "#pg-searchview .z-searchview__input"), "foco en el campo");
        await page.keyboard.type("bor");
        await poll(async () => (await page.locator("#pg-searchview .z-navlink").allTextContents()).join() === "Borealis", "filtra");
        await shot(page, "page-searchview");
        await page.keyboard.press("Escape");
        await gone(page, "#pg-searchview dialog:modal");
        await poll(() => focused(page, "#pg-searchview .z-searchview__bar"), "el foco vuelve a la barra");
        assert((await bar.textContent()).includes("bor"), "la barra muestra lo escrito");
      },
    },
    {
      name: "SearchView (React) a 390 px: pantalla completa",
      async run({ open }) {
        const page = await open("page", { width: 390, height: 844, hasTouch: true });
        const bar = page.locator("#pg-searchview .z-searchview__bar");
        await bar.scrollIntoViewIfNeeded();
        await bar.click();
        await visible(page, "#pg-searchview dialog:modal");
        const box = await page.locator("#pg-searchview dialog").boundingBox();
        assert(box && box.x === 0 && box.y === 0 && box.width === 390, `pantalla completa: ${JSON.stringify(box)}`);
        await page.locator("#pg-searchview .z-searchview__back").click();
        await gone(page, "#pg-searchview dialog:modal");
      },
    },
    {
      name: "Popconfirm (React): foco en Cancelar, Escape cancela, confirmar espera ocupado y borra",
      async run({ open, shot }) {
        const page = await open("page");
        const trigger = page.locator(t("pg-delete-atlas"));
        await trigger.scrollIntoViewIfNeeded();
        await trigger.click();
        await visible(page, ".z-popconfirm:popover-open");
        await poll(() => focused(page, ".z-popconfirm .z-btn--secondary"), "foco en Cancelar");
        const description = await page.evaluate(() => document.activeElement.getAttribute("aria-describedby"));
        assert(description && (await page.locator(`#${description}`).textContent()) === "Its history goes with it.", "Cancelar lleva la descripción");
        await shot(page, "page-popconfirm");
        await page.keyboard.press("Escape");
        await gone(page, ".z-popconfirm:popover-open");
        await poll(() => focused(page, t("pg-delete-atlas")), "Escape devuelve el foco");
        await trigger.click();
        await visible(page, ".z-popconfirm:popover-open");
        await page.locator(".z-popconfirm").getByRole("button", { name: "Delete" }).click();
        await poll(async () => (await page.locator(".z-popconfirm [data-z-confirm]").getAttribute("aria-busy")) === "true", "ocupado mientras espera");
        await gone(page, t("pg-delete-atlas"));
      },
    },
    {
      name: "ChatSearch (React) sobre MessageList: contador, siguiente, cerrar y abrir",
      async run({ open, shot }) {
        const page = await open("studio");
        const bar = page.locator(".z-chat-search");
        await poll(async () => (await bar.locator(".z-chat-search__count").textContent()) === "1 of 3", "tres coincidencias");
        await bar.locator(".z-chat-search__input").press("Enter");
        await poll(async () => (await bar.locator(".z-chat-search__count").textContent()) === "2 of 3", "siguiente");
        const sizes = await page.evaluate(() => (CSS.highlights ? [CSS.highlights.get("z-search")?.size, CSS.highlights.get("z-search-current")?.size] : null));
        if (sizes) assert(sizes[0] === 2 && sizes[1] === 1, `resaltado: ${sizes}`);
        await shot(page, "studio-chat-search");
        await bar.locator(".z-chat-search__input").press("Escape");
        await gone(page, ".z-chat-search");
        assert((await page.evaluate(() => CSS.highlights?.size ?? 0)) === 0, "al cerrar no queda resaltado");
        await page.getByRole("button", { name: "Search in conversation" }).click();
        await visible(page, ".z-chat-search");
      },
    },
    {
      name: "Checkpoint y WebPreview (React): restaurar, navegar en el iframe aislado y anchos",
      async run({ open }) {
        const page = await open("studio");
        const restore = page.locator(".z-checkpoint").first().getByRole("button", { name: "Restore" });
        assert((await restore.getAttribute("aria-describedby")) !== null, "descrito por el nombre del punto");
        await restore.click();
        await poll(async () => (await page.locator(".z-checkpoint").first().getByRole("button").textContent())?.includes("Restored"), "restaurado");
        const wp = page.locator(".z-web-preview");
        await wp.scrollIntoViewIfNeeded();
        const frame = wp.locator("iframe");
        assert((await frame.getAttribute("src"))?.endsWith("/preview.html"), "dirección inicial");
        assert((await frame.getAttribute("sandbox")) === "allow-scripts allow-forms", "sandbox");
        await poll(async () => !(await wp.evaluate((el) => el.hasAttribute("data-loading"))), "carga");
        const heading = await page.frameLocator(".z-web-preview iframe").locator("h1").textContent();
        assert(heading === "Pricing", `página dentro: ${heading}`);
        await wp.getByRole("button", { name: "Tablet" }).click();
        const width = await wp.locator(".z-web-preview__viewport-frame").evaluate((el) => el.getBoundingClientRect().width);
        assert(width <= 770, `tableta: ${width}`);
        const input = wp.locator(".z-web-preview__input");
        await input.fill("ftp://example.com");
        await input.press("Enter");
        await poll(async () => (await input.getAttribute("aria-invalid")) === "true", "dirección no válida");
        await input.fill("example.com/");
        await input.press("Escape");
      },
    },
    {
      name: "VoiceInput (React) con un micrófono de prueba: graba, pausa, sigue, envía y la nota suena en VoiceNote",
      async run({ open, shot }) {
        const page = await open("studio");
        // Micrófono de prueba: un oscilador a través de Web Audio. MediaRecorder y el analizador son los de verdad.
        await page.evaluate(() => {
          navigator.mediaDevices.getUserMedia = async () => {
            const ctx = new AudioContext();
            const osc = ctx.createOscillator();
            const dest = ctx.createMediaStreamDestination();
            osc.connect(dest);
            osc.start();
            return dest.stream;
          };
        });
        const box = page.locator(".z-voice-input");
        await box.getByRole("button", { name: "Record voice message" }).click();
        await poll(async () => (await box.getAttribute("data-status")) === "recording", "graba");
        await poll(() => focused(page, ".z-voice-input__send"), "el foco va a enviar");
        await page.waitForTimeout(1200);
        assert((await box.locator('[role="timer"]').textContent()) === "0:01", `tiempo: ${await box.locator('[role="timer"]').textContent()}`);
        await shot(page, "studio-voice-recording");
        await box.getByRole("button", { name: "Pause recording" }).click();
        await poll(async () => (await box.getAttribute("data-status")) === "paused", "pausa");
        const paused = await box.locator('[role="timer"]').textContent();
        await page.waitForTimeout(1100);
        assert((await box.locator('[role="timer"]').textContent()) === paused, "en pausa el tiempo no corre");
        await box.getByRole("button", { name: "Resume recording" }).click();
        await page.waitForTimeout(400);
        await box.getByRole("button", { name: "Send recording" }).click();
        await poll(async () => (await box.getAttribute("data-status")) === "idle", "vuelve al botón");
        await visible(page, ".z-voice-note");
        await poll(async () => /Recording sent/.test(await said(page)) || (await page.locator(".z-voice-input [data-live]").textContent()) === "Recording sent", "anuncia el envío");
      },
    },
    {
      name: "StackTrace (React): marcos de terceros plegados, abrir el grupo, plegar y copiar",
      async run({ open }) {
        const page = await open("studio");
        const trace = page.locator(".z-stack-trace");
        await trace.scrollIntoViewIfNeeded();
        assert((await trace.locator(".z-stack-trace__frame[data-app]").count()) === 3, "tres de la aplicación");
        const group = trace.locator(".z-stack-trace__toggle-group");
        assert((await group.textContent()).includes("3 library frames"), "grupo de terceros");
        await group.click();
        await poll(async () => (await trace.locator(".z-stack-trace__toggle-group").getAttribute("aria-expanded")) === "true", "abre");
        await trace.getByRole("button", { name: "Hide frames" }).click();
        await poll(async () => !(await trace.locator(".z-stack-trace__frames").isVisible()), "pliega");
        await trace.getByRole("button", { name: "Show frames" }).click();
        await trace.getByRole("button", { name: "Copy stack trace" }).click();
        await poll(async () => /Stack trace copied|Couldn't copy/.test(await said(page)), "anuncia el copiado");
      },
    },
    {
      name: "AudioPlayer y Waveform (React): onda calculada con Web Audio, reproducir, K, velocidad y posición controlada",
      async run({ open, shot }) {
        const page = await open("studio");
        const player = page.locator(".z-audio-player");
        await player.scrollIntoViewIfNeeded();
        await poll(async () => (await player.locator(".z-audio-player__times").textContent())?.endsWith("0:06"), "duración de los metadatos");
        await poll(async () => (await player.locator(".z-audio-player__wave").getAttribute("aria-busy")) === null, "onda calculada");
        const heights = await player.locator(".z-waveform__bar").evaluateAll((bars) => new Set(bars.map((b) => b.style.getPropertyValue("--z-peak"))).size);
        assert(heights > 4, `la onda tiene forma: ${heights}`);
        await player.getByRole("button", { name: "Play", exact: true }).click();
        await poll(() => player.evaluate((el) => el.hasAttribute("data-playing")), "suena");
        await page.keyboard.press("k");
        await poll(() => player.evaluate((el) => !el.hasAttribute("data-playing")), "K pausa");
        await player.getByRole("button", { name: /Playback speed/ }).click();
        assert((await player.locator(".z-audio-player__rate").textContent()) === "1.25×", "velocidad");
        await shot(page, "studio-audio");
        const wave = page.locator(".z-waveform [role=slider]");
        await wave.focus();
        await page.keyboard.press("ArrowRight");
        await poll(async () => (await wave.getAttribute("aria-valuenow")) === "17", "la posición controlada sigue a onSeek");
      },
    },
    {
      name: "Widget (React) en DashboardGrid: menú, vacío tras cargar y error con reintento",
      async run({ open, shot }) {
        const page = await open("studio");
        const signups = page.locator('.z-widget[data-id="signups"] .z-widget__body');
        await signups.scrollIntoViewIfNeeded();
        await poll(async () => (await signups.getAttribute("data-status")) === "empty", "vacío tras cargar");
        assert((await signups.textContent()).includes("No sign-ups in this period"), "mensaje propio");
        const errors = page.locator('.z-widget[data-id="errors"]');
        assert((await errors.locator('[role="alert"]').count()) === 1, "error en role=alert");
        await shot(page, "studio-widgets");
        await errors.getByRole("button", { name: "Retry" }).click();
        await poll(async () => (await errors.locator(".z-stat__value").textContent()) === "3", "reintento");
        await page.getByRole("button", { name: "Revenue options" }).click();
        await visible(page, '.z-menu:popover-open[role="menu"]');
        await page.keyboard.press("Escape");
        await poll(() => focused(page, '[aria-label="Revenue options"]'), "Escape devuelve el foco");
      },
    },
  ];
}
