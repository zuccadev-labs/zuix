// Caja de texto de chat como pieza (core/widget), en dos formas: Composer (mensajería) y PromptInput (asistente).
// Comparten el campo que crece, Intro para enviar y Mayús+Intro para saltar de línea (nunca durante la composición de
// un IME: `isComposing` o `keyCode 229`), botón de enviar siempre presente, adjuntos (elegir, pegar o soltar) con
// «Quitar», emojis con el selector propio, menciones con `@` (combobox sobre el campo) y barra de «respondiendo a» o
// «editando». Composer graba notas de voz con MediaRecorder si el navegador lo ofrece (pulsar para empezar, pulsar para
// enviar, Cancelar); PromptInput añade modelo, herramientas activables, uso de contexto y enviar ↔ parar.

import { followScrollEdges } from "./edges";
import { announce } from "./announcer";
import { avatarNode } from "./chat-tree";
import {
  emojiPickerAfter,
  emojiPickerClick,
  emojiPickerConfig,
  emojiPickerInitial,
  emojiPickerKey,
  emojiPickerTree,
  emojiToneKey,
  ensureEmojiSet,
  type EmojiPickerLabels,
  type EmojiPickerState,
} from "./emoji-picker-widget";
import type { EmojiSet } from "./emoji-data";
import { formatByte } from "./format";
import { encodeMentions, filterMentions, findTrigger, insertMention, type MentionItem, type MentionMatch } from "./mentions";
import { compactTokens, percentText, usageLevel, usageRatio } from "./usage";
import { clockText, peaksFrom } from "./waveform";
import { fill, h, icon, on, type VNode } from "./vnode";
import { num, yes, type Widget, type WidgetHost } from "./widget";

export interface ComposerLabels {
  field: string;
  placeholder: string;
  send: string;
  save: string;
  stop: string;
  attach: string;
  emoji: string;
  record: string;
  /** «Recording {time}». */
  recording: string;
  sendRecording: string;
  cancelRecording: string;
  micError: string;
  /** «Replying to {name}». */
  replyingTo: string;
  editing: string;
  cancelReply: string;
  cancelEdit: string;
  /** «Remove {name}». */
  remove: string;
  attachments: string;
  mentions: string;
  /** «{n} suggestions». */
  mentionResults: string;
  /** «{n} characters left». */
  remaining: string;
  model: string;
  tools: string;
  /** «{used} of {limit} tokens ({percent})». */
  usage: string;
  stopped: string;
  /** Título de la cita en PromptInput. */
  quoting: string;
  removeQuote: string;
  /** Contextos adjuntos (lista). */
  contexts: string;
  /** Zona de soltar archivos. */
  dropTitle: string;
  dropHint: string;
  /** Texto sobre la barra de grabación. */
  recordingHint: string;
  picker?: Partial<EmojiPickerLabels>;
}

export const COMPOSER_LABELS: ComposerLabels = {
  field: "Message",
  placeholder: "Message",
  send: "Send",
  save: "Save",
  stop: "Stop generating",
  attach: "Attach files",
  emoji: "Emoji",
  record: "Record voice message",
  recording: "Recording {time}",
  sendRecording: "Send voice message",
  cancelRecording: "Cancel recording",
  micError: "Microphone not available",
  replyingTo: "Replying to {name}",
  editing: "Editing message",
  cancelReply: "Cancel reply",
  cancelEdit: "Cancel editing",
  remove: "Remove {name}",
  attachments: "Attachments",
  mentions: "Suggestions",
  mentionResults: "{n} suggestions",
  remaining: "{n} characters left",
  model: "Model",
  tools: "Tools",
  usage: "{used} of {limit} tokens ({percent})",
  stopped: "Stopped",
  quoting: "Quoting",
  removeQuote: "Remove quote",
  contexts: "Context",
  dropTitle: "Drop files here",
  dropHint: "Images, documents, audio and more",
  recordingHint: "Recording a voice note",
};

export const PROMPT_INPUT_LABELS: ComposerLabels = { ...COMPOSER_LABELS, field: "Prompt", placeholder: "Ask anything" };

export interface ComposerFile {
  id: string;
  name: string;
  size?: number;
  type?: string;
  /** Miniatura (URL de objeto o la que dé la aplicación). */
  preview?: string;
  file?: File;
}

export interface ComposerSend {
  /** Texto con las menciones como tokens (`<@id>`). */
  text: string;
  attachments: ComposerFile[];
  replyTo?: string;
  editing?: string;
}

export interface ComposerVoice {
  blob: Blob;
  /** Segundos. */
  duration: number;
  /** Onda calculada al grabar (40 picos entre 0 y 1). */
  peaks: number[];
  type: string;
}

export interface ComposerModel {
  id: string;
  label: string;
  description?: string;
}

export interface ComposerTool {
  id: string;
  label: string;
  icon?: string;
  active?: boolean;
}

export interface ComposerContext {
  id: string;
  label: string;
  icon?: string;
}

