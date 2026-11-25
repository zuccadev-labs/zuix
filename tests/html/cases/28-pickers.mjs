// Sin React: los selectores de 0.5 desde el contrato HTML. Cascader (columnas, búsqueda, carga diferida con
// setWidgetProps), TreeSelect (casillas y estrategia), MaskedInput (cursor y crudo), TimeRangePicker (medianoche),
// DateTimeRangePicker (panel con calendario, horas y zona) y QuarterPicker (rejilla), con z:change y FormData.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const contract = JSON.parse(readFileSync(join(here, "../../../zui/html.json"), "utf8")).components;
/** Marcado de un ejemplo del contrato por su título. */
const example = (name, title) => contract[name].examples.find((e) => e.title === title).html;

export default async function ({ page, test, ok }) {
  /** Monta el marcado en una caja `[data-z-dom]` dentro de un formulario, prepara la suite y recoge z:change. */
  // La página de ejemplos ya trae cada ejemplo del contrato: los ids del marcado se renombran para no repetirlos.
  const mount = (markup) =>
    page.evaluate(async (html) => {
      for (const old of document.querySelectorAll("[data-pk-layer]")) old.remove();
      const box = document.createElement("form");
      box.setAttribute("data-z-dom", "");
      box.setAttribute("data-pk-layer", "");
      box.innerHTML = html.replace(/\b(id|aria-controls)="([^"]+)"/g, '$1="pk-$2"');
      Object.assign(box.style, {
        position: "fixed",
        insetBlockStart: "0",
        insetInlineStart: "0",
        zIndex: "2147483000",
        inlineSize: "min(520px, 100vw)",
        padding: "16px",
        background: "Canvas",
      });
      document.querySelector(".page__main").append(box);
      window.__pk = [];
      box.addEventListener("z:change", (event) => window.__pk.push({ target: event.target.className, detail: event.detail }));
      (await import("/zui/dist/zui.dom.js")).hydrate(box);
    }, markup);
  const changes = () => page.evaluate(() => window.__pk.splice(0));
  const box = page.locator("[data-pk-layer]");
  const form = () =>
    page.evaluate(() => Object.fromEntries([...new FormData(document.querySelector("[data-pk-layer]"))].map(([k, v]) => [k, v])));
  const activeText = (input) =>
    box.locator(input).evaluate((el) => {
      const node = document.getElementById(el.getAttribute("aria-activedescendant") ?? "");
      return (node?.querySelector(".z-listbox__text, .z-tree__label")?.textContent ?? "").trim();
    });

  await test("Cascader sin React · columnas con el teclado, búsqueda por la ruta y carga diferida", async () => {
    await mount(contract.Cascader.examples[0].html);
    const input = ".z-cascader__input";
    ok((await box.locator(input).inputValue()) === "Spain / Madrid / Alcalá de Henares", "texto de la ruta elegida");
    ok((await form()).location === "es/md/alc", "FormData con la ruta");
    await box.locator(input).focus();
    await page.keyboard.press("ArrowDown");
    ok((await activeText(input)) === "Alcalá de Henares", "abre en la ruta");
    ok((await box.locator(".z-cascader__column").count()) === 3, "tres columnas");
    ok((await box.locator(".z-cascader__column").nth(2).getAttribute("aria-label")) === "City", "nombre de la columna");
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowRight");
    ok((await activeText(input)) === "Barcelona", "derecha entra en Catalonia");
    await page.keyboard.press("Enter");
    const c1 = await changes();
    ok(JSON.stringify(c1.at(-1)?.detail.value) === JSON.stringify(["es", "ct", "bcn"]), `z:change: ${JSON.stringify(c1)}`);
    ok((await form()).location === "es/ct/bcn", "FormData al día");
    await page.keyboard.type("sintra");
    ok((await activeText(input)).replace(/\s+/g, " ") === "Portugal / Lisbon / Sintra", "búsqueda por ruta");
    await page.keyboard.press("Enter");
    ok(JSON.stringify((await changes()).at(-1)?.detail.value) === JSON.stringify(["pt", "lis", "sin"]), "elige el resultado");
    // Carga diferida: una rama nueva con `isLeaf: false` y `loadChildren` por propiedad.
    await page.evaluate(async () => {
      const el = document.querySelector("[data-pk-layer] .z-cascader");
      const { setWidgetProps } = await import("/zui/dist/zui.dom.js");
      const options = JSON.parse(el.querySelector("script[data-props]")?.textContent ?? "{}").options ?? [];
      setWidgetProps(el, {
        options: [...options, { value: "fr", label: "France", isLeaf: false }],
        loadChildren: () => new Promise((resolve) => setTimeout(() => resolve([{ value: "par", label: "Paris" }]), 150)),
      });
    });
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("End");
    ok((await activeText(input)) === "France", "France al final");
    await page.keyboard.press("ArrowRight");
    ok((await box.locator(".z-cascader__option[data-loading]").count()) === 1, "estado de carga");
    await page.waitForFunction(() => document.querySelector("[data-pk-layer] .z-cascader__option[data-value='par']"));
    await page.keyboard.press("Enter");
    ok(JSON.stringify((await changes()).at(-1)?.detail.value) === JSON.stringify(["fr", "par"]), "hijo cargado elegido");
  });

  await test("TreeSelect sin React · casillas con estado mixto, estrategia parent y FormData", async () => {
    await mount(example("TreeSelect", "Varios equipos con casillas"));
    const input = ".z-treeselect__input";
    ok((await box.locator(".z-tags__tag").count()) === 2, "dos piezas");
    await box.locator(input).focus();
    await page.keyboard.press("ArrowDown");
    ok((await box.locator('[role="tree"]').getAttribute("aria-multiselectable")) === "true", "árbol múltiple");
    ok((await box.locator('.z-treeselect__item[data-value="eng"]').getAttribute("aria-checked")) === "mixed", "Engineering a medias");
    ok((await activeText(input)) === "Web", "abre en lo elegido");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    const last = (await changes()).at(-1)?.detail.value;
    ok(JSON.stringify(last) === JSON.stringify(["eng", "design"]), `rama entera: ${JSON.stringify(last)}`);
    const data = await page.evaluate(() => new FormData(document.querySelector("[data-pk-layer]")).getAll("teams"));
    ok(JSON.stringify(data) === JSON.stringify(["eng", "design"]), `FormData: ${JSON.stringify(data)}`);
    await page.keyboard.press("Escape");
    ok((await box.locator(input).getAttribute("aria-expanded")) === "false", "Escape cierra");
    await page.keyboard.type("bran");
    ok((await activeText(input)) === "Brand", "búsqueda");
  });

  await test("MaskedInput sin React · cursor estable, crudo en el campo oculto y z:change", async () => {
    await mount(`${contract.MaskedInput.examples[0].html}${contract.MaskedInput.examples[1].html}`);
    const phone = box.locator(".z-masked").first().locator("input.z-input__control");
    ok((await phone.inputValue()) === "(555) 123-4567", "formateado al preparar");
    await phone.click();
    await phone.evaluate((el) => el.setSelectionRange(7, 7));
    await page.keyboard.type("9");
    ok((await phone.inputValue()) === "(555) 192-3456", `valor: ${await phone.inputValue()}`);
    ok((await phone.evaluate((el) => el.selectionStart)) === 8, "cursor tras el 9");
    const last = (await changes()).at(-1)?.detail;
    ok(last?.raw === "5551923456" && last.complete === true, `z:change: ${JSON.stringify(last)}`);
    ok((await form()).phone === "5551923456", "el formulario recibe el crudo");
    const card = box.locator(".z-masked").nth(1).locator("input.z-input__control");
    await card.click();
    await page.keyboard.type("4242424242");
    ok((await card.inputValue()) === "4242 4242 42", "tarjeta en grupos de 4");
    ok((await card.evaluate((el) => el.validationMessage)) === "Enter the complete value", "a medias no es válido");
  });

  await test("TimeRangePicker sin React · turno de noche con indicador, duración y fin anterior al inicio", async () => {
    await mount(example("TimeRangePicker", "Turno de noche"));
    const group = box.locator(".z-timerange");
    ok((await group.getAttribute("data-overnight")) === "", "cruza la medianoche");
    ok((await group.locator(".z-timerange__overnight").textContent())?.includes("+1 day"), "indicador");
    ok((await group.locator(".z-timerange__duration").textContent())?.includes("8"), "duración");
    ok((await form()).shift === "22:00/06:00", "FormData inicio/fin");
    // Sin `allowOvernight`, el mismo rango no vale.
    await page.evaluate(() => document.querySelector("[data-pk-layer] .z-timerange").removeAttribute("data-allow-overnight"));
    await box.locator('#pk-shift-end [data-segment="hour"]').click();
    await page.keyboard.type("07");
    const last = (await changes()).filter((c) => c.target.includes("z-timerange")).at(-1)?.detail;
    ok(last?.value.end === "07:00" && last.info.error === "order", `z:change del grupo: ${JSON.stringify(last)}`);
    ok((await group.getAttribute("data-invalid")) === "", "inválido");
    ok(
      (await group.locator("> input.z-native-input").evaluate((el) => el.validationMessage)) ===
        "The end time must be after the start time",
      "mensaje de validez",
    );
  });

  await test("DateTimeRangePicker sin React · panel con calendario de rango, horas, zona y Apply", async () => {
    await mount(example("DateTimeRangePicker", "Ventana de mantenimiento con zona"));
    const trigger = box.locator(".z-dtrange > .z-select__control");
    ok((await trigger.textContent())?.includes("(Madrid)"), `texto: ${await trigger.textContent()}`);
    await trigger.click();
    const panel = box.locator(".z-dtrange__panel");
    await panel.locator(".z-calendar__grid").first().waitFor();
    ok((await panel.locator(".z-timefield").count()) === 2, "dos horas");
    ok((await panel.locator(".z-calendar__preset").count()) === 2, "preajustes");
    await panel.locator("select").selectOption("UTC");
    await panel.locator(".z-calendar__apply").click();
    const last = (await changes()).at(-1)?.detail.value;
    ok(last?.timeZone === "UTC" && last.start === "2026-11-28T22:00", `z:change: ${JSON.stringify(last)}`);
    ok((await form()).window === "2026-11-28T22:00+00:00[UTC]/2026-11-29T02:00+00:00[UTC]", `FormData: ${(await form()).window}`);
    ok(!(await panel.evaluate((el) => el.matches(":popover-open"))), "se cierra");
    ok(await trigger.evaluate((el) => el === document.activeElement), "el foco vuelve al botón");
  });

  await test("QuarterPicker sin React · rejilla de 2 × 2, límites, z:change con los días y FormData", async () => {
    await mount(contract.QuarterPicker.examples[0].html);
    const trigger = box.locator(".z-quarterpicker__field .z-select__control");
    ok((await trigger.textContent())?.includes("Q4 2026"), "valor");
    await trigger.click();
    ok((await page.evaluate(() => document.activeElement?.getAttribute("data-value"))) === "2026-Q4", "foco en el elegido");
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("ArrowLeft");
    ok((await page.evaluate(() => document.activeElement?.getAttribute("data-value"))) === "2026-Q1", "flechas");
    await page.keyboard.press("PageUp");
    await page.keyboard.press("PageUp");
    await page.keyboard.press("PageUp");
    ok((await page.evaluate(() => document.activeElement?.getAttribute("data-value"))) === "2024-Q1", "el límite min");
    await page.keyboard.press("Enter");
    const last = (await changes()).at(-1)?.detail;
    ok(last?.value === "2024-Q1" && last.from === "2024-01-01" && last.to === "2024-03-31", `z:change: ${JSON.stringify(last)}`);
    ok((await form()).quarter === "2024-Q1", "FormData");
    ok(await trigger.evaluate((el) => el === document.activeElement), "el foco vuelve al botón");
  });
}
