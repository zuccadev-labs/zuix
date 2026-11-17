// Genera dist/ a partir de src/base.json y brands/*.json. Nadie edita dist/ a mano.
// También genera las capas de compatibilidad de compat/*.json (ver src/compat.mjs).
// Uso: node src/build.mjs          escribe dist/
//      node src/build.mjs --check  falla si dist/ no coincide con las fuentes
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildCompat } from "./compat.mjs";
import { parseColor, splitTop, toHex } from "./color.mjs";
import { validate as validateSchema } from "./schema.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(readFileSync(join(root, p), "utf8"));
const base = read("src/base.json");
const { defaultBrand } = read("config.json");
const THEMES = ["dark", "light"];
const errors = [];
const notes = [];
// Cada marca se valida contra el esquema publicado antes de usarla: un archivo mal formado da un error con su
// ruta, no una excepción a mitad de la generación. Las marcas inválidas no entran en la salida.
const brandSchema = read("schema/brand.schema.json");
const brands = [];
for (const file of readdirSync(join(root, "brands")).filter((f) => f.endsWith(".json")).sort()) {
  let brand;
  try { brand = read(`brands/${file}`); } catch (error) { errors.push(`brands/${file}: JSON inválido (${error.message})`); continue; }
  const problems = validateSchema(brand, brandSchema);
  if (brand?.name && `${brand.name}.json` !== file) problems.push(`"name" es "${brand.name}" y el archivo se llama ${file}: deben coincidir`);
  if (problems.length) errors.push(...problems.map((m) => `brands/${file}: ${m}`));
  else brands.push(brand);
}

export function loadAll() { return { base, brands, defaultBrand }; }

/** Valor sin resolver de un token para una marca y tema, con la misma precedencia que la cascada de tokens.css. */
function rawToken(name, brand, theme) {
  if (/^font-(display|sans|mono)$/.test(name)) return name === "font-display" ? brand.fonts.display ?? brand.fonts.sans : brand.fonts[name.slice(5)];
  return brand.themes[theme][name] ?? base.semantic[name] ?? brand.component?.[name] ?? base.component[name] ?? brand.scale?.[name] ?? base.scale[name];
}

/**
 * Valor de un token con sus referencias `{nombre}` y `{p.primitivo}` sustituidas, o `null` si no existe.
 * Lanza un error si las referencias forman un ciclo.
 */
export function expandToken(name, brand, theme, trail = []) {
  const raw = rawToken(name, brand, theme);
  if (raw == null) return null;
  if (trail.includes(name)) throw new Error(`referencia circular: ${[...trail, name].join(" → ")}`);
  return String(raw).replace(/\{([a-z0-9.-]+)\}/gi, (all, ref) => (ref.startsWith("p.") ? brand.primitives[ref.slice(2)] ?? all : expandToken(ref, brand, theme, [...trail, name]) ?? all));
}

/** Nombres de token que define una marca en un tema (los de la base y los suyos). */
const tokenNames = (brand, theme) => [...new Set([
  ...Object.keys(base.scale), ...Object.keys(base.semantic), ...Object.keys(base.component),
  ...Object.keys(brand.scale ?? {}), ...Object.keys(brand.component ?? {}), ...Object.keys(brand.themes[theme]),
])];

/** Todas las claves --z-* que existen para una marca (para validar referencias). */
function knownNames(brand) {
  return new Set([
    ...Object.keys(base.scale), ...Object.keys(base.semantic), ...Object.keys(base.component),
    ...Object.keys(brand.scale ?? {}), ...Object.keys(brand.component ?? {}),
    ...THEMES.flatMap((t) => Object.keys(brand.themes[t])),
    "font-display", "font-sans", "font-mono",
  ]);
}

