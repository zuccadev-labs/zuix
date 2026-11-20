#!/usr/bin/env node
// Genera el contrato HTML de zui y zout: <paquete>/html.json.
// Renderiza cada ejemplo de los manifiestos con el binding de React y guarda el marcado resultante,
// de modo que el HTML documentado para otros frameworks es exactamente el que produce la implementación.
// Los iconos se escriben como <z-icon name="…">. Un manifiesto puede fijar el marcado a mano con el campo
// `html` (lista de { title, code }): se usa en lo que React monta por portal y no aparece en el render estático.
import { build, transformSync } from "esbuild";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const tmp = join(root, ".tmp");
mkdirSync(tmp, { recursive: true });

// Entrada: expone los componentes y el render estático. Se empaqueta para poder ejecutar TSX desde Node.
// Va por stdin con `resolveDir` en zui/ (resuelve react desde sus dependencias): no se escribe ningún archivo
// temporal dentro del fuente, así que dos ejecuciones a la vez o una interrupción no dejan restos.
const entry = `
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import "../zicon/src/all";
import { Icon } from "../zicon/src/core";
import * as zui from "./src/index";
import * as zout from "../zout/src/index";
export { React, renderToStaticMarkup, zui, zout, Icon };
`;
const bundle = join(tmp, `html-entry-${process.pid}.cjs`);
await build({
  stdin: { contents: entry, resolveDir: join(root, "zui"), sourcefile: "html-entry.tsx", loader: "tsx" },
  outfile: bundle,
  bundle: true,
  format: "cjs",
  platform: "node",
  jsx: "automatic",
  logLevel: "error",
  define: { "process.env.NODE_ENV": '"production"' },
});
const { React, renderToStaticMarkup, zui, zout, Icon } = createRequire(import.meta.url)(bundle);
rmSync(bundle, { force: true });

// Identificadores que el ejemplo no define (datos, manejadores): un sustituto inerte.
// biome-ignore lint/complexity/useArrowFunction: React instancia el sustituto con `new` cuando hace de componente; una flecha no es construible.
const stub = new Proxy(function () {}, {
  get: (_, key) =>
    key === Symbol.iterator
      ? function* () {}
      : key === "map" || key === "filter"
        ? () => []
        : key === "length"
          ? 0
          : key === Symbol.toPrimitive
            ? () => ""
            : key === "then" || key === "$$typeof"
              ? undefined
              : stub,
  apply: () => stub,
});
// `Icon` (zicon) también: los ejemplos lo usan como contenido de adornos y de Swap.
const components = { ...zui, ...zout, Icon };
const scope = new Proxy(
  {},
  {
    has: () => true,
    get: (_, key) =>
      key === Symbol.unscopables
        ? undefined
        : key === "React"
          ? React
          : key in components
            ? components[key]
            : key in React
              ? React[key]
              : key in globalThis
                ? globalThis[key]
                : stub,
  },
);
const jsx = (code) => transformSync(code, { loader: "jsx", jsx: "transform" }).code.trim().replace(/;$/, "");

