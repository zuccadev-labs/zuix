// Layouts adaptativos (?screen=adaptive): la misma página con una plantilla distinta por clase de tamaño, dentro de un
// marco que se redimensiona, y un panel para cambiar en vivo el área, el orden y la visibilidad de cada pieza por
// clase, como lo haría el editor visual. ?screen=adaptive-stage muestra la página sola a todo el ancho (la que se
// captura en las cinco clases) y ?screen=adaptive-ssr comprueba que hidratar no mueve nada.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import {
  AdaptiveItem,
  AdaptiveLayout,
  AdaptiveSwitch,
  AdaptiveTable,
  AdaptiveTabs,
  AdaptiveToolbar,
  Grid,
  Page,
  Shell,
  Sidebar,
  SidebarItem,
  SIZE_CLASS_NAMES,
  adaptiveTransition,
  resolveAdaptive,
  resolveTemplate,
  areaRects,
  type AdaptiveIssue,
  type AdaptiveMap,
  type AdaptiveTemplates,
  type OrderReport,
  type ShellPanelMode,
  type SizeClass,
  type SizeState,
} from "@zuccadev-labs/zuix-zout";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  IconButton,
  Link,
  NativeSelect,
  SegmentedControl,
  StatTile,
  Switch,
} from "@zuccadev-labs/zuix-zui";
import { PROJECTS, STATUS_LABEL, STATUS_TONE, type Project } from "../data";

export type PieceId = "header" | "stats" | "main" | "activity" | "help";
export const PIECES: PieceId[] = ["header", "stats", "main", "activity", "help"];
const PIECE_LABEL: Record<PieceId, string> = { header: "Header", stats: "Metrics", main: "Work", activity: "Activity", help: "Tips" };

export const TEMPLATES: AdaptiveTemplates = {
  compact: { areas: ["header", "stats", "main", "activity"] },
  medium: { areas: ["header header", "stats stats", "main main", "activity help"] },
  // La última fila absorbe el alto que sobra del trabajo: los consejos quedan justo bajo la actividad.
  expanded: {
    areas: ["header header", "stats stats", "main activity", "main help"],
    columns: "minmax(0, 1fr) 300px",
    rows: "auto auto auto 1fr",
  },
  large: {
    areas: ["header header header", "stats stats activity", "main main activity", "main main help"],
    columns: "repeat(2, minmax(0, 1fr)) 320px",
    rows: "auto auto auto 1fr",
  },
  xlarge: {
    areas: ["header header header header", "help stats stats activity", "help main main activity"],
    columns: "260px repeat(2, minmax(0, 1fr)) 340px",
    rows: "auto auto 1fr",
  },
};

export type PieceState = Record<PieceId, { area: string; adaptive: AdaptiveMap }>;
export const INITIAL: PieceState = {
  header: { area: "header", adaptive: {} },
  stats: { area: "stats", adaptive: {} },
  main: { area: "main", adaptive: {} },
  activity: { area: "activity", adaptive: {} },
  help: { area: "help", adaptive: { compact: { hidden: true }, medium: { hidden: false } } },
};

const SIDEBAR_ADAPTIVE: AdaptiveMap = { compact: { variant: "drawer" }, medium: { variant: "rail" }, expanded: { variant: "docked" } };

const ACTIVITY = [
  { who: "Marta Ruiz", what: "moved Atlas to review", when: "2 min ago" },
  { who: "Ken Adams", what: "closed 3 tasks in Borealis", when: "18 min ago" },
  { who: "Ana López", what: "commented on the release notes", when: "1 h ago" },
  { who: "Omar Haddad", what: "added a milestone to Cobalt", when: "3 h ago" },
];

