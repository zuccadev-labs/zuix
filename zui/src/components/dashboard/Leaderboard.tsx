import type { CSSProperties } from "react";
import { competitionRanks, barFractions, formatValue } from "../../core/metric";
import { cx } from "../../cx";
import { Avatar } from "../data/Avatar";
import { DeltaBadge } from "./DeltaBadge";

export interface LeaderboardEntry {
  id: string;
  name: string;
  /** Línea secundaria (equipo, rol). */
  secondary?: string;
  avatar?: string;
  value: number;
  /** Valor del periodo anterior: muestra la variación. */
  previous?: number;
  href?: string;
}

export interface LeaderboardProps {
  entries: readonly LeaderboardEntry[];
  /** Nombre de la tabla. */
  label: string;
  /** Lo que es bueno: que suba (por defecto) o que baje. */
  positive?: "up" | "down";
  /** Muestra solo los N primeros. */
  limit?: number;
  /** Destaca una fila (la de quien mira). */
  highlight?: string;
  valueFormat?: Intl.NumberFormatOptions;
  locale?: string;
  /** Texto del rango para el lector: «Rank {rank}». */
  rankLabel?: string;
  className?: string;
  id?: string;
}

/** Clasificación sencilla: rango con empates, persona, valor con barra y variación. Una lista ordenada, no una tabla. */
export function Leaderboard({
  entries,
  label,
  positive = "up",
  limit,
  highlight,
  valueFormat,
  locale,
  rankLabel = "Rank {rank}",
  className,
  id,
}: LeaderboardProps) {
  const sorted = [...entries]
    .sort((a, b) => (positive === "down" ? a.value - b.value : b.value - a.value))
    .slice(0, limit ?? entries.length);
  const ranks = competitionRanks(sorted.map((e) => e.value));
  const bars = barFractions(sorted.map((e) => e.value));
  return (
    <ol id={id} className={cx("z-leaderboard", className)} aria-label={label}>
      {sorted.map((e, i) => (
        <li
          key={e.id}
          className="z-leaderboard__row"
          data-rank={ranks[i]! <= 3 ? ranks[i] : undefined}
          data-current={e.id === highlight ? "" : undefined}
          aria-current={e.id === highlight ? "true" : undefined}
          style={{ "--z-bar": Math.round((bars[i] ?? 0) * 1000) / 1000 } as CSSProperties}
        >
          <span className="z-leaderboard__rank">
            <span className="z-sr-only">{rankLabel.replace("{rank}", String(ranks[i]))}</span>
            <span aria-hidden="true">{ranks[i]}</span>
          </span>
          <Avatar size="sm" name={e.name} src={e.avatar} alt="" aria-hidden />
          <span className="z-leaderboard__who">
            {e.href ? (
              <a className="z-leaderboard__name" href={e.href}>
                {e.name}
              </a>
            ) : (
              <span className="z-leaderboard__name">{e.name}</span>
            )}
            {e.secondary ? <span className="z-leaderboard__secondary">{e.secondary}</span> : null}
          </span>
          <span className="z-leaderboard__value">
            <span className="z-leaderboard__number">{formatValue(e.value, locale, valueFormat)}</span>
            <span className="z-leaderboard__bar" aria-hidden="true" />
          </span>
          {typeof e.previous === "number" ? (
            <DeltaBadge size="sm" variant="plain" value={e.value} previous={e.previous} positive={positive} locale={locale} />
          ) : (
            <span className="z-leaderboard__delta-gap" aria-hidden="true" />
          )}
        </li>
      ))}
    </ol>
  );
}
