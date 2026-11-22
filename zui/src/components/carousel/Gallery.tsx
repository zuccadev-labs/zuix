"use client";
import { useRef, useState, type HTMLAttributes, type ReactNode, type Ref } from "react";
import { Icon } from "@zuccadev-labs/zuix-zicon/core";
import { cx } from "../../cx";
import type { CarouselEffect, CarouselLayout } from "../../core/carousel-effects";
import { Carousel, type CarouselLabels } from "./Carousel";
import { Lightbox, type LightboxLabels } from "./Lightbox";

export interface GalleryItem {
  src: string;
  alt: string;
  /** Miniatura (por defecto, la misma imagen). */
  thumb?: string;
  caption?: ReactNode;
  width?: number;
  height?: number;
}

export interface GalleryProps extends Omit<HTMLAttributes<HTMLDivElement>, "children" | "aria-label"> {
  items: readonly GalleryItem[];
  ariaLabel: string;
  /** Tira de miniaturas sincronizada: debajo, al lado o ninguna (puntos). */
  thumbnails?: "bottom" | "side" | "none";
  /** Botón para abrir la imagen actual en el visor a pantalla completa. */
  lightbox?: boolean;
  layout?: CarouselLayout;
  effect?: CarouselEffect;
  labels?: Partial<CarouselLabels> & { expand?: string; lightbox?: Partial<LightboxLabels> };
  ref?: Ref<HTMLDivElement>;
}

/** Galería: carrusel con miniaturas sincronizadas y visor a pantalla completa (Lightbox). */
export function Gallery({
  items,
  ariaLabel,
  thumbnails = "bottom",
  lightbox = true,
  layout,
  effect = "fade",
  labels,
  className,
  ref,
  ...rest
}: GalleryProps) {
  const { expand = "View full screen", lightbox: lightboxLabels, ...carouselLabels } = labels ?? {};
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <div {...rest} ref={ref} className={cx("z-gallery", className)} data-thumbnails={thumbnails}>
      <Carousel
        items={items}
        ariaLabel={ariaLabel}
        labels={carouselLabels}
        layout={layout ?? (effect === "fade" ? "fullscreen" : "strip")}
        effect={effect}
        loop
        indicators={thumbnails === "none" ? "dots" : "thumbnails"}
        onIndexChange={setIndex}
        getKey={(item) => item.src}
        renderItem={(item) => (
          <>
            <img
              className="z-carousel__media"
              src={item.src}
              alt={item.alt}
              width={item.width}
              height={item.height}
              loading="lazy"
              decoding="async"
            />
            {item.caption ? <div className="z-carousel__caption">{item.caption}</div> : null}
          </>
        )}
        renderThumbnail={(item) => <img src={item.thumb ?? item.src} alt="" loading="lazy" decoding="async" />}
      />
      {lightbox ? (
        <>
          <button ref={trigger} type="button" className="z-gallery__expand" aria-label={expand} onClick={() => setOpen(true)}>
            <Icon name="arrows-pointing-out" size={18} />
          </button>
          <Lightbox items={items} open={open} onOpenChange={setOpen} index={index} labels={lightboxLabels} />
        </>
      ) : null}
    </div>
  );
}
