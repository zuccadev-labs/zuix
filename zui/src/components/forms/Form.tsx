"use client";
import type { FormEvent, FormHTMLAttributes, ReactNode, Ref } from "react";
import { validateForm } from "../../core/validity";
import { cx } from "../../cx";

export interface FormProps extends FormHTMLAttributes<HTMLFormElement> {
  /** Se llama cuando el envío se detiene por errores (tras llevar el foco al primero). */
  onInvalidSubmit?: (event: FormEvent<HTMLFormElement>) => void;
  ref?: Ref<HTMLFormElement>;
  children?: ReactNode;
}

/**
 * Formulario con la validación nativa pintada en sus campos: sin los globos del navegador (`noValidate`), al
 * enviar comprueba los controles, cada `Field` con `validate` muestra su mensaje y el foco va al primer error. Si
 * todo es válido, llama a `onSubmit` como un `<form>` normal.
 */
export function Form({ className, onSubmit, onInvalidSubmit, children, ...rest }: FormProps) {
  return (
    <form
      noValidate
      {...rest}
      className={cx("z-form", className)}
      onSubmit={(event) => {
        if (!validateForm(event.currentTarget)) {
          event.preventDefault();
          onInvalidSubmit?.(event);
          return;
        }
        onSubmit?.(event);
      }}
    >
      {children}
    </form>
  );
}
