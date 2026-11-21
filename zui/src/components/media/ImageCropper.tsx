"use client";
import type { Ref } from "react";
import type { Crop } from "../../core/crop";
import { imageCropperWidget, type ImageCropperLabels, type ImageCropperProps as CoreProps } from "../../core/cropper-widget";
import { useWidget } from "../agenda/vtree";

export type { Crop, ImageCropperLabels };

/** Recorte en píxeles enteros de la imagen original. */
export interface PixelCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ImageCropperProps extends CoreProps {
  /** Cada cambio del recorte (en fracciones y en píxeles de la imagen original). */
  onCropChange?: (crop: Crop, pixels: PixelCrop) => void;
  /** Al soltar el puntero o tras una tecla. */
  onCropChangeEnd?: (crop: Crop, pixels: PixelCrop) => void;
  /** La imagen cargó: tamaño natural conocido y recorte inicial colocado. */
  onImageLoad?: (crop: Crop, pixels: PixelCrop) => void;
  id?: string;
  className?: string;
  ref?: Ref<HTMLDivElement>;
}

type Detail = { crop: Crop; pixels: PixelCrop };

/**
 * Recortador de imagen: área que se mueve y se redimensiona (ocho asas), relación de aspecto fija u opcional, forma
 * rectangular o circular y teclado. La salida se dibuja con `cropImage(img, crop)` o `cropImageBlob(img, crop)`.
 */
export function ImageCropper({ onCropChange, onCropChangeEnd, onImageLoad, id, className, ref, ...props }: ImageCropperProps) {
  return useWidget(imageCropperWidget, props, {
    id,
    className,
    ref,
    handlers: {
      change: onCropChange ? (d: Detail) => onCropChange(d.crop, d.pixels) : undefined,
      "change-end": onCropChangeEnd ? (d: Detail) => onCropChangeEnd(d.crop, d.pixels) : undefined,
      load: onImageLoad ? (d: Detail) => onImageLoad(d.crop, d.pixels) : undefined,
    },
  });
}
