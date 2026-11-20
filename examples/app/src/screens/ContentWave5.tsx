import { useState } from "react";
import { Grid, Page, PageHeader, PageSection, Stack } from "@zuccadev-labs/zuix-zout";
import { Icon } from "@zuccadev-labs/zuix-zicon";
import {
  Accordion,
  AspectRatio,
  Breadcrumb,
  Card,
  CardHeader,
  CardMedia,
  FormatByte,
  FormatDate,
  FormatNumber,
  Highlight,
  Input,
  Marquee,
  Prose,
  ScrollArea,
  JsonTree,
  Stepper,
  Tree,
  type TreeNode,
} from "@zuccadev-labs/zuix-zui";

const show = (value: unknown) =>
  Array.isArray(value) ? value.join(",") || "none" : value === null || value === "" ? "none" : String(value);

const FOLDERS: TreeNode[] = [
  {
    id: "photos",
    label: "Photos",
    icon: "folder",
    children: [
      { id: "photos/2025", label: "2025", icon: "folder" },
      { id: "photos/2026", label: "2026", icon: "folder" },
      { id: "photos/raw", label: "Raw", icon: "folder", disabled: true },
    ],
  },
  { id: "music", label: "Music", icon: "folder" },
  { id: "notes", label: "Notes", icon: "document" },
];

const JSON_SAMPLE = {
  id: 42,
  name: "Atlas",
  active: true,
  owner: null,
  summary: "Design tokens rollout across every product surface and platform.",
  tags: ["design", "tokens"],
  created: new Date("2026-11-20T09:00:00Z"),
  roles: new Set(["admin", "editor"]),
  limits: new Map([["api", 1000n]]),
};

