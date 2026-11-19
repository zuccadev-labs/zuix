"use client";
import { useRef, useState, type ClipboardEvent, type KeyboardEvent, type Ref } from "react";
import { Icon } from "@zuccadev-labs/zuix-zicon/core";
import { addTags, splitTags, type TagRejection, type TagRules } from "../../core/tags";
import { cx } from "../../cx";
import { useControllable } from "../../primitives/hooks";
import { useMergedRef } from "../../refs";
import { ICON_SIZE, type ControlSize } from "../actions/types";
import { useFieldControl } from "./Field";

export interface TagsInputProps extends TagRules {
  value?: ReadonlyArray<string>;
  defaultValue?: ReadonlyArray<string>;
  onValueChange?: (value: string[]) => void;
  /** Etiquetas que no entraron y por qué (repetida, tope, longitud, no válida). */
  onReject?: (rejected: Array<{ tag: string; reason: TagRejection }>) => void;
  /** Caracteres que cierran una etiqueta además de Intro (por defecto, la coma). */
  delimiters?: ReadonlyArray<string>;
  /** Añade lo escrito al salir del campo. */
  addOnBlur?: boolean;
  /** Parte lo pegado en varias etiquetas. */
  addOnPaste?: boolean;
  placeholder?: string;
  size?: ControlSize;
  invalid?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  /** Nombre del campo: cada etiqueta se envía con él. */
  name?: string;
  id?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
  /** Nombre del botón de quitar una etiqueta. */
  removeLabel?: (tag: string) => string;
  /** Anuncios para lectores de pantalla. */
  addedMessage?: (tag: string) => string;
  removedMessage?: (tag: string) => string;
  className?: string;
  ref?: Ref<HTMLInputElement>;
}

const EMPTY: ReadonlyArray<string> = [];

/**
 * Campo de etiquetas: Intro o un delimitador cierran la etiqueta, pegar una lista crea varias, Retroceso con el
 * campo vacío lleva a la última y otro Retroceso la quita, y las flechas recorren las etiquetas. Una sola parada de
 * Tab; los cambios se anuncian en una región `status`.
 */
