"use client";
import { useState, type ComponentProps, type KeyboardEvent } from "react";
import { logicalKey } from "../../core/dir";
import { moveBoth } from "../../core/roving";
import { cx } from "../../cx";
import { useControllable, useIsoLayoutEffect } from "../../primitives/hooks";
import { RadioGroupContext } from "../../primitives/radio-context";
import { useFieldControl, useFieldLabel } from "./Field";
import { withRef } from "../../react-compat";

export interface RadioGroupProps extends Omit<ComponentProps<"div">, "onChange" | "defaultValue"> {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Nombre del campo al enviar un formulario. */
  name?: string;
  required?: boolean;
  disabled?: boolean;
  orientation?: "horizontal" | "vertical";
  invalid?: boolean;
  /** `card`: cada opción es un recuadro que se marca entero (planes, temas, métodos de envío). */
  variant?: "default" | "card";
}

/** Radios habilitados que pertenecen a `group` (no a un grupo anidado). */
const radiosOf = (group: Element) =>
  [...group.querySelectorAll<HTMLButtonElement>('[role="radio"]')].filter(
    (radio) => radio.closest('[role="radiogroup"]') === group && !radio.disabled,
  );

/** Grupo de opciones excluyentes (patrón APG «radiogroup»): las flechas mueven el foco y la selección. */
export const RadioGroup = withRef(function RadioGroup({
  value: valueProp,
  defaultValue = "",
  onValueChange,
  name,
  disabled,
  invalid,
  className,
  orientation = "vertical",
  variant = "default",
  id,
  required,
  "aria-describedby": describedBy,
  onKeyDown,
  children,
  ...rest
}: RadioGroupProps) {
  const {
    invalid: isInvalid,
    required: isRequired,
    ...control
  } = useFieldControl({ id, invalid, required, "aria-describedby": describedBy });
  // Un radiogroup no es etiquetable con <label for>: dentro de un Field se nombra con aria-labelledby.
  const fieldLabel = useFieldLabel();
  const labelledBy = rest["aria-labelledby"] ?? (rest["aria-label"] ? undefined : fieldLabel);
  const [value, setValue] = useControllable(valueProp, defaultValue, onValueChange);
  const [tabStop, setTabStop] = useState<string | null>(null);
  const [node, setNode] = useState<HTMLDivElement | null>(null);

  useIsoLayoutEffect(() => {
    if (!node) return;
    const list = radiosOf(node);
    setTabStop((list.find((radio) => radio.value === value) ?? list[0])?.value ?? null);
  });

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    const current = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('[role="radio"]') : null;
    if (event.defaultPrevented || !current || current.closest('[role="radiogroup"]') !== event.currentTarget) return;
    // En RTL la flecha izquierda avanza: la dirección se lee del DOM.
    const next = moveBoth(radiosOf(event.currentTarget), current, logicalKey(event.key, current));
    if (!next) return;
    event.preventDefault();
    next.focus();
    setValue(next.value);
  };

  return (
    <div
      {...rest}
      {...control}
      ref={setNode}
      role="radiogroup"
      aria-required={isRequired}
      aria-orientation={orientation}
      aria-labelledby={labelledBy}
      aria-disabled={disabled || undefined}
      data-orientation={orientation}
      data-variant={variant === "card" ? "card" : undefined}
      data-invalid={isInvalid || undefined}
      data-disabled={disabled ? "" : undefined}
      className={cx("z-radio-group", className)}
      onKeyDown={handleKeyDown}
    >
      <RadioGroupContext.Provider
        value={{ value, select: setValue, reset: () => setValue(defaultValue), name, required: isRequired, disabled, tabStop, variant }}
      >
        {children}
      </RadioGroupContext.Provider>
    </div>
  );
});
