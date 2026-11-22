// Piezas sueltas de chat (core/widget): nota de voz (VoiceNote), fila de reacciones (Reactions), tarjeta de llamada
// (CallCard: entrante, saliente y en curso) y barra de mensajes fijados (PinnedBar). Las mismas burbujas y reacciones
// las pinta también la lista de mensajes; aquí van para usarlas fuera de ella.

import { announce } from "./announcer";
import { avatarNode, CHAT_LABELS, reactionsNode, voiceNode, type ChatLabels, type VoiceState } from "./chat-tree";
import type { ChatPerson, ChatReaction } from "./chat-group";
import { isRtl } from "./dir";
import { QUICK_REACTIONS } from "./emoji-data";
import { toInstant } from "./relative";
import { fractionAt, seekAudio, seekKey, toggleAudio, watchAudio } from "./voice-control";
import { clockText, nextRate } from "./waveform";
import { fill, h, icon, on } from "./vnode";
import { list, num, yes, type Widget } from "./widget";

// ---- VoiceNote ----

export interface VoiceNoteProps {
  src?: string;
  /** Duración en segundos. */
  duration?: number;
  /** Onda precalculada (cualquier escala). */
  peaks?: readonly number[];
  /** Velocidades que recorre el botón (1, 1.5, 2). */
  rates?: readonly number[];
  /** Sin escuchar aún: el punto de «nuevo». */
  played?: boolean;
  /** Barras de la onda (36). */
  bars?: number;
  labels?: Partial<Pick<ChatLabels, "play" | "pause" | "speed" | "seek" | "voice">>;
}

interface VoiceConfig {
  src: string;
  duration: number;
  peaks?: readonly number[];
  rates: readonly number[];
  played?: boolean;
  bars: number;
  labels: Pick<ChatLabels, "play" | "pause" | "speed" | "seek" | "voice">;
}

export const voiceNoteWidget: Widget<VoiceNoteProps, VoiceConfig, VoiceState> = {
  root: "z-voice-note",
  configure: (p) => ({
    src: p.src ?? "",
    duration: Math.max(0, Number(p.duration) || 0),
    peaks: p.peaks,
    rates: p.rates?.length ? p.rates : [1, 1.5, 2],
    played: p.played,
    bars: Math.max(8, Math.min(96, Math.floor(p.bars ?? 36))),
    labels: { ...CHAT_LABELS, ...p.labels },
  }),
  initial: (c) => ({ playing: false, position: 0, rate: c.rates[0] ?? 1 }),
  tree: (c, s, uid) =>
    voiceNode({ src: c.src, duration: c.duration, peaks: c.peaks, played: c.played }, s, c.labels, { bars: c.bars, id: `${uid}-audio` }),
  attach(root, host) {
    const audio = () => root.querySelector<HTMLAudioElement>(".z-voice-note__audio");
    let unwatch: (() => void) | null = null;
    const onClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      const el = audio();
      const s = host.state();
      if (target?.closest(".z-voice-note__play") && el) {
        unwatch ??= watchAudio(el, (u) => {
          host.update({ playing: u.playing, position: u.position });
          if (u.ended) host.emit("ended", {});
        });
        const playing = toggleAudio(el, s.rate);
        host.emit(playing ? "play" : "pause", {});
        return;
      }
      if (target?.closest(".z-voice-note__rate")) {
        const rate = nextRate(host.config().rates, s.rate);
        if (el) el.playbackRate = rate;
        host.update({ rate });
        host.emit("rate-change", { rate });
        return;
      }
      const wave = target?.closest<HTMLElement>(".z-voice-note__wave");
      if (wave) {
        const pos = fractionAt(wave, event.clientX) * host.config().duration;
        seekAudio(el, pos);
        host.update({ position: pos });
      }
    };
    const onKey = (event: KeyboardEvent) => {
      const wave = (event.target as Element).closest?.<HTMLElement>(".z-voice-note__wave");
      if (!wave) return;
      const next = seekKey(event.key, host.state().position, host.config().duration, isRtl(wave));
      if (next === null) return;
      event.preventDefault();
      seekAudio(audio(), next);
      host.update({ position: next });
    };
    root.addEventListener("click", onClick);
    root.addEventListener("keydown", onKey);
    return () => {
      unwatch?.();
      audio()?.pause();
      root.removeEventListener("click", onClick);
      root.removeEventListener("keydown", onKey);
    };
  },
  fromDom(el, json) {
    const d = el.dataset;
    return {
      src: d.src,
      duration: d.duration ? num(d.duration, 0) : undefined,
      peaks: d.peaks ? list(d.peaks).map(Number) : (json.peaks as number[] | undefined),
      rates: d.rates ? list(d.rates).map(Number) : undefined,
      played: d.played === "false" ? false : undefined,
      bars: d.bars ? num(d.bars, 36) : undefined,
      labels: json.labels as VoiceNoteProps["labels"],
    };
  },
};

