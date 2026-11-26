"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { Icon } from "@zuccadev-labs/zuix-zicon/core";
import { bindLightbox, LIGHTBOX_LABELS, type LightboxHandle, type LightboxLabels } from "../../core/lightbox-runtime";
import { useLocale } from "../../locale";
import { cx } from "../../cx";
import { DialogSurface } from "../../primitives/dialog";
import { useLatest } from "../../primitives/hooks";

export type { LightboxLabels };

export interface LightboxItem {
  src: string;
  alt: string;
  caption?: ReactNode;
  width?: number;
  height?: number;
}

export interface LightboxProps {
  items: readonly LightboxItem[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Imagen que se muestra (desde 0). */
  index?: number;
  onIndexChange?: (index: number) => void;
  /** Zoom con botones, + y −, doble clic y Ctrl + rueda; encuadre arrastrando o con las flechas. */
  zoom?: boolean;
  loop?: boolean;
  labels?: Partial<LightboxLabels>;
  className?: string;
}

/** Visor de imágenes a pantalla completa sobre `<dialog>` modal: flechas, Escape cierra y devuelve el foco, zoom. */
export function Lightbox({
  items,
  open,
  onOpenChange,
  index = 0,
  onIndexChange,
  zoom = true,
  loop = true,
  labels,
  className,
}: LightboxProps) {
  const text = { ...useLocale().messages("lightbox", LIGHTBOX_LABELS), ...labels };
  const dialog = useRef<HTMLDialogElement>(null);
  const handle = useRef<LightboxHandle | null>(null);
  const latest = useLatest({ onIndexChange, index, image: text.image });
  const count = items.length;

  // biome-ignore lint/correctness/useExhaustiveDependencies: `count` obliga a volver a conectar cuando cambian las imágenes.
  useEffect(() => {
    const el = dialog.current;
    if (!open || !el) return;
    const h = bindLightbox(el, {
      initialIndex: latest.current.index,
      loop,
      zoom,
      imageLabel: latest.current.image,
      onIndex: (i) => latest.current.onIndexChange?.(i),
    });
    handle.current = h;
    return () => {
      handle.current = null;
      h.dispose();
    };
  }, [open, loop, zoom, count, latest]);
  useEffect(() => {
    if (handle.current && handle.current.index !== index) handle.current.goTo(index, false);
  }, [index]);

  return (
    <DialogSurface
      ref={dialog}
      open={open}
      onDismiss={() => onOpenChange(false)}
      // El primer botón al abrir sería «Alejar», que el visor desactiva en cuanto se conecta (sin zoom no hay nada que
      // alejar). Safari saca entonces el foco al documento y las flechas, + y Escape dejan de llegar al visor: el foco
      // empieza en «Acercar» (o en «Cerrar» sin zoom), como en el modo sin framework.
      initialFocus={(d) =>
        d.querySelector<HTMLElement>('[data-lightbox-action="zoom-in"]') ??
        d.querySelector<HTMLElement>(".z-lightbox__bar > button:not([data-lightbox-action])")
      }
      className={cx("z-lightbox", className)}
      aria-label={text.dialog}
      data-zoom={zoom ? undefined : "off"}
    >
      <div className="z-lightbox__bar">
        <span className="z-lightbox__counter" aria-hidden="true" />
        {zoom ? (
          <>
            <button type="button" className="z-lightbox__button" data-lightbox-action="zoom-out" aria-label={text.zoomOut}>
              <Icon name="magnifying-glass-minus" size={18} />
            </button>
            <button type="button" className="z-lightbox__button" data-lightbox-action="zoom-in" aria-label={text.zoomIn}>
              <Icon name="magnifying-glass-plus" size={18} />
            </button>
          </>
        ) : null}
        <button type="button" className="z-lightbox__button" aria-label={text.close} onClick={() => onOpenChange(false)}>
          <Icon name="x-mark" size={18} />
        </button>
      </div>
      <div className="z-lightbox__stage">
        {items.map((item, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: una figura por imagen, en orden.
          <figure key={i} className="z-lightbox__item">
            <img src={item.src} alt={item.alt} width={item.width} height={item.height} loading="lazy" decoding="async" />
            {item.caption ? <figcaption className="z-lightbox__caption">{item.caption}</figcaption> : null}
          </figure>
        ))}
      </div>
      {count > 1 ? (
        <>
          <button
            type="button"
            className="z-lightbox__button z-lightbox__nav"
            data-dir="prev"
            data-lightbox-action="prev"
            aria-label={text.previous}
          >
            <Icon name="chevron-left" size={20} />
          </button>
          <button
            type="button"
            className="z-lightbox__button z-lightbox__nav"
            data-dir="next"
            data-lightbox-action="next"
            aria-label={text.next}
          >
            <Icon name="chevron-right" size={20} />
          </button>
        </>
      ) : null}
    </DialogSurface>
  );
}
