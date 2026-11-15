// Casos de colecciones sin framework: CommandPalette, Tree, DataTable, Pagination y Carousel.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");

export default async function ({ page, test, ok, card, settle, shots, browserName }) {
// Eventos z:* recibidos en el documento, para comprobar lo que emite cada componente.
await page.evaluate(() => {
  window.__z = [];
  for (const name of ["z:select", "z:change", "z:sort"]) document.addEventListener(name, (e) => window.__z.push({ name, detail: e.detail, from: e.target.id || e.target.className }));
});
const events = (name) => page.evaluate((n) => window.__z.filter((e) => e.name === n), name);
const clearEvents = () => page.evaluate(() => { window.__z.length = 0; });
const dom = () => page.evaluateHandle(() => import("/zui/dist/zui.dom.js"));
const until = async (fn, arg, msg) => { try { await page.waitForFunction(fn, arg, { timeout: 4000 }); } catch { throw new Error(msg); } };
const mod = browserName === "webkit" ? "Meta" : "Control";

/* ---------- CommandPalette ---------- */
const palette = page.locator("#commands");
const active = () => palette.locator('.z-palette__item[aria-selected="true"]');
const shown = () => palette.locator(".z-palette__item:not([hidden])").allTextContents().then((list) => list.map((t) => t.replace(/\s+/g, " ").trim()));

await test("CommandPalette: el botón abre, flechas, filtro por texto y keywords, vacío, Escape devuelve el foco", async () => {
  const trigger = card("CommandPalette").locator("[data-z-open]");
  await trigger.click(); await settle();
  ok(await palette.evaluate((d) => d.open && d.matches(":modal")), "no abrió como modal");
  ok(await page.evaluate(() => document.activeElement?.classList.contains("z-palette__input")), "el foco no está en el campo");
  ok((await active().getAttribute("data-value")) === "home", "el primer comando no está activo");
  ok(await palette.locator(".z-palette__input").getAttribute("aria-activedescendant") === "commands-home", "aria-activedescendant");
  const box = await palette.boundingBox();
  ok(Math.abs(box.width - 620) < 2 && Math.abs(box.y - 120) < 2 && Math.abs(box.x + box.width / 2 - 720) < 2, `posición o tamaño: ${JSON.stringify(box)}`);
  await page.screenshot({ path: join(shots, "palette.png") });

  await page.keyboard.press("ArrowDown");
  ok((await active().getAttribute("data-value")) === "settings", "ArrowDown");
  await page.keyboard.press("End");
  ok((await active().getAttribute("data-value")) === "invite", "End");
  await page.keyboard.press("ArrowDown");
  ok((await active().getAttribute("data-value")) === "invite", "ArrowDown no debe pasar del último");
  await page.keyboard.press("ArrowUp");
  ok((await active().getAttribute("data-value")) === "new", "ArrowUp");
  await page.keyboard.press("Home");
  ok((await active().getAttribute("data-value")) === "home", "Home");

  await page.keyboard.type("sett");
  ok((await shown()).join("|") === "Open settings /settings", `filtro por texto: ${await shown()}`);
  ok(await palette.locator(".z-palette__group:not([hidden])").count() === 1, "el grupo sin resultados sigue visible");
  ok((await active().getAttribute("data-value")) === "settings", "el primer resultado no quedó activo");
  await palette.locator(".z-palette__input").fill("create");
  ok((await shown()).join("|") === "New project", `filtro por keywords: ${await shown()}`);
  await palette.locator(".z-palette__input").fill("open");
  ok((await shown()).length === 2 && await palette.locator('.z-palette__item[aria-disabled="true"]:not([hidden])').count() === 1, `filtro "open": ${await shown()}`);
  await palette.locator(".z-palette__input").fill("zzz");
  ok(await palette.locator(".z-palette__empty").evaluate((el) => !el.hidden && el.offsetHeight > 0 && el.textContent === "No results"), "sin estado vacío");
  ok(await active().count() === 0 && !(await palette.locator(".z-palette__input").getAttribute("aria-activedescendant")), "queda un comando activo sin resultados");
  await page.screenshot({ path: join(shots, "palette-empty.png") });

  await page.keyboard.press("Escape"); await settle();
  ok(await palette.evaluate((d) => !d.open), "Escape no cerró");
  ok(await trigger.evaluate((el) => el === document.activeElement), "no devolvió el foco");
});

await test("CommandPalette: atajo Ctrl/Cmd K, Enter emite z:select, deshabilitado, puntero y velo", async () => {
  await clearEvents();
  await card("Button").locator(".z-btn").first().focus();
  await page.keyboard.press(`${mod}+k`); await settle();
  ok(await palette.evaluate((d) => d.open), "el atajo no abrió");
  ok(await palette.locator(".z-palette__input").inputValue() === "" && (await shown()).length === 5, "no empezó limpia");
  ok(await palette.locator(".z-palette__empty").evaluate((el) => el.hidden), "el estado vacío sigue visible");

  // Comando deshabilitado: ni se ejecuta ni cierra.
  await page.keyboard.press("ArrowDown"); await page.keyboard.press("ArrowDown");
  ok((await active().getAttribute("data-value")) === "billing", "no llegó al deshabilitado");
  await page.keyboard.press("Enter"); await settle();
  ok(await palette.evaluate((d) => d.open) && (await events("z:select")).length === 0, "ejecutó un comando deshabilitado");
  await palette.locator('[data-value="billing"]').click({ force: true }); await settle();
  ok(await palette.evaluate((d) => d.open) && (await events("z:select")).length === 0, "el clic ejecutó un comando deshabilitado");

  // Puntero: mover activa; clic ejecuta.
  await palette.locator('[data-value="invite"]').hover();
  ok((await active().getAttribute("data-value")) === "invite", "el puntero no activó el comando");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Enter"); await settle();
  ok(await palette.evaluate((d) => !d.open), "Enter no cerró");
  const selected = await events("z:select");
  ok(selected.length === 1 && selected[0].detail.value === "new", `z:select: ${JSON.stringify(selected)}`);
  ok(await card("Button").locator(".z-btn").first().evaluate((el) => el === document.activeElement), "el foco no volvió a donde estaba");
  ok(await page.locator(".z-toast").count() === 1, "el manejador de z:select no se ejecutó");
  await page.locator(".z-toast__close").click(); await page.waitForTimeout(400);

  await page.keyboard.press(`${mod}+k`); await settle();
  await palette.locator('[data-value="home"]').click(); await settle();
  ok(await palette.evaluate((d) => !d.open) && (await events("z:select")).at(-1).detail.value === "home", "el clic no ejecutó el comando");
  await page.locator(".z-toast__close").click(); await page.waitForTimeout(400);

  await page.keyboard.press(`${mod}+k`); await settle();
  await page.mouse.click(20, 600); await settle();
  ok(await palette.evaluate((d) => !d.open), "el velo no cerró");
  await page.keyboard.press(`${mod}+k`); await settle();
  await page.keyboard.press(`${mod}+k`); await settle();
  ok(await palette.evaluate((d) => !d.open), "el atajo no alternó");
});

await test("CommandPalette: openPalette() abre limpia", async () => {
  await palette.evaluate((d) => { d.querySelector(".z-palette__input").value = "old"; });
  await (await dom()).evaluate((m) => m.openPalette(document.querySelector("#commands"))); await settle();
  ok(await palette.evaluate((d) => d.open) && await palette.locator(".z-palette__input").inputValue() === "", "no abrió limpia");
  ok((await active().getAttribute("data-value")) === "home", "sin comando activo");
  await page.keyboard.press("Escape"); await settle();
  ok(await palette.evaluate((d) => !d.open), "no cerró");
});

/* ---------- Tree ---------- */
await test("Tree: clic expande, pliega y selecciona; z:change; rama deshabilitada", async () => {
  await clearEvents();
  const tree = card("Tree").locator(".z-tree");
  const node = (value) => tree.locator(`[data-value="${value}"]`);
  const row = (value) => node(value).locator("> .z-tree__row");
  ok(await node("src/styles").locator("> .z-tree__group").evaluate((el) => el.hidden && el.offsetHeight === 0), "la rama plegada se ve");
  await row("src/styles").click();
  ok(await node("src/styles").getAttribute("aria-expanded") === "true" && await node("src/styles/base.css").isVisible(), "no expandió");
  ok(await row("src/styles").locator(".z-tree__toggle").getAttribute("data-state") === "open", "el indicador no giró");
  ok(await node("src/styles").getAttribute("aria-selected") === "true", "no seleccionó");
  let last = (await events("z:change")).at(-1);
  ok(last?.detail.value === "src/styles" && last.detail.expanded.join() === "src,src/styles", `z:change: ${JSON.stringify(last)}`);
  await row("src/app.tsx").click();
  ok(await tree.locator('[aria-selected="true"]').count() === 1 && await node("src/app.tsx").getAttribute("aria-selected") === "true", "selección única");
  ok(await tree.locator('[role="treeitem"][tabindex="0"]').count() === 1 && await node("src/app.tsx").getAttribute("tabindex") === "0", "foco itinerante");
  await row("src/styles").click();
  ok(await node("src/styles").getAttribute("aria-expanded") === "false" && await node("src/styles/base.css").isHidden(), "no plegó");
  const before = (await events("z:change")).length;
  await row("docs").click();
  ok(await node("docs").getAttribute("aria-expanded") === "false" && (await events("z:change")).length === before, "una rama deshabilitada respondió");
  await card("Tree").screenshot({ path: join(shots, "tree.png") });
});

await test("Tree: flechas, Home/End, letra, Enter y Espacio", async () => {
  const tree = card("Tree").locator(".z-tree");
  const focused = () => page.evaluate(() => document.activeElement?.getAttribute("data-value"));
  await tree.locator('[data-value="src/index.ts"] > .z-tree__row').click();
  await page.keyboard.press("Home");
  ok(await focused() === "src", `Home: ${await focused()}`);
  await page.keyboard.press("ArrowLeft");
  ok(await tree.locator('[data-value="src"]').getAttribute("aria-expanded") === "false" && await focused() === "src", "ArrowLeft no plegó");
  await page.keyboard.press("ArrowDown");
  ok(await focused() === "docs", `ArrowDown salta los ocultos: ${await focused()}`);
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowRight");
  ok(await tree.locator('[data-value="src"]').getAttribute("aria-expanded") === "true" && await focused() === "src", "ArrowRight no expandió");
  await page.keyboard.press("ArrowRight");
  ok(await focused() === "src/index.ts", `ArrowRight no entró: ${await focused()}`);
  await page.keyboard.press("ArrowDown"); await page.keyboard.press("ArrowDown");
  ok(await focused() === "src/styles", `ArrowDown: ${await focused()}`);
  await page.keyboard.press("Enter");
  ok(await tree.locator('[data-value="src/styles"]').getAttribute("aria-expanded") === "true" && await tree.locator('[data-value="src/styles"]').getAttribute("aria-selected") === "true", "Enter no activó");
  await page.keyboard.press("t");
  ok(await focused() === "src/styles/theme.css", `letra: ${await focused()}`);
  await page.keyboard.press("ArrowLeft");
  ok(await focused() === "src/styles", `ArrowLeft no subió al padre: ${await focused()}`);
  await page.keyboard.press("End");
  ok(await focused() === "README.md", `End: ${await focused()}`);
  await page.keyboard.press(" ");
  ok(await tree.locator('[data-value="README.md"]').getAttribute("aria-selected") === "true", "Espacio no seleccionó");
  await page.keyboard.press("a");
  ok(await focused() === "src/app.tsx", `letra con vuelta: ${await focused()}`);
  ok(await tree.locator('[role="treeitem"][tabindex="0"]').count() === 1, "más de un nodo tabulable");
  const ring = await tree.locator('[data-value="src/app.tsx"] > .z-tree__row').evaluate((el) => getComputedStyle(el).boxShadow);
  ok(ring !== "none", "sin foco visible con teclado");
});

/* ---------- DataTable ---------- */
await test("DataTable: ordena por número, fecha y texto; ciclo asc, desc, sin orden; z:sort", async () => {
  await clearEvents();
  const table = card("DataTable").locator("table");
  const names = () => table.locator("tbody tr td:first-child").allTextContents();
  const head = (key) => table.locator(`th[data-key="${key}"]`);
  ok(await head("name").locator("svg").evaluate((el) => getComputedStyle(el).opacity) === "1", "el icono de la columna activa no se ve");
  ok(await head("seats").locator("svg").evaluate((el) => getComputedStyle(el).opacity) === "0", "el icono de una columna inactiva se ve");
  await card("DataTable").screenshot({ path: join(shots, "datatable.png") });

  await head("seats").locator(".z-table__sort").click();
  ok((await names()).join() === "Mia Chen,Ana Ruiz,Zoe Katz,Leo Park", `números ascendente: ${await names()}`);
  ok(await head("seats").getAttribute("aria-sort") === "ascending" && await head("name").getAttribute("aria-sort") === "none", "aria-sort");
  ok(await head("seats").locator(".z-table__sort").getAttribute("data-active") !== null && await head("name").locator(".z-table__sort").getAttribute("data-active") === null, "data-active");
  await head("seats").locator(".z-table__sort").click();
  ok((await names()).join() === "Leo Park,Zoe Katz,Ana Ruiz,Mia Chen", `números descendente: ${await names()}`);
  ok(await head("seats").locator("svg").getAttribute("data-icon") === "arrow-down", "el icono no cambió a flecha abajo");
  await head("seats").locator(".z-table__sort").click();
  ok((await names()).join() === "Ana Ruiz,Leo Park,Mia Chen,Zoe Katz" && await head("seats").getAttribute("aria-sort") === "none", `sin orden: ${await names()}`);
  ok(await head("seats").locator("svg").getAttribute("data-icon") === "arrow-up", "el icono no volvió");

  // Teclado: la cabecera es un botón.
  await head("joined").locator(".z-table__sort").focus();
  await page.keyboard.press("Enter");
  ok((await names()).join() === "Mia Chen,Ana Ruiz,Zoe Katz,Leo Park", `fechas ascendente: ${await names()}`);
  await page.keyboard.press(" ");
  ok((await names()).join() === "Leo Park,Zoe Katz,Ana Ruiz,Mia Chen", `fechas descendente: ${await names()}`);
  await head("name").locator(".z-table__sort").click();
  await head("name").locator(".z-table__sort").click();
  ok((await names()).join() === "Zoe Katz,Mia Chen,Leo Park,Ana Ruiz", `texto descendente: ${await names()}`);
  const sorts = await events("z:sort");
  ok(sorts.length === 7 && JSON.stringify(sorts[0].detail) === '{"key":"seats","direction":"asc","column":1}' && sorts[2].detail.direction === null && sorts.at(-1).detail.key === "name", `z:sort: ${JSON.stringify(sorts.map((s) => s.detail))}`);
  await card("DataTable").screenshot({ path: join(shots, "datatable-sorted.png") });
});

/* ---------- Pagination ---------- */
await test("Pagination: clic y teclado cambian de página, recalculan el rango y emiten z:change", async () => {
  await clearEvents();
  const nav = card("Pagination").locator(".z-pagination");
  const range = () => nav.evaluate((el) => [...el.children].slice(1, -1).map((c) => (c.classList.contains("z-pagination__gap") ? "…" : c.textContent.trim() + (c.getAttribute("aria-current") === "page" ? "*" : ""))).join(" "));
  const prev = nav.locator('[aria-label="Previous page"]');
  const next = nav.locator('[aria-label="Next page"]');
  ok(await range() === "1* 2 3 4 5 … 20" && await prev.isDisabled(), `inicial: ${await range()}`);
  await nav.locator('[aria-label="Page 3"]').click();
  ok(await range() === "1 2 3* 4 5 … 20", `página 3: ${await range()}`);
  ok(await nav.locator('[aria-label="Page 3"]').evaluate((el) => el === document.activeElement), "el botón pulsado perdió el foco");
  ok(await prev.isEnabled(), "anterior sigue deshabilitado");
  await nav.locator('[aria-label="Page 5"]').click();
  ok(await range() === "1 … 4 5* 6 … 20", `página 5: ${await range()}`);
  ok(await nav.locator('[aria-label="Page 5"]').evaluate((el) => el === document.activeElement), "el foco no siguió a la página");
  ok(await nav.locator(".z-pagination__gap").count() === 2 && await nav.locator('[aria-label="Page 6"]').evaluate((el) => el.type === "button" && !el.hasAttribute("aria-current")), "marcado de las páginas nuevas");
  await card("Pagination").screenshot({ path: join(shots, "pagination.png") });
  await next.click();
  ok(await range() === "1 … 5 6* 7 … 20", `siguiente: ${await range()}`);
  // Teclado.
  await prev.focus();
  await page.keyboard.press("Enter");
  ok(await range() === "1 … 4 5* 6 … 20", `anterior con Enter: ${await range()}`);
  await page.keyboard.press("Tab"); await page.keyboard.press("Tab"); await page.keyboard.press("Tab"); await page.keyboard.press("Tab"); await page.keyboard.press("Tab");
  ok(await nav.locator('[aria-label="Page 20"]').evaluate((el) => el === document.activeElement), "orden de tabulación");
  await page.keyboard.press(" ");
  ok(await range() === "1 … 16 17 18 19 20*" && await next.isDisabled(), `última: ${await range()}`);
  const changes = (await events("z:change")).filter((e) => e.from === "z-pagination").map((e) => e.detail.value);
  ok(changes.join() === "3,5,6,5,20", `z:change: ${changes}`);
  await (await dom()).evaluate((m) => m.setPage(document.querySelector('[data-component="Pagination"] .z-pagination'), 1));
  ok(await range() === "1* 2 3 4 5 … 20" && await prev.isDisabled() && await next.isEnabled(), `setPage(1): ${await range()}`);
});

/* ---------- Carousel ---------- */
const lens = "#projects";
const state = (sel) => page.evaluate((s) => {
  const el = document.querySelector(s);
  const slide = el.querySelector(".z-carousel__slide[data-active]");
  const vp = el.querySelector(".z-carousel__viewport").getBoundingClientRect();
  const r = slide?.getBoundingClientRect();
  return {
    index: slide ? Number(slide.dataset.index) : -1,
    offset: r ? Math.round(r.left + r.width / 2 - (vp.left + vp.width / 2)) : null,
    counter: el.querySelector(".z-carousel__counter").textContent,
    live: el.querySelector(".z-carousel__live").textContent,
    mode: el.dataset.mode,
  };
}, sel);
const atRest = (sel, index) => until(([s, i]) => {
  const el = document.querySelector(s);
  const slide = el.querySelector(".z-carousel__slide[data-active]");
  if (!slide || Number(slide.dataset.index) !== i) return false;
  const vp = el.querySelector(".z-carousel__viewport").getBoundingClientRect();
  const r = slide.getBoundingClientRect();
  return Math.abs(r.left + r.width / 2 - (vp.left + vp.width / 2)) < 2 && !el.querySelector(".z-carousel__viewport").hasAttribute("data-dragging");
}, [sel, index], `el slide ${index} no quedó centrado en ${sel}`);
// Espera a que la tira se detenga y devuelve el slide centrado.
const settled = async (sel) => {
  let last = null;
  for (let i = 0; i < 60; i++) {
    await page.waitForTimeout(100);
    const s = await state(sel);
    if (last && s.index === last.index && s.offset === last.offset && Math.abs(s.offset) < 2) return s.index;
    last = s;
  }
  throw new Error(`la tira de ${sel} no se detuvo: ${JSON.stringify(last)}`);
};
const drag = async (sel, dx, { steps = 8, pause = 12 } = {}) => {
  await page.locator(`${sel} .z-carousel__viewport`).evaluate((el) => el.scrollIntoView({ block: "center" }));
  const box = await page.locator(`${sel} .z-carousel__viewport`).boundingBox();
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) { await page.mouse.move(x + (dx * i) / steps, y); await page.waitForTimeout(pause); }
  const dragging = await page.locator(`${sel} .z-carousel__viewport`).evaluate((el) => el.hasAttribute("data-dragging"));
  await page.mouse.up();
  return dragging;
};

