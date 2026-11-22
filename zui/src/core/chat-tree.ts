// Marcado de las piezas de chat como árbol (core/vnode): burbuja con su cola, autor, cita, adjuntos (imágenes, archivo,
// nota de voz, ubicación, vista previa de enlace), texto con enlaces seguros y menciones, hora, «editado» y estado de
// entrega; reacciones, resumen de hilo, separador de fecha, marca de no leídos e indicador de escritura. Lo pintan la
// lista de mensajes, los componentes sueltos de React y el modo DOM: un solo origen para el contrato HTML. Sin documento.

import type { BubblePosition, ChatAttachment, ChatMessage, ChatPerson, ChatReaction, DeliveryState } from "./chat-group";
import { messagePreview, timeLabel, typingText, type ArrivalLabels, type TypingLabels } from "./chat-group";
import { DELIVERY_LABELS, deliveryIcons, type DeliveryLabels } from "./delivery";
import { emojiName } from "./emoji-data";
import { formatByte, highlightParts } from "./format";
import { domainOf, linkify, safeHref } from "./linkify";
import { mentionParts } from "./mentions";
import { formatRelative, toInstant } from "./relative";
import { clockText, playedBars, resamplePeaks } from "./waveform";
import { fill, h, icon, on, type VEl, type VNode } from "./vnode";

export interface ChatLabels extends DeliveryLabels, TypingLabels, Omit<ArrivalLabels, "one" | "fromOne" | "many"> {
  you: string;
  today: string;
  yesterday: string;
  /** «{n} unread messages». */
  unread: string;
  forwarded: string;
  edited: string;
  deleted: string;
  /** «Reply to {name}» (cita: prefijo oculto). */
  quoted: string;
  reply: string;
  react: string;
  forward: string;
  copy: string;
  edit: string;
  delete: string;
  retry: string;
  /** Nombre de la barra de acciones de un mensaje. */
  actions: string;
  /** Nombre de la fila de reacciones. */
  reactions: string;
  /** «you reacted» (en el nombre de una reacción propia). */
  reacted: string;
  addReaction: string;
  /** «More reactions». */
  moreReactions: string;
  play: string;
  pause: string;
  /** «Playback speed {rate}×». */
  speed: string;
  /** Nombre del deslizador de la nota de voz. */
  seek: string;
  download: string;
  openMap: string;
  /** «{n} replies». */
  replies: string;
  /** «Last reply {time}». */
  lastReply: string;
  /** «Image {i} of {n}». */
  image: string;
  /** «+{n}» sobre la última imagen visible de un álbum. */
  moreImages: string;
}

export const CHAT_LABELS: ChatLabels = {
  ...DELIVERY_LABELS,
  one: "{name} is typing…",
  two: "{a} and {b} are typing…",
  many: "{name} and {n} others are typing…",
  photo: "Photo",
  file: "File",
  voice: "Voice message",
  location: "Location",
  link: "Link",
  you: "You",
  today: "Today",
  yesterday: "Yesterday",
  unread: "{n} unread messages",
  forwarded: "Forwarded",
  edited: "edited",
  deleted: "This message was deleted",
  quoted: "Reply to {name}",
  reply: "Reply",
  react: "React",
  forward: "Forward",
  copy: "Copy",
  edit: "Edit",
  delete: "Delete",
  retry: "Retry",
  actions: "Message actions",
  reactions: "Reactions",
  reacted: "you reacted",
  addReaction: "Add reaction",
  moreReactions: "More reactions",
  play: "Play",
  pause: "Pause",
  speed: "Playback speed {rate}×",
  seek: "Voice message position",
  download: "Download",
  openMap: "Open in maps",
  replies: "{n} replies",
  lastReply: "Last reply {time}",
  image: "Image {i} of {n}",
  moreImages: "+{n}",
};

/** Estado de reproducción de una nota de voz (por id de mensaje o de la pieza suelta). */
export interface VoiceState {
  playing: boolean;
  /** Segundos reproducidos. */
  position: number;
  rate: number;
}

