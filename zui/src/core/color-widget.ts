// Familia ColorPicker: área de saturación y brillo, deslizadores de tono y alfa, campos por canal y hexadecimal,
// selector de formato, muestrario, cuentagotas (EyeDropper, mejora progresiva), selector del sistema
// (`<input type="color">`, que también es el respaldo sin JavaScript) y la variante en popover con muestra.
// Un solo árbol (core/vnode) y una sola interacción para React y para el modo DOM (core/widget). El valor público es
// una cadena CSS en el formato elegido; dentro se guarda en HSV para que el tono no se pierda en los grises.
//
// Teclado: el área es un deslizador en dos ejes (role="slider" con aria-valuetext de los dos canales): izquierda y
// derecha mueven la saturación, arriba y abajo el brillo, Mayúsculas diez pasos, Re/Av Pág el brillo de diez en diez,
// Inicio y Fin la saturación. Tono y alfa siguen el patrón APG «slider». El muestrario es un grupo de radios (flechas).

import {
  areaAt,
  areaKey,
  channelsOf,
  channelValues,
  COLOR_FORMATS,
  formatColor,
  formatOf,
  hsvToRgb,
  inkOn,
  isColorFormat,
  parseColor,
  rgbToHsv,
  round,
  sameColor,
  withChannel,
  type ColorChannel,
  type ColorFormat,
  type Hsva,
  type Rgba,
} from "./color";
import { isRtl } from "./dir";
import { place } from "./place";
import { move } from "./roving";
import { keyValue } from "./slider";
import { fill, h, icon, on, type VEl, type VNode } from "./vnode";
import { list, yes, type Widget, type WidgetHost } from "./widget";

export interface ColorPickerLabels {
  /** Nombre del grupo (el selector entero). */
  picker: string;
  /** Nombre del área. */
  area: string;
  /** Descripción del área para lectores de pantalla (aria-roledescription). */
  areaRole: string;
  /** «Saturation {s}%, brightness {v}%». */
  areaValue: string;
  hue: string;
  /** «{h} degrees». */
  hueValue: string;
  alpha: string;
  /** «{a}% opaque». */
  alphaValue: string;
  format: string;
  formatNames: Record<ColorFormat, string>;
  hex: string;
  channels: Record<Exclude<ColorChannel, "hex" | "alpha">, string>;
  eyeDropper: string;
  system: string;
  swatches: string;
  /** Texto del botón de la variante en popover cuando no hay valor que mostrar. */
  trigger: string;
}

export const COLOR_PICKER_LABELS: ColorPickerLabels = {
  picker: "Color picker",
  area: "Color",
  areaRole: "2D slider",
  areaValue: "Saturation {s}%, brightness {v}%",
  hue: "Hue",
  hueValue: "{h} degrees",
  alpha: "Alpha",
  alphaValue: "{a}% opaque",
  format: "Color format",
  formatNames: { hex: "HEX", rgb: "RGB", hsl: "HSL", oklch: "OKLCH" },
  hex: "Hex color",
  channels: { r: "Red", g: "Green", b: "Blue", h: "Hue", s: "Saturation", l: "Lightness", L: "Lightness", C: "Chroma", H: "Hue" },
  eyeDropper: "Pick a color from the screen",
  system: "System color picker",
  swatches: "Swatches",
  trigger: "Choose color",
};

const SHORT: Record<ColorChannel, string> = {
  hex: "#",
  r: "R",
  g: "G",
  b: "B",
  h: "H",
  s: "S",
  l: "L",
  L: "L",
  C: "C",
  H: "H",
  alpha: "A",
};

export interface ColorSwatch {
  value: string;
  /** Nombre accesible (por defecto, el valor). */
  label?: string;
}

export interface ColorPickerProps {
  /** Valor controlado: cualquier color CSS que entienda `parseColor` (hex, rgb, hsl, hwb, oklch). */
  value?: string;
  defaultValue?: string;
  /** Formato en que se escribe el valor (controlado). */
  format?: ColorFormat;
  defaultFormat?: ColorFormat;
  /** Formatos que ofrece el selector de formato; uno solo lo oculta. */
  formats?: readonly ColorFormat[];
  /** Deslizador y campo de opacidad. */
  alpha?: boolean;
  /** Muestras fijas (cadenas CSS o `{ value, label }`). */
  swatches?: ReadonlyArray<string | ColorSwatch>;
  /** Botón de cuentagotas donde el navegador tenga EyeDropper. */
  eyeDropper?: boolean;
  /** Botón del selector del sistema (`<input type="color">`). */
  systemPicker?: boolean;
  /** Campos de canal y de formato. */
  fields?: boolean;
  /** Orientación del deslizador suelto (ColorSlider). */
  orientation?: "horizontal" | "vertical";
  /** Canal del deslizador suelto (ColorSlider). */
  channel?: "hue" | "alpha";
  disabled?: boolean;
  readOnly?: boolean;
  /** Nombre del campo oculto con el valor, para enviar un formulario. */
  name?: string;
  form?: string;
  size?: "sm" | "md";
  /** Nombre accesible del grupo (por defecto, `labels.picker`). */
  label?: string;
  labels?: Partial<ColorPickerLabels>;
}

