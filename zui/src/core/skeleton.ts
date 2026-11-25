// Skeletons por patrón (tarjeta, lista, tabla, perfil, chat, gráfico, artículo y calendario): cada patrón es un
// árbol de core/vnode, así que React, el modo DOM y el contrato HTML pintan lo mismo. Los anchos salen de un
// generador con semilla por índice: el servidor y el cliente dan los mismos y no hay saltos al hidratar.

import { h, type VEl, type VNode } from "./vnode";

export type SkeletonPattern = "card" | "list" | "table" | "profile" | "chat" | "chart" | "article" | "calendar";
export type SkeletonAnimation = "pulse" | "wave" | "none";
export const SKELETON_PATTERNS: readonly SkeletonPattern[] = ["card", "list", "table", "profile", "chat", "chart", "article", "calendar"];
export const isPattern = (v: unknown): v is SkeletonPattern =>
  typeof v === "string" && (SKELETON_PATTERNS as readonly string[]).includes(v);
export const isAnimation = (v: unknown): v is SkeletonAnimation => v === "pulse" || v === "wave" || v === "none";

export interface SkeletonPatternOptions {
  animation?: SkeletonAnimation;
  /** Semilla de los anchos (misma semilla, mismos anchos). */
  seed?: number;
  /** card: imagen arriba. */
  media?: boolean;
  /** card: líneas de texto. */
  lines?: number;
  /** card: pie con botón. */
  actions?: boolean;
  /** list y table: filas. */
  rows?: number;
  /** list: avatar circular. */
  avatar?: boolean;
  /** list: dato a la derecha. */
  meta?: boolean;
  /** table: columnas. */
  columns?: number;
  /** table: fila de cabecera. */
  header?: boolean;
  /** profile: portada. */
  cover?: boolean;
  /** chat: mensajes. */
  messages?: number;
  /** chart: barras, línea o anillo. */
  type?: "bar" | "line" | "donut";
  /** article: párrafos. */
  paragraphs?: number;
  /** article: imagen. */
  image?: boolean;
}

/** Número pseudoaleatorio estable en [0, 1) para (semilla, índice): mulberry32. */
export function seeded(seed: number, index: number): number {
  let t = (Math.imul(seed | 0, 0x9e3779b1) ^ Math.imul(index | 0, 0x85ebca6b)) >>> 0;
  t = (t + 0x6d2b79f5) >>> 0;
  let r = Math.imul(t ^ (t >>> 15), 1 | t);
  r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
  return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
}

/** Porcentaje entero estable entre `min` y `max` (incluidos). */
export const widthAt = (seed: number, index: number, min: number, max: number) =>
  Math.round(min + seeded(seed, index) * (Math.max(min, max) - min));

const count = (v: number | undefined, fallback: number, max = 24) =>
  typeof v === "number" && Number.isFinite(v) && v >= 1 ? Math.min(max, Math.floor(v)) : fallback;

/** Constructor de huesos con un contador de índices para la semilla. */
function bones(o: SkeletonPatternOptions) {
  const animation = o.animation ?? "pulse";
  const seed = o.seed ?? 1;
  let n = 0;
  const bone = (variant: "text" | "circular" | "rectangular" | "rounded", part: string, width?: [number, number] | string) => {
    const s: Record<string, string> = {};
    if (Array.isArray(width)) s["--z-skeleton-w"] = `${widthAt(seed, n++, width[0], width[1])}%`;
    else if (typeof width === "string") s["--z-skeleton-w"] = width;
    return h("span", {
      class: `z-skeleton z-skeleton-pattern__${part}`,
      "data-variant": variant,
      "data-animation": animation,
      s: Object.keys(s).length ? s : undefined,
    });
  };
  const height = (part: string, min: number, max: number) => {
    const s = { "--z-skeleton-h": `${widthAt(seed, n++, min, max)}%` };
    return h("span", { class: `z-skeleton z-skeleton-pattern__${part}`, "data-variant": "rounded", "data-animation": animation, s });
  };
  return { bone, height };
}

const root = (pattern: SkeletonPattern, extra: Record<string, string | undefined>, ...c: VNode[]): VEl =>
  h("div", { class: "z-skeleton-pattern", "data-pattern": pattern, "aria-hidden": "true", ...extra }, ...c);

