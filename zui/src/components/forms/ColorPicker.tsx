"use client";
import type { Ref } from "react";
import type { ColorFormat } from "../../core/color";
import {
  colorAreaWidget,
  colorFieldWidget,
  colorPickerWidget,
  colorSliderWidget,
  colorSwatchPickerWidget,
  colorTriggerWidget,
  type ColorPickerLabels,
  type ColorPickerProps as CoreProps,
  type ColorSwatch,
} from "../../core/color-widget";
import { useWidget } from "../agenda/vtree";
import { withRef } from "../../react-compat";

export type { ColorFormat, ColorPickerLabels, ColorSwatch };

export interface ColorPickerProps extends CoreProps {
  /** Cada cambio (arrastre, tecla, campo), con el valor en el formato elegido. */
  onValueChange?: (value: string) => void;
  /** Al soltar el puntero, tras una tecla, al elegir una muestra o al salir de un campo. */
  onValueChangeEnd?: (value: string) => void;
  onFormatChange?: (format: ColorFormat) => void;
  id?: string;
  className?: string;
  ref?: Ref<HTMLDivElement>;
}

type Handlers = Pick<ColorPickerProps, "onValueChange" | "onValueChangeEnd" | "onFormatChange">;
const handlers = ({ onValueChange, onValueChangeEnd, onFormatChange }: Handlers) => ({
  change: onValueChange ? (d: { value: string }) => onValueChange(d.value) : undefined,
  "change-end": onValueChangeEnd ? (d: { value: string }) => onValueChangeEnd(d.value) : undefined,
  "format-change": onFormatChange ? (d: { format: ColorFormat }) => onFormatChange(d.format) : undefined,
});

/**
 * Selector de color: área de saturación y brillo, tono, alfa, campos por canal y hexadecimal, formato (hex, rgb, hsl,
 * oklch), muestrario, cuentagotas (EyeDropper donde exista) y selector del sistema. El valor es una cadena CSS.
 */
export const ColorPicker = withRef(function ColorPicker({
  onValueChange,
  onValueChangeEnd,
  onFormatChange,
  id,
  className,
  ref,
  ...props
}: ColorPickerProps) {
  return useWidget(colorPickerWidget, props, {
    id,
    className,
    ref,
    handlers: handlers({ onValueChange, onValueChangeEnd, onFormatChange }),
  });
});

export type ColorAreaProps = Omit<
  ColorPickerProps,
  "formats" | "swatches" | "eyeDropper" | "systemPicker" | "fields" | "orientation" | "channel"
>;

/** Área de saturación y brillo para el tono del color (deslizador en dos ejes). */
export const ColorArea = withRef(function ColorArea({
  onValueChange,
  onValueChangeEnd,
  onFormatChange,
  id,
  className,
  ref,
  ...props
}: ColorAreaProps) {
  return useWidget(colorAreaWidget, props, { id, className, ref, handlers: handlers({ onValueChange, onValueChangeEnd, onFormatChange }) });
});

export type ColorSliderProps = Omit<ColorPickerProps, "formats" | "swatches" | "eyeDropper" | "systemPicker" | "fields">;

/** Deslizador de tono (`channel="hue"`) o de opacidad (`channel="alpha"`), horizontal o vertical. */
export const ColorSlider = withRef(function ColorSlider({
  onValueChange,
  onValueChangeEnd,
  onFormatChange,
  id,
  className,
  ref,
  ...props
}: ColorSliderProps) {
  return useWidget(colorSliderWidget, props, {
    id,
    className,
    ref,
    handlers: handlers({ onValueChange, onValueChangeEnd, onFormatChange }),
  });
});

export type ColorSwatchPickerProps = Omit<ColorPickerProps, "eyeDropper" | "systemPicker" | "fields" | "orientation" | "channel">;

/** Muestrario: un grupo de radios con las muestras dadas. */
export const ColorSwatchPicker = withRef(function ColorSwatchPicker({
  onValueChange,
  onValueChangeEnd,
  onFormatChange,
  id,
  className,
  ref,
  ...props
}: ColorSwatchPickerProps) {
  return useWidget(colorSwatchPickerWidget, props, {
    id,
    className,
    ref,
    handlers: handlers({ onValueChange, onValueChangeEnd, onFormatChange }),
  });
});

export type ColorFieldProps = Omit<ColorPickerProps, "swatches" | "eyeDropper" | "fields" | "orientation" | "channel">;

/** Campos del color: formato, canales o hexadecimal, opacidad y el selector del sistema. */
export const ColorField = withRef(function ColorField({
  onValueChange,
  onValueChangeEnd,
  onFormatChange,
  id,
  className,
  ref,
  ...props
}: ColorFieldProps) {
  return useWidget(colorFieldWidget, props, {
    id,
    className,
    ref,
    handlers: handlers({ onValueChange, onValueChangeEnd, onFormatChange }),
  });
});

/** Botón con la muestra y el valor que abre el selector en un popover (cristal elevado). */
export const ColorPickerTrigger = withRef(function ColorPickerTrigger({
  onValueChange,
  onValueChangeEnd,
  onFormatChange,
  id,
  className,
  ref,
  ...props
}: ColorPickerProps) {
  return useWidget(colorTriggerWidget, props, {
    id,
    className,
    ref,
    handlers: handlers({ onValueChange, onValueChangeEnd, onFormatChange }),
  });
});
