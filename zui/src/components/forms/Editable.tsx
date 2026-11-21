"use client";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Icon } from "@zuccadev-labs/zuix-zicon/core";
import { cx } from "../../cx";
import { useControllable } from "../../primitives/hooks";
import { ICON_SIZE, type ControlSize } from "../actions/types";

export interface EditableProps {
  value?: string;
  defaultValue?: string;
  /** Se llama al guardar (Intro, salir del campo o el botón de guardar), no en cada tecla. */
  onValueChange?: (value: string) => void;
  /** Nombre accesible del texto («Project name»). */
  label: string;
  placeholder?: string;
  /** Cómo se entra a editar: clic, foco, doble clic o solo con el botón de editar. */
  activationMode?: "click" | "focus" | "dblclick" | "none";
  /** Salir del campo guarda (`true`, por defecto) o descarta. */
  submitOnBlur?: boolean;
  /** Varias líneas (textarea): Intro hace salto de línea y Ctrl/⌘+Intro guarda. */
  multiline?: boolean;
  /** Botones de editar, guardar y cancelar. */
  controls?: boolean;
  editing?: boolean;
  defaultEditing?: boolean;
  onEditingChange?: (editing: boolean) => void;
  editLabel?: string;
  saveLabel?: string;
  cancelLabel?: string;
  /** Aviso que se lee con el texto («Press Enter to edit»). */
  hint?: string;
  maxLength?: number;
  required?: boolean;
  disabled?: boolean;
  size?: ControlSize;
  /** Campo oculto con el valor guardado. */
  name?: string;
  className?: string;
}

/**
 * Texto que se edita en su sitio: se ve como texto y, al activarlo, pasa a ser un campo con el mismo tamaño. Intro
 * guarda, Escape cancela y el foco vuelve al texto. El mismo marcado (texto y campo, uno oculto) sirve al modo DOM.
 */
export function Editable({
  value,
  defaultValue = "",
  onValueChange,
  label,
  placeholder = "Empty",
  activationMode = "click",
  submitOnBlur = true,
  multiline,
  controls,
  editing: editingProp,
  defaultEditing = false,
  onEditingChange,
  editLabel = "Edit",
  saveLabel = "Save",
  cancelLabel = "Cancel",
  hint = "Press Enter to edit",
  maxLength,
  required,
  disabled,
  size = "md",
  name,
  className,
}: EditableProps) {
  const auto = useId();
  const [saved, setSaved] = useControllable(value, defaultValue, onValueChange);
  const [editing, setEditing] = useControllable(editingProp, defaultEditing, onEditingChange);
  const [draft, setDraft] = useState(saved);
  const field = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const preview = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef(false);
  const px = ICON_SIZE[size];

  useEffect(() => {
    if (editing) {
      field.current?.focus();
      field.current?.select();
    } else if (returnFocus.current) {
      // Al volver el foco al texto no se vuelve a entrar en edición (activación por foco).
      preview.current?.focus();
      returnFocus.current = false;
    }
  }, [editing]);

  const start = () => {
    if (disabled || editing) return;
    setDraft(saved);
    setEditing(true);
  };
  const finish = (save: boolean) => {
    if (!editing) return;
    const next = draft;
    if (save && required && !next.trim()) return;
    returnFocus.current = true;
    setEditing(false);
    if (save) setSaved(next);
    else setDraft(saved);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      finish(false);
    } else if (event.key === "Enter" && (!multiline || event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      finish(true);
    }
  };
  const Field = multiline ? "textarea" : "input";

  return (
    <div
      className={cx("z-editable", className)}
      data-size={size}
      data-state={editing ? "edit" : "preview"}
      data-activation={activationMode}
      data-multiline={multiline || undefined}
      data-disabled={disabled || undefined}
      data-required={required || undefined}
      data-keep={submitOnBlur ? undefined : ""}
      data-value={saved}
      data-placeholder={placeholder}
    >
      <span id={`${auto}-hint`} className="z-sr-only">
        {hint}
      </span>
      <button
        ref={preview}
        type="button"
        className="z-editable__preview"
        hidden={editing}
        disabled={disabled}
        aria-describedby={activationMode === "none" ? undefined : `${auto}-hint`}
        tabIndex={activationMode === "none" ? -1 : undefined}
        data-placeholder={saved ? undefined : ""}
        onClick={activationMode === "click" ? start : undefined}
        onDoubleClick={activationMode === "dblclick" ? start : undefined}
        onFocus={activationMode === "focus" ? () => (returnFocus.current ? undefined : start()) : undefined}
        onKeyDown={(event) => {
          // Con doble clic o sin activación propia, Intro también entra a editar desde el teclado.
          if ((event.key === "Enter" || event.key === "F2") && activationMode !== "none") {
            event.preventDefault();
            start();
          }
        }}
      >
        {/* El nombre es la etiqueta (oculta) más el texto visible: lo que se lee contiene lo que se ve. */}
        <span className="z-sr-only">{`${label}: `}</span>
        <span className="z-editable__text">{saved || placeholder}</span>
      </button>
      <Field
        ref={field}
        className="z-editable__input"
        hidden={!editing}
        aria-label={label}
        value={draft}
        maxLength={maxLength}
        required={required}
        disabled={disabled}
        placeholder={placeholder}
        rows={multiline ? 3 : undefined}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={onKeyDown}
        onBlur={(event) => {
          // Pulsar en un botón propio (guardar, cancelar) no cuenta como salir.
          if (event.relatedTarget instanceof Node && event.currentTarget.parentElement?.contains(event.relatedTarget)) return;
          finish(submitOnBlur);
        }}
      />
      {controls ? (
        // Los tres botones están siempre en el marcado (el modo DOM los usa); el estado decide cuáles se ven.
        <span className="z-editable__controls">
          <button
            type="button"
            className="z-btn z-btn--ghost z-btn--icon"
            data-size="sm"
            data-action="edit"
            aria-label={`${editLabel} ${label}`}
            title={editLabel}
            disabled={disabled}
            onClick={start}
          >
            <Icon name="pencil" size={px} />
          </button>
          <button
            type="button"
            className="z-btn z-btn--ghost z-btn--icon"
            data-size="sm"
            data-action="save"
            aria-label={saveLabel}
            title={saveLabel}
            onClick={() => finish(true)}
          >
            <Icon name="check" size={px} />
          </button>
          <button
            type="button"
            className="z-btn z-btn--ghost z-btn--icon"
            data-size="sm"
            data-action="cancel"
            aria-label={cancelLabel}
            title={cancelLabel}
            onClick={() => finish(false)}
          >
            <Icon name="x-mark" size={px} />
          </button>
        </span>
      ) : null}
      {name ? <input type="hidden" name={name} value={saved} /> : null}
    </div>
  );
}
