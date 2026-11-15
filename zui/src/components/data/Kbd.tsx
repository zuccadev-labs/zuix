import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "../../cx";

export interface KbdProps extends HTMLAttributes<HTMLElement> {
  /** Combinación separada por espacios ("Ctrl K"): una tecla por palabra. */
  keys?: string;
  size?: "sm" | "md";
  children?: ReactNode;
}

/** Tecla o atajo de teclado. */
export function Kbd({ keys, size = "md", className, children, ...rest }: KbdProps) {
  if (keys) {
    return (
      <span className="z-kbd-group">
        {keys.split(" ").filter(Boolean).map((key, index) => (
          <kbd key={`${key}-${index}`} {...rest} className={cx("z-kbd", className)} data-size={size}>
            {key}
          </kbd>
        ))}
      </span>
    );
  }
  return (
    <kbd {...rest} className={cx("z-kbd", className)} data-size={size}>
      {children}
    </kbd>
  );
}
