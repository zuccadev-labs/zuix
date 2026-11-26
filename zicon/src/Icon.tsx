import type { SVGProps } from "react";
import type { CustomIconName } from "./custom";
import type { IconName } from "./names";
import type { IconVariant } from "./types";
import { withRef } from "./react-compat";
import { getIcon } from "./registry";
import { iconFrame, iconParts } from "./svg";

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
  /** Nombre del icono (kebab-case). Ver manifest.json; los propios de la aplicación se declaran en `CustomIcons`. */
  name: IconName | CustomIconName;
  /** `outline` por defecto; `solid` para estados activos o énfasis. */
  variant?: IconVariant;
  /** Lado en px o cualquier longitud CSS. 16 en texto y botones, 20–22 en recuadros, 28 en estados vacíos. */
  size?: number | string;
  /** Si el icono comunica algo por sí solo, su nombre accesible. Sin `label` es decorativo y se oculta. */
  label?: string;
}

const warned = new Set<string>();

/** Icono de la suite. El color se hereda de `currentColor`. */
export const Icon = withRef(function Icon({ name, variant = "outline", size = 16, label, className, ...rest }: IconProps) {
  const def = getIcon(name);
  if (!def && !warned.has(name)) {
    warned.add(name);
    console.warn(
      `[zicon] "${name}" no está registrado. Importa "@zuccadev-labs/zuix-zicon/all" una vez o registra el icono con registerIcons().`,
    );
  }
  const parts = def ? iconParts(name, variant) : [];
  const frame = iconFrame(name);
  // Un nombre accesible puede llegar también por `aria-label` o `aria-labelledby`: entonces el icono no se oculta.
  const named = Boolean(label ?? rest["aria-label"] ?? rest["aria-labelledby"]);
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={frame.viewBox}
      width={size}
      height={size}
      fill="currentColor"
      focusable="false"
      role={named ? "img" : undefined}
      aria-label={label}
      aria-hidden={named ? undefined : true}
      data-icon={name}
      data-variant={variant}
      {...rest}
      className={className ? `z-icon ${className}` : "z-icon"}
    >
      {frame.image ? (
        <image
          href={frame.image}
          x={frame.viewBox.split(/[\s,]+/)[0]}
          y={frame.viewBox.split(/[\s,]+/)[1]}
          width={frame.width}
          height={frame.height}
          preserveAspectRatio="xMidYMid meet"
        />
      ) : null}
      {parts.map((p, i) => (
        <path
          // biome-ignore lint/suspicious/noArrayIndexKey: los trazos de un icono son una lista fija y sin estado, y dos pueden coincidir en `d`; su posición es su identidad.
          key={i}
          fillRule={p.evenodd ? "evenodd" : undefined}
          clipRule={p.evenodd ? "evenodd" : undefined}
          fill={p.fill}
          opacity={p.opacity !== undefined && p.opacity < 1 ? p.opacity : undefined}
          d={p.d}
        />
      ))}
    </svg>
  );
});
