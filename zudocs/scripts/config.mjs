// Resuelve qué zudocs.config.json se usa, lo valida contra zudocs.schema.json y calcula todas las rutas
// que dependen de él. Lo comparten docusaurus.config.ts, sidebars.ts, el bin y los scripts: una sola regla.
//
// Orden de búsqueda de la configuración:
//   1. --config <ruta> en la línea de comandos (archivo, o carpeta que contiene zudocs.config.json)
//   2. variable de entorno ZUDOCS_CONFIG
//   3. zudocs.config.json en la carpeta desde la que se llamó
//   4. la configuración de la propia plantilla (el sitio de zuix)
// Las rutas de la configuración (docs.path, static, outDir, llms.append, fuentes locales) son relativas al archivo.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, parse, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

/** Carpeta de la plantilla (zudocs/). */
export const templateDir = join(dirname(fileURLToPath(import.meta.url)), "..");
/** Raíz del repositorio de zuix. */
export const repoDir = join(templateDir, "..");
export const PAGES = ["components", "icons", "tokens", "loaders", "effects"];
export const CONFIG_NAME = "zudocs.config.json";

/** Error de uso o de configuración: el mensaje ya es legible y no necesita traza. */
export class ZudocsError extends Error {}

/** Carpeta desde la que el usuario lanzó el comando (pnpm cambia el cwd al del paquete). */
export const callerDir = () => process.env.INIT_CWD || process.cwd();

const VALUE_FLAGS = { "--config": "config", "--out-dir": "outDir" };
const BOOLEAN_FLAGS = { "--strict": "strict", "--headers": "headers", "--help": "help", "-h": "help" };

/**
 * Separa las opciones propias de zudocs del resto de argumentos.
 * Una opción con valor sin su valor es un error: `--config` a secas no debe acabar compilando otro sitio.
 */
export function parseArgs(argv = process.argv.slice(2)) {
  const out = { config: undefined, outDir: undefined, strict: false, headers: false, help: false, rest: [] };
  const args = argv.filter((a) => a !== "--");
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    const name = a.startsWith("--") && a.includes("=") ? a.slice(0, a.indexOf("=")) : a;
    if (name in VALUE_FLAGS) {
      const value = a === name ? args[++i] : a.slice(name.length + 1);
      if (value === undefined || value === "" || (a === name && value.startsWith("--")))
        throw new ZudocsError(`La opción ${name} necesita un valor: ${name} <ruta>`);
      out[VALUE_FLAGS[name]] = value;
    } else if (a in BOOLEAN_FLAGS) out[BOOLEAN_FLAGS[a]] = true;
    else out.rest.push(a);
  }
  return out;
}

/** Ruta del archivo de configuración que se usará. Una carpeta vale por su zudocs.config.json. */
export function findConfig(explicit) {
  const pick = (value) => {
    const path = resolve(callerDir(), value);
    return existsSync(path) && statSync(path).isDirectory() ? join(path, CONFIG_NAME) : path;
  };
  if (explicit) return pick(explicit);
  if (process.env.ZUDOCS_CONFIG) return pick(process.env.ZUDOCS_CONFIG);
  const local = join(callerDir(), CONFIG_NAME);
  return existsSync(local) ? local : join(templateDir, CONFIG_NAME);
}

// ── Validación ──────────────────────────────────────────────────────────────────────────────────────────
/**
 * Valida `value` contra el subconjunto de JSON Schema que usa zudocs.schema.json:
 * type, enum, const, required, properties, additionalProperties: false, items, minItems, uniqueItems,
 * minLength, maxLength y pattern. Cada palabra clave del esquema se aplica: un esquema con una palabra
 * que este validador no conoce es un error de programación y se dice.
 * @returns {string[]} problemas encontrados, con la ruta del campo.
 */
