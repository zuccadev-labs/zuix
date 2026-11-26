import { localize } from "../../core/locale";
import type { CSSProperties, HTMLAttributes, ReactNode, Ref } from "react";
import { Icon } from "@zuccadev-labs/zuix-zicon/core";
import { fill } from "../../core/vnode";
import { ratingAverage, ratingDistribution, ratingTotal, type RatingCounts } from "../../core/reviews";
import { REVIEW_SUMMARY_LABELS, type ReviewSummaryLabels } from "../../core/reviews";
import { cx } from "../../cx";
import { Rating } from "./Rating";
import { withRef } from "../../react-compat";

export type { RatingCounts, ReviewSummaryLabels };
export { REVIEW_SUMMARY_LABELS };

export interface ReviewSummaryProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  /** Recuentos por estrella: `{ 5: 873, 4: 241, 3: 90, 2: 31, 1: 49 }` (o una lista con 1 estrella primero). */
  distribution: RatingCounts;
  /** Media propia (ponderada en el servidor). Por defecto, la de la distribución con un decimal. */
  average?: number;
  /** Total propio (incluye opiniones sin estrellas). Por defecto, la suma de la distribución. */
  count?: number;
  max?: number;
  locale?: string;
  /** Título sobre el resumen. */
  title?: ReactNode;
  labels?: Partial<ReviewSummaryLabels>;
  ref?: Ref<HTMLDivElement>;
}

/** Resumen de opiniones: media, estrellas, número de valoraciones y una barra por estrella con su texto para lectores. */
export const ReviewSummary = withRef(function ReviewSummary({
  distribution,
  average,
  count,
  max = 5,
  locale,
  title,
  labels,
  className,
  ref,
  ...rest
}: ReviewSummaryProps) {
  const l = { ...localize("reviewSummary", REVIEW_SUMMARY_LABELS), ...labels };
  const rows = ratingDistribution(distribution, max);
  const total = count ?? ratingTotal(rows);
  const mean = average ?? ratingAverage(rows);
  const number = new Intl.NumberFormat(locale);
  const one = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const percent = new Intl.NumberFormat(locale, { style: "percent" });
  return (
    <div {...rest} ref={ref} className={cx("z-review-summary", className)} data-empty={total ? undefined : ""}>
      {title ? <h3 className="z-review-summary__title">{title}</h3> : null}
      <div className="z-review-summary__body">
        <div className="z-review-summary__score">
          <span className="z-review-summary__average" aria-hidden="true">
            {total ? one.format(mean) : "–"}
          </span>
          <Rating
            value={total ? mean : 0}
            max={max}
            label={l.rating}
            valueLabel={(v, m) => fill(l.outOf, { value: one.format(v), max: m })}
          />
          <span className="z-review-summary__count">
            {total ? (total === 1 ? l.countOne : fill(l.count, { count: number.format(total) })) : l.empty}
          </span>
        </div>
        <ul className="z-review-summary__bars" aria-label={l.distribution}>
          {rows.map((row) => (
            <li
              key={row.star}
              className="z-review-summary__row"
              style={{ "--z-review-share": `${(row.share * 100).toFixed(2)}%` } as CSSProperties}
            >
              <span className="z-review-summary__star" aria-hidden="true">
                {number.format(row.star)}
                <Icon name="star" variant="solid" size={12} />
              </span>
              <span className="z-review-summary__track" aria-hidden="true">
                <span className="z-review-summary__fill" />
              </span>
              <span className="z-review-summary__share" aria-hidden="true">
                {percent.format(row.percent / 100)}
              </span>
              <span className="z-sr-only">
                {fill(row.star === 1 ? l.barOne : l.bar, {
                  star: number.format(row.star),
                  count: number.format(row.count),
                  percent: percent.format(row.percent / 100),
                })}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
});
