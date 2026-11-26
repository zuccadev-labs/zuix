// Tipos compartidos por los grupos de componentes.
export type Tone = "neutral" | "accent" | "success" | "warning" | "danger" | "info";
export type ControlSize = "sm" | "md" | "lg";
export type Intent = "primary" | "secondary" | "ghost" | "danger";
/** Variantes de Button: las intenciones más el contorno y el aspecto de enlace. */
export type ButtonVariant = Intent | "outline" | "link" | "glass";
/** Tamaños de Button e IconButton: los de control más `xs` (24 px) y `xl` (48 px). */
export type ButtonSize = "xs" | ControlSize | "xl";

/** Tamaño de icono (px) para cada altura de control. */
export const ICON_SIZE: Record<ControlSize, number> = { sm: 14, md: 16, lg: 18 };
/** Tamaño de icono (px) para cada tamaño de botón. */
export const BUTTON_ICON_SIZE: Record<ButtonSize, number> = { xs: 12, ...ICON_SIZE, xl: 20 };
