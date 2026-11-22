// Binding de React (pantalla `?screen=data` de examples/app): DataTable con selección, pie y
// paginación; Timeline, CircularProgress, Progress vertical y por tramos, DescriptionList, Item, StatusDot y Chip con
// tono. Exporta una función que recibe los ayudantes de cases.mjs.
export default function ({ t, assert, poll, settled, expectAttr, expectText }) {
  const screen = (open, options) => open("data", options);

  return [
    {
      name: "DataTable: casillas, seleccionar todo indeterminado, Mayús para un rango, conteo, pie y paginación (React)",
      async run({ open }) {
        const page = await screen(open);
        const table = t("d-table");
        const box = (name) => `${table} [role=checkbox][aria-label="Select ${name}"]`;
        const all = `${table} [role=checkbox][aria-label="Select all rows"]`;
        // Orden por nombre: Ana, Eva, Iker, Leo | Mia, Noa, Zoe. Ana es la dueña: no seleccionable.
        await expectAttr(page, box("Ana Ruiz"), "disabled", "");
        await expectAttr(page, all, "aria-checked", "mixed", "Leo marcado: cabecera mixta");
        await expectText(page, `${table} .z-datatable__count`, "1 selected");
        await page.click(all);
        await expectText(page, t("d-table-selected"), "eva,iker,leo", "seleccionar todo, sin la no seleccionable");
        await expectAttr(page, all, "aria-checked", "true");
        await page.click(all);
        await expectText(page, t("d-table-selected"), "none");
        await expectAttr(page, `${table} .z-datatable__count`, "data-empty", "true");
        await page.click(box("Eva Mora"));
        await page.click(box("Leo Park"), { modifiers: ["Shift"] });
        await expectText(page, t("d-table-selected"), "eva,iker,leo", "Mayús + clic marca el rango");
        // Teclado: Espacio en una casilla.
        await page.focus(box("Iker Sanz"));
        await page.keyboard.press(" ");
        await expectText(page, t("d-table-selected"), "eva,leo");
        await expectText(page, `${table} tfoot td:nth-child(2)`, "Total");
        await expectText(page, `${table} tfoot td:last-child`, "39", "el pie suma todas las filas, no solo la página");
        await expectText(page, `${table} .z-datatable__range`, "1–4 of 7");
        await page.click(`${table} .z-pagination [aria-label="Next page"]`);
        await expectText(page, t("d-table-page"), "2");
        await expectText(page, `${table} .z-datatable__range`, "5–7 of 7");
        await expectAttr(page, all, "aria-checked", "false", "la cabecera mira solo la página visible");
        await page.click(all);
        await expectText(page, t("d-table-selected"), "eva,leo,mia,noa,zoe", "lo de otras páginas se conserva");
        // Ordenar por asientos (desc) sigue en la página 2 y la cabecera se recalcula.
        await page.click(`${table} th:has-text("Seats") .z-table__sort`);
        await page.click(`${table} th:has-text("Seats") .z-table__sort`);
        await expectAttr(page, `${table} th:has-text("Seats")`, "aria-sort", "descending");
        await expectText(page, t("d-table-page"), "2");
      },
    },
    {
      name: "Datos: anillo con <progress>, barras vertical y por tramos, línea temporal, lista de descripciones e items (React)",
      async run({ open, axe }) {
        for (const theme of ["dark", "light"]) {
          const page = await screen(open, { theme });
          await settled(page);
          const ring = `${t("d-rings")} .z-progress-ring:first-child progress`;
          await expectAttr(page, ring, "value", "64");
          await expectAttr(page, ring, "aria-label", "Upload");
          await page.click('[aria-label="More"]');
          await expectAttr(page, ring, "value", "74");
          await expectText(page, `${t("d-rings")} .z-progress-ring:first-child .z-progress-ring__content`, "74%");
          const indeterminate = await page.evaluate(() => document.querySelector('[aria-label="Loading"]')?.matches(":indeterminate"));
          assert(indeterminate, "sin valor el <progress> es indeterminado");
          // La barra vertical crece hacia arriba: el relleno toca el borde inferior de la pista.
          const geometry = await page.evaluate((sel) => {
            const track = document.querySelector(`${sel} .z-progress:first-child .z-progress__track`).getBoundingClientRect();
            const fill = document.querySelector(`${sel} .z-progress:first-child .z-progress__fill`).getBoundingClientRect();
            return {
              trackBottom: track.bottom,
              fillBottom: fill.bottom,
              ratio: fill.height / track.height,
              tall: track.height > track.width,
            };
          }, t("d-vertical"));
          assert(geometry.tall, "pista vertical");
          assert(Math.abs(geometry.trackBottom - geometry.fillBottom) < 1.5, "relleno anclado abajo");
          assert(Math.abs(geometry.ratio - 0.72) < 0.03, `relleno del 72 % (${geometry.ratio.toFixed(2)})`);
          // Alterna: a 2 columnas en ancho, los cuerpos a los dos lados de la línea.
          const sides = await page.evaluate((sel) => {
            const bodies = [...document.querySelectorAll(`${sel} .z-timeline-list__body`)].map((b) => b.getBoundingClientRect());
            const marker = document.querySelector(`${sel} .z-timeline-list__marker`).getBoundingClientRect();
            return { first: bodies[0].left > marker.left, second: bodies[1].right <= marker.left + 1 };
          }, t("d-timeline-alt"));
          assert(sides.first && sides.second, "los elementos alternan de lado");
          await expectAttr(page, ".z-timeline-list__item[aria-current]", "aria-current", "step");
          const violations = (await axe(page, { include: "main" })).filter((v) => v.impact === "serious" || v.impact === "critical");
          assert(!violations.length, `axe (${theme}): ${violations.map((v) => `${v.id} ${v.nodes[0]?.target}`).join(" · ")}`);
        }
      },
    },
    {
      name: "Datos a 390 px: la línea alterna pasa a una columna y la barra de la tabla no desborda (React)",
      async run({ open }) {
        const page = await screen(open, { width: 390, height: 844 });
        await settled(page);
        const single = await page.evaluate((sel) => {
          const bodies = [...document.querySelectorAll(`${sel} .z-timeline-list__body`)].map((b) => b.getBoundingClientRect().left);
          return Math.abs(bodies[0] - bodies[1]) < 1;
        }, t("d-timeline-alt"));
        assert(single, "una columna en estrecho");
        const overflow = await poll(() =>
          page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1),
        );
        assert(overflow, "sin desbordamiento horizontal de la página");
      },
    },
  ];
}