export interface ComposerProps {
  /** Texto controlado. */
  value?: string;
  defaultValue?: string;
  /** Intro envía (por defecto) o solo Ctrl/⌘+Intro. */
  sendOn?: "enter" | "mod-enter";
  /** Tipos de archivo aceptados (`accept` del campo de archivos). Sin `attach: false`, se ofrece adjuntar. */
  accept?: string;
  attach?: boolean;
  maxFiles?: number;
  /** Selector de emojis (por defecto sí) y su conjunto. */
  emoji?: boolean;
  emojiData?: EmojiSet | (() => Promise<EmojiSet>);
  /** Notas de voz (Composer): botón de grabar cuando el campo está vacío. */
  voice?: boolean;
  /** Menciones: disparadores y candidatos. */
  mentions?: { trigger?: string | readonly string[]; items: readonly MentionItem[] };
  replyTo?: { id: string; author?: string; text?: string };
  editing?: { id: string; text: string };
  maxLength?: number;
  disabled?: boolean;
  placeholder?: string;
  /** PromptInput: estado de la respuesta (enviar ↔ parar). */
  status?: "ready" | "submitted" | "streaming" | "error";
  models?: readonly ComposerModel[];
  model?: string;
  tools?: readonly ComposerTool[];
  usage?: { used: number; limit: number };
  /** PromptInput: texto citado de la respuesta, en una ficha sobre el campo (con «Quitar»). */
  quote?: { id?: string; text: string };
  /** PromptInput: contextos adjuntos (reunión, documento) en fichas de borde punteado, cada una con «Quitar». */
  contexts?: readonly ComposerContext[];
  /** PromptInput: halo suave de destellos encima de la caja. */
  halo?: boolean;
  locale?: string;
  labels?: Partial<ComposerLabels>;
}

interface Config {
  kind: "chat" | "prompt";
  value?: string;
  defaultValue: string;
  sendOn: "enter" | "mod-enter";
  accept?: string;
  attach: boolean;
  maxFiles: number;
  emoji: boolean;
  emojiData?: ComposerProps["emojiData"];
  voice: boolean;
  triggers: readonly string[];
  mentionItems: readonly MentionItem[];
  replyTo?: ComposerProps["replyTo"];
  editing?: ComposerProps["editing"];
  maxLength?: number;
  disabled: boolean;
  placeholder: string;
  status: "ready" | "submitted" | "streaming" | "error";
  models: readonly ComposerModel[];
  model?: string;
  tools: readonly ComposerTool[];
  usage?: { used: number; limit: number };
  quote?: { id?: string; text: string };
  contexts: readonly ComposerContext[];
  halo: boolean;
  locale?: string;
  labels: ComposerLabels;
}

interface State {
  text: string;
  files: ComposerFile[];
  emojiOpen: boolean;
  picker: EmojiPickerState;
  mention: { match: MentionMatch; options: MentionItem[]; index: number } | null;
  chosen: MentionItem[];
  recording: { startedAt: number; elapsed: number } | null;
  model?: string;
  tools: Readonly<Record<string, boolean>>;
  /** El navegador puede grabar (se sabe al montar). */
  canRecord: boolean;
}

type Host = WidgetHost<Config, State>;

const busy = (c: Config) => c.kind === "prompt" && (c.status === "submitted" || c.status === "streaming");
const canRecord = (root: Element) => {
  const win = root.ownerDocument.defaultView as (Window & { MediaRecorder?: unknown }) | null;
  return Boolean(win?.MediaRecorder && win.navigator.mediaDevices?.getUserMedia);
};

interface Live {
  recorder: MediaRecorder | null;
  stream: MediaStream | null;
  chunks: Blob[];
  levels: number[];
  timer: ReturnType<typeof setInterval> | undefined;
  context: AudioContext | null;
  cancelled: boolean;
  lastEditing?: string;
  seq: number;
}
const lives = new WeakMap<HTMLElement, Live>();

