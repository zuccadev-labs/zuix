// Barra de carga superior (TopProgress): el controlador imperativo al estilo de NProgress (`start`, `set`, `inc`,
// `done`) con su goteo, que avanza deprisa al principio y cada vez más despacio sin llegar nunca al final, y la pieza
// que lo pinta. El controlador compartido `topProgress` no hace nada al importarse: los temporizadores empiezan con
// `start()`. El estado se anuncia («Loading», «Loaded») en la región viva del documento.
import { announce } from "./announcer";
import { h, on } from "./vnode";
import { num, yes, type Widget } from "./widget";

export type ProgressStatus = "idle" | "loading" | "done";

export interface ProgressSnapshot {
  status: ProgressStatus;
  /** 0–1. */
  value: number;
}

/** Paso del goteo para el valor actual: grande al principio, mínimo cerca del final (nunca pasa de 0.994). */
export function trickleStep(value: number): number {
  const v = Number.isFinite(value) ? value : 0;
  if (v < 0.2) return 0.1;
  if (v < 0.5) return 0.04;
  if (v < 0.8) return 0.02;
  if (v < 0.99) return 0.005;
  return 0;
}

/** Valor tras un incremento (`amount`, o el del goteo), acotado a [0, 0.994]. */
export function advance(value: number, amount?: number): number {
  const v = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  const step = amount === undefined ? trickleStep(v) : amount;
  return Math.max(0, Math.min(0.994, v + (Number.isFinite(step) ? step : 0)));
}

export interface ProgressOptions {
  /** Valor con el que empieza (0.08). */
  minimum?: number;
  /** Cada cuánto gotea (ms, 300). */
  trickleMs?: number;
  /** Cuánto se queda llena tras `done()` antes de ocultarse (ms, 400). */
  doneMs?: number;
  /** Temporizadores (inyectables en las pruebas). */
  timers?: { set(fn: () => void, ms: number): unknown; clear(id: unknown): void };
}

export interface ProgressController {
  snapshot(): ProgressSnapshot;
  subscribe(fn: (s: ProgressSnapshot) => void): () => void;
  /** Empieza (o sigue, si ya estaba en marcha) con goteo. */
  start(): void;
  /** Fija el valor (0–1) y deja de gotear hasta el siguiente `inc` o `start`. */
  set(value: number): void;
  /** Avanza un paso (o `amount`). Si estaba parada, empieza. */
  inc(amount?: number): void;
  /** Llena la barra y la oculta poco después. Sin `force`, no hace nada si no estaba en marcha. */
  done(force?: boolean): void;
  /** Vuelve a reposo sin anunciar el final. */
  reset(): void;
}

export function createProgress(options: ProgressOptions = {}): ProgressController {
  const timers = options.timers ?? { set: (fn, ms) => setTimeout(fn, ms), clear: (id) => clearTimeout(id as ReturnType<typeof setTimeout>) };
  const minimum = Math.max(0, Math.min(0.5, options.minimum ?? 0.08));
  const trickleMs = Math.max(16, options.trickleMs ?? 300);
  const doneMs = Math.max(0, options.doneMs ?? 400);
  let state: ProgressSnapshot = { status: "idle", value: 0 };
  let trickle: unknown = null;
  let hide: unknown = null;
  const listeners = new Set<(s: ProgressSnapshot) => void>();
  const emit = (next: ProgressSnapshot) => {
    if (next.status === state.status && next.value === state.value) return;
    state = next;
    for (const fn of [...listeners]) fn(state);
  };
  const stopTrickle = () => {
    if (trickle !== null) timers.clear(trickle);
    trickle = null;
  };
  const stopHide = () => {
    if (hide !== null) timers.clear(hide);
    hide = null;
  };
  const tick = () => {
    trickle = null;
    if (state.status !== "loading") return;
    emit({ status: "loading", value: advance(state.value) });
    trickle = timers.set(tick, trickleMs);
  };
  const begin = (value: number) => {
    stopHide();
    emit({ status: "loading", value: Math.max(minimum, Math.min(0.994, value)) });
  };
  return {
    snapshot: () => state,
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    start() {
      begin(state.status === "loading" ? state.value : minimum);
      if (trickle === null) trickle = timers.set(tick, trickleMs);
    },
    set(value) {
      stopTrickle();
      begin(Number.isFinite(value) ? value : 0);
    },
    inc(amount) {
      if (state.status !== "loading") {
        this.start();
        return;
      }
      emit({ status: "loading", value: advance(state.value, amount) });
    },
    done(force) {
      if (state.status !== "loading" && !force) return;
      stopTrickle();
      stopHide();
      emit({ status: "done", value: 1 });
      hide = timers.set(() => {
        hide = null;
        emit({ status: "idle", value: 0 });
      }, doneMs);
    },
    reset() {
      stopTrickle();
      stopHide();
      emit({ status: "idle", value: 0 });
    },
  };
}

