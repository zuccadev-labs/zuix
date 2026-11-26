#!/usr/bin/env node
// Prueba de humo de consumo externo (`pnpm test:pack`). No publica nada.
//   1. `pnpm build` (se salta con --skip-build), `pnpm bump check` y `pnpm pack` de cada paquete a .tmp/pack/.
//   2. Revisa cada tarball (los cinco, incluido el paraguas @zuccadev-labs/zuix): sin `src/`, sin `workspace:`, sin datos
//      internos, con README, LICENSE, CHANGELOG y metadatos de npm, y cada destino de `exports` existe dentro.
//   3. .tmp/consumer/react y .tmp/consumer/react18: proyectos fuera del workspace (raíz propia), instalados desde los
//      tarballs, con React 19 y con React 18 (y sus @types/react). Renderizan con react-dom/server y en un DOM de happy-dom
//      (refs, `inert`, `popovertarget`, sin avisos de React en la consola), compilan con Vite y pasan `tsc --noEmit` con
//      skipLibCheck: false (bundler y nodenext), con TypeScript 5.9, 6 (solo React 19) y 7.
//   4. .tmp/consumer/dom: lo mismo sin React instalado; importa los módulos `dom` en Node y comprueba con esbuild que
//      las entradas por familia de zui/dom se descartan en un bundle (toast() solo no trae agenda, gráficos ni color).
//   5. Con --next, .tmp/consumer/next: Next.js (última estable, App Router) instalado desde los tarballs. `next build`,
//      `next start` y una prueba en Chrome con playwright-core: marcado de servidor con iconos, hidratación sin avisos
//      e interacción (Modal, Menu, Tabs, Select, Toast, Accordion, Shell), y la ruta /umbrella, que lo importa todo por
//      el paquete paraguas con un solo @import de estilos. Necesita red (next) y Chrome. Añade unos 25 s con la caché de pnpm caliente.
//   6. Opcional: publint y @arethetypeswrong/cli con `pnpm dlx`. Si no hay red se avisa y no falla.
// Lo que esta prueba no cubre (instalar desde un registro, sin `overrides`, con npm, yarn y bun) está en
// docs/package/02-publicacion.md, "Ensayo contra un registro local".
// Sale con código ≠ 0 si algo no resuelve. Opciones: --skip-build, --skip-lint, --next.
import { spawn, spawnSync } from "node:child_process";
import net from "node:net";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Cuántos iconos del set completo trae un bundle: se busca el primer trazado de cada icono de `zicon/src/icons`.
 * Los componentes usan unos pocos por dentro (chevrones, cierre, marca…); el set completo son más de 300. Medir esto
 * en vez del peso del bundle evita que el tope tenga que subir con cada componente nuevo. El consumidor de Vite llama
 * al init() completo de zui/dom, que trae los iconos de todas las familias (unos 80 con chat, IA, dashboard y
 * usuarios): el tope queda lejos de esa cifra y del set completo.
 */
const ICON_LIMIT = 120;
function iconsIn(js) {
  const dir = join(root, "zicon", "src", "icons");
  let found = 0;
  let total = 0;
  for (const file of readdirSync(dir)) {
    const path = /"o":\["([^"]{24,})/.exec(readFileSync(join(dir, file), "utf8"))?.[1];
    if (!path) continue;
    total += 1;
    if (js.includes(path)) found += 1;
  }
  return { found, total };
}
const args = new Set(process.argv.slice(2));
// Carpetas de los paquetes publicables, en orden de dependencias. `suite` es el paraguas @zuccadev-labs/zuix.
const PACKAGES = ["tokens", "zicon", "zui", "zout", "suite"];
const npmName = (pkg) => (pkg === "suite" ? "@zuccadev-labs/zuix" : `@zuccadev-labs/zuix-${pkg}`);
const packDir = join(root, ".tmp/pack");
const consumerDir = join(root, ".tmp/consumer");
const failures = [];
const notes = [];
const ok = (msg) => console.log(`✓ ${msg}`);
const bad = (msg) => {
  failures.push(msg);
  console.log(`✗ ${msg}`);
};
const walk = (d) =>
  readdirSync(d).flatMap((f) => {
    const p = join(d, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

function sh(cmd, argv, cwd, { timeout = 600_000 } = {}) {
  // "node" es este mismo Node, no el primero del PATH. En Windows pnpm es pnpm.cmd, que solo se lanza con shell.
  const bin = cmd === "node" ? process.execPath : cmd;
  const r = spawnSync(bin, argv, {
    cwd,
    encoding: "utf8",
    timeout,
    shell: process.platform === "win32" && cmd === "pnpm",
    env: { ...process.env, CI: "1", FORCE_COLOR: "0" },
  });
  const failure = r.error
    ? `no se pudo ejecutar ${cmd}: ${r.error.code === "ETIMEDOUT" ? `superó ${timeout / 1000} s` : r.error.message}`
    : "";
  return { ok: r.status === 0, out: `${r.stdout ?? ""}${r.stderr ?? ""}${failure}`.trim(), status: r.status };
}
function step(name, cmd, argv, cwd) {
  const r = sh(cmd, argv, cwd);
  if (r.ok) ok(name);
  else
    bad(
      `${name}\n${r.out
        .split("\n")
        .slice(-40)
        .map((l) => `    ${l}`)
        .join("\n")}`,
    );
  return r;
}
function finish() {
  for (const n of notes) console.log(`· ${n}`);
  if (failures.length) {
    console.error(`\n✗ pack-test: ${failures.length} fallo(s)`);
    process.exit(1);
  }
  console.log("\n✓ pack-test: los cinco paquetes empaquetados se instalan, resuelven, renderizan y compilan fuera del workspace");
  process.exit(0);
}

// ── 1. Build y empaquetado ────────────────────────────────────────────────────────────────────────
if (!args.has("--skip-build")) {
  const r = step("pnpm build", "node", ["tools/build.mjs"], root);
  if (!r.ok) finish();
}
step("pnpm bump check", "node", ["tools/version.mjs", "check"], root);
rmSync(packDir, { recursive: true, force: true });
rmSync(consumerDir, { recursive: true, force: true });
mkdirSync(packDir, { recursive: true });

const tarballs = {};
for (const pkg of PACKAGES) {
  const r = sh("pnpm", ["pack", "--pack-destination", packDir], join(root, pkg));
  const file = join(
    packDir,
    `${npmName(pkg).slice(1).replace("/", "-")}-${JSON.parse(readFileSync(join(root, pkg, "package.json"), "utf8")).version}.tgz`,
  );
  if (!r.ok || !existsSync(file)) {
    bad(`pnpm pack ${pkg}\n${r.out}`);
    continue;
  }
  tarballs[pkg] = file;
}
if (failures.length) finish();

// ── 2. Contenido de cada tarball ──────────────────────────────────────────────────────────────────
for (const pkg of PACKAGES) {
  const file = tarballs[pkg];
  const entries = sh("tar", ["-tzf", file], root)
    .out.split("\n")
    .map((e) => e.replace(/^package\//, ""));
  const manifest = JSON.parse(sh("tar", ["-xzOf", file, "package/package.json"], root).out);
  const problems = [];
  if (pkg !== "tokens" && entries.some((e) => e.startsWith("src/"))) problems.push("incluye src/");
  if (JSON.stringify(manifest).includes("workspace:")) problems.push("quedan dependencias workspace:");
  if (manifest.publishConfig?.exports) problems.push("publishConfig.exports no se aplicó");
  if (manifest.license !== "MIT") problems.push("license no es MIT");
  if (manifest.name !== npmName(pkg)) problems.push(`name es ${manifest.name}`);
  for (const field of ["description", "keywords", "repository", "homepage", "bugs", "engines"])
    if (!manifest[field]) problems.push(`falta ${field}`);
  if (manifest.repository?.directory !== pkg) problems.push("repository.directory no es la carpeta del paquete");
  for (const required of ["README.md", "LICENSE", "CHANGELOG.md"]) if (!entries.includes(required)) problems.push(`falta ${required}`);
  const internal = entries.filter((e) =>
    /\.inventory\.json$|(^|\/)\.tmp\/|(^|\/)(tests?|__tests__)\/|\.test\.|\.tsbuildinfo$|(^|\/)tsconfig[^/]*\.json$|(^|\/)node_modules\//.test(
      e,
    ),
  );
  if (internal.length) problems.push(`incluye archivos internos: ${internal.slice(0, 5).join(", ")}`);
  // Dependencias entre paquetes de la suite: rango ^ de la versión, nunca exacta ni workspace. zicon es peer de zui y zout.
  for (const [dep, range] of Object.entries({ ...manifest.dependencies, ...manifest.peerDependencies })) {
    if (dep.startsWith("@zuccadev-labs/") && range !== `^${manifest.version}`)
      problems.push(`${dep} declarado como "${range}" y no "^${manifest.version}"`);
  }
  if (
    (pkg === "zui" || pkg === "zout") &&
    (manifest.dependencies?.["@zuccadev-labs/zuix-zicon"] || !manifest.peerDependencies?.["@zuccadev-labs/zuix-zicon"])
  )
    problems.push("@zuccadev-labs/zuix-zicon debe ser peerDependency, no dependency");
  const targets = [];
  const collect = (v) => (typeof v === "string" ? targets.push(v) : Object.values(v ?? {}).forEach(collect));
  collect(manifest.exports);
  for (const t of [manifest.main, manifest.types, ...targets].filter(Boolean)) {
    const rel = t.replace(/^\.\//, "");
    // Un patrón de subruta (`./dist/*.js`): cada tramo literal se escapa entero y cada `*` vale por uno o más caracteres.
    const pattern = rel.includes("*")
      ? new RegExp(
          `^${rel
            .split("*")
            .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
            .join(".+")}$`,
        )
      : null;
    const hit = pattern ? entries.some((e) => pattern.test(e)) : entries.includes(rel);
    if (!hit) problems.push(`exports apunta a "${t}", que no está en el tarball`);
  }
  if (problems.length) bad(`tarball ${pkg}: ${problems.join("; ")}`);
  else ok(`tarball ${npmName(pkg)} · ${(statSync(file).size / 1024).toFixed(1)} kB · ${entries.length} archivos · exports íntegros`);
}

// ── Proyectos consumidores ────────────────────────────────────────────────────────────────────────
const tgz = (pkg) => `file:${tarballs[pkg]}`;
const zuixDeps = Object.fromEntries(PACKAGES.map((p) => [npmName(p), tgz(p)]));
function project(name, pkg, files, builds = []) {
  const dir = join(consumerDir, name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: `consumer-${name}`, private: true, type: "module", ...pkg }, null, 2));
  // Su propio pnpm-workspace.yaml lo convierte en raíz independiente: queda fuera del workspace de zuix.
  // (pnpm 12 ya no lee `pnpm.overrides` de package.json, y `--ignore-workspace` ignora también este archivo,
  // que es donde viven los overrides; por eso el aislamiento se hace así y no con esa opción.)
  // overrides: las dependencias entre paquetes zuix (zui → zicon 0.1.0) no existen en ningún registro; se fuerzan al tarball.
  // allowBuilds: solo lo que el consumidor compila al instalar. Vite 8 (Rolldown y Oxc) ya no trae esbuild, así que
  // el consumidor de React no autoriza nada; Next autoriza sharp.
  // autoInstallPeers: false: React es un peer opcional de los paquetes zuix; si pnpm lo instalara por su cuenta, la prueba
  // "sin React" no probaría nada.
  writeFileSync(
    join(dir, "pnpm-workspace.yaml"),
    `autoInstallPeers: false\n${builds.length ? `allowBuilds:\n${builds.map((b) => `  "${b}": true`).join("\n")}\n` : ""}overrides:\n${Object.entries(
      zuixDeps,
    )
      .map(([k, v]) => `  "${k}": "${v}"`)
      .join("\n")}\n`,
  );
  for (const [f, content] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, f)), { recursive: true });
    writeFileSync(join(dir, f), content);
  }
  return dir;
}

