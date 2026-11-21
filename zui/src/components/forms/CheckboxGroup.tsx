"use client";
import { useId, useMemo, type ReactNode, type Ref } from "react";
import { cx } from "../../cx";
import { useControllable } from "../../primitives/hooks";
import { CheckboxGroupContext, type CheckboxGroupState } from "../../primitives/checkbox-context";
import { Checkbox, type CheckedState } from "./Checkbox";

export interface CheckboxGroupOption {
  value: string;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}

export interface CheckboxGroupProps {
  /** Título del grupo (`<legend>`). */
  label: ReactNode;
  /** Texto bajo el título. */
  description?: ReactNode;
  /** Opciones; también se pueden poner `<Checkbox value="…">` como hijos. */
  options?: ReadonlyArray<CheckboxGroupOption>;
  value?: ReadonlyArray<string>;
  defaultValue?: ReadonlyArray<string>;
  onValueChange?: (value: string[]) => void;
  /** Nombre del campo: cada casilla marcada envía su valor con él. */
  name?: string;
  /** Casilla «todas» encima de las opciones (marcada, sin marcar o indeterminada), con este texto. */
  selectAll?: ReactNode;
  orientation?: "vertical" | "horizontal";
  variant?: "default" | "card";
  disabled?: boolean;
  invalid?: boolean;
  /** Mensaje de error bajo el grupo; lo marca como no válido. */
  error?: ReactNode;
  className?: string;
  ref?: Ref<HTMLFieldSetElement>;
  children?: ReactNode;
}

const EMPTY: ReadonlyArray<string> = [];

/**
 * Varias casillas de una misma pregunta en un `<fieldset>` con su `<legend>`. El valor es la lista de marcadas;
 * `selectAll` añade una casilla que marca o desmarca todas y se ve indeterminada si solo hay algunas.
 */
export function CheckboxGroup({
  label,
  description,
  options = [],
  value,
  defaultValue = EMPTY,
  onValueChange,
  name,
  selectAll,
  orientation = "vertical",
  variant = "default",
  disabled,
  invalid,
  error,
  className,
  ref,
  children,
}: CheckboxGroupProps) {
  const auto = useId();
  const [current, setCurrent] = useControllable<ReadonlyArray<string>>(
    value,
    defaultValue,
    onValueChange as (value: ReadonlyArray<string>) => void,
  );
  const isInvalid = Boolean(invalid || error);
  const state = useMemo<CheckboxGroupState>(
    () => ({
      value: current,
      toggle: (item, on) => setCurrent(on ? [...current.filter((v) => v !== item), item] : current.filter((v) => v !== item)),
      reset: () => setCurrent(defaultValue),
      name,
      disabled,
      invalid: isInvalid,
      variant,
    }),
    [current, setCurrent, defaultValue, name, disabled, isInvalid, variant],
  );
  const usable = options.filter((option) => !option.disabled).map((option) => option.value);
  const marked = usable.filter((v) => current.includes(v)).length;
  const all: CheckedState = marked === 0 ? false : marked === usable.length ? true : "indeterminate";
  const descriptionId = description ? `${auto}-description` : undefined;
  const errorId = error ? `${auto}-error` : undefined;

  return (
    <fieldset
      ref={ref}
      className={cx("z-checkgroup", className)}
      data-orientation={orientation}
      data-variant={variant === "card" ? "card" : undefined}
      data-invalid={isInvalid || undefined}
      aria-describedby={[descriptionId, errorId].filter(Boolean).join(" ") || undefined}
      disabled={disabled}
    >
      <legend className="z-checkgroup__legend">{label}</legend>
      {description ? (
        <p id={descriptionId} className="z-checkgroup__description">
          {description}
        </p>
      ) : null}
      {selectAll ? (
        <Checkbox
          className="z-checkgroup__all"
          data-select-all=""
          checked={all}
          disabled={disabled}
          onCheckedChange={(next) =>
            setCurrent(next === true ? [...new Set([...current, ...usable])] : current.filter((v) => !usable.includes(v)))
          }
        >
          {selectAll}
        </Checkbox>
      ) : null}
      <div className="z-checkgroup__items">
        <CheckboxGroupContext.Provider value={state}>
          {options.map((option) => (
            <Checkbox key={option.value} value={option.value} description={option.description} disabled={option.disabled}>
              {option.label}
            </Checkbox>
          ))}
          {children}
        </CheckboxGroupContext.Provider>
      </div>
      {error ? (
        <p id={errorId} className="z-field__error" role="alert">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
