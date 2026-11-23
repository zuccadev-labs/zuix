import { FIELD_TEXTS, type Granularity } from "../../core/segments";
import { SegmentedField, type SegmentedFieldProps } from "./segmented.internal";
import { withRef } from "../../react-compat";

export interface DateFieldProps extends SegmentedFieldProps {
  /**
   * Segmento más fino. `day` (por defecto): valor `YYYY-MM-DD`. `hour`, `minute` o `second` añaden la hora y el valor
   * pasa a `YYYY-MM-DDTHH:mm[:ss]`, sin zona.
   */
  granularity?: Granularity;
}

/**
 * Fecha (y hora) que se teclea por segmentos: un spinbutton por día, mes y año (y hora, minuto, segundo, AM/PM) en el
 * orden del locale. Admite pegar una fecha completa. Valor ISO civil, sin zona.
 */
export const DateField = withRef(function DateField({ granularity = "day", ...props }: DateFieldProps) {
  return <SegmentedField {...props} granularity={granularity} texts={FIELD_TEXTS.date} />;
});
