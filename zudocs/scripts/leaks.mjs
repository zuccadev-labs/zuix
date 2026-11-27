// Rutas del sistema de archivos local en el sitio compilado. Un sitio publicado no debe llevar la ruta de la
// máquina que lo compiló: dice el nombre de usuario, cómo tiene organizado el disco y el nombre de proyectos
// que pueden ser privados. `build` y `verify` recorren la carpeta de salida y fallan si encuentran alguna.
import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join, parse, relative, sep } from "node:path";
import { callerDir, repoDir, templateDir } from "./config.mjs";

/**
 * Carpetas cuyas rutas absolutas no pueden aparecer en el sitio: la personal, la de trabajo, la de llamada,
 * la plantilla, el repositorio y las del proyecto (configuración, documentación y estáticos), con su ruta
 * real si alguna es un enlace simbólico. Se descartan las de menos de dos niveles (`/`, `/tmp`, `/root`):
 * aparecen en cualquier texto y no identifican a nadie.
 * @param {Partial<import("./config.d.mts").ZudocsContext>} [ctx]
 * @returns {string[]} de la más larga a la más corta, para que el aviso nombre la más concreta.
 */
export function localRoots(ctx = {}) {
  const dirs = [homedir(), process.cwd(), callerDir(), templateDir, repoDir, ctx.configDir, ctx.docsDir, ctx.staticDir];
  const out = new Set();
  for (const dir of dirs) {
    if (!dir) continue;
    let real = dir;
    try {
      real = realpathSync(dir);
    } catch {}
    for (const d of [dir, real]) {
      const { root } = parse(d);
      if (d.slice(root.length).split(/[\\/]/).filter(Boolean).length < 2) continue;
      out.add(d.replace(/[\\/]+$/, ""));
    }
  }
  return [...out].sort((a, b) => b.length - a.length);
}

/** Formas en que una ruta puede quedar escrita en un archivo: tal cual, con barras normales y escapada en JSON. */
function spellings(root) {
  const forms = new Set([root, root.replaceAll("\\", "/"), JSON.stringify(root).slice(1, -1)]);
  return [...forms].map((f) => Buffer.from(f));
}

/** ¿El byte que sigue a la coincidencia sigue el nombre de la carpeta? (`/home/ana` no es `/home/anabel`). */
const continuesName = (byte) => byte !== undefined && /[\w.-]/.test(String.fromCharCode(byte));

/**
 * Busca las rutas `roots` en todos los archivos de `dir`, binarios incluidos.
 * @param {string} dir carpeta del sitio compilado
 * @param {string[]} roots rutas absolutas (ver `localRoots`)
 * @returns {{ file: string, root: string, excerpt: string }[]} un hallazgo por archivo, con la ruta relativa a `dir`.
 */
export function findLocalPaths(dir, roots) {
  const needles = roots.map((root) => ({ root, forms: spellings(root) }));
  const found = [];
  const walk = (d) => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const path = join(d, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile() || (entry.isSymbolicLink() && statSync(path).isFile())) check(path);
    }
  };
  const check = (path) => {
    const bytes = readFileSync(path);
    for (const { root, forms } of needles)
      for (const form of forms) {
        let at = bytes.indexOf(form);
        while (at >= 0 && continuesName(bytes[at + form.length])) at = bytes.indexOf(form, at + 1);
        if (at < 0) continue;
        const excerpt = bytes
          .subarray(Math.max(0, at - 40), at + form.length + 40)
          .toString("utf8")
          .replace(/\s+/g, " ");
        found.push({ file: relative(dir, path).split(sep).join("/"), root, excerpt });
        return;
      }
  };
  if (existsSync(dir)) walk(dir);
  return found;
}

/** Mensajes de error legibles para los hallazgos de `findLocalPaths`. */
export function describeLeaks(found, label = "build") {
  return found.map(({ file, root, excerpt }) => `${label}/${file}: contiene la ruta local ${root} («…${excerpt}…»)`);
}