export type ColorPart = "area" | "hue" | "alpha" | "preview" | "fields" | "swatches" | "eyedropper" | "system";

interface Config {
  root: string;
  kind: "picker" | "area" | "slider" | "swatches" | "field" | "trigger";
  parts: Set<ColorPart>;
  value?: Rgba;
  valueText?: string;
  defaultValue: Rgba;
  format?: ColorFormat;
  defaultFormat: ColorFormat;
  formats: ColorFormat[];
  alpha: boolean;
  swatches: ColorSwatch[];
  orientation: "horizontal" | "vertical";
  channel: "hue" | "alpha";
  systemPicker: boolean;
  fieldsOn: boolean;
  disabled: boolean;
  readOnly: boolean;
  name?: string;
  form?: string;
  size: "sm" | "md";
  label: string;
  labels: ColorPickerLabels;
}

export interface ColorState {
  hsva: Hsva;
  format: ColorFormat;
  /** Último `value` recibido por props: solo se vuelve a leer cuando cambia (así conserva el tono de los grises). */
  prop: string | null;
  /** El navegador tiene EyeDropper (se comprueba al conectar: el servidor no lo sabe). */
  canPick: boolean;
  /** Variante en popover: el panel está abierto. */
  open: boolean;
}

/** Color de partida si no llega ninguno: el azul de la suite en HSV (sin literal de marca). */
const FALLBACK: Rgba = hsvToRgb({ h: 217, s: 0.76, v: 0.96, a: 1 });

function swatchList(input: ColorPickerProps["swatches"]): ColorSwatch[] {
  return (input ?? [])
    .map((s) => (typeof s === "string" ? { value: s } : s))
    .filter((s): s is ColorSwatch => Boolean(s && typeof s.value === "string" && parseColor(s.value)));
}

function configure(kind: Config["kind"], root: string, p: ColorPickerProps): Config {
  const labels = { ...COLOR_PICKER_LABELS, ...p.labels };
  labels.formatNames = { ...COLOR_PICKER_LABELS.formatNames, ...p.labels?.formatNames };
  labels.channels = { ...COLOR_PICKER_LABELS.channels, ...p.labels?.channels };
  const formats = (p.formats ?? COLOR_FORMATS).filter(isColorFormat);
  const alpha = p.alpha !== false;
  const swatches = swatchList(p.swatches);
  const channel = p.channel === "alpha" ? "alpha" : "hue";
  const parts = new Set<ColorPart>();
  const full = kind === "picker" || kind === "trigger";
  if (full || kind === "area") parts.add("area");
  if (full) {
    parts.add("hue");
    if (alpha) parts.add("alpha");
    parts.add("preview");
    if (p.eyeDropper !== false) parts.add("eyedropper");
  }
  if (kind === "slider") parts.add(channel);
  if ((full && p.fields !== false) || kind === "field") parts.add("fields");
  if ((full || kind === "field") && p.systemPicker !== false) parts.add("system");
  if ((full || kind === "swatches") && swatches.length) parts.add("swatches");
  const value = p.value === undefined ? undefined : (parseColor(p.value) ?? undefined);
  return {
    root,
    kind,
    parts,
    value,
    valueText: p.value,
    defaultValue: parseColor(p.defaultValue ?? "") ?? FALLBACK,
    format: isColorFormat(p.format) ? p.format : undefined,
    defaultFormat: isColorFormat(p.defaultFormat) ? p.defaultFormat : (formatOf(p.value ?? p.defaultValue ?? "") ?? "hex"),
    formats: formats.length ? formats : ["hex"],
    alpha,
    swatches,
    orientation: p.orientation === "vertical" ? "vertical" : "horizontal",
    channel,
    systemPicker: p.systemPicker !== false,
    fieldsOn: p.fields !== false,
    disabled: Boolean(p.disabled),
    readOnly: Boolean(p.readOnly),
    name: p.name,
    form: p.form,
    size: p.size === "sm" ? "sm" : "md",
    label: p.label ?? labels.picker,
    labels,
  };
}

const rgbOf = (s: ColorState) => hsvToRgb(s.hsva);
/** Cadena pública del estado: en su formato, sin alfa si el selector no lo ofrece. */
export function colorValue(config: Pick<Config, "alpha">, s: ColorState): string {
  const rgb = rgbOf(s);
  return formatColor(config.alpha ? rgb : { ...rgb, a: 1 }, s.format);
}