function css(value, brand, where) {
  const names = knownNames(brand);
  return String(value).replace(/\{([a-z0-9.-]+)\}/gi, (_, ref) => {
    if (ref.startsWith("p.")) {
      const key = ref.slice(2);
      if (!(key in brand.primitives)) errors.push(`${brand.name}: ${where} referencia el primitivo inexistente "${key}"`);
      return `var(--zp-${key})`;
    }
    if (!names.has(ref)) errors.push(`${brand.name}: ${where} referencia el token inexistente "${ref}"`);
    return `var(--z-${ref})`;
  });
}

const decl = (obj, brand, prefix = "--z-") =>
  Object.entries(obj).map(([k, v]) => `  ${prefix}${k}: ${css(v, brand, k)};`).join("\n");

const checked = new Set();
/** Comprobaciones de una marca que no dependen de la salida: obligatorios, simetría entre temas y ciclos. */
function checkBrand(brand) {
  if (checked.has(brand.name)) return;
  checked.add(brand.name);
  for (const t of THEMES)
    for (const key of base.required)
      if (!(key in brand.themes[t])) errors.push(`${brand.name}: falta "${key}" en el tema ${t}`);
  // `:root` lleva el tema oscuro: un token que solo define un tema se heredaría en el otro con el valor equivocado.
  for (const [a, b] of [["dark", "light"], ["light", "dark"]])
    for (const key of Object.keys(brand.themes[a]))
      if (!(key in brand.themes[b]) && !(key in base.semantic)) errors.push(`${brand.name}: "${key}" está en el tema ${a} y falta en el tema ${b}`);
  const scaleKeys = new Set(Object.keys(base.scale));
  for (const key of Object.keys(brand.scale ?? {})) if (!scaleKeys.has(key)) errors.push(`${brand.name}: scale."${key}" no es una clave de la escala común`);
  for (const t of THEMES)
    for (const name of tokenNames(brand, t)) {
      try { expandToken(name, brand, t); } catch (error) { if (!errors.includes(`${brand.name}: ${error.message}`)) errors.push(`${brand.name}: ${error.message}`); }
    }
}

function brandBlocks(brand, scope) {
  checkBrand(brand);
  const fonts = { "font-display": brand.fonts.display ?? brand.fonts.sans, "font-sans": brand.fonts.sans, "font-mono": brand.fonts.mono };
  const sel = (theme) => `${scope}[data-theme="${theme}"]`;
  const themeBody = (t) => `  color-scheme: ${t};\n${decl({ ...base.semantic, ...brand.themes[t] }, brand)}`;
  // Mismos selectores que los temas, para que estas preferencias ganen a cualquiera de ellos.
  const everyTheme = [scope, sel("dark"), sel("light")].join(",\n");
  const preference = (query, tokens) => `@media ${query} {\n${`${everyTheme} {\n${decl(tokens, brand)}\n}`.replace(/^/gm, "  ")}\n}`;
  return [
    `/* ${brand.label ?? brand.name}: primitivos, fuentes, escala y tokens de componente */`,
    `${scope} {`,
    decl(brand.primitives, brand, "--zp-"),
    decl(fonts, brand),
    decl({ ...base.scale, ...(brand.scale ?? {}) }, brand),
    decl({ ...base.component, ...(brand.component ?? {}) }, brand),
    `}`,
    `/* ${brand.label ?? brand.name}: tema oscuro (por defecto) */`,
    `${scope},\n${sel("dark")} {\n${themeBody("dark")}\n}`,
    `/* ${brand.label ?? brand.name}: tema claro */`,
    `${sel("light")} {\n${themeBody("light")}\n}`,
    `@media (prefers-color-scheme: light) {\n${`${scope}:not([data-theme]) {\n${themeBody("light")}\n}`.replace(/^/gm, "  ")}\n}`,
    // Va en el mismo selector que la escala de la marca: con uno más débil, `--z-touch-target: 0px` de la marca ganaría.
    `/* ${brand.label ?? brand.name}: puntero principal grueso (dedo). Los controles sm y md crecen hasta el objetivo táctil */`,
    `@media (pointer: coarse) {\n${`${scope} {\n${decl(base.coarse, brand)}\n}`.replace(/^/gm, "  ")}\n}`,
    `/* ${brand.label ?? brand.name}: más contraste a petición de la persona (prefers-contrast: more) */`,
    preference("(prefers-contrast: more)", base.moreContrast),
    `/* ${brand.label ?? brand.name}: colores forzados (alto contraste de Windows). El sistema pone los colores; aquí se retira lo que no fuerza */`,
    preference("(forced-colors: active)", base.forcedColors),
  ].join("\n");
}

