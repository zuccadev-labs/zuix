"use client";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { cx } from "../cx";
import { INSPECTOR_BREAKPOINT, SIDEBAR_BREAKPOINT, panelMode } from "../logic";
import { ResizeHandle } from "./ResizeHandle";

export type ShellPanelMode = "docked" | "overlay";

export interface ShellPanel {
  content: ReactNode;
  /** Nombre accesible del panel. */
  label: string;
  /** Si está abierto. Por defecto, true. */
  open?: boolean;
  /** `auto` (por defecto) acopla el panel si cabe y lo pasa a cajón si no. */
  mode?: ShellPanelMode | "auto";
  /** Ancho en px. Sin valor usa el token de medida (`sidebar-width` o `inspector-width`). */
  width?: number;
  minWidth?: number;
  maxWidth?: number;
  defaultWidth?: number;
  /** Si se pasa, el panel acoplado muestra un tirador para redimensionar. */
  onResize?: (width: number) => void;
}

export interface ShellProps {
  /** Barra de título propia (ventanas sin marco). */
  titlebar?: ReactNode;
  /** Barra estrecha de navegación principal. */
  rail?: ReactNode;
  sidebar?: ShellPanel;
  inspector?: ShellPanel;
  /** Cabecera dentro del área principal. */
  header?: ReactNode;
  /** Contenido del área principal. */
  children: ReactNode;
  /** `glass`: el área principal es un panel de cristal. `solid`: superficie opaca para lectura o edición. */
  surface?: "glass" | "solid" | "none";
  /** Ancho del shell (px) bajo el cual la sidebar en modo `auto` pasa a cajón. */
  sidebarBreakpoint?: number;
  /** Ancho del shell (px) bajo el cual el inspector en modo `auto` pasa a cajón. */
  inspectorBreakpoint?: number;
  /** Cierra el cajón abierto (clic en el velo o Escape). */
  onCloseOverlay?: () => void;
  /**
   * Avisa del modo que corresponde a cada panel según el ancho medido (con independencia de si está abierto).
   * Sirve para cerrar los paneles cuando pasan a cajón o para adaptar los botones que los abren.
   */
  onModeChange?: (modes: { sidebar: ShellPanelMode; inspector: ShellPanelMode }) => void;
  closeOverlayLabel?: string;
  /** Capas flotantes hermanas del cuerpo (diálogos propios, avisos). */
  overlays?: ReactNode;
  className?: string;
}

/**
 * Ancho del shell medido con ResizeObserver. En servidor es `null` (todo acoplado); en el navegador se mide
 * antes del primer pintado para que un shell estrecho no muestre un instante los paneles acoplados.
 */
function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.getBoundingClientRect().width);
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => { if (entry) setWidth(entry.contentRect.width); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

function Side({ panel, side, mode, inert }: { panel: ShellPanel; side: "left" | "right"; mode: ShellPanelMode; inert?: boolean }) {
  const overlay = mode === "overlay";
  const ref = useRef<HTMLElement>(null);
  // En modo cajón el foco entra en el panel al abrirse y vuelve a donde estaba al cerrarse.
  useEffect(() => {
    const el = ref.current;
    if (!overlay || !el) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!el.contains(previous)) el.focus({ preventScroll: true });
    return () => {
      const active = document.activeElement;
      if (previous && previous.isConnected && (!active || active === document.body || el.contains(active))) previous.focus({ preventScroll: true });
    };
  }, [overlay]);
  const style = panel.width !== undefined ? ({ "--z-shell-panel-width": `${panel.width}px` } as CSSProperties) : undefined;
  return (
    <aside
      ref={ref}
      tabIndex={overlay ? -1 : undefined}
      className={cx("z-liquid", side === "left" ? "z-shell__side" : "z-shell__inspector", overlay && "z-shell__drawer")}
      style={style}
      aria-label={panel.label}
      role={overlay ? "dialog" : undefined}
      aria-modal={overlay ? true : undefined}
      data-mode={mode}
      data-side={side}
      inert={inert || undefined}
    >
      <div className="z-shell__panel-body">{panel.content}</div>
      {!overlay && panel.onResize && panel.width !== undefined ? (
        <ResizeHandle
          side={side === "left" ? "right" : "left"}
          size={panel.width}
          onResize={panel.onResize}
          min={panel.minWidth}
          max={panel.maxWidth}
          defaultSize={panel.defaultWidth}
          label={`Resize ${panel.label}`}
        />
      ) : null}
    </aside>
  );
}

/**
 * Estructura general de una aplicación: barra de título · rail · sidebar · área principal · inspector.
 * Los paneles laterales se acoplan si caben y pasan a cajón con velo si no. Origen: AppShell de zutool.
 */
export function Shell({
  titlebar, rail, sidebar, inspector, header, children, surface = "glass",
  sidebarBreakpoint = SIDEBAR_BREAKPOINT, inspectorBreakpoint = INSPECTOR_BREAKPOINT, onCloseOverlay, onModeChange, closeOverlayLabel = "Close panel", overlays, className,
}: ShellProps) {
  const [ref, width] = useWidth();
  const resolve = (panel: ShellPanel | undefined, breakpoint: number): ShellPanelMode | null => {
    if (!panel || panel.open === false) return null;
    return panelMode(width, breakpoint, panel.mode);
  };
  const sideMode = resolve(sidebar, sidebarBreakpoint);
  const inspectorMode = resolve(inspector, inspectorBreakpoint);
  const drawerOpen = sideMode === "overlay" || inspectorMode === "overlay";

  const auto = (panel: ShellPanel | undefined, breakpoint: number): ShellPanelMode => panelMode(width, breakpoint, panel?.mode);
  const sidebarAuto = auto(sidebar, sidebarBreakpoint);
  const inspectorAuto = auto(inspector, inspectorBreakpoint);
  const modeChange = useRef(onModeChange);
  modeChange.current = onModeChange;
  // Antes del pintado: si la aplicación cierra un panel al pasar a cajón, no llega a verse abierto.
  useLayoutEffect(() => {
    if (width !== null) modeChange.current?.({ sidebar: sidebarAuto, inspector: inspectorAuto });
  }, [width === null, sidebarAuto, inspectorAuto]);

  useEffect(() => {
    if (!drawerOpen || !onCloseOverlay) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !e.defaultPrevented) onCloseOverlay(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawerOpen, onCloseOverlay]);

  return (
    <div ref={ref} className={cx("z-shell z-canvas z-root", className)}>
      {titlebar}
      <div className="z-shell__body">
        {/* Con un cajón abierto todo lo que queda bajo el velo es inerte: rail, área principal y el panel que siga acoplado. */}
        {rail ? <div className="z-shell__rail" inert={drawerOpen ? true : undefined}>{rail}</div> : null}
        {sidebar && sideMode ? <Side panel={sidebar} side="left" mode={sideMode} inert={drawerOpen && sideMode === "docked"} /> : null}
        <main className={cx("z-shell__main", surface === "glass" && "z-liquid", surface === "solid" && "z-solid")} inert={drawerOpen ? true : undefined}>
          {header ? <header className="z-shell__header">{header}</header> : null}
          <div className="z-shell__content">{children}</div>
        </main>
        {inspector && inspectorMode ? <Side panel={inspector} side="right" mode={inspectorMode} inert={drawerOpen && inspectorMode === "docked"} /> : null}
        {drawerOpen ? <button type="button" className="z-shell__scrim" aria-label={closeOverlayLabel} onClick={onCloseOverlay} /> : null}
      </div>
      {overlays}
    </div>
  );
}
