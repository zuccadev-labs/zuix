"use client";
import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import { isRtl } from "../../core/dir";
import { activeElement, focusQuiet } from "../../core/focus";
import type { Box } from "../../core/place";
import { reducedMotion } from "../../core/presence";
import { centerBox, clampStep, ringBox, tourKey, tourProgress } from "../../core/tour";
import { cx } from "../../cx";
import { useControllable, useLatest, useLayer, usePresence } from "../../primitives/hooks";
import { Popup, Portal } from "../../primitives/popup";
import { CloseButton } from "./internal";

export interface TourStep {
  /** Elemento que explica el paso: un selector o una ref. Sin él (o si no está), el paso va centrado. */
  target?: string | RefObject<Element | null>;
  /** Encabezado del paso: tiene que entenderse sin ver la pantalla («Start a review»). */
  title: ReactNode;
  content?: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
}

export interface TourProps {
  steps: TourStep[];
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Paso actual (índice), controlado. */
  step?: number;
  defaultStep?: number;
  onStepChange?: (step: number) => void;
  /** Al terminar con «Done» (no al saltar ni con Escape). */
  onFinish?: () => void;
  /** Al saltar con «Skip», Escape o el cierre. */
  onSkip?: () => void;
  /** Texto de progreso: `{step}` y `{count}`. */
  progressLabel?: string;
  nextLabel?: string;
  backLabel?: string;
  doneLabel?: string;
  skipLabel?: string;
  closeLabel?: string;
  /** Margen del anillo que resalta el elemento del paso, en px. */
  ringPadding?: number;
  className?: string;
}

const targetOf = (step: TourStep | undefined): Element | null => {
  if (!step?.target) return null;
  if (typeof step.target === "string") {
    try {
      return document.querySelector(step.target);
    } catch {
      return null;
    }
  }
  return step.target.current;
};

/**
 * Recorrido guiado: una tarjeta anclada a cada elemento que explica (no modal, la página sigue usable), con anillo
 * que lo resalta, progreso, Anterior, Siguiente y Saltar. Al abrir y en cada paso el foco entra en la tarjeta (en
 * Siguiente o Hecho); Escape o Saltar lo cierran y el foco vuelve a donde estaba. Flecha izquierda y derecha cambian
 * de paso con el foco dentro.
 */
