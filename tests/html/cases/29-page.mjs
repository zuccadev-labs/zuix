// Sin React: piezas de página y de dominio de la 0.5 (TableOfContents, BackToTop, Affix, TopProgress, DataView,
// OverflowList, ChatSearch, WebPreview, VoiceInput, StackTrace, Widget, AudioPlayer, Waveform, Mentions, SearchView y
// Popconfirm) desde las tarjetas del contrato HTML y marcado escrito a mano.
export default async function ({ page, test, ok, card, settle }) {
  const focusIs = (selector) => page.evaluate((s) => document.activeElement?.matches(s) ?? false, selector);
  const inject = async (markup) => {
    await page.evaluate(async (html) => {
      for (const old of document.querySelectorAll("[data-pg-layer]")) old.remove();
      const box = document.createElement("div");
      box.setAttribute("data-z-dom", "");
      box.setAttribute("data-pg-layer", "");
      box.id = "pg-layer";
      box.innerHTML = html;
      Object.assign(box.style, { position: "fixed", insetBlockStart: "0", insetInlineStart: "0", zIndex: "2147483000", inlineSize: "640px", padding: "24px", background: "Canvas" });
      document.querySelector(".page__main").append(box);
      window.__pg = [];
      for (const type of ["z:activechange", "z:stuckchange", "z:layoutchange", "z:urlchange", "z:mention", "z:valuechange", "z:confirm", "z:copy", "z:play", "z:seek", "z:error"])
        box.addEventListener(type, (e) => window.__pg.push([type, JSON.parse(JSON.stringify(e.detail ?? null))]));
      const zui = await import("/zui/dist/zui.dom.js");
      zui.hydrate(box);
    }, markup);
    return page.locator("#pg-layer");
  };
  const clearLayer = () => page.evaluate(() => {
      for (const el of document.querySelectorAll("[data-pg-layer]")) el.remove();
    });

  await test("TableOfContents: el desplazamiento marca la sección y el clic lleva, marca y enfoca", async () => {
    const toc = card("TableOfContents").locator(".z-toc").first();
    await toc.scrollIntoViewIfNeeded();
    await settle();
    ok((await toc.getAttribute("role")) === "navigation" && (await toc.getAttribute("aria-label")) === "On this page", "navegación con nombre");
    ok((await toc.locator('[aria-current="true"]').textContent()) === "Introduction", "sección inicial");
    // Desplazar el artículo hasta «Usage»: el observador marca la sección (y `scrollend` cubre el salto).
    await page.evaluate(() => {
      const article = document.getElementById("toc-demo-article");
      article.scrollTop = article.scrollHeight;
    });
    await page.waitForFunction(() => document.querySelector('.z-toc [aria-current="true"]')?.textContent === "Usage", null, { timeout: 3000 }).catch(() => {});
    ok((await toc.locator('[aria-current="true"]').textContent()) === "Usage", `al final: ${await toc.locator('[aria-current="true"]').textContent()}`);
    await toc.locator('a[href="#toc-install"]').click();
    await page.waitForTimeout(900);
    ok((await toc.locator('[aria-current="true"]').textContent()) === "Install", "el clic marca la sección");
    ok(await focusIs("#toc-install"), "el foco va a la sección");
    ok((await page.evaluate(() => location.hash)) === "#toc-install", "la dirección lleva el fragmento");
    const top = await page.evaluate(() => {
      const a = document.getElementById("toc-demo-article");
      return document.getElementById("toc-install").getBoundingClientRect().top - a.getBoundingClientRect().top;
    });
    ok(Math.abs(top) < 4, `la sección queda arriba: ${top}`);
    await page.evaluate(() => history.replaceState(null, "", location.pathname));
  });

  await test("TableOfContents compacto: <details> con la sección actual en el resumen", async () => {
    // El contrato muestra el primer ejemplo de cada pieza: el compacto se monta aquí, con sus enlaces ya escritos.
    await inject(
      '<div class="z-toc" data-compact data-label="On this page" style="max-width: 280px"><ol class="z-toc__list"><li class="z-toc__entry" data-depth="0"><a class="z-toc__link" href="#nowhere-a">Introduction</a></li><li class="z-toc__entry" data-depth="0"><a class="z-toc__link" href="#nowhere-b" aria-current="true">Install</a></li></ol></div>',
    );
    const toc = page.locator("#pg-layer .z-toc");
    ok((await toc.locator(".z-toc__summary-current").textContent()) === "Install", "sección actual en el resumen (leída de los enlaces)");
    await toc.locator("summary").click();
    ok(await toc.locator("details").evaluate((d) => d.open), "abre");
    ok((await toc.locator(".z-toc__link").count()) === 2, "enlaces");
    await toc.locator("summary").click();
    await clearLayer();
  });

  await test("BackToTop: aparece al pasar el umbral, sube y deja el foco en el desplazador", async () => {
    const scroller = page.locator("#btt-demo");
    await scroller.scrollIntoViewIfNeeded();
    const button = scroller.locator(".z-back-to-top__button");
    ok(!(await button.isVisible()), "oculto arriba");
    ok((await button.getAttribute("tabindex")) === "-1", "oculto, fuera del tabulador");
    await scroller.evaluate((el) => {
      el.scrollTop = 300;
    });
    await page.waitForFunction(() => document.querySelector("#btt-demo .z-back-to-top")?.hasAttribute("data-visible"));
    await settle();
    ok(await button.isVisible(), "visible al desplazar");
    ok((await button.textContent()).includes("Back to top"), "texto visible");
    await button.click();
    await page.waitForFunction(() => document.getElementById("btt-demo").scrollTop === 0, null, { timeout: 3000 });
    ok(await focusIs("#btt-demo"), "el foco va al desplazador, no al body");
  });

  await test("TopProgress: sigue a topProgress (start, goteo, done), anuncia y en reposo se oculta", async () => {
    await inject('<div class="z-top-progress" data-inline style="position: relative"></div>');
    const bar = page.locator("#pg-layer .z-top-progress");
    ok((await bar.getAttribute("data-state")) === "idle" && (await bar.getAttribute("aria-hidden")) === "true", "reposo");
    await page.evaluate(async () => (await import("/zui/dist/zui.dom.js")).topProgress.start());
    ok((await bar.getAttribute("data-state")) === "loading", "en marcha");
    const first = Number(await bar.getAttribute("aria-valuenow"));
    await page.waitForTimeout(700);
    const later = Number(await bar.getAttribute("aria-valuenow"));
    ok(later > first, `gotea: ${first} → ${later}`);
    await page.evaluate(async () => (await import("/zui/dist/zui.dom.js")).topProgress.done());
    ok((await bar.getAttribute("aria-valuenow")) === "100", "lleno al terminar");
    await page.waitForFunction(() => document.querySelector("#pg-layer .z-top-progress")?.dataset.state === "idle");
    const said = await page.evaluate(() => [...document.querySelectorAll("[data-z-announcer] [aria-live]")].map((r) => r.textContent).join("|"));
    ok(said.includes("Loaded"), `anuncio del final: ${said}`);
    ok((await card("TopProgress").locator(".z-top-progress").first().getAttribute("aria-valuenow")) === "64", "valor fijo de la tarjeta");
    await clearLayer();
  });

  await test("Affix: se pega con position: sticky y lo dice con data-stuck", async () => {
    await inject(
      '<div id="affix-scroll" style="block-size: 200px; overflow: auto"><p style="block-size: 80px">Above</p><div class="z-affix" style="--z-affix-offset: 8px"><button type="button" class="z-btn" data-size="sm">Filters</button></div><p style="block-size: 900px">Below</p></div>',
    );
    const affix = page.locator("#pg-layer .z-affix");
    ok(!(await affix.evaluate((el) => el.hasAttribute("data-stuck"))), "suelto arriba");
    await page.evaluate(() => {
      document.getElementById("affix-scroll").scrollTop = 300;
    });
    await page.waitForFunction(() => document.querySelector("#pg-layer .z-affix")?.hasAttribute("data-stuck"));
    const gap = await page.evaluate(() => document.querySelector("#pg-layer .z-affix").getBoundingClientRect().top - document.getElementById("affix-scroll").getBoundingClientRect().top);
    ok(Math.abs(gap - 8) < 2, `pegado a 8 px: ${gap}`);
    ok((await page.evaluate(() => window.__pg.filter(([t]) => t === "z:stuckchange").length)) >= 1, "z:stuckchange");
    await clearLayer();
  });

  await test("DataView: el conmutador pasa a rejilla, lo guarda y lo recupera", async () => {
    const view = card("DataView").locator(".z-dataview");
    ok((await view.getAttribute("data-layout")) === "grid", "rejilla inicial");
    await view.getByRole("radio", { name: "List" }).click();
    ok((await view.getAttribute("data-layout")) === "list", "lista");
    const markup = await view.evaluate((el) => el.outerHTML);
    await page.evaluate(() => localStorage.removeItem("pg-dataview"));
    await inject(markup.replace('class="z-dataview"', 'class="z-dataview" data-persist="pg-dataview"'));
    const copy = page.locator("#pg-layer .z-dataview");
    await copy.getByRole("radio", { name: "Grid" }).click();
    ok((await page.evaluate(() => localStorage.getItem("pg-dataview"))) === "grid", "guardado");
    ok((await page.evaluate(() => JSON.stringify(window.__pg))).includes('"layout":"grid"'), "z:layoutchange");
    await inject(markup.replace('class="z-dataview"', 'class="z-dataview" data-persist="pg-dataview"').replace('data-layout="list"', 'data-layout="list"'));
    ok((await page.locator("#pg-layer .z-dataview").getAttribute("data-layout")) === "grid", "recuperado al montar");
    ok(
      (await page.locator('#pg-layer [role="radio"][value="grid"]').getAttribute("aria-checked")) === "true",
      "el conmutador marca lo recuperado",
    );
    await page.evaluate(() => localStorage.removeItem("pg-dataview"));
    await clearLayer();
  });

  await test("OverflowList: lo que no cabe pasa al menú «+N» y elegirlo pulsa el original", async () => {
    const list = card("OverflowList").locator(".z-overflow-list");
    await list.scrollIntoViewIfNeeded();
    await settle();
    const hidden = Number(await list.getAttribute("data-hidden-count"));
    ok(hidden > 0, `algo no cabe: ${hidden}`);
    const more = list.locator(".z-overflow-list__more");
    ok((await more.getAttribute("aria-label")) === `${hidden} more`, `nombre del «+N»: ${await more.getAttribute("aria-label")}`);
    ok((await list.locator(".z-overflow-list__item[data-overflow][inert]").count()) === hidden, "ocultos inertes");
    await page.evaluate(() => {
      window.__clicked = [];
      document.querySelector('[data-component="OverflowList"] [data-id="settings"] button').addEventListener("click", () => window.__clicked.push("settings"));
    });
    await more.click();
    await settle();
    const menu = page.locator("#overflow-menu");
    ok(await menu.evaluate((el) => el.matches(":popover-open")), "abre el menú");
    ok((await menu.locator("[data-overflow-for]:not([hidden])").count()) === hidden, "el menú repite los que no caben");
    await menu.locator('[data-overflow-for="settings"]').click();
    ok((await page.evaluate(() => window.__clicked.join())) === "settings", "pulsa el elemento original");
    // Más ancho: caben todos y el botón sobra.
    await list.evaluate((el) => {
      el.style.maxWidth = "none";
      el.style.flex = "none";
      el.style.inlineSize = "900px";
    });
    await page.waitForFunction(() => document.querySelector('[data-component="OverflowList"] .z-overflow-list')?.dataset.hiddenCount === "0");
    ok(await more.evaluate((el) => el.hasAttribute("data-overflow")), "sin ocultos no hay «+N»");
    await list.evaluate((el) => {
      el.style.inlineSize = "";
      el.style.flex = "";
      el.style.maxWidth = "340px";
    });
  });

  await test("ChatSearch: cuenta, avanza con Intro, resalta con la Highlight API y vuelve a buscar", async () => {
    const bar = card("ChatSearch").locator(".z-chat-search");
    await bar.scrollIntoViewIfNeeded();
    ok((await bar.getAttribute("role")) === "search", "role=search");
    ok((await bar.locator(".z-chat-search__count").textContent()) === "1 of 2", "contador inicial");
    const input = bar.locator(".z-chat-search__input");
    await input.press("Enter");
    ok((await bar.locator(".z-chat-search__count").textContent()) === "2 of 2", "Intro avanza");
    await input.press("Shift+Enter");
    ok((await bar.locator(".z-chat-search__count").textContent()) === "1 of 2", "Mayús + Intro retrocede");
    const marks = await page.evaluate(() => (CSS.highlights ? [CSS.highlights.get("z-search")?.size ?? 0, CSS.highlights.get("z-search-current")?.size ?? 0] : null));
    if (marks) ok(marks[0] === 1 && marks[1] === 1, `resaltado: ${marks}`);
    await input.fill("notes");
    await page.waitForTimeout(300);
    ok((await bar.locator(".z-chat-search__count").textContent()) === "1 of 2", "nueva consulta");
    await input.fill("zzz");
    await page.waitForTimeout(300);
    ok((await bar.locator(".z-chat-search__count").textContent()) === "No results", "sin resultados");
    ok(await bar.locator(".z-chat-search__next").isDisabled(), "siguiente desactivado");
    // Un mensaje nuevo con la consulta: se vuelve a buscar sola.
    await page.evaluate(() => {
      const li = document.createElement("li");
      li.className = "z-message";
      li.innerHTML = '<div class="z-message__text">zzz arrived</div>';
      document.getElementById("chat-search-demo").append(li);
    });
    await page.waitForTimeout(400);
    ok((await bar.locator(".z-chat-search__count").textContent()) === "1 of 1", "busca en lo que llega");
    await page.evaluate(() => document.querySelector("#chat-search-demo li:last-child").remove());
    await input.fill("release");
    await page.waitForTimeout(300);
  });

  await test("WebPreview: dirección no válida, navegar en el iframe aislado, atrás y anchos", async () => {
    await inject('<div class="z-web-preview" data-viewports data-title="Local page" data-url="/zui/package.json" style="--z-web-preview-height: 240px"></div>');
    const wp = page.locator("#pg-layer .z-web-preview");
    const frame = wp.locator("iframe");
    ok((await frame.getAttribute("sandbox")) === "allow-scripts allow-forms", "sandbox por defecto");
    ok((await frame.getAttribute("title")) === "Local page", "title del iframe");
    ok((await frame.getAttribute("referrerpolicy")) === "no-referrer", "sin referer");
    const input = wp.locator(".z-web-preview__input");
    await input.fill("javascript:alert(1)");
    await input.press("Enter");
    ok((await input.getAttribute("aria-invalid")) === "true", "aria-invalid");
    ok((await wp.locator('[role="alert"]').textContent()).includes("http"), "mensaje de error");
    const origin = await page.evaluate(() => location.origin);
    await input.fill(`${origin}/zout/package.json`);
    await input.press("Enter");
    ok((await frame.getAttribute("src")) === `${origin}/zout/package.json`, "navega");
    ok((await page.evaluate(() => JSON.stringify(window.__pg))).includes("urlchange"), "z:urlchange");
    await wp.getByRole("button", { name: "Back" }).click();
    ok((await wp.locator("iframe").getAttribute("src")).endsWith("/zui/package.json"), "atrás");
    await wp.getByRole("button", { name: "Mobile" }).click();
    // El ancho cambia con una transición: se espera a que acabe.
    await page
      .waitForFunction(() => document.querySelector("#pg-layer .z-web-preview__viewport-frame").getBoundingClientRect().width <= 392, null, { timeout: 3000 })
      .catch(() => {});
    const width = await wp.locator(".z-web-preview__viewport-frame").evaluate((el) => el.getBoundingClientRect().width);
    ok(width <= 392, `ancho de móvil: ${width}`);
    ok((await wp.getByRole("button", { name: "Mobile" }).getAttribute("aria-pressed")) === "true", "aria-pressed");
    await clearLayer();
  });

  await test("VoiceInput: sin permiso o sin dispositivo lo dice y no se rompe", async () => {
    const box = card("VoiceInput").locator(".z-voice-input");
    const record = box.locator(".z-voice-input__record");
    ok((await record.textContent()).includes("Record voice message"), "botón con texto");
    await record.click();
    await page.waitForFunction(() => {
      const el = document.querySelector('[data-component="VoiceInput"] .z-voice-input');
      return el?.dataset.status === "error" || el?.dataset.status === "recording";
    }, null, { timeout: 5000 });
    const status = await box.getAttribute("data-status");
    if (status === "recording") {
      await box.locator(".z-voice-input__cancel").click();
      ok((await box.getAttribute("data-status")) === "idle", "cancelar vuelve al botón");
    } else {
      ok((await box.locator('[role="alert"]').count()) === 1, "motivo en un role=alert");
      ok(!(await record.isDisabled()), "se puede volver a intentar");
      ok((await record.getAttribute("aria-describedby")) === (await box.locator(".z-voice-input__message").getAttribute("id")), "el botón se describe con el motivo");
    }
  });

  await test("StackTrace: grupos de terceros, plegar y copiar", async () => {
    const trace = card("StackTrace").locator(".z-stack-trace");
    await trace.scrollIntoViewIfNeeded();
    ok((await trace.locator(".z-stack-trace__name").textContent()) === "TypeError", "tipo");
    const group = trace.locator(".z-stack-trace__toggle-group");
    ok((await group.getAttribute("aria-expanded")) === "false", "terceros plegados");
    await group.click();
    ok((await trace.locator(".z-stack-trace__toggle-group").getAttribute("aria-expanded")) === "true", "abre el grupo");
    ok(await trace.locator(".z-stack-trace__library").isVisible(), "marcos de terceros a la vista");
    const toggle = trace.locator(".z-stack-trace__toggle");
    await toggle.click();
    ok((await trace.locator(".z-stack-trace__toggle").getAttribute("aria-expanded")) === "false", "pliega");
    ok(!(await trace.locator(".z-stack-trace__frames").isVisible()), "marcos ocultos");
    await trace.locator(".z-stack-trace__toggle").click();
    await page.evaluate(() => {
      window.__copied = [];
      document.querySelector('[data-component="StackTrace"]').addEventListener("z:copy", (e) => window.__copied.push(e.detail.ok));
    });
    await trace.locator(".z-stack-trace__copy").click();
    await page.waitForFunction(() => window.__copied.length > 0);
    ok(await trace.locator(".z-stack-trace__copy").evaluate((b) => b === document.activeElement), "el foco sigue en copiar");
  });

  await test("Widget: menú de la cabecera y estado de error", async () => {
    const widget = card("Widget").locator(".z-widget").first();
    await widget.scrollIntoViewIfNeeded();
    await widget.getByRole("button", { name: "Revenue options" }).click();
    await settle();
    ok(await page.locator("#widget-demo-menu").evaluate((el) => el.matches(":popover-open")), "abre el menú");
    await page.keyboard.press("Escape");
    await settle();
    const markup = (await import("node:fs")).readFileSync(new URL("../../../zui/html.json", import.meta.url), "utf8");
    await inject(JSON.parse(markup).components.Widget.examples[1].html);
    const error = page.locator('#pg-layer .z-widget__state[data-status="error"]');
    ok((await error.getAttribute("role")) === "alert", "error en role=alert");
    ok((await error.getByRole("button", { name: "Retry" }).count()) === 1, "reintentar");
    await clearLayer();
  });

  await test("Waveform: deslizador con flechas, Inicio y Fin", async () => {
    const wave = card("Waveform").locator('[role="slider"]');
    await wave.scrollIntoViewIfNeeded();
    ok((await wave.getAttribute("aria-valuenow")) === "12", "posición inicial");
    await wave.focus();
    await page.keyboard.press("ArrowRight");
    ok((await card("Waveform").locator('[role="slider"]').getAttribute("aria-valuenow")) === "17", "+5 s");
    await page.keyboard.press("End");
    ok((await card("Waveform").locator('[role="slider"]').getAttribute("aria-valuetext")) === "0:42 / 0:42", "Fin");
    ok(await focusIs('[data-component="Waveform"] [role="slider"]'), "el foco sigue en la onda");
  });

  await test("AudioPlayer: reproduce un audio, K pausa, L salta y la velocidad cambia", async () => {
    // Un segundo de silencio en WAV, hecho en la página (sin red).
    await inject('<div class="z-audio-player" data-title="Silence" data-peaks="1 2 3 2 1"></div>');
    await page.evaluate(() => {
      const rate = 8000;
      const n = rate * 4;
      const buf = new ArrayBuffer(44 + n * 2);
      const v = new DataView(buf);
      const s = (o, t) => {
        for (let i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i));
      };
      s(0, "RIFF");
      v.setUint32(4, 36 + n * 2, true);
      s(8, "WAVEfmt ");
      v.setUint32(16, 16, true);
      v.setUint16(20, 1, true);
      v.setUint16(22, 1, true);
      v.setUint32(24, rate, true);
      v.setUint32(28, rate * 2, true);
      v.setUint16(32, 2, true);
      v.setUint16(34, 16, true);
      s(36, "data");
      v.setUint32(40, n * 2, true);
      const url = URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
      const el = document.querySelector("#pg-layer .z-audio-player");
      el.dataset.src = url;
      // Atributo cambiado: se vuelve a pintar (setWidgetProps fuerza el pintado).
      return import("/zui/dist/zui.dom.js").then((z) => z.setWidgetProps(el, { src: url }));
    });
    const player = page.locator("#pg-layer .z-audio-player");
    await page.waitForFunction(() => document.querySelector("#pg-layer .z-audio-player__times")?.lastElementChild?.textContent === "0:04", null, { timeout: 5000 });
    ok((await player.getAttribute("aria-labelledby")) !== null, "grupo nombrado por el título");
    await player.getByRole("button", { name: "Play", exact: true }).click();
    await page.waitForFunction(() => document.querySelector("#pg-layer .z-audio-player")?.hasAttribute("data-playing"), null, { timeout: 5000 });
    await page.keyboard.press("k");
    await page.waitForFunction(() => !document.querySelector("#pg-layer .z-audio-player")?.hasAttribute("data-playing"));
    ok((await player.getByRole("button", { name: "Play", exact: true }).count()) === 1, "K pausa");
    await page.locator("#pg-layer .z-audio-player__wave").focus();
    await page.keyboard.press("Home");
    await page.keyboard.press("l");
    ok((await page.locator("#pg-layer .z-audio-player__wave").getAttribute("aria-valuenow")) === "4", "L salta (acotado a la duración)");
    await player.getByRole("button", { name: /Playback speed/ }).click();
    ok((await player.locator(".z-audio-player__rate").textContent()) === "1.25×", "velocidad");
    ok((await page.locator("#pg-layer audio").evaluate((a) => a.playbackRate)) === 1.25, "playbackRate del audio");
    await clearLayer();
  });

  await test("Mentions: @ abre la lista anclada al cursor, ↓ e Intro insertan, Escape cierra", async () => {
    const area = card("Mentions").locator("textarea");
    await area.scrollIntoViewIfNeeded();
    await area.click();
    await area.fill("");
    await page.keyboard.type("Hi @");
    const list = card("Mentions").locator(".z-mentions__popup");
    await page.waitForFunction(() => document.querySelector('[data-component="Mentions"] .z-mentions__popup')?.matches(":popover-open"));
    ok((await list.getAttribute("role")) === "listbox" && (await list.getAttribute("aria-label")) === "People", "listbox con nombre de la fuente");
    ok((await area.getAttribute("aria-controls")) === (await list.getAttribute("id")), "aria-controls");
    ok((await list.locator('[role="option"]').count()) === 3, "tres personas");
    await page.keyboard.type("br");
    ok((await list.locator('[role="option"]').count()) === 1, "filtra");
    await page.keyboard.press("Backspace");
    await page.keyboard.press("Backspace");
    await page.keyboard.press("ArrowDown");
    const active = await area.getAttribute("aria-activedescendant");
    ok(active && (await page.locator(`#${active}`).textContent()).includes("Bruno"), `opción activa: ${active}`);
    await page.keyboard.press("Enter");
    ok((await area.inputValue()) === "Hi @Bruno Díaz ", `insertado: ${await area.inputValue()}`);
    ok(!(await list.evaluate((el) => el.matches(":popover-open"))), "cierra al elegir");
    ok(await focusIs('[data-component="Mentions"] textarea'), "el foco sigue en el campo");
    await page.keyboard.type("#");
    await page.waitForFunction(() => document.querySelector('[data-component="Mentions"] .z-mentions__popup')?.matches(":popover-open"));
    ok((await list.getAttribute("aria-label")) === "Channels", "otra fuente con #");
    // La lista sale junto al cursor, bajo la línea que se escribe.
    const [caretBox, areaBox] = [await list.boundingBox(), await area.boundingBox()];
    ok(caretBox.y > areaBox.y && caretBox.x > areaBox.x + 40, `anclada al cursor: ${JSON.stringify(caretBox)}`);
    await page.keyboard.press("Escape");
    ok(!(await list.evaluate((el) => el.matches(":popover-open"))), "Escape cierra");
    ok((await area.inputValue()).endsWith("#"), "sin perder lo escrito");
  });

  await test("SearchView: la barra abre la vista modal, el campo recibe el foco y Escape devuelve el foco", async () => {
    const view = card("SearchView").locator(".z-searchview");
    await view.scrollIntoViewIfNeeded();
    const bar = view.locator(".z-searchview__bar");
    await bar.click();
    const dialog = view.locator("dialog");
    ok(await dialog.evaluate((d) => d.matches(":modal")), "modal");
    ok((await bar.getAttribute("aria-expanded")) === "true", "aria-expanded");
    ok(await focusIs('[data-component="SearchView"] .z-searchview__input'), "foco en el campo");
    await page.evaluate(() => {
      window.__sv = [];
      document.querySelector('[data-component="SearchView"] .z-searchview').addEventListener("z:valuechange", (e) => window.__sv.push(e.detail.value));
    });
    await page.keyboard.type("atl");
    ok((await page.evaluate(() => window.__sv.at(-1))) === "atl", "z:valuechange");
    // Acoplada (pantalla ancha): sobre la barra y con su ancho.
    const [b, d] = [await bar.boundingBox(), await dialog.boundingBox()];
    ok(Math.abs(b.x - d.x) < 2 && Math.abs(b.y - d.y) < 2 && d.width >= b.width - 1, `acoplada: ${JSON.stringify([b, d])}`);
    await page.keyboard.press("Escape");
    ok(!(await dialog.evaluate((el) => el.open)), "Escape cierra");
    ok(await focusIs('[data-component="SearchView"] .z-searchview__bar'), "el foco vuelve a la barra");
    ok((await bar.locator(".z-searchview__text").textContent()) === "atl", "la barra muestra lo escrito");
  });

  await test("Popconfirm: el foco empieza en Cancelar; confirmar emite z:confirm, cierra y devuelve el foco", async () => {
    const trigger = card("Popconfirm").locator("[data-z-open]");
    await trigger.scrollIntoViewIfNeeded();
    await trigger.click();
    await settle();
    const layer = page.locator("#popconfirm-demo");
    ok(await layer.evaluate((el) => el.matches(":popover-open")), "abre");
    ok(await focusIs("#popconfirm-demo [data-z-close]"), "foco en Cancelar");
    ok((await page.evaluate(() => document.activeElement.getAttribute("aria-describedby"))) === "popconfirm-demo-description", "Cancelar lleva la descripción");
    await page.evaluate(() => {
      window.__confirmed = 0;
      document.getElementById("popconfirm-demo").addEventListener("z:confirm", () => window.__confirmed++);
    });
    await layer.locator("[data-z-confirm]").click();
    await settle();
    ok((await page.evaluate(() => window.__confirmed)) === 1, "z:confirm");
    ok(!(await layer.evaluate((el) => el.matches(":popover-open"))), "cierra");
    ok(await trigger.evaluate((el) => el === document.activeElement), "el foco vuelve al disparador");
    await trigger.click();
    await settle();
    await page.keyboard.press("Escape");
    await settle();
    ok(!(await layer.evaluate((el) => el.matches(":popover-open"))), "Escape cancela");
    ok((await page.evaluate(() => window.__confirmed)) === 1, "cancelar no confirma");
  });
}
