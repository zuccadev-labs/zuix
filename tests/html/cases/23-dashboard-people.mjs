// Sin React: dashboard y tableros (indicadores, Tracker, DashboardGrid, KanbanBoard) y usuarios y perfiles
// (MemberList, ProfileEditor, AvatarGroup con lista), desde el contrato HTML de zui/html.json y zout/html.json.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const zui = JSON.parse(readFileSync(join(here, "../../../zui/html.json"), "utf8")).components;
const zout = JSON.parse(readFileSync(join(here, "../../../zout/html.json"), "utf8")).components;

export default async function ({ page, test, ok }) {
  let seq = 0;
  const inject = async (raw, width = "min(1100px, 100vw)") => {
    const id = `dp-${++seq}`;
    const html = raw
      .replace(/(?<![\w-])id="([^"]+)"/g, `id="$1-${id}"`)
      .replace(
        /\b(aria-controls|aria-describedby|aria-labelledby)="([^"]+)"/g,
        (_, a, v) =>
          `${a}="${v
            .split(/\s+/)
            .map((x) => `${x}-${id}`)
            .join(" ")}"`,
      )
      .replace(/\bdata-z-open="#([^"]+)"/g, `data-z-open="#$1-${id}"`);
    await page.evaluate(
      async ([markup, wrap, w]) => {
        for (const old of document.querySelectorAll("[data-dp-layer]")) old.remove();
        const box = document.createElement("div");
        box.id = wrap;
        box.setAttribute("data-z-dom", "");
        box.setAttribute("data-dp-layer", "");
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
        window.__dp = [];
        for (const type of ["z:layoutchange", "z:move", "z:open", "z:add", "z:rolechange", "z:remove", "z:invite", "z:submit"])
          box.addEventListener(type, (event) => window.__dp.push([type, JSON.parse(JSON.stringify(event.detail ?? null))]));
        (await import("/zui/dist/zui.dom.js")).hydrate(box);
        (await import("/zout/dist/zout.dom.js")).hydrate(box);
      },
      [html, id, width],
    );
    return page.locator(`#${id}`);
  };
  const ui = (name, i = 0) => zui[name].examples[i].html;
  const events = () => page.evaluate(() => window.__dp.splice(0));
  const until = async (fn, message, tries = 60) => {
    for (let i = 0; i < tries; i++) {
      if (await fn()) return;
      await page.waitForTimeout(50);
    }
    ok(false, message);
  };

  await test("Dashboard · Indicadores sin React: meter con zona, variación hablada, meta con ritmo y embudo como lista", async () => {
    const box = await inject(`${ui("Gauge")}${ui("DeltaBadge")}${ui("ProgressGoal")}${ui("FunnelChart")}${ui("BarList")}`);
    const gauge = box.locator(".z-gauge");
    ok((await gauge.getAttribute("role")) === "meter", "Gauge es meter");
    ok((await gauge.getAttribute("aria-valuetext")) === "72, Warning", `valuetext: ${await gauge.getAttribute("aria-valuetext")}`);
    ok((await box.locator(".z-gauge__zone").count()) === 3, "tres zonas");
    ok((await box.locator(".z-delta .z-sr-only").first().textContent()) === "up 12.4%, better than last month", "frase de la variación");
    ok((await box.locator(".z-delta").first().getAttribute("data-sentiment")) === "good", "sentimiento");
    const goal = box.locator(".z-progress-goal__track");
    ok(/of goal, Behind pace$/.test((await goal.getAttribute("aria-valuetext")) ?? ""), "ritmo en el valor");
    ok((await box.locator(".z-funnel__stage").count()) === 3, "tres etapas");
    ok((await box.locator(".z-bar-list__row").first().textContent())?.includes("Google"), "BarList ordenada");
  });

  await test("Dashboard · Tracker sin React: una parada, flechas entre días y etiqueta del día activo", async () => {
    const box = await inject(ui("Tracker"));
    const bars = box.locator(".z-tracker__bar");
    ok((await box.locator('.z-tracker__bar[tabindex="0"]').count()) === 1, "una sola parada");
    await bars.last().focus();
    await page.keyboard.press("ArrowLeft");
    await until(async () => (await bars.nth(6).getAttribute("tabindex")) === "0", "la parada pasa al día anterior");
    ok(await page.evaluate(() => document.activeElement?.classList.contains("z-tracker__bar")), "el foco sigue en una barra");
    ok((await box.locator(".z-tracker__tip-text").textContent()) === "Nov 7: Maintenance", "etiqueta del día activo");
    await page.keyboard.press("Home");
    await until(async () => (await box.locator(".z-tracker__tip-text").textContent()) === "Nov 1: Operational", "Inicio va al primero");
    await page.keyboard.press("Escape");
    await until(async () => (await box.locator(".z-tracker__tip").count()) === 0, "Escape oculta la etiqueta");
  });

  await test("Dashboard · DashboardGrid sin React: coger con Espacio, mover con flechas, soltar con Intro y orden del DOM al día", async () => {
    const box = await inject(ui("DashboardGrid"), "1200px");
    const handle = box.locator('.z-dashboard-grid__item[data-id="revenue"] .z-dashboard-grid__handle');
    await handle.focus();
    await page.keyboard.press("Space");
    ok((await handle.getAttribute("aria-pressed")) === "true", "aria-pressed al coger");
    ok((await box.locator(".z-dashboard-grid__canvas[data-drop]").count()) === 1, "hueco de destino");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    const got = await events();
    const change = got.find(([t]) => t === "z:layoutchange");
    ok(change, "z:layoutchange al soltar");
    const revenue = change[1].layout.find((i) => i.id === "revenue");
    const sources = change[1].layout.find((i) => i.id === "sources");
    ok(revenue.y === 3 && sources.y === 0, `intercambio con la de debajo: ${JSON.stringify(change[1].layout)}`);
    const order = await box.locator(".z-dashboard-grid__item").evaluateAll((els) => els.map((e) => e.dataset.id));
    ok(order[0] === "sources", `el DOM sigue el orden de lectura: ${order}`);
    await until(
      () => page.evaluate(() => document.activeElement?.closest(".z-dashboard-grid__item")?.dataset.id === "revenue"),
      "el foco vuelve al asa",
    );
    // Escape devuelve la pieza.
    await page.keyboard.press("Space");
    await page.keyboard.press("Shift+ArrowLeft");
    await page.keyboard.press("Escape");
    ok((await events()).length === 0, "cancelar no emite");
    ok((await box.locator('.z-dashboard-grid__item[data-id="revenue"]').getAttribute("data-w")) === "8", "conserva el ancho");
  });

  await test("Dashboard · DashboardGrid sin React: arrastrar el asa con el puntero mueve la pieza", async () => {
    const box = await inject(ui("DashboardGrid"), "1200px");
    const handle = box.locator('.z-dashboard-grid__item[data-id="revenue"] .z-dashboard-grid__handle');
    const a = await handle.boundingBox();
    const from = await box.locator('.z-dashboard-grid__item[data-id="revenue"]').boundingBox();
    const to = await box.locator('.z-dashboard-grid__item[data-id="sources"]').boundingBox();
    const x = a.x + a.width / 2;
    const y = a.y + a.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y + 30, { steps: 3 });
    await page.mouse.move(x, y + (to.y - from.y), { steps: 10 });
    ok((await box.locator(".z-dashboard-grid[data-dragging]").count()) === 1, "estado de arrastre");
    ok((await box.locator(".z-dashboard-grid__canvas[data-drop]").count()) === 1, "hueco de destino");
    await page.mouse.up();
    const change = (await events()).find(([t]) => t === "z:layoutchange");
    ok(change, "z:layoutchange al soltar");
    const revenue = change[1].layout.find((i) => i.id === "revenue");
    const sources = change[1].layout.find((i) => i.id === "sources");
    ok(revenue.y === 3 && sources.y === 0, `intercambio: ${JSON.stringify(change[1].layout)}`);
    ok((await box.locator(".z-dashboard-grid[data-dragging]").count()) === 0, "sin estado de arrastre al soltar");
  });

  await test("Kanban · Sin React: Espacio coge, flecha derecha cambia de columna, Intro suelta y z:move", async () => {
    const box = await inject(ui("KanbanBoard"), "1200px");
    const first = box.locator('.z-kanban__card[data-id="c1"]');
    ok((await box.locator('.z-kanban__card[tabindex="0"]').count()) === 1, "una sola parada");
    await first.focus();
    await page.keyboard.press("ArrowDown");
    await until(() => page.evaluate(() => document.activeElement?.dataset.id === "c2"), "flecha abajo va a la siguiente");
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("Space");
    await until(async () => (await box.locator('.z-kanban__card[data-id="c1"]').getAttribute("data-grabbed")) === "key", "cogida");
    await page.keyboard.press("ArrowRight");
    await until(
      async () => (await box.locator('[data-column="doing"] .z-kanban__card[data-id="c1"]').count()) === 1,
      "pasa a la columna siguiente",
    );
    ok(await page.evaluate(() => document.activeElement?.dataset.id === "c1"), "el foco sigue en la tarjeta");
    await page.keyboard.press("Enter");
    const move = (await events()).find(([t]) => t === "z:move");
    ok(move && move[1].toColumn === "doing" && move[1].fromColumn === "todo", `z:move: ${JSON.stringify(move?.[1] ?? null).slice(0, 120)}`);
    await page.keyboard.press("Space");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Escape");
    await until(async () => (await box.locator('[data-column="doing"] .z-kanban__card[data-id="c1"]').count()) === 1, "Escape la devuelve");
    ok(!(await events()).some(([t]) => t === "z:move"), "cancelar no emite");
  });

  await test("Kanban · Sin React: arrastrar una tarjeta a otra columna con el puntero", async () => {
    const box = await inject(ui("KanbanBoard"), "1200px");
    const card = box.locator('.z-kanban__card[data-id="c2"]');
    const done = box.locator('.z-kanban__column[data-column="done"]');
    const a = await card.boundingBox();
    const b = await done.boundingBox();
    await page.mouse.move(a.x + 20, a.y + 10);
    await page.mouse.down();
    await page.mouse.move(a.x + 40, a.y + 20, { steps: 3 });
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 10 });
    await until(async () => (await box.locator('[data-column="done"] .z-kanban__placeholder').count()) === 1, "hueco en el destino");
    await page.mouse.up();
    const move = (await events()).find(([t]) => t === "z:move");
    ok(move && move[1].toColumn === "done" && move[1].index === 0, `z:move: ${JSON.stringify(move?.[1] ?? null).slice(0, 120)}`);
    ok((await box.locator('[data-column="done"] .z-kanban__card[data-id="c2"]').count()) === 1, "la tarjeta está en Done");
  });

  await test("Usuarios · MemberList sin React: búsqueda que anuncia, cambio de rol y quitar con el foco en la siguiente", async () => {
    const box = await inject(ui("MemberList"));
    await box.locator("[data-search]").fill("mar");
    await until(async () => (await box.locator(".z-member-list__row").count()) === 1, "filtra por nombre");
    await until(async () => (await box.locator(".z-member-list [data-live]").textContent()) === "1 results", "anuncia los resultados");
    await box.locator("[data-search]").fill("");
    await until(async () => (await box.locator(".z-member-list__row").count()) === 3, "vuelven todas");
    await box.locator('select[data-member="m2"]').selectOption("member");
    ok(
      (await events()).some(([t, d]) => t === "z:rolechange" && d.memberId === "m2" && d.role === "member"),
      "z:rolechange",
    );
    const remove = box.locator('[data-remove="m2"]');
    ok((await remove.getAttribute("aria-label")) === "Remove Marco Rossi", "nombre del botón");
    await remove.click();
    ok(
      (await events()).some(([t, d]) => t === "z:remove" && d.memberId === "m2"),
      "z:remove",
    );
    await until(async () => (await box.locator('[data-id="m2"]').count()) === 0, "la fila desaparece");
    ok(await page.evaluate(() => document.activeElement?.closest(".z-member-list") !== null), "el foco queda en la lista");
  });

  await test("Usuarios · ProfileEditor sin React: error tras salir del campo, foco al primero al guardar y z:submit", async () => {
    const box = await inject(ui("ProfileEditor"));
    const name = box.locator('input[name="name"]');
    await name.fill("");
    ok((await name.getAttribute("aria-invalid")) === null, "sin error mientras se escribe");
    await name.blur();
    await until(async () => (await name.getAttribute("aria-invalid")) === "true", "error al salir");
    const described = (await name.getAttribute("aria-describedby")) ?? "";
    ok(described.endsWith("-error"), `el error se une al campo: ${described}`);
    ok(
      (await box.locator(".z-profile-editor__error").first().textContent())?.includes("Enter your name."),
      "mensaje que dice cómo corregir",
    );
    await box.locator('input[name="handle"]').fill("1x");
    await box.locator('button[type="submit"]').click();
    await until(() => page.evaluate(() => document.activeElement?.getAttribute("name") === "name"), "el foco va al primero con error");
    ok((await box.locator(".z-profile-editor__status").textContent()) === "Fix 2 fields to save.", "cuántos errores");
    await name.fill("Ana López");
    await box.locator('input[name="handle"]').fill("ana_lopez");
    await box.locator('textarea[name="bio"]').fill("Hola");
    ok((await box.locator(".z-profile-editor__counter").textContent())?.trim() === "4 of 160", "contador");
    await box.locator('button[type="submit"]').click();
    const submit = (await events()).find(([t]) => t === "z:submit");
    ok(submit && submit[1].values.handle === "ana_lopez", "z:submit con los valores");
    ok((await name.getAttribute("aria-invalid")) === null, "sin errores");
  });

  await test("Usuarios · AvatarGroup sin React: el +N abre la lista de sobrantes y Escape la cierra", async () => {
    const box = await inject(zui.AvatarGroup.examples.at(-1).html);
    const more = box.locator(".z-avatar-group__more");
    ok((await more.getAttribute("aria-label")) === "2 more", "nombre del botón");
    await more.click();
    await until(
      () => page.evaluate(() => document.querySelector(".z-avatar-group__popover")?.matches(":popover-open") ?? false),
      "se abre",
    );
    ok((await page.locator(".z-avatar-group__popover .z-persona").count()) === 2, "dos personas");
    await page.keyboard.press("Escape");
    await until(() => page.evaluate(() => !document.querySelector(".z-avatar-group__popover")?.matches(":popover-open")), "se cierra");
  });

  await test("Layouts · AppBar sin React: data-scrolled al desplazar su contenedor", async () => {
    const markup = `<div class="dp-scroller" style="block-size: 300px; overflow: auto">${zout.AppBar.examples[0].html}<div style="block-size: 1200px"></div></div>`;
    const box = await inject(markup);
    const bar = box.locator(".z-appbar");
    ok((await bar.getAttribute("data-scrolled")) === null, "sin desplazar");
    await box.locator(".dp-scroller").evaluate((el) => {
      el.scrollTop = 200;
    });
    await until(async () => (await bar.getAttribute("data-scrolled")) === "", "con algo desplazado");
  });
}