await test("Carousel: monta el marcado del contrato desde los hijos", async () => {
  const info = await page.evaluate((s) => {
    const el = document.querySelector(s);
    const track = el.querySelector(":scope > .z-carousel__viewport > .z-carousel__stage > .z-carousel__track");
    const slides = [...(track?.children ?? [])];
    const mains = slides.filter((x) => !x.hasAttribute("aria-hidden"));
    const clones = slides.filter((x) => x.hasAttribute("aria-hidden"));
    const arrows = [...el.querySelectorAll(":scope > .z-carousel__controls > .z-carousel__arrow")];
    return {
      role: el.getAttribute("role") + "/" + el.getAttribute("aria-roledescription"),
      mains: mains.length, clones: clones.length,
      slideOk: mains.every((x, i) => x.classList.contains("z-carousel__slide") && x.getAttribute("role") === "group" && x.getAttribute("aria-roledescription") === "slide" && x.getAttribute("aria-label") === `Slide ${i + 1} of 6` && x.firstElementChild.classList.contains("z-card")),
      clonesOk: clones.every((x) => x.inert && !x.hasAttribute("role") && !x.querySelector("[id]")),
      copies: new Set(slides.map((x) => x.dataset.copy)).size,
      arrows: arrows.map((a) => a.getAttribute("aria-label") + ":" + a.disabled + ":" + !!a.querySelector("svg.z-icon path")).join(),
      live: el.querySelector(":scope > .z-carousel__live")?.getAttribute("aria-live"),
      slideWidth: mains[0].getBoundingClientRect().height > 60 && getComputedStyle(mains[0]).overflow,
    };
  }, lens);
  ok(info.role === "region/carousel", `región: ${info.role}`);
  ok(info.mains === 6 && info.slideOk, `slides: ${JSON.stringify(info)}`);
  ok(info.clones >= 12 && info.clones % 6 === 0 && info.clonesOk && info.copies === info.clones / 6 + 1, `réplicas: ${JSON.stringify(info)}`);
  ok(info.arrows === "Previous slide:false:true,Next slide:false:true", `flechas: ${info.arrows}`);
  ok(info.live === "polite", "sin región viva");
  const s = await state(lens);
  ok(s.index === 0 && Math.abs(s.offset) < 2 && s.counter === "01/06" && s.mode === "css", `estado inicial: ${JSON.stringify(s)}`);
  await page.locator(lens).evaluate((el) => el.scrollIntoView({ block: "center" }));
  ok(await page.locator(`${lens} .z-carousel__slide[data-copy]:not([data-active])`).evaluateAll((list) => list.some((el) => el.style.transform.startsWith("matrix3d"))), "la lente no deforma los slides laterales");
  ok(await page.locator(`${lens} .z-carousel__slide[data-active]`).evaluate((el) => { const m = new DOMMatrix(getComputedStyle(el).transform); return Math.abs(m.a - 1) < 0.01 && Math.abs(m.b) < 0.01; }), "el slide centrado está deformado");
  await page.mouse.move(5, 5); await settle();
  await card("Carousel").screenshot({ path: join(shots, "carousel.png") });
});

