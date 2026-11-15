"use client";
import { useId, useRef, useState, type DragEvent, type ReactNode } from "react";
import { Icon, type IconName } from "@zuccadev-labs/zuix-zicon/core";
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
function matchesAccept(file: File, accept?: string): boolean {
  if (!accept) return true;
  const rules = accept.split(",").map((rule) => rule.trim().toLowerCase()).filter(Boolean);
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return rules.some((rule) => (rule.startsWith(".") ? name.endsWith(rule) : rule.endsWith("/*") ? type.startsWith(rule.slice(0, -1)) : type === rule));
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
  };
  const onDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragging(false);
    if (!disabled) deliver(event.dataTransfer.files);
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
      onDragLeave={() => setDragging(false)}
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
          deliver(event.target.files);
          // Permite volver a elegir el mismo archivo.
          event.target.value = "";
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
