"use client";
import { useEffect, useId, useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";
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
  /** Contenido extra bajo los textos. */
  children?: ReactNode;
  /**
   * Lista de archivos elegidos dentro de la zona, con miniatura de las imágenes, tamaño, progreso y botón de quitar.
   * Sin `files`, la lista la lleva el componente (acumula con `multiple`).
   */
  showFiles?: boolean;
  /** Lista controlada (con `showFiles`). */
  files?: ReadonlyArray<File>;
  /** Se quitó un archivo de la lista. */
  onRemove?: (file: File) => void;
  /** Progreso de subida de un archivo, de 0 a 100 (`undefined`: sin barra). */
  progress?: (file: File) => number | undefined;
  /** Nombre del botón de quitar. */
  removeLabel?: (file: File) => string;
  /** Permite elegir una carpeta entera (webkitdirectory). */
  directory?: boolean;
  /** Abre la cámara en el móvil (`user` o `environment`). */
  capture?: "user" | "environment";
}

/** Tamaño legible de un archivo (B, kB, MB). */
function fileSize(bytes: number): string {
  if (bytes < 1000) return `${bytes} B`;
  if (bytes < 1_000_000) return `${(bytes / 1000).toFixed(bytes < 10_000 ? 1 : 0)} kB`;
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

function FileRow({ file, progress, removeLabel, onRemove }: { file: File; progress?: number; removeLabel: string; onRemove?: () => void }) {
  const image = file.type.startsWith("image/");
  const url = useMemo(() => (image && typeof URL.createObjectURL === "function" ? URL.createObjectURL(file) : null), [file, image]);
  useEffect(() => () => (url ? URL.revokeObjectURL(url) : undefined), [url]);
  return (
    <li className="z-upload__file" data-progress={progress === undefined ? undefined : Math.round(progress)}>
      <span className="z-upload__thumb" aria-hidden="true">
        {url ? <img src={url} alt="" width={28} height={28} /> : <Icon name={image ? "photo" : "document"} size={16} />}
      </span>
      <span className="z-upload__file-main">
        <span className="z-upload__file-name">{file.name}</span>
        {progress === undefined ? null : (
          <progress className="z-upload__progress" max={100} value={progress} aria-label={`${file.name}: ${Math.round(progress)}%`} />
        )}
      </span>
      <span className="z-upload__file-size">{fileSize(file.size)}</span>
      {onRemove ? (
        <button type="button" className="z-upload__remove" aria-label={removeLabel} title={removeLabel} onClick={onRemove}>
          <Icon name="x-mark" size={14} />
        </button>
      ) : null}
    </li>
  );
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
  showFiles,
  files: filesProp,
  onRemove,
  progress,
  removeLabel = (file) => `Remove ${file.name}`,
  directory,
  capture,
}: FileUploadProps) {
  const [inner, setInner] = useState<ReadonlyArray<File>>([]);
  const list = filesProp ?? inner;
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
    if (showFiles && filesProp === undefined && accepted.length) setInner(multiple ? [...inner, ...accepted] : accepted);
    return showFiles && multiple && filesProp === undefined ? [...inner, ...accepted] : accepted;
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
        capture={capture}
        {...(directory ? { webkitdirectory: "", directory: "" } : {})}
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
      {showFiles ? (
        // biome-ignore lint/a11y/useKeyWithClickEvents: solo cancela la activación de la etiqueta; los botones de la lista tienen su teclado.
        <ul className="z-upload__files" onClick={(event) => event.preventDefault()}>
          {list.map((file) => (
            <FileRow
              key={`${file.name}-${file.size}-${file.lastModified}`}
              file={file}
              progress={progress?.(file)}
              removeLabel={removeLabel(file)}
              onRemove={
                disabled
                  ? undefined
                  : () => {
                      const next = list.filter((f) => f !== file);
                      if (filesProp === undefined) setInner(next);
                      if (name) keep(input.current, next);
                      onRemove?.(file);
                    }
              }
            />
          ))}
        </ul>
      ) : null}
    </label>
  );
}
