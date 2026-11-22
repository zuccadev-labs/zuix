import { cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { Icon } from "@zuccadev-labs/zuix-zicon/core";
import { cx } from "../../cx";

export interface SettingsSectionProps {
  title: string;
  description?: ReactNode;
  /** Ancla de la sección (la navegación de SettingsLayout enlaza a ella). */
  id?: string;
  /** Acciones al pie (guardar, restablecer). */
  footer?: ReactNode;
  /** `danger` para la zona de borrar la cuenta. */
  tone?: "default" | "danger";
  headingLevel?: 2 | 3;
  className?: string;
  children: ReactNode;
}

/** Sección de ajustes: título, descripción y filas (SettingRow) en una superficie, con pie opcional. */
export function SettingsSection({
  title,
  description,
  id,
  footer,
  tone = "default",
  headingLevel = 2,
  className,
  children,
}: SettingsSectionProps) {
  const H = `h${headingLevel}` as "h2";
  const headingId = id ? `${id}-title` : undefined;
  return (
    <section
      id={id}
      className={cx("z-settings-section", className)}
      data-tone={tone === "danger" ? "danger" : undefined}
      aria-labelledby={headingId}
    >
      <div className="z-settings-section__head">
        <H className="z-settings-section__title" id={headingId}>
          {title}
        </H>
        {description ? <p className="z-settings-section__description">{description}</p> : null}
      </div>
      <div className="z-settings-section__body z-solid">{children}</div>
      {footer ? <div className="z-settings-section__footer">{footer}</div> : null}
    </section>
  );
}

export interface SettingRowLabels {
  saving: string;
  saved: string;
  error: string;
}

const SETTING_ROW_LABELS: SettingRowLabels = { saving: "Saving…", saved: "Saved", error: "Couldn't save" };

export interface SettingRowProps {
  label: ReactNode;
  description?: ReactNode;
  /** El control (Switch, Select, botón). Recibe `aria-describedby` con la descripción. */
  control: ReactNode;
  /** Id del control: la etiqueta es un `<label for>`. Sin él, la etiqueta es texto y el control se nombra solo. */
  htmlFor?: string;
  /** Estado del guardado de esta fila; «Saved» se anuncia una vez. */
  status?: "saving" | "saved" | "error";
  /** Texto del error (con `status="error"`). */
  error?: string;
  /** Acción destructiva (borrar, salir del equipo). */
  danger?: boolean;
  /** Control bajo el texto en vez de a su lado (selectores anchos). */
  stacked?: boolean;
  labels?: Partial<SettingRowLabels>;
  className?: string;
  id?: string;
}

/** Fila de ajuste: etiqueta unida al control, descripción por `aria-describedby`, control y estado de guardado. */
export function SettingRow({
  label,
  description,
  control,
  htmlFor,
  status,
  error,
  danger,
  stacked,
  labels: labelsProp,
  className,
  id,
}: SettingRowProps) {
  const labels = { ...SETTING_ROW_LABELS, ...labelsProp };
  const base = htmlFor ?? id;
  const descId = description && base ? `${base}-description` : undefined;
  const wired =
    descId && isValidElement(control)
      ? cloneElement(control as ReactElement<{ "aria-describedby"?: string }>, {
          "aria-describedby": [(control.props as { "aria-describedby"?: string })["aria-describedby"], descId].filter(Boolean).join(" "),
        })
      : control;
  return (
    <div id={id} className={cx("z-setting-row", className)} data-danger={danger ? "" : undefined} data-stacked={stacked ? "" : undefined}>
      <div className="z-setting-row__text">
        {htmlFor ? (
          <label className="z-setting-row__label" htmlFor={htmlFor}>
            {label}
          </label>
        ) : (
          <span className="z-setting-row__label">{label}</span>
        )}
        {description ? (
          <p className="z-setting-row__description" id={descId}>
            {description}
          </p>
        ) : null}
      </div>
      <div className="z-setting-row__control">
        {wired}
        <span className="z-setting-row__status" role="status" data-status={status}>
          {status === "saved" ? (
            <>
              <Icon name="check" size={14} />
              {labels.saved}
            </>
          ) : status === "saving" ? (
            labels.saving
          ) : status === "error" ? (
            <>
              <Icon name="exclamation-circle" size={14} />
              {error ?? labels.error}
            </>
          ) : null}
        </span>
      </div>
    </div>
  );
}