function initial(config: Config): ColorState {
  const rgb = config.value ?? config.defaultValue;
  return {
    hsva: rgbToHsv(config.alpha ? rgb : { ...rgb, a: 1 }),
    format: config.format ?? (config.formats.includes(config.defaultFormat) ? config.defaultFormat : config.formats[0]!),
    prop: config.valueText ?? null,
    canPick: false,
    open: false,
  };
}

function control(config: Config, state: ColorState): ColorState {
  let next = state;
  if (config.format && config.format !== state.format) next = { ...next, format: config.format };
  if (config.value && config.valueText !== state.prop) {
    const incoming = config.alpha ? config.value : { ...config.value, a: 1 };
    // Solo se vuelve a leer si el color es otro: así un gris o un negro conservan el tono del área.
    const hsva = sameColor(incoming, rgbOf(next)) ? next.hsva : rgbToHsv(incoming, next.hsva.h);
    next = { ...next, hsva, prop: config.valueText ?? null };
  }
  return next;
}

/* ---------- Árbol ---------- */

const frac = (n: number) => String(round(n, 4));

function rootVars(s: ColorState): Record<string, string> {
  const rgb = rgbOf(s);
  return {
    "--z-colorpicker-color": formatColor(rgb, "hex"),
    "--z-colorpicker-opaque": formatColor({ ...rgb, a: 1 }, "hex"),
    "--z-colorpicker-hue": formatColor(hsvToRgb({ h: s.hsva.h, s: 1, v: 1, a: 1 }), "hex"),
    "--z-colorpicker-x": frac(s.hsva.s),
    "--z-colorpicker-y": frac(1 - s.hsva.v),
    "--z-colorpicker-h": frac(s.hsva.h / 360),
    "--z-colorpicker-a": frac(s.hsva.a),
  };
}

const interactive = (c: Config) => !c.disabled && !c.readOnly;

function area(c: Config, s: ColorState): VEl {
  const sat = Math.round(s.hsva.s * 100);
  const bri = Math.round(s.hsva.v * 100);
  return h(
    "div",
    { class: "z-colorpicker__area", "data-part": "area" },
    h("span", {
      class: "z-colorpicker__thumb",
      "data-part": "area-thumb",
      role: "slider",
      tabindex: c.disabled ? -1 : 0,
      "aria-label": c.labels.area,
      "aria-roledescription": c.labels.areaRole,
      "aria-valuemin": 0,
      "aria-valuemax": 100,
      "aria-valuenow": sat,
      "aria-valuetext": fill(c.labels.areaValue, { s: sat, v: bri }),
      "aria-disabled": c.disabled ? "true" : undefined,
      "aria-readonly": c.readOnly ? "true" : undefined,
    }),
  );
}

function slider(c: Config, s: ColorState, channel: "hue" | "alpha"): VEl {
  const hue = channel === "hue";
  const now = hue ? Math.round(s.hsva.h) : Math.round(s.hsva.a * 100);
  return h(
    "div",
    { class: "z-colorpicker__slider", "data-part": channel, "data-channel": channel, "data-orientation": c.orientation },
    h("span", { class: "z-colorpicker__slider-track", "aria-hidden": "true" }),
    h("span", {
      class: "z-colorpicker__slider-thumb",
      "data-part": `${channel}-thumb`,
      role: "slider",
      tabindex: c.disabled ? -1 : 0,
      "aria-label": hue ? c.labels.hue : c.labels.alpha,
      "aria-valuemin": 0,
      "aria-valuemax": hue ? 360 : 100,
      "aria-valuenow": now,
      "aria-valuetext": hue ? fill(c.labels.hueValue, { h: now }) : fill(c.labels.alphaValue, { a: now }),
      "aria-orientation": c.orientation,
      "aria-disabled": c.disabled ? "true" : undefined,
      "aria-readonly": c.readOnly ? "true" : undefined,
    }),
  );
}

/** Muestra del color que abre el selector del sistema (`<input type="color">`, que también es el respaldo sin JS). */
function systemPicker(c: Config, rgb: Rgba, cls: string): VEl {
  return h(
    "label",
    { class: `z-colorpicker__system ${cls}`, "data-disabled": on(c.disabled) },
    h("input", {
      type: "color",
      class: "z-colorpicker__system-input",
      "data-part": "system",
      "aria-label": c.labels.system,
      value: formatColor({ ...rgb, a: 1 }, "hex"),
      disabled: c.disabled || c.readOnly || undefined,
    }),
    h("span", { class: "z-colorpicker__system-swatch", "aria-hidden": "true" }),
  );
}

