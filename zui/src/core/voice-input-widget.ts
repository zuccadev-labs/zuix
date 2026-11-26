// VoiceInput (core/widget): grabar una nota de voz con MediaRecorder. Botón de grabar; al grabar, punto, tiempo
// (sin las pausas), nivel de la señal (Web Audio, si lo hay), pausar o seguir, cancelar y enviar. Mejora progresiva:
// sin MediaRecorder o sin contexto seguro el botón queda desactivado con su motivo; sin permiso se dice y se puede
// volver a intentar. Al enviar sale `send { blob, duration, peaks, type }` con la onda lista para VoiceNote.
import { announceIn, num, type Widget } from "./widget";
import { clockText, peaksFrom } from "./waveform";
import { h, icon, on } from "./vnode";
import {
  levelBars,
  levelOf,
  pauseClock,
  pickMimeType,
  problemOf,
  pushLevel,
  recordedMs,
  recorderSupport,
  resumeClock,
  type RecorderProblem,
  type RecordingClock,
} from "./voice-input";

export interface VoiceInputLabels {
  record: string;
  pause: string;
  resume: string;
  cancel: string;
  send: string;
  time: string;
  recording: string;
  paused: string;
  cancelled: string;
  sent: string;
  unsupported: string;
  denied: string;
  failed: string;
}

export const VOICE_INPUT_LABELS: VoiceInputLabels = {
  record: "Record voice message",
  pause: "Pause recording",
  resume: "Resume recording",
  cancel: "Cancel recording",
  send: "Send recording",
  time: "Recording time",
  recording: "Recording",
  paused: "Recording paused",
  cancelled: "Recording cancelled",
  sent: "Recording sent",
  unsupported: "Voice recording isn't available in this browser",
  denied: "Microphone access was denied. Allow it in the browser to record.",
  failed: "Couldn't start recording",
};

export interface VoiceSend {
  blob: Blob;
  /** Segundos grabados. */
  duration: number;
  /** 40 picos 0–1 para VoiceNote. */
  peaks: number[];
  type: string;
}

export interface VoiceInputProps {
  /** Segundos como mucho; al llegar, se envía sola. */
  maxDuration?: number;
  /** Barras del nivel (24). */
  bars?: number;
  /** Texto visible en el botón de grabar. */
  showLabel?: boolean;
  disabled?: boolean;
  labels?: Partial<VoiceInputLabels>;
}

interface Config {
  maxDuration: number;
  bars: number;
  showLabel: boolean;
  disabled: boolean;
  labels: VoiceInputLabels;
}

type Status = "idle" | "requesting" | "recording" | "paused" | "error";

interface State {
  status: Status;
  problem: RecorderProblem | null;
  elapsed: number;
  levels: readonly number[];
  /** Comprobado tras montar (en el servidor no hay ventana): hasta entonces, se puede intentar. */
  support: RecorderProblem | null;
}

interface Session {
  recorder: MediaRecorder | null;
  stream: MediaStream | null;
  chunks: Blob[];
  levels: number[];
  clock: RecordingClock;
  timer: ReturnType<typeof setInterval> | undefined;
  context: AudioContext | null;
  cancelled: boolean;
}

const sessions = new WeakMap<HTMLElement, Session>();

const button = (cls: string, label: string, name: string, extra: Record<string, string | undefined> = {}) =>
  h(
    "button",
    { type: "button", class: `z-btn z-btn--icon ${cls}`, "data-size": "md", "aria-label": label, title: label, ...extra },
    icon(name, 16),
  );

