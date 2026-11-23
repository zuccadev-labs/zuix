"use client";
import { useEffect, useId, useRef, useState, type InputHTMLAttributes, type Ref } from "react";
import { Icon } from "@zuccadev-labs/zuix-zicon/core";
import { passwordStrength } from "../../core/password";
import { cx } from "../../cx";
import { useControllable } from "../../primitives/hooks";
import { useMergedRef } from "../../refs";
import { ICON_SIZE, type ControlSize } from "../actions/types";
import { useFieldControl } from "./Field";
import { withRef } from "../../react-compat";

export interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size" | "type"> {
  size?: ControlSize;
  invalid?: boolean;
  /** `current-password` al entrar y `new-password` al crear o cambiar la contraseña. */
  autoComplete?: "current-password" | "new-password" | "one-time-code" | "off";
  /** Contraseña visible (controlado). */
  visible?: boolean;
  defaultVisible?: boolean;
  onVisibleChange?: (visible: boolean) => void;
  /** Nombre accesible del botón de mostrar (no cambia al pulsarlo: el estado lo da aria-pressed). */
  toggleLabel?: string;
  /** Aviso que lee el lector al llegar al botón. */
  toggleHint?: string;
  /** Vuelve a ocultarla al enviar el formulario (por defecto). */
  hideOnSubmit?: boolean;
  /**
   * Medidor de fortaleza bajo el campo. `true` usa una estimación orientativa (longitud y variedad); un número de 0
   * a 4 lo fija la aplicación (por ejemplo, con la respuesta del servidor).
   */
  strength?: boolean | number;
  /** Textos de los cinco niveles del medidor (0 a 4). */
  strengthLabels?: readonly [string, string, string, string, string];
  /** Prefijo del texto del medidor («Strength: Fair»). */
  strengthPrefix?: string;
  /** Clase de la envoltura. */
  className?: string;
  /** Clase del `<input>`. */
  inputClassName?: string;
  ref?: Ref<HTMLInputElement>;
}

const LABELS = ["Too short", "Weak", "Fair", "Good", "Strong"] as const;

/**
 * Campo de contraseña con botón de mostrar u ocultar (aria-pressed) y medidor opcional. Admite pegar y el
 * autocompletado del gestor de contraseñas; el medidor se lee con el campo (aria-describedby), sin anunciar cada tecla.
 */
export const PasswordInput = withRef(function PasswordInput({
  size = "md",
  invalid,
  autoComplete = "current-password",
  visible: visibleProp,
  defaultVisible = false,
  onVisibleChange,
  toggleLabel = "Show password",
  toggleHint = "Shows the password on screen",
  hideOnSubmit = true,
  strength,
  strengthLabels = LABELS,
  strengthPrefix = "Strength:",
  className,
  inputClassName,
  id,
  required,
  disabled,
  value,
  defaultValue,
  onChange,
  "aria-describedby": describedBy,
  ref,
  ...rest
}: PasswordInputProps) {
  const auto = useId();
  const meterId = strength !== undefined && strength !== false ? `${auto}-strength` : undefined;
  const hintId = `${auto}-toggle-hint`;
  const {
    invalid: isInvalid,
    id: fieldId,
    ...field
  } = useFieldControl({
    id,
    invalid,
    required,
    "aria-describedby": [describedBy, meterId].filter(Boolean).join(" ") || undefined,
  });
  // El id del Field (enlaza su <label>) o, sin Field, uno propio para aria-controls.
  const control = { ...field, id: fieldId ?? `${auto}-input` };
  const [visible, setVisible] = useControllable(visibleProp, defaultVisible, onVisibleChange);
  const [typed, setTyped] = useState(String(defaultValue ?? ""));
  const text = value === undefined ? typed : String(value);
  const input = useRef<HTMLInputElement | null>(null);
  const setRef = useMergedRef(input, ref);

  // Al enviar el formulario se vuelve a ocultar: no queda a la vista en la página siguiente ni en una captura.
  useEffect(() => {
    const form = input.current?.form;
    if (!form || !hideOnSubmit) return;
    const onSubmit = () => setVisible(false);
    form.addEventListener("submit", onSubmit);
    return () => form.removeEventListener("submit", onSubmit);
  }, [hideOnSubmit, setVisible]);

  const score = typeof strength === "number" ? Math.max(0, Math.min(4, Math.round(strength))) : passwordStrength(text).score;
  // Sin nada escrito el medidor no juzga (no hay error antes de interactuar).
  const rated = Boolean(text) || typeof strength === "number";

  return (
    <div
      className={cx("z-password", className)}
      data-size={size}
      data-strength={typeof strength === "number" ? score : undefined}
      data-labels={strengthLabels === LABELS ? undefined : strengthLabels.join("|")}
      data-prefix={strengthPrefix === "Strength:" ? undefined : strengthPrefix}
      data-keep-visible={hideOnSubmit ? undefined : ""}
    >
      <span
        className="z-input z-password__field"
        data-size={size}
        data-invalid={isInvalid || undefined}
        data-disabled={disabled || undefined}
      >
        <input
          {...rest}
          {...control}
          ref={setRef}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required={control.required}
          disabled={disabled}
          value={value}
          defaultValue={defaultValue}
          className={cx("z-input__control", inputClassName)}
          onChange={(event) => {
            if (value === undefined) setTyped(event.target.value);
            onChange?.(event);
          }}
        />
        <button
          type="button"
          className="z-input__action z-password__toggle"
          aria-label={toggleLabel}
          aria-pressed={visible}
          aria-controls={control.id}
          aria-describedby={hintId}
          title={toggleLabel}
          disabled={disabled}
          onClick={() => setVisible(!visible)}
        >
          <span className="z-swap" aria-hidden="true" data-effect="fade">
            <span className="z-swap__item" data-for="off">
              <Icon name="eye" size={ICON_SIZE[size]} />
            </span>
            <span className="z-swap__item" data-for="on">
              <Icon name="eye-slash" size={ICON_SIZE[size]} />
            </span>
          </span>
        </button>
        <span id={hintId} className="z-sr-only">
          {toggleHint}
        </span>
      </span>
      {meterId ? (
        <div className="z-password__meter" data-score={rated ? score : undefined}>
          <span className="z-password__bars" aria-hidden="true">
            <span className="z-password__bar" />
            <span className="z-password__bar" />
            <span className="z-password__bar" />
            <span className="z-password__bar" />
          </span>
          <span id={meterId} className="z-password__label">
            {rated ? `${strengthPrefix} ${strengthLabels[score]}` : ""}
          </span>
        </div>
      ) : null}
    </div>
  );
});
