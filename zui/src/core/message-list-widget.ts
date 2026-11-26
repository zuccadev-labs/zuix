// Lista de mensajes como pieza (core/widget): filas por día y autor (core/chat-group), burbujas (core/chat-tree),
// marca de no leídos, indicador de escritura, «ir al final» con los nuevos contados, historial hacia arriba sin saltos
// (se conserva el mensaje que había delante) y ventana virtual (core/virtual) con altos medidos cuando hay muchos.
// La lista es una sola parada de Tab: ↑/↓ entre mensajes, Inicio/Fin, RePág/AvPág, Intro a sus acciones, R responder y
// Escape a la caja de texto. Lo que llega en vivo no se lee desde el contenedor (leería lo propio, las ediciones y el
// historial): los mensajes nuevos de otros se anuncian por el anunciador central, cortos y agrupados.
import { localize } from "./locale";

import { announce } from "./announcer";
import { followAction, nearEnd, nearStart, pendingBelow, pickAnchor, restoreAnchor, type ScrollAnchor } from "./chat-anchor";
import {
  arrivalText,
  chatRows,
  dayKey,
  dayLabel,
  newArrivals,
  typingText,
  type ChatMessage,
  type ChatPerson,
  type ChatReaction,
  type ChatRow,
} from "./chat-group";
import { toggleReaction } from "./chat-widgets";
import {
  bubbleRow,
  CHAT_LABELS,
  dateNode,
  messageDomId,
  systemNode,
  typingNode,
  unreadNode,
  type ChatLabels,
  type MessageAction,
  type VoiceState,
} from "./chat-tree";
import { copyText } from "./clipboard";
import { isRtl } from "./dir";
import { QUICK_REACTIONS } from "./emoji-data";
import { renderIndices, virtualWindow } from "./virtual";
import { measureInto } from "./virtual-widget";
import { fractionAt, seekAudio, seekKey, toggleAudio, watchAudio } from "./voice-control";
import { nextRate } from "./waveform";
import { fill, h, icon, on, type VEl, type VNode } from "./vnode";
import { list, num, yes, type Widget, type WidgetHost } from "./widget";

export interface MessageListLabels extends ChatLabels {
  /** Nombre de la región. */
  list: string;
  /** «Jump to latest». */
  latest: string;
  /** «{n} new messages» (en el botón de ir al final). */
  newBelow: string;
  loadOlder: string;
  loadingOlder: string;
  copied: string;
  /** Anuncios de llegada: «{name}: {text}», «{n} new messages from {name}», «{n} new messages». */
  arrivalOne: string;
  arrivalFromOne: string;
  arrivalMany: string;
}

export const MESSAGE_LIST_LABELS: MessageListLabels = {
  ...CHAT_LABELS,
  list: "Messages",
  latest: "Jump to latest",
  newBelow: "{n} new messages",
  loadOlder: "Load earlier messages",
  loadingOlder: "Loading earlier messages…",
  copied: "Copied",
  arrivalOne: "{name}: {text}",
  arrivalFromOne: "{n} new messages from {name}",
  arrivalMany: "{n} new messages",
};

export interface MessageListProps {
  messages?: readonly ChatMessage[];
  /** Quién es la persona actual: sus mensajes van a la derecha, con estado de entrega. */
  currentUserId?: string;
  /** Conversación de grupo: nombre del autor y avatar en los mensajes de otros. */
  group?: boolean;
  /** Ventana para agrupar mensajes seguidos del mismo autor (ms). 5 minutos. */
  groupWithin?: number;
  timeZone?: string;
  locale?: string;
  hourCycle?: "h12" | "h23";
  /** Primer mensaje sin leer: lleva la marca delante. */
  unreadFrom?: string;
  /** Dónde se abre: al final (por defecto), en el primer no leído o en un mensaje. */
  initialAnchor?: "end" | "first-unread" | (string & {});
  /** Hay mensajes anteriores que pedir con `onLoadOlder`. */
  hasOlder?: boolean;
  /** Pidiendo historial: se muestra en la cabecera de la lista y no se vuelve a pedir. */
  loadingOlder?: boolean;
  /** Quiénes escriben ahora. */
  typing?: readonly ChatPerson[];
  /** Texto buscado: las coincidencias se marcan. */
  highlight?: string;
  /** Nombres de las menciones `<@id>` del texto (miembros de la conversación). */
  mentions?: readonly { id: string; label: string }[];
  /** Acciones de la barra de cada mensaje (`false`: sin barra). */
  actions?: readonly MessageAction[] | false;
  /** Reacciones rápidas (seis por defecto). */
  quickReactions?: readonly string[];
  /** Ventana virtual a partir de este número de filas (`false`: nunca). 150 por defecto. */
  virtualize?: number | false;
  /** Qué se anuncia: los mensajes nuevos de otros (por defecto), todo como `role="log"`, o nada. */
  announce?: "new" | "log" | "none";
  /** Nombre de la región. */
  label?: string;
  /** Elemento al que vuelve el foco con Escape (la caja de texto). */
  composer?: string;
  /** Instante «ahora» (pruebas, render en servidor). */
  now?: number;
  labels?: Partial<MessageListLabels>;
}

