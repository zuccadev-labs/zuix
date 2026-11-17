import type { SVGProps } from "react";
import type { IconName } from "./names";
import type { IconVariant } from "./types";
import { getIcon } from "./registry";

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
  /** Nombre del icono (kebab-case). Ver manifest.json. */
  name: IconName;
  /** `outline` por defecto; `solid` para estados activos o énfasis. */
  variant?: IconVariant;
  /** Lado en px o cualquier longitud CSS. 16 en texto y botones, 20–22 en recuadros, 28 en estados vacíos. */
  size?: number | string;
  /** Si el icono comunica algo por sí solo, su nombre accesible. Sin `label` es decorativo y se oculta. */
  label?: string;
}

const warned = new Set<string>();

/** Icono de la suite. El color se hereda de `currentColor`. */
export function Icon({ name, variant = "outline", size = 16, label, className, ...rest }: IconProps) {
  const def = getIcon(name);
  if (!def && !warned.has(name)) {
    warned.add(name);
    console.warn(`[zicon] "${name}" no está registrado. Importa "@zuccadev-labs/zuix-zicon/all" una vez o registra el icono con registerIcons().`);
  }
  const paths = def ? (variant === "solid" ? def.s : def.o) : [];
  // Un nombre accesible puede llegar también por `aria-label` o `aria-labelledby`: entonces el icono no se oculta.
  const named = Boolean(label ?? rest["aria-label"] ?? rest["aria-labelledby"]);
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
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
      {paths.map((d, i) =>
        d.startsWith("E:") ? <path key={i} fillRule="evenodd" clipRule="evenodd" d={d.slice(2)} /> : <path key={i} d={d} />,
      )}
    </svg>
  );
}
