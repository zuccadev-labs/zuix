// Genera dist/ a partir de src/base.json y brands/*.json. Nadie edita dist/ a mano.
// También genera las capas de compatibilidad de compat/*.json (ver src/compat.mjs).
// Uso: node src/build.mjs          escribe dist/
//      node src/build.mjs --check  falla si dist/ no coincide con las fuentes
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildCompat } from "./compat.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(readFileSync(join(root, p), "utf8"));
const base = read("src/base.json");
const { defaultBrand } = read("config.json");
const brands = readdirSync(join(root, "brands")).filter((f) => f.endsWith(".json")).sort().map((f) => read(`brands/${f}`));
const THEMES = ["dark", "light"];
const errors = [];
const notes = [];

export function loadAll() { return { base, brands, defaultBrand }; }

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

function brandBlocks(brand, scope) {
  for (const t of THEMES)
    for (const key of base.required)
      if (!(key in brand.themes[t])) errors.push(`${brand.name}: falta "${key}" en el tema ${t}`);
  const fonts = { "font-display": brand.fonts.display ?? brand.fonts.sans, "font-sans": brand.fonts.sans, "font-mono": brand.fonts.mono };
  const sel = (theme) => `${scope}[data-theme="${theme}"]`;
  const themeBody = (t) => `  color-scheme: ${t};\n${decl({ ...base.semantic, ...brand.themes[t] }, brand)}`;
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
  const color = ["canvas", "canvas-fg", "canvas-fg-muted", "surface", "surface-2", "surface-3", "surface-solid", "overlay", "inset", "line", "line-strong", "row-hover", "fg", "fg-muted", "fg-subtle", "fg-on-accent", "accent", "accent-hover", "accent-solid", "accent-soft", "accent-ring", "success", "success-soft", "warning", "warning-soft", "danger", "danger-soft", "info", "info-soft", "glass-bg", "glass-border"];
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
  return `${HEADER}/* Puente tokens → utilidades de Tailwind v4. Importar después de "tailwindcss" y de tokens.css. */\n@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *));\n\n@theme inline {\n${lines.join("\n")}\n}\n`;
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
    "ifm-link-color": "var(--z-accent)", "ifm-link-hover-color": "var(--z-accent-hover)",
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
  const out = { defaultBrand, themes: THEMES, scale: base.scale, coarse: base.coarse, component: base.component, semanticDerived: base.semantic, required: base.required, brands: {} };
  for (const b of brands) out.brands[b.name] = { label: b.label ?? b.name, primitives: b.primitives, fonts: b.fonts, scale: b.scale ?? {}, component: b.component ?? {}, themes: b.themes };
  return JSON.stringify(out, null, 2) + "\n";
}

export function build() {
  const files = { "dist/tokens.css": tokensCss(), "dist/tailwind.css": tailwindCss(), "dist/docusaurus.css": docusaurusCss(), "dist/tokens.json": tokensJson() };
  for (const b of brands) files[`dist/brands/${b.name}.css`] = `${HEADER}\n${brandBlocks(b, ":root")}\n`;
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