export function Tour({
  steps,
  open: openProp,
  defaultOpen,
  onOpenChange,
  step: stepProp,
  defaultStep = 0,
  onStepChange,
  onFinish,
  onSkip,
  progressLabel = "Step {step} of {count}",
  nextLabel = "Next",
  backLabel = "Back",
  doneLabel = "Done",
  skipLabel = "Skip tour",
  closeLabel = "Close tour",
  ringPadding = 6,
  className,
}: TourProps) {
  const id = useId();
  const [open, setOpen] = useControllable(openProp, defaultOpen ?? false, onOpenChange);
  const [rawStep, setStep] = useControllable(stepProp, defaultStep, onStepChange);
  const index = clampStep(rawStep, steps.length);
  const step = steps[index];
  const card = useRef<HTMLDivElement | null>(null);
  const present = usePresence(open, card);
  const previous = useRef<HTMLElement | null>(null);
  const [ring, setRing] = useState<Box | null>(null);
  const latest = useLatest({ step, ringPadding });
  const last = index === steps.length - 1;

  // Al abrir se recuerda dónde estaba el foco; al cerrar vuelve allí.
  useEffect(() => {
    if (!open) return;
    previous.current = activeElement();
    return () => {
      const back = previous.current;
      if (!document.activeElement || document.activeElement === document.body || card.current?.contains(document.activeElement))
        focusQuiet(back);
    };
  }, [open]);

  // Cada paso: el elemento a la vista, el anillo a su alrededor y el foco en la acción principal de la tarjeta.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `index` no se lee dentro (el paso sale de `latest`); es el disparador de cada paso.
  useEffect(() => {
    if (!open) return;
    const target = targetOf(latest.current.step);
    target?.scrollIntoView({ block: "center", inline: "nearest", behavior: reducedMotion() ? "auto" : "smooth" });
    const measure = () => {
      const el = targetOf(latest.current.step);
      const root = document.documentElement;
      setRing(
        ringBox(el?.getBoundingClientRect() ?? null, latest.current.ringPadding, { width: root.clientWidth, height: root.clientHeight }),
      );
    };
    measure();
    // La tarjeta ya está abierta y colocada (efecto de la capa): el foco entra ya, y otra vez en el cuadro siguiente
    // por si el desplazamiento hasta el elemento lo movió.
    const primary = () => card.current?.querySelector<HTMLElement>(".z-tour__primary");
    focusQuiet(primary());
    const frame = requestAnimationFrame(() => {
      if (!card.current?.contains(document.activeElement)) focusQuiet(primary());
    });
    const wiring = new AbortController();
    document.addEventListener("scroll", measure, { capture: true, passive: true, signal: wiring.signal });
    window.addEventListener("resize", measure, { signal: wiring.signal });
    const settle = setTimeout(measure, 400);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(settle);
      wiring.abort();
    };
  }, [open, index, latest]);

  const skip = () => {
    setOpen(false);
    onSkip?.();
  };
  const go = (to: "next" | "prev") => {
    if (to === "prev") {
      if (index > 0) setStep(index - 1);
      return;
    }
    if (!last) return setStep(index + 1);
    setOpen(false);
    onFinish?.();
  };

  useLayer(open, {
    contains: (target) => card.current?.contains(target) ?? false,
    onEscape: skip,
  });

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!(event.target instanceof Element) || event.target.closest("input, textarea, select")) return;
    const to = tourKey(event.key, isRtl(event.currentTarget));
    if (!to || (to === "prev" && index === 0)) return;
    event.preventDefault();
    go(to);
  };

  if (!present || !step) return null;
  const ringStyle = ring ? ({ left: ring.left, top: ring.top, width: ring.width, height: ring.height } as CSSProperties) : undefined;
  const titleId = `${id}-title`;
  return (
    <Portal>
      {ring ? <div className="z-tour__ring" data-state={open ? "open" : "closed"} style={ringStyle} aria-hidden="true" /> : null}
      <Popup
        key={index}
        ref={card}
        open={open}
        anchorRect={() => {
          const el = targetOf(latest.current.step);
          const root = document.documentElement;
          const view = { width: root.clientWidth, height: root.clientHeight };
          const box = el ? ringBox(el.getBoundingClientRect(), latest.current.ringPadding, view) : null;
          return box ?? centerBox(view);
        }}
        placement={step.align && step.align !== "center" ? `${step.side ?? "bottom"}-${step.align}` : (step.side ?? "bottom")}
        gap={10}
        role="dialog"
        aria-labelledby={titleId}
        className={cx("z-liquid z-tour", className)}
        data-arrow={targetOf(step) ? "" : undefined}
        onKeyDown={onKeyDown}
      >
        <header className="z-tour__header">
          <p className="z-tour__progress">{tourProgress(progressLabel, index, steps.length)}</p>
          <h2 id={titleId} className="z-tour__title">
            {step.title}
          </h2>
        </header>
        {step.content ? <div className="z-tour__body">{step.content}</div> : null}
        <footer className="z-tour__footer">
          {last ? null : (
            <button type="button" className="z-dialog-btn z-tour__skip" data-variant="secondary" onClick={skip}>
              {skipLabel}
            </button>
          )}
          <span className="z-tour__spacer" />
          {index > 0 ? (
            <button type="button" className="z-dialog-btn" data-variant="secondary" onClick={() => go("prev")}>
              {backLabel}
            </button>
          ) : null}
          <button type="button" className="z-dialog-btn z-tour__primary" data-variant="primary" onClick={() => go("next")}>
            {last ? doneLabel : nextLabel}
          </button>
        </footer>
        <CloseButton label={closeLabel} className="z-tour__close" onClick={skip} />
      </Popup>
    </Portal>
  );
}
