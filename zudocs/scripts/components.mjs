// Catálogo de componentes del sitio: una página por componente, generada de los manifiestos de zui y zout
// (`manifest.json` y `html.json`). Lo comparten el plugin del sitio (rutas y datos de cada página) y llms.mjs
// (copia .md de cada página). Un componente nuevo aparece solo con existir en su manifiesto. Sin dependencias.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { templateDir } from "./config.mjs";

const require = createRequire(join(templateDir, "package.json"));
const readJson = (spec) => JSON.parse(readFileSync(require.resolve(spec), "utf8"));

/** Paquetes que aportan componentes, en el orden del índice. */
const SOURCES = [
  { id: "zui", pkg: "@zuccadev-labs/zuix-zui" },
  { id: "zout", pkg: "@zuccadev-labs/zuix-zout" },
];

/** Nombre, icono y orden de cada grupo de los manifiestos. Un grupo que no está aquí sale al final con su id. */
export const GROUPS = {
  actions: { label: "Acciones", icon: "cursor-arrow-rays" },
  forms: { label: "Formularios", icon: "pencil-square" },
  agenda: { label: "Agenda", icon: "calendar-days" },
  data: { label: "Datos", icon: "table-cells" },
  charts: { label: "Gráficos", icon: "chart-bar" },
  feedback: { label: "Estado", icon: "bell" },
  content: { label: "Contenido", icon: "rectangle-stack" },
  overlay: { label: "Superposición", icon: "square-3-stack-3d" },
  navigation: { label: "Navegación", icon: "queue-list" },
  carousel: { label: "Carousel", icon: "photo" },
  effects: { label: "Efectos", icon: "sparkles" },
  media: { label: "Medios", icon: "camera" },
  time: { label: "Tiempo", icon: "clock" },
  terminal: { label: "Terminal y código", icon: "command-line" },
  chat: { label: "Chat y mensajería", icon: "chat-bubble-left-right" },
  ai: { label: "IA y agentes", icon: "sparkles" },
  layout: { label: "Layouts", icon: "rectangle-group" },
};

/**
 * Patrón de ARIA Authoring Practices que sigue cada componente, si lo hay. Un manifiesto puede declararlo él
 * mismo con `apg` (el nombre del patrón en https://www.w3.org/WAI/ARIA/apg/patterns/), que gana sobre esta tabla.
 */
const APG = {
  Accordion: "accordion",
  Alert: "alert",
  Breadcrumb: "breadcrumb",
  Button: "button",
  Calendar: "dialog-modal/examples/datepicker-dialog",
  Carousel: "carousel",
  Checkbox: "checkbox",
  CheckboxGroup: "checkbox",
  Combobox: "combobox",
  ConfirmDialog: "alertdialog",
  ContextMenu: "menubar",
  DataTable: "table",
  DatePicker: "dialog-modal/examples/datepicker-dialog",
  Drawer: "dialog-modal",
  IconButton: "button",
  Link: "link",
  Menu: "menu-button",
  Meter: "meter",
  Modal: "dialog-modal",
  NavList: "disclosure",
  NumberInput: "spinbutton",
  RadioGroup: "radio",
  Radio: "radio",
  SegmentedControl: "radio",
  Select: "combobox",
  Slider: "slider",
  Switch: "switch",
  Table: "table",
  Tabs: "tabs",
  Toggle: "button",
  ToggleGroup: "toolbar",
  ButtonGroup: "button",
  CopyButton: "button",
  PasswordInput: "button",
  Tooltip: "tooltip",
  Tree: "treeview",
  JsonTree: "treeview",
};

/** `OTPInput` → `otp-input`, `DataTable` → `data-table`. */
export const slugOf = (name) =>
  name
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();

/** Frases de la nota de accesibilidad que hablan del teclado: son la tabla de teclado de la página. */
const KEYS =
  /\b(teclado|tecla|teclas|Tab|Mayús|Shift|Enter|Intro|Espacio|Escape|Esc|flechas?|Home|End|Inicio|Fin|PageUp|PageDown|Re Pág|Av Pág|Ctrl|Cmd|⌘)\b/;
