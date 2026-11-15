"use client";
import type { ComponentProps } from "react";
import { Slider as RadixSlider } from "radix-ui";
import { cx } from "../../cx";

export interface SliderProps extends Omit<ComponentProps<typeof RadixSlider.Root>, "children"> {
  size?: "sm" | "md";
  /** Nombre accesible de cada tirador (uno por valor). */
  thumbLabels?: ReadonlyArray<string>;
}

/** Deslizador de uno o varios valores (rango con dos tiradores). */
export function Slider({ size = "md", thumbLabels, className, "aria-label": ariaLabel, ...rest }: SliderProps) {
  const count = (rest.value ?? rest.defaultValue ?? [0]).length;
  return (
    <RadixSlider.Root {...rest} className={cx("z-slider", className)} data-size={size}>
      <RadixSlider.Track className="z-slider__track">
        <RadixSlider.Range className="z-slider__range" />
      </RadixSlider.Track>
      {Array.from({ length: count }, (_, index) => (
        <RadixSlider.Thumb key={index} className="z-slider__thumb" aria-label={thumbLabels?.[index] ?? ariaLabel} />
      ))}
    </RadixSlider.Root>
  );
}
