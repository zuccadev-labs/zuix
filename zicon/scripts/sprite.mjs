#!/usr/bin/env node
// Genera sprite.svg: un <symbol> por icono. Uso: <svg class="z-icon" width="16" height="16"><use href="sprite.svg#plus"/></svg>
// Ids: `nombre` (outline) y `nombre-solid`.
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
writeFileSync(join(root, "sprite.svg"), `<svg xmlns="http://www.w3.org/2000/svg" style="display:none">\n${symbols.join("\n")}\n</svg>\n`);
console.log(`✓ sprite.svg: ${symbols.length} símbolos`);