export type MessageAction = "react" | "reply" | "forward" | "copy" | "edit" | "delete";
export const MESSAGE_ACTIONS: readonly MessageAction[] = ["react", "reply", "forward", "copy", "edit", "delete"];

export interface BubbleContext {
  labels: ChatLabels;
  uid: string;
  locale?: string;
  timeZone?: string;
  hourCycle?: "h12" | "h23";
  now?: number;
  /** Mensaje con la parada de tabulación de la lista. */
  active?: boolean;
  /** Mensaje resaltado (salto a una cita, búsqueda). */
  flash?: boolean;
  /** Texto buscado: las coincidencias van en <mark>. */
  highlight?: string;
  /** Nombre de una mención `<@id>`. */
  mention?: (id: string, trigger: string) => string | undefined;
  voice?: VoiceState;
  /** Acciones de la barra (las de editar y borrar solo en los propios). Sin ninguna, no hay barra. */
  actions?: readonly MessageAction[];
  /** Fila de reacciones rápidas abierta en este mensaje. */
  reacting?: boolean;
  quick?: readonly string[];
  /** Barras de la onda de una nota de voz. */
  bars?: number;
}

const initials = (name: string) => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] ?? "") + (words.length > 1 ? (words[words.length - 1]?.[0] ?? "") : "")).toUpperCase();
};

/** Avatar con el marcado del componente Avatar. `decorative`: el nombre ya está al lado y el avatar no se lee. */
export function avatarNode(
  person: ChatPerson | undefined,
  o: { size?: "xs" | "sm" | "md" | "lg"; status?: string; statusLabel?: string; decorative?: boolean } = {},
): VEl {
  const name = person?.name ?? "";
  const img = person?.avatar
    ? (safeHref(person.avatar, new Set(["http:", "https:", "data:", "blob:"])) ?? (person.avatar.startsWith("/") ? person.avatar : null))
    : null;
  return h(
    "span",
    {
      class: "z-avatar",
      "data-size": o.size ?? "md",
      "data-shape": "circle",
      role: img || o.decorative ? undefined : "img",
      "aria-label": img || o.decorative ? undefined : name || undefined,
      "aria-hidden": o.decorative ? "true" : undefined,
    },
    img
      ? h("img", { class: "z-avatar__image", src: img, alt: o.decorative ? "" : name, loading: "lazy", decoding: "async" })
      : name
        ? h("span", { class: "z-avatar__initials", "aria-hidden": "true" }, initials(name))
        : icon("user", 16),
    o.status
      ? h("span", {
          class: "z-avatar__status",
          "data-status": o.status,
          role: o.decorative ? undefined : "img",
          "aria-label": o.decorative ? undefined : (o.statusLabel ?? o.status),
        })
      : null,
  );
}

/** Estado de entrega: iconos (dos marcas en entregado y leído) y su texto oculto. Leído cambia además de color. */
export function deliveryNode(status: DeliveryState, labels: DeliveryLabels = DELIVERY_LABELS, key?: string): VEl {
  return h(
    "span",
    { class: "z-delivery", "data-status": status, key },
    h("span", { class: "z-delivery__icons", "aria-hidden": "true" }, ...deliveryIcons(status).map((name) => icon(name, 14))),
    h("span", { class: "z-sr-only" }, labels[status]),
  );
}

