import { useCallback, useEffect, useMemo, useState } from "react";
import { Icon } from "@zuccadev-labs/zuix-zicon/core";
import {
  Rail,
  RailItem,
  Shell,
  Sidebar,
  SidebarSection,
  SidePanel,
  Stack,
  TabStrip,
  TitleBar,
  type ShellPanelMode,
  type WorkTab,
} from "@zuccadev-labs/zuix-zout";
import {
  Avatar,
  Badge,
  Button,
  CommandPalette,
  Divider,
  IconButton,
  Meter,
  NavLink,
  NavList,
  Progress,
  Switch,
  Tooltip,
  useToast,
  type PaletteGroup,
} from "@zuccadev-labs/zuix-zui";
import { PROJECTS, SCREENS, STATUS_LABEL, STATUS_TONE, isScreen, type Brand, type Project, type ScreenId, type Theme } from "./data";
import { Overview } from "./screens/Overview";
import { Projects } from "./screens/Projects";
import { Forms } from "./screens/Forms";
import { Inputs } from "./screens/Inputs";
import { Commands } from "./screens/Commands";
import { Overlays } from "./screens/Overlays";
import { NavigationScreen } from "./screens/Navigation";
import { Gallery } from "./screens/Gallery";
import { Editor } from "./screens/Editor";
import { AgendaScreen } from "./screens/Agenda";
import { Workspace } from "./screens/Workspace";
import { ContentScreen } from "./screens/Content";
import { ChartsScreen } from "./screens/Charts";
import { DataScreen } from "./screens/Data";
import { Site } from "./screens/Site";
import { Media } from "./screens/Media";
import { CarouselsScreen } from "./screens/Carousels";
import { TerminalScreen } from "./screens/TerminalScreen";
import { Flows } from "./screens/Flows";
import { TimeScreen } from "./screens/Time";
import { ChatScreen } from "./screens/Chat";
import { AssistantScreen } from "./screens/Assistant";
import { DashboardScreen } from "./screens/Dashboard";
import { KanbanScreen } from "./screens/Kanban";
import { LoginScreen } from "./screens/Login";
import { ProfileScreen, SettingsScreen } from "./screens/People";
import { ListingScreen } from "./screens/Listing";
import { Pickers } from "./screens/Pickers";
import { PagePieces } from "./screens/PagePieces";
import { StudioScreen } from "./screens/Studio";

const params = new URLSearchParams(window.location.search);
const initialScreen: ScreenId = (() => {
  const value = params.get("screen");
  return isScreen(value) ? value : "overview";
})();
const initialTheme: Theme = params.get("theme") === "light" ? "light" : "dark";
const initialBrand: Brand = params.get("brand") === "zutool" ? "zutool" : "dazlabs";

// Ancho inicial de la sidebar (el del token `sidebar-width`); el usuario puede cambiarlo con el tirador.
const SIDEBAR_WIDTH = 224;