export const voiceInputWidget: Widget<VoiceInputProps, Config, State> = {
  root: "z-voice-input",
  configure: (p) => ({
    maxDuration: Math.max(0, Number(p.maxDuration) || 0),
    bars: Math.max(8, Math.min(64, Math.floor(p.bars ?? 24))),
    showLabel: Boolean(p.showLabel),
    disabled: Boolean(p.disabled),
    labels: { ...VOICE_INPUT_LABELS, ...p.labels },
  }),
  initial: () => ({ status: "idle", problem: null, elapsed: 0, levels: [], support: null }),
  tree(c, s, uid) {
    const { labels } = c;
    const live = s.status === "recording" || s.status === "paused";
    const problem = s.support ?? (s.status === "error" ? s.problem : null);
    const messageId = `${uid}-message`;
    if (!live) {
      return h(
        "div",
        { class: "z-voice-input", "data-status": s.status, "data-problem": problem ?? undefined },
        h(
          "button",
          {
            type: "button",
            class: `z-btn z-btn--secondary z-voice-input__record${c.showLabel ? "" : " z-btn--icon"}`,
            "data-size": "md",
            key: "record",
            "aria-label": c.showLabel ? undefined : labels.record,
            title: c.showLabel ? undefined : labels.record,
            disabled: c.disabled || s.support !== null || undefined,
            "aria-busy": s.status === "requesting" ? "true" : undefined,
            "aria-describedby": problem ? messageId : undefined,
          },
          icon(s.support ? "microphone-slash" : "microphone", 16),
          c.showLabel ? h("span", { class: "z-voice-input__label" }, labels.record) : null,
        ),
        problem ? h("p", { class: "z-voice-input__message", id: messageId, key: "message", role: s.support ? undefined : "alert" }, labels[problem]) : null,
        h("span", { class: "z-sr-only", "data-live": "", "aria-live": "polite", key: "live" }),
      );
    }
    const paused = s.status === "paused";
    return h(
      "div",
      { class: "z-voice-input", "data-status": s.status, role: "group", "aria-label": labels.recording },
      button("z-btn--ghost z-voice-input__cancel", labels.cancel, "trash"),
      h("span", { class: "z-voice-input__dot", "aria-hidden": "true", "data-paused": on(paused) }),
      h("span", { class: "z-voice-input__time", role: "timer", "aria-label": labels.time, key: "time" }, clockText(s.elapsed / 1000)),
      h(
        "span",
        { class: "z-voice-input__level", "aria-hidden": "true", key: "level" },
        ...levelBars(s.levels, c.bars).map((v, i) => h("span", { class: "z-voice-input__bar", key: String(i), s: { "--z-peak": v.toFixed(2) } })),
      ),
      button("z-btn--ghost z-voice-input__pause", paused ? labels.resume : labels.pause, paused ? "microphone" : "pause"),
      button("z-btn--primary z-voice-input__send", labels.send, "paper-airplane"),
      h("span", { class: "z-sr-only", "data-live": "", "aria-live": "polite", key: "live" }),
    );
  },
  attach(root, host) {
    const view = root.ownerDocument.defaultView as (Window & { MediaRecorder?: typeof MediaRecorder; AudioContext?: typeof AudioContext }) | null;
    const support = recorderSupport(view);
    if (support) queueMicrotask(() => host.update({ support }));
    const focus = (selector: string) => requestAnimationFrame(() => root.querySelector<HTMLElement>(selector)?.focus());
    const stopAll = (session: Session) => {
      clearInterval(session.timer);
      session.timer = undefined;
      for (const t of session.stream?.getTracks() ?? []) t.stop();
      session.stream = null;
      void session.context?.close?.().catch?.(() => {});
      session.context = null;
    };
    const finish = (cancel: boolean) => {
      const session = sessions.get(root);
      if (!session) return;
      session.cancelled = cancel;
      if (session.recorder && session.recorder.state !== "inactive") session.recorder.stop();
      else {
        stopAll(session);
        sessions.delete(root);
        host.update({ status: "idle", elapsed: 0, levels: [] });
      }
    };
    const start = async () => {
      if (!view || sessions.has(root)) return;
      host.update({ status: "requesting", problem: null });
      const session: Session = {
        recorder: null,
        stream: null,
        chunks: [],
        levels: [],
        clock: { startedAt: 0, pausedMs: 0, pausedAt: null },
        timer: undefined,
        context: null,
        cancelled: false,
      };
      sessions.set(root, session);
      try {
        const stream = await view.navigator.mediaDevices.getUserMedia({ audio: true });
        session.stream = stream;
        const Recorder = view.MediaRecorder!;
        const mimeType = pickMimeType(Recorder.isTypeSupported?.bind(Recorder));
        const recorder = new Recorder(stream, mimeType ? { mimeType } : undefined);
        session.recorder = recorder;
        let sample: (() => number) | null = null;
        try {
          const Ctx = view.AudioContext;
          if (Ctx) {
            const ctx = new Ctx();
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 512;
            ctx.createMediaStreamSource(stream).connect(analyser);
            const buffer = new Float32Array(analyser.fftSize);
            session.context = ctx;
            sample = () => {
              analyser.getFloatTimeDomainData(buffer);
              return levelOf(buffer);
            };
          }
        } catch {
          session.context = null;
        }
        recorder.addEventListener("dataavailable", (e) => {
          if (e.data.size) session.chunks.push(e.data);
        });
        recorder.addEventListener(
          "stop",
          () => {
            const duration = recordedMs(session.clock, performance.now()) / 1000;
            stopAll(session);
            sessions.delete(root);
            const labels = host.config().labels;
            host.update({ status: "idle", elapsed: 0, levels: [] });
            focus(".z-voice-input__record");
            if (session.cancelled || !session.chunks.length) {
              announceIn(root, labels.cancelled);
              host.emit("cancel", {});
              return;
            }
            const blob = new Blob(session.chunks, { type: recorder.mimeType || mimeType || "audio/webm" });
            announceIn(root, labels.sent);
            host.emit("send", { blob, duration, peaks: peaksFrom(session.levels, 40), type: blob.type } satisfies VoiceSend);
          },
          { once: true },
        );
        recorder.start(250);
        session.clock = { startedAt: performance.now(), pausedMs: 0, pausedAt: null };
        host.update({ status: "recording", elapsed: 0, levels: [] });
        announceIn(root, host.config().labels.recording);
        host.emit("start", {});
        focus(".z-voice-input__send");
        session.timer = setInterval(() => {
          if (host.state().status !== "recording") return;
          const level = sample ? sample() : 0;
          session.levels.push(level);
          const elapsed = recordedMs(session.clock, performance.now());
          host.update({ elapsed, levels: pushLevel(host.state().levels, level, host.config().bars) });
          const max = host.config().maxDuration;
          if (max && elapsed >= max * 1000) finish(false);
        }, 100);
      } catch (error) {
        stopAll(session);
        sessions.delete(root);
        const problem = problemOf(error);
        host.update({ status: "error", problem });
        host.emit("error", { problem });
        focus(".z-voice-input__record");
      }
    };
    const togglePause = () => {
      const session = sessions.get(root);
      const recorder = session?.recorder;
      if (!session || !recorder) return;
      const labels = host.config().labels;
      if (host.state().status === "recording" && recorder.state === "recording") {
        recorder.pause();
        session.clock = pauseClock(session.clock, performance.now());
        host.update({ status: "paused" });
        announceIn(root, labels.paused);
        host.emit("pause", {});
      } else if (host.state().status === "paused" && recorder.state === "paused") {
        recorder.resume();
        session.clock = resumeClock(session.clock, performance.now());
        host.update({ status: "recording" });
        announceIn(root, labels.recording);
        host.emit("resume", {});
      }
      focus(".z-voice-input__pause");
    };
    const onClick = (event: MouseEvent) => {
      const target = (event.target as Element).closest?.<HTMLElement>("button");
      if (!target || !root.contains(target)) return;
      if (target.classList.contains("z-voice-input__record")) void start();
      else if (target.classList.contains("z-voice-input__pause")) togglePause();
      else if (target.classList.contains("z-voice-input__cancel")) finish(true);
      else if (target.classList.contains("z-voice-input__send")) finish(false);
    };
    // Escape cancela mientras se graba.
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && sessions.has(root)) {
        event.preventDefault();
        finish(true);
      }
    };
    root.addEventListener("click", onClick);
    root.addEventListener("keydown", onKey);
    return () => {
      root.removeEventListener("click", onClick);
      root.removeEventListener("keydown", onKey);
      const session = sessions.get(root);
      if (session) {
        session.cancelled = true;
        if (session.recorder && session.recorder.state !== "inactive") session.recorder.stop();
        stopAll(session);
        sessions.delete(root);
      }
    };
  },
  after() {},
  fromDom(el) {
    const d = el.dataset;
    return {
      maxDuration: d.maxDuration ? num(d.maxDuration, 0) : undefined,
      bars: d.bars ? num(d.bars, 24) : undefined,
      showLabel: d.showLabel !== undefined && d.showLabel !== "false",
      disabled: d.disabled !== undefined && d.disabled !== "false",
    };
  },
};

