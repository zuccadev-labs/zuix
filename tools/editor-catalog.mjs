#!/usr/bin/env node
// Genera y comprueba el catálogo del conector de editores visuales (`pnpm editor`).
//   zui/editor/catalog.json         bloques de zui, zout y del conector, tokens editables y estilo admitido
//   zui/editor/document.schema.json forma del documento de página (sale de zui/src/editor/document-schema.ts)
//   zui/src/editor/blocks.generated.ts  tipo BlockType y lista BLOCK_TYPES
// Lee los manifiestos (`pnpm manifest`), el contrato HTML (`pnpm html`), tokens y zicon. Falla si:
//   · el catálogo no cumple zui/editor/catalog.schema.json, o un preset no valida contra el propio catálogo;
//   · un bloque con serialización propia no produce exactamente el marcado de html.json en un ejemplo que se puede
//     expresar como documento (la comparación normaliza espacios, orden de atributos y entidades);
//   · un bloque nombra una prop que su manifiesto no tiene, o un icono que zicon no tiene;
//   · la medida de contraste del navegador (zui/src/editor/contrast.ts) no da lo mismo que tokens/src/validate.mjs.
// Uso: node tools/editor-catalog.mjs [--verbose]
import { build, transformSync } from "esbuild";
import { spawnSync } from "node:child_process";
import { closeSync, mkdirSync, openSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { extractUses, parseRules } from "../tokens/src/pairs.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const verbose = process.argv.includes("--verbose");
const read = (p) => JSON.parse(readFileSync(join(root, p), "utf8"));
const errors = [];
const notes = [];

// ── Código del conector (TypeScript), empaquetado para Node ─────────────────────────────────────────────────
const tmp = join(root, ".tmp");
mkdirSync(tmp, { recursive: true });
const bundle = join(tmp, `editor-catalog-${process.pid}.cjs`);
await build({
  stdin: {
    contents: `
export { BUILTIN_BLOCKS } from "./src/editor/blocks";
export { DOCUMENT_JSON_SCHEMA } from "./src/editor/document-schema";
export { validateSchema } from "./src/editor/json-schema";
export { toHTML } from "./src/editor/render";
export { validateDocument } from "./src/editor/validate";
export { CATALOG_SCHEMA_VERSION, DOCUMENT_SCHEMA_VERSION } from "./src/editor/types";
export { PROTOCOL_VERSION } from "./src/editor/protocol";
export { checkContrast } from "./src/editor/contrast";
export { ADAPTIVE_VARIANTS } from "./src/editor/adaptive";
`,
    resolveDir: join(root, "zui"),
    sourcefile: "editor-catalog-entry.ts",
    loader: "ts",
  },
  outfile: bundle,
  bundle: true,
  format: "cjs",
  platform: "node",
  logLevel: "error",
});
const E = createRequire(import.meta.url)(bundle);
rmSync(bundle, { force: true });

// ── Fuentes ──────────────────────────────────────────────────────────────────────────────────────────────────
const zuiPkg = read("zui/package.json");
const tokensJson = read("tokens/dist/tokens.json");
const base = read("tokens/src/base.json");
const icons = read("zicon/manifest.json").icons.map((i) => i.name);
const iconSet = new Set(icons);
const manifests = { zui: read("zui/manifest.json").components, zout: read("zout/manifest.json").components };
const contracts = { zui: read("zui/html.json").components, zout: read("zout/html.json").components };
const specs = new Map(E.BUILTIN_BLOCKS.map((b) => [b.type, b]));

// ── Props del manifiesto → JSON Schema ─────────────────────────────────────────────────────────────────────
const SLOT_TYPES = /^(ReactNode|ReactElement)(\s*\|\s*null)?$/;
const SKIP_TYPES = /^(Ref<|ElementType|.*HTMLAttributes|.*Props$|Omit<|Date$|unknown$|T\[\]$|CSSProperties)/;
const isEvent = (p) => /=>/.test(p.type ?? "") || /Handler(<|$)/.test(p.type ?? "");

/** Esquema de una prop a partir de su tipo de TypeScript del manifiesto, o null si no es una prop de datos. */
function propSchema(p) {
  const t = String(p.type ?? "").trim();
  const d = p.description ? { description: p.description } : {};
  const def = (s) =>
    p.default !== undefined && p.default !== null && E.validateSchema(p.default, s).length === 0 ? { ...s, default: p.default } : s;
  if (p.name.startsWith("...") || SLOT_TYPES.test(t) || isEvent(p) || SKIP_TYPES.test(t)) return null;
  if (t === "enum" && Array.isArray(p.values)) {
    const ints = p.values.every((v) => Number.isInteger(v));
    return def({ type: ints ? "integer" : "string", enum: p.values, "x-control": "select", ...d });
  }
  if (t === "boolean") return def({ type: "boolean", "x-control": "switch", ...d });
  if (t === "number") return def({ type: "number", "x-control": "number", ...d });
  if (t === "string") {
    if (/(^href$|url$|Url$|^to$|link$|Href$)/.test(p.name))
      return def({ type: "string", format: "uri-reference", "x-control": "link", ...d });
    if (/^(src|image|cover|poster|logo|avatar|photo)$/i.test(p.name))
      return def({ type: "string", format: "uri-reference", "x-control": "image", ...d });
    return def({ type: "string", "x-control": "text", ...d });
  }
  if (t === "IconName") return def({ type: "string", "x-control": "icon", ...d });
  if (t === "IconName | null") return def({ type: ["string", "null"], "x-control": "icon", ...d });
  if (/^\d+(\s*\|\s*\d+)+$/.test(t))
    return def({ type: "integer", enum: t.split("|").map((x) => Number(x.trim())), "x-control": "select", ...d });
  if (/^"[^"]*"(\s*\|\s*"[^"]*")+$/.test(t))
    return def({ type: "string", enum: t.split("|").map((x) => x.trim().slice(1, -1)), "x-control": "select", ...d });
  if (t === "number | string" || t === "string | number")
    return def({ anyOf: [{ type: "number" }, { type: "string" }], "x-control": "text", ...d });
  if (t === "string | null") return def({ type: ["string", "null"], "x-control": "text", ...d });
  if (t === "number | null") return def({ type: ["number", "null"], "x-control": "number", ...d });
  if (t === "string[]") return def({ type: "array", items: { type: "string" }, "x-control": "json", ...d });
  if (t === "number[]") return def({ type: "array", items: { type: "number" }, "x-control": "json", ...d });
  return def({ "x-control": "json", description: `${p.description ? `${p.description} ` : ""}Tipo: ${t}.` });
}

