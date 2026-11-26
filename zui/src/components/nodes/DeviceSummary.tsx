import type { HTMLAttributes, ReactNode, Ref } from "react";
import { Icon, type IconName } from "@zuccadev-labs/zuix-zicon/core";
import { cx } from "../../cx";
import { withRef } from "../../react-compat";
import { Redact } from "./Redact";

export interface DeviceSummaryProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  /** Modelo o nombre completo del equipo. */
  title: ReactNode;
  /** Icono de zicon (o uno propio de la aplicación). */
  icon?: IconName;
  /** Imagen o logotipo propio en lugar del icono. */
  media?: ReactNode;
  /** Direcciones IP, separadas por « / » si son varias. Se enmascaran con el interruptor global. */
  ip?: string;
  /** Nombre de host. Los nombres públicos se enmascaran; los internos (`.internal`, `.lan`…) no. */
  hostname?: string;
  /** Líneas de detalle (sistema y versión, papel). */
  meta?: ReactNode | ReactNode[];
  /** Tono del icono. */
  tone?: "accent" | "success" | "warning" | "danger" | "info" | "neutral";
  ref?: Ref<HTMLDivElement>;
}

/**
 * Resumen de un equipo: icono o logotipo, modelo, dirección e host (en monoespaciada, enmascarables) y líneas de
 * detalle. Es el encabezado de una tarjeta de diagrama («MikroTik CRS310 · 10.0.99.2 · switch.internal · RouterOS 7»).
 */
export const DeviceSummary = withRef(function DeviceSummary({
  title,
  icon,
  media,
  ip,
  hostname,
  meta,
  tone = "neutral",
  className,
  ref,
  ...rest
}: DeviceSummaryProps) {
  const lines = meta === undefined || meta === null ? [] : Array.isArray(meta) ? meta : [meta];
  return (
    <div {...rest} ref={ref} className={cx("z-device", className)} data-tone={tone !== "neutral" ? tone : undefined}>
      {media || icon ? (
        <span className="z-device__media" aria-hidden="true">
          {media ?? (icon ? <Icon name={icon} size={22} /> : null)}
        </span>
      ) : null}
      <div className="z-device__text">
        <span className="z-device__title">{title}</span>
        {ip || hostname ? (
          <span className="z-device__address">
            {ip ? (
              <span className="z-device__ip">
                <Redact kind="ip">{ip}</Redact>
              </span>
            ) : null}
            {ip && hostname ? (
              <span className="z-device__sep" aria-hidden="true">
                {" "}
                ·{" "}
              </span>
            ) : null}
            {hostname ? (
              <span className="z-device__host">
                <Redact kind="domain">{hostname}</Redact>
              </span>
            ) : null}
          </span>
        ) : null}
        {lines.map((line, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: líneas fijas sin estado, en el orden en que llegan.
          <span key={i} className="z-device__meta">
            {line}
          </span>
        ))}
      </div>
    </div>
  );
});
