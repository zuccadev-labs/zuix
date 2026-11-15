// Resuelve qué zudocs.config.json se usa y todas las rutas que dependen de él.
// Lo comparten docusaurus.config.ts, sidebars.ts, el bin y los scripts: una sola regla para todos.
//
// Orden de búsqueda de la configuración:
//   1. --config <ruta> en la línea de comandos
//   2. variable de entorno ZUDOCS_CONFIG
//   3. zudocs.config.json en la carpeta desde la que se llamó
//   4. la configuración de la propia plantilla (el sitio de zuix)
// Las rutas de la configuración (docs.path, static, outDir, llms.append) son relativas al archivo.
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Carpeta de la plantilla (zudocs/). */
export const templateDir = join(dirname(fileURLToPath(import.meta.url)), "..");
/** Raíz del repositorio de zuix. */
export const repoDir = join(templateDir, "..");
export const PAGES = ["components", "icons", "tokens"];

/** Carpeta desde la que el usuario lanzó el comando (pnpm cambia el cwd al del paquete). */
export const callerDir = () => process.env.INIT_CWD || process.cwd();

/** Separa `--config`, `--out-dir` y `--strict` del resto de argumentos. */
export function parseArgs(argv = process.argv.slice(2)) {
  const out = { config: undefined, outDir: undefined, strict: false, rest: [] };
  const args = argv.filter((a) => a !== "--");
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    const value = (name) => (a === name ? args[++i] : a.startsWith(`${name}=`) ? a.slice(name.length + 1) : undefined);
    if (a === "--config" || a.startsWith("--config=")) out.config = value("--config");
    else if (a === "--out-dir" || a.startsWith("--out-dir=")) out.outDir = value("--out-dir");
    else if (a === "--strict") out.strict = true;
    else out.rest.push(a);
  }
  return out;
}

export function findConfig(explicit) {
  const own = join(templateDir, "zudocs.config.json");
  if (explicit) return resolve(callerDir(), explicit);
  if (process.env.ZUDOCS_CONFIG) return resolve(callerDir(), process.env.ZUDOCS_CONFIG);
  const local = join(callerDir(), "zudocs.config.json");
  return existsSync(local) ? local : own;
}

/**
 * Carga la configuración y calcula las rutas del proyecto.
 * @param {{ config?: string, outDir?: string }} [options]
 */
export function loadZudocs(options = {}) {
  const configPath = findConfig(options.config);
  if (!existsSync(configPath)) throw new Error(`No existe la configuración de zudocs: ${configPath}`);
  const site = JSON.parse(readFileSync(configPath, "utf8"));
  const configDir = dirname(configPath);
  const isDefault = resolve(configPath) === resolve(templateDir, "zudocs.config.json");
  const from = (p) => (isAbsolute(p) ? p : resolve(configDir, p));

  // Cada proyecto externo tiene su carpeta de trabajo dentro de la plantilla: caché de Docusaurus,
  // caché del empaquetador y llms.txt generado. Así dos proyectos no se pisan y el proyecto no se ensucia.
  const slug = `${String(site.name ?? "sitio").normalize("NFD").replace(/[^\w]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || "sitio"}-${createHash("sha1").update(resolve(configPath)).digest("hex").slice(0, 8)}`;
  const workDir = isDefault ? templateDir : join(templateDir, ".zudocs", slug);
  const staticDir = from(site.static ?? "static");
  const generatedStaticDir = isDefault ? staticDir : join(workDir, "static");
  const docsDir = from(site.docs?.path ?? "docs");
  const outDir = options.outDir ? resolve(callerDir(), options.outDir) : process.env.ZUDOCS_OUT_DIR ? resolve(process.env.ZUDOCS_OUT_DIR) : from(site.outDir ?? "build");
  const pages = Object.fromEntries(PAGES.map((p) => [p, site.pages?.[p] === true]));
  const areas = (site.docs?.areas ?? []).filter((a) => existsSync(join(docsDir, a.id)));

  return {
    site, configPath, configDir, isDefault, slug, workDir, docsDir, outDir, pages, areas,
    /** Diagramas Mermaid activos (`markdown.mermaid`). Desactivados por defecto. */
    mermaid: site.markdown?.mermaid === true,
    /** Carpeta de recursos estáticos del proyecto (logo, imágenes). Puede no existir. */
    staticDir,
    /** Carpetas que Docusaurus sirve como estáticas: la del proyecto y la de archivos generados. */
    staticDirs: [...new Set([staticDir, generatedStaticDir])].filter((d) => d === generatedStaticDir || existsSync(d)),
    llmsPath: join(generatedStaticDir, "llms.txt"),
    llmsAppend: site.llms?.append ? from(site.llms.append) : undefined,
    /** Nombre de la carpeta de archivos generados de Docusaurus, relativo a la plantilla. */
    generatedDirName: isDefault ? ".docusaurus" : relative(templateDir, join(workDir, "docusaurus")),
    bundlerCacheDir: isDefault ? undefined : join(workDir, "cache"),
    /** Ruta legible en mensajes: relativa a la carpeta de llamada si queda dentro, absoluta si no. */
    rel: (p) => { const r = relative(callerDir(), p); return r.startsWith("..") ? p : r || "."; },
  };
}
