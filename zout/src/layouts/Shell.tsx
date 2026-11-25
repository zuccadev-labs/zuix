"use client";
import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { cx } from "../cx";
import {
  INSPECTOR_BREAKPOINT,
  RAIL_BREAKPOINT,
  SIDEBAR_BREAKPOINT,
  adaptivePanel,
  adaptivePanelClasses,
  panelMode,
  railInDrawer,
} from "../logic";
import { sizeClassFor, type AdaptiveMap } from "../adaptive";
import { ShellPanelContext } from "./shell-panel-context";
import { inertProp } from "../react-compat";
import { ResizeHandle } from "./ResizeHandle";
import { closestOpenPopover } from "../popover";

/** `useLayoutEffect` en el navegador; en el servidor, `useEffect` (React 18 avisa de un efecto de layout en el servidor). */
const useIsoLayoutEffect = typeof document === "undefined" ? useEffect : useLayoutEffect;

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
  /** Nombre accesible del tirador. Por defecto, `Resize <label>`. */
  resizeLabel?: string;
  /**
   * Ajustes por clase de tamaño del shell (layout adaptativo). `variant`: `docked`, `drawer` o `rail` (acoplado y
   * plegado a iconos: la `Sidebar` de dentro se pliega sola); `hidden`: ni acoplado ni cajón. Se heredan hacia arriba:
   * `{ compact: { variant: "drawer" }, medium: { variant: "rail" }, expanded: { variant: "docked" } }`. Con ellos, el
   * panel ignora `mode` y el corte en px.
   */
  adaptive?: AdaptiveMap;
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
  /**
   * Ancho del shell (px) bajo el cual el rail deja su columna y se muestra dentro del cajón de la sidebar (si la
   * sidebar es un cajón). Por defecto, 600.
   */
  railBreakpoint?: number;
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
  /**
   * Texto de un enlace «saltar al contenido», primer elemento enfocable del shell y visible solo con el foco:
   * lleva al área principal sin recorrer la barra de título, el rail y la sidebar (WCAG 2.4.1). Sin valor no se dibuja.
   */
  skipLinkLabel?: string;
  /**
   * Elemento del área principal. `main` (por defecto) es la región principal del documento, y solo puede haber
   * una visible: un Shell anidado o un segundo Shell en la misma página usa `div` o `section`.
   */
  mainAs?: "main" | "div" | "section";
  className?: string;
}

/**
 * Ancho del shell medido con ResizeObserver. En servidor es `null` (todo acoplado); en el navegador se mide
 * antes del primer pintado para que un shell estrecho no muestre un instante los paneles acoplados.
 */
function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number | null>(null);
  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.getBoundingClientRect().width);
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

