// Campos compuestos sin framework: InputGroup, PasswordInput y NumberInput.
//
// InputGroup     .z-input-group > .z-input-group__addon + .z-input-group__control. Pulsar en un adorno (no en un
//                botón suyo) enfoca el control.
// PasswordInput  .z-password > .z-input > input + button.z-password__toggle[aria-pressed]; medidor opcional
//                .z-password__meter > .z-password__bar ×4 + .z-password__label (data-labels="a|b|c|d|e" y
//                data-prefix en .z-password). Se oculta al enviar el formulario salvo data-keep-visible.
//                z:change { visible } en .z-password.
// NumberInput    .z-input.z-number > input[role=spinbutton] (+ button.z-number__step[data-step=up|down]) e
//                input[type=hidden] opcional. En .z-number: data-min, data-max, data-step, data-large-step,
//                data-locale, data-format (JSON de Intl.NumberFormatOptions), data-value, data-wheel.
//                z:change { value } (número o null). setNumberInputValue().
// CheckboxGroup  fieldset.z-checkgroup con casillas [role=checkbox][value]; la casilla [data-select-all] marca o
//                desmarca las demás y se ve indeterminada con algunas. z:change { value: string[] } en el grupo.
// Field          .z-field[data-validate]: muestra el error de la validación nativa del control tras interactuar
//                (al salir si se editó, o al enviar) en un p.z-field__error, con aria-invalid y aria-describedby;
//                lo quita al corregirlo. Mensajes propios: data-msg-value-missing, data-msg-type-mismatch…
// Form           form.z-form[novalidate]: al enviar comprueba los controles y, si falla alguno, cancela el envío,
//                lleva el foco al primer error y emite z:invalid en el formulario.
import { clampNumber, formatNumber, parseNumber, stepNumber } from "../core/number";
import { passwordStrength } from "../core/password";
import { messageAttribute, validateForm, validityMessage, VALIDITY_KEYS, type ValidityMessages } from "../core/validity";
import { all, emit, flag, inDom } from "./forms-popup";
import type { Listen } from "./shared";

/* ---------- InputGroup ---------- */

const INTERACTIVE = "button, a, input, select, textarea, label, [tabindex], [contenteditable]";

function onAddonDown(event: MouseEvent): void {
  const target = event.target;
  if (!(target instanceof Element) || target.closest(INTERACTIVE)) return;
  const addon = target.closest(".z-input-group__addon");
  if (!addon || !inDom(addon)) return;
  const control = addon.closest(".z-input-group")?.querySelector<HTMLInputElement>(".z-input-group__control");
  if (!control || control.disabled) return;
  event.preventDefault();
  control.focus();
}

/* ---------- PasswordInput ---------- */

const LABELS = ["Too short", "Weak", "Fair", "Good", "Strong"];

function paintMeter(box: HTMLElement): void {
  const input = box.querySelector<HTMLInputElement>(".z-input__control");
  const meter = box.querySelector<HTMLElement>(".z-password__meter");
  if (!input || !meter) return;
  const fixed = box.dataset.strength;
  const rated = input.value !== "" || (fixed !== undefined && fixed !== "");
  const score =
    fixed !== undefined && fixed !== "" ? Math.max(0, Math.min(4, Math.round(Number(fixed)))) : passwordStrength(input.value).score;
  if (rated) meter.dataset.score = String(score);
  else delete meter.dataset.score;
  const label = meter.querySelector(".z-password__label");
  const labels = box.dataset.labels?.split("|") ?? LABELS;
  if (label) label.textContent = rated ? `${box.dataset.prefix ?? "Strength:"} ${labels[score] ?? LABELS[score]}` : "";
}

function setVisible(box: HTMLElement, visible: boolean): void {
  const input = box.querySelector<HTMLInputElement>(".z-input__control");
  const toggle = box.querySelector<HTMLButtonElement>(".z-password__toggle");
  if (!input || !toggle) return;
  const before = toggle.getAttribute("aria-pressed") === "true";
  input.type = visible ? "text" : "password";
  toggle.setAttribute("aria-pressed", String(visible));
  if (before !== visible) emit(box, "change", { visible });
}

/* ---------- NumberInput ---------- */

const num = (raw: string | undefined) => (raw !== undefined && raw.trim() !== "" && Number.isFinite(Number(raw)) ? Number(raw) : undefined);