// ── Paquete paraguas @zuccadev-labs/zuix: reexporta los otros cuatro bajo subrutas ───────────────────────────
{
  const dir = project(
    "umbrella",
    { dependencies: { ...zuixDeps, react: "^19.0.0", "react-dom": "^19.0.0" } },
    {
      "check.mjs": `import assert from "node:assert/strict";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import "@zuccadev-labs/zuix/zicon/all";
import { Button } from "@zuccadev-labs/zuix/zui";
import { Stack } from "@zuccadev-labs/zuix/zout";
import { iconSvg } from "@zuccadev-labs/zuix/zicon/dom";
import * as zuiDom from "@zuccadev-labs/zuix/zui/dom";
import * as zoutDom from "@zuccadev-labs/zuix/zout/dom";
import { zui, zout, zicon } from "@zuccadev-labs/zuix";
import { Button as Direct } from "@zuccadev-labs/zuix-zui";
assert.equal(Button, Direct, "el paraguas reexporta el mismo módulo");
assert.equal(zui.Button, Button); assert.equal(zout.Stack, Stack); assert.equal(typeof zicon.Icon, "function");
const html = renderToStaticMarkup(h(Stack, null, h(Button, { variant: "primary", icon: "plus" }, "New")));
assert.ok(html.includes("z-btn--primary") && html.includes("<path"), "render con icono a través del paraguas");
assert.ok(iconSvg("plus").includes("<path")); assert.equal(typeof zuiDom.init, "function"); assert.equal(typeof zoutDom.init, "function");
for (const f of ["styles.css", "tokens.css", "styles.compat.css", "tokens.compat.css"]) import.meta.resolve("@zuccadev-labs/zuix/" + f);
console.log("ok");
`,
    },
  );
  step("instalar consumidor paraguas", "pnpm", ["install", "--no-frozen-lockfile"], dir);
  step("paraguas @zuccadev-labs/zuix: subrutas, mismo módulo y render", "node", ["check.mjs"], dir);
}