function render(code) {
  const named = /^function\s+([A-Z]\w*)\s*\(/.exec(code);
  const body = named ? `${jsx(code)}; return React.createElement(${named[1]});` : `return (${jsx(`<>${code}</>`)});`;
  const element = new Function("scope", `with (scope) { ${body} }`)(scope);
  return renderToStaticMarkup(element);
}

const VOID = new Set(["input", "img", "br", "hr", "path", "source", "col", "meta", "link"]);
function tidy(html) {
  // Iconos: el elemento <z-icon> dibuja el mismo SVG.
  html = html.replace(/<svg\b([^>]*\bclass="z-icon")[^>]*>.*?<\/svg>/g, (svg, _a) => {
    const at = (name) => new RegExp(`\\b${name}="([^"]*)"`).exec(svg)?.[1];
    const variant = at("data-variant") === "solid" ? ' variant="solid"' : "";
    const label = at("aria-label") ? ` label="${at("aria-label")}"` : "";
    return `<z-icon name="${at("data-icon")}"${variant} size="${at("width")}"${label}></z-icon>`;
  });
  // El acordeón nace sin animación (`style="animation:none"` hasta el primer cambio): no es parte del contrato.
  html = html.replace(/ style="animation:none"/g, "");
  const out = [];
  let depth = 0;
  for (const token of html.split(/(<[^>]+>)/).filter((t) => t !== "")) {
    if (token.startsWith("</")) depth -= 1;
    const last = out[out.length - 1];
    // <tag></tag> y <tag>texto</tag> en una sola línea.
    if (token.startsWith("</") && last && last.depth === depth && !last.closed && last.inline) {
      last.text += token;
      last.closed = true;
      continue;
    }
    if (!token.startsWith("<") && last && last.open && !last.closed) {
      last.text += token;
      continue;
    }
    const open = token.startsWith("<") && !token.startsWith("</") && !token.endsWith("/>") && !VOID.has(/^<([\w-]+)/.exec(token)?.[1]);
    out.push({ depth, text: token, open, inline: open, closed: !open });
    if (last?.open && !last.closed) last.inline = false;
    if (open) depth += 1;
  }
  return out.map((l) => "  ".repeat(Math.max(0, l.depth)) + l.text).join("\n");
}

// Marcado cuyo estado cambia con interacción: lo mueve @zuccadev-labs/zuix-zui/dom.
const DOM = /role="(?:tab|switch|checkbox|radio)"|aria-pressed=|z-accordion__trigger/;
let total = 0,
  manual = 0;
const skipped = [];
for (const pkg of ["zui", "zout"]) {
  const manifest = JSON.parse(readFileSync(join(root, pkg, "manifest.json"), "utf8"));
  const result = {};
  for (const c of manifest.components) {
    const examples = [];
    if (Array.isArray(c.html)) {
      for (const ex of c.html) {
        examples.push({ title: ex.title, html: ex.code, source: "manual", ...(ex.script ? { script: ex.script } : {}) });
        manual += 1;
      }
    } else {
      for (const ex of c.examples ?? []) {
        try {
          const html = tidy(render(ex.code));
          if (html.trim()) examples.push({ title: ex.title, html, source: "generated" });
          else skipped.push(`${pkg}/${c.name}: "${ex.title}" no produce marcado estático`);
        } catch (error) {
          skipped.push(`${pkg}/${c.name}: "${ex.title}" (${String(error.message).split("\n")[0].slice(0, 90)})`);
        }
      }
    }
    if (examples.length) {
      result[c.name] = {
        group: c.group,
        classes: c.classes,
        behavior:
          c.behavior ??
          (DOM.test(examples.map((e) => e.html).join(""))
            ? "dom"
            : pkg === "zui" && ["overlay", "carousel"].includes(c.group)
              ? "react"
              : "none"),
        examples,
      };
      total += examples.length;
    } else skipped.push(`${pkg}/${c.name}: sin contrato HTML`);
  }
  writeFileSync(
    join(root, pkg, "html.json"),
    `${JSON.stringify({ name: `@zuccadev-labs/zuix-${pkg}`, note: "Contrato HTML: marcado que producen los componentes. Iconos como <z-icon>. `behavior`: none = solo CSS; dom = necesita @zuccadev-labs/zuix-zui/dom (layouts de zout: @zuccadev-labs/zuix-zout/dom); react = hoy solo disponible en el binding de React.", components: result }, null, 1)}\n`,
  );
  console.log(`${pkg}: ${Object.keys(result).length} de ${manifest.components.length} componentes con contrato HTML`);
}
if (skipped.length && process.argv.includes("--verbose")) console.log(skipped.map((s) => `· ${s}`).join("\n"));
console.log(
  `✓ ${total} ejemplos (${manual} escritos a mano) · ${skipped.length} sin marcado estático${process.argv.includes("--verbose") ? "" : " (--verbose para verlos)"}`,
);
