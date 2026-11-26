// Sin React: diagramas de infraestructura desde el contrato HTML de zui/html.json. Aristas con estilo y ortogonales,
// nube, carpeta y zona pintadas desde el grafo en JSON; PortPanel con teclado y aviso; enmascarado con el
// interruptor del marcado; exportar el lienzo a SVG y PNG; forced-colors, movimiento reducido y axe.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const contract = JSON.parse(readFileSync(join(here, "../../../zui/html.json"), "utf8")).components;
const axeSource = readFileSync(join(here, "../../../node_modules/axe-core/axe.min.js"), "utf8");

export default async function ({ page, test, ok, note }) {
  let seq = 0;
  const inject = async (raw, height = 560) => {
    const id = `dg-${++seq}`;
    await page.evaluate(
      async ([markup, wrap, h]) => {
        for (const old of document.querySelectorAll("[data-dg-layer]")) old.remove();
        const box = document.createElement("div");
        box.id = wrap;
        box.setAttribute("data-z-dom", "");
        box.setAttribute("data-dg-layer", "");
        box.innerHTML = markup;
        Object.assign(box.style, {
          position: "fixed",
          insetBlockStart: "0",
          insetInlineStart: "0",
          zIndex: "2147483000",
          inlineSize: "min(1100px, 100vw)",
          maxBlockSize: "100vh",
          overflow: "auto",
          padding: "16px",
          background: "Canvas",
        });
        document.querySelector(".page__main").append(box);
        for (const canvas of box.querySelectorAll(".z-node-canvas")) canvas.style.blockSize = `${h}px`;
        window.__dg = [];
        box.addEventListener("z:portselect", (event) => window.__dg.push(event.detail?.port));
        (await import("/zui/dist/zui.dom.js")).hydrate(box);
      },
      [raw, id, height],
    );
    return page.locator(`#${id}`);
  };
  const example = (name, title) => contract[name].examples.find((e) => e.title === title).html;
  const until = async (fn, message, tries = 80) => {
    for (let i = 0; i < tries; i++) {
      if (await fn()) return;
      await page.waitForTimeout(50);
    }
    ok(false, message);
  };
  const axe = async (box) => {
    if (!(await page.evaluate(() => typeof window.axe !== "undefined"))) await page.evaluate(axeSource);
    return box.evaluate(async (el) =>
      (await window.axe.run(el, { resultTypes: ["violations"] })).violations.map((v) => `${v.id} ${v.nodes[0]?.target}`),
    );
  };

  await test("Diagramas sin React · nube, carpeta y zona desde el grafo, aristas con estilo y ortogonales", async () => {
    const box = await inject(example("NodeCanvas", "Red con aristas con estilo, en JSON"));
    await until(async () => (await box.locator(".z-edge").count()) === 4, "cuatro aristas");
    ok((await box.locator('.z-node[data-type="cloud"] .z-node__shape path').count()) === 1, "la nube con su forma");
    ok((await box.locator(".z-node.z-folder-card .z-folder-card__tab").count()) === 3, "tres carpetas con pestaña");
    ok((await box.locator('.z-node-group[data-type="zone"]').getAttribute("style")).includes("--z-zone-color"), "la zona con su color");
    const trunk = box.locator('.z-edge[data-id="trunk"]');
    ok((await trunk.getAttribute("data-double")) === "", "troncal doble");
    ok((await trunk.locator(".z-edge__core").count()) === 1, "núcleo de la línea doble");
    ok((await trunk.evaluate((g) => g.style.getPropertyValue("--z-edge-width"))) === "5.5px", "10G = 5.5 px");
    const wan = box.locator('.z-edge[data-id="wan"]');
    ok((await wan.getAttribute("data-tone")) === "danger", "WAN en tono de peligro");
    const lan = box.locator('.z-edge[data-id="lan"]');
    ok((await lan.evaluate((g) => g.style.getPropertyValue("--z-edge-color"))) === "var(--z-chart-1)", "acceso con el color de su VLAN");
    ok((await box.locator('.z-edge[data-id="console"]').getAttribute("data-dash")) === "dashed", "consola discontinua");
    const stroke = await box.locator('.z-edge[data-id="console"] .z-edge__path').evaluate((p) => getComputedStyle(p).strokeDasharray);
    ok(stroke !== "none", `patrón discontinuo: ${stroke}`);
    // Ortogonal: todos los tramos son horizontales o verticales (las curvas son solo las esquinas Q).
    const straight = await box.locator(".z-edge__path").evaluateAll((paths) =>
      paths.every((p) => {
        // Todos los puntos en orden, con los de control de las esquinas: cada par seguido comparte x o y.
        const nums = (p.getAttribute("d") ?? "").match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
        for (let i = 2; i + 1 < nums.length; i += 2)
          if (Math.abs(nums[i] - nums[i - 2]) > 0.5 && Math.abs(nums[i + 1] - nums[i - 1]) > 0.5) return false;
        return true;
      }),
    );
    ok(straight, "tramos ortogonales");
    const ends = await box.locator(".z-edge__end-label").allTextContents();
    ok(
      ["1G", "2.5G", "10G"].every((t) => ends.includes(t)),
      `etiquetas de extremo: ${ends.join(", ")}`,
    );
    ok((await box.locator(".z-edge__label").textContent()) === "HDMI + USB", "etiqueta central");
    const violations = await axe(box);
    ok(violations.length === 0, `axe: ${violations.join(", ")}`);
  });

  await test("Diagramas sin React · exportar el lienzo a SVG y PNG", async () => {
    const box = await inject(example("NodeCanvas", "Red con aristas con estilo, en JSON"));
    await until(async () => (await box.locator(".z-edge").count()) === 4, "cuatro aristas");
    const result = await box.locator(".z-node-canvas").evaluate(async (el) => {
      const dom = await import("/zui/dist/zui.dom.js");
      const handle = dom.nodeCanvas(el);
      const svg = await handle.exportSVG({ title: "Small network", padding: 24 });
      const png = await handle.exportPNG({ scale: 1, padding: 24 });
      const bitmap = await createImageBitmap(png);
      const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
      const styles = [...doc.querySelectorAll("[style]")].map((n) => n.getAttribute("style"));
      return {
        root: doc.documentElement.localName,
        title: doc.querySelector("title")?.textContent,
        foreign: doc.querySelectorAll("foreignObject").length,
        vars: styles.filter((s) => s.includes("var(--")).length,
        controls: doc.querySelectorAll(".z-node-controls, .z-node__resize").length,
        text: doc.documentElement.textContent.includes("Core switch"),
        width: Number(doc.documentElement.getAttribute("width")),
        pngType: png.type,
        png: [bitmap.width, bitmap.height],
        error: doc.querySelector("parsererror")?.textContent ?? null,
        visible: el.dataset.visibleCount,
      };
    });
    ok(result.error === null, `SVG bien formado: ${result.error}`);
    ok(result.root === "svg" && result.title === "Small network" && result.foreign === 1, "documento SVG con título y foreignObject");
    ok(result.vars === 0, `estilos resueltos, sin var(): ${result.vars}`);
    ok(result.controls === 0, "sin el cromo");
    ok(result.text, "el texto de los nodos");
    ok(result.pngType === "image/png" && result.png[0] === result.width, `PNG ${result.png.join("×")} (SVG ${result.width})`);
    note(`SVG ${result.width} px de ancho · PNG ${result.png.join("×")}`);
  });

  await test("Diagramas sin React · PortPanel: foco itinerante, Intro elige y avisa, descripción completa", async () => {
    const box = await inject(example("PortPanel", "Switch con VLAN"));
    const options = box.locator('.z-port-panel [role="option"]');
    ok((await box.locator('.z-port-panel [tabindex="0"]').count()) === 1, "una parada de tabulación");
    await options.first().focus();
    await page.keyboard.press("ArrowRight");
    const focused = () => page.evaluate(() => document.activeElement?.getAttribute("data-port"));
    ok((await focused()) === "p2", "flecha derecha al puerto 2");
    ok((await options.nth(1).getAttribute("tabindex")) === "0", "la parada se mueve");
    await page.keyboard.press("End");
    ok((await focused()) === "s1", "Fin al último");
    await page.keyboard.press("Home");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Enter");
    ok((await page.evaluate(() => window.__dg.at(-1))) === "p2", "z:portselect con el puerto");
    ok((await options.nth(1).getAttribute("aria-selected")) === "true", "aria-selected");
    const label = await options.nth(1).getAttribute("aria-label");
    ok(label === "Port 2 Desk, connected, untagged LAN, 2.5G", `descripción: ${label}`);
    ok((await options.nth(4).getAttribute("aria-disabled")) === "true", "deshabilitado");
    const violations = await axe(box);
    ok(violations.length === 0, `axe: ${violations.join(", ")}`);
  });

  await test("Diagramas sin React · enmascarado con [data-sensitive] y el interruptor del marcado", async () => {
    const box = await inject(
      '<p><span data-sensitive="domain">git.mylab.example.net</span> · <span data-sensitive="ip">81.40.12.7</span> · <span data-sensitive="text" data-sensitive-placeholder="SSID">Home Wi-Fi</span></p><label><input type="checkbox" data-z-redact-toggle> Mask</label>',
    );
    const text = () => box.locator("p").textContent();
    const before = await text();
    await box.locator("input").check();
    await until(async () => (await text()) !== before, "enmascara al marcar");
    const masked = await text();
    ok(masked.startsWith("git.mylab.example.com"), `dominio: ${masked}`);
    ok(!masked.includes("81.40.12.7") && /(192\.0\.2|198\.51\.100|203\.0\.113)\.\d+/.test(masked), `IP: ${masked}`);
    ok(masked.endsWith("SSID"), "texto con sustituto fijo");
    ok((await box.locator("[data-redacted]").count()) === 3, "data-redacted");
    await box.locator("input").uncheck();
    await until(async () => (await text()) === before, "restaura al desmarcar");
  });

  await test("Diagramas sin React · StoragePool, DiagramLegend, FolderCard y SpecList sin infracciones", async () => {
    const markup = [
      example("StoragePool", "RAIDZ2 con vdev especial"),
      example("DiagramLegend", "Desde un grafo"),
      example("FolderCard", "Equipo de red"),
      example("SpecList", "Hardware"),
    ].join("");
    const box = await inject(markup);
    const meter = box.locator('[role="meter"]');
    ok((await meter.getAttribute("aria-valuetext")).startsWith("49% used"), `medidor: ${await meter.getAttribute("aria-valuetext")}`);
    ok((await box.locator(".z-disk").count()) === 8, "ocho discos");
    ok((await box.locator(".z-diagram-legend__item").count()) === 8, "filas de la leyenda");
    const columns = await box
      .locator(".z-diagram-legend__key")
      .evaluateAll((keys) => new Set(keys.map((k) => Math.round(k.getBoundingClientRect().left))).size);
    ok(columns === 1, "las muestras comparten columna (subrejilla)");
    const violations = await axe(box);
    ok(violations.length === 0, `axe: ${violations.join(", ")}`);
  });

  await test("Diagramas sin React · forced-colors y movimiento reducido", async () => {
    await page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
    try {
      const box = await inject(example("NodeCanvas", "Red con aristas con estilo, en JSON"));
      await until(async () => (await box.locator(".z-edge").count()) === 4, "cuatro aristas");
      const colors = await box.evaluate((el) => {
        const probe = document.createElement("span");
        probe.style.color = "CanvasText";
        el.append(probe);
        const text = getComputedStyle(probe).color;
        probe.remove();
        const strokes = [...el.querySelectorAll(".z-edge__path")].map((p) => getComputedStyle(p).stroke);
        const dash = getComputedStyle(el.querySelector('.z-edge[data-id="console"] .z-edge__path')).strokeDasharray;
        return { text, strokes, dash };
      });
      ok(
        colors.strokes.every((s) => s === colors.text),
        `aristas en CanvasText: ${colors.strokes.join(" | ")}`,
      );
      ok(colors.dash !== "none", "el tipo de línea se conserva");
      const panel = await inject(example("PortPanel", "Switch con VLAN"));
      const mark = await panel
        .locator(".z-port__vlan")
        .first()
        .evaluate((m) => getComputedStyle(m).backgroundColor);
      ok(mark !== "rgba(0, 0, 0, 0)", `marca de VLAN visible: ${mark}`);
    } finally {
      await page.emulateMedia({ forcedColors: "none", reducedMotion: "no-preference" });
    }
  });
}
