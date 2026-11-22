import type { ReactNode } from "react";
import { cx } from "../cx";

export interface AuthLayoutProps {
  title: ReactNode;
  description?: ReactNode;
  /** Marca sobre el título (logo y nombre). */
  brand?: ReactNode;
  /** `centered` tarjeta de cristal sobre el lienzo; `split` imagen o marca a un lado y el formulario al otro. */
  variant?: "centered" | "split";
  /** Lado de imagen (`split`): una imagen, una cita, una ilustración. */
  media?: ReactNode;
  /** Bajo el formulario: «¿No tienes cuenta? Regístrate». */
  footer?: ReactNode;
  /** Enlaces legales al pie de la página. */
  legal?: ReactNode;
  /** El formulario. */
  children: ReactNode;
  className?: string;
}

/**
 * Página de acceso (entrar, registrarse, recuperar): tarjeta de cristal centrada sobre el lienzo o dividida con un
 * lado de imagen. Es la región principal con un h1; en móvil solo queda el formulario.
 */
export function AuthLayout({
  title,
  description,
  brand,
  variant = "centered",
  media,
  footer,
  legal,
  children,
  className,
}: AuthLayoutProps) {
  return (
    <main className={cx("z-auth-layout", className)} data-variant={variant}>
      <div className="z-auth-layout__grid">
        {variant === "split" && media ? (
          <div className="z-auth-layout__media" aria-hidden="true">
            {media}
          </div>
        ) : null}
        <div className="z-auth-layout__stage">
          <div className="z-auth-layout__card z-liquid">
            {brand ? <div className="z-auth-layout__brand">{brand}</div> : null}
            <div className="z-auth-layout__head">
              <h1 className="z-auth-layout__title">{title}</h1>
              {description ? <p className="z-auth-layout__description">{description}</p> : null}
            </div>
            <div className="z-auth-layout__body">{children}</div>
            {footer ? <div className="z-auth-layout__footer">{footer}</div> : null}
          </div>
          {legal ? <footer className="z-auth-layout__legal">{legal}</footer> : null}
        </div>
      </div>
    </main>
  );
}
