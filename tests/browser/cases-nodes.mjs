// Binding de React del lienzo de nodos (pantalla `?screen=flows` de examples/app): estructura accesible, teclado
// (foco itinerante, flechas espaciales, entrar en un nodo, mover, conectar, seguir conexiones, borrar y deshacer),
// puntero (arrastrar con imán, desplazar, zoom con Ctrl + rueda, caja de selección, conectar arrastrando), copiar y
// pegar, controles, minimapa, vista en lista y el grafo grande (solo se pinta lo que se ve; se mide).
export default function ({ t, assert, poll }) {
  const canvas = "#flow-canvas";
  const node = (id) => `${canvas} :is(.z-node, .z-node-group)[data-id="${id}"]`;
  const count = (page) => page.locator(t("f-count")).textContent();
  const active = (page) =>
    page.evaluate(() => document.activeElement?.closest("[data-id]")?.getAttribute("data-id") ?? document.activeElement?.className);
  const nodeX = (page, id) => page.locator(node(id)).evaluate((el) => Number.parseFloat(el.style.getPropertyValue("--z-node-x")));
  const center = async (page, selector) => {
    const box = await page.locator(selector).first().boundingBox();
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  };
  const open = async (o, options = {}) => {
    const page = await o("flows", options);
    await page.locator(canvas).scrollIntoViewIfNeeded();
    await poll(async () => (await page.locator(`${canvas} .z-edge`).count()) === 6, "seis aristas pintadas");
    return page;
  };

  return [
    {
      name: "NodeCanvas (React): grupo con descripción, nodos con nombre y conexiones descritas, controles y minimapa",
      async run({ open: o, axe }) {
        const page = await open(o);
        const root = page.locator(canvas);
        assert((await root.getAttribute("role")) === "group", "el lienzo es un group");
        assert((await root.getAttribute("aria-roledescription")) === "diagram", "roledescription");
        const desc = await page.evaluate((sel) => {
          const el = document.querySelector(sel);
          return document.getElementById(el.getAttribute("aria-describedby"))?.textContent;
        }, canvas);
        assert(/^8 nodes, 6 connections\. Arrow keys/.test(desc ?? ""), `descripción del lienzo: ${desc}`);
        const route = page.locator(node("route"));
        assert((await route.getAttribute("aria-roledescription")) === "node", "cada nodo es un nodo");
        const routeDesc = await route.evaluate((el) => document.getElementById(el.getAttribute("aria-describedby"))?.textContent);
        assert(
          routeDesc === "1 inputs, 2 outputs; connected to Enrich customer and Notify sales; receives from Validate",
          `descripción: ${routeDesc}`,
        );
        assert((await page.locator(`${canvas} .z-node-port[aria-label="Output true"]`).count()) === 1, "puerto con nombre");
        assert((await page.locator(`${canvas} .z-node-minimap__node`).count()) === 8, "minimapa con los ocho nodos");
        assert((await page.locator(`${canvas} .z-node-controls[role=toolbar]`).count()) === 1, "controles como toolbar");
        const violations = await axe(page, { include: canvas });
        assert(violations.length === 0, `axe en el lienzo:\n  ${violations.map((v) => `${v.id}: ${v.nodes[0]?.target}`).join("\n  ")}`);
      },
    },
    {
      name: "NodeCanvas (React): una parada de Tab, flechas espaciales, ] sigue conexiones, Intro entra y Escape sale",
      async run({ open: o }) {
        const page = await open(o);
        const tabStops = await page
          .locator(`${canvas} .z-node-canvas__nodes > [tabindex="0"], ${canvas} .z-node-canvas__groups > [tabindex="0"]`)
          .count();
        assert(tabStops === 1, `una sola parada entre los nodos: ${tabStops}`);
        await page.locator(node("hook")).focus();
        await page.keyboard.press("ArrowRight");
        await poll(async () => (await active(page)) === "validate", "flecha derecha va al vecino de la derecha");
        await page.keyboard.press("]");
        await poll(async () => (await active(page)) === "route", "] sigue la conexión de salida");
        await page.keyboard.press("]");
        await poll(
          async () => (await page.locator(`${canvas} .z-node-canvas__menu[role=menu] [role=menuitem]`).count()) === 2,
          "con dos salidas, un menú para elegir",
        );
        await poll(() => page.evaluate(() => document.activeElement?.getAttribute("role") === "menuitem"), "foco en el menú");
        await page.keyboard.press("ArrowDown");
        await page.keyboard.press("Enter");
        await poll(async () => (await active(page)) === "notify", "la segunda salida lleva a Notify");
        await page.keyboard.press("[");
        await poll(async () => (await active(page)) === "route", "[ vuelve por la entrada");
        await page.keyboard.press("Enter");
        await poll(() => page.evaluate(() => document.activeElement?.classList.contains("z-node-port")), "Intro entra: foco en un puerto");
        await page.keyboard.press("Escape");
        await poll(
          async () => (await active(page)) === "route" && (await page.evaluate(() => document.activeElement?.classList.contains("z-node"))),
          "Escape sale al nodo",
        );
        await page.keyboard.press("Escape");
        await poll(() => page.evaluate((sel) => document.activeElement === document.querySelector(sel), canvas), "otra vez: al lienzo");
        const x0 = await page.locator(canvas).evaluate((el) => el.style.getPropertyValue("--z-vp-x"));
        await page.keyboard.press("ArrowLeft");
        await poll(
          async () => (await page.locator(canvas).evaluate((el) => el.style.getPropertyValue("--z-vp-x"))) !== x0,
          "en el lienzo, las flechas desplazan",
        );
        await page.keyboard.press("Enter");
        await poll(
          async () => typeof (await active(page)) === "string" && (await page.evaluate(() => !!document.activeElement?.dataset.id)),
          "Intro vuelve a un nodo",
        );
      },
    },
    {
      name: "NodeCanvas (React): Alt+flechas mueven con imán y se anuncia; Supr borra y Ctrl+Z deshace",
      async run({ open: o }) {
        const page = await open(o);
        await page.locator(node("validate")).focus();
        const before = await nodeX(page, "validate");
        await page.keyboard.press("Alt+ArrowRight");
        await poll(async () => (await nodeX(page, "validate")) === before + 16, "una celda del imán");
        await poll(
          () =>
            page.evaluate(() =>
              [...document.querySelectorAll("[data-z-announcer] [aria-live]")].some((r) => /Validate moved right/.test(r.textContent)),
            ),
          "anuncio del movimiento",
        );
        await page.keyboard.press("Delete");
        await poll(async () => (await count(page)) === "7 nodes · 4 connections", "borra el nodo y sus aristas");
        await poll(() => page.evaluate(() => !!document.activeElement?.dataset.id), "el foco queda en otro nodo");
        await page.keyboard.press("Control+z");
        await poll(async () => (await count(page)) === "8 nodes · 6 connections", "Ctrl+Z lo devuelve");
        await page.keyboard.press("Control+z");
        await poll(async () => (await nodeX(page, "validate")) === before, "otro Ctrl+Z deshace el movimiento");
        await page.keyboard.press("Control+Shift+z");
        await poll(async () => (await nodeX(page, "validate")) === before + 16, "Ctrl+Mayús+Z rehace");
      },
    },
    {
      name: "NodeCanvas (React): conectar con el teclado (coger un puerto, recorrer compatibles, Intro) y con dos clics",
      async run({ open: o }) {
        const page = await open(o);
        await page.locator(node("hook")).focus();
        await page.keyboard.press("Enter");
        await poll(
          async () => (await page.evaluate(() => document.activeElement?.getAttribute("aria-label"))) === "Output out",
          "foco en la salida",
        );
        await page.keyboard.press("Enter");
        await poll(
          async () => (await page.locator(`${canvas} .z-node-port[data-candidate]`).count()) > 0,
          "puertos compatibles resaltados",
        );
        const first = await page.evaluate(() => document.activeElement?.closest("[data-id]")?.dataset.id);
        assert(first && first !== "hook", `el foco salta a un destino: ${first}`);
        await page.keyboard.press("ArrowRight");
        await page.keyboard.press("Escape");
        await poll(async () => (await page.locator(`${canvas} .z-node-port[data-candidate]`).count()) === 0, "Escape cancela");
        await poll(
          async () => (await page.evaluate(() => document.activeElement?.getAttribute("aria-label"))) === "Output out",
          "vuelve al puerto de origen",
        );
        await page.keyboard.press("Enter");
        await page.keyboard.press("Enter");
        await poll(async () => (await count(page)) === "8 nodes · 7 connections", "Intro conecta");
        // Con dos clics: salida de Validate y entrada de Respond 201.
        await page.click(`${node("validate")} .z-node-port[data-kind="source"]`);
        await page.click(`${node("done")} .z-node-port[data-kind="target"]`, { force: true });
        await poll(async () => (await count(page)) === "8 nodes · 8 connections", "dos clics conectan");
      },
    },
    {
      name: "NodeCanvas (React): arrastrar un nodo con imán, desplazar el fondo, Ctrl+rueda acerca y Mayús+arrastre selecciona",
      async run({ open: o }) {
        const page = await open(o);
        const before = await nodeX(page, "notify");
        const start = await center(page, `${node("notify")} .z-node__title`);
        await page.mouse.move(start.x, start.y);
        await page.mouse.down();
        await page.mouse.move(start.x + 30, start.y + 5, { steps: 4 });
        await page.mouse.move(start.x + 61, start.y + 7, { steps: 4 });
        await page.mouse.up();
        await poll(async () => {
          const x = await nodeX(page, "notify");
          return x !== before && x % 16 === 0;
        }, "se mueve y cae en la cuadrícula");
        const vp = () => page.locator(canvas).evaluate((el) => [el.style.getPropertyValue("--z-vp-x"), el.dataset.zoom]);
        const [x0, z0] = await vp();
        const box = await page.locator(canvas).boundingBox();
        await page.mouse.move(box.x + 60, box.y + 40);
        await page.mouse.down();
        await page.mouse.move(box.x + 160, box.y + 80, { steps: 5 });
        await page.mouse.up();
        await poll(async () => (await vp())[0] !== x0, "arrastrar el fondo desplaza");
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.keyboard.down("Control");
        await page.mouse.wheel(0, -200);
        await page.keyboard.up("Control");
        await poll(async () => Number((await vp())[1]) > Number(z0), "Ctrl + rueda acerca");
        // Caja de selección sobre todo el lienzo.
        await page.locator(canvas).evaluate((el) => el.dispatchEvent(new KeyboardEvent("keydown", { key: "f", bubbles: true })));
        await page.keyboard.down("Shift");
        await page.mouse.move(box.x + 8, box.y + 8);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width - 8, box.y + box.height - 8, { steps: 6 });
        await page.mouse.up();
        await page.keyboard.up("Shift");
        await poll(async () => (await page.locator(`${canvas} [data-selected].z-node`).count()) >= 5, "la caja selecciona varios nodos");
      },
    },
    {
      name: "NodeCanvas (React): conectar arrastrando desde un puerto y reconectar arrastrando el extremo",
      async run({ open: o }) {
        const page = await open(o);
        const from = await center(page, `${node("validate")} .z-node-port[data-kind="source"]`);
        const to = await center(page, `${node("done")} .z-node-port[data-kind="target"]`);
        await page.mouse.move(from.x, from.y);
        await page.mouse.down();
        await page.mouse.move(from.x + 40, from.y + 10, { steps: 3 });
        await poll(async () => (await page.locator(`${canvas} .z-node-canvas__draft:not([hidden])`).count()) === 1, "arista en curso");
        await page.mouse.move(to.x, to.y, { steps: 6 });
        await page.mouse.up();
        await poll(async () => (await count(page)) === "8 nodes · 7 connections", "soltar sobre un puerto conecta");
        // Seleccionar la arista nueva por su trazo y reconectar su destino a Notify.
        const edge = page.locator(`${canvas} .z-edge[data-id="edge-7"] .z-edge__hit`);
        await edge.dispatchEvent("pointerdown", { button: 0, pointerId: 1, isPrimary: true });
        await poll(
          async () => (await page.locator(`${canvas} .z-edge__end[data-edge="edge-7"]`).count()) === 2,
          "extremos visibles al seleccionar",
        );
        const end = await center(page, `${canvas} .z-edge__end[data-edge="edge-7"][data-end="target"]`);
        const notify = await center(page, `${node("notify")} .z-node-port[data-kind="target"]`);
        await page.mouse.move(end.x, end.y);
        await page.mouse.down();
        await page.mouse.move(notify.x, notify.y, { steps: 6 });
        await page.mouse.up();
        await poll(() => page.evaluate(() => document.querySelector('#flow-canvas .z-edge[data-id="edge-7"]') !== null), "la arista sigue");
        await page.locator('[role="radiogroup"][aria-label="View"] [role="radio"]', { hasText: "List" }).click();
        await poll(async () => (await page.locator(".z-node-list tbody tr").count()) > 8, "vista en lista");
        const row = await page.locator('.z-node-list tr[data-edge="edge-7"]').textContent();
        assert(/Validate · out.*Notify sales · in/.test(row ?? ""), `reconectada a Notify: ${row}`);
      },
    },
    {
      name: "NodeCanvas (React): copiar, pegar, duplicar, agrupar y controles (zoom, bloquear, deshacer)",
      async run({ open: o }) {
        const page = await open(o);
        await page.locator(node("hook")).focus();
        await page.keyboard.press("Space");
        await page.keyboard.press("Control+c");
        await page.keyboard.press("Control+v");
        await poll(async () => (await count(page)) === "9 nodes · 6 connections", "pegar añade el nodo");
        await page.keyboard.press("Control+d");
        await poll(async () => (await count(page)) === "10 nodes · 6 connections", "duplicar");
        await page.keyboard.press("Control+g");
        await poll(async () => (await page.locator(`${canvas} .z-node-group`).count()) === 2, "Ctrl+G agrupa");
        await page.keyboard.press("Control+Shift+g");
        await poll(async () => (await page.locator(`${canvas} .z-node-group`).count()) === 1, "Ctrl+Mayús+G desagrupa");
        const bar = `${canvas} .z-node-controls`;
        const zoom = () => page.locator(canvas).evaluate((el) => Number(el.dataset.zoom));
        const z0 = await zoom();
        await page.click(`${bar} [data-node-action="zoom-in"]`);
        await poll(async () => (await zoom()) > z0, "acercar");
        await page.click(`${bar} [data-node-action="lock"]`);
        await poll(
          async () => (await page.locator(`${bar} [data-node-action="lock"]`).getAttribute("aria-pressed")) === "true",
          "bloquear",
        );
        await page.locator(node("hook")).focus();
        await page.keyboard.press("Delete");
        await page.waitForTimeout(200);
        assert((await count(page)) === "10 nodes · 6 connections", "bloqueado no borra");
        await page.click(`${bar} [data-node-action="lock"]`);
        await page.click(`${bar} [data-node-action="undo"]`);
        await poll(async () => (await count(page)) === "11 nodes · 6 connections", "deshacer desde los controles: vuelve el grupo");
      },
    },
    {
      name: "NodeCanvas (React): con movimiento reducido las aristas animadas quedan quietas y llevan flecha",
      async run({ open: o }) {
        const page = await open(o, { reducedMotion: "reduce" });
        const edge = page.locator(`${canvas} .z-edge[data-animated] .z-edge__path`);
        const anim = await edge.evaluate((el) => getComputedStyle(el).animationName);
        assert(anim === "none", `sin animación: ${anim}`);
        assert(((await edge.getAttribute("marker-end")) ?? "").includes("arrow"), "flecha que indica el sentido");
      },
    },
    {
      name: "NodeCanvas (React): 500 nodos y 800 aristas, solo se pinta lo visible y el desplazamiento es fluido (medida)",
      async run({ open: o, note }) {
        const page = await o("flows");
        await page.locator(t("f-big")).scrollIntoViewIfNeeded();
        const t0 = Date.now();
        await page.click(t("f-big"));
        const big = "#flow-big";
        await poll(async () => (await page.locator(`${big} .z-edge`).count()) > 0, "el grafo grande se pinta", 15000);
        const mount = Date.now() - t0;
        const painted = await page.locator(big).evaluate((el) => ({
          nodes: el.querySelectorAll(".z-node").length,
          edges: el.querySelectorAll(".z-edge").length,
          total: el.querySelectorAll(".z-node-minimap__node").length,
        }));
        assert(painted.total === 500, `el minimapa ve los 500: ${painted.total}`);
        assert(painted.nodes < 200, `solo los visibles: ${painted.nodes} nodos pintados`);
        await page.locator(big).scrollIntoViewIfNeeded();
        const box = await page.locator(big).boundingBox();
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        // 90 pasos de rueda (desplazar). Se mide el intervalo entre fotogramas y, donde el navegador lo da (Chromium,
        // long-animation-frame), el trabajo del hilo principal en los fotogramas largos.
        const frames = await page.evaluate(async () => {
          const times = [];
          const loaf = [];
          const observer =
            typeof PerformanceObserver !== "undefined" && PerformanceObserver.supportedEntryTypes?.includes("long-animation-frame")
              ? new PerformanceObserver((list) => {
                  for (const e of list.getEntries()) loaf.push(e.scripts.reduce((a, s) => a + s.duration, 0));
                })
              : null;
          observer?.observe({ type: "long-animation-frame" });
          let last = performance.now();
          const el = document.querySelector("#flow-big");
          const r = el.getBoundingClientRect();
          for (let i = 0; i < 90; i++) {
            el.dispatchEvent(
              new WheelEvent("wheel", {
                deltaX: 14,
                deltaY: 9,
                clientX: r.left + 200,
                clientY: r.top + 200,
                bubbles: true,
                cancelable: true,
              }),
            );
            await new Promise((done) => requestAnimationFrame(done));
            const now = performance.now();
            times.push(now - last);
            last = now;
          }
          await new Promise((done) => setTimeout(done, 100));
          observer?.disconnect();
          const q = (list, p) =>
            list.length ? [...list].sort((a, b) => a - b)[Math.min(list.length - 1, Math.floor(list.length * p))] : 0;
          return { p50: q(times, 0.5), p95: q(times, 0.95), script95: q(loaf, 0.95), long: loaf.length, loaf: !!observer };
        });
        note(
          `grafo grande: montaje ${mount} ms (React de desarrollo), ${painted.nodes} nodos y ${painted.edges} aristas pintados de 500/800; al desplazar, fotogramas p50 ${frames.p50.toFixed(1)} ms y p95 ${frames.p95.toFixed(1)} ms` +
            (frames.loaf ? `; ${frames.long} fotogramas largos con script p95 ${frames.script95.toFixed(1)} ms` : ""),
        );
        // El intervalo depende de la máquina (el raster por software de un entorno sin GPU domina); el umbral es sobre el
        // trabajo de script, que es lo que pone el lienzo.
        if (frames.loaf) assert(frames.script95 < 33, `script por fotograma p95 ${frames.script95.toFixed(1)} ms`);
      },
    },
  ];
}
