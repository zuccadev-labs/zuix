#!/usr/bin/env node
// Matriz de soporte de docs/users/10-compatibilidad.md (`pnpm matrix`; `--check` solo comprueba que está al día).
// Las versiones salen del paquete web-features (los datos de Baseline, que a su vez vienen de
// @mdn/browser-compat-data); lo que escribo a mano es para qué uso cada característica y qué pasa por debajo.
// Cada fila lleva un detector que cuenta los usos en el CSS empaquetado o en el código sin framework: si una
// característica deja de usarse, la generación falla y la fila se quita en vez de quedarse envejeciendo.
// Requiere `pnpm dist` (lee zui/dist/zui.css y zout/dist/zout.css).
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { transform } from "lightningcss";
import { features } from "web-features";
import { TARGET } from "./compat.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const DOC = "docs/users/10-compatibilidad.md";
const START = "<!-- matriz: la genera tools/compat-matrix.mjs (pnpm matrix); no se edita a mano -->";
const END = "<!-- fin de la matriz -->";

const walk = (d) =>
  readdirSync(d).flatMap((f) => {
    const p = join(d, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
const read = (p) => readFileSync(join(root, p), "utf8");

/** Fuentes donde se buscan los usos: CSS empaquetado y TypeScript del modo sin framework (sin React). */
export function sources() {
  const css = read("zui/dist/zui.css") + read("zout/dist/zout.css");
  const js = [
    ...walk(join(root, "zui/src/dom")),
    ...walk(join(root, "zui/src/core")),
    ...walk(join(root, "zout/src/dom")),
    join(root, "zout/src/site.ts"),
    join(root, "zicon/src/element.ts"),
  ]
    .filter((f) => f.endsWith(".ts"))
    .map((f) => readFileSync(f, "utf8").replace(/^\s*\/\/.*$/gm, ""))
    .join("\n");
  return { css, js };
}

const count = (text, re) => (text.match(new RegExp(re.source, re.flags.includes("g") ? re.flags : `${re.flags}g`)) ?? []).length;
/** Reglas de estilo con reglas anidadas dentro (después de empaquetar). */
const nested = (css) => {
  let n = 0;
  transform({
    filename: "matrix.css",
    code: Buffer.from(css),
    visitor: {
      Rule: {
        style(rule) {
          if (rule.value.rules?.length) n += 1;
        },
      },
    },
  });
  return n;
};

// Qué pasa por debajo de la versión mínima: roto (la pieza no funciona), compat (la hoja compat lo resuelve),
// alternativa (la suite hace otra cosa que funciona) o degradación (se pierde un detalle, no la función).
const EFFECT = { roto: "Roto", compat: "Modo compat", alternativa: "Alternativa", degradacion: "Degradación" };

/** Filas de la matriz. `uses({ css, js })` cuenta los usos; `floor`: marca el mínimo de la hoja normal. */
export const ROWS = [
  {
    id: "popover",
    uses: ({ css, js }) => count(css, /\[popover|:popover-open/) + count(js, /popover/),
    floor: true,
    what: "Todas las capas flotantes: menús, selectores, tooltips, popovers, toasts, submenús",
    effect: "roto",
    below:
      "No se abren. El `/dom` no lanza: comprueba que existe `showPopover` y lee el estado sin `:popover-open`. Con `@oddbird/popover-polyfill` funcionan, y la hoja compat entiende su clase `.\\:popover-open`",
  },
  {
    id: "dialog",
    uses: ({ css, js }) => count(css, /\bdialog\b/) + count(js, /showModal\(/),
    floor: true,
    what: "Modal, Drawer, AlertDialog, Palette y `confirm()`",
    effect: "roto",
    below: "No se abren. Es el suelo de Safari en el modo compat (15.4)",
  },
  {
    id: "cascade-layers",
    uses: ({ css }) => count(css, /@layer\b/),
    floor: true,
    what: "El orden de las hojas: `zui.material`, `zui.base` y una capa por grupo; `zout` después",
    effect: "compat",
    below:
      "Con la hoja normal, el navegador descarta todo lo que hay dentro de `@layer`: la página sale sin estilos. La hoja compat aplana las capas en su orden",
  },
  {
    id: "color-mix",
    uses: ({ css }) => count(css, /color-mix\(/),
    floor: true,
    what: "Tonos suaves, bordes y estados de los tokens y de los componentes",
    effect: "compat",
    below:
      "La declaración no vale: fondos y bordes de estado transparentes, tonos de texto heredados. La hoja compat escribe el color ya mezclado para cada marca y tema",
  },
  {
    id: "nesting",
    uses: ({ css }) => nested(css),
    what: "Reglas anidadas que quedan después de empaquetar: hoy, `@starting-style` dentro de la regla que anima",
    effect: "compat",
    below: "La regla anidada se pierde (aquí, solo la animación de entrada). La hoja compat la desanida",
  },
  {
    id: "has",
    uses: ({ css }) => count(css, /:has\(/),
    what: "Anillo de foco en el contenedor de un enlace o control, columna plegada del Shell, media estrella del Rating, ajustes de espaciado",
    effect: "degradacion",
    below:
      "La regla se ignora. Casi todo es espaciado. Los anillos de foco de contenedor pasan a `:focus-within` en la hoja compat. Sin alternativa: la columna del Shell no se estrecha al plegar la Sidebar y una media estrella se ve entera",
  },
  {
    id: "dir-pseudo",
    uses: ({ css }) => count(css, /:dir\(/),
    what: "Espejo en RTL de flechas, gráficos, marquesinas y cajones",
    effect: "compat",
    below: 'La regla se ignora: esas piezas no se invierten en RTL. La hoja compat mira `[dir="rtl"]` en el elemento o en un ancestro',
  },
  {
    id: "registered-custom-properties",
    uses: ({ css }) => count(css, /@property\b/),
    what: "Variables animables: progreso del anillo, avance del carrusel, lienzo de nodos",
    effect: "compat",
    below: "La variable no tiene valor inicial ni se interpola. La hoja compat le da su valor inicial; la animación salta sin interpolar",
  },
  {
    id: "container-queries",
    uses: ({ css }) => count(css, /@container\b/),
    what: "Disposición según el ancho del contenedor (tarjetas, cabeceras, paneles, dashboard)",
    effect: "degradacion",
    below: "Se queda la disposición base, la de ancho amplio. Afecta a Safari 15.4 a 15.6 en el modo compat",
  },
  {
    id: "starting-style",
    uses: ({ css }) => count(css, /@starting-style\b/),
    what: "Entrada animada de capas, diálogos y avisos",
    effect: "degradacion",
    below: "Aparecen sin transición",
  },
  {
    id: "inert",
    uses: ({ js }) => count(js, /\.inert\b/),
    what: "Fondo inerte con el cajón del Shell abierto, copias de las diapositivas del carrusel",
    effect: "degradacion",
    below: "El foco con Tab puede llegar a lo que está detrás. Afecta a Safari 15.4 en el modo compat",
  },
  {
    id: "anchor-positioning",
    uses: ({ js }) => count(js, /anchorWithCss|supportsAnchor/),
    what: "Colocación de popovers con CSS, como mejora progresiva",
    effect: "alternativa",
    below: "Se colocan con JavaScript (`place()`), que mide y vuelve a colocar al desplazar",
  },
  {
    id: "move-before",
    uses: ({ js }) => count(js, /moveBefore/),
    what: "Reordenar nodos sin perder foco ni estado (dashboard, listas de transferencia)",
    effect: "alternativa",
    below:
      "`append()`: el orden es el mismo, pero el nodo movido se desconecta y vuelve (un iframe se recarga, una animación empieza de nuevo)",
  },
  {
    id: "scroll-driven-animations",
    uses: ({ css }) => count(css, /animation-timeline/),
    what: "Efectos ligados al desplazamiento (carrusel, lector, sombras de los bordes)",
    effect: "degradacion",
    below: "Están dentro de `@supports`: sin efecto",
  },
  {
    id: "customizable-select",
    uses: ({ css }) => count(css, /base-select/),
    what: "Selector de mes y año del Calendar",
    effect: "degradacion",
    below: "`<select>` nativo del sistema",
  },
  {
    id: "field-sizing",
    uses: ({ css, js }) => count(css, /field-sizing/) + count(js, /field-sizing/),
    what: "Altura del Composer según su texto",
    effect: "alternativa",
    below: "La mide JavaScript en cada entrada",
  },
  {
    id: "hidden-until-found",
    uses: ({ css }) => count(css, /until-found/),
    what: "Texto plegado de ReviewCard que encuentra Buscar en la página",
    effect: "degradacion",
    below: "Es `hidden` normal: Buscar en la página no lo encuentra",
  },
  {
    id: "scrollend",
    uses: ({ js }) => count(js, /scrollend/),
    what: "Fin del desplazamiento del carrusel",
    effect: "alternativa",
    below: "Se detecta con un temporizador tras el último `scroll`",
  },
  {
    id: "intl-segmenter",
    uses: ({ js }) => count(js, /Segmenter/),
    what: "Grafemas de las iniciales del Avatar y de los efectos de texto",
    effect: "alternativa",
    below: "Por puntos de código: un emoji compuesto puede partirse",
  },
  {
    id: "check-visibility",
    uses: ({ js }) => count(js, /checkVisibility/),
    what: "Saber si un elemento enfocable se ve",
    effect: "alternativa",
    below: "Se usa `getClientRects()`",
  },
  {
    id: "backdrop-filter",
    uses: ({ css }) => count(css, /backdrop-filter/),
    what: "Cristal de superficies y capas (`.z-liquid`)",
    effect: "degradacion",
    below:
      "Sin desenfoque: queda el fondo translúcido del token. Safari lo tiene con prefijo desde la 9 y la suite escribe también `-webkit-backdrop-filter`",
  },
  {
    id: "text-wrap-balance",
    uses: ({ css }) => count(css, /text-wrap:\s*balance/),
    what: "Títulos repartidos en líneas parejas",
    effect: "degradacion",
    below: "Corte de línea normal",
  },
];

const BROWSERS = [
  ["Chrome", "chrome"],
  ["Firefox", "firefox"],
  ["Safari", "safari"],
  ["Safari iOS", "safari_ios"],
];

const versionKey = (v) => (v ?? "").split(".").map(Number);
const newer = (a, b) => {
  const [x, y] = [versionKey(a), versionKey(b)];
  for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0);
  return false;
};

/** Versión mínima de cada navegador para una característica ("—" si ninguno la tiene). */
export function support(id) {
  const f = features[id];
  if (f?.kind !== "feature") throw new Error(`web-features no tiene la característica "${id}"`);
  const s = f.status?.support ?? {};
  const out = Object.fromEntries(BROWSERS.map(([, b]) => [b, s[b] ?? null]));
  // Edge sigue a Chrome desde que usa Chromium; si llega después, se dice.
  out.edge = s.edge && s.edge !== s.chrome ? s.edge : null;
  return { name: f.name, out };
}

export function matrix(src = sources()) {
  const rows = ROWS.map((row) => {
    const uses = row.uses(src);
    if (!uses) throw new Error(`"${row.id}" ya no aparece en el código: quita su fila de tools/compat-matrix.mjs`);
    return { ...row, uses, ...support(row.id) };
  });
  // El mínimo de la hoja normal: lo más alto de las filas que la marcan.
  const floor = Object.fromEntries(
    BROWSERS.map(([, b]) => [b, rows.filter((r) => r.floor).reduce((m, r) => (newer(r.out[b], m) ? r.out[b] : m), "0")]),
  );
  // Lo que el modo compat no resuelve por sí solo no puede pedir más que su objetivo.
  for (const r of rows.filter((r) => r.effect === "roto" && r.id !== "popover"))
    for (const [b, t] of [
      ["chrome", TARGET.chrome],
      ["firefox", TARGET.firefox],
      ["safari", TARGET.safari],
      ["safari_ios", TARGET.ios_saf],
    ])
      if (newer(r.out[b], t)) throw new Error(`"${r.id}" pide ${b} ${r.out[b]}, por encima del objetivo del modo compat (${t})`);
  return { rows, floor };
}

const cell = (v) => v ?? "—";
export function render({ rows, floor }) {
  const head = `| Característica | Qué la usa | ${BROWSERS.map(([n]) => n).join(" | ")} | Por debajo |`;
  const sep = `|${"---|".repeat(BROWSERS.length + 3)}`;
  const lines = rows.map((r) => {
    const chrome = r.out.edge ? `${cell(r.out.chrome)} (Edge ${r.out.edge})` : cell(r.out.chrome);
    const versions = [chrome, ...BROWSERS.slice(1).map(([, b]) => cell(r.out[b]))];
    // `<dialog>` en el texto de un enlace sería una etiqueta: va como código.
    const label = r.name.includes("<") ? `\`${r.name}\`` : r.name;
    const name = `[${label}](https://web-platform-dx.github.io/web-features-explorer/features/${r.id}/)`;
    return `| ${name} | ${r.what} (${r.uses}) | ${versions.join(" | ")} | **${EFFECT[r.effect]}.** ${r.below} |`;
  });
  const summary = [
    "| | Chrome y Edge | Firefox | Safari | Safari iOS |",
    "|---|---|---|---|---|",
    `| Hoja normal y \`/dom\` | ${floor.chrome} | ${floor.firefox} | ${floor.safari} | ${floor.safari_ios} |`,
    `| Hoja compat y \`/dom\` con \`@oddbird/popover-polyfill\` | ${TARGET.chrome} | ${TARGET.firefox} | ${TARGET.safari} | ${TARGET.ios_saf} |`,
  ];
  return [
    START,
    "",
    ...summary,
    "",
    head,
    sep,
    ...lines,
    "",
    `Versiones de web-features ${webFeaturesVersion()}. Entre paréntesis, los usos que cuenta el generador en el CSS empaquetado o en el código sin framework.`,
    "",
    END,
  ].join("\n");
}

const webFeaturesVersion = () => JSON.parse(readFileSync(join(root, "node_modules/web-features/package.json"), "utf8")).version;

export function updateDoc(text, block) {
  const a = text.indexOf(START);
  const b = text.indexOf(END);
  if (a === -1 || b === -1 || b < a) throw new Error(`${DOC}: faltan las marcas de la matriz`);
  return text.slice(0, a) + block + text.slice(b + END.length);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const text = read(DOC);
  const next = updateDoc(text, render(matrix()));
  if (process.argv.includes("--check")) {
    if (next !== text) {
      console.error(`✗ ${DOC}: la matriz no está al día. Ejecuta: pnpm matrix`);
      process.exit(1);
    }
    console.log("✓ matriz de soporte al día");
  } else {
    if (next !== text) writeFileSync(join(root, DOC), next);
    console.log(`✓ ${DOC} · matriz de ${ROWS.length} características`);
  }
}
