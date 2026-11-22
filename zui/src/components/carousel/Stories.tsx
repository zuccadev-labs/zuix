"use client";
import { useEffect, useRef, useState, type HTMLAttributes, type ReactNode, type Ref } from "react";
import { Icon } from "@zuccadev-labs/zuix-zicon/core";
import { storyText, type StoriesState } from "../../core/stories";
import { bindStories, type StoriesHandle } from "../../core/stories-runtime";
import { cx } from "../../cx";
import { useLatest } from "../../primitives/hooks";
import { useMergedRef } from "../../refs";

export interface StoryItem {
  id: string;
  /** URL de una imagen o el contenido de la historia. */
  media: string | ReactNode;
  /** Texto alternativo de la imagen (con `media` como URL). */
  alt?: string;
  caption?: ReactNode;
  /** Duración de esta historia (ms); por defecto la de `duration`. */
  duration?: number;
}

export interface StoryGroup {
  id: string;
  author: { name: string; avatar?: string };
  items: readonly StoryItem[];
}

export interface StoriesLabels {
  /** aria-roledescription de la región. */
  stories: string;
  /** aria-roledescription de cada historia. */
  story: string;
  previous: string;
  next: string;
  pause: string;
  previousGroup: string;
  nextGroup: string;
  /** Nombre de cada historia y anuncio: {index}, {count}, {author}. */
  position: string;
}

export interface StoriesProps extends Omit<HTMLAttributes<HTMLElement>, "children" | "aria-label"> {
  groups: readonly StoryGroup[];
  ariaLabel: string;
  defaultGroup?: number;
  /** Duración por defecto de cada historia (ms, mínimo 1000). */
  duration?: number;
  labels?: Partial<StoriesLabels>;
  onGroupChange?: (group: number) => void;
  /** Terminó la última historia del último grupo. */
  onComplete?: () => void;
  ref?: Ref<HTMLElement>;
}

const DEFAULT_LABELS: StoriesLabels = {
  stories: "stories",
  story: "story",
  previous: "Previous story",
  next: "Next story",
  pause: "Pause stories",
  previousGroup: "Previous person",
  nextGroup: "Next person",
  position: "Story {index} of {count}, {author}",
};

/**
 * Historias al estilo de Instagram: una barra por historia que se llena con el tiempo, tocar a un lado o al otro para
 * retroceder o avanzar, mantener pulsado para pausar y grupos por persona. Con movimiento reducido empieza en pausa.
 */
export function Stories({
  groups,
  ariaLabel,
  defaultGroup = 0,
  duration = 5000,
  labels,
  onGroupChange,
  onComplete,
  className,
  ref,
  ...rest
}: StoriesProps) {
  const text = { ...DEFAULT_LABELS, ...labels };
  const node = useRef<HTMLElement | null>(null);
  const setRef = useMergedRef(node, ref);
  const handle = useRef<StoriesHandle | null>(null);
  const [state, setState] = useState<Pick<StoriesState, "paused" | "group">>({ paused: false, group: defaultGroup });
  const latest = useLatest({ onGroupChange, onComplete, position: text.position, duration, defaultGroup });
  const shapeKey = groups.map((g) => `${g.id}:${g.items.map((i) => `${i.id}/${i.duration ?? ""}`).join(",")}`).join("|");

  // biome-ignore lint/correctness/useExhaustiveDependencies: `shapeKey` resume los grupos: se vuelve a conectar cuando cambian.
  useEffect(() => {
    const root = node.current;
    if (!root) return;
    let group = latest.current.defaultGroup;
    const h = bindStories(root, {
      duration: latest.current.duration,
      initialGroup: group,
      storyLabel: latest.current.position,
      onComplete: () => latest.current.onComplete?.(),
      onChange: (s) => {
        setState({ paused: s.paused, group: s.group });
        if (s.group !== group) {
          group = s.group;
          latest.current.onGroupChange?.(s.group);
        }
      },
    });
    handle.current = h;
    setState({ paused: h.state.paused, group: h.state.group });
    return () => {
      handle.current = null;
      h.dispose();
    };
  }, [shapeKey, latest]);

  return (
    <section {...rest} ref={setRef} className={cx("z-stories", className)} aria-roledescription={text.stories} aria-label={ariaLabel}>
      <div className="z-stories__viewer">
        {groups.map((g) => (
          <article key={g.id} className="z-stories__group" data-author={g.author.name} aria-label={g.author.name}>
            <div className="z-stories__bars" aria-hidden="true">
              {g.items.map((it) => (
                <span key={it.id} className="z-stories__bar">
                  <span className="z-stories__fill" />
                </span>
              ))}
            </div>
            <header className="z-stories__head">
              {g.author.avatar ? <img className="z-stories__avatar" src={g.author.avatar} alt="" /> : null}
              <span className="z-stories__author">{g.author.name}</span>
            </header>
            {g.items.map((it, i) => (
              <figure
                key={it.id}
                className="z-stories__item"
                data-duration={it.duration}
                role="group"
                aria-roledescription={text.story}
                aria-label={storyText(text.position, i, g.items.length, g.author.name)}
              >
                {typeof it.media === "string" ? <img className="z-stories__media" src={it.media} alt={it.alt ?? ""} /> : it.media}
                {it.caption ? <figcaption className="z-stories__caption">{it.caption}</figcaption> : null}
              </figure>
            ))}
          </article>
        ))}
        <button type="button" className="z-stories__nav" data-dir="prev" data-stories-action="prev" aria-label={text.previous} />
        <button type="button" className="z-stories__nav" data-dir="next" data-stories-action="next" aria-label={text.next} />
      </div>
      <div className="z-stories__controls">
        <button
          type="button"
          className="z-stories__control"
          data-stories-action="prev-group"
          aria-label={text.previousGroup}
          disabled={state.group === 0}
        >
          <Icon name="chevron-double-left" size={16} />
        </button>
        <button
          type="button"
          className="z-stories__control"
          data-stories-action="pause"
          aria-label={text.pause}
          aria-pressed={state.paused}
        >
          <Icon className="z-stories__icon-pause" name="pause" size={16} />
          <Icon className="z-stories__icon-play" name="play" size={16} />
        </button>
        <button
          type="button"
          className="z-stories__control"
          data-stories-action="next-group"
          aria-label={text.nextGroup}
          disabled={state.group >= groups.length - 1}
        >
          <Icon name="chevron-double-right" size={16} />
        </button>
      </div>
    </section>
  );
}
