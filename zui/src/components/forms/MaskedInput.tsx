"use client";
import { useEffect, useId, useMemo, useRef, useState, type InputHTMLAttributes, type Ref } from "react";
import { Icon, type IconName } from "@zuccadev-labs/zuix-zicon/core";
import { applyMask, MASK_PRESETS, maskInputMode, maskTemplate, resolveMask, type MaskPreset, type MaskSpec } from "../../core/mask";
import { attachMask, type MaskControl } from "../../core/mask-control";
import { fill } from "../../core/vnode";
import { cx } from "../../cx";
import { useLatest } from "../../primitives/hooks";
import { useMergedRef } from "../../refs";
import { ICON_SIZE, type ControlSize } from "../actions/types";
import { useFieldControl } from "./Field";
import { withRef } from "../../react-compat";

export type { MaskPreset, MaskSpec };

export interface MaskedInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "size" | "value" | "defaultValue" | "onChange" | "type" | "name"> {
  /** Preset (`phone`, `card`, `date`, `time`, `plate`, `postal`), patrón (`9` cifra, `a` letra, `*` letra o cifra, `\` escapa),
   *  función que elige el patrón según lo tecleado o una máscara completa `{ pattern, tokens, transform }`. */
  mask: MaskPreset | string | ((raw: string) => string) | MaskSpec;
  /** Valor crudo (solo lo que ocupa ranuras), controlado. */
  value?: string;
  defaultValue?: string;
  onValueChange?: (raw: string, detail: { value: string; complete: boolean }) => void;
  /** Nombre del campo al enviar un formulario. */
  name?: string;
  /** Qué envía el formulario: el crudo (por defecto, en un campo oculto) o el texto formateado. */
  submit?: "raw" | "formatted";
  /** Formato que se anuncia y se muestra sobre el campo. Por defecto, el del preset o el patrón con `_`. */
  formatHint?: string;
  /** Texto del formato; `{format}` se sustituye. */
  formatLabel?: string;
  /** Muestra el formato sobre el campo (por defecto). Sin él, el formato solo se anuncia. */
  showFormat?: boolean;
  /** Mensaje de validez con el valor a medias. */
  incompleteMessage?: string;
  size?: ControlSize;
  invalid?: boolean;
  icon?: IconName;
  /** Clase del `<input>`; `className` va a la envoltura. */
  inputClassName?: string;
  ref?: Ref<HTMLInputElement>;
}

/**
 * Campo con máscara: teléfono, tarjeta, fecha, matrícula o patrón propio. El cursor no salta al teclear, pegar o
 * borrar en medio (`beforeinput`), y la composición de un IME o el autocompletado se reformatean al terminar. El
 * formato va sobre el campo y se anuncia con `aria-describedby`.
 */
export const MaskedInput = withRef(function MaskedInput({
  mask,
  value,
  defaultValue = "",
  onValueChange,
  name,
  submit = "raw",
  formatHint,
  formatLabel = "Format: {format}",
  showFormat = true,
  incompleteMessage = "Enter the complete value",
  size = "md",
  invalid,
  icon,
  className,
  inputClassName,
  id,
  required,
  "aria-describedby": describedBy,
  ref,
  inputMode,
  autoComplete,
  ...rest
}: MaskedInputProps) {
  const spec = useMemo(() => resolveMask(mask), [mask]);
  const formatId = `${useId()}-format`;
  const { invalid: isInvalid, ...control } = useFieldControl({
    id,
    invalid,
    required,
    "aria-describedby": [formatId, describedBy].filter(Boolean).join(" "),
  });
  const input = useRef<HTMLInputElement | null>(null);
  const setInput = useMergedRef(input, ref);
  const handle = useRef<MaskControl | null>(null);
  const [raw, setRaw] = useState(() => (spec ? applyMask(spec, value ?? defaultValue).raw : (value ?? defaultValue)));
  // Valor con el que se montó: el que devuelve `form.reset()` (como el `defaultValue` de un campo nativo).
  const mounted = useRef(value ?? defaultValue);
  const latest = useLatest({ spec, onValueChange, incompleteMessage, defaultValue: mounted.current, controlled: value !== undefined });
  const initial = spec ? applyMask(spec, value ?? defaultValue).value : (value ?? defaultValue);

  useEffect(() => {
    const el = input.current;
    if (!el) return;
    handle.current = attachMask(el, {
      spec: () => latest.current.spec,
      incompleteMessage: () => latest.current.incompleteMessage,
      onChange: (change) => {
        if (!latest.current.controlled) setRaw(change.raw);
        latest.current.onValueChange?.(change.raw, { value: change.value, complete: change.complete });
      },
    });
    // `form.reset()` devuelve el valor inicial; el evento llega antes de que el formulario restablezca sus campos.
    const form = el.form;
    const onReset = () =>
      setTimeout(() => {
        const { spec: now, defaultValue: initialRaw } = latest.current;
        handle.current?.set(initialRaw);
        const masked = now ? applyMask(now, initialRaw) : { raw: initialRaw, value: initialRaw, complete: false };
        setRaw(masked.raw);
        latest.current.onValueChange?.(masked.raw, { value: masked.value, complete: masked.complete });
      }, 0);
    form?.addEventListener("reset", onReset);
    return () => {
      form?.removeEventListener("reset", onReset);
      handle.current?.destroy();
      handle.current = null;
    };
  }, [latest]);

  // Controlado: el valor de la aplicación manda.
  useEffect(() => {
    if (value === undefined) return;
    handle.current?.set(value);
    setRaw(spec ? applyMask(spec, value).raw : value);
  }, [value, spec]);

  const hint = formatHint ?? spec?.hint ?? (spec ? maskTemplate(spec) : "");
  const mode = inputMode ?? spec?.inputMode ?? (spec ? maskInputMode(spec) : undefined);
  const shown = value === undefined ? raw : spec ? applyMask(spec, value).raw : value;
  const preset = typeof mask === "string" && Object.hasOwn(MASK_PRESETS, mask) ? mask : undefined;
  const pattern = preset
    ? undefined
    : typeof mask === "string"
      ? mask
      : typeof mask === "object" && typeof mask.pattern === "string"
        ? mask.pattern
        : undefined;
  return (
    <span
      className={cx("z-masked", className)}
      data-size={size}
      data-mask={preset}
      data-pattern={pattern}
      data-transform={typeof mask === "object" ? mask.transform : undefined}
      data-incomplete-message={incompleteMessage === "Enter the complete value" ? undefined : incompleteMessage}
    >
      <span className={showFormat ? "z-masked__format" : "z-sr-only"} id={formatId}>
        {fill(formatLabel, { format: hint })}
      </span>
      <span className="z-input" data-size={size} data-invalid={isInvalid || undefined} data-disabled={rest.disabled || undefined}>
        {icon ? (
          <span className="z-input__icon">
            <Icon name={icon} size={ICON_SIZE[size]} />
          </span>
        ) : null}
        <input
          {...rest}
          {...control}
          ref={setInput}
          type="text"
          className={cx("z-input__control", inputClassName)}
          inputMode={mode}
          autoComplete={autoComplete ?? spec?.autoComplete ?? "off"}
          spellCheck={false}
          autoCorrect="off"
          name={submit === "formatted" ? name : undefined}
          defaultValue={initial}
        />
      </span>
      {name && submit === "raw" ? <input type="hidden" name={name} value={shown} /> : null}
    </span>
  );
});