/** Reacciones: botones conmutables con el nombre del emoji, la cuenta y si es tuya; y el de añadir. */
export function reactionsNode(
  items: readonly ChatReaction[],
  labels: Pick<ChatLabels, "reactions" | "reacted" | "addReaction">,
  o: { add?: boolean; key?: string } = {},
): VEl {
  return h(
    "div",
    { class: "z-reactions", role: "group", "aria-label": labels.reactions, key: o.key },
    ...items
      .filter((r) => r.count > 0)
      .map((r) =>
        h(
          "button",
          {
            type: "button",
            class: "z-reaction",
            key: r.emoji,
            "data-emoji": r.emoji,
            "aria-pressed": r.mine ? "true" : "false",
            "aria-label": `${emojiName(r.emoji)}, ${r.count}${r.mine ? `, ${labels.reacted}` : ""}`,
          },
          h("span", { class: "z-reaction__emoji", "aria-hidden": "true" }, r.emoji),
          h("span", { class: "z-reaction__count", "aria-hidden": "true" }, String(r.count)),
        ),
      ),
    o.add
      ? h(
          "button",
          { type: "button", class: "z-reaction z-reaction--add", "aria-label": labels.addReaction, title: labels.addReaction },
          icon("face-smile", 16),
        )
      : null,
  );
}

/** Indicador de escritura: tres puntos en una burbuja y el texto (que se lee). Vacío si nadie escribe. */
export function typingNode(
  names: readonly string[],
  labels: TypingLabels,
  o: { people?: readonly ChatPerson[]; key?: string; tag?: string } = {},
): VEl | null {
  const text = typingText(names, labels);
  if (!text) return null;
  return h(
    o.tag ?? "div",
    { class: "z-typing", key: o.key },
    o.people?.length
      ? h(
          "span",
          { class: "z-typing__avatars", "aria-hidden": "true" },
          ...o.people.slice(0, 3).map((p) => avatarNode(p, { size: "xs", decorative: true })),
        )
      : null,
    h(
      "span",
      { class: "z-typing__bubble", "aria-hidden": "true" },
      h("span", { class: "z-typing__dot" }),
      h("span", { class: "z-typing__dot" }),
      h("span", { class: "z-typing__dot" }),
    ),
    h("span", { class: "z-typing__text" }, text),
  );
}

/** Resumen de hilo: avatares, «12 replies» y la última respuesta en relativo. Es un botón (abre el hilo). */
export function threadNode(
  thread: NonNullable<ChatMessage["thread"]>,
  labels: Pick<ChatLabels, "replies" | "lastReply">,
  o: { now?: number; locale?: string; key?: string } = {},
): VEl {
  const last = toInstant(thread.lastAt ?? null);
  return h(
    "button",
    { type: "button", class: "z-thread-summary", key: o.key },
    thread.participants?.length
      ? h(
          "span",
          { class: "z-avatar-group z-thread-summary__people", "aria-hidden": "true" },
          ...thread.participants.slice(0, 3).map((p) => avatarNode(p, { size: "xs", decorative: true })),
        )
      : null,
    h("span", { class: "z-thread-summary__count" }, fill(labels.replies, { n: thread.count })),
    last !== null && o.now !== undefined
      ? h(
          "span",
          { class: "z-thread-summary__last" },
          fill(labels.lastReply, { time: formatRelative(last, o.now, o.locale, { style: "short" }) }),
        )
      : null,
    h("span", { class: "z-thread-summary__chevron", "aria-hidden": "true" }, icon("chevron-right", 14)),
  );
}

/** Texto de un mensaje: menciones, enlaces seguros y coincidencias de búsqueda, como nodos. */
export function messageText(text: string, o: { mention?: BubbleContext["mention"]; highlight?: string } = {}): VNode[] {
  const out: VNode[] = [];
  const marked = (t: string, k: string): VNode[] =>
    o.highlight?.trim()
      ? highlightParts(t, o.highlight).map((p, i) =>
          p.match ? h("mark", { class: "z-message__match", key: `${k}m${i}` }, p.text) : p.text,
        )
      : [t];
  mentionParts(text, o.mention).forEach((part, i) => {
    if (part.type === "mention") {
      out.push(
        h("span", { class: "z-mention", key: `n${i}`, "data-id": part.id, "data-trigger": part.trigger }, `${part.trigger}${part.label}`),
      );
      return;
    }
    linkify(part.text).forEach((piece, j) => {
      const k = `t${i}.${j}`;
      if (piece.type === "link")
        out.push(h("a", { key: k, href: piece.href, target: "_blank", rel: "noopener noreferrer nofollow" }, ...marked(piece.text, k)));
      else out.push(...marked(piece.text, k));
    });
  });
  return out;
}

