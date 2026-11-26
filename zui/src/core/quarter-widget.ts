// QuarterPicker: el mismo patrón que MonthPicker y YearPicker (botón con el valor y un panel de diálogo con la rejilla
// del calendario), con los cuatro trimestres de un año en una rejilla de 2 × 2. Foco itinerante en la rejilla (APG
// «grid»): flechas, Inicio, Fin, Re Pág y Av Pág; Intro o Espacio eligen y el panel se cierra devolviendo el foco al
// botón. Valor `YYYY-Qn`. Un solo árbol y una sola interacción para React y el modo DOM.
import { localize } from "./locale";
import { openAnchored, type Anchored } from "./anchored";
import { todayISO } from "./date";
import { logicalKey } from "./dir";
import { trapTab } from "./focus";
import { PICKER_ICON, nativeInputs, syncNatives } from "./picker-parts";
import {
  clampQuarter,
  inQuarterBounds,
  parseQuarter,
  quarterKeyTarget,
  quarterMonths,
  quarterOf,
  quarterRange,
  quarterText,
  validQuarter,
} from "./quarter";
import { fill, h, icon, on, type VEl } from "./vnode";
import type { Widget, WidgetHost } from "./widget";

export interface QuarterPickerLabels {
  placeholder: string;
  /** Nombre del panel. */
  dialog: string;
  /** Texto corto de cada trimestre: «Q{quarter}». */
  quarter: string;
  /** Texto del valor en el campo: «Q{quarter} {year}». */
  value: string;
  previousYear: string;
  nextYear: string;
}

export const QUARTER_LABELS: QuarterPickerLabels = {
  placeholder: "Select quarter",
  dialog: "Choose quarter",
  quarter: "Q{quarter}",
  value: "Q{quarter} {year}",
  previousYear: "Previous year",
  nextYear: "Next year",
};

export interface QuarterPickerProps {
  /** `YYYY-Qn` o null. Controlado. */
  value?: string | null;
  defaultValue?: string | null;
  /** Primer y último trimestre elegibles (`YYYY-Qn`). */
  min?: string;
  max?: string;
  /** Hoy (`YYYY-MM-DD`): marca el trimestre en curso. */
  today?: string;
  locale?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  invalid?: boolean;
  name?: string;
  size?: "sm" | "md" | "lg";
  /** Ancho completo (por defecto) o intrínseco. */
  block?: boolean;
  labels?: Partial<QuarterPickerLabels>;
  controlId?: string;
  describedBy?: string;
  labelledBy?: string;
  ariaLabel?: string;
}

interface Config extends Omit<QuarterPickerProps, "labels"> {
  labels: QuarterPickerLabels;
  size: "sm" | "md" | "lg";
}

interface State {
  open: boolean;
  value: string | null;
  prop: unknown;
  /** Año a la vista. */
  year: number;
  /** Trimestre con el foco en la rejilla. */
  focused: string;
}

type Host = WidgetHost<Config, State>;

const now = (c: Config) => quarterOf(c.today ?? todayISO());

function valueText(c: Config, value: string | null): string {
  const q = parseQuarter(value);
  return q ? fill(c.labels.value, { quarter: q.quarter, year: q.year }) : "";
}