// ── Ejemplos JSX → nodos del documento ──────────────────────────────────────────────────────────────────────
const FRAG = Symbol("fragment");
class NotConvertible extends Error {}
// biome-ignore lint/complexity/useArrowFunction: el sustituto debe poder llamarse y construirse.
const STUB = new Proxy(function () {}, {
  get: (_, k) => (k === Symbol.toPrimitive ? () => "" : k === "then" || k === Symbol.iterator ? undefined : STUB),
  apply: () => STUB,
  construct: () => STUB,
});
const componentNames = new Set(["Icon"]);
for (const list of Object.values(manifests))
  for (const m of list) for (const n of [m.name, ...(m.exports ?? [])]) if (/^[A-Z]/.test(n)) componentNames.add(n);
const markers = new Map([...componentNames].map((n) => [n, { $component: n }]));
const fakeReact = { createElement: (type, props, ...children) => ({ $el: true, type, props: props ?? {}, children }), Fragment: FRAG };
const GLOBALS = new Set(["Math", "JSON", "Number", "String", "Array", "Object", "undefined", "NaN", "Infinity", "Boolean"]);
const scope = new Proxy(
  {},
  {
    has: () => true,
    get: (_, key) =>
      key === Symbol.unscopables
        ? undefined
        : key === "React"
          ? fakeReact
          : markers.has(key)
            ? markers.get(key)
            : GLOBALS.has(key)
              ? globalThis[key]
              : STUB,
  },
);
function evaluate(code) {
  if (/^\s*function\s/.test(code)) throw new NotConvertible("ejemplo con estado");
  const js = transformSync(`<>${code}</>`, { loader: "jsx", jsx: "transform" }).code.trim().replace(/;$/, "");
  return new Function("scope", `with (scope) { return (${js}); }`)(scope);
}
const isJson = (v) =>
  v === null ||
  ["string", "boolean"].includes(typeof v) ||
  (typeof v === "number" && Number.isFinite(v)) ||
  (Array.isArray(v)
    ? v.every(isJson)
    : v &&
      typeof v === "object" &&
      !v.$el &&
      !v.$component &&
      Object.getPrototypeOf(v) === Object.prototype &&
      Object.values(v).every(isJson));
const NATIVE = {
  p: () => ({ type: "Paragraph" }),
  blockquote: (a) => ({ type: "Quote", props: a.cite ? { cite: a.cite } : undefined, attrs: ["cite"] }),
  a: (a) => ({ type: "Anchor", props: a.href !== undefined ? { href: a.href } : undefined, attrs: ["href"] }),
  img: (a) => ({
    type: "Image",
    props: Object.fromEntries(["src", "alt", "width", "height", "loading"].filter((k) => a[k] !== undefined).map((k) => [k, a[k]])),
    attrs: ["src", "alt", "width", "height", "loading"],
  }),
  ul: () => ({ type: "List" }),
  ol: () => ({ type: "List", props: { ordered: true } }),
  li: () => ({ type: "ListItem" }),
};
for (const n of [1, 2, 3, 4, 5, 6]) NATIVE[`h${n}`] = () => ({ type: "Heading", props: { level: n } });
for (const t of ["strong", "em", "code", "kbd", "mark", "small", "s", "span", "sub", "sup"])
  NATIVE[t] = () => ({ type: "InlineText", props: { tag: t } });
