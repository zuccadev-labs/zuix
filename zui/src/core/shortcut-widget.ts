// ShortcutInput: campo que graba una combinación de teclas. Se pulsa (o Intro/Espacio) para grabar; la siguiente
// combinación completa queda guardada en forma canónica y portable («Mod+Shift+K»). Escape cancela, Retroceso o
// Supr sin modificadores borran y Tab sale sin grabar (el foco nunca queda atrapado). Se muestra con las teclas de
// la plataforma (⌘⇧K o Ctrl+Shift+K) y se anuncia en palabras. Un solo árbol y una sola interacción (core/widget).

import {
  formatShortcutValue,
  isApplePlatform,
  isCompleteShortcut,
  normalizeShortcut,
  parseShortcut,
  shortcutFromEvent,
  shortcutLabels,
  shortcutSpoken,
  type Shortcut,
} from "./shortcut";
import { fill, h, icon, on, type VEl } from "./vnode";
import { announceIn, yes, type Widget, type WidgetHost } from "./widget";

export interface ShortcutInputLabels {
  /** Nombre accesible del campo. */
  field: string;
  /** Texto con el campo vacío. */
  placeholder: string;
  /** Texto mientras graba sin teclas. */
  recording: string;
  /** Instrucciones (aria-describedby). */
  instructions: string;
  clear: string;
  /** «Shortcut set to {keys}». */
  set: string;
  /** «Shortcut cleared». */
  cleared: string;
  /** Se pulsó una tecla sin modificador. */
  needsModifier: string;
}

export const SHORTCUT_LABELS: ShortcutInputLabels = {
  field: "Keyboard shortcut",
  placeholder: "Record shortcut",
  recording: "Press keys…",
  instructions: "Press Enter to record, then the key combination. Escape cancels; Backspace clears.",
  clear: "Clear shortcut",
  set: "Shortcut set to {keys}",
  cleared: "Shortcut cleared",
  needsModifier: "Add Ctrl, Alt or Command",
};

export interface ShortcutInputProps {
  /** Atajo controlado en forma canónica («Mod+Shift+K»). */
  value?: string;
  defaultValue?: string;
  /** Sin modificador solo valen las teclas de función (por defecto, sí se exige). */
  requireModifier?: boolean;
  /** Plataforma para mostrar las teclas; por defecto la del navegador. */
  platform?: "apple" | "other";
  disabled?: boolean;
  name?: string;
  form?: string;
  size?: "sm" | "md";
  labels?: Partial<ShortcutInputLabels>;
}

interface Config extends ShortcutInputProps {
  labels: ShortcutInputLabels;
  requireModifier: boolean;
}

interface State {
  value: string;
  recording: boolean;
  /** Modificadores pulsados mientras se graba (vista previa). */
  partial: Shortcut | null;
  hint: boolean;
  apple: boolean;
  prop: string | undefined;
}

function tree(c: Config, s: State, uid: string): VEl {
  const parsed = parseShortcut(s.value);
  const shown = s.recording ? s.partial : parsed;
  const keys = shown ? shortcutLabels(shown, s.apple) : [];
  const spoken = parsed ? shortcutSpoken(parsed, s.apple) : "";
  return h(
    "div",
    {
      class: "z-shortcut",
      "data-size": c.size === "sm" ? "sm" : "md",
      "data-recording": on(s.recording),
      "data-empty": on(!parsed),
      "data-disabled": on(c.disabled),
      "data-value": s.value || undefined,
      "data-platform": c.platform,
      "data-require-modifier": c.requireModifier ? undefined : "false",
      "data-name": c.name,
    },
    h(
      "button",
      {
        type: "button",
        class: "z-shortcut__field",
        "aria-describedby": `${uid}-help`,
        disabled: c.disabled || undefined,
      },
      // Nombre por contenido (no aria-label): el texto visible queda dentro del nombre (WCAG 2.5.3).
      h("span", { class: "z-sr-only" }, spoken ? `${c.labels.field}: ${spoken}` : `${c.labels.field}, `),
      keys.length
        ? h(
            "span",
            { class: "z-kbd-group z-shortcut__keys", "aria-hidden": "true" },
            ...keys.map((k, i) => h("kbd", { key: `${i}-${k}`, class: "z-kbd", "data-size": "sm" }, k)),
          )
        : h("span", { class: "z-shortcut__placeholder" }, s.recording ? c.labels.recording : c.labels.placeholder),
      s.hint ? h("span", { class: "z-shortcut__hint" }, c.labels.needsModifier) : null,
    ),
    parsed && !s.recording
      ? h(
          "button",
          {
            type: "button",
            class: "z-shortcut__clear",
            "aria-label": c.labels.clear,
            title: c.labels.clear,
            disabled: c.disabled || undefined,
          },
          icon("x-mark", 14),
        )
      : null,
    h("span", { id: `${uid}-help`, class: "z-sr-only" }, c.labels.instructions),
    h("span", { class: "z-sr-only", "data-live": "", "aria-live": "polite" }),
    c.name ? h("input", { type: "hidden", name: c.name, form: c.form, value: s.value }) : null,
  );
}