await test("Carousel: flechas, contador, anuncios, bucle y teclado; z:change", async () => {
  await clearEvents();
  const next = page.locator(`${lens} .z-carousel__arrow[aria-label="Next slide"]`);
  const prev = page.locator(`${lens} .z-carousel__arrow[aria-label="Previous slide"]`);
  await next.click(); await atRest(lens, 1);
  let s = await state(lens);
  ok(s.counter === "02/06" && s.live === "Slide 2 of 6", `siguiente: ${JSON.stringify(s)}`);
  await prev.click(); await atRest(lens, 0);
  await prev.click(); await atRest(lens, 5);
  s = await state(lens);
  ok(s.counter === "06/06" && s.live === "Slide 6 of 6", `bucle hacia atrás: ${JSON.stringify(s)}`);
  await next.click(); await atRest(lens, 0);
  // Teclado sobre el carrusel.
  await next.focus();
  await page.keyboard.press("ArrowRight"); await atRest(lens, 1);
  await page.keyboard.press("ArrowRight"); await atRest(lens, 2);
  await page.keyboard.press("ArrowLeft"); await atRest(lens, 1);
  await page.keyboard.press("End"); await atRest(lens, 5);
  ok((await state(lens)).live === "Slide 6 of 6", "End no se anunció");
  await page.keyboard.press("Home"); await atRest(lens, 0);
  const changes = (await events("z:change")).filter((e) => e.from === "projects").map((e) => e.detail.index);
  ok(changes.length >= 8 && changes[0] === 1 && changes.at(-1) === 0, `z:change: ${changes}`);
  // El foco que entra en un slide lo centra.
  await page.locator(`${lens} .z-carousel__slide[data-copy][data-index="2"]:not([aria-hidden]) button`).focus();
  await atRest(lens, 2);
  await page.keyboard.press("Home"); await atRest(lens, 0);
});