function Activity() {
  return (
    <Card padding="md">
      <CardHeader title="Recent activity" />
      <ul className="app-adaptive__feed">
        {ACTIVITY.map((a) => (
          <li key={a.when}>
            <Link href={`#member-${a.who.split(" ")[0]!.toLowerCase()}`}>{a.who}</Link> {a.what}
            <span className="app-muted"> · {a.when}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Work() {
  return (
    <Card padding="md">
      <AdaptiveTabs
        label="Work"
        items={[
          {
            value: "projects",
            label: "Projects",
            icon: "folder",
            content: (
              <AdaptiveTable<Project>
                caption="Projects"
                captionHidden
                rows={PROJECTS.slice(0, 4)}
                rowKey={(p) => p.id}
                columns={[
                  { key: "name", header: "Name", accessor: (p) => p.name },
                  { key: "owner", header: "Owner", accessor: (p) => p.owner },
                  {
                    key: "status",
                    header: "Status",
                    render: (p) => (
                      <Badge tone={STATUS_TONE[p.status]} dot>
                        {STATUS_LABEL[p.status]}
                      </Badge>
                    ),
                  },
                  { key: "tasks", header: "Tasks", accessor: (p) => p.tasks, align: "end" },
                ]}
              />
            ),
          },
          {
            value: "milestones",
            label: "Milestones",
            icon: "flag",
            content: <p className="app-text">Tokens freeze on Dec 1, release candidate on Dec 8, launch on Dec 15.</p>,
          },
          {
            value: "notes",
            label: "Notes",
            icon: "document-text",
            content: <p className="app-text">Keep the sidebar as a rail on tablets.</p>,
          },
        ]}
      />
    </Card>
  );
}

export interface AdaptivePageProps {
  pieces: PieceState;
  reorder?: "dom" | "visual";
  transition?: boolean;
  onSizeClassChange?: (state: SizeState) => void;
  onOrderMismatch?: (report: OrderReport) => void;
  onIssues?: (issues: AdaptiveIssue[]) => void;
  /** `main` en la página sola; `div` dentro del marco de la pantalla (ya hay un main en la aplicación). */
  mainAs?: "main" | "div";
  /** La página sola mide la ventana (clases de ventana de Material 3); en el marco, su contenedor. */
  measure?: "container" | "window";
}

/** La página de ejemplo: un Shell con la sidebar adaptativa y un AdaptiveLayout con cinco piezas. */
export function AdaptivePage({
  pieces,
  reorder = "dom",
  transition,
  onSizeClassChange,
  onOrderMismatch,
  onIssues,
  mainAs = "main",
  measure = "container",
}: AdaptivePageProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mode, setMode] = useState<ShellPanelMode>("docked");
  const [page, setPage] = useState("overview");
  const onModeChange = useCallback((next: { sidebar: ShellPanelMode }) => {
    setMode((previous) => {
      if (next.sidebar === "overlay" && previous !== "overlay") setSidebarOpen(false);
      if (next.sidebar === "docked") setSidebarOpen(true);
      return next.sidebar;
    });
  }, []);
  const go = (id: string) => {
    setPage(id);
    if (mode === "overlay") setSidebarOpen(false);
  };
  return (
    <Shell
      className="app-adaptive__shell"
      mainAs={mainAs}
      surface="none"
      onModeChange={onModeChange}
      onCloseOverlay={() => setSidebarOpen(false)}
      sidebar={{
        label: "Navigation",
        open: sidebarOpen,
        adaptive: SIDEBAR_ADAPTIVE,
        content: (
          <Sidebar>
            <SidebarItem icon="home" label="Overview" active={page === "overview"} onClick={() => go("overview")} />
            <SidebarItem icon="folder" label="Projects" badge={4} active={page === "projects"} onClick={() => go("projects")} />
            <SidebarItem icon="calendar-days" label="Planning" active={page === "planning"} onClick={() => go("planning")} />
            <SidebarItem icon="chart-bar" label="Reports" active={page === "reports"} onClick={() => go("reports")} />
          </Sidebar>
        ),
      }}
    >
      <Page label="Adaptive page" width="full">
        <AdaptiveLayout
          templates={TEMPLATES}
          measure={measure}
          reorder={reorder}
          transition={transition}
          onSizeClassChange={onSizeClassChange}
          onOrderMismatch={onOrderMismatch}
          onIssues={onIssues}
          data-testid="adaptive-layout"
        >
          {PIECES.map((id) => (
            <AdaptiveItem key={id} id={id} area={pieces[id].area} adaptive={pieces[id].adaptive} data-testid={`piece-${id}`}>
              {id === "header" ? (
                <div className="app-adaptive__header">
                  {mode === "overlay" ? (
                    <IconButton icon="bars-3" label="Open navigation" onClick={() => setSidebarOpen(true)} data-testid="adaptive-menu" />
                  ) : null}
                  <div className="app-adaptive__title">
                    <h1>Q4 planning</h1>
                    <p className="app-text">Five pieces, five templates: the order and the regions change with the size class.</p>
                  </div>
                  <AdaptiveToolbar
                    label="Page actions"
                    variant="plain"
                    actions={[
                      { id: "share", label: "Share", icon: "share" },
                      {
                        id: "export",
                        label: "Export",
                        icon: "arrow-down-tray",
                        adaptive: { compact: { variant: "menu" }, medium: { variant: "bar" } },
                      },
                      {
                        id: "print",
                        label: "Print",
                        icon: "printer",
                        adaptive: { compact: { variant: "menu" }, expanded: { variant: "bar" } },
                      },
                      { id: "archive", label: "Archive", icon: "archive-box", adaptive: { compact: { variant: "menu" } } },
                    ]}
                  />
                </div>
              ) : id === "stats" ? (
                <Grid min={160} gap={3}>
                  <StatTile label="Open tasks" value="47" delta="-6" deltaTone="success" />
                  <StatTile label="On track" value="3 of 4" />
                  <StatTile label="Next milestone" value="Dec 1" />
                </Grid>
              ) : id === "main" ? (
                <Work />
              ) : id === "activity" ? (
                <Activity />
              ) : (
                <Card padding="md" variant="filled">
                  <CardHeader title="Tips" />
                  <p className="app-text">Hidden in compact. From medium up it sits next to the activity feed.</p>
                </Card>
              )}
            </AdaptiveItem>
          ))}
        </AdaptiveLayout>
      </Page>
    </Shell>
  );
}

// Anchos del marco que dejan el layout en cada clase (el Shell del marco se come la sidebar o el rail).
const FRAMES = [
  { value: "fit", label: "Fit" },
  { value: "390", label: "390" },
  { value: "820", label: "820" },
  { value: "1180", label: "1180" },
  { value: "1600", label: "1600" },
  { value: "1960", label: "1960" },
] as const;
type Frame = (typeof FRAMES)[number]["value"];

/** Pantalla con el marco y el panel de edición. */
export function AdaptiveScreen() {
  const [pieces, setPieces] = useState<PieceState>(INITIAL);
  const [editing, setEditing] = useState<SizeClass>("compact");
  const [reorder, setReorder] = useState<"dom" | "visual">("dom");
  const [transition, setTransition] = useState(true);
  const [frame, setFrame] = useState<Frame>("fit");
  const [state, setState] = useState<SizeState | null>(null);
  const [mismatch, setMismatch] = useState<OrderReport | null>(null);
  const [issues, setIssues] = useState<AdaptiveIssue[]>([]);
  const frameRef = useRef<HTMLDivElement>(null);

  // Los cambios del panel y del marco pasan por una view transition (sin ella con prefers-reduced-motion).
  const animate = (update: () => void) => {
    const el = frameRef.current;
    if (el && transition) adaptiveTransition(el, () => flushSync(update));
    else update();
  };
  const onSizeClassChange = useCallback((next: SizeState) => {
    setState(next);
    setEditing(next.sizeClass);
    setMismatch(null);
  }, []);
  const onOrderMismatch = useCallback((report: OrderReport) => setMismatch(report), []);
  const onIssues = useCallback((list: AdaptiveIssue[]) => setIssues(list), []);

  const set = (id: PieceId, patch: { area?: string; order?: number; hidden?: boolean }) =>
    animate(() => {
      setMismatch(null);
      setIssues([]);
      setPieces((all) => ({
        ...all,
        [id]: { ...all[id], adaptive: { ...all[id].adaptive, [editing]: { ...all[id].adaptive[editing], ...patch } } },
      }));
    });

  const areas = useMemo(() => [...areaRects(resolveTemplate(TEMPLATES, editing)?.areas ?? []).keys()], [editing]);

  return (
    <div className="app-adaptive" data-testid="screen-adaptive-body">
      <section className="app-adaptive__panel" aria-label="Layout editor">
        {/* Cinco opciones no caben en un panel estrecho: el propio selector es adaptativo. */}
        <AdaptiveSwitch
          className="app-adaptive__classes"
          adaptive={{ compact: { variant: "select" }, medium: { variant: "segmented" } }}
          variants={{
            select: (
              <NativeSelect
                size="sm"
                aria-label="Size class to edit"
                value={editing}
                onChange={(e) => setEditing(e.currentTarget.value as SizeClass)}
                options={SIZE_CLASS_NAMES.map((c) => ({ value: c, label: c }))}
              />
            ),
            segmented: (
              <SegmentedControl
                label="Size class to edit"
                size="sm"
                value={editing}
                onValueChange={setEditing}
                items={SIZE_CLASS_NAMES.map((c) => ({ value: c, label: c }))}
              />
            ),
          }}
        />
        <table className="app-adaptive__pieces">
          <caption className="app-muted">Pieces in {editing}</caption>
          <thead>
            <tr>
              <th scope="col">Piece</th>
              <th scope="col">Area</th>
              <th scope="col">Order</th>
              <th scope="col">Visible</th>
            </tr>
          </thead>
          <tbody>
            {PIECES.map((id) => {
              const s = resolveAdaptive(pieces[id].adaptive, editing, { area: pieces[id].area });
              return (
                <tr key={id} data-testid={`edit-${id}`}>
                  <th scope="row">{PIECE_LABEL[id]}</th>
                  <td>
                    <NativeSelect
                      size="sm"
                      aria-label={`${PIECE_LABEL[id]} area in ${editing}`}
                      value={s.area && areas.includes(s.area) ? s.area : ""}
                      onChange={(e) => set(id, { area: e.currentTarget.value || undefined })}
                      options={[{ value: "", label: "Flow" }, ...areas.map((a) => ({ value: a, label: a }))]}
                      data-testid={`area-${id}`}
                    />
                  </td>
                  <td>
                    <NativeSelect
                      size="sm"
                      aria-label={`${PIECE_LABEL[id]} order in ${editing}`}
                      value={String(s.order ?? 0)}
                      onChange={(e) => set(id, { order: Number(e.currentTarget.value) })}
                      options={[-1, 0, 1, 2, 3, 4].map((n) => ({ value: String(n), label: String(n) }))}
                      data-testid={`order-${id}`}
                    />
                  </td>
                  <td>
                    <Switch
                      aria-label={`${PIECE_LABEL[id]} visible in ${editing}`}
                      checked={!s.hidden}
                      onCheckedChange={(on) => set(id, { hidden: !on })}
                      data-testid={`visible-${id}`}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <SegmentedControl
          label="Reading order"
          size="sm"
          value={reorder}
          onValueChange={(v) => setReorder(v as "dom" | "visual")}
          items={[
            { value: "dom", label: "DOM order" },
            { value: "visual", label: "Visual only" },
          ]}
        />
        <Switch checked={transition} onCheckedChange={setTransition}>
          Animate changes
        </Switch>
        <Button size="sm" variant="ghost" icon="arrow-path" onClick={() => animate(() => setPieces(INITIAL))}>
          Reset
        </Button>
        <div className="app-adaptive__status" role="status" data-testid="adaptive-status">
          {state ? (
            <span>
              Class <strong data-testid="adaptive-class">{state.sizeClass}</strong> · {Math.round(state.width)} px · pointer {state.pointer}
            </span>
          ) : null}
          {mismatch ? (
            <span className="app-adaptive__warning" data-testid="adaptive-mismatch">
              {mismatch.readingFlow
                ? "The visual order differs from the DOM; this browser makes focus follow the grid (reading-flow)."
                : "The visual order differs from the DOM: keyboard and screen readers follow the DOM."}
            </span>
          ) : null}
          {issues.length ? (
            <span className="app-adaptive__warning" data-testid="adaptive-issues">
              {issues.map((i) => i.message).join(" ")}
            </span>
          ) : null}
        </div>
      </section>
      <section className="app-adaptive__stage" aria-label="Preview">
        <SegmentedControl
          label="Frame width"
          size="sm"
          value={frame}
          onValueChange={(v) => animate(() => setFrame(v as Frame))}
          items={FRAMES.map((f) => ({ value: f.value, label: f.label }))}
        />
        {/* biome-ignore lint/a11y/noNoninteractiveTabindex: región desplazable; con un marco ancho, el teclado la desplaza. */}
        <div className="app-adaptive__scroller" role="region" aria-label="Preview frame" tabIndex={0}>
          <div
            ref={frameRef}
            className="app-adaptive__frame"
            data-testid="adaptive-frame"
            style={frame === "fit" ? undefined : { inlineSize: `${frame}px` }}
          >
            <AdaptivePage
              pieces={pieces}
              reorder={reorder}
              transition={transition}
              mainAs="div"
              onSizeClassChange={onSizeClassChange}
              onOrderMismatch={onOrderMismatch}
              onIssues={onIssues}
            />
          </div>
        </div>
      </section>
    </div>
  );
}

/** La página sola, a todo el ancho de la ventana (?screen=adaptive-stage). */
export function AdaptiveStage() {
  return (
    <div className="app-adaptive__full" data-testid="screen-adaptive-stage">
      <AdaptivePage pieces={INITIAL} measure="window" />
    </div>
  );
}

interface SsrResult {
  recoverable: string[];
  /** Piezas cuya caja cambió al hidratar (más de 1 px). */
  moved: string[];
  before: Record<string, number[]>;
  after: Record<string, number[]>;
  domOrder: string[];
  sizeClass: string | null;
}
declare global {
  interface Window {
    __adaptiveSsr?: SsrResult;
  }
}

/**
 * Hidratación sin saltos (?screen=adaptive-ssr): pinta la página con react-dom/server en el propio navegador, mide la
 * caja de cada pieza antes de hidratar, hidrata y vuelve a medir. El resultado queda en `window.__adaptiveSsr`.
 */
export function AdaptiveSsr() {
  const host = useRef<HTMLDivElement>(null);
  const started = useRef(false);
  const [status, setStatus] = useState("running");
  useEffect(() => {
    if (started.current || !host.current) return;
    started.current = true;
    const container = host.current;
    void (async () => {
      const { renderToString } = await import("react-dom/server");
      const { hydrateRoot } = await import("react-dom/client");
      container.innerHTML = renderToString(<AdaptivePage pieces={INITIAL} measure="window" />);
      // Con las fuentes cargadas y un fotograma pintado: lo que se compara es la colocación, no la carga de la letra.
      await document.fonts.ready;
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const boxes = () =>
        Object.fromEntries(
          PIECES.map((id) => {
            const r = container.querySelector(`[data-item="${id}"]`)?.getBoundingClientRect();
            return [id, r ? [r.x, r.y, r.width, r.height].map((n) => Math.round(n)) : []];
          }),
        );
      const before = boxes();
      const recoverable: string[] = [];
      hydrateRoot(container, <AdaptivePage pieces={INITIAL} measure="window" />, {
        onRecoverableError: (error) => recoverable.push(String((error as Error)?.message ?? error).slice(0, 400)),
      });
      await new Promise((resolve) => setTimeout(resolve, 500));
      const after = boxes();
      const moved = PIECES.filter((id) => before[id]!.some((v, i) => Math.abs(v - (after[id]![i] ?? 0)) > 1));
      window.__adaptiveSsr = {
        recoverable,
        moved,
        before,
        after,
        domOrder: [...container.querySelectorAll<HTMLElement>(".z-adaptive__item")].map((el) => el.dataset.item ?? ""),
        sizeClass: container.querySelector<HTMLElement>(".z-adaptive")?.dataset.sizeClass ?? null,
      };
      setStatus("done");
    })();
  }, []);
  return (
    <div className="app-adaptive__full" data-testid="screen-adaptive-ssr">
      <output className="app-adaptive__ssr-status" data-testid="ssr-status">
        {status}
      </output>
      <div ref={host} className="app-adaptive__full" />
    </div>
  );
}
