import { cloneElement, type ReactElement } from "react";
import { qrcodeSvg, qrcodeTree, type QRCodeLabels, type QRCodeProps as CoreProps } from "../../core/qr-widget";
import type { QrLevel } from "../../core/qr";
import { cx } from "../../cx";
import { toReact } from "../vnode";

export { qrcodeSvg };
export type { QRCodeLabels, QrLevel };

export interface QRCodeProps extends Omit<CoreProps, "icon"> {
  /** Icono de zicon en el centro (sube la corrección a H). */
  icon?: CoreProps["icon"];
  className?: string;
  id?: string;
}

/**
 * Código QR propio (modo byte, versiones 1–40, corrección L/M/Q/H, máscara de menor penalización) dibujado en SVG,
 * oscuro sobre claro con su zona de silencio. Imagen con nombre; sin estado (vale en un Server Component).
 */
export function QRCode({ className, id, ...props }: QRCodeProps) {
  const el = toReact(qrcodeTree(props)) as ReactElement<{ className?: string; id?: string }>;
  return cloneElement(el, { id, className: cx("z-qrcode", className) });
}
