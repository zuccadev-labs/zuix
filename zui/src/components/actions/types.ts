// Tipos compartidos por los grupos de componentes.
export type Tone = "neutral" | "accent" | "success" | "warning" | "danger" | "info";
export type ControlSize = "sm" | "md" | "lg";
export type Intent = "primary" | "secondary" | "ghost" | "danger";

/** Tamaño de icono (px) para cada altura de control. */
export const ICON_SIZE: Record<ControlSize, number> = { sm: 14, md: 16, lg: 18 };