function tree(c: Config, s: State, uid: string): VEl {
  const l = c.labels;
  const panelId = `${uid}-panel`;
  const valueId = `${uid}-value`;
  const text = valueText(c, s.value);
  const current = now(c);
  const canPrev = !validQuarter(c.min) || quarterText(s.year - 1, 4) >= c.min!;
  const canNext = !validQuarter(c.max) || quarterText(s.year + 1, 1) <= c.max!;
  const year = new Intl.DateTimeFormat(c.locale, { year: "numeric", timeZone: "UTC" }).format(Date.UTC(s.year, 0, 1));
  const cell = (quarter: number): VEl => {
    const value = quarterText(s.year, quarter);
    const disabled = !inQuarterBounds(value, c.min, c.max);
    const selected = s.value === value;
    return h(
      "td",
      { key: value, class: "z-calendar__cell", "aria-selected": selected ? "true" : "false" },
      h(
        "button",
        {
          type: "button",
          class: "z-calendar__unit z-quarterpicker__unit",
          "data-value": value,
          "data-selected": on(selected),
          "data-current": on(value === current),
          "aria-disabled": disabled ? "true" : undefined,
          "aria-label": `${fill(l.value, { quarter, year: s.year })}, ${quarterMonths(quarter, c.locale)}`,
          tabindex: value === s.focused ? 0 : -1,
        },
        h("span", { class: "z-quarterpicker__name" }, fill(l.quarter, { quarter })),
        h("span", { class: "z-quarterpicker__months", "aria-hidden": "true" }, quarterMonths(quarter, c.locale)),
      ),
    );
  };
  return h(
    "div",
    {
      class: "z-quarterpicker",
      "data-size": c.size,
      "data-block": c.block === false ? "false" : undefined,
      "data-disabled": on(c.disabled),
      "data-invalid": on(c.invalid),
      "data-name": c.name,
      "data-value": s.value ?? undefined,
      "data-min": c.min,
      "data-max": c.max,
    },
    h(
      "span",
      {
        class: "z-select z-quarterpicker__field",
        "data-picker": "",
        "data-size": c.size,
        "data-block": c.block === false ? undefined : "",
        "data-invalid": on(c.invalid),
        "data-disabled": on(c.disabled),
      },
      h(
        "button",
        {
          type: "button",
          id: c.controlId ?? `${uid}-control`,
          class: "z-select__control",
          "aria-haspopup": "dialog",
          "aria-expanded": s.open ? "true" : "false",
          "aria-controls": s.open ? panelId : undefined,
          // El nombre accesible incluye el trimestre elegido (como DatePicker).
          "aria-labelledby": c.labelledBy ? `${c.labelledBy} ${valueId}` : undefined,
          "aria-describedby": [c.describedBy, c.ariaLabel || c.labelledBy ? undefined : valueId].filter(Boolean).join(" ") || undefined,
          "aria-invalid": c.invalid ? "true" : undefined,
          "data-state": s.open ? "open" : "closed",
          "data-placeholder": text ? undefined : "",
          disabled: c.disabled || undefined,
          "data-trigger": "",
        },
        c.ariaLabel && !c.labelledBy ? h("span", { class: "z-sr-only" }, c.ariaLabel) : null,
        h("span", { class: "z-select__value", id: valueId }, text || (c.placeholder ?? l.placeholder)),
      ),
      h("span", { class: "z-select__chevron" }, icon("calendar", PICKER_ICON[c.size])),
    ),
    ...nativeInputs(c.name, s.value ? [s.value] : [], c.required, c.disabled),
    h(
      "div",
      {
        id: panelId,
        class: "z-liquid z-popover z-datepicker__panel z-quarterpicker__panel",
        popover: "manual",
        role: "dialog",
        "aria-label": l.dialog,
        "data-state": s.open ? "open" : "closed",
      },
      h(
        "div",
        { class: "z-calendar z-quarterpicker__calendar", "data-view": "quarter", "data-mode": "single", "data-widget": "" },
        h(
          "div",
          { class: "z-calendar__main" },
          h(
            "div",
            { class: "z-calendar__header" },
            h(
              "button",
              {
                type: "button",
                class: "z-calendar__nav",
                "data-nav": "prev",
                "aria-label": l.previousYear,
                title: l.previousYear,
                disabled: canPrev ? undefined : true,
              },
              icon("chevron-left", 16),
            ),
            h("div", { class: "z-calendar__title", id: `${uid}-title`, "aria-live": "polite" }, year),
            h(
              "button",
              {
                type: "button",
                class: "z-calendar__nav",
                "data-nav": "next",
                "aria-label": l.nextYear,
                title: l.nextYear,
                disabled: canNext ? undefined : true,
              },
              icon("chevron-right", 16),
            ),
          ),
          h(
            "div",
            { class: "z-calendar__months" },
            h(
              "div",
              { class: "z-calendar__month" },
              h(
                "table",
                { class: "z-calendar__grid", role: "grid", "data-view": "quarter", "aria-labelledby": `${uid}-title` },
                h("tbody", {}, h("tr", { key: "r1" }, cell(1), cell(2)), h("tr", { key: "r2" }, cell(3), cell(4))),
              ),
            ),
          ),
        ),
      ),
    ),
  );
}

interface Runtime {
  layer: Anchored | null;
  focus: boolean;
}
const runtimes = new WeakMap<HTMLElement, Runtime>();

