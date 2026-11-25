// Agenda sin framework con 5000 eventos: cada navegación por debajo de un umbral holgado, lo que se
// pinta acotado («+N» en la rejilla de horas, ventana virtual en la lista) y lo que eso no puede romper: el teclado
// llega a lo oculto por «+N», la lista con ventana sigue al foco y la densidad del año sale de setAgendaOptions.
// También el arrastre con puntero en la vista de línea temporal.
//
// Umbral: en Chromium, el tiempo de CPU del hilo principal entre el clic y el segundo fotograma (reloj de hilo de la
// traza: no cuenta las esperas de una máquina cargada), 300 ms por paso (AGENDA_BUDGET). En todos los motores, el
// tiempo de pared con un tope de catástrofe (AGENDA_WALL, 3000 ms). De cada paso, la mejor de tres vueltas.
const BUDGET = Number(process.env.AGENDA_BUDGET) || 300;
const WALL = Number(process.env.AGENDA_WALL) || 3000;

export default async function ({ page, test, ok, note, browserName }) {
  const root = "#perf-dom-agenda";
  const mount = (attrs) =>
    page.evaluate(
      async ([attrs]) => {
        document.querySelector("#perf-dom-stage")?.remove();
        const stage = document.createElement("div");
        stage.id = "perf-dom-stage";
        stage.innerHTML = `<div class="z-agenda" id="perf-dom-agenda" data-date="2026-11-19" data-today="2026-11-19" data-now="2026-11-19T09:42:00Z" data-time-zone="Europe/Madrid" data-locale="en-GB" data-week-start="1" data-list-days="30" ${attrs}></div>`;
        document.querySelector("[data-z-dom]").append(stage);
        const dom = await import("/zui/dist/zui.dom.js");
        dom.hydrate(stage);
        const el = stage.firstElementChild;
        // Los mismos datos que la etapa de rendimiento de la app de ejemplo: 5000 eventos de noviembre.
        const cals = ["work", "product", "team", "personal", "health", "travel"];
        let seed = 11;
        const next = () => {
          seed = (seed * 9301 + 49297) % 233280;
          return seed / 233280;
        };
        const t = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
        const events = Array.from({ length: 5000 }, (_, i) => {
          const day = 1 + Math.floor(next() * 30);
          const hour = 7 + Math.floor(next() * 12);
          const minutes = [0, 15, 30, 45][Math.floor(next() * 4)];
          const length = [15, 30, 45, 60, 90, 120][Math.floor(next() * 6)];
          const start = hour * 60 + minutes;
          const date = `2026-11-${String(day).padStart(2, "0")}`;
          return {
            id: `p${i}`,
            title: `Event ${i}`,
            start: `${date}T${t(start)}`,
            end: `${date}T${t(Math.min(start + length, 23 * 60 + 45))}`,
            timeZone: "Europe/Madrid",
            calendarId: cals[i % 6],
            resourceIds: [`r${i % 8}`],
          };
        });
        dom.setAgendaCalendars(
          el,
          cals.map((id, i) => ({ id, name: id, color: String((i % 6) + 1) })),
        );
        dom.setAgendaEvents(el, events);
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      },
      [attrs],
    );
  // Clic → dos fotogramas: lo que tarda la interacción en llegar a la pantalla. Cada paso deja dos marcas
  // (`agenda-step-N-a` y `-b`) para leer en la traza el tiempo de CPU entre ellas.
  let marks = 0;
  const labels = [];
  const step = async (selector, label) => {
    const n = marks++;
    labels.push([n, label]);
    return page.evaluate(
      async ([selector, n]) => {
        performance.mark(`agenda-step-${n}-a`);
        const t = performance.now();
        if (selector) document.querySelector(selector).click();
        else document.querySelector("#perf-dom-agenda .z-agendalist").scrollTop += 2000;
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        if (!selector) await new Promise((r) => requestAnimationFrame(r));
        const ms = performance.now() - t;
        performance.mark(`agenda-step-${n}-b`);
        return ms;
      },
      [selector, n],
    );
  };
  const next = `${root} .z-agenda__nav [data-nav="next"]`;
  const prev = `${root} .z-agenda__nav [data-nav="previous"]`;
  const view = (v) => `${root} .z-agenda__views [data-view="${v}"]`;

  await test(`EventCalendar sin framework: 5000 eventos, cada navegación por debajo de ${BUDGET} ms de CPU`, async () => {
    await mount('data-view="month" data-views="day,week,month,agenda,year"');
    await page.locator(root).scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    const times = {};
    let shown = 0;
    let chips = 0;
    let rows = 0;
    // Chromium: una traza para todo el recorrido; el reloj de hilo (tts) de cada marca da el tiempo de CPU.
    const cdp = browserName === "chromium" ? await page.context().newCDPSession(page) : null;
    const trace = [];
    const collect = (d) => trace.push(...d.value);
    if (cdp) {
      cdp.on("Tracing.dataCollected", collect);
      await cdp.send("Tracing.start", { categories: "blink.user_timing", transferMode: "ReportEvents" });
    }
    // Tres vueltas del recorrido completo y, de cada paso, la mejor: la máquina cargada (otras pruebas, CI) añade
    // esperas que no son trabajo de la agenda; una regresión real sube también la mejor de las tres.
    for (let round = 0; round < 3; round++) {
      const add = async (label, selector) => {
        const ms = await step(selector, label);
        times[label] ??= [];
        times[label].push(ms);
      };
      await add("mes siguiente", next);
      await add("mes anterior", prev);
      await add("a semana", view("week"));
      await add("semana siguiente", next);
      await add("semana anterior", prev);
      shown = await page.locator(`${root} .z-timegrid .z-event`).count();
      chips = await page.locator(`${root} .z-timegrid__overflow`).count();
      await add("a día", view("day"));
      await add("día siguiente", next);
      await add("día anterior", prev);
      await add("a agenda", view("agenda"));
      rows = await page.locator(`${root} .z-agendalist__item`).count();
      await add("desplazar la lista", null);
      await add("a año", view("year"));
      await add("a mes", view("month"));
      // Vuelta al punto de partida: noviembre, en el mes.
      await page.evaluate(async (sel) => {
        (await import("/zui/dist/zui.dom.js")).setAgendaView(document.querySelector(sel), { view: "month", date: "2026-11-19" });
      }, root);
    }
    const cpu = {};
    if (cdp) {
      const done = new Promise((r) => cdp.once("Tracing.tracingComplete", r));
      await cdp.send("Tracing.end");
      await done;
      cdp.off("Tracing.dataCollected", collect);
      const at = new Map(trace.filter((e) => e.name?.startsWith("agenda-step-")).map((e) => [e.name, e.tts]));
      for (const [n, label] of labels) {
        const a = at.get(`agenda-step-${n}-a`);
        const b = at.get(`agenda-step-${n}-b`);
        if (a === undefined || b === undefined) continue;
        cpu[label] ??= [];
        cpu[label].push((b - a) / 1000);
      }
      await cdp.detach();
    }
    const best = (list) => Math.round(Math.min(...list));
    const report = Object.entries(times).map(([k, v]) => [k, best(v), cpu[k] ? best(cpu[k]) : null]);
    note(report.map(([k, wall, c]) => `${k} ${wall}${c === null ? "" : ` (CPU ${c})`}`).join(" · ") + " ms");
    note(`semana: ${shown} eventos pintados y ${chips} «+N»; lista: ${rows} filas pintadas de 5000`);
    ok(shown < 600 && chips > 0, `semana acotada: ${shown} eventos, ${chips} «+N»`);
    ok(rows > 0 && rows < 120, `lista con ventana virtual: ${rows} filas`);
    const slow = report.filter(([, wall, c]) => (c !== null && c > BUDGET) || wall > WALL);
    ok(
      !slow.length,
      `por encima del umbral (CPU ${BUDGET} ms, pared ${WALL} ms): ${slow.map(([k, w, c]) => `${k} ${w}/${c} ms`).join(", ")}`,
    );
  });

  await test("EventCalendar sin framework: «+N» con teclado, lista con ventana que sigue al foco y densidad del año", async () => {
    await mount('data-view="week" data-views="day,week,month,agenda,year"');
    // «+N»: lleva el tabulador al recorrer con flechas y abre el popover del intervalo.
    const chip = `${root} .z-timegrid__col[data-date="2026-11-19"] .z-timegrid__overflow`;
    const label = await page.locator(chip).first().getAttribute("aria-label");
    ok(/^\+\d+ more, Thursday 19 November, /.test(label), `nombre del «+N»: ${label}`);
    await page.locator(chip).first().focus();
    await page.keyboard.press("Enter");
    await page.waitForFunction((sel) => document.querySelector(`${sel} .z-agenda__pop[data-pop="more"]`)?.matches(":popover-open"), root);
    const listed = await page.locator(`${root} .z-agenda__pop[data-pop="more"] .z-event`).count();
    const count = Number(label.match(/^\+(\d+)/)[1]);
    ok(listed >= count, `el popover lista el intervalo: ${listed} ≥ ${count}`);
    await page.keyboard.press("Escape");
    await page.waitForFunction((sel) => !document.querySelector(`${sel} .z-agenda__pop`), root);
    ok(await page.evaluate(() => document.activeElement?.classList.contains("z-timegrid__overflow")), "Escape vuelve al «+N»");
    await page.keyboard.press("ArrowLeft");
    ok(await page.evaluate(() => document.activeElement?.classList.contains("z-event")), "flechas: del «+N» a un evento");
    // Lista: Fin lleva al último evento aunque no esté pintado; la ventana lo sigue.
    await page.click(`${root} .z-agenda__views [data-view="agenda"]`);
    await page.locator(`${root} .z-agendalist .z-event`).first().focus();
    await page.keyboard.press("End");
    await page.waitForFunction(() =>
      document.activeElement?.closest(".z-agendalist__day")?.querySelector("h3")?.textContent.includes("30"),
    );
    const top = await page.locator(`${root} .z-agendalist`).evaluate((el) => el.scrollTop);
    ok(top > 10_000, `la lista se desplaza hasta el foco: ${top}`);
    await page.keyboard.press("Home");
    await page.waitForFunction(() =>
      document.activeElement?.closest(".z-agendalist__day")?.querySelector("h3")?.textContent.includes("19"),
    );
    ok((await page.locator(`${root} .z-agendalist__item`).count()) < 120, "la ventana sigue acotada");
    // Año: densidad propia por setAgendaOptions.
    await page.evaluate(async (sel) => {
      const el = document.querySelector(sel);
      const dom = await import("/zui/dist/zui.dom.js");
      dom.setAgendaOptions(el, { density: (date) => (date === "2026-11-19" ? 3 : 0) });
      dom.setAgendaView(el, { view: "year" });
    }, root);
    await page.waitForSelector(`${root} .z-yeargrid`);
    const levels = await page.evaluate(
      (sel) => ["2026-11-19", "2026-11-18"].map((d) => document.querySelector(`${sel} .z-yeargrid__day[data-date="${d}"]`)?.dataset.load),
      root,
    );
    ok(levels[0] === "3" && levels[1] === "0", `densidad propia: ${JSON.stringify(levels)}`);
  });

  await test("EventCalendar sin framework: arrastre con puntero en la línea temporal (mover y alargar)", async () => {
    // Una capa que dejó abierta otro caso de la página (el panel de un TimePicker…) taparía la pista: se cierra.
    await page.keyboard.press("Escape");
    await page.evaluate(() => {
      for (const el of document.querySelectorAll(":popover-open")) el.hidePopover();
      for (const d of document.querySelectorAll("dialog[open]")) d.close();
    });
    await page.evaluate(async () => {
      document.querySelector("#perf-dom-stage")?.remove();
      const stage = document.createElement("div");
      stage.id = "perf-dom-stage";
      // Por encima de todo lo que otros casos de la página dejaron en pantalla (un panel de TimePicker…): el
      // arrastre necesita que la pista sea lo que hay bajo el puntero.
      stage.style.cssText = "position: fixed; inset: 0; z-index: 2147483647; overflow: auto; background: Canvas";
      stage.innerHTML = `<div class="z-agenda" id="perf-dom-agenda" data-view="timeline" data-views="week,timeline" data-date="2026-11-19" data-today="2026-11-19" data-time-zone="Europe/Madrid" data-locale="en-GB" data-week-start="1" data-day-start="07:00" data-day-end="21:00" data-editable>
        <script type="application/json" data-calendars>[{ "id": "work", "name": "Work", "color": "1" }]</script>
        <script type="application/json" data-resources>[{ "id": "kepler", "title": "Kepler" }, { "id": "hubble", "title": "Hubble" }]</script>
        <script type="application/json" data-events>[{ "id": "a", "title": "Design review", "start": "2026-11-19T10:00", "end": "2026-11-19T11:00", "timeZone": "Europe/Madrid", "calendarId": "work", "resourceIds": ["kepler"] }]</script>
      </div>`;
      document.querySelector("[data-z-dom]").append(stage);
      window.__tlchanges = [];
      stage.addEventListener("z:eventchange", (e) => window.__tlchanges.push(e.detail));
      (await import("/zui/dist/zui.dom.js")).hydrate(stage);
    });
    const booking = `${root} .z-timeline__booking[data-key="a"]`;
    await page.locator(booking).evaluate((el) => el.scrollIntoView({ block: "center", inline: "center" }));
    await page.mouse.move(5, 5);
    const box = await page.locator(booking).boundingBox();
    const hit = await page.evaluate(
      ([sel, x, y]) => {
        const el = document.elementFromPoint(x, y);
        return el?.closest(sel) ? "" : `${el?.tagName}.${el?.className}`;
      },
      [booking, box.x + 10, box.y + box.height / 2],
    );
    ok(!hit, `la reserva no está bajo el puntero: ${hit}`);
    const hour = await page.evaluate((sel) => {
      const track = document.querySelector(`${sel} .z-timeline__track`).getBoundingClientRect();
      return track.width / 14;
    }, root);
    // Mover: dos horas a la derecha.
    const y = box.y + box.height / 2;
    await page.mouse.move(box.x + 10, y);
    await page.mouse.down();
    for (let i = 1; i <= 10; i++) await page.mouse.move(box.x + 10 + (2 * hour * i) / 10, y);
    ok((await page.locator(`${booking}[data-dragging]`).count()) === 1, "el evento se arrastra");
    await page.mouse.up();
    let change = await page.evaluate(() => window.__tlchanges.splice(0)[0]);
    ok(
      change?.start === "2026-11-19T12:00" && change.end === "2026-11-19T13:00" && change.kind === "move",
      `mover: ${JSON.stringify(change)}`,
    );
    // Alargar por el asa del final: media hora más (la agenda no cambia los datos; el evento sigue a las 10:00).
    await page.locator(booking).click();
    const after = await page.locator(booking).boundingBox();
    const handle = await page.locator(`${booking} .z-event__resize`).boundingBox();
    ok(handle && handle.x + handle.width >= after.x + after.width - 2, "asa al final de la reserva");
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
    await page.mouse.down();
    for (let i = 1; i <= 6; i++) await page.mouse.move(handle.x + handle.width / 2 + (hour / 2) * (i / 6), handle.y + handle.height / 2);
    await page.mouse.up();
    change = await page.evaluate(() => window.__tlchanges.splice(0)[0]);
    ok(
      change?.kind === "resize" && change.start === "2026-11-19T10:00" && change.end === "2026-11-19T11:30",
      `alargar: ${JSON.stringify(change)}`,
    );
    await page.evaluate(() => document.querySelector("#perf-dom-stage")?.remove());
  });
}
