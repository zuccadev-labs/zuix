import type { CSSProperties, HTMLAttributes, Ref } from "react";
import { cx } from "../../cx";
import { withRef } from "../../react-compat";

export interface AspectRatioProps extends HTMLAttributes<HTMLDivElement> {
  /** Ancho entre alto: `16 / 9` (número) o `"4 / 3"`. */
  ratio?: number | string;
  ref?: Ref<HTMLDivElement>;
}

/** Caja que mantiene una proporción (CSS `aspect-ratio`); la imagen, el vídeo o el iframe de dentro la cubren. */
export const AspectRatio = withRef(function AspectRatio({ ratio = 16 / 9, className, style, children, ...rest }: AspectRatioProps) {
  return (
    <div {...rest} className={cx("z-aspect", className)} style={{ ...style, "--z-aspect": String(ratio) } as CSSProperties}>
      {children}
    </div>
  );
});
