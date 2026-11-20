import { useState } from "react";
import {
  Grid,
  Page,
  PageHeader,
  PageSection,
  Sidebar,
  SidebarItem,
  SidebarTrigger,
  TabStrip,
  type TabGroup,
  type WorkTab,
} from "@zuccadev-labs/zuix-zout";
import { Card, CardHeader, IconButton } from "@zuccadev-labs/zuix-zui";

const INITIAL_TABS: WorkTab[] = [
  { id: "button", title: "Button.tsx", groupId: "ui", modified: true },
  { id: "menu", title: "Menu.tsx", groupId: "ui" },
  { id: "routes", title: "routes.ts", groupId: "api", busy: true },
  { id: "schema", title: "schema.ts", groupId: "api" },
  { id: "readme", title: "README.md" },
];

/** Pantalla Workspace: piezas de escritorio de zout (sidebar plegable, pestañas de trabajo, paneles y ventanas). */
export function Workspace() {
  const [collapsed, setCollapsed] = useState(false);
  const [page, setPage] = useState("home");
  const [tabs, setTabs] = useState(INITIAL_TABS);
  const [active, setActive] = useState("button");
  const [groups, setGroups] = useState<TabGroup[]>([
    { id: "ui", label: "UI", tone: "info" },
    { id: "api", label: "API", tone: "success" },
  ]);

  return (
    <Page width="full">
      <PageHeader title="Workspace" description="Collapsible sidebar, work tabs, panes and floating windows." />
      <PageSection title="Navigation">
        <Grid min={300}>
          <Card className="app-demo">
            <CardHeader title="Sidebar" subtitle="Collapses to icons; submenus become flyouts" />
            <div className="app-sidebar-demo" data-testid="ws-sidebar">
              <SidebarTrigger collapsed={collapsed} onCollapsedChange={setCollapsed} controls="ws-nav" />
              <div className="app-sidebar-demo__frame" data-collapsed={collapsed || undefined}>
                <Sidebar
                  id="ws-nav"
                  collapsed={collapsed}
                  footer={<SidebarItem icon="gear" label="Settings" onClick={() => setPage("settings")} active={page === "settings"} />}
                >
                  <SidebarItem icon="home" label="Home" active={page === "home"} onClick={() => setPage("home")} />
                  <SidebarItem icon="inbox" label="Inbox" badge={4} active={page === "inbox"} onClick={() => setPage("inbox")} />
                  <SidebarItem
                    icon="folder"
                    label="Projects"
                    defaultOpen
                    action={<IconButton icon="plus" label="New project" size="sm" variant="ghost" />}
                  >
                    <SidebarItem label="Atlas" active={page === "atlas"} onClick={() => setPage("atlas")} />
                    <SidebarItem label="Borealis" active={page === "borealis"} onClick={() => setPage("borealis")} />
                  </SidebarItem>
                  <SidebarItem icon="chart-bar" label="Reports" active={page === "reports"} onClick={() => setPage("reports")} />
                </Sidebar>
              </div>
            </div>
            <output className="app-value" data-testid="ws-sidebar-value">
              {page}
            </output>
          </Card>
          <Card className="app-demo">
            <CardHeader title="TabStrip" subtitle="Groups, indicators and reorder (drag or Ctrl+Shift+Arrows)" />
            <div data-testid="ws-tabs">
              <TabStrip
                label="Open files"
                tabs={tabs}
                activeId={active}
                onSelect={setActive}
                groups={groups}
                onGroupToggle={(id) => setGroups((list) => list.map((g) => (g.id === id ? { ...g, collapsed: !g.collapsed } : g)))}
                onReorder={(ids) => setTabs((list) => ids.map((id) => list.find((t) => t.id === id)!))}
                onClose={(id) => {
                  setTabs((list) => list.filter((t) => t.id !== id));
                  if (id === active) setActive(tabs.find((t) => t.id !== id)?.id ?? "");
                }}
              />
            </div>
            <output className="app-value" data-testid="ws-tabs-value">
              {tabs.map((t) => t.id).join(",")}
            </output>
          </Card>
        </Grid>
      </PageSection>
    </Page>
  );
}
