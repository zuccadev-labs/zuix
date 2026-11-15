#!/usr/bin/env node
// Build de publicación de @zuccadev-labs/zuix-zicon, @zuccadev-labs/zuix-zui y @zuccadev-labs/zuix-zout, y comprobación del paraguas (`pnpm build`).
//   <paquete>/dist/esm/      ESM compilado por tsc, módulo a módulo (sin empaquetar), con .d.ts y sourcemaps
//   <paquete>/dist/styles/   hojas CSS sueltas (zui, zout)
//   <paquete>/dist/*.css|js  bundles de navegador: los escribe tools/dist.mjs, que se ejecuta al final
// @zuccadev-labs/zuix-tokens no se compila aquí (su dist/ lo genera `pnpm tokens`). El paraguas @zuccadev-labs/zuix (suite/)
// no tiene build: son reexportaciones escritas a mano; al final se comprueba que cada una apunta a una entrada real.
// tsc emite los especificadores relativos como en el fuente, sin extensión ("./core"). Node los exige
// completos, así que aquí se reescriben a "./core.js" o "./dir/index.js" en .js y .d.ts.
// El orden importa: zui compila contra las declaraciones de zicon, y zout contra las de zui
// (`paths` en cada tsconfig.build.json), para no arrastrar el fuente de otro paquete a su salida.
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const PACKAGES = ["zicon", "zui", "zout"];
const LOOSE_STYLES = ["zui"]; // paquetes que exportan sus hojas sueltas ("./styles/*")
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const fail = (msg) => { console.error(`✗ ${msg}`); process.exit(1); };

function run(cmd, args, cwd) {
  const r = spawnSync(cmd, args, { cwd, stdio: "inherit" });
  if (r.status !== 0) fail(`${cmd} ${args.join(" ")} (en ${relative(root, cwd) || "."}) terminó con código ${r.status}`);
}

// from "./x" · import "./x" · import("./x") · export … from "./x"
const SPEC = /(\bfrom\s*|\bimport\s*\(?\s*)(["'])(\.{1,2}\/[^"']+)\2/g;
function completeSpecifiers(file) {
  const dts = file.endsWith(".d.ts");
  const exists = (base) => existsSync(dts ? `${base}.d.ts` : `${base}.js`);
  const src = readFileSync(file, "utf8");
  const out = src.replace(SPEC, (all, lead, quote, spec) => {
    if (/\.(js|json|css)$/.test(spec)) return all;
    const base = join(dirname(file), spec);
    if (exists(base)) return `${lead}${quote}${spec}.js${quote}`;
    if (exists(join(base, "index"))) return `${lead}${quote}${spec}/index.js${quote}`;
    fail(`${relative(root, file)}: no se resuelve "${spec}"`);
  });
  if (out !== src) writeFileSync(file, out);
}

for (const pkg of PACKAGES) {
  const dir = join(root, pkg);
  const esm = join(dir, "dist/esm");
  rmSync(esm, { recursive: true, force: true });
  run("pnpm", ["exec", "tsc", "-p", "tsconfig.build.json"], dir);
  // Los módulos de icono son datos generados: su sourcemap duplicaría el tamaño del paquete sin aportar nada.
  for (const f of walk(esm)) {
    if (!/[\\/]icons[\\/]/.test(f)) continue;
    if (f.endsWith(".js.map")) rmSync(f);
    else if (f.endsWith(".js")) writeFileSync(f, readFileSync(f, "utf8").replace(/\n?\/\/# sourceMappingURL=.*\s*$/, "\n"));
  }
  const files = walk(esm);
  for (const f of files) if (f.endsWith(".js") || f.endsWith(".d.ts")) completeSpecifiers(f);

  // "use client" debe sobrevivir a la compilación: si el fuente lo declara, la salida también.
  for (const f of walk(join(dir, "src")).filter((f) => /\.tsx?$/.test(f))) {
    if (!/^\s*["']use client["']/.test(readFileSync(f, "utf8"))) continue;
    const out = join(esm, relative(join(dir, "src"), f).replace(/\.tsx?$/, ".js"));
    if (!/^\s*["']use client["']/.test(readFileSync(out, "utf8"))) fail(`${relative(root, out)}: se perdió "use client"`);
  }

  const styles = join(dir, "src/styles");
  if (LOOSE_STYLES.includes(pkg) && existsSync(styles)) {
    rmSync(join(dir, "dist/styles"), { recursive: true, force: true });
    mkdirSync(join(dir, "dist/styles"), { recursive: true });
    cpSync(styles, join(dir, "dist/styles"), { recursive: true });
  }
  const js = files.filter((f) => f.endsWith(".js")).length;
  const kb = files.reduce((n, f) => n + statSync(f).size, 0) / 1024;
  console.log(`✓ ${pkg}/dist/esm · ${js} módulos · ${kb.toFixed(0)} kB con declaraciones y sourcemaps`);
}

run("node", ["tools/dist.mjs"], root);

// Paraguas: cada entrada de `exports` existe, cada .js tiene su .d.ts con los mismos especificadores, y cada
// especificador es una entrada publicada (`publishConfig.exports`) de un paquete del que depende.
{
  const dir = join(root, "suite");
  const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  const specs = (file) => [...new Set([...readFileSync(join(dir, file), "utf8").matchAll(/(?:from|import)\s*["']([^"']+)["']/g)].map((m) => m[1]))].sort();
  const published = (spec) => {
    const dep = Object.keys(pkg.dependencies).find((d) => spec === d || spec.startsWith(`${d}/`));
    if (!dep) return false;
    const target = JSON.parse(readFileSync(join(root, dep.replace(/^@zuccadev-labs\/zuix-/, ""), "package.json"), "utf8"));
    return `.${spec.slice(dep.length)}` in (target.publishConfig?.exports ?? target.exports);
  };
  let entries = 0;
  for (const [key, value] of Object.entries(pkg.exports)) {
    const files = typeof value === "string" ? [value] : Object.values(value);
    for (const f of files) if (!existsSync(join(dir, f))) fail(`suite: exports["${key}"] apunta a ${f}, que no existe`);
    if (typeof value === "string") { if (value.endsWith(".css")) for (const s of specs(value)) if (!published(s)) fail(`suite/${value}: "${s}" no es una entrada publicada`); continue; }
    const [js, dts] = [specs(value.default), specs(value.types)];
    for (const s of js) if (!published(s)) fail(`suite/${value.default}: "${s}" no es una entrada publicada`);
    if (dts.length && js.join() !== dts.join()) fail(`suite: ${value.default} y ${value.types} no reexportan lo mismo`);
    entries += 1;
  }
  console.log(`✓ suite · ${entries} entradas de JavaScript con declaraciones y ${Object.values(pkg.exports).filter((v) => typeof v === "string" && v.endsWith(".css")).length} hojas, todas sobre entradas publicadas`);
}