/** Solo uno a tres emojis (sin texto): se pintan grandes, como en los clientes de mensajería. */
export function emojiOnly(text: string | undefined): boolean {
  if (!text) return false;
  const t = text.trim();
  if (!t || t.length > 24) return false;
  const stripped = t.replace(/(?:\p{Extended_Pictographic}|\p{Emoji_Modifier}|\u{fe0f}|\u{200d}|\u{20e3}|\s)/gu, "");
  if (stripped) return false;
  const count = [...t.matchAll(/\p{Extended_Pictographic}/gu)].length;
  return count >= 1 && count <= 3;
}

const SAFE_MEDIA = new Set(["http:", "https:", "data:", "blob:"]);
const mediaSrc = (src: string | undefined) =>
  src ? (safeHref(src, SAFE_MEDIA) ?? (src.startsWith("/") || src.startsWith("./") ? src : null)) : null;

/** Nota de voz: reproducir/pausar, onda (que es el deslizador de posición), tiempo y velocidad, sobre un <audio>. */
export function voiceNode(
  a: { src: string; duration: number; peaks?: readonly number[]; played?: boolean },
  state: VoiceState,
  labels: Pick<ChatLabels, "play" | "pause" | "speed" | "seek" | "voice">,
  o: { bars?: number; key?: string; id?: string } = {},
): VEl {
  const duration = Math.max(0, a.duration || 0);
  const progress = duration ? Math.min(1, state.position / duration) : 0;
  const bars = resamplePeaks(a.peaks, o.bars ?? 36);
  const played = playedBars(progress, bars.length);
  const src = mediaSrc(a.src);
  return h(
    "div",
    {
      class: "z-voice-note",
      key: o.key,
      "data-playing": on(state.playing),
      "data-unplayed": on(a.played === false),
      role: "group",
      "aria-label": labels.voice,
    },
    h(
      "button",
      { type: "button", class: "z-voice-note__play", "aria-label": state.playing ? labels.pause : labels.play, "aria-pressed": undefined },
      icon(state.playing ? "pause" : "play", 18),
    ),
    h(
      "div",
      {
        class: "z-voice-note__wave",
        role: "slider",
        tabindex: 0,
        "aria-label": labels.seek,
        "aria-valuemin": 0,
        "aria-valuemax": Math.round(duration),
        "aria-valuenow": Math.round(state.position),
        "aria-valuetext": `${clockText(state.position)} / ${clockText(duration)}`,
      },
      ...bars.map((v, i) =>
        h("span", { class: "z-voice-note__bar", key: String(i), "data-played": on(i < played), s: { "--z-peak": v.toFixed(2) } }),
      ),
    ),
    h(
      "span",
      { class: "z-voice-note__time", "aria-hidden": "true" },
      clockText(state.playing || state.position > 0 ? state.position : duration),
    ),
    h("button", { type: "button", class: "z-voice-note__rate", "aria-label": fill(labels.speed, { rate: state.rate }) }, `${state.rate}×`),
    src ? h("audio", { class: "z-voice-note__audio", src, preload: "none", id: o.id }) : null,
  );
}

