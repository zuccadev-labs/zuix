"use client";
import type { Ref } from "react";
import type { SignaturePoint, SignatureStroke } from "../../core/signature";
import {
  signatureBlob,
  signaturePadWidget,
  signatureValue,
  type SignaturePadLabels,
  type SignaturePadProps as CoreProps,
  type SignatureValue,
} from "../../core/signature-widget";
import { useWidget } from "../agenda/vtree";
import { withRef } from "../../react-compat";

export { signatureBlob, signatureValue };
export type { SignaturePadLabels, SignaturePoint, SignatureStroke, SignatureValue };

export interface SignaturePadProps extends CoreProps {
  /** Tras cada trazo, deshacer, borrar, cambio de modo o al escribir el nombre. */
  onChange?: (value: SignatureValue) => void;
  id?: string;
  className?: string;
  ref?: Ref<HTMLDivElement>;
}

/**
 * Lienzo de firma con el puntero (presión si la hay), deshacer y borrar, y la alternativa accesible de escribir el
 * nombre. La firma se lee con `signatureValue(el)` (SVG incluido) o `signatureBlob(el)` (PNG).
 */
export const SignaturePad = withRef(function SignaturePad({ onChange, id, className, ref, ...props }: SignaturePadProps) {
  return useWidget(signaturePadWidget, props, { id, className, ref, handlers: { change: onChange } });
});
