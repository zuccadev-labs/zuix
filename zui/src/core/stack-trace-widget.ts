// StackTrace (core/widget): traza de un error. Cabecera con el tipo y el mensaje, copiar (la traza en el formato de
// V8) y plegar; los marcos de la aplicación a la vista y los de terceros seguidos plegados en «N library frames». Con
// `selectable` cada marco es un botón que avisa (`frame-select`) para abrirlo en el editor. El texto del error entra
// siempre como texto.
import { announce } from "./announcer";
import { announceText, copyText } from "./clipboard";
import { fill, h, icon, on, type VNode } from "./vnode";
import { frameLocation, groupFrames, parseStack, stackText, type ParsedError, type StackFrame } from "./stack-trace";
import { list, yes, type Widget } from "./widget";

export interface StackTraceLabels {
  /** Nombre de la pieza. */
  trace: string;
  copy: string;
  copied: string;
  copyFailed: string;
  expand: string;
  collapse: string;
  /** «{count} library frames». */
  library: string;
  /** «{count} library frame». */
  libraryOne: string;
  anonymous: string;
  frames: string;
}

export const STACK_TRACE_LABELS: StackTraceLabels = {
  trace: "Stack trace",
  copy: "Copy stack trace",
  copied: "Stack trace copied",
  copyFailed: "Couldn't copy",
  expand: "Show frames",
  collapse: "Hide frames",
  library: "{count} library frames",
  libraryOne: "{count} library frame",
  anonymous: "<anonymous>",
  frames: "Frames",
};

export interface StackTraceProps {
  /** La traza (`error.stack`) o el propio error. */
  error?: string | { name?: string; message?: string; stack?: string };
  /** Marcos a la vista al empezar (true). */
  defaultOpen?: boolean;
  /** Grupos de terceros abiertos al empezar. */
  showLibrary?: boolean;
  /** Lo que marca un marco como de terceros (por defecto node_modules, node:, extensiones…). */
  libraryPatterns?: readonly string[];
  /** Cada marco es un botón (`onFrameSelect`). */
  selectable?: boolean;
  labels?: Partial<StackTraceLabels>;
}

interface Config {
  parsed: ParsedError;
  defaultOpen: boolean;
  showLibrary: boolean;
  selectable: boolean;
  labels: StackTraceLabels;
}

interface State {
  open: boolean;
  /** Primer índice de cada grupo de terceros abierto. */
  expanded: readonly number[];
}

function frameNode(f: StackFrame, index: number, c: Config): VNode {
  const name = h("span", { class: "z-stack-trace__fn" }, f.fn || c.labels.anonymous);
  const where = h("span", { class: "z-stack-trace__file", title: frameLocation(f) }, frameLocation(f, true));
  return h(
    "li",
    { class: "z-stack-trace__frame", key: `f${index}`, "data-app": on(f.app), "data-index": index },
    c.selectable
      ? h("button", { type: "button", class: "z-stack-trace__open", "data-index": index }, name, where)
      : h("span", { class: "z-stack-trace__line" }, name, where),
  );
}

