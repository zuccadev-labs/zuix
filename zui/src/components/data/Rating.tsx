"use client";
import { useState, type KeyboardEvent, type ReactNode } from "react";
import { Icon } from "@zuccadev-labs/zuix-zicon/core";
import { cx } from "../../cx";

const STAR_PX = { sm: 14, md: 18, lg: 24 } as const;

export interface RatingProps {
  value: number;
  max?: number;
  size?: "sm" | "md" | "lg";
  /** Muestra el valor numérico junto a las estrellas. */
  showValue?: boolean;
  /** Texto extra tras el valor (por ejemplo, número de opiniones). */
  caption?: ReactNode;
  /** Con `onChange` las estrellas pasan a ser un grupo de opciones. */
  onChange?: (value: number) => void;
  disabled?: boolean;
  /** Nombre accesible del conjunto. */
  label?: string;
  /** Nombre accesible de cada estrella o del valor mostrado. */
  valueLabel?: (value: number, max: number) => string;
  /** Con `onChange`, medias estrellas: cada estrella tiene dos mitades y las flechas avanzan de 0,5 en 0,5. */
  allowHalf?: boolean;
  className?: string;
}

/** Valoración con estrellas: lectura (admite decimales) o entrada. */
export function Rating({
  value,
  max = 5,
  size = "md",
  showValue,
  caption,
  onChange,
  disabled,
  label = "Rating",
  valueLabel = (v, m) => `${v} out of ${m}`,
  allowHalf,
  className,
}: RatingProps) {
  const [hover, setHover] = useState<number | null>(null);
  const px = STAR_PX[size];
  const stars = Array.from({ length: max }, (_, index) => index + 1);
  const tail = (
    <>
      {showValue ? <span className="z-rating__value">{Number.isInteger(value) ? value : value.toFixed(1)}</span> : null}
      {caption ? <span className="z-rating__caption">{caption}</span> : null}
    </>
  );

  if (!onChange) {
    const percent = Math.max(0, Math.min(100, (value / max) * 100));
    return (
      <span className={cx("z-rating", className)} data-size={size}>
        <span className="z-rating__stars" role="img" aria-label={`${label}: ${valueLabel(value, max)}`}>
          <span className="z-rating__layer">
            {stars.map((star) => (
              <Icon key={star} name="star" variant="outline" size={px} />
            ))}
          </span>
          {/* Capa rellena recortada al porcentaje del valor. */}
          <span className="z-rating__layer z-rating__layer--filled" style={{ width: `${percent}%` }}>
            {stars.map((star) => (
              <Icon key={star} name="star" variant="solid" size={px} />
            ))}
          </span>
        </span>
        {tail}
      </span>
    );
  }

  const shown = hover ?? value;
  // Flechas como en un grupo de radio: mueven y eligen.
  const onKeyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
    // En RTL las estrellas crecen hacia la izquierda: la flecha izquierda sube.
    const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
    const forward = rtl ? "ArrowLeft" : "ArrowRight";
    const backward = rtl ? "ArrowRight" : "ArrowLeft";
    const step = event.key === forward || event.key === "ArrowUp" ? 1 : event.key === backward || event.key === "ArrowDown" ? -1 : 0;
    if (!step && event.key !== "Home" && event.key !== "End") return;
    event.preventDefault();
    const unit = allowHalf ? 0.5 : 1;
    const base = Math.round(value / unit) * unit;
    const next = event.key === "Home" ? unit : event.key === "End" ? max : Math.max(unit, Math.min(max, base + step * unit));
    onChange(next);
    event.currentTarget.querySelector<HTMLButtonElement>(`[data-star="${next}"]`)?.focus();
  };
  if (allowHalf) {
    const chosen = Math.round(Math.min(value, max) * 2) / 2;
    const half = (star: number, side: "start" | "end") => {
      const n = side === "start" ? star - 0.5 : star;
      const checked = chosen === n;
      return (
        <button
          type="button"
          role="radio"
          className="z-rating__star"
          data-half={side}
          data-star={n}
          data-filled={n <= shown || undefined}
          aria-checked={checked}
          aria-label={valueLabel(n, max)}
          tabIndex={checked || (chosen < 0.5 && n === 0.5) ? 0 : -1}
          disabled={disabled}
          onClick={() => onChange(n)}
          onMouseEnter={() => setHover(n)}
        />
      );
    };
    return (
      <span className={cx("z-rating", className)} data-size={size} data-interactive data-half data-disabled={disabled || undefined}>
        <span className="z-rating__stars" role="radiogroup" aria-label={label} onKeyDown={onKeyDown} onMouseLeave={() => setHover(null)}>
          {stars.map((star) => (
            <span key={star} className="z-rating__cell">
              <span className="z-rating__glyph" aria-hidden="true">
                <Icon name="star" variant="outline" size={px} />
              </span>
              <span className="z-rating__glyph z-rating__glyph--filled" aria-hidden="true">
                <Icon name="star" variant="solid" size={px} />
              </span>
              {half(star, "start")}
              {half(star, "end")}
            </span>
          ))}
        </span>
        {tail}
      </span>
    );
  }
  return (
    <span className={cx("z-rating", className)} data-size={size} data-interactive data-disabled={disabled || undefined}>
      <span className="z-rating__stars" role="radiogroup" aria-label={label} onKeyDown={onKeyDown} onMouseLeave={() => setHover(null)}>
        {stars.map((star) => {
          const checked = Math.round(Math.min(value, max)) === star;
          return (
            <button
              key={star}
              type="button"
              role="radio"
              className="z-rating__star"
              data-star={star}
              data-filled={star <= shown || undefined}
              aria-checked={checked}
              aria-label={valueLabel(star, max)}
              tabIndex={checked || (value < 1 && star === 1) ? 0 : -1}
              disabled={disabled}
              onClick={() => onChange(star)}
              onMouseEnter={() => setHover(star)}
            >
              <Icon name="star" variant={star <= shown ? "solid" : "outline"} size={px} />
            </button>
          );
        })}
      </span>
      {tail}
    </span>
  );
}
