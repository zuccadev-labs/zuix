"use client";
import type { ComponentProps, ReactNode } from "react";
import { Checkbox as RadixCheckbox } from "radix-ui";
import { cx } from "../../cx";
import { useFieldControl } from "./Field";

export interface CheckboxProps extends Omit<ComponentProps<typeof RadixCheckbox.Root>, "children"> {
  /** Etiqueta visible. Sin ella hace falta `aria-label`. */
  children?: ReactNode;
  /** Texto secundario bajo la etiqueta. */
  description?: ReactNode;
  invalid?: boolean;
}

/** Casilla con estado marcado, sin marcar e indeterminado (`checked="indeterminate"`). */
export function Checkbox({ children, description, invalid, className, id, required, "aria-describedby": describedBy, ...rest }: CheckboxProps) {
  const { invalid: isInvalid, ...control } = useFieldControl({ id, invalid, required, "aria-describedby": describedBy });
  return (
    <label className={cx("z-check", className)} data-disabled={rest.disabled || undefined}>
      <RadixCheckbox.Root {...rest} {...control} className="z-check__box" data-invalid={isInvalid || undefined}>
        {/* La marca se dibuja con CSS según data-state. */}
        <RadixCheckbox.Indicator forceMount className="z-check__mark" />
      </RadixCheckbox.Root>
      {children || description ? (
        <span className="z-check__text">
          {children ? <span className="z-check__label">{children}</span> : null}
          {description ? <span className="z-check__description">{description}</span> : null}
        </span>
      ) : null}
    </label>
  );
}