for (const t of ["div", "section", "article", "header", "footer", "main", "aside", "nav"])
  NATIVE[t] = () => ({ type: "Section", props: { tag: t } });

/** Convierte el valor de un ejemplo en nodos. `state.dropped` se marca si se descartó un manejador. */
function convert(value, state) {
  if (value === null || value === undefined || value === false || value === true) return [];
  if (value === STUB) throw new NotConvertible("usa datos del ejemplo");
  if (typeof value === "string") return value === "" ? [] : [{ id: state.id(), type: "#text", text: value }];
  if (typeof value === "number") return [{ id: state.id(), type: "#text", text: String(value) }];
  if (Array.isArray(value)) return value.flatMap((v) => convert(v, state));
  if (!value.$el) throw new NotConvertible("valor que no es un elemento");
  const { type, props, children } = value;
  if (type === FRAG) return convert(children, state);
  if (typeof type === "string") {
    const map = NATIVE[type];
    if (!map) throw new NotConvertible(`<${type}>`);
    const m = map(props);
    for (const k of Object.keys(props)) if (k !== "key" && !(m.attrs ?? []).includes(k)) throw new NotConvertible(`<${type} ${k}>`);
    const node = { id: state.id(), type: m.type };
    if (m.props && Object.keys(m.props).length) node.props = m.props;
    const kids = convert(children, state);
    if (kids.length) node.children = kids;
    return [node];
  }
  const name = type?.$component;
  if (!name) throw new NotConvertible("componente desconocido");
  if (name === "Icon") {
    for (const k of Object.keys(props))
      if (!["name", "size", "variant", "label", "key"].includes(k) || !isJson(props[k])) throw new NotConvertible(`Icon ${k}`);
    const { key: _k, ...rest } = props;
    return [{ id: state.id(), type: "Icon", props: rest }];
  }
  const spec = specs.get(name);
  if (!spec) throw new NotConvertible(`${name} no tiene serialización propia`);
  const node = { id: state.id(), type: name };
  for (const [k, v] of Object.entries(props)) {
    if (k === "key") continue;
    if (spec.slots?.[k]) {
      const list = convert(v, state);
      if (list.length) node.slots = { ...node.slots, [k]: list };
    } else if (k in spec.props) {
      if (typeof v === "function" || v === STUB || !isJson(v)) throw new NotConvertible(`${name} ${k}`);
      node.props = { ...node.props, [k]: v };
    } else if (typeof v === "function" && /^on[A-Z]/.test(k)) state.dropped = true;
    else throw new NotConvertible(`${name} ${k}`);
  }
  const kids = convert(children, state);
  if (kids.length) {
    if (!spec.children) throw new NotConvertible(`${name} no admite hijos`);
    node.children = kids;
  }
  return [node];
}

// ── Normalización de HTML para comparar con html.json ─────────────────────────────────────────────────────
const decode = (s) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (_, e) =>
    e[0] === "#"
      ? String.fromCodePoint(e[1] === "x" ? Number.parseInt(e.slice(2), 16) : Number(e.slice(1)))
      : { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " }[e.toLowerCase()],
  );