// ── 3. Consumidores con React 19 y con React 18 ───────────────────────────────────────────────────
// El mismo proyecto dos veces: `react` (React 19 y @types/react 19) y `react18` (React 18 y @types/react 18). Los dos
// renderizan en servidor y en un DOM (happy-dom: refs, `inert`, `popovertarget` y consola sin avisos), resuelven las
// entradas, pasan tsc y compilan con Vite.
const install = ["install", "--prefer-offline", "--no-frozen-lockfile"];
for (const major of [19, 18]) {
  const name = major === 19 ? "react" : "react18";
  const range = major === 19 ? "^19.0.0" : "^18.2.0";
  const reactDir = project(
    name,
    {
      dependencies: { ...zuixDeps, react: range, "react-dom": range },
      devDependencies: {
        "@types/react": range,
        "@types/react-dom": range,
        "@happy-dom/global-registrator": "^21.0.0",
        typescript: "^5.9.0",
        "typescript-6": "npm:typescript@^6.0.0",
        "typescript-7": "npm:typescript@^7.0.0",
        vite: "^8.0.0",
      },
    },
    {
      "ssr.mjs": `import assert from "node:assert/strict";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import "@zuccadev-labs/zuix-zicon/all";
import { Icon, registeredIconNames } from "@zuccadev-labs/zuix-zicon";
import { plus } from "@zuccadev-labs/zuix-zicon/icons/plus";
import { Button, Badge, Modal, cx } from "@zuccadev-labs/zuix-zui";
import { Stack, Shell } from "@zuccadev-labs/zuix-zout";

const button = renderToStaticMarkup(h(Button, { variant: "primary", icon: "plus" }, "New project"));
assert.match(button, /^<button type="button" class="z-btn z-btn--primary" data-size="md">/);
assert.ok(button.includes('data-icon="plus"') && button.includes("<path"), "el botón dibuja el icono: zui y la aplicación comparten el registro de zicon");
assert.ok(button.includes(plus.o[0].replace(/^E:/, "")), "el trazado es el del módulo de icono");
const badge = renderToStaticMarkup(h(Badge, { tone: "success" }, "Live"));
assert.match(badge, /^<span class="z-badge" data-tone="success" data-variant="soft" data-size="md">Live<\\/span>$/);
const stack = renderToStaticMarkup(h(Stack, { gap: 2 }, h(Icon, { name: "bell", label: "Alerts" })));
assert.match(stack, /^<div class="z-stack" data-gap="2" data-align="stretch"><svg/);
assert.ok(stack.includes('role="img"') && stack.includes('aria-label="Alerts"'));
assert.equal(typeof Modal, "function");
assert.equal(typeof Shell, "function");
assert.equal(cx("a", false, "b"), "a b");
assert.ok(registeredIconNames().length >= 300, "set completo registrado");
// Conector de editores: toReact con el binding (React 18 y 19).
const { toReact } = await import("@zuccadev-labs/zuix-zui/editor/react");
const zuiAll = await import("@zuccadev-labs/zuix-zui");
const editorPage = { format: "zuix.page", schemaVersion: 1, body: [{ id: "b", type: "Button", props: { variant: "primary" }, children: [{ id: "t", type: "#text", text: "Go" }] }] };
assert.equal(renderToStaticMarkup(toReact(editorPage)), '<button type="button" class="z-btn z-btn--primary" data-size="md">Go</button>');
assert.equal(renderToStaticMarkup(toReact(editorPage, { components: zuiAll })), '<button type="button" class="z-btn z-btn--primary" data-size="md">Go</button>');
// Render de servidor de componentes con efectos de layout, sin avisos de React (React 18 avisa de un useLayoutEffect
// en el servidor; el binding usa useEffect cuando no hay document).
const { renderToString } = await import("react-dom/server");
const { Calendar, Carousel, FileUpload, Tabs } = await import("@zuccadev-labs/zuix-zui");
const { FloatingPanel, Navbar } = await import("@zuccadev-labs/zuix-zout");
const warnings = [];
const { error, warn } = console;
console.error = (...args) => warnings.push(args.map(String).join(" ").slice(0, 300));
console.warn = console.error;
const page = renderToString(
  h(Shell, { sidebar: { content: "Nav", label: "Main" } },
    h(Calendar, {}),
    h(Carousel, { items: ["a", "b"], renderItem: (item) => h("span", null, item), label: "Photos" }),
    h(FileUpload, { onFiles: () => {} }),
    h(Tabs, { items: [{ value: "a", label: "A", content: "Panel" }] }),
    h(FloatingPanel, { title: "Panel" }, "Body"),
    h(Navbar, { brand: "Acme", items: [{ label: "Docs", href: "#docs" }] }),
  ),
);
console.error = error;
console.warn = warn;
assert.ok(page.includes("z-shell") && page.includes("z-calendar"), "render de servidor de Shell y Calendar");
assert.deepEqual(warnings, [], "render de servidor sin avisos");
console.log("ssr: Button, Badge, Stack e Icon renderizan el marcado del contrato; Shell, Calendar, Carousel y otros, sin avisos");
`,
      "subpaths.mjs": `import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const resolve = (s) => fileURLToPathSafe(import.meta.resolve(s));
function fileURLToPathSafe(u) { return decodeURIComponent(new URL(u).pathname); }
const specs = [
  "@zuccadev-labs/zuix-zicon", "@zuccadev-labs/zuix-zicon/core", "@zuccadev-labs/zuix-zicon/all", "@zuccadev-labs/zuix-zicon/dom", "@zuccadev-labs/zuix-zicon/element", "@zuccadev-labs/zuix-zicon/icons/x-mark",
  "@zuccadev-labs/zuix-zicon/manifest.json", "@zuccadev-labs/zuix-zicon/sprite.svg", "@zuccadev-labs/zuix-zicon/svg/outline/bell.svg", "@zuccadev-labs/zuix-zicon/svg/solid/bell.svg", "@zuccadev-labs/zuix-zicon/dist/zicon.element.js",
  "@zuccadev-labs/zuix-zui", "@zuccadev-labs/zuix-zui/dom", ...["core", "dates", "data", "content", "agenda", "charts", "color", "media", "effects", "time", "terminal", "chat", "ai", "dashboard", "people", "nodes", "page"].map((f) => "@zuccadev-labs/zuix-zui/dom/" + f), "@zuccadev-labs/zuix-zui/styles.css", "@zuccadev-labs/zuix-zui/styles/actions.css", "@zuccadev-labs/zuix-zui/manifest.json", "@zuccadev-labs/zuix-zui/html.json", "@zuccadev-labs/zuix-zui/dist/zui.css", "@zuccadev-labs/zuix-zui/dist/zui.dom.js", "@zuccadev-labs/zuix-zui/styles.compat.css", "@zuccadev-labs/zuix-zui/dist/zui.compat.css", "@zuccadev-labs/zuix-zui/editor", "@zuccadev-labs/zuix-zui/editor/react", "@zuccadev-labs/zuix-zui/editor/catalog.json", "@zuccadev-labs/zuix-zui/editor/catalog.schema.json", "@zuccadev-labs/zuix-zui/editor/document.schema.json",
  "@zuccadev-labs/zuix-zout", "@zuccadev-labs/zuix-zout/dom", "@zuccadev-labs/zuix-zout/styles.css", "@zuccadev-labs/zuix-zout/manifest.json", "@zuccadev-labs/zuix-zout/html.json", "@zuccadev-labs/zuix-zout/dist/zout.css", "@zuccadev-labs/zuix-zout/dist/zout.dom.js", "@zuccadev-labs/zuix-zout/styles.compat.css", "@zuccadev-labs/zuix-zout/dist/zout.compat.css",
  "@zuccadev-labs/zuix-tokens/tokens.css", "@zuccadev-labs/zuix-tokens/tokens.json", "@zuccadev-labs/zuix-tokens/css/dazlabs.css",
  "@zuccadev-labs/zuix-tokens/tokens.compat.css", "@zuccadev-labs/zuix-tokens/css/zenith.compat.css",
];
for (const s of specs) {
  const file = resolve(s);
  assert.ok(readFileSync(file).length > 0, s);
  assert.ok(file.includes("/.tmp/consumer/") && !file.includes("/src/"), s + " debe resolver al paquete instalado, no al workspace");
}
assert.ok(JSON.parse(readFileSync(resolve("@zuccadev-labs/zuix-zui/manifest.json"), "utf8")).count > 0);
// "use client" llega a la salida compilada de un componente con estado, y no a uno estático.
const zui = resolve("@zuccadev-labs/zuix-zui").replace(/index\\.js$/, "");
assert.match(readFileSync(zui + "components/overlay/Modal.js", "utf8"), /^"use client";/);
assert.doesNotMatch(readFileSync(zui + "components/actions/Button.js", "utf8"), /use client/);
// Los bundles de navegador no importan nada externo.
for (const s of ["@zuccadev-labs/zuix-zui/dist/zui.dom.js", "@zuccadev-labs/zuix-zout/dist/zout.dom.js", "@zuccadev-labs/zuix-zicon/dist/zicon.element.js"])
  assert.doesNotMatch(readFileSync(resolve(s), "utf8"), /from\\s*["'](?!\\.)/, s + " es autocontenido");
console.log("subpaths: " + specs.length + " entradas de exports resuelven a archivos publicados");
`,
      "client.mjs": `import assert from "node:assert/strict";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
GlobalRegistrator.register({ url: "http://localhost/" });
// Cualquier aviso de React (refs en componentes de función, atributos desconocidos o mal tipados) hace fallar la prueba.
const problems = [];
for (const level of ["error", "warn"]) console[level] = (...args) => problems.push(level + ": " + args.map(String).join(" ").slice(0, 400));
const { createElement: h, createRef, version } = await import("react");
const { flushSync } = await import("react-dom");
const { createRoot } = await import("react-dom/client");
await import("@zuccadev-labs/zuix-zicon/all");
const { Icon } = await import("@zuccadev-labs/zuix-zicon");
const { Button, Input, Skeleton, Modal, Switch } = await import("@zuccadev-labs/zuix-zui");
const { Navbar } = await import("@zuccadev-labs/zuix-zout");
assert.equal(version.split(".")[0], "${major}", "React instalado");
const refs = { button: createRef(), icon: createRef(), input: createRef(), toggle: createRef(), trigger: createRef() };
const container = document.createElement("div");
document.body.append(container);
const root = createRoot(container);
flushSync(() =>
  root.render(
    h("div", null,
      h(Button, { ref: refs.button }, "Save"),
      h(Icon, { name: "bell", ref: refs.icon }),
      h(Input, { ref: refs.input, "aria-label": "Name" }),
      h(Switch, { ref: refs.toggle, "aria-label": "Wi-Fi" }),
      h(Skeleton, { loading: true }, h("span", null, "Loaded")),
      h(Modal, { title: "Edit", trigger: h(Button, { ref: refs.trigger }, "Open") }, "Body"),
      h(Navbar, { brand: "Acme", items: [{ label: "Docs", href: "#docs" }] }),
    ),
  ),
);
await new Promise((resolve) => setTimeout(resolve, 20));
assert.equal(refs.button.current?.tagName, "BUTTON", "ref de Button");
assert.equal(refs.icon.current?.tagName.toLowerCase(), "svg", "ref de Icon");
assert.equal(refs.input.current?.tagName, "INPUT", "ref de Input");
assert.equal(refs.toggle.current?.getAttribute("role"), "switch", "ref de Switch");
// La ref del disparador de Modal (Slot) se une a la propia del componente: el botón la recibe y abre el diálogo.
assert.equal(refs.trigger.current?.textContent, "Open", "ref del disparador de Modal");
assert.equal(container.querySelector(".z-skeleton")?.getAttribute("inert"), "", "Skeleton con contenido lleva inert");
assert.equal(container.querySelector(".z-navbar__toggle")?.getAttribute("popovertarget"), container.querySelector(".z-navbar__menu")?.id, "popovertarget del Navbar");
flushSync(() => root.unmount());
assert.equal(refs.button.current, null, "la ref se limpia al desmontar");
assert.deepEqual(problems, [], "consola sin avisos");
console.log("client: React " + version + " · refs, inert y popovertarget sin avisos");
// Sin unregister: el planificador de React puede tener trabajo pendiente que aún lee window.
process.exit(0);
`,
      "tsconfig.json": JSON.stringify(
        {
          compilerOptions: {
            target: "ES2022",
            module: "ESNext",
            moduleResolution: "Bundler",
            jsx: "react-jsx",
            lib: ["ES2022", "DOM", "DOM.Iterable"],
            strict: true,
            noEmit: true,
            skipLibCheck: false,
            types: [],
            resolveJsonModule: true,
          },
          include: ["src"],
        },
        null,
        2,
      ),
      "tsconfig.nodenext.json": JSON.stringify(
        { extends: "./tsconfig.json", compilerOptions: { module: "NodeNext", moduleResolution: "NodeNext" } },
        null,
        2,
      ),
      "index.html": `<!doctype html><html data-theme="dark"><head><meta charset="utf-8"><title>consumer</title></head><body class="z-root z-canvas"><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>\n`,
      "vite.config.mjs": `import { defineConfig } from "vite";\nexport default defineConfig({ oxc: { jsx: { runtime: "automatic" } }, logLevel: "warn", build: { outDir: "out" } });\n`,
      "src/css.d.ts": `declare module "*.css";\n`,
      // El mismo uso a través del paraguas: tipos en Bundler y NodeNext, y CSS con @import de paquetes en Vite.
      "umbrella.html": `<!doctype html><html data-theme="dark"><head><meta charset="utf-8"><title>umbrella</title></head><body class="z-root z-canvas"><div id="root"></div><script type="module" src="/src/umbrella.tsx"></script></body></html>\n`,
      "vite.umbrella.config.mjs": `import { defineConfig } from "vite";\nexport default defineConfig({ oxc: { jsx: { runtime: "automatic" } }, logLevel: "warn", build: { outDir: "out-umbrella", rolldownOptions: { input: "umbrella.html" } } });\n`,
      // Modo compat por el paraguas: una sola hoja con tokens, zui y zout ya bajados (docs/users/10-compatibilidad.md).
      "compat.html": `<!doctype html><html data-theme="dark"><head><meta charset="utf-8"><title>compat</title></head><body class="z-root z-canvas"><button class="z-btn z-btn--primary">Ok</button><script type="module" src="/src/compat.ts"></script></body></html>\n`,
      "vite.compat.config.mjs": `import { defineConfig } from "vite";\nexport default defineConfig({ logLevel: "warn", build: { outDir: "out-compat", rolldownOptions: { input: "compat.html" } } });\n`,
      "src/compat.ts": `import "@zuccadev-labs/zuix/styles.compat.css";
import { init } from "@zuccadev-labs/zuix/zui/dom";
init();
`,
      "src/umbrella.tsx": `import "@zuccadev-labs/zuix/styles.css";
import { createRoot } from "react-dom/client";
import { Icon, registerIcons, type IconName } from "@zuccadev-labs/zuix/zicon/core";
import { plus } from "@zuccadev-labs/zuix-zicon/icons/plus";
import { Button, Modal, type ButtonProps } from "@zuccadev-labs/zuix/zui";
import { Page, Stack, type ShellProps } from "@zuccadev-labs/zuix/zout";
import { init, toast, type ToastOptions } from "@zuccadev-labs/zuix/zui/dom";
import { init as initLayouts } from "@zuccadev-labs/zuix/zout/dom";
import { iconSvg } from "@zuccadev-labs/zuix/zicon/dom";
import { zui, zout, zicon } from "@zuccadev-labs/zuix";

registerIcons([plus]);
const icon: IconName = "plus";
const props: ButtonProps = { variant: "primary", icon };
const options: ToastOptions = { title: "Saved", intent: "success" };
const shell: Partial<ShellProps> = {};
const same: typeof Button = zui.Button;
// @ts-expect-error un nombre de icono inexistente tampoco compila a través del paraguas
const wrong: IconName = "no-such-icon";
void wrong; void shell; void iconSvg; void same; void zout.Stack; void zicon.Icon;

createRoot(document.getElementById("root")!).render(
  <Page>
    <Stack gap={4}>
      <Button {...props} onClick={() => toast(options)}>New project</Button>
      <Icon name={icon} label="Add" />
      <Modal trigger={<Button>Open</Button>} title="Edit">Body</Modal>
    </Stack>
  </Page>,
);
init();
initLayouts();
`,
      "src/main.tsx": `import "@zuccadev-labs/zuix-tokens/tokens.css";
import "@zuccadev-labs/zuix-zui/styles.css";
import "@zuccadev-labs/zuix-zout/styles.css";
import { createRef } from "react";
import { createRoot } from "react-dom/client";
import { Icon, registerIcons, type IconName } from "@zuccadev-labs/zuix-zicon/core";
import { plus } from "@zuccadev-labs/zuix-zicon/icons/plus";
import { bell } from "@zuccadev-labs/zuix-zicon/icons/bell";
import { Button, Modal, ToastProvider, type ButtonProps } from "@zuccadev-labs/zuix-zui";
import { Page, Stack, Shell, type ShellProps } from "@zuccadev-labs/zuix-zout";
import { toast, init, type ToastOptions } from "@zuccadev-labs/zuix-zui/dom";
import { init as initLayouts } from "@zuccadev-labs/zuix-zout/dom";
import { iconSvg } from "@zuccadev-labs/zuix-zicon/dom";

registerIcons([plus, bell]);
// Refs a componentes con los tipos de @types/react 18 y 19.
const saveRef = createRef<HTMLButtonElement>();
const iconRef = createRef<SVGSVGElement>();
const icon: IconName = "bell";
const props: ButtonProps = { variant: "primary", icon: "plus" };
const options: ToastOptions = { title: "Saved", intent: "success" };
const shell: Partial<ShellProps> = {};
// @ts-expect-error un nombre de icono inexistente no compila
const wrong: IconName = "no-such-icon";
void wrong; void shell; void Shell; void iconSvg;

createRoot(document.getElementById("root")!).render(
  <ToastProvider>
    <Page>
      <Stack gap={4}>
        <Button {...props} ref={saveRef} onClick={() => toast(options)}>New project</Button>
        <Icon name={icon} label="Alerts" ref={iconRef} />
        <Modal trigger={<Button>Open</Button>} title="Edit">Body</Modal>
      </Stack>
    </Page>
  </ToastProvider>,
);
init();
initLayouts();
`,
    },
  );
  if (step(`${name}: pnpm install desde los tarballs, fuera del workspace`, "pnpm", install, reactDir).ok) {
    step(`${name}: render con react-dom/server`, "node", ["ssr.mjs"], reactDir);
    step(`${name}: render en un DOM, refs y consola sin avisos`, "node", ["client.mjs"], reactDir);
    step(`${name}: subpath exports`, "node", ["subpaths.mjs"], reactDir);
    // Las declaraciones se emiten con TypeScript 7 y las consume quien siga en 5.x: se comprueban con los dos compiladores,
    // cada uno por su ruta (los dos paquetes declaran el binario `tsc`).
    // Con React 18 (y @types/react 18) basta con los extremos: 5.9 y 7.
    for (const [label, pkg] of [["TS 5.9", "typescript"], ...(major === 19 ? [["TS 6", "typescript-6"]] : []), ["TS 7", "typescript-7"]]) {
      const tsc = join(reactDir, "node_modules", pkg, "bin/tsc");
      step(`${name}: tsc --noEmit con ${label} (Bundler, skipLibCheck: false)`, "node", [tsc, "-p", "tsconfig.json"], reactDir);
      step(`${name}: tsc --noEmit con ${label} (NodeNext, skipLibCheck: false)`, "node", [tsc, "-p", "tsconfig.nodenext.json"], reactDir);
    }
    if (step(`${name}: vite build`, "pnpm", ["exec", "vite", "build"], reactDir).ok) {
      const out = walk(join(reactDir, "out"));
      const css = out
        .filter((f) => f.endsWith(".css"))
        .map((f) => readFileSync(f, "utf8"))
        .join("");
      const js = out
        .filter((f) => f.endsWith(".js"))
        .map((f) => readFileSync(f, "utf8"))
        .join("");
      if (!css.includes(".z-btn") || !css.includes(".z-shell") || !css.includes("--z-"))
        bad(`${name} vite: el CSS compilado no trae zui, zout y tokens`);
      else if (!js.includes("z-btn--")) bad(`${name} vite: el JS compilado no trae los componentes`);
      // Solo se registraron dos iconos: el set completo no debe entrar en el bundle.
      else if (iconsIn(js).found > ICON_LIMIT)
        bad(`${name} vite: el bundle trae ${iconsIn(js).found} de ${iconsIn(js).total} iconos; el set completo no se está descartando`);
      else
        ok(
          `${name} vite: CSS ${(css.length / 1024).toFixed(0)} kB con tokens, zui y zout · JS ${(js.length / 1024).toFixed(0)} kB con ${iconsIn(js).found} de ${iconsIn(js).total} iconos`,
        );
    }
    if (
      step(`${name}: vite build a través del paraguas`, "pnpm", ["exec", "vite", "build", "--config", "vite.umbrella.config.mjs"], reactDir)
        .ok
    ) {
      const out = walk(join(reactDir, "out-umbrella"));
      const css = out
        .filter((f) => f.endsWith(".css"))
        .map((f) => readFileSync(f, "utf8"))
        .join("");
      const js = out
        .filter((f) => f.endsWith(".js"))
        .map((f) => readFileSync(f, "utf8"))
        .join("");
      if (!css.includes(".z-btn") || !css.includes(".z-shell") || !css.includes("--z-") || css.includes("@import"))
        bad(`${name} vite (paraguas): @zuccadev-labs/zuix/styles.css no trae tokens, zui y zout resueltos`);
      else if (!js.includes("z-btn--")) bad(`${name} vite (paraguas): el JS compilado no trae los componentes`);
      else if (iconsIn(js).found > ICON_LIMIT)
        bad(
          `${name} vite (paraguas): el bundle trae ${iconsIn(js).found} de ${iconsIn(js).total} iconos; el paraguas arrastra el set completo`,
        );
      else
        ok(
          `${name} vite (paraguas): styles.css resuelve sus @import (CSS ${(css.length / 1024).toFixed(0)} kB) · JS ${(js.length / 1024).toFixed(0)} kB con ${iconsIn(js).found} de ${iconsIn(js).total} iconos`,
        );
    }
  }
  // La hoja compat no depende de la versión de React: basta con un consumidor.
  if (
    major === 19 &&
    step(
      "react: vite build de la hoja compat del paraguas",
      "pnpm",
      ["exec", "vite", "build", "--config", "vite.compat.config.mjs"],
      reactDir,
    ).ok
  ) {
    const css = walk(join(reactDir, "out-compat"))
      .filter((f) => f.endsWith(".css"))
      .map((f) => readFileSync(f, "utf8"))
      .join("");
    const left = [
      ["@import", "@import"],
      ["@layer", /@layer\b/],
      ["color-mix()", /color-mix\(/i],
    ].filter(([, re]) => (typeof re === "string" ? css.includes(re) : re.test(css)));
    if (!css.includes(".z-btn") || !css.includes(".z-shell") || !css.includes("--z-compat-"))
      bad("vite (compat): @zuccadev-labs/zuix/styles.compat.css no trae los tokens compat, zui y zout");
    else if (left.length) bad(`vite (compat): la hoja compilada aún lleva ${left.map(([n]) => n).join(", ")}`);
    else ok(`vite (compat): styles.compat.css resuelve sus @import, sin @layer ni color-mix() (CSS ${(css.length / 1024).toFixed(0)} kB)`);
  }
}

// ── 4. Consumidor sin React ───────────────────────────────────────────────────────────────────────
const domDir = project(
  "dom",
  { dependencies: { ...zuixDeps } },
  {
    "dom.mjs": `import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const here = createRequire(import.meta.url);
for (const from of [import.meta.url, import.meta.resolve("@zuccadev-labs/zuix-zui/dom"), import.meta.resolve("@zuccadev-labs/zuix-zicon/dom"), import.meta.resolve("@zuccadev-labs/zuix-zout/dom")]) {
  const require = createRequire(from);
  for (const name of ["react", "react-dom"]) assert.throws(() => require.resolve(name), new RegExp("Cannot find module"), name + " no debe estar instalado (" + from + ")");
}
void here;
const zicon = await import("@zuccadev-labs/zuix-zicon/dom");
const { bell } = await import("@zuccadev-labs/zuix-zicon/icons/bell");
zicon.registerIcons([bell]);
const svg = zicon.iconSvg("bell", { size: 20, label: "Alerts" });
assert.match(svg, /^<svg xmlns="http:\\/\\/www.w3.org\\/2000\\/svg" viewBox="0 0 24 24" width="20" height="20"/);
assert.ok(svg.includes('class="z-icon"') && svg.includes("<path"));
const zui = await import("@zuccadev-labs/zuix-zui/dom");
for (const fn of ["init", "hydrate", "toast", "confirm", "openDialog", "closeDialog", "openPopover", "setTheme", "setBrand", "carousel"]) assert.equal(typeof zui[fn], "function", "zui/dom." + fn);
// Entradas por familia: el núcleo y cada familia cargan solas y exportan su módulo para init()/use().
const core = await import("@zuccadev-labs/zuix-zui/dom/core");
for (const fn of ["init", "use", "hydrate", "destroy", "toast", "confirm", "openDialog", "openPopover", "setSelectValue"]) assert.equal(typeof core[fn], "function", "zui/dom/core." + fn);
assert.equal(zui.toast, core.toast, "zui/dom reexporta el núcleo de zui/dom/core");
const families = { dates: "datesModule", data: "dataModule", content: "contentModule", agenda: "agendaModule", charts: "chartsModule", color: "colorModule", media: "mediaModule", effects: "effectsModule", time: "timeModule", terminal: "terminalModule", chat: "chatModule", ai: "aiModule", dashboard: "dashboardModule", people: "peopleModule", nodes: "nodesModule", page: "pageModule" };
for (const [family, name] of Object.entries(families)) {
  const mod = await import("@zuccadev-labs/zuix-zui/dom/" + family);
  assert.ok(Array.isArray(mod[name]?.parts), "zui/dom/" + family + "." + name);
  assert.equal(zui[name], mod[name], "zui/dom reexporta " + name);
  assert.equal((await import("@zuccadev-labs/zuix/zui/dom/" + family))[name], mod[name], "el paraguas reexporta zui/dom/" + family);
}
assert.equal((await import("@zuccadev-labs/zuix/zui/dom/core")).toast, core.toast, "el paraguas reexporta zui/dom/core");
const zout = await import("@zuccadev-labs/zuix-zout/dom");
for (const fn of ["init", "hydrate", "setPanelOpen", "addWorkTab"]) assert.equal(typeof zout[fn], "function", "zout/dom." + fn);
// Los módulos dom de zui registran sus iconos en el mismo registro que usa la aplicación.
assert.ok(zicon.registeredIconNames().includes("x-mark"), "registro compartido entre zui/dom y zicon/dom");
// El set completo y el elemento también cargan en Node (el elemento no se define sin navegador).
await import("@zuccadev-labs/zuix-zicon/element");
assert.ok(zicon.registeredIconNames().length >= 300);
// Las subrutas sin framework del paraguas cargan sin React y son los mismos módulos.
const viaUmbrella = await import("@zuccadev-labs/zuix/zui/dom");
assert.equal(viaUmbrella.init, zui.init, "el paraguas reexporta el mismo zui/dom");
assert.equal((await import("@zuccadev-labs/zuix/zout/dom")).init, zout.init);
assert.equal((await import("@zuccadev-labs/zuix/zicon/dom")).iconSvg, zicon.iconSvg);
await import("@zuccadev-labs/zuix/zicon/element");
// Conector de editores: sin React, con el catálogo como JSON (paquete suelto) y como módulo (paraguas).
const editor = await import("@zuccadev-labs/zuix-zui/editor");
const { default: catalog } = await import("@zuccadev-labs/zuix-zui/editor/catalog.json", { with: { type: "json" } });
assert.equal(catalog.schemaVersion, editor.CATALOG_SCHEMA_VERSION);
assert.equal((await import("@zuccadev-labs/zuix/editor/catalog")).default.zuix, catalog.zuix, "el paraguas reexporta el catálogo");
assert.equal((await import("@zuccadev-labs/zuix/editor")).toHTML, editor.toHTML, "el paraguas reexporta el conector");
const page = editor.migrateDocument([{ type: "Button", props: { variant: "primary", icon: "plus" }, children: ["New"] }]).document;
assert.ok(editor.validateDocument(page, catalog).valid, "el documento migrado valida");
assert.equal(editor.toHTML(page, { catalog }), '<button type="button" class="z-btn z-btn--primary" data-size="md"><z-icon name="plus" size="16"></z-icon>New</button>');
assert.equal(editor.validateDocument({ ...page, body: [{ id: "x", type: "IconButton", props: { icon: "plus" } }] }, catalog).errors[0].code, "a11y.name");
for (const f of ["catalog.schema.json", "document.schema.json"]) assert.ok(JSON.parse(readFileSync(new URL(import.meta.resolve("@zuccadev-labs/zuix-zui/editor/" + f)), "utf8")).$schema);
// El binding de React sí debe fallar aquí: confirma que React no llegó por otra vía.
await assert.rejects(() => import("@zuccadev-labs/zuix-zui"), /Cannot find package 'react/);
console.log("dom: @zuccadev-labs/zuix-zicon/dom, @zuccadev-labs/zuix-zui/dom y @zuccadev-labs/zuix-zout/dom cargan en Node sin React instalado");
`,
  },
);
if (step("dom: pnpm install desde los tarballs, sin React", "pnpm", install, domDir).ok) {
  step("dom: importar zicon/dom, zui/dom y zout/dom sin React", "node", ["dom.mjs"], domDir);
  await domTreeShaking(domDir);
}

/**
 * Lo que arrastra cada entrada de zui/dom en un bundler, con los paquetes instalados (dist/esm y su `sideEffects`).
 * Se cuentan iconos y se buscan clases propias de cada familia, no kilobytes: así la prueba no depende del tamaño de
 * cada componente. Quien solo toma toast() del núcleo (o de la entrada completa) no debe cargar la agenda, los
 * gráficos ni el ColorPicker; init() del núcleo tampoco; init() de la entrada completa los trae todos.
 */
async function domTreeShaking(dir) {
  const { build } = await import("esbuild");
  const MARKS = { agenda: "z-agenda__move-field", charts: "z-chart__axis", color: "z-colorpicker__area", calendar: "z-calendar__grid" };
  const bundle = async (code) => {
    const out = await build({
      stdin: { contents: code, resolveDir: dir, loader: "js" },
      absWorkingDir: dir,
      bundle: true,
      format: "esm",
      minify: true,
      write: false,
      logLevel: "silent",
      external: ["*/carousel-gl.js"],
    });
    const js = out.outputFiles[0].text;
    return {
      js,
      kb: (js.length / 1024).toFixed(1),
      icons: iconsIn(js).found,
      has: Object.keys(MARKS).filter((k) => js.includes(MARKS[k])),
    };
  };
  const cases = [
    [
      "toast() de zui/dom/core",
      'import { toast } from "@zuccadev-labs/zuix-zui/dom/core"; toast({ title: "x" });',
      { maxIcons: 3, none: ["agenda", "charts", "color", "calendar"] },
    ],
    [
      "toast() de zui/dom",
      'import { toast } from "@zuccadev-labs/zuix-zui/dom"; toast({ title: "x" });',
      { maxIcons: 3, none: ["agenda", "charts", "color", "calendar"] },
    ],
    [
      "toast() del paraguas zui/dom/core",
      'import { toast } from "@zuccadev-labs/zuix/zui/dom/core"; toast({ title: "x" });',
      { maxIcons: 3, none: ["agenda", "charts", "color", "calendar"] },
    ],
    [
      "init() de zui/dom/core",
      'import { init } from "@zuccadev-labs/zuix-zui/dom/core"; init();',
      { none: ["agenda", "charts", "color", "calendar"] },
    ],
    [
      "init(agendaModule) de zui/dom/core",
      'import { init } from "@zuccadev-labs/zuix-zui/dom/core"; import { agendaModule } from "@zuccadev-labs/zuix-zui/dom/agenda"; init(agendaModule);',
      { all: ["agenda", "calendar"], none: ["charts", "color"] },
    ],
    [
      "init() de zui/dom",
      'import { init } from "@zuccadev-labs/zuix-zui/dom"; init();',
      { all: ["agenda", "charts", "color", "calendar"] },
    ],
  ];
  for (const [name, code, want] of cases) {
    let r;
    try {
      r = await bundle(code);
    } catch (error) {
      bad(`dom (bundler): ${name} no compila: ${String(error.message).split("\n")[0]}`);
      continue;
    }
    const extra = (want.none ?? []).filter((k) => r.has.includes(k));
    const missing = (want.all ?? []).filter((k) => !r.has.includes(k));
    const summary = `${r.kb} kB, ${r.icons} iconos${r.has.length ? `, con ${r.has.join(", ")}` : ""}`;
    if (extra.length) bad(`dom (bundler): ${name} arrastra ${extra.join(", ")} (${summary})`);
    else if (missing.length) bad(`dom (bundler): ${name} no trae ${missing.join(", ")} (${summary})`);
    else if (want.maxIcons !== undefined && r.icons > want.maxIcons)
      bad(`dom (bundler): ${name} trae ${r.icons} iconos (máximo ${want.maxIcons})`);
    else ok(`dom (bundler): ${name} · ${summary}`);
  }
}

// ── 5. Consumidor Next.js (App Router), con --next ────────────────────────────────────────────────
// El registro de iconos es estado de módulo y Next compila dos grafos: el de Server Components y el de Client
// Components (que se renderiza en servidor y en el navegador). `@zuccadev-labs/zuix-zicon/all` se importa en los dos:
// en app/layout.tsx (servidor) y en app/providers.tsx ("use client").
if (args.has("--next")) {
  const nextDir = project(
    "next",
    {
      dependencies: { ...zuixDeps, next: "latest", react: "^19.0.0", "react-dom": "^19.0.0" },
      devDependencies: { "@types/node": "^24.0.0", "@types/react": "^19.0.0", "@types/react-dom": "^19.0.0", typescript: "^5.9.0" },
    },
    {
      // Raíz propia: sin esto Next toma el lockfile del workspace de zuix como raíz del proyecto.
      "next.config.mjs": `import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
export default { turbopack: { root: here }, outputFileTracingRoot: here };
`,
      // skipLibCheck: true es el valor de Next (sus propias declaraciones no pasan sin él). Las de zuix ya se comprueban en el consumidor de React.
      "tsconfig.json": JSON.stringify(
        {
          compilerOptions: {
            target: "ES2022",
            lib: ["dom", "dom.iterable", "esnext"],
            allowJs: true,
            module: "esnext",
            moduleResolution: "bundler",
            jsx: "react-jsx",
            strict: true,
            noEmit: true,
            skipLibCheck: true,
            esModuleInterop: true,
            resolveJsonModule: true,
            isolatedModules: true,
            incremental: true,
            plugins: [{ name: "next" }],
          },
          include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts", ".next/dev/types/**/*.ts"],
          exclude: ["node_modules"],
        },
        null,
        2,
      ),
      // Icono de la aplicación: sin él Chrome pide /favicon.ico y el 404 llega a la consola.
      "app/icon.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="currentColor"/></svg>\n`,
      "app/(packages)/layout.tsx": `import type { ReactNode } from "react";
import "@zuccadev-labs/zuix-tokens/tokens.css";
import "@zuccadev-labs/zuix-zui/styles.css";
import "@zuccadev-labs/zuix-zout/styles.css";
import "@zuccadev-labs/zuix-zicon/all"; // iconos de los Server Components
import { Providers } from "./providers";

export const metadata = { title: "consumer-next" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="dark">
      <body className="z-root z-canvas">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
`,
      "app/(packages)/providers.tsx": `"use client";
import type { ReactNode } from "react";
import "@zuccadev-labs/zuix-zicon/all"; // iconos de los Client Components, en su render de servidor y en el navegador
import { ToastProvider } from "@zuccadev-labs/zuix-zui";

export function Providers({ children }: { children: ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}
`,
      // Server Component: componentes de solo marcado, y componentes de cliente usados directamente con props serializables.
      "app/(packages)/content.tsx": `import { Icon } from "@zuccadev-labs/zuix-zicon/core";
import { Accordion, Badge, Button, Callout, Card, EmptyState, Kbd, Modal, Progress, Tabs } from "@zuccadev-labs/zuix-zui";
import { Inline, Page, PageHeader, PageSection, Stack } from "@zuccadev-labs/zuix-zout";
import { Interactive } from "./interactive";

export function Content({ mode }: { mode: string }) {
  return (
    <Page header={<PageHeader title="Server page" description={"Rendered as a Server Component (" + mode + ")"} actions={<Button variant="primary" icon="plus">New project</Button>} />}>
      <Stack gap={4}>
        <section data-testid="server">
          <Inline gap={2}>
            <Badge tone="success">Live</Badge>
            <Icon name="bell" label="Alerts" />
            <Icon name="star" variant="solid" />
            <Kbd>Ctrl K</Kbd>
          </Inline>
          <Progress value={40} label="Upload" />
          <Callout tone="info" title="Heads up">Static markup only.</Callout>
          <Card><EmptyState icon="folder" title="No projects" description="Create the first one." /></Card>
        </section>
        <PageSection title="Client components used from the server">
          <div data-testid="server-client">
            <Modal trigger={<Button data-testid="open-modal" icon="pencil">Edit</Button>} title="Edit profile" footer={<Button variant="primary">Done</Button>}>
              Modal body
            </Modal>
            <Tabs label="Sections" items={[
              { value: "one", label: "One", icon: "home", content: <p data-testid="panel-one">First panel</p> },
              { value: "two", label: "Two", icon: "bell", content: <p data-testid="panel-two">Second panel</p> },
            ]} />
            <Accordion items={[
              { value: "a", title: "Billing", icon: "credit-card", content: <p data-testid="acc-a">Billing content</p> },
              { value: "b", title: "Team", icon: "users", content: <p data-testid="acc-b">Team content</p> },
            ]} />
          </div>
        </PageSection>
        <PageSection title="Client module">
          <Interactive />
        </PageSection>
      </Stack>
    </Page>
  );
}
`,
      "app/(packages)/page.tsx": `import { Content } from "./content";
export default function Home() { return <Content mode="static" />; }
`,
      "app/(packages)/dynamic/page.tsx": `import { Content } from "../content";
export const dynamic = "force-dynamic";
export default function Dynamic() { return <Content mode="dynamic" />; }
`,
      "app/(packages)/interactive.tsx": `"use client";
import { useState } from "react";
import { Button, DatePicker, Field, Input, Menu, Select, Switch, useToast } from "@zuccadev-labs/zuix-zui";

export function Interactive() {
  const { toast } = useToast();
  const [picked, setPicked] = useState("none");
  const [fruit, setFruit] = useState("");
  const [on, setOn] = useState(false);
  return (
    <div data-testid="client">
      <Menu label="Actions" trigger={<Button data-testid="open-menu" icon="ellipsis-horizontal">Actions</Button>} items={[
        { id: "rename", label: "Rename", icon: "pencil", onSelect: () => setPicked("rename") },
        { id: "delete", label: "Delete", icon: "trash", danger: true, onSelect: () => setPicked("delete") },
      ]} />
      <output data-testid="picked">{picked}</output>
      <Select aria-label="Fruit" placeholder="Pick a fruit" value={fruit} onValueChange={setFruit} options={[{ value: "apple", label: "Apple" }, { value: "pear", label: "Pear" }]} />
      <output data-testid="fruit">{fruit}</output>
      <Field label="Name" hint="As shown to others"><Input placeholder="Ada" /></Field>
      <DatePicker aria-label="Due date" />
      <Switch checked={on} onCheckedChange={setOn}>Notifications</Switch>
      <output data-testid="switch">{String(on)}</output>
      <Button data-testid="toast" icon="check" onClick={() => toast({ title: "Saved", intent: "success" })}>Save</Button>
    </div>
  );
}
`,
      // Página de cliente con los layouts de zout que miden el contenedor.
      "app/(packages)/shell/page.tsx": `"use client";
import { useState } from "react";
import { Button } from "@zuccadev-labs/zuix-zui";
import { Pane, Rail, RailItem, Shell, Sidebar, SidebarSection, SplitPane, TitleBar } from "@zuccadev-labs/zuix-zout";

export default function ShellPage() {
  const [open, setOpen] = useState(true);
  return (
    <div style={{ height: "100vh" }}>
      <Shell
        titlebar={<TitleBar actions={<Button data-testid="toggle-sidebar" size="sm" icon="bars-3" onClick={() => setOpen((v) => !v)}>Sidebar</Button>}>Workspace</TitleBar>}
        rail={<Rail label="Primary"><RailItem icon="home" label="Home" active /><RailItem icon="cog" label="Settings" /></Rail>}
        sidebar={{ label: "Explorer", open, content: <Sidebar><SidebarSection title="Files">File list</SidebarSection></Sidebar> }}
        onCloseOverlay={() => setOpen(false)}
      >
        <SplitPane><Pane header="Left">Left pane</Pane><Pane header="Right">Right pane</Pane></SplitPane>
      </Shell>
    </div>
  );
}
`,
      // Ruta /umbrella: lo mismo que /shell, pero todo llega por el paquete paraguas (@zuccadev-labs/zuix/zui, /zout, /zicon)
      // y los estilos por un solo @import. Tiene su propio layout raíz (grupo de rutas): no hereda las hojas ni el
      // registro de iconos de las rutas que importan los paquetes uno a uno.
      "app/(umbrella)/globals.css": `@import "@zuccadev-labs/zuix/styles.css";\n`,
      "app/(umbrella)/layout.tsx": `import type { ReactNode } from "react";
import "./globals.css";
import "@zuccadev-labs/zuix/zicon/all"; // iconos de los Server Components, registrados a través del paraguas

export const metadata = { title: "consumer-next-umbrella" };

export default function UmbrellaLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="dark">
      <body className="z-root z-canvas">{children}</body>
    </html>
  );
}
`,
      // Server Component: el icono se dibuja con el Icon del paraguas y con el de @zuccadev-labs/zuix-zicon/core; los dos leen el
      // registro que llenó el layout a través de @zuccadev-labs/zuix/zicon/all.
      "app/(umbrella)/umbrella/page.tsx": `import { Icon } from "@zuccadev-labs/zuix/zicon/core";
import { Icon as PackageIcon } from "@zuccadev-labs/zuix-zicon/core";
import { UmbrellaShell } from "./shell";

export default function UmbrellaPage() {
  return (
    <div style={{ height: "100vh" }}>
      <span data-testid="server-icons"><Icon name="star" /><PackageIcon name="folder" /></span>
      <UmbrellaShell />
    </div>
  );
}
`,
      "app/(umbrella)/umbrella/shell.tsx": `"use client";
import { useState } from "react";
import "@zuccadev-labs/zuix/zicon/all"; // iconos de los Client Components, registrados a través del paraguas
import { Icon } from "@zuccadev-labs/zuix/zicon/core";
import { Button } from "@zuccadev-labs/zuix/zui";
import { Pane, Rail, RailItem, Shell, Sidebar, SidebarSection, SplitPane, TitleBar } from "@zuccadev-labs/zuix/zout";

export function UmbrellaShell() {
  const [open, setOpen] = useState(true);
  return (
    <Shell
      titlebar={<TitleBar actions={<Button data-testid="toggle-sidebar" size="sm" icon="bars-3" onClick={() => setOpen((v) => !v)}>Sidebar</Button>}><Icon name="bell" /> Workspace</TitleBar>}
      rail={<Rail label="Primary"><RailItem icon="home" label="Home" active /><RailItem icon="cog" label="Settings" /></Rail>}
      sidebar={{ label: "Explorer", open, content: <Sidebar><SidebarSection title="Files">File list</SidebarSection></Sidebar> }}
      onCloseOverlay={() => setOpen(false)}
    >
      <SplitPane><Pane header="Left">Left pane</Pane><Pane header="Right">Right pane</Pane></SplitPane>
    </Shell>
  );
}
`,
    },
    ["sharp"],
  );

  const nextBin = join(nextDir, "node_modules/next/dist/bin/next");
  const nextEnv = { ...process.env, NEXT_TELEMETRY_DISABLED: "1", FORCE_COLOR: "0", NO_COLOR: "1" };
  delete nextEnv.NODE_ENV;
  let built = false;
  if (step("next: pnpm install desde los tarballs (next@latest), fuera del workspace", "pnpm", install, nextDir).ok) {
    const version = JSON.parse(readFileSync(join(nextDir, "node_modules/next/package.json"), "utf8")).version;
    const r = spawnSync(process.execPath, [nextBin, "build"], { cwd: nextDir, encoding: "utf8", timeout: 600_000, env: nextEnv });
    const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
    if (r.status !== 0)
      bad(
        `next ${version}: next build\n${out
          .split("\n")
          .slice(-40)
          .map((l) => `    ${l}`)
          .join("\n")}`,
      );
    // En CI, Next avisa de que no hay caché de compilación: no dice nada del paquete y no cuenta como aviso.
    else if (
      /\[zicon\]|Warning:|⚠/.test(
        out
          .split("\n")
          .filter((l) => !/No build cache found/.test(l))
          .join("\n"),
      )
    )
      bad(
        `next ${version}: next build pasa con avisos\n${out
          .split("\n")
          .filter((l) => /\[zicon\]|Warning:|⚠/.test(l) && !/No build cache found/.test(l))
          .slice(0, 10)
          .map((l) => `    ${l}`)
          .join("\n")}`,
      );
    else {
      built = true;
      ok(`next ${version}: next build (App Router, Turbopack) sin avisos; rutas / (estática), /dynamic, /shell y /umbrella`);
    }
  }
  if (built) {
    const port = await new Promise((resolve, reject) => {
      const s = net.createServer();
      s.once("error", reject);
      s.listen(0, "127.0.0.1", () => {
        const { port } = s.address();
        s.close(() => resolve(port));
      });
    });
    const server = spawn(process.execPath, [nextBin, "start", "-p", String(port), "-H", "127.0.0.1"], {
      cwd: nextDir,
      stdio: ["ignore", "pipe", "pipe"],
      env: nextEnv,
    });
    let log = "";
    server.stdout.on("data", (d) => {
      log += d;
    });
    server.stderr.on("data", (d) => {
      log += d;
    });
    const base = `http://127.0.0.1:${port}`;
    let browser;
    // biome-ignore lint/suspicious/noControlCharactersInRegex: casa los códigos de color ANSI (ESC[…m) para quitarlos del mensaje de Playwright.
    const ANSI = /\u001b\[\d+m/g;
    const check = async (name, fn) => {
      try {
        const detail = await fn();
        ok(`next: ${name}${detail ? ` · ${detail}` : ""}`);
      } catch (error) {
        bad(
          `next: ${name} — ${String(error?.message ?? error)
            .replace(ANSI, "")
            .split("\n")
            .slice(0, 6)
            .join("\n    ")}`,
        );
      }
    };
    const must = (cond, msg) => {
      if (!cond) throw new Error(msg);
    };
    try {
      const deadline = Date.now() + 30_000;
      for (;;) {
        if (server.exitCode !== null) throw new Error(`next start terminó antes de escuchar:\n${log}`);
        try {
          if ((await fetch(base)).ok) break;
        } catch {
          /* aún no escucha */
        }
        if (Date.now() > deadline) throw new Error(`next start no respondió en 30 s:\n${log}`);
        await new Promise((r) => setTimeout(r, 150));
      }
      // Marcado de servidor, sin navegador: cada <svg data-icon> trae trazados, en la parte de servidor y en la de cliente.
      const icons = (html) =>
        [...html.matchAll(/<svg[^>]*data-icon="([^"]+)"[^>]*>(.*?)<\/svg>/g)].map((m) => ({ name: m[1], drawn: m[2].includes("<path") }));
      for (const route of ["/", "/dynamic", "/shell", "/umbrella"]) {
        await check(`marcado de servidor de ${route} con iconos dibujados`, async () => {
          const res = await fetch(base + route);
          must(res.ok, `HTTP ${res.status}`);
          const found = icons(await res.text());
          const empty = found.filter((i) => !i.drawn).map((i) => i.name);
          must(empty.length === 0, `iconos sin trazado en el HTML de servidor: ${empty.join(", ")}`);
          const expected =
            route === "/umbrella"
              ? ["star", "folder", "bell", "home", "cog", "bars-3"]
              : route === "/shell"
                ? ["home", "cog", "bars-3"]
                : ["plus", "bell", "star", "folder", "pencil", "home", "credit-card", "ellipsis-horizontal", "chevron-down", "check"];
          const missing = expected.filter((n) => !found.some((i) => i.name === n));
          must(missing.length === 0, `faltan iconos en el HTML de servidor: ${missing.join(", ")}`);
          return `${found.length} iconos`;
        });
      }
      await check("el HTML de servidor trae el marcado del contrato y las hojas de estilo", async () => {
        const html = await (await fetch(base)).text();
        for (const cls of [
          'class="z-btn z-btn--primary"',
          'class="z-badge"',
          'class="z-page',
          'class="z-tabs',
          'class="z-select',
          'class="z-switch',
        ])
          must(html.includes(cls), `falta ${cls} en el HTML`);
        const sheets = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)].map((m) => m[1]);
        must(sheets.length > 0, "sin hojas de estilo enlazadas");
        const css = (await Promise.all(sheets.map(async (href) => (await fetch(new URL(href, base))).text()))).join("");
        must(css.includes(".z-btn") && css.includes(".z-shell") && css.includes("--z-"), "el CSS servido no trae zui, zout y tokens");
        return `CSS ${(css.length / 1024).toFixed(0)} kB`;
      });
      await check('/umbrella: un solo @import "@zuccadev-labs/zuix/styles.css" sirve tokens, zui y zout', async () => {
        const html = await (await fetch(`${base}/umbrella`)).text();
        for (const cls of ['class="z-shell', 'class="z-btn z-btn--secondary', 'class="z-titlebar'])
          must(html.includes(cls), `falta ${cls} en el HTML`);
        const sheets = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)].map((m) => m[1]);
        must(sheets.length > 0, "sin hojas de estilo enlazadas");
        const css = (await Promise.all(sheets.map(async (href) => (await fetch(new URL(href, base))).text()))).join("");
        must(
          css.includes(".z-btn") && css.includes(".z-shell") && css.includes("--z-") && !css.includes("@import"),
          "el CSS de /umbrella no trae tokens, zui y zout resueltos",
        );
        return `CSS ${(css.length / 1024).toFixed(0)} kB`;
      });
      // El registro de iconos es uno por grafo de módulos (servidor y cliente no comparten memoria). Lo que se comprueba
      // es que, en cada grafo, @zuccadev-labs/zuix/zicon/core es el mismo módulo que @zuccadev-labs/zuix-zicon/core: lo registrado a través
      // del paraguas lo dibujan el Icon del paraguas, el del paquete y los componentes de zui y zout.
      await check(
        "/umbrella: /zicon/core comparte registro con @zuccadev-labs/zuix-zicon/core en el grafo de servidor y en el de cliente",
        async () => {
          const html = await (await fetch(`${base}/umbrella`)).text();
          const found = icons(html);
          const drawn = (name) => found.some((i) => i.name === name && i.drawn);
          must(
            drawn("star") && drawn("folder"),
            "grafo de servidor: el Icon del paraguas o el del paquete no ven lo registrado con @zuccadev-labs/zuix/zicon/all",
          );
          must(
            drawn("bell") && drawn("home") && drawn("cog") && drawn("bars-3"),
            "grafo de cliente (render de servidor): el Icon del paraguas o los componentes de zui/zout no ven lo registrado con @zuccadev-labs/zuix/zicon/all",
          );
          return "servidor: star, folder · cliente: bell, home, cog, bars-3";
        },
      );

      const { chromium } = await import("playwright-core");
      try {
        browser = await chromium.launch({ channel: "chrome", headless: true });
      } catch (error) {
        bad(`next: no se pudo lanzar Chrome con playwright-core (${String(error.message).split("\n")[0]})`);
      }
      if (browser) {
        // Cualquier mensaje de consola que no sea log/info/debug cuenta: los avisos de hidratación de React llegan como error.
        const open = async (route, viewport = { width: 1280, height: 900 }) => {
          const page = await browser.newPage({ viewport });
          page.setDefaultTimeout(10_000);
          const problems = [];
          page.on("console", (m) => {
            if (["error", "warning", "assert"].includes(m.type())) problems.push(`console.${m.type()}: ${m.text()}`);
          });
          page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
          page.on("requestfailed", (r) => problems.push(`requestfailed: ${r.url()}`));
          page.on("response", (r) => {
            if (r.status() >= 400) problems.push(`${r.status()}: ${r.url()}`);
          });
          await page.goto(base + route, { waitUntil: "networkidle" });
          return { page, problems };
        };
        const emptyIcons = (page) =>
          page.evaluate(() =>
            [...document.querySelectorAll("svg[data-icon]")].filter((s) => !s.querySelector("path")).map((s) => s.dataset.icon),
          );
        const t = (id) => `[data-testid="${id}"]`;
        for (const route of ["/", "/dynamic"]) {
          await check(`${route} hidrata sin avisos y responde a la interacción`, async () => {
            const { page, problems } = await open(route);
            try {
              // El HTML de servidor y el árbol hidratado coinciden: React no avisó y los iconos siguen dibujados.
              must((await emptyIcons(page)).length === 0, `iconos vacíos tras hidratar: ${(await emptyIcons(page)).join(", ")}`);
              const bg = await page
                .locator(".z-btn--primary")
                .first()
                .evaluate((el) => getComputedStyle(el).backgroundColor);
              must(bg !== "rgba(0, 0, 0, 0)" && bg !== "rgb(239, 239, 239)", `botón primario sin tokens: ${bg}`);
              // Modal declarado en un Server Component.
              await page.locator(t("open-modal")).click();
              await page.locator(".z-modal").waitFor();
              must(await page.locator(".z-modal").evaluate((el) => el.contains(document.activeElement)), "el foco no entró en el Modal");
              must((await page.locator(".z-modal svg[data-icon] path").count()) > 0, "el botón de cierre del Modal no dibuja su icono");
              await page.keyboard.press("Escape");
              await page.locator(".z-modal").waitFor({ state: "detached" });
              // Tabs y Accordion declarados en un Server Component.
              must(await page.locator(t("panel-one")).isVisible(), "el primer panel no está visible tras hidratar");
              await page.getByRole("tab", { name: "Two" }).click();
              await page.locator(t("panel-two")).waitFor();
              must(
                (await page.locator(t("panel-one")).count()) === 0 || !(await page.locator(t("panel-one")).isVisible()),
                "Tabs no cambió de panel",
              );
              await page.getByRole("button", { name: "Team" }).click();
              await page.locator(t("acc-b")).waitFor();
              // Menu, Select, Switch y Toast en un módulo de cliente.
              const focused = (label) =>
                page.waitForFunction(
                  (l) => document.activeElement?.getAttribute("role") === "menuitem" && document.activeElement.textContent.includes(l),
                  label,
                );
              await page.locator(t("open-menu")).focus();
              await page.keyboard.press("Enter");
              await focused("Rename");
              must((await page.locator(".z-menu svg[data-icon] path").count()) >= 2, "las entradas del Menu no dibujan sus iconos");
              await page.keyboard.press("ArrowDown");
              await focused("Delete");
              await page.keyboard.press("Enter");
              await page.locator(`${t("picked")}:text-is("delete")`).waitFor();
              await page.getByRole("combobox", { name: "Fruit" }).click();
              await page.getByRole("option", { name: "Pear" }).click();
              await page.locator(`${t("fruit")}:text-is("pear")`).waitFor();
              await page.getByRole("switch").click();
              await page.locator(`${t("switch")}:text-is("true")`).waitFor();
              await page.locator(t("toast")).click();
              await page.locator(".z-toast").waitFor();
              // biome-ignore lint/performance/useDomNodeTextContent: innerText() es la API de Playwright (texto visible), no la propiedad del DOM.
              must((await page.locator(".z-toast").innerText()).includes("Saved"), "el Toast no muestra el título");
              must((await emptyIcons(page)).length === 0, `iconos vacíos tras interactuar: ${(await emptyIcons(page)).join(", ")}`);
              must(problems.length === 0, `avisos o errores de consola:\n    ${[...new Set(problems)].slice(0, 6).join("\n    ")}`);
              return "Modal, Tabs, Accordion, Menu, Select, Switch y Toast";
            } finally {
              await page.close();
            }
          });
        }
        for (const route of ["/shell", "/umbrella"])
          await check(`${route} hidrata sin avisos; Shell acoplado a 1280 px y en cajón a 600 px`, async () => {
            const wide = await open(route);
            try {
              await wide.page.locator(".z-shell__side").waitFor();
              must((await wide.page.locator(".z-shell__drawer").count()) === 0, "a 1280 px la sidebar no debería ser un cajón");
              if (route === "/umbrella")
                must(
                  (await wide.page.locator('.z-titlebar svg[data-icon="bell"] path, .z-shell svg[data-icon="bell"] path').count()) > 0,
                  "en el navegador, el Icon del paraguas no dibuja lo registrado",
                );
              must((await wide.page.locator(".z-split__divider").count()) === 1, "SplitPane sin divisor");
              await wide.page.locator(".z-split__divider").focus();
              const before = await wide.page.locator(".z-split__divider").getAttribute("aria-valuenow");
              await wide.page.keyboard.press("ArrowLeft");
              must(
                (await wide.page.locator(".z-split__divider").getAttribute("aria-valuenow")) !== before,
                "el divisor no respondió al teclado",
              );
              must(
                wide.problems.length === 0,
                `avisos o errores de consola (1280 px):\n    ${[...new Set(wide.problems)].slice(0, 6).join("\n    ")}`,
              );
            } finally {
              await wide.page.close();
            }
            const narrow = await open(route, { width: 600, height: 800 });
            try {
              await narrow.page.locator(".z-shell__drawer").waitFor();
              await narrow.page.keyboard.press("Escape");
              await narrow.page.locator(".z-shell__drawer").waitFor({ state: "detached" });
              await narrow.page.locator('[data-testid="toggle-sidebar"]').click();
              await narrow.page.locator(".z-shell__drawer").waitFor();
              must(
                narrow.problems.length === 0,
                `avisos o errores de consola (600 px):\n    ${[...new Set(narrow.problems)].slice(0, 6).join("\n    ")}`,
              );
            } finally {
              await narrow.page.close();
            }
          });
      }
    } catch (error) {
      bad(`next: ${String(error?.message ?? error)}`);
    } finally {
      await browser?.close().catch(() => {});
      // Se termina por PID el proceso que se lanzó aquí.
      if (server.exitCode === null) {
        await new Promise((resolve) => {
          server.once("exit", resolve);
          server.kill("SIGTERM");
          setTimeout(() => server.kill("SIGKILL"), 5000).unref();
        });
      }
    }
  }
} else {
  notes.push("consumidor Next.js omitido: se ejecuta con --next (pnpm test:pack:next)");
}

