"use client";
import { useLocale } from "../../locale";
import { useEffect, useId, useRef, useState, type HTMLAttributes, type ReactNode, type Ref } from "react";
import { formatDate } from "../../core/format";
import { excerpt, foldedValue } from "../../core/reviews";
import { fill } from "../../core/vnode";
import { useIsoLayoutEffect, useLatest } from "../../primitives/hooks";
import { REVIEW_CARD_LABELS, type ReviewCardLabels } from "../../core/reviews";
import { cx } from "../../cx";
import { useMergedRef } from "../../refs";
import { Persona } from "../people/Persona";
import { Rating } from "./Rating";
import { withRef } from "../../react-compat";

export type { ReviewCardLabels };
export { REVIEW_CARD_LABELS };

export interface ReviewPhoto {
  src: string;
  /** Texto alternativo: lo que se ve en la foto. */
  alt: string;
}

export interface ReviewReply {
  text: string;
  /** Quien responde. Sin él, «Response from the owner». */
  author?: string;
  date?: Date | number | string;
}

export interface ReviewCardProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  author: { name: string; avatar?: string; secondary?: ReactNode };
  rating: number;
  max?: number;
  /** Fecha de la opinión (ISO civil, instante o Date). */
  date?: Date | number | string;
  locale?: string;
  title?: ReactNode;
  /** Nivel del título. Por defecto 3. */
  headingLevel?: 2 | 3 | 4 | 5 | 6;
  text: string;
  /** Caracteres visibles antes de plegar (por defecto 280; 0 no pliega). */
  collapseAt?: number;
  /** Abierto al empezar. */
  defaultExpanded?: boolean;
  photos?: ReadonlyArray<ReviewPhoto>;
  /** Con él cada foto es un botón (abrir un Lightbox, por ejemplo). */
  onPhotoSelect?: (index: number) => void;
  reply?: ReviewReply;
  labels?: Partial<ReviewCardLabels>;
  ref?: Ref<HTMLElement>;
}

/**
 * Opinión: autor (Persona), valoración con estrellas de solo lectura, fecha, texto largo plegable (la búsqueda en la
 * página encuentra y abre lo plegado), fotos y respuesta del propietario.
 */
export const ReviewCard = withRef(function ReviewCard({
  author,
  rating,
  max = 5,
  date,
  locale,
  title,
  headingLevel = 3,
  text,
  collapseAt = 280,
  defaultExpanded = false,
  photos,
  onPhotoSelect,
  reply,
  labels,
  className,
  id: idProp,
  ref,
  ...rest
}: ReviewCardProps) {
  const l = { ...useLocale().messages("reviewCard", REVIEW_CARD_LABELS), ...labels };
  const auto = useId().replace(/:/g, "");
  const id = idProp ?? `z-review-${auto}`;
  const [open, setOpen] = useState(defaultExpanded);
  const { head, tail } = excerpt(text, collapseAt);
  const restRef = useRef<HTMLSpanElement | null>(null);
  const root = useRef<HTMLElement | null>(null);
  const setRoot = useMergedRef(root, ref);
  const latest = useLatest(setOpen);
  const when = date === undefined ? null : formatDate(date, locale);
  const replyWhen = reply?.date === undefined ? null : formatDate(reply.date, locale);
  const Heading = `h${headingLevel}` as "h3";

  // React solo escribe `hidden` como booleano: plegado pasa a `until-found` (Buscar en la página lo encuentra y abre).
  useIsoLayoutEffect(() => {
    if (!open && restRef.current) restRef.current.setAttribute("hidden", foldedValue());
  }, [open, tail]);
  // `beforematch` burbujea: se escucha en el artículo, que existe siempre (el resto aparece y desaparece con el texto).
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const reveal = (event: Event) => {
      if ((event.target as Element).matches?.(".z-review-card__rest")) latest.current(true);
    };
    el.addEventListener("beforematch", reveal);
    return () => el.removeEventListener("beforematch", reveal);
  }, [latest]);

  return (
    <article
      {...rest}
      id={idProp}
      ref={setRoot}
      className={cx("z-review-card", className)}
      data-state={tail ? (open ? "open" : "closed") : undefined}
      data-read-more={tail ? l.readMore : undefined}
      data-read-less={tail ? l.readLess : undefined}
    >
      <header className="z-review-card__head">
        <Persona name={author.name} avatar={author.avatar} secondary={author.secondary} size="sm" />
        <div className="z-review-card__meta">
          <Rating value={rating} max={max} size="sm" label={l.rating} valueLabel={(value, m) => fill(l.outOf, { value, max: m })} />
          {when?.text ? (
            <time className="z-review-card__date" dateTime={when.datetime}>
              {when.text}
            </time>
          ) : null}
        </div>
      </header>
      {title ? <Heading className="z-review-card__title">{title}</Heading> : null}
      <p className="z-review-card__text" id={`${id}-text`}>
        {head}
        {tail ? (
          <>
            <span className="z-review-card__ellipsis" aria-hidden="true" hidden={open || undefined}>
              …
            </span>
            <span ref={restRef} className="z-review-card__rest" id={`${id}-rest`} hidden={open ? undefined : true}>
              {tail}
            </span>
          </>
        ) : null}
      </p>
      {tail ? (
        <button
          type="button"
          className="z-review-card__more"
          aria-expanded={open}
          aria-controls={`${id}-rest`}
          onClick={() => setOpen(!open)}
        >
          {open ? l.readLess : l.readMore}
        </button>
      ) : null}
      {photos?.length ? (
        <ul className="z-review-card__photos" aria-label={l.photos}>
          {photos.map((photo, index) => (
            <li key={photo.src} className="z-review-card__photo-item">
              {onPhotoSelect ? (
                <button
                  type="button"
                  className="z-review-card__photo"
                  data-index={index}
                  aria-label={fill(l.photo, { index: index + 1, count: photos.length })}
                  onClick={() => onPhotoSelect(index)}
                >
                  <img src={photo.src} alt={photo.alt} loading="lazy" decoding="async" />
                </button>
              ) : (
                <span className="z-review-card__photo">
                  <img src={photo.src} alt={photo.alt} loading="lazy" decoding="async" />
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : null}
      {reply ? (
        <div className="z-review-card__reply">
          <p className="z-review-card__reply-head">
            <span className="z-review-card__reply-author">{reply.author ? fill(l.replyFrom, { name: reply.author }) : l.reply}</span>
            {replyWhen?.text ? (
              <time className="z-review-card__date" dateTime={replyWhen.datetime}>
                {replyWhen.text}
              </time>
            ) : null}
          </p>
          <p className="z-review-card__reply-text">{reply.text}</p>
        </div>
      ) : null}
    </article>
  );
});
