// Piezas de IA como core/widget: mensaje de asistente con partes ordenadas (texto en streaming con Markdown propio y
// cursor, razonamiento plegable, llamadas a herramientas, aprobaciones, fuentes y artefactos), acciones (copiar,
// regenerar, valorar) y ramas; y sueltas: Reasoning, ToolCall, ApprovalCard, AgentPlan, Sources, Suggestions,
// AgentStatus, UsageMeter, Artifact y BranchPicker. El texto del modelo nunca entra como marcado (core/markdown-lite) y
// el código se pinta con el CodeViewer de la suite. Mientras llega no se anuncia nada; al terminar, una vez, por el
// anunciador central. Una herramienta solo se anuncia cuando espera aprobación o falla.
import { localize } from "./locale";

import {
  AGENT_ANNOUNCE_LABELS,
  durationText,
  isBusy,
  planProgress,
  responseAnnouncement,
  toolAnnouncement,
  type AgentAnnounceLabels,
  type PlanStep,
  type ResponseState,
  type StepStatus,
  type ToolStatus,
} from "./agent-state";
import { announce } from "./announcer";
import { avatarNode } from "./chat-tree";
import { copyText } from "./clipboard";
import { tokenize } from "./code-tokens";
import { codeViewerWidget } from "./code-viewer-widget";
import { domainOf, safeHref } from "./linkify";
import { markdownText, markdownTree } from "./markdown-lite";
import { toInstant } from "./relative";
import { firstSentence, provisional } from "./stream-text";
import { copyFromButton, tokenNodes, type CopyState } from "./terminal-shared";
import { compactTokens, formatCost, percentText, usageLevel, usageRatio } from "./usage";
import { fill, h, icon, on, type VEl, type VNode } from "./vnode";
import { num, yes, type Widget, type WidgetHost } from "./widget";

// ---- Tipos de las partes ----

export interface Source {
  id?: string;
  title: string;
  url: string;
  snippet?: string;
}

export type AssistantPart =
  | { type: "text"; text: string }
  | { type: "reasoning"; text?: string; state?: "thinking" | "done"; startedAt?: number | string; endedAt?: number | string }
  | {
      type: "tool";
      id: string;
      name: string;
      title?: string;
      status: ToolStatus;
      input?: unknown;
      output?: unknown;
      error?: string;
      startedAt?: number | string;
      endedAt?: number | string;
    }
  | {
      type: "approval";
      id: string;
      title: string;
      description?: string;
      details?: readonly { label: string; value: string }[];
      risk?: "low" | "medium" | "high";
      decision?: "approved" | "rejected";
    }
  | { type: "sources"; items: readonly Source[] }
  | { type: "artifact"; id: string; title: string; kind?: string; description?: string };

export interface AiLabels extends AgentAnnounceLabels {
  assistant: string;
  thinking: string;
  /** «Thought for {time}». */
  thought: string;
  reasoning: string;
  copy: string;
  copied: string;
  copyFailed: string;
  regenerate: string;
  good: string;
  bad: string;
  actions: string;
  retry: string;
  stoppedNote: string;
  errorNote: string;
  /** «{n} sources». */
  sources: string;
  /** «Source {n}: {title}». */
  source: string;
  input: string;
  output: string;
  /** Estados de herramienta en texto. */
  pending: string;
  "input-streaming": string;
  running: string;
  "awaiting-approval": string;
  success: string;
  error: string;
  cancelled: string;
  approve: string;
  reject: string;
  confirmApprove: string;
  cancel: string;
  allowAlways: string;
  approved: string;
  rejected: string;
  /** «Risk: {level}». */
  risk: string;
  low: string;
  medium: string;
  high: string;
  /** «Approval needed». */
  approval: string;
  openArtifact: string;
  /** «Version {index} of {count}». */
  branch: string;
  previous: string;
  next: string;
  code: string;
}

export const AI_LABELS: AiLabels = {
  ...AGENT_ANNOUNCE_LABELS,
  assistant: "Assistant",
  thinking: "Thinking…",
  thought: "Thought for {time}",
  reasoning: "Reasoning",
  copy: "Copy",
  copied: "Copied",
  copyFailed: "Copy failed",
  regenerate: "Regenerate",
  good: "Good response",
  bad: "Bad response",
  actions: "Response actions",
  retry: "Retry",
  stoppedNote: "Stopped",
  errorNote: "Something went wrong.",
  sources: "{n} sources",
  source: "Source {n}: {title}",
  input: "Input",
  output: "Output",
  pending: "Pending",
  "input-streaming": "Preparing",
  running: "Running",
  "awaiting-approval": "Awaiting approval",
  success: "Done",
  error: "Error",
  cancelled: "Cancelled",
  approve: "Approve",
  reject: "Reject",
  confirmApprove: "Confirm approval",
  cancel: "Cancel",
  allowAlways: "Always allow in this session",
  approved: "Approved",
  rejected: "Rejected",
  risk: "Risk: {level}",
  low: "Low",
  medium: "Medium",
  high: "High",
  approval: "Approval needed",
  openArtifact: "Open",
  branch: "Version {index} of {count}",
  previous: "Previous version",
  next: "Next version",
  code: "Code",
};

const TOOL_ICON: Record<ToolStatus, string> = {
  pending: "clock",
  "input-streaming": "clock",
  running: "arrow-path",
  "awaiting-approval": "hand",
  success: "check-circle",
  error: "exclamation-circle",
  cancelled: "no-circle",
};

const json = (v: unknown) => (typeof v === "string" ? v : (JSON.stringify(v, null, 2) ?? ""));
const ms = (a?: number | string, b?: number | string) => {
  const x = toInstant(a ?? null);
  const y = toInstant(b ?? null);
  return x !== null && y !== null ? Math.max(0, y - x) : null;
};

/** Valor de entrada o salida de una herramienta como código (JSON con el tokenizador propio). */
function codeBlock(value: unknown, label: string, key: string): VEl {
  const text = json(value);
  return h(
    "div",
    { class: "z-tool-call__section", key },
    h("span", { class: "z-tool-call__label" }, label),
    h(
      "pre",
      { class: "z-tool-call__code", tabindex: 0, "aria-label": label },
      h("code", null, ...tokenNodes(tokenize(text, typeof value === "string" ? undefined : "json"))),
    ),
  );
}

// ---- Árboles ----

export interface ToolCallInput {
  id?: string;
  name: string;
  title?: string;
  status: ToolStatus;
  input?: unknown;
  output?: unknown;
  error?: string;
  startedAt?: number | string;
  endedAt?: number | string;
}

/** Tarjeta de herramienta: icono, nombre, estado en texto (además del icono y el color), duración y entrada/salida plegables. */
export function toolCallNode(
  t: ToolCallInput,
  labels: AiLabels,
  o: { key?: string; open?: boolean; locale?: string; approval?: boolean } = {},
): VEl {
  const duration = ms(t.startedAt, t.endedAt);
  const has = t.input !== undefined || t.output !== undefined || t.error;
  return h(
    "section",
    {
      class: "z-tool-call",
      key: o.key,
      "data-status": t.status,
      "data-id": t.id,
      "aria-label": `${t.title ?? t.name}, ${labels[t.status]}`,
    },
    h(
      "details",
      { class: "z-tool-call__details", open: o.open || t.status === "awaiting-approval" || t.status === "error" ? true : undefined },
      h(
        "summary",
        { class: "z-tool-call__summary" },
        h("span", { class: "z-tool-call__icon", "aria-hidden": "true" }, icon("wrench", 16)),
        h("span", { class: "z-tool-call__name" }, t.title ?? t.name),
        t.title ? h("code", { class: "z-tool-call__id" }, t.name) : null,
        h(
          "span",
          { class: "z-tool-call__status", "data-status": t.status },
          h("span", { class: "z-tool-call__status-icon", "aria-hidden": "true" }, icon(TOOL_ICON[t.status], 14)),
          labels[t.status],
        ),
        duration !== null ? h("span", { class: "z-tool-call__time" }, durationText(duration, o.locale)) : null,
        has ? h("span", { class: "z-tool-call__chevron", "aria-hidden": "true" }, icon("chevron-down", 14)) : null,
      ),
      has
        ? h(
            "div",
            { class: "z-tool-call__body" },
            t.input !== undefined ? codeBlock(t.input, labels.input, "in") : null,
            t.output !== undefined ? codeBlock(t.output, labels.output, "out") : null,
            t.error ? h("p", { class: "z-tool-call__error", key: "err" }, icon("exclamation-triangle", 14), t.error) : null,
          )
        : null,
    ),
    t.status === "awaiting-approval" && o.approval !== false
      ? h(
          "div",
          { class: "z-tool-call__approval" },
          h("button", { type: "button", class: "z-btn z-btn--secondary z-tool-call__reject", "data-size": "sm" }, labels.reject),
          h("button", { type: "button", class: "z-btn z-btn--primary z-tool-call__approve", "data-size": "sm" }, labels.approve),
        )
      : null,
  );
}

