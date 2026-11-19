"use client";
// Binding de React del campo por segmentos que comparten DateField, TimeField y TimePicker. La lógica (orden de los
// segmentos, teclado, pegado, validez) vive en ../../core/segments; aquí solo se pinta y se conectan los eventos.
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type FocusEvent,
  type KeyboardEvent,
  type KeyboardEventHandler,
  type PointerEvent,
  type ReactNode,
  type Ref,
} from "react";
import { Icon } from "@zuccadev-labs/zuix-zicon/core";
import { logicalKey } from "../../core/dir";
import {
  bounds,
  fieldConfig,
  firstEditable,
  isEmpty,
  SEGMENT_LABELS,
  SEGMENT_PLACEHOLDERS,
  parsePasted,
  segmentKey,
  segmentText,
  segmentValueText,
  validity,
  fieldValue,
  valuesFrom,
  type FieldConfig,
  type FieldState,
  type Granularity,
  type SegmentType,
  type Validity,
} from "../../core/segments";
import { cx } from "../../cx";
import { useLatest } from "../../primitives/hooks";
import { useMergedRef } from "../../refs";
import { ICON_SIZE, type ControlSize } from "../actions/types";
import { useFieldControl, useFieldLabel } from "./Field";

export type { SegmentType };

export interface SegmentedFieldProps {
  /** Valor ISO; `null` mientras el campo está vacío o incompleto. */
  value?: string | null;
  defaultValue?: string | null;
  /** Cada cambio del valor: el ISO cuando todos los segmentos forman un valor que existe, si no `null`. */
  onValueChange?: (value: string | null) => void;
  /** Valor mínimo (ISO). Fuera de `min`/`max` el valor se emite, pero el campo queda inválido al salir. */
  min?: string;
  max?: string;
  /** 12 o 24 h. Por defecto, el ciclo del locale. */
  hourCycle?: 12 | 24;
  /** Paso de las flechas en los minutos. */
  minuteStep?: number;
  /** Paso de las flechas en los segundos. */
  secondStep?: number;
  /** Valor que siembran las flechas en un segmento vacío. Por defecto, hoy a las 00:00. */
  placeholderValue?: string;
  /** Mes, día y hora con dos cifras. */
  forceLeadingZeros?: boolean;
  /** Botón para vaciar el campo. */
  clearable?: boolean;
  clearLabel?: string;
  size?: ControlSize;
  invalid?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  /** Nombre del campo al enviar un formulario: el valor ISO. */
  name?: string;
  form?: string;
  /** Etiqueta BCP 47: orden de los segmentos, separadores, dígitos y ciclo horario. */
  locale?: string;
  /** Nombre accesible de cada segmento. */
  segmentLabels?: Partial<Record<SegmentType, string>>;
  /** Texto visible de cada segmento vacío. */
  segmentPlaceholders?: Partial<Record<SegmentType, string>>;
  /** Texto que anuncia el lector de pantalla en un segmento vacío. */
  emptyLabel?: string;
  /** Mensaje de validación nativo con algún segmento vacío. */
  incompleteMessage?: string;
  /** Mensaje de validación nativo cuando la fecha no existe (31 de febrero). */
  invalidMessage?: string;
  /** Mensaje de validación nativo fuera de `min`/`max`. */
  rangeMessage?: string;
  id?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  className?: string;
  /** Se pinta dentro del campo, tras los segmentos (p. ej. un botón que abre un calendario). */
  children?: ReactNode;
  /** Teclado del grupo; llega después de que el segmento haya atendido la tecla (`defaultPrevented`). */
  onKeyDown?: KeyboardEventHandler<HTMLDivElement>;
  ref?: Ref<HTMLDivElement>;
}

interface InternalProps extends SegmentedFieldProps {
  time?: boolean;
  granularity: Granularity;
  rootClassName?: string;
  /** Atributos `data-*` de configuración que añade la variante (TimePicker), los mismos que lee el modo DOM. */
  data?: Record<`data-${string}`, string | number | undefined>;
  /** Textos por defecto de la variante (fecha u hora). */
  texts: { group: string; incomplete: string; invalid: string; range: string };
}

const MESSAGES: Record<Validity, "incomplete" | "invalid" | "range" | null> = {
  empty: null,
  valid: null,
  incomplete: "incomplete",
  invalid: "invalid",
  outOfRange: "range",
};

