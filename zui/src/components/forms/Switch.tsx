"use client";
import type { ComponentProps, ReactNode } from "react";
import { Switch as RadixSwitch } from "radix-ui";
import { cx } from "../../cx";
import { useFieldControl } from "./Field";

export interface SwitchProps extends Omit<ComponentProps<typeof RadixSwitch.Root>, "children"> {
  size?: "sm" | "md";
  /** Etiqueta visible. Sin ella hace falta `aria-label`. */
  children?: ReactNode;
  /** Coloca la etiqueta antes o después del interruptor. */
  labelPosition?: "start" | "end";
}

/** Interruptor de activación inmediata (role="switch"). */
export function Switch({ size = "md", children, labelPosition = "end", className, id, required, "aria-describedby": describedBy, ...rest }: SwitchProps) {
  const { invalid: _invalid, "aria-invalid": _ariaInvalid, ...control } = useFieldControl({ id, required, "aria-describedby": describedBy });
  return (
    <label className={cx("z-switch", className)} data-size={size} data-label={labelPosition} data-disabled={rest.disabled || undefined}>
      <RadixSwitch.Root {...rest} {...control} className="z-switch__track">
        <RadixSwitch.Thumb className="z-switch__thumb" />
      </RadixSwitch.Root>
      {children ? <span className="z-switch__label">{children}</span> : null}
    </label>
  );
}
