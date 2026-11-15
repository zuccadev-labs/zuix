"use client";
import type { ComponentProps } from "react";
import { RadioGroup as RadixRadioGroup } from "radix-ui";
import { cx } from "../../cx";
import { useFieldControl } from "./Field";

export interface RadioGroupProps extends ComponentProps<typeof RadixRadioGroup.Root> {
  invalid?: boolean;
}

/** Grupo de opciones excluyentes. Las flechas mueven la selección. */
export function RadioGroup({ invalid, className, orientation = "vertical", id, required, "aria-describedby": describedBy, children, ...rest }: RadioGroupProps) {
  const { invalid: isInvalid, ...control } = useFieldControl({ id, invalid, required, "aria-describedby": describedBy });
  return (
    <RadixRadioGroup.Root {...rest} {...control} orientation={orientation} className={cx("z-radio-group", className)} data-invalid={isInvalid || undefined}>
      {children}
    </RadixRadioGroup.Root>
  );
}
