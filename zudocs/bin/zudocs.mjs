#!/usr/bin/env node
// zudocs: una plantilla, cualquier proyecto. La configuración se elige con --config o ZUDOCS_CONFIG
// (ver scripts/config.mjs); sin ninguna de las dos se usa la de la carpeta actual o la del sitio de zuix.
//
//   zudocs build  [--config <ruta>] [--out-dir <ruta>]   verifica, genera llms.txt y compila el sitio
//   zudocs start  [--config <ruta>] [--port <n>]          servidor de desarrollo
//   zudocs serve  [--config <ruta>] [--port <n>]          sirve el sitio ya compilado
//   zudocs verify [--config <ruta>] [--strict]            configuración, áreas, nombres, iconos, marca y enlaces
//   zudocs new    [--config <ruta>] <tipo> <area> "<título>" ["<descripción>"]
//   zudocs llms   [--config <ruta>]                       solo regenera llms.txt
//   zudocs info   [--config <ruta>]                       rutas que usará el proyecto
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { callerDir, loadZudocs, parseArgs, templateDir } from "../scripts/config.mjs";

const [command, ...argv] = process.argv.slice(2).filter((a) => a !== "--");
const USAGE = "Uso: zudocs <build|start|serve|verify|new|llms|info> [--config <ruta a zudocs.config.json>] [--out-dir <ruta>] [--strict]";
if (!command || command === "--help" || command === "-h") { console.log(USAGE); process.exit(command ? 0 : 1); }

const args = parseArgs(argv);
let ctx;
try { ctx = loadZudocs(args); } catch (e) { console.error(`✗ ${e.message}`); process.exit(1); }

// Los procesos hijos reciben la configuración ya resuelta: no vuelven a buscarla.
const env = { ...process.env, INIT_CWD: callerDir(), ZUDOCS_CONFIG: ctx.configPath, ZUDOCS_OUT_DIR: ctx.outDir, DOCUSAURUS_GENERATED_FILES_DIR_NAME: ctx.generatedDirName };
const run = (file, extra = []) => {
  const r = spawnSync(process.execPath, [file, ...extra], { stdio: "inherit", env, cwd: templateDir });
  if (r.status !== 0) process.exit(r.status ?? 1);
};
const script = (name, extra) => run(join(templateDir, "scripts", `${name}.mjs`), extra);
const docusaurus = (extra) => run(createRequire(import.meta.url).resolve("@docusaurus/core/bin/docusaurus.mjs"), extra);

mkdirSync(ctx.workDir, { recursive: true });
switch (command) {
  case "info":
    for (const [k, v] of Object.entries({ configuración: ctx.configPath, documentación: ctx.docsDir, estáticos: ctx.staticDir, salida: ctx.outDir, caché: ctx.isDefault ? join(templateDir, ".docusaurus") : ctx.workDir, "llms.txt": ctx.llmsPath, páginas: Object.entries(ctx.pages).filter(([, on]) => on).map(([p]) => p).join(", ") || "ninguna" })) console.log(`${k.padEnd(14)} ${v}`);
    break;
  case "verify": script("verify", args.strict ? ["--strict"] : []); break;
  case "llms": script("llms"); break;
  case "new": script("new", args.rest); break;
  case "build":
    script("verify", args.strict ? ["--strict"] : []);
    script("llms");
    if (ctx.isDefault) docusaurus(["build", templateDir, "--out-dir", ctx.outDir, ...args.rest]);
    else {
      // Docusaurus ejecuta el paquete de servidor desde la carpeta de salida como CommonJS. Si la salida
      // cae dentro de un proyecto con "type": "module", falla. Se compila en la carpeta de trabajo y se mueve.
      const staging = join(ctx.workDir, "build");
      docusaurus(["build", templateDir, "--out-dir", staging, ...args.rest]);
      rmSync(ctx.outDir, { recursive: true, force: true });
      mkdirSync(dirname(ctx.outDir), { recursive: true });
      cpSync(staging, ctx.outDir, { recursive: true });
      rmSync(staging, { recursive: true, force: true });
    }
    console.log(`✓ ${ctx.site.name}: sitio en ${ctx.rel(ctx.outDir)}`);
    break;
  case "start":
    script("llms");
    docusaurus(["start", templateDir, ...args.rest]);
    break;
  case "serve": docusaurus(["serve", templateDir, "--dir", ctx.outDir, ...args.rest]); break;
  default:
    console.error(`Comando desconocido: "${command}".\n${USAGE}`);
    process.exit(1);
}