export function TagsInput({
  value,
  defaultValue = EMPTY,
  onValueChange,
  onReject,
  delimiters = [","],
  addOnBlur = true,
  addOnPaste = true,
  max,
  maxLength,
  allowDuplicates,
  sanitize,
  validate,
  placeholder,
  size = "md",
  invalid,
  disabled,
  readOnly,
  name,
  id,
  "aria-label": ariaLabel,
  "aria-describedby": describedBy,
  removeLabel = (tag) => `Remove ${tag}`,
  addedMessage = (tag) => `${tag} added`,
  removedMessage = (tag) => `${tag} removed`,
  className,
  ref,
}: TagsInputProps) {
  const { invalid: isInvalid, ...control } = useFieldControl({ id, invalid, "aria-describedby": describedBy });
  const [tags, setTags] = useControllable<ReadonlyArray<string>>(value, defaultValue, onValueChange as (v: ReadonlyArray<string>) => void);
  const [text, setText] = useState("");
  const [announce, setAnnounce] = useState("");
  const [rejected, setRejected] = useState(false);
  const input = useRef<HTMLInputElement | null>(null);
  const setRef = useMergedRef(input, ref);
  const box = useRef<HTMLDivElement | null>(null);
  const rules: TagRules = { max, maxLength, allowDuplicates, sanitize, validate };
  const full = max !== undefined && tags.length >= max;
  const off = disabled || readOnly;

  const add = (incoming: string[]) => {
    const result = addTags(tags, incoming, rules);
    if (result.added.length) {
      setTags(result.value);
      setAnnounce(result.added.map(addedMessage).join(". "));
    }
    const real = result.rejected.filter((r) => r.reason !== "empty");
    setRejected(real.length > 0);
    if (real.length) onReject?.(real);
    return result;
  };
  const remove = (index: number) => {
    const tag = tags[index];
    if (tag === undefined || off) return;
    setTags(tags.filter((_, i) => i !== index));
    setAnnounce(removedMessage(tag));
  };
  const tagNode = (index: number) => box.current?.querySelectorAll<HTMLElement>(".z-tags__tag")[index];
  const focusTag = (index: number) => {
    if (index < 0) return;
    if (index >= tags.length) input.current?.focus();
    else tagNode(index)?.focus();
  };
  const commitText = () => {
    if (!text.trim()) return;
    const result = add(splitTags(text, delimiters));
    // Lo que no entró se queda escrito para corregirlo.
    setText(
      result.rejected
        .filter((r) => r.reason !== "empty")
        .map((r) => r.tag)
        .join(delimiters[0] ?? ","),
    );
  };

  const onInputKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;
    const caretAtStart = event.currentTarget.selectionStart === 0 && event.currentTarget.selectionEnd === 0;
    if (event.key === "Enter" && text.trim()) {
      event.preventDefault();
      commitText();
    } else if (delimiters.includes(event.key)) {
      event.preventDefault();
      commitText();
    } else if ((event.key === "Backspace" && text === "") || (event.key === "ArrowLeft" && caretAtStart && tags.length)) {
      if (!tags.length) return;
      event.preventDefault();
      focusTag(tags.length - 1);
    }
  };
  const onTagKey = (index: number, event: KeyboardEvent<HTMLSpanElement>) => {
    const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
    const back = rtl ? "ArrowRight" : "ArrowLeft";
    const forward = rtl ? "ArrowLeft" : "ArrowRight";
    if (event.key === back) {
      event.preventDefault();
      focusTag(Math.max(0, index - 1));
    } else if (event.key === forward) {
      event.preventDefault();
      focusTag(index + 1);
    } else if (event.key === "Backspace" || event.key === "Delete") {
      event.preventDefault();
      remove(index);
      // Tras quitarla, el foco va a la anterior (Retroceso) o a la siguiente (Supr), o al campo.
      requestAnimationFrame(() => {
        const left = tags.length - 1;
        if (!left) input.current?.focus();
        else if (event.key === "Backspace") focusTag(Math.max(0, index - 1));
        else focusTag(Math.min(index, left));
      });
    } else if (event.key === "Escape" || event.key === "End") {
      event.preventDefault();
      input.current?.focus();
    } else if (event.key === "Home") {
      event.preventDefault();
      focusTag(0);
    }
  };
  const onPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    if (!addOnPaste) return;
    const pasted = event.clipboardData.getData("text");
    const parts = splitTags(pasted, delimiters);
    if (parts.length < 2) return;
    event.preventDefault();
    add(parts);
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: pulsar en el recuadro enfoca el campo, como en un campo nativo.
    // biome-ignore lint/a11y/useKeyWithClickEvents: el campo ya es enfocable con teclado.
    <div
      ref={box}
      className={cx("z-input", "z-tags", className)}
      data-size={size}
      data-invalid={isInvalid || rejected || undefined}
      data-disabled={disabled || undefined}
      data-max={max}
      data-max-length={maxLength}
      data-delimiters={delimiters.join("")}
      data-name={name}
      data-allow-duplicates={allowDuplicates || undefined}
      data-readonly={readOnly || undefined}
      data-no-blur={addOnBlur ? undefined : ""}
      data-no-paste={addOnPaste ? undefined : ""}
      onClick={(event) => {
        if (event.target === event.currentTarget) input.current?.focus();
      }}
    >
      {tags.map((tag, index) => (
        // biome-ignore lint/a11y/noStaticElementInteractions: la etiqueta recibe el foco con las flechas para quitarla con Retroceso o Supr.
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: una etiqueta repetida (allowDuplicates) no tiene otra identidad que su posición.
          key={`${tag}-${index}`}
          className="z-tags__tag"
          tabIndex={-1}
          data-value={tag}
          onKeyDown={(event) => onTagKey(index, event)}
        >
          <span className="z-tags__text">{tag}</span>
          {off ? null : (
            <button
              type="button"
              className="z-tags__remove"
              tabIndex={-1}
              aria-label={removeLabel(tag)}
              title={removeLabel(tag)}
              onClick={() => {
                remove(index);
                input.current?.focus();
              }}
            >
              <Icon name="x-mark" size={ICON_SIZE[size] - 2} />
            </button>
          )}
        </span>
      ))}
      <input
        {...control}
        ref={setRef}
        className="z-input__control z-tags__input"
        type="text"
        aria-label={ariaLabel}
        aria-invalid={isInvalid || rejected || undefined}
        autoComplete="off"
        enterKeyHint="enter"
        placeholder={full ? undefined : placeholder}
        disabled={disabled}
        readOnly={readOnly || full}
        maxLength={maxLength}
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          setRejected(false);
        }}
        onKeyDown={onInputKey}
        onPaste={onPaste}
        onBlur={() => {
          if (addOnBlur) commitText();
        }}
      />
      <span className="z-sr-only" role="status">
        {announce}
      </span>
      {name
        ? tags.map((tag, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: una etiqueta repetida (allowDuplicates) no tiene otra identidad que su posición.
            <input key={`${tag}-${index}`} type="hidden" name={name} value={tag} />
          ))
        : null}
    </div>
  );
}
