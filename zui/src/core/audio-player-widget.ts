// AudioPlayer y Waveform (core/widget). La onda es un `role="slider"` (APG «slider»): flechas cinco segundos, Re Pág y
// Av Pág quince, Inicio y Fin; con el puntero, buscar donde se pulsa. El reproductor añade reproducir o pausar,
// saltos atrás y adelante, velocidad y las teclas K, J y L en todo el grupo. Reutiliza el control del <audio> de la nota
// de voz (una sola pista suena a la vez en el documento) y su remuestreo de picos.
import { decodePeaks, playerKey, rateText, skipBy, skipLabel } from "./audio-player";
import { isRtl } from "./dir";
import { fractionAt, seekAudio, seekKey, toggleAudio, watchAudio } from "./voice-control";
import { clockText, nextRate, playedBars, resamplePeaks } from "./waveform";
import { h, icon, on, type VEl } from "./vnode";
import { list, num, yes, type Widget, type WidgetHost } from "./widget";

/** Onda que hace de deslizador de posición. */
export function waveNode(o: {
  peaks?: readonly number[];
  bars: number;
  position: number;
  duration: number;
  label: string;
  cls: string;
  loading?: boolean;
  disabled?: boolean;
}): VEl {
  const duration = Math.max(0, o.duration || 0);
  const progress = duration ? Math.min(1, o.position / duration) : 0;
  const bars = resamplePeaks(o.peaks, o.bars);
  const played = playedBars(progress, bars.length);
  return h(
    "div",
    {
      class: o.cls,
      role: "slider",
      tabindex: o.disabled ? -1 : 0,
      "aria-label": o.label,
      "aria-valuemin": 0,
      "aria-valuemax": Math.round(duration),
      "aria-valuenow": Math.round(Math.min(o.position, duration || o.position)),
      "aria-valuetext": `${clockText(o.position)} / ${clockText(duration)}`,
      "aria-disabled": o.disabled ? "true" : undefined,
      "aria-busy": o.loading ? "true" : undefined,
      "data-loading": on(o.loading),
      s: { "--z-wave-progress": progress.toFixed(4) },
    },
    ...bars.map((v, i) => h("span", { class: "z-waveform__bar", key: String(i), "data-played": on(i < played), s: { "--z-peak": v.toFixed(2) } })),
  );
}

/** Teclado y puntero de una onda: devuelve la posición nueva o `null`. */
function seekFromEvent(event: Event, wave: HTMLElement, position: number, duration: number): number | null {
  if (event.type === "keydown") return seekKey((event as KeyboardEvent).key, position, duration, isRtl(wave));
  if (event.type === "click") return fractionAt(wave, (event as MouseEvent).clientX) * duration;
  return null;
}

// ---- Waveform ----

export interface WaveformProps {
  /** Picos precalculados (cualquier escala). */
  peaks?: readonly number[];
  /** Audio del que calcular la onda con Web Audio si no hay `peaks` (con CORS si es de otro origen). */
  src?: string;
  /** Duración en segundos (la del audio, si se calcula). */
  duration?: number;
  /** Posición en segundos (controlado). */
  position?: number;
  defaultPosition?: number;
  bars?: number;
  label?: string;
  disabled?: boolean;
}

interface WaveConfig {
  peaks?: readonly number[];
  src?: string;
  duration?: number;
  position?: number;
  defaultPosition: number;
  bars: number;
  label: string;
  disabled: boolean;
}

interface WaveState {
  position: number;
  computed: { src: string; peaks: number[]; duration: number } | null;
  loading: boolean;
}

const decoding = new WeakMap<HTMLElement, AbortController>();

/** Calcula la onda de `src` si hace falta (una vez por fuente). */
function ensurePeaks<C extends { peaks?: readonly number[]; src?: string; bars: number }, S extends { computed: WaveState["computed"]; loading: boolean }>(
  root: HTMLElement,
  host: WidgetHost<C, S>,
  want: boolean,
): void {
  const c = host.config();
  const s = host.state();
  if (!want || c.peaks?.length || !c.src || s.computed?.src === c.src || s.loading) return;
  decoding.get(root)?.abort();
  const ctrl = new AbortController();
  decoding.set(root, ctrl);
  host.update({ loading: true } as Partial<S>);
  const src = c.src;
  void decodePeaks(root.ownerDocument.defaultView, src, 160, ctrl.signal).then((result) => {
    if (ctrl.signal.aborted) return;
    host.update({ loading: false, computed: result ? { src, ...result } : { src, peaks: [], duration: 0 } } as Partial<S>);
    if (result) host.emit("peaks", { peaks: result.peaks, duration: result.duration });
  });
}