export interface ReasoningInput {
  text?: string;
  state?: "thinking" | "done";
  startedAt?: number | string;
  endedAt?: number | string;
}

/** Razonamiento plegable: «Thinking…» con brillo (decorativo) mientras dura y «Thought for 12 s» al terminar. */
export function reasoningNode(
  r: ReasoningInput,
  labels: AiLabels,
  o: { open?: boolean; key?: string; locale?: string; id?: string } = {},
): VEl {
  const thinking = r.state !== "done";
  const duration = ms(r.startedAt, r.endedAt);
  return h(
    "details",
    { class: "z-reasoning", key: o.key, id: o.id, "data-state": thinking ? "thinking" : "done", open: o.open ? true : undefined },
    h(
      "summary",
      { class: "z-reasoning__summary" },
      h("span", { class: "z-reasoning__icon", "aria-hidden": "true" }, icon("light-bulb", 16)),
      thinking
        ? h("span", { class: "z-texteffect z-reasoning__label", "data-effect": "shimmer", "data-animated": "" }, labels.thinking)
        : h(
            "span",
            { class: "z-reasoning__label" },
            duration !== null ? fill(labels.thought, { time: durationText(duration, o.locale) }) : labels.reasoning,
          ),
      h("span", { class: "z-reasoning__chevron", "aria-hidden": "true" }, icon("chevron-down", 14)),
    ),
    r.text ? h("div", { class: "z-reasoning__body" }, markdownTree(r.text)) : null,
  );
}

export interface ApprovalInput {
  id?: string;
  title: string;
  description?: string;
  details?: readonly { label: string; value: string }[];
  risk?: "low" | "medium" | "high";
  decision?: "approved" | "rejected";
  allowAlways?: boolean;
}

/** Petición de permiso: qué hará, con qué argumentos, riesgo; Rechazar y Aprobar (riesgo alto: Aprobar pide confirmar). */
export function approvalNode(
  a: ApprovalInput,
  labels: AiLabels,
  o: { key?: string; uid: string; confirming?: boolean; always?: boolean },
): VEl {
  const risk = a.risk ?? "medium";
  const titleId = `${o.uid}-approval-${a.id ?? "x"}`;
  return h(
    "section",
    {
      class: "z-approval",
      key: o.key,
      "data-risk": risk,
      "data-id": a.id,
      "data-decision": a.decision,
      role: "region",
      "aria-labelledby": titleId,
    },
    h(
      "header",
      { class: "z-approval__header" },
      h("span", { class: "z-approval__icon", "aria-hidden": "true" }, icon(risk === "high" ? "shield-exclamation" : "shield-check", 18)),
      h(
        "span",
        { class: "z-approval__heading" },
        h("span", { class: "z-approval__eyebrow" }, labels.approval),
        h("h4", { class: "z-approval__title", id: titleId }, a.title),
      ),
      h("span", { class: "z-approval__risk", "data-risk": risk }, fill(labels.risk, { level: labels[risk] })),
    ),
    a.description ? h("p", { class: "z-approval__description" }, a.description) : null,
    a.details?.length
      ? h(
          "dl",
          { class: "z-approval__details" },
          ...a.details.flatMap((d, i) => [h("dt", { key: `t${i}` }, d.label), h("dd", { key: `d${i}` }, h("code", null, d.value))]),
        )
      : null,
    a.decision
      ? h(
          "p",
          { class: "z-approval__decision", "data-decision": a.decision },
          icon(a.decision === "approved" ? "check-circle" : "x-circle", 16),
          a.decision === "approved" ? labels.approved : labels.rejected,
        )
      : h(
          "div",
          { class: "z-approval__actions" },
          a.allowAlways
            ? h(
                "label",
                { class: "z-approval__always" },
                h("input", { type: "checkbox", class: "z-approval__always-input", checked: o.always }),
                h("span", null, labels.allowAlways),
              )
            : null,
          o.confirming
            ? h("button", { type: "button", class: "z-btn z-btn--secondary z-approval__cancel", "data-size": "sm" }, labels.cancel)
            : h("button", { type: "button", class: "z-btn z-btn--secondary z-approval__reject", "data-size": "sm" }, labels.reject),
          h(
            "button",
            {
              type: "button",
              class: `z-btn ${risk === "high" && o.confirming ? "z-btn--danger" : "z-btn--primary"} z-approval__approve`,
              "data-size": "sm",
              "data-confirming": on(o.confirming),
            },
            o.confirming ? labels.confirmApprove : labels.approve,
          ),
        ),
  );
}

/** Lista de fuentes plegable: icono genérico, título y dominio; numeradas como sus citas. */
export function sourcesNode(items: readonly Source[], labels: AiLabels, o: { key?: string; open?: boolean } = {}): VEl | null {
  const safe = items.map((s) => ({ ...s, href: safeHref(s.url) })).filter((s) => s.href);
  if (!safe.length) return null;
  return h(
    "aside",
    { class: "z-sources", key: o.key, "aria-label": fill(labels.sources, { n: safe.length }) },
    h(
      "details",
      { class: "z-sources__details", open: o.open ? true : undefined },
      h(
        "summary",
        { class: "z-sources__summary" },
        h(
          "span",
          { class: "z-sources__icons", "aria-hidden": "true" },
          ...safe
            .slice(0, 3)
            .map((s, i) => h("span", { class: "z-sources__favicon", key: String(i) }, (domainOf(s.href!)[0] ?? "").toUpperCase())),
        ),
        fill(labels.sources, { n: safe.length }),
        h("span", { class: "z-sources__chevron", "aria-hidden": "true" }, icon("chevron-down", 14)),
      ),
      h(
        "ol",
        { class: "z-sources__list" },
        ...safe.map((s, i) =>
          h(
            "li",
            { key: s.id ?? String(i), class: "z-sources__item" },
            h(
              "a",
              { class: "z-sources__link", href: s.href!, target: "_blank", rel: "noopener noreferrer nofollow" },
              h("span", { class: "z-sources__index", "aria-hidden": "true" }, String(i + 1)),
              h("span", { class: "z-sr-only" }, `${fill(labels.source, { n: i + 1, title: "" }).replace(/:\s*$/, "")}: `),
              h(
                "span",
                { class: "z-sources__text" },
                h("span", { class: "z-sources__title" }, s.title),
                h("span", { class: "z-sources__domain" }, domainOf(s.href!)),
              ),
            ),
            s.snippet ? h("p", { class: "z-sources__snippet" }, s.snippet) : null,
          ),
        ),
      ),
    ),
  );
}

/** Cita en línea `[n]`: enlace con nombre «Source n: título» y una tarjeta que aparece con el puntero o el foco. */
export function citationNode(n: number, source: Source | undefined, labels: AiLabels, key?: string): VNode {
  const href = source ? safeHref(source.url) : null;
  if (!source || !href) return h("sup", { key, class: "z-markdown__cite" }, `[${n}]`);
  return h(
    "a",
    {
      key,
      class: "z-citation",
      href,
      target: "_blank",
      rel: "noopener noreferrer nofollow",
      "aria-label": fill(labels.source, { n, title: source.title }),
      "data-source": n,
    },
    h("span", { class: "z-citation__index", "aria-hidden": "true" }, String(n)),
    h(
      "span",
      { class: "z-citation__card", "aria-hidden": "true" },
      h("span", { class: "z-citation__title" }, source.title),
      h("span", { class: "z-citation__domain" }, domainOf(href)),
    ),
  );
}