type Host = WidgetHost<Config, State>;

function commit(root: HTMLElement, host: Host, value: string): void {
  const s = host.state();
  host.update({ value, recording: false, partial: null, hint: false });
  if (value !== s.value) host.emit("change", { value });
  const parsed = parseShortcut(value);
  const labels = host.config().labels;
  announceIn(root, parsed ? fill(labels.set, { keys: shortcutSpoken(parsed, s.apple) }) : labels.cleared);
}

function attach(root: HTMLElement, host: Host): () => void {
  const nav = root.ownerDocument.defaultView?.navigator as (Navigator & { userAgentData?: { platform?: string } }) | undefined;
  const platform = host.config().platform;
  const apple = platform ? platform === "apple" : isApplePlatform(nav);
  if (apple !== host.state().apple) host.update({ apple });
  const field = () => root.querySelector<HTMLButtonElement>(".z-shortcut__field");

  const click = (event: MouseEvent) => {
    if (!(event.target instanceof Element) || host.config().disabled) return;
    if (event.target.closest(".z-shortcut__clear")) {
      commit(root, host, "");
      field()?.focus();
      return;
    }
    // Pulsar el campo empieza a grabar; volver a pulsarlo lo deja como estaba. El estado se ve y se oye en el propio
    // contenido («Press keys…» forma parte del nombre), sin aria-pressed: no es un conmutador de dos estados.
    if (event.target.closest(".z-shortcut__field")) host.update({ recording: !host.state().recording, partial: null, hint: false });
  };
  const keydown = (event: KeyboardEvent) => {
    if (!(event.target instanceof Element) || !event.target.closest(".z-shortcut__field")) return;
    const s = host.state();
    if (!s.recording) return;
    const shortcut = shortcutFromEvent(event, s.apple);
    const bare = !shortcut.mod && !shortcut.ctrl && !shortcut.alt && !shortcut.meta && !shortcut.shift;
    // Tab sale sin grabar: el foco no queda atrapado.
    if (bare && shortcut.key === "Tab") {
      host.update({ recording: false, partial: null, hint: false });
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (bare && shortcut.key === "Escape") {
      host.update({ recording: false, partial: null, hint: false });
      return;
    }
    if (bare && (shortcut.key === "Backspace" || shortcut.key === "Delete")) {
      commit(root, host, "");
      return;
    }
    if (!shortcut.key) {
      host.update({ partial: shortcut, hint: false });
      return;
    }
    if (!isCompleteShortcut(shortcut, host.config().requireModifier)) {
      host.update({ partial: shortcut, hint: true });
      return;
    }
    commit(root, host, formatShortcutValue(shortcut));
  };
  const keyup = (event: KeyboardEvent) => {
    const s = host.state();
    if (!s.recording || !(event.target instanceof Element) || !event.target.closest(".z-shortcut__field")) return;
    // Al soltar modificadores sin tecla, la vista previa sigue a lo que queda pulsado.
    const held = { key: "Shift", code: "", ctrlKey: event.ctrlKey, altKey: event.altKey, shiftKey: event.shiftKey, metaKey: event.metaKey };
    if (!s.hint) host.update({ partial: shortcutFromEvent(held, s.apple) });
  };
  const focusout = (event: FocusEvent) => {
    if (!host.state().recording) return;
    if (event.relatedTarget instanceof Node && root.contains(event.relatedTarget)) return;
    host.update({ recording: false, partial: null, hint: false });
  };
  root.addEventListener("click", click);
  root.addEventListener("keydown", keydown);
  root.addEventListener("keyup", keyup);
  root.addEventListener("focusout", focusout);
  return () => {
    root.removeEventListener("click", click);
    root.removeEventListener("keydown", keydown);
    root.removeEventListener("keyup", keyup);
    root.removeEventListener("focusout", focusout);
  };
}

export const shortcutInputWidget: Widget<ShortcutInputProps, Config, State> = {
  root: "z-shortcut",
  configure: (p) => ({ ...p, labels: { ...SHORTCUT_LABELS, ...p.labels }, requireModifier: p.requireModifier !== false }),
  initial: (c) => ({
    value: normalizeShortcut(c.value ?? c.defaultValue ?? ""),
    recording: false,
    partial: null,
    hint: false,
    apple: c.platform === "apple",
    prop: c.value,
  }),
  control: (c, s) => (c.value !== undefined && c.value !== s.prop ? { ...s, value: normalizeShortcut(c.value), prop: c.value } : s),
  tree,
  attach,
  after: () => {},
  fromDom(el, json) {
    const d = el.dataset;
    return {
      defaultValue: d.value,
      requireModifier: d.requireModifier === undefined ? undefined : yes(d.requireModifier),
      platform: d.platform === "apple" || d.platform === "other" ? d.platform : undefined,
      disabled: d.disabled !== undefined,
      name: d.name,
      form: d.form,
      size: d.size === "sm" ? "sm" : undefined,
      labels: json.labels as Partial<ShortcutInputLabels> | undefined,
    };
  },
};
