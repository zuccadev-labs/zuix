#!/usr/bin/env node
// Contrasta lo que el proyecto tiene con lo que cuenta la documentación.
//
// Falla (código 1) cuando:
//   - un componente de zui o una pieza de zout no aparece en la guía de su paquete (docs/users/03-zui.md, 04-zout.md);
//   - una entrada de `exports` de un paquete publicable no aparece en la documentación de usuario ni en su README;
//   - una familia `/dom/<nombre>` de zui no tiene fila en la tabla de familias de docs/users/06-frameworks.md, o una
//     función que exporta no está en «Todas las funciones» bajo esa entrada (o la tabla pone una que no exporta);
//   - una función de la raíz de zui o zout, de zout/dom o de zicon no aparece en la guía de su paquete;
//   - un miembro propio de `<Nombre>Props` no aparece en las props del manifiesto del componente;
//   - un recuento (componentes, grupos, layouts, iconos, categorías) no coincide con los manifiestos;
//   - la tabla de `behavior` de 03-zui.md no coincide con html.json;
//   - la lista de grupos de zui/AGENTS.md no es la de zui/manifest.json;
//   - un comando de package.json no aparece como `pnpm <comando>` en la documentación;
//   - la portada de usuarios dice describir otra versión que la de package.json;
//   - un enlace relativo de un README, un AGENTS.md o un CHANGELOG, o un enlace a `blob/main/<ruta>` del
//     repositorio, apunta a un archivo que no existe (los de docs/ los comprueba el build de zudocs).
//
// Con --report lista además, sin fallar, lo que no está nombrado en ningún documento: funciones exportadas por
// los módulos sin framework, herramientas de tools/ y suites de prueba.
//
// Uso: node tools/docs-coverage.mjs [--report]
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { exportedNames } from "./check-barrels.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");
const json = (p) => JSON.parse(read(p));
const md = (dir) =>
  readdirSync(join(root, dir))
    .filter((f) => f.endsWith(".md"))
    .map((f) => `${dir}/${f}`);

const errors = [];
const fail = (msg) => errors.push(msg);

const zui = json("zui/manifest.json");
const zout = json("zout/manifest.json");
const zicon = json("zicon/manifest.json");
const zuiHtml = json("zui/html.json");
const rootPkg = json("package.json");
const version = json("zui/package.json").version;

/** Documentación que se presenta como vigente (las investigaciones y los CHANGELOG cuentan el pasado). */
const current = [
  "README.md",
  "README.es.md",
  "AGENTS.md",
  ...["suite", "tokens", "zicon", "zui", "zout"].map((p) => `${p}/README.md`),
  "zui/AGENTS.md",
  "zicon/AGENTS.md",
  ...md("docs/users"),
  ...md("docs/agents"),
  ...md("docs/development"),
  ...md("docs/package"),
];
const text = Object.fromEntries(current.map((f) => [f, read(f)]));
const allText = Object.values(text).join("\n");
const userText = current
  .filter((f) => f.startsWith("docs/users/") || f.endsWith("README.md"))
  .map((f) => text[f])
  .join("\n");
const word = (name) => new RegExp(`(^|[^\\w-])${name.replace(/[$.*+?^()[\]{}|\\]/g, "\\$&")}(?![\\w-])`);

// 1. Componentes y piezas en la guía de su paquete.
for (const [manifest, guide] of [
  [zui, "docs/users/03-zui.md"],
  [zout, "docs/users/04-zout.md"],
]) {
  const missing = manifest.components.map((c) => c.name).filter((n) => !word(n).test(text[guide]));
  if (missing.length) fail(`${guide}: no nombra ${missing.length} componente(s): ${missing.join(", ")}`);
}