await test("Carousel: arrastre real con inercia; no activa el botón del slide; clic simple sí", async () => {
  await page.evaluate((s) => {
    window.__opened = [];
    document.querySelector(s).addEventListener("click", (e) => { const b = e.target.closest("[data-project]"); if (b) window.__opened.push(b.dataset.project); });
  }, lens);
  const dragging = await drag(lens, -340);
  ok(dragging, "sin data-dragging durante el arrastre");
  await until((s) => document.querySelector(s + " .z-carousel__slide[data-active]")?.dataset.index !== "0", lens, "el arrastre no cambió de slide");
  const after = await settled(lens);
  ok(after >= 1 && after <= 3, `arrastre a la izquierda: slide ${after}`);
  ok((await page.evaluate(() => window.__opened)).length === 0, "el arrastre activó el botón del slide");
  // Arrastre lento y corto: vuelve al mismo slide.
  await drag(lens, -30, { steps: 6, pause: 40 });
  await atRest(lens, after);
  // Lanzamiento rápido en sentido contrario: la inercia lleva más allá de lo arrastrado.
  await drag(lens, 200, { steps: 3, pause: 8 });
  await page.waitForTimeout(150);
  await until(([s, a]) => { const i = Number(document.querySelector(s + " .z-carousel__slide[data-active]")?.dataset.index); return i !== a; }, [lens, after], "el lanzamiento no cambió de slide");
  const thrown = await settled(lens);
  ok(thrown !== after, "el lanzamiento volvió al mismo slide");
  // Clic simple en el botón del slide activo.
  await page.locator(`${lens} .z-carousel__slide[data-active] button`).click();
  ok((await page.evaluate(() => window.__opened)).length === 1, "el botón del slide activo no responde");
  // Clic en un slide lateral lo centra.
  const side = await page.locator(`${lens} .z-carousel__slide[data-active] + .z-carousel__slide`).evaluate((el) => { const r = el.getBoundingClientRect(); return { x: r.left + 20, y: r.top + r.height / 2, index: Number(el.dataset.index) }; });
  await page.mouse.click(side.x, side.y);
  await atRest(lens, side.index);
  await page.mouse.move(5, 5);
  await page.locator(`${lens} .z-carousel__arrow`).first().focus();
  await page.keyboard.press("Home"); await atRest(lens, 0);
});