/** Controlador compartido de la página: `topProgress.start()` al empezar una navegación, `topProgress.done()` al acabar. */
export const topProgress: ProgressController = /* @__PURE__ */ createProgress();

export interface TopProgressLabels {
  /** Nombre de la barra y anuncio al empezar. */
  loading: string;
  /** Anuncio al terminar. */
  done: string;
}

export const TOP_PROGRESS_LABELS: TopProgressLabels = { loading: "Loading", done: "Loaded" };

export interface TopProgressProps {
  /** Valor 0–100 (controlado): barra determinada. */
  value?: number;
  /** En marcha (controlado). Sin `value`, indeterminada. */
  active?: boolean;
  /** Barra indeterminada (franja que recorre la barra) en vez de goteo. */
  indeterminate?: boolean;
  /** Controlador que sigue la barra sin `value` ni `active` (el compartido `topProgress` por defecto). */
  controller?: ProgressController;
  /** Anuncia el principio y el final en la región viva (true). */
  announce?: boolean;
  /** Dentro de su contenedor en vez de fija arriba de la ventana. */
  inline?: boolean;
  labels?: Partial<TopProgressLabels>;
}

interface Config {
  value?: number;
  active?: boolean;
  indeterminate: boolean;
  controller: ProgressController;
  announce: boolean;
  inline: boolean;
  labels: TopProgressLabels;
}

interface State {
  snapshot: ProgressSnapshot;
  /** Último estado anunciado. */
  said: ProgressStatus;
}

/** Lo que se pinta: lo controlado por props o lo del controlador. */
export function progressView(c: Pick<Config, "value" | "active">, store: ProgressSnapshot): ProgressSnapshot & { determinate: boolean } {
  if (c.value !== undefined && Number.isFinite(c.value)) {
    const v = Math.max(0, Math.min(100, c.value)) / 100;
    const status: ProgressStatus = c.active === false ? "idle" : v >= 1 ? "done" : "loading";
    return { status, value: v, determinate: true };
  }
  if (c.active !== undefined) return { status: c.active ? "loading" : "idle", value: 0, determinate: false };
  return { ...store, determinate: true };
}

// Tras cada pintado: cambio de controlador y anuncio del estado nuevo.
const checks = new WeakMap<HTMLElement, () => void>();

export const topProgressWidget: Widget<TopProgressProps, Config, State> = {
  root: "z-top-progress",
  configure: (p) => ({
    value: p.value,
    active: p.active,
    indeterminate: Boolean(p.indeterminate),
    controller: p.controller ?? topProgress,
    announce: p.announce !== false,
    inline: Boolean(p.inline),
    labels: { ...TOP_PROGRESS_LABELS, ...p.labels },
  }),
  initial: (c) => ({ snapshot: c.controller.snapshot(), said: "idle" }),
  tree(c, s) {
    const view = progressView(c, s.snapshot);
    const indeterminate = !view.determinate || (c.indeterminate && view.status === "loading");
    const percent = Math.round(view.value * 100);
    return h(
      "div",
      {
        class: "z-top-progress",
        role: "progressbar",
        "aria-label": c.labels.loading,
        "aria-valuemin": 0,
        "aria-valuemax": 100,
        "aria-valuenow": indeterminate || view.status === "idle" ? undefined : percent,
        "aria-hidden": view.status === "idle" ? "true" : undefined,
        "data-state": view.status,
        "data-indeterminate": on(indeterminate),
        "data-inline": on(c.inline),
        s: { "--z-progress": (indeterminate ? 0 : view.value).toFixed(3) },
      },
      h("span", { class: "z-top-progress__bar" }),
    );
  },
  attach(root, host) {
    const say = () => {
      const c = host.config();
      const status = progressView(c, host.state().snapshot).status;
      const said = host.state().said;
      if (status === said || (status === "idle" && said === "done")) return;
      if (status === "loading" && said !== "loading" && c.announce) announce(c.labels.loading, { source: root });
      if (status === "done" && c.announce) announce(c.labels.done, { source: root });
      host.state().said = status === "idle" ? "idle" : status;
    };
    let controller = host.config().controller;
    let off = controller.subscribe((snapshot) => host.update({ snapshot }));
    const check = () => {
      const next = host.config().controller;
      if (next !== controller) {
        off();
        controller = next;
        off = controller.subscribe((snapshot) => host.update({ snapshot }));
        host.update({ snapshot: controller.snapshot() });
      }
      say();
    };
    checks.set(root, check);
    check();
    return () => {
      off();
      checks.delete(root);
    };
  },
  after(root) {
    checks.get(root)?.();
  },
  fromDom(el) {
    const d = el.dataset;
    return {
      value: d.value !== undefined && d.value !== "" ? num(d.value, 0) : undefined,
      active: d.active === undefined ? undefined : yes(d.active),
      indeterminate: yes(d.indeterminate),
      announce: d.announce === "false" ? false : undefined,
      inline: yes(d.inline),
      labels: d.label ? { loading: d.label } : undefined,
    };
  },
};
