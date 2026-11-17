// Modelo de la documentación de un proyecto: qué documentos hay, en qué ruta se publican, qué títulos y
// anclas tienen. Lo comparten verify.mjs y llms.mjs para que comprueben y enlacen lo mismo que compila
// Docusaurus. Sin dependencias.
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

/** Separa el front matter del cuerpo. `problems` recoge lo que Docusaurus rechazaría o leería mal. */
export function parseFrontMatter(text) {
  const out = { data: {}, body: text, lines: 0, problems: [] };
  const src = text.replace(/^\uFEFF/, "");
  if (!/^---[ \t]*\r?\n/.test(src)) return out;
  const end = src.slice(3).search(/\r?\n---[ \t]*(\r?\n|$)/);
  if (end < 0) { out.problems.push("front matter sin cerrar (falta la línea --- final)"); return out; }
  const raw = src.slice(src.indexOf("\n") + 1, end + 3);
  const rest = src.slice(end + 3).replace(/^\r?\n---[ \t]*(\r?\n|$)/, "");
  out.body = rest;
  out.lines = src.length ? src.slice(0, src.length - rest.length).split("\n").length - 1 : 0;
  let last;
  for (const [i, line] of raw.split(/\r?\n/).entries()) {
    if (!line.trim() || /^\s*#/.test(line)) continue;
    if (line.includes("\t")) out.problems.push(`front matter, línea ${i + 2}: tabulador (YAML solo admite espacios)`);
    // Línea de continuación (lista o valor anidado): pertenece a la clave anterior.
    if (/^\s+\S/.test(line) || /^-\s/.test(line)) { if (!last) out.problems.push(`front matter, línea ${i + 2}: valor sin clave`); continue; }
    const m = line.match(/^([A-Za-z_][\w-]*):(?:\s+(.*))?$/);
    if (!m) { out.problems.push(`front matter, línea ${i + 2}: se esperaba "clave: valor" y hay "${line.trim().slice(0, 40)}"`); continue; }
    const [, key, value = ""] = m;
    if (key in out.data) out.problems.push(`front matter: clave "${key}" repetida`);
    let v = value.trim();
    const quoted = /^(["']).*\1$/.test(v);
    if (/^["']/.test(v) && !quoted) out.problems.push(`front matter: comillas sin cerrar en "${key}"`);
    else if (!quoted && /:\s/.test(v)) out.problems.push(`front matter: el valor de "${key}" contiene ": " y debe ir entre comillas`);
    if (quoted) v = v[0] === '"' ? v.slice(1, -1).replace(/\\(["\\])/g, "$1") : v.slice(1, -1).replace(/''/g, "'");
    else v = v.replace(/\s+#.*$/, "");
    out.data[key] = v;
    last = key;
  }
  return out;
}

/** Quita lo que no es prosa: bloques de código, código en línea y comentarios. Conserva los saltos de línea. */
export function stripCode(text, { inline = true } = {}) {
  const blank = (m) => m.replace(/[^\n]/g, " ");
  const blocks = text.replace(/^([ \t]*)(```+|~~~+)[^\n]*\n[\s\S]*?^\1\2[ \t]*$/gm, blank).replace(/<!--[\s\S]*?-->/g, blank);
  return inline ? blocks.replace(/(`+)[^`\n]*?\1/g, blank) : blocks;
}

/** Texto de un título sin marcas de Markdown, como lo ve el lector. */
const plain = (s) => s.replace(/\s+\{#[^}]+\}\s*$/, "").replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/<[^>]+>/g, "").replace(/(\*\*|__|\*|_|`|~~)/g, "").trim();

/** Ancla de un título como la genera Docusaurus (github-slugger): minúsculas, sin puntuación, espacios a guiones. */
export function slugify(text) {
  return text.toLowerCase().replace(/[^\p{L}\p{M}\p{N}\p{Pc}\- ]/gu, "").replace(/ /g, "-");
}

/** Títulos de un documento con su ancla. Los repetidos reciben -1, -2…; `{#id}` fija el ancla a mano. */
export function headings(body) {
  const seen = new Map();
  const out = [];
  const text = stripCode(body);
  const original = body.split("\n");
  for (const [i, line] of text.split("\n").entries()) {
    const m = line.match(/^ {0,3}(#{1,6})(?:[ \t]+(.*?))?[ \t]*#*[ \t]*$/);
    if (!m) continue;
    // El código en línea cuenta para el ancla: se lee de la línea original.
    const raw = (original[i].match(/^ {0,3}#{1,6}[ \t]+(.*?)[ \t]*$/)?.[1] ?? "").replace(/[ \t]+#+$/, "");
    const explicit = raw.match(/\{#([^}]+)\}\s*$/)?.[1];
    const title = plain(raw);
    let id = explicit ?? slugify(title);
    if (!explicit) { const n = seen.get(id) ?? 0; seen.set(id, n + 1); if (n) id = `${id}-${n}`; }
    out.push({ level: m[1].length, title, id, line: i + 1 });
  }
  return out;
}

const stripPrefix = (name) => name.replace(/^\d+\s*[-_.]\s*/, "");

/**
 * Todos los documentos de una carpeta, como los publica Docusaurus: sin los que empiezan por _,
 * con el prefijo numérico fuera de la ruta y README/index como portada de su carpeta.
 * @returns {{ file: string, rel: string, area: string, route: string, title: string, description: string, data: Record<string,string>, body: string, bodyOffset: number, headings: ReturnType<typeof headings>, problems: string[], index: boolean, draft: boolean }[]}
 */
export function listDocs(docsDir) {
  const out = [];
  const walk = (dir) => {
    const entries = readdirSync(dir, { withFileTypes: true }).filter((e) => !e.name.startsWith("_") && !e.name.startsWith(".")).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    // La portada primero; después los archivos en orden y, al final, las subcarpetas.
    const isIndex = (n) => /^(README|index)\.mdx?$/i.test(n);
    const files = entries.filter((e) => e.isFile() && /\.mdx?$/.test(e.name));
    for (const e of [...files.filter((f) => isIndex(f.name)), ...files.filter((f) => !isIndex(f.name))]) out.push(readDoc(docsDir, join(dir, e.name)));
    for (const e of entries.filter((d) => d.isDirectory())) walk(join(dir, e.name));
  };
  walk(docsDir);
  return out;
}

function readDoc(docsDir, file) {
  const rel = relative(docsDir, file).split(sep).join("/");
  const fm = parseFrontMatter(readFileSync(file, "utf8"));
  const parts = rel.split("/");
  const name = parts.pop().replace(/\.mdx?$/, "");
  const dirs = parts.map(stripPrefix);
  const base = stripPrefix(name);
  // Portada de carpeta: README, index o un archivo con el nombre de su carpeta.
  const index = /^(README|index)$/i.test(name) || (dirs.length > 0 && base === dirs.at(-1));
  let route = [...dirs, ...(index ? [] : [fm.data.id || base])].join("/");
  const slug = fm.data.slug;
  if (slug) route = slug.startsWith("/") ? slug.replace(/^\/+|\/+$/g, "") : [...dirs, slug].join("/").replace(/\/+$/, "");
  const hs = headings(fm.body);
  const h1 = hs.find((h) => h.level === 1);
  // Primer párrafo de prosa: ni título, ni cita, ni tabla, ni lista, ni JSX.
  const first = stripCode(fm.body, { inline: false }).split(/\n[ \t]*\n/).map((p) => p.trim()).find((p) => p && !/^(#|>|---|\||<|import |export |:::|[-*+] |\d+\. |!\[)/.test(p)) ?? "";
  return {
    file, rel, area: rel.includes("/") ? rel.split("/")[0] : "", route: `docs/${route}`.replace(/\/$/, ""),
    title: fm.data.title || h1?.title || base, description: fm.data.description || "", summary: plain(first),
    data: fm.data, body: fm.body, bodyOffset: fm.lines, headings: hs, problems: fm.problems, index,
    draft: fm.data.draft === "true" || fm.data.unlisted === "true",
  };
}

/** Primera frase de un texto, cortada en un límite de palabra si es larga. */
export function sentence(text, max = 200) {
  const clean = text.replace(/\s+/g, " ").trim();
  const end = clean.search(/[.!?…](\s|$)/);
  const one = end > 20 ? clean.slice(0, end + 1) : clean;
  return one.length <= max ? one : `${one.slice(0, one.lastIndexOf(" ", max - 1)).replace(/[,;:]$/, "")}…`;
}
