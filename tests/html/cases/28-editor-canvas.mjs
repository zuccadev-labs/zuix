// Puente del conector de editores (zui/editor) en un navegador, sobre examples/editor-canvas: el editor en
// 127.0.0.1 y el lienzo en un iframe con sandbox="allow-scripts" (origen opaco). Se prueban el saludo con
// MessagePort, la carga, la selección (con su capa, que no ensucia el documento), la inserción, el cambio de props,
// deshacer y rehacer, el tema y los tokens en vivo, la exportación y que el lienzo rechaza otro origen.
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");

export default async function ({ page, test, ok, note }) {
  const built = spawnSync(process.execPath, [join(root, "examples/editor-canvas/build.mjs")], { encoding: "utf8" });
  const origin = new URL(page.url()).origin;
  const port = new URL(page.url()).port;
  const editor = await page
    .context()
    .browser()
    .newPage({ viewport: { width: 1440, height: 1000 } });
  const problems = [];
  editor.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  editor.on("console", (m) => {
    if (m.type() === "error") problems.push(`console: ${m.text()}`);
  });
  const canvas = () => editor.frames().find((f) => f.url().includes("canvas.html"));
  const counts = () => canvas().evaluate(() => document.querySelectorAll("#page [data-z-node]").length);
  const wait = (fn, arg) =>
    editor.waitForFunction(fn, arg, { timeout: 8000 }).catch((error) => {
      throw new Error(`no se cumplió ${String(fn).slice(6, 90)} (${error.message.split("\n")[0]})`);
    });

  try {
    await test("editor: el lienzo responde al saludo y pinta el documento", async () => {
      ok(built.status === 0, `no se pudo construir el ejemplo: ${built.stderr}`);
      await editor.goto(`${origin}/examples/editor-canvas/index.html`);
      await wait(() => document.documentElement.hasAttribute("data-editor-ready"));
      ok((await editor.locator("#canvas").getAttribute("sandbox")) === "allow-scripts", "el iframe no lleva sandbox");
      const frame = canvas();
      ok(frame, "no hay iframe del lienzo");
      ok(await frame.evaluate(() => window.origin === "null"), "el lienzo no tiene origen opaco");
      await frame.waitForSelector("#page .z-landing-hero h1");
      ok(await frame.evaluate(() => window.zuixCanvas.connected), "el lienzo no quedó conectado");
      ok((await counts()) === 3, `nodos pintados: ${await counts()}`);
    });

    await test("editor: clic en el lienzo selecciona, con capa fuera del documento", async () => {
      const frame = canvas();
      await frame.locator('#page [data-z-node="intro"]').click();
      await wait(() => window.zuixEditor.selected === "intro");
      ok((await editor.locator("#selected").textContent()).includes("Paragraph"), "el panel no muestra la selección");
      const box = await frame.evaluate(() => {
        const b = document.querySelector('.z-editor-overlay__box[data-kind="select"]');
        const r = b?.getBoundingClientRect();
        const t = document.querySelector('[data-z-node="intro"]').getBoundingClientRect();
        return {
          hidden: b?.hidden,
          inside: Boolean(b?.closest("#page")),
          dx: Math.abs((r?.x ?? 0) - t.x),
          dw: Math.abs((r?.width ?? 0) - t.width),
        };
      });
      ok(box.hidden === false && !box.inside && box.dx < 1 && box.dw < 1, `capa de selección: ${JSON.stringify(box)}`);
      const exported = await editor.evaluate(() => window.zuixEditor.document.body.length);
      ok(exported === 2, "la selección cambió el documento");
    });

    await test("editor: insertar desde el catálogo, cambiar una prop, deshacer y rehacer", async () => {
      const frame = canvas();
      // Sin selección el bloque va al final del cuerpo (con un párrafo seleccionado, el botón entraría en él).
      await frame.evaluate(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
      await wait(() => window.zuixEditor.selected === null);
      await editor.locator('#palette [data-block="Button"]').click();
      await wait(() => window.zuixEditor.document.body.length === 3);
      ok((await frame.locator("#page > .z-btn").count()) === 1, "el botón no llegó al lienzo");
      ok(await editor.locator("#undo").isEnabled(), "deshacer no se habilitó");
      await editor.locator('#props select[name="variant"]').selectOption("danger");
      await frame.waitForSelector("#page > .z-btn--danger");
      await editor.locator("#undo").click();
      await frame.waitForSelector("#page > .z-btn:not(.z-btn--danger)");
      await editor.locator("#undo").click();
      await wait(() => window.zuixEditor.document.body.length === 2);
      ok((await frame.locator("#page > .z-btn").count()) === 0, "deshacer no quitó el botón");
      await editor.locator("#redo").click();
      await wait(() => window.zuixEditor.document.body.length === 3);
      await editor.keyboard.press("Control+Shift+Z");
      await frame.waitForSelector("#page > .z-btn--danger");
    });

    await test("editor: una inserción inválida se rechaza con un error legible", async () => {
      const message = await editor.evaluate(async () => {
        try {
          await window.zuixEditor.connection.request("insert", { node: { id: "bad", type: "ListItem" }, at: { parent: null, index: 0 } });
          return "aceptada";
        } catch (error) {
          return `${error.code}: ${error.message}`;
        }
      });
      ok(/^invalid: .*ListItem «bad»/.test(message), message);
      const targets = await editor.evaluate(() =>
        window.zuixEditor.connection.request("measure", {}).then((m) => m.payload.targets.length),
      );
      ok(targets >= 4, `puntos de anclaje: ${targets}`);
    });

    await test("editor: tema y tokens en vivo; exportar HTML", async () => {
      const frame = canvas();
      await editor.locator("#theme").selectOption("light");
      await frame.waitForFunction(() => document.documentElement.dataset.theme === "light");
      await editor.locator("#accent").evaluate((el) => {
        el.value = "#1d4ed8";
        el.dispatchEvent(new Event("input", { bubbles: true }));
      });
      await frame.waitForFunction(() => getComputedStyle(document.documentElement).getPropertyValue("--z-accent").trim() === "#1d4ed8");
      await editor.locator("#export").click();
      const html = await editor.locator("#html").inputValue();
      ok(
        html.includes('class="z-landing-hero"') && html.includes("z-btn--danger") && !html.includes("data-z-node"),
        "el HTML exportado no es el del documento",
      );
      await editor.keyboard.press("Escape");
    });

    await test("editor: el lienzo rechaza el saludo de otro origen", async () => {
      const probe = await page.context().browser().newPage();
      await probe.goto(`http://localhost:${port}/examples/editor-canvas/probe.html`);
      const answered = await probe.evaluate(
        (editorOrigin) =>
          new Promise((resolve) => {
            const frame = document.createElement("iframe");
            frame.setAttribute("sandbox", "allow-scripts");
            frame.src = `./canvas.html?editor=${encodeURIComponent(editorOrigin)}`;
            frame.addEventListener("load", () => {
              const channel = new MessageChannel();
              channel.port1.onmessage = () => resolve(true);
              frame.contentWindow.postMessage(
                { protocol: "zuix-editor", version: 1, type: "hello", payload: { zuix: "", protocolVersion: 1 } },
                "*",
                [channel.port2],
              );
              setTimeout(() => resolve(false), 1500);
            });
            document.body.append(frame);
          }),
        origin,
      );
      const rejected = await probe
        .frames()
        .find((f) => f.url().includes("canvas.html"))
        .evaluate(() => window.zuixCanvas.rejected);
      await probe.close();
      ok(answered === false, "el lienzo respondió a un origen no admitido");
      ok(rejected >= 1, "el lienzo no contó el rechazo");
      note(`mensajes rechazados: ${rejected}`);
    });

    await test("editor: sin errores de consola", async () => ok(problems.length === 0, problems.slice(0, 5).join(" | ")));
  } finally {
    await editor.close();
  }
}