// ---- Reactions ----

export interface ReactionsProps {
  items?: readonly ChatReaction[];
  /** Botón de añadir: abre la fila rápida (seis) y «más». */
  add?: boolean;
  quick?: readonly string[];
  labels?: Partial<Pick<ChatLabels, "reactions" | "reacted" | "addReaction" | "moreReactions">>;
}

interface ReactionsConfig {
  items: readonly ChatReaction[];
  add: boolean;
  quick: readonly string[];
  labels: Pick<ChatLabels, "reactions" | "reacted" | "addReaction" | "moreReactions">;
}
interface ReactionsState {
  items: readonly ChatReaction[];
  /** Firma de las `items` de la aplicación con las que se calculó `items`: si cambian, mandan las nuevas. */
  source: string;
  picking: boolean;
}

/** Cambia la reacción propia `emoji` en una lista: la añade o la quita y ajusta la cuenta. */
export function toggleReaction(items: readonly ChatReaction[], emoji: string): ChatReaction[] {
  const found = items.find((r) => r.emoji === emoji);
  if (!found) return [...items, { emoji, count: 1, mine: true }];
  return items
    .map((r) => (r.emoji === emoji ? { ...r, mine: !r.mine, count: Math.max(0, r.count + (r.mine ? -1 : 1)) } : r))
    .filter((r) => r.count > 0);
}

export const reactionsWidget: Widget<ReactionsProps, ReactionsConfig, ReactionsState> = {
  root: "z-reactions",
  configure: (p) => ({
    items: p.items ?? [],
    add: p.add !== false,
    quick: p.quick?.length ? p.quick : QUICK_REACTIONS,
    labels: { ...CHAT_LABELS, ...p.labels },
  }),
  initial: (c) => ({ items: c.items, source: JSON.stringify(c.items), picking: false }),
  control: (c, s) => {
    // Por valor y no por identidad: en el modo DOM la configuración se lee de nuevo en cada pintado.
    const source = JSON.stringify(c.items);
    return source !== s.source ? { ...s, items: c.items, source } : s;
  },
  tree(c, s) {
    const row = reactionsNode(s.items, c.labels, { add: c.add });
    if (s.picking)
      row.c = [
        ...(row.c ?? []),
        h(
          "span",
          { class: "z-reactions__quick", role: "group", "aria-label": c.labels.addReaction, key: "quick" },
          ...c.quick.map((emoji, i) =>
            h(
              "button",
              { type: "button", class: "z-reaction z-reactions__pick", key: `q${i}`, "data-pick": emoji, "aria-label": emoji },
              emoji,
            ),
          ),
          h(
            "button",
            {
              type: "button",
              class: "z-reaction z-reactions__more",
              key: "more",
              "aria-label": c.labels.moreReactions,
              title: c.labels.moreReactions,
            },
            icon("plus", 14),
          ),
        ),
      ];
    return row;
  },
  attach(root, host) {
    const onClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      const pick = target?.closest<HTMLElement>("[data-pick]");
      const toggle = target?.closest<HTMLElement>(".z-reaction[data-emoji]");
      const emoji = pick?.dataset.pick ?? toggle?.dataset.emoji;
      if (emoji) {
        const items = toggleReaction(host.state().items, emoji);
        const mine = items.find((r) => r.emoji === emoji)?.mine ?? false;
        host.update({ items, picking: false }, Boolean(pick));
        host.emit("toggle", { emoji, active: mine });
        return;
      }
      if (target?.closest(".z-reactions__more")) {
        host.update({ picking: false });
        host.emit("more", {});
        return;
      }
      if (target?.closest(".z-reaction--add")) {
        host.update({ picking: !host.state().picking });
        if (!host.state().picking) return;
        requestAnimationFrame(() => root.querySelector<HTMLElement>("[data-pick]")?.focus());
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && host.state().picking) {
        host.update({ picking: false });
        root.querySelector<HTMLElement>(".z-reaction--add")?.focus();
      }
    };
    root.addEventListener("click", onClick);
    root.addEventListener("keydown", onKey);
    return () => {
      root.removeEventListener("click", onClick);
      root.removeEventListener("keydown", onKey);
    };
  },
  after(root, _host, focus) {
    if (focus) root.querySelector<HTMLElement>(".z-reaction--add")?.focus();
  },
  fromDom(el, json) {
    return {
      items: json.items as ChatReaction[] | undefined,
      add: el.dataset.add === "false" ? false : undefined,
      quick: json.quick as string[] | undefined,
      labels: json.labels as ReactionsProps["labels"],
    };
  },
};

