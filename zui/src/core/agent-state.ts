// Estados de una respuesta de asistente y de sus herramientas: qué transiciones valen, cuáles son finales, qué cambio
// merece un anuncio (el final de la respuesta, una herramienta que espera aprobación o falla; nunca los intermedios) y
// la duración como texto. También el progreso de un plan de pasos. Puro.

export type ResponseState = "submitted" | "streaming" | "done" | "error" | "stopped";
export type ToolStatus = "pending" | "input-streaming" | "running" | "awaiting-approval" | "success" | "error" | "cancelled";
export type StepStatus = "pending" | "running" | "done" | "failed" | "skipped";

const RESPONSE_NEXT: Record<ResponseState, readonly ResponseState[]> = {
  submitted: ["streaming", "done", "error", "stopped"],
  streaming: ["done", "error", "stopped"],
  done: ["submitted"],
  error: ["submitted"],
  stopped: ["submitted"],
};

const TOOL_NEXT: Record<ToolStatus, readonly ToolStatus[]> = {
  pending: ["input-streaming", "running", "awaiting-approval", "error", "cancelled"],
  "input-streaming": ["running", "awaiting-approval", "error", "cancelled"],
  "awaiting-approval": ["running", "cancelled", "error"],
  running: ["success", "error", "cancelled"],
  success: [],
  error: ["running"],
  cancelled: [],
};

export const canRespond = (from: ResponseState, to: ResponseState) => from === to || RESPONSE_NEXT[from].includes(to);
export const canTool = (from: ToolStatus, to: ToolStatus) => from === to || TOOL_NEXT[from].includes(to);
export const isFinalTool = (s: ToolStatus) => s === "success" || s === "error" || s === "cancelled";
export const isBusy = (s: ResponseState) => s === "submitted" || s === "streaming";

export interface AgentAnnounceLabels {
  /** Respuesta terminada. */
  done: string;
  stopped: string;
  failed: string;
  /** «{name} needs your approval». */
  approval: string;
  /** «{name} failed». */
  toolFailed: string;
}

export const AGENT_ANNOUNCE_LABELS: AgentAnnounceLabels = {
  done: "Response complete",
  stopped: "Response stopped",
  failed: "Response failed",
  approval: "{name} needs your approval",
  toolFailed: "{name} failed",
};

const put = (t: string, v: Record<string, string>) => t.replace(/\{(\w+)\}/g, (_, k: string) => v[k] ?? `{${k}}`);

/** Anuncio de un cambio de estado de la respuesta, o `""` si no se dice nada (empezar, cada trozo). */
export function responseAnnouncement(
  from: ResponseState | undefined,
  to: ResponseState,
  labels: AgentAnnounceLabels = AGENT_ANNOUNCE_LABELS,
  summary?: string,
): string {
  if (from === to || (from !== undefined && !isBusy(from))) return "";
  if (to === "done") return summary ? `${labels.done}. ${summary}` : labels.done;
  if (to === "stopped") return labels.stopped;
  if (to === "error") return labels.failed;
  return "";
}

/** Anuncio de un cambio de estado de una herramienta: solo la espera de aprobación y el error. */
export function toolAnnouncement(
  from: ToolStatus | undefined,
  to: ToolStatus,
  name: string,
  labels: AgentAnnounceLabels = AGENT_ANNOUNCE_LABELS,
): string {
  if (from === to) return "";
  if (to === "awaiting-approval") return put(labels.approval, { name });
  if (to === "error") return put(labels.toolFailed, { name });
  return "";
}

/** Duración corta: «0.4 s», «12 s», «2 min 5 s», «1 h 3 min», con las unidades del locale. */
export function durationText(ms: number, locale?: string): string {
  const total = Math.max(0, ms);
  const unit = (value: number, u: "second" | "minute" | "hour", digits = 0) => {
    try {
      return new Intl.NumberFormat(locale, { style: "unit", unit: u, unitDisplay: "narrow", maximumFractionDigits: digits }).format(value);
    } catch {
      return new Intl.NumberFormat(undefined, { style: "unit", unit: u, unitDisplay: "narrow", maximumFractionDigits: digits }).format(
        value,
      );
    }
  };
  if (total < 10_000) return unit(Math.round(total / 100) / 10, "second", 1);
  const s = Math.round(total / 1000);
  if (s < 60) return unit(s, "second");
  const m = Math.floor(s / 60);
  if (m < 60) return s % 60 ? `${unit(m, "minute")} ${unit(s % 60, "second")}` : unit(m, "minute");
  const hr = Math.floor(m / 60);
  return m % 60 ? `${unit(hr, "hour")} ${unit(m % 60, "minute")}` : unit(hr, "hour");
}

export interface PlanStep {
  id: string;
  title: string;
  status: StepStatus;
  detail?: string;
  children?: readonly PlanStep[];
}

/** Pasos terminados (hechos u omitidos) y totales, contando los subpasos; y el primero en curso. */
export function planProgress(steps: readonly PlanStep[]): { done: number; total: number; failed: number; current?: PlanStep } {
  let done = 0;
  let total = 0;
  let failed = 0;
  let current: PlanStep | undefined;
  const walk = (list: readonly PlanStep[]) => {
    for (const s of list) {
      if (s.children?.length) walk(s.children);
      else {
        total++;
        if (s.status === "done" || s.status === "skipped") done++;
        if (s.status === "failed") failed++;
      }
      if (!current && s.status === "running") current = s;
    }
  };
  walk(steps);
  return { done, total, failed, current };
}
