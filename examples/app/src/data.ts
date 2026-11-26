import type { IconName } from "@zuccadev-labs/zuix-zicon/core";

export type ScreenId =
  | "overview"
  | "projects"
  | "overlays"
  | "navigation"
  | "gallery"
  | "editor"
  | "forms"
  | "inputs"
  | "commands"
  | "agenda"
  | "workspace"
  | "content"
  | "charts"
  | "data"
  | "site"
  | "media"
  | "carousels"
  | "time"
  | "terminal"
  | "chat"
  | "assistant"
  | "dashboard"
  | "profile"
  | "settings"
  | "kanban"
  | "login"
  | "flows"
  | "infra"
  | "pickers"
  | "listing";

export interface ScreenDef {
  id: ScreenId;
  title: string;
  icon: IconName;
  hint: string;
}

export const SCREENS: ScreenDef[] = [
  { id: "overview", title: "Overview", icon: "home", hint: "Workspace summary" },
  { id: "projects", title: "Projects", icon: "folder", hint: "Table and forms" },
  { id: "overlays", title: "Overlays", icon: "window", hint: "Dialogs, menus and toasts" },
  { id: "navigation", title: "Navigation", icon: "queue-list", hint: "Tabs, accordion and tree" },
  { id: "gallery", title: "Gallery", icon: "photo", hint: "Carousel" },
  { id: "editor", title: "Editor", icon: "code-bracket", hint: "Split panes" },
  { id: "forms", title: "Forms", icon: "pencil-square", hint: "Select, combobox and dates" },
  { id: "inputs", title: "Inputs", icon: "adjustments-horizontal", hint: "Fields, groups and actions" },
  { id: "commands", title: "Commands", icon: "command-line", hint: "Toolbars, menus and light layers" },
  { id: "agenda", title: "Agenda", icon: "calendar-days", hint: "Day, week, month and list" },
  { id: "workspace", title: "Workspace", icon: "rectangle-group", hint: "Sidebar, work tabs and panes" },
  { id: "content", title: "Content", icon: "document-text", hint: "Trees, prose and formatting" },
  { id: "charts", title: "Charts", icon: "chart-bar", hint: "Lines, areas, bars and donuts" },
  { id: "data", title: "Data", icon: "table-cells", hint: "Selection, timeline and progress" },
  { id: "site", title: "Site", icon: "globe-alt", hint: "Navbar, loaders and effects" },
  { id: "media", title: "Media", icon: "swatch", hint: "Color, sliders, images and capture" },
  { id: "carousels", title: "Carousels", icon: "photo", hint: "Prism, layouts, stories and skeletons" },
  { id: "time", title: "Time", icon: "clock", hint: "Clocks, countdowns and durations" },
  { id: "terminal", title: "Terminal", icon: "command-line", hint: "Terminal, logs, code and diffs" },
  { id: "chat", title: "Chat", icon: "chat-bubble-left-right", hint: "Conversations, messages and composer" },
  { id: "assistant", title: "Assistant", icon: "sparkles", hint: "Streams, tools and approvals" },
  { id: "dashboard", title: "Dashboard", icon: "presentation-chart-line", hint: "Metrics, meters and editable widgets" },
  { id: "profile", title: "Profile", icon: "user-circle", hint: "Profile header, members and presence" },
  { id: "settings", title: "Settings", icon: "cog", hint: "Account sections and profile editor" },
  { id: "kanban", title: "Board", icon: "view-columns", hint: "Kanban board with drag and keyboard" },
  { id: "login", title: "Sign in", icon: "lock-closed", hint: "Glass sign-in page" },
  { id: "flows", title: "Flows", icon: "share", hint: "Node editor with ports, edges and minimap" },
  { id: "infra", title: "Infrastructure", icon: "server-stack", hint: "Home lab diagram from an inventory, with export" },
  { id: "pickers", title: "Pickers", icon: "list-bullet", hint: "Cascader, tree select, masks and ranges" },
  { id: "listing", title: "Listing", icon: "home-modern", hint: "Notifications, filters, prices, reviews and photos" },
];

export const isScreen = (value: string | null): value is ScreenId => SCREENS.some((s) => s.id === value);

export type ProjectStatus = "active" | "paused" | "review" | "archived";

export interface Project {
  id: string;
  name: string;
  owner: string;
  status: ProjectStatus;
  progress: number;
  tasks: number;
  updated: string;
  summary: string;
}

export const PROJECTS: Project[] = [
  {
    id: "atlas",
    name: "Atlas",
    owner: "Marta Ruiz",
    status: "active",
    progress: 72,
    tasks: 18,
    updated: "2026-11-10",
    summary: "Design tokens rollout across every product surface.",
  },
  {
    id: "borealis",
    name: "Borealis",
    owner: "Ken Adams",
    status: "review",
    progress: 91,
    tasks: 4,
    updated: "2026-11-12",
    summary: "Icon set audit and naming cleanup.",
  },
  {
    id: "cobalt",
    name: "Cobalt",
    owner: "Ines Vidal",
    status: "paused",
    progress: 35,
    tasks: 27,
    updated: "2026-10-28",
    summary: "Layout engine for resizable workspaces.",
  },
  {
    id: "delta",
    name: "Delta",
    owner: "Omar Haddad",
    status: "active",
    progress: 58,
    tasks: 12,
    updated: "2026-11-08",
    summary: "Documentation site with live component previews.",
  },
  {
    id: "ember",
    name: "Ember",
    owner: "Lena Fischer",
    status: "archived",
    progress: 100,
    tasks: 0,
    updated: "2026-09-14",
    summary: "Legacy theme migration, now complete.",
  },
  {
    id: "fathom",
    name: "Fathom",
    owner: "Marta Ruiz",
    status: "active",
    progress: 14,
    tasks: 41,
    updated: "2026-11-13",
    summary: "Carousel with lens effect and WebGL rendering.",
  },
  {
    id: "garnet",
    name: "Garnet",
    owner: "Ken Adams",
    status: "review",
    progress: 80,
    tasks: 7,
    updated: "2026-11-02",
    summary: "Accessible overlays built on shared primitives.",
  },
  {
    id: "harbor",
    name: "Harbor",
    owner: "Ines Vidal",
    status: "active",
    progress: 46,
    tasks: 22,
    updated: "2026-11-11",
    summary: "Command palette and keyboard shortcuts.",
  },
];

export const STATUS_TONE: Record<ProjectStatus, "success" | "warning" | "info" | "neutral"> = {
  active: "success",
  paused: "warning",
  review: "info",
  archived: "neutral",
};

export const STATUS_LABEL: Record<ProjectStatus, string> = {
  active: "Active",
  paused: "Paused",
  review: "In review",
  archived: "Archived",
};

export type Theme = "dark" | "light";
export type Brand = "dazlabs" | "zutool";
