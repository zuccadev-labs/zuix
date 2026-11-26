"use client";
import { createContext, useContext, useEffect, useId, useMemo, useRef, useState, type HTMLAttributes, type ReactNode } from "react";
import { messageAttribute, validityMessage, VALIDITY_KEYS, type ValidityMessages } from "../../core/validity";
import { cx } from "../../cx";

interface FieldContextValue {
  id: string;
  labelId?: string;
  describedBy?: string;
  invalid: boolean;
  required: boolean;
  floating?: boolean;
}

const FieldContext = createContext<FieldContextValue | null>(null);

/**
 * Atributos que un control toma del `Field` que lo envuelve. Las props propias del control ganan.
 * Sin `Field` devuelve lo recibido.
 */
export function useFieldControl(own: { id?: string; invalid?: boolean; required?: boolean; "aria-describedby"?: string } = {}) {
  const field = useContext(FieldContext);
  const invalid = own.invalid ?? field?.invalid ?? false;
  const describedBy = [own["aria-describedby"], field?.describedBy].filter(Boolean).join(" ") || undefined;
  return {
    id: own.id ?? field?.id,
    required: own.required ?? (field?.required || undefined),
    invalid,
    "aria-invalid": invalid || undefined,
    "aria-describedby": describedBy,
  } as const;
}

/**
 * Id de la etiqueta del `Field` que envuelve al control, si la tiene. Lo usan los controles que `<label for>` no
 * puede nombrar porque no son elementos etiquetables (un `radiogroup`, el grupo de casillas de OTPInput, los
 * tiradores de Slider): se enlazan con `aria-labelledby`.
 */
export function useFieldLabel(): string | undefined {
  return useContext(FieldContext)?.labelId;
}

/** Verdadero dentro de un `Field` con etiqueta flotante (el control necesita un `placeholder` para saber si está vacío). */
export function useFieldFloating(): boolean {
  return Boolean(useContext(FieldContext)?.floating);
}

export interface FieldProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  label?: ReactNode;
  /** Ayuda bajo el control. */
  hint?: ReactNode;
  /** Mensaje de error; si existe el control queda marcado como inválido. */
  error?: ReactNode;
  required?: boolean;
  /** Texto junto a la etiqueta cuando el campo no es obligatorio. */
  optionalLabel?: string;
  /** Id del control; por defecto se genera. */
  htmlFor?: string;
  /** `inline` coloca la etiqueta a la izquierda del control. */
  layout?: "stacked" | "inline";
  /**
   * `floating` (Material 3 Expressive): la etiqueta va dentro del campo mientras está vacío y sube al enfocarlo, al
   * escribir o cuando el navegador lo autocompleta. Sigue siendo un `<label for>`. Con `Input` (también con icono);
   * sin efecto con `layout="inline"`.
   */
  labelPlacement?: "top" | "floating";
  /**
   * Muestra el error de la validación nativa del control (required, type, pattern, minLength, min, max…) tras
   * interactuar: al salir del campo si se editó, o al intentar enviar. Se quita en cuanto el valor es válido.
   * `true` usa los mensajes del navegador; un objeto los sustituye por motivo (`valueMissing`, `typeMismatch`…).
   */
  validate?: boolean | ValidityMessages;
  children: ReactNode;
}

type Validatable = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
const validatable = (el: EventTarget | null): el is Validatable =>
  el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement;

/** Envoltura de campo: etiqueta, ayuda y error enlazados al control por id y aria-describedby. */
export function Field({
  label,
  hint,
  error,
  required = false,
  optionalLabel,
  htmlFor,
  layout = "stacked",
  labelPlacement = "top",
  validate,
  className,
  children,
  ...rest
}: FieldProps) {
  const auto = useId();
  const id = htmlFor ?? `${auto}-control`;
  const root = useRef<HTMLDivElement | null>(null);
  const [native, setNative] = useState<string | null>(null);
  const messages = typeof validate === "object" ? validate : undefined;
  const messagesKey = JSON.stringify(messages ?? {});

  // Validación nativa: `invalid` no burbujea, así que se escucha en captura en la envoltura.
  useEffect(() => {
    const el = root.current;
    if (!el || !validate) return;
    const own: ValidityMessages = JSON.parse(messagesKey);
    const edited = new WeakSet<EventTarget>();
    const show = (control: Validatable) => setNative(validityMessage(control.validity, own, control.validationMessage));
    const onInvalid = (event: Event) => {
      if (!validatable(event.target)) return;
      // El mensaje se pinta en el campo; el globo del navegador sobra.
      event.preventDefault();
      show(event.target);
    };
    const onInput = (event: Event) => {
      if (!validatable(event.target)) return;
      edited.add(event.target);
      // Mientras se escribe solo se quita el error, no se pone.
      if (event.target.validity.valid) setNative(null);
    };
    const onLeave = (event: Event) => {
      if (validatable(event.target) && edited.has(event.target)) show(event.target);
    };
    el.addEventListener("invalid", onInvalid, true);
    el.addEventListener("input", onInput, true);
    el.addEventListener("change", onInput, true);
    el.addEventListener("focusout", onLeave, true);
    return () => {
      el.removeEventListener("invalid", onInvalid, true);
      el.removeEventListener("input", onInput, true);
      el.removeEventListener("change", onInput, true);
      el.removeEventListener("focusout", onLeave, true);
    };
  }, [validate, messagesKey]);

  // El error de la aplicación (`error`) manda sobre el de la validación nativa.
  const shown = error ?? (validate ? native : null) ?? undefined;
  const hintId = hint ? `${auto}-hint` : undefined;
  const errorId = shown ? `${auto}-error` : undefined;
  const labelId = label ? `${auto}-label` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;
  const floating = labelPlacement === "floating" && layout !== "inline" && Boolean(label);
  const value = useMemo<FieldContextValue>(
    () => ({ id, labelId, describedBy, invalid: Boolean(shown), required, floating }),
    [id, labelId, describedBy, shown, required, floating],
  );

  return (
    <div
      {...rest}
      ref={root}
      className={cx("z-field", className)}
      data-layout={layout}
      data-label-placement={floating ? "floating" : undefined}
      data-invalid={shown ? true : undefined}
      data-validate={validate ? "" : undefined}
      // Mensajes propios legibles por el modo DOM (data-msg-value-missing…).
      {...Object.fromEntries(VALIDITY_KEYS.filter((key) => messages?.[key]).map((key) => [messageAttribute(key), messages?.[key]]))}
    >
      {label ? (
        <label className="z-field__label" id={labelId} htmlFor={id}>
          {label}
          {required ? (
            <span className="z-field__required" aria-hidden="true">
              *
            </span>
          ) : optionalLabel ? (
            <span className="z-field__optional">{optionalLabel}</span>
          ) : null}
        </label>
      ) : null}
      <div className="z-field__body">
        <FieldContext.Provider value={value}>{children}</FieldContext.Provider>
        {shown ? (
          <p className="z-field__error" id={errorId} role="alert">
            {shown}
          </p>
        ) : null}
        {hint ? (
          <p className="z-field__hint" id={hintId}>
            {hint}
          </p>
        ) : null}
      </div>
    </div>
  );
}
