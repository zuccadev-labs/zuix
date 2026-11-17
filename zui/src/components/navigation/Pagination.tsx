"use client";
import { Icon } from "@zuccadev-labs/zuix-zicon/core";
import { clampPage, pageRange, pageTotal } from "../../core/pagination";
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
  // Un total no numérico cuenta como una página; la página se redondea y se acota, igual que `setPage` en el modo DOM.
  const count = pageTotal(pageCount);
  const current = clampPage(page, count);
  const go = (next: number) => {
    if (next !== current && next >= 1 && next <= count) onPageChange(next);
  };
  // Un hueco se identifica por la página que lo precede: es el mismo hueco mientras siga en el mismo punto de la serie.
  const entries: Array<{ key: string; n: number }> = [];
  for (const n of pageRange(current, count, Math.max(0, Math.floor(siblingCount) || 0))) {
    entries.push({ key: n === 0 ? `gap-after-${entries[entries.length - 1]?.n ?? 0}` : `page-${n}`, n });
  }
  return (
    <nav aria-label={label} className={cx("z-pagination", className)} data-size={size}>
      <button
        type="button"
        className="z-pagination__btn"
        aria-label={previousLabel}
        disabled={current <= 1}
        onClick={() => go(current - 1)}
      >
        <Icon name="chevron-left" size={14} />
      </button>
      {entries.map(({ key, n }) =>
        n === 0 ? (
          <span key={key} className="z-pagination__gap" aria-hidden="true">
            …
          </span>
        ) : (
          <button
            key={key}
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
      <button
        type="button"
        className="z-pagination__btn"
        aria-label={nextLabel}
        disabled={current >= count}
        onClick={() => go(current + 1)}
      >
        <Icon name="chevron-right" size={14} />
      </button>
    </nav>
  );
}