interface Config {
  messages: readonly ChatMessage[];
  me?: string;
  group: boolean;
  groupWithin?: number;
  timeZone?: string;
  locale?: string;
  hourCycle?: "h12" | "h23";
  unreadFrom?: string;
  anchor: string;
  hasOlder: boolean;
  loadingOlder: boolean;
  typing: readonly ChatPerson[];
  highlight: string;
  mention?: (id: string) => string | undefined;
  actions: readonly MessageAction[] | false;
  quick: readonly string[];
  virtualize: number | false;
  announce: "new" | "log" | "none";
  label: string;
  composer?: string;
  now?: number;
  labels: MessageListLabels;
}

interface State {
  active: string | null;
  reacting: string | null;
  flash: string | null;
  voice: Readonly<Record<string, VoiceState>>;
  pending: number;
  away: boolean;
  /** Día de lo que se ve arriba, en la pastilla flotante que aparece solo mientras se desplaza. */
  day: string | null;
  scrolling: boolean;
  scroll: number;
  viewport: number;
  /** Altos medidos por clave de fila (mutable, compartido entre pintados). */
  heights: Map<string, number>;
  version: number;
  /** Reacciones propias puestas o quitadas aquí antes de que la aplicación responda: `base` es la firma de las suyas. */
  reactions: Readonly<Record<string, { base: string; items: ChatReaction[] }>>;
}

type Host = WidgetHost<Config, State>;

const ESTIMATE: Record<ChatRow["kind"], number> = { date: 44, unread: 40, system: 36, message: 64 };

const rowsOf = (c: Config) =>
  chatRows(c.messages, { currentUserId: c.me, groupWithin: c.groupWithin, timeZone: c.timeZone, unreadFrom: c.unreadFrom, group: c.group });
const messageIds = (rows: readonly ChatRow[]) => rows.filter((r) => r.kind === "message").map((r) => r.key);

// Nodo de cada fila memorizado por mensaje y por todo lo que cambia su pintado: lo que no cambió no se recorre.
const rowCache = new WeakMap<ChatMessage, { sig: string; node: VEl }>();

function rowNode(row: ChatRow, c: Config, s: State, uid: string, today: string, now: number): VNode {
  if (row.kind === "date") return dateNode(dayLabel(row.day, today, c.labels, c.locale), row.at, row.key, c.timeZone);
  if (row.kind === "unread") return unreadNode(row.count, c.labels, row.key);
  if (row.kind === "system") return systemNode(row.message, row.key);
  const original = row.message;
  const local = s.reactions[original.id];
  const m = local ? { ...original, reactions: local.items } : original;
  const voice = s.voice[m.id];
  const sig = [
    row.position,
    row.showAuthor,
    row.showAvatar,
    s.active === m.id,
    s.flash === m.id,
    s.reacting === m.id,
    voice ? `${voice.playing}:${voice.position.toFixed(1)}:${voice.rate}` : "",
    c.highlight,
    c.group,
    m.thread ? Math.floor(now / 60000) : 0,
    local ? JSON.stringify(local.items) : "",
  ].join("|");
  const hit = rowCache.get(original);
  if (hit && hit.sig === sig) return hit.node;
  const node = bubbleRow(
    { message: m, mine: row.mine, position: row.position, showAuthor: row.showAuthor, showAvatar: row.showAvatar, group: c.group },
    {
      labels: c.labels,
      uid,
      locale: c.locale,
      timeZone: c.timeZone,
      hourCycle: c.hourCycle,
      now,
      active: s.active === m.id,
      flash: s.flash === m.id,
      highlight: c.highlight,
      mention: c.mention,
      voice,
      actions: c.actions === false ? [] : c.actions,
      reacting: s.reacting === m.id,
      quick: c.quick,
    },
  );
  node.a = { ...node.a, "data-key": row.key };
  node.m = true;
  rowCache.set(original, { sig, node });
  return node;
}

/** API de una lista montada (React: `ref`; modo DOM: `messageList(el)`). */
export interface MessageListApi {
  /** Va al final (con el foco en el último mensaje si `focus`). */
  scrollToEnd(focus?: boolean): void;
  /** Lleva a un mensaje, lo resalta y le da el foco. */
  jumpTo(id: string): boolean;
  focus(): void;
}