// ---- CallCard ----

export interface CallCardLabels {
  incoming: string;
  incomingVideo: string;
  outgoing: string;
  ongoing: string;
  accept: string;
  acceptVideo: string;
  decline: string;
  hangUp: string;
  mute: string;
  camera: string;
  /** «Incoming call from {name}». */
  announce: string;
  /** «Call duration {time}». */
  duration: string;
}

export const CALL_CARD_LABELS: CallCardLabels = {
  incoming: "Incoming voice call",
  incomingVideo: "Incoming video call",
  outgoing: "Calling…",
  ongoing: "On call",
  accept: "Accept",
  acceptVideo: "Accept with video",
  decline: "Decline",
  hangUp: "Hang up",
  mute: "Mute",
  camera: "Camera",
  announce: "Incoming call from {name}",
  duration: "Call duration {time}",
};

export interface CallCardProps {
  kind?: "incoming" | "outgoing" | "ongoing";
  caller?: ChatPerson;
  video?: boolean;
  /** Inicio de la llamada en curso (ISO o ms). */
  startedAt?: number | string;
  muted?: boolean;
  camera?: boolean;
  labels?: Partial<CallCardLabels>;
}

interface CallConfig {
  kind: "incoming" | "outgoing" | "ongoing";
  caller: ChatPerson;
  video: boolean;
  startedAt: number | null;
  muted?: boolean;
  camera?: boolean;
  labels: CallCardLabels;
}
interface CallState {
  now: number;
  muted: boolean;
  camera: boolean;
}

const callButton = (cls: string, iconName: string, label: string, extra: Record<string, string | undefined> = {}) =>
  h("button", { type: "button", class: `z-call__button ${cls}`, "aria-label": label, title: label, ...extra }, icon(iconName, 20));