function fields(c: Config, s: ColorState): VEl {
  const rgb = rgbOf(s);
  const values = channelValues(rgb, s.format);
  const specs = channelsOf(s.format, c.alpha);
  const formatSelect =
    c.formats.length > 1
      ? h(
          "span",
          { class: "z-select z-colorpicker__format", "data-size": "sm", "data-disabled": on(c.disabled) },
          h(
            "select",
            {
              class: "z-select__control",
              "data-part": "format",
              "aria-label": c.labels.format,
              disabled: c.disabled || undefined,
            },
            ...c.formats.map((f) => h("option", { key: f, value: f, selected: f === s.format || undefined }, c.labels.formatNames[f])),
          ),
          h("span", { class: "z-select__chevron" }, icon("chevron-up-down", 14)),
        )
      : null;
  return h(
    "div",
    { class: "z-colorpicker__fields", "data-format": s.format },
    formatSelect,
    ...specs.map((spec) => {
      const ch = spec.channel;
      const hex = ch === "hex";
      const name = ch === "hex" ? c.labels.hex : ch === "alpha" ? c.labels.alpha : c.labels.channels[ch];
      // El canal se rotula debajo (R, G, B, A…): los campos numéricos caben estrechos y el rótulo se lee siempre.
      return h(
        "span",
        { key: `${s.format}-${ch}`, class: "z-colorpicker__channel", "data-channel": ch },
        h(
          "span",
          { class: "z-input z-colorpicker__field", "data-size": "sm", "data-channel": ch, "data-disabled": on(c.disabled) },
          hex ? h("span", { class: "z-input__icon z-colorpicker__field-prefix", "aria-hidden": "true" }, "#") : null,
          h("input", {
            class: "z-input__control",
            type: hex ? "text" : "number",
            inputmode: hex ? undefined : "decimal",
            "data-channel": ch,
            "aria-label": name,
            value: values[ch] ?? "",
            min: hex ? undefined : spec.min,
            max: hex ? undefined : spec.max,
            step: hex ? undefined : spec.step,
            maxlength: hex ? 7 : undefined,
            spellcheck: hex ? "false" : undefined,
            autocomplete: "off",
            disabled: c.disabled || undefined,
            readonly: c.readOnly || undefined,
          }),
        ),
        h("span", { class: "z-colorpicker__channel-label", "aria-hidden": "true" }, hex ? c.labels.formatNames.hex : SHORT[ch]),
      );
    }),
    c.parts.has("system") && !c.parts.has("preview") ? systemPicker(c, rgb, "z-colorpicker__system--field") : null,
  );
}

function swatches(c: Config, s: ColorState): VEl {
  const current = rgbOf(s);
  const checked = c.swatches.findIndex((sw) => sameColor(parseColor(sw.value)!, current));
  return h(
    "div",
    {
      class: "z-colorpicker__swatches",
      role: "radiogroup",
      "aria-label": c.labels.swatches,
      "aria-disabled": c.disabled ? "true" : undefined,
    },
    ...c.swatches.map((sw, i) => {
      const rgb = parseColor(sw.value)!;
      return h("button", {
        key: `${i}-${sw.value}`,
        type: "button",
        class: "z-colorpicker__swatch",
        role: "radio",
        "aria-checked": i === checked ? "true" : "false",
        "aria-label": sw.label ?? sw.value,
        tabindex: c.disabled ? -1 : i === Math.max(checked, 0) ? 0 : -1,
        "data-value": sw.value,
        "data-ink": inkOn(rgb),
        disabled: c.disabled || undefined,
        s: { "--z-swatch": formatColor(rgb, "hex") },
      });
    }),
  );
}

function body(c: Config, s: ColorState): VNode[] {
  const p = c.parts;
  const controls =
    p.has("hue") || p.has("alpha") || p.has("preview") || p.has("eyedropper")
      ? h(
          "div",
          { class: "z-colorpicker__controls" },
          p.has("eyedropper")
            ? h(
                "button",
                {
                  type: "button",
                  class: "z-btn z-btn--icon z-btn--ghost z-colorpicker__eyedropper",
                  "data-size": "sm",
                  title: c.labels.eyeDropper,
                  "data-part": "eyedropper",
                  "aria-label": c.labels.eyeDropper,
                  hidden: !s.canPick || undefined,
                  disabled: !interactive(c) || undefined,
                },
                icon("eye-dropper", 16),
              )
            : null,
          p.has("hue") || p.has("alpha")
            ? h(
                "div",
                { class: "z-colorpicker__sliders" },
                p.has("hue") ? slider(c, s, "hue") : null,
                p.has("alpha") ? slider(c, s, "alpha") : null,
              )
            : null,
          p.has("preview")
            ? p.has("system")
              ? systemPicker(c, rgbOf(s), "z-colorpicker__preview")
              : h("span", { class: "z-colorpicker__preview", "aria-hidden": "true" })
            : null,
        )
      : null;
  return [p.has("area") ? area(c, s) : null, controls, p.has("fields") ? fields(c, s) : null, p.has("swatches") ? swatches(c, s) : null];
}

