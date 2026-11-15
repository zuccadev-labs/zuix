"use client";
import { useState, type Ref } from "react";
import { Select as RadixSelect } from "radix-ui";
import { Icon, type IconName } from "@zuccadev-labs/zuix-zicon/core";
import { cx } from "../../cx";
import { ICON_SIZE, type ControlSize } from "../actions/types";
import { useFieldControl } from "./Field";

export interface SelectOption {
  value: string;
  label: string;
  icon?: IconName;
  disabled?: boolean;
}

export interface SelectOptionGroup {
  /** Título del grupo. */
  label: string;
  options: ReadonlyArray<SelectOption>;
}

export interface SelectProps {
  /** Opciones sueltas, grupos `{ label, options }` o una mezcla de ambos. */
  options: ReadonlyArray<SelectOption | SelectOptionGroup>;
  /** Valor elegido; cadena vacía muestra el placeholder. */
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  placeholder?: string;
  size?: ControlSize;
  invalid?: boolean;
  disabled?: boolean;
  required?: boolean;
  /** Nombre del campo al enviar un formulario. */
  name?: string;
  /** Ancho completo (por defecto) o intrínseco. */
  block?: boolean;
  /** Alineación del popup respecto al control. */
  align?: "start" | "center" | "end";
  id?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  /** Clase de la envoltura. */
  className?: string;
  /** Clase del popup. */
  popupClassName?: string;
  ref?: Ref<HTMLButtonElement>;
}

const isGroup = (entry: SelectOption | SelectOptionGroup): entry is SelectOptionGroup => "options" in entry;

function Option({ option, size }: { option: SelectOption; size: ControlSize }) {
  return (
    <RadixSelect.Item className="z-listbox__option" value={option.value} disabled={option.disabled} textValue={option.label}>
      {option.icon ? (
        <span className="z-listbox__icon">
          <Icon name={option.icon} size={ICON_SIZE[size]} />
        </span>
      ) : null}
      <span className="z-listbox__text">
        <RadixSelect.ItemText>{option.label}</RadixSelect.ItemText>
      </span>
      <span className="z-listbox__check">
        <Icon name="check" size={ICON_SIZE[size]} />
      </span>
    </RadixSelect.Item>
  );
}

/** Lista desplegable con popup propio (material liquid), iconos y grupos. Para la lista del sistema, `NativeSelect`. */
export function Select({
  options,
  value,
  defaultValue = "",
  onValueChange,
  open,
  defaultOpen,
  onOpenChange,
  placeholder,
  size = "md",
  invalid,
  disabled,
  required,
  name,
  block = true,
  align = "start",
  id,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "aria-describedby": describedBy,
  className,
  popupClassName,
  ref,
}: SelectProps) {
  const { invalid: isInvalid, required: isRequired, ...control } = useFieldControl({ id, invalid, required, "aria-describedby": describedBy });
  const [inner, setInner] = useState(defaultValue);
  const current = value ?? inner;
  const flat = options.flatMap((entry) => (isGroup(entry) ? entry.options : [entry]));
  const selected = flat.find((option) => option.value === current);

  const change = (next: string) => {
    setInner(next);
    onValueChange?.(next);
  };

  return (
    <RadixSelect.Root value={current} onValueChange={change} open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange} disabled={disabled} required={isRequired} name={name}>
      <span className={cx("z-select", className)} data-size={size} data-block={block || undefined} data-invalid={isInvalid || undefined} data-disabled={disabled || undefined}>
        <RadixSelect.Trigger {...control} ref={ref} className="z-select__control" aria-label={ariaLabel} aria-labelledby={ariaLabelledBy}>
          {selected?.icon ? (
            <span className="z-select__icon">
              <Icon name={selected.icon} size={ICON_SIZE[size]} />
            </span>
          ) : null}
          <span className="z-select__value">
            <RadixSelect.Value placeholder={placeholder}>{selected?.label ?? current}</RadixSelect.Value>
          </span>
        </RadixSelect.Trigger>
        <span className="z-select__chevron">
          <Icon name="chevron-down" size={ICON_SIZE[size]} />
        </span>
      </span>
      <RadixSelect.Portal>
        <RadixSelect.Content className={cx("z-liquid z-listbox", popupClassName)} data-size={size} position="popper" side="bottom" align={align} sideOffset={4} collisionPadding={8}>
          <RadixSelect.Viewport className="z-listbox__viewport">
            {options.map((entry, index) =>
              isGroup(entry) ? (
                <RadixSelect.Group key={`group-${index}`} className="z-listbox__group">
                  <RadixSelect.Label className="z-listbox__label">{entry.label}</RadixSelect.Label>
                  {entry.options.map((option) => (
                    <Option key={option.value} option={option} size={size} />
                  ))}
                </RadixSelect.Group>
              ) : (
                <Option key={entry.value} option={entry} size={size} />
              ),
            )}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
}