export const waveformWidget: Widget<WaveformProps, WaveConfig, WaveState> = {
  root: "z-waveform",
  configure: (p) => ({
    peaks: p.peaks,
    src: p.src,
    duration: p.duration,
    position: p.position,
    defaultPosition: Math.max(0, Number(p.defaultPosition) || 0),
    bars: Math.max(8, Math.min(160, Math.floor(p.bars ?? 64))),
    label: p.label ?? "Seek",
    disabled: Boolean(p.disabled),
  }),
  initial: (c) => ({ position: c.position ?? c.defaultPosition, computed: null, loading: false }),
  control: (c, s) => (c.position !== undefined && c.position !== s.position ? { ...s, position: c.position } : s),
  tree(c, s) {
    const duration = c.duration ?? s.computed?.duration ?? 0;
    const wave = waveNode({
      peaks: c.peaks?.length ? c.peaks : s.computed?.peaks,
      bars: c.bars,
      position: s.position,
      duration,
      label: c.label,
      cls: "z-waveform__wave",
      loading: s.loading,
      disabled: c.disabled,
    });
    return h("div", { class: "z-waveform", "data-disabled": on(c.disabled) }, wave);
  },
  attach(root, host) {
    const handle = (event: Event) => {
      const wave = (event.target as Element).closest?.<HTMLElement>(".z-waveform__wave");
      const c = host.config();
      if (!wave || c.disabled) return;
      const duration = c.duration ?? host.state().computed?.duration ?? 0;
      const next = seekFromEvent(event, wave, host.state().position, duration);
      if (next === null) return;
      event.preventDefault();
      if (c.position === undefined) host.update({ position: next });
      host.emit("seek", { position: next });
    };
    root.addEventListener("click", handle);
    root.addEventListener("keydown", handle);
    return () => {
      decoding.get(root)?.abort();
      root.removeEventListener("click", handle);
      root.removeEventListener("keydown", handle);
    };
  },
  after(root, host) {
    ensurePeaks(root, host, true);
  },
  fromDom(el, json) {
    const d = el.dataset;
    return {
      peaks: d.peaks ? list(d.peaks).map(Number) : (json.peaks as number[] | undefined),
      src: d.src,
      duration: d.duration ? num(d.duration, 0) : undefined,
      defaultPosition: d.position ? num(d.position, 0) : undefined,
      bars: d.bars ? num(d.bars, 64) : undefined,
      label: d.label,
      disabled: yes(d.disabled),
    };
  },
};

// ---- AudioPlayer ----

export interface AudioPlayerLabels {
  player: string;
  play: string;
  pause: string;
  seek: string;
  /** «Back {seconds} seconds». */
  back: string;
  forward: string;
  /** «Playback speed {rate}». */
  speed: string;
}

export const AUDIO_PLAYER_LABELS: AudioPlayerLabels = {
  player: "Audio player",
  play: "Play",
  pause: "Pause",
  seek: "Seek",
  back: "Back {seconds} seconds",
  forward: "Forward {seconds} seconds",
  speed: "Playback speed {rate}",
};

export interface AudioPlayerProps {
  src?: string;
  title?: string;
  /** Línea bajo el título (autor, programa). */
  subtitle?: string;
  /** Segundos; si falta, la del audio al cargar sus metadatos. */
  duration?: number;
  peaks?: readonly number[];
  /** Calcula la onda con Web Audio si no hay `peaks` (descarga el audio entero). */
  analyze?: boolean;
  bars?: number;
  rates?: readonly number[];
  /** Segundos del salto atrás (10) y adelante (10). */
  skipBack?: number;
  skipForward?: number;
  labels?: Partial<AudioPlayerLabels>;
}

interface PlayerConfig {
  src: string;
  title?: string;
  subtitle?: string;
  duration?: number;
  peaks?: readonly number[];
  analyze: boolean;
  bars: number;
  rates: readonly number[];
  skipBack: number;
  skipForward: number;
  labels: AudioPlayerLabels;
}