function normalize(html) {
  const out = [];
  for (const token of html.replace(/<link rel="preload"[^>]*>/g, "").split(/(<[^>]+>)/)) {
    if (!token) continue;
    if (token.startsWith("</")) out.push(token.toLowerCase());
    else if (token.startsWith("<")) {
      const name = /^<([\w-]+)/.exec(token)[1].toLowerCase();
      const attrs = [...token.slice(name.length + 1).matchAll(/([^\s"'=/>]+)(?:="([^"]*)")?/g)]
        .map(([, k, v = ""]) => {
          let value = decode(v);
          if (k === "style") value = value.replace(/\s*([:;])\s*/g, "$1").replace(/;$/, "");
          return `${k}="${value}"`;
        })
        .sort();
      out.push(`<${name}${attrs.length ? ` ${attrs.join(" ")}` : ""}>`);
    } else {
      const text = decode(token).replace(/\s+/g, " ").trim();
      if (text) out.push(text);
    }
  }
  return out.join("");
}

// ── Bloques ──────────────────────────────────────────────────────────────────────────────────────────────
const GROUP_ICON = {
  actions: "cursor-arrow-rays",
  forms: "pencil-square",
  agenda: "calendar-days",
  ai: "sparkles",
  carousel: "film",
  charts: "chart-bar",
  chat: "chat-bubble-left-right",
  content: "document-text",
  dashboard: "squares-2x2",
  data: "table-cells",
  effects: "sparkles",
  feedback: "bell",
  media: "photo",
  navigation: "bars-3",
  nodes: "share",
  overlay: "window",
  people: "users",
  terminal: "command-line",
  time: "clock",
  layout: "view-columns",
};
const VARIANT_PROPS = ["variant", "tone", "size", "material", "shape", "surface", "layout", "emphasis", "align", "width"];
const KNOWN_DOM_EVENTS = new Set(["open", "close", "change", "select", "sort", "input", "add", "resize", "modechange"]);
const slug = (s) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "preset";
const uniq = (used, id) => {
  let out = id;
  for (let i = 2; used.has(out); i++) out = `${id}-${i}`;
  used.add(out);
  return out;
};

/** Prop del manifiesto que corresponde a una prop del bloque (las de subcomponentes van con prefijo: `Grid.min`). */
const manifestProp = (m, type, prop) => m?.props.find((p) => p.name === `${type}.${prop}`) ?? m?.props.find((p) => p.name === prop);

let verified = 0;
let checkedExamples = 0;
const blocks = [];

function blockFrom({ type, pkg, manifest, spec }) {
  const isMain = !manifest || manifest.name === type;
  const contract = isMain && manifest ? contracts[pkg]?.[manifest.name] : undefined;
  const html = spec ? "template" : contract ? "preset" : "none";
  const properties = {};
  if (spec) {
    for (const [name, s] of Object.entries(spec.props)) {
      const mp = manifestProp(manifest, type, name);
      if (spec.package !== "core" && s === true && !mp) errors.push(`${type}: la prop "${name}" no está en su manifiesto`);
      const fromManifest = mp ? propSchema(mp) : null;
      if (s === true && !fromManifest) errors.push(`${type}: la prop "${name}" no se puede editar (tipo ${mp?.type})`);
      properties[name] = s === true ? fromManifest : { ...(fromManifest ?? {}), ...s };
    }
  } else if (manifest) {
    for (const p of manifest.props) {
      const own = p.name.includes(".") ? p.name.startsWith(`${type}.`) : isMain;
      if (!own) continue;
      const s = propSchema({ ...p, name: p.name.replace(/^\w+\./, "") });
      if (s) properties[p.name.replace(/^\w+\./, "")] = { ...s, readOnly: true };
    }
  }
  const events = manifest
    ? manifest.props
        .filter(
          (p) =>
            isEvent(p) && /^on[A-Z]/.test(p.name.replace(/^\w+\./, "")) && (p.name.includes(".") ? p.name.startsWith(`${type}.`) : isMain),
        )
        .map((p) => {
          const react = p.name.replace(/^\w+\./, "");
          const name = react.slice(2, 3).toLowerCase() + react.slice(3);
          const dom = KNOWN_DOM_EVENTS.has(name.toLowerCase()) && contract?.behavior === "dom" ? { dom: `z:${name.toLowerCase()}` } : {};
          return { name, react, ...dom, type: p.type, ...(p.description ? { description: p.description } : {}) };
        })
    : [];
  const variants = [];
  if (html === "template")
    for (const prop of VARIANT_PROPS) {
      const s = properties[prop];
      if (s?.enum) for (const value of s.enum) variants.push({ prop, value, label: `${prop}: ${value}` });
    }
  const icon = spec?.icon ?? GROUP_ICON[manifest?.group] ?? "cube";
  if (!iconSet.has(icon)) errors.push(`${type}: el icono de paleta "${icon}" no existe en zicon`);
  const desc = spec?.description ?? manifest?.description ?? "";
  return {
    type,
    package: pkg,
    group: spec?.group ?? manifest?.group ?? "content",
    title: spec?.title ?? type,
    description: isMain ? desc : `${desc} (parte de ${manifest.name})`.trim(),
    icon,
    ...(manifest ? { import: `import { ${type} } from "@zuccadev-labs/zuix-${pkg}"` } : {}),
    html,
    behavior: (contract?.behavior ?? manifest?.behavior ?? "none") === "dom" ? "dom" : "none",
    layout: spec?.layout ?? false,
    categories: spec?.categories ?? ["flow"],
    props: { type: "object", additionalProperties: false, properties },
    ...(spec?.children ? { children: spec.children } : {}),
    slots: spec?.slots ?? {},
    ...(spec?.parents ? { parents: spec.parents } : {}),
    variants,
    presets: [],
    events,
    a11y: spec?.a11y ?? [],
    classes: manifest?.classes ?? [],
    ...(spec?.adaptive || E.ADAPTIVE_VARIANTS[type]
      ? { adaptive: { ...(E.ADAPTIVE_VARIANTS[type] ? { variants: E.ADAPTIVE_VARIANTS[type] } : {}), ...spec?.adaptive } }
      : {}),
    ...(spec?.provisional ? { provisional: spec.provisional } : {}),
    _manifest: manifest,
    _contract: contract,
    _spec: spec,
  };
}

for (const spec of E.BUILTIN_BLOCKS.filter((b) => b.package === "core")) blocks.push(blockFrom({ type: spec.type, pkg: "core", spec }));
const seenTypes = new Set(blocks.map((b) => b.type));
for (const pkg of ["zui", "zout"]) {
  for (const m of manifests[pkg]) {
    for (const type of [m.name, ...(m.exports ?? [])]) {
      if (!/^[A-Z]/.test(type) || /Provider$/.test(type) || seenTypes.has(type)) continue;
      seenTypes.add(type);
      blocks.push(blockFrom({ type, pkg, manifest: m, spec: specs.get(type) }));
    }
  }
}
for (const [type, spec] of specs) {
  if (!blocks.some((b) => b.type === type)) {
    // Un bloque provisional (su componente llega de otra rama) entra sin manifiesto, con sus presets.
    if (spec.provisional) blocks.push(blockFrom({ type, pkg: spec.package, spec }));
    else errors.push(`${type}: tiene serialización pero ningún manifiesto lo exporta`);
  }
  for (const s of Object.values(spec.props))
    if (s !== true && s["x-control"] === "icon" && s.default && !iconSet.has(s.default))
      errors.push(`${type}: icono por defecto inexistente`);
}

// Presets y comparación con el contrato.
const DEFAULT_TEXT = {
  Heading: "Heading",
  Paragraph: "Paragraph text.",
  InlineText: "Text",
  Anchor: "Link",
  Quote: "Quotation.",
  Button: "Button",
  Link: "Link",
  Badge: "Badge",
  Kbd: "K",
};
function defaultPreset(block, used) {
  let n = 0;
  const id = () => `d${(n++).toString(36)}`;
  const node = { id: id(), type: block.type };
  const fill = (rule) => (rule?.text ? [{ id: id(), type: "#text", text: DEFAULT_TEXT[block.type] ?? "Text" }] : []);
  if (block.type === "List")
    node.children = [0, 1].map((i) => ({ id: id(), type: "ListItem", children: [{ id: id(), type: "#text", text: `Item ${i + 1}` }] }));
  else if (block.type === "ListItem") node.children = fill(block.children);
  else if (block.children?.text && !block.layout) node.children = fill(block.children);
  for (const [name, rule] of Object.entries(block.slots))
    if (rule.required) node.slots = { ...node.slots, [name]: [{ id: id(), type: "#text", text: "Title" }] };
  if (block.type === "IconButton") node.props = { icon: "plus", label: "Add" };
  if (block.type === "Image") node.props = { src: "", alt: "" };
  return { id: uniq(used, "default"), title: "Default", node };
}

for (const block of blocks) {
  const used = new Set();
  const m = block._manifest;
  if (block.html === "preset") {
    for (const ex of block._contract.examples) {
      const id = uniq(used, slug(ex.title));
      block.presets.push({
        id,
        title: ex.title,
        node: { id: "p0", type: block.type, preset: id },
        html: ex.html,
        ...(ex.script ? { script: ex.script } : {}),
      });
    }
    continue;
  }
  if (block.html !== "template" || !m) {
    if (block._spec?.presets) block.presets.push(...block._spec.presets);
    else if (block.html === "template") block.presets.push(defaultPreset(block, used));
    continue;
  }
  const isMain = m.name === block.type;
  for (const ex of m.examples ?? []) {
    let nodes;
    const state = { dropped: false, n: 0 };
    state.id = () => `${slug(block.type)}-${(state.n++).toString(36)}`;
    try {
      nodes = convert(evaluate(ex.code), state);
    } catch (error) {
      if (!(error instanceof NotConvertible)) throw error;
      if (verbose) notes.push(`${block.type} · "${ex.title}": no se expresa como documento (${error.message})`);
      continue;
    }
    // El ejemplo es del bloque si su raíz es de ese tipo (o si es la única forma de mostrarlo).
    const mine = nodes.length === 1 && (nodes[0].type === block.type || isMain);
    if (isMain && !state.dropped) {
      const contract = contracts[block.package]?.[m.name]?.examples.find((e) => e.title === ex.title && e.source === "generated");
      if (contract) {
        checkedExamples += 1;
        let html;
        try {
          html = E.toHTML({ format: "zuix.page", schemaVersion: 1, body: nodes }, { builtins: E.BUILTIN_BLOCKS });
        } catch (error) {
          errors.push(`${block.type} · "${ex.title}": ${error.message}`);
          continue;
        }
        const [a, b] = [normalize(html), normalize(contract.html)];
        if (a === b) verified += 1;
        else {
          let i = 0;
          while (i < a.length && a[i] === b[i]) i++;
          errors.push(
            `${block.type} · "${ex.title}": el marcado no coincide con html.json\n    conector: …${a.slice(Math.max(0, i - 60), i + 120)}\n    contrato: …${b.slice(Math.max(0, i - 60), i + 120)}`,
          );
        }
      }
    }
    if (mine && nodes[0].type === block.type) block.presets.push({ id: uniq(used, slug(ex.title)), title: ex.title, node: nodes[0] });
  }
  // Los presets propios de la serialización (los que piensan en el documento, como los de AdaptiveLayout, cuyos
  // ejemplos de React usan AdaptiveItem) van delante de los sacados de los ejemplos.
  for (const p of [...(block._spec?.presets ?? [])].reverse()) {
    if (used.has(p.id)) continue;
    used.add(p.id);
    block.presets.unshift(p);
  }
  if (!block.presets.length) block.presets.push(defaultPreset(block, used));
}
for (const b of blocks) if (b.html === "template" && b.package === "core") b.presets.push(defaultPreset(b, new Set()));
// Un bloque del conector sin manifiesto entró dos veces por la rama de arriba: se queda un solo preset por defecto.
for (const b of blocks) if (b.package === "core") b.presets = b.presets.filter((p, i, all) => all.findIndex((q) => q.id === p.id) === i);

// ── Tokens ───────────────────────────────────────────────────────────────────────────────────────────────
const THEMES = tokensJson.themes;
const brandFiles = Object.fromEntries(
  readdirSync(join(root, "tokens/brands"))
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => {
      const b = read(`tokens/brands/${f}`);
      delete b.$schema;
      return [b.name, b];
    }),
);
const defaultBrand = brandFiles[tokensJson.defaultBrand] ? tokensJson.defaultBrand : Object.keys(brandFiles)[0];
const baseTokens = { scale: base.scale, semantic: base.semantic, component: base.component };
function rawToken(name, brand, theme) {
  if (/^font-(display|sans|mono)$/.test(name))
    return name === "font-display" ? (brand.fonts.display ?? brand.fonts.sans) : brand.fonts[name.slice(5)];
  return (
    brand.themes[theme][name] ??
    base.semantic[name] ??
    brand.component?.[name] ??
    base.component[name] ??
    brand.scale?.[name] ??
    base.scale[name]
  );
}
function expand(name, brand, theme, trail = []) {
  const raw = rawToken(name, brand, theme);
  if (raw == null) return null;
  if (trail.includes(name)) throw new Error(`ciclo: ${[...trail, name].join(" → ")}`);
  return String(raw).replace(/\{([a-z0-9.-]+)\}/gi, (all, ref) =>
    ref.startsWith("p.") ? (brand.primitives[ref.slice(2)] ?? all) : (expand(ref, brand, theme, [...trail, name]) ?? all),
  );
}
const isColor = (v) => /^(#|rgba?\(|color-mix\(|transparent$|white$|black$)/i.test(String(v).trim());
function tokenType(name, value) {
  const v = String(value).trim();
  if (/^font-(display|sans|mono)$/.test(name)) return "font";
  if (/gradient\(/.test(v)) return "gradient";
  if (/^cubic-bezier|^ease|^linear$/.test(v) || name.startsWith("ease-")) return "easing";
  if (/^-?\d+(\.\d+)?m?s$/.test(v) || name.startsWith("duration-")) return "duration";
  if (/shadow|^focus-ring$/.test(name) || /\d+px\s+(-?\d+px\s+)+.*(rgba?\(|#|var\()/.test(v)) return "shadow";
  if (isColor(v)) return "color";
  if (/^-?\d+(\.\d+)?(px|rem|em|vw|vh|%)$|^(clamp|calc|min|max)\(/.test(v) || v === "0") return "length";
  if (/^-?\d+(\.\d+)?$/.test(v)) return "number";
  return "other";
}
const RANGES = [
  [/^space-/, 0, 256],
  [/^radius-/, 0, 999],
  [/^(control-height|touch-target)/, 16, 96],
  [/^container-/, 320, 2560],
  [/^(rail|sidebar|inspector)-width$|^header-height$/, 0, 960],
  [/^weight-/, 100, 900],
  [/^leading-/, 0.8, 3],
  [/^layer-/, -1, 1000],
  [/^duration-/, 0, 5000],
];
const tokenList = [];
const themeNames = new Set([...Object.keys(base.semantic), ...tokensJson.required]);
for (const b of Object.values(brandFiles)) for (const t of THEMES) for (const k of Object.keys(b.themes[t])) themeNames.add(k);
const allNames = new Set([
  ...Object.keys(base.scale),
  ...Object.keys(base.component),
  ...themeNames,
  "font-display",
  "font-sans",
  "font-mono",
]);
const db = brandFiles[defaultBrand];
for (const name of [...allNames].sort()) {
  const scope = themeNames.has(name) ? "theme" : name in base.component ? "component" : "scale";
  const dark = expand(name, db, "dark");
  const light = expand(name, db, "light");
  if (dark == null) continue;
  const type = tokenType(name, dark);
  const range = RANGES.find(([re]) => re.test(name));
  tokenList.push({
    name,
    type,
    group: name.split("-")[0],
    scope,
    ...(range && ["length", "number", "duration"].includes(type) ? { min: range[1], max: range[2] } : {}),
    default: scope === "theme" && dark !== light ? { dark, light } : dark,
  });
}
// Usos reales de las hojas, con los mismos filtros que tokens/src/validate.mjs.
const sheets = [];
for (const [pkg, dir] of [
  ["zui", "zui/src/styles"],
  ["zout", "zout/src/styles"],
  ["zudocs", "zudocs/src/css"],
]) {
  for (const f of readdirSync(join(root, dir))
    .filter((f) => f.endsWith(".css"))
    .sort())
    sheets.push({ pkg, file: `${dir}/${f}`, css: readFileSync(join(root, dir, f), "utf8") });
}
const rules = sheets.flatMap((s) => parseRules(s.css, s.file));
const isToken = (name) => Object.values(brandFiles).some((b) => THEMES.some((t) => expand(name, b, t) != null));
const usesRaw = extractUses(rules, isToken);
const spec = base.contrast;
const ignored = (u) => spec.ignore.find((i) => u.selector.includes(i.selector) && (!i.fg || i.fg === u.fg));
const uses = new Map();
for (const u of usesRaw.text) {
  if (ignored(u)) continue;
  const onCanvas = spec.canvasText.includes(u.fg);
  if (!u.bg && !onCanvas && spec.text.includes(u.fg)) continue;
  const key = `${u.file.split("/")[0]}:${u.fg}/${u.bg ?? "*"}`;
  const id = `${key}:${u.graphic ? 3 : 4.5}`;
  if (!uses.has(id))
    uses.set(id, { fg: u.fg, ...(u.bg ? { bg: u.bg } : {}), min: u.graphic ? 3 : 4.5, key, where: u.selector.slice(0, 120) });
}
const borders = new Map();
for (const u of usesRaw.borders) {
  if (spec.nonText.includes(u.border)) continue;
  const key = `${u.file.split("/")[0]}:${u.border}/border`;
  if (!borders.has(key)) borders.set(key, { token: u.border, key, where: u.selector.slice(0, 120) });
}
const contrast = {
  surfaces: spec.surfaces,
  text: spec.text,
  canvasText: spec.canvasText,
  pairs: spec.pairs,
  nonText: spec.nonText,
  uses: [...uses.values()],
  borders: [...borders.values()],
  pending: read("tokens/src/contrast-baseline.json").pending.map((p) => p.key),
};
const brandSchema = read("tokens/schema/brand.schema.json");

// Estilo de nodo: qué tokens admite cada propiedad.
const names = (re) => tokenList.filter((t) => re.test(t.name)).map((t) => t.name);
const style = {
  padding: { css: "padding", tokens: names(/^space-/) },
  paddingBlock: { css: "padding-block", tokens: names(/^space-/) },
  paddingInline: { css: "padding-inline", tokens: names(/^space-/) },
  margin: { css: "margin", tokens: names(/^space-/) },
  marginBlock: { css: "margin-block", tokens: names(/^space-/) },
  marginInline: { css: "margin-inline", tokens: names(/^space-/) },
  gap: { css: "gap", tokens: names(/^space-/) },
  background: {
    css: "background",
    tokens: names(/^(surface(-\d|-solid)?|inset|(accent|success|warning|danger|info)-soft|card-bg|reading-bg)$/),
  },
  color: { css: "color", tokens: [...spec.text] },
  radius: { css: "border-radius", tokens: names(/^radius-(?!full)/) },
  maxWidth: { css: "max-width", tokens: names(/^container-(sm|md|lg|xl)$/) },
  textAlign: { css: "text-align", keywords: ["start", "center", "end"] },
};

const catalog = {
  $schema: "./catalog.schema.json",
  schemaVersion: E.CATALOG_SCHEMA_VERSION,
  zuix: zuiPkg.version,
  documentSchemaVersion: E.DOCUMENT_SCHEMA_VERSION,
  protocolVersion: E.PROTOCOL_VERSION,
  blocks: blocks.map(({ _manifest, _contract, _spec, ...b }) => b),
  icons,
  style,
  tokens: {
    defaultBrand,
    themes: THEMES,
    brands: Object.keys(brandFiles),
    brandSchema,
    tokens: tokenList,
    contrast,
    base: baseTokens,
    brandFiles,
  },
};

// ── Comprobaciones del catálogo generado ───────────────────────────────────────────────────────────────────
const catalogSchema = read("zui/editor/catalog.schema.json");
for (const e of E.validateSchema(catalog, catalogSchema).slice(0, 20)) errors.push(`catalog.json${e.pointer}: ${e.message}`);
// Un preset se valida en su sitio (dentro de su padre obligatorio, si lo tiene). Uno sacado de un ejemplo que no
// valida (un ejemplo que usa «…» como relleno) se descarta; uno por defecto que no valida es un error.
for (const b of catalog.blocks) {
  b.presets = b.presets.filter((p) => {
    if (!p.node) return true;
    const node = b.parents ? { id: "preset-parent", type: b.parents[0], children: [p.node] } : p.node;
    const r = E.validateDocument({ format: "zuix.page", schemaVersion: 1, body: [node] }, catalog);
    if (r.valid) return true;
    if (p.id.startsWith("default")) for (const i of r.errors) errors.push(`${b.type} · preset "${p.id}": ${i.message}`);
    else notes.push(`${b.type} · preset "${p.id}" descartado: ${r.errors[0].message}`);
    return false;
  });
  if (!b.presets.length && b.html === "template") errors.push(`${b.type}: se queda sin presets`);
}
// Contraste: el del navegador tiene que coincidir con el de tokens.
// La salida va a un archivo: validate.mjs termina con process.exit y por una tubería se cortaría a 64 kB.
const rowsFile = join(tmp, `editor-contrast-${process.pid}.json`);
const fd = openSync(rowsFile, "w");
spawnSync(process.execPath, [join(root, "tokens/src/validate.mjs"), "--json"], { stdio: ["ignore", fd, "inherit"] });
closeSync(fd);
const validateRows = JSON.parse(readFileSync(rowsFile, "utf8"));
rmSync(rowsFile, { force: true });
const reference = new Map(validateRows.rows.map((r) => [`${r.where} · ${r.what}`, r.ratio]));
let contrastRows = 0;
for (const [name, b] of Object.entries(brandFiles)) {
  const r = E.checkContrast(b, catalog.tokens, { rows: true });
  for (const row of r.rows) {
    const id = `${name}/${row.theme} · ${row.what}`;
    if (!reference.has(id)) errors.push(`contraste: tokens no mide «${id}»`);
    else if (reference.get(id) !== row.ratio)
      errors.push(`contraste: «${id}» da ${row.ratio} en el navegador y ${reference.get(id)} en tokens`);
    else contrastRows += 1;
  }
  if (!r.ok && validateRows.failures.length === 0) errors.push(`contraste de ${name}: el navegador falla y tokens no`);
}

// ── Salida ─────────────────────────────────────────────────────────────────────────────────────────────────
if (errors.length) {
  console.error(errors.map((e) => `✗ ${e}`).join("\n"));
  console.error(`✗ ${errors.length} problemas en el catálogo del editor`);
  process.exit(1);
}
writeFileSync(join(root, "zui/editor/catalog.json"), `${JSON.stringify(catalog)}\n`);
writeFileSync(join(root, "zui/editor/document.schema.json"), `${JSON.stringify(E.DOCUMENT_JSON_SCHEMA, null, 2)}\n`);
const types = catalog.blocks.map((b) => b.type);
writeFileSync(
  join(root, "zui/src/editor/blocks.generated.ts"),
  `// GENERADO por tools/editor-catalog.mjs. No editar.\n// Tipos de bloque del catálogo de zuix ${zuiPkg.version}.\n\nexport const BLOCK_TYPES = ${JSON.stringify(types)} as const;\n\nexport type BlockType = (typeof BLOCK_TYPES)[number];\n`,
);
if (verbose) console.log(notes.join("\n"));
const by = (h) => catalog.blocks.filter((b) => b.html === h).length;
console.log(
  `✓ catálogo del editor: ${catalog.blocks.length} bloques (${by("template")} con serialización propia, ${by("preset")} por preset, ${by("none")} solo React) · ${catalog.blocks.reduce((n, b) => n + b.presets.length, 0)} presets · ${tokenList.length} tokens`,
);
console.log(
  `✓ ${verified} de ${checkedExamples} ejemplos expresables como documento dan el marcado de html.json · ${contrastRows} medidas de contraste iguales a las de tokens en ${Object.keys(brandFiles).length} marcas`,
);
