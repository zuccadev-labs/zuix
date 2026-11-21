"use client";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { Icon, type IconName } from "@zuccadev-labs/zuix-zicon/core";
import { cx } from "../../cx";

export interface StepItem {
  label: ReactNode;
  description?: ReactNode;
  /** Icono del marcador en lugar del número (un paso completo muestra siempre la marca de hecho). */
  icon?: IconName;
  /** Paso en curso de procesarse: el marcador gira y el paso lleva aria-busy. */
  loading?: boolean;
  /** Panel del paso. Con algún panel, el Stepper muestra el del paso actual y los botones Anterior/Siguiente. */
  content?: ReactNode;
}

export interface StepperProps {
  steps: StepItem[];
  /** Índice del paso actual, desde 0. Igual a `steps.length` deja todos completos. */
  current: number;
  orientation?: "horizontal" | "vertical";
  /** Si se pasa, los pasos ya completados se pueden pulsar. */
  onStepSelect?: (index: number) => void;
  /** Nombre accesible de la lista. */
  label?: string;
  /** Texto para lectores de pantalla según el estado del paso. */
  statusLabels?: { complete: string; current: string; upcoming: string };
  /** Con paneles: Anterior y Siguiente piden este índice (Siguiente en el último paso pide `steps.length`). */
  onStepChange?: (index: number) => void;
  /** Con paneles: lo que se muestra cuando todos los pasos están completos. */
  completed?: ReactNode;
  /** Textos de los botones de los paneles. */
  navLabels?: { previous: string; next: string; finish: string };
  /** Con paneles: Siguiente desactivado (p. ej. mientras el paso no es válido). */
  nextDisabled?: boolean;
  className?: string;
}

const DEFAULT_STATUS = { complete: "Completed", current: "Current", upcoming: "Upcoming" };
const DEFAULT_NAV = { previous: "Back", next: "Next", finish: "Finish" };

export function Stepper({
  steps,
  current,
  orientation = "horizontal",
  onStepSelect,
  label = "Progress",
  statusLabels = DEFAULT_STATUS,
  onStepChange,
  completed,
  navLabels = DEFAULT_NAV,
  nextDisabled,
  className,
}: StepperProps) {
  const uid = useId().replace(/:/g, "");
  const panels = steps.some((step) => step.content !== undefined);
  const panelRef = useRef<HTMLDivElement>(null);
  const moved = useRef(false);
  // Tras Anterior o Siguiente el foco va al panel nuevo: el lector lee el paso al que se llega.
  // biome-ignore lint/correctness/useExhaustiveDependencies: el efecto reacciona al cambio de paso.
  useEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    panelRef.current?.focus();
  }, [current]);

  const list = (
    <ol className={cx("z-stepper", !panels && className)} data-orientation={orientation} aria-label={label}>
      {steps.map((step, i) => {
        const state = i < current ? "complete" : i === current ? "current" : "upcoming";
        const body = (
          <>
            <span className="z-stepper__marker" aria-hidden="true" data-loading={step.loading || undefined}>
              {step.loading ? (
                <span className="z-stepper__spinner" />
              ) : state === "complete" ? (
                <Icon name="check" size={14} />
              ) : step.icon ? (
                <Icon name={step.icon} size={14} />
              ) : (
                i + 1
              )}
            </span>
            <span className="z-stepper__text">
              <span className="z-stepper__label" id={panels ? `${uid}-label-${i}` : undefined}>
                {step.label}
              </span>
              {step.description ? <span className="z-stepper__description">{step.description}</span> : null}
              <span className="z-sr-only">{statusLabels[state]}</span>
            </span>
          </>
        );
        return (
          <li
            // biome-ignore lint/suspicious/noArrayIndexKey: un paso es su número de orden (el mismo índice que recibe `onStepSelect`); `label` puede ser un nodo.
            key={i}
            className="z-stepper__step"
            data-state={state}
            aria-current={state === "current" ? "step" : undefined}
            aria-busy={step.loading || undefined}
          >
            {onStepSelect && state === "complete" ? (
              <button type="button" className="z-stepper__body" onClick={() => onStepSelect(i)}>
                {body}
              </button>
            ) : (
              <span className="z-stepper__body">{body}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
  if (!panels) return list;

  const last = steps.length - 1;
  const done = current > last;
  const go = (index: number) => {
    moved.current = true;
    onStepChange?.(index);
  };
  return (
    <div className={cx("z-stepper-panels", className)} data-orientation={orientation} data-current={current}>
      {list}
      <div className="z-stepper__panels">
        {steps.map((step, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: el panel es el del paso con el mismo índice.
            key={i}
            ref={i === current ? panelRef : undefined}
            className="z-stepper__panel"
            role="group"
            aria-labelledby={`${uid}-label-${i}`}
            tabIndex={-1}
            hidden={i !== current}
          >
            {step.content}
          </div>
        ))}
        {completed !== undefined ? (
          <div ref={done ? panelRef : undefined} className="z-stepper__panel" data-completed="" tabIndex={-1} hidden={!done}>
            {completed}
          </div>
        ) : null}
      </div>
      {done ? null : (
        <div className="z-stepper__nav">
          <button
            type="button"
            className="z-btn z-btn--secondary"
            data-size="md"
            data-step="prev"
            disabled={current <= 0}
            onClick={() => go(current - 1)}
          >
            {navLabels.previous}
          </button>
          <button
            type="button"
            className="z-btn z-btn--primary"
            data-size="md"
            data-step="next"
            disabled={nextDisabled || steps[current]?.loading}
            onClick={() => go(current + 1)}
          >
            {current >= last ? navLabels.finish : navLabels.next}
          </button>
        </div>
      )}
    </div>
  );
}
