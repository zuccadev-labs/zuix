import { FIELD_TEXTS } from "../../core/segments";
import { SegmentedField, type SegmentedFieldProps } from "./segmented.internal";
import { withRef } from "../../react-compat";

export interface TimeFieldProps extends SegmentedFieldProps {
  /** Añade el segmento de segundos: el valor pasa de `HH:mm` a `HH:mm:ss`. */
  showSeconds?: boolean;
}

/**
 * Hora de reloj que se teclea por segmentos (hora, minuto, segundo, AM/PM). El valor es `HH:mm` o `HH:mm:ss` en
 * 24 h; 12 h es solo presentación. `min` y `max` pueden cruzar la medianoche (`22:00`–`02:00`).
 */
export const TimeField = withRef(function TimeField({ showSeconds, ...props }: TimeFieldProps) {
  return (
    <SegmentedField {...props} time granularity={showSeconds ? "second" : "minute"} rootClassName="z-timefield" texts={FIELD_TEXTS.time} />
  );
});
