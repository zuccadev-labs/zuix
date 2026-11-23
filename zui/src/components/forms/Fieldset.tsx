import type { FieldsetHTMLAttributes, HTMLAttributes, ReactNode, Ref } from "react";
import { cx } from "../../cx";
import { withRef } from "../../react-compat";

export interface FieldsetProps extends Omit<FieldsetHTMLAttributes<HTMLFieldSetElement>, "title"> {
  /** Título del grupo (`<legend>`, primer hijo): nombra el grupo para los lectores de pantalla. */
  legend: ReactNode;
  /** Texto bajo el título. */
  description?: ReactNode;
  /** `plain` sin recuadro; `card` en un recuadro de superficie. */
  variant?: "plain" | "card";
  ref?: Ref<HTMLFieldSetElement>;
  children?: ReactNode;
}

/**
 * Grupo de controles relacionados con su título (`<fieldset>` y `<legend>`). `disabled` deshabilita de una vez
 * todos los controles nativos que contiene (también los botones de Checkbox, Switch, Select…).
 */
export const Fieldset = withRef(function Fieldset({ legend, description, variant = "plain", className, children, ...rest }: FieldsetProps) {
  return (
    <fieldset {...rest} className={cx("z-fieldset", className)} data-variant={variant}>
      <legend className="z-fieldset__legend">{legend}</legend>
      {description ? <p className="z-fieldset__description">{description}</p> : null}
      <div className="z-fieldset__body">{children}</div>
    </fieldset>
  );
});

export interface FieldGroupProps extends HTMLAttributes<HTMLDivElement> {
  /** `vertical` apila; `horizontal` reparte en columnas que pasan a otra fila si no caben. */
  orientation?: "vertical" | "horizontal";
  ref?: Ref<HTMLDivElement>;
  children?: ReactNode;
}

/** Disposición de varios `Field` con el ritmo del estándar (más aire entre campos que entre etiqueta y control). */
export const FieldGroup = withRef(function FieldGroup({ orientation = "vertical", className, children, ...rest }: FieldGroupProps) {
  return (
    <div {...rest} className={cx("z-field-group", className)} data-orientation={orientation}>
      {children}
    </div>
  );
});
