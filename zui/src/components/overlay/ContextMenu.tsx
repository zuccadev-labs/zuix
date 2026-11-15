"use client";
import { useContext, type ReactElement } from "react";
import { ContextMenu as RadixContextMenu } from "radix-ui";
import { cx } from "../../cx";
import { ElevatedContext, MenuEntries, type MenuEntry, type MenuKit } from "./internal";

export interface ContextMenuProps {
  /** Zona que abre el menú con clic derecho o pulsación larga. */
  children: ReactElement;
  items: MenuEntry[];
  /** Nombre accesible del menú. */
  label?: string;
  size?: "md" | "lg";
  disabled?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}

export function ContextMenu({ children, items, label, size = "md", disabled, onOpenChange, className }: ContextMenuProps) {
  const elevated = useContext(ElevatedContext);
  return (
    <RadixContextMenu.Root onOpenChange={onOpenChange}>
      <RadixContextMenu.Trigger asChild disabled={disabled}>
        {children}
      </RadixContextMenu.Trigger>
      <RadixContextMenu.Portal>
        <RadixContextMenu.Content
          className={cx("z-liquid z-menu", className)}
          data-size={size}
          data-elevated={elevated || undefined}
          collisionPadding={8}
          aria-label={label}
        >
          <MenuEntries kit={RadixContextMenu as MenuKit} items={items} size={size} elevated={elevated} />
        </RadixContextMenu.Content>
      </RadixContextMenu.Portal>
    </RadixContextMenu.Root>
  );
}