function numberConfig(box: HTMLElement) {
  let format: Intl.NumberFormatOptions | undefined;
  try {
    format = box.dataset.format ? (JSON.parse(box.dataset.format) as Intl.NumberFormatOptions) : undefined;
  } catch {
    format = undefined;
  }
  const step = num(box.dataset.step) ?? 1;
  return {
    min: num(box.dataset.min),
    max: num(box.dataset.max),
    step,
    large: num(box.dataset.largeStep) ?? step * 10,
    locale: box.dataset.locale || undefined,
    format,
    percent: format?.style === "percent",
  };
}

const numberInput = (box: Element) => box.querySelector<HTMLInputElement>("input.z-number__input, input[role='spinbutton']");
const numberValue = (box: HTMLElement): number | null => {
  const raw = box.dataset.value;
  return raw === undefined || raw === "" || !Number.isFinite(Number(raw)) ? null : Number(raw);
};

function paintNumber(box: HTMLElement, value: number | null): void {
  const { min, max, locale, format } = numberConfig(box);
  const input = numberInput(box);
  if (value === null) delete box.dataset.value;
  else box.dataset.value = String(value);
  if (input) {
    input.value = formatNumber(value, locale, format);
    flag(input, "aria-valuenow", value !== null, String(value));
    flag(input, "aria-valuetext", value !== null, input.value);
    flag(input, "aria-valuemin", min !== undefined, String(min));
    flag(input, "aria-valuemax", max !== undefined, String(max));
  }
  const hidden = box.querySelector<HTMLInputElement>('input[type="hidden"]');
  if (hidden) hidden.value = value === null ? "" : String(value);
  const off = input?.disabled || input?.readOnly;
  for (const button of box.querySelectorAll<HTMLButtonElement>(".z-number__step")) {
    const up = button.dataset.step === "up";
    button.disabled = Boolean(off || (value !== null && (up ? max !== undefined && value >= max : min !== undefined && value <= min)));
  }
}

function commitNumber(box: HTMLElement, value: number | null): void {
  const before = numberValue(box);
  paintNumber(box, value);
  if (value !== before) emit(box, "change", { value });
}

/** Fija el valor de un NumberInput (`null` lo vacía), ajustado al rango y al paso. Emite z:change si cambia. */
export function setNumberInputValue(box: HTMLElement, value: number | null): void {
  const { min, max, step } = numberConfig(box);
  commitNumber(box, value === null || !Number.isFinite(value) ? null : clampNumber(value, { min, max, step }));
}

/** Valor que el campo tiene ahora: lo escrito (si se puede leer) o el último confirmado. */
function typedValue(box: HTMLElement): number | null {
  const input = numberInput(box);
  const { locale, percent } = numberConfig(box);
  const shown = formatNumber(numberValue(box), locale, numberConfig(box).format);
  if (!input || input.value === shown) return numberValue(box);
  return parseNumber(input.value, locale, percent);
}

function nudge(box: HTMLElement, delta: number, large = false): void {
  const input = numberInput(box);
  if (!input || input.disabled || input.readOnly) return;
  const { min, max, step, large: big } = numberConfig(box);
  commitNumber(box, stepNumber(typedValue(box), delta, { min, max, step: large ? big : step }));
}

function settleNumber(box: HTMLElement): void {
  const input = numberInput(box);
  if (!input) return;
  const { min, max, step } = numberConfig(box);
  const typed = typedValue(box);
  commitNumber(box, typed === null ? null : clampNumber(typed, { min, max, step }));
  // Aunque el valor no cambie, el texto vuelve al formato.
  paintNumber(box, numberValue(box));
}

function onNumberKey(box: HTMLElement, event: KeyboardEvent): void {
  const { min, max } = numberConfig(box);
  switch (event.key) {
    case "ArrowUp":
    case "ArrowDown":
      event.preventDefault();
      nudge(box, event.key === "ArrowUp" ? 1 : -1);
      break;
    case "PageUp":
    case "PageDown":
      event.preventDefault();
      nudge(box, event.key === "PageUp" ? 1 : -1, true);
      break;
    case "Home":
    case "End": {
      const to = event.key === "Home" ? min : max;
      if (to === undefined) return;
      event.preventDefault();
      commitNumber(box, to);
      break;
    }
    case "Enter":
      settleNumber(box);
      break;
    default:
  }
}

let hold: ReturnType<typeof setTimeout> | undefined;
const release = () => clearTimeout(hold);

