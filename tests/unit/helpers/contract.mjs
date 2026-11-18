// Marcado del contrato HTML (zui/html.json, generado por tools/html.mjs): el mismo que documenta la suite.
import { readFileSync } from "node:fs";

const contract = JSON.parse(readFileSync(new URL("../../../zui/html.json", import.meta.url), "utf8")).components;

/** HTML del ejemplo `index` de un componente del contrato. */
export function contractHtml(component, index = 0) {
  const example = contract[component]?.examples[index];
  if (!example) throw new Error(`zui/html.json no tiene el ejemplo ${index} de ${component}. Ejecuta: pnpm manifest && pnpm html`);
  return example.html;
}
