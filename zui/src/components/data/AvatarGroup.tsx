import { Children, type HTMLAttributes, type ReactNode } from "react";
import { cx } from "../../cx";
import type { AvatarSize } from "./Avatar";

export interface AvatarGroupProps extends HTMLAttributes<HTMLDivElement> {
  /** Máximo de avatares visibles; el resto se resume en "+N". */
  max?: number;
  /** Total real si hay más elementos que hijos renderizados. */
  total?: number;
  size?: AvatarSize;
  /** Nombre accesible del contador de sobrantes. */
  overflowLabel?: (hidden: number) => string;
  children: ReactNode;
}

/** Avatares solapados con contador de sobrantes. */
export function AvatarGroup({
  max = 4,
  total,
  size = "md",
  overflowLabel = (hidden) => `${hidden} more`,
  className,
  children,
  ...rest
}: AvatarGroupProps) {
  const items = Children.toArray(children);
  const visible = items.slice(0, max);
  const hidden = (total ?? items.length) - visible.length;
  return (
    <div {...rest} role="group" className={cx("z-avatar-group", className)} data-size={size}>
      {visible}
      {hidden > 0 ? (
        <span className="z-avatar z-avatar--overflow" data-size={size} data-shape="circle" role="img" aria-label={overflowLabel(hidden)}>
          <span className="z-avatar__initials" aria-hidden="true">
            +{hidden}
          </span>
        </span>
      ) : null}
    </div>
  );
}
