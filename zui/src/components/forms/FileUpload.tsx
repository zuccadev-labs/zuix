"use client";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { Icon, type IconName } from "@zuccadev-labs/zuix-zicon/core";
import { matchesAccept } from "../../core/accept";
import { announce } from "../../core/announcer";
import { isRtl } from "../../core/dir";
import { columnsOf, gridTarget, moveItem, nearestIndex, REORDER_LABELS, type ReorderLabels } from "../../core/reorder";
import { drawThumbnail } from "../../core/thumbnail";
import { fill } from "../../core/vnode";
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
  /**
   * `list` (por defecto): filas con miniatura pequeña. `grid`: rejilla de miniaturas grandes, pensada para fotos
   * (implica `showFiles`).
   */
  layout?: "list" | "grid";
  /**
   * Reordenar con el puntero (arrastrando el asa) y con el teclado (Espacio coge, flechas mueven, Espacio suelta,
   * Escape cancela), con anuncio de cada posición. El nuevo orden sale por `onReorder`.
   */
  sortable?: boolean;
  /** Nuevo orden de la lista tras soltar. Con `files`, actualízala aquí. */
  onReorder?: (files: File[]) => void;
  /** La primera es la portada: lleva la marca «Cover» y las demás un botón para pasar a ser la primera. */
  cover?: boolean;
  /** Se eligió otra portada (ya está primera en el orden que llega por `onReorder`). */
  onCoverChange?: (file: File) => void;
  /** Textos de reordenar y portada: `handle`, `hint`, `grabbed`, `moved`, `dropped`, `cancelled`, `cover`, `makeCover`, `coverChanged`. */
  reorderLabels?: Partial<ReorderLabels>;
}

export type { ReorderLabels };