function attach(root: HTMLElement, host: Host): () => void {
  const live: Live = { recorder: null, stream: null, chunks: [], levels: [], timer: undefined, context: null, cancelled: false, seq: 0 };
  lives.set(root, live);
  const field = () => root.querySelector<HTMLTextAreaElement>(".z-composer__input");
  if (host.config().voice && canRecord(root)) queueMicrotask(() => host.update({ canRecord: true }));
  const pickerConfig = () => emojiPickerConfig({ data: host.config().emojiData, labels: host.config().labels.picker });
  const setPicker = (patch: Partial<EmojiPickerState>) => host.update({ picker: { ...host.state().picker, ...patch } });
  const autosize = () => {
    const el = field();
    if (!el || CSS.supports?.("field-sizing", "content")) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };
  const setText = (text: string, caret?: number) => {
    const el = field();
    if (el) {
      el.value = text;
      if (caret !== undefined) el.setSelectionRange(caret, caret);
    }
    host.update({ text });
    host.emit("value-change", { value: text });
    autosize();
  };
  const insertAtCaret = (insert: string) => {
    const el = field();
    if (!el) return;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? start;
    setText(el.value.slice(0, start) + insert + el.value.slice(end), start + insert.length);
  };
  const refreshMention = () => {
    const c = host.config();
    const el = field();
    if (!el || !c.mentionItems.length) return;
    const match = findTrigger(el.value, el.selectionStart ?? el.value.length, c.triggers);
    if (!match) {
      if (host.state().mention) host.update({ mention: null });
      return;
    }
    const options = filterMentions(c.mentionItems, match.query);
    const prev = host.state().mention;
    host.update({
      mention: options.length
        ? { match, options, index: prev && prev.match.start === match.start ? Math.min(prev.index, options.length - 1) : 0 }
        : null,
    });
  };
  const chooseMention = (item: MentionItem) => {
    const s = host.state();
    const el = field();
    if (!s.mention || !el) return;
    const next = insertMention(el.value, s.mention.match, item);
    host.update({ mention: null, chosen: [...s.chosen.filter((m) => m.id !== item.id), item] });
    setText(next.text, next.caret);
    el.focus();
  };
  const addFiles = (list: FileList | readonly File[] | null) => {
    if (!list?.length) return;
    const c = host.config();
    const s = host.state();
    const room = Math.max(0, c.maxFiles - s.files.length);
    const added = [...list].slice(0, room).map((file) => ({
      id: `f${++live.seq}`,
      name: file.name,
      size: file.size,
      type: file.type,
      preview: file.type.startsWith("image/") && typeof URL.createObjectURL === "function" ? URL.createObjectURL(file) : undefined,
      file,
    }));
    if (!added.length) return;
    host.update({ files: [...s.files, ...added] });
    host.emit("attach", { files: added.map((f) => f.file) });
  };
  const removeFile = (id: string) => {
    const s = host.state();
    const gone = s.files.find((f) => f.id === id);
    if (gone?.preview?.startsWith("blob:")) URL.revokeObjectURL(gone.preview);
    const index = s.files.findIndex((f) => f.id === id);
    host.update({ files: s.files.filter((f) => f.id !== id) });
    host.emit("remove-attachment", { id, name: gone?.name });
    requestAnimationFrame(() => {
      const chips = root.querySelectorAll<HTMLButtonElement>(".z-composer__remove");
      (chips[Math.min(index, chips.length - 1)] ?? field())?.focus();
    });
  };

  const send = () => {
    const c = host.config();
    const s = host.state();
    if (c.disabled || busy(c) || s.recording) return;
    const el = field();
    const raw = (el?.value ?? s.text).trim();
    if (!raw && !s.files.length) return;
    const detail: ComposerSend = {
      text: c.mentionItems.length ? encodeMentions(raw, s.chosen, c.triggers[0] ?? "@") : raw,
      attachments: s.files,
      replyTo: c.replyTo?.id,
      editing: c.editing?.id,
    };
    host.update({ files: [], chosen: [], mention: null, emojiOpen: false });
    setText("");
    host.emit("send", detail);
    el?.focus();
  };

  // Grabación de voz: mejora progresiva. Sin MediaRecorder o sin permiso, el botón no aparece o avisa.
  const stopTracks = () => {
    for (const t of live.stream?.getTracks() ?? []) t.stop();
    live.stream = null;
    clearInterval(live.timer);
    live.timer = undefined;
    void live.context?.close?.().catch?.(() => {});
    live.context = null;
  };
  const startRecording = async () => {
    const win = root.ownerDocument.defaultView as Window & { MediaRecorder?: typeof MediaRecorder; AudioContext?: typeof AudioContext };
    try {
      const stream = await win.navigator.mediaDevices.getUserMedia({ audio: true });
      const Recorder = win.MediaRecorder!;
      const recorder = new Recorder(stream);
      live.recorder = recorder;
      live.stream = stream;
      live.chunks = [];
      live.levels = [];
      live.cancelled = false;
      // Nivel de la señal cada 100 ms para dibujar la onda de la nota (si hay Web Audio).
      try {
        const Ctx = win.AudioContext;
        if (Ctx) {
          const ctx = new Ctx();
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 512;
          ctx.createMediaStreamSource(stream).connect(analyser);
          const buf = new Float32Array(analyser.fftSize);
          live.context = ctx;
          const sample = () => {
            analyser.getFloatTimeDomainData(buf);
            let peak = 0;
            for (const v of buf) peak = Math.max(peak, Math.abs(v));
            live.levels.push(peak);
          };
          const id = setInterval(sample, 100);
          recorder.addEventListener("stop", () => clearInterval(id), { once: true });
        }
      } catch {
        live.context = null;
      }
      recorder.addEventListener("dataavailable", (e) => {
        if (e.data.size) live.chunks.push(e.data);
      });
      recorder.addEventListener(
        "stop",
        () => {
          const rec = host.state().recording;
          const duration = rec ? (Date.now() - rec.startedAt) / 1000 : 0;
          stopTracks();
          host.update({ recording: null });
          if (live.cancelled || !live.chunks.length) return;
          const blob = new Blob(live.chunks, { type: recorder.mimeType || "audio/webm" });
          host.emit("voice", { blob, duration, peaks: peaksFrom(live.levels, 40), type: blob.type } satisfies ComposerVoice);
        },
        { once: true },
      );
      recorder.start();
      const startedAt = Date.now();
      host.update({ recording: { startedAt, elapsed: 0 } });
      live.timer = setInterval(() => {
        const rec = host.state().recording;
        if (rec) host.update({ recording: { ...rec, elapsed: Math.floor((Date.now() - rec.startedAt) / 1000) } });
      }, 1000);
      requestAnimationFrame(() => root.querySelector<HTMLButtonElement>(".z-composer__record-send")?.focus());
    } catch {
      stopTracks();
      announce(host.config().labels.micError, { source: root, politeness: "assertive" });
      host.emit("record-error", {});
    }
  };
  const stopRecording = (cancel: boolean) => {
    live.cancelled = cancel;
    if (live.recorder && live.recorder.state !== "inactive") live.recorder.stop();
    else {
      stopTracks();
      host.update({ recording: null });
    }
    requestAnimationFrame(() => field()?.focus());
  };

  const onSubmit = (event: SubmitEvent) => {
    if (!(event.target as Element).matches?.(".z-composer__form")) return;
    event.preventDefault();
    send();
  };
  const onInput = (event: Event) => {
    const target = event.target as HTMLElement;
    if (target.matches?.(".z-emoji-picker__field")) {
      setPicker({ query: (target as HTMLInputElement).value, active: 0 });
      return;
    }
    if (!target.matches?.(".z-composer__input")) return;
    const value = (target as HTMLTextAreaElement).value;
    host.update({ text: value });
    host.emit("value-change", { value });
    autosize();
    refreshMention();
  };
  const onKey = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement;
    const c = host.config();
    const s = host.state();
    const picker = root.querySelector<HTMLElement>(".z-emoji-picker");
    if (picker && emojiToneKey(event, picker, setPicker)) return;
    if (target.matches?.(".z-emoji-picker__field")) {
      const result = emojiPickerKey(event, pickerConfig(), s.picker, setPicker);
      if (result === "close") {
        host.update({ emojiOpen: false });
        field()?.focus();
      } else if (result) insertAtCaret(result);
      return;
    }
    if (event.key === "Escape" && s.emojiOpen) {
      event.preventDefault();
      host.update({ emojiOpen: false });
      field()?.focus();
      return;
    }
    if (!target.matches?.(".z-composer__input")) return;
    if (s.mention) {
      const { options, index } = s.mention;
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const next = (index + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length;
        host.update({ mention: { ...s.mention, index: next } });
        return;
      }
      if ((event.key === "Enter" || event.key === "Tab") && !event.shiftKey && !event.isComposing && event.keyCode !== 229) {
        event.preventDefault();
        chooseMention(options[index]!);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        host.update({ mention: null });
        return;
      }
    }
    if (event.key === "Escape" && (c.replyTo || c.editing || (c.kind === "prompt" && c.quote))) {
      event.preventDefault();
      host.emit(c.editing ? "cancel-edit" : c.kind === "prompt" && c.quote ? "quote-remove" : "cancel-reply", {});
      return;
    }
    if (event.key !== "Enter") return;
    const mod = event.ctrlKey || event.metaKey;
    const submit = c.sendOn === "enter" ? !event.shiftKey && !event.altKey : mod;
    if (!submit) return;
    // Intro confirma un candidato del IME: no envía.
    event.preventDefault();
    if (event.isComposing || event.keyCode === 229) return;
    if (busy(c)) return;
    root.querySelector<HTMLFormElement>(".z-composer__form")?.requestSubmit();
  };
  const onKeyUp = (event: KeyboardEvent) => {
    if (
      (event.target as Element).matches?.(".z-composer__input") &&
      (event.key === "ArrowLeft" || event.key === "ArrowRight" || event.key === "Home" || event.key === "End")
    )
      refreshMention();
  };
  const onClick = (event: MouseEvent) => {
    const target = event.target as Element | null;
    if (!target || !root.contains(target)) return;
    const picker = root.querySelector<HTMLElement>(".z-emoji-picker");
    if (picker?.contains(target)) {
      const char = emojiPickerClick(target, picker, host.state().picker, setPicker);
      if (char) insertAtCaret(char);
      return;
    }
    if (target.closest(".z-composer__attach")) {
      root.querySelector<HTMLInputElement>(".z-composer__files")?.click();
      return;
    }
    if (target.closest(".z-composer__emoji")) {
      const open = !host.state().emojiOpen;
      host.update({ emojiOpen: open });
      if (open) {
        ensureEmojiSet(pickerConfig(), host.state().picker, setPicker);
        requestAnimationFrame(() => root.querySelector<HTMLInputElement>(".z-emoji-picker__field")?.focus());
      }
      return;
    }
    const remove = target.closest<HTMLElement>(".z-composer__remove");
    if (remove?.dataset.id) {
      removeFile(remove.dataset.id);
      return;
    }
    if (target.closest(".z-composer__cancel-context")) {
      const c = host.config();
      host.emit(c.editing ? "cancel-edit" : c.kind === "prompt" && c.quote ? "quote-remove" : "cancel-reply", {});
      field()?.focus();
      return;
    }
    const ctx = target.closest<HTMLElement>(".z-composer__context-remove");
    if (ctx?.dataset.id) {
      host.emit("context-remove", { id: ctx.dataset.id });
      field()?.focus();
      return;
    }
    if (target.closest(".z-composer__record")) {
      void startRecording();
      return;
    }
    if (target.closest(".z-composer__record-send")) {
      stopRecording(false);
      return;
    }
    if (target.closest(".z-composer__record-cancel")) {
      stopRecording(true);
      return;
    }
    if (target.closest(".z-composer__stop")) {
      host.emit("stop", {});
      announce(host.config().labels.stopped, { source: root });
      return;
    }
    const option = target.closest<HTMLElement>(".z-composer__mention");
    if (option) {
      const item = host.state().mention?.options.find((o) => o.id === option.dataset.id);
      if (item) chooseMention(item);
      return;
    }
    const tool = target.closest<HTMLElement>(".z-composer__tool");
    if (tool?.dataset.tool) {
      const s = host.state();
      const active = !s.tools[tool.dataset.tool];
      host.update({ tools: { ...s.tools, [tool.dataset.tool]: active } });
      host.emit("tool-toggle", { id: tool.dataset.tool, active });
    }
  };
  const onChange = (event: Event) => {
    const target = event.target as HTMLElement;
    if (target.matches?.(".z-composer__files")) {
      const input = target as HTMLInputElement;
      addFiles(input.files);
      input.value = "";
      return;
    }
    if (target.matches?.(".z-composer__model select")) {
      const model = (target as HTMLSelectElement).value;
      host.update({ model });
      host.emit("model-change", { model });
    }
  };
  const onPaste = (event: ClipboardEvent) => {
    if (!(event.target as Element).matches?.(".z-composer__input") || !host.config().attach) return;
    const files = [...(event.clipboardData?.files ?? [])];
    if (files.length) {
      event.preventDefault();
      addFiles(files);
    }
  };
  const onDragOver = (event: DragEvent) => {
    if (host.config().attach && event.dataTransfer?.types.includes("Files")) {
      event.preventDefault();
      root.dataset.drop = "";
    }
  };
  const onDragLeave = (event: DragEvent) => {
    if (!root.contains(event.relatedTarget as Node | null)) delete root.dataset.drop;
  };
  const onDrop = (event: DragEvent) => {
    delete root.dataset.drop;
    if (!host.config().attach || !event.dataTransfer?.files.length) return;
    event.preventDefault();
    addFiles(event.dataTransfer.files);
  };
  const onFocusOut = (event: FocusEvent) => {
    // Al salir de la pieza se cierran el selector y la lista de menciones.
    if (root.contains(event.relatedTarget as Node | null)) return;
    const s = host.state();
    if (s.emojiOpen || s.mention) host.update({ emojiOpen: false, mention: null });
  };
  root.addEventListener("submit", onSubmit);
  root.addEventListener("input", onInput);
  root.addEventListener("keydown", onKey);
  root.addEventListener("keyup", onKeyUp);
  root.addEventListener("click", onClick);
  root.addEventListener("change", onChange);
  root.addEventListener("paste", onPaste);
  root.addEventListener("dragover", onDragOver);
  root.addEventListener("dragleave", onDragLeave);
  root.addEventListener("drop", onDrop);
  root.addEventListener("focusout", onFocusOut);
  return () => {
    followScrollEdges(root, null);
    root.removeEventListener("submit", onSubmit);
    root.removeEventListener("input", onInput);
    root.removeEventListener("keydown", onKey);
    root.removeEventListener("keyup", onKeyUp);
    root.removeEventListener("click", onClick);
    root.removeEventListener("change", onChange);
    root.removeEventListener("paste", onPaste);
    root.removeEventListener("dragover", onDragOver);
    root.removeEventListener("dragleave", onDragLeave);
    root.removeEventListener("drop", onDrop);
    root.removeEventListener("focusout", onFocusOut);
    live.cancelled = true;
    if (live.recorder && live.recorder.state !== "inactive") live.recorder.stop();
    stopTracks();
    for (const f of host.state().files) if (f.preview?.startsWith("blob:")) URL.revokeObjectURL(f.preview);
    lives.delete(root);
  };
}

