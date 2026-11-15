"use client";
import { useContext, type ReactElement } from "react";
import { DropdownMenu } from "radix-ui";
import { cx } from "../../cx";
import { ElevatedContext, MenuEntries, type MenuEntry, type MenuKit } from "./internal";

export interface MenuProps {
  /** Elemento disparador (un botón). */
  trigger: ReactElement;
  items: MenuEntry[];
  /** Nombre accesible del menú. */
  label?: string;
  size?: "md" | "lg";
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}

export function Menu({ trigger, items, label, size = "md", side = "bottom", align = "end", open, defaultOpen, onOpenChange, className }: MenuProps) {
  const elevated = useContext(ElevatedContext);
  return (
    <DropdownMenu.Root open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className={cx("z-liquid z-menu", className)}
          data-size={size}
          data-elevated={elevated || undefined}
          side={side}
          align={align}
          sideOffset={4}
          collisionPadding={8}
          aria-label={label}
        >
          <MenuEntries kit={DropdownMenu as MenuKit} items={items} size={size} elevated={elevated} />
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
