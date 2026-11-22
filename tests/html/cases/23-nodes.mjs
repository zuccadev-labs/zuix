// Sin React: lienzo de nodos desde el contrato HTML de zui/html.json (nodos en el marcado y aristas en JSON, o el grafo
// entero en JSON con su vista en lista), teclado, conexión con teclado, copiar y pegar y el grafo grande medido.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const contract = JSON.parse(readFileSync(join(here, "../../../zui/html.json"), "utf8")).components;
const axeSource = readFileSync(join(here, "../../../node_modules/axe-core/axe.min.js"), "utf8");

export default async function ({ page, test, ok, note }) {
  let seq = 0;
  const inject = async (raw, height = 460) => {
    const id = `nd-${++seq}`;
    const html = raw.replace(/(?<![\w-])id="([^"]+)"/g, `id="$1-${id}"`).replace(/\bdata-for="#([^"]+)"/g, `data-for="#$1-${id}"`);
    await page.evaluate(
      async ([markup, wrap, h]) => {
        for (const old of document.querySelectorAll("[data-nd-layer]")) old.remove();
        const box = document.createElement("div");
        box.id = wrap;
        box.setAttribute("data-z-dom", "");
        box.setAttribute("data-nd-layer", "");
        box.innerHTML = markup;
        Object.assign(box.style, {
          position: "fixed",
          insetBlockStart: "0",
          insetInlineStart: "0",
          zIndex: "2147483000",
          inlineSize: "min(960px, 100vw)",
          maxBlockSize: "100vh",
          overflow: "auto",
          padding: "16px",
          background: "Canvas",
        });
        document.querySelector(".page__main").append(box);
        for (const canvas of box.querySelectorAll(".z-node-canvas")) canvas.style.blockSize = `${h}px`;
        window.__nd = [];
        for (const type of ["z:graphchange", "z:connect", "z:selectionchange"])
          box.addEventListener(type, (event) => window.__nd.push([type, event.detail?.change?.type ?? null]));
        (await import("/zui/dist/zui.dom.js")).hydrate(box);
      },
      [html, id, height],
    );
    return page.locator(`#${id}`);
  };
  const html = (name, i = 0) => contract[name].examples[i].html;
  const until = async (fn, message, tries = 80) => {
    for (let i = 0; i < tries; i++) {
      if (await fn()) return;
      await page.waitForTimeout(50);
    }
    ok(false, message);
  };
  const activeId = () => page.evaluate(() => document.activeElement?.closest("[data-id]")?.getAttribute("data-id") ?? null);
  const events = () => page.evaluate(() => window.__nd.splice(0));

  await test("Nodos sin React · el marcado se monta: capas, aristas, minimapa, controles y descripciones", async () => {
    const box = await inject(html("NodeCanvas", 0));
    const canvas = box.locator(".z-node-canvas");
    ok((await canvas.getAttribute("aria-roledescription")) === "diagram", "roledescription del lienzo");
    ok((await box.locator(".z-node-canvas__nodes > .z-node").count()) === 3, "los tres nodos van a su capa");
    await until(async () => (await box.locator(".z-edge").count()) === 2, "dos aristas pintadas");
    ok((await box.locator(".z-edge[data-animated]").count()) === 1, "la arista animada");
    ok((await box.locator(".z-edge__label").textContent()) === "yes", "etiqueta de la arista");
    ok((await box.locator(".z-node-minimap__node").count()) === 3, "minimapa");
    ok((await box.locator('.z-node-controls[role="toolbar"] [data-node-action]').count()) >= 6, "controles creados");
    const desc = await box
      .locator('.z-node[data-id="filter"]')
      .evaluate((el) => document.getElementById(el.getAttribute("aria-describedby"))?.textContent);
    ok(desc === "succeeded; 1 inputs, 2 outputs; connected to Save order; receives from Webhook", `descripción: ${desc}`);
    const x = await box.locator('.z-node[data-id="filter"]').evaluate((el) => el.style.getPropertyValue("--z-node-x"));
    ok(x === "300px", `posición del marcado: ${x}`);
    ok((await box.locator('.z-node[tabindex="0"]').count()) === 1, "una sola parada de tabulación");
  });

  await test("Nodos sin React · flechas, Alt+flechas, Supr y Ctrl+Z con avisos z:graphchange", async () => {
    const box = await inject(html("NodeCanvas", 0));
    await box.locator('.z-node[data-id="hook"]').focus();
    await page.keyboard.press("ArrowRight");
    await until(async () => (await activeId()) === "filter", "flecha derecha");
    await page.keyboard.press("ArrowRight");
    await until(async () => (await activeId()) === "save", "otra vez");
    await events();
    await page.keyboard.press("Alt+ArrowDown");
    await until(
      async () => (await box.locator('.z-node[data-id="save"]').evaluate((el) => el.style.getPropertyValue("--z-node-y"))) === "80px",
      "baja una celda (64 → 80)",
    );
    ok(
      (await events()).some(([type, change]) => type === "z:graphchange" && change === "move"),
      "z:graphchange move",
    );
    await page.keyboard.press("Delete");
    await until(async () => (await box.locator(".z-node-canvas__nodes > .z-node").count()) === 2, "borra el nodo");
    await until(async () => (await box.locator(".z-edge").count()) === 1, "y su arista");
    await page.keyboard.press("Control+z");
    await until(async () => (await box.locator(".z-node-canvas__nodes > .z-node").count()) === 3, "Ctrl+Z lo devuelve");
    await until(async () => (await box.locator(".z-edge").count()) === 2, "con su arista");
  });

  await test("Nodos sin React · conectar con el teclado y pegar un clon con su cuerpo", async () => {
    const box = await inject(html("NodeCanvas", 0));
    await box.locator('.z-node[data-id="filter"]').focus();
    await page.keyboard.press("Enter");
    await until(
      () => page.evaluate(() => document.activeElement?.getAttribute("aria-label") === "Input in"),
      "Intro: foco en el primer puerto",
    );
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    ok(
      (await page.evaluate(() => document.activeElement?.getAttribute("aria-label"))) === "Output false",
      "Tab recorre los puertos del nodo",
    );
    await page.keyboard.press("Enter");
    await until(
      async () => (await box.locator(".z-node-port[data-candidate]").count()) === 1,
      "un destino compatible (Save order, la entrada de Webhook no existe)",
    );
    await page.keyboard.press("Enter");
    await until(async () => (await box.locator(".z-edge").count()) === 3, "Intro conecta");
    ok(
      (await events()).some(([type]) => type === "z:connect"),
      "z:connect",
    );
    await page.keyboard.press("Escape");
    await until(
      async () => (await activeId()) === "filter" && (await page.evaluate(() => document.activeElement?.classList.contains("z-node"))),
      "Escape sale al nodo",
    );
    await page.keyboard.press("Control+c");
    await page.keyboard.press("Control+v");
    await until(async () => (await box.locator(".z-node-canvas__nodes > .z-node").count()) === 4, "pegar añade un nodo");
    const body = await box.locator(".z-node-canvas__nodes > .z-node").nth(3).locator(".z-node__body").textContent();
    ok(body === "total > 100", `el clon conserva su cuerpo: ${body}`);
    ok((await activeId())?.startsWith("filter-copy"), "el foco pasa al pegado");
  });

  await test("Nodos sin React · grafo en JSON, solo lectura, vista en lista conectada y axe", async () => {
    const box = await inject(html("NodeCanvas", 1));
    await until(async () => (await box.locator(".z-edge").count()) === 2, "aristas desde el JSON");
    ok((await box.locator(".z-node-minimap").count()) === 0, "data-minimap=false");
    const list = box.locator(".z-node-list");
    await until(async () => (await list.locator("tbody tr").count()) === 5, "la lista pinta nodos y conexiones");
    ok((await list.locator('[data-node-action="remove-edge"]').count()) === 0, "solo lectura: sin quitar conexiones");
    await box.locator('.z-node[data-id="hook"]').focus();
    await page.keyboard.press("Delete");
    await page.waitForTimeout(150);
    ok((await box.locator(".z-node-canvas__nodes > .z-node").count()) === 3, "solo lectura no borra");
    await list.locator('[data-node-action="show"][data-node="save"]').click();
    await until(async () => (await activeId()) === "save", "Show lleva el foco al nodo");
    if (!(await page.evaluate(() => typeof window.axe !== "undefined"))) await page.evaluate(axeSource);
    const violations = await box.evaluate(async (el) =>
      (await window.axe.run(el, { resultTypes: ["violations"] })).violations.map((v) => `${v.id} ${v.nodes[0]?.target}`),
    );
    ok(violations.length === 0, `axe: ${violations.join(", ")}`);
  });

  await test("Nodos sin React · 500 nodos y 800 aristas: solo se pinta lo visible y el script por fotograma (medida)", async () => {
    const box = await inject(
      '<div class="z-node-canvas" data-z-node-canvas data-edge-type="smoothstep" aria-label="Large graph" id="big"></div>',
      520,
    );
    const result = await box.evaluate(async (root) => {
      const el = root.querySelector(".z-node-canvas");
      const { setNodeGraph, nodeCanvas } = await import("/zui/dist/zui.dom.js");
      const nodes = [];
      const edges = [];
      const cols = 29;
      for (let i = 0; i < 500; i++)
        nodes.push({
          id: `n${i}`,
          position: { x: (i % cols) * 256, y: Math.floor(i / cols) * 128 },
          data: { label: `Step ${i + 1}`, description: `job-${i}` },
          ports: [
            { id: "in", kind: "target" },
            { id: "out", kind: "source" },
          ],
        });
      for (let i = 0; i < 500 && edges.length < 800; i++) {
        if ((i + 1) % cols !== 0 && i + 1 < 500)
          edges.push({ id: `r${i}`, source: `n${i}`, sourcePort: "out", target: `n${i + 1}`, targetPort: "in" });
        if (i + cols < 500) edges.push({ id: `d${i}`, source: `n${i}`, sourcePort: "out", target: `n${i + cols}`, targetPort: "in" });
      }
      const t0 = performance.now();
      setNodeGraph(el, { nodes, edges: edges.slice(0, 800) });
      nodeCanvas(el).setViewport({ x: 16, y: 16, zoom: 0.8 });
      await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
      const mount = performance.now() - t0;
      const loaf = [];
      const supported = PerformanceObserver.supportedEntryTypes?.includes("long-animation-frame");
      const observer = supported
        ? new PerformanceObserver((list) => {
            for (const e of list.getEntries()) loaf.push(e.scripts.reduce((a, s) => a + s.duration, 0));
          })
        : null;
      observer?.observe({ type: "long-animation-frame" });
      const r = el.getBoundingClientRect();
      const work = [];
      const times = [];
      let last = performance.now();
      for (let i = 0; i < 120; i++) {
        const a = performance.now();
        el.dispatchEvent(
          new WheelEvent("wheel", { deltaX: 16, deltaY: 10, clientX: r.left + 100, clientY: r.top + 100, bubbles: true, cancelable: true }),
        );
        await new Promise((done) =>
          requestAnimationFrame(() => {
            work.push(performance.now() - a);
            done();
          }),
        );
        const now = performance.now();
        times.push(now - last);
        last = now;
      }
      await new Promise((done) => setTimeout(done, 100));
      observer?.disconnect();
      const q = (list, p) => (list.length ? [...list].sort((x, y) => x - y)[Math.min(list.length - 1, Math.floor(list.length * p))] : 0);
      return {
        mount,
        nodes: el.querySelectorAll(".z-node").length,
        edges: el.querySelectorAll(".z-edge").length,
        mini: el.querySelectorAll(".z-node-minimap__node").length,
        p50: q(times, 0.5),
        p95: q(times, 0.95),
        script95: q(loaf, 0.95),
        script50: q(loaf, 0.5),
        long: loaf.length,
        supported: !!supported,
      };
    });
    note(
      `500/800 sin React: montaje ${result.mount.toFixed(0)} ms; ${result.nodes} nodos y ${result.edges} aristas en el documento; fotogramas al desplazar p50 ${result.p50.toFixed(1)} ms, p95 ${result.p95.toFixed(1)} ms` +
        (result.supported ? `; ${result.long} fotogramas largos, script p95 ${result.script95.toFixed(1)} ms` : ""),
    );
    ok(result.mini === 500, `el minimapa ve los 500: ${result.mini}`);
    ok(result.nodes < 150, `solo los visibles: ${result.nodes}`);
    // Con la máquina cargada (suite entera) hay fotogramas largos por el raster, no por el lienzo: se exige que el script
    // de esos fotogramas quede, en la mediana, dentro de un fotograma.
    if (result.supported) ok(result.script50 < 16, `script por fotograma largo, mediana ${result.script50.toFixed(1)} ms`);
  });
}