const apis = new WeakMap<HTMLElement, MessageListApi>();
export const messageListApi = (el: HTMLElement | null | undefined): MessageListApi | null => (el ? (apis.get(el) ?? null) : null);

interface Live {
  mounted: boolean;
  stick: boolean;
  anchor: ScrollAnchor | null;
  firstId: string | null;
  lastId: string | null;
  known: Set<string>;
  arrivals: ChatMessage[];
  arrivalTimer: ReturnType<typeof setTimeout> | undefined;
  typingSeen: Set<string>;
  typingTimer: ReturnType<typeof setTimeout> | undefined;
  askedOlder: boolean;
  wasLoading: boolean;
  scrollTimer: ReturnType<typeof setTimeout> | undefined;
  measureFrame: number;
  flashTimer: ReturnType<typeof setTimeout> | undefined;
  unwatch: Map<string, () => void>;
}
const lives = new WeakMap<HTMLElement, Live>();

const reduced = (el: Element) => el.ownerDocument.defaultView?.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? true;

function attach(root: HTMLElement, host: Host): () => void {
  const live: Live = {
    mounted: false,
    stick: true,
    anchor: null,
    firstId: null,
    lastId: null,
    known: new Set(),
    arrivals: [],
    arrivalTimer: undefined,
    typingSeen: new Set(),
    typingTimer: undefined,
    askedOlder: false,
    wasLoading: false,
    scrollTimer: undefined,
    measureFrame: 0,
    flashTimer: undefined,
    unwatch: new Map(),
  };
  lives.set(root, live);
  const viewport = () => root.querySelector<HTMLElement>(".z-message-list__viewport");
  const article = (id: string) => root.ownerDocument.getElementById(messageDomId(root.id, id));
  const ids = () => messageIds(rowsOf(host.config()));
  const message = (id: string) => host.config().messages.find((m) => m.id === id);

  const scrollToEnd = (focus = false, smooth = false) => {
    const vp = viewport();
    live.stick = true;
    const list = ids();
    host.update(
      { pending: 0, away: false, scroll: Number.MAX_SAFE_INTEGER, ...(focus && list.length ? { active: list[list.length - 1]! } : {}) },
      focus,
    );
    if (vp) vp.scrollTo({ top: vp.scrollHeight, behavior: smooth && !reduced(root) ? "smooth" : "auto" });
  };
  const jumpTo = (id: string) => {
    if (!message(id)) return false;
    live.stick = false;
    clearTimeout(live.flashTimer);
    host.update({ active: id, flash: id, reacting: null }, true);
    live.flashTimer = setTimeout(() => host.update({ flash: null }), 1600);
    const el = article(id);
    el?.scrollIntoView({ block: "center", behavior: reduced(root) ? "auto" : "smooth" });
    return true;
  };
  apis.set(root, {
    scrollToEnd: (focus) => scrollToEnd(Boolean(focus), true),
    jumpTo,
    focus: () => {
      const s = host.state();
      const target = (s.active && article(s.active)) || root.querySelector<HTMLElement>('.z-message[tabindex="0"]');
      target?.focus({ preventScroll: false });
    },
  });

  const onScroll = (event: Event) => {
    const vp = event.target as HTMLElement;
    if (!vp.matches?.(".z-message-list__viewport")) return;
    const end = nearEnd(vp);
    live.stick = end;
    const rows = [...vp.querySelectorAll<HTMLElement>(":scope > ol > li[data-key]")].map((li) => ({
      key: li.dataset.key!,
      top: li.offsetTop,
      height: li.offsetHeight,
    }));
    live.anchor = pickAnchor(rows, vp.scrollTop);
    const s = host.state();
    const c = host.config();
    if (nearStart(vp, 160) && c.hasOlder && !c.loadingOlder && !live.askedOlder) {
      live.askedOlder = true;
      host.emit("load-older", {});
    }
    const patch: Partial<State> = {};
    // Día de lo que queda arriba: una pastilla flotante mientras se desplaza (no tapa nada en reposo) y oculta si el
    // separador de ese día ya está a la vista arriba.
    const first = live.anchor ? vp.querySelector<HTMLElement>(`:scope > ol > li[data-key="${CSS.escape(live.anchor.key)}"]`) : null;
    const iso = first?.querySelector("time")?.getAttribute("datetime");
    const separatorAtTop = [...vp.querySelectorAll<HTMLElement>(".z-date-separator")].some(
      (sep) => sep.offsetTop + sep.offsetHeight > vp.scrollTop && sep.offsetTop < vp.scrollTop + 56,
    );
    const at = iso ? Date.parse(iso) : Number.NaN;
    const now = c.now ?? Date.now();
    const day =
      Number.isFinite(at) && !separatorAtTop && vp.scrollTop > 0
        ? dayLabel(dayKey(at, c.timeZone ?? ""), dayKey(now, c.timeZone ?? ""), c.labels, c.locale)
        : null;
    if (day !== s.day) patch.day = day;
    if (!s.scrolling) patch.scrolling = true;
    clearTimeout(live.scrollTimer);
    live.scrollTimer = setTimeout(() => host.update({ scrolling: false }), 1200);
    if (s.away === end) patch.away = !end;
    if (end && s.pending) {
      patch.pending = 0;
      host.emit("reach-end", {});
    }
    const total = rowsOf(c).length;
    if (c.virtualize !== false && total > c.virtualize && Math.abs(vp.scrollTop - s.scroll) > 40) patch.scroll = vp.scrollTop;
    if (Object.keys(patch).length) host.update(patch);
  };

  const move = (from: string | null, key: string): string | null => {
    const list = ids();
    if (!list.length) return null;
    const i = from ? list.indexOf(from) : list.length - 1;
    const vp = viewport();
    const page = Math.max(1, Math.round((vp?.clientHeight ?? 400) / 80));
    if (key === "ArrowUp") return list[Math.max(0, i - 1)]!;
    if (key === "ArrowDown") return list[Math.min(list.length - 1, i + 1)]!;
    if (key === "PageUp") return list[Math.max(0, i - page)]!;
    if (key === "PageDown") return list[Math.min(list.length - 1, i + page)]!;
    if (key === "Home") return list[0]!;
    if (key === "End") return list[list.length - 1]!;
    return null;
  };

  const onKey = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement;
    const c = host.config();
    const s = host.state();
    // Dentro de la barra de acciones de un mensaje: flechas entre botones, Escape vuelve al mensaje.
    const bar = target.closest?.<HTMLElement>(".z-message__actions");
    if (bar && root.contains(bar)) {
      const buttons = [...bar.querySelectorAll<HTMLButtonElement>("button")];
      const i = buttons.indexOf(target as HTMLButtonElement);
      const rtl = isRtl(bar);
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
      if (next !== null && buttons.length) {
        event.preventDefault();
        const to = buttons[(next + buttons.length) % buttons.length]!;
        for (const b of buttons) b.tabIndex = b === to ? 0 : -1;
        to.focus();
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        const id = bar.closest<HTMLElement>(".z-message-row")?.querySelector<HTMLElement>(".z-message")?.dataset.id;
        if (s.reacting) host.update({ reacting: null });
        if (id) article(id)?.focus();
      }
      return;
    }
    const wave = target.closest?.<HTMLElement>(".z-voice-note__wave");
    if (wave) {
      const id = wave.closest<HTMLElement>(".z-message")?.dataset.id;
      const m = id ? message(id) : undefined;
      const voice = m?.attachments?.find((a) => a.kind === "voice");
      if (id && voice && voice.kind === "voice") {
        const pos = s.voice[id]?.position ?? 0;
        const next = seekKey(event.key, pos, voice.duration, isRtl(wave));
        if (next !== null) {
          event.preventDefault();
          event.stopPropagation();
          seekAudio(root.ownerDocument.getElementById(`${root.id}-audio-${id}`) as HTMLAudioElement | null, next);
          setVoice(id, { position: next });
        }
      }
      return;
    }
    const msg = target.closest?.<HTMLElement>(".z-message");
    if (!msg || target !== msg || !root.contains(msg)) {
      if (event.key === "Escape" && c.composer) {
        const composer = root.ownerDocument.getElementById(c.composer.replace(/^#/, ""));
        if (composer) {
          event.preventDefault();
          (composer.querySelector<HTMLElement>("textarea, input") ?? composer).focus();
        }
      }
      return;
    }
    const id = msg.dataset.id!;
    const next = move(id, event.key);
    if (next !== null) {
      event.preventDefault();
      live.stick = false;
      if (event.key === "ArrowUp" && next === id && c.hasOlder && !c.loadingOlder) {
        live.askedOlder = true;
        host.emit("load-older", {});
      }
      host.update({ active: next, reacting: null }, true);
      return;
    }
    if (event.key === "Enter" || event.key === "F10") {
      const first = msg.closest(".z-message-row")?.querySelector<HTMLButtonElement>(".z-message__actions button");
      if (first) {
        event.preventDefault();
        first.focus();
      }
      return;
    }
    if ((event.key === "r" || event.key === "R") && !event.ctrlKey && !event.metaKey && !event.altKey && !message(id)?.deletedAt) {
      event.preventDefault();
      host.emit("reply", { id });
      return;
    }
    if (event.key === "Escape") {
      if (s.reacting) {
        host.update({ reacting: null });
        return;
      }
      host.emit("escape", {});
      if (c.composer) {
        const composer = root.ownerDocument.getElementById(c.composer.replace(/^#/, ""));
        (composer?.querySelector<HTMLElement>("textarea, input") ?? composer)?.focus();
      }
    }
  };

  const setVoice = (id: string, patch: Partial<VoiceState>) => {
    const s = host.state();
    const prev = s.voice[id] ?? { playing: false, position: 0, rate: 1 };
    host.update({ voice: { ...s.voice, [id]: { ...prev, ...patch } } });
  };

  const onClick = (event: MouseEvent) => {
    const target = event.target as Element | null;
    if (!target || !root.contains(target)) return;
    const msgEl = target.closest<HTMLElement>(".z-message-row")?.querySelector<HTMLElement>(".z-message");
    const id = msgEl?.dataset.id;
    const older = target.closest(".z-message-list__older-button");
    if (older) {
      live.askedOlder = true;
      host.emit("load-older", {});
      return;
    }
    if (target.closest(".z-scroll-to-bottom")) {
      scrollToEnd(false, true);
      host.emit("reach-end", {});
      return;
    }
    if (!id) return;
    const action = target.closest<HTMLElement>("[data-action]");
    if (action) {
      const name = action.dataset.action!;
      if (name === "react") {
        host.update({ reacting: id, active: id });
        requestAnimationFrame(() =>
          root
            .querySelector<HTMLButtonElement>(`#${CSS.escape(messageDomId(root.id, id))} ~ .z-message__actions .z-message__quick`)
            ?.focus(),
        );
        return;
      }
      if (name === "more-reactions") {
        host.update({ reacting: null });
        host.emit("react-more", { id });
        return;
      }
      if (name === "copy") {
        const text = message(id)?.text ?? "";
        void copyText(text).then((ok) => {
          if (ok) announce(host.config().labels.copied, { source: root });
        });
        host.emit("copy", { id, text });
        return;
      }
      host.emit(name, { id });
      return;
    }
    // Reaccionar responde al instante; cuando la aplicación actualiza el mensaje, mandan sus reacciones.
    const react = (emoji: string) => {
      const m = message(id);
      if (!m) return;
      const s = host.state();
      const base = JSON.stringify(m.reactions ?? []);
      const current = s.reactions[id]?.base === base ? s.reactions[id]!.items : (m.reactions ?? []);
      host.update({ reacting: null, reactions: { ...s.reactions, [id]: { base, items: toggleReaction(current, emoji) } } });
      host.emit("react", { id, emoji });
    };
    const quick = target.closest<HTMLElement>(".z-message__quick");
    if (quick) {
      react(quick.dataset.emoji ?? "");
      article(id)?.focus();
      return;
    }
    const reaction = target.closest<HTMLElement>(".z-reaction[data-emoji]");
    if (reaction) {
      react(reaction.dataset.emoji ?? "");
      return;
    }
    const quote = target.closest<HTMLElement>(".z-quoted");
    if (quote) {
      const to = quote.dataset.replyTo!;
      jumpTo(to);
      host.emit("quote", { id: to });
      return;
    }
    if (target.closest(".z-message__retry")) {
      host.emit("retry", { id });
      return;
    }
    if (target.closest(".z-thread-summary")) {
      host.emit("open-thread", { id });
      return;
    }
    const image = target.closest<HTMLElement>(".z-message__image");
    if (image) {
      host.emit("open-media", { id, index: Number(image.dataset.index ?? 0) });
      return;
    }
    const voiceEl = target.closest<HTMLElement>(".z-voice-note");
    if (voiceEl) {
      const audio = root.ownerDocument.getElementById(`${root.id}-audio-${id}`) as HTMLAudioElement | null;
      const s = host.state();
      const state = s.voice[id] ?? { playing: false, position: 0, rate: 1 };
      if (target.closest(".z-voice-note__play") && audio) {
        if (!live.unwatch.has(id))
          live.unwatch.set(
            id,
            watchAudio(audio, (u) => {
              setVoice(id, { playing: u.playing, position: u.position });
              if (u.ended) host.emit("voice-ended", { id });
            }),
          );
        toggleAudio(audio, state.rate);
        return;
      }
      if (target.closest(".z-voice-note__rate")) {
        const rate = nextRate([1, 1.5, 2], state.rate);
        if (audio) audio.playbackRate = rate;
        setVoice(id, { rate });
        return;
      }
      const wave = target.closest<HTMLElement>(".z-voice-note__wave");
      const m = message(id);
      const voice = m?.attachments?.find((a) => a.kind === "voice");
      if (wave && voice && voice.kind === "voice") {
        const pos = fractionAt(wave, event.clientX) * voice.duration;
        seekAudio(audio, pos);
        setVoice(id, { position: pos });
      }
      return;
    }
    // Pulsar un mensaje (sin tocar un control) lo hace activo: el teclado sigue desde ahí.
    if (msgEl && host.state().active !== id) host.update({ active: id });
  };

  const onFocusIn = (event: FocusEvent) => {
    const msg = (event.target as Element).closest?.<HTMLElement>(".z-message");
    if (msg && root.contains(msg) && msg.dataset.id && host.state().active !== msg.dataset.id) host.update({ active: msg.dataset.id });
  };

  root.addEventListener("scroll", onScroll, true);
  root.addEventListener("keydown", onKey);
  root.addEventListener("click", onClick);
  root.addEventListener("focusin", onFocusIn);
  return () => {
    root.removeEventListener("scroll", onScroll, true);
    root.removeEventListener("keydown", onKey);
    root.removeEventListener("click", onClick);
    root.removeEventListener("focusin", onFocusIn);
    clearTimeout(live.arrivalTimer);
    clearTimeout(live.typingTimer);
    clearTimeout(live.flashTimer);
    clearTimeout(live.scrollTimer);
    cancelAnimationFrame(live.measureFrame);
    for (const off of live.unwatch.values()) off();
    apis.delete(root);
    lives.delete(root);
  };
}

/** Tras pintar: medir, conservar la posición (historial antepuesto o seguir el final) y anunciar lo que llegó. */
function after(root: HTMLElement, host: Host, focus: boolean): void {
  const live = lives.get(root);
  const vp = root.querySelector<HTMLElement>(".z-message-list__viewport");
  if (!live || !vp) return;
  const c = host.config();
  const s = host.state();
  const rows = rowsOf(c);
  const list = messageIds(rows);
  const first = list[0] ?? null;
  const last = list[list.length - 1] ?? null;

  // Altos reales de lo pintado: la ventana virtual los usa en el siguiente cálculo.
  const ol = vp.querySelector(":scope > ol");
  const changed = ol ? measureInto(ol, ":scope > li[data-key]", s.heights) : false;

  if (!live.mounted) {
    live.mounted = true;
    for (const id of list) live.known.add(id);
    live.firstId = first;
    live.lastId = last;
    // Abrir en el primer no leído o en el mensaje pedido; si no, al final. Sin mover el foco.
    const marker =
      c.anchor === "first-unread"
        ? vp.querySelector<HTMLElement>(".z-unread-marker")
        : c.anchor !== "end"
          ? root.ownerDocument.getElementById(messageDomId(root.id, c.anchor))
          : null;
    if (marker) {
      vp.scrollTop = Math.max(0, marker.offsetTop - 8);
      live.stick = nearEnd(vp);
    } else vp.scrollTop = vp.scrollHeight;
    if (vp.clientHeight !== s.viewport || changed) host.update({ viewport: vp.clientHeight, scroll: vp.scrollTop, away: !nearEnd(vp) });
    return;
  }

  const prepended = first !== null && live.firstId !== null && first !== live.firstId && list.indexOf(live.firstId) > 0;
  const appended = last !== null && last !== live.lastId && (live.lastId === null || list.indexOf(last) > list.indexOf(live.lastId));
  const arrived = newArrivals(live.known, c.messages, c.me);
  const own = appended && c.messages.some((m) => m.id === last && m.authorId === c.me);
  for (const id of list) live.known.add(id);
  live.firstId = first;
  live.lastId = last;
  // Se vuelve a pedir historial cuando llegó lo pedido o la carga terminó.
  if (c.loadingOlder) live.wasLoading = true;
  else if (live.wasLoading || prepended) {
    live.wasLoading = false;
    live.askedOlder = false;
  }

  if (prepended && live.anchor) {
    const el = vp.querySelector<HTMLElement>(`:scope > ol > li[data-key="${CSS.escape(live.anchor.key)}"]`);
    if (el) vp.scrollTop = restoreAnchor(live.anchor, el.offsetTop);
  } else if (followAction({ wasNearEnd: live.stick, ownMessage: own, prepended }) === "end" && !focus) {
    if (appended || live.stick) vp.scrollTop = vp.scrollHeight;
    if (own) live.stick = true;
  }
  if (appended && arrived.length && !live.stick) {
    const pending = pendingBelow(s.pending, arrived.length, false);
    if (pending !== s.pending) queueMicrotask(() => host.update({ pending, away: true }));
  }

  // Anuncios: lo de otros, agrupado en una tanda corta; quien escribe, una vez por persona y episodio.
  if (c.announce === "new" && arrived.length && appended) {
    live.arrivals.push(...arrived);
    clearTimeout(live.arrivalTimer);
    live.arrivalTimer = setTimeout(() => {
      const batch = live.arrivals.splice(0);
      const l = host.config().labels;
      const text = arrivalText(batch, { ...l, one: l.arrivalOne, fromOne: l.arrivalFromOne, many: l.arrivalMany });
      if (text) announce(text, { source: root });
    }, 700);
  }
  const typingNames = c.typing.map((p) => p.name);
  const fresh = typingNames.filter((n) => !live.typingSeen.has(n));
  live.typingSeen = new Set(typingNames);
  if (c.announce === "new" && fresh.length) {
    clearTimeout(live.typingTimer);
    live.typingTimer = setTimeout(() => {
      const still = host
        .config()
        .typing.map((p) => p.name)
        .filter((n) => fresh.includes(n));
      if (still.length) announce(typingText(still, host.config().labels), { source: root });
    }, 1000);
  }

  if (vp.clientHeight !== s.viewport) queueMicrotask(() => host.update({ viewport: vp.clientHeight }));
  else if (changed && c.virtualize !== false && rows.length > c.virtualize && !live.measureFrame) {
    live.measureFrame = requestAnimationFrame(() => {
      live.measureFrame = 0;
      host.update({ version: host.state().version + 1 });
    });
  }
  if (focus && s.active) {
    const el = root.ownerDocument.getElementById(messageDomId(root.id, s.active));
    if (el && el !== root.ownerDocument.activeElement) {
      el.focus({ preventScroll: true });
      el.scrollIntoView?.({ block: "nearest" });
    }
  }
}

export const messageListWidget: Widget<MessageListProps, Config, State> = {
  root: "z-message-list",
  configure: (p) => ({
    messages: p.messages ?? [],
    me: p.currentUserId,
    group: Boolean(p.group),
    groupWithin: p.groupWithin,
    timeZone: p.timeZone,
    locale: p.locale,
    hourCycle: p.hourCycle,
    unreadFrom: p.unreadFrom,
    anchor: p.initialAnchor ?? (p.unreadFrom ? "first-unread" : "end"),
    hasOlder: Boolean(p.hasOlder),
    loadingOlder: Boolean(p.loadingOlder),
    typing: p.typing ?? [],
    highlight: p.highlight ?? "",
    mention: p.mentions?.length ? (id) => p.mentions?.find((m) => m.id === id)?.label : undefined,
    actions: p.actions === false ? false : (p.actions ?? ["react", "reply", "forward", "copy", "edit", "delete"]),
    quick: p.quickReactions?.length ? p.quickReactions : QUICK_REACTIONS,
    virtualize: p.virtualize === false ? false : Math.max(20, Math.floor(Number(p.virtualize ?? 150))),
    announce: p.announce === "log" || p.announce === "none" ? p.announce : "new",
    label: p.label ?? p.labels?.list ?? localize("messageList", MESSAGE_LIST_LABELS).list,
    composer: p.composer,
    now: p.now,
    labels: { ...localize("messageList", MESSAGE_LIST_LABELS), ...p.labels },
  }),
  initial: (c) => {
    const ids = messageIds(rowsOf(c));
    return {
      active: ids[ids.length - 1] ?? null,
      reacting: null,
      flash: null,
      voice: {},
      pending: 0,
      away: false,
      day: null,
      scrolling: false,
      scroll: c.anchor === "end" ? Number.MAX_SAFE_INTEGER : 0,
      viewport: 0,
      heights: new Map(),
      version: 0,
      reactions: {},
    };
  },
  control(c, s) {
    let next = s;
    // Reacciones locales cuyo mensaje ya cambió en la aplicación (o desapareció): se retiran.
    const local = Object.entries(s.reactions);
    if (local.length) {
      const kept = local.filter(([id, r]) => {
        const m = c.messages.find((x) => x.id === id);
        return m && JSON.stringify(m.reactions ?? []) === r.base;
      });
      if (kept.length !== local.length) next = { ...next, reactions: Object.fromEntries(kept) };
    }
    // Un mensaje activo que ya no está (borrado, otra conversación) cede la parada al último.
    if (next.active && c.messages.some((m) => m.id === next.active)) return next;
    const ids = messageIds(rowsOf(c));
    return { ...next, active: ids[ids.length - 1] ?? null };
  },
  tree(c, s, uid) {
    const { labels } = c;
    const now = c.now ?? Date.now();
    const today = dayKey(now, c.timeZone ?? "");
    const rows = rowsOf(c);
    const virtual = c.virtualize !== false && rows.length > c.virtualize;
    const size = (i: number) => s.heights.get(rows[i]!.key) ?? ESTIMATE[rows[i]!.kind];
    const win = virtual
      ? virtualWindow({ count: rows.length, size, scroll: s.scroll, viewport: s.viewport || 800, overscan: 8 })
      : { start: 0, end: rows.length, before: 0, after: 0, total: 0 };
    // La fila activa no sale del documento: es la parada de Tab.
    const activeIndex = s.active ? rows.findIndex((r) => r.key === s.active) : -1;
    const shown: VNode[] = [];
    if (virtual && win.before > 0)
      shown.push(h("li", { class: "z-message-list__spacer", key: "before", "aria-hidden": "true", s: { "--z-space": `${win.before}px` } }));
    // La ventana más la fila activa (core/virtual): el foco itinerante sobrevive al reciclado de filas.
    for (const i of renderIndices(win, virtual && activeIndex >= 0 ? [activeIndex] : []))
      shown.push(rowNode(rows[i]!, c, s, uid, today, now));
    if (virtual && win.after > 0)
      shown.push(h("li", { class: "z-message-list__spacer", key: "after", "aria-hidden": "true", s: { "--z-space": `${win.after}px` } }));
    const typing = typingNode(
      c.typing.map((p) => p.name),
      labels,
      { people: c.group ? c.typing : undefined, key: "typing", tag: "li" },
    );
    return h(
      "div",
      {
        class: "z-message-list",
        role: "region",
        "aria-label": c.label,
        "data-z-message-list": "",
        "data-anchor": c.anchor === "end" || c.anchor === "first-unread" ? c.anchor : "id",
        "data-virtual": on(virtual),
      },
      h(
        "div",
        { class: "z-message-list__viewport" },
        c.hasOlder || c.loadingOlder
          ? h(
              "div",
              { class: "z-message-list__older" },
              c.loadingOlder
                ? h(
                    "span",
                    { class: "z-message-list__loading", role: "status" },
                    h("span", { class: "z-message-list__spinner", "aria-hidden": "true" }),
                    labels.loadingOlder,
                  )
                : h(
                    "button",
                    { type: "button", class: "z-btn z-btn--ghost z-message-list__older-button", "data-size": "sm" },
                    icon("arrow-up", 14),
                    labels.loadOlder,
                  ),
            )
          : null,
        h(
          "ol",
          {
            class: "z-message-list__items",
            role: c.announce === "log" ? "log" : undefined,
            "aria-live": c.announce === "log" ? "polite" : undefined,
            "aria-label": c.label,
          },
          ...shown,
          typing,
          h("li", { class: "z-message-list__end", key: "end", "aria-hidden": "true" }),
        ),
      ),
      h("div", { class: "z-message-list__day", "aria-hidden": "true", "data-visible": on(s.scrolling && Boolean(s.day)) }, s.day ?? ""),
      h(
        "button",
        {
          type: "button",
          class: "z-scroll-to-bottom",
          "data-visible": on(s.away),
          "aria-label": s.pending ? `${labels.latest}, ${fill(labels.newBelow, { n: s.pending })}` : labels.latest,
          title: labels.latest,
          tabindex: s.away ? 0 : -1,
          "aria-hidden": s.away ? undefined : "true",
        },
        icon("arrow-down", 18),
        s.pending ? h("span", { class: "z-scroll-to-bottom__count", "aria-hidden": "true" }, String(s.pending)) : null,
      ),
    );
  },
  attach,
  after,
  fromDom(el, json) {
    const d = el.dataset;
    return {
      messages: json.messages as ChatMessage[] | undefined,
      currentUserId: d.currentUser ?? (json.currentUserId as string | undefined),
      group: yes(d.group) || Boolean(json.group),
      groupWithin: d.groupWithin ? num(d.groupWithin, 300000) : undefined,
      timeZone: d.timeZone,
      locale: d.locale,
      hourCycle: d.hourCycle === "h12" || d.hourCycle === "h23" ? d.hourCycle : undefined,
      unreadFrom: d.unreadFrom,
      initialAnchor: d.anchor,
      hasOlder: yes(d.hasOlder),
      loadingOlder: yes(d.loadingOlder),
      typing: json.typing as ChatPerson[] | undefined,
      highlight: d.highlight,
      mentions: json.mentions as MessageListProps["mentions"],
      actions: d.actions === "none" ? false : d.actions ? (list(d.actions) as MessageAction[]) : undefined,
      virtualize: d.virtualize === "false" ? false : d.virtualize ? num(d.virtualize, 150) : undefined,
      announce: d.announce === "log" || d.announce === "none" ? d.announce : undefined,
      label: d.label,
      composer: d.composer,
      now: d.now ? num(d.now, Date.now()) : undefined,
      labels: json.labels as Partial<MessageListLabels> | undefined,
    };
  },
};
