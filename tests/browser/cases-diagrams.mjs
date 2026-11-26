// Binding de React de los diagramas de infraestructura (pantalla `?screen=infra` de examples/app): el inventario
// pintado con carpetas, nube, zona y PortPanel; aristas que salen del conector exacto; teclado de los puertos dentro
// de una tarjeta; el interruptor de enmascarado; exportar a SVG y PNG (descargas reales); forced-colors, movimiento
// reducido y axe.
import { readFileSync } from "node:fs";

export default function ({ t, assert, poll }) {
  const canvas = "#infra-canvas";
  const node = (id) => `${canvas} :is(.z-node, .z-node-group)[data-id="${id}"]`;
  const open = async (o, options = {}) => {
    const page = await o("infra", options);
    await poll(async () => (await page.locator(`${canvas} .z-edge`).count()) >= 14, "aristas del inventario y del flujo pintadas");
    // Segunda pasada con las medidas reales: las posiciones se asientan.
    await page.waitForTimeout(300);
    return page;
  };

  return [
    {
      name: "Infra (React): inventario pintado, carpetas, nube, zona, PortPanel y axe",
      async run({ open: o, axe }) {
        const page = await open(o);
        assert((await page.locator(`${canvas} .z-node[data-type="cloud"]`).count()) === 1, "la nube de internet");
        assert((await page.locator(`${canvas} .z-node.z-folder-card`).count()) >= 11, "tarjetas con pestaña");
        assert((await page.locator(`${canvas} .z-node-group[data-type="zone"]`).count()) === 1, "la zona DMZ");
        assert((await page.locator(`${canvas} .z-node-canvas__groups > [data-id="zone-dmz"]`).count()) === 1, "zona en la capa de grupos");
        assert((await page.locator(`${node("sw")} .z-port-panel [role="option"]`).count()) === 10, "los diez puertos del switch");
        assert((await page.locator(`${canvas} .z-node-canvas__edges .z-edge[data-double]`).count()) === 4, "troncales dobles");
        assert((await page.locator(`${canvas} .z-node-canvas__edges .z-edge[data-dash="dashed"]`).count()) === 1, "consola discontinua");
        assert((await page.locator(`${canvas} .z-edge__end-label`).count()) >= 10, "velocidades junto a los puertos");
        assert((await page.locator(`${canvas} .z-storage-pool [role="meter"]`).count()) === 2, "dos pools");
        assert((await page.locator(`${canvas} .z-diagram-legend__item`).count()) >= 8, "leyenda deducida del grafo");
        const violations = await axe(page, { include: canvas });
        assert(violations.length === 0, `axe en el diagrama:\n  ${violations.map((v) => `${v.id}: ${v.nodes[0]?.target}`).join("\n  ")}`);
      },
    },
    {
      name: "Infra (React): la arista sale del conector exacto y llega al borde de la tarjeta, sin cruzar nodos",
      async run({ open: o }) {
        const page = await open(o);
        const result = await page.evaluate((sel) => {
          const root = document.querySelector(sel);
          const edge = root.querySelector('.z-edge[data-id="link-5"] .z-edge__path'); // sw:p3 → desk
          const start = edge.getPointAtLength(0);
          const end = edge.getPointAtLength(edge.getTotalLength());
          const m = edge.getScreenCTM();
          const screen = (p) => ({ x: m.a * p.x + m.c * p.y + m.e, y: m.b * p.x + m.d * p.y + m.f });
          const jack = root.querySelector('.z-node[data-id="sw"] [data-port="p3"] .z-port__jack').getBoundingClientRect();
          const sw = root.querySelector('.z-node[data-id="sw"]').getBoundingClientRect();
          const body = root.querySelector('.z-node[data-id="desk"] .z-folder-card__body').getBoundingClientRect();
          // Ninguna ruta ortogonal atraviesa una tarjeta que no sea suya.
          const crossings = [];
          const cards = [...root.querySelectorAll(".z-node-canvas__nodes > .z-node")].map((n) => [n.dataset.id, n.getBoundingClientRect()]);
          for (const g of root.querySelectorAll('.z-edge[data-id^="link-"]')) {
            const p = g.querySelector(".z-edge__path");
            const len = p.getTotalLength();
            const mm = p.getScreenCTM();
            // Fuera de los extremos: el último tramo entra en su propia tarjeta por la pestaña hasta el borde.
            for (let s = 60; s < len - 60; s += 8) {
              const q = p.getPointAtLength(s);
              const x = mm.a * q.x + mm.c * q.y + mm.e;
              const y = mm.b * q.x + mm.d * q.y + mm.f;
              for (const [id, r] of cards)
                if (x > r.left + 2 && x < r.right - 2 && y > r.top + 2 && y < r.bottom - 2) crossings.push(`${g.dataset.id}→${id}`);
            }
          }
          return {
            start: screen(start),
            end: screen(end),
            jackX: jack.left + jack.width / 2,
            swBottom: sw.bottom,
            bodyTop: body.top,
            crossings: [...new Set(crossings)],
          };
        }, canvas);
        assert(Math.abs(result.start.x - result.jackX) < 1.5, `sale del conector 3: ${result.start.x} vs ${result.jackX}`);
        assert(
          Math.abs(result.start.y - result.swBottom) < 1.5,
          `desde el borde de abajo del switch: ${result.start.y} vs ${result.swBottom}`,
        );
        assert(
          Math.abs(result.end.y - result.bodyTop) < 1.5,
          `llega al borde de la tarjeta, no a la pestaña: ${result.end.y} vs ${result.bodyTop}`,
        );
        assert(result.crossings.length === 0, `rutas que cruzan tarjetas: ${result.crossings.join(", ")}`);
      },
    },
    {
      name: "Infra (React): dentro de la tarjeta del switch, flechas entre puertos con su descripción",
      async run({ open: o }) {
        const page = await open(o);
        await page.locator(node("sw")).focus();
        await page.keyboard.press("Enter");
        const focused = () => page.evaluate(() => document.activeElement?.getAttribute("data-port"));
        await poll(async () => (await focused()) === "p1", "Intro entra en la tarjeta y lleva al primer puerto");
        await page.keyboard.press("ArrowRight");
        await page.keyboard.press("ArrowRight");
        assert((await focused()) === "p3", `flechas al puerto 3: ${await focused()}`);
        const label = await page.evaluate(() => document.activeElement?.getAttribute("aria-label"));
        assert(label === "Port 3 Desk, connected, untagged VLAN 10 LAN", `descripción: ${label}`);
        await page.keyboard.press("End");
        assert((await focused()) === "sfp2", "Fin al último puerto");
        await page.keyboard.press("Escape");
        assert(
          (await page.evaluate(() => document.activeElement?.closest("[data-id]")?.getAttribute("data-id"))) === "sw",
          "Escape vuelve a la tarjeta",
        );
      },
    },
    {
      name: "Infra (React): el interruptor enmascara dominios e IP en todo el diagrama y los restaura",
      async run({ open: o }) {
        const page = await open(o);
        const host = page.locator(`${node("hv-proxy")} .z-redact`).first();
        const ip = page.locator(`${node("sw")} .z-device__ip`).first();
        assert((await host.textContent()) === "proxy.example.net", "dominio real");
        assert((await ip.textContent()) === "10.0.99.2", "IP real");
        await page.locator(t("infra-redact")).click();
        await poll(async () => (await host.textContent()) === "proxy.redacted.example", "dominio enmascarado");
        const masked = await ip.textContent();
        assert(/^(192\.0\.2|198\.51\.100|203\.0\.113)\.\d+$/.test(masked ?? ""), `IP enmascarada: ${masked}`);
        assert((await page.locator(`${canvas} [data-sensitive][data-redacted]`).count()) > 20, "todos los datos marcados");
        await page.locator(t("infra-redact")).click();
        await poll(async () => (await host.textContent()) === "proxy.example.net", "restaurado");
      },
    },
    {
      name: "Infra (React): exportar a SVG autocontenido y a PNG, con y sin enmascarado",
      async run({ open: o }) {
        const page = await open(o);
        const grab = async (id) => {
          const wait = page.waitForEvent("download", { timeout: 60_000 });
          await page.locator(t(id)).click();
          const download = await wait;
          return readFileSync(await download.path());
        };
        const svg = (await grab("infra-svg")).toString("utf8");
        assert(svg.startsWith("<svg") && svg.includes("<foreignObject"), "SVG con foreignObject");
        assert(svg.includes("Core switch") && svg.includes("proxy.example.net"), "con el texto del diagrama");
        assert(!/style="[^"]*var\(--/.test(svg), "sin variables CSS sin resolver");
        assert(!svg.includes("z-node-controls") && !svg.includes("z-node-minimap"), "sin el cromo");
        const width = Number(/<svg[^>]* width="(\d+)"/.exec(svg)?.[1]);
        assert(width > 1500, `el diagrama entero, no solo lo visible: ${width} px`);
        await page.locator(t("infra-redact")).click();
        const png = await grab("infra-png");
        assert(png.subarray(1, 4).toString("latin1") === "PNG", "firma PNG");
        const pngWidth = png.readUInt32BE(16);
        // Al doble de escala; el ancho puede variar unos píxeles con los textos enmascarados.
        assert(Math.abs(pngWidth / 2 - width) < width * 0.05, `PNG al doble: ${pngWidth} vs ${width}`);
        const masked = (await grab("infra-svg")).toString("utf8");
        assert(!masked.includes("proxy.example.net") && masked.includes("proxy.redacted.example"), "la exportación sale enmascarada");
        await page.locator(t("infra-redact")).click();
      },
    },
    {
      name: "Infra (React): forced-colors y movimiento reducido",
      async run({ open: o }) {
        const page = await open(o, { reducedMotion: "reduce" });
        await page.emulateMedia({ forcedColors: "active" });
        // El cambio de medio se aplica en el siguiente cálculo de estilo.
        await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
        await page.waitForTimeout(200);
        const out = await page.evaluate((sel) => {
          const root = document.querySelector(sel);
          const probe = document.createElement("span");
          probe.style.color = "CanvasText";
          root.append(probe);
          const text = getComputedStyle(probe).color;
          probe.remove();
          const paths = [...root.querySelectorAll(".z-edge:not([data-selected]) .z-edge__path")];
          return {
            text,
            off: paths.map((p) => getComputedStyle(p).stroke).filter((s) => s !== text).length,
            sample: paths.slice(0, 3).map((p) => getComputedStyle(p).stroke),
            animated: [...root.querySelectorAll(".z-edge[data-animated] .z-edge__path")].map((p) => getComputedStyle(p).animationName),
            marks: getComputedStyle(root.querySelector(".z-port__vlan")).backgroundColor,
          };
        }, canvas);
        assert(out.off === 0, `${out.off} aristas fuera de CanvasText (${out.text}): ${out.sample.join(" | ")}`);
        assert(out.animated.length === 2 && out.animated.every((a) => a === "none"), `sin animación: ${out.animated.join(", ")}`);
        assert(out.marks === out.text, `marcas de VLAN en CanvasText: ${out.marks}`);
      },
    },
  ];
}
