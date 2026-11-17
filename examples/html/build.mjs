#!/usr/bin/env node
// Genera examples/html/index.html: todo el catálogo en HTML plano, sin React ni bundler.
// El marcado sale de zui/html.json y zout/html.json (el contrato HTML), así que esta página prueba el contrato.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "../..");
const read = (p) => JSON.parse(readFileSync(join(root, p), "utf8"));
const all = { ...read("zui/html.json").components, ...read("zout/html.json").components };

const groups = {};
const scripts = [];
for (const [name, c] of Object.entries(all)) {
  if (c.behavior === "react") continue;
  // Primer ejemplo que no dependa de archivos externos (imágenes de datos de muestra).
  const ex = c.examples.find((e) => !/\bsrc="\//.test(e.html)) ?? c.examples[0];
  groups[c.group] ??= [];
  groups[c.group].push(`<section class="z-card demo" data-component="${name}" data-behavior="${c.behavior}">
  <header class="demo__head"><h3 class="demo__name">${name}</h3><span class="z-badge" data-tone="${c.behavior === "dom" ? "accent" : "neutral"}">${c.behavior === "dom" ? "dom" : "css"}</span></header>
  <div class="demo__stage">
${ex.html}
  </div>
</section>`);
  if (ex.script) scripts.push(`// ${name}\n${ex.script.replace(/^import .*\n+/gm, "")}`);
}

const html = `<!doctype html>
<!-- GENERADO por examples/html/build.mjs. No editar. -->
<html lang="en" data-theme="dark" data-brand="dazlabs">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Zuix · HTML</title>
  <link rel="icon" href="data:,">
  <link rel="stylesheet" href="../../tokens/dist/tokens.css">
  <link rel="stylesheet" href="../../zui/dist/zui.css">
  <link rel="stylesheet" href="../../zout/dist/zout.css">
  <link rel="stylesheet" href="./page.css">
</head>
<body class="z-root z-canvas" data-z-dom>
  <header class="z-liquid page__bar">
    <strong>Zuix · plain HTML</strong>
    <span class="page__spacer"></span>
    <button type="button" class="z-btn z-btn--ghost" data-size="sm" id="theme" aria-label="Toggle theme" data-z-tooltip="Toggle theme"><z-icon name="moon" size="16"></z-icon></button>
    <button type="button" class="z-btn z-btn--secondary" data-size="sm" id="brand">Brand: dazlabs</button>
  </header>
  <main class="page__main">
${Object.entries(groups).map(([group, cards]) => `<h2 class="page__group">${group}</h2>\n<div class="page__grid">\n${cards.join("\n")}\n</div>`).join("\n")}
  </main>
  <script type="module">
import "../../zicon/dist/zicon.element.js";
import { init, toast, confirm, setTheme, setBrand } from "../../zui/dist/zui.dom.js";
import * as zout from "../../zout/dist/zout.dom.js";
import * as zui from "../../zui/dist/zui.dom.js";
init();
zout.init();
const html = document.documentElement;
document.querySelector("#theme").addEventListener("click", () => setTheme(html.dataset.theme === "dark" ? "light" : "dark"));
document.querySelector("#brand").addEventListener("click", (event) => {
  setBrand(html.dataset.brand === "dazlabs" ? "zutool" : "dazlabs");
  event.currentTarget.textContent = "Brand: " + html.dataset.brand;
});
const removeProject = () => toast({ title: "Project deleted", intent: "danger" });
${scripts.join("\n\n")}
  </script>
</body>
</html>
`;
writeFileSync(join(here, "index.html"), html);
console.log(`✓ examples/html/index.html · ${Object.values(groups).flat().length} componentes`);
