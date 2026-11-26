import type { ReactNode } from "react";
import { Icon, type IconName } from "@zuccadev-labs/zuix-zicon/core";
import { ACTIVITY_LABELS, groupByDay, isoOf, relativeText, type ActivityFeedLabels } from "../../core/activity";
import { localize } from "../../core/locale";
import { toInstant } from "../../core/relative";
import { cx } from "../../cx";
import { Avatar } from "../data/Avatar";

export type { ActivityFeedLabels };

export interface ActivityActor {
  name: string;
  avatar?: string;
}

export interface ActivityItem {
  id: string;
  actor: ActivityActor;
  /** Verbo: «closed», «commented on». */
  verb: string;
  /** Objeto de la acción: «#42 Login timeout». */
  object?: string;
  /** Enlace del objeto. */
  href?: string;
  /** Instante (ISO con zona, ms o Date). */
  at: number | string | Date;
  /** Icono en lugar del avatar (eventos del sistema). */
  icon?: IconName;
  tone?: "accent" | "success" | "warning" | "danger" | "info" | "neutral";
  /** Contenido bajo la frase (un comentario, un extracto). */
  detail?: ReactNode;
}

export interface ActivityFeedProps {
  items: readonly ActivityItem[];
  /** Nombre de la región. */
  label?: string;
  groupBy?: "day" | "none";
  /** Hay más entradas: muestra «Load more» (con `onLoadMore`). */
  hasMore?: boolean;
  onLoadMore?: () => void;
  /** Cargando más: el botón queda en espera. */
  loading?: boolean;
  /** Zona IANA para agrupar por día. */
  timeZone?: string;
  /** Momento de referencia (pruebas y capturas); por defecto, ahora. */
  now?: number | string | Date;
  locale?: string;
  labels?: Partial<ActivityFeedLabels>;
  className?: string;
  id?: string;
}

/**
 * Actividad reciente: avatar o icono, «Ana **closed** #42», hora relativa con la absoluta en `<time>`, agrupada por
 * día en la zona de la persona y con «Load more».
 */
export function ActivityFeed({
  items,
  label,
  groupBy = "day",
  hasMore,
  onLoadMore,
  loading,
  timeZone,
  now: nowProp,
  locale,
  labels: labelsProp,
  className,
  id,
}: ActivityFeedProps) {
  const labels = { ...localize("activityFeed", ACTIVITY_LABELS), ...labelsProp };
  const now = toInstant(nowProp ?? null) ?? Date.now();
  const groups = groupBy === "day" ? groupByDay(items, now, timeZone, locale, labels) : [{ key: "all", label: "", items: [...items] }];
  const entry = (item: ActivityItem) => (
    <li key={item.id} className="z-activity__item" data-tone={item.icon ? (item.tone ?? "neutral") : undefined}>
      <span className="z-activity__marker">
        {item.icon ? (
          <span className="z-activity__icon" aria-hidden="true">
            <Icon name={item.icon} size={14} />
          </span>
        ) : (
          <Avatar size="sm" name={item.actor.name} src={item.actor.avatar} alt="" aria-hidden />
        )}
      </span>
      <div className="z-activity__body">
        <p className="z-activity__text">
          <span className="z-activity__actor">{item.actor.name}</span> <span className="z-activity__verb">{item.verb}</span>
          {item.object ? (
            <>
              {" "}
              {item.href ? (
                <a className="z-activity__object" href={item.href}>
                  {item.object}
                </a>
              ) : (
                <span className="z-activity__object">{item.object}</span>
              )}
            </>
          ) : null}
        </p>
        {item.detail ? <div className="z-activity__detail">{item.detail}</div> : null}
      </div>
      <time className="z-activity__time" dateTime={isoOf(item.at)}>
        {relativeText(item.at, now, locale)}
      </time>
    </li>
  );
  return (
    <section id={id} className={cx("z-activity", className)} aria-label={label} aria-busy={loading || undefined}>
      {items.length === 0 ? <p className="z-activity__empty">{labels.empty}</p> : null}
      {groups.map((g) =>
        groupBy === "day" && g.label ? (
          <section key={g.key} className="z-activity__group" aria-label={g.label}>
            <h3 className="z-activity__day">{g.label}</h3>
            <ol className="z-activity__list">{g.items.map(entry)}</ol>
          </section>
        ) : (
          <ol key={g.key} className="z-activity__list">
            {g.items.map(entry)}
          </ol>
        ),
      )}
      {hasMore && onLoadMore ? (
        <button
          type="button"
          className="z-btn z-btn--ghost z-activity__more"
          data-size="sm"
          onClick={onLoadMore}
          aria-disabled={loading || undefined}
        >
          {labels.loadMore}
        </button>
      ) : null}
    </section>
  );
}