/** Selector de ramas «‹ 2 / 3 ›». */
export function branchNode(index: number, count: number, labels: AiLabels, key?: string): VEl | null {
  if (count < 2) return null;
  return h(
    "span",
    { class: "z-branch-picker", key, role: "group", "aria-label": fill(labels.branch, { index, count }) },
    h(
      "button",
      {
        type: "button",
        class: "z-branch-picker__button",
        "data-step": -1,
        "aria-label": labels.previous,
        title: labels.previous,
        disabled: index <= 1,
      },
      icon("chevron-left", 14),
    ),
    h("span", { class: "z-branch-picker__value", "aria-hidden": "true" }, `${index} / ${count}`),
    h(
      "button",
      {
        type: "button",
        class: "z-branch-picker__button",
        "data-step": 1,
        "aria-label": labels.next,
        title: labels.next,
        disabled: index >= count,
      },
      icon("chevron-right", 14),
    ),
  );
}

/** Añade el cursor de escritura al final del último bloque de texto del árbol. */
function withCaret(tree: VEl): VEl {
  const caret = h("span", { class: "z-caret", "aria-hidden": "true", key: "caret" });
  const last = (el: VEl): VEl => {
    const kids = el.c ?? [];
    for (let i = kids.length - 1; i >= 0; i--) {
      const k = kids[i];
      if (k && typeof k === "object" && !("slot" in k)) {
        if (k.t === "div" && String(k.a?.class ?? "").includes("z-code-viewer")) return el;
        if (/^(p|li|h\d|blockquote|ul|ol|div)$/.test(k.t)) return last(k);
        return el;
      }
      if (typeof k === "string") return el;
    }
    return el;
  };
  const target = last(tree);
  target.c = [...(target.c ?? []), caret];
  return tree;
}

// ---- AssistantMessage ----

export interface AssistantMessageProps {
  parts?: readonly AssistantPart[];
  state?: ResponseState;
  author?: { name: string; avatar?: string };
  /** Barra de acciones al terminar (copiar, regenerar, valorar). */
  actions?: boolean;
  feedback?: "up" | "down" | null;
  branch?: { index: number; count: number };
  /** Qué se anuncia al terminar: «Response complete» (por defecto), esa frase y la primera de la respuesta, o nada. */
  announce?: "done" | "summary" | "none";
  locale?: string;
  labels?: Partial<AiLabels>;
}

interface AssistantConfig {
  parts: readonly AssistantPart[];
  state: ResponseState;
  author: { name: string; avatar?: string };
  actions: boolean;
  feedback?: "up" | "down" | null;
  branch?: { index: number; count: number };
  announce: "done" | "summary" | "none";
  locale?: string;
  labels: AiLabels;
}

interface AssistantState {
  copied: Readonly<Record<string, CopyState>>;
  open: Readonly<Record<string, boolean>>;
  confirming: Readonly<Record<string, boolean>>;
  always: Readonly<Record<string, boolean>>;
  feedback: "up" | "down" | null;
}

type AssistantHost = WidgetHost<AssistantConfig, AssistantState>;

const sourcesOf = (parts: readonly AssistantPart[]) => parts.flatMap((p) => (p.type === "sources" ? p.items : []));
const textOf = (parts: readonly AssistantPart[]) =>
  parts
    .filter((p): p is Extract<AssistantPart, { type: "text" }> => p.type === "text")
    .map((p) => p.text)
    .join("\n\n");

/** Texto de un Markdown como árbol, con los bloques de código en el CodeViewer de la suite y las citas enlazadas. */
export function richText(
  text: string,
  o: { uid: string; labels: AiLabels; sources?: readonly Source[]; copied?: Readonly<Record<string, CopyState>>; streaming?: boolean },
): VEl {
  const tree = markdownTree(o.streaming ? provisional(text) : text, {
    code: (code, lang, key) => {
      const config = codeViewerWidget.configure({ code, language: lang || undefined, title: "", lineNumbers: false });
      const node = codeViewerWidget.tree(config, { file: 0, copied: o.copied?.[key] ?? "idle" }, `${o.uid}-${key}`);
      node.k = key;
      node.a = { ...node.a, "data-block": key };
      return node;
    },
    cite: (n, key) => citationNode(n, o.sources?.[n - 1], o.labels, key),
  });
  return o.streaming ? withCaret(tree) : tree;
}

function assistantTree(c: AssistantConfig, s: AssistantState, uid: string): VEl {
  const { labels } = c;
  const busy = isBusy(c.state);
  const sources = sourcesOf(c.parts);
  const lastText = c.parts.reduce((acc, p, i) => (p.type === "text" ? i : acc), -1);
  const body: VNode[] = c.parts.map((p, i) => {
    const key = `p${i}`;
    switch (p.type) {
      case "text":
        return h(
          "div",
          { class: "z-assistant-message__text", key, dir: "auto" },
          richText(p.text, {
            uid: `${uid}-${key}`,
            labels,
            sources,
            copied: s.copied,
            streaming: c.state === "streaming" && i === lastText,
          }),
        );
      case "reasoning":
        return reasoningNode(p, labels, { key, open: s.open[key] ?? p.state !== "done", locale: c.locale });
      case "tool":
        // Con una petición de aprobación en la misma respuesta, se decide en ella y no dos veces.
        return toolCallNode(p, labels, {
          key,
          open: s.open[key],
          locale: c.locale,
          approval: !c.parts.some((x) => x.type === "approval" && !x.decision),
        });
      case "approval":
        return approvalNode(p, labels, { key, uid, confirming: s.confirming[p.id], always: s.always[p.id] });
      case "sources":
        return sourcesNode(p.items, labels, { key, open: s.open[key] });
      case "artifact":
        return h(
          "button",
          { type: "button", class: "z-artifact-card", key, "data-artifact": p.id },
          h("span", { class: "z-artifact-card__icon", "aria-hidden": "true" }, icon("code-bracket", 18)),
          h(
            "span",
            { class: "z-artifact-card__body" },
            h("span", { class: "z-artifact-card__title" }, p.title),
            p.kind || p.description
              ? h("span", { class: "z-artifact-card__meta" }, [p.kind, p.description].filter(Boolean).join(" · "))
              : null,
          ),
          h("span", { class: "z-artifact-card__open" }, labels.openArtifact),
        );
      default:
        return null;
    }
  });
  const waiting = c.state === "submitted" && !c.parts.some((p) => p.type !== "text" || p.text);
  return h(
    "article",
    {
      class: "z-assistant-message",
      role: "article",
      "data-state": c.state,
      "aria-busy": busy ? "true" : undefined,
      "aria-labelledby": `${uid}-author`,
    },
    h(
      "span",
      { class: "z-assistant-message__avatar", "aria-hidden": "true" },
      c.author.avatar
        ? avatarNode(c.author, { size: "sm", decorative: true })
        : h("span", { class: "z-assistant-message__mark" }, icon("sparkles", 16)),
    ),
    h(
      "div",
      { class: "z-assistant-message__content" },
      h("span", { class: "z-sr-only", id: `${uid}-author` }, c.author.name),
      waiting
        ? h(
            "span",
            { class: "z-assistant-message__waiting" },
            h("span", { class: "z-texteffect", "data-effect": "shimmer", "data-animated": "" }, labels.thinking),
          )
        : null,
      ...body,
      c.state === "stopped"
        ? h("p", { class: "z-assistant-message__note", "data-tone": "muted" }, icon("stop", 14), labels.stoppedNote)
        : null,
      c.state === "error"
        ? h(
            "p",
            { class: "z-assistant-message__note", "data-tone": "danger" },
            icon("exclamation-triangle", 14),
            labels.errorNote,
            h(
              "button",
              { type: "button", class: "z-btn z-btn--ghost z-assistant-message__retry", "data-size": "sm" },
              icon("arrow-path", 14),
              labels.retry,
            ),
          )
        : null,
      c.actions && !busy && c.state !== "error"
        ? h(
            "div",
            { class: "z-assistant-message__actions", role: "toolbar", "aria-label": labels.actions },
            h(
              "button",
              {
                type: "button",
                class: "z-assistant-message__action",
                "data-action": "copy",
                "aria-label": s.copied.message === "copied" ? labels.copied : labels.copy,
                title: labels.copy,
                tabindex: 0,
              },
              icon(s.copied.message === "copied" ? "check" : "copy", 16),
            ),
            h(
              "button",
              {
                type: "button",
                class: "z-assistant-message__action",
                "data-action": "regenerate",
                "aria-label": labels.regenerate,
                title: labels.regenerate,
                tabindex: -1,
              },
              icon("arrow-path", 16),
            ),
            h(
              "button",
              {
                type: "button",
                class: "z-assistant-message__action",
                "data-action": "good",
                "aria-label": labels.good,
                title: labels.good,
                "aria-pressed": s.feedback === "up" ? "true" : "false",
                tabindex: -1,
              },
              icon("hand-thumb-up", 16),
            ),
            h(
              "button",
              {
                type: "button",
                class: "z-assistant-message__action",
                "data-action": "bad",
                "aria-label": labels.bad,
                title: labels.bad,
                "aria-pressed": s.feedback === "down" ? "true" : "false",
                tabindex: -1,
              },
              icon("hand-thumb-down", 16),
            ),
            c.branch ? branchNode(c.branch.index, c.branch.count, labels, "branch") : null,
          )
        : null,
      h("span", { class: "z-sr-only", role: "status", "data-live": "" }),
    ),
  );
}

