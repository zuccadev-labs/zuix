#!/usr/bin/env node
// Empaqueta lo necesario para usar la suite sin bundler ni framework (un <link> y un <script type="module">):
//   zui/dist/zui.css            estilos de componentes        zout/dist/zout.css   estilos de layouts
//   zui/dist/zui.dom.js         comportamiento (@zuccadev-labs/zuix-zui/dom)
//   zui/dist/zui.dom.carousel-gl.js  modo WebGL del Carousel; zui.dom.js lo importa solo si un carrusel lo pide
//   zui/dist/zui.locale.<id>.js textos de un idioma; zui.dom.js lo importa al pedirlo setLocale() o loadLocale()
//   zicon/dist/zicon.element.js <z-icon> con el set completo
//   */dist/*.compat.css         modo compat (tools/compat.mjs): zui, zout y los tokens, para navegadores anteriores
// Los tokens ya se publican en tokens/dist/; su versión compat sale de aquí porque resuelve también las mezclas
// de color de los componentes.
import { build } from "esbuild";
import { statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildCompat } from "./compat.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const targets = [
  ["zui/src/styles/index.css", "zui/dist/zui.css"],
  ["zout/src/styles/index.css", "zout/dist/zout.css"],
  ["zui/src/dom/index.ts", "zui/dist/zui.dom.js"],
  ["zui/src/dom/carousel-gl.ts", "zui/dist/zui.dom.carousel-gl.js"],
  ...["es", "pt", "fr", "de"].map((id) => [`zui/src/locales/${id}.ts`, `zui/dist/zui.locale.${id}.js`]),
  ["zout/src/dom/index.ts", "zout/dist/zout.dom.js"],
  ["zicon/src/element.ts", "zicon/dist/zicon.element.js"],
];
// Módulos que se cargan bajo demanda: en el bundle quedan como import() de un archivo hermano, no incrustados.
const LAZY = { "./carousel-gl": "./zui.dom.carousel-gl.js" };
const lazy = {
  name: "lazy",
  setup(b) {
    b.onResolve({ filter: /^\.\/carousel-gl$/ }, (args) =>
      args.kind === "dynamic-import" ? { path: LAZY[args.path], external: true } : null,
    );
    // Los idiomas que importa locales/load.ts: cada uno en su archivo.
    b.onResolve({ filter: /^\.\/(es|pt|fr|de)$/ }, (args) =>
      args.kind === "dynamic-import" && /[\\/]locales$/.test(args.resolveDir)
        ? { path: `./zui.locale.${args.path.slice(2)}.js`, external: true }
        : null,
    );
  },
};
for (const [entry, out] of targets) {
  await build({
    plugins: [lazy],
    entryPoints: [join(root, entry)],
    outfile: join(root, out),
    bundle: true,
    format: "esm",
    target: "es2022",
    minify: out.endsWith(".js"),
    legalComments: "none",
    logLevel: "warning",
    banner: out.endsWith(".js")
      ? { js: "// GENERADO por tools/dist.mjs. No editar." }
      : { css: "/* GENERADO por tools/dist.mjs. No editar. */" },
  });
  console.log(`✓ ${out} · ${(statSync(join(root, out)).size / 1024).toFixed(1)} kB`);
}
const compat = buildCompat();
for (const f of compat.written) console.log(`✓ ${f} · ${(statSync(join(root, f)).size / 1024).toFixed(1)} kB`);
