"use client";
import type { ComponentProps, ReactNode } from "react";
import { RadioGroup as RadixRadioGroup } from "radix-ui";
import { cx } from "../../cx";

export interface RadioProps extends Omit<ComponentProps<typeof RadixRadioGroup.Item>, "children"> {
  children?: ReactNode;
  description?: ReactNode;
}

/** Opción de un `RadioGroup`. */
export function Radio({ children, description, className, ...rest }: RadioProps) {
  return (
    <label className={cx("z-radio", className)} data-disabled={rest.disabled || undefined}>
      <RadixRadioGroup.Item {...rest} className="z-radio__dot">
        <RadixRadioGroup.Indicator className="z-radio__mark" />
      </RadixRadioGroup.Item>
      {children || description ? (
        <span className="z-check__text">
          {children ? <span className="z-check__label">{children}</span> : null}
          {description ? <span className="z-check__description">{description}</span> : null}
        </span>
      ) : null}
    </label>
  );
}