function attachmentNodes(m: ChatMessage, ctx: BubbleContext): VNode[] {
  const list = m.attachments ?? [];
  const out: VNode[] = [];
  const images = list.filter((a): a is Extract<ChatAttachment, { kind: "image" }> => a.kind === "image");
  if (images.length) {
    const shown = images.slice(0, 4);
    out.push(
      h(
        "div",
        { class: "z-message__media", key: "media", "data-count": String(Math.min(4, images.length)) },
        ...shown.map((img, i) => {
          const src = mediaSrc(img.src);
          const more = i === 3 && images.length > 4 ? images.length - 4 : 0;
          return h(
            "button",
            {
              type: "button",
              class: "z-message__image",
              key: String(i),
              "data-index": i,
              "aria-label": img.alt
                ? `${img.alt}, ${fill(ctx.labels.image, { i: i + 1, n: images.length })}`
                : fill(ctx.labels.image, { i: i + 1, n: images.length }),
              s: img.width && img.height && images.length === 1 ? { "--z-ratio": `${img.width} / ${img.height}` } : undefined,
            },
            src ? h("img", { src, alt: "", loading: "lazy", decoding: "async", width: img.width, height: img.height }) : null,
            more ? h("span", { class: "z-message__more", "aria-hidden": "true" }, fill(ctx.labels.moreImages, { n: more })) : null,
          );
        }),
      ),
    );
  }
  list.forEach((a, i) => {
    const key = `a${i}`;
    if (a.kind === "file") {
      const href = a.href ? (safeHref(a.href) ?? (a.href.startsWith("/") ? a.href : null)) : null;
      out.push(
        h(
          "div",
          { class: "z-message-file", key },
          h("span", { class: "z-message-file__icon", "aria-hidden": "true" }, icon("document-text", 20)),
          h(
            "span",
            { class: "z-message-file__body" },
            h("span", { class: "z-message-file__name" }, a.name),
            h(
              "span",
              { class: "z-message-file__meta" },
              [a.size !== undefined ? formatByte(a.size, ctx.locale) : "", a.type ?? ""].filter(Boolean).join(" · "),
            ),
            a.progress !== undefined && a.progress < 1
              ? h("progress", { class: "z-message-file__progress", max: 100, value: Math.round(a.progress * 100), "aria-label": a.name })
              : null,
          ),
          href
            ? h(
                "a",
                {
                  class: "z-btn z-btn--ghost z-btn--icon z-message-file__download",
                  "data-size": "sm",
                  href,
                  download: a.name,
                  "aria-label": `${ctx.labels.download} ${a.name}`,
                  title: ctx.labels.download,
                },
                icon("arrow-down-tray", 16),
              )
            : null,
        ),
      );
    } else if (a.kind === "voice") {
      out.push(
        voiceNode(a, ctx.voice ?? { playing: false, position: 0, rate: 1 }, ctx.labels, {
          bars: ctx.bars,
          key,
          id: `${ctx.uid}-audio-${m.id}`,
        }),
      );
    } else if (a.kind === "location") {
      const href = a.href ? safeHref(a.href) : null;
      const img = mediaSrc(a.image);
      const body = [
        h(
          "span",
          { class: "z-message-location__map", key: "map", "aria-hidden": "true" },
          img ? h("img", { src: img, alt: "", loading: "lazy", decoding: "async" }) : null,
          h("span", { class: "z-message-location__pin" }, icon("map-pin", 22)),
        ),
        h(
          "span",
          { class: "z-message-location__body", key: "body" },
          h("span", { class: "z-message-location__title" }, a.title ?? ctx.labels.location),
          a.address ? h("span", { class: "z-message-location__address" }, a.address) : null,
          href ? h("span", { class: "z-message-location__open" }, ctx.labels.openMap, icon("arrow-top-right-on-square", 12)) : null,
        ),
      ];
      out.push(
        href
          ? h("a", { class: "z-message-location", key, href, target: "_blank", rel: "noopener noreferrer" }, ...body)
          : h("div", { class: "z-message-location", key }, ...body),
      );
    } else if (a.kind === "link") {
      const href = safeHref(a.href);
      if (!href) return;
      const img = mediaSrc(a.image);
      out.push(
        h(
          "a",
          { class: "z-link-preview", key, href, target: "_blank", rel: "noopener noreferrer nofollow" },
          img
            ? h(
                "span",
                { class: "z-link-preview__image", "aria-hidden": "true" },
                h("img", { src: img, alt: "", loading: "lazy", decoding: "async" }),
              )
            : null,
          h(
            "span",
            { class: "z-link-preview__body" },
            h("span", { class: "z-link-preview__site" }, a.site ?? domainOf(href)),
            a.title ? h("span", { class: "z-link-preview__title" }, a.title) : null,
            a.description ? h("span", { class: "z-link-preview__description" }, a.description) : null,
          ),
        ),
      );
    }
  });
  return out;
}

