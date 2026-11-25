#!/usr/bin/env node
// Empaqueta el editor de demostración: dist/editor.js (la página del editor) y dist/canvas.js (el lienzo del iframe).
// Los dos son scripts clásicos (IIFE): el lienzo va en un iframe con sandbox y origen opaco, y un módulo pediría CORS.
// El catálogo (zui/editor/catalog.json) va dentro de los dos. Uso: node examples/editor-canvas/build.mjs
import { build } from "esbuild";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
for (const name of ["editor", "canvas"]) {
  await build({
    entryPoints: [join(here, "src", `${name}.ts`)],
    outfile: join(here, "dist", `${name}.js`),
    bundle: true,
    format: "iife",
    target: "es2022",
    legalComments: "none",
    logLevel: "warning",
    banner: { js: "// GENERADO por examples/editor-canvas/build.mjs. No editar." },
  });
}
console.log("✓ examples/editor-canvas/dist: editor.js y canvas.js");
