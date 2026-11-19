"use client";
import { useContext, type ComponentProps, type ReactNode } from "react";
import { cx } from "../../cx";
import { NativeInput } from "../../primitives/native-input";
import { RadioGroupContext } from "../../primitives/radio-context";

export interface RadioProps extends Omit<ComponentProps<"button">, "children" | "value" | "onChange"> {
  /** Valor de la opción dentro de su `RadioGroup`. */
  value: string;
  children?: ReactNode;
  description?: ReactNode;
}

/** Opción de un `RadioGroup`. */
export function Radio({ value, children, description, className, disabled: disabledProp, onClick, ...rest }: RadioProps) {
  const group = useContext(RadioGroupContext);
  if (!group) throw new Error("<Radio> must be used inside <RadioGroup>");
  const checked = group.value === value;
  const disabled = disabledProp || group.disabled;
  const state = checked ? "checked" : "unchecked";
  return (
    <label
      className={cx("z-radio", className)}
      data-disabled={disabled || undefined}
      data-variant={group.variant === "card" ? "card" : undefined}
    >
      <button
        type="button"
        {...rest}
        role="radio"
        aria-checked={checked}
        data-state={state}
        data-disabled={disabled ? "" : undefined}
        disabled={disabled}
        value={value}
        // Antes de hidratar aún no se conoce la primera opción habilitada: la parada es la opción elegida.
        tabIndex={(group.tabStop ?? group.value) === value ? 0 : -1}
        className="z-radio__dot"
        onClick={(event) => {
          onClick?.(event);
          if (!event.defaultPrevented) group.select(value);
        }}
      >
        {checked ? <span className="z-radio__mark" data-state={state} /> : null}
      </button>
      <NativeInput
        type="radio"
        name={group.name}
        value={value}
        checked={checked}
        required={group.required}
        disabled={disabled}
        onReset={group.reset}
      />
      {children || description ? (
        <span className="z-check__text">
          {children ? <span className="z-check__label">{children}</span> : null}
          {description ? <span className="z-check__description">{description}</span> : null}
        </span>
      ) : null}
    </label>
  );
}
