// Sin React (0.5): DataTable como rejilla desde el contrato HTML (teclado, edición con validación y z:celledit,
// reordenar columnas, fijadas a los dos lados, grupos, árbol y detalle) y con 10 000 filas medidas; Select con
// búsqueda y Combobox/Listbox del servidor; Tree que se mueve con el puntero y el teclado y carga ramas; Tabs con menú
// «Más»; ConversationList, MemberList y TransferList por miles con la misma ventana virtual que React.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const contract = JSON.parse(readFileSync(join(here, "../../../zui/html.json"), "utf8")).components;
const example = (name, match) => contract[name].examples.find((e) => e.title.includes(match)).html;

export default async function ({ page, test, ok, note }) {
  /** Monta marcado en una capa fija con [data-z-dom] e hidrata; `events` se apuntan en window.__ev. */
  const mount = (html, events = [], width = 760) =>
    page.evaluate(
      async ([markup, types, w]) => {
        for (const old of document.querySelectorAll("[data-sc-layer]")) old.remove();
        const box = document.createElement("div");
        box.setAttribute("data-z-dom", "");
        box.setAttribute("data-sc-layer", "");
        box.innerHTML = markup;
        Object.assign(box.style, {
          position: "fixed",
          insetBlockStart: "0",
          insetInlineStart: "0",
          zIndex: "2147483000",
          inlineSize: `min(${w}px, 100vw)`,
          maxBlockSize: "100vh",
          overflow: "auto",
          padding: "16px",
          background: "Canvas",
        });
        document.querySelector(".page__main").append(box);
        window.__ev = [];
        for (const type of types) box.addEventListener(type, (event) => window.__ev.push([type, event.detail]));
        (await import("/zui/dist/zui.dom.js")).hydrate(box);
      },
      [html, events, width],
    );
  const box = () => page.locator("[data-sc-layer]");
  const events = () => page.evaluate(() => window.__ev.splice(0));
  const focused = () =>
    page.evaluate(() => {
      const el = document.activeElement;
      return { row: el?.closest("tr")?.dataset.rowKey ?? null, col: el?.closest("td, th")?.cellIndex ?? -1, tag: el?.tagName };
    });
  /** Espera una condición en la página; si no llega, el error dice cuál. */
  const until = async (fn, label, arg) => {
    try {
      await page.waitForFunction(fn, arg, { timeout: 8000 });
    } catch {
      throw new Error(`no llegó: ${label}`);
    }
  };
  const live = () => page.evaluate(() => [...document.querySelectorAll("[aria-live]")].map((n) => n.textContent).join(" | "));

  await test("Escala · DataTable sin React · rejilla: flechas, editar con validación, z:celledit cancelable, Escape y Tab", async () => {
    await mount(example("DataTable", "Rejilla editable"), ["z:celledit", "z:columnorder"]);
    const b = box();
    ok((await b.locator("tbody [tabindex='0']").count()) === 1, "una parada de Tab en el cuerpo");
    await b.locator("tbody [tabindex='0']").focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowDown");
    let f = await focused();
    ok(f.row === "b2" && f.col === 1, `flechas: ${JSON.stringify(f)}`);
    // Seats: número con mínimo y máximo de la cabecera.
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("F2");
    ok((await page.evaluate(() => document.activeElement?.className)).includes("z-table__input"), "F2 abre el campo");
    await page.keyboard.press("Control+a");
    await page.keyboard.type("99");
    await page.keyboard.press("Enter");
    ok((await b.locator(".z-table__error").textContent()) === "Must be at most 50", "máximo");
    ok((await b.locator(".z-table__input").getAttribute("aria-invalid")) === "true", "aria-invalid");
    // La aplicación cancela: el valor no se aplica.
    await page.evaluate(() => {
      document.querySelector("[data-sc-layer]").addEventListener(
        "z:celledit",
        (event) => {
          if (event.detail.value === "13") {
            event.preventDefault();
            event.detail.error = "13 seats are not sold";
          }
        },
        { once: true },
      );
    });
    await page.fill("[data-sc-layer] .z-table__input", "13");
    await page.keyboard.press("Enter");
    ok((await b.locator(".z-table__error").textContent()) === "13 seats are not sold", "cancelado con mensaje");
    await page.fill("[data-sc-layer] .z-table__input", "20");
    await page.keyboard.press("Enter");
    ok((await b.locator('tbody tr[data-row-key="b2"] td[data-col="seats"]').textContent()) === "20", "valor aplicado");
    f = await focused();
    ok(f.row === "b2" && f.tag === "TD", `vuelve a la celda: ${JSON.stringify(f)}`);
    let ev = await events();
    ok(
      ev.some(([t, d]) => t === "z:celledit" && d.key === "b2" && d.column === "seats" && d.value === "20"),
      `z:celledit: ${JSON.stringify(ev)}`,
    );
    // Una letra en Name empieza a editar; Escape no guarda; select con su etiqueta.
    await page.keyboard.press("Home");
    await page.keyboard.press("Q");
    ok((await page.inputValue("[data-sc-layer] .z-table__input")) === "Q", "la letra siembra el campo");
    await page.keyboard.press("Escape");
    ok((await b.locator('tbody tr[data-row-key="b2"] td[data-col="name"]').textContent()) === "Ben Okafor", "Escape no guarda");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Enter");
    await page.selectOption("[data-sc-layer] select.z-table__input", "admin");
    await page.keyboard.press("Enter");
    ok((await b.locator('tbody tr[data-row-key="b2"] td[data-col="role"]').textContent()) === "Admin", "select: escribe la etiqueta");
    // Reordenar con el teclado.
    await b.locator('.z-table__grip[data-col-key="role"]').focus();
    await page.keyboard.press("Space");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Space");
    ev = await events();
    const order = ev.find(([t]) => t === "z:columnorder")?.[1].value;
    ok(order?.join() === "seats,role", `z:columnorder: ${JSON.stringify(order)}`);
    const heads = await b.locator("thead th").evaluateAll((ths) => ths.map((th) => th.dataset.key));
    ok(heads.join() === "name,seats,role,joined", `cabecera movida: ${heads}`);
    const cells = await b.locator('tbody tr[data-row-key="a1"] td').evaluateAll((tds) => tds.map((td) => td.dataset.col));
    ok(cells.join() === "name,seats,role,joined", `celdas movidas: ${cells}`);
    await page.waitForFunction(() =>
      /Role dropped at position 2 of 2/.test([...document.querySelectorAll("[aria-live]")].map((n) => n.textContent).join(" ")),
    );
    const pins = await b
      .locator('tbody tr[data-row-key="a1"] td[data-pinned]')
      .evaluateAll((tds) => tds.map((td) => getComputedStyle(td).position));
    ok(pins.join() === "sticky,sticky", `fijadas a los dos lados: ${pins}`);
  });

  await test("Escala · DataTable sin React · grupos con agregados, árbol con →/← y fila de detalle", async () => {
    await mount(example("DataTable", "Agrupada con agregados"), ["z:expandchange", "z:detailchange"]);
    let b = box();
    const group = b.locator("tbody tr.z-table__group").first();
    await group.locator("td").first().focus();
    await page.keyboard.press("ArrowLeft");
    ok((await group.getAttribute("aria-expanded")) === "false", "← pliega");
    ok((await b.locator('tbody tr[aria-level="2"]:not([hidden])').count()) === 1, "oculta lo del grupo");
    await page.keyboard.press("ArrowRight");
    ok((await b.locator('tbody tr[aria-level="2"]:not([hidden])').count()) === 3, "→ abre");
    let ev = await events();
    ok(ev.filter(([t]) => t === "z:expandchange").length === 2, "z:expandchange");

    await mount(example("DataTable", "Datos en árbol"), ["z:expandchange", "z:detailchange"]);
    b = box();
    const src = b.locator('tbody tr[data-row-key="src"]');
    await src.locator(".z-table__toggle").click();
    ok((await src.getAttribute("aria-expanded")) === "false", "el botón pliega la rama");
    ok(await b.locator('tbody tr[data-row-key="src/app.ts"]').isHidden(), "hijos ocultos");
    await src.locator(".z-table__toggle").click();
    ok(!(await b.locator('tbody tr[data-row-key="src/app.ts"]').isHidden()), "hijos a la vista");
    // Detalle: abierto en el marcado, se cierra y se abre.
    const expand = b.locator('tbody tr[data-row-key="readme"] .z-table__expand');
    await expand.click();
    ok((await expand.getAttribute("aria-expanded")) === "false", "cierra el detalle");
    ok(await b.locator('tbody tr[data-detail-of="readme"]').isHidden(), "detalle oculto");
    await expand.click();
    ok(!(await b.locator('tbody tr[data-detail-of="readme"]').isHidden()), "detalle a la vista");
    ev = await events();
    ok(ev.filter(([t]) => t === "z:detailchange").length === 2, `z:detailchange: ${JSON.stringify(ev)}`);
  });

  await test("Escala · DataTable sin React · 10 000 filas del servidor: ventana virtual, orden, filtro y foco medidos", async () => {
    const build = (n) =>
      page.evaluate(async (count) => {
        for (const old of document.querySelectorAll("[data-sc-layer]")) old.remove();
        const rows = [];
        for (let i = 0; i < count; i++)
          rows.push(
            `<tr data-key="r${i}" data-row-key="r${i}"><td class="z-table__select"><button type="button" role="checkbox" class="z-check__box" aria-checked="false" aria-label="Select row ${i + 1}" data-state="unchecked"></button></td><td data-col="name">Item ${String(i + 1).padStart(5, "0")}</td><td data-col="team">${["North", "South", "East", "West", "Central"][i % 5]}</td><td data-col="value" data-align="end">${(i * 37) % 1000}</td></tr>`,
          );
        const html = `<div class="z-datatable" data-selected-label="{n} selected"><div class="z-table-wrap"><table class="z-table" data-grid data-density="comfortable"><thead><tr><th scope="col" class="z-table__select"><button type="button" role="checkbox" class="z-check__box" aria-checked="false" aria-label="Select all" data-select-all></button></th><th scope="col" data-key="name">Name</th><th scope="col" data-key="team">Team</th><th scope="col" data-key="value" data-sort="number" aria-sort="none"><button type="button" class="z-table__sort"><span>Value</span></button></th></tr><tr class="z-table__filters"><td class="z-table__select"></td><th scope="col"><input type="search" class="z-input__control z-table__filter" aria-label="Filter Name"></th><th scope="col"><input type="search" class="z-input__control z-table__filter" aria-label="Filter Team"></th><th scope="col"></th></tr></thead><tbody>${rows.join("")}</tbody></table></div><div class="z-datatable__bar"><span class="z-datatable__count" role="status" data-empty></span></div></div>`;
        const box = document.createElement("div");
        box.setAttribute("data-z-dom", "");
        box.setAttribute("data-sc-layer", "");
        Object.assign(box.style, {
          position: "fixed",
          insetBlockStart: "0",
          insetInlineStart: "0",
          zIndex: "2147483000",
          inlineSize: "760px",
          background: "Canvas",
          padding: "16px",
        });
        document.querySelector(".page__main").append(box);
        const dom = await import("/zui/dist/zui.dom.js");
        const start = performance.now();
        box.innerHTML = html;
        dom.hydrate(box);
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        const mount = performance.now() - start;
        const table = box.querySelector("table");
        const wrap = box.querySelector(".z-table-wrap");
        const inDoc = table.tBodies[0].rows.length;
        const frames = [];
        for (let i = 1; i <= 20; i++) {
          const s = performance.now();
          wrap.scrollTop = i * 4000;
          await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
          frames.push(performance.now() - s);
        }
        frames.sort((a, b) => a - b);
        const firstIndex = table.tBodies[0].querySelector("tr[data-vkey]")?.getAttribute("aria-rowindex");
        let s = performance.now();
        table.querySelector('th[data-key="value"] .z-table__sort').click();
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        const sort = performance.now() - s;
        wrap.scrollTop = 0;
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        const firstValue = table.tBodies[0].querySelector("tr[data-vkey] td[data-col='value']")?.textContent;
        s = performance.now();
        const filter = table.querySelector('input[aria-label="Filter Team"]');
        filter.value = "north";
        filter.dispatchEvent(new Event("input", { bubbles: true }));
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        const filtering = performance.now() - s;
        const shownAfterFilter = [...table.tBodies[0].querySelectorAll("tr[data-vkey] td[data-col='team']")].every(
          (td) => td.textContent === "North",
        );
        return {
          mount: Math.round(mount),
          inDoc,
          p50: Math.round(frames[10]),
          p95: Math.round(frames[18]),
          firstIndex,
          sort: Math.round(sort),
          firstValue,
          filtering: Math.round(filtering),
          shownAfterFilter,
          rowcount: table.getAttribute("aria-rowcount"),
        };
      }, n);
    // Referencia con 1 000 filas: con ventana virtual, desplazar cuesta lo mismo con 10 veces más.
    const small = await build(1000);
    const result = await build(10000);
    note(
      `10 000 filas sin React · montaje ${result.mount} ms · ${result.inDoc} filas en el documento · desplazamiento p50 ${result.p50} ms, p95 ${result.p95} ms (con 1 000: p50 ${small.p50} ms) · ordenar ${result.sort} ms · filtrar ${result.filtering} ms`,
    );
    ok(result.inDoc < 90, `ventana virtual: ${result.inDoc} filas en el documento`);
    ok(result.rowcount === "10002", `aria-rowcount: ${result.rowcount}`);
    ok(Number(result.firstIndex) > 1000, `aria-rowindex tras desplazar: ${result.firstIndex}`);
    ok(result.firstValue === "0", `ordena todas las filas (también las de fuera): ${result.firstValue}`);
    ok(result.shownAfterFilter, "filtra todas las filas");
    // Umbrales holgados para una máquina cargada; lo que se comprueba de verdad es que el coste no crece con las filas.
    ok(result.p50 <= small.p50 * 2 + 40, `desplazar no depende del número de filas: ${result.p50} ms frente a ${small.p50} ms`);
    ok(result.mount < 3000, `montaje < 3000 ms: ${result.mount}`);
    ok(result.sort < 1500, `ordenar < 1500 ms: ${result.sort}`);
    // Foco al reciclar: la fila enfocada sigue en el documento tras desplazar lejos.
    await page.locator("[data-sc-layer] tbody tr[data-vkey] td[data-col='name']").first().click();
    const row = await page.evaluate(() => document.activeElement?.closest("tr")?.dataset.rowKey);
    await page.evaluate(() => {
      document.querySelector("[data-sc-layer] .z-table-wrap").scrollTop += 30000;
    });
    await page.waitForTimeout(150);
    ok((await page.evaluate(() => document.activeElement?.closest("tr")?.dataset.rowKey)) === row, "el foco no sale del documento");
    await page.keyboard.press("ArrowDown");
    ok((await page.evaluate(() => document.activeElement?.closest("tr")?.dataset.rowKey)) !== row, "↓ desde la fila reciclada");
  });

  await test("Escala · Select con búsqueda y Combobox/Listbox del servidor sin React · antirrebote, cancelación, error y páginas", async () => {
    const options = Array.from(
      { length: 300 },
      (_, i) =>
        `<div class="z-listbox__option" role="option" data-value="o${i}" aria-selected="false"><span class="z-listbox__text">Option ${String(i + 1).padStart(3, "0")}</span></div>`,
    ).join("");
    await mount(
      `<span class="z-select" data-size="md" data-searchable data-placeholder="Pick"><button type="button" role="combobox" class="z-select__control" aria-haspopup="listbox" aria-expanded="false" aria-label="Option" aria-controls="sc-pop-list"><span class="z-select__value">Pick</span></button></span><div id="sc-pop" class="z-liquid z-listbox" popover="manual" data-size="md"><div id="sc-pop-list" role="listbox" class="z-listbox__viewport" aria-label="Option">${options}</div></div>
       <span class="z-input z-combobox" data-size="md"><input class="z-input__control" role="combobox" aria-label="City" aria-expanded="false" aria-controls="sc-combo-list" aria-autocomplete="list"><button type="button" class="z-input__action z-combobox__toggle" aria-label="Show options" tabindex="-1"></button></span><div id="sc-combo" class="z-liquid z-listbox" popover="manual" data-size="md"><div id="sc-combo-list" role="listbox" class="z-listbox__viewport"></div></div>`,
      ["z:change"],
    );
    ok((await page.locator("#sc-pop .z-listbox__viewport").getAttribute("data-deferred")) !== null, "lista larga: content-visibility");
    await page.click("[data-sc-layer] .z-select__control");
    ok(await page.evaluate(() => document.activeElement?.matches(".z-listbox__search input")), "el foco va a la búsqueda");
    await page.keyboard.type("29");
    const shown = await page.locator("#sc-pop .z-listbox__option:not([hidden])").allTextContents();
    ok(shown.length === 13 && shown.every((t) => t.includes("29")), `filtra: ${shown.join()}`);
    await page.keyboard.press("ArrowDown");
    const id = await page.getAttribute("#sc-pop .z-listbox__search input", "aria-activedescendant");
    ok(id && (await page.locator(`[id="${id}"]`).textContent()) === shown[1], "aria-activedescendant");
    await page.keyboard.press("Enter");
    const ev = await events();
    ok(
      ev.some(([t, d]) => t === "z:change" && d.value === "o128"),
      `elige la activa (Option 129): ${JSON.stringify(ev)}`,
    );

    // Combobox del servidor.
    await page.evaluate(async () => {
      const dom = await import("/zui/dist/zui.dom.js");
      window.__calls = [];
      let failed = false;
      dom.setComboboxLoader(
        document.querySelector("[data-sc-layer] .z-combobox"),
        (query, { signal, page }) =>
          new Promise((resolve, reject) => {
            window.__calls.push(`${query}#${page}`);
            const t = setTimeout(() => {
              if (query === "error" && !failed) {
                failed = true;
                reject(new Error("down"));
                return;
              }
              const all = Array.from({ length: 50 }, (_, i) => ({ value: `${query || "x"}-${i}`, label: `${query || "City"} ${i + 1}` }));
              resolve({ options: all.slice((page - 1) * 20, page * 20), hasMore: page * 20 < all.length });
            }, 120);
            signal.addEventListener("abort", () => {
              clearTimeout(t);
              reject(new DOMException("aborted", "AbortError"));
            });
          }),
        { debounce: 150 },
      );
    });
    await page.click("[data-sc-layer] .z-combobox input");
    await until(() => document.querySelectorAll("#sc-combo .z-listbox__option").length === 20, "paso 2");
    await page.keyboard.type("rome", { delay: 20 });
    await until(() => document.querySelector("#sc-combo .z-listbox__option .z-listbox__text")?.textContent === "rome 1", "paso 3");
    const calls = await page.evaluate(() => window.__calls.splice(0));
    ok(calls.join() === "#1,rome#1", `antirrebote: una petición por consulta final: ${calls}`);
    await page.evaluate(() => {
      const vp = document.querySelector("#sc-combo .z-listbox__viewport");
      vp.scrollTop = vp.scrollHeight;
    });
    await until(() => document.querySelectorAll("#sc-combo .z-listbox__option").length === 40, "paso 4");
    await page.fill("[data-sc-layer] .z-combobox input", "error");
    await until(() => document.querySelector("#sc-combo .z-listbox__empty[data-error]"), "paso 5");
    ok((await page.locator("#sc-combo [data-retry]").count()) === 1, "botón de reintentar");
    await page.keyboard.press("Enter");
    await until(() => document.querySelector("#sc-combo .z-listbox__option .z-listbox__text")?.textContent === "error 1", "paso 6");
    await page.keyboard.press("Escape");

    // Listbox del servidor.
    await mount(
      `<div class="z-listbox" data-inline data-size="md" data-orientation="vertical"><div role="listbox" class="z-listbox__viewport" aria-label="Remote" style="max-block-size: 200px"></div></div>`,
      ["z:change"],
    );
    await page.evaluate(async () => {
      const dom = await import("/zui/dist/zui.dom.js");
      dom.setListboxLoader(document.querySelector("[data-sc-layer] .z-listbox"), async (_q, { page }) => ({
        options: Array.from({ length: 30 }, (_, i) => ({ value: `v${(page - 1) * 30 + i}`, label: `Value ${(page - 1) * 30 + i + 1}` })),
        hasMore: page < 3,
      }));
    });
    await until(() => document.querySelectorAll("[data-sc-layer] .z-listbox__option").length === 30, "paso 7");
    await page.locator("[data-sc-layer] .z-listbox__option").first().focus();
    await page.keyboard.press("End");
    await until(() => document.querySelectorAll("[data-sc-layer] .z-listbox__option").length === 60, "paso 8");
  });

  await test("Escala · Tree sin React · mover con el teclado y con el puntero (z:move cancelable), anuncios y carga diferida", async () => {
    await mount(example("Tree", "Explorador"), ["z:move", "z:change"], 420);
    await page.evaluate(async () => {
      const tree = document.querySelector("[data-sc-layer] [role=tree]");
      tree.setAttribute("data-draggable", "");
      // Una rama más, de carga diferida.
      const lazy = document.createElement("li");
      lazy.setAttribute("role", "treeitem");
      lazy.className = "z-tree__item";
      lazy.dataset.value = "lazy";
      lazy.setAttribute("aria-expanded", "false");
      lazy.setAttribute("aria-level", "1");
      lazy.setAttribute("data-has-children", "");
      lazy.tabIndex = -1;
      lazy.innerHTML =
        '<div class="z-tree__row" style="--z-tree-level:0"><span class="z-tree__toggle" data-state="closed" aria-hidden="true"></span><span class="z-tree__label">lazy</span></div>';
      tree.append(lazy);
      const dom = await import("/zui/dist/zui.dom.js");
      dom.hydrate(tree.parentElement);
      dom.setTreeLoader(
        tree,
        (value) =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve([
                  { id: `${value}-a`, label: "a.md" },
                  { id: `${value}-b`, label: "b.md" },
                ]),
              100,
            ),
          ),
      );
    });
    const tree = "[data-sc-layer] [role=tree]";
    const items = () =>
      page.locator(`${tree} [role=treeitem]`).evaluateAll((els) => els.map((el) => `${el.dataset.value}:${el.getAttribute("aria-level")}`));
    // Carga diferida.
    await page.locator(`${tree} [data-value="lazy"] > .z-tree__row`).click();
    ok((await page.getAttribute(`${tree} [data-value="lazy"]`, "aria-busy")) === "true", "aria-busy");
    await until(() => document.querySelectorAll('[data-sc-layer] [data-value="lazy"] [role=treeitem]').length === 2, "paso 9");
    // Teclado: Ctrl+X coge, ↓ elige, Intro suelta.
    const first = (await items())[0].split(":")[0];
    await page.focus(`${tree} [data-value="${first}"]`);
    await page.locator(`${tree} [role=treeitem][tabindex="0"]`).focus();
    const start = await page.evaluate(() => document.activeElement.dataset.value);
    // Coge una hoja (la última de la primera rama).
    const leaf = await page.evaluate(
      () =>
        [...document.querySelectorAll("[data-sc-layer] [role=treeitem]")].find(
          (el) => !el.querySelector("[role=group]") && !el.hasAttribute("data-has-children"),
        )?.dataset.value,
    );
    await page.focus(`${tree} [data-value="${leaf}"]`);
    await page.keyboard.press("Control+x");
    ok((await page.getAttribute(`${tree} [data-value="${leaf}"]`, "data-grabbed")) === "", "cogido");
    await page.waitForFunction(() => /Moving /.test([...document.querySelectorAll("[aria-live]")].map((n) => n.textContent).join(" ")));
    await page.keyboard.press("ArrowDown");
    ok((await page.locator(`${tree} .z-tree__row[data-drop]`).count()) === 1, "marcador");
    await page.keyboard.press("Enter");
    const ev = await events();
    const move = ev.find(([t]) => t === "z:move");
    ok(move && move[1].value === leaf, `z:move: ${JSON.stringify(ev)}`);
    await page.waitForFunction(() => /moved/.test([...document.querySelectorAll("[aria-live]")].map((n) => n.textContent).join(" ")));
    ok(start !== undefined, "parada de Tab");
    // Cancelable: la aplicación lo impide y el marcado no cambia.
    await page.evaluate(() =>
      document.querySelector("[data-sc-layer]").addEventListener("z:move", (e) => e.preventDefault(), { once: true }),
    );
    const before = (await items()).join();
    const moved = await page.evaluate(async (id) => {
      const dom = await import("/zui/dist/zui.dom.js");
      return dom.moveTreeItem(document.querySelector("[data-sc-layer] [role=tree]"), { id, target: "lazy", position: "inside" });
    }, leaf);
    ok(!moved && (await items()).join() === before, "z:move cancelado");
    // Puntero: la hoja dentro de «lazy».
    const from = await page.locator(`${tree} [data-value="${leaf}"] > .z-tree__row`).boundingBox();
    const to = await page.locator(`${tree} [data-value="lazy"] > .z-tree__row`).boundingBox();
    await page.mouse.move(from.x + 30, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(to.x + 30, to.y + to.height / 2, { steps: 8 });
    await page.mouse.up();
    const after = await items();
    ok(
      after.includes(`${leaf}:2`) && (await page.locator(`${tree} [data-value="lazy"] [data-value="${leaf}"]`).count()) === 1,
      `dentro de lazy, nivel 2: ${after}`,
    );
  });

  await test("Escala · Tabs sin React · menú «Más»: botón fuera del tablist, entradas de las que no caben, la elegida vuelve a la tira", async () => {
    const tabs = [
      "Overview",
      "Activity",
      "Members",
      "Billing",
      "Security",
      "Integrations",
      "Webhooks",
      "Audit log",
      "Advanced",
      "Danger zone",
    ];
    const html = `<div class="z-tabs" data-orientation="horizontal" style="max-inline-size: 360px"><div role="tablist" class="z-tabs__list" data-variant="underline" data-size="md" data-orientation="horizontal" data-overflow="menu" aria-label="Sections">${tabs
      .map(
        (label, i) =>
          `<button type="button" role="tab" class="z-tabs__tab" data-value="t${i}" data-state="${i ? "inactive" : "active"}" aria-selected="${i === 0}" tabindex="${i ? -1 : 0}"><span class="z-tabs__label">${label}</span></button>`,
      )
      .join("")}</div></div>`;
    await mount(html, ["z:change"], 420);
    await until(() => !document.querySelector("[data-sc-layer] .z-tabs__more")?.hidden, "paso 10");
    ok((await page.locator("[data-sc-layer] [role=tablist] .z-tabs__more").count()) === 0, "fuera del tablist");
    await page.click("[data-sc-layer] .z-tabs__more");
    const shown = await page.locator("[data-sc-layer] .z-menu [role=menuitem]:not([hidden])").allTextContents();
    ok(shown.includes("Danger zone") && !shown.includes("Overview"), `entradas: ${shown}`);
    await page.locator("[data-sc-layer] .z-menu [role=menuitem]", { hasText: "Danger zone" }).click();
    const ev = await events();
    ok(
      ev.some(([t, d]) => t === "z:change" && d.value === "t9"),
      `z:change: ${JSON.stringify(ev)}`,
    );
    await until(() => document.activeElement?.dataset.value === "t9", "paso 11");
    const fits = await page.evaluate(() => {
      const tab = document.querySelector('[data-sc-layer] [data-value="t9"]');
      const list = tab.parentElement.getBoundingClientRect();
      const r = tab.getBoundingClientRect();
      return r.left >= list.left - 1 && r.right <= list.right + 1;
    });
    ok(fits, "la elegida cabe en la tira");
  });

  await test("Escala · ConversationList, MemberList y TransferList sin React · 1 000 entradas con la ventana virtual de core", async () => {
    const now = Date.parse("2026-11-19T10:00:00Z");
    const items = Array.from({ length: 1000 }, (_, i) => ({
      id: `c${i}`,
      title: `Chat ${i + 1}`,
      lastMessage: `Message ${i + 1}`,
      lastAt: now - i * 60000,
    }));
    const members = Array.from({ length: 1000 }, (_, i) => ({
      id: `m${i}`,
      name: `Member ${String(i + 1).padStart(4, "0")}`,
      email: `m${i}@example.com`,
      role: i % 2 ? "member" : "admin",
    }));
    const transfer = Array.from({ length: 1000 }, (_, i) => ({ value: `p${i}`, label: `Person ${i + 1}` }));
    await mount(
      `<div style="display:flex; flex-direction:column; block-size:520px"><div class="z-conversation-list" data-time-zone="UTC" data-now="${now}" style="flex:1; min-block-size:0"><script type="application/json" data-props>${JSON.stringify({ items })}</script></div></div>
       <div class="z-member-list" data-title="Team"><script type="application/json" data-props>${JSON.stringify({
         members,
         roles: [
           { id: "admin", label: "Admins" },
           { id: "member", label: "Members" },
         ],
       })}</script></div>
       <div class="z-transfer"><script type="application/json" data-props>${JSON.stringify({ items: transfer })}</script></div>`,
      ["z:select", "z:change"],
    );
    const b = box();
    ok((await b.locator(".z-conversation").count()) < 80, `ConversationList: ${await b.locator(".z-conversation").count()} pintadas`);
    ok((await b.locator(".z-member-list__row").count()) < 80, "MemberList: ventana virtual");
    ok((await b.locator(".z-transfer__option").count()) < 160, "TransferList: ventana virtual");
    await b.locator('.z-conversation[tabindex="0"]').focus();
    await page.keyboard.press("End");
    await until(() => document.activeElement?.closest("li")?.getAttribute("aria-posinset") === "1000", "paso 12");
    ok((await page.evaluate(() => document.activeElement?.closest("li")?.getAttribute("aria-setsize"))) === "1000", "aria-setsize");
    await page.keyboard.press("Enter");
    const ev = await events();
    ok(
      ev.some(([t, d]) => t === "z:select" && d.id === "c999"),
      `z:select: ${JSON.stringify(ev)}`,
    );
    await b.locator('.z-transfer__options[data-side="source"]').focus();
    await page.keyboard.press("End");
    const id = await b.locator('.z-transfer__options[data-side="source"]').getAttribute("aria-activedescendant");
    ok(id && (await page.locator(`[id="${id}"]`).getAttribute("aria-posinset")) === "1000", "TransferList: la activa está en el documento");
  });
}