await test("Carousel plano sin bucle: límites, arrastre y API carousel(el)", async () => {
  // Segundo ejemplo del contrato, insertado después de cargar: hydrate() lo activa.
  const flatHtml = JSON.parse(readFileSync(join(root, "zui/html.json"), "utf8")).components.Carousel.examples[1].html;
  const m = await dom();
  await m.evaluate((mod, html) => {
    const stage = document.querySelector('[data-component="Carousel"] .demo__stage');
    stage.insertAdjacentHTML("beforeend", html);
    window.__flatBefore = document.querySelector("#gallery").innerHTML;
    mod.hydrate(stage);
  }, flatHtml);
  const flat = "#gallery";
  await atRest(flat, 0);
  const prev = page.locator(`${flat} .z-carousel__arrow[aria-label="Previous slide"]`);
  const next = page.locator(`${flat} .z-carousel__arrow[aria-label="Next slide"]`);
  ok((await state(flat)).mode === "flat" && await page.locator(`${flat} .z-carousel__slide[aria-hidden]`).count() === 0, "modo plano sin réplicas");
  ok(await page.locator(`${flat} .z-carousel__slide`).evaluateAll((list) => list.every((el) => !el.style.transform && Math.round(el.getBoundingClientRect().width) === 240)), "slides deformados o sin el ancho pedido");
  ok(await prev.isDisabled() && await next.isEnabled(), "flechas en el primero");
  await next.click(); await atRest(flat, 1);
  ok(await prev.isEnabled(), "anterior no se habilitó");
  await next.focus();
  await page.keyboard.press("End"); await atRest(flat, 3);
  ok(await next.isDisabled() && (await state(flat)).counter === "04/04", "flechas en el último");
  // Arrastre más allá del final: resistencia y vuelta al último.
  await drag(flat, -300);
  await atRest(flat, 3);
  await drag(flat, 280);
  await until((s) => document.querySelector(s + " .z-carousel__slide[data-active]")?.dataset.index !== "3", flat, "el arrastre no retrocedió");
  const back = await settled(flat);
  ok(back < 3, `arrastre hacia atrás: slide ${back}`);
  await card("Carousel").screenshot({ path: join(shots, "carousel-flat.png") });

  // API imperativa.
  const api = await m.evaluateHandle((mod) => mod.carousel(document.querySelector("#gallery")));
  ok(await m.evaluate((mod, a) => mod.carousel(document.querySelector("#gallery")) === a, api), "carousel(el) no es idempotente");
  await api.evaluate((a) => a.goTo(0)); await atRest(flat, 0);
  await api.evaluate((a) => a.next()); await atRest(flat, 1);
  ok((await state(flat)).live === "Slide 2 of 4", "next() no se anunció");
  await api.evaluate((a) => a.prev()); await atRest(flat, 0);
  ok(await api.evaluate((a) => a.index) === 0, "index");
  await api.evaluate((a) => a.destroy());
  ok(await page.evaluate(() => document.querySelector("#gallery").innerHTML === window.__flatBefore), "destroy() no devolvió el marcado original");
  await page.evaluate(() => document.querySelector("#gallery").remove());
});