function hidden(c: Config, s: ColorState): VNode {
  return c.name
    ? h("input", { type: "hidden", name: c.name, form: c.form, value: colorValue(c, s), disabled: c.disabled || undefined })
    : null;
}

/** Configuración en atributos de la raíz: el modo DOM la vuelve a leer en cada pintado (y la lee del contrato HTML). */
function configAttrs(c: Config): Record<string, string | undefined> {
  const custom = c.labels !== COLOR_PICKER_LABELS && JSON.stringify(c.labels) !== JSON.stringify(COLOR_PICKER_LABELS);
  return {
    "data-formats": c.formats.length === COLOR_FORMATS.length ? undefined : c.formats.join(" "),
    "data-alpha": c.alpha ? undefined : "false",
    "data-swatches": c.swatches.length ? JSON.stringify(c.swatches) : undefined,
    "data-eyedropper": (c.kind === "picker" || c.kind === "trigger") && !c.parts.has("eyedropper") ? "false" : undefined,
    "data-system-picker": c.systemPicker ? undefined : "false",
    "data-fields": c.fieldsOn ? undefined : "false",
    "data-channel": c.kind === "slider" ? c.channel : undefined,
    "data-format": c.format,
    "data-name": c.name,
    "data-form": c.form,
    "data-label": c.label === c.labels.picker ? undefined : c.label,
    "data-labels": custom ? JSON.stringify(c.labels) : undefined,
  };
}

function tree(c: Config, s: ColorState, uid: string): VEl {
  const common = {
    ...configAttrs(c),
    "data-size": c.size,
    "data-disabled": on(c.disabled),
    "data-readonly": on(c.readOnly),
    "data-value": colorValue(c, s),
    s: rootVars(s),
  };
  if (c.kind === "slider") {
    return h(
      "div",
      { ...common, class: c.root, "data-orientation": c.orientation },
      slider({ ...c, label: c.label }, s, c.channel),
      hidden(c, s),
    );
  }
  if (c.kind === "trigger") {
    const value = colorValue(c, s);
    return h(
      "div",
      { ...common, class: c.root, "data-state": s.open ? "open" : "closed" },
      h(
        "button",
        {
          type: "button",
          class: "z-colortrigger__button",
          popovertarget: `${uid}-panel`,
          "aria-haspopup": "dialog",
          "aria-expanded": s.open ? "true" : "false",
          "data-part": "trigger",
          disabled: c.disabled || undefined,
        },
        h("span", { class: "z-colortrigger__swatch", "aria-hidden": "true" }),
        h("span", { class: "z-colortrigger__value" }, value),
        h("span", { class: "z-colortrigger__chevron", "aria-hidden": "true" }, icon("chevron-up-down", 14)),
      ),
      h(
        "div",
        {
          id: `${uid}-panel`,
          class: "z-liquid z-popover z-colortrigger__panel",
          popover: "auto",
          role: "dialog",
          "aria-label": c.label,
          "data-state": s.open ? "open" : "closed",
        },
        // No lleva la clase raíz `z-colorpicker`: el modo DOM la montaría como otra pieza.
        h("div", { class: "z-colortrigger__picker", role: "group", "aria-label": c.label, "data-size": c.size }, ...body(c, s)),
      ),
      hidden(c, s),
    );
  }
  return h(
    "div",
    {
      ...common,
      class: c.root,
      role: c.kind === "swatches" ? undefined : "group",
      "aria-label": c.kind === "swatches" ? undefined : c.label,
    },
    ...body(c, s),
    hidden(c, s),
  );
}

/* ---------- Interacción ---------- */

type Host = WidgetHost<Config, ColorState>;

function commitRgb(host: Host, rgb: Rgba, end: boolean, keepHue = true): void {
  const c = host.config();
  const s = host.state();
  const hsva = rgbToHsv(c.alpha ? rgb : { ...rgb, a: 1 }, keepHue ? s.hsva.h : 0);
  setHsva(host, hsva, end);
}

function setHsva(host: Host, hsva: Hsva, end: boolean): void {
  const c = host.config();
  const s = host.state();
  const before = colorValue(c, s);
  const next = { ...s, hsva };
  const value = colorValue(c, next);
  host.update({ hsva });
  if (value !== before) host.emit("change", { value });
  if (end) host.emit("change-end", { value });
}

