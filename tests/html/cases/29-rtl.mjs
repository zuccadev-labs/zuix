// Sin React, de derecha a izquierda: las familias de la 0.4 (chat, IA, dashboard, personas, nodos, terminal y tiempo)
// dentro de un contenedor `dir="rtl"`. Teclado: la flecha que apunta hacia un lado lleva al elemento que está en ese
// lado (lo que se mide es la posición en pantalla, no el índice). Disposición: el orden de los grupos sigue al de
// lectura, los iconos con sentido se reflejan y el código sigue de izquierda a derecha.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const contract = JSON.parse(readFileSync(join(here, "../../../zui/html.json"), "utf8")).components;

export default async function ({ page, test, ok }) {
  let seq = 0;
  const html = (name, i = 0) => contract[name].html?.[i]?.code ?? contract[name].examples[i].html;
  const inject = async (raw, width = "min(1000px, 100vw)") => {
    const id = `rtl-${++seq}`;
    await page.evaluate(
      async ([markup, wrap, w]) => {
        for (const old of document.querySelectorAll("[data-rtl-layer]")) old.remove();
        const box = document.createElement("div");
        box.id = wrap;
        box.dir = "rtl";
        box.setAttribute("data-z-dom", "");
        box.setAttribute("data-rtl-layer", "");
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
        const zui = await import("/zui/dist/zui.dom.js");
        zui.hydrate(box);
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      },
      [raw, id, width],
    );
    return page.locator(`#${id}`);
  };
  const until = async (fn, message, tries = 60) => {
    for (let i = 0; i < tries; i++) {
      if (await fn()) return;
      await page.waitForTimeout(50);
    }
    ok(false, message);
  };
  /** Centro horizontal del elemento con el foco. */
  const focusX = () =>
    page.evaluate(() => {
      const r = document.activeElement?.getBoundingClientRect();
      return r ? r.left + r.width / 2 : Number.NaN;
    });
  const centerX = async (loc) => {
    const b = await loc.boundingBox();
    return b.x + b.width / 2;
  };
  /** Pulsa una flecha horizontal y dice hacia dónde se movió el foco en pantalla. */
  const step = async (key) => {
    const before = await focusX();
    await page.keyboard.press(key);
    await page.waitForTimeout(60);
    const after = await focusX();
    return after < before - 1 ? "left" : after > before + 1 ? "right" : "none";
  };
  const mirrored = (loc) => loc.evaluate((el) => getComputedStyle(el).scale === "-1 1");

  await test("RTL · Chat sin React: filtros con ← al siguiente, avatar al inicio y hora al final del texto sin taparlo", async () => {
    const box = await inject(html("ConversationList", 0));
    const filter = (f) => box.locator(`.z-conversation-list__filter[data-filter="${f}"]`);
    ok((await centerX(filter("all"))) > (await centerX(filter("unread"))), "«All» a la derecha de «Unread»");
    await filter("all").focus();
    ok((await step("ArrowLeft")) === "left", "← lleva al filtro de la izquierda");
    ok((await filter("unread").getAttribute("aria-checked")) === "true", "y lo marca");
    ok((await step("ArrowRight")) === "right", "→ vuelve");
    const row = box.locator(".z-conversation").first();
    const avatar = await row.locator(".z-avatar").first().boundingBox();
    const name = await row.locator(".z-conversation__title").first().boundingBox();
    ok(avatar.x > name.x, "el avatar va al inicio de la fila (derecha)");

    const bubbles = await inject(html("MessageBubble", 0), "520px");
    const overlaps = await bubbles.evaluate((root) =>
      [...root.querySelectorAll(".z-message__bubble")].map((b) => {
        const meta = b.querySelector(".z-message__meta").getBoundingClientRect();
        const text = b.querySelector(".z-message__text");
        const range = document.createRange();
        range.selectNodeContents(text);
        const lines = [...range.getClientRects()];
        const hit = lines.some((l) => l.left < meta.right && l.right > meta.left && l.top < meta.bottom && l.bottom > meta.top);
        const last = lines.at(-1);
        // La hora va en el lado donde acaba el texto: con texto en inglés, a la derecha de la última línea.
        return { hit, endSide: getComputedStyle(text).direction === "ltr" ? meta.left >= last.right - 1 : meta.right <= last.left + 1 };
      }),
    );
    ok(overlaps.length === 2 && overlaps.every((o) => !o.hit), `la hora no tapa el texto: ${JSON.stringify(overlaps)}`);
    ok(
      overlaps.every((o) => o.endSide),
      `la hora sigue al final del texto: ${JSON.stringify(overlaps)}`,
    );

    const list = await inject(html("MessageList", 0));
    const reply = list.locator('svg[data-icon="arrow-turn-up-left"]').first();
    const forward = list.locator('svg[data-icon="arrow-turn-up-right"]').first();
    ok((await reply.count()) === 1 && (await mirrored(reply)), "responder se refleja");
    ok((await forward.count()) === 1 && (await mirrored(forward)), "reenviar se refleja");
  });

  await test("RTL · EmojiPicker sin React: desde la búsqueda, ← elige el emoji de la izquierda y las pestañas van de derecha a izquierda", async () => {
    const box = await inject(html("EmojiPicker", 0), "420px");
    const tabs = box.locator(".z-emoji-picker__tab");
    ok((await centerX(tabs.nth(0))) > (await centerX(tabs.nth(1))), "la primera pestaña a la derecha");
    // El foco se queda en la búsqueda (combobox); la opción activa es la de aria-selected.
    const active = () => centerX(box.locator('.z-emoji-picker__option[aria-selected="true"]'));
    await box.locator(".z-emoji-picker__field").focus();
    const a = await active();
    await page.keyboard.press("ArrowLeft");
    await until(async () => (await active()) < a - 1, "← elige la opción de la izquierda");
    const b = await active();
    await page.keyboard.press("ArrowRight");
    await until(async () => (await active()) > b + 1, "→ vuelve a la de la derecha");
  });

  await test("RTL · IA sin React: entrada y salida de una herramienta en LTR, y en la rama «siguiente» queda a la izquierda", async () => {
    const box = await inject(html("ToolCall", 0), "600px");
    const code = box.locator(".z-tool-call__code").first();
    ok((await code.evaluate((el) => getComputedStyle(el).direction)) === "ltr", "el código es LTR");
    const align = await code.evaluate((el) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      return range.getClientRects()[0].left - el.getBoundingClientRect().left;
    });
    ok(align < 24, `la primera línea empieza a la izquierda (${align})`);

    const picker = await inject(html("BranchPicker", 0), "400px");
    const [prev, next] = [picker.locator(".z-branch-picker__button").first(), picker.locator(".z-branch-picker__button").last()];
    ok((await centerX(prev)) > (await centerX(next)), "anterior a la derecha, siguiente a la izquierda");
    ok(await mirrored(next.locator("svg").first()), "el chevrón de «siguiente» apunta a la izquierda");
  });

  await test("RTL · Dashboard sin React: el kanban mueve con ← a la columna de la izquierda, el Tracker y la rejilla siguen a la pantalla", async () => {
    const box = await inject(html("KanbanBoard", 0));
    const columns = box.locator(".z-kanban__column");
    ok((await centerX(columns.nth(0))) > (await centerX(columns.nth(1))), "la primera columna, a la derecha");
    const card = box.locator(".z-kanban__card").first();
    const id = await card.getAttribute("data-id");
    const from = await centerX(card);
    await card.focus();
    await page.keyboard.press("Space");
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("Enter");
    const moved = box.locator(`.z-kanban__card[data-id="${id}"]`);
    await until(async () => (await centerX(moved)) < from - 40, "← lleva la tarjeta a la columna de la izquierda");

    const tracker = await inject(html("Tracker", 0));
    const bars = tracker.locator(".z-tracker__bar");
    ok((await centerX(bars.first())) > (await centerX(bars.last())), "el primer día a la derecha");
    await bars.first().focus();
    ok((await step("ArrowLeft")) === "left", "← al día de la izquierda");

    const grid = await inject(html("DashboardGrid", 0));
    const handles = grid.locator(".z-dashboard-grid__handle");
    ok((await centerX(handles.first())) > (await centerX(handles.nth(1))), "la primera pieza a la derecha");
    await handles.first().focus();
    ok((await step("ArrowLeft")) === "left", "← al asa de la izquierda");
  });

  await test("RTL · Personas sin React: «Salir» se refleja en el menú de cuenta y el avatar abre la fila de cada miembro", async () => {
    const box = await inject(html("AccountMenu", 0));
    const out = box.locator('svg[data-icon="arrow-right-start-on-rectangle"]');
    ok((await out.count()) === 1 && (await mirrored(out)), "el icono de salir apunta hacia el final de la línea (izquierda)");
    const members = await inject(html("MemberList", 0));
    const member = members.locator(".z-member-list__row").first();
    const avatar = await member.locator(".z-avatar").first().boundingBox();
    const name = await member.locator(".z-persona__name").first().boundingBox();
    ok(avatar.x > name.x, "avatar a la derecha del nombre");
  });

  await test("RTL · Nodos sin React: deshacer y rehacer se reflejan, un nodo suelto conserva sus puertos y el lienzo es espacial", async () => {
    const box = await inject(html("NodeControls", 0));
    for (const name of ["arrow-uturn-up-left", "arrow-uturn-up-right"])
      ok(await mirrored(box.locator(`svg[data-icon="${name}"]`)), `${name} reflejado`);

    const lone = await inject(html("Node", 0), "480px");
    const node = await lone.locator(".z-node").first().boundingBox();
    const sides = await lone.locator(".z-node-port").evaluateAll((ports) =>
      ports.map((p) => {
        const r = p.getBoundingClientRect();
        return [p.dataset.side ?? "left", r.left + r.width / 2];
      }),
    );
    ok(
      sides.length > 0 &&
        sides.every(([side, x]) => (side === "right" ? Math.abs(x - (node.x + node.width)) < 3 : Math.abs(x - node.x) < 3)),
      `cada puerto en su borde físico: ${JSON.stringify(sides)} sobre ${node.x}…${node.x + node.width}`,
    );

    const canvas = await inject(html("NodeCanvas", 0));
    const nodes = canvas.locator(".z-node-canvas .z-node");
    await until(async () => (await nodes.count()) >= 2, "el lienzo pinta sus nodos");
    const xs = await nodes.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().left));
    const leftmost = xs.indexOf(Math.min(...xs));
    await nodes.nth(leftmost).focus();
    ok((await step("ArrowRight")) === "right", "→ al nodo que está a la derecha: el lienzo no se refleja");
  });

  await test("RTL · Terminal sin React: el código y el registro siguen en LTR, las pestañas de archivos van con la lectura", async () => {
    const box = await inject(html("LogConsole", 0));
    const cell = box.locator(".z-log-console__body .z-log-console__cell").first();
    ok((await box.locator(".z-log-console__grid").evaluate((el) => getComputedStyle(el).direction)) === "ltr", "la rejilla es LTR");
    await cell.click();
    await cell.focus();
    ok((await step("ArrowRight")) === "right", "→ a la celda de la derecha");

    const viewer = await inject(html("CodeViewer", 1));
    const tabs = viewer.locator(".z-code-viewer__tab");
    ok((await centerX(tabs.first())) > (await centerX(tabs.last())), "el primer archivo a la derecha");
    await tabs.first().focus();
    ok((await step("ArrowLeft")) === "left", "← al archivo de la izquierda");
    ok((await viewer.locator(".z-code-viewer__pre").evaluate((el) => getComputedStyle(el).direction)) === "ltr", "el código es LTR");

    const term = await inject(html("Terminal", 0));
    ok(
      (await term
        .locator(".z-terminal__output, .z-terminal__screen, pre")
        .first()
        .evaluate((el) => getComputedStyle(el).direction)) === "ltr",
      "la salida del terminal es LTR",
    );
  });

  await test("RTL · Tiempo sin React: la duración se escribe como una hora (LTR) y sus flechas siguen a la pantalla; unidades y ciudades van de derecha a izquierda", async () => {
    const box = await inject(html("DurationField", 0), "420px");
    const segments = box.locator(".z-duration-field__segment");
    ok((await centerX(segments.first())) < (await centerX(segments.last())), "horas a la izquierda de minutos, como en 1:30");
    await segments.first().focus();
    ok((await step("ArrowRight")) === "right", "→ a los minutos, a la derecha");
    ok((await step("ArrowLeft")) === "left", "← vuelve a las horas");

    const countdown = await inject(html("Countdown", 0));
    const units = countdown.locator(".z-countdown__unit");
    ok((await centerX(units.first())) > (await centerX(units.last())), "los días a la derecha");

    const clocks = await inject(html("WorldClock", 0));
    const cities = clocks.locator(".z-world-clock__city");
    ok((await centerX(cities.first())) > (await centerX(cities.nth(1))), "la primera ciudad a la derecha");
  });

  await test("RTL · las siete familias sin React: nada desborda el contenedor en horizontal", async () => {
    const manifest = JSON.parse(readFileSync(join(here, "../../../zui/manifest.json"), "utf8")).components;
    const names = Object.values(manifest)
      .filter((c) => ["chat", "ai", "dashboard", "people", "nodes", "terminal", "time"].includes(c.group))
      .map((c) => c.name)
      .filter((n) => contract[n]);
    const bad = [];
    for (const name of names) {
      const box = await inject(html(name, 0), "900px");
      const over = await box.evaluate((el) => {
        const limit = el.getBoundingClientRect();
        return (
          [...el.querySelectorAll("*")]
            // Un nodo suelto es una pieza con posición absoluta pensada para el lienzo: sus puertos salen de la caja a propósito.
            .filter((e) => e.checkVisibility?.() && !e.closest("[popover], dialog, .z-node-canvas__world, .z-node, [aria-hidden='true']"))
            .some((e) => {
              const r = e.getBoundingClientRect();
              return r.width > 0 && (r.left < limit.left - 1 || r.right > limit.right + 1);
            })
        );
      });
      if (over) bad.push(name);
    }
    ok(!bad.length, `se salen del contenedor en RTL: ${bad.join(", ")}`);
  });
}
