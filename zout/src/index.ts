// @zuccadev-labs/zuix-zout — layouts y ventanas dinámicas.
export { Shell, type ShellProps, type ShellPanel, type ShellPanelMode } from "./layouts/Shell";
export { Rail, RailItem, type RailProps, type RailItemProps } from "./layouts/Rail";
export { SidePanel, Sidebar, SidebarSection, type SidePanelProps, type SidebarProps, type SidebarSectionProps } from "./layouts/SidePanel";
export { SidebarItem, SidebarTrigger, type SidebarItemProps, type SidebarTriggerProps } from "./layouts/SidebarItem";
export { SplitPane, Pane, type SplitPaneProps, type PaneProps } from "./layouts/SplitPane";
export { TabStrip, type TabStripProps, type WorkTab, type TabGroup, type TabGroupTone } from "./layouts/TabStrip";
export { TitleBar, type TitleBarProps } from "./layouts/TitleBar";
export { PaneHeader, type PaneHeaderProps } from "./layouts/PaneHeader";
export { FloatingPanel, type FloatingPanelProps } from "./layouts/FloatingPanel";
export { PaneLayout, type PaneLayoutProps, type PaneInfo, type PaneLayoutLabels } from "./layouts/PaneLayout";
export type { PaneNode, DropEdge } from "./logic";
export { Float, type FloatProps, type FloatPlacement } from "./layouts/Float";
export { ResizeHandle, type ResizeHandleProps } from "./layouts/ResizeHandle";
export {
  Stack,
  Inline,
  Grid,
  Container,
  Page,
  PageHeader,
  PageSection,
  type StackProps,
  type InlineProps,
  type GridProps,
  type ContainerProps,
  type PageProps,
  type PageHeaderProps,
  type PageSectionProps,
} from "./layouts/Page";
export { Navbar, type NavbarProps } from "./layouts/Navbar";
export { NavigationMenu, type NavigationMenuProps, type NavMenuItem, type NavMenuLink } from "./layouts/NavigationMenu";
export { BottomNavigation, type BottomNavigationProps, type BottomNavItem } from "./layouts/BottomNavigation";
export { SiteFooter, type SiteFooterProps, type SiteFooterColumn, type SiteFooterLink, type SiteFooterSocial } from "./layouts/SiteFooter";
export { SkipLink, type SkipLinkProps } from "./layouts/SkipLink";
export { ChatLayout, CHAT_LAYOUT_LABELS, type ChatLayoutLabels, type ChatLayoutProps, type ChatView } from "./layouts/ChatLayout";
export { AppBar, type AppBarProps } from "./layouts/AppBar";
export { DashboardLayout, type DashboardLayoutProps } from "./layouts/DashboardLayout";
export { SettingsLayout, type SettingsLayoutProps, type SettingsNavItem } from "./layouts/SettingsLayout";
export { AuthLayout, type AuthLayoutProps } from "./layouts/AuthLayout";
export { ProfileLayout, type ProfileLayoutProps } from "./layouts/ProfileLayout";
export { DocsLayout, type DocsLayoutLabels, type DocsLayoutProps, type DocsPagerLink, type DocsTocItem } from "./layouts/DocsLayout";
export {
  LandingHero,
  LandingLayout,
  LandingSection,
  type LandingHeroProps,
  type LandingLayoutProps,
  type LandingSectionProps,
} from "./layouts/LandingLayout";
export { KanbanLayout, type KanbanLayoutProps } from "./layouts/KanbanLayout";
export { MailLayout, type MailLayoutProps } from "./layouts/MailLayout";
export { activeSection, appBarProgress } from "./logic";
export { AdaptiveLayout, AdaptiveItem, type AdaptiveLayoutProps, type AdaptiveItemProps } from "./layouts/AdaptiveLayout";
export { AdaptiveSwitch, type AdaptiveSwitchProps } from "./layouts/AdaptiveSwitch";
export { AdaptiveTabs, type AdaptiveTabsProps, type AdaptiveTabItem } from "./layouts/AdaptiveTabs";
export { AdaptiveToolbar, type AdaptiveToolbarProps, type AdaptiveToolbarAction } from "./layouts/AdaptiveToolbar";
export { AdaptiveTable, type AdaptiveTableProps } from "./layouts/AdaptiveTable";
export { useSizeClass, SizeClassContext, type SizeClassView } from "./layouts/size-class";
export {
  SIZE_CLASSES,
  SIZE_CLASS_NAMES,
  areaRects,
  areaRows,
  domOrderFor,
  inputClassOf,
  isSizeClass,
  nodeStyle,
  orderMismatch,
  pickForClass,
  readingOrder,
  resolveAdaptive,
  resolveAll,
  resolveNodes,
  resolveTemplate,
  sizeClassFor,
  sizeClassIndex,
  splitOverflow,
  templateVars,
  validateAdaptive,
  validateTemplate,
  visualOrder,
  type AdaptiveIssue,
  type AdaptiveIssueCode,
  type AdaptiveMap,
  type AdaptiveNode,
  type AdaptiveSettings,
  type AdaptiveTemplate,
  type AdaptiveTemplates,
  type InputClass,
  type PointerKind,
  type SizeClass,
  type SizeClassDef,
} from "./adaptive";
export { adaptiveTransition, sizeClassOf, type MeasureMode, type OrderReport, type ReorderMode, type SizeState } from "./adaptive-runtime";
export { adaptivePanel, type ShellPanelVariant } from "./logic";
