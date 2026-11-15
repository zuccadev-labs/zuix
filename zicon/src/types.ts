/** Datos de un icono. `o` = outline, `s` = solid. Un trazado con prefijo "E:" usa la regla evenodd. */
export interface IconDef {
  name: string;
  o: string[];
  s: string[];
}

export type IconVariant = "outline" | "solid";
