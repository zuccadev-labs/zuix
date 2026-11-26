// MaskedInput sin framework: `.z-masked` con `data-mask` (preset: phone, card, date, time, plate, postal) o
// `data-pattern` (`9` cifra, `a` letra, `*` letra o cifra, `\` escapa), `data-transform="uppercase|lowercase"` y
// `data-incomplete-message`; dentro, el `.z-input__control` y, opcional, un `input[type=hidden]` con el `name` que
// recibe el crudo. La lógica es la de ../core/mask-control, la misma que el binding de React. z:change { raw, value,
// complete }. Una máscara con ranuras propias o una función: setMask(el, spec).
import { extractRaw, resolveMask, type MaskSpec } from "../core/mask";
import { attachMask, type MaskControl } from "../core/mask-control";
import { all, emit } from "./forms-popup";
import type { DomPart } from "./shared";

const controls = new Map<HTMLElement, MaskControl>();
const specs = new WeakMap<HTMLElement, MaskSpec>();

function specOf(el: HTMLElement): MaskSpec | null {
  const own = specs.get(el);
  if (own) return own;
  const base = resolveMask(el.dataset.mask ?? el.dataset.pattern);
  if (!base) return null;
  const transform = el.dataset.transform === "uppercase" || el.dataset.transform === "lowercase" ? el.dataset.transform : base.transform;
  return { ...base, transform };
}

const hiddenOf = (el: HTMLElement) => el.querySelector<HTMLInputElement>(":scope > input[type=hidden]");

function mount(el: HTMLElement): void {
  if (controls.has(el)) return;
  const input = el.querySelector<HTMLInputElement>(".z-input__control");
  if (!input) return;
  const initial = hiddenOf(el)?.value || input.value;
  const control = attachMask(input, {
    spec: () => specOf(el),
    incompleteMessage: () => el.dataset.incompleteMessage ?? "Enter the complete value",
    onChange: (change) => {
      const hidden = hiddenOf(el);
      if (hidden) hidden.value = change.raw;
      emit(el, "change", change);
    },
  });
  const spec = specOf(el);
  if (spec) {
    control.set(extractRaw(spec, initial));
    const hidden = hiddenOf(el);
    if (hidden) hidden.value = extractRaw(spec, initial);
  }
  // `form.reset()` vuelve al valor con el que se preparó el campo.
  input.form?.addEventListener("reset", () =>
    setTimeout(() => {
      const s = specOf(el);
      const raw = s ? extractRaw(s, initial) : initial;
      control.set(raw);
      const hidden = hiddenOf(el);
      if (hidden) hidden.value = raw;
    }, 0),
  );
  controls.set(el, control);
}

/** Escribe un valor crudo en el campo (formatea; no emite z:change). */
export function setMaskedValue(el: HTMLElement, raw: string): void {
  mount(el);
  controls.get(el)?.set(raw);
  const spec = specOf(el);
  const hidden = hiddenOf(el);
  if (hidden) hidden.value = spec ? extractRaw(spec, raw) : raw;
}

/** Máscara propia (ranuras con `test`, patrón como función). Reformatea lo que haya. */
export function setMask(el: HTMLElement, spec: MaskSpec): void {
  specs.set(el, spec);
  mount(el);
  const input = el.querySelector<HTMLInputElement>(".z-input__control");
  if (input) controls.get(el)?.set(extractRaw(spec, input.value));
}

export const maskedPart: DomPart = {
  rank: 45.2,
  setup() {},
  hydrate(root) {
    for (const el of all(root, ".z-masked")) mount(el);
  },
  teardown() {
    for (const control of controls.values()) control.destroy();
    controls.clear();
  },
};