/** Piezas de la oleada 5 (contenido y navegación) con su valor a la vista, para las pruebas en navegador. */
export function ContentWave5() {
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [picked, setPicked] = useState<string[]>([]);
  const [checked, setChecked] = useState<string[]>(["photos/2025"]);
  const [jsonPath, setJsonPath] = useState("none");
  const [step, setStep] = useState(0);
  const [query, setQuery] = useState("cafe");
  const [crumb, setCrumb] = useState("none");
  const [sections, setSections] = useState<string[]>(["plan"]);
  const nodes = FOLDERS.map(function relabel(node): TreeNode {
    return { ...node, label: labels[node.id] ?? node.label, children: node.children?.map(relabel) };
  });

  return (
    <Page width="full">
      <PageHeader title="Content" description="Trees, long-form content, formatting and navigation helpers." />
      <PageSection title="Tree">
        <Grid min={280}>
          <Card className="app-demo">
            <CardHeader title="Tree" subtitle="Multiple selection, cascading checkboxes and rename" />
            <Stack gap={3}>
              <div data-testid="c-tree">
                <Tree
                  label="Sync folders"
                  nodes={nodes}
                  selectionMode="multiple"
                  checkable
                  renamable
                  defaultExpanded={["photos"]}
                  selectedIds={picked}
                  onSelectedChange={setPicked}
                  checked={checked}
                  onCheckedChange={setChecked}
                  onRename={(id, label) => setLabels((all) => ({ ...all, [id]: label }))}
                />
              </div>
              <p className="app-muted">
                Selected: <output data-testid="c-tree-selected">{show(picked)}</output>
                <br />
                Checked: <output data-testid="c-tree-checked">{show(checked)}</output>
              </p>
            </Stack>
          </Card>
          <Card className="app-demo">
            <CardHeader title="JsonTree" subtitle="Types, Map and Set, depth and paths" />
            <Stack gap={3}>
              <div data-testid="c-json">
                <JsonTree
                  label="Project payload"
                  defaultExpandDepth={2}
                  maxStringLength={32}
                  onSelect={(path) => setJsonPath(path)}
                  value={JSON_SAMPLE}
                />
              </div>
              <p className="app-muted">
                Path: <output data-testid="c-json-path">{jsonPath}</output>
              </p>
            </Stack>
          </Card>
        </Grid>
      </PageSection>
      <PageSection title="Content">
        <Grid min={240}>
          <Card data-testid="c-card-media">
            <CardMedia ratio={16 / 9}>
              <Icon name="photo" size={32} />
            </CardMedia>
            <CardHeader icon="cube" title="Atlas" subtitle="Design tokens rollout" />
          </Card>
          <Card>
            <CardMedia placement="inset" ratio={4 / 3}>
              <Icon name="map" size={32} />
            </CardMedia>
            <CardHeader icon="map-pin" title="Lisbon office" subtitle="Inset media with a concentric radius" />
          </Card>
          <Card>
            <CardHeader title="AspectRatio" subtitle="Square box" />
            <AspectRatio ratio={1} data-testid="c-aspect">
              <Icon name="photo" size={32} />
            </AspectRatio>
          </Card>
        </Grid>
      </PageSection>
      <PageSection title="Navigation">
        <Grid min={320}>
          <Card className="app-demo">
            <CardHeader title="Accordion" subtitle="Card variant, always one open, disabled item" />
            <div data-testid="c-accordion">
              <Accordion
                variant="card"
                collapsible={false}
                value={sections}
                onValueChange={setSections}
                items={[
                  { value: "plan", title: "Plan", content: "Pro, billed yearly." },
                  { value: "seats", title: "Seats", content: "12 of 20 in use." },
                  { value: "sso", title: "Single sign-on", content: "Enterprise only.", disabled: true },
                ]}
              />
            </div>
            <p className="app-muted">
              Open: <output data-testid="c-accordion-value">{show(sections)}</output>
            </p>
          </Card>
          <Card className="app-demo">
            <CardHeader title="Breadcrumb" subtitle="Collapsed with a menu and a custom separator" />
            <div data-testid="c-breadcrumb">
              <Breadcrumb
                maxItems={3}
                separator="/"
                items={["Home", "Workspace", "Projects", "Atlas", "Settings"].map((label, i, all) =>
                  i === all.length - 1 ? { label } : { label, onClick: () => setCrumb(label) },
                )}
              />
            </div>
            <p className="app-muted">
              Went to: <output data-testid="c-breadcrumb-value">{crumb}</output>
            </p>
          </Card>
          <Card className="app-demo">
            <CardHeader title="Stepper" subtitle="Panels, icons and loading" />
            <div data-testid="c-stepper">
              <Stepper
                current={step}
                onStepChange={setStep}
                steps={[
                  { label: "Account", icon: "user", content: <Input aria-label="Workspace name" defaultValue="Atlas" /> },
                  { label: "Plan", icon: "credit-card", content: <p>Pick a plan for the workspace.</p> },
                  { label: "Deploy", icon: "rocket-launch", content: <p>Review and deploy.</p> },
                ]}
                completed={<p>All set.</p>}
              />
            </div>
            <p className="app-muted">
              Step: <output data-testid="c-stepper-value">{step}</output>
            </p>
          </Card>
        </Grid>
      </PageSection>
      <PageSection title="Reading and formatting">
        <Grid min="320px" gap={4}>
          <Card className="app-demo">
            <CardHeader title="Prose" subtitle="Long-form typography" />
            <Prose size="sm" data-testid="c-prose">
              <h3>Release notes</h3>
              <p>
                Charts land in <strong>zui</strong> with <a href="#keyboard">keyboard support</a> and <code>prefers-reduced-motion</code>.
              </p>
              <ul>
                <li>Line, area and bar charts</li>
                <li>Donut and pie charts</li>
              </ul>
              <blockquote>Nothing depends on color alone.</blockquote>
              <p>
                Press <kbd>⌘</kbd> <kbd>K</kbd> to search.
              </p>
            </Prose>
          </Card>
          <Card className="app-demo">
            <CardHeader title="ScrollArea and Highlight" />
            <Input aria-label="Highlight query" value={query} onChange={(event) => setQuery(event.currentTarget.value)} />
            <ScrollArea label="Changelog entries" maxHeight="9rem" data-testid="c-scroll">
              <ul>
                {[
                  "Café charts",
                  "Data table selection",
                  "Tree rename",
                  "Timeline",
                  "Circular progress",
                  "Status dot",
                  "Marquee",
                  "Málaga highlight",
                ].map((item) => (
                  <li key={item}>
                    <Highlight text={item} query={query} ignoreAccents />
                  </li>
                ))}
              </ul>
            </ScrollArea>
          </Card>
          <Card className="app-demo">
            <CardHeader title="Format and Marquee" />
            <p data-testid="c-format">
              <FormatNumber value={1250000} options={{ notation: "compact" }} locale="en-US" /> ·{" "}
              <FormatByte value={1572864} system="binary" locale="en-US" /> ·{" "}
              <FormatDate value="2026-11-20" options={{ dateStyle: "long" }} locale="en-US" />
            </p>
            <Marquee label="Customers" duration={18} data-testid="c-marquee">
              {["Atlas", "Borealis", "Cobalt", "Dune", "Echo", "Fjord"].map((name) => (
                <span key={name} className="app-muted">
                  {name}
                </span>
              ))}
            </Marquee>
          </Card>
        </Grid>
      </PageSection>
    </Page>
  );
}
