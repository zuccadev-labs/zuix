import { useState } from "react";
import { Grid, Page, PageHeader, PageSection, Stack } from "@zuccadev-labs/zuix-zout";
import {
  Banner,
  Button,
  Card,
  CardHeader,
  Collapsible,
  IconButton,
  Link,
  Menu,
  ToggleGroup,
  Toolbar,
  ToolbarGroup,
  ToolbarSeparator,
  type MenuEntry,
} from "@zuccadev-labs/zuix-zui";

/** Oleada 4 en React: barras, menús con estado, capas ligeras y avisos de aplicación. Cada pieza deja su valor a la vista. */
export function Commands() {
  const [last, setLast] = useState("none");
  const [format, setFormat] = useState<string[]>(["bold"]);
  const [minimap, setMinimap] = useState(true);
  const [wrap, setWrap] = useState(false);
  const [density, setDensity] = useState("comfortable");
  const [details, setDetails] = useState(false);
  const [banner, setBanner] = useState(true);

  const view: MenuEntry[] = [
    { type: "checkbox", id: "minimap", label: "Minimap", checked: minimap, onCheckedChange: setMinimap },
    { type: "checkbox", id: "wrap", label: "Word wrap", shortcut: "Alt Z", checked: wrap, onCheckedChange: setWrap },
    { type: "separator" },
    {
      type: "radio-group",
      id: "density",
      label: "Density",
      value: density,
      onValueChange: setDensity,
      items: [
        { value: "compact", label: "Compact" },
        { value: "comfortable", label: "Comfortable" },
        { value: "spacious", label: "Spacious", disabled: true },
      ],
    },
    { type: "separator" },
    { id: "docs", label: "Keyboard shortcuts", icon: "command-line", href: "#shortcuts" },
  ];

  return (
    <Page
      header={
        <PageHeader eyebrow="Components" title="Commands" description="Toolbars, stateful menus, light layers and application notices." />
      }
    >
      {banner ? (
        <Banner
          data-testid="c-banner"
          tone="accent"
          badge="New"
          title="Workspaces are here."
          action={<Link href="#changelog">See what changed</Link>}
          onDismiss={() => setBanner(false)}
        >
          Group projects and share layouts with your team.
        </Banner>
      ) : (
        <p className="app-muted" data-testid="c-banner-gone">
          Notice dismissed.
        </p>
      )}
      <p className="app-muted">
        Last action: <output data-testid="c-last">{last}</output>
      </p>

      <PageSection title="Toolbar">
        <Grid min={320}>
          <Card className="app-demo">
            <CardHeader title="Editor toolbar" subtitle="One tab stop, arrows inside" />
            <Toolbar label="Text formatting" controls="c-editor" data-testid="c-toolbar">
              <ToggleGroup
                type="multiple"
                label="Style"
                variant="ghost"
                size="sm"
                value={format}
                onValueChange={setFormat}
                items={[
                  { value: "bold", icon: "bold", ariaLabel: "Bold" },
                  { value: "italic", icon: "italic", ariaLabel: "Italic" },
                  { value: "underline", icon: "underline", ariaLabel: "Underline" },
                ]}
              />
              <ToolbarSeparator />
              <ToolbarGroup label="Insert">
                <IconButton icon="link" label="Insert link" size="sm" onClick={() => setLast("toolbar:link")} />
                <IconButton icon="photo" label="Insert image" size="sm" onClick={() => setLast("toolbar:image")} />
                <IconButton
                  icon="code-bracket"
                  label="Insert code"
                  size="sm"
                  aria-disabled="true"
                  onClick={() => setLast("toolbar:code")}
                />
              </ToolbarGroup>
              <ToolbarSeparator />
              <Menu
                label="View options"
                items={view}
                trigger={
                  <Button size="sm" variant="ghost" iconRight="chevron-down" data-testid="c-view">
                    View
                  </Button>
                }
              />
            </Toolbar>
            <p id="c-editor" className="app-muted">
              Format: <output data-testid="c-format">{format.join(",")}</output> · minimap{" "}
              <output data-testid="c-minimap">{String(minimap)}</output> · wrap <output data-testid="c-wrap">{String(wrap)}</output> ·
              density <output data-testid="c-density">{density}</output>
            </p>
          </Card>
          <Card className="app-demo">
            <CardHeader title="Collapsible" subtitle="Disclosure and partial collapse" />
            <Stack gap={8}>
              <Collapsible id="c-advanced" title="Advanced settings" icon="adjustments-horizontal" open={details} onOpenChange={setDetails}>
                <p>Retries, timeouts and the proxy used for outgoing requests.</p>
              </Collapsible>
              <Collapsible id="c-notes" title="Show full description" peek={44}>
                <p>
                  The release adds a workspace layout with resizable panes, a floating inspector and grouped tabs.{" "}
                  <a href="#notes">Read the notes</a>.
                </p>
              </Collapsible>
              <p className="app-muted">
                Advanced open: <output data-testid="c-details">{String(details)}</output>
              </p>
            </Stack>
          </Card>
        </Grid>
      </PageSection>
    </Page>
  );
}