function onStepDown(button: HTMLButtonElement, event: PointerEvent): void {
  const box = button.closest<HTMLElement>(".z-number");
  if (!box || button.disabled || event.button !== 0) return;
  event.preventDefault();
  numberInput(box)?.focus({ preventScroll: true });
  const delta = button.dataset.step === "up" ? 1 : -1;
  nudge(box, delta);
  release();
  const repeat = (wait: number) => {
    hold = setTimeout(() => {
      nudge(box, delta);
      repeat(60);
    }, wait);
  };
  repeat(400);
}

/* ---------- CheckboxGroup ---------- */

const groupBoxes = (group: Element) =>
  [...group.querySelectorAll<HTMLElement>('.z-checkgroup__items [role="checkbox"]')].filter(
    (box) => box.closest(".z-checkgroup") === group,
  );
const boxOn = (box: Element) => box.getAttribute("aria-checked") === "true";
const boxOff = (box: HTMLElement) => box.hasAttribute("data-disabled") || (box as HTMLButtonElement).disabled;

function paintBox(box: HTMLElement, state: "checked" | "unchecked" | "indeterminate"): void {
  box.dataset.state = state;
  box.setAttribute("aria-checked", state === "indeterminate" ? "mixed" : String(state === "checked"));
  let mark = box.querySelector<HTMLElement>(".z-check__mark");
  if (state !== "unchecked" && !mark) {
    mark = document.createElement("span");
    mark.className = "z-check__mark";
    box.append(mark);
  }
  if (state === "unchecked") mark?.remove();
  else if (mark) mark.dataset.state = state;
  const input = box.parentElement?.querySelector<HTMLInputElement>(':scope > input[type="checkbox"]');
  if (input) {
    input.checked = state === "checked";
    input.indeterminate = state === "indeterminate";
  }
}

function syncAll(group: HTMLElement): void {
  const all = group.querySelector<HTMLElement>('[data-select-all][role="checkbox"]');
  if (!all) return;
  const usable = groupBoxes(group).filter((box) => !boxOff(box));
  const on = usable.filter(boxOn).length;
  paintBox(all, on === 0 ? "unchecked" : on === usable.length ? "checked" : "indeterminate");
}

function onGroupChange(event: Event): void {
  const box = event.target;
  if (!(box instanceof HTMLElement) || !box.matches('[role="checkbox"]')) return;
  const group = box.closest<HTMLElement>(".z-checkgroup");
  if (!group || !inDom(group)) return;
  if (box.hasAttribute("data-select-all")) {
    const on = boxOn(box);
    for (const item of groupBoxes(group)) if (!boxOff(item)) paintBox(item, on ? "checked" : "unchecked");
  }
  syncAll(group);
  emit(group, "change", {
    value: groupBoxes(group)
      .filter(boxOn)
      .map((item) => item.getAttribute("value") ?? ""),
  });
}

/* ---------- Validación de Field y Form ---------- */

type Validatable = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
const validatable = (el: EventTarget | null): el is Validatable =>
  el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement;
const edited = new WeakSet<Element>();
let errorSeq = 0;

function fieldMessages(field: HTMLElement): ValidityMessages {
  const out: ValidityMessages = {};
  for (const key of VALIDITY_KEYS) {
    const text = field.getAttribute(messageAttribute(key));
    if (text) out[key] = text;
  }
  return out;
}

/** Controles visibles del campo que describen el error (el nativo oculto de un control propio, no). */
const describedControls = (field: HTMLElement) =>
  [
    ...field.querySelectorAll<HTMLElement>(
      "input, select, textarea, [role='checkbox'], [role='switch'], [role='combobox'], [role='radiogroup']",
    ),
  ].filter((el) => !el.matches(".z-native-input, [type='hidden']"));

function showFieldError(field: HTMLElement, message: string | null): void {
  const body = field.querySelector<HTMLElement>(".z-field__body") ?? field;
  let error = body.querySelector<HTMLElement>(":scope > .z-field__error");
  if (message) {
    if (!error) {
      error = document.createElement("p");
      error.className = "z-field__error";
      error.id = `z-field-error-${++errorSeq}`;
      error.setAttribute("role", "alert");
      body.insertBefore(error, body.querySelector(":scope > .z-field__hint"));
    }
    if (error.textContent !== message) error.textContent = message;
  } else error?.remove();
  flag(field, "data-invalid", Boolean(message), "true");
  for (const control of describedControls(field)) {
    const ids = (control.getAttribute("aria-describedby") ?? "").split(/\s+/).filter((id) => id && id !== error?.id);
    if (message && error) ids.unshift(error.id);
    if (ids.length) control.setAttribute("aria-describedby", ids.join(" "));
    else control.removeAttribute("aria-describedby");
    flag(control, "aria-invalid", Boolean(message), "true");
    const box = control.closest(".z-input, .z-select, .z-input-group, .z-textarea");
    if (box) flag(box, "data-invalid", Boolean(message), "true");
    if (control.matches(".z-textarea")) flag(control, "data-invalid", Boolean(message), "true");
  }
}