const HEADER = "/* GENERADO por @zuccadev-labs/zuix-tokens (src/build.mjs). No editar: cambia brands/*.json o src/base.json y regenera. */\n";

function tokensCss() {
  const def = brands.find((b) => b.name === defaultBrand);
  if (!def) throw new Error(`config.json: la marca por defecto "${defaultBrand}" no existe en brands/`);
  const others = brands.filter((b) => b !== def);
  return [HEADER, brandBlocks(def, ":root"), ...others.map((b) => brandBlocks(b, `:root[data-brand="${b.name}"]`)), ""].join("\n\n");
}

function tailwindCss() {
  const color = ["canvas", "canvas-fg", "canvas-fg-muted", "surface", "surface-2", "surface-3", "surface-solid", "overlay", "inset", "line", "line-strong", "row-hover", "fg", "fg-muted", "fg-subtle", "fg-on-accent", "accent", "accent-hover", "accent-solid", "accent-solid-hover", "accent-text", "accent-soft", "accent-ring", "success", "success-text", "success-solid", "success-soft", "warning", "warning-text", "warning-solid", "warning-soft", "danger", "danger-text", "danger-solid", "danger-soft", "info", "info-text", "info-solid", "info-soft", "glass-bg", "glass-border"];
  const lines = [
    ...color.map((k) => `  --color-${k}: var(--z-${k});`),
    ...Object.keys(base.scale).flatMap((k) => {
      if (k.startsWith("radius-")) return [`  --${k}: var(--z-${k});`];
      if (k.startsWith("text-")) return [`  --${k}: var(--z-${k});`];
      if (k.startsWith("ease-")) return [`  --${k}: var(--z-${k});`];
      return [];
    }),
    "  --font-display: var(--z-font-display);", "  --font-sans: var(--z-font-sans);", "  --font-mono: var(--z-font-mono);",
    "  --shadow-sm: var(--z-shadow-sm);", "  --shadow-md: var(--z-shadow-md);", "  --shadow-lg: var(--z-shadow-lg);",
  ];
  return `${HEADER}/* Puente tokens → utilidades de Tailwind v4. Importar después de "tailwindcss" y de tokens.css. */\n/* \`dark:\` sigue al tema de los tokens: data-theme="dark" o, sin atributo, el sistema (oscuro salvo que pida claro). */\n@custom-variant dark {\n  &:where([data-theme="dark"], [data-theme="dark"] *) {\n    @slot;\n  }\n  @media not (prefers-color-scheme: light) {\n    &:where(:root:not([data-theme]), :root:not([data-theme]) *) {\n      @slot;\n    }\n  }\n}\n\n@theme inline {\n${lines.join("\n")}\n}\n`;
}