// 2. Entradas de exports en la documentación de usuario o en el README del paquete.
const packages = { tokens: "tokens", zicon: "zicon", zui: "zui", zout: "zout", suite: "suite" };
for (const dir of Object.values(packages)) {
  const pkg = json(`${dir}/package.json`);
  const readme = text[`${dir}/README.md`];
  const missing = [];
  for (const key of Object.keys(pkg.exports)) {
    if (key === "./package.json") continue;
    const sub = key === "." ? "" : key.slice(1).replace(/\*.*$/, "");
    const full = `${pkg.name}${sub}`;
    const haystack = `${userText}\n${readme}`;
    const literal = key === "." ? new RegExp(`${full.replace(/[/.-]/g, "\\$&")}["'\`]`).test(haystack) : haystack.includes(full);
    // Las tablas abrevian la subruta (`/dom/data`, `tokens.compat.css`, `css/<marca>.css`).
    const short = (s) => new RegExp(`[\`/ ]${s.replace(/[$.*+?^()[\]{}|\\]/g, "\\$&")}(?![\\w.-])`).test(haystack);
    const bare = sub.slice(1);
    const abbreviated = key !== "." && (short(bare) || short(bare.replace(/\b(dazlabs|zenith|zutool)\b/, "<marca>")));
    // El paraguas documenta sus subrutas de zui por patrón: «las mismas rutas cuelgan de …/zui/dom/…».
    const byPattern = dir === "suite" && /^\.\/zui\/dom\//.test(key) && haystack.includes(`${pkg.name}/zui/dom/…`);
    if (!literal && !abbreviated && !byPattern) missing.push(key);
  }
  if (missing.length) fail(`${pkg.name}: entradas sin documentar: ${missing.join(", ")}`);
}

// 3. Familias de /dom en la tabla de 06-frameworks.md.
{
  const families = Object.keys(json("zui/package.json").exports)
    .map((k) => /^\.\/dom\/([\w-]+)$/.exec(k)?.[1])
    .filter((f) => f && f !== "carousel-gl");
  const guide = text["docs/users/06-frameworks.md"];
  const missing = families.filter((f) => !guide.includes(`| \`/dom/${f}\` |`));
  if (missing.length) fail(`docs/users/06-frameworks.md: la tabla de familias no tiene fila para /dom/${missing.join(", /dom/")}`);
}

// 3b. «Todas las funciones» de 06-frameworks.md: cada exportación de cada entrada /dom/<familia> está en su fila, y
// cada nombre de la tabla sale de la entrada que dice.
{
  const guide = text["docs/users/06-frameworks.md"];
  const table = /### Todas las funciones\n([\s\S]*?)\n(?=#)/.exec(guide)?.[1] ?? "";
  if (!table) fail("docs/users/06-frameworks.md: falta la tabla «Todas las funciones»");
  const pkgExports = json("zui/package.json").exports;
  const listed = new Map();
  let entry = null;
  for (const row of table.split("\n").filter((l) => l.startsWith("| ") || l.startsWith("| |"))) {
    const cells = row.split(" | ");
    const head = /^\| `(\/dom\/[\w-]+)`/.exec(row)?.[1];
    if (head) entry = head;
    else if (!row.startsWith("| |")) entry = null; // fila común («Todas las de piezas con datos»)
    const names = [...(cells.at(-1) ?? "").matchAll(/`([\w$]+)`/g)].map((m) => m[1]);
    for (const n of names) listed.set(n, [...(listed.get(n) ?? []), entry]);
  }
  const shared = new Set(["setWidgetProps", "destroyWidget"]);
  for (const key of Object.keys(pkgExports).filter((k) => /^\.\/dom\/[\w-]+$/.test(k) && k !== "./dom/carousel-gl")) {
    const sub = key.slice(1);
    const names = [...exportedNames(join(root, "zui", pkgExports[key]))].filter((n) => !/Module$/.test(n) && !shared.has(n));
    const missing = names.filter((n) => !(listed.get(n) ?? []).includes(sub));
    if (missing.length) fail(`docs/users/06-frameworks.md: «Todas las funciones» no lista en ${sub}: ${missing.join(", ")}`);
    for (const [n, entries] of listed)
      if (entries.includes(sub) && !names.includes(n) && !shared.has(n))
        fail(`docs/users/06-frameworks.md: «Todas las funciones» pone ${n} en ${sub}, que no lo exporta`);
  }
}

// 3c. Funciones de la raíz de zui (utilidades y hooks) en 03-zui.md, y las de zout/dom y zicon/dom en su guía.
for (const [file, guide, filter] of [
  ["zui/src/index.ts", "docs/users/03-zui.md", (n) => /^[a-z]/.test(n) || /^[A-Z][A-Z_]+$/.test(n)],
  ["zout/src/index.ts", "docs/users/04-zout.md", (n) => /^[a-z]/.test(n) || /^[A-Z][A-Z_]+$/.test(n)],
  ["zout/src/dom/index.ts", "docs/users/04-zout.md", () => true],
  ["zicon/src/dom.ts", "docs/users/02-zicon.md", () => true],
  ["zicon/src/core.ts", "docs/users/02-zicon.md", () => true],
]) {
  const missing = [...exportedNames(join(root, file))].filter(filter).filter((n) => !word(n).test(text[guide]));
  if (missing.length) fail(`${guide}: no nombra ${missing.length} exportación(es) de ${file}: ${missing.join(", ")}`);
}

