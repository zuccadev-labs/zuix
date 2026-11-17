"use client";
import { useRef, type InputHTMLAttributes, type Ref } from "react";
import { Icon } from "@zuccadev-labs/zuix-zicon/core";
import { cx } from "../../cx";
import { ICON_SIZE, type ControlSize } from "../actions/types";
import { useMergedRef } from "../../refs";
import { useFieldControl } from "./Field";

export interface DateInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size" | "type"> {
  /** Tipo de valor: fecha, hora, fecha y hora, o mes. */
  type?: "date" | "time" | "datetime-local" | "month";
  size?: ControlSize;
  invalid?: boolean;
  /** Nombre accesible del botón que abre el selector nativo. */
  pickerLabel?: string;
  ref?: Ref<HTMLInputElement>;
}

/** Campo de fecha u hora sobre el control nativo: valor ISO, teclado y selector del sistema. */
export function DateInput({ type = "date", size = "md", invalid, pickerLabel = "Open picker", className, id, required, ref, "aria-describedby": describedBy, ...rest }: DateInputProps) {
  const { invalid: isInvalid, ...control } = useFieldControl({ id, invalid, required, "aria-describedby": describedBy });
  const inner = useRef<HTMLInputElement | null>(null);
  // Une la ref interna (para abrir el selector) con la ref recibida.
  const setRef = useMergedRef(inner, ref);
  const openPicker = () => {
    const node = inner.current;
    if (!node) return;
    try {
      node.showPicker();
    } catch {
      // Navegadores sin showPicker: basta con enfocar el campo.
      node.focus();
    }
  };
  return (
    <span className={cx("z-input", "z-input--date", className)} data-size={size} data-invalid={isInvalid || undefined} data-disabled={rest.disabled || undefined}>
      <input {...rest} {...control} ref={setRef} type={type} className="z-input__control" />
      <button type="button" className="z-input__action" aria-label={pickerLabel} title={pickerLabel} onClick={openPicker} disabled={rest.disabled || rest.readOnly}>
        <Icon name={type === "time" ? "clock" : "calendar"} size={ICON_SIZE[size]} />
      </button>
    </span>
  );
}
