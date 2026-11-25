// Bloques de zui con serialización propia. Cada función reproduce el marcado de su componente de React (el mismo
// árbol, las mismas clases y atributos de estado); `pnpm check` lo compara con `html.json` ejemplo a ejemplo, así
// que un cambio en el componente que no se traslade aquí rompe la comprobación.

import { h } from "../../core/vnode";
import type { BlockSpec } from "../render";
import { oneOf, safeUrl } from "../render";
import { BLOCK, CONTROL, FLOW, INLINE, PHRASING, PHRASING_STATIC, flag, zicon } from "./shared";

const BUTTON_ICON = { xs: 12, sm: 14, md: 16, lg: 18, xl: 20 } as const;
const SIZES = ["xs", "sm", "md", "lg", "xl"] as const;
const TONES = ["neutral", "accent", "success", "warning", "danger", "info"] as const;
const TONE_ICON: Record<string, string> = {
  neutral: "information-circle",
  accent: "information-circle",
  info: "information-circle",
  success: "check-circle",
  warning: "exclamation-triangle",
  danger: "exclamation-circle",
};
const PADDING = ["none", "sm", "md", "lg"] as const;
const LEVEL = [2, 3, 4] as const;
const s = (v: unknown) => (typeof v === "string" && v ? v : undefined);

