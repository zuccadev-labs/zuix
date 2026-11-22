// Sin React: chat y mensajería (lista de conversaciones, mensajes, caja de texto, emojis, nota de voz, reacciones,
// llamada, fijados) e IA (respuesta en streaming, herramientas, aprobación, Markdown, artefacto), desde el contrato HTML
// de zui/html.json y zout/html.json y marcado escrito a mano.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const contract = JSON.parse(readFileSync(join(here, "../../../zui/html.json"), "utf8")).components;
const layouts = JSON.parse(readFileSync(join(here, "../../../zout/html.json"), "utf8")).components;

export default async function ({ page, test, ok }) {
  let seq = 0;
  const inject = async (raw, width = "min(900px, 100vw)") => {
    const id = `ca-${++seq}`;
    await page.evaluate(
      async ([markup, wrap, w]) => {
        for (const old of document.querySelectorAll("[data-ca-layer]")) old.remove();
        const box = document.createElement("div");
        box.id = wrap;
        box.setAttribute("data-z-dom", "");
        box.setAttribute("data-ca-layer", "");
        box.innerHTML = markup;
        Object.assign(box.style, {
          position: "fixed",
          insetBlockStart: "0",
          insetInlineStart: "0",
          zIndex: "2147483000",
          inlineSize: w,
          maxBlockSize: "100vh",
          overflow: "auto",
          padding: "24px",
          background: "Canvas",
        });
        document.querySelector(".page__main").append(box);
        window.__ca = [];
        for (const type of [
          "z:select",
          "z:send",
          "z:reply",
          "z:react",
          "z:loadolder",
          "z:toggle",
          "z:accept",
          "z:decline",
          "z:jump",
          "z:approve",
          "z:reject",
          "z:viewchange",
          "z:copy",
          "z:valuechange",
          "z:stop",
        ])
          box.addEventListener(type, (event) => window.__ca.push([type, JSON.parse(JSON.stringify(event.detail ?? null))]));
        const [zui, zout] = await Promise.all([import("/zui/dist/zui.dom.js"), import("/zout/dist/zout.dom.js")]);
        zui.hydrate(box);
        zout.init();
        zout.hydrate(box);
      },
      [raw, id, width],
    );
    return page.locator(`#${id}`);
  };
  const html = (name, i = 0) => contract[name].html?.[i]?.code ?? contract[name].examples[i].html;
  const events = () => page.evaluate(() => window.__ca.splice(0));
  const until = async (fn, message, tries = 60) => {
    for (let i = 0; i < tries; i++) {
      if (await fn()) return;
      await page.waitForTimeout(50);
    }
    ok(false, message);
  };
  const announced = () =>
    page.evaluate(() => [...document.querySelectorAll("[data-z-announcer] [aria-live]")].map((r) => r.textContent).join(" | "));

  await test("Chat · ConversationList sin React: una parada, flechas, selección con aria-current, filtros como radios y búsqueda sin acentos", async () => {
    const box = await inject(html("ConversationList", 0));
    const rows = box.locator(".z-conversation");
    ok((await rows.count()) === 4, "cuatro conversaciones");
    ok((await box.locator('.z-conversation[tabindex="0"]').count()) === 1, "una sola parada");
    ok((await rows.first().getAttribute("aria-current")) === "true", "la fijada va arriba y es la abierta");
    await rows.first().focus();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    const evs = await events();
    ok(
      evs.some(([t, d]) => t === "z:select" && d.id === "team"),
      `z:select del grupo: ${JSON.stringify(evs)}`,
    );
    ok((await box.locator('.z-conversation[aria-current="true"]').getAttribute("data-id")) === "team", "pasa a abierta");
    await box.locator('.z-conversation-list__filter[data-filter="unread"]').click();
    ok((await box.locator('.z-conversation-list__filter[data-filter="unread"]').getAttribute("aria-checked")) === "true", "filtro marcado");
    ok((await rows.count()) === 3, "solo las no leídas");
    await page.keyboard.press("ArrowRight");
    ok(
      (await box.locator('.z-conversation-list__filter[data-filter="groups"]').getAttribute("aria-checked")) === "true",
      "→ pasa al siguiente filtro",
    );
    await box.locator('.z-conversation-list__filter[data-filter="all"]').click();
    await box.locator(".z-conversation-list__search input").fill("lopez");
    await until(async () => (await rows.count()) === 1, "búsqueda sin acentos");
    ok((await rows.first().textContent()).includes("Ana López"), "encuentra a Ana López");
    await until(async () => (await announced()).includes("1 chats"), "anuncia el número de resultados");
  });

  await test("Chat · MessageList sin React: lista con nombre, burbujas descritas, días como h3, no leídos, una parada y acciones del mensaje", async () => {
    const box = await inject(html("MessageList", 0));
    const list = box.locator(".z-message-list");
    ok((await list.getAttribute("role")) === "region", "región");
    ok((await box.locator(".z-message-list__items").evaluate((el) => el.tagName)) === "OL", "lista ordenada");
    ok((await box.locator(".z-date-separator h3").count()) === 2, "dos días como encabezados");
    ok(((await box.locator(".z-unread-marker").textContent()) ?? "").includes("unread"), "marca de no leídos");
    ok((await box.locator('.z-message[tabindex="0"]').count()) === 1, "una sola parada");
    const described = await box
      .locator(".z-message")
      .nth(1)
      .evaluate((el) => {
        const ids = (el.getAttribute("aria-describedby") ?? "").split(" ");
        return [
          document.getElementById(el.getAttribute("aria-labelledby"))?.textContent,
          ids.map((id) => document.getElementById(id)?.textContent).join(" "),
        ];
      });
    ok(described[0] === "You" && /Read/.test(described[1]), `nombre y descripción: ${described}`);
    const active = box.locator('.z-message[tabindex="0"]');
    await active.focus();
    await page.keyboard.press("ArrowUp");
    await until(() => page.evaluate(() => document.activeElement?.dataset.id === "m5"), "↑ al mensaje anterior");
    await page.keyboard.press("Home");
    await until(() => page.evaluate(() => document.activeElement?.dataset.id === "m1"), "Inicio al primero");
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await until(
      () => page.evaluate(() => document.activeElement?.classList.contains("z-message__action")),
      "Intro lleva a la barra de acciones",
    );
    await page.keyboard.press("ArrowRight");
    await until(() => page.evaluate(() => document.activeElement?.dataset.action === "reply"), "→ dentro de la barra");
    await page.keyboard.press("Enter");
    ok(
      (await events()).some(([t, d]) => t === "z:reply" && d.id === "m6"),
      "z:reply del mensaje",
    );
    await page.keyboard.press("Escape");
    await until(() => page.evaluate(() => document.activeElement?.dataset.id === "m6"), "Escape vuelve al mensaje");
    await page.keyboard.press("r");
    ok(
      (await events()).some(([t]) => t === "z:reply"),
      "R responde",
    );
  });

  await test("Chat · MessageList sin React: reacción al instante, llegada de otros anunciada y agrupada, ir al final con contador e historial sin saltos", async () => {
    const box = await inject(html("MessageList", 0));
    const reaction = box.locator('.z-message[data-id="m5"] ~ * .z-reaction, .z-message[data-id="m5"] .z-reaction').first();
    const before = await reaction.getAttribute("aria-pressed");
    await reaction.click();
    ok(
      (await box.locator('.z-message[data-id="m5"] .z-reaction').first().getAttribute("aria-pressed")) !== before,
      "la reacción responde sin esperar a la aplicación",
    );
    ok(
      (await events()).some(([t, d]) => t === "z:react" && d.id === "m5"),
      "z:react",
    );
    // Mensajes nuevos de otros: un solo anuncio corto y agrupado.
    await page.evaluate(async () => {
      const el = document.querySelector("[data-ca-layer] .z-message-list");
      const { setWidgetProps } = await import("/zui/dist/zui.dom.js");
      const json = JSON.parse(el.querySelector('script[type="application/json"]').textContent);
      const extra = [1, 2, 3].map((i) => ({
        id: `n${i}`,
        authorId: "ana",
        author: { name: "Ana López" },
        createdAt: `2026-11-21T09:2${i}:00Z`,
        text: `New ${i}`,
      }));
      setWidgetProps(el, { messages: [...json.messages, ...extra], typing: [] });
    });
    await until(async () => (await announced()).includes("3 new messages from Ana López"), "anuncio agrupado", 80);
    ok((await box.locator(".z-message").count()) === 9, "llegan los tres");
    // Lejos del final, lo nuevo se cuenta en el botón.
    await box.locator(".z-message-list").evaluate((el) => {
      el.style.height = "260px";
    });
    const vp = box.locator(".z-message-list__viewport");
    await vp.evaluate((el) => {
      el.scrollTop = 0;
      el.dispatchEvent(new Event("scroll"));
    });
    await page.evaluate(async () => {
      const el = document.querySelector("[data-ca-layer] .z-message-list");
      const { setWidgetProps } = await import("/zui/dist/zui.dom.js");
      const json = JSON.parse(el.querySelector('script[type="application/json"]').textContent);
      const extra = [1, 2, 3, 4].map((i) => ({
        id: `n${i}`,
        authorId: "ana",
        author: { name: "Ana López" },
        createdAt: `2026-11-21T09:2${i}:00Z`,
        text: `New ${i}`,
      }));
      setWidgetProps(el, { messages: [...json.messages, ...extra] });
    });
    const jump = box.locator(".z-scroll-to-bottom");
    await until(async () => (await jump.getAttribute("data-visible")) !== null, "aparece ir al final");
    await until(async () => /1 new messages/.test((await jump.getAttribute("aria-label")) ?? ""), "cuenta el nuevo");
    await jump.click();
    await until(() => vp.evaluate((el) => el.scrollHeight - el.clientHeight - el.scrollTop < 100), "baja al final");
  });

  await test("Chat · historial hacia arriba: z:loadolder al llegar arriba y el mensaje de delante no se mueve al anteponer", async () => {
    const many = Array.from({ length: 30 }, (_, i) => ({
      id: `h${i}`,
      authorId: i % 2 ? "ana" : "me",
      createdAt: new Date(Date.UTC(2026, 10, 21, 8, i)).toISOString(),
      text: `Message ${i} `.repeat(3),
    }));
    const box = await inject(
      `<div class="z-message-list" style="height: 360px" data-current-user="me" data-time-zone="UTC" data-has-older><script type="application/json" data-props>${JSON.stringify({ messages: many })}</script></div>`,
    );
    const vp = box.locator(".z-message-list__viewport");
    await vp.evaluate((el) => {
      el.scrollTop = 200;
      el.dispatchEvent(new Event("scroll"));
    });
    const anchor = await vp.evaluate((el) => {
      const first = [...el.querySelectorAll(".z-message")].find(
        (m) => m.getBoundingClientRect().bottom > el.getBoundingClientRect().top + 4,
      );
      return { id: first.dataset.id, top: first.getBoundingClientRect().top };
    });
    await vp.evaluate((el) => {
      el.scrollTop = 0;
      el.dispatchEvent(new Event("scroll"));
    });
    ok(
      (await events()).some(([t]) => t === "z:loadolder"),
      "pide historial arriba del todo",
    );
    await vp.evaluate((el) => {
      el.scrollTop = 200;
      el.dispatchEvent(new Event("scroll"));
    });
    await page.evaluate(async (list) => {
      const el = document.querySelector("[data-ca-layer] .z-message-list");
      const { setWidgetProps } = await import("/zui/dist/zui.dom.js");
      const older = Array.from({ length: 10 }, (_, i) => ({
        id: `o${i}`,
        authorId: "ana",
        createdAt: new Date(Date.UTC(2026, 10, 21, 7, i)).toISOString(),
        text: `Older ${i}`,
      }));
      setWidgetProps(el, { messages: [...older, ...list] });
    }, many);
    const after = await page.evaluate(
      (id) => document.querySelector(`[data-ca-layer] .z-message[data-id="${id}"]`).getBoundingClientRect().top,
      anchor.id,
    );
    ok(Math.abs(after - anchor.top) < 6, `el mensaje de delante se queda: ${anchor.top} → ${after}`);
  });

  await test("Chat · Composer sin React: Intro envía, Mayús+Intro salta, el IME no envía, menciones como combobox y adjuntos con quitar", async () => {
    const box = await inject(
      `<div class="z-composer"><script type="application/json" data-props>${JSON.stringify({
        mentions: {
          items: [
            { id: "ana", label: "Ana López" },
            { id: "luis", label: "Luis Gil" },
          ],
        },
      })}</script></div>`,
    );
    const field = box.locator(".z-composer__input");
    ok((await box.locator(`label[for="${await field.getAttribute("id")}"]`).count()) === 1, "campo etiquetado");
    ok((await box.locator(".z-composer__send").getAttribute("aria-disabled")) === "true", "enviar existe y está vacío");
    await field.click();
    await page.keyboard.type("Line one");
    await page.keyboard.press("Shift+Enter");
    await page.keyboard.type("two");
    ok((await field.inputValue()) === "Line one\ntwo", "Mayús+Intro salta de línea");
    // Intro que confirma un candidato del IME (isComposing) no envía.
    await field.evaluate((el) =>
      el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", isComposing: true, bubbles: true, cancelable: true })),
    );
    await field.evaluate((el) =>
      el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", keyCode: 229, bubbles: true, cancelable: true })),
    );
    ok(!(await events()).some(([t]) => t === "z:send"), "el IME no envía");
    await page.keyboard.press("Enter");
    const sent = (await events()).find(([t]) => t === "z:send");
    ok(sent?.[1].text === "Line one\ntwo", `envía el texto: ${JSON.stringify(sent)}`);
    ok((await field.inputValue()) === "", "se vacía");
    await page.keyboard.type("Hi @lu");
    ok((await field.getAttribute("aria-expanded")) === "true", "se abre la lista de menciones");
    const listbox = box.locator(".z-composer__mentions");
    ok((await listbox.getAttribute("role")) === "listbox", "listbox");
    ok(
      (await field.getAttribute("aria-activedescendant")) === (await listbox.locator('[aria-selected="true"]').getAttribute("id")),
      "activedescendant",
    );
    await page.keyboard.press("Enter");
    ok((await field.inputValue()) === "Hi @Luis Gil ", "Intro inserta la mención");
    await page.keyboard.press("Enter");
    const withMention = (await events()).find(([t]) => t === "z:send");
    ok(withMention?.[1].text === "Hi <@luis>", `menciones como tokens: ${JSON.stringify(withMention)}`);
    await box.locator(".z-composer__files").setInputFiles([{ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello") }]);
    const remove = box.locator(".z-composer__remove");
    ok((await remove.getAttribute("aria-label")) === "Remove notes.txt", "quitar con nombre");
    await remove.click();
    ok((await box.locator(".z-composer__attachment").count()) === 0, "se quita");
  });

  await test("Chat · EmojiPicker: combobox sobre la rejilla, flechas, búsqueda y elección", async () => {
    const box = await inject(html("EmojiPicker", 0), "420px");
    const field = box.locator(".z-emoji-picker__field");
    await field.focus();
    const first = await field.getAttribute("aria-activedescendant");
    await page.keyboard.press("ArrowDown");
    const next = await field.getAttribute("aria-activedescendant");
    ok(first !== next, "↓ mueve la opción activa");
    ok((await box.locator(`#${next}`).getAttribute("aria-selected")) === "true", "la activa está marcada");
    await field.fill("pizza");
    await until(async () => (await box.locator(".z-emoji-picker__option").count()) === 1, "búsqueda");
    await page.keyboard.press("Enter");
    const picked = (await events()).find(([t]) => t === "z:select");
    ok(picked?.[1].emoji === String.fromCodePoint(0x1f355), "elige con Intro");
  });

  await test("Chat · VoiceNote, Reactions, CallCard y PinnedBar sin React", async () => {
    const box = await inject(`${html("VoiceNote", 0)}${html("Reactions", 0)}${html("CallCard", 0)}${html("PinnedBar", 0)}`);
    const wave = box.locator(".z-voice-note__wave");
    ok((await wave.getAttribute("role")) === "slider", "la onda es un deslizador");
    await wave.focus();
    await page.keyboard.press("ArrowRight");
    ok((await wave.getAttribute("aria-valuenow")) === "5", "→ avanza cinco segundos");
    const rate = box.locator(".z-voice-note__rate");
    await rate.click();
    ok((await rate.textContent()) === "1.5×", "velocidad");
    const reaction = box.locator(".z-reactions .z-reaction[data-emoji]").first();
    ok(/thumbs up, 3, you reacted/.test((await reaction.getAttribute("aria-label")) ?? ""), "nombre de la reacción");
    await reaction.click();
    ok((await box.locator(".z-reactions .z-reaction[data-emoji]").first().getAttribute("aria-pressed")) === "false", "se quita la propia");
    ok(
      (await events()).some(([t, d]) => t === "z:toggle" && d.active === false),
      "z:toggle",
    );
    ok((await box.locator(".z-call").getAttribute("role")) === "region", "llamada como región");
    await until(async () => (await announced()).includes("Incoming call from Ana López"), "aviso asertivo de llamada");
    ok(!(await page.evaluate(() => document.activeElement?.closest(".z-call"))), "no roba el foco");
    await box.locator(".z-call__accept").click();
    ok(
      (await events()).some(([t, d]) => t === "z:accept" && d.video === true),
      "z:accept con vídeo",
    );
    const pinned = box.locator(".z-pinned-bar__main");
    ok(/Pinned message 3 of 3/.test((await pinned.textContent()) ?? ""), "el último fijado");
    await pinned.click();
    ok(
      (await events()).some(([t, d]) => t === "z:jump" && d.id === "p3"),
      "salta al fijado",
    );
    ok(/2 of 3/.test((await pinned.textContent()) ?? ""), "pasa al anterior");
  });

  await test("IA · AssistantMessage sin React: Markdown como nodos, enlaces seguros, código con CodeViewer, streaming con aria-busy y un solo anuncio al terminar", async () => {
    const box = await inject(html("AssistantMessage", 1));
    const msg = box.locator(".z-assistant-message");
    ok((await msg.getAttribute("aria-busy")) === "true", "aria-busy mientras llega");
    ok((await box.locator(".z-caret").count()) === 1, "cursor");
    const chunks = [
      "Drafting the **release** notes",
      " and <img src=x onerror=window.__xss=1> [x](javascript:alert(1))",
      "\n\n```js\nconst a = 1;\n```",
    ];
    for (let i = 1; i <= chunks.length; i++) {
      await page.evaluate(async (text) => {
        const el = document.querySelector("[data-ca-layer] .z-assistant-message");
        const { setWidgetProps } = await import("/zui/dist/zui.dom.js");
        setWidgetProps(el, { parts: [{ type: "text", text }], state: "streaming" });
      }, chunks.slice(0, i).join(""));
    }
    ok(!(await announced()).includes("Response complete"), "no anuncia por trozo");
    ok((await box.locator("img").count()) === 0 && !(await page.evaluate(() => window.__xss)), "el marcado del modelo es texto");
    ok((await box.locator('a[href^="javascript"]').count()) === 0, "sin destinos peligrosos");
    ok((await box.locator(".z-code-viewer").count()) === 1, "código con el CodeViewer");
    await page.evaluate(async (text) => {
      const el = document.querySelector("[data-ca-layer] .z-assistant-message");
      const { setWidgetProps } = await import("/zui/dist/zui.dom.js");
      setWidgetProps(el, { parts: [{ type: "text", text }], state: "done" });
    }, chunks.join(""));
    ok((await msg.getAttribute("aria-busy")) === null, "sin aria-busy al terminar");
    await until(async () => (await announced()).includes("Response complete"), "un anuncio al terminar");
    const bar = box.locator(".z-assistant-message__actions");
    ok((await bar.getAttribute("role")) === "toolbar", "acciones en una barra");
    await bar.locator("button").first().focus();
    await page.keyboard.press("ArrowRight");
    ok((await page.evaluate(() => document.activeElement?.dataset.action)) === "regenerate", "→ dentro de la barra");
  });

  await test("IA · herramientas, aprobación de riesgo alto con confirmación y razonamiento nativo", async () => {
    const box = await inject(`${html("ApprovalCard", 0)}${html("ToolCall", 0)}${html("AssistantMessage", 0)}`);
    await until(async () => (await announced()).includes("Approval needed: Deploy to production"), "se anuncia la petición");
    const approve = box.locator(".z-approval__approve");
    await approve.click();
    ok((await approve.textContent()) === "Confirm approval", "riesgo alto: pide confirmar");
    ok(!(await events()).some(([t]) => t === "z:approve"), "aún no aprueba");
    await box.locator(".z-approval__approve").click();
    ok(
      (await events()).some(([t, d]) => t === "z:approve" && d.id === "deploy"),
      "z:approve al confirmar",
    );
    const tool = box.locator(".z-tool-call").first();
    ok(/Weather, Done/.test((await tool.getAttribute("aria-label")) ?? ""), "estado en texto");
    ok((await tool.locator("details").getAttribute("open")) !== null, "abierta");
    const reasoning = box.locator(".z-assistant-message details.z-reasoning");
    ok((await reasoning.getAttribute("open")) === null, "el razonamiento terminado empieza plegado");
    await reasoning.locator("summary").click();
    ok((await reasoning.getAttribute("open")) !== null, "se abre con su summary");
    const sources = box.locator(".z-sources a").first();
    ok(/Source 1: Release process/.test((await sources.textContent()) ?? ""), "fuente con nombre");
  });

  await test("IA · PromptInput sin React: enviar ↔ parar en el mismo sitio, modelo, herramientas y uso", async () => {
    const box = await inject(html("PromptInput", 0));
    const field = box.locator(".z-composer__input");
    await field.fill("Plan the release");
    await field.press("Enter");
    ok(
      (await events()).some(([t, d]) => t === "z:send" && d.text === "Plan the release"),
      "envía",
    );
    await page.evaluate(async () => {
      const { setWidgetProps } = await import("/zui/dist/zui.dom.js");
      setWidgetProps(document.querySelector("[data-ca-layer] .z-prompt-input"), { status: "streaming" });
    });
    const stop = box.locator(".z-composer__stop");
    ok((await stop.getAttribute("aria-label")) === "Stop generating", "parar");
    await stop.click();
    ok(
      (await events()).some(([t]) => t === "z:stop"),
      "z:stop",
    );
    await until(async () => (await announced()).includes("Stopped"), "se anuncia");
    ok((await box.locator(".z-composer__model select").getAttribute("aria-label")) === "Model", "modelo con nombre");
    ok(/tokens/.test((await box.locator("meter").getAttribute("aria-label")) ?? ""), "uso con nombre");
  });

  await test("Layouts · ChatLayout sin React: pila en estrecho con volver, F6 entre paneles y vista de detalles", async () => {
    const markup = layouts.ChatLayout.examples[0].html;
    const box = await inject(markup, "420px");
    const layout = box.locator(".z-chat-layout");
    const visible = (sel) => box.locator(sel).evaluate((el) => el.getClientRects().length > 0);
    ok((await visible(".z-chat-layout__main")) && !(await visible(".z-chat-layout__list")), "en estrecho solo la conversación");
    await box.locator(".z-chat-header__back").click();
    ok((await layout.getAttribute("data-view")) === "list", "volver a la lista");
    ok((await visible(".z-chat-layout__list")) && !(await visible(".z-chat-layout__main")), "la lista sustituye a la conversación");
    ok(
      (await events()).some(([t, d]) => t === "z:viewchange" && d.view === "list"),
      "z:viewchange",
    );
    const wide = await inject(markup, "1300px");
    const panes = await wide.locator(".z-chat-layout > *").evaluateAll((els) => els.filter((e) => e.getClientRects().length).length);
    ok(panes === 3, `tres paneles en ancho: ${panes}`);
    await wide.locator(".z-conversation").first().focus();
    await page.keyboard.press("F6");
    ok(await page.evaluate(() => Boolean(document.activeElement?.closest(".z-chat-layout__main"))), "F6 a la conversación");
    await page.keyboard.press("F6");
    ok(await page.evaluate(() => Boolean(document.activeElement?.closest(".z-chat-layout__details"))), "F6 a los detalles");
  });
}