export interface BubbleInput {
  message: ChatMessage;
  mine: boolean;
  position: BubblePosition;
  showAuthor: boolean;
  showAvatar?: boolean;
  /** Conversación de grupo: hueco del avatar a la izquierda de los mensajes ajenos. */
  group?: boolean;
}

/** Id del artículo de un mensaje dentro de una lista (`uid`). */
export const messageDomId = (uid: string, id: string) => `${uid}-m-${id.replace(/[^\w-]/g, "_")}`;

/** Una fila de mensaje: `li` con el avatar (en grupos), el artículo con la burbuja, las reacciones, el hilo y la barra de acciones. */
export function bubbleRow(input: BubbleInput, ctx: BubbleContext, tag: "li" | "div" = "li"): VEl {
  const { message: m, mine, position } = input;
  const { labels } = ctx;
  const domId = messageDomId(ctx.uid, m.id);
  const deleted = Boolean(m.deletedAt);
  const at = toInstant(m.createdAt) ?? 0;
  const status = mine && !deleted ? m.status : undefined;
  const authorName = mine ? labels.you : (m.author?.name ?? m.authorId);
  const time = timeLabel(at, ctx.timeZone, ctx.locale, ctx.hourCycle);
  const jumbo = !deleted && !m.attachments?.length && !m.replyTo && emojiOnly(m.text);
  const actions = deleted ? [] : (ctx.actions ?? MESSAGE_ACTIONS).filter((a) => mine || (a !== "edit" && a !== "delete"));
  const kinds = new Set((m.attachments ?? []).map((a) => a.kind));
  const article = h(
    "article",
    {
      class: "z-message",
      id: domId,
      "data-z-message": "",
      "data-id": m.id,
      "data-mine": on(mine),
      "data-position": position,
      "data-status": status,
      "data-deleted": on(deleted),
      "data-jumbo": on(jumbo),
      "data-flash": on(ctx.flash),
      "data-media": kinds.has("image") && !m.text ? "only" : kinds.has("image") ? "" : undefined,
      tabindex: ctx.active ? 0 : -1,
      "aria-labelledby": `${domId}-author`,
      "aria-describedby": `${domId}-meta`,
    },
    h(
      "div",
      { class: "z-message__bubble" },
      h("span", { class: input.showAuthor ? "z-message__author" : "z-sr-only", id: `${domId}-author` }, authorName),
      m.forwarded && !deleted ? h("span", { class: "z-message__forwarded" }, icon("arrow-turn-up-right", 12), labels.forwarded) : null,
      m.replyTo && !deleted
        ? h(
            "button",
            { type: "button", class: "z-quoted", "data-reply-to": m.replyTo.id },
            h("span", { class: "z-sr-only" }, `${fill(labels.quoted, { name: m.replyTo.author ?? "" })}: `),
            m.replyTo.author ? h("span", { class: "z-quoted__author", "aria-hidden": "true" }, m.replyTo.author) : null,
            h("span", { class: "z-quoted__text" }, m.replyTo.text ?? ""),
          )
        : null,
      ...(deleted ? [] : attachmentNodes(m, ctx)),
      deleted
        ? h("div", { class: "z-message__text z-message__text--deleted" }, icon("no-circle", 14), labels.deleted)
        : m.text
          ? h("div", { class: "z-message__text", dir: "auto" }, ...messageText(m.text, { mention: ctx.mention, highlight: ctx.highlight }))
          : null,
      h(
        "span",
        { class: "z-message__meta", id: `${domId}-meta` },
        m.editedAt && !deleted ? h("span", { class: "z-message__edited" }, labels.edited) : null,
        h("time", { datetime: new Date(at).toISOString() }, time),
        status ? deliveryNode(status, labels) : null,
        m.forwarded && !deleted ? h("span", { class: "z-sr-only" }, labels.forwarded) : null,
      ),
    ),
    status === "failed"
      ? h(
          "button",
          { type: "button", class: "z-message__retry", "aria-label": `${labels.retry}: ${labels.failed}` },
          icon("arrow-path", 14),
          labels.retry,
        )
      : null,
    m.reactions?.some((r) => r.count > 0) ? reactionsNode(m.reactions, labels) : null,
    m.thread && m.thread.count > 0 ? threadNode(m.thread, labels, { now: ctx.now, locale: ctx.locale }) : null,
  );
  const toolbar = actions.length
    ? h(
        "div",
        { class: "z-message__actions", role: "toolbar", "aria-label": labels.actions, "data-open": on(ctx.reacting) },
        ...(ctx.reacting
          ? [
              ...(ctx.quick ?? []).map((emoji, i) =>
                h(
                  "button",
                  {
                    type: "button",
                    class: "z-message__action z-message__quick",
                    key: `q${i}`,
                    "data-emoji": emoji,
                    "aria-label": emojiName(emoji),
                    tabindex: i === 0 ? 0 : -1,
                  },
                  emoji,
                ),
              ),
              h(
                "button",
                {
                  type: "button",
                  class: "z-message__action",
                  key: "more",
                  "data-action": "more-reactions",
                  "aria-label": labels.moreReactions,
                  title: labels.moreReactions,
                  tabindex: -1,
                },
                icon("plus", 16),
              ),
            ]
          : actions.map((a, i) =>
              h(
                "button",
                {
                  type: "button",
                  class: "z-message__action",
                  key: a,
                  "data-action": a,
                  "aria-label": labels[a],
                  title: labels[a],
                  tabindex: i === 0 ? 0 : -1,
                },
                icon(ACTION_ICON[a], 16),
              ),
            )),
      )
    : null;
  return h(
    tag,
    {
      class: "z-message-row",
      key: m.id,
      "data-mine": on(mine),
      "data-position": position,
      "data-group": on(input.group),
    },
    input.group && !mine
      ? h(
          "span",
          { class: "z-message-row__avatar", "aria-hidden": "true" },
          input.showAvatar ? avatarNode(m.author, { size: "sm", decorative: true }) : null,
        )
      : null,
    article,
    toolbar,
  );
}

