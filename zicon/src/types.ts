/**
 * Trazado con pintura propia: lo usan los iconos que aporta la aplicación (un logotipo de varios colores). `fill`
 * admite `currentColor`, `none`, un color CSS o `var(--…)`; sin él, el trazado hereda el color del texto.
 */
export interface IconPathDef {
  d: string;
  fill?: string;
  opacity?: number;
  evenodd?: boolean;
}

/** Un trazado: la cadena `d` (con prefijo "E:" usa la regla evenodd) o un trazado con pintura propia. */
export type IconPath = string | IconPathDef;

/** Datos de un icono. `o` = outline, `s` = solid. Un trazado con prefijo "E:" usa la regla evenodd. */
export interface IconDef {
  name: string;
  o: IconPath[];
  s: IconPath[];
  /** Caja del dibujo. Por defecto `0 0 24 24`, la del set; un icono de la aplicación puede traer la suya. */
  viewBox?: string;
  /** Imagen (URL segura) que se dibuja dentro del icono: logotipos a todo color que aporta la aplicación. */
  image?: string;
}

export type IconVariant = "outline" | "solid";
