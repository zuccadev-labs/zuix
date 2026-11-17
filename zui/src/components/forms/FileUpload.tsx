"use client";
import { useId, useRef, useState, type DragEvent, type ReactNode } from "react";
import { Icon, type IconName } from "@zuccadev-labs/zuix-zicon/core";
import { matchesAccept } from "../../core/accept";
import { cx } from "../../cx";
import { useFieldControl } from "./Field";

export interface FileUploadProps {
  /** Recibe los archivos elegidos o soltados (ya filtrados por `accept` y `maxSize`). */
  onFiles: (files: File[]) => void;
  /** Recibe los archivos descartados por tipo o tamaño. */
  onReject?: (files: File[]) => void;
  /** Igual que el atributo `accept` de un input de archivos. */
  accept?: string;
  multiple?: boolean;
  /** Tamaño máximo por archivo, en bytes. */
  maxSize?: number;
  disabled?: boolean;
  invalid?: boolean;
  icon?: IconName;
  /** Texto principal de la zona. */
  label?: ReactNode;
  /** Texto secundario (formatos, límite). */
  hint?: ReactNode;
  size?: "md" | "lg";
  name?: string;
  id?: string;
  className?: string;
  /** Contenido extra bajo los textos (por ejemplo, la lista de archivos). */
  children?: ReactNode;
}

// Comprueba un archivo contra una lista `accept` (extensiones, tipos MIME y comodines).
// Deja en el campo solo los archivos aceptados: el formulario envía lo mismo que recibió `onFiles`.
function keep(input: HTMLInputElement | null, files: File[]): void {
  if (!input) return;
  try {
    const transfer = new DataTransfer();
    for (const file of files) transfer.items.add(file);
    input.files = transfer.files;
  } catch {
    // Navegador sin DataTransfer construible: el campo queda como estaba.
  }
}

/** Zona para elegir o soltar archivos. No guarda estado: entrega los archivos por `onFiles`. */
export function FileUpload({
  onFiles,
  onReject,
  accept,
  multiple,
  maxSize,
  disabled,
  invalid,
  icon = "arrow-up-tray",
  label = "Drop files here or click to browse",
  hint,
  size = "md",
  name,
  id,
  className,
  children,
}: FileUploadProps) {
  const control = useFieldControl({ id, invalid });
  const hintId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const deliver = (list: FileList | null) => {
    const all = Array.from(list ?? []);
    const picked = multiple ? all : all.slice(0, 1);
    const accepted = picked.filter((file) => matchesAccept(file, accept) && (maxSize === undefined || file.size <= maxSize));
    const rejected = picked.filter((file) => !accepted.includes(file));
    if (accepted.length) onFiles(accepted);
    if (rejected.length) onReject?.(rejected);
    return accepted;
  };
  const onDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragging(false);
    if (disabled) return;
    const accepted = deliver(event.dataTransfer.files);
    if (name) keep(input.current, accepted);
  };

  return (
    <label
      className={cx("z-upload", className)}
      data-size={size}
      data-dragging={dragging || undefined}
      data-invalid={control.invalid || undefined}
      data-disabled={disabled || undefined}
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={(event) => {
        // Pasar sobre un hijo de la zona no es salir de ella.
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={onDrop}
    >
      <input
        ref={input}
        id={control.id}
        className="z-upload__input z-sr-only"
        type="file"
        name={name}
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        aria-invalid={control["aria-invalid"]}
        aria-describedby={[hint ? hintId : undefined, control["aria-describedby"]].filter(Boolean).join(" ") || undefined}
        onChange={(event) => {
          const accepted = deliver(event.target.files);
          // Con `name` el campo conserva lo aceptado para enviarlo con el formulario. Sin él se vacía, y así se
          // puede volver a elegir el mismo archivo.
          if (name) keep(event.target, accepted);
          else event.target.value = "";
        }}
      />
      <span className="z-upload__icon">
        <Icon name={icon} size={size === "lg" ? 24 : 20} />
      </span>
      <span className="z-upload__label">{label}</span>
      {hint ? (
        <span className="z-upload__hint" id={hintId}>
          {hint}
        </span>
      ) : null}
      {children}
    </label>
  );
}