function tree(kind: "chat" | "prompt") {
  return (c: Config, s: State, uid: string) => {
    const { labels } = c;
    const isBusy = busy(c);
    const empty = !s.text.trim() && !s.files.length;
    const recordable = kind === "chat" && c.voice && s.canRecord && empty && !c.editing;
    // En PromptInput, el micrófono va junto a enviar (no lo sustituye).
    const micButton: VNode =
      kind === "prompt" && c.voice && s.canRecord && !s.recording && !isBusy
        ? h(
            "button",
            {
              type: "button",
              class: "z-btn z-btn--ghost z-btn--icon z-composer__record z-composer__mic",
              "data-size": "md",
              "aria-label": labels.record,
              title: labels.record,
              disabled: c.disabled,
            },
            icon("microphone", 18),
          )
        : null;
    const remaining = c.maxLength ? c.maxLength - s.text.length : null;
    const context = c.editing
      ? { icon: "pencil", title: labels.editing, text: c.editing.text, cancel: labels.cancelEdit }
      : kind === "prompt" && c.quote
        ? { icon: "arrow-turn-down-left", title: labels.quoting, text: c.quote.text, cancel: labels.removeQuote, quote: true }
        : c.replyTo
        ? {
            icon: "arrow-turn-up-left",
            title: fill(labels.replyingTo, { name: c.replyTo.author ?? "" }),
            text: c.replyTo.text ?? "",
            cancel: labels.cancelReply,
          }
        : null;
    const mention = s.mention;
    const mentionId = (i: number) => `${uid}-mention-${i}`;
    const fieldId = `${uid}-field`;
    const ratio = c.usage ? usageRatio(c.usage.used, c.usage.limit) : 0;
    const sendButton: VNode = isBusy
      ? h(
          "button",
          {
            type: "button",
            class: "z-composer__send z-composer__stop",
            "aria-label": labels.stop,
            title: labels.stop,
            "data-mode": "stop",
          },
          icon("stop", 16),
        )
      : s.recording
        ? null
        : recordable
          ? h(
              "button",
              {
                type: "button",
                class: "z-composer__send z-composer__record",
                "aria-label": labels.record,
                title: labels.record,
                "data-mode": "record",
                disabled: c.disabled,
              },
              icon("microphone", 18),
            )
          : h(
              "button",
              {
                type: "submit",
                class: "z-composer__send",
                "aria-label": c.editing ? labels.save : labels.send,
                title: c.editing ? labels.save : labels.send,
                "data-mode": "send",
                disabled: c.disabled,
                "aria-disabled": empty ? "true" : undefined,
              },
              icon(c.editing ? "check" : kind === "prompt" ? "arrow-up" : "paper-airplane", 18),
            );
    return h(
      "div",
      {
        class: kind === "prompt" ? "z-composer z-prompt-input" : "z-composer",
        "data-kind": kind,
        "data-status": kind === "prompt" ? c.status : undefined,
        "data-disabled": on(c.disabled),
        "data-recording": on(Boolean(s.recording)),
        "data-halo": on(kind === "prompt" && c.halo),
      },
      h(
        "form",
        { class: "z-composer__form", "aria-busy": isBusy ? "true" : undefined },
        context
          ? h(
              "div",
              { class: "z-composer__context", "data-quote": on(Boolean((context as { quote?: boolean }).quote)) },
              h("span", { class: "z-composer__context-icon", "aria-hidden": "true" }, icon(context.icon, 16)),
              h(
                "span",
                { class: "z-composer__context-body" },
                h("span", { class: "z-composer__context-title" }, context.title),
                h("span", { class: "z-composer__context-text" }, context.text),
              ),
              h(
                "button",
                {
                  type: "button",
                  class: "z-btn z-btn--ghost z-btn--icon z-composer__cancel-context",
                  "data-size": "sm",
                  "aria-label": context.cancel,
                  title: context.cancel,
                },
                icon("x-mark", 14),
              ),
            )
          : null,
        kind === "prompt" && c.contexts.length
          ? h(
              "ul",
              { class: "z-composer__contexts", "aria-label": labels.contexts },
              ...c.contexts.map((x) =>
                h(
                  "li",
                  { class: "z-composer__context-chip", key: x.id },
                  x.icon ? h("span", { class: "z-composer__context-chip-icon", "aria-hidden": "true" }, icon(x.icon, 14)) : null,
                  h("span", { class: "z-composer__context-chip-label" }, x.label),
                  h(
                    "button",
                    {
                      type: "button",
                      class: "z-composer__context-remove",
                      "data-id": x.id,
                      "aria-label": fill(labels.remove, { name: x.label }),
                      title: fill(labels.remove, { name: x.label }),
                    },
                    icon("x-mark", 12),
                  ),
                ),
              ),
            )
          : null,
        s.files.length
          ? h(
              "ul",
              { class: "z-composer__attachments", "aria-label": labels.attachments },
              ...s.files.map((f) =>
                h(
                  "li",
                  { class: "z-composer__attachment", key: f.id },
                  f.preview
                    ? h("img", { class: "z-composer__thumb", src: f.preview, alt: "" })
                    : h("span", { class: "z-composer__thumb", "aria-hidden": "true" }, icon("document-text", 18)),
                  h(
                    "span",
                    { class: "z-composer__file" },
                    h("span", { class: "z-composer__file-name" }, f.name),
                    f.size !== undefined ? h("span", { class: "z-composer__file-size" }, formatByte(f.size, c.locale)) : null,
                  ),
                  h(
                    "button",
                    {
                      type: "button",
                      class: "z-composer__remove",
                      "data-id": f.id,
                      "aria-label": fill(labels.remove, { name: f.name }),
                      title: fill(labels.remove, { name: f.name }),
                    },
                    icon("x-mark", 12),
                  ),
                ),
              ),
            )
          : null,
        s.recording
          ? h(
              "div",
              { class: "z-composer__recording" },
              h("span", { class: "z-composer__rec-hint", "aria-hidden": "true" }, labels.recordingHint),
              h(
                "button",
                {
                  type: "button",
                  class: "z-btn z-btn--ghost z-btn--icon z-composer__record-cancel",
                  "aria-label": labels.cancelRecording,
                  title: labels.cancelRecording,
                },
                icon("trash", 18),
              ),
              h("span", { class: "z-composer__rec-dot", "aria-hidden": "true" }),
              h(
                "span",
                {
                  class: "z-composer__rec-time",
                  role: "timer",
                  "aria-label": fill(labels.recording, { time: clockText(s.recording.elapsed) }),
                },
                clockText(s.recording.elapsed),
              ),
              h(
                "span",
                { class: "z-composer__rec-wave", "aria-hidden": "true" },
                ...Array.from({ length: 24 }, (_, i) => h("span", { key: String(i), class: "z-composer__rec-bar" })),
              ),
              h(
                "button",
                {
                  type: "button",
                  class: "z-composer__send z-composer__record-send",
                  "aria-label": labels.sendRecording,
                  title: labels.sendRecording,
                },
                icon("paper-airplane", 18),
              ),
            )
          : h(
              "div",
              { class: "z-composer__row" },
              c.attach || c.emoji
                ? h(
                    "div",
                    { class: "z-composer__tools" },
                    c.attach
                      ? h(
                          "button",
                          {
                            type: "button",
                            class: "z-btn z-btn--ghost z-btn--icon z-composer__attach",
                            "data-size": "md",
                            "aria-label": labels.attach,
                            title: labels.attach,
                            disabled: c.disabled,
                          },
                          icon(kind === "prompt" ? "plus" : "paper-clip", 20),
                        )
                      : null,
                    c.emoji && kind === "chat"
                      ? h(
                          "button",
                          {
                            type: "button",
                            class: "z-btn z-btn--ghost z-btn--icon z-composer__emoji",
                            "data-size": "md",
                            "aria-label": labels.emoji,
                            title: labels.emoji,
                            "aria-expanded": s.emojiOpen ? "true" : "false",
                            "aria-controls": `${uid}-emoji`,
                            disabled: c.disabled,
                          },
                          icon("face-smile", 20),
                        )
                      : null,
                  )
                : null,
              h(
                "div",
                { class: "z-composer__field" },
                h("label", { class: "z-sr-only", for: fieldId }, labels.field),
                h("textarea", {
                  class: "z-composer__input",
                  id: fieldId,
                  rows: 1,
                  placeholder: c.placeholder,
                  enterkeyhint: c.sendOn === "enter" ? "send" : "enter",
                  maxlength: c.maxLength,
                  disabled: c.disabled,
                  autocomplete: "off",
                  "aria-describedby": remaining !== null && remaining < (c.maxLength ?? 0) * 0.2 ? `${uid}-remaining` : undefined,
                  ...(c.mentionItems.length
                    ? {
                        role: "combobox",
                        "aria-autocomplete": "list",
                        "aria-haspopup": "listbox",
                        "aria-expanded": mention ? "true" : "false",
                        "aria-controls": `${uid}-mentions`,
                        "aria-activedescendant": mention ? mentionId(mention.index) : undefined,
                      }
                    : {}),
                }),
                remaining !== null && remaining < (c.maxLength ?? 0) * 0.2
                  ? h(
                      "span",
                      { class: "z-composer__remaining", id: `${uid}-remaining`, "data-over": on(remaining <= 0) },
                      fill(labels.remaining, { n: Math.max(0, remaining) }),
                    )
                  : null,
              ),
              micButton,
              sendButton,
            ),
        kind === "prompt" && (c.models.length || c.tools.length || c.usage)
          ? h(
              "div",
              { class: "z-composer__footer" },
              c.models.length
                ? h(
                    "span",
                    { class: "z-select z-composer__model", "data-size": "sm" },
                    h(
                      "select",
                      { class: "z-select__control", "aria-label": labels.model, disabled: c.disabled },
                      ...c.models.map((m) =>
                        h("option", { key: m.id, value: m.id, selected: (s.model ?? c.models[0]?.id) === m.id }, m.label),
                      ),
                    ),
                    h("span", { class: "z-select__chevron" }, icon("chevron-up-down", 14)),
                  )
                : null,
              c.tools.length
                ? h(
                    "span",
                    { class: "z-composer__toolset", role: "group", "aria-label": labels.tools },
                    ...c.tools.map((t) =>
                      h(
                        "button",
                        {
                          type: "button",
                          class: "z-composer__tool",
                          key: t.id,
                          "data-tool": t.id,
                          "aria-pressed": s.tools[t.id] ? "true" : "false",
                          disabled: c.disabled,
                        },
                        t.icon ? icon(t.icon, 14) : null,
                        t.label,
                      ),
                    ),
                  )
                : null,
              c.usage
                ? h(
                    "span",
                    { class: "z-composer__usage", "data-level": usageLevel(ratio) },
                    h("meter", {
                      class: "z-composer__usage-meter",
                      min: 0,
                      max: c.usage.limit,
                      value: c.usage.used,
                      low: c.usage.limit * 0.8,
                      high: c.usage.limit * 0.95,
                      optimum: 0,
                      "aria-label": fill(labels.usage, {
                        used: compactTokens(c.usage.used, c.locale),
                        limit: compactTokens(c.usage.limit, c.locale),
                        percent: percentText(ratio, c.locale),
                      }),
                    }),
                    h("span", { class: "z-composer__usage-text", "aria-hidden": "true" }, percentText(ratio, c.locale)),
                  )
                : null,
            )
          : null,
        c.attach
          ? h(
              "div",
              { class: "z-composer__drop", "aria-hidden": "true" },
              h("span", { class: "z-composer__drop-icon" }, icon("arrow-up-tray", 20)),
              h("span", { class: "z-composer__drop-title" }, labels.dropTitle),
              h("span", { class: "z-composer__drop-hint" }, labels.dropHint),
            )
          : null,
        c.attach
          ? h("input", {
              class: "z-composer__files",
              type: "file",
              multiple: c.maxFiles > 1,
              accept: c.accept,
              hidden: true,
              tabindex: -1,
              "aria-hidden": "true",
            })
          : null,
      ),
      mention
        ? h(
            "ul",
            { class: "z-composer__mentions", id: `${uid}-mentions`, role: "listbox", "aria-label": labels.mentions },
            ...mention.options.map((o, i) =>
              h(
                "li",
                {
                  class: "z-composer__mention",
                  key: o.id,
                  id: mentionId(i),
                  role: "option",
                  "aria-selected": i === mention.index ? "true" : "false",
                  "data-id": o.id,
                },
                avatarNode({ name: o.label, avatar: o.avatar }, { size: "sm", decorative: true }),
                h(
                  "span",
                  { class: "z-composer__mention-body" },
                  h("span", { class: "z-composer__mention-label" }, o.label),
                  o.description ? h("span", { class: "z-composer__mention-description" }, o.description) : null,
                ),
              ),
            ),
          )
        : null,
      c.emoji && kind === "chat" && s.emojiOpen
        ? h(
            "div",
            { class: "z-composer__popover z-liquid", id: `${uid}-emoji` },
            emojiPickerTree(emojiPickerConfig({ data: c.emojiData, labels: labels.picker }), s.picker, `${uid}-picker`),
          )
        : null,
    );
  };
}