/** Tamaño legible de un archivo (B, kB, MB). */
function fileSize(bytes: number): string {
  if (bytes < 1000) return `${bytes} B`;
  if (bytes < 1_000_000) return `${(bytes / 1000).toFixed(bytes < 10_000 ? 1 : 0)} kB`;
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

function FileRow({ file, progress, removeLabel, onRemove }: { file: File; progress?: number; removeLabel: string; onRemove?: () => void }) {
  const image = file.type.startsWith("image/");
  // La miniatura se dibuja en un lienzo: el archivo no pasa por ninguna URL ni atributo `src`.
  const canvas = useRef<HTMLCanvasElement>(null);
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    setDrawn(false);
    if (!image || !canvas.current) return;
    let alive = true;
    void drawThumbnail(canvas.current, file, 28).then((ok) => {
      if (alive) setDrawn(ok);
    });
    return () => {
      alive = false;
    };
  }, [file, image]);
  return (
    <li className="z-upload__file" data-progress={progress === undefined ? undefined : Math.round(progress)}>
      <span className="z-upload__thumb" aria-hidden="true">
        {image ? <canvas ref={canvas} hidden={!drawn} /> : null}
        {drawn ? null : <Icon name={image ? "photo" : "document"} size={16} />}
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

interface TileProps {
  file: File;
  index: number;
  count: number;
  progress?: number;
  removeLabel: string;
  onRemove?: () => void;
  sortable: boolean;
  grabbed: boolean;
  dragging: boolean;
  /** Casilla donde caerá el arrastre. */
  dropTarget: boolean;
  isCover: boolean;
  labels: ReorderLabels;
  hintId: string;
  onMakeCover?: () => void;
  onHandleClick: (event: ReactMouseEvent<HTMLButtonElement>) => void;
  onHandleKey: (event: KeyboardEvent<HTMLButtonElement>) => void;
  onHandleBlur: () => void;
  onHandlePointer: (event: ReactPointerEvent<HTMLButtonElement>) => void;
}

function GridTile(p: TileProps) {
  const image = p.file.type.startsWith("image/");
  // La miniatura se dibuja en un lienzo: el archivo no pasa por ninguna URL ni atributo `src`.
  const canvas = useRef<HTMLCanvasElement>(null);
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    setDrawn(false);
    if (!image || !canvas.current) return;
    let alive = true;
    void drawThumbnail(canvas.current, p.file, 192).then((ok) => {
      if (alive) setDrawn(ok);
    });
    return () => {
      alive = false;
    };
  }, [p.file, image]);
  const name = p.file.name;
  return (
    <li
      className="z-upload__tile"
      data-index={p.index}
      data-cover={p.isCover || undefined}
      data-grabbed={p.grabbed || undefined}
      data-dragging={p.dragging || undefined}
      data-drop-target={p.dropTarget || undefined}
      data-progress={p.progress === undefined ? undefined : Math.round(p.progress)}
    >
      <span className="z-upload__preview" aria-hidden="true">
        {image ? <canvas ref={canvas} hidden={!drawn} /> : null}
        {drawn ? null : <Icon name={image ? "photo" : "document"} size={24} />}
      </span>
      {p.isCover ? <span className="z-upload__cover">{p.labels.cover}</span> : null}
      <span className="z-upload__tile-name">{name}</span>
      {p.progress === undefined ? null : (
        <progress className="z-upload__progress" max={100} value={p.progress} aria-label={`${name}: ${Math.round(p.progress)}%`} />
      )}
      <span className="z-upload__tile-actions">
        {p.sortable && p.count > 1 ? (
          <button
            type="button"
            className="z-upload__handle"
            aria-label={fill(p.labels.handle, { name })}
            aria-describedby={p.hintId}
            aria-pressed={p.grabbed}
            data-index={p.index}
            onClick={p.onHandleClick}
            onKeyDown={p.onHandleKey}
            onBlur={p.onHandleBlur}
            onPointerDown={p.onHandlePointer}
          >
            <Icon name="arrows-pointing-out" size={14} />
          </button>
        ) : null}
        {p.onMakeCover && !p.isCover ? (
          <button
            type="button"
            className="z-upload__make-cover"
            aria-label={fill(p.labels.makeCover, { name })}
            title={fill(p.labels.makeCover, { name })}
            onClick={p.onMakeCover}
          >
            <Icon name="star" size={14} />
          </button>
        ) : null}
        {p.onRemove ? (
          <button type="button" className="z-upload__remove" aria-label={p.removeLabel} title={p.removeLabel} onClick={p.onRemove}>
            <Icon name="x-mark" size={14} />
          </button>
        ) : null}
      </span>
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
  layout = "list",
  sortable,
  onReorder,
  cover,
  onCoverChange,
  reorderLabels,
}: FileUploadProps) {
  const [inner, setInner] = useState<ReadonlyArray<File>>([]);
  const grid = layout === "grid";
  const listed = showFiles || grid;
  // Orden provisional mientras se reordena con el teclado (Escape lo descarta; soltar lo confirma).
  const [preview, setPreview] = useState<ReadonlyArray<File> | null>(null);
  const list = preview ?? filesProp ?? inner;
  const reorderText = { ...REORDER_LABELS, ...reorderLabels };
  const filesHint = useId();
  const grab = useRef<{ file: File; origin: number } | null>(null);
  const [grabbed, setGrabbed] = useState<File | null>(null);
  const refocus = useRef<File | null>(null);
  const filesRef = useRef<HTMLUListElement>(null);
  const [drag, setDrag] = useState<{ file: File; target: number } | null>(null);
  const control = useFieldControl({ id, invalid });
  const hintId = useId();
  const labelId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const deliver = (list: FileList | null) => {
    const all = Array.from(list ?? []);
    const picked = multiple ? all : all.slice(0, 1);
    const accepted = picked.filter((file) => matchesAccept(file, accept) && (maxSize === undefined || file.size <= maxSize));
    const rejected = picked.filter((file) => !accepted.includes(file));
    if (accepted.length) onFiles(accepted);
    if (rejected.length) onReject?.(rejected);
    if (listed && filesProp === undefined && accepted.length) setInner(multiple ? [...inner, ...accepted] : accepted);
    return listed && multiple && filesProp === undefined ? [...inner, ...accepted] : accepted;
  };
  const onDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragging(false);
    if (disabled) return;
    const accepted = deliver(event.dataTransfer.files);
    if (name) keep(input.current, accepted);
  };

  const say = (template: string, file: File, position: number) =>
    announce(fill(template, { name: file.name, position: position + 1, count: list.length }), { source: input.current, delay: 300 });
  const commit = (next: File[]) => {
    if (filesProp === undefined) setInner(next);
    if (name) keep(input.current, next);
    onReorder?.(next);
  };
  const columns = () =>
    columnsOf([...(filesRef.current?.querySelectorAll<HTMLElement>(".z-upload__tile") ?? [])].map((el) => el.getBoundingClientRect()));
  const handleOf = (file: File) => {
    const i = list.indexOf(file);
    return filesRef.current?.querySelector<HTMLButtonElement>(`.z-upload__tile[data-index="${i}"] .z-upload__handle`) ?? null;
  };
  // Tras cada movimiento, el foco vuelve al asa del archivo (React lo mueve de sitio en el DOM) y la casilla se trae a la vista.
  useLayoutEffect(() => {
    const file = refocus.current;
    if (!file) return;
    refocus.current = null;
    const handle = handleOf(file);
    handle?.closest(".z-upload__tile")?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
    handle?.focus({ preventScroll: true });
  });
  const drop = (file: File) => {
    const session = grab.current;
    grab.current = null;
    setGrabbed(null);
    if (!session) return;
    const order = [...list];
    setPreview(null);
    const at = order.indexOf(file);
    if (at !== session.origin) {
      commit(order);
      say(reorderText.dropped, file, at);
    }
  };
  const cancel = (file: File) => {
    const session = grab.current;
    grab.current = null;
    setGrabbed(null);
    setPreview(null);
    if (!session) return;
    refocus.current = file;
    say(reorderText.cancelled, file, session.origin);
  };
  const onHandleClick = (file: File) => (event: ReactMouseEvent<HTMLButtonElement>) => {
    // Un clic de ratón al soltar un arrastre no coge: el modo de teclado empieza con Espacio o Intro (o con la activación
    // de un lector de pantalla, que llega como clic sin puntero, `detail` 0).
    if (event.detail !== 0) return;
    if (grab.current) drop(file);
    else {
      grab.current = { file, origin: list.indexOf(file) };
      setGrabbed(file);
      say(reorderText.grabbed, file, list.indexOf(file));
    }
  };
  const onHandleKey = (file: File) => (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!grab.current) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      cancel(file);
      return;
    }
    const from = list.indexOf(file);
    const to = gridTarget(from, event.key, { count: list.length, columns: columns(), rtl: isRtl(event.currentTarget) });
    if (to === null) {
      if (event.key.startsWith("Arrow") || event.key === "Home" || event.key === "End") event.preventDefault();
      return;
    }
    event.preventDefault();
    refocus.current = file;
    setPreview(moveItem(list, from, to));
    say(reorderText.moved, file, to);
  };
  // Soltar si el asa pierde el foco (Tab a otro control); el desenfoque que causa el propio movimiento no cuenta.
  const onHandleBlur = (file: File) => () => {
    if (grab.current && refocus.current !== file) drop(file);
  };
  const onHandlePointer = (file: File) => (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || grab.current || disabled) return;
    const handle = event.currentTarget;
    const tile = handle.closest<HTMLElement>(".z-upload__tile");
    if (!tile || !filesRef.current) return;
    event.preventDefault();
    const pointer = event.pointerId;
    const start = { x: event.clientX, y: event.clientY };
    // Casillas medidas en reposo: el destino sale de la rejilla quieta, no de lo que se mueve.
    const rects = [...filesRef.current.querySelectorAll<HTMLElement>(".z-upload__tile")].map((el) => el.getBoundingClientRect());
    const from = list.indexOf(file);
    let target = from;
    handle.setPointerCapture?.(pointer);
    setDrag({ file, target });
    const move = (e: PointerEvent) => {
      if (e.pointerId !== pointer) return;
      tile.style.setProperty("--z-drag-x", `${e.clientX - start.x}px`);
      tile.style.setProperty("--z-drag-y", `${e.clientY - start.y}px`);
      const next = nearestIndex(e.clientX, e.clientY, rects);
      if (next !== -1 && next !== target) {
        target = next;
        setDrag({ file, target });
      }
    };
    const end = (e: PointerEvent) => {
      if (e.pointerId !== pointer) return;
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", end);
      document.removeEventListener("pointercancel", end);
      tile.style.removeProperty("--z-drag-x");
      tile.style.removeProperty("--z-drag-y");
      setDrag(null);
      if (e.type === "pointerup" && target !== from) {
        commit(moveItem(list, from, target));
        say(reorderText.dropped, file, target);
      }
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", end);
    document.addEventListener("pointercancel", end);
  };
  const remove = (file: File) => () => {
    const next = list.filter((f) => f !== file);
    if (filesProp === undefined) setInner(next);
    if (name) keep(input.current, next);
    onRemove?.(file);
  };
  const makeCover = (file: File) => () => {
    const next = moveItem(list, list.indexOf(file), 0);
    commit(next);
    onCoverChange?.(file);
    announce(fill(reorderText.coverChanged, { name: file.name }), { source: input.current, delay: 300 });
  };

  return (
    <label
      className={cx("z-upload", className)}
      data-layout={grid ? "grid" : undefined}
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
        // Con la lista dentro de la zona, el nombre del campo es solo su texto principal (no los nombres de archivo).
        aria-labelledby={listed ? labelId : undefined}
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
      <span className="z-upload__label" id={listed ? labelId : undefined}>
        {label}
      </span>
      {hint ? (
        <span className="z-upload__hint" id={hintId}>
          {hint}
        </span>
      ) : null}
      {children}
      {listed && !grid ? (
        // biome-ignore lint/a11y/useKeyWithClickEvents: solo cancela la activación de la etiqueta; los botones de la lista tienen su teclado.
        <ul className="z-upload__files" onClick={(event) => event.preventDefault()}>
          {list.map((file) => (
            <FileRow
              key={`${file.name}-${file.size}-${file.lastModified}`}
              file={file}
              progress={progress?.(file)}
              removeLabel={removeLabel(file)}
              onRemove={disabled ? undefined : remove(file)}
            />
          ))}
        </ul>
      ) : null}
      {grid ? (
        <>
          {/* biome-ignore lint/a11y/useKeyWithClickEvents: solo cancela la activación de la etiqueta; los botones de la rejilla tienen su teclado. */}
          <ul
            ref={filesRef}
            className="z-upload__files z-upload__grid"
            data-sorting={grabbed || drag ? "" : undefined}
            onClick={(event) => event.preventDefault()}
          >
            {list.map((file, index) => (
              <GridTile
                key={`${file.name}-${file.size}-${file.lastModified}`}
                file={file}
                index={index}
                count={list.length}
                progress={progress?.(file)}
                removeLabel={removeLabel(file)}
                onRemove={disabled ? undefined : remove(file)}
                sortable={Boolean(sortable) && !disabled}
                grabbed={grabbed === file || drag?.file === file}
                dragging={drag?.file === file}
                dropTarget={Boolean(drag) && drag?.target === index && drag?.file !== file}
                isCover={Boolean(cover) && index === 0}
                labels={reorderText}
                hintId={filesHint}
                onMakeCover={cover && !disabled ? makeCover(file) : undefined}
                onHandleClick={onHandleClick(file)}
                onHandleKey={onHandleKey(file)}
                onHandleBlur={onHandleBlur(file)}
                onHandlePointer={onHandlePointer(file)}
              />
            ))}
          </ul>
          {sortable ? (
            <span className="z-sr-only" id={filesHint}>
              {reorderText.hint}
            </span>
          ) : null}
        </>
      ) : null}
    </label>
  );
}
