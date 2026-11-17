#!/usr/bin/env node
// zudocs: una plantilla, cualquier proyecto. La configuración se elige con --config o ZUDOCS_CONFIG
// (ver scripts/config.mjs); sin ninguna de las dos se usa la de la carpeta actual o la del sitio de zuix.
// Códigos de salida: 0 correcto, 1 fallo de verificación o de compilación, 2 uso incorrecto.
import { spawn, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { callerDir, loadZudocs, parseArgs, templateDir, ZudocsError } from "../scripts/config.mjs";

const USAGE = `Uso: zudocs <comando> [--config <archivo o carpeta>] [opciones]

  build   [--out-dir <ruta>] [--strict] [--headers]   verifica, genera llms.txt y robots.txt y compila el sitio
  start   [--port <n>] [--host <h>]                    servidor de desarrollo
  serve   [--out-dir <ruta>] [--port <n>]              sirve el sitio ya compilado
  verify  [--strict]                                   configuración, áreas, documentos, enlaces, anclas e imágenes
  new     <tipo> <area> "<título>" ["<descripción>"]   documento nuevo desde una plantilla
  llms                                                 solo regenera llms.txt, llms-full.txt y robots.txt
  fonts   [--out-dir <carpeta>] [<url> …]              descarga las fuentes remotas para autoalojarlas
  headers [--out-dir <ruta>]                           escribe _headers (CSP y caché) en el sitio compilado
  info                                                 rutas y URL que usará el proyecto

La configuración se busca en: --config, ZUDOCS_CONFIG, ./zudocs.config.json y, si no hay, la del sitio de zuix.
ZUDOCS_URL y ZUDOCS_BASE_URL sustituyen "url" y "baseUrl" en una ejecución.`;
// Una tubería cerrada por el lector (zudocs info | head) no es un error.
process.stdout.on("error", (e) => process.exit(e.code === "EPIPE" ? 0 : 1));
const say = (text) => process.stdout.write(`${text}\n`);
const die = (text, code = 1) => { process.stderr.write(`${text}\n`); process.exit(code); };

const [command, ...argv] = process.argv.slice(2).filter((a) => a !== "--");
if (!command) die(USAGE, 2);
if (command === "--help" || command === "-h" || command === "help") { say(USAGE); process.exit(0); }
if (command === "--version" || command === "-v") { say(JSON.parse(readFileSync(join(templateDir, "package.json"), "utf8")).version); process.exit(0); }

// Argumentos que cada comando admite además de --config. Lo demás es un error: una opción mal escrita
// (--strcit) no debe pasar en silencio. build, start y serve pasan el resto a Docusaurus.
const COMMANDS = {
  build: { flags: ["outDir", "strict", "headers"], rest: "docusaurus" },
  start: { flags: [], rest: "docusaurus" },
  serve: { flags: ["outDir"], rest: "docusaurus" },
  verify: { flags: ["strict"] },
  new: { flags: [], rest: "posicionales" },
  llms: { flags: [] },
  fonts: { flags: ["outDir"], rest: "posicionales" },
  headers: { flags: ["outDir"] },
  info: { flags: ["outDir"] },
};
const spec = COMMANDS[command];
if (!spec) die(`Comando desconocido: "${command}".\n\n${USAGE}`, 2);

let args, ctx;
try {
  args = parseArgs(argv);
  if (args.help) { say(USAGE); process.exit(0); }
  const NAMES = { outDir: "--out-dir", strict: "--strict", headers: "--headers" };
  for (const [key, flag] of Object.entries(NAMES)) if (args[key] && !spec.flags.includes(key)) throw new ZudocsError(`"${command}" no admite ${flag}.`);
  if (!spec.rest && args.rest.length) throw new ZudocsError(`"${command}" no admite: ${args.rest.join(" ")}`);
  // fonts usa --out-dir como destino de las fuentes, no como salida del sitio.
  ctx = loadZudocs(command === "fonts" ? { config: args.config } : args);
} catch (e) {
  if (!(e instanceof ZudocsError)) throw e;
  die(`✗ ${e.message}`, /opción|admite/.test(e.message) ? 2 : 1);
}

// Los procesos hijos reciben la configuración ya resuelta: no vuelven a buscarla.
const env = { ...process.env, INIT_CWD: callerDir(), ZUDOCS_CONFIG: ctx.configPath, ZUDOCS_OUT_DIR: ctx.outDir, DOCUSAURUS_GENERATED_FILES_DIR_NAME: ctx.generatedDirName };
// Por debajo de este tamaño Docusaurus incrusta un recurso en el CSS como data: URI. Su valor por defecto
// (10 kB) metería las fuentes pequeñas en la hoja de estilos, que bloquea el pintado, y obligaría a
// permitir data: en font-src. Docusaurus lee la variable al cargarse: se fija aquí, en el entorno del hijo.
env.WEBPACK_URL_LOADER_LIMIT ??= "2048";
const run = (file, extra = []) => {
  const r = spawnSync(process.execPath, [file, ...extra], { stdio: "inherit", env, cwd: templateDir });
  if (r.error) die(`✗ No se pudo ejecutar ${file}: ${r.error.message}`);
  if (r.signal) process.kill(process.pid, r.signal);
  if (r.status !== 0) process.exit(r.status ?? 1);
};
// Servidores (start, serve): proceso asíncrono que recibe las señales del padre. Con spawnSync, terminar
// zudocs (SIGTERM de un gestor de procesos o de CI) dejaba a Docusaurus huérfano y con el puerto ocupado.
const serve = (file, extra = []) => {
  const child = spawn(process.execPath, [file, ...extra], { stdio: "inherit", env, cwd: templateDir });
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) process.on(signal, () => child.kill(signal));
  child.on("error", (e) => die(`✗ No se pudo ejecutar ${file}: ${e.message}`));
  child.on("exit", (code, signal) => process.exit(signal ? 0 : (code ?? 1)));
};
const docusaurusBin = createRequire(import.meta.url).resolve("@docusaurus/core/bin/docusaurus.mjs");
const script = (name, extra = []) => run(join(templateDir, "scripts", `${name}.mjs`), extra);
const docusaurus = (extra) => run(docusaurusBin, extra);
const strict = args.strict ? ["--strict"] : [];