interface PlayerState {
  playing: boolean;
  position: number;
  rate: number;
  /** De los metadatos del audio. */
  media: number;
  computed: WaveState["computed"];
  loading: boolean;
}

const playerDuration = (c: PlayerConfig, s: PlayerState) => c.duration ?? (s.media || s.computed?.duration || 0);

export const audioPlayerWidget: Widget<AudioPlayerProps, PlayerConfig, PlayerState> = {
  root: "z-audio-player",
  configure: (p) => ({
    src: p.src ?? "",
    title: p.title,
    subtitle: p.subtitle,
    duration: p.duration !== undefined && Number.isFinite(Number(p.duration)) ? Math.max(0, Number(p.duration)) : undefined,
    peaks: p.peaks,
    analyze: Boolean(p.analyze),
    bars: Math.max(16, Math.min(160, Math.floor(p.bars ?? 72))),
    rates: p.rates?.length ? p.rates : [1, 1.25, 1.5, 2, 0.75],
    skipBack: Math.max(1, Number(p.skipBack) || 10),
    skipForward: Math.max(1, Number(p.skipForward) || 10),
    labels: { ...AUDIO_PLAYER_LABELS, ...p.labels },
  }),
  initial: (c) => ({ playing: false, position: 0, rate: c.rates.includes(1) ? 1 : (c.rates[0] ?? 1), media: 0, computed: null, loading: false }),
  tree(c, s, uid) {
    const { labels } = c;
    const duration = playerDuration(c, s);
    const titleId = `${uid}-title`;
    return h(
      "div",
      {
        class: "z-audio-player",
        role: "group",
        "aria-label": c.title ? undefined : labels.player,
        "aria-labelledby": c.title ? titleId : undefined,
        "data-playing": on(s.playing),
      },
      h(
        "button",
        {
          type: "button",
          class: "z-btn z-btn--primary z-btn--icon z-audio-player__play",
          "data-size": "lg",
          key: "play",
          "aria-label": s.playing ? labels.pause : labels.play,
          title: s.playing ? labels.pause : labels.play,
          disabled: !c.src || undefined,
        },
        icon(s.playing ? "pause" : "play", 20),
      ),
      h(
        "div",
        { class: "z-audio-player__main", key: "main" },
        c.title || c.subtitle
          ? h(
              "div",
              { class: "z-audio-player__meta" },
              c.title ? h("span", { class: "z-audio-player__title", id: titleId }, c.title) : null,
              c.subtitle ? h("span", { class: "z-audio-player__subtitle" }, c.subtitle) : null,
            )
          : null,
        waveNode({
          peaks: c.peaks?.length ? c.peaks : s.computed?.peaks,
          bars: c.bars,
          position: s.position,
          duration,
          label: labels.seek,
          cls: "z-audio-player__wave",
          loading: s.loading,
          disabled: !c.src,
        }),
        h(
          "div",
          { class: "z-audio-player__times", "aria-hidden": "true" },
          h("span", { class: "z-audio-player__time" }, clockText(s.position)),
          h("span", { class: "z-audio-player__time" }, clockText(duration)),
        ),
      ),
      h(
        "div",
        { class: "z-audio-player__controls", key: "controls" },
        h(
          "button",
          { type: "button", class: "z-btn z-btn--ghost z-btn--icon z-audio-player__back", "data-size": "sm", "aria-label": skipLabel(labels.back, c.skipBack), title: skipLabel(labels.back, c.skipBack), disabled: !c.src || undefined },
          icon("backward", 16),
        ),
        h(
          "button",
          { type: "button", class: "z-btn z-btn--ghost z-btn--icon z-audio-player__forward", "data-size": "sm", "aria-label": skipLabel(labels.forward, c.skipForward), title: skipLabel(labels.forward, c.skipForward), disabled: !c.src || undefined },
          icon("forward", 16),
        ),
        h(
          "button",
          { type: "button", class: "z-btn z-btn--ghost z-audio-player__rate", "data-size": "sm", "aria-label": labels.speed.replace("{rate}", rateText(s.rate)), disabled: !c.src || undefined },
          rateText(s.rate),
        ),
      ),
      c.src ? h("audio", { class: "z-audio-player__audio", key: "audio", src: c.src, preload: "metadata", id: `${uid}-audio` }) : null,
    );
  },
  attach(root, host) {
    const audio = () => root.querySelector<HTMLAudioElement>(".z-audio-player__audio");
    let unwatch: (() => void) | null = null;
    let watched: HTMLAudioElement | null = null;
    const watch = () => {
      const el = audio();
      if (!el || el === watched) return el;
      unwatch?.();
      watched = el;
      unwatch = watchAudio(el, (u) => {
        host.update({ playing: u.playing, position: u.ended ? 0 : u.position });
        if (u.ended) host.emit("ended", {});
      });
      return el;
    };
    const seek = (to: number) => {
      const next = skipBy(to, 0, playerDuration(host.config(), host.state()));
      seekAudio(watch(), next);
      host.update({ position: next });
      host.emit("seek", { position: next });
    };
    const toggle = () => {
      const el = watch();
      if (!el) return;
      const playing = toggleAudio(el, host.state().rate);
      host.emit(playing ? "play" : "pause", {});
    };
    const onClick = (event: MouseEvent) => {
      const target = event.target as Element;
      const s = host.state();
      const c = host.config();
      if (target.closest?.(".z-audio-player__play")) toggle();
      else if (target.closest?.(".z-audio-player__back")) seek(s.position - c.skipBack);
      else if (target.closest?.(".z-audio-player__forward")) seek(s.position + c.skipForward);
      else if (target.closest?.(".z-audio-player__rate")) {
        const rate = nextRate(c.rates, s.rate);
        const el = audio();
        if (el) el.playbackRate = rate;
        host.update({ rate });
        host.emit("rate-change", { rate });
      } else {
        const wave = target.closest?.<HTMLElement>(".z-audio-player__wave");
        if (wave && c.src) {
          const next = seekFromEvent(event, wave, s.position, playerDuration(c, s));
          if (next !== null) seek(next);
        }
      }
    };
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest?.("input, textarea, select, [contenteditable]") || !host.config().src) return;
      const wave = target.closest?.<HTMLElement>(".z-audio-player__wave");
      const s = host.state();
      const c = host.config();
      const action = playerKey(event.key, { onButton: target.tagName === "BUTTON", modifier: event.ctrlKey || event.metaKey || event.altKey });
      if (action) {
        event.preventDefault();
        if (action === "toggle") toggle();
        else seek(s.position + (action === "back" ? -c.skipBack : c.skipForward));
        return;
      }
      if (wave) {
        const next = seekFromEvent(event, wave, s.position, playerDuration(c, s));
        if (next === null) return;
        event.preventDefault();
        seek(next);
      }
    };
    // `loadedmetadata` no burbujea: en captura. Da la duración si no vino por props.
    const onMeta = (event: Event) => {
      const el = event.target as HTMLAudioElement;
      if (!el.classList?.contains("z-audio-player__audio")) return;
      watch();
      if (Number.isFinite(el.duration) && el.duration > 0 && el.duration !== host.state().media) host.update({ media: el.duration });
      el.playbackRate = host.state().rate;
    };
    root.addEventListener("click", onClick);
    root.addEventListener("keydown", onKey);
    root.addEventListener("loadedmetadata", onMeta, true);
    return () => {
      unwatch?.();
      decoding.get(root)?.abort();
      audio()?.pause();
      root.removeEventListener("click", onClick);
      root.removeEventListener("keydown", onKey);
      root.removeEventListener("loadedmetadata", onMeta, true);
    };
  },
  after(root, host) {
    ensurePeaks(root, host, host.config().analyze);
  },
  fromDom(el, json) {
    const d = el.dataset;
    return {
      src: d.src,
      title: d.title,
      subtitle: d.subtitle,
      duration: d.duration ? num(d.duration, 0) : undefined,
      peaks: d.peaks ? list(d.peaks).map(Number) : (json.peaks as number[] | undefined),
      analyze: yes(d.analyze),
      bars: d.bars ? num(d.bars, 72) : undefined,
      rates: d.rates ? list(d.rates).map(Number) : undefined,
      skipBack: d.skipBack ? num(d.skipBack, 10) : undefined,
      skipForward: d.skipForward ? num(d.skipForward, 10) : undefined,
      labels: json.labels as Partial<AudioPlayerLabels> | undefined,
    };
  },
};
