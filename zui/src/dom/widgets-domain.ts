// Piezas de dominio de la 0.5 sin framework, con el mismo árbol que el binding de React: ChatSearch (familia chat),
// WebPreview, VoiceInput y StackTrace (ai), AudioPlayer y Waveform (media). Mentions (forms) conecta su interacción al
// campo ya escrito: candidatos en `<script type="application/json" data-props>{ "sources": […] }</script>` y carga
// asíncrona con setMentionsLoader(el, trigger, load). Cada familia registra los iconos de sus piezas.
import { registerIcons } from "@zuccadev-labs/zuix-zicon/dom";
import { arrowLeft } from "@zuccadev-labs/zuix-zicon/icons/arrow-left";
import { arrowPath } from "@zuccadev-labs/zuix-zicon/icons/arrow-path";
import { arrowRight } from "@zuccadev-labs/zuix-zicon/icons/arrow-right";
import { arrowTopRightOnSquare } from "@zuccadev-labs/zuix-zicon/icons/arrow-top-right-on-square";
import { backward } from "@zuccadev-labs/zuix-zicon/icons/backward";
import { chevronDown } from "@zuccadev-labs/zuix-zicon/icons/chevron-down";
import { chevronRight } from "@zuccadev-labs/zuix-zicon/icons/chevron-right";
import { chevronUp } from "@zuccadev-labs/zuix-zicon/icons/chevron-up";
import { computerDesktop } from "@zuccadev-labs/zuix-zicon/icons/computer-desktop";
import { copy } from "@zuccadev-labs/zuix-zicon/icons/copy";
import { exclamationTriangle } from "@zuccadev-labs/zuix-zicon/icons/exclamation-triangle";
import { forward } from "@zuccadev-labs/zuix-zicon/icons/forward";
import { globeAlt } from "@zuccadev-labs/zuix-zicon/icons/globe-alt";
import { lockClosed } from "@zuccadev-labs/zuix-zicon/icons/lock-closed";
import { magnifyingGlass } from "@zuccadev-labs/zuix-zicon/icons/magnifying-glass";
import { microphone } from "@zuccadev-labs/zuix-zicon/icons/microphone";
import { microphoneSlash } from "@zuccadev-labs/zuix-zicon/icons/microphone-slash";
import { mobile } from "@zuccadev-labs/zuix-zicon/icons/mobile";
import { paperAirplane } from "@zuccadev-labs/zuix-zicon/icons/paper-airplane";
import { pause } from "@zuccadev-labs/zuix-zicon/icons/pause";
import { play } from "@zuccadev-labs/zuix-zicon/icons/play";
import { tablet } from "@zuccadev-labs/zuix-zicon/icons/tablet";
import { trash } from "@zuccadev-labs/zuix-zicon/icons/trash";
import { xMark } from "@zuccadev-labs/zuix-zicon/icons/x-mark";
import type { AsyncLoader } from "../core/async-options";
import { audioPlayerWidget, waveformWidget } from "../core/audio-player-widget";
import { chatSearchWidget } from "../core/chat-search-widget";
import type { MentionItem } from "../core/mentions";
import { attachMentions, MENTIONS_LABELS, type MentionSource, type MentionsLabels } from "../core/mentions-widget";
import { stackTraceWidget } from "../core/stack-trace-widget";
import { voiceInputWidget } from "../core/voice-input-widget";
import { webPreviewWidget } from "../core/web-preview-widget";
import { all, emit } from "./forms-popup";
import type { DomPart } from "./shared";
import { widgetPart } from "./widgets";

export const chatSearchPart = /* @__PURE__ */ (() => {
  registerIcons([chevronDown, chevronUp, magnifyingGlass, xMark]);
  return widgetPart(46.3, [chatSearchWidget]);
})();

export const aiToolsPart = /* @__PURE__ */ (() => {
  registerIcons([
    arrowLeft,
    arrowPath,
    arrowRight,
    arrowTopRightOnSquare,
    chevronDown,
    chevronRight,
    computerDesktop,
    copy,
    exclamationTriangle,
    globeAlt,
    lockClosed,
    microphone,
    microphoneSlash,
    mobile,
    paperAirplane,
    pause,
    tablet,
    trash,
  ]);
  return widgetPart(46.4, [webPreviewWidget, voiceInputWidget, stackTraceWidget]);
})();

export const audioPart = /* @__PURE__ */ (() => {
  registerIcons([backward, forward, pause, play]);
  return widgetPart(46.5, [audioPlayerWidget, waveformWidget]);
})();

interface MentionsEntry {
  sources: MentionSource[];
  labels: MentionsLabels;
  detach: () => void;
}
const mentions = new Map<HTMLElement, MentionsEntry>();

function readJSON(el: HTMLElement): Record<string, unknown> {
  const script = el.querySelector<HTMLScriptElement>(':scope > script[type="application/json"][data-props]');
  try {
    const value = script?.textContent ? (JSON.parse(script.textContent) as unknown) : {};
    return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Mentions del marcado: `.z-mentions` con el campo dentro. Emite `z:mention { item }` al elegir. */
export const mentionsPart: DomPart = {
  rank: 46.6,
  setup() {},
  hydrate(root) {
    for (const el of all(root, ".z-mentions")) {
      if (mentions.has(el)) continue;
      const json = readJSON(el);
      const entry: MentionsEntry = {
        sources: Array.isArray(json.sources) ? (json.sources as MentionSource[]).filter((s) => s && typeof s.trigger === "string") : [],
        labels: { ...MENTIONS_LABELS, ...(json.labels as Partial<MentionsLabels> | undefined) },
        detach: () => {},
      };
      mentions.set(el, entry);
      entry.detach = attachMentions(el, {
        sources: () => entry.sources,
        labels: () => entry.labels,
        select: (item) => emit(el, "mention", { item }),
      });
    }
  },
  teardown() {
    for (const entry of mentions.values()) entry.detach();
    mentions.clear();
  },
};

/** Carga asíncrona de los candidatos de un disparador de un `.z-mentions` del modo DOM. */
export function setMentionsLoader(el: HTMLElement, trigger: string, load: AsyncLoader<MentionItem>): void {
  const entry = mentions.get(el);
  if (!entry) return;
  const known = entry.sources.find((s) => s.trigger === trigger);
  entry.sources = known ? entry.sources.map((s) => (s === known ? { ...s, items: undefined, load } : s)) : [...entry.sources, { trigger, load }];
}

/** Candidatos fijos de un disparador. */
export function setMentionsItems(el: HTMLElement, trigger: string, items: readonly MentionItem[]): void {
  const entry = mentions.get(el);
  if (!entry) return;
  const known = entry.sources.find((s) => s.trigger === trigger);
  entry.sources = known ? entry.sources.map((s) => (s === known ? { ...s, items, load: undefined } : s)) : [...entry.sources, { trigger, items }];
}
