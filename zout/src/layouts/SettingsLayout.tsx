import type { ReactNode } from "react";
import { Icon, type IconName } from "@zuccadev-labs/zuix-zicon/core";
import { cx } from "../cx";

export interface SettingsNavItem {
  /** Ancla de la sección (`#id`) o ruta. */
  href: string;
  label: string;
  icon?: IconName;
  /** La sección o página actual. */
  current?: boolean;
}

export interface SettingsLayoutProps {
  title: ReactNode;
  description?: ReactNode;
  /** Navegación de ajustes: enlaces a las secciones o a otras páginas. */
  nav: readonly SettingsNavItem[];
  navLabel?: string;
  /** Hay cambios sin guardar: aparece la barra de guardar. */
  dirty?: boolean;
  /** Botones de la barra de guardar (Cancelar, Guardar). */
  saveBar?: ReactNode;
  /** Texto de la barra de guardar. */
  dirtyLabel?: string;
  /** SettingsSection. */
  children: ReactNode;
  className?: string;
}

/**
 * Página de ajustes: navegación lateral con anclas, secciones (SettingsSection) y una barra de guardar fija al pie
 * cuando hay cambios. En estrecho, la navegación pasa a una tira desplazable arriba.
 */
export function SettingsLayout({
  title,
  description,
  nav,
  navLabel = "Settings",
  dirty,
  saveBar,
  dirtyLabel = "You have unsaved changes",
  children,
  className,
}: SettingsLayoutProps) {
  return (
    <div className={cx("z-settings-layout", className)} data-dirty={dirty ? "" : undefined}>
      <div className="z-settings-layout__grid">
        <header className="z-settings-layout__header">
          <h1 className="z-settings-layout__title">{title}</h1>
          {description ? <p className="z-settings-layout__description">{description}</p> : null}
        </header>
        <nav className="z-settings-layout__nav" aria-label={navLabel}>
          <ul className="z-settings-layout__links">
            {nav.map((item) => (
              <li key={item.href}>
                <a className="z-settings-layout__link" href={item.href} aria-current={item.current ? "page" : undefined}>
                  {item.icon ? <Icon name={item.icon} size={16} /> : null}
                  <span>{item.label}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="z-settings-layout__content">{children}</div>
        {dirty && saveBar ? (
          <section className="z-settings-layout__savebar z-liquid" aria-label={dirtyLabel}>
            <span className="z-settings-layout__dirty" role="status">
              <Icon name="exclamation-circle" size={16} />
              {dirtyLabel}
            </span>
            <div className="z-settings-layout__save-actions">{saveBar}</div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
