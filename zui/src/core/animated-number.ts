// Número animado (AnimatedNumber): cuenta del valor anterior al nuevo con `Intl.NumberFormat`. El marcado (también el
// del servidor) ya trae el valor final, así que no hay desajuste de hidratación ni nada que esperar sin JavaScript;
// la cuenta solo reescribe el nodo de texto visible, que está oculto a los lectores de pantalla. Al lado, una copia
// solo para ellos con el valor final: se lee una vez y, con `live`, se anuncia una sola vez por cambio, nunca las
// cifras intermedias. Con `prefers-reduced-motion: reduce` (o `animate={false}`) el valor cambia sin cuenta.
// El árbol y la lógica sirven a React y al modo DOM; el documento solo se toca al llamar a `syncAnimatedNumber`.

import { decimalsOf, numberFormat, tweenValue } from "./chart";
import { h, type VEl } from "./vnode";
import { num, type Widget } from "./widget";

export interface AnimatedNumberProps {
  value?: number | null;
  /** Valor desde el que cuenta al montar (por defecto, al montar no cuenta: muestra el valor). */
  from?: number;
  format?: Intl.NumberFormatOptions;
  locale?: string;
  /** Duración de la cuenta en ms. */
  duration?: number;
  /** `false`: cambia sin cuenta. Con `prefers-reduced-motion: reduce`, siempre sin cuenta. */
  animate?: boolean;
  /** Anuncia el valor final al cambiar (`polite` o `assertive`); por defecto no se anuncia. */
  live?: "off" | "polite" | "assertive";
  /** Texto sin valor. */
  placeholder?: string;
}

export interface AnimatedNumberConfig {
  value: number | null;
  from?: number;
  format: Intl.NumberFormatOptions;
  locale?: string;
  duration: number;
  animate: boolean;
  live: "off" | "polite" | "assertive";
  placeholder: string;
}

export const ANIMATED_NUMBER_DURATION = 800;

export function animatedNumberConfig(p: AnimatedNumberProps): AnimatedNumberConfig {
  return {
    value: typeof p.value === "number" && Number.isFinite(p.value) ? p.value : null,
    from: typeof p.from === "number" && Number.isFinite(p.from) ? p.from : undefined,
    format: p.format ?? {},
    locale: p.locale,
    duration: Math.max(0, Math.min(10000, Number.isFinite(p.duration) ? Number(p.duration) : ANIMATED_NUMBER_DURATION)),
    animate: p.animate !== false,
    live: p.live === "polite" || p.live === "assertive" ? p.live : "off",
    placeholder: p.placeholder ?? "—",
  };
}

export const formatAnimated = (config: AnimatedNumberConfig, v: number | null) =>
  v === null ? config.placeholder : numberFormat(config.locale, config.format).format(v);

/** Árbol (raíz `span.z-animated-number`): el valor visible y su copia para lectores de pantalla. */
export function animatedNumberTree(config: AnimatedNumberConfig): VEl {
  const text = formatAnimated(config, config.value);
  return h(
    "span",
    { class: "z-animated-number", "data-empty": config.value === null ? "" : undefined },
    h("span", { key: "value", class: "z-animated-number__value", "aria-hidden": "true" }, text),
    h(
      "span",
      {
        key: "sr",
        class: "z-sr-only",
        "aria-live": config.live === "off" ? undefined : config.live,
        "aria-atomic": config.live === "off" ? undefined : "true",
      },
      text,
    ),
  );
}

/** Decimales de la cuenta: los del valor más preciso, sin pasar de los que muestra el formato. */
export function countDecimals(config: AnimatedNumberConfig, from: number, to: number): number {
  const max = numberFormat(config.locale, config.format).resolvedOptions().maximumFractionDigits ?? 3;
  const pct = config.format.style === "percent" ? 2 : 0;
  return Math.min(Math.max(decimalsOf(from), decimalsOf(to)), max + pct);
}

interface Memo {
  /** Valor al que se va. */
  target: number | null;
  /** Último valor pintado (durante la cuenta, el intermedio). */
  shown: number | null;
  frame: number;
}
const memos = new WeakMap<Element, Memo>();

/** Para la cuenta en curso de un número (al desmontar). */
export function stopAnimatedNumber(root: Element): void {
  const memo = memos.get(root);
  const win = root.ownerDocument?.defaultView;
  if (memo?.frame && win) win.cancelAnimationFrame(memo.frame);
  memos.delete(root);
}

/**
 * Tras pintar: si el valor cambió (o es el primer pintado con `from`), cuenta desde lo que se veía hasta el nuevo. Solo
 * reescribe el `nodeValue` del texto visible, el mismo nodo que pintó React o el modo DOM, y acaba en el texto final.
 */
export function syncAnimatedNumber(root: Element, config: AnimatedNumberConfig): void {
  const memo = memos.get(root);
  const to = config.value;
  if (memo && memo.target === to) return;
  const node = root.querySelector(".z-animated-number__value")?.firstChild;
  const win = root.ownerDocument?.defaultView;
  const start = memo ? memo.shown : (config.from ?? null);
  if (memo?.frame && win) win.cancelAnimationFrame(memo.frame);
  const next: Memo = { target: to, shown: to, frame: 0 };
  memos.set(root, next);
  const still = !win || !config.animate || config.duration === 0 || win.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (node?.nodeType !== 3 || start === null || to === null || start === to || still) return;
  const decimals = countDecimals(config, start, to);
  const f = numberFormat(config.locale, config.format);
  const text = node as Text;
  const t0 = win.performance.now();
  root.setAttribute("data-animating", "");
  const step = (now: number) => {
    const t = Math.min(1, (now - t0) / config.duration);
    const v = tweenValue(start, to, t, decimals);
    next.shown = v;
    text.nodeValue = f.format(v);
    if (t < 1) next.frame = win.requestAnimationFrame(step);
    else {
      next.frame = 0;
      root.removeAttribute("data-animating");
    }
  };
  // El primer cuadro se pinta ya con el valor de partida: sin destello del final.
  text.nodeValue = f.format(start);
  next.shown = start;
  next.frame = win.requestAnimationFrame(step);
}

/** Pieza del modo DOM: `<span class="z-animated-number" data-value="1284" data-locale="en-US">`. */
export const animatedNumberWidget: Widget<AnimatedNumberProps, AnimatedNumberConfig, Record<string, never>> = {
  root: "z-animated-number",
  configure: animatedNumberConfig,
  initial: () => ({}),
  tree: (config) => animatedNumberTree(config),
  attach(root) {
    return () => stopAnimatedNumber(root);
  },
  after(root, host) {
    syncAnimatedNumber(root, host.config());
  },
  fromDom(el, json) {
    const d = el.dataset;
    return {
      value: d.value !== undefined && d.value !== "" ? num(d.value, Number.NaN) : (json.value as number | undefined),
      from: d.from !== undefined ? num(d.from, Number.NaN) : undefined,
      format: json.format as Intl.NumberFormatOptions | undefined,
      locale: d.locale,
      duration: d.duration !== undefined ? num(d.duration, ANIMATED_NUMBER_DURATION) : undefined,
      animate: d.animate !== "false",
      live: d.live as AnimatedNumberProps["live"],
      placeholder: d.placeholder,
    };
  },
};