/** Árbol del patrón pedido. */
export function skeletonTree(pattern: SkeletonPattern, o: SkeletonPatternOptions = {}): VEl {
  const { bone, height } = bones(o);
  switch (pattern) {
    case "card": {
      const lines = count(o.lines, 2, 8);
      return root(
        "card",
        {},
        o.media === false ? null : bone("rounded", "media"),
        h(
          "div",
          { class: "z-skeleton-pattern__body" },
          bone("text", "title", [55, 75]),
          ...Array.from({ length: lines }, (_, i) => bone("text", "line", i === lines - 1 ? [45, 65] : [85, 100])),
        ),
        o.actions === false ? null : h("div", { class: "z-skeleton-pattern__foot" }, bone("rounded", "button")),
      );
    }
    case "list": {
      const rows = count(o.rows, 4);
      return root(
        "list",
        {},
        ...Array.from({ length: rows }, (_, i) =>
          h(
            "div",
            { class: "z-skeleton-pattern__row", key: String(i) },
            o.avatar === false ? null : bone("circular", "avatar"),
            h("div", { class: "z-skeleton-pattern__lines" }, bone("text", "line", [45, 75]), bone("text", "line", [25, 50])),
            o.meta === false ? null : bone("text", "meta"),
          ),
        ),
      );
    }
    case "table": {
      const rows = count(o.rows, 5);
      const columns = count(o.columns, 4, 12);
      const row = (kind: "head" | "row", i: number) =>
        h(
          "div",
          { class: `z-skeleton-pattern__${kind}`, key: `${kind}${i}` },
          ...Array.from({ length: columns }, () =>
            h("div", { class: "z-skeleton-pattern__cell" }, bone("text", "line", kind === "head" ? [35, 55] : [40, 90])),
          ),
        );
      return root(
        "table",
        { "data-columns": String(columns) },
        o.header === false ? null : row("head", 0),
        ...Array.from({ length: rows }, (_, i) => row("row", i)),
      );
    }
    case "profile":
      return root(
        "profile",
        {},
        o.cover === false ? null : bone("rounded", "cover"),
        h(
          "div",
          { class: "z-skeleton-pattern__identity" },
          bone("circular", "avatar"),
          h("div", { class: "z-skeleton-pattern__lines" }, bone("text", "name", [35, 55]), bone("text", "line", [20, 35])),
        ),
        h(
          "div",
          { class: "z-skeleton-pattern__stats" },
          ...Array.from({ length: 3 }, (_, i) =>
            h(
              "div",
              { class: "z-skeleton-pattern__stat", key: String(i) },
              bone("text", "value", [45, 70]),
              bone("text", "line", [60, 90]),
            ),
          ),
        ),
      );
    case "chat": {
      const messages = count(o.messages, 5, 16);
      return root(
        "chat",
        {},
        ...Array.from({ length: messages }, (_, i) => {
          const own = i % 3 === 2 || i % 4 === 1;
          return h(
            "div",
            { class: "z-skeleton-pattern__message", "data-side": own ? "end" : "start", key: String(i) },
            own ? null : bone("circular", "avatar"),
            bone("rounded", "bubble", [own ? 30 : 40, own ? 55 : 70]),
          );
        }),
      );
    }
    case "chart": {
      const type = o.type === "line" || o.type === "donut" ? o.type : "bar";
      const plot =
        type === "bar"
          ? h("div", { class: "z-skeleton-pattern__plot" }, ...Array.from({ length: 8 }, () => height("bar", 30, 95)))
          : type === "line"
            ? h(
                "div",
                { class: "z-skeleton-pattern__plot" },
                h(
                  "svg",
                  { class: "z-skeleton-pattern__curve", viewBox: "0 0 100 40", preserveAspectRatio: "none", focusable: "false" },
                  h("path", { d: "M0 30 C 12 26, 18 12, 30 16 S 48 30, 60 20 S 80 6, 100 10" }),
                ),
              )
            : h("div", { class: "z-skeleton-pattern__plot" }, bone("circular", "donut"));
      return root(
        "chart",
        { "data-type": type },
        plot,
        h(
          "div",
          { class: "z-skeleton-pattern__legend" },
          ...Array.from({ length: 3 }, (_, i) =>
            h("span", { class: "z-skeleton-pattern__key", key: String(i) }, bone("circular", "dot"), bone("text", "line", "4rem")),
          ),
        ),
      );
    }
    case "article": {
      const paragraphs = count(o.paragraphs, 3, 12);
      return root(
        "article",
        {},
        h("div", { class: "z-skeleton-pattern__heading" }, bone("text", "headline", [80, 95]), bone("text", "headline", [40, 60])),
        h("div", { class: "z-skeleton-pattern__byline" }, bone("circular", "avatar"), bone("text", "line", [20, 30])),
        o.image === false ? null : bone("rounded", "image"),
        ...Array.from({ length: paragraphs }, (_, p) =>
          h(
            "div",
            { class: "z-skeleton-pattern__paragraph", key: String(p) },
            ...Array.from({ length: 4 }, (_, i) => bone("text", "line", i === 3 ? [35, 70] : [92, 100])),
          ),
        ),
      );
    }
    case "calendar":
      return root(
        "calendar",
        {},
        h("div", { class: "z-skeleton-pattern__header" }, bone("text", "title", "8rem"), bone("rounded", "nav"), bone("rounded", "nav")),
        h(
          "div",
          { class: "z-skeleton-pattern__grid" },
          ...Array.from({ length: 7 }, () => bone("text", "weekday")),
          ...Array.from({ length: 42 }, () => bone("rounded", "day")),
        ),
      );
  }
}

/** Opciones de un patrón leídas de atributos `data-*` (modo DOM). */
export function patternOptions(data: DOMStringMap): SkeletonPatternOptions {
  const num = (v: string | undefined) => (v === undefined || v === "" ? undefined : Number(v));
  const flag = (v: string | undefined) => (v === undefined ? undefined : v !== "false");
  const type = data.type;
  return {
    animation: isAnimation(data.animation) ? data.animation : undefined,
    seed: num(data.seed),
    media: flag(data.media),
    lines: num(data.lines),
    actions: flag(data.actions),
    rows: num(data.rows),
    avatar: flag(data.avatar),
    meta: flag(data.meta),
    columns: num(data.columns),
    header: flag(data.header),
    cover: flag(data.cover),
    messages: num(data.messages),
    type: type === "bar" || type === "line" || type === "donut" ? type : undefined,
    paragraphs: num(data.paragraphs),
    image: flag(data.image),
  };
}