function docusaurusCss() {
  const mix = (pct, withColor) => `color-mix(in srgb, var(--z-accent) ${pct}%, ${withColor})`;
  const m = {
    "ifm-color-primary": "var(--z-accent)",
    "ifm-color-primary-dark": mix(90, "black"), "ifm-color-primary-darker": mix(82, "black"), "ifm-color-primary-darkest": mix(68, "black"),
    "ifm-color-primary-light": mix(90, "white"), "ifm-color-primary-lighter": mix(82, "white"), "ifm-color-primary-lightest": mix(68, "white"),
    "ifm-background-color": "var(--z-canvas)", "ifm-background-surface-color": "var(--z-surface-solid)",
    "ifm-color-content": "var(--z-fg)", "ifm-color-content-secondary": "var(--z-fg-muted)",
    "ifm-font-color-base": "var(--z-fg)", "ifm-heading-color": "var(--z-fg)",
    "ifm-font-family-base": "var(--z-font-sans)", "ifm-heading-font-family": "var(--z-font-display)", "ifm-font-family-monospace": "var(--z-font-mono)",
    "ifm-link-color": "var(--z-accent-text)", "ifm-link-hover-color": "var(--z-accent-hover)",
    "ifm-global-radius": "var(--z-radius-sm)", "ifm-code-border-radius": "var(--z-radius-xs)", "ifm-pre-border-radius": "var(--z-radius-md)",
    "ifm-card-border-radius": "var(--z-card-radius)", "ifm-card-background-color": "var(--z-card-bg)",
    "ifm-code-background": "var(--z-code-bg)", "ifm-pre-background": "var(--z-code-bg)",
    "ifm-navbar-background-color": "transparent", "ifm-navbar-height": "var(--z-header-height)", "ifm-navbar-shadow": "none",
    "ifm-navbar-link-color": "var(--z-fg-muted)", "ifm-navbar-link-hover-color": "var(--z-fg)",
    "ifm-menu-color": "var(--z-fg-muted)", "ifm-menu-color-active": "var(--z-fg)", "ifm-menu-color-background-active": "var(--z-surface-2)", "ifm-menu-color-background-hover": "var(--z-row-hover)",
    "ifm-toc-border-color": "var(--z-line)", "ifm-toc-link-color": "var(--z-fg-muted)",
    "ifm-hr-background-color": "var(--z-line)", "ifm-table-border-color": "var(--z-line)", "ifm-table-stripe-background": "var(--z-surface)",
    "ifm-color-emphasis-100": "var(--z-surface)", "ifm-color-emphasis-200": "var(--z-surface-2)", "ifm-color-emphasis-300": "var(--z-line-strong)",
    "ifm-color-emphasis-600": "var(--z-fg-subtle)", "ifm-color-emphasis-700": "var(--z-fg-muted)", "ifm-color-emphasis-900": "var(--z-fg)",
    "ifm-footer-background-color": "transparent", "ifm-footer-color": "var(--z-fg-muted)",
    "ifm-color-success": "var(--z-success)", "ifm-color-warning": "var(--z-warning)", "ifm-color-danger": "var(--z-danger)", "ifm-color-info": "var(--z-info)",
    "ifm-global-shadow-lw": "var(--z-shadow-sm)", "ifm-global-shadow-md": "var(--z-shadow-md)", "ifm-global-shadow-tl": "var(--z-shadow-lg)",
    "ifm-dropdown-background-color": "var(--z-popup-bg)", "ifm-breadcrumb-item-background-active": "var(--z-surface-2)",
    "docusaurus-highlighted-code-line-bg": "var(--z-surface-2)",
  };
  const body = Object.entries(m).map(([k, v]) => `  --${k}: ${v};`).join("\n");
  return `${HEADER}/* Mapa de tokens zuix → variables de Infima (tema clásico de Docusaurus). Importar después de tokens.css. */\n:root,\n[data-theme="dark"],\n[data-theme="light"] {\n${body}\n}\n`;
}

function tokensJson() {
  const out = { defaultBrand, themes: THEMES, scale: base.scale, coarse: base.coarse, moreContrast: base.moreContrast, forcedColors: base.forcedColors, component: base.component, semanticDerived: base.semantic, required: base.required, brands: {} };
  for (const b of brands) out.brands[b.name] = { label: b.label ?? b.name, primitives: b.primitives, fonts: b.fonts, scale: b.scale ?? {}, component: b.component ?? {}, themes: b.themes };
  return `${JSON.stringify(out, null, 2)}\n`;
}

