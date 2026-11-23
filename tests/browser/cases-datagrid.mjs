// Binding de React de DataTable avanzado (pantalla `?screen=data`, sección «Data grid»): filtros por columna, ancho con
// puntero y teclado, columna fijada al desplazar y exportar a CSV.
export default function ({ t, assert, poll }) {
  const grid = '[data-testid="d-grid"]';
  return [
    {
      name: "DataTable avanzado (React): filtros, ancho con flechas y arrastre, columna fijada y exportar CSV",
      async run({ open }) {
        const page = await open("data");
        await page.locator(grid).scrollIntoViewIfNeeded();
        const rows = () => page.locator(`${grid} tbody tr`).count();
        assert((await rows()) === 7, "siete filas");
        await page.fill(`${grid} input[aria-label="Filter Role"]`, "edit");
        await poll(async () => (await rows()) === 3, "filtrar por rol");
        await page.fill(`${grid} input[aria-label="Filter Status"]`, "invited");
        await poll(async () => (await page.locator(`${grid} tbody tr td.z-table__empty`).count()) === 1, "sin filas: vacío");
        await page.fill(`${grid} input[aria-label="Filter Status"]`, "");
        await poll(async () => (await page.locator(t("d-grid-filters")).textContent()) === '{"role":"edit"}', "onFiltersChange");
        const handle = page.locator(`${grid} .z-table__resize[aria-label="Resize Name"]`);
        assert((await handle.getAttribute("role")) === "separator", "asa como separador");
        const th = page.locator(`${grid} th[data-key="name"]`);
        const w0 = (await th.boundingBox()).width;
        await handle.focus();
        await page.keyboard.press("ArrowRight");
        await page.keyboard.press("Shift+ArrowRight");
        await poll(async () => Math.round((await th.boundingBox()).width - w0) === 48, "flechas: +8 y +40");
        await poll(async () => /^name \d+$/.test(await page.locator(t("d-grid-resized")).textContent()), "onColumnResize");
        const box = await handle.boundingBox();
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x - 60, box.y + box.height / 2, { steps: 5 });
        await page.mouse.up();
        await poll(async () => Math.round((await th.boundingBox()).width) < Math.round(w0), "arrastrar estrecha la columna");
        const sticky = await page
          .locator(`${grid} tbody tr td[data-pinned]`)
          .first()
          .evaluate((el) => getComputedStyle(el).position);
        assert(sticky === "sticky", `columna fijada: ${sticky}`);
        const [file] = await Promise.all([page.waitForEvent("download"), page.click(`${grid} .z-datatable__export`)]);
        assert(file.suggestedFilename() === "members.csv", `nombre: ${file.suggestedFilename()}`);
        const csv = await new Promise((resolve) => {
          file.createReadStream().then((stream) => {
            let data = "";
            stream.on("data", (chunk) => {
              data += chunk;
            });
            stream.on("end", () => resolve(data));
          });
        });
        assert(csv.split("\r\n")[0] === "Name,Role,Seats,Status", `cabecera CSV: ${csv.split("\r\n")[0]}`);
        assert(csv.split("\r\n").length === 4, `solo las filas filtradas: ${csv.split("\r\n").length - 1}`);
      },
    },
  ];
}