export const callCardWidget: Widget<CallCardProps, CallConfig, CallState> = {
  root: "z-call",
  configure: (p) => ({
    kind: p.kind === "outgoing" || p.kind === "ongoing" ? p.kind : "incoming",
    caller: p.caller ?? { name: "" },
    video: Boolean(p.video),
    startedAt: toInstant(p.startedAt ?? null),
    muted: p.muted,
    camera: p.camera,
    labels: { ...CALL_CARD_LABELS, ...p.labels },
  }),
  initial: (c) => ({ now: Date.now(), muted: Boolean(c.muted), camera: c.camera ?? c.video }),
  control: (c, s) => ({ ...s, muted: c.muted ?? s.muted, camera: c.camera ?? s.camera }),
  tree(c, s, uid) {
    const { labels } = c;
    const elapsed = c.startedAt !== null ? Math.max(0, (s.now - c.startedAt) / 1000) : 0;
    const status =
      c.kind === "incoming" ? (c.video ? labels.incomingVideo : labels.incoming) : c.kind === "outgoing" ? labels.outgoing : labels.ongoing;
    return h(
      "div",
      {
        class: "z-call z-liquid",
        "data-kind": c.kind,
        "data-video": on(c.video),
        role: "region",
        "aria-labelledby": `${uid}-name`,
        "aria-describedby": `${uid}-status`,
      },
      h(
        "span",
        { class: "z-call__avatar", "data-ringing": on(c.kind !== "ongoing") },
        avatarNode(c.caller, { size: "lg", decorative: true }),
      ),
      h(
        "span",
        { class: "z-call__body" },
        h("span", { class: "z-call__name", id: `${uid}-name` }, c.caller.name),
        h(
          "span",
          { class: "z-call__status", id: `${uid}-status` },
          c.kind === "ongoing" && c.startedAt !== null
            ? h(
                "span",
                { class: "z-call__timer", role: "timer", "aria-label": fill(labels.duration, { time: clockText(elapsed) }) },
                clockText(elapsed),
              )
            : status,
        ),
      ),
      h(
        "span",
        { class: "z-call__actions" },
        ...(c.kind === "incoming"
          ? [
              callButton("z-call__decline", "phone-x-mark", labels.decline),
              callButton("z-call__accept", c.video ? "video-camera" : "phone", c.video ? labels.acceptVideo : labels.accept),
            ]
          : c.kind === "outgoing"
            ? [callButton("z-call__decline z-call__hangup", "phone-x-mark", labels.hangUp)]
            : [
                callButton("z-call__toggle z-call__mute", s.muted ? "microphone-slash" : "microphone", labels.mute, {
                  "aria-pressed": s.muted ? "true" : "false",
                }),
                c.video
                  ? callButton("z-call__toggle z-call__camera", s.camera ? "video-camera" : "video-camera-slash", labels.camera, {
                      "aria-pressed": s.camera ? "true" : "false",
                    })
                  : null,
                callButton("z-call__decline z-call__hangup", "phone-x-mark", labels.hangUp),
              ]),
      ),
    );
  },
  attach(root, host) {
    const c = host.config();
    // Entrante: un aviso asertivo, una vez. No se roba el foco.
    if (c.kind === "incoming" && c.caller.name)
      announce(fill(c.labels.announce, { name: c.caller.name }), { source: root, politeness: "assertive" });
    const timer = setInterval(() => {
      if (host.config().kind === "ongoing" && root.ownerDocument.visibilityState !== "hidden") host.update({ now: Date.now() });
    }, 1000);
    const onClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (target?.closest(".z-call__accept")) host.emit("accept", { video: host.config().video });
      else if (target?.closest(".z-call__hangup")) host.emit("hang-up", {});
      else if (target?.closest(".z-call__decline")) host.emit("decline", {});
      else if (target?.closest(".z-call__mute")) {
        const muted = !host.state().muted;
        host.update({ muted });
        host.emit("mute", { muted });
      } else if (target?.closest(".z-call__camera")) {
        const camera = !host.state().camera;
        host.update({ camera });
        host.emit("camera", { camera });
      }
    };
    root.addEventListener("click", onClick);
    return () => {
      clearInterval(timer);
      root.removeEventListener("click", onClick);
    };
  },
  fromDom(el, json) {
    const d = el.dataset;
    return {
      kind: d.kind === "outgoing" || d.kind === "ongoing" ? d.kind : undefined,
      caller: (json.caller as ChatPerson | undefined) ?? (d.caller ? { name: d.caller, avatar: d.avatar } : undefined),
      video: yes(d.video),
      startedAt: d.startedAt,
      muted: d.muted !== undefined ? yes(d.muted) : undefined,
      camera: d.camera !== undefined ? yes(d.camera) : undefined,
      labels: json.labels as Partial<CallCardLabels> | undefined,
    };
  },
};

