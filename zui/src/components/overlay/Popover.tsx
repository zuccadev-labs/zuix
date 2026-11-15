"use client";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { Popover as RadixPopover } from "radix-ui";
import { cx } from "../../cx";

export interface PopoverProps {
  /** Elemento disparador. */
  trigger: ReactElement;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  sideOffset?: number;
  /** Ancho del panel (maquetación). */
  width?: number | string;
  /** Nombre accesible del panel. */
  label?: string;
  modal?: boolean;
  className?: string;
  children?: ReactNode;
}

export function Popover({
  trigger,
  open,
  defaultOpen,
  onOpenChange,
  side = "bottom",
  align = "end",
  sideOffset = 4,
  width,
  label,
  modal,
  className,
  children,
}: PopoverProps) {
  const style: CSSProperties | undefined = width === undefined ? undefined : { width };
  return (
    <RadixPopover.Root open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange} modal={modal}>
      <RadixPopover.Trigger asChild>{trigger}</RadixPopover.Trigger>
      <RadixPopover.Portal>
        <RadixPopover.Content
          className={cx("z-liquid z-popover", className)}
          side={side}
          align={align}
          sideOffset={sideOffset}
          collisionPadding={8}
          aria-label={label}
          style={style}
        >
          {children}
        </RadixPopover.Content>
      </RadixPopover.Portal>
    </RadixPopover.Root>
  );
}
