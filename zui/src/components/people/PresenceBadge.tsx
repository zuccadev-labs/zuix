import { Icon, type IconName } from "@zuccadev-labs/zuix-zicon/core";
import { PRESENCE_ICON, presenceOf, presenceText, type PresenceLabels, type PresenceStatus } from "../../core/user-presence";
import { cx } from "../../cx";

export type { PresenceLabels, PresenceStatus };

export interface PresenceBadgeProps {
  status: PresenceStatus;
  /** Última vez conectada (ISO, ms o Date): con `offline` o `away` añade «Last seen …». */
  lastSeen?: number | string | Date;
  /** Texto visible junto al punto; sin él, el texto queda para el lector. */
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
  /** Momento de referencia para «Last seen» (pruebas y capturas). */
  now?: number;
  locale?: string;
  labels?: Partial<PresenceLabels>;
  className?: string;
  id?: string;
}

/**
 * Presencia de una persona: disponible, ausente, ocupada, no molestar, desconectada o fuera de la oficina. Cada estado
 * tiene su forma (marca, reloj, punto lleno, raya, aspa, flecha) y su texto; nunca solo un color.
 */
export function PresenceBadge({ status, lastSeen, showLabel, size = "md", now, locale, labels, className, id }: PresenceBadgeProps) {
  const s = presenceOf(status);
  const glyph = PRESENCE_ICON[s];
  const text = presenceText(s, { lastSeen, now, locale, labels });
  return (
    <span id={id} className={cx("z-presence-badge", className)} data-status={s} data-size={size}>
      <span className="z-presence" data-status={s} data-size={size} aria-hidden="true">
        {glyph ? <Icon name={glyph as IconName} size={size === "lg" ? 10 : 8} /> : null}
      </span>
      <span className={showLabel ? "z-presence-badge__label" : "z-sr-only"}>{text}</span>
    </span>
  );
}