function Side({
  panel,
  side,
  mode,
  inert,
  rail,
  railVariant = false,
}: {
  panel: ShellPanel;
  side: "left" | "right";
  mode: ShellPanelMode;
  inert?: boolean;
  /** Rail dentro del cajón (shell estrecho). */
  rail?: ReactNode;
  /** Variante `rail` de los ajustes por clase: acoplado y plegado a iconos. */
  railVariant?: boolean;
}) {
  const id = useId();
  const overlay = mode === "overlay";
  const ref = useRef<HTMLElement>(null);
  // En modo cajón el foco entra en el panel al abrirse y vuelve a donde estaba al cerrarse.
  useEffect(() => {
    const el = ref.current;
    if (!overlay || !el) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    // Al fotograma siguiente: un panel acoplado que pasa a cajón al estrecharse y que la aplicación cierra en ese mismo
    // cambio (onModeChange) no llega a pintarse, y no debe quitarle el foco a lo que lo tenía.
    const frame = requestAnimationFrame(() => {
      if (el.isConnected && !el.contains(document.activeElement)) el.focus({ preventScroll: true });
    });
    return () => {
      cancelAnimationFrame(frame);
      const active = document.activeElement;
      if (previous?.isConnected && (!active || active === document.body || el.contains(active))) previous.focus({ preventScroll: true });
    };
  }, [overlay]);
  const style = panel.width !== undefined ? ({ "--z-shell-panel-width": `${panel.width}px` } as CSSProperties) : undefined;
  const classes = panel.adaptive ? adaptivePanelClasses(panel.adaptive) : null;
  return (
    // biome-ignore lint/a11y/useAriaPropsSupportedByRole: aria-modal solo se emite cuando el panel es un cajón y lleva role="dialog"; acoplado es un <aside> sin ninguno de los dos.
    <aside
      ref={ref}
      tabIndex={overlay ? -1 : undefined}
      className={cx("z-liquid", side === "left" ? "z-shell__side" : "z-shell__inspector", overlay && "z-shell__drawer")}
      style={style}
      aria-label={panel.label}
      role={overlay ? "dialog" : undefined}
      aria-modal={overlay ? true : undefined}
      id={id}
      data-mode={mode}
      data-panel-mode={panel.adaptive ? "auto" : (panel.mode ?? "auto")}
      data-side={side}
      data-adaptive={panel.adaptive ? "" : undefined}
      data-drawer-in={classes?.drawerIn}
      data-rail-in={classes?.railIn}
      data-hidden-in={classes?.hiddenIn}
      data-variant={railVariant ? "rail" : undefined}
      inert={inertProp(inert)}
    >
      {rail ? <div className="z-shell__rail">{rail}</div> : null}
      <div className="z-shell__panel-body">
        <ShellPanelContext.Provider value={{ rail: railVariant }}>{panel.content}</ShellPanelContext.Provider>
      </div>
      {!overlay && !railVariant && panel.onResize && panel.width !== undefined ? (
        <ResizeHandle
          // Bordes lógicos: la sidebar se redimensiona por su borde final y el inspector por el inicial, también en RTL.
          side={side === "left" ? "end" : "start"}
          controls={id}
          size={panel.width}
          onResize={panel.onResize}
          min={panel.minWidth}
          max={panel.maxWidth}
          defaultSize={panel.defaultWidth}
          label={panel.resizeLabel ?? `Resize ${panel.label}`}
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
  titlebar,
  rail,
  sidebar,
  inspector,
  header,
  children,
  surface = "glass",
  sidebarBreakpoint = SIDEBAR_BREAKPOINT,
  inspectorBreakpoint = INSPECTOR_BREAKPOINT,
  railBreakpoint = RAIL_BREAKPOINT,
  onCloseOverlay,
  onModeChange,
  closeOverlayLabel = "Close panel",
  overlays,
  skipLinkLabel,
  mainAs: Main = "main",
  className,
}: ShellProps) {
  const [ref, width] = useWidth();
  const mainId = useId();
  // Con ajustes por clase, el panel se resuelve con la clase de tamaño del shell; sin ellos, con su corte en px.
  const sidebarState = sidebar?.adaptive ? adaptivePanel(width, sidebar.adaptive) : null;
  const inspectorState = inspector?.adaptive ? adaptivePanel(width, inspector.adaptive) : null;
  const resolve = (
    panel: ShellPanel | undefined,
    breakpoint: number,
    state: ReturnType<typeof adaptivePanel> | null,
  ): ShellPanelMode | null => {
    if (!panel || panel.open === false || state?.hidden) return null;
    return state ? state.mode : panelMode(width, breakpoint, panel.mode);
  };
  const sideMode = resolve(sidebar, sidebarBreakpoint, sidebarState);
  const inspectorMode = resolve(inspector, inspectorBreakpoint, inspectorState);
  const drawerOpen = sideMode === "overlay" || inspectorMode === "overlay";

  const auto = (panel: ShellPanel | undefined, breakpoint: number, state: ReturnType<typeof adaptivePanel> | null): ShellPanelMode =>
    state ? state.mode : panelMode(width, breakpoint, panel?.mode);
  const sidebarAuto = auto(sidebar, sidebarBreakpoint, sidebarState);
  const inspectorAuto = auto(inspector, inspectorBreakpoint, inspectorState);
  const railToDrawer = Boolean(rail && sidebar) && railInDrawer(width, railBreakpoint, sidebarAuto);
  const modeChange = useRef(onModeChange);
  modeChange.current = onModeChange;
  // Antes del pintado: si la aplicación cierra un panel al pasar a cajón, no llega a verse abierto.
  // Solo importa si el ancho ya se midió, no su valor: el aviso depende de los modos resueltos.
  const measured = width !== null;
  useIsoLayoutEffect(() => {
    if (measured) modeChange.current?.({ sidebar: sidebarAuto, inspector: inspectorAuto });
  }, [measured, sidebarAuto, inspectorAuto]);

  useEffect(() => {
    if (!drawerOpen || !onCloseOverlay) return;
    // Escape cierra el cajón salvo que lo gestione una capa por encima (un diálogo, un menú o un popover abiertos).
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      if (e.target instanceof Element && (e.target.closest("dialog[open]") || closestOpenPopover(e.target))) return;
      onCloseOverlay();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawerOpen, onCloseOverlay]);

  return (
    // `data-measured`: hasta que se mide el ancho (servidor, antes de hidratar) la hoja oculta con una consulta de
    // contenedor los paneles `auto` que no caben, para que una ventana estrecha no los muestre acoplados un instante.
    <div
      ref={ref}
      className={cx("z-shell z-canvas z-root", className)}
      data-measured={width !== null ? "" : undefined}
      data-size-class={width !== null ? sizeClassFor(width) : undefined}
    >
      {skipLinkLabel ? (
        <a className="z-shell__skip" href={`#${mainId}`}>
          {skipLinkLabel}
        </a>
      ) : null}
      {titlebar}
      <div className="z-shell__body">
        {/* Con un cajón abierto todo lo que queda bajo el velo es inerte: rail, área principal y el panel que siga acoplado. */}
        {/* Estrecho: el rail no ocupa columna; va dentro del cajón de la sidebar cuando está abierto. */}
        {rail && !railToDrawer ? (
          <div className="z-shell__rail" inert={inertProp(drawerOpen)}>
            {rail}
          </div>
        ) : null}
        {sidebar && sideMode ? (
          <Side
            panel={sidebar}
            side="left"
            mode={sideMode}
            inert={drawerOpen && sideMode === "docked"}
            rail={railToDrawer && sideMode === "overlay" ? rail : undefined}
            railVariant={sideMode === "docked" && sidebarState?.rail === true}
          />
        ) : null}
        <Main
          id={mainId}
          tabIndex={skipLinkLabel ? -1 : undefined}
          className={cx("z-shell__main", surface === "glass" && "z-liquid", surface === "solid" && "z-solid")}
          inert={inertProp(drawerOpen)}
        >
          {header ? <header className="z-shell__header">{header}</header> : null}
          <div className="z-shell__content">{children}</div>
        </Main>
        {inspector && inspectorMode ? (
          <Side
            panel={inspector}
            side="right"
            mode={inspectorMode}
            inert={drawerOpen && inspectorMode === "docked"}
            railVariant={inspectorMode === "docked" && inspectorState?.rail === true}
          />
        ) : null}
        {drawerOpen ? <button type="button" className="z-shell__scrim" aria-label={closeOverlayLabel} onClick={onCloseOverlay} /> : null}
      </div>
      {overlays}
    </div>
  );
}