function pointRatio(el: Element, event: PointerEvent, vertical: boolean): { x: number; y: number } {
  const r = el.getBoundingClientRect();
  const rtl = isRtl(el);
  let x = (event.clientX - r.left) / (r.width || 1);
  if (rtl) x = 1 - x;
  const y = (event.clientY - r.top) / (r.height || 1);
  return vertical ? { x: 1 - y, y } : { x, y };
}

function fromPointer(host: Host, part: string, el: Element, event: PointerEvent, end: boolean): void {
  const s = host.state();
  const c = host.config();
  if (part === "area") {
    const { x, y } = pointRatio(el, event, false);
    const { s: sat, v } = areaAt(x, y);
    setHsva(host, { ...s.hsva, s: sat, v }, end);
    return;
  }
  const vertical = (el as HTMLElement).dataset.orientation === "vertical";
  // El tirador no sobresale de la pista: la pista útil es el ancho menos el tirador.
  const thumb = el.querySelector<HTMLElement>(".z-colorpicker__slider-thumb");
  const r = el.getBoundingClientRect();
  const size = thumb ? (vertical ? thumb.offsetHeight : thumb.offsetWidth) : 0;
  const length = (vertical ? r.height : r.width) - size;
  const raw = pointRatio(el, event, vertical).x;
  const ratio = Math.min(1, Math.max(0, ((vertical ? r.height : r.width) * raw - size / 2) / (length || 1)));
  if (part === "hue") setHsva(host, { ...s.hsva, h: round(ratio * 360, 2) }, end);
  else if (c.alpha || part === "alpha") setHsva(host, { ...s.hsva, a: round(ratio, 4) }, end);
}

function syncFields(root: HTMLElement, host: Host): void {
  const s = host.state();
  const values = channelValues(rgbOf(s), s.format);
  const active = root.ownerDocument.activeElement;
  for (const input of root.querySelectorAll<HTMLInputElement>("input[data-channel]")) {
    const want = values[input.dataset.channel as ColorChannel] ?? "";
    if (input !== active && input.value !== want) input.value = want;
  }
  const system = root.querySelector<HTMLInputElement>('input[data-part="system"]');
  const opaque = formatColor({ ...rgbOf(s), a: 1 }, "hex");
  if (system && system.value !== opaque) system.value = opaque;
  const hiddenInput = root.querySelector<HTMLInputElement>('input[type="hidden"]');
  const value = colorValue(host.config(), s);
  if (hiddenInput && hiddenInput.value !== value) hiddenInput.value = value;
}

interface EyeDropperLike {
  open(options?: { signal?: AbortSignal }): Promise<{ sRGBHex: string }>;
}

