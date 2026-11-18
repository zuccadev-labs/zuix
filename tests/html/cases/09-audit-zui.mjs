// Auditoría previa a 0.1.1 del modo sin framework de zui.
//  1. TODOS los ejemplos de zui/html.json (no solo el primero de cada componente): cada uno en su página, con
//     consola limpia, sin violaciones graves de axe y con su interacción genérica funcionando.
//  2. Seguridad: inyección de marcado y de selectores, CSP estricta y Trusted Types.
//  3. Comportamiento corregido en la auditoría: Tooltip (WCAG 1.4.13), Toast (pausa, F8), diálogos, Rating,
//     acordeón anidado, RTL, popovers que siguen al disparador.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const contract = JSON.parse(readFileSync(join(here, "../../../zui/html.json"), "utf8")).components;
const axeSource = readFileSync(join(here, "../../../node_modules/axe-core/axe.min.js"), "utf8");

const PIXEL = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const HEAD = `<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="icon" href="data:,">
<link rel="stylesheet" href="/tokens/dist/tokens.css"><link rel="stylesheet" href="/zui/dist/zui.css"><link rel="stylesheet" href="/examples/html/page.css">`;

/** Página con un solo ejemplo del contrato, tal como lo copiaría una aplicación. */
function examplePage(name, example) {
  // Los `import` del ejemplo apuntan al paquete publicado: aquí salen del bundle local.
  const script = (example.script ?? "")
    .replace(/^import\s*\{([^}]*)\}\s*from\s*"@zuccadev-labs\/zuix-zui\/dom";?\s*$/gm, "const {$1} = zui;")
    .replace(/^import .*$/gm, "");
  return `<!doctype html><html lang="en" data-theme="dark" data-brand="dazlabs"><head>${HEAD}<title>${name}</title></head>
<body class="z-root z-canvas" data-z-dom><main style="padding:48px;min-height:600px"><h1 class="z-sr-only">${name}</h1>
${example.html}
</main>
<script type="module">
import "/zicon/dist/zicon.element.js";
import * as zui from "/zui/dist/zui.dom.js";
window.zui = zui;
window.__events = [];
for (const type of ["z:open", "z:close", "z:change", "z:select", "z:sort", "z:input"]) document.addEventListener(type, (event) => window.__events.push(type));
const removeProject = () => zui.toast({ title: "Project deleted", intent: "danger" });
zui.init();
${script}
window.__ready = true;
</script></body></html>`;
}

