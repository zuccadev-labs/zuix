// Bloques de maquetación de zout con serialización propia. El conector vive en zui y no importa zout: escribe el
// marcado de su contrato (`zout/html.json`), igual que una aplicación sin React. `pnpm check` lo compara con él.

import { h } from "../../core/vnode";
import { type AdaptiveTemplates, adaptiveLayoutAttributes } from "../adaptive";
import type { BlockSpec } from "../render";
import { oneOf } from "../render";
import { FLOW, LAYOUT, PHRASING, SPACE, bool, enumOf, text } from "./shared";

const ALIGN = ["start", "center", "end", "stretch"];
const TAGS = ["div", "section", "article", "header", "footer", "main", "aside", "nav"];
const WIDTHS = ["sm", "md", "lg", "xl", "content", "prose", "full"];
const asTag = enumOf(TAGS, "div", "Elemento de la raíz.");

export const ZOUT_BLOCKS: BlockSpec[] = [
  {
    type: "Stack",
    package: "zout",
    icon: "bars-4",
    categories: ["flow"],
    layout: true,
    children: LAYOUT,
    props: { gap: enumOf(SPACE, 4, "Separación, en pasos de la escala de espaciado."), align: enumOf(ALIGN, "stretch"), as: asTag },
    render: ({ props, children }) =>
      h(
        oneOf(props.as, TAGS, "div"),
        { class: "z-stack", "data-gap": oneOf(props.gap, SPACE, 4), "data-align": oneOf(props.align, ALIGN, "stretch") },
        ...children,
      ),
  },
  {
    type: "Inline",
    package: "zout",
    icon: "view-columns",
    categories: ["flow"],
    layout: true,
    children: LAYOUT,
    props: {
      gap: enumOf(SPACE, 2, "Separación, en pasos de la escala de espaciado."),
      align: enumOf(ALIGN, "center"),
      justify: enumOf(["start", "center", "end", "between"], "start"),
      wrap: bool(true, "Salta de línea cuando no cabe."),
      as: asTag,
    },
    render: ({ props, children }) =>
      h(
        oneOf(props.as, TAGS, "div"),
        {
          class: "z-inline",
          "data-gap": oneOf(props.gap, SPACE, 2),
          "data-align": oneOf(props.align, ALIGN, "center"),
          "data-justify": oneOf(props.justify, ["start", "center", "end", "between"], "start"),
          "data-wrap": props.wrap === false ? undefined : "true",
        },
        ...children,
      ),
  },
  {
    type: "Grid",
    package: "zout",
    icon: "squares-2x2",
    categories: ["flow"],
    layout: true,
    children: LAYOUT,
    props: {
      min: {
        anyOf: [
          { type: "integer", minimum: 40, maximum: 1600 },
          { type: "string", pattern: "^\\d+(\\.\\d+)?(px|rem|em|ch|%)$" },
        ],
        default: 240,
        "x-control": "number",
        description: "Ancho mínimo de cada celda (px, o una longitud CSS).",
      },
      gap: enumOf(SPACE, 4, "Separación, en pasos de la escala de espaciado."),
      as: asTag,
    },
    render: ({ props, children }) => {
      const m = props.min;
      const min =
        typeof m === "number" && Number.isFinite(m)
          ? `${m}px`
          : typeof m === "string" && /^\d+(\.\d+)?(px|rem|em|ch|%)$/.test(m)
            ? m
            : "240px";
      return h(
        oneOf(props.as, TAGS, "div"),
        { class: "z-grid", "data-gap": oneOf(props.gap, SPACE, 4), s: { "--z-grid-min": min } },
        ...children,
      );
    },
  },
  {
    type: "Container",
    package: "zout",
    icon: "arrows-pointing-in",
    categories: ["flow"],
    layout: true,
    children: LAYOUT,
    props: {
      width: enumOf(WIDTHS, "content", "Ancho máximo: tokens container-* (sm–xl), ancho de contenido, de lectura o sin límite."),
      gutter: {
        type: "string",
        enum: ["fluid", "stage", "none"],
        "x-control": "select",
        description: "Margen lateral. Por defecto fluid en sm–xl y stage en el resto.",
      },
      as: asTag,
    },
    render: ({ props, children }) => {
      const width = oneOf(props.width, WIDTHS, "content");
      const gutter = oneOf(props.gutter, ["fluid", "stage", "none"], ["sm", "md", "lg", "xl"].includes(width) ? "fluid" : "stage");
      return h(oneOf(props.as, TAGS, "div"), { class: "z-container", "data-width": width, "data-gutter": gutter }, ...children);
    },
  },
  {
    type: "PageHeader",
    package: "zout",
    icon: "bars-3-center-left",
    categories: ["flow"],
    slots: {
      title: { ...PHRASING, required: true },
      description: PHRASING,
      eyebrow: PHRASING,
      actions: { accepts: ["phrasing"] },
      breadcrumb: { accepts: ["flow"] },
    },
    props: { headingLevel: enumOf([1, 2, 3, 4, 5, 6], 1, "Nivel del título. 1 en la página principal.") },
    a11y: [{ rule: "required-text", slot: "title", message: "la cabecera de página necesita título" }],
    render: ({ props, slot, has }) =>
      h(
        "header",
        { class: "z-pagehead" },
        ...slot("breadcrumb"),
        h(
          "div",
          { class: "z-pagehead__row" },
          h(
            "div",
            { class: "z-pagehead__text" },
            has("eyebrow") ? h("div", { class: "z-pagehead__eyebrow" }, ...slot("eyebrow")) : null,
            h(`h${oneOf(props.headingLevel, [1, 2, 3, 4, 5, 6], 1)}`, { class: "z-pagehead__title" }, ...slot("title")),
            has("description") ? h("p", { class: "z-pagehead__description" }, ...slot("description")) : null,
          ),
          has("actions") ? h("div", { class: "z-pagehead__actions" }, ...slot("actions")) : null,
        ),
      ),
  },
  {
    type: "PageSection",
    package: "zout",
    icon: "rectangle-group",
    categories: ["flow", "sectioning"],
    layout: true,
    children: FLOW,
    slots: { title: PHRASING, description: PHRASING, actions: { accepts: ["phrasing"] } },
    props: { headingLevel: enumOf([2, 3, 4, 5, 6], 2, "Nivel del título.") },
    render: ({ props, children, slot, has }) =>
      h(
        "section",
        { class: "z-section" },
        has("title") || has("actions")
          ? h(
              "div",
              { class: "z-section__head" },
              h(
                "div",
                null,
                has("title")
                  ? h(`h${oneOf(props.headingLevel, [2, 3, 4, 5, 6], 2)}`, { class: "z-section__title" }, ...slot("title"))
                  : null,
                has("description") ? h("p", { class: "z-section__description" }, ...slot("description")) : null,
              ),
              ...slot("actions"),
            )
          : null,
        ...children,
      ),
  },
  {
    type: "LandingLayout",
    package: "zout",
    icon: "globe-alt",
    categories: ["flow", "sectioning"],
    layout: true,
    children: LAYOUT,
    slots: { header: { accepts: ["flow"] }, footer: { accepts: ["flow"] } },
    props: {},
    render: ({ children, slot, has }) =>
      h(
        "div",
        { class: "z-landing" },
        has("header") ? h("div", { class: "z-landing__header" }, ...slot("header")) : null,
        h("main", { class: "z-landing__main" }, ...children),
        has("footer") ? h("div", { class: "z-landing__footer" }, ...slot("footer")) : null,
      ),
  },
  {
    type: "LandingHero",
    package: "zout",
    icon: "sparkles",
    categories: ["flow", "sectioning"],
    slots: {
      title: { ...PHRASING, required: true },
      eyebrow: PHRASING,
      lead: PHRASING,
      actions: { accepts: ["phrasing"] },
      media: { accepts: ["flow"] },
    },
    props: { align: enumOf(["center", "split"], "center", "`center` con la imagen debajo; `split` texto a un lado e imagen al otro.") },
    a11y: [{ rule: "required-text", slot: "title", message: "el héroe necesita título (es el h1 de la página)" }],
    render: ({ props, slot, has }) =>
      h(
        "section",
        { class: "z-landing-hero", "data-align": oneOf(props.align, ["center", "split"], "center") },
        h(
          "div",
          { class: "z-landing-hero__text" },
          has("eyebrow") ? h("p", { class: "z-landing-hero__eyebrow" }, ...slot("eyebrow")) : null,
          h("h1", { class: "z-landing-hero__title" }, ...slot("title")),
          has("lead") ? h("p", { class: "z-landing-hero__lead" }, ...slot("lead")) : null,
          has("actions") ? h("div", { class: "z-landing-hero__actions" }, ...slot("actions")) : null,
        ),
        has("media") ? h("div", { class: "z-landing-hero__media" }, ...slot("media")) : null,
      ),
  },
  {
    type: "LandingSection",
    package: "zout",
    icon: "rectangle-stack",
    categories: ["flow", "sectioning"],
    layout: true,
    children: LAYOUT,
    slots: { title: PHRASING, eyebrow: PHRASING, description: PHRASING, actions: { accepts: ["phrasing"] } },
    props: {
      id: { ...text("Ancla de la sección (#id) y del título."), pattern: "^[A-Za-z][A-Za-z0-9_-]*$" },
      variant: enumOf(
        ["default", "features", "cta", "muted"],
        "default",
        "`features` rejilla de tarjetas; `cta` banda de llamada; `muted` fondo tenue.",
      ),
      columns: enumOf([2, 3, 4], 3, "Columnas de la rejilla con `features`."),
    },
    render: ({ props, children, slot, has }) => {
      const id = typeof props.id === "string" && /^[A-Za-z][A-Za-z0-9_-]*$/.test(props.id) ? props.id : undefined;
      const variant = oneOf(props.variant, ["default", "features", "cta", "muted"], "default");
      const headingId = id && has("title") ? `${id}-title` : undefined;
      return h(
        "section",
        {
          id,
          class: variant === "cta" ? "z-landing-section z-liquid" : "z-landing-section",
          "data-variant": variant,
          "data-columns": variant === "features" ? oneOf(props.columns, [2, 3, 4], 3) : undefined,
          "aria-labelledby": headingId,
        },
        has("title") || has("eyebrow") || has("description")
          ? h(
              "div",
              { class: "z-landing-section__head" },
              has("eyebrow") ? h("p", { class: "z-landing-section__eyebrow" }, ...slot("eyebrow")) : null,
              has("title") ? h("h2", { class: "z-landing-section__title", id: headingId }, ...slot("title")) : null,
              has("description") ? h("p", { class: "z-landing-section__description" }, ...slot("description")) : null,
              has("actions") ? h("div", { class: "z-landing-section__actions" }, ...slot("actions")) : null,
            )
          : null,
        children.length ? h("div", { class: "z-landing-section__body" }, ...children) : null,
      );
    },
  },
  {
    type: "AdaptiveLayout",
    package: "zout",
    provisional: "AdaptiveLayout llega a zout en la rama feat/v05-adaptive; su manifiesto y su marcado sustituyen a estos al integrar.",
    title: "AdaptiveLayout",
    group: "layout",
    description: "Rejilla de áreas con una plantilla por clase de tamaño. Cada hijo elige área, orden y visibilidad por clase.",
    icon: "squares-2x2",
    categories: ["flow"],
    layout: true,
    children: LAYOUT,
    props: {
      templates: {
        type: "object",
        "x-control": "json",
        description:
          'Plantilla por clase: { compact: { areas: ["main", "aside"] }, expanded: { areas: ["main aside"], columns: "1fr 18rem" } }.',
        propertyNames: { enum: ["compact", "medium", "expanded", "large", "xlarge"] },
        additionalProperties: {
          type: "object",
          required: ["areas"],
          additionalProperties: false,
          properties: {
            areas: { type: "array", minItems: 1, items: { type: "string", pattern: "^[A-Za-z0-9_.\\s-]+$" } },
            columns: { type: "string", pattern: "^[A-Za-z0-9 ().,%+*/-]*$" },
            rows: { type: "string", pattern: "^[A-Za-z0-9 ().,%+*/-]*$" },
          },
        },
        default: { compact: { areas: ["main", "aside"] }, expanded: { areas: ["main aside"], columns: "1fr 18rem" } },
      },
      measure: enumOf(["container", "viewport"], "container", "Sobre qué se mide la clase de tamaño."),
    },
    adaptive: {
      layout: {
        measure: "container",
        templates: { compact: { areas: ["main", "aside"] }, expanded: { areas: ["main aside"], columns: "1fr 18rem" } },
      },
    },
    presets: [
      {
        id: "lista-y-detalle",
        title: "Lista y detalle",
        node: {
          id: "al",
          type: "AdaptiveLayout",
          props: { templates: { compact: { areas: ["list", "detail"] }, expanded: { areas: ["list detail"], columns: "20rem 1fr" } } },
          children: [
            {
              id: "al-l",
              type: "Section",
              props: { tag: "nav" },
              adaptive: { compact: { area: "list" } },
              children: [{ id: "al-lp", type: "Paragraph", children: [{ id: "al-lt", type: "#text", text: "List" }] }],
            },
            {
              id: "al-d",
              type: "Section",
              props: { tag: "section" },
              adaptive: { compact: { area: "detail" } },
              children: [{ id: "al-dp", type: "Paragraph", children: [{ id: "al-dt", type: "#text", text: "Detail" }] }],
            },
          ],
        },
      },
      {
        id: "contenido-con-lateral",
        title: "Contenido con lateral",
        node: {
          id: "cl",
          type: "AdaptiveLayout",
          props: {
            templates: {
              compact: { areas: ["main", "aside"] },
              expanded: { areas: ["main aside"], columns: "1fr 18rem" },
              large: { areas: ["nav main aside"], columns: "14rem 1fr 18rem" },
            },
          },
          children: [
            {
              id: "cl-n",
              type: "Section",
              props: { tag: "nav" },
              adaptive: { compact: { hidden: true }, large: { hidden: false, area: "nav" } },
              children: [{ id: "cl-np", type: "Paragraph", children: [{ id: "cl-nt", type: "#text", text: "Navigation" }] }],
            },
            {
              id: "cl-m",
              type: "Section",
              props: { tag: "main" },
              adaptive: { compact: { area: "main" } },
              children: [{ id: "cl-mp", type: "Paragraph", children: [{ id: "cl-mt", type: "#text", text: "Content" }] }],
            },
            {
              id: "cl-a",
              type: "Section",
              props: { tag: "aside" },
              adaptive: { compact: { area: "aside", order: 2 } },
              children: [{ id: "cl-ap", type: "Paragraph", children: [{ id: "cl-at", type: "#text", text: "Aside" }] }],
            },
          ],
        },
      },
    ],
    render: ({ props, children }) => {
      const { a, s } = adaptiveLayoutAttributes(
        props.templates as AdaptiveTemplates | undefined,
        props.measure === "viewport" ? "viewport" : "container",
      );
      return { t: "div", a: { class: "z-adaptive", ...a }, s, c: children };
    },
  },
];