function attach(root: HTMLElement, host: Host): () => void {
  const win = root.ownerDocument.defaultView;
  const Picker = (win as unknown as { EyeDropper?: new () => EyeDropperLike } | null)?.EyeDropper;
  if (Picker && host.config().parts.has("eyedropper")) host.update({ canPick: true });
  let drag: { part: string; el: Element; pointer: number } | null = null;

  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0 || !interactive(host.config())) return;
    const target =
      event.target instanceof Element
        ? event.target.closest<HTMLElement>('[data-part="area"], [data-part="hue"], [data-part="alpha"]')
        : null;
    if (!target || !root.contains(target)) return;
    event.preventDefault();
    const part = target.dataset.part!;
    drag = { part, el: target, pointer: event.pointerId };
    try {
      target.setPointerCapture(event.pointerId);
    } catch {
      // Puntero sintético: el arrastre sigue mientras lleguen eventos.
    }
    target.querySelector<HTMLElement>('[role="slider"]')?.focus({ preventScroll: true });
    fromPointer(host, part, target, event, false);
  };
  const onPointerMove = (event: PointerEvent) => {
    if (drag && event.pointerId === drag.pointer) fromPointer(host, drag.part, drag.el, event, false);
  };
  const onPointerEnd = (event: PointerEvent) => {
    if (!drag || event.pointerId !== drag.pointer) return;
    drag = null;
    host.emit("change-end", { value: colorValue(host.config(), host.state()) });
  };

  const onKeyDown = (event: KeyboardEvent) => {
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (!target || !root.contains(target)) return;
    const c = host.config();
    const s = host.state();
    const part = target.dataset.part;
    if (part === "area-thumb" || part === "hue-thumb" || part === "alpha-thumb") {
      if (!interactive(c)) return;
      const dirX = isRtl(target) ? -1 : 1;
      if (part === "area-thumb") {
        const next = areaKey(event.key, event.shiftKey, s.hsva.s, s.hsva.v, dirX);
        if (!next) return;
        event.preventDefault();
        setHsva(host, { ...s.hsva, ...next }, true);
        return;
      }
      const hue = part === "hue-thumb";
      const current = hue ? Math.round(s.hsva.h) : Math.round(s.hsva.a * 100);
      const max = hue ? 360 : 100;
      const vertical = target.getAttribute("aria-orientation") === "vertical";
      const wanted = keyValue(event.key, event.shiftKey, current, 0, max, 1, vertical ? 1 : dirX, 1);
      if (wanted === undefined) return;
      event.preventDefault();
      const v = Math.min(max, Math.max(0, wanted));
      setHsva(host, hue ? { ...s.hsva, h: v } : { ...s.hsva, a: v / 100 }, true);
      return;
    }
    if (target.getAttribute("role") === "radio" && target.classList.contains("z-colorpicker__swatch")) {
      const group = [...root.querySelectorAll<HTMLElement>(".z-colorpicker__swatch:not([disabled])")];
      const key =
        event.key === "ArrowLeft" || event.key === "ArrowRight"
          ? isRtl(target)
            ? event.key === "ArrowLeft"
              ? "ArrowRight"
              : "ArrowLeft"
            : event.key
          : event.key;
      const next = move(group, target, key, false) ?? move(group, target, key, true);
      if (!next) return;
      event.preventDefault();
      next.focus();
      if (interactive(c) && next.dataset.value) {
        const rgb = parseColor(next.dataset.value);
        if (rgb) commitRgb(host, rgb, true);
      }
      return;
    }
    if (event.key === "Enter" && target instanceof HTMLInputElement && target.dataset.channel) {
      syncOne(target);
    }
  };

  const syncOne = (input: HTMLInputElement) => {
    const s = host.state();
    input.value = channelValues(rgbOf(s), s.format)[input.dataset.channel as ColorChannel] ?? "";
  };

  const onInput = (event: Event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || !root.contains(target) || !interactive(host.config())) return;
    if (target.dataset.part === "system") {
      const rgb = parseColor(target.value);
      if (rgb) commitRgb(host, { ...rgb, a: host.state().hsva.a }, false);
      return;
    }
    const channel = target.dataset.channel as ColorChannel | undefined;
    if (!channel) return;
    const s = host.state();
    const next = withChannel(rgbOf(s), s.format, channel, target.value);
    if (!next) return;
    // El tono escrito manda (un gris de HSL con tono 200 conserva 200 en el área).
    const hue = channel === "h" || channel === "H" ? Number(target.value) : s.hsva.h;
    setHsva(host, rgbToHsv(host.config().alpha ? next : { ...next, a: 1 }, Number.isFinite(hue) ? hue : s.hsva.h), false);
  };

  const onChange = (event: Event) => {
    const target = event.target;
    if (!(target instanceof Element) || !root.contains(target)) return;
    if (target instanceof HTMLSelectElement && target.dataset.part === "format") {
      if (!isColorFormat(target.value)) return;
      const c = host.config();
      const format = target.value;
      const before = colorValue(c, host.state());
      if (!c.format) host.update({ format });
      host.emit("format-change", { format });
      const value = colorValue(c, { ...host.state(), format });
      if (value !== before) host.emit("change", { value });
      return;
    }
    if (target instanceof HTMLInputElement && (target.dataset.channel || target.dataset.part === "system")) {
      if (target.dataset.channel) syncOne(target);
      host.emit("change-end", { value: colorValue(host.config(), host.state()) });
    }
  };

  const onFocusOut = (event: FocusEvent) => {
    const target = event.target;
    if (target instanceof HTMLInputElement && target.dataset.channel && root.contains(target)) syncOne(target);
  };

  const onClick = (event: MouseEvent) => {
    const target = event.target instanceof Element ? event.target.closest<HTMLElement>("button") : null;
    if (!target || !root.contains(target) || !interactive(host.config())) return;
    if (target.classList.contains("z-colorpicker__swatch") && target.dataset.value) {
      const rgb = parseColor(target.dataset.value);
      if (rgb) commitRgb(host, rgb, true);
      return;
    }
    if (target.dataset.part === "eyedropper" && Picker) {
      void new Picker()
        .open()
        .then((result) => {
          const rgb = parseColor(result.sRGBHex);
          if (rgb) commitRgb(host, { ...rgb, a: host.state().hsva.a }, true);
        })
        .catch(() => {
          // La persona canceló con Escape: nada que hacer.
        });
    }
  };

  // Variante en popover: `toggle` no burbujea, se escucha en captura. Se coloca bajo el botón al abrirse.
  const onToggle = (event: Event) => {
    const panel = event.target;
    if (!(panel instanceof HTMLElement) || !panel.classList.contains("z-colortrigger__panel") || !root.contains(panel)) return;
    const open = (event as ToggleEvent).newState === "open";
    host.update({ open });
    if (open) {
      const button = root.querySelector<HTMLElement>(".z-colortrigger__button");
      if (button) place(panel, button.getBoundingClientRect(), "bottom-start", 6);
      panel.querySelector<HTMLElement>('[data-part="area-thumb"], [role="slider"], input')?.focus({ preventScroll: true });
    }
  };

  root.addEventListener("pointerdown", onPointerDown);
  root.addEventListener("pointermove", onPointerMove);
  root.addEventListener("pointerup", onPointerEnd);
  root.addEventListener("pointercancel", onPointerEnd);
  root.addEventListener("keydown", onKeyDown);
  root.addEventListener("input", onInput);
  root.addEventListener("change", onChange);
  root.addEventListener("focusout", onFocusOut);
  root.addEventListener("click", onClick);
  root.addEventListener("toggle", onToggle, true);
  return () => {
    root.removeEventListener("pointerdown", onPointerDown);
    root.removeEventListener("pointermove", onPointerMove);
    root.removeEventListener("pointerup", onPointerEnd);
    root.removeEventListener("pointercancel", onPointerEnd);
    root.removeEventListener("keydown", onKeyDown);
    root.removeEventListener("input", onInput);
    root.removeEventListener("change", onChange);
    root.removeEventListener("focusout", onFocusOut);
    root.removeEventListener("click", onClick);
    root.removeEventListener("toggle", onToggle, true);
  };
}