/* ---------- Formato DTCG (Design Tokens Community Group, 2025.10) ---------- */

const DTCG_EXT = "io.github.zuccadev-labs.zuix";
const GROUPS = ["space", "radius", "text", "weight", "leading", "duration", "ease", "layer", "shadow", "font"];
const round = (n, digits = 4) => Number(n.toFixed(digits));
const dimension = (v) => { const m = /^(-?\d*\.?\d+)(px|rem)$/.exec(v); return m ? { value: Number(m[1]), unit: m[2] } : v === "0" ? { value: 0, unit: "px" } : null; };

function dtcgColor(css) {
  const c = parseColor(css);
  if (!c) return null;
  const value = { colorSpace: "srgb", components: [0, 1, 2].map((i) => round(Math.max(0, Math.min(255, c[i])) / 255)) };
  if (c[3] < 1) value.alpha = round(c[3]);
  value.hex = toHex(c);
  return value;
}
function dtcgShadow(css) {
  const layers = splitTop(css).map((layer) => {
    const inset = /^inset\s+/.test(layer);
    const colorAt = layer.search(/(#|rgba?\()/);
    if (colorAt < 0) return null;
    const lengths = layer.slice(0, colorAt).replace(/^inset\s+/, "").trim().split(/\s+/).map(dimension);
    const color = dtcgColor(layer.slice(colorAt).trim());
    if (lengths.length < 2 || lengths.length > 4 || lengths.includes(null) || !color) return null;
    const zero = { value: 0, unit: "px" };
    return { color, offsetX: lengths[0], offsetY: lengths[1], blur: lengths[2] ?? zero, spread: lengths[3] ?? zero, ...(inset ? { inset: true } : {}) };
  });
  return layers.includes(null) ? null : layers.length === 1 ? layers[0] : layers;
}
/** Tipo y valor DTCG de un valor CSS ya resuelto, o null si la especificación no puede expresarlo. */
function dtcgValue(name, css) {
  if (name.startsWith("font-")) return { $type: "fontFamily", $value: splitTop(css).map((f) => f.replace(/^["']|["']$/g, "")) };
  if (name.startsWith("weight-") && /^\d+$/.test(css)) return { $type: "fontWeight", $value: Number(css) };
  if ((name.startsWith("leading-") || name.startsWith("layer-")) && /^-?\d*\.?\d+$/.test(css)) return { $type: "number", $value: Number(css) };
  const ms = /^(\d*\.?\d+)(ms|s)$/.exec(css);
  if (ms) return { $type: "duration", $value: { value: Number(ms[1]), unit: ms[2] } };
  const bezier = /^cubic-bezier\(([^)]+)\)$/.exec(css);
  if (bezier) return { $type: "cubicBezier", $value: bezier[1].split(",").map(Number) };
  if (/shadow/.test(name)) { const shadow = dtcgShadow(css); return shadow ? { $type: "shadow", $value: shadow } : null; }
  const dim = dimension(css);
  if (dim) return { $type: "dimension", $value: dim };
  const color = dtcgColor(css);
  return color ? { $type: "color", $value: color } : null;
}

/**
 * Tokens de una marca y un tema en formato DTCG: un archivo autocontenido, con los valores ya resueltos.
 * Lo que la especificación no puede expresar (clamp(), max(), degradados, unidades em o ch, porcentajes) va con
 * su valor CSS en `$extensions`; un alias directo a otro token se conserva como referencia `{grupo.nombre}`.
 */
function dtcg(brand, theme) {
  const names = [...tokenNames(brand, theme), "font-display", "font-sans", "font-mono"];
  const typed = new Map();
  const cssOnly = {};
  for (const name of names) {
    const value = dtcgValue(name, expandToken(name, brand, theme));
    if (value) typed.set(name, value); else cssOnly[name] = expandToken(name, brand, theme);
  }
  const path = (name) => {
    const group = GROUPS.find((g) => name.startsWith(`${g}-`));
    if (group) return [group, name.slice(group.length + 1)];
    return [typed.get(name).$type === "color" ? "color" : name in base.scale ? "size" : "component", name];
  };
  const out = {
    $description: `${brand.label ?? brand.name} · tema ${theme}. Generado por @zuccadev-labs/zuix-tokens; formato Design Tokens (DTCG) 2025.10.`,
    $extensions: { [DTCG_EXT]: { brand: brand.name, theme, cssPrefix: "--z-", cssOnly } },
    primitive: {},
  };
  for (const [key, css] of Object.entries(brand.primitives)) {
    const value = dtcgValue(key, css);
    if (value) out.primitive[key] = value;
  }
  for (const [name, value] of typed) {
    const [group, key] = path(name);
    const raw = String(rawToken(name, brand, theme));
    const alias = /^\{([a-z0-9.-]+)\}$/i.exec(raw)?.[1];
    const target = alias?.startsWith("p.") ? (alias.slice(2) in out.primitive ? `primitive.${alias.slice(2)}` : null) : alias && typed.has(alias) ? path(alias).join(".") : null;
    out[group] ??= {};
    out[group][key] = target ? { $type: value.$type, $value: `{${target}}` } : value;
  }
  return `${JSON.stringify(out, null, 2)}\n`;
}

export function build() {
  const files = { "dist/tokens.css": tokensCss(), "dist/tailwind.css": tailwindCss(), "dist/docusaurus.css": docusaurusCss(), "dist/tokens.json": tokensJson() };
  for (const b of brands) files[`dist/brands/${b.name}.css`] = `${HEADER}\n${brandBlocks(b, ":root")}\n`;
  if (!errors.length) for (const b of brands) for (const t of THEMES) files[`dist/dtcg/${b.name}.${t}.tokens.json`] = dtcg(b, t);
  // El paraguas (suite/) reexporta la hoja de cada marca: una marca nueva necesita allí su entrada.
  if (existsSync(join(root, "../suite/package.json"))) {
    const suite = JSON.parse(readFileSync(join(root, "../suite/package.json"), "utf8"));
    for (const b of brands) if (!(`./tokens/${b.name}.css` in suite.exports)) errors.push(`suite/package.json: falta exports["./tokens/${b.name}.css"] para la marca ${b.name} (archivo suite/tokens-${b.name}.css con @import "@zuccadev-labs/zuix-tokens/css/${b.name}.css")`);
  }
  // Capas de compatibilidad para proyectos que migran desde sus propias variables (compat/*.json).
  const compat = buildCompat({ base, brands, css, knownNames, header: HEADER });
  errors.push(...compat.errors);
  Object.assign(files, compat.files);
  notes.push(...compat.warnings.map((w) => `aviso  ${w}`), ...compat.summaries.map((m) => `  ${m}`));
  return files;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const files = build();
  if (errors.length) { console.error(errors.map((e) => `✗ ${e}`).join("\n")); process.exit(1); }
  if (process.argv.includes("--check")) {
    const stale = Object.entries(files).filter(([p, c]) => !existsSync(join(root, p)) || readFileSync(join(root, p), "utf8") !== c).map(([p]) => p);
    if (stale.length) { console.error(`✗ dist/ desactualizado: ${stale.join(", ")}. Ejecuta: pnpm tokens`); process.exit(1); }
    console.log(`✓ dist/ al día (${Object.keys(files).length} archivos)`);
  } else {
    for (const [p, c] of Object.entries(files)) { mkdirSync(dirname(join(root, p)), { recursive: true }); writeFileSync(join(root, p), c); }
    console.log(`✓ ${Object.keys(files).length} archivos generados · marcas: ${brands.map((b) => b.name).join(", ")} · por defecto: ${defaultBrand}`);
    for (const n of notes) console.log(n);
  }
}
