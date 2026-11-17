"use client";
import type { ReactNode } from "react";
import { Icon } from "@zuccadev-labs/zuix-zicon/core";
import { cx } from "../../cx";

export interface StepItem {
  label: ReactNode;
  description?: ReactNode;
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
  className?: string;
}

const DEFAULT_STATUS = { complete: "Completed", current: "Current", upcoming: "Upcoming" };

export function Stepper({
  steps,
  current,
  orientation = "horizontal",
  onStepSelect,
  label = "Progress",
  statusLabels = DEFAULT_STATUS,
  className,
}: StepperProps) {
  return (
    <ol className={cx("z-stepper", className)} data-orientation={orientation} aria-label={label}>
      {steps.map((step, i) => {
        const state = i < current ? "complete" : i === current ? "current" : "upcoming";
        const body = (
          <>
            <span className="z-stepper__marker" aria-hidden="true">
              {state === "complete" ? <Icon name="check" size={14} /> : i + 1}
            </span>
            <span className="z-stepper__text">
              <span className="z-stepper__label">{step.label}</span>
              {step.description ? <span className="z-stepper__description">{step.description}</span> : null}
              <span className="z-sr-only">{statusLabels[state]}</span>
            </span>
          </>
        );
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: un paso es su número de orden (el mismo índice que recibe `onStepSelect`); `label` puede ser un nodo.
          <li key={i} className="z-stepper__step" data-state={state} aria-current={state === "current" ? "step" : undefined}>
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
}