export const ZUI_BLOCKS: BlockSpec[] = [
  {
    type: "Button",
    package: "zui",
    icon: "cursor-arrow-rays",
    categories: CONTROL,
    children: PHRASING_STATIC,
    props: { variant: true, size: true, icon: true, iconRight: true, loading: true, fullWidth: true },
    a11y: [{ rule: "name", props: [], text: true, message: "un botón necesita texto" }],
    render: ({ props, children }) => {
      const size = oneOf(props.size, SIZES, "md");
      const loading = props.loading === true;
      return h(
        "button",
        {
          type: "button",
          class: `z-btn z-btn--${oneOf(props.variant, ["primary", "secondary", "outline", "ghost", "link", "danger"], "secondary")}`,
          "data-size": size,
          "data-block": flag(props.fullWidth),
          "data-loading": flag(loading),
          "aria-busy": flag(loading),
          "aria-disabled": flag(loading),
        },
        loading
          ? h("span", { class: "z-btn__spinner", "aria-hidden": "true" })
          : s(props.icon)
            ? zicon(props.icon, BUTTON_ICON[size])
            : null,
        ...children,
        s(props.iconRight) ? zicon(props.iconRight, BUTTON_ICON[size]) : null,
      );
    },
  },
  {
    type: "IconButton",
    package: "zui",
    icon: "plus-circle",
    categories: CONTROL,
    props: { icon: true, label: true, variant: true, size: true, iconVariant: true, active: true, loading: true },
    a11y: [{ rule: "name", props: ["label"], message: "un botón de icono necesita `label`: es su único nombre accesible" }],
    render: ({ props }) => {
      const size = oneOf(props.size, SIZES, "md");
      const loading = props.loading === true;
      const label = typeof props.label === "string" ? props.label : "";
      return h(
        "button",
        {
          type: "button",
          title: label,
          "aria-label": label,
          class: `z-btn z-btn--icon z-btn--${oneOf(props.variant, ["primary", "secondary", "outline", "ghost", "danger"], "ghost")}`,
          "data-size": size,
          "data-active": flag(props.active),
          "data-loading": flag(loading),
          "aria-busy": flag(loading),
          "aria-disabled": flag(loading),
        },
        loading
          ? h("span", { class: "z-btn__spinner", "aria-hidden": "true" })
          : zicon(props.icon ?? "star", BUTTON_ICON[size], oneOf(props.iconVariant, ["outline", "solid"], "outline")),
      );
    },
  },
  {
    type: "Link",
    package: "zui",
    icon: "link",
    categories: CONTROL,
    children: PHRASING_STATIC,
    props: {
      href: { type: "string", format: "uri-reference", "x-control": "link", description: "Destino." },
      variant: true,
      external: true,
      externalLabel: true,
      icon: true,
    },
    a11y: [{ rule: "name", props: [], text: true, message: "un enlace necesita texto" }],
    render: ({ props, children }) => {
      const external = props.external === true;
      return h(
        "a",
        {
          ...(external ? { target: "_blank", rel: "noopener noreferrer" } : {}),
          href: safeUrl(props.href),
          class: `z-link z-link--${oneOf(props.variant, ["inline", "subtle", "standalone"], "inline")}`,
        },
        s(props.icon) ? zicon(props.icon, 14) : null,
        ...children,
        external ? zicon("arrow-top-right-on-square", 12) : null,
        external
          ? h("span", { class: "z-sr-only" }, ` (${typeof props.externalLabel === "string" ? props.externalLabel : "opens in a new tab"})`)
          : null,
      );
    },
  },
  {
    type: "Badge",
    package: "zui",
    icon: "tag",
    categories: INLINE,
    children: PHRASING_STATIC,
    props: { tone: true, variant: true, size: true, dot: true, icon: true },
    render: ({ props, children }) => {
      const size = oneOf(props.size, ["sm", "md"], "md");
      return h(
        "span",
        {
          class: "z-badge",
          "data-tone": oneOf(props.tone, TONES, "neutral"),
          "data-variant": oneOf(props.variant, ["soft", "solid", "outline"], "soft"),
          "data-size": size,
        },
        props.dot === true ? h("span", { class: "z-badge__dot", "aria-hidden": "true" }) : null,
        s(props.icon) ? zicon(props.icon, size === "sm" ? 10 : 12) : null,
        ...children,
      );
    },
  },
  {
    type: "Kbd",
    package: "zui",
    icon: "command-line",
    categories: INLINE,
    children: { text: true },
    props: { keys: true, size: true },
    render: ({ props, children }) => {
      const size = oneOf(props.size, ["sm", "md"], "md");
      const keys = typeof props.keys === "string" ? props.keys.split(" ").filter(Boolean) : [];
      if (keys.length) return h("span", { class: "z-kbd-group" }, ...keys.map((k) => h("kbd", { class: "z-kbd", "data-size": size }, k)));
      return h("kbd", { class: "z-kbd", "data-size": size }, ...children);
    },
  },
  {
    type: "Divider",
    package: "zui",
    icon: "minus",
    categories: BLOCK,
    children: { text: true, accepts: ["phrasing"], rejects: ["interactive"] },
    props: { orientation: true, spacing: true, emphasis: true },
    render: ({ props, children }) => {
      const orientation = oneOf(props.orientation, ["horizontal", "vertical"], "horizontal");
      const label = children.length > 0;
      return h(
        "div",
        {
          role: "separator",
          "aria-orientation": orientation,
          class: "z-divider",
          "data-orientation": orientation,
          "data-spacing": oneOf(props.spacing, ["none", "sm", "md", "lg"], "none"),
          "data-emphasis": oneOf(props.emphasis, ["subtle", "strong"], "subtle"),
          "data-label": label ? "true" : undefined,
        },
        label && orientation === "horizontal" ? h("span", { class: "z-divider__label" }, ...children) : null,
      );
    },
  },
  {
    type: "Callout",
    package: "zui",
    icon: "information-circle",
    categories: BLOCK,
    children: FLOW,
    slots: { title: PHRASING },
    props: { tone: true, icon: true },
    render: ({ props, children, slot, has }) => {
      const tone = oneOf(props.tone, TONES, "neutral");
      const name = props.icon === null ? null : (s(props.icon) ?? TONE_ICON[tone]);
      return h(
        "aside",
        { role: "note", class: "z-callout", "data-tone": tone },
        name ? h("span", { class: "z-callout__icon" }, zicon(name, 16)) : null,
        h("div", { class: "z-callout__body" }, has("title") ? h("p", { class: "z-callout__title" }, ...slot("title")) : null, ...children),
      );
    },
  },
  {
    type: "Alert",
    package: "zui",
    icon: "exclamation-triangle",
    categories: BLOCK,
    children: FLOW,
    slots: { title: PHRASING, actions: { accepts: ["phrasing"], text: false } },
    props: { tone: true, icon: true },
    render: ({ props, children, slot, has }) => {
      const tone = oneOf(props.tone, ["info", "success", "warning", "danger"], "info");
      const fallback: Record<string, string> = {
        info: "information-circle",
        success: "check-circle",
        warning: "exclamation-triangle",
        danger: "exclamation-circle",
      };
      return h(
        "div",
        { role: tone === "danger" || tone === "warning" ? "alert" : "status", class: "z-alert", "data-tone": tone },
        h("span", { class: "z-alert__icon" }, zicon(s(props.icon) ?? fallback[tone], 18)),
        h(
          "div",
          { class: "z-alert__body" },
          has("title") ? h("p", { class: "z-alert__title" }, ...slot("title")) : null,
          children.length ? h("div", { class: "z-alert__message" }, ...children) : null,
          has("actions") ? h("div", { class: "z-alert__actions" }, ...slot("actions")) : null,
        ),
      );
    },
  },
  {
    type: "Card",
    package: "zui",
    icon: "rectangle-stack",
    categories: BLOCK,
    layout: true,
    children: FLOW,
    props: { variant: true, padding: true },
    render: ({ props, children }) =>
      h(
        "div",
        {
          class: "z-card",
          "data-variant": oneOf(props.variant, ["elevated", "outlined", "filled"], "elevated"),
          "data-padding": oneOf(props.padding, PADDING, "md"),
        },
        ...children,
      ),
  },
  {
    type: "CardHeader",
    package: "zui",
    icon: "bars-2",
    categories: BLOCK,
    slots: { title: { ...PHRASING, required: true }, subtitle: PHRASING, action: { accepts: ["phrasing"] } },
    props: { headingLevel: true, icon: true },
    a11y: [{ rule: "required-text", slot: "title", message: "la cabecera de una tarjeta necesita título" }],
    render: ({ props, slot, has }) => {
      const level = oneOf(props.headingLevel, LEVEL, 3);
      return h(
        "div",
        { class: "z-card__header" },
        s(props.icon) ? h("span", { class: "z-card__icon", "aria-hidden": "true" }, zicon(props.icon, 18)) : null,
        h(
          "div",
          { class: "z-card__heading" },
          h(`h${level}`, { class: "z-card__title" }, ...slot("title")),
          has("subtitle") ? h("p", { class: "z-card__subtitle" }, ...slot("subtitle")) : null,
        ),
        has("action") ? h("div", { class: "z-card__action" }, ...slot("action")) : null,
      );
    },
  },
  {
    type: "CardFooter",
    package: "zui",
    icon: "ellipsis-horizontal",
    categories: BLOCK,
    children: { accepts: ["phrasing"] },
    props: { align: true },
    render: ({ props, children }) =>
      h("div", { class: "z-card__footer", "data-align": oneOf(props.align, ["start", "end", "between"], "end") }, ...children),
  },
  {
    type: "Panel",
    package: "zui",
    icon: "window",
    categories: ["flow", "sectioning"],
    layout: true,
    children: FLOW,
    slots: { title: PHRASING, description: PHRASING, actions: { accepts: ["phrasing"] } },
    props: { as: true, material: true, padding: true, headingLevel: true },
    render: ({ props, children, slot, has }) => {
      const level = oneOf(props.headingLevel, LEVEL, 2);
      const head = has("title") || has("actions");
      return h(
        oneOf(props.as, ["section", "aside", "header", "footer", "nav", "div"], "section"),
        { class: `z-panel ${props.material === "solid" ? "z-solid" : "z-liquid"}`, "data-padding": oneOf(props.padding, PADDING, "md") },
        head
          ? h(
              "div",
              { class: "z-panel__header" },
              h(
                "div",
                { class: "z-panel__heading" },
                has("title") ? h(`h${level}`, { class: "z-panel__title" }, ...slot("title")) : null,
                has("description") ? h("p", { class: "z-panel__description" }, ...slot("description")) : null,
              ),
              has("actions") ? h("div", { class: "z-panel__actions" }, ...slot("actions")) : null,
            )
          : null,
        ...children,
      );
    },
  },
  {
    type: "Prose",
    package: "zui",
    icon: "document-text",
    categories: BLOCK,
    layout: true,
    children: FLOW,
    props: { as: true, size: true },
    render: ({ props, children }) =>
      h(
        oneOf(props.as, ["div", "article", "section", "main"], "div"),
        { class: "z-prose", "data-size": oneOf(props.size, ["sm", "md", "lg"], "md") },
        ...children,
      ),
  },
  {
    type: "AspectRatio",
    package: "zui",
    icon: "rectangle-group",
    categories: BLOCK,
    children: { accepts: ["phrasing"], max: 1 },
    props: {
      ratio: {
        anyOf: [
          { type: "number", exclusiveMinimum: 0 },
          { type: "string", pattern: "^\\s*\\d+(\\.\\d+)?\\s*(/\\s*\\d+(\\.\\d+)?\\s*)?$" },
        ],
        default: "16 / 9",
        "x-control": "text",
        description: "Proporción: un número (1.5) o «ancho / alto» (16 / 9).",
      },
    },
    render: ({ props, children }) => {
      const r = props.ratio;
      const ratio =
        typeof r === "number" && Number.isFinite(r) && r > 0 ? String(r) : typeof r === "string" && /^[\d.\s/]+$/.test(r) ? r : "16 / 9";
      return h("div", { class: "z-aspect", s: { "--z-aspect": ratio } }, ...children);
    },
  },
  {
    type: "Spinner",
    package: "zui",
    icon: "arrow-path",
    categories: INLINE,
    props: { size: true, tone: true, shape: true, label: true },
    render: ({ props }) => {
      const shape = oneOf(props.shape, ["ring", "dots", "bars"], "ring");
      const parts = { ring: 0, dots: 3, bars: 4 }[shape];
      const label = typeof props.label === "string" ? props.label : "Loading";
      return h(
        "span",
        {
          class: "z-spinner",
          "data-size": oneOf(props.size, ["sm", "md", "lg"], "md"),
          "data-tone": oneOf(props.tone, ["accent", "muted", "current"], "accent"),
          "data-shape": parts ? shape : undefined,
          role: label ? "status" : undefined,
          "aria-label": label || undefined,
          "aria-hidden": label ? undefined : "true",
        },
        ...Array.from({ length: parts }, () => h("span", { class: "z-spinner__part" })),
      );
    },
  },
  {
    type: "EmptyState",
    package: "zui",
    icon: "inbox",
    categories: BLOCK,
    slots: { title: { ...PHRASING, required: true }, description: PHRASING, action: { accepts: ["phrasing"] } },
    props: { icon: true, size: true, headingLevel: true },
    a11y: [{ rule: "required-text", slot: "title", message: "un estado vacío necesita título" }],
    render: ({ props, slot, has }) => {
      const size = oneOf(props.size, ["sm", "md"], "md");
      return h(
        "div",
        { class: "z-empty", "data-size": size },
        s(props.icon) ? h("span", { class: "z-empty__icon" }, zicon(props.icon, size === "sm" ? 20 : 28)) : null,
        h(`h${oneOf(props.headingLevel, LEVEL, 3)}`, { class: "z-empty__title" }, ...slot("title")),
        has("description") ? h("p", { class: "z-empty__description" }, ...slot("description")) : null,
        has("action") ? h("div", { class: "z-empty__action" }, ...slot("action")) : null,
      );
    },
  },
];