switch (command) {
  case "info":
    for (const [k, v] of Object.entries({
      configuración: ctx.configPath, documentación: ctx.docsDir, estáticos: existsSync(ctx.staticDir) ? ctx.staticDir : `${ctx.staticDir} (no existe)`, salida: ctx.outDir,
      "URL pública": ctx.url ? ctx.href() : `sin "url" (baseUrl ${ctx.baseUrl})`,
      caché: ctx.isDefault ? join(templateDir, ".docusaurus") : ctx.workDir, generados: ctx.generatedStaticDir, "llms.txt": ctx.llmsPath,
      fuentes: [...ctx.localFonts, ...ctx.remoteFonts].join(", ") || "las del sistema",
      páginas: Object.entries(ctx.pages).filter(([, on]) => on).map(([p]) => p).join(", ") || "ninguna",
    })) say(`${k.padEnd(14)} ${v}`);
    break;
  case "verify": script("verify", strict); break;
  case "llms": script("llms"); break;
  case "new": script("new", args.rest); break;
  case "fonts": script("fonts", [...(args.outDir ? ["--out-dir", args.outDir] : []), ...args.rest]); break;
  case "headers": script("headers"); break;
  case "build": {
    script("verify", strict);
    script("llms");
    // Docusaurus ejecuta el paquete de servidor desde la carpeta de salida como CommonJS: dentro de un
    // proyecto con "type": "module" falla. Se compila siempre en la carpeta de trabajo de zudocs y se mueve.
    const direct = ctx.outDir === join(templateDir, "build");
    const target = direct ? ctx.outDir : ctx.stagingDir;
    docusaurus(["build", templateDir, "--out-dir", target, ...args.rest]);
    if (!direct) {
      rmSync(ctx.outDir, { recursive: true, force: true });
      mkdirSync(dirname(ctx.outDir), { recursive: true });
      // Mover es atómico en el mismo sistema de archivos; entre sistemas distintos se copia.
      try { renameSync(target, ctx.outDir); } catch { cpSync(target, ctx.outDir, { recursive: true }); rmSync(target, { recursive: true, force: true }); }
    }
    if (args.headers) script("headers");
    say(`✓ ${ctx.site.name}: sitio en ${ctx.rel(ctx.outDir)}`);
    break;
  }
  case "start":
    script("llms");
    serve(docusaurusBin, ["start", templateDir, ...args.rest]);
    break;
  case "serve":
    if (!existsSync(join(ctx.outDir, "index.html"))) die(`✗ No hay sitio compilado en ${ctx.rel(ctx.outDir)}. Ejecuta antes "zudocs build".`);
    serve(docusaurusBin, ["serve", templateDir, "--dir", ctx.outDir, ...args.rest]);
    break;
}