/** Campo por segmentos (spinbuttons de APG en un `role="group"`). Uso interno: DateField, TimeField, TimePicker. */
export function SegmentedField(props: InternalProps) {
  const {
    value,
    defaultValue,
    onValueChange,
    min,
    max,
    hourCycle,
    minuteStep,
    secondStep,
    placeholderValue,
    forceLeadingZeros,
    clearable,
    clearLabel = "Clear",
    size = "md",
    invalid,
    disabled,
    readOnly,
    required,
    name,
    form,
    locale,
    segmentLabels,
    segmentPlaceholders,
    emptyLabel = "Empty",
    incompleteMessage,
    invalidMessage,
    rangeMessage,
    id,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledBy,
    "aria-describedby": describedBy,
    className,
    children,
    onKeyDown,
    ref,
    time,
    granularity,
    rootClassName,
    data,
    texts,
  } = props;
  const config = useMemo(
    () => fieldConfig({ locale, time, granularity, hourCycle, minuteStep, secondStep, min, max, placeholderValue, forceLeadingZeros }),
    [locale, time, granularity, hourCycle, minuteStep, secondStep, min, max, placeholderValue, forceLeadingZeros],
  );
  const {
    invalid: fieldInvalid,
    required: isRequired,
    ...control
  } = useFieldControl({ id, invalid, required, "aria-describedby": describedBy });
  const fieldLabel = useFieldLabel();
  const group = useRef<HTMLDivElement | null>(null);
  const setGroup = useMergedRef(group, ref);
  const native = useRef<HTMLInputElement | null>(null);
  const segments = useRef<Array<HTMLElement | null>>([]);

  const [state, setState] = useState<FieldState>(() => ({ values: valuesFrom(value ?? defaultValue ?? null, config), typed: null }));
  // Valor controlado: un `value` nuevo que no es el último emitido rehace los segmentos.
  const [synced, setSynced] = useState(value);
  const [shownConfig, setShownConfig] = useState<FieldConfig>(config);
  if (config !== shownConfig) {
    // Otro locale o ciclo horario: la hora mostrada cambia de significado; se recalcula desde el valor.
    setShownConfig(config);
    setState({ values: valuesFrom(value ?? fieldValue(state.values, shownConfig), config), typed: null });
  } else if (value !== undefined && value !== synced) {
    setSynced(value);
    setState({ values: valuesFrom(value, config), typed: null });
  }
  const [active, setActive] = useState(0);
  const [userInvalid, setUserInvalid] = useState(false);
  // Un nodo que el navegador haya tocado por su cuenta (composición de texto) se monta de nuevo.
  const [generation, setGeneration] = useState(0);
  const edited = useRef(false);
  const latest = useLatest({ state, config });

  const iso = fieldValue(state.values, config);
  const status = validity(state.values, config);
  const message = MESSAGES[status];
  const messages = {
    incomplete: incompleteMessage ?? texts.incomplete,
    invalid: invalidMessage ?? texts.invalid,
    range: rangeMessage ?? texts.range,
  };
  const isInvalid = fieldInvalid || userInvalid;
  const editable = !disabled && !readOnly;

  const commit = (next: FieldState) => {
    const before = fieldValue(latest.current.state.values, config);
    latest.current = { state: next, config };
    setState(next);
    edited.current = true;
    const after = fieldValue(next.values, config);
    const nextStatus = validity(next.values, config);
    if (userInvalid && (nextStatus === "valid" || nextStatus === "empty")) setUserInvalid(false);
    if (after !== before) {
      setSynced(after);
      onValueChange?.(after);
    }
  };

  const focusSegment = (index: number) => {
    if (index < 0 || index >= config.types.length) return;
    setActive(index);
    segments.current[index]?.focus();
  };

  /** Una tecla (o un carácter de `beforeinput`) en el segmento `index`. Devuelve si el campo la atendió. */
  const apply = (index: number, key: string): boolean => {
    const type = config.types[index];
    if (!type) return false;
    const current = latest.current.state;
    const outcome = segmentKey(current, type, key, config, !editable);
    if (!outcome.handled) return false;
    if (outcome.state !== current) commit(outcome.state);
    if (outcome.focus) focusSegment(index + (outcome.focus === "next" ? 1 : -1));
    return true;
  };
  const applyLatest = useLatest(apply);

  const onSegmentKeyDown = (index: number, event: KeyboardEvent<HTMLElement>) => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.key === "Tab" || event.key === "Escape") return;
    if (event.key === "Enter") {
      // Como en un campo nativo: Intro envía el formulario y no escribe un salto de línea.
      event.preventDefault();
      native.current?.form?.requestSubmit();
      return;
    }
    if (apply(index, logicalKey(event.key, event.currentTarget))) event.preventDefault();
  };

  const onPaste = (event: ClipboardEvent<HTMLElement>) => {
    event.preventDefault();
    if (!editable) return;
    const pasted = parsePasted(event.clipboardData?.getData("text") ?? "", config);
    if (pasted) commit({ values: { ...latest.current.state.values, ...pasted }, typed: null });
  };

  // Teclados virtuales (Android) y dictado: llegan como `beforeinput` sin tecla reconocible. React no expone el
  // evento nativo, así que se escucha en el grupo.
  useEffect(() => {
    const el = group.current;
    if (!el) return;
    const segmentAt = (target: EventTarget | null) => (target instanceof Element ? target.closest<HTMLElement>("[data-segment]") : null);
    const onBeforeInput = (event: Event) => {
      const segment = segmentAt(event.target);
      if (!segment) return;
      event.preventDefault();
      const index = segments.current.indexOf(segment);
      const input = event as InputEvent;
      if (input.inputType === "insertText" && input.data) for (const ch of input.data) applyLatest.current(index, ch);
      else if (input.inputType.startsWith("delete")) applyLatest.current(index, "Backspace");
    };
    const onInput = (event: Event) => {
      if (segmentAt(event.target)) setGeneration((n) => n + 1);
    };
    el.addEventListener("beforeinput", onBeforeInput);
    el.addEventListener("input", onInput);
    return () => {
      el.removeEventListener("beforeinput", onBeforeInput);
      el.removeEventListener("input", onInput);
    };
  }, [applyLatest]);

  // Validez nativa del campo oculto: incompleto, fecha que no existe o fuera de rango.
  useEffect(() => {
    native.current?.setCustomValidity(message ? messages[message] : "");
  });

  // Formulario: `form.reset()` vuelve al valor inicial; un envío inválido marca el campo y le lleva el foco.
  const initial = useRef(defaultValue ?? null);
  const handlers = useLatest({
    reset: () => {
      commit({ values: valuesFrom(initial.current, config), typed: null });
      edited.current = false;
      setUserInvalid(false);
    },
    invalid: () => setUserInvalid(true),
  });
  useEffect(() => {
    const field = native.current;
    const owner = field?.form;
    if (!field) return;
    const onReset = () => setTimeout(() => handlers.current.reset(), 0);
    const onInvalid = () => handlers.current.invalid();
    owner?.addEventListener("reset", onReset);
    field.addEventListener("invalid", onInvalid);
    return () => {
      owner?.removeEventListener("reset", onReset);
      field.removeEventListener("invalid", onInvalid);
    };
  }, [handlers]);

  const onBlur = (event: FocusEvent<HTMLDivElement>) => {
    const current = latest.current.state;
    // Al dejar un segmento se olvida lo tecleado: el año escrito con dos cifras se muestra relleno.
    if (current.typed) {
      latest.current = { state: { ...current, typed: null }, config };
      setState(latest.current.state);
    }
    if (group.current?.contains(event.relatedTarget as Node | null)) return;
    // Validar al salir, y solo si se editó (guía de formularios): no se avisa mientras se teclea.
    if (!edited.current) return;
    edited.current = false;
    const result = validity(current.values, config);
    setUserInvalid(result === "incomplete" || result === "invalid" || result === "outOfRange");
  };

  // Pulsar en el campo fuera de un segmento (un separador, el hueco) enfoca el primer segmento vacío.
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const target = event.target as Element;
    if (disabled || event.button !== 0 || target.closest("[data-segment], button, a, input")) return;
    event.preventDefault();
    focusSegment(firstEditable(latest.current.state.values, config));
  };

  const clear = () => {
    commit({ values: {}, typed: null });
    focusSegment(0);
  };

  const groupName =
    ariaLabel !== undefined
      ? { "aria-label": ariaLabel }
      : ariaLabelledBy
        ? { "aria-labelledby": ariaLabelledBy }
        : fieldLabel
          ? { "aria-labelledby": fieldLabel }
          : { "aria-label": texts.group };
  const tabbable = Math.min(active, config.types.length - 1);
  let segmentIndex = -1;

  return (
    <div
      {...groupName}
      {...data}
      ref={setGroup}
      role="group"
      id={control.id}
      aria-describedby={control["aria-describedby"]}
      className={cx("z-input", "z-datefield", rootClassName, className)}
      data-size={size}
      data-invalid={isInvalid || undefined}
      data-disabled={disabled || undefined}
      data-readonly={readOnly || undefined}
      data-locale={locale}
      data-granularity={granularity}
      data-hour-cycle={hourCycle}
      data-minute-step={minuteStep}
      data-second-step={secondStep}
      data-min={min}
      data-max={max}
      data-placeholder-value={placeholderValue}
      data-leading-zeros={forceLeadingZeros === false ? "false" : undefined}
      data-clearable={clearable || undefined}
      data-value={iso ?? undefined}
      onKeyDown={onKeyDown}
      onBlur={onBlur}
      onPointerDown={onPointerDown}
    >
      <span className="z-datefield__input">
        {config.parts.map((part, i) => {
          if (part.type === "literal")
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: el separador es su posición en el formato del locale.
              <span key={`l${i}`} className="z-datefield__literal" aria-hidden="true">
                {part.text}
              </span>
            );
          const type = part.type;
          const index = ++segmentIndex;
          const text = segmentText(type, state, config);
          const [lo, hi] = bounds(type, state.values, config);
          return (
            <span
              key={`${type}-${generation}`}
              ref={(node) => {
                segments.current[index] = node;
              }}
              role="spinbutton"
              className="z-datefield__segment"
              data-segment={type}
              data-placeholder={text === null ? "" : undefined}
              tabIndex={disabled ? undefined : index === tabbable ? 0 : -1}
              contentEditable={editable || undefined}
              suppressContentEditableWarning
              inputMode={type === "dayPeriod" ? "text" : "numeric"}
              spellCheck={false}
              autoCorrect="off"
              autoCapitalize="off"
              enterKeyHint="next"
              aria-label={segmentLabels?.[type] ?? SEGMENT_LABELS[type]}
              aria-valuemin={lo}
              aria-valuemax={hi}
              aria-valuenow={state.values[type]}
              aria-valuetext={segmentValueText(type, state, config) ?? emptyLabel}
              aria-invalid={isInvalid || undefined}
              aria-readonly={readOnly || undefined}
              aria-disabled={disabled || undefined}
              aria-required={isRequired || undefined}
              onKeyDown={(event) => onSegmentKeyDown(index, event)}
              onFocus={() => {
                setActive(index);
                const current = latest.current.state;
                if (current.typed && current.typed.type !== type) setState({ ...current, typed: null });
              }}
              onPaste={onPaste}
            >
              {text ?? segmentPlaceholders?.[type] ?? SEGMENT_PLACEHOLDERS[type]}
            </span>
          );
        })}
      </span>
      {clearable ? (
        <button
          type="button"
          className="z-input__action z-datefield__clear"
          aria-label={clearLabel}
          title={clearLabel}
          // Fuera del orden de Tab (como el de React Aria): con teclado se vacía con Retroceso o Supr.
          tabIndex={-1}
          hidden={isEmpty(state.values) || !editable}
          onClick={clear}
        >
          <Icon name="x-mark" size={ICON_SIZE[size]} />
        </button>
      ) : null}
      {children}
      {/* Campo nativo oculto: lleva el valor al formulario y su validez (obligatorio, incompleto, fuera de rango). */}
      <input
        ref={native}
        type="text"
        className="z-native-input"
        aria-hidden="true"
        tabIndex={-1}
        name={name}
        form={form}
        value={iso ?? ""}
        required={isRequired}
        disabled={disabled}
        onChange={noop}
        // La validación nativa enfoca el campo inválido: el foco pasa al primer segmento vacío.
        onFocus={() => focusSegment(firstEditable(latest.current.state.values, config))}
      />
    </div>
  );
}

const noop = () => {};