/* ---------- Modo DOM ---------- */

function fromDom(el: HTMLElement, json: Record<string, unknown>): ColorPickerProps {
  const d = el.dataset;
  const formats = Array.isArray(json.formats)
    ? (json.formats as ColorFormat[])
    : d.formats
      ? (list(d.formats) as ColorFormat[])
      : undefined;
  const parsed = (text: string | undefined): unknown => {
    if (!text || !/^[[{]/.test(text.trim())) return undefined;
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return undefined;
    }
  };
  const fromAttr = parsed(d.swatches);
  const swatchesInput = Array.isArray(json.swatches)
    ? (json.swatches as Array<string | ColorSwatch>)
    : Array.isArray(fromAttr)
      ? (fromAttr as Array<string | ColorSwatch>)
      : d.swatches
        ? d.swatches.split(/\s*;\s*/).filter(Boolean)
        : undefined;
  const labelsAttr = parsed(d.labels);
  return {
    // `data-value` lo escribe el propio pintado: es el valor inicial y no manda después.
    defaultValue: (json.defaultValue as string | undefined) ?? d.defaultValue ?? d.value,
    defaultFormat: (json.defaultFormat as ColorFormat | undefined) ?? (d.format as ColorFormat | undefined),
    formats,
    alpha: d.alpha === undefined ? (json.alpha as boolean | undefined) : yes(d.alpha),
    swatches: swatchesInput,
    eyeDropper: d.eyedropper === undefined ? undefined : yes(d.eyedropper),
    systemPicker: d.systemPicker === undefined ? undefined : yes(d.systemPicker),
    fields: d.fields === undefined ? undefined : yes(d.fields),
    orientation: d.orientation === "vertical" ? "vertical" : undefined,
    channel: d.channel === "alpha" ? "alpha" : undefined,
    disabled: d.disabled !== undefined,
    readOnly: d.readonly !== undefined,
    name: d.name,
    form: d.form,
    size: d.size === "sm" ? "sm" : undefined,
    label: d.label ?? el.getAttribute("aria-label") ?? undefined,
    labels: (json.labels ?? labelsAttr) as Partial<ColorPickerLabels> | undefined,
  };
}

function makeWidget(kind: Config["kind"], root: string): Widget<ColorPickerProps, Config, ColorState> {
  return {
    root,
    configure: (p) => configure(kind, root, p),
    initial,
    control,
    tree,
    attach,
    after: (el, host) => syncFields(el, host),
    fromDom,
  };
}

/** Selector completo: área, tono, alfa, campos, formato, muestrario, cuentagotas y selector del sistema. */
export const colorPickerWidget = makeWidget("picker", "z-colorpicker");
/** Área de saturación y brillo sola. */
export const colorAreaWidget = makeWidget("area", "z-colorarea");
/** Deslizador de tono o de alfa solo. */
export const colorSliderWidget = makeWidget("slider", "z-colorslider");
/** Muestrario solo (grupo de radios). */
export const colorSwatchPickerWidget = makeWidget("swatches", "z-colorswatches");
/** Campos de canal y de formato solos (con el selector del sistema). */
export const colorFieldWidget = makeWidget("field", "z-colorfield");
/** Botón con muestra que abre el selector en un popover. */
export const colorTriggerWidget = makeWidget("trigger", "z-colortrigger");