export function validateSchema(value, schema, path = "$") {
  const KNOWN = new Set([
    "$schema",
    "$comment",
    "title",
    "description",
    "default",
    "examples",
    "type",
    "enum",
    "const",
    "required",
    "properties",
    "additionalProperties",
    "items",
    "minItems",
    "uniqueItems",
    "minLength",
    "maxLength",
    "pattern",
    "patternHint",
  ]);
  const out = [];
  for (const key of Object.keys(schema))
    if (!KNOWN.has(key)) out.push(`esquema ${path}: palabra clave "${key}" sin soporte en el validador`);
  const kind = Array.isArray(value) ? "array" : value === null ? "null" : typeof value;
  if (schema.type && kind !== schema.type && !(schema.type === "integer" && Number.isInteger(value)))
    return [...out, `${path}: se esperaba ${schema.type} y es ${kind}`];
  if (schema.enum && !schema.enum.includes(value))
    out.push(`${path}: debe ser uno de ${schema.enum.map((v) => JSON.stringify(v)).join(", ")} y es ${JSON.stringify(value)}`);
  if ("const" in schema && value !== schema.const) out.push(`${path}: debe ser ${JSON.stringify(schema.const)}`);
  if (kind === "string") {
    if (schema.minLength !== undefined && value.trim().length < schema.minLength) out.push(`${path}: no puede estar vacío`);
    if (schema.maxLength !== undefined && value.length > schema.maxLength)
      out.push(`${path}: admite como máximo ${schema.maxLength} caracteres`);
    if (schema.pattern && !new RegExp(schema.pattern, "u").test(value))
      out.push(
        `${path}: ${JSON.stringify(value)} no es válido${schema.patternHint ? ` (${schema.patternHint})` : ` (patrón ${schema.pattern})`}`,
      );
  }
  if (kind === "array") {
    if (schema.minItems !== undefined && value.length < schema.minItems)
      out.push(`${path}: necesita al menos ${schema.minItems} elemento(s)`);
    if (schema.uniqueItems && new Set(value.map((v) => JSON.stringify(v))).size !== value.length)
      out.push(`${path}: tiene elementos repetidos`);
    if (schema.items) for (const [i, v] of value.entries()) out.push(...validateSchema(v, schema.items, `${path}[${i}]`));
  }
  if (kind === "object") {
    for (const key of schema.required ?? []) if (!(key in value)) out.push(`${path}: falta "${key}"`);
    for (const [key, v] of Object.entries(value)) {
      const sub = schema.properties?.[key];
      if (sub) out.push(...validateSchema(v, sub, `${path}.${key}`));
      else if (schema.additionalProperties === false) {
        const near = Object.keys(schema.properties ?? {}).find((k) => k.toLowerCase() === key.toLowerCase() || distance(k, key) <= 2);
        out.push(`${path}: campo desconocido "${key}"${near ? ` (¿"${near}"?)` : ""}`);
      }
    }
  }
  return out;
}

/** Distancia de edición, para sugerir el campo correcto ante una errata. */
function distance(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
}

/** Lee un JSON y, si no es válido, dice en qué línea. */
function readJson(path) {
  const text = readFileSync(path, "utf8").replace(/^﻿/, "");
  try {
    return JSON.parse(text);
  } catch (error) {
    const pos = Number(String(error.message).match(/position (\d+)/)?.[1]);
    const where = Number.isFinite(pos) ? ` (línea ${text.slice(0, pos).split("\n").length})` : "";
    throw new ZudocsError(`${path} no es JSON válido${where}: ${error.message}`);
  }
}

const inside = (child, parent) => {
  const r = relative(parent, child);
  return r === "" || (!r.startsWith(`..${sep}`) && r !== ".." && !isAbsolute(r));
};

/**
 * Motivo por el que `outDir` no puede usarse como salida, o `undefined` si es segura.
 * `build` vacía la carpeta de salida antes de escribir: nunca debe contener otra cosa que un sitio compilado.
 */
export function unsafeOutDir(outDir, protectedDirs) {
  if (outDir === parse(outDir).root) return "es la raíz del sistema de archivos";
  for (const [label, dir] of protectedDirs) if (dir && inside(dir, outDir)) return `contiene ${label} (${dir})`;
  if (inside(homedir(), outDir)) return "contiene la carpeta personal";
  if (existsSync(outDir)) {
    if (!statSync(outDir).isDirectory()) return "existe y no es una carpeta";
    const entries = readdirSync(outDir);
    if (entries.length && !(entries.includes("index.html") && entries.includes("assets")))
      return "ya existe, no está vacía y no parece un sitio compilado (sin index.html ni assets/): bórrala a mano o elige otra";
  }
  return undefined;
}

/**
 * Carga la configuración, la valida y calcula las rutas del proyecto.
 * Lanza `ZudocsError` con todos los problemas encontrados si la configuración no es válida.
 * @param {{ config?: string, outDir?: string }} [options]
 */
