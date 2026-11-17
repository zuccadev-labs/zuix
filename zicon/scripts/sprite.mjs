#!/usr/bin/env node
// Genera sprite.svg: un <symbol> por icono. Uso: <svg class="z-icon" width="16" height="16"><use href="sprite.svg#plus"/></svg>
// Ids: `nombre` (outline) y `nombre-solid`. Falla si dos símbolos comparten id.
// La raíz se oculta con el atributo de presentación `display`, no con `style`: incrustada en una página con una
// política de seguridad de contenido sin estilos en línea, sigue oculta.
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const symbols = [];
for (const [variant, suffix] of [["outline", ""], ["solid", "-solid"]]) {
  const dir = join(root, "svg", variant);
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".svg")).sort()) {
    const svg = readFileSync(join(dir, file), "utf8");
    const inner = svg.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "").trim();
    symbols.push(`<symbol id="${file.slice(0, -4)}${suffix}" viewBox="0 0 24 24">${inner}</symbol>`);
  }
}
const ids = symbols.map((s) => /id="([^"]+)"/.exec(s)[1]);
const repeated = ids.filter((id, i) => ids.indexOf(id) !== i);
if (repeated.length) { console.error(`✗ sprite.svg: ids repetidos: ${[...new Set(repeated)].join(", ")}`); process.exit(1); }
writeFileSync(join(root, "sprite.svg"), `<svg xmlns="http://www.w3.org/2000/svg" display="none" aria-hidden="true">\n${symbols.join("\n")}\n</svg>\n`);
console.log(`✓ sprite.svg: ${symbols.length} símbolos`);