export function App() {
  const { toast } = useToast();
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [brand, setBrand] = useState<Brand>(initialBrand);
  const [tabs, setTabs] = useState<ScreenId[]>(initialScreen === "overview" ? ["overview", "projects"] : ["overview", initialScreen]);
  const [active, setActive] = useState<ScreenId>(initialScreen);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_WIDTH);
  const [modes, setModes] = useState<{ sidebar: ShellPanelMode; inspector: ShellPanelMode } | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [projectId, setProjectId] = useState<string>("atlas");
  const [notify, setNotify] = useState(true);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.brand = brand;
  }, [theme, brand]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Un panel que pasa a cajón se cierra: en pantallas estrechas no debe tapar el contenido al cargar.
  const onModeChange = useCallback((next: { sidebar: ShellPanelMode; inspector: ShellPanelMode }) => {
    setModes((previous) => {
      if (next.sidebar === "overlay" && previous?.sidebar !== "overlay") setSidebarOpen(false);
      if (next.inspector === "overlay" && previous?.inspector !== "overlay") setInspectorOpen(false);
      if (next.sidebar === "docked" && previous?.sidebar === "overlay") setSidebarOpen(true);
      if (next.inspector === "docked" && previous?.inspector === "overlay") setInspectorOpen(true);
      return next;
    });
  }, []);

  const closeOverlays = useCallback(() => {
    setModes((current) => {
      if (current?.sidebar === "overlay") setSidebarOpen(false);
      if (current?.inspector === "overlay") setInspectorOpen(false);
      return current;
    });
  }, []);

  const navigate = useCallback((id: ScreenId) => {
    setTabs((list) => (list.includes(id) ? list : [...list, id]));
    setActive(id);
    // En cajón, elegir un destino cierra la navegación.
    setModes((current) => {
      if (current?.sidebar === "overlay") setSidebarOpen(false);
      return current;
    });
  }, []);

  const closeTab = (id: string) => {
    const index = tabs.indexOf(id as ScreenId);
    const next = tabs.filter((tab) => tab !== id);
    setTabs(next);
    if (active === id) setActive(next[Math.min(index, next.length - 1)] ?? "overview");
  };

  const addTab = () => {
    const missing = SCREENS.find((screen) => !tabs.includes(screen.id));
    if (missing) navigate(missing.id);
    else toast({ title: "Every screen is already open", intent: "info" });
  };

  const toggleSidebar = () => {
    if (!sidebarOpen && modes?.inspector === "overlay") setInspectorOpen(false);
    setSidebarOpen(!sidebarOpen);
  };
  const toggleInspector = () => {
    if (!inspectorOpen && modes?.sidebar === "overlay") setSidebarOpen(false);
    setInspectorOpen(!inspectorOpen);
  };

  const project: Project = PROJECTS.find((p) => p.id === projectId) ?? PROJECTS[0]!;
  const selectProject = (id: string) => setProjectId(id);

  const workTabs: WorkTab[] = tabs.map((id) => {
    const screen = SCREENS.find((s) => s.id === id)!;
    return { id, title: screen.title, leading: <Icon name={screen.icon} size={14} />, closable: id !== "overview" };
  });

  const groups = useMemo<PaletteGroup[]>(
    () => [
      {
        heading: "Go to",
        commands: SCREENS.map((screen) => ({
          id: `go-${screen.id}`,
          label: screen.title,
          hint: screen.hint,
          icon: screen.icon,
          onSelect: () => navigate(screen.id),
        })),
      },
      {
        heading: "Appearance",
        commands: [
          { id: "theme-light", label: "Use light theme", icon: "sun", keywords: ["appearance", "day"], onSelect: () => setTheme("light") },
          { id: "theme-dark", label: "Use dark theme", icon: "moon", keywords: ["appearance", "night"], onSelect: () => setTheme("dark") },
          { id: "brand-dazlabs", label: "Switch brand to dazlabs", icon: "swatch", onSelect: () => setBrand("dazlabs") },
          { id: "brand-zutool", label: "Switch brand to zutool", icon: "swatch", onSelect: () => setBrand("zutool") },
        ],
      },
      {
        heading: "Projects",
        commands: PROJECTS.map((p) => ({
          id: `project-${p.id}`,
          label: `Open ${p.name}`,
          hint: p.owner,
          icon: "folder-open" as const,
          disabled: p.status === "archived",
          onSelect: () => {
            setProjectId(p.id);
            navigate("projects");
          },
        })),
      },
    ],
    [navigate],
  );

  const screen =
    active === "overview" ? (
      <Overview onNavigate={navigate} onSelectProject={selectProject} />
    ) : active === "projects" ? (
      <Projects selectedId={projectId} onSelect={selectProject} />
    ) : active === "forms" ? (
      <Forms />
    ) : active === "inputs" ? (
      <Inputs />
    ) : active === "commands" ? (
      <Commands />
    ) : active === "overlays" ? (
      <Overlays onOpenPalette={() => setPaletteOpen(true)} />
    ) : active === "navigation" ? (
      <NavigationScreen />
    ) : active === "gallery" ? (
      <Gallery theme={theme} brand={brand} />
    ) : active === "agenda" ? (
      <AgendaScreen />
    ) : active === "workspace" ? (
      <Workspace />
    ) : active === "content" ? (
      <ContentScreen />
    ) : active === "charts" ? (
      <ChartsScreen />
    ) : active === "data" ? (
      <DataScreen />
    ) : active === "site" ? (
      <Site />
    ) : active === "media" ? (
      <Media />
    ) : active === "carousels" ? (
      <CarouselsScreen />
    ) : active === "time" ? (
      <TimeScreen />
    ) : active === "terminal" ? (
      <TerminalScreen />
    ) : active === "chat" ? (
      <ChatScreen />
    ) : active === "assistant" ? (
      <AssistantScreen />
    ) : active === "dashboard" ? (
      <DashboardScreen />
    ) : active === "profile" ? (
      <ProfileScreen />
    ) : active === "settings" ? (
      <SettingsScreen />
    ) : active === "kanban" ? (
      <KanbanScreen />
    ) : active === "login" ? (
      <LoginScreen />
    ) : active === "flows" ? (
      <Flows />
    ) : active === "listing" ? (
      <ListingScreen />
    ) : active === "pickers" ? (
      <Pickers />
    ) : active === "page" ? (
      <PagePieces />
    ) : active === "studio" ? (
      <StudioScreen />
    ) : (
      <Editor />
    );

  return (
    <Shell
      className="app-shell"
      // ?skip=1: enlace «saltar al contenido» (lo recorre tests/browser).
      skipLinkLabel={params.get("skip") === "1" ? "Skip to content" : undefined}
      surface={active === "editor" || active === "chat" ? "none" : "glass"}
      onCloseOverlay={closeOverlays}
      onModeChange={onModeChange}
      titlebar={
        <TitleBar
          brand={
            <>
              <IconButton
                icon="bars-3"
                label="Toggle navigation"
                variant="ghost"
                size="sm"
                onClick={toggleSidebar}
                aria-expanded={sidebarOpen}
                data-testid="toggle-sidebar"
              />
              {/* Nombre de la aplicación de ejemplo, no de la marca: la marca es un tema y se elige en el selector. */}
              <span className="app-brand" data-testid="app-name">
                Acme
              </span>
            </>
          }
          actions={
            <>
              <Tooltip content="Command palette (Ctrl K)" side="bottom">
                <IconButton
                  icon="magnifying-glass"
                  label="Open command palette"
                  variant="ghost"
                  size="sm"
                  onClick={() => setPaletteOpen(true)}
                  data-testid="open-palette"
                />
              </Tooltip>
              <IconButton
                icon="swatch"
                label={`Switch brand (current: ${brand})`}
                variant="ghost"
                size="sm"
                onClick={() => setBrand(brand === "dazlabs" ? "zutool" : "dazlabs")}
                className="app-brand-toggle"
                data-testid="toggle-brand"
              />
              <IconButton
                icon={theme === "dark" ? "sun" : "moon"}
                label={theme === "dark" ? "Use light theme" : "Use dark theme"}
                variant="ghost"
                size="sm"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                data-testid="toggle-theme"
              />
              <IconButton
                icon="adjustments-horizontal"
                label="Toggle details panel"
                variant="ghost"
                size="sm"
                onClick={toggleInspector}
                aria-expanded={inspectorOpen}
                data-testid="toggle-inspector"
              />
            </>
          }
        >
          <TabStrip
            tabs={workTabs}
            activeId={active}
            onSelect={(id) => setActive(id as ScreenId)}
            onClose={closeTab}
            onAdd={addTab}
            label="Open screens"
          />
        </TitleBar>
      }
      rail={
        <Rail
          brand={
            <span className="app-logo">
              <Icon name="cube" variant="solid" size={20} />
            </span>
          }
          footer={
            <RailItem
              icon="bell"
              label="Notifications"
              badge={3}
              data-testid="rail-notifications"
              onClick={() => toast({ title: "3 unread notifications", description: "Review requests are waiting.", intent: "info" })}
            />
          }
        >
          {SCREENS.map((s) => (
            <RailItem
              key={s.id}
              icon={s.icon}
              label={s.title}
              active={active === s.id}
              onClick={() => navigate(s.id)}
              data-testid={`rail-${s.id}`}
            />
          ))}
        </Rail>
      }
      sidebar={{
        label: "Navigation",
        open: sidebarOpen,
        width: sidebarWidth,
        minWidth: 180,
        maxWidth: 360,
        defaultWidth: SIDEBAR_WIDTH,
        onResize: setSidebarWidth,
        content: (
          <Sidebar
            footer={
              <div className="app-user">
                <Avatar name="Marta Ruiz" size="sm" status="online" statusLabel="Online" />
                <span className="app-user__name">Marta Ruiz</span>
              </div>
            }
          >
            <SidebarSection title="Workspace">
              <NavList label="Workspace">
                {SCREENS.map((s) => (
                  <NavLink key={s.id} icon={s.icon} active={active === s.id} onClick={() => navigate(s.id)}>
                    {s.title}
                  </NavLink>
                ))}
              </NavList>
            </SidebarSection>
            <SidebarSection title="Projects" count={PROJECTS.length}>
              <NavList label="Projects">
                {PROJECTS.map((p) => (
                  <NavLink
                    key={p.id}
                    icon="folder"
                    active={p.id === projectId}
                    trailing={
                      <Badge tone={STATUS_TONE[p.status]} size="sm">
                        {p.tasks}
                      </Badge>
                    }
                    onClick={() => {
                      setProjectId(p.id);
                      navigate("projects");
                    }}
                  >
                    {p.name}
                  </NavLink>
                ))}
              </NavList>
            </SidebarSection>
          </Sidebar>
        ),
      }}
      inspector={{
        label: "Details",
        // Chat y asistente ocupan el ancho: traen sus propios paneles de detalles.
        open: inspectorOpen && active !== "chat" && active !== "assistant",
        content: (
          <SidePanel
            title={project.name}
            subtitle={project.owner}
            actions={
              <IconButton
                icon="x-mark"
                label="Close details"
                variant="ghost"
                size="sm"
                onClick={() => setInspectorOpen(false)}
                data-testid="close-inspector"
              />
            }
            footer={
              <Button variant="primary" icon="arrow-top-right-on-square" fullWidth onClick={() => navigate("projects")}>
                Open project
              </Button>
            }
          >
            <Stack gap={4}>
              <div>
                <Badge tone={STATUS_TONE[project.status]} dot>
                  {STATUS_LABEL[project.status]}
                </Badge>
              </div>
              <p className="app-text">{project.summary}</p>
              <Progress value={project.progress} label="Completion" showValue />
              <Meter
                value={project.tasks}
                max={50}
                label="Open tasks"
                showLabel
                valueLabel={`${project.tasks} of 50`}
                warningAt={25}
                dangerAt={40}
              />
              <Divider />
              <Switch checked={notify} onCheckedChange={setNotify} data-testid="inspector-switch">
                Notify me about changes
              </Switch>
              <dl className="app-meta">
                <dt>Updated</dt>
                <dd>{project.updated}</dd>
                <dt>Identifier</dt>
                <dd>{project.id}</dd>
              </dl>
            </Stack>
          </SidePanel>
        ),
      }}
      overlays={<CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} groups={groups} />}
    >
      <div className="app-screen" data-testid={`screen-${active}`} data-screen={active}>
        {screen}
      </div>
    </Shell>
  );
}