const ACTION_ICON: Record<MessageAction, string> = {
  react: "face-smile",
  reply: "arrow-turn-up-left",
  forward: "arrow-turn-up-right",
  copy: "copy",
  edit: "pencil",
  delete: "trash",
};

/** Separador de día: un encabezado real (se navega por fechas con el lector), pegajoso al desplazar. */
export function dateNode(label: string, at: number, key: string, timeZone?: string): VEl {
  return h(
    "li",
    { class: "z-date-separator", key },
    h("h3", { class: "z-date-separator__label" }, h("time", { datetime: dayIso(at, timeZone) }, label)),
  );
}
const dayIso = (at: number, timeZone?: string) => {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
  } catch {
    return new Date(at).toISOString().slice(0, 10);
  }
};

/** Marca de no leídos: «3 unread messages». */
export const unreadNode = (count: number, labels: Pick<ChatLabels, "unread">, key = "unread"): VEl =>
  h("li", { class: "z-unread-marker", key }, h("span", { class: "z-unread-marker__label" }, fill(labels.unread, { n: count })));

/** Aviso del sistema («Ana joined»): centrado, sin burbuja. */
export const systemNode = (m: ChatMessage, key: string): VEl =>
  h("li", { class: "z-message-system", key }, h("span", { class: "z-message-system__text" }, m.text ?? ""));

/** Vista previa de un mensaje para la lista de conversaciones. */
export const previewText = (m: ChatMessage, labels: ChatLabels) => messagePreview(m, labels, 120);