// ── 6. Linters de paquete (opcionales) ────────────────────────────────────────────────────────────
if (!args.has("--skip-lint") && !failures.length) {
  for (const pkg of PACKAGES) {
    const r = sh("pnpm", ["dlx", "publint", tarballs[pkg]], consumerDir, { timeout: 120_000 });
    if (r.ok) ok(`publint ${npmName(pkg)}`);
    else if (/ERR_PNPM_(FETCH|META_FETCH|NO_MATCHING)|ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ETIMEDOUT/.test(r.out) || r.status === null)
      notes.push(`publint ${npmName(pkg)}: no se pudo ejecutar (sin red o sin el paquete); no cuenta como fallo`);
    else
      bad(
        `publint ${npmName(pkg)}\n${r.out
          .split("\n")
          .slice(-30)
          .map((l) => `    ${l}`)
          .join("\n")}`,
      );
  }
  for (const pkg of PACKAGES.filter((p) => p !== "tokens")) {
    // Los paquetes son solo ESM por decisión: `cjs-resolves-to-esm` se ignora. node10 no entiende `exports`.
    // Las entradas que no son JavaScript (CSS, SVG) no tienen tipos que comprobar.
    const manifest = JSON.parse(sh("tar", ["-xzOf", tarballs[pkg], "package/package.json"], root).out);
    const assets = Object.entries(manifest.exports)
      .filter(([, v]) => typeof v === "string" && /\.(css|svg)$|\/\*$/.test(v))
      .map(([k]) => k);
    const r = sh(
      "pnpm",
      [
        "dlx",
        "@arethetypeswrong/cli",
        tarballs[pkg],
        "--profile",
        "esm-only",
        "--ignore-rules",
        "cjs-resolves-to-esm",
        "--exclude-entrypoints",
        ...assets,
      ],
      consumerDir,
      { timeout: 180_000 },
    );
    if (r.ok) ok(`attw ${npmName(pkg)} (perfil esm-only)`);
    else if (/ERR_PNPM_(FETCH|META_FETCH|NO_MATCHING)|ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ETIMEDOUT/.test(r.out) || r.status === null)
      notes.push(`attw ${npmName(pkg)}: no se pudo ejecutar (sin red o sin el paquete); no cuenta como fallo`);
    else
      bad(
        `attw ${npmName(pkg)}\n${r.out
          .split("\n")
          .slice(-40)
          .map((l) => `    ${l}`)
          .join("\n")}`,
      );
  }
}
finish();