function attach(root: HTMLElement, host: Host): () => void {
  const rt: Runtime = { layer: null, focus: false };
  runtimes.set(root, rt);
  const trigger = () => root.querySelector<HTMLButtonElement>("[data-trigger]");
  const panel = () => root.querySelector<HTMLElement>(".z-quarterpicker__panel");
  const close = (refocus: boolean) => {
    const inside = panel()?.contains(root.ownerDocument.activeElement) ?? false;
    rt.layer?.close();
    rt.layer = null;
    if (host.state().open) host.update({ open: false });
    if (refocus || inside) trigger()?.focus({ preventScroll: true });
  };
  const open = () => {
    const c = host.config();
    const s = host.state();
    if (c.disabled || s.open) return;
    const focused = clampQuarter(s.value ?? now(c), c.min, c.max);
    rt.focus = true;
    host.update({ open: true, focused, year: Number(focused.slice(0, 4)) });
    const p = panel();
    const anchor = root.querySelector<HTMLElement>(".z-quarterpicker__field");
    if (p && anchor)
      rt.layer = openAnchored(p, anchor, {
        matchWidth: false,
        onDismiss: (reason) => close(reason === "escape"),
      });
    if (rt.focus) focusUnit(root, focused);
  };
  const choose = (value: string) => {
    const c = host.config();
    if (!inQuarterBounds(value, c.min, c.max)) return;
    host.update({ value, focused: value });
    host.emit("change", { value, ...quarterRange(value) });
    close(true);
  };
  const focusOn = (value: string) => {
    const q = parseQuarter(value);
    if (!q) return;
    rt.focus = true;
    host.update({ focused: value, year: q.year });
  };
  const click = (event: MouseEvent) => {
    const target = event.target as Element;
    if (host.config().disabled) return;
    if (target.closest("[data-trigger]")) {
      if (host.state().open) close(true);
      else open();
      return;
    }
    const nav = target.closest<HTMLButtonElement>(".z-calendar__nav");
    if (nav && !nav.disabled) {
      const s = host.state();
      const year = s.year + (nav.dataset.nav === "next" ? 1 : -1);
      const col = (parseQuarter(s.focused)?.quarter ?? 1) - 1;
      host.update({ year, focused: quarterText(year, col + 1) });
      return;
    }
    const unit = target.closest<HTMLElement>(".z-quarterpicker__unit");
    if (unit && unit.getAttribute("aria-disabled") !== "true") choose(unit.dataset.value ?? "");
  };
  const keydown = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement;
    const p = panel();
    if (p?.contains(target) && event.key === "Tab" && trapTab(p, event)) {
      event.preventDefault();
      return;
    }
    if (target.matches("[data-trigger]") && !host.state().open && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      event.preventDefault();
      open();
      return;
    }
    const unit = target.closest<HTMLElement>(".z-quarterpicker__unit");
    if (!unit) return;
    const value = unit.dataset.value ?? "";
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (unit.getAttribute("aria-disabled") !== "true") choose(value);
      return;
    }
    const next = quarterKeyTarget(logicalKey(event.key, unit), value, event.shiftKey);
    if (!next) return;
    event.preventDefault();
    const c = host.config();
    focusOn(clampQuarter(next, c.min, c.max));
  };
  const invalid = (event: Event) => {
    if ((event.target as HTMLElement).matches?.("[data-native]")) trigger()?.focus();
  };
  // El navegador enfoca el campo nativo oculto al informar de un error: el foco pasa al control visible.
  const nativeFocus = (event: FocusEvent) => {
    if ((event.target as HTMLElement).matches?.("[data-native]")) trigger()?.focus();
  };
  const form = root.closest("form");
  const initial = host.state().value;
  // `form.reset()`: vuelve al valor con el que se montó y lo anuncia (un valor controlado se entera).
  const reset = () =>
    setTimeout(() => {
      host.update({ value: initial });
      host.emit("change", { value: initial, ...(initial ? quarterRange(initial) : {}) });
    }, 0);
  root.addEventListener("click", click);
  root.addEventListener("keydown", keydown);
  root.addEventListener("invalid", invalid, true);
  root.addEventListener("focusin", nativeFocus);
  form?.addEventListener("reset", reset);
  return () => {
    rt.layer?.close();
    runtimes.delete(root);
    root.removeEventListener("click", click);
    root.removeEventListener("keydown", keydown);
    root.removeEventListener("invalid", invalid, true);
    root.removeEventListener("focusin", nativeFocus);
    form?.removeEventListener("reset", reset);
  };
}

/** Lleva el foco al trimestre; si el panel aún no se ve (el modo DOM pinta antes de abrir), lo deja pendiente. */
function focusUnit(root: HTMLElement, value: string): void {
  const rt = runtimes.get(root);
  const unit = root.querySelector<HTMLElement>(`.z-quarterpicker__unit[data-value="${value}"]`);
  unit?.focus({ preventScroll: true });
  if (rt && unit && root.ownerDocument.activeElement === unit) rt.focus = false;
}

function after(root: HTMLElement, host: Host): void {
  const s = host.state();
  syncNatives(root, s.value ? [s.value] : []);
  const rt = runtimes.get(root);
  if (!rt) return;
  if (s.open) {
    rt.layer?.reposition();
    if (rt.focus) focusUnit(root, s.focused);
  } else if (rt.layer) {
    rt.layer.close();
    rt.layer = null;
  }
}

export const quarterPickerWidget: Widget<QuarterPickerProps, Config, State> = {
  root: "z-quarterpicker",
  configure: (p) => ({ ...p, labels: { ...localize("quarter", QUARTER_LABELS), ...p.labels }, size: p.size ?? "md" }),
  initial: (c) => {
    const value = validQuarter(c.value ?? c.defaultValue) ? ((c.value ?? c.defaultValue) as string) : null;
    const focused = value ?? now(c);
    return { open: false, value, prop: c.value, year: Number(focused.slice(0, 4)), focused };
  },
  control: (c, s) =>
    c.value !== undefined && c.value !== s.prop ? { ...s, value: validQuarter(c.value) ? c.value : null, prop: c.value } : s,
  tree,
  attach,
  after,
  fromDom(el, json) {
    const d = el.dataset;
    return {
      defaultValue: d.value ?? null,
      min: d.min,
      max: d.max,
      today: d.today,
      locale: d.locale,
      placeholder: d.placeholder,
      disabled: d.disabled !== undefined,
      required: d.required !== undefined,
      name: d.name,
      size: d.size === "sm" || d.size === "lg" ? d.size : undefined,
      block: d.block === "false" ? false : undefined,
      labels: json.labels as Partial<QuarterPickerLabels> | undefined,
      ariaLabel: d.label,
    };
  },
};
