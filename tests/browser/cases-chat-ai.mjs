// Binding de React (pantallas `?screen=chat` y `?screen=assistant` de examples/app): mensajería con estados de
// entrega, respuesta y reacciones; asistente con streaming, parar, aprobación y ramas. Exporta una función que recibe
// los ayudantes de cases.mjs.
export default function ({ t, assert, poll }) {
  const announced = (page) =>
    page.evaluate(() => [...document.querySelectorAll("[data-z-announcer] [aria-live]")].map((r) => r.textContent).join(" | "));

  return [
    {
      name: "Chat (React): enviar recorre los estados de entrega, la otra persona escribe y responde, y la llegada se anuncia",
      async run({ open }) {
        const page = await open("chat");
        const field = page.locator(`${t("c-composer")} .z-composer__input`);
        await field.click();
        await page.keyboard.type("Testing the composer");
        await page.keyboard.press("Enter");
        const last = page.locator(`${t("c-messages")} .z-message[data-mine]`).last();
        await poll(async () => ((await last.textContent()) ?? "").includes("Testing the composer"), "el mensaje aparece");
        await poll(async () => (await last.getAttribute("data-status")) === "read", "llega a leído", 6000);
        assert(((await last.locator(".z-delivery .z-sr-only").textContent()) ?? "") === "Read", "estado en texto");
        await poll(async () => (await page.locator(`${t("c-messages")} .z-typing`).count()) === 1, "Ana escribe", 6000);
        await poll(async () => (await page.locator(`${t("c-messages")} .z-message:not([data-mine])`).count()) >= 5, "Ana responde", 8000);
        await poll(async () => /Ana López: /.test(await announced(page)), "se anuncia la respuesta", 4000);
        assert((await field.inputValue()) === "", "la caja de texto se vacía");
      },
    },
    {
      name: "Chat (React): responder desde la barra de acciones, editar el propio y reaccionar al instante",
      async run({ open }) {
        const page = await open("chat");
        const msgs = page.locator(`${t("c-messages")} .z-message`);
        const target = page.locator(`${t("c-messages")} .z-message[data-id="a8"]`);
        await target.focus();
        await page.keyboard.press("Enter");
        await page.keyboard.press("ArrowRight");
        await page.keyboard.press("Enter");
        await poll(async () => (await page.locator(`${t("c-composer")} .z-composer__context`).count()) === 1, "barra de respondiendo a");
        assert(
          /Replying to Ana López/.test((await page.locator(`${t("c-composer")} .z-composer__context`).textContent()) ?? ""),
          "dice a quién",
        );
        await page.locator(`${t("c-composer")} .z-composer__input`).fill("Yes, 10 works");
        await page.keyboard.press("Enter");
        await poll(
          async () => (await page.locator(`${t("c-messages")} .z-message[data-mine] .z-quoted`).count()) >= 2,
          "la respuesta lleva la cita",
        );
        // Reaccionar responde al instante y la aplicación lo confirma.
        const own = page.locator(`${t("c-messages")} .z-message[data-id="a8"] .z-reaction`).first();
        await own.click();
        await poll(
          async () => (await page.locator(`${t("c-messages")} .z-message[data-id="a8"] .z-reaction`).count()) === 0,
          "se quita la reacción propia",
        );
        // Editar el último propio con la barra.
        const mine = page.locator(`${t("c-messages")} .z-message[data-id="a9"]`);
        await mine.hover();
        await page.locator(`${t("c-messages")} .z-message[data-id="a9"] ~ .z-message__actions [data-action="edit"]`).click();
        const field = page.locator(`${t("c-composer")} .z-composer__input`);
        await poll(async () => (await field.inputValue()).startsWith("Perfect, see you there"), "el texto del mensaje en la caja");
        await field.fill("Perfect, see you at 10");
        await page.keyboard.press("Enter");
        await poll(async () => ((await mine.textContent()) ?? "").includes("Perfect, see you at 10"), "se edita");
        assert((await msgs.count()) > 5, "la lista sigue entera");
      },
    },
    {
      name: "Chat (React): historial al subir sin saltos, cambio de conversación y pila con volver en móvil",
      async run({ open }) {
        const page = await open("chat");
        const vp = page.locator(`${t("c-messages")} .z-message-list__viewport`);
        // Llegar arriba pide el historial (el botón es la alternativa para quien no desplaza).
        await vp.evaluate((el) => {
          el.scrollTop = 0;
        });
        await poll(
          async () => (await page.locator(`${t("c-messages")} .z-message[data-id^="old-"]`).count()) === 12,
          "llega el historial",
          4000,
        );
        assert((await vp.evaluate((el) => el.scrollTop)) > 0, "no salta arriba del todo");
        await page.locator(`${t("c-list")} .z-conversation[data-id="team"]`).click();
        await poll(async () => (await page.locator(`${t("c-messages")} .z-message-system`).count()) === 1, "abre el grupo");
        assert(
          (await page
            .locator(`${t("c-messages")} .z-mention`)
            .first()
            .textContent()) === "@Luis Gil",
          "mención con nombre",
        );
        assert((await page.locator(`${t("c-messages")} .z-message__author`).count()) > 0, "autores en el grupo");
        const mobile = await open("chat", { width: 390, height: 844 });
        const layout = mobile.locator(`${t("c-chat")} .z-chat-layout`);
        assert((await layout.getAttribute("data-view")) === "conversation", "en móvil, la conversación");
        await mobile.locator(".z-chat-header__back").click();
        await poll(async () => (await layout.getAttribute("data-view")) === "list", "volver a la lista");
        assert(await mobile.locator(`${t("c-list")}`).isVisible(), "la lista se ve");
        await mobile.locator(`${t("c-list")} .z-conversation[data-id="ana"]`).click();
        await poll(async () => (await layout.getAttribute("data-view")) === "conversation", "vuelve a la conversación");
      },
    },
    {
      name: "Chat (React): llamada entrante anunciada sin robar el foco; aceptar pasa a en curso con duración",
      async run({ open }) {
        const page = await open("chat");
        await page.locator(t("c-call")).click();
        const card = page.locator(`${t("c-callcard")} .z-call`);
        await poll(async () => (await card.count()) === 1, "aparece la tarjeta");
        await poll(async () => /Incoming call from Ana López/.test(await announced(page)), "aviso asertivo");
        assert(!(await page.evaluate(() => document.activeElement?.closest(".z-call"))), "no roba el foco");
        await card.locator(".z-call__accept").click();
        await poll(async () => (await page.locator(`${t("c-callcard")} [role=timer]`).count()) === 1, "en curso");
        await page.locator(`${t("c-callcard")} .z-call__mute`).click();
        assert((await page.locator(`${t("c-callcard")} .z-call__mute`).getAttribute("aria-pressed")) === "true", "silenciado");
        await page.locator(`${t("c-callcard")} .z-call__hangup`).click();
        await poll(async () => (await page.locator(t("c-callcard")).count()) === 0, "colgar");
      },
    },
    {
      name: "Asistente (React): respuesta en streaming con aria-busy, razonamiento que se pliega solo, herramienta y un solo anuncio al terminar",
      async run({ open }) {
        const page = await open("assistant");
        await page
          .locator(`${t("a-suggestions")} .z-suggestion`)
          .first()
          .click();
        const answer = page.locator(`${t("a-answer")} .z-assistant-message`).last();
        await poll(async () => (await answer.getAttribute("aria-busy")) === "true", "aria-busy mientras responde");
        await poll(async () => (await page.locator(`${t("a-prompt")} .z-composer__stop`).count()) === 1, "enviar pasa a parar");
        await poll(async () => (await answer.locator(".z-tool-call").count()) === 1, "herramienta", 6000);
        await poll(async () => (await answer.getAttribute("data-state")) === "done", "termina", 15000);
        assert((await answer.getAttribute("aria-busy")) === null, "sin aria-busy");
        assert((await answer.locator("details.z-reasoning").getAttribute("open")) === null, "el razonamiento se pliega");
        assert((await answer.locator(".z-code-viewer").count()) === 1, "código con CodeViewer");
        assert((await answer.locator("table").count()) === 1, "tabla");
        assert((await answer.locator(".z-citation").count()) >= 2, "citas enlazadas");
        await poll(async () => /Response complete/.test(await announced(page)), "un anuncio al terminar");
        await answer.locator(".z-artifact-card").click();
        await poll(async () => (await page.locator(`${t("a-artifact")} .z-artifact`).count()) === 1, "abre el artefacto");
      },
    },
    {
      name: "Asistente (React): parar a mitad, regenerar abre una rama «2 / 2» y la aprobación de riesgo alto pide confirmar",
      async run({ open }) {
        const page = await open("assistant");
        await page
          .locator(`${t("a-suggestions")} .z-suggestion`)
          .first()
          .click();
        const stop = page.locator(`${t("a-prompt")} .z-composer__stop`);
        await poll(
          async () => (await page.locator(`${t("a-answer")} .z-assistant-message[data-state="streaming"]`).count()) === 1,
          "escribe",
          8000,
        );
        await stop.click();
        const answer = page.locator(`${t("a-answer")} .z-assistant-message`).last();
        await poll(async () => (await answer.getAttribute("data-state")) === "stopped", "se para");
        await poll(async () => /Stopped|Response stopped/.test(await announced(page)), "se anuncia");
        await answer.locator('[data-action="regenerate"]').click();
        await poll(
          async () => (await page.locator(`${t("a-answer")} .z-assistant-message[data-state="done"]`).count()) === 1,
          "nueva rama terminada",
          15000,
        );
        const picker = page.locator(`${t("a-answer")} .z-branch-picker`).last();
        assert((await picker.getAttribute("aria-label")) === "Version 2 of 2", "rama 2 de 2");
        await picker.locator('[data-step="-1"]').click();
        await poll(
          async () => (await page.locator(`${t("a-answer")} .z-assistant-message[data-state="stopped"]`).count()) === 1,
          "vuelve a la primera",
        );
        await page.locator(`${t("a-prompt")} .z-composer__input`).fill("Deploy it");
        await page.keyboard.press("Enter");
        const approve = page.locator(`${t("a-answer")} .z-approval__approve`).last();
        await poll(async () => (await approve.count()) === 1, "pide aprobación", 6000);
        await poll(async () => /needs your approval|Approval needed/.test(await announced(page)), "se anuncia la espera");
        await approve.click();
        assert((await approve.textContent()) === "Confirm approval", "riesgo alto: confirmar");
        await approve.click();
        await poll(async () => (await page.locator(`${t("a-answer")} .z-approval__decision`).count()) === 1, "aprobada");
        await poll(
          async () =>
            (await page
              .locator(`${t("a-answer")} .z-assistant-message`)
              .last()
              .getAttribute("data-state")) === "done",
          "termina",
          15000,
        );
      },
    },
  ];
}