interface AssistantLive {
  state?: ResponseState;
  tools: Map<string, ToolStatus>;
}
const assistantLives = new WeakMap<HTMLElement, AssistantLive>();

/** Teclado de una barra de herramientas (una parada): ←/→, Inicio y Fin. */
function toolbarKeys(event: KeyboardEvent, bar: HTMLElement): void {
  const buttons = [...bar.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")];
  const i = buttons.indexOf(event.target as HTMLButtonElement);
  if (i < 0) return;
  const rtl = bar.closest("[dir=rtl]") !== null;
  const next =
    event.key === (rtl ? "ArrowLeft" : "ArrowRight")
      ? i + 1
      : event.key === (rtl ? "ArrowRight" : "ArrowLeft")
        ? i - 1
        : event.key === "Home"
          ? 0
          : event.key === "End"
            ? buttons.length - 1
            : null;
  if (next === null) return;
  event.preventDefault();
  const to = buttons[(next + buttons.length) % buttons.length]!;
  for (const b of buttons) b.tabIndex = b === to ? 0 : -1;
  to.focus();
}

/** Clics comunes de una pieza con aprobaciones y herramientas dentro (mensaje y tarjetas sueltas). */
function approvalClick(
  target: Element,
  host: AssistantHost | WidgetHost<{ labels: AiLabels; risk?: string; parts?: readonly AssistantPart[] }, AssistantState>,
): boolean {
  const card = target.closest<HTMLElement>(".z-approval");
  const tool = target.closest<HTMLElement>(".z-tool-call");
  if (tool && target.closest(".z-tool-call__approve")) {
    host.emit("approve", { id: tool.dataset.id });
    return true;
  }
  if (tool && target.closest(".z-tool-call__reject")) {
    host.emit("reject", { id: tool.dataset.id });
    return true;
  }
  if (!card) return false;
  const id = card.dataset.id ?? "";
  const s = host.state();
  if (target.closest(".z-approval__always-input")) {
    host.update({ always: { ...s.always, [id]: !s.always[id] } });
    return true;
  }
  if (target.closest(".z-approval__reject")) {
    host.emit("reject", { id });
    return true;
  }
  if (target.closest(".z-approval__cancel")) {
    host.update({ confirming: { ...s.confirming, [id]: false } });
    requestAnimationFrame(() => card.querySelector<HTMLElement>(".z-approval__approve")?.focus());
    return true;
  }
  if (target.closest(".z-approval__approve")) {
    const high = card.dataset.risk === "high";
    if (high && !s.confirming[id]) {
      host.update({ confirming: { ...s.confirming, [id]: true } });
      requestAnimationFrame(() => card.querySelector<HTMLElement>(".z-approval__approve")?.focus());
      return true;
    }
    host.update({ confirming: { ...s.confirming, [id]: false } });
    host.emit("approve", { id, always: Boolean(s.always[id]) });
    return true;
  }
  return false;
}

function attachAssistant(root: HTMLElement, host: AssistantHost): () => void {
  const live: AssistantLive = { state: undefined, tools: new Map() };
  assistantLives.set(root, live);
  const onClick = (event: MouseEvent) => {
    const target = event.target as Element | null;
    if (!target || !root.contains(target)) return;
    if (approvalClick(target, host)) return;
    const copyBtn = target.closest<HTMLButtonElement>(".z-code-viewer__copy");
    if (copyBtn) {
      const block = copyBtn.closest<HTMLElement>(".z-code-viewer");
      const key = block?.dataset.block ?? "";
      const text = (block?.querySelector(".z-code-viewer__code")?.textContent ?? "").replace(/\n$/, "");
      void copyFromButton(copyBtn, text, host.config().labels, (copied) =>
        host.update({ copied: { ...host.state().copied, [key]: copied } }),
      );
      return;
    }
    const action = target.closest<HTMLElement>(".z-assistant-message__action");
    if (action) {
      const name = action.dataset.action;
      const s = host.state();
      if (name === "copy") {
        const text = markdownText(textOf(host.config().parts));
        void copyText(text).then((ok) => {
          host.update({ copied: { ...host.state().copied, message: ok ? "copied" : "failed" } });
          announce(ok ? host.config().labels.copied : host.config().labels.copyFailed, { source: root });
          setTimeout(() => host.update({ copied: { ...host.state().copied, message: "idle" } }), 2000);
        });
        host.emit("copy", { text });
      } else if (name === "good" || name === "bad") {
        const value = name === "good" ? "up" : "down";
        const feedback = s.feedback === value ? null : value;
        host.update({ feedback });
        host.emit("feedback", { value: feedback });
      } else if (name === "regenerate") host.emit("regenerate", {});
      return;
    }
    const step = target.closest<HTMLElement>(".z-branch-picker__button");
    if (step) {
      const b = host.config().branch;
      if (b) host.emit("branch-change", { index: Math.max(1, Math.min(b.count, b.index + Number(step.dataset.step))) });
      return;
    }
    if (target.closest(".z-assistant-message__retry")) {
      host.emit("retry", {});
      return;
    }
    const artifact = target.closest<HTMLElement>(".z-artifact-card");
    if (artifact) host.emit("open-artifact", { id: artifact.dataset.artifact });
  };
  // Lo que la persona pliega o despliega (clic o Intro/Espacio en el summary) se respeta en los pintados siguientes;
  // lo que abre o cierra el propio árbol (el razonamiento al terminar) no cuenta como elección.
  const onSummary = (event: MouseEvent) => {
    const summary = (event.target as Element).closest?.("summary");
    const details = summary?.parentElement;
    if (!(details instanceof HTMLDetailsElement) || !root.contains(details)) return;
    requestAnimationFrame(() => {
      const part = partKey(root, details);
      if (part && host.state().open[part] !== details.open) host.update({ open: { ...host.state().open, [part]: details.open } });
    });
  };
  const onKey = (event: KeyboardEvent) => {
    const bar = (event.target as Element).closest?.<HTMLElement>(".z-assistant-message__actions");
    if (bar) toolbarKeys(event, bar);
  };
  root.addEventListener("click", onClick);
  root.addEventListener("click", onSummary);
  root.addEventListener("keydown", onKey);
  return () => {
    root.removeEventListener("click", onClick);
    root.removeEventListener("click", onSummary);
    root.removeEventListener("keydown", onKey);
    assistantLives.delete(root);
  };
}

/** Clave de la parte a la que pertenece un `details` (su posición entre los hijos del contenido). */
function partKey(root: HTMLElement, details: Element): string | null {
  const content = root.querySelector(".z-assistant-message__content");
  if (!content) return null;
  let node: Element | null = details;
  while (node && node.parentElement !== content) node = node.parentElement;
  if (!node) return null;
  const parts = [...content.children].filter(
    (el) => !el.matches(".z-sr-only, .z-assistant-message__waiting, .z-assistant-message__note, .z-assistant-message__actions"),
  );
  const i = parts.indexOf(node);
  return i < 0 ? null : `p${i}`;
}

function afterAssistant(root: HTMLElement, host: AssistantHost): void {
  const live = assistantLives.get(root);
  if (!live) return;
  const c = host.config();
  const s = host.state();
  // Razonamiento terminado: se pliega solo, salvo que la persona esté dentro (no se le quita el foco de debajo).
  c.parts.forEach((p, i) => {
    if (p.type !== "reasoning" || p.state !== "done") return;
    const key = `p${i}`;
    const el =
      root.querySelectorAll<HTMLDetailsElement>("details.z-reasoning")[c.parts.slice(0, i).filter((x) => x.type === "reasoning").length];
    if (s.open[key] === undefined && el?.open && !el.contains(root.ownerDocument.activeElement)) {
      el.open = false;
      queueMicrotask(() => host.update({ open: { ...host.state().open, [key]: false } }));
    }
  });
  const previous = live.state;
  live.state = c.state;
  if (previous !== undefined && previous !== c.state && c.announce !== "none") {
    const summary = c.announce === "summary" ? firstSentence(markdownText(textOf(c.parts))) : undefined;
    const text = responseAnnouncement(previous, c.state, c.labels, summary);
    if (text) announce(text, { source: root });
  }
  for (const p of c.parts) {
    if (p.type !== "tool") continue;
    const before = live.tools.get(p.id);
    live.tools.set(p.id, p.status);
    if (before === undefined && previous === undefined) continue;
    const text = toolAnnouncement(before, p.status, p.title ?? p.name, c.labels);
    if (text) announce(text, { source: root, politeness: p.status === "error" ? "assertive" : "polite" });
  }
}

export const assistantMessageWidget: Widget<AssistantMessageProps, AssistantConfig, AssistantState> = {
  root: "z-assistant-message",
  configure: (p) => ({
    parts: p.parts ?? [],
    state: p.state ?? "done",
    author: p.author ?? { name: p.labels?.assistant ?? localize("ai", AI_LABELS).assistant },
    actions: p.actions !== false,
    feedback: p.feedback,
    branch: p.branch,
    announce: p.announce === "summary" || p.announce === "none" ? p.announce : "done",
    locale: p.locale,
    labels: { ...localize("ai", AI_LABELS), ...p.labels },
  }),
  initial: (c) => ({ copied: {}, open: {}, confirming: {}, always: {}, feedback: c.feedback ?? null }),
  control: (c, s) => (c.feedback !== undefined && c.feedback !== s.feedback ? { ...s, feedback: c.feedback } : s),
  tree: assistantTree,
  attach: attachAssistant,
  after: afterAssistant,
  fromDom(el, data) {
    const d = el.dataset;
    const state = d.state as ResponseState | undefined;
    return {
      parts: data.parts as AssistantPart[] | undefined,
      state: state && ["submitted", "streaming", "done", "error", "stopped"].includes(state) ? state : undefined,
      author: data.author as AssistantMessageProps["author"],
      actions: d.actions === "false" ? false : undefined,
      branch: data.branch as AssistantMessageProps["branch"],
      announce: d.announce === "summary" || d.announce === "none" ? d.announce : undefined,
      locale: d.locale,
      labels: data.labels as Partial<AiLabels> | undefined,
    };
  },
};

// ---- Piezas sueltas ----

type Simple<P, C> = Widget<P, C, AssistantState>;
const emptyState = (): AssistantState => ({ copied: {}, open: {}, confirming: {}, always: {}, feedback: null });
const labelsOf = (p: { labels?: Partial<AiLabels> }) => ({ ...localize("ai", AI_LABELS), ...p.labels });

/** Pieza sin estado propio salvo plegados y confirmaciones: árbol, clics de aprobación y anuncios de estado. */
function simple<P extends { labels?: Partial<AiLabels> }, C extends { labels: AiLabels }>(
  root: string,
  configure: (p: P) => C,
  tree: (c: C, s: AssistantState, uid: string) => VEl,
  fromDom: (el: HTMLElement, json: Record<string, unknown>) => P,
  announceOf?: (prev: C | undefined, next: C) => { text: string; politeness?: "polite" | "assertive" } | null,
): Simple<P, C> {
  const last = new WeakMap<HTMLElement, C>();
  return {
    root,
    configure,
    initial: emptyState,
    tree,
    attach(el, host) {
      const onClick = (event: MouseEvent) => {
        const target = event.target as Element | null;
        if (!target || !el.contains(target)) return;
        if (approvalClick(target, host as never)) return;
        const pick = target.closest<HTMLElement>(".z-suggestion");
        if (pick) host.emit("select", { id: pick.dataset.id, text: pick.dataset.text ?? pick.textContent ?? "" });
      };
      el.addEventListener("click", onClick);
      return () => el.removeEventListener("click", onClick);
    },
    after(el, host) {
      if (!announceOf) return;
      const c = host.config();
      const prev = last.get(el);
      last.set(el, c);
      const said = announceOf(prev, c);
      if (said?.text) announce(said.text, { source: el, politeness: said.politeness });
    },
    fromDom,
  };
}

export interface ReasoningProps extends ReasoningInput {
  defaultOpen?: boolean;
  locale?: string;
  labels?: Partial<AiLabels>;
}
export const reasoningWidget = simple<ReasoningProps, ReasoningProps & { labels: AiLabels }>(
  "z-reasoning-block",
  (p) => ({ ...p, labels: labelsOf(p) }),
  (c) =>
    h("div", { class: "z-reasoning-block" }, reasoningNode(c, c.labels, { open: c.defaultOpen ?? c.state !== "done", locale: c.locale })),
  (el, j) => ({
    text: (j.text as string | undefined) ?? undefined,
    state: el.dataset.state === "done" ? "done" : "thinking",
    startedAt: el.dataset.startedAt,
    endedAt: el.dataset.endedAt,
    defaultOpen: el.dataset.open !== undefined ? yes(el.dataset.open) : undefined,
    locale: el.dataset.locale,
    labels: j.labels as Partial<AiLabels>,
  }),
);

export interface ToolCallProps extends ToolCallInput {
  defaultOpen?: boolean;
  locale?: string;
  labels?: Partial<AiLabels>;
}
export const toolCallWidget = simple<ToolCallProps, ToolCallProps & { labels: AiLabels }>(
  "z-tool-call-block",
  (p) => ({ ...p, labels: labelsOf(p) }),
  (c) => h("div", { class: "z-tool-call-block" }, toolCallNode(c, c.labels, { open: c.defaultOpen, locale: c.locale })),
  (el, j) => ({
    id: el.dataset.id,
    name: el.dataset.name ?? "",
    title: el.dataset.title,
    status: (el.dataset.status as ToolStatus) ?? "pending",
    input: j.input,
    output: j.output,
    error: el.dataset.error,
    startedAt: el.dataset.startedAt,
    endedAt: el.dataset.endedAt,
    defaultOpen: yes(el.dataset.open),
    locale: el.dataset.locale,
    labels: j.labels as Partial<AiLabels>,
  }),
  (prev, next) =>
    prev
      ? {
          text: toolAnnouncement(prev.status, next.status, next.title ?? next.name, next.labels),
          politeness: next.status === "error" ? "assertive" : "polite",
        }
      : null,
);

export interface ApprovalCardProps extends ApprovalInput {
  labels?: Partial<AiLabels>;
}
export const approvalCardWidget = simple<ApprovalCardProps, ApprovalCardProps & { labels: AiLabels }>(
  "z-approval-card",
  (p) => ({ ...p, labels: labelsOf(p) }),
  (c, s, uid) =>
    h(
      "div",
      { class: "z-approval-card" },
      approvalNode(c, c.labels, { uid, confirming: s.confirming[c.id ?? ""], always: s.always[c.id ?? ""] }),
    ),
  (el, j) => ({
    id: el.dataset.id ?? "approval",
    title: el.dataset.title ?? "",
    description: el.dataset.description,
    details: j.details as ApprovalInput["details"],
    risk: el.dataset.risk === "low" || el.dataset.risk === "high" ? el.dataset.risk : el.dataset.risk === "medium" ? "medium" : undefined,
    decision: el.dataset.decision === "approved" || el.dataset.decision === "rejected" ? el.dataset.decision : undefined,
    allowAlways: yes(el.dataset.allowAlways),
    labels: j.labels as Partial<AiLabels>,
  }),
  // Al aparecer se anuncia la petición: la persona tiene que decidir.
  (prev, next) => (!prev && !next.decision ? { text: `${next.labels.approval}: ${next.title}` } : null),
);

export interface AgentPlanLabels {
  plan: string;
  /** «{done} of {total}». */
  progress: string;
  pending: string;
  running: string;
  done: string;
  failed: string;
  skipped: string;
}
export const AGENT_PLAN_LABELS: AgentPlanLabels = {
  plan: "Plan",
  progress: "{done} of {total}",
  pending: "Pending",
  running: "In progress",
  done: "Done",
  failed: "Failed",
  skipped: "Skipped",
};

const STEP_ICON: Record<StepStatus, string> = {
  pending: "minus-circle",
  running: "arrow-path",
  done: "check-circle",
  failed: "x-circle",
  skipped: "minus-circle",
};

export interface AgentPlanProps {
  steps?: readonly PlanStep[];
  title?: string;
  /** Plegable con su título como resumen. */
  collapsible?: boolean;
  defaultOpen?: boolean;
  labels?: Partial<AgentPlanLabels>;
}

function stepNodes(steps: readonly PlanStep[], labels: AgentPlanLabels): VNode[] {
  return steps.map((st) =>
    h(
      "li",
      { class: "z-agent-plan__step", key: st.id, "data-status": st.status, "aria-current": st.status === "running" ? "step" : undefined },
      h("span", { class: "z-agent-plan__marker", "aria-hidden": "true" }, icon(STEP_ICON[st.status], 16)),
      h(
        "span",
        { class: "z-agent-plan__body" },
        h("span", { class: "z-agent-plan__title" }, st.title, h("span", { class: "z-sr-only" }, `, ${labels[st.status]}`)),
        st.detail ? h("span", { class: "z-agent-plan__detail" }, st.detail) : null,
        st.children?.length ? h("ol", { class: "z-agent-plan__steps" }, ...stepNodes(st.children, labels)) : null,
      ),
    ),
  );
}

export const agentPlanWidget: Widget<
  AgentPlanProps,
  Required<Pick<AgentPlanProps, "steps" | "title" | "collapsible">> & { defaultOpen: boolean; labels: AgentPlanLabels },
  AssistantState
> = {
  root: "z-agent-plan",
  configure: (p) => ({
    steps: p.steps ?? [],
    title: p.title ?? p.labels?.plan ?? localize("agentPlan", AGENT_PLAN_LABELS).plan,
    collapsible: Boolean(p.collapsible),
    defaultOpen: p.defaultOpen !== false,
    labels: { ...localize("agentPlan", AGENT_PLAN_LABELS), ...p.labels },
  }),
  initial: emptyState,
  tree(c, _s, uid) {
    const { done, total, failed } = planProgress(c.steps);
    const header = [
      h("span", { class: "z-agent-plan__heading", id: `${uid}-title` }, c.title),
      h("span", { class: "z-agent-plan__count", "aria-hidden": "true" }, fill(c.labels.progress, { done, total })),
      h("progress", {
        class: "z-agent-plan__progress",
        max: Math.max(1, total),
        value: done,
        "aria-label": `${c.title}: ${fill(c.labels.progress, { done, total })}`,
        "data-failed": on(failed > 0),
      }),
    ];
    const list = h("ol", { class: "z-agent-plan__steps", "aria-labelledby": `${uid}-title` }, ...stepNodes(c.steps, c.labels));
    return h(
      "div",
      { class: "z-agent-plan" },
      c.collapsible
        ? h(
            "details",
            { class: "z-agent-plan__details", open: c.defaultOpen ? true : undefined },
            h(
              "summary",
              { class: "z-agent-plan__header" },
              ...header,
              h("span", { class: "z-agent-plan__chevron", "aria-hidden": "true" }, icon("chevron-down", 14)),
            ),
            list,
          )
        : h("div", { class: "z-agent-plan__details" }, h("div", { class: "z-agent-plan__header" }, ...header), list),
    );
  },
  attach: () => () => {},
  fromDom: (el, j) => ({
    steps: j.steps as PlanStep[] | undefined,
    title: el.dataset.title,
    collapsible: yes(el.dataset.collapsible),
    defaultOpen: el.dataset.open === "false" ? false : undefined,
    labels: j.labels as Partial<AgentPlanLabels>,
  }),
};

export interface SourcesProps {
  items?: readonly Source[];
  defaultOpen?: boolean;
  labels?: Partial<AiLabels>;
}
export const sourcesWidget = simple<SourcesProps, { items: readonly Source[]; defaultOpen: boolean; labels: AiLabels }>(
  "z-sources-block",
  (p) => ({ items: p.items ?? [], defaultOpen: Boolean(p.defaultOpen), labels: labelsOf(p) }),
  (c) => h("div", { class: "z-sources-block" }, sourcesNode(c.items, c.labels, { open: c.defaultOpen })),
  (el, j) => ({ items: j.items as Source[] | undefined, defaultOpen: yes(el.dataset.open), labels: j.labels as Partial<AiLabels> }),
);

export interface Suggestion {
  id?: string;
  text: string;
  icon?: string;
  description?: string;
}
export interface SuggestionsProps {
  items?: readonly (Suggestion | string)[];
  label?: string;
  /** `row` desplazable (por defecto) o `grid` (pantalla de inicio). */
  layout?: "row" | "grid";
  labels?: Partial<AiLabels>;
}
export const suggestionsWidget = simple<SuggestionsProps, { items: Suggestion[]; label: string; layout: "row" | "grid"; labels: AiLabels }>(
  "z-suggestions",
  (p) => ({
    items: (p.items ?? []).map((it) => (typeof it === "string" ? { text: it } : it)),
    label: p.label ?? "Suggestions",
    layout: p.layout === "grid" ? "grid" : "row",
    labels: labelsOf(p),
  }),
  (c) =>
    h(
      "div",
      { class: "z-suggestions", "data-layout": c.layout },
      h(
        "ul",
        { class: "z-suggestions__list", "aria-label": c.label },
        ...c.items.map((it, i) =>
          h(
            "li",
            { key: it.id ?? String(i) },
            h(
              "button",
              { type: "button", class: "z-suggestion", "data-id": it.id, "data-text": it.text },
              it.icon ? h("span", { class: "z-suggestion__icon", "aria-hidden": "true" }, icon(it.icon, 16)) : null,
              h(
                "span",
                { class: "z-suggestion__body" },
                h("span", { class: "z-suggestion__text" }, it.text),
                it.description ? h("span", { class: "z-suggestion__description" }, it.description) : null,
              ),
            ),
          ),
        ),
      ),
    ),
  (el, j) => ({
    items: j.items as Suggestion[] | undefined,
    label: el.dataset.label,
    layout: el.dataset.layout === "grid" ? "grid" : undefined,
    labels: j.labels as Partial<AiLabels>,
  }),
);

export interface AgentStatusLabels {
  idle: string;
  thinking: string;
  /** «Using {tool}». */
  tool: string;
  waiting: string;
  error: string;
  done: string;
}
export const AGENT_STATUS_LABELS: AgentStatusLabels = {
  idle: "Idle",
  thinking: "Thinking",
  tool: "Using {tool}",
  waiting: "Waiting for approval",
  error: "Error",
  done: "Done",
};
export type AgentState = "idle" | "thinking" | "tool" | "waiting" | "error" | "done";

export interface AgentStatusProps {
  state?: AgentState;
  /** Herramienta en uso o detalle. */
  detail?: string;
  /** Desde cuándo (ISO o ms): se muestra la duración. */
  since?: number | string;
  now?: number;
  locale?: string;
  labels?: Partial<AgentStatusLabels>;
}

/** Marcado del estado del agente (también lo pinta el componente sin estado de React). */
export function agentStatusNode(p: AgentStatusProps): VEl {
  const labels = { ...localize("agentStatus", AGENT_STATUS_LABELS), ...p.labels };
  const state = p.state ?? "idle";
  const since = toInstant(p.since ?? null);
  const text = state === "tool" ? fill(labels.tool, { tool: p.detail ?? "" }) : labels[state];
  const active = state === "thinking" || state === "tool";
  return h(
    "span",
    { class: "z-agent-status", "data-state": state, role: "status" },
    h(
      "span",
      { class: "z-agent-status__indicator", "aria-hidden": "true" },
      active
        ? h("span", { class: "z-agent-status__spinner" })
        : icon(
            state === "error" ? "exclamation-circle" : state === "waiting" ? "hand" : state === "done" ? "check-circle" : "minus-circle",
            14,
          ),
    ),
    h("span", { class: "z-agent-status__label" }, text),
    state !== "tool" && p.detail ? h("span", { class: "z-agent-status__detail" }, p.detail) : null,
    since !== null && active ? h("span", { class: "z-agent-status__time" }, durationText((p.now ?? Date.now()) - since, p.locale)) : null,
  );
}

export interface UsageMeterLabels {
  context: string;
  /** «{used} / {limit} tokens». */
  tokens: string;
  input: string;
  output: string;
  cached: string;
  cost: string;
}
export const USAGE_METER_LABELS: UsageMeterLabels = {
  context: "Context",
  tokens: "{used} / {limit} tokens",
  input: "Input",
  output: "Output",
  cached: "Cached",
  cost: "Cost",
};

export interface UsageMeterProps {
  used?: number;
  limit?: number;
  breakdown?: { input?: number; output?: number; cached?: number };
  cost?: { value: number; currency?: string };
  variant?: "bar" | "ring" | "inline";
  locale?: string;
  label?: string;
  labels?: Partial<UsageMeterLabels>;
}

/** Marcado del medidor de uso (sin estado): `<meter>` nativo con su texto, desglose y coste. */
export function usageMeterNode(p: UsageMeterProps): VEl {
  const labels = { ...localize("usageMeter", USAGE_METER_LABELS), ...p.labels };
  const used = Math.max(0, p.used ?? 0);
  const limit = Math.max(1, p.limit ?? 1);
  const ratio = usageRatio(used, limit);
  const level = usageLevel(ratio);
  const variant = p.variant ?? "bar";
  const tokens = fill(labels.tokens, { used: compactTokens(used, p.locale), limit: compactTokens(limit, p.locale) });
  const label = p.label ?? labels.context;
  const meter = h("meter", {
    class: "z-usage__meter",
    min: 0,
    max: limit,
    value: used,
    low: limit * 0.8,
    high: limit * 0.95,
    optimum: 0,
    "aria-label": `${label}: ${tokens} (${percentText(ratio, p.locale)})`,
  });
  const rows = p.breakdown
    ? (["input", "output", "cached"] as const)
        .filter((k) => p.breakdown?.[k] !== undefined)
        .map((k) =>
          h("div", { class: "z-usage__row", key: k }, h("dt", null, labels[k]), h("dd", null, compactTokens(p.breakdown![k]!, p.locale))),
        )
    : [];
  return h(
    "div",
    { class: "z-usage", "data-variant": variant, "data-level": level, s: { "--z-usage": ratio.toFixed(3) } },
    variant === "ring"
      ? h(
          "span",
          { class: "z-usage__ring", "aria-hidden": "true" },
          h(
            "svg",
            { viewBox: "0 0 36 36", class: "z-usage__svg" },
            h("circle", { class: "z-usage__track", cx: 18, cy: 18, r: 15.5, pathLength: 100 }),
            h("circle", { class: "z-usage__arc", cx: 18, cy: 18, r: 15.5, pathLength: 100 }),
          ),
          h("span", { class: "z-usage__percent" }, percentText(ratio, p.locale)),
        )
      : null,
    h(
      "div",
      { class: "z-usage__main" },
      h(
        "div",
        { class: "z-usage__head" },
        h("span", { class: "z-usage__label" }, label),
        h("span", { class: "z-usage__value" }, variant === "ring" ? tokens : `${tokens} · ${percentText(ratio, p.locale)}`),
      ),
      meter,
      rows.length || p.cost
        ? h(
            "dl",
            { class: "z-usage__breakdown" },
            ...rows,
            p.cost
              ? h(
                  "div",
                  { class: "z-usage__row", key: "cost" },
                  h("dt", null, labels.cost),
                  h("dd", null, formatCost(p.cost.value, p.cost.currency, p.locale)),
                )
              : null,
          )
        : null,
    ),
  );
}

// ---- Artifact ----

export interface ArtifactVersion {
  code: string;
  language?: string;
  /** Vista previa: `html` (en un iframe aislado sin scripts), `markdown` o ninguna. */
  preview?: "html" | "markdown";
  label?: string;
}

export interface ArtifactLabels {
  code: string;
  preview: string;
  /** «Version {index} of {count}». */
  version: string;
  previous: string;
  next: string;
  copy: string;
  copied: string;
  copyFailed: string;
  download: string;
  close: string;
  views: string;
}
export const ARTIFACT_LABELS: ArtifactLabels = {
  code: "Code",
  preview: "Preview",
  version: "Version {index} of {count}",
  previous: "Previous version",
  next: "Next version",
  copy: "Copy",
  copied: "Copied",
  copyFailed: "Copy failed",
  download: "Download",
  close: "Close",
  views: "View",
};

export interface ArtifactProps {
  title?: string;
  kind?: string;
  versions?: readonly ArtifactVersion[];
  /** Versión que se muestra (por defecto, la última). */
  version?: number;
  /** Nombre del archivo al descargar: con él aparece el botón. */
  downloadName?: string;
  /** Botón de cerrar (panel lateral). */
  closable?: boolean;
  defaultView?: "code" | "preview";
  labels?: Partial<ArtifactLabels>;
}

interface ArtifactConfig {
  title: string;
  kind: string;
  versions: readonly ArtifactVersion[];
  version?: number;
  downloadName?: string;
  closable: boolean;
  defaultView: "code" | "preview";
  labels: ArtifactLabels;
}
interface ArtifactState {
  version: number;
  view: "code" | "preview";
  copied: CopyState;
}

export const artifactWidget: Widget<ArtifactProps, ArtifactConfig, ArtifactState> = {
  root: "z-artifact",
  configure: (p) => ({
    title: p.title ?? "",
    kind: p.kind ?? "",
    versions: p.versions?.length ? p.versions : [{ code: "" }],
    version: p.version,
    downloadName: p.downloadName,
    closable: Boolean(p.closable),
    defaultView: p.defaultView === "code" ? "code" : "preview",
    labels: { ...localize("artifact", ARTIFACT_LABELS), ...p.labels },
  }),
  initial: (c) => ({
    version: c.version ?? c.versions.length - 1,
    view: c.versions[c.versions.length - 1]?.preview ? c.defaultView : "code",
    copied: "idle",
  }),
  control: (c, s) => {
    const version = Math.max(0, Math.min(c.versions.length - 1, c.version ?? s.version));
    return version !== s.version ? { ...s, version } : s;
  },
  tree(c, s, uid) {
    const { labels } = c;
    const v = c.versions[s.version] ?? c.versions[0]!;
    const view = v.preview ? s.view : "code";
    const count = c.versions.length;
    return h(
      "section",
      { class: "z-artifact z-liquid", role: "region", "aria-labelledby": `${uid}-title`, "data-view": view },
      h(
        "header",
        { class: "z-artifact__bar" },
        h("span", { class: "z-artifact__icon", "aria-hidden": "true" }, icon("code-bracket", 16)),
        h(
          "span",
          { class: "z-artifact__titles" },
          h("h3", { class: "z-artifact__title", id: `${uid}-title` }, c.title),
          c.kind ? h("span", { class: "z-artifact__kind" }, c.kind) : null,
        ),
        v.preview
          ? h(
              "span",
              { class: "z-artifact__views", role: "tablist", "aria-label": labels.views },
              ...(["preview", "code"] as const).map((k) =>
                h(
                  "button",
                  {
                    type: "button",
                    role: "tab",
                    key: k,
                    class: "z-artifact__view",
                    "data-view": k,
                    id: `${uid}-tab-${k}`,
                    "aria-selected": view === k ? "true" : "false",
                    "aria-controls": `${uid}-panel`,
                    tabindex: view === k ? 0 : -1,
                  },
                  labels[k],
                ),
              ),
            )
          : null,
        count > 1
          ? h(
              "span",
              {
                class: "z-branch-picker z-artifact__versions",
                role: "group",
                "aria-label": fill(labels.version, { index: s.version + 1, count }),
              },
              h(
                "button",
                {
                  type: "button",
                  class: "z-branch-picker__button",
                  "data-step": -1,
                  "aria-label": labels.previous,
                  title: labels.previous,
                  disabled: s.version <= 0,
                },
                icon("chevron-left", 14),
              ),
              h("span", { class: "z-branch-picker__value", "aria-hidden": "true" }, `v${s.version + 1}`),
              h(
                "button",
                {
                  type: "button",
                  class: "z-branch-picker__button",
                  "data-step": 1,
                  "aria-label": labels.next,
                  title: labels.next,
                  disabled: s.version >= count - 1,
                },
                icon("chevron-right", 14),
              ),
            )
          : null,
        h(
          "span",
          { class: "z-artifact__actions" },
          h(
            "button",
            {
              type: "button",
              class: "z-btn z-btn--ghost z-btn--icon z-artifact__copy",
              "data-size": "sm",
              "aria-label": s.copied === "copied" ? labels.copied : labels.copy,
              title: labels.copy,
            },
            icon(s.copied === "copied" ? "check" : "copy", 14),
          ),
          c.downloadName
            ? h(
                "button",
                {
                  type: "button",
                  class: "z-btn z-btn--ghost z-btn--icon z-artifact__download",
                  "data-size": "sm",
                  "aria-label": labels.download,
                  title: labels.download,
                },
                icon("arrow-down-tray", 14),
              )
            : null,
          c.closable
            ? h(
                "button",
                {
                  type: "button",
                  class: "z-btn z-btn--ghost z-btn--icon z-artifact__close",
                  "data-size": "sm",
                  "aria-label": labels.close,
                  title: labels.close,
                },
                icon("x-mark", 14),
              )
            : null,
        ),
      ),
      h(
        "div",
        {
          class: "z-artifact__panel",
          id: `${uid}-panel`,
          tabindex: 0,
          role: v.preview ? "tabpanel" : "region",
          "aria-label": v.preview ? undefined : c.title,
          "aria-labelledby": v.preview ? `${uid}-tab-${view}` : undefined,
        },
        view === "preview" && v.preview === "html"
          ? // Aislado: sin scripts, sin formularios, sin el origen de la página. Solo se ve.
            h("iframe", {
              class: "z-artifact__frame",
              sandbox: "",
              srcdoc: v.code,
              title: `${c.title} ${labels.preview}`,
              loading: "lazy",
              referrerpolicy: "no-referrer",
            })
          : view === "preview" && v.preview === "markdown"
            ? h("div", { class: "z-artifact__doc" }, markdownTree(v.code))
            : codeViewerWidget.tree(
                codeViewerWidget.configure({ code: v.code, language: v.language, title: c.downloadName ?? c.title }),
                { file: 0, copied: "idle" },
                `${uid}-code`,
              ),
      ),
      h("span", { class: "z-sr-only", role: "status", "data-live": "" }),
    );
  },
  attach(root, host) {
    const onClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (!target || !root.contains(target)) return;
      const s = host.state();
      const c = host.config();
      const v = c.versions[s.version];
      const tab = target.closest<HTMLElement>(".z-artifact__view");
      if (tab) {
        host.update({ view: tab.dataset.view === "code" ? "code" : "preview" }, true);
        return;
      }
      const step = target.closest<HTMLElement>(".z-branch-picker__button");
      if (step) {
        const version = Math.max(0, Math.min(c.versions.length - 1, s.version + Number(step.dataset.step)));
        host.update({ version });
        host.emit("version-change", { index: version });
        return;
      }
      const copy = target.closest<HTMLButtonElement>(".z-artifact__copy, .z-code-viewer__copy");
      if (copy && v) {
        void copyFromButton(copy, v.code, c.labels, (copied) => host.update({ copied }));
        return;
      }
      if (target.closest(".z-artifact__download") && v && c.downloadName) {
        host.emit("download", { name: c.downloadName, code: v.code });
        const blob = new Blob([v.code], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = root.ownerDocument.createElement("a");
        a.href = url;
        a.download = c.downloadName;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        return;
      }
      if (target.closest(".z-artifact__close")) host.emit("close", {});
    };
    const onKey = (event: KeyboardEvent) => {
      const tab = (event.target as Element).closest?.<HTMLElement>(".z-artifact__view");
      if (!tab || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return;
      event.preventDefault();
      host.update({ view: host.state().view === "code" ? "preview" : "code" }, true);
    };
    root.addEventListener("click", onClick);
    root.addEventListener("keydown", onKey);
    return () => {
      root.removeEventListener("click", onClick);
      root.removeEventListener("keydown", onKey);
    };
  },
  after(root, _host, focus) {
    if (focus) root.querySelector<HTMLElement>('.z-artifact__view[aria-selected="true"]')?.focus();
  },
  fromDom(el, j) {
    const d = el.dataset;
    return {
      title: d.title,
      kind: d.kind,
      versions: j.versions as ArtifactVersion[] | undefined,
      version: d.version ? num(d.version, 0) : undefined,
      downloadName: d.downloadName,
      closable: yes(d.closable),
      defaultView: d.defaultView === "code" ? "code" : undefined,
      labels: j.labels as Partial<ArtifactLabels>,
    };
  },
};

// ---- BranchPicker suelto ----

export interface BranchPickerProps {
  index?: number;
  count?: number;
  labels?: Partial<AiLabels>;
}
export const branchPickerWidget: Widget<BranchPickerProps, { index: number; count: number; labels: AiLabels }, AssistantState> = {
  root: "z-branch",
  configure: (p) => ({ index: Math.max(1, Math.floor(p.index ?? 1)), count: Math.max(1, Math.floor(p.count ?? 1)), labels: labelsOf(p) }),
  initial: emptyState,
  tree: (c) => h("div", { class: "z-branch" }, branchNode(Math.min(c.index, c.count), c.count, c.labels)),
  attach(root, host) {
    const onClick = (event: MouseEvent) => {
      const step = (event.target as Element).closest?.<HTMLElement>(".z-branch-picker__button");
      if (!step) return;
      const c = host.config();
      host.emit("change", { index: Math.max(1, Math.min(c.count, c.index + Number(step.dataset.step))) });
    };
    root.addEventListener("click", onClick);
    return () => root.removeEventListener("click", onClick);
  },
  fromDom: (el, j) => ({
    index: el.dataset.index ? num(el.dataset.index, 1) : undefined,
    count: el.dataset.count ? num(el.dataset.count, 1) : undefined,
    labels: j.labels as Partial<AiLabels>,
  }),
};

export type { PlanStep, ResponseState, StepStatus, ToolStatus };

// ---- Estado del agente, uso y Markdown sueltos ----

export interface MarkdownProps {
  /** Texto Markdown (el de un modelo o de una persona: nunca entra como marcado). */
  children?: string;
  text?: string;
  /** Llega a trozos: cierra a título provisional lo abierto y pinta el cursor. */
  streaming?: boolean;
  /** Fuentes para las citas `[n]`. */
  sources?: readonly Source[];
  labels?: Partial<AiLabels>;
}

export const markdownWidget: Widget<
  MarkdownProps,
  { text: string; streaming: boolean; sources: readonly Source[]; labels: AiLabels },
  AssistantState
> = {
  root: "z-markdown-view",
  configure: (p) => ({
    text: p.text ?? (typeof p.children === "string" ? p.children : ""),
    streaming: Boolean(p.streaming),
    sources: p.sources ?? [],
    labels: labelsOf(p),
  }),
  initial: emptyState,
  tree: (c, s, uid) =>
    h(
      "div",
      { class: "z-markdown-view", "aria-busy": c.streaming ? "true" : undefined },
      richText(c.text, { uid, labels: c.labels, sources: c.sources, copied: s.copied, streaming: c.streaming }),
    ),
  attach(root, host) {
    const onClick = (event: MouseEvent) => {
      const copyBtn = (event.target as Element).closest?.<HTMLButtonElement>(".z-code-viewer__copy");
      if (!copyBtn || !root.contains(copyBtn)) return;
      const block = copyBtn.closest<HTMLElement>(".z-code-viewer");
      const key = block?.dataset.block ?? "";
      const text = (block?.querySelector(".z-code-viewer__code")?.textContent ?? "").replace(/\n$/, "");
      void copyFromButton(copyBtn, text, host.config().labels, (copied) =>
        host.update({ copied: { ...host.state().copied, [key]: copied } }),
      );
    };
    root.addEventListener("click", onClick);
    return () => root.removeEventListener("click", onClick);
  },
  fromDom(el, j) {
    const template = el.querySelector<HTMLTemplateElement>(":scope > template[data-markdown]");
    if (template && !markdownSource.has(el)) markdownSource.set(el, template.content.textContent ?? "");
    return {
      text: (j.text as string | undefined) ?? markdownSource.get(el),
      streaming: yes(el.dataset.streaming),
      sources: j.sources as Source[] | undefined,
      labels: j.labels as Partial<AiLabels>,
    };
  },
};
const markdownSource = new WeakMap<HTMLElement, string>();
