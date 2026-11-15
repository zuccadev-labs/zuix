"use client";
import { Icon } from "@zuccadev-labs/zuix-zicon/core";
import { cx } from "../../cx";

export interface PaginationProps {
  /** Página actual, desde 1. */
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  /** Páginas visibles a cada lado de la actual. */
  siblingCount?: number;
  size?: "sm" | "md";
  label?: string;
  previousLabel?: string;
  nextLabel?: string;
  /** Nombre accesible de cada botón de página. */
  pageLabel?: (page: number) => string;
  className?: string;
}

// Rango con huecos: 1 … 4 5 6 … 20. Un hueco se representa con 0.
function range(page: number, count: number, siblings: number): number[] {
  const slots = siblings * 2 + 5;
  if (count <= slots) return Array.from({ length: count }, (_, i) => i + 1);
  const left = Math.max(page - siblings, 1);
  const right = Math.min(page + siblings, count);
  const gapLeft = left > 2;
  const gapRight = right < count - 1;
  const edge = siblings * 2 + 3;
  if (!gapLeft) return [...Array.from({ length: edge }, (_, i) => i + 1), 0, count];
  if (!gapRight) return [1, 0, ...Array.from({ length: edge }, (_, i) => count - edge + 1 + i)];
  return [1, 0, ...Array.from({ length: right - left + 1 }, (_, i) => left + i), 0, count];
}

export function Pagination({
  page,
  pageCount,
  onPageChange,
  siblingCount = 1,
  size = "md",
  label = "Pagination",
  previousLabel = "Previous page",
  nextLabel = "Next page",
  pageLabel = (n) => `Page ${n}`,
  className,
}: PaginationProps) {
  const count = Math.max(1, Math.floor(pageCount));
  const current = Math.min(Math.max(1, page), count);
  const go = (next: number) => {
    if (next !== current && next >= 1 && next <= count) onPageChange(next);
  };
  return (
    <nav aria-label={label} className={cx("z-pagination", className)} data-size={size}>
      <button type="button" className="z-pagination__btn" aria-label={previousLabel} disabled={current <= 1} onClick={() => go(current - 1)}>
        <Icon name="chevron-left" size={14} />
      </button>
      {range(current, count, Math.max(0, siblingCount)).map((n, i) =>
        n === 0 ? (
          <span key={`gap-${i}`} className="z-pagination__gap" aria-hidden="true">
            …
          </span>
        ) : (
          <button
            key={n}
            type="button"
            className="z-pagination__btn"
            aria-label={pageLabel(n)}
            aria-current={n === current ? "page" : undefined}
            onClick={() => go(n)}
          >
            {n}
          </button>
        ),
      )}
      <button type="button" className="z-pagination__btn" aria-label={nextLabel} disabled={current >= count} onClick={() => go(current + 1)}>
        <Icon name="chevron-right" size={14} />
      </button>
    </nav>
  );
}