function makeWidget(root: "z-composer" | "z-prompt-input", kind: "chat" | "prompt"): Widget<ComposerProps, Config, State> {
  return {
    root,
    configure: (p) => {
      const labels = { ...(kind === "prompt" ? PROMPT_INPUT_LABELS : COMPOSER_LABELS), ...p.labels };
      const triggers =
        p.mentions?.trigger === undefined ? ["@"] : typeof p.mentions.trigger === "string" ? [p.mentions.trigger] : p.mentions.trigger;
      return {
        kind,
        value: p.value,
        defaultValue: p.defaultValue ?? "",
        sendOn: p.sendOn === "mod-enter" ? "mod-enter" : "enter",
        accept: p.accept,
        attach: p.attach !== false,
        maxFiles: Math.max(1, Math.floor(p.maxFiles ?? 10)),
        emoji: p.emoji !== false,
        emojiData: p.emojiData,
        voice: Boolean(p.voice),
        triggers,
        mentionItems: p.mentions?.items ?? [],
        replyTo: p.replyTo,
        editing: p.editing,
        maxLength: p.maxLength && p.maxLength > 0 ? Math.floor(p.maxLength) : undefined,
        disabled: Boolean(p.disabled),
        placeholder: p.placeholder ?? labels.placeholder,
        status: p.status ?? "ready",
        models: p.models ?? [],
        model: p.model,
        tools: p.tools ?? [],
        usage: p.usage,
        quote: p.quote,
        contexts: p.contexts ?? [],
        halo: Boolean(p.halo),
        locale: p.locale,
        labels,
      };
    },
    initial: (c) => ({
      text: c.value ?? c.editing?.text ?? c.defaultValue,
      files: [],
      emojiOpen: false,
      picker: emojiPickerInitial(emojiPickerConfig({ data: c.emojiData })),
      mention: null,
      chosen: [],
      recording: null,
      model: c.model,
      tools: Object.fromEntries(c.tools.map((t) => [t.id, Boolean(t.active)])),
      canRecord: false,
    }),
    control(c, s) {
      let next = s;
      if (c.value !== undefined && c.value !== s.text) next = { ...next, text: c.value };
      if (c.model !== undefined && c.model !== s.model) next = { ...next, model: c.model };
      return next;
    },
    tree: tree(kind),
    attach,
    after(rootEl, host) {
      // Pie del asistente (modelo, herramientas, uso): una fila que desplaza, con el borde oculto difuminado.
      followScrollEdges(rootEl, ".z-composer__footer");
      const live = lives.get(rootEl);
      const el = rootEl.querySelector<HTMLTextAreaElement>(".z-composer__input");
      const c = host.config();
      const s = host.state();
      if (el) {
        // Valor inicial, controlado o el del mensaje que se edita: se escribe en el campo sin pisar lo que se teclea.
        const editing = c.editing?.id;
        if (live && editing !== live.lastEditing) {
          live.lastEditing = editing;
          if (c.editing && el.value !== c.editing.text) {
            el.value = c.editing.text;
            host.update({ text: c.editing.text });
            el.focus();
            el.setSelectionRange(el.value.length, el.value.length);
          }
        }
        if (el.value !== s.text && (c.value !== undefined || !el.value)) el.value = s.text;
        if (!CSS.supports?.("field-sizing", "content")) {
          el.style.height = "auto";
          el.style.height = `${el.scrollHeight}px`;
        }
      }
      emojiPickerAfter(rootEl.querySelector(".z-emoji-picker"));
    },
    fromDom(el, json) {
      const d = el.dataset;
      return {
        defaultValue: d.defaultValue,
        sendOn: d.sendOn === "mod-enter" ? "mod-enter" : undefined,
        accept: d.accept,
        attach: d.attach === "false" ? false : undefined,
        maxFiles: d.maxFiles ? num(d.maxFiles, 10) : undefined,
        emoji: d.emoji === "false" ? false : undefined,
        voice: yes(d.voice),
        mentions: json.mentions as ComposerProps["mentions"],
        replyTo: json.replyTo as ComposerProps["replyTo"],
        editing: json.editing as ComposerProps["editing"],
        maxLength: d.maxLength ? num(d.maxLength, 0) : undefined,
        disabled: yes(d.disabled),
        placeholder: d.placeholder,
        status: d.status === "submitted" || d.status === "streaming" || d.status === "error" ? d.status : undefined,
        models: json.models as ComposerModel[] | undefined,
        model: d.model,
        tools: json.tools as ComposerTool[] | undefined,
        usage: json.usage as ComposerProps["usage"],
        quote: json.quote as ComposerProps["quote"],
        contexts: json.contexts as ComposerProps["contexts"],
        halo: yes(d.halo),
        locale: d.locale,
        labels: json.labels as Partial<ComposerLabels> | undefined,
      };
    },
  };
}

export const composerWidget = makeWidget("z-composer", "chat");
export const promptInputWidget = makeWidget("z-prompt-input", "prompt");

/** El navegador puede grabar notas de voz (MediaRecorder y micrófono). */
export const voiceRecordingSupported = (el: Element) => canRecord(el);
