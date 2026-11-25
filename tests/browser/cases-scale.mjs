// Escala y rejilla (0.5) en el binding de React: DataTable como rejilla (teclado APG, edición con validación,
// reordenar, fijadas a los dos lados, grupos, árbol, detalle, rango con Mayús, locale de las fechas) y con 10 000
// filas medidas; listas largas y del servidor (Select, Combobox, Listbox, TransferList); Tree con arrastre, teclado y
// carga diferida; Tabs con menú «Más»; Command, ConversationList y MemberList por miles.
export default function ({ t, assert, poll, sleep }) {
  const active = (page) =>
    page.evaluate(() => {
      const el = document.activeElement;
      const td = el?.closest("td, th");
      return {
        tag: el?.tagName,
        row: el?.closest("tr")?.dataset.rowKey ?? null,
        col: td?.cellIndex ?? -1,
        text: (td ?? el)?.textContent?.trim(),
      };
    });
  const seriousAxe = async (axe, page, include) =>
    (await axe(page, { include })).filter((v) => v.impact === "serious" || v.impact === "critical");

  return [
    {
      name: "DataTable rejilla (React): flechas por celdas, F2 y letra editan, validación, Escape, Intro y Tab, fecha con locale",
      async run({ open, axe }) {
        const page = await open("data");
        const grid = t("g-edit");
        await page.locator(grid).scrollIntoViewIfNeeded();
        assert((await page.getAttribute(`${grid} table`, "role")) === "grid", "role=grid");
        // Fecha con el idioma de la tabla (es-ES), no con el del entorno.
        const joined = await page.locator(`${grid} tbody tr[data-row-key="ana"] td[data-col="joined"]`).textContent();
        assert(/mar.*2025/.test(joined), `fecha es-ES: ${joined}`);
        // Una sola parada de Tab en el cuerpo.
        const stops = await page.locator(`${grid} tbody [tabindex="0"]`).count();
        assert(stops === 1, `una parada de Tab en el cuerpo: ${stops}`);
        await page.locator(`${grid} tbody [tabindex="0"]`).focus();
        let a = await active(page);
        assert(a.row === "ana", `empieza en la primera fila: ${JSON.stringify(a)}`);
        await page.keyboard.press("ArrowRight");
        await page.keyboard.press("ArrowRight");
        a = await active(page);
        assert(a.row === "ana" && a.col === 2 && a.tag === "TD", `→→ a Role: ${JSON.stringify(a)}`);
        await page.keyboard.press("ArrowDown");
        a = await active(page);
        assert(a.row === "ben" && a.col === 2, `↓: ${JSON.stringify(a)}`);
        // F2 en Name (col 1): campo con el texto; Escape cancela y devuelve el foco a la celda.
        await page.keyboard.press("ArrowLeft");
        await page.keyboard.press("F2");
        await poll(
          async () => (await page.evaluate(() => document.activeElement?.className)).includes("z-table__input"),
          "F2 abre el editor",
        );
        assert((await page.inputValue(`${grid} .z-table__input`)) === "Ben Okafor", "valor inicial");
        await page.keyboard.type("x");
        await page.keyboard.press("Escape");
        await poll(async () => (await page.locator(`${grid} .z-table__input`).count()) === 0, "Escape cierra");
        a = await active(page);
        assert(a.row === "ben" && a.col === 1 && a.text === "Ben Okafor", `Escape no guarda y vuelve a la celda: ${JSON.stringify(a)}`);
        // Una letra empieza a editar con ella; vacío no vale (obligatorio).
        await page.keyboard.press("Z");
        await poll(async () => (await page.inputValue(`${grid} .z-table__input`).catch(() => "")) === "Z", "la letra siembra el campo");
        await page.keyboard.press("Backspace");
        await page.keyboard.press("Enter");
        await poll(
          async () => (await page.getAttribute(`${grid} .z-table__input`, "aria-invalid")) === "true",
          "obligatorio: aria-invalid",
        );
        const described = await page.getAttribute(`${grid} .z-table__input`, "aria-describedby");
        assert(described && (await page.locator(`[id="${described}"]`).textContent()) === "Required", "mensaje enlazado");
        // Rechazo de la aplicación (devuelve un mensaje): el editor sigue abierto.
        await page.keyboard.type("taken");
        await page.keyboard.press("Enter");
        await poll(
          async () =>
            (await page
              .locator(`${grid} .z-table__error`)
              .textContent()
              .catch(() => "")) === "That name is taken",
          "onCellEdit rechaza",
        );
        await page.fill(`${grid} .z-table__input`, "Bea Okafor");
        // Tab confirma y abre la siguiente editable (Role, un select).
        await page.keyboard.press("Tab");
        await poll(async () => (await page.locator(t("g-edit-last")).textContent()) === "ben.name=Bea Okafor", "Tab confirma");
        await poll(
          async () => (await page.evaluate(() => document.activeElement?.tagName)) === "SELECT",
          "Tab abre la siguiente celda editable",
        );
        await page.selectOption(`${grid} select.z-table__input`, "admin");
        await page.keyboard.press("Tab");
        await poll(async () => (await page.locator(t("g-edit-last")).textContent()) === "ben.role=admin", "select confirma");
        // Seats: número con mínimo, máximo y validación propia.
        await page.fill(`${grid} .z-table__input`, "60");
        await page.keyboard.press("Enter");
        await poll(
          async () =>
            /at most 50/.test(
              await page
                .locator(`${grid} .z-table__error`)
                .textContent()
                .catch(() => ""),
            ),
          "máximo",
        );
        await page.fill(`${grid} .z-table__input`, "13");
        await page.keyboard.press("Enter");
        await poll(
          async () =>
            (await page
              .locator(`${grid} .z-table__error`)
              .textContent()
              .catch(() => "")) === "13 seats are not sold",
          "validate",
        );
        await page.fill(`${grid} .z-table__input`, "9");
        await page.keyboard.press("Enter");
        await poll(async () => (await page.locator(t("g-edit-last")).textContent()) === "ben.seats=9", "Intro confirma");
        a = await active(page);
        assert(a.row === "ben" && a.text === "9", `Intro vuelve a la celda con el valor: ${JSON.stringify(a)}`);
        // Ctrl+Fin y Ctrl+Inicio.
        await page.keyboard.press("Control+End");
        a = await active(page);
        assert(a.row === "eli", `Ctrl+Fin: ${JSON.stringify(a)}`);
        await page.keyboard.press("Control+Home");
        a = await active(page);
        assert(a.row === "ana" && a.col === 0, `Ctrl+Inicio: ${JSON.stringify(a)}`);
        const violations = await seriousAxe(axe, page, grid);
        assert(violations.length === 0, `axe: ${JSON.stringify(violations).slice(0, 400)}`);
      },
    },
    {
      name: "DataTable rejilla (React): rango con Mayús, reordenar columnas con teclado y puntero, fijadas a los dos lados",
      async run({ open }) {
        const page = await open("data");
        const grid = t("g-edit");
        await page.locator(grid).scrollIntoViewIfNeeded();
        // Mayús+clic en las casillas: rango.
        await page.locator(`${grid} tbody tr[data-row-key="ana"] [role="checkbox"]`).click();
        await page.locator(`${grid} tbody tr[data-row-key="chen"] [role="checkbox"]`).click({ modifiers: ["Shift"] });
        await poll(async () => (await page.locator(t("g-edit-selected")).textContent()) === "ana,ben,chen", "Mayús+clic: rango");
        // Mayús+Espacio y Mayús+↓ con el teclado.
        await page.locator(`${grid} tbody tr[data-row-key="dara"] td[data-col="name"]`).click();
        await page.keyboard.press("Shift+Space");
        await poll(async () => (await page.locator(t("g-edit-selected")).textContent()) === "ana,ben,chen,dara", "Mayús+Espacio");
        await page.keyboard.press("Shift+ArrowDown");
        await poll(async () => (await page.locator(t("g-edit-selected")).textContent()) === "ana,ben,chen,dara,eli", "Mayús+↓");
        // Reordenar con el teclado: Espacio coge, → mueve, Espacio suelta.
        const grip = `${grid} .z-table__grip[data-col-key="role"]`;
        await page.locator(grip).focus();
        await page.keyboard.press("Space");
        assert((await page.getAttribute(grip, "aria-pressed")) === "true", "aria-pressed al coger");
        await page.keyboard.press("ArrowRight");
        await poll(async () => (await page.locator(t("g-edit-order")).textContent()) === "name,seats,role,joined", "→ mueve una posición");
        await poll(async () => (await page.evaluate(() => document.activeElement?.dataset.colKey)) === "role", "el asa conserva el foco");
        await page.keyboard.press("Space");
        assert((await page.getAttribute(grip, "aria-pressed")) === "false", "suelta");
        // Escape devuelve la columna a su sitio.
        await page.keyboard.press("Space");
        await page.keyboard.press("ArrowLeft");
        await poll(async () => (await page.locator(t("g-edit-order")).textContent()) === "name,role,seats,joined", "← mueve");
        await page.keyboard.press("Escape");
        await poll(async () => (await page.locator(t("g-edit-order")).textContent()) === "name,seats,role,joined", "Escape cancela");
        // Con el puntero: arrastrar Role delante de Seats.
        const from = await page.locator(grip).boundingBox();
        const to = await page.locator(`${grid} thead th[data-key="seats"]`).boundingBox();
        await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
        await page.mouse.down();
        await page.mouse.move(to.x + 8, to.y + to.height / 2, { steps: 8 });
        await page.mouse.up();
        await poll(
          async () => (await page.locator(t("g-edit-order")).textContent()) === "name,role,seats,joined",
          "arrastrar con el puntero",
        );
        // Columnas fijadas: Name al inicio y Joined al final, pegadas al desplazar.
        const sticky = await page.evaluate((sel) => {
          const start = document.querySelector(`${sel} tbody td[data-col="name"]`);
          const end = document.querySelector(`${sel} tbody td[data-col="joined"]`);
          return [getComputedStyle(start).position, getComputedStyle(end).position, end.getAttribute("data-pinned")];
        }, grid);
        assert(sticky[0] === "sticky" && sticky[1] === "sticky" && sticky[2] === "end", `fijadas: ${sticky}`);
      },
    },
    {
      name: "DataTable (React): agrupación con agregados, árbol con →/← y detalle desplegable; edición por fila",
      async run({ open, axe }) {
        const page = await open("data");
        const group = t("g-group");
        await page.locator(group).scrollIntoViewIfNeeded();
        assert((await page.getAttribute(`${group} table`, "role")) === "treegrid", "agrupada: treegrid");
        const heads = await page.locator(`${group} tbody tr.z-table__group`).allTextContents();
        assert(heads.length === 3 && heads[0].includes("Admin · 1"), `grupos: ${heads.join(" | ")}`);
        const editors = page.locator(`${group} tbody tr.z-table__group`).nth(1);
        assert((await editors.locator('td[data-col="seats"]').textContent()) === "19", "suma de Seats del grupo Editor");
        assert((await editors.locator('td[data-col="name"]').textContent()) === "2 people", "count con formato propio");
        assert((await page.locator(`${group} tfoot td`).nth(2).textContent()) === "27", "agregado en el pie");
        // ← en la cabecera de grupo pliega; → abre.
        await editors.locator("td").first().click();
        await page.keyboard.press("ArrowLeft");
        await poll(async () => (await editors.getAttribute("aria-expanded")) === "false", "← pliega el grupo");
        assert((await page.locator(`${group} tbody tr[aria-level="2"]`).count()) === 3, "sin las filas del grupo");
        await page.keyboard.press("ArrowRight");
        await poll(async () => (await editors.getAttribute("aria-expanded")) === "true", "→ abre el grupo");

        const tree = t("g-tree");
        await page.locator(tree).scrollIntoViewIfNeeded();
        const levels = await page
          .locator(`${tree} tbody tr[aria-level]`)
          .evaluateAll((rows) => rows.map((r) => `${r.dataset.rowKey}:${r.getAttribute("aria-level")}`));
        assert(levels.join(",") === "ceo:1,cto:2,cfo:2", `árbol abierto en ceo: ${levels}`);
        const cto = page.locator(`${tree} tbody tr[data-row-key="cto"]`);
        await cto.locator("td").nth(1).click();
        await page.keyboard.press("ArrowLeft");
        await page.keyboard.press("ArrowRight");
        await poll(async () => (await cto.getAttribute("aria-expanded")) === "true", "→ abre la rama");
        await poll(async () => (await page.locator(`${tree} tbody tr[data-row-key="dev1"]`).count()) === 1, "hijos a la vista");
        await page.keyboard.press("ArrowDown");
        await page.keyboard.press("Home");
        await page.keyboard.press("ArrowRight");
        await page.keyboard.press("ArrowLeft");
        await page.keyboard.press("ArrowLeft");
        await poll(async () => (await active(page)).row === "cto", "← en un hijo va a su padre");
        // Detalle: botón con aria-expanded y aria-controls.
        const expand = `${tree} tbody tr[data-row-key="cfo"] .z-table__expand`;
        await page.click(expand);
        await poll(async () => (await page.getAttribute(expand, "aria-expanded")) === "true", "detalle abierto");
        const controls = await page.getAttribute(expand, "aria-controls");
        assert(
          /Rosa Pinto joined on 2023-05-21/.test(await page.locator(`[id="${controls}"]`).textContent()),
          "el detalle es el controlado",
        );
        const violations = await seriousAxe(axe, page, tree);
        assert(violations.length === 0, `axe: ${JSON.stringify(violations).slice(0, 400)}`);

        // Edición por fila: F2 abre todos los campos editables; Intro confirma la fila.
        const row = t("g-row");
        await page.locator(`${row} tbody tr[data-row-key="ana"] td[data-col="seats"]`).click();
        await page.keyboard.press("F2");
        await poll(async () => (await page.locator(`${row} .z-table__input`).count()) === 2, "dos campos en la fila");
        await page.keyboard.press("Control+A");
        await page.keyboard.type("6");
        await page.keyboard.press("Enter");
        await poll(async () => (await page.locator(t("g-row-last")).textContent()) === "ana:Ana Torres/6", "onRowEdit con los valores");
      },
    },
    {
      name: "DataTable con 10 000 filas (React): montaje, desplazamiento, orden, filtro y selección medidos; aria-rowcount y foco al reciclar",
      async run({ open, note }) {
        const page = await open("data");
        await page.locator(t("g-big-mount")).scrollIntoViewIfNeeded();
        const mount = await page.evaluate(async () => {
          const start = performance.now();
          document.querySelector('[data-testid="g-big-mount"]').click();
          for (;;) {
            await new Promise((r) => requestAnimationFrame(r));
            if (document.querySelector('[data-testid="g-big"] tbody tr[data-vkey]')) break;
          }
          return Math.round(performance.now() - start);
        });
        const big = t("g-big");
        const rendered = await page.locator(`${big} tbody tr[data-vkey]`).count();
        assert(rendered > 5 && rendered < 80, `solo se pintan las filas que se ven: ${rendered}`);
        const rowcount = await page.getAttribute(`${big} table`, "aria-rowcount");
        assert(rowcount === String(10000 + 3), `aria-rowcount (2 de cabecera + 10 000 + pie): ${rowcount}`);
        // Desplazamiento: tiempo por cambio de ventana (doble rAF tras cada paso). Pasos de 600 px (unas 13 filas, lo que
        // mueve una rueda rápida) y, cada cinco, un salto de 20 000 px.
        const measureScroll = (sel) =>
          page.evaluate(async (s) => {
            const el = document.querySelector(`${s} .z-table-wrap`);
            el.scrollTop = 0;
            await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
            const frames = [];
            for (let i = 1; i <= 20; i++) {
              const start = performance.now();
              el.scrollTop = i % 5 === 0 ? el.scrollTop + 20000 : el.scrollTop + 600;
              await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
              frames.push(performance.now() - start);
            }
            frames.sort((a, b) => a - b);
            const first = document.querySelector(`${s} tbody tr[data-vkey]`)?.getAttribute("aria-rowindex");
            return { p50: Math.round(frames[10]), p95: Math.round(frames[18]), first };
          }, sel);
        const scroll = await measureScroll(big);
        assert(Number(scroll.first) > 1000, `tras desplazar, filas de más abajo con su aria-rowindex: ${scroll.first}`);
        // Orden por Value (10 000 filas).
        const sort = await page.evaluate(async (sel) => {
          const start = performance.now();
          document.querySelector(`${sel} th[data-key="value"] .z-table__sort`).click();
          await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
          return Math.round(performance.now() - start);
        }, big);
        // Filtro por Team.
        const filterStart = Date.now();
        await page.fill(`${big} input[aria-label="Filter Team"]`, "north");
        await poll(async () => Number(await page.getAttribute(`${big} table`, "aria-rowcount")) === 2000 + 3, "filtro: 2000 filas");
        const filter = Date.now() - filterStart;
        // Seleccionar todo (2000 filtradas) y volver.
        const all = await page.evaluate(async (sel) => {
          const start = performance.now();
          document.querySelector(`${sel} thead [role="checkbox"]`).click();
          await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
          return Math.round(performance.now() - start);
        }, big);
        await poll(async () => (await page.locator(t("g-big-selected")).textContent()) === "2000", "seleccionar todo lo filtrado");
        await page.fill(`${big} input[aria-label="Filter Team"]`, "");
        // El foco sobrevive al reciclado: la fila con el foco sigue en el documento tras desplazar lejos.
        await page.locator(`${big} tbody tr[data-vkey] td`).nth(1).click();
        const focusedRow = await page.evaluate(() => document.activeElement?.closest("tr")?.dataset.vkey);
        await page.evaluate((sel) => {
          document.querySelector(`${sel} .z-table-wrap`).scrollTop += 60000;
        }, big);
        await sleep(200);
        const still = await page.evaluate(() => document.activeElement?.closest("tr")?.dataset.vkey);
        assert(still === focusedRow, `el foco sigue en su fila (${focusedRow}) tras desplazar: ${still}`);
        // ↓ con la fila lejos de la vista: vuelve a ella y sigue.
        await page.keyboard.press("ArrowDown");
        await poll(
          async () => (await page.evaluate(() => document.activeElement?.closest("tr")?.dataset.vkey)) !== focusedRow,
          "↓ desde una fila reciclada",
        );
        // Referencia: la misma tabla con 1 000 filas. Con ventana virtual, desplazar cuesta lo mismo con 10 veces más filas.
        await page.click(t("g-big-mount-1k"));
        await poll(async () => (await page.getAttribute(`${big} table`, "aria-rowcount")) === String(1000 + 3), "1 000 filas");
        const small = await measureScroll(big);
        note(
          `10 000 filas · montaje ${mount} ms · desplazamiento p50 ${scroll.p50} ms, p95 ${scroll.p95} ms (con 1 000: p50 ${small.p50} ms) · ordenar ${sort} ms · filtrar ${filter} ms · seleccionar 2000 ${all} ms · ${rendered} filas en el documento`,
        );
        // Umbrales del servidor de desarrollo (React en modo desarrollo, mucho más lento que el de producción) y
        // holgados para una máquina cargada; lo que se comprueba de verdad es que el coste no crece con las filas.
        assert(scroll.p50 <= small.p50 * 2 + 40, `desplazar no depende del número de filas: ${scroll.p50} ms frente a ${small.p50} ms`);
        assert(mount < 3000, `montaje < 3000 ms: ${mount}`);
        assert(sort < 1500, `ordenar < 1500 ms: ${sort}`);
        assert(all < 1500, `seleccionar todo < 1500 ms: ${all}`);
      },
    },
    {
      name: "Select con búsqueda y 1 200 opciones en grupos (React): ventana virtual, aria-activedescendant, filtro y Fin",
      async run({ open, axe }) {
        const page = await open("inputs");
        const box = t("l-select");
        await page.locator(box).scrollIntoViewIfNeeded();
        await page.click(`${box} .z-select__control`);
        const search = ".z-listbox[data-searchable] .z-listbox__search input";
        await poll(
          async () => (await page.evaluate(() => document.activeElement?.matches(".z-listbox__search input"))) === true,
          "el foco va a la búsqueda",
        );
        const options = await page.locator(".z-listbox[data-searchable] .z-listbox__option").count();
        assert(options > 5 && options < 80, `ventana virtual: ${options} de 1200`);
        assert(
          (await page.getAttribute(".z-listbox[data-searchable] .z-listbox__option >> nth=0", "aria-setsize")) === "1200",
          "aria-setsize",
        );
        await page.keyboard.press("ArrowDown");
        const activeId = await page.getAttribute(search, "aria-activedescendant");
        assert(
          activeId && (await page.locator(`[id="${activeId}"]`).textContent()) === "Country 0002",
          `activa por aria-activedescendant: ${activeId}`,
        );
        await page.keyboard.type("0950");
        await poll(async () => (await page.locator(".z-listbox[data-searchable] .z-listbox__option").count()) === 1, "filtra");
        const label = await page.locator(".z-listbox[data-searchable] .z-listbox__label").allTextContents();
        assert(label.join() === "Asia", `el grupo con coincidencias conserva su título: ${label}`);
        await page.keyboard.press("Enter");
        await poll(async () => (await page.locator(t("l-select-value")).textContent()) === "c949", "Intro elige");
        // Fin con la lista entera: la última opción, fuera de la ventana inicial.
        await page.click(`${box} .z-select__control`);
        await page.keyboard.press("PageDown");
        for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowDown");
        const violations = await seriousAxe(axe, page, ".z-listbox[data-searchable]");
        assert(violations.length === 0, `axe: ${JSON.stringify(violations).slice(0, 400)}`);
        await page.keyboard.press("Escape");
      },
    },
    {
      name: "Combobox y Select del servidor (React): antirrebote, cancelación, carga, vacío, error con reintento y páginas",
      async run({ open }) {
        const page = await open("inputs");
        const box = t("l-combo");
        await page.locator(box).scrollIntoViewIfNeeded();
        const input = `${box} input[role="combobox"]`;
        await page.click(input);
        // La lista del popup, por su id (en la página hay otras listas con opciones).
        const listId = await page.getAttribute(input, "aria-controls");
        const list = `[id="${listId}"]`;
        const popup = `.z-listbox:has(${list})`;
        await poll(async () => (await page.locator(`${list} .z-listbox__option`).count()) === 20, "primera página al abrir");
        // Antirrebote: teclear rápido pide una sola vez la consulta final.
        await page.keyboard.type("city 1", { delay: 30 });
        assert((await page.getAttribute(input, "aria-busy")) === "true", "aria-busy mientras carga");
        await poll(async () => (await page.locator(`${list} .z-listbox__option`).count()) === 20, "resultados de «city 1»");
        await poll(async () => (await page.getAttribute(input, "aria-busy")) === null, "sin aria-busy al terminar");
        // Página siguiente al llegar al final.
        await page.keyboard.press("End");
        await page.keyboard.press("ArrowDown");
        await page.locator(list).evaluate((el) => {
          el.scrollTop = el.scrollHeight;
        });
        await poll(async () => (await page.locator(`${list} .z-listbox__option`).count()) >= 40, "página 2");
        // Vacío.
        await page.fill(input, "zzz");
        await poll(
          async () =>
            (await page
              .locator(`${popup} .z-listbox__empty`)
              .textContent()
              .catch(() => "")) === "No results",
          "vacío",
        );
        // Error y reintento (el servidor falla una vez con «error»).
        await page.fill(input, "error");
        await poll(
          async () =>
            /Couldn't load/.test(
              await page
                .locator(`${popup} .z-listbox__empty`)
                .textContent()
                .catch(() => ""),
            ),
          "error",
        );
        await page.keyboard.press("Enter");
        await poll(async () => (await page.locator(`${popup} .z-listbox__empty[data-error]`).count()) === 0, "Intro reintenta");
        // Elegir.
        await page.fill(input, "city 007");
        await poll(async () => (await page.locator(`${list} .z-listbox__option`).count()) === 1, "una coincidencia");
        await page.keyboard.press("ArrowDown");
        await page.keyboard.press("Enter");
        await poll(async () => (await page.locator(t("l-combo-value")).textContent()) === "city-007", "elige");

        // Select del servidor: búsqueda dentro, la elegida conserva su etiqueta.
        const sel = t("l-remote-select");
        await page.click(`${sel} .z-select__control`);
        await poll(
          async () => (await page.locator(".z-listbox[data-searchable] .z-listbox__option").count()) === 20,
          "Select: primera página",
        );
        await page.keyboard.type("city 01");
        await poll(
          async () => (await page.locator(".z-listbox[data-searchable] .z-listbox__option").first().textContent()) === "City 010",
          "Select: busca en el servidor",
        );
        await page.keyboard.press("Enter");
        await poll(async () => (await page.locator(`${sel} .z-select__value`).textContent()) === "City 010", "etiqueta de la elegida");
      },
    },
    {
      name: "Listbox y TransferList largos (React): ventana virtual, aria-posinset y aria-setsize, Fin e Inicio",
      async run({ open }) {
        const page = await open("inputs");
        const box = t("l-listbox");
        await page.locator(box).scrollIntoViewIfNeeded();
        const options = `${box} [role="option"]`;
        assert((await page.locator(options).count()) < 80, "ventana virtual");
        await page.locator(`${box} [role="option"][tabindex="0"]`).focus();
        await page.keyboard.press("End");
        await poll(
          async () => (await page.evaluate(() => document.activeElement?.getAttribute("aria-posinset"))) === "1200",
          "Fin: la última",
        );
        assert((await page.locator(t("l-listbox-value")).textContent()) === "c1199", "la selección sigue al foco");
        await page.keyboard.press("Home");
        await poll(async () => (await page.evaluate(() => document.activeElement?.getAttribute("aria-posinset"))) === "1", "Inicio");

        const tr = t("l-transfer");
        await page.locator(tr).scrollIntoViewIfNeeded();
        const source = `${tr} .z-transfer__options[data-side="source"]`;
        assert((await page.locator(`${source} .z-transfer__option`).count()) < 80, "TransferList: ventana virtual");
        await page.focus(source);
        await page.keyboard.press("End");
        await poll(async () => {
          const id = await page.getAttribute(source, "aria-activedescendant");
          return id && (await page.locator(`[id="${id}"]`).getAttribute("aria-posinset")) === "1000";
        }, "Fin en TransferList: la activa existe en el documento");
        await page.keyboard.press("Space");
        await page.keyboard.press("Enter");
        await poll(async () => (await page.locator(t("l-transfer-value")).textContent()) === "1", "mueve la última");
      },
    },
    {
      name: "Tree (React): arrastrar con el puntero, mover con el teclado (Ctrl+X, ↑/↓, Intro) con anuncios, carga diferida y 2 400 filas",
      async run({ open, axe }) {
        const page = await open("navigation");
        const tree = t("t-drag");
        await page.locator(tree).scrollIntoViewIfNeeded();
        const item = (id) => `${tree} [role="treeitem"][data-value="${id}"]`;
        // Carga diferida: archive no tiene hijos hasta abrirla.
        await page.click(`${item("archive")} > .z-tree__row`);
        await poll(async () => (await page.getAttribute(item("archive"), "aria-busy")) === "true", "aria-busy al cargar");
        await poll(async () => (await page.locator(`${item("archive")} [role="treeitem"]`).count()) === 2, "hijos cargados");
        // Teclado: Ctrl+X coge notes.md, ↑ elige el sitio, Intro suelta.
        await page.focus(item("notes"));
        await page.keyboard.press("Control+x");
        await poll(async () => (await page.getAttribute(item("notes"), "data-grabbed")) === "", "cogido");
        const live = () => page.evaluate(() => [...document.querySelectorAll("[aria-live]")].map((n) => n.textContent).join(" | "));
        await poll(async () => /Moving notes\.md/.test(await live()), "anuncia que lo coge");
        await page.keyboard.press("ArrowUp");
        await poll(async () => /(Before|Inside|After) /.test(await live()), "anuncia el destino");
        const marked = await page.locator(`${tree} .z-tree__row[data-drop]`).count();
        assert(marked === 1, `un marcador de destino: ${marked}`);
        await page.keyboard.press("Enter");
        await poll(async () => (await page.locator(t("t-drag-last")).textContent()).startsWith("notes "), "onMove con el teclado");
        await poll(async () => /notes\.md moved/.test(await live()), "anuncia que lo soltó");
        // Puntero: todo.md dentro de docs (con el árbol en el centro: cerca del borde, la página se desplaza sola).
        await page.locator(tree).evaluate((el) => el.scrollIntoView({ block: "center" }));
        const from = await page.locator(`${item("todo")} > .z-tree__row`).boundingBox();
        const to = await page.locator(`${item("docs")} > .z-tree__row`).boundingBox();
        await page.mouse.move(from.x + 40, from.y + from.height / 2);
        await page.mouse.down();
        await page.mouse.move(to.x + 40, to.y + to.height / 2, { steps: 10 });
        assert((await page.locator(`${item("docs")} > .z-tree__row`).getAttribute("data-drop")) === "inside", "marcador «dentro»");
        await page.mouse.up();
        await poll(async () => (await page.locator(t("t-drag-last")).textContent()) === "todo inside docs", "onMove con el puntero");
        await poll(
          async () => (await page.locator(`${item("docs")} [role="treeitem"][data-value="todo"]`).count()) === 1,
          "todo.md cuelga de docs",
        );
        const violations = await seriousAxe(axe, page, tree);
        assert(violations.length === 0, `axe: ${JSON.stringify(violations).slice(0, 400)}`);

        // Árbol grande: plano con ventana virtual.
        const big = t("t-big");
        await page.locator(big).scrollIntoViewIfNeeded();
        assert((await page.getAttribute(`${big} [role="tree"]`, "data-virtual")) !== null, "virtual");
        const items = await page.locator(`${big} [role="treeitem"]`).count();
        assert(items < 80, `filas pintadas: ${items} de 2460`);
        await page.locator(`${big} [role="treeitem"][tabindex="0"]`).focus();
        await page.keyboard.press("End");
        await poll(async () => (await page.evaluate(() => document.activeElement?.dataset.value)) === "f59-39", "Fin: la última fila");
        const level = await page.evaluate(() => [
          document.activeElement?.getAttribute("aria-level"),
          document.activeElement?.getAttribute("aria-posinset"),
          document.activeElement?.getAttribute("aria-setsize"),
        ]);
        assert(level.join() === "2,40,40", `aria-level/posinset/setsize en plano: ${level}`);
      },
    },
    {
      name: "Tabs (React): menú «Más» con las que no caben, la elegida siempre en la tira, y desplazamiento a la vista",
      async run({ open, axe }) {
        const page = await open("navigation");
        const box = t("t-tabs-menu");
        await page.locator(box).scrollIntoViewIfNeeded();
        await poll(async () => (await page.locator(`${box} .z-tabs__more`).count()) === 1, "botón «Más» con pestañas que no caben");
        const more = `${box} .z-tabs__more`;
        assert((await page.getAttribute(more, "aria-label")) === "More tabs", "nombre del botón");
        assert((await page.locator(`${box} [role="tablist"] .z-tabs__more`).count()) === 0, "el botón queda fuera del tablist");
        await page.click(more);
        await poll(async () => (await page.locator('[role="menu"] [role="menuitem"]').count()) > 0, "menú abierto");
        const items = await page.locator('[role="menu"] [role="menuitem"]').allTextContents();
        assert(items.includes("Danger zone"), `entradas: ${items}`);
        await page.locator('[role="menu"] [role="menuitem"]', { hasText: "Danger zone" }).click();
        await poll(async () => (await page.locator(t("t-tabs-value")).textContent()) === "danger-zone", "elegir activa la pestaña");
        await poll(
          async () => (await page.evaluate(() => document.activeElement?.dataset.value)) === "danger-zone",
          "la pestaña recibe el foco",
        );
        const visible = await page.locator(`${box} .z-tabs__tab[data-value="danger-zone"]`).evaluate((el) => {
          const list = el.parentElement.getBoundingClientRect();
          const r = el.getBoundingClientRect();
          return r.left >= list.left - 1 && r.right <= list.right + 1 && getComputedStyle(el).visibility !== "hidden";
        });
        assert(visible, "la elegida queda en la tira");
        const violations = await seriousAxe(axe, page, box);
        assert(violations.length === 0, `axe: ${JSON.stringify(violations).slice(0, 400)}`);
        // Desplazamiento: elegir con el teclado lleva la pestaña a la vista.
        const scroll = t("t-tabs-scroll");
        await page.locator(`${scroll} .z-tabs__tab[aria-selected="true"]`).focus();
        await page.keyboard.press("End");
        const inView = await page.locator(`${scroll} .z-tabs__tab[aria-selected="true"]`).evaluate((el) => {
          const list = el.parentElement.getBoundingClientRect();
          const r = el.getBoundingClientRect();
          return r.right <= list.right + 1;
        });
        assert(inView, "la pestaña elegida se ve en la tira");
      },
    },
    {
      name: "Command con 2 000 comandos (React): ventana virtual, Fin y filtro",
      async run({ open }) {
        const page = await open("commands");
        const box = t("c-big-command");
        await page.locator(box).scrollIntoViewIfNeeded();
        const items = `${box} [role="option"]`;
        assert((await page.locator(items).count()) < 80, "ventana virtual");
        await page.focus(`${box} .z-palette__input`);
        await page.keyboard.press("End");
        await poll(async () => {
          const id = await page.getAttribute(`${box} .z-palette__input`, "aria-activedescendant");
          return id && (await page.locator(`[id="${id}"]`).textContent()) === "Go to symbol 1000";
        }, "Fin: el último existe y está activo");
        await page.keyboard.type("symbol 0500");
        await poll(async () => (await page.locator(items).count()) === 1, "filtra");
      },
    },
    {
      name: "ConversationList y MemberList con 1 000 entradas (React): ventana virtual, teclado y posición para lectores",
      async run({ open }) {
        const page = await open("scale-stage");
        const chats = t("s-chats");
        assert((await page.locator(`${chats} .z-conversation`).count()) < 80, "ConversationList: ventana virtual");
        await page.locator(`${chats} .z-conversation[tabindex="0"]`).focus();
        await page.keyboard.press("End");
        await poll(
          async () => (await page.evaluate(() => document.activeElement?.closest("li")?.getAttribute("aria-posinset"))) === "1000",
          "Fin: la última",
        );
        await page.keyboard.press("Enter");
        await poll(async () => (await page.locator(t("s-chat-value")).textContent()) === "chat-999", "Intro abre");
        const members = t("s-members");
        assert((await page.locator(`${members} .z-member-list__row`).count()) < 80, "MemberList: ventana virtual");
        await page.locator(`${members} .z-member-list__scroll`).evaluate((el) => {
          el.scrollTop = el.scrollHeight;
        });
        await poll(
          async () => (await page.locator(`${members} .z-member-list__row`).last().getAttribute("aria-posinset")) !== null,
          "filas del final con posición",
        );
      },
    },
  ];
}
