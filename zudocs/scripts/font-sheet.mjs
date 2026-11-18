// Lectura de una hoja de fuentes remota para `zudocs fonts` (fonts.mjs). Lo que llega de la red no es de
// confianza: de cada bloque @font-face solo se conservan descriptores conocidos con valores de un alfabeto
// cerrado, el nombre del archivo sale de un alfabeto cerrado y del contenido, y la hoja local se escribe
// de nuevo con esas piezas. Nada del texto remoto llega tal cual a una ruta ni a la hoja generada.

/** Tamaño máximo de una hoja remota y de un archivo de fuente. Un subconjunto latino pesa decenas de KB. */
export const MAX_SHEET_BYTES = 2 * 1024 * 1024;
export const MAX_FONT_BYTES = 10 * 1024 * 1024;

/** Descriptores de @font-face que se copian a la hoja local. `src` se escribe aparte, con el archivo local. */
const DESCRIPTORS = new Set([
  "font-family",
  "font-style",
  "font-weight",
  "font-stretch",
  "font-width",
  "font-display",
  "unicode-range",
  "font-feature-settings",
  "font-variation-settings",
  "ascent-override",
  "descent-override",
  "line-gap-override",
  "size-adjust",
]);
// Letras, cifras, espacios, comillas y la puntuación de un nombre de familia, un peso o un rango Unicode. Sin
// paréntesis (no cabe un `url()`), sin barras, llaves, punto y coma ni signos de marcado.
const VALUE = /^[\w \t\r\n"',.%+?-]{1,4000}$/;
const SUBSET = /^[\w-]{1,40}$/;

/**
 * URL remota aceptable: https, sin credenciales. Devuelve el objeto URL o lanza un error legible.
 * @param {string} value
 */
export function remoteUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`URL inválida: ${value}`);
  }
  if (url.protocol !== "https:") throw new Error(`Solo se descargan URL https: ${value}`);
  if (url.username || url.password) throw new Error(`La URL no puede llevar credenciales: ${url.origin}${url.pathname}`);
  return url;
}

/** Nombre de familia como tramo de un nombre de archivo: minúsculas, cifras y guiones. */
export function familySlug(family) {
  const slug = String(family)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40)
    .replace(/-$/, "");
  return slug || "fuente";
}

/**
 * Bloques @font-face de una hoja que traen un archivo woff2 por https, de los subconjuntos pedidos.
 * Cada bloque viene precedido de un comentario con su subconjunto (`/* latin *\/`); sin comentario, entra siempre.
 * @param {string} sheet
 * @param {string[]} subsets
 * @returns {{ subset: string | undefined, family: string, src: URL, descriptors: [string, string][] }[]}
 */
export function fontFaces(sheet, subsets) {
  const out = [];
  for (const m of String(sheet).matchAll(/(?:\/\*([^*]*)\*\/\s*)?@font-face\s*\{([^{}]*)\}/g)) {
    // Un comentario que no es un nombre de subconjunto (una licencia, por ejemplo) no clasifica el bloque.
    const label = m[1]?.trim() ?? "";
    const subset = SUBSET.test(label) ? label : undefined;
    if (subset !== undefined && !subsets.includes(subset)) continue;
    let src;
    const descriptors = [];
    for (const declaration of m[2].split(";")) {
      const colon = declaration.indexOf(":");
      if (colon < 0) continue;
      const name = declaration.slice(0, colon).trim().toLowerCase();
      const value = declaration.slice(colon + 1).trim();
      if (name === "src") {
        // El descriptor conserva su sitio en el bloque; su valor lo pone fontFaceCss con el archivo local.
        if (src) continue;
        src = woff2Source(value);
        if (src) descriptors.push(["src", ""]);
      } else if (DESCRIPTORS.has(name) && VALUE.test(value)) descriptors.push([name, value.replace(/\s+/g, " ")]);
    }
    if (!src) continue;
    const family = descriptors.find(([name]) => name === "font-family")?.[1].replace(/["']/g, "") ?? "";
    out.push({ subset, family, src, descriptors });
  }
  return out;
}

/** Primera fuente `url(https://….woff2)` de un descriptor `src`, o `undefined`. */
function woff2Source(value) {
  for (const m of value.matchAll(/url\(\s*["']?([^\s"'()]+)["']?\s*\)/g)) {
    try {
      const url = remoteUrl(m[1]);
      if (url.pathname.endsWith(".woff2")) return url;
    } catch {
      // No es una URL https: se prueba con la siguiente fuente del descriptor.
    }
  }
  return undefined;
}

/** Los datos son un archivo WOFF2 (firma `wOF2`) de un tamaño razonable. */
export function isWoff2(data) {
  return data.length > 48 && data.length <= MAX_FONT_BYTES && data.subarray(0, 4).toString("latin1") === "wOF2";
}

/**
 * Nombre del archivo local de una fuente. Sale del contenido: una fuente variable sirve varios pesos con un solo archivo.
 * @param {{ subset?: string, family: string }} face
 * @param {string} hash  resumen hexadecimal del contenido
 */
export function fontFileName(face, hash) {
  if (!/^[0-9a-f]{8,}$/.test(hash)) throw new Error("resumen inválido");
  return `${familySlug(face.family)}-${face.subset ?? "all"}-${hash.slice(0, 8)}.woff2`;
}

/** Bloque @font-face de la hoja local: los descriptores aceptados y el archivo descargado como única fuente. */
export function fontFaceCss(face, fileName) {
  const lines = face.descriptors.map(([name, value]) => `  ${name}: ${name === "src" ? `url("./${fileName}") format("woff2")` : value};`);
  return `${face.subset ? `/* ${face.subset} */\n` : ""}@font-face {\n${lines.join("\n")}\n}\n`;
}

/** Texto dentro de un comentario CSS: sin la secuencia que lo cierra ni saltos de línea. */
export const cssComment = (text) =>
  String(text)
    .replace(/\*\//g, "*%2F")
    .replace(/[\r\n]+/g, " ");