export function loadZudocs(options = {}) {
  const configPath = findConfig(options.config);
  if (!existsSync(configPath)) throw new ZudocsError(`No existe la configuración de zudocs: ${configPath}`);
  if (statSync(configPath).isDirectory()) throw new ZudocsError(`${configPath} es una carpeta sin ${CONFIG_NAME}`);
  const site = readJson(configPath);
  const problems = validateSchema(site, readJson(join(templateDir, "zudocs.schema.json")));
  if (problems.length)
    throw new ZudocsError(`${configPath} no cumple el esquema (zudocs.schema.json):\n${problems.map((p) => `  · ${p}`).join("\n")}`);

  const configDir = dirname(configPath);
  const isDefault = resolve(configPath) === resolve(templateDir, CONFIG_NAME);
  const from = (p) => (isAbsolute(p) ? p : resolve(configDir, p));

  // Cada proyecto tiene su carpeta de trabajo dentro de la plantilla: caché de Docusaurus, caché del
  // empaquetador y archivos generados. Así dos proyectos no se pisan y el proyecto no se ensucia.
  const slug = `${
    site.name
      .normalize("NFD")
      .replace(/[^\w]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "sitio"
  }-${createHash("sha1").update(resolve(configPath)).digest("hex").slice(0, 8)}`;
  const workDir = isDefault ? templateDir : join(templateDir, ".zudocs", slug);
  const staticDir = from(site.static ?? "static");
  // Archivos generados en cada build (robots.txt, llms-full.txt, copias .md): nunca en la carpeta del proyecto.
  const generatedStaticDir = join(templateDir, ".zudocs", isDefault ? "_zuix" : slug, "static");
  const docsDir = from(site.docs.path);
  const outDir = options.outDir
    ? resolve(callerDir(), options.outDir)
    : process.env.ZUDOCS_OUT_DIR
      ? resolve(callerDir(), process.env.ZUDOCS_OUT_DIR)
      : from(site.outDir ?? "build");
  const pages = Object.fromEntries(PAGES.map((p) => [p, site.pages?.[p] === true]));
  const areas = site.docs.areas.filter((a) => existsSync(join(docsDir, a.id)));

  // URL pública. ZUDOCS_URL y ZUDOCS_BASE_URL la sustituyen para una ejecución (vista previa, otro alojamiento).
  const url = (process.env.ZUDOCS_URL || site.url || "").replace(/\/+$/, "") || undefined;
  const baseUrl = (process.env.ZUDOCS_BASE_URL || site.baseUrl || "/").replace(/^\/?/, "/").replace(/\/?$/, "/");
  if (url && !/^https?:\/\/[^/\s]+$/.test(url))
    throw new ZudocsError(`URL del sitio no válida: "${url}". Es el origen, sin ruta: la ruta va en baseUrl.`);

  // Fuentes: una URL se enlaza tal cual (petición a un tercero); una ruta local se empaqueta con el sitio.
  const isRemote = (f) => /^https?:\/\//.test(f);
  const fonts = site.fonts ?? [];

  const ctx = {
    site,
    configPath,
    configDir,
    isDefault,
    slug,
    workDir,
    docsDir,
    outDir,
    pages,
    areas,
    url,
    baseUrl,
    /** Barra final en las rutas. `false`: /docs/guia → docs/guia.html, la forma que sirve sin redirección cualquier alojamiento estático. */
    trailingSlash: site.trailingSlash ?? false,
    /** Diagramas Mermaid activos (`markdown.mermaid`). Desactivados por defecto. */
    mermaid: site.markdown?.mermaid === true,
    /** Carpeta de recursos estáticos del proyecto (logo, imágenes). Puede no existir. */
    staticDir,
    generatedStaticDir,
    /** Carpetas que Docusaurus sirve como estáticas: la de archivos generados y la del proyecto, que gana si coinciden. */
    staticDirs: [generatedStaticDir, ...(existsSync(staticDir) ? [staticDir] : [])],
    /** llms.txt del sitio de zuix se versiona en su carpeta de estáticos; el de otro proyecto es un archivo generado más. */
    llmsPath: join(isDefault ? staticDir : generatedStaticDir, "llms.txt"),
    llmsAppend: site.llms?.append ? from(site.llms.append) : undefined,
    remoteFonts: fonts.filter(isRemote),
    localFonts: fonts.filter((f) => !isRemote(f)).map(from),
    /** Carpeta donde `build` compila antes de mover el resultado a `outDir`. */
    stagingDir: join(templateDir, ".zudocs", isDefault ? "_zuix" : slug, "build"),
    /** Nombre de la carpeta de archivos generados de Docusaurus, relativo a la plantilla. */
    generatedDirName: isDefault ? ".docusaurus" : relative(templateDir, join(workDir, "docusaurus")),
    bundlerCacheDir: isDefault ? undefined : join(workDir, "cache"),
    /** Ruta legible en mensajes: relativa a la carpeta de llamada si queda dentro, absoluta si no. */
    rel: (p) => {
      const r = relative(callerDir(), p);
      return r.startsWith("..") || isAbsolute(r) ? p : r || ".";
    },
    /** URL absoluta de una ruta del sitio si hay `url`; si no, la ruta con su baseUrl. */
    href: (route = "") => `${url ?? ""}${baseUrl}${route.replace(/^\//, "")}`,
  };

  // Comprobaciones que el esquema no puede expresar.
  const fatal = [];
  if (!existsSync(docsDir)) fatal.push(`docs.path: no existe la carpeta de documentación ${ctx.rel(docsDir)}`);
  else if (!statSync(docsDir).isDirectory()) fatal.push(`docs.path: ${ctx.rel(docsDir)} no es una carpeta`);
  const bad = unsafeOutDir(
    outDir,
    [
      ["la carpeta de documentación", docsDir],
      ["la configuración", configDir],
      ["los recursos estáticos", existsSync(staticDir) ? staticDir : undefined],
      ["la plantilla de zudocs", templateDir],
      ["la carpeta de trabajo actual", process.cwd()],
    ].filter(([, d]) => !(isDefault && d === templateDir && outDir !== templateDir && !inside(templateDir, outDir))),
  );
  if (bad) fatal.push(`carpeta de salida ${ctx.rel(outDir)}: ${bad}. La compilación la vacía antes de escribir.`);
  if (fatal.length) throw new ZudocsError(`${configPath}:\n${fatal.map((p) => `  · ${p}`).join("\n")}`);
  return ctx;
}