export default async function ({ page, test, ok, shots, browserName, note, Unverifiable }) {
  const dir = join(shots, "audit");
  mkdirSync(dir, { recursive: true });
  const base = new URL(page.url()).origin;
  const urlOf = (file) => `${base}/tests/html/shots/${browserName}/audit/${file}`;

  /** Abre una página aparte y vigila consola, errores y red; `problems` se comprueba al cerrar. */
  async function openPage(file, { viewport = { width: 1100, height: 800 } } = {}) {
    // Página propia (contexto aparte): se cierra al terminar el caso.
    const tab = await page.context().browser().newPage({ viewport });
    tab.setDefaultTimeout(8000);
    const problems = [];
    tab.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
    tab.on("console", (m) => {
      if (m.type() === "error" && !m.text().includes("Failed to load resource")) problems.push(`console: ${m.text()}`);
    });
    tab.on("requestfailed", (r) => problems.push(`request: ${r.url()}`));
    tab.on("response", (r) => {
      if (r.status() >= 400) problems.push(`${r.status()}: ${r.url()}`);
    });
    // Imágenes de muestra de los ejemplos (rutas absolutas de la aplicación): un píxel.
    await tab.route(/\.(jpg|jpeg|png|webp)(\?.*)?$/, (route) => route.fulfill({ contentType: "image/png", body: PIXEL }));
    await tab.goto(urlOf(file));
    try {
      await tab.waitForFunction(() => window.__ready === true);
    } catch {
      const seen = problems.join(" | ");
      await tab.close();
      throw new Error(`la página ${file} no terminó de cargar: ${seen}`);
    }
    return { tab, problems };
  }
  const write = (file, html) => writeFileSync(join(dir, file), html);
  const scratch = (
    body,
    script = "",
  ) => `<!doctype html><html lang="en" data-theme="dark" data-brand="dazlabs"><head>${HEAD}<title>audit</title></head>
<body class="z-root z-canvas" data-z-dom><main style="padding:48px;min-height:900px"><h1>Audit</h1>${body}</main>
<script type="module">
import "/zicon/dist/zicon.element.js";
import * as zui from "/zui/dist/zui.dom.js";
window.zui = zui;
window.__events = [];
for (const type of ["z:open", "z:close", "z:change", "z:select"]) document.addEventListener(type, (event) => window.__events.push({ type, id: event.target.id, detail: event.detail ?? null }));
zui.init();
${script}
window.__ready = true;
</script></body></html>`;

  /* ---------- 1. Todos los ejemplos del contrato ---------- */

  const all = Object.entries(contract)
    .filter(([, c]) => c.behavior !== "react")
    .flatMap(([name, c]) => c.examples.map((example, index) => ({ name, index, example, behavior: c.behavior })));

  await test(`contrato: los ${all.length} ejemplos de zui/html.json cargan sin errores, sin violaciones graves de axe y responden`, async () => {
    const failures = [];
    let interactions = 0;
    for (const { name, index, example } of all) {
      const id = `${name} #${index + 1} "${example.title}"`;
      const file = `ex-${name}-${index}.html`;
      write(file, examplePage(name, example));
      const { tab, problems } = await openPage(file);
      // Espera a que se cumpla `check` (hasta `timeout` ms) y devuelve si se cumplió. Sustituye a «esperar N ms y mirar
      // una vez»: con la CPU saturada una animación de salida de 200 ms puede tardar un segundo, y eso no es un fallo
      // del componente. Lo que se comprueba es lo mismo; solo cambia cuánto se espera antes de darlo por incumplido.
      const soon = async (check, timeout = 5000) => {
        const end = Date.now() + timeout;
        for (;;) {
          if (await check()) return true;
          if (Date.now() > end) return false;
          await tab.waitForTimeout(40);
        }
      };
      try {
        await soon(
          () => tab.evaluate(() => [...document.querySelectorAll("z-icon")].every((i) => i.querySelector("svg.z-icon path"))),
          3000,
        );
        // Iconos dibujados y nada desbordado.
        const state = await tab.evaluate(() => ({
          icons: [...document.querySelectorAll("z-icon")]
            .filter((i) => !i.querySelector("svg.z-icon path"))
            .map((i) => i.getAttribute("name")),
          overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
          ids: [...document.querySelectorAll("[id]")].map((el) => el.id).filter((v, i, list) => list.indexOf(v) !== i),
        }));
        if (state.icons.length) failures.push(`${id}: iconos sin dibujar (${state.icons.join(", ")})`);
        if (state.overflow) failures.push(`${id}: desbordamiento horizontal`);
        if (state.ids.length) failures.push(`${id}: ids duplicados (${state.ids.join(", ")})`);

        // Interacción genérica según lo que el marcado declara.
        for (const opener of await tab.locator("[data-z-open]").all()) {
          const ref = await opener.getAttribute("data-z-open");
          if (await opener.isDisabled().catch(() => false)) continue;
          await opener.click();
          const isOpen = () =>
            tab.evaluate((r) => {
              const el = document.getElementById(r.slice(1));
              return el ? (el instanceof HTMLDialogElement ? el.open : el.matches(":popover-open")) : null;
            }, ref);
          await soon(async () => (await isOpen()) === true);
          const opened = await isOpen();
          if (opened !== true) failures.push(`${id}: data-z-open="${ref}" no abre`);
          interactions += 1;
          // Cada capa tiene nombre accesible mientras está abierta.
          const unnamed = await tab.evaluate((r) => {
            const el = document.getElementById(r.slice(1));
            const role = el.getAttribute("role") ?? (el instanceof HTMLDialogElement ? "dialog" : "");
            return (
              ["dialog", "alertdialog", "menu", "listbox"].includes(role) &&
              !el.getAttribute("aria-label") &&
              !document.getElementById(el.getAttribute("aria-labelledby") ?? "") &&
              !document.querySelector(`[aria-controls="${el.id}"], [data-z-open="#${el.id}"]`)?.textContent.trim()
            );
          }, ref);
          if (unnamed) failures.push(`${id}: la capa ${ref} no tiene nombre accesible`);
          await tab.keyboard.press("Escape");
          const isClosed = () =>
            tab.evaluate((r) => {
              const el = document.getElementById(r.slice(1));
              return el instanceof HTMLDialogElement ? !el.open : !el.matches(":popover-open");
            }, ref);
          // Un diálogo estático no se cierra con Escape: no hay por qué agotar el plazo esperándolo.
          const staticLayer = await tab.evaluate((r) => document.getElementById(r.slice(1)).hasAttribute("data-z-static"), ref);
          if (staticLayer) await tab.waitForTimeout(320);
          else await soon(isClosed);
          const closed = await isClosed();
          if (!closed) {
            // Un diálogo estático no se cierra con Escape: se cierra con su botón.
            const isStatic = await tab.evaluate((r) => document.getElementById(r.slice(1)).hasAttribute("data-z-static"), ref);
            if (!isStatic) failures.push(`${id}: Escape no cierra ${ref}`);
            await tab.evaluate((r) => {
              const el = document.getElementById(r.slice(1));
              if (el instanceof HTMLDialogElement) el.close();
              else el.hidePopover();
            }, ref);
          }
        }
        for (const tabs of await tab.locator(".z-tabs").all()) {
          const second = tabs.locator(".z-tabs__tab:not([data-disabled]):not([disabled])").nth(1);
          if (!(await second.count())) continue;
          await second.click();
          interactions += 1;
          if ((await second.getAttribute("aria-selected")) !== "true") failures.push(`${id}: la segunda pestaña no se selecciona`);
          const panel = await second.getAttribute("aria-controls");
          if (panel && (await tab.evaluate((p) => document.getElementById(p)?.hidden !== false, panel)))
            failures.push(`${id}: el panel ${panel} sigue oculto`);
        }
        for (const control of await tab
          .locator(
            'button[role="switch"]:not([disabled]):not([data-disabled]), button[role="checkbox"]:not([disabled]):not([data-disabled])',
          )
          .all()) {
          const before = await control.getAttribute("aria-checked");
          await control.click();
          interactions += 1;
          if ((await control.getAttribute("aria-checked")) === before)
            failures.push(`${id}: ${await control.getAttribute("role")} no cambia de estado`);
        }
        for (const group of await tab.locator('[role="radiogroup"]').all()) {
          const radio = group.locator('[role="radio"]:not([disabled]):not([data-disabled])').last();
          if (!(await radio.count())) continue;
          await radio.click();
          interactions += 1;
          if ((await radio.getAttribute("aria-checked")) !== "true") failures.push(`${id}: el radio no queda marcado`);
        }
        for (const pressed of await tab.locator("[data-z-dom] button[aria-pressed]:not([disabled])").all()) {
          const before = await pressed.getAttribute("aria-pressed");
          await pressed.click();
          interactions += 1;
          if ((await pressed.getAttribute("aria-pressed")) === before) failures.push(`${id}: aria-pressed no cambia`);
        }
        for (const trigger of await tab
          .locator('.z-accordion__trigger[aria-expanded="false"]:not([disabled]):not([data-disabled])')
          .elementHandles()) {
          await trigger.click();
          interactions += 1;
          if ((await trigger.getAttribute("aria-expanded")) !== "true") failures.push(`${id}: la sección del acordeón no se abre`);
        }
        for (const control of await tab.locator(".z-select:not(.z-datepicker) > button.z-select__control:not([disabled])").all()) {
          // Un Select generado desde React no trae su lista (va por portal): el contrato sin framework es el escrito a mano.
          if (!(await control.evaluate((b) => document.getElementById(b.getAttribute("aria-controls") ?? "")))) {
            failures.push(`${id}: Select sin lista en el marcado (aria-controls no apunta a nada)`);
            continue;
          }
          await control.click();
          await soon(async () => (await control.getAttribute("aria-expanded")) === "true");
          interactions += 1;
          if ((await control.getAttribute("aria-expanded")) !== "true") {
            failures.push(`${id}: Select no abre`);
            continue;
          }
          await tab.keyboard.press("End");
          await tab.keyboard.press("Enter");
          await soon(async () => (await control.getAttribute("aria-expanded")) === "false");
          if ((await control.getAttribute("aria-expanded")) !== "false") failures.push(`${id}: Select no cierra al elegir`);
        }
        for (const input of await tab.locator(".z-combobox input.z-input__control:not([disabled])").all()) {
          await input.click();
          await soon(async () => (await input.getAttribute("aria-expanded")) === "true");
          interactions += 1;
          if ((await input.getAttribute("aria-expanded")) !== "true") failures.push(`${id}: Combobox no abre`);
          await tab.keyboard.press("Escape");
        }
        for (const control of await tab.locator(".z-datepicker > button.z-select__control:not([disabled])").all()) {
          await control.click();
          await soon(() => tab.evaluate(() => document.activeElement?.classList.contains("z-calendar__day") === true));
          interactions += 1;
          if (!(await tab.evaluate(() => document.activeElement?.classList.contains("z-calendar__day"))))
            failures.push(`${id}: DatePicker no enfoca un día al abrir`);
          await tab.keyboard.press("Escape");
          await soon(async () => (await control.getAttribute("aria-expanded")) !== "true");
        }
        for (const cal of await tab.locator("[data-z-dom] .z-calendar").all()) {
          if (!(await cal.isVisible())) continue;
          interactions += 1;
          if ((await cal.locator(".z-calendar__day").count()) < 28) failures.push(`${id}: Calendar sin rejilla`);
        }
        for (const thumb of await tab.locator(".z-slider:not([data-disabled]) .z-slider__thumb").all()) {
          const before = await thumb.getAttribute("aria-valuenow");
          await thumb.focus();
          await tab.keyboard.press("End");
          await tab.keyboard.press("ArrowLeft");
          interactions += 1;
          if ((await thumb.getAttribute("aria-valuenow")) === before && before === (await thumb.getAttribute("aria-valuemax")))
            failures.push(`${id}: Slider no responde al teclado`);
          if (!(await thumb.getAttribute("aria-label")) && !(await thumb.getAttribute("aria-labelledby")))
            failures.push(`${id}: tirador de Slider sin nombre accesible`);
        }
        for (const cell of await tab.locator(".z-otp").all()) {
          const first = cell.locator(".z-otp__cell:not([disabled])").first();
          if (!(await first.count())) continue;
          await first.click();
          await tab.keyboard.type("7");
          interactions += 1;
          if ((await first.inputValue()) !== "7" && (await cell.getAttribute("data-mode")) !== "text")
            failures.push(`${id}: OTPInput no acepta un dígito`);
        }
        for (const nav of await tab.locator("[data-z-dom] .z-pagination").all()) {
          const next = nav.locator(":scope > .z-pagination__btn").last();
          if (await next.isDisabled()) continue;
          const before = await nav.locator('[aria-current="page"]').textContent();
          await next.click();
          interactions += 1;
          if ((await nav.locator('[aria-current="page"]').textContent()) === before) failures.push(`${id}: Pagination no avanza`);
        }
        for (const sorter of await tab.locator("[data-z-dom] .z-table__sort").all()) {
          const sortOf = () => sorter.evaluate((b) => b.closest("th").getAttribute("aria-sort"));
          const before = await sortOf();
          await sorter.click();
          interactions += 1;
          if ((await sortOf()) === before) failures.push(`${id}: DataTable no cambia el orden`);
        }
        for (const item of await tab
          .locator('[data-z-dom] [role="treeitem"][aria-expanded="false"]:not([aria-disabled="true"])')
          .elementHandles()) {
          if (!(await item.isVisible())) continue;
          await (await item.$(":scope > .z-tree__row")).click();
          interactions += 1;
          if ((await item.getAttribute("aria-expanded")) !== "true") failures.push(`${id}: Tree no expande`);
        }
        for (const arrow of await tab.locator(".z-carousel__arrow").all()) {
          if (await arrow.isDisabled()) continue;
          await arrow.click();
          interactions += 1;
        }
        for (const host of await tab.locator("[data-z-tooltip]").all()) {
          await host.hover();
          await soon(async () => (await tab.locator('.z-tooltip[role="tooltip"]').count()) > 0);
          interactions += 1;
          if (!(await tab.locator('.z-tooltip[role="tooltip"]').count())) failures.push(`${id}: Tooltip no aparece`);
          await tab.mouse.move(2, 2);
          await soon(async () => (await tab.locator('.z-tooltip[role="tooltip"]').count()) === 0, 3000);
        }
        // Botones que el script del ejemplo conecta (toast, confirm): un clic no debe lanzar.
        for (const button of await tab.locator("main > button[id]:not([data-z-open]), main > .z-btn[id]:not([data-z-open])").all()) {
          await button.click();
          await tab.waitForTimeout(150);
          interactions += 1;
          if (await tab.locator("dialog.z-confirm[open]").count()) {
            await tab.keyboard.press("Escape");
            await soon(async () => (await tab.locator("dialog.z-confirm[open]").count()) === 0);
          }
        }
        await tab.mouse.move(2, 2);
        // axe mide contraste y visibilidad: se evalúa con las animaciones de entrada y salida ya terminadas.
        await soon(
          () =>
            tab.evaluate(() =>
              document.getAnimations().every((a) => a.playState !== "running" || a.effect?.getComputedTiming().iterations === Infinity),
            ),
          3000,
        );
        await tab.evaluate(axeSource);
        const violations = await tab.evaluate(async () => {
          const result = await window.axe.run(document, { resultTypes: ["violations"] });
          return result.violations
            .filter((v) => v.impact === "serious" || v.impact === "critical")
            .map(
              (v) =>
                `${v.id}: ${v.nodes
                  .slice(0, 3)
                  .map((n) => n.target.join(" "))
                  .join("; ")}`,
            );
        });
        for (const violation of violations) failures.push(`${id}: axe ${violation}`);
        for (const problem of problems) failures.push(`${id}: ${problem}`);
      } catch (error) {
        failures.push(`${id}: ${String(error.message).split("\n")[0]}`);
      } finally {
        await tab.close();
      }
    }
    note(`${all.length} ejemplos · ${interactions} interacciones comprobadas`);
    ok(failures.length === 0, `${failures.length} problemas: ${failures.slice(0, 40).join(" ‖ ")}`);
  });

  /* ---------- 2. Seguridad ---------- */

  const XSS = `"><img src=x onerror="window.__xss=(window.__xss||0)+1"><svg onload="window.__xss=1"></svg><script>window.__xss=1</script>`;

  await test("seguridad: referencias (data-z-open, data-z-context, data-z-submenu) con selectores inválidos, ids con caracteres especiales y disparadores deshabilitados", async () => {
    write(
      "sec-refs.html",
      scratch(`
    <button id="bad1" data-z-open="#a b[[">bad selector</button>
    <button id="bad2" data-z-open="">empty</button>
    <button id="bad3" data-z-open="#missing">missing</button>
    <div id="zone-bad" data-z-context=":::">zone with bad selector</div>
    <button id="react" data-z-open="#:r1:">react id</button>
    <div id=":r1:" popover class="z-liquid z-popover" role="dialog" aria-label="React id">ok</div>
    <button id="quoted" data-z-open='#we"ird.id'>quoted id</button>
    <dialog id='we"ird.id' class="z-liquid z-modal" aria-label="Weird"><button data-z-close>Close</button></dialog>
    <button id="off" disabled data-z-open="#never"><span id="off-inner">disabled</span></button>
    <button id="aria-off" aria-disabled="true" data-z-open="#never">aria-disabled</button>
    <dialog id="never" class="z-liquid z-modal" aria-label="Never"><button data-z-close>Close</button></dialog>
    <button id="menu-open" aria-haspopup="menu" data-z-open="#menu">Menu</button>
    <div id="menu" popover class="z-liquid z-menu" role="menu"><button role="menuitem" class="z-menu__item" id="sub-bad" data-z-submenu="#nope[">Broken sub</button></div>`),
    );
    const { tab, problems } = await openPage("sec-refs.html");
    try {
      for (const id of ["bad1", "bad2", "bad3"]) await tab.locator(`#${id}`).click();
      await tab.locator("#zone-bad").click({ button: "right" });
      await tab.locator("#zone-bad").dispatchEvent("pointerdown", { pointerType: "touch", pointerId: 9, bubbles: true });
      ok(
        await tab.evaluate(() => document.body.getAttribute("popover") === null && !document.querySelector(":popover-open")),
        "una referencia inválida no debe abrir nada ni tocar <body>",
      );
      await tab.locator("#react").click();
      ok(await tab.locator('[id=":r1:"]').evaluate((el) => el.matches(":popover-open")), 'data-z-open="#:r1:" (id de useId) no abre');
      await tab.keyboard.press("Escape");
      await tab.locator("#quoted").click();
      ok(await tab.locator("dialog.z-modal[aria-label='Weird']").evaluate((d) => d.open), "un id con comillas y punto no se resuelve");
      await tab.keyboard.press("Escape");
      await tab.waitForTimeout(350);
      await tab.locator("#aria-off").click({ force: true });
      await tab.locator("#off-inner").dispatchEvent("click");
      ok(await tab.locator("#never").evaluate((d) => !d.open), "un disparador deshabilitado (disabled o aria-disabled) abrió su diálogo");
      await tab.locator("#menu-open").click();
      await tab.locator("#sub-bad").click();
      await tab.keyboard.press("ArrowRight");
      ok(problems.length === 0, problems.join(" | "));
    } finally {
      await tab.close();
    }
  });

  await test("seguridad: el texto de la aplicación nunca se interpreta como marcado (toast, confirm, tooltip, combobox, select, calendar, pagination, palette, carousel, upload)", async () => {
    write(
      "sec-xss.html",
      scratch(
        `
    <button id="tip" data-z-tooltip="x">tip</button>
    <span class="z-input z-combobox" id="combo" data-size="md"><input class="z-input__control" role="combobox" aria-label="City" aria-controls="combo-list" aria-expanded="false" aria-autocomplete="list"><div id="combo-list" popover class="z-liquid z-listbox" data-size="md"><div class="z-listbox__viewport" role="listbox" aria-label="City"></div></div></span>
    <span class="z-select" id="sel" data-size="md"><button type="button" class="z-select__control" role="combobox" aria-label="Pick" aria-controls="sel-list" aria-expanded="false"><span class="z-select__value"></span></button><div id="sel-list" popover class="z-liquid z-listbox" role="listbox" aria-label="Pick"><div class="z-listbox__viewport"><div class="z-listbox__option" role="option" id="sel-opt"><span class="z-listbox__icon"></span><span class="z-listbox__text"></span></div></div></div></span>
    <div class="z-calendar" id="cal"></div>
    <nav class="z-pagination" id="pages" aria-label="Pages" data-page-count="20"><button type="button" class="z-pagination__btn" aria-label="Previous">‹</button><button type="button" class="z-pagination__btn" aria-current="page" aria-label="Page 1">1</button><button type="button" class="z-pagination__btn" aria-label="Next">›</button></nav>
    <dialog class="z-liquid z-palette" id="pal" aria-label="Commands"><input class="z-palette__input" role="combobox" aria-label="Commands" aria-expanded="true"><div class="z-palette__list" role="listbox" aria-label="Commands"><div class="z-palette__item" role="option" data-value="a"><span class="z-palette__item-label">Alpha</span></div></div></dialog>
    <div class="z-carousel" id="car" data-effect="none" aria-label="Slides"><div data-raster="#nope[[">One</div><div>Two</div></div>
    <label class="z-upload" id="up"><input class="z-upload__input z-sr-only" type="file" multiple><span class="z-upload__label">Drop</span><ul class="z-upload__files"></ul></label>`,
        `const X = ${JSON.stringify(XSS).replace(/</g, "\\u003c")};
   document.querySelector("#tip").setAttribute("data-z-tooltip", X);
   const set = (sel, name) => document.querySelector(sel).setAttribute(name, X);
   set("#cal", "data-previous-label"); set("#cal", "data-next-label"); set("#cal", "data-locale"); set("#cal", "data-month"); set("#cal", "data-value"); set("#cal", "data-min");
   set("#pages", "data-page-label"); set("#pal", "data-empty-label"); set("#car", "data-label-slide"); set("#car", "data-label-previous"); set("#combo", "data-empty-text");
   document.querySelector("#sel-opt").dataset.value = X; document.querySelector("#sel-opt .z-listbox__text").textContent = X;
   document.querySelector("#sel-opt .z-listbox__icon").append(Object.assign(document.createElement("z-icon"), {}));
   document.querySelector("#sel-opt z-icon").setAttribute("name", X);
   zui.hydrate(document);
   zui.carousel(document.querySelector("#car"));
   zui.setComboboxOptions(document.querySelector("#combo"), [{ value: X, label: X, icon: X }, { value: "b", label: "B" }]);
   zui.setSelectValue(document.querySelector("#sel"), X);
   window.__dismiss = zui.toast({ title: X, description: X, action: { label: X, onClick() {} }, closeLabel: X, regionLabel: X, duration: 0 });
   window.__confirm = zui.confirm({ title: X, description: X, confirmLabel: X, cancelLabel: X });`,
      ),
    );
    const { tab, problems } = await openPage("sec-xss.html");
    try {
      await tab.waitForTimeout(200);
      ok(
        await tab.locator("dialog.z-confirm .z-modal__title").evaluate((el, x) => el.textContent === x && el.children.length === 0, XSS),
        "confirm(): el título no es texto literal",
      );
      await tab.keyboard.press("Escape");
      await tab.waitForTimeout(350);
      await tab.locator("#tip").hover();
      await tab.waitForTimeout(450);
      ok(
        await tab.locator(".z-tooltip").evaluate((el, x) => el.textContent === x && el.children.length === 0, XSS),
        "tooltip: el texto no es literal",
      );
      await tab.mouse.move(2, 2);
      await tab.locator("#combo input").click();
      await tab.locator("#combo input").fill("zzzz");
      await tab.waitForTimeout(100);
      await tab.keyboard.press("Escape");
      await tab.locator("#pages .z-pagination__btn").last().click();
      await tab.evaluate(() => {
        zui.openPalette(document.querySelector("#pal"));
        const input = document.querySelector("#pal input");
        input.value = "qqqq";
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
      await tab.waitForTimeout(100);
      await tab.keyboard.press("Escape");
      await tab.waitForTimeout(350);
      await tab
        .locator("#up input")
        .setInputFiles([{ name: `<img src=x onerror="window.__xss=1">.txt`, mimeType: "text/plain", buffer: Buffer.from("x") }]);
      await tab.waitForTimeout(250);
      const state = await tab.evaluate(() => ({
        xss: window.__xss ?? 0,
        injected: document.querySelectorAll("img[src='x'], main script, svg[onload], [onerror]").length,
        toast: document.querySelector(".z-toast__title")?.textContent,
        option: document.querySelector("#combo-list .z-listbox__text")?.textContent,
        file: document.querySelector(".z-upload__file-name")?.textContent,
        calendarDays: document.querySelectorAll("#cal .z-calendar__day").length,
        pageLabel: document.querySelector("#pages [aria-current='page']")?.getAttribute("aria-label"),
      }));
      ok(state.xss === 0 && state.injected === 0, `se ejecutó o insertó marcado inyectado: ${JSON.stringify(state)}`);
      ok(state.toast === XSS && state.option === XSS, "toast u opción de combobox no conservan el texto literal");
      ok(state.file?.startsWith("<img"), "el nombre de archivo no se muestra como texto");
      ok(state.calendarDays >= 28, "Calendar con atributos basura no dibuja un mes válido");
      ok(state.pageLabel === XSS.replace("{page}", "2"), "data-page-label no llega como atributo literal");
      ok(problems.length === 0, problems.join(" | "));
    } finally {
      await tab.close();
    }
  });

  await test("seguridad: CSP estricta (script-src 'self', style-src 'self') y Trusted Types con la política zuix-zui", async () => {
    // Sin <z-icon>: el elemento de zicon escribe su SVG por su cuenta (otro paquete). Los iconos de zui/dom salen de iconSvg().
    writeFileSync(
      join(dir, "csp.js"),
      `import * as zui from "/zui/dist/zui.dom.js";
window.__csp = [];
document.addEventListener("securitypolicyviolation", (event) => window.__csp.push(event.violatedDirective + " " + (event.blockedURI || "") + " " + (event.sample || "")));
window.zui = zui;
zui.init();
zui.toast({ title: "Saved", description: "ok", duration: 0, action: { label: "Undo", onClick() {} } });
window.__confirm = zui.confirm({ title: "Sure?", description: "Really" });
zui.setComboboxOptions(document.querySelector("#combo"), [{ value: "a", label: "A" }]);
zui.setComboboxLoading(document.querySelector("#combo"), true);
window.__ready = true;`,
    );
    write(
      "csp.html",
      `<!doctype html><html lang="en" data-theme="dark" data-brand="dazlabs"><head>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; require-trusted-types-for 'script'; trusted-types zuix-zui">
${HEAD}<title>csp</title></head><body class="z-root z-canvas" data-z-dom><main>
<button id="open" data-z-open="#pop">Open</button><div id="pop" popover class="z-liquid z-popover" role="dialog" aria-label="Pop">Hi</div>
<div class="z-calendar" id="cal" data-value="2026-03-10"></div>
<div class="z-slider" id="slider" data-min="0" data-max="100" data-value="40" data-size="md"><span class="z-slider__track"><span class="z-slider__range"></span></span><span class="z-slider__thumb" aria-label="Volume"></span></div>
<div class="z-carousel" id="car" data-z-carousel data-effect="none" aria-label="Slides"><div>One</div><div>Two</div></div>
<span class="z-input z-combobox" id="combo" data-size="md"><input class="z-input__control" role="combobox" aria-label="City" aria-controls="combo-list" aria-expanded="false"><div id="combo-list" popover class="z-liquid z-listbox"><div class="z-listbox__viewport" role="listbox" aria-label="City"></div></div></span>
<span class="z-rating" data-interactive="true"><span class="z-rating__stars" role="radiogroup" aria-label="Rate"><button type="button" role="radio" class="z-rating__star" data-star="1" aria-checked="false" aria-label="1"></button><button type="button" role="radio" class="z-rating__star" data-star="2" aria-checked="false" aria-label="2"></button></span></span>
</main><script type="module" src="./csp.js"></script></body></html>`,
    );
    const { tab, problems } = await openPage("csp.html");
    try {
      ok(
        (await tab.locator("dialog.z-confirm .z-confirm__icon svg.z-icon").count()) === 1,
        "confirm() no dibuja su icono bajo Trusted Types",
      );
      await tab.keyboard.press("Escape");
      await tab.waitForTimeout(350);
      await tab.locator("#open").click();
      await tab.waitForTimeout(100);
      const placed = await tab.locator("#pop").evaluate((el) => el.matches(":popover-open") && el.style.left !== "");
      await tab.keyboard.press("Escape");
      await tab.locator("#slider .z-slider__thumb").focus();
      await tab.keyboard.press("ArrowRight");
      await tab.locator(".z-rating__star").nth(1).click();
      await tab.waitForTimeout(150);
      const state = await tab.evaluate(() => ({
        csp: window.__csp,
        tt: typeof window.trustedTypes !== "undefined",
        days: document.querySelectorAll("#cal .z-calendar__day").length,
        toast: document.querySelectorAll(".z-toast svg.z-icon").length,
        arrows: document.querySelectorAll("#car .z-carousel__arrow svg").length,
        slider: document.querySelector("#slider .z-slider__thumb").getAttribute("aria-valuenow"),
        thumbLeft: document.querySelector("#slider .z-slider__thumb").style.left,
        rating: document.querySelector(".z-rating__star[aria-checked='true']")?.dataset.star,
      }));
      ok(state.csp.length === 0, `violaciones de CSP: ${state.csp.join(" | ")}`);
      ok(placed && state.thumbLeft !== "", "con style-src 'self' la posición calculada (CSSOM) debe seguir aplicándose");
      ok(
        state.days >= 28 && state.toast === 1 && state.arrows === 2 && state.slider === "41" && state.rating === "2",
        `algo no se dibujó bajo CSP: ${JSON.stringify(state)}`,
      );
      ok(problems.length === 0, problems.join(" | "));
      if (!state.tt) throw new Unverifiable(`${browserName} no implementa Trusted Types: comprobada solo la CSP de script y estilo`);
    } finally {
      await tab.close();
    }
  });

  /* ---------- 3. Comportamiento corregido ---------- */

  await test("Tooltip (WCAG 1.4.13): el puntero pasa a la burbuja sin cerrarla, Escape la cierra, conserva aria-describedby y funciona dentro de un modal", async () => {
    write(
      "fix-tooltip.html",
      scratch(`
    <p id="help">Existing help</p>
    <button id="host" aria-describedby="help" data-z-tooltip="Copy the link" data-z-placement="bottom">Copy</button>
    <button id="open" data-z-open="#dlg" style="margin-left:200px">Open</button>
    <dialog id="dlg" class="z-liquid z-modal" aria-label="Dialog"><div class="z-modal__body"><button id="inner" data-z-tooltip="Inside">Inner</button><button data-z-close>Close</button></div></dialog>`),
    );
    const { tab, problems } = await openPage("fix-tooltip.html");
    try {
      await tab.locator("#host").hover();
      await tab.waitForTimeout(450);
      const tip = tab.locator('.z-tooltip[role="tooltip"]');
      ok((await tip.count()) === 1, "el tooltip no aparece en un control que ya tenía aria-describedby");
      ok(
        (await tab.locator("#host").getAttribute("aria-describedby")).split(" ").length === 2 &&
          (await tab.locator("#host").getAttribute("aria-describedby")).startsWith("help "),
        "aria-describedby debe conservar la descripción previa y añadir el tooltip",
      );
      const box = await tip.boundingBox();
      await tab.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 4 });
      await tab.waitForTimeout(400);
      ok((await tip.count()) === 1, "hoverable: la burbuja se cerró al pasar el puntero del disparador a ella");
      await tab.keyboard.press("Escape");
      ok((await tip.count()) === 0, "dismissible: Escape no cierra el tooltip");
      ok((await tab.locator("#host").getAttribute("aria-describedby")) === "help", "al cerrar debe quedar solo la descripción original");
      await tab.locator("#host").hover();
      await tab.waitForTimeout(450);
      await tab.mouse.move(600, 600);
      await tab.waitForTimeout(350);
      ok((await tip.count()) === 0, "al salir el puntero el tooltip debe cerrarse");
      await tab.locator("#open").click();
      await tab.waitForTimeout(300);
      await tab.locator("#inner").hover();
      await tab.waitForTimeout(450);
      ok(
        (await tab.locator("#dlg .z-tooltip").count()) === 1,
        "dentro de un modal el tooltip debe vivir en el diálogo (fuera queda inerte)",
      );
      await tab.keyboard.press("Escape");
      ok(
        (await tab.locator("#dlg").evaluate((d) => d.open)) === false || (await tab.locator(".z-tooltip").count()) === 0,
        "Escape con tooltip abierto",
      );
      ok(problems.length === 0, problems.join(" | "));
    } finally {
      await tab.close();
    }
  });

  await test("Toast: el cierre automático se pausa con el puntero o el foco (WCAG 2.2.1), F8 enfoca la región, Escape descarta y el foco vuelve", async () => {
    write(
      "fix-toast.html",
      scratch(
        `<button id="go">Go</button>`,
        `document.querySelector("#go").addEventListener("click", () => zui.toast({ title: "Saved", duration: 700, action: { label: "Undo", onClick() { window.__undo = true; } } }));`,
      ),
    );
    const { tab, problems } = await openPage("fix-toast.html");
    try {
      await tab.locator("#go").click();
      const toastEl = tab.locator(".z-toast");
      await toastEl.hover();
      await tab.waitForTimeout(1300);
      ok((await toastEl.count()) === 1, "con el puntero encima el aviso no debe cerrarse solo");
      await tab.mouse.move(2, 2);
      await tab.waitForTimeout(1300);
      ok((await toastEl.count()) === 0, "al salir el puntero el aviso debe cerrarse con el tiempo que quedaba");
      await tab.locator("#go").click();
      ok(
        (await tab.locator(".z-toast-viewport").getAttribute("aria-label")) === "Notifications (F8)",
        "la región de avisos no tiene nombre accesible",
      );
      await tab.keyboard.press("F8");
      ok(await tab.evaluate(() => document.activeElement?.classList.contains("z-toast")), "F8 no lleva el foco al aviso");
      await tab.waitForTimeout(1300);
      ok((await toastEl.count()) === 1, "con el foco dentro el aviso no debe cerrarse solo");
      await tab.keyboard.press("Escape");
      await tab.waitForTimeout(450);
      ok((await toastEl.count()) === 0, "Escape no descarta el aviso enfocado");
      ok(await tab.evaluate(() => document.activeElement?.id === "go"), "al descartar el aviso el foco no vuelve a donde estaba");
      ok(problems.length === 0, problems.join(" | "));
    } finally {
      await tab.close();
    }
  });

  await test("Diálogos: z:close también con dialog.close(), el velo exige pulsar y soltar en él, y un popover sigue a su disparador al desplazar", async () => {
    write(
      "fix-dialog.html",
      scratch(`
    <button id="open" data-z-open="#dlg">Open</button>
    <dialog id="dlg" class="z-liquid z-modal" data-size="md" aria-label="Dialog"><div class="z-modal__body"><p id="text">Some selectable text inside the dialog body.</p><button data-z-close>Close</button></div></dialog>
    <div style="height:1400px"></div>
    <button id="pop-open" aria-haspopup="dialog" data-z-open="#pop">Pop</button><div id="pop" popover class="z-liquid z-popover" role="dialog" aria-label="Pop">Popover</div>
    <div style="height:1400px"></div>`),
    );
    const { tab, problems } = await openPage("fix-dialog.html");
    try {
      await tab.locator("#open").click();
      await tab.waitForTimeout(300);
      // Arrastre que empieza dentro (selección de texto) y termina en el velo.
      const text = await tab.locator("#text").boundingBox();
      await tab.mouse.move(text.x + 10, text.y + 5);
      await tab.mouse.down();
      await tab.mouse.move(8, 8, { steps: 5 });
      await tab.mouse.up();
      await tab.waitForTimeout(350);
      ok(await tab.locator("#dlg").evaluate((d) => d.open), "soltar en el velo tras pulsar dentro del diálogo no debe cerrarlo");
      await tab.evaluate(() => {
        window.__events.length = 0;
        document.querySelector("#dlg").close("api");
      });
      await tab.waitForTimeout(100);
      const closed = await tab.evaluate(() => ({
        events: window.__events.filter((e) => e.type === "z:close"),
        state: document.querySelector("#dlg").dataset.state,
      }));
      ok(
        closed.events.length === 1 && closed.events[0].detail?.value === "api" && closed.state === "closed",
        `dialog.close() no deja data-state="closed" ni emite un único z:close: ${JSON.stringify(closed)}`,
      );
      await tab.locator("#open").click();
      await tab.waitForTimeout(300);
      await tab.evaluate(() => {
        window.__events.length = 0;
      });
      await tab.mouse.click(8, 8);
      await tab.waitForTimeout(400);
      ok(
        await tab.evaluate(() => !document.querySelector("#dlg").open && window.__events.filter((e) => e.type === "z:close").length === 1),
        "el clic en el velo debe cerrar y emitir un único z:close",
      );
      await tab.locator("#pop-open").scrollIntoViewIfNeeded();
      await tab.locator("#pop-open").click();
      await tab.waitForTimeout(100);
      const gap = () =>
        tab.evaluate(
          () =>
            document.querySelector("#pop").getBoundingClientRect().top - document.querySelector("#pop-open").getBoundingClientRect().bottom,
        );
      const before = await gap();
      await tab.evaluate(() => window.scrollBy(0, 160));
      await tab.waitForTimeout(150);
      ok(await tab.locator("#pop").evaluate((el) => el.matches(":popover-open")), "el popover se cerró al desplazar");
      ok(Math.abs((await gap()) - before) < 2, `el popover no sigue a su disparador al desplazar la página (${before} → ${await gap()})`);
      ok(problems.length === 0, problems.join(" | "));
    } finally {
      await tab.close();
    }
  });

  await test("Rating sin framework: clic y flechas rellenan las estrellas y emiten z:change; Accordion anidado y z:change; Checkbox ignora Intro", async () => {
    write(
      "fix-controls.html",
      scratch(`
    ${contract.Rating.examples[1].html.replace('class="z-rating"', 'class="z-rating" id="rating"')}
    <div class="z-accordion" id="outer" data-type="single">
      <div class="z-accordion__item" data-state="open" data-value="one"><h3 class="z-accordion__header"><button type="button" class="z-accordion__trigger" data-state="open" aria-expanded="true" aria-controls="c1" id="t1">One</button></h3>
        <div class="z-accordion__content" data-state="open" role="region" id="c1" aria-labelledby="t1">
          <div class="z-accordion" id="inner" data-type="single">
            <div class="z-accordion__item" data-state="closed" data-value="in-a"><h4 class="z-accordion__header"><button type="button" class="z-accordion__trigger" data-state="closed" aria-expanded="false" aria-controls="ca" id="ta">Inner A</button></h4><div class="z-accordion__content" data-state="closed" role="region" id="ca" aria-labelledby="ta" hidden>A</div></div>
          </div>
        </div></div>
      <div class="z-accordion__item" data-state="closed" data-value="two"><h3 class="z-accordion__header"><button type="button" class="z-accordion__trigger" data-state="closed" aria-expanded="false" aria-controls="c2" id="t2">Two</button></h3><div class="z-accordion__content" data-state="closed" role="region" id="c2" aria-labelledby="t2" hidden>Two</div></div>
    </div>
    <label class="z-check"><button type="button" role="checkbox" class="z-check__box" id="check" data-state="unchecked" aria-checked="false" aria-label="Agree"></button></label>`),
    );
    const { tab, problems } = await openPage("fix-controls.html");
    try {
      await tab.locator("#rating .z-rating__star").nth(2).click();
      let rating = await tab.evaluate(() => ({
        filled: document.querySelectorAll("#rating .z-rating__star[data-filled]").length,
        solid: document.querySelectorAll('#rating z-icon[variant="solid"]').length,
        checked: document.querySelector('#rating [aria-checked="true"]')?.dataset.star,
        tab: document.querySelectorAll('#rating .z-rating__star[tabindex="0"]').length,
        events: window.__events.filter((e) => e.type === "z:change" && e.id === "rating").map((e) => e.detail.value),
      }));
      ok(
        rating.filled === 3 && rating.solid === 3 && rating.checked === "3" && rating.tab === 1 && rating.events.join() === "3",
        `Rating tras clic en la tercera estrella: ${JSON.stringify(rating)}`,
      );
      await tab.keyboard.press("ArrowRight");
      rating = await tab.evaluate(() => ({
        filled: document.querySelectorAll("#rating .z-rating__star[data-filled]").length,
        focus: document.activeElement?.dataset.star,
      }));
      ok(rating.filled === 4 && rating.focus === "4", `Rating con flecha derecha: ${JSON.stringify(rating)}`);
      await tab.evaluate(() => {
        window.__events.length = 0;
      });
      await tab.locator("#ta").click();
      ok(
        await tab.evaluate(
          () =>
            document.querySelector("#t1").getAttribute("aria-expanded") === "true" &&
            document.querySelector("#ta").getAttribute("aria-expanded") === "true",
        ),
        "abrir una sección del acordeón interior cerró la del exterior",
      );
      await tab.locator("#t2").click();
      const acc = await tab.evaluate(() => ({
        inner: document.querySelector("#ta").getAttribute("aria-expanded"),
        one: document.querySelector("#t1").getAttribute("aria-expanded"),
        events: window.__events.filter((e) => e.type === "z:change").map((e) => `${e.id}:${e.detail.value.join("+")}`),
      }));
      ok(
        acc.one === "false" && acc.inner === "true" && acc.events.join() === "inner:in-a,outer:two",
        `acordeón anidado y z:change: ${JSON.stringify(acc)}`,
      );
      await tab.locator("#check").focus();
      await tab.keyboard.press("Enter");
      ok((await tab.locator("#check").getAttribute("aria-checked")) === "false", "Intro no debe marcar una casilla (APG checkbox)");
      await tab.keyboard.press("Space");
      ok((await tab.locator("#check").getAttribute("aria-checked")) === "true", "Espacio debe marcar la casilla");
      ok(problems.length === 0, problems.join(" | "));
    } finally {
      await tab.close();
    }
  });

  await test("RTL sin framework: flechas reflejadas en Tabs, Calendar, RadioGroup y Tree; el submenú abre hacia la izquierda", async () => {
    write(
      "fix-rtl.html",
      scratch(
        `
    ${contract.Tabs.examples[0].html}
    <div class="z-calendar" id="cal" data-value="2026-03-10" data-locale="en-US"></div>
    ${contract.Tree.examples[0].html}
    <div style="text-align:center">${contract.Menu.examples[0].html}</div>`,
        `document.documentElement.dir = "rtl";`,
      ),
    );
    const { tab, problems } = await openPage("fix-rtl.html");
    try {
      await tab.locator(".z-tabs__tab").first().focus();
      await tab.keyboard.press("ArrowLeft");
      ok(
        await tab.evaluate(
          () =>
            document.activeElement === document.querySelectorAll(".z-tabs__tab")[1] &&
            document.activeElement.getAttribute("aria-selected") === "true",
        ),
        "Tabs RTL: la flecha izquierda debe ir a la pestaña siguiente",
      );
      await tab.locator('#cal [data-date="2026-03-10"]').focus();
      await tab.keyboard.press("ArrowLeft");
      ok(
        await tab.evaluate(() => document.activeElement?.dataset.date === "2026-03-11"),
        "Calendar RTL: la flecha izquierda debe ir al día siguiente",
      );
      const day = (d) => tab.locator(`#cal [data-date="${d}"]`).evaluate((el) => el.getBoundingClientRect().left);
      ok((await day("2026-03-11")) < (await day("2026-03-10")), "Calendar RTL: el día siguiente debe quedar a la izquierda");
      const branch = await tab.locator('[role="treeitem"][aria-expanded="false"]').first().elementHandle();
      await branch.focus();
      await tab.keyboard.press("ArrowLeft");
      ok((await branch.getAttribute("aria-expanded")) === "true", "Tree RTL: la flecha izquierda debe expandir");
      await tab.keyboard.press("ArrowRight");
      ok((await branch.getAttribute("aria-expanded")) === "false", "Tree RTL: la flecha derecha debe plegar");
      await tab.locator("[data-z-open='#actions']").click();
      await tab.locator("[data-z-submenu]").first().focus();
      await tab.keyboard.press("ArrowLeft");
      await tab.waitForTimeout(150);
      const sub = await tab.evaluate(() => {
        const s = document.querySelector("#actions-share");
        return {
          open: s.matches(":popover-open"),
          left: s.getBoundingClientRect().right <= document.querySelector("#actions").getBoundingClientRect().left + 8,
        };
      });
      ok(sub.open && sub.left, `Menu RTL: el submenú debe abrirse con flecha izquierda y a la izquierda del menú (${JSON.stringify(sub)})`);
      ok(
        await tab.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1),
        "RTL: desbordamiento horizontal",
      );
      ok(problems.length === 0, problems.join(" | "));
    } finally {
      await tab.close();
    }
  });

  await test("OTPInput: Supr borra la casilla; Select, Combobox, DatePicker y Menu dentro de un Drawer y de un Popover", async () => {
    const select = contract.Select.examples[0].html;
    write(
      "fix-compose.html",
      scratch(`
    ${contract.OTPInput.examples[0].html}
    <button id="open" data-z-open="#drawer">Open drawer</button>
    <dialog id="drawer" class="z-liquid z-drawer" data-side="right" data-size="md" aria-label="Panel"><div class="z-drawer__body">${select}${contract.DatePicker.examples[0].html}<button id="m-open" aria-haspopup="menu" data-z-open="#m">Menu</button><div id="m" popover class="z-liquid z-menu" role="menu" aria-label="Actions"><button type="button" role="menuitem" class="z-menu__item" id="keep" data-keep-open>Pin</button><button type="button" role="menuitem" class="z-menu__item" id="pick">Pick</button></div><button data-z-close>Close</button></div></dialog>`),
    );
    const { tab, problems } = await openPage("fix-compose.html");
    try {
      const cells = tab.locator(".z-otp__cell");
      await cells.first().click();
      await tab.keyboard.type("123");
      await cells.nth(1).focus();
      await tab.keyboard.press("Delete");
      ok(
        (await tab.locator(".z-otp").getAttribute("data-value")) === "13",
        `Supr debe borrar el carácter de la casilla: ${await tab.locator(".z-otp").getAttribute("data-value")}`,
      );
      await tab.locator("#open").click();
      await tab.waitForTimeout(350);
      const control = tab.locator("#drawer .z-select:not(.z-datepicker) > .z-select__control");
      await control.click();
      await tab.waitForTimeout(100);
      const option = tab.locator("#drawer .z-listbox__option:not([data-disabled])").nth(1);
      ok(await option.isVisible(), "la lista del Select no se ve dentro del Drawer");
      const label = (await option.locator(".z-listbox__text").textContent()).trim();
      await option.click();
      ok(
        (await control.locator(".z-select__value").textContent()).trim() === label,
        "elegir con el puntero dentro del Drawer no cambia el valor",
      );
      await control.press("ArrowDown");
      await tab.keyboard.press("Escape");
      ok(await tab.locator("#drawer").evaluate((d) => d.open), "Escape en la lista del Select cerró el Drawer");
      const picker = tab.locator("#drawer .z-datepicker > .z-select__control");
      await picker.click();
      await tab.waitForTimeout(150);
      await tab.keyboard.press("ArrowRight");
      await tab.keyboard.press("Enter");
      await tab.waitForTimeout(150);
      ok(
        (await tab.locator("#drawer .z-datepicker").evaluate((el) => /^\d{4}-\d{2}-\d{2}$/.test(el.dataset.value ?? ""))) &&
          (await tab.locator("#drawer").evaluate((d) => d.open)),
        "DatePicker dentro del Drawer no elige con teclado",
      );
      await tab.locator("#m-open").click();
      await tab.locator("#keep").click();
      ok(await tab.locator("#m").evaluate((el) => el.matches(":popover-open")), "data-keep-open: el menú no debe cerrarse al elegir");
      await tab.locator("#pick").click();
      ok(
        (await tab.locator("#m").evaluate((el) => !el.matches(":popover-open"))) && (await tab.locator("#drawer").evaluate((d) => d.open)),
        "elegir en el menú debe cerrar solo el menú, no el Drawer",
      );
      ok(problems.length === 0, problems.join(" | "));
    } finally {
      await tab.close();
    }
  });
}
