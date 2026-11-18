"use client";
import { createContext, useContext, useId, useMemo, type HTMLAttributes, type ReactNode } from "react";
import { cx } from "../../cx";

interface FieldContextValue {
  id: string;
  labelId?: string;
  describedBy?: string;
  invalid: boolean;
  required: boolean;
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
  children: ReactNode;
}

/** Envoltura de campo: etiqueta, ayuda y error enlazados al control por id y aria-describedby. */
export function Field({
  label,
  hint,
  error,
  required = false,
  optionalLabel,
  htmlFor,
  layout = "stacked",
  className,
  children,
  ...rest
}: FieldProps) {
  const auto = useId();
  const id = htmlFor ?? `${auto}-control`;
  const hintId = hint ? `${auto}-hint` : undefined;
  const errorId = error ? `${auto}-error` : undefined;
  const labelId = label ? `${auto}-label` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;
  const value = useMemo<FieldContextValue>(
    () => ({ id, labelId, describedBy, invalid: Boolean(error), required }),
    [id, labelId, describedBy, error, required],
  );

  return (
    <div {...rest} className={cx("z-field", className)} data-layout={layout} data-invalid={error ? true : undefined}>
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
        {error ? (
          <p className="z-field__error" id={errorId} role="alert">
            {error}
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