// ---- PinnedBar ----

export interface PinnedItem {
  id: string;
  author?: string;
  text: string;
}

export interface PinnedBarLabels {
  pinned: string;
  /** «Pinned message {i} of {n}». */
  position: string;
  unpin: string;
}

export const PINNED_BAR_LABELS: PinnedBarLabels = { pinned: "Pinned message", position: "Pinned message {i} of {n}", unpin: "Unpin" };

export interface PinnedBarProps {
  items?: readonly PinnedItem[];
  /** Con él, botón de quitar. */
  unpinnable?: boolean;
  labels?: Partial<PinnedBarLabels>;
}

interface PinnedConfig {
  items: readonly PinnedItem[];
  unpinnable: boolean;
  labels: PinnedBarLabels;
}

export const pinnedBarWidget: Widget<PinnedBarProps, PinnedConfig, { index: number }> = {
  root: "z-pinned-bar",
  configure: (p) => ({ items: p.items ?? [], unpinnable: Boolean(p.unpinnable), labels: { ...PINNED_BAR_LABELS, ...p.labels } }),
  // Como en los clientes de mensajería: se muestra el último fijado y cada pulsación salta al anterior.
  initial: (c) => ({ index: Math.max(0, c.items.length - 1) }),
  control: (c, s) => (s.index >= c.items.length ? { index: Math.max(0, c.items.length - 1) } : s),
  tree(c, s) {
    const item = c.items[s.index];
    const n = c.items.length;
    return h(
      "div",
      { class: "z-pinned-bar", "data-empty": on(!item) },
      item
        ? h(
            "button",
            { type: "button", class: "z-pinned-bar__main" },
            n > 1
              ? h(
                  "span",
                  { class: "z-pinned-bar__track", "aria-hidden": "true" },
                  ...c.items.map((p, i) => h("span", { class: "z-pinned-bar__segment", key: p.id, "data-current": on(i === s.index) })),
                )
              : h(
                  "span",
                  { class: "z-pinned-bar__track", "aria-hidden": "true" },
                  h("span", { class: "z-pinned-bar__segment", "data-current": "" }),
                ),
            h("span", { class: "z-pinned-bar__icon", "aria-hidden": "true" }, icon("bookmark", 16)),
            h(
              "span",
              { class: "z-pinned-bar__body" },
              h("span", { class: "z-pinned-bar__title" }, n > 1 ? fill(c.labels.position, { i: s.index + 1, n }) : c.labels.pinned),
              h("span", { class: "z-pinned-bar__text" }, item.author ? `${item.author}: ${item.text}` : item.text),
            ),
          )
        : null,
      item && c.unpinnable
        ? h(
            "button",
            {
              type: "button",
              class: "z-btn z-btn--ghost z-btn--icon z-pinned-bar__unpin",
              "data-size": "sm",
              "aria-label": c.labels.unpin,
              title: c.labels.unpin,
            },
            icon("x-mark", 14),
          )
        : null,
    );
  },
  attach(root, host) {
    const onClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      const { items } = host.config();
      const item = items[host.state().index];
      if (!item) return;
      if (target?.closest(".z-pinned-bar__unpin")) {
        host.emit("unpin", { id: item.id });
        return;
      }
      if (target?.closest(".z-pinned-bar__main")) {
        host.emit("jump", { id: item.id });
        if (items.length > 1) host.update({ index: (host.state().index - 1 + items.length) % items.length });
      }
    };
    root.addEventListener("click", onClick);
    return () => root.removeEventListener("click", onClick);
  },
  fromDom(el, json) {
    return {
      items: json.items as PinnedItem[] | undefined,
      unpinnable: yes(el.dataset.unpinnable),
      labels: json.labels as Partial<PinnedBarLabels> | undefined,
    };
  },
};