export const stackTraceWidget: Widget<StackTraceProps, Config, State> = {
  root: "z-stack-trace",
  configure: (p) => ({
    parsed: parseStack(p.error ?? "", p.libraryPatterns),
    defaultOpen: p.defaultOpen !== false,
    showLibrary: Boolean(p.showLibrary),
    selectable: Boolean(p.selectable),
    labels: { ...STACK_TRACE_LABELS, ...p.labels },
  }),
  initial: (c) => ({
    open: c.defaultOpen,
    expanded: c.showLibrary ? groupFrames(c.parsed.frames).flatMap((g) => (g.kind === "library" ? [g.start] : [])) : [],
  }),
  tree(c, s, uid) {
    const { parsed, labels } = c;
    const groups = groupFrames(parsed.frames);
    const framesId = `${uid}-frames`;
    const rows: VNode[] = [];
    for (const g of groups) {
      if (g.kind === "app") {
        rows.push(frameNode(g.frame, g.index, c));
        continue;
      }
      const open = s.expanded.includes(g.start);
      const groupId = `${uid}-lib-${g.start}`;
      rows.push(
        h(
          "li",
          { class: "z-stack-trace__group", key: `g${g.start}`, "data-open": on(open) },
          h(
            "button",
            { type: "button", class: "z-stack-trace__toggle-group", "aria-expanded": String(open), "aria-controls": groupId, "data-start": g.start },
            h("span", { class: "z-stack-trace__chevron", "aria-hidden": "true" }, icon("chevron-right", 12)),
            fill(g.frames.length === 1 ? labels.libraryOne : labels.library, { count: g.frames.length }),
          ),
          h(
            "ol",
            { class: "z-stack-trace__library", id: groupId, hidden: !open || undefined },
            ...g.frames.map((f, i) => frameNode(f, g.start + i, c)),
          ),
        ),
      );
    }
    return h(
      "div",
      { class: "z-stack-trace", role: "group", "aria-label": labels.trace, "data-open": on(s.open) },
      h(
        "div",
        { class: "z-stack-trace__head", key: "head" },
        h("span", { class: "z-stack-trace__icon", "aria-hidden": "true" }, icon("exclamation-triangle", 16)),
        h(
          "p",
          { class: "z-stack-trace__title" },
          parsed.name ? h("span", { class: "z-stack-trace__name" }, parsed.name) : null,
          parsed.message ? h("span", { class: "z-stack-trace__message" }, parsed.message) : null,
        ),
        h(
          "button",
          { type: "button", class: "z-btn z-btn--ghost z-btn--icon z-stack-trace__copy", "data-size": "sm", "aria-label": labels.copy, title: labels.copy },
          icon("copy", 16),
        ),
        parsed.frames.length
          ? h(
              "button",
              {
                type: "button",
                class: "z-btn z-btn--ghost z-btn--icon z-stack-trace__toggle",
                "data-size": "sm",
                "aria-label": s.open ? labels.collapse : labels.expand,
                title: s.open ? labels.collapse : labels.expand,
                "aria-expanded": String(s.open),
                "aria-controls": framesId,
              },
              h("span", { class: "z-stack-trace__chevron", "aria-hidden": "true" }, icon("chevron-down", 16)),
            )
          : null,
      ),
      parsed.frames.length
        ? h("ol", { class: "z-stack-trace__frames", id: framesId, key: "frames", "aria-label": labels.frames, hidden: !s.open || undefined }, ...rows)
        : null,
    );
  },
  attach(root, host) {
    const onClick = (event: MouseEvent) => {
      const button = (event.target as Element).closest?.<HTMLButtonElement>("button");
      if (!button || !root.contains(button)) return;
      const c = host.config();
      const s = host.state();
      if (button.classList.contains("z-stack-trace__toggle")) {
        host.update({ open: !s.open });
        host.emit("toggle", { open: !s.open });
      } else if (button.classList.contains("z-stack-trace__toggle-group")) {
        const start = Number(button.dataset.start);
        host.update({ expanded: s.expanded.includes(start) ? s.expanded.filter((x) => x !== start) : [...s.expanded, start] });
      } else if (button.classList.contains("z-stack-trace__copy")) {
        void copyText(stackText(c.parsed)).then((done) => {
          announce(announceText(done ? c.labels.copied : c.labels.copyFailed), { source: root });
          host.emit("copy", { ok: done });
        });
      } else if (button.classList.contains("z-stack-trace__open")) {
        const frame = c.parsed.frames[Number(button.dataset.index)];
        if (frame) host.emit("frame-select", { frame, index: Number(button.dataset.index) });
      }
    };
    root.addEventListener("click", onClick);
    return () => root.removeEventListener("click", onClick);
  },
  after() {},
  fromDom(el, json) {
    const d = el.dataset;
    const script = json.error ?? json.stack;
    return {
      error: typeof script === "string" || (script && typeof script === "object") ? (script as StackTraceProps["error"]) : undefined,
      defaultOpen: d.open === "false" ? false : undefined,
      showLibrary: yes(d.showLibrary),
      libraryPatterns: d.libraryPatterns ? list(d.libraryPatterns) : undefined,
      selectable: yes(d.selectable),
      labels: json.labels as Partial<StackTraceLabels> | undefined,
    };
  },
};