// 4. Recuentos.
{
  const own = Object.keys(json("zicon/icons-own.json").icons).length;
  const counts = [
    { re: /(\d+) (?:accessible )?(?:componentes|components)\b/g, ok: [zui.count], what: "componentes de zui" },
    { re: /(\d+) (?:grupos|groups)\b/g, ok: [Object.keys(zui.groups).length], what: "grupos de zui" },
    { re: /(\d+) (?:layouts|piezas)\b/g, ok: [zout.count], what: "piezas de zout" },
    { re: /(\d+) (?:categorías|categories)\b/g, ok: [Object.keys(zicon.categories).length], what: "categorías de iconos" },
    // Además del total, los documentos citan los propios, los de Dazicon y los que repiten dibujo; las cifras
    // pequeñas («3 iconos» de un ejemplo) no son recuentos del set.
    { re: /(\d{3}) (?:iconos|icons|literales)\b/g, ok: [zicon.count, zicon.count - own, own].concat(sameDrawing()), what: "iconos" },
  ];
  for (const [file, body] of Object.entries(text)) {
    body.split("\n").forEach((line, i) => {
      // Una línea que compara versiones («pasa de 144 a 224», «0.3.0») habla del pasado.
      if (/\b0\.\d+\.\d+\b|\bpasa de\b|\bfrom \d/.test(line)) return;
      for (const { re, ok, what } of counts)
        for (const m of line.matchAll(re))
          if (!ok.includes(Number(m[1]))) fail(`${file}:${i + 1}: «${m[0]}» no coincide con ${what} (${ok[0]})`);
    });
  }
}

function sameDrawing() {
  // Iconos cuya variante solid es el mismo dibujo que la outline (zicon/AGENTS.md lo cita).
  const dir = join(root, "zicon/svg");
  if (!existsSync(join(dir, "outline"))) return [];
  let same = 0;
  for (const f of readdirSync(join(dir, "outline"))) {
    const solid = join(dir, "solid", f);
    if (existsSync(solid) && readFileSync(join(dir, "outline", f), "utf8") === readFileSync(solid, "utf8")) same++;
  }
  return [same];
}

// 5. Tabla de behavior de 03-zui.md.
{
  const by = {};
  for (const c of Object.values(zuiHtml.components)) by[c.behavior] = (by[c.behavior] ?? 0) + 1;
  for (const m of text["docs/users/03-zui.md"].matchAll(/^\| `(none|dom|react)` \|[^|]*\| (\d+) \|$/gm))
    if ((by[m[1]] ?? 0) !== Number(m[2])) fail(`docs/users/03-zui.md: behavior ${m[1]} dice ${m[2]}, html.json tiene ${by[m[1]] ?? 0}`);
}

// 6. Grupos de zui/AGENTS.md.
{
  const line = /^Grupos: (.*)$/m.exec(text["zui/AGENTS.md"])?.[1] ?? "";
  const listed = [...line.matchAll(/`([\w-]+)`/g)].map((m) => m[1]);
  const missing = Object.keys(zui.groups).filter((g) => !listed.includes(g));
  const extra = listed.filter((g) => !zui.groups[g]);
  if (missing.length || extra.length)
    fail(
      `zui/AGENTS.md: la lista de grupos no es la del manifiesto (faltan: ${missing.join(", ") || "—"}; sobran: ${extra.join(", ") || "—"})`,
    );
}

// 7. Comandos de package.json.
{
  const missing = Object.keys(rootPkg.scripts).filter((s) => !new RegExp(`pnpm ${s.replace(/[:]/g, "\\:")}(?![\\w:-])`).test(allText));
  if (missing.length) fail(`comandos de package.json sin documentar: ${missing.join(", ")}`);
}

// 8. Versión que dice describir la portada de usuarios.
{
  const m = /Esta documentación describe la `([\d.]+)`/.exec(text["docs/users/README.md"]);
  if (m && m[1] !== version) fail(`docs/users/README.md: dice describir la ${m[1]}; la versión es ${version}`);
}