await test("Carousel con movimiento reducido: sin lente y navegación inmediata", async () => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  try {
    await until((s) => document.querySelector(s).dataset.mode === "flat", lens, "no pasó a modo plano");
    ok(await page.locator(`${lens} .z-carousel__slide`).evaluateAll((list) => list.every((el) => !el.style.transform)), "quedan slides deformados");
    // Sin muelle: la tira salta al destino en la misma tarea que el clic.
    const jump = await page.locator(lens).evaluate((el) => {
      const x = () => new DOMMatrix(el.querySelector(".z-carousel__track").style.transform).e;
      const slides = el.querySelectorAll(".z-carousel__slide:not([aria-hidden])");
      const before = x();
      el.querySelector('.z-carousel__arrow[aria-label="Next slide"]').click();
      return { moved: before - x(), period: slides[1].offsetLeft - slides[0].offsetLeft };
    });
    ok(jump.period > 100 && Math.abs(jump.moved - jump.period) < 2, `no fue inmediato: ${JSON.stringify(jump)}`);
    await atRest(lens, 1);
    ok((await state(lens)).live === "Slide 2 of 6", "sin anuncio");
    await page.locator(`${lens} .z-carousel__arrow[aria-label="Previous slide"]`).click();
  } finally {
    await page.emulateMedia({ reducedMotion: "no-preference" });
  }
  await until((s) => document.querySelector(s).dataset.mode === "css", lens, "no recuperó la lente");
  await atRest(lens, 0);
});
}