function validateField(field: HTMLElement, control: Validatable): void {
  showFieldError(field, validityMessage(control.validity, fieldMessages(field), control.validationMessage));
}

const validatingField = (target: EventTarget | null) => {
  const field = target instanceof Element ? target.closest<HTMLElement>(".z-field[data-validate]") : null;
  return field && inDom(field) ? field : null;
};

/* ---------- Delegación ---------- */

export function setup(on: Listen): void {
  on(document, "mousedown", onAddonDown);
  on(document, "click", (event) => {
    const target = event.target;
    if (!(target instanceof Element) || !inDom(target)) return;
    const toggle = target.closest<HTMLButtonElement>(".z-password__toggle");
    if (toggle && !toggle.disabled) {
      const box = toggle.closest<HTMLElement>(".z-password");
      if (box) setVisible(box, toggle.getAttribute("aria-pressed") !== "true");
      return;
    }
    // Activación del botón de paso sin puntero (lector de pantalla): un paso.
    const step = target.closest<HTMLButtonElement>(".z-number__step");
    if (step && event.detail === 0) nudge(step.closest<HTMLElement>(".z-number")!, step.dataset.step === "up" ? 1 : -1);
  });
  on(document, "input", (event) => {
    const input = event.target as Element;
    const box = input.closest?.<HTMLElement>(".z-password");
    if (box && inDom(box)) paintMeter(box);
  });
  on(document, "z:change", onGroupChange);
  on(
    document,
    "invalid",
    (event) => {
      const field = validatingField(event.target);
      if (!field || !validatable(event.target)) return;
      event.preventDefault();
      validateField(field, event.target);
    },
    true,
  );
  for (const type of ["input", "change"])
    on(document, type, (event) => {
      const field = validatingField(event.target);
      if (!field || !validatable(event.target)) return;
      edited.add(event.target);
      if (event.target.validity.valid) showFieldError(field, null);
    });
  on(document, "focusout", (event) => {
    const field = validatingField(event.target);
    if (field && validatable(event.target) && edited.has(event.target)) validateField(field, event.target);
  });
  on(
    document,
    "submit",
    (event) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement) || !form.matches(".z-form") || !inDom(form)) return;
      if (validateForm(form)) return;
      event.preventDefault();
      emit(form, "invalid");
    },
    true,
  );
  on(document, "submit", (event) => {
    const form = event.target as HTMLFormElement;
    if (!(form instanceof HTMLFormElement) || event.defaultPrevented) return;
    for (const box of form.querySelectorAll<HTMLElement>(".z-password"))
      if (inDom(box) && !box.hasAttribute("data-keep-visible")) setVisible(box, false);
  });
  on(document, "keydown", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || event.defaultPrevented || typeof event.key !== "string") return;
    const box = target.closest<HTMLElement>(".z-number");
    if (box && inDom(box) && target === numberInput(box)) onNumberKey(box, event);
  });
  on(document, "focusout", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    const box = target.closest<HTMLElement>(".z-number");
    if (box && inDom(box) && target === numberInput(box)) settleNumber(box);
  });
  on(document, "pointerdown", (event) => {
    const button = (event.target as Element).closest?.<HTMLButtonElement>(".z-number__step");
    if (button && inDom(button)) onStepDown(button, event);
  });
  on(document, "pointerup", release);
  on(document, "pointercancel", release);
  on(
    document,
    "wheel",
    (event) => {
      const input = event.target as Element;
      const box = input.closest?.<HTMLElement>(".z-number[data-wheel]");
      if (!box || !inDom(box) || document.activeElement !== numberInput(box) || event.deltaY === 0) return;
      event.preventDefault();
      nudge(box, event.deltaY < 0 ? 1 : -1);
    },
    { passive: false },
  );
}

export function hydrate(root: ParentNode): void {
  for (const group of all(root, ".z-checkgroup")) syncAll(group);
  for (const box of all(root, ".z-password")) paintMeter(box);
  for (const box of all(root, ".z-number")) {
    const input = numberInput(box);
    const { locale, percent } = numberConfig(box);
    const declared = box.dataset.value !== undefined ? numberValue(box) : input?.value ? parseNumber(input.value, locale, percent) : null;
    paintNumber(box, declared);
  }
}