function keyboardOf(a11y = "") {
  return a11y
    .replace(/\s+/g, " ")
    .split(/(?<=[.;])\s+(?=[A-ZÁÉÍÓÚÑ`])/u)
    .map((s) => s.trim())
    .filter((s) => KEYS.test(s));
}

/**
 * Todos los componentes con lo que su página necesita.
 * @param {{ base?: string }} [options] `base`: prefijo de las rutas (`/components`).
 */
export function loadCatalog({ base = "/components" } = {}) {
  const out = [];
  for (const source of SOURCES) {
    let manifest, html;
    try {
      manifest = readJson(`${source.pkg}/manifest.json`);
      html = readJson(`${source.pkg}/html.json`).components ?? {};
    } catch {
      continue;
    }
    const version = readJson(`${source.pkg}/package.json`).version;
    for (const c of manifest.components) {
      const contract = html[c.name];
      const slug = slugOf(c.name);
      out.push({
        name: c.name,
        slug,
        group: c.group,
        package: source.pkg,
        packageId: source.id,
        version,
        path: `${base}/${c.group}/${slug}`,
        description: c.description ?? "",
        import: c.import ?? "",
        props: c.props ?? [],
        states: c.states ?? [],
        tokens: c.tokens ?? [],
        classes: c.classes ?? [],
        cssVars: c.cssVars ?? [],
        attributes: c.attributes ?? [],
        a11y: c.a11y ?? "",
        keyboard: keyboardOf(c.a11y),
        apg: c.apg ?? APG[c.name],
        status: c.status,
        file: c.file,
        behavior: contract?.behavior ?? "react",
        examples: (c.examples ?? []).map((e) => {
          const h = contract?.examples?.find((x) => x.title === e.title);
          return { title: e.title, code: e.code, html: h?.html, script: h?.script };
        }),
        // Ejemplos del contrato HTML sin equivalente en React.
        htmlOnly: (contract?.examples ?? [])
          .filter((h) => !(c.examples ?? []).some((e) => e.title === h.title))
          .map((h) => ({ title: h.title, html: h.html, script: h.script })),
      });
    }
  }
  const order = Object.keys(GROUPS);
  const rank = (g) => (order.includes(g) ? order.indexOf(g) : order.length);
  out.sort((a, b) => rank(a.group) - rank(b.group) || a.group.localeCompare(b.group) || a.name.localeCompare(b.name));
  return out;
}

/** Grupos presentes en el catálogo, en orden, con su nombre, icono y número de componentes. */
export function groupsOf(catalog) {
  const seen = new Map();
  for (const c of catalog) {
    const g = seen.get(c.group) ?? {
      id: c.group,
      label: GROUPS[c.group]?.label ?? c.group,
      icon: GROUPS[c.group]?.icon ?? "cube",
      count: 0,
    };
    g.count += 1;
    seen.set(c.group, g);
  }
  return [...seen.values()];
}

const BEHAVIOR = { none: "Solo CSS", dom: "CSS + zui/dom", react: "Solo React" };
export const behaviorLabel = (b) => BEHAVIOR[b] ?? b;

const cell = (s) =>
  String(s ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\|/g, "\\|")
    .replace(/\s+/g, " ");
const typeOf = (p) => (p.values?.length ? p.values.map((v) => JSON.stringify(v)).join(" \\| ") : p.type);

/** La página de un componente en Markdown: «Copiar página», la copia .md y llms-full.txt. */
export function componentMarkdown(c, { href = (p) => p } = {}) {
  const lines = [`# ${c.name}`, "", c.description, ""];
  lines.push(`Paquete: \`${c.package}\` · Grupo: ${GROUPS[c.group]?.label ?? c.group} · ${behaviorLabel(c.behavior)}`, "");
  lines.push("## Instalación", "", "```bash", `pnpm add ${c.package}`, "```", "");
  if (c.import) lines.push("```tsx", c.import, "```", "");
  if (c.examples.length || c.htmlOnly.length) {
    lines.push("## Ejemplos", "");
    for (const e of c.examples) {
      lines.push(`### ${e.title}`, "", "```tsx", e.code, "```", "");
      if (e.html) lines.push("HTML sin React:", "", "```html", e.html, "```", "");
    }
    for (const e of c.htmlOnly) lines.push(`### ${e.title}`, "", "```html", e.html, "```", "");
  }
  if (c.props.length) {
    lines.push("## API", "", "| Prop | Tipo | Por defecto | Descripción |", "|---|---|---|---|");
    for (const p of c.props)
      lines.push(
        `| \`${cell(p.name)}\` | ${cell(typeOf(p))} | ${p.default === undefined ? "" : `\`${cell(JSON.stringify(p.default))}\``} | ${cell(p.description)} |`,
      );
    lines.push("");
  }
  if (c.a11y) lines.push("## Accesibilidad", "", c.a11y, "");
  if (c.tokens.length) lines.push("## Tokens", "", c.tokens.map((t) => `\`--z-${t}\``).join(", "), "");
  lines.push(`Fuente: ${href(c.path)}`, "");
  return lines.join("\n");
}
