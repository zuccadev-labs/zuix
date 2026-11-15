"use client";
import type { ReactElement, ReactNode } from "react";
import { Tooltip as RadixTooltip } from "radix-ui";
import { cx } from "../../cx";

export interface TooltipProps {
  /** Texto o contenido de la burbuja. */
  content: ReactNode;
  /** Disparador: un único elemento enfocable. */
  children: ReactElement;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  /** Retardo de apertura en ms. */
  delay?: number;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}

export function Tooltip({ content, children, side = "top", align = "center", delay = 300, open, defaultOpen, onOpenChange, className }: TooltipProps) {
  // Sin contenido no hay burbuja: se devuelve el disparador tal cual.
  if (content === null || content === undefined || content === "") return children;
  // La burbuja no recibe el puntero (pointer-events: none): se cierra en cuanto el puntero sale del disparador.
  return (
    <RadixTooltip.Provider delayDuration={delay} disableHoverableContent>
      <RadixTooltip.Root open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
        <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
        <RadixTooltip.Portal>
          <RadixTooltip.Content className={cx("z-liquid z-tooltip", className)} side={side} align={align} sideOffset={7} collisionPadding={8}>
            {content}
          </RadixTooltip.Content>
        </RadixTooltip.Portal>
      </RadixTooltip.Root>
    </RadixTooltip.Provider>
  );
}
