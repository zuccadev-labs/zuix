import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { skeletonTree, type SkeletonAnimation, type SkeletonPattern, type SkeletonPatternOptions } from "../../core/skeleton";
import { cx } from "../../cx";
import { toReact } from "../vnode";
import { inertProp } from "../../react-compat";

export type { SkeletonAnimation, SkeletonPattern, SkeletonPatternOptions };

export interface SkeletonProps extends Omit<HTMLAttributes<HTMLSpanElement>, "children">, Omit<SkeletonPatternOptions, "animation"> {
  /** Ancho y alto: número en px o cualquier longitud CSS. */
  width?: number | string;
  height?: number | string;
  variant?: "text" | "circular" | "rectangular" | "rounded";
  animation?: SkeletonAnimation;
  /** Con `variant="text"`: número de líneas; la última queda más corta. Con `pattern="card"`: líneas del cuerpo. */
  lines?: number;
  /** Patrón completo: tarjeta, lista, tabla, perfil, chat, gráfico, artículo o calendario. */
  pattern?: SkeletonPattern;
  /**
   * Envuelve el contenido real: mientras es `true` se ve el hueso con el tamaño del contenido (oculto e inerte); con
   * `false` se pinta el contenido tal cual.
   */
  loading?: boolean;
  children?: ReactNode;
}

/** Marcador de posición mientras llega el contenido. Decorativo: el estado de carga lo anuncia el contenedor (aria-busy). */
export function Skeleton({
  width,
  height,
  variant = "text",
  animation = "pulse",
  lines = 1,
  pattern,
  loading,
  children,
  seed,
  media,
  actions,
  rows,
  avatar,
  meta,
  columns,
  header,
  cover,
  messages,
  type,
  paragraphs,
  image,
  className,
  style,
  ...rest
}: SkeletonProps) {
  if (loading === false) return <>{children}</>;
  if (pattern) {
    const tree = skeletonTree(pattern, {
      animation,
      seed,
      media,
      lines: pattern === "card" && lines !== 1 ? lines : undefined,
      actions,
      rows,
      avatar,
      meta,
      columns,
      header,
      cover,
      messages,
      type,
      paragraphs,
      image,
    });
    tree.a = { ...tree.a, class: cx(String(tree.a?.class ?? ""), className), id: rest.id };
    return <>{toReact(tree)}</>;
  }
  if (loading) {
    return (
      <span
        {...rest}
        className={cx("z-skeleton", className)}
        data-variant={variant === "text" ? "rounded" : variant}
        data-animation={animation}
        data-loading=""
        style={style}
        aria-hidden="true"
        inert={inertProp(true)}
      >
        {children}
      </span>
    );
  }
  const size: CSSProperties = { width, height };
  if (variant === "text" && lines > 1) {
    return (
      <span {...rest} className={cx("z-skeleton-lines", className)} style={{ ...style, width }} aria-hidden="true">
        {Array.from({ length: lines }, (_, index) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: líneas idénticas generadas a partir de un número; no hay más identidad que la posición.
            key={index}
            className="z-skeleton"
            data-variant="text"
            data-animation={animation}
            style={{ height, width: index === lines - 1 ? "60%" : undefined }}
          />
        ))}
      </span>
    );
  }
  return (
    <span
      {...rest}
      className={cx("z-skeleton", className)}
      data-variant={variant}
      data-animation={animation}
      style={{ ...style, ...size }}
      aria-hidden="true"
    />
  );
}

type PatternProps = Omit<SkeletonProps, "pattern" | "loading" | "children" | "variant">;
Skeleton.Card = function SkeletonCard(props: PatternProps) {
  return <Skeleton {...props} pattern="card" />;
};
Skeleton.List = function SkeletonList(props: PatternProps) {
  return <Skeleton {...props} pattern="list" />;
};
Skeleton.Table = function SkeletonTable(props: PatternProps) {
  return <Skeleton {...props} pattern="table" />;
};
Skeleton.Profile = function SkeletonProfile(props: PatternProps) {
  return <Skeleton {...props} pattern="profile" />;
};
Skeleton.Chat = function SkeletonChat(props: PatternProps) {
  return <Skeleton {...props} pattern="chat" />;
};
Skeleton.Chart = function SkeletonChart(props: PatternProps) {
  return <Skeleton {...props} pattern="chart" />;
};
Skeleton.Article = function SkeletonArticle(props: PatternProps) {
  return <Skeleton {...props} pattern="article" />;
};
Skeleton.Calendar = function SkeletonCalendar(props: PatternProps) {
  return <Skeleton {...props} pattern="calendar" />;
};

export interface SkeletonGroupProps extends HTMLAttributes<HTMLDivElement> {
  /** El contenedor espera (aria-busy). Por defecto, sí. */
  busy?: boolean;
  /** Brillo de todos los huesos de dentro, sincronizado (un solo degradado fijo a la ventana). */
  animation?: SkeletonAnimation;
  /** Una línea de estado visible para esperas largas (no se anuncia: es texto normal). */
  label?: ReactNode;
}

/** Contenedor que espera: lleva aria-busy y sincroniza el brillo de sus skeletons para que no parpadeen desfasados. */
export function SkeletonGroup({ busy = true, animation = "wave", label, className, children, ...rest }: SkeletonGroupProps) {
  return (
    <div {...rest} className={cx("z-skeleton-group", className)} data-animation={animation} aria-busy={busy || undefined}>
      {label ? <p className="z-skeleton-group__label">{label}</p> : null}
      {children}
    </div>
  );
}