// 9. Enlaces de los README, AGENTS.md y CHANGELOG (los de docs/ los comprueba zudocs).
{
  const files = [
    ...current.filter((f) => !f.startsWith("docs/")),
    "CONTRIBUTING.md",
    "SECURITY.md",
    ...["suite", "tokens", "zicon", "zui", "zout", "zudocs"].map((p) => `${p}/CHANGELOG.md`),
  ];
  for (const file of files) {
    const body = read(file).replace(/```[\s\S]*?```/g, "");
    for (const m of body.matchAll(/\]\(([^)\s]+)\)/g)) {
      const href = m[1];
      let target;
      const blob = /^https:\/\/github\.com\/zuccadev-labs\/zuix\/(?:blob|tree)\/main\/([^#?]+)/.exec(href);
      if (blob) target = join(root, decodeURIComponent(blob[1]));
      else if (!/^[a-z]+:|^#|^\//.test(href)) target = resolve(root, dirname(file), decodeURIComponent(href.split("#")[0]));
      if (target && !existsSync(target)) fail(`${file}: enlace roto a ${href}`);
    }
  }
}

// 10. Props: cada miembro propio de `<Nombre>Props` aparece en las props del manifiesto (el catálogo del sitio y la
// página de cada componente salen de ahí). Los atributos que todo componente reenvía no cuentan.
{
  const forwarded = new Set(["id", "className", "ref", "children", "style", "aria-label", "aria-describedby"]);
  for (const [dir, manifest] of [
    ["zui", zui],
    ["zout", zout],
  ]) {
    for (const c of manifest.components) {
      const folder = join(root, dirname(c.file));
      let body = null;
      for (const f of readdirSync(folder).filter((f) => /\.tsx?$/.test(f))) {
        const src = readFileSync(join(folder, f), "utf8");
        const at = src.search(new RegExp(`export interface ${c.name}Props\\b[^{]*\\{`));
        if (at < 0) continue;
        // Solo el primer nivel de la interfaz: los tipos anidados no son props.
        body = "";
        let depth = 0;
        for (let i = src.indexOf("{", at); i < src.length; i++) {
          const ch = src[i];
          if (ch === "{") depth++;
          if (ch === "}" && --depth === 0) break;
          body += depth === 1 || ch === "\n" ? ch : " ";
        }
        break;
      }
      if (body === null) continue; // Props declaradas con `type` o heredadas enteras: no se comprueban.
      const declared = [
        ...body.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "").matchAll(/^\s*(?:readonly\s+)?["']?([A-Za-z_$][\w$-]*)["']?\??\s*:/gm),
      ].map((m) => m[1]);
      const documented = JSON.stringify(c.props);
      const missing = declared.filter((p) => !forwarded.has(p) && !word(p).test(documented));
      if (missing.length) fail(`${dir}: ${c.file} no documenta la(s) prop(s) ${missing.join(", ")} de ${c.name}Props`);
    }
  }
}

// Informe: lo que ningún documento nombra.
if (process.argv.includes("--report")) {
  const everything = [
    allText,
    ...md("docs/investigations").map(read),
    ...["suite", "tokens", "zicon", "zui", "zout", "zudocs"].map((p) => read(`${p}/CHANGELOG.md`)),
  ].join("\n");
  const docsOnly = allText;
  const section = (title, names, haystack) => {
    const missing = names.filter((n) => !word(n).test(haystack));
    console.log(`\n${title}: ${missing.length} de ${names.length} sin nombrar`);
    if (missing.length) console.log(`  ${missing.join(", ")}`);
  };
  const domFns = [
    ...exportedNames(join(root, "zui/src/dom/index.ts")),
    ...exportedNames(join(root, "zout/src/dom/index.ts")),
    ...exportedNames(join(root, "zicon/src/dom.ts")),
  ].filter((n) => !/Module$/.test(n));
  section("Funciones sin framework (guías y README)", [...new Set(domFns)].sort(), docsOnly);
  section("Funciones sin framework (ni siquiera en CHANGELOG o investigaciones)", [...new Set(domFns)].sort(), everything);
  const reactNames = [...exportedNames(join(root, "zui/src/index.ts")), ...exportedNames(join(root, "zout/src/index.ts"))].filter((n) =>
    /^(use|[a-z])/.test(n),
  );
  section("Funciones y hooks de React (guías y README)", [...new Set(reactNames)].sort(), docsOnly);
  section(
    "Herramientas de tools/",
    readdirSync(join(root, "tools")).filter((f) => f.endsWith(".mjs")),
    docsOnly,
  );
  // Los casos de tests/browser y tests/html se documentan por patrón (cases-<área>.mjs, NN-<área>.mjs).
  const suites = readdirSync(join(root, "tests")).filter((f) => f.endsWith(".mjs"));
  section("Ayudantes y pruebas sueltas de tests/", suites, docsOnly);
}

if (errors.length) {
  console.error(`docs-coverage: ${errors.length} hueco(s) entre el proyecto y la documentación`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log("docs-coverage: la documentación nombra todos los componentes, entradas, familias y comandos");
