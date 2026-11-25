import { useState } from "react";
import { Grid, Inline, Page, PageHeader, PageSection, Stack } from "@zuccadev-labs/zuix-zout";
import {
  Accordion,
  Breadcrumb,
  Button,
  Card,
  CodeBlock,
  Pagination,
  SegmentedControl,
  Stepper,
  Tabs,
  Tree,
  type TreeNode,
} from "@zuccadev-labs/zuix-zui";
import { TreeAndTabsSections } from "./scale";

const TREE: TreeNode[] = [
  {
    id: "src",
    label: "src",
    icon: "folder",
    children: [
      {
        id: "components",
        label: "components",
        icon: "folder",
        children: [
          { id: "button", label: "Button.tsx", icon: "document-text" },
          { id: "modal", label: "Modal.tsx", icon: "document-text" },
        ],
      },
      { id: "styles", label: "styles", icon: "folder", children: [{ id: "index-css", label: "index.css", icon: "document-text" }] },
      { id: "index", label: "index.ts", icon: "document-text" },
    ],
  },
  { id: "package", label: "package.json", icon: "document-text" },
  { id: "readme", label: "README.md", icon: "document-text", disabled: true },
];

export function NavigationScreen() {
  const [tab, setTab] = useState("summary");
  const [selected, setSelected] = useState<string | null>("index");
  const [step, setStep] = useState(1);
  const [page, setPage] = useState(3);
  const [view, setView] = useState("grid");

  return (
    <Page
      header={
        <PageHeader
          breadcrumb={<Breadcrumb items={[{ label: "Workspace", icon: "home" }, { label: "Components" }, { label: "Navigation" }]} />}
          title="Navigation"
          description="Tabs, accordion, tree, stepper and pagination, all usable from the keyboard."
        />
      }
    >
      <PageSection title="Tabs">
        <div data-testid="tabs">
          <Tabs
            label="Project sections"
            variant="underline"
            value={tab}
            onValueChange={setTab}
            items={[
              {
                value: "summary",
                label: "Summary",
                icon: "document-text",
                content: (
                  <p className="app-text" data-testid="tab-panel-summary">
                    Atlas ships the design tokens to every product surface.
                  </p>
                ),
              },
              {
                value: "activity",
                label: "Activity",
                icon: "clock",
                content: (
                  <p className="app-text" data-testid="tab-panel-activity">
                    Eight changes were merged this week.
                  </p>
                ),
              },
              {
                value: "members",
                label: "Members",
                icon: "users",
                content: (
                  <p className="app-text" data-testid="tab-panel-members">
                    Five people contribute to this project.
                  </p>
                ),
              },
              {
                value: "billing",
                label: "Billing",
                icon: "lock-closed",
                disabled: true,
                content: <p className="app-text">Not available.</p>,
              },
            ]}
          />
        </div>
        <Inline>
          <SegmentedControl
            label="View"
            value={view}
            onValueChange={setView}
            items={[
              { value: "grid", label: "Grid", icon: "squares-2x2" },
              { value: "list", label: "List", icon: "queue-list" },
            ]}
          />
          <span className="app-muted" data-testid="view-state">
            {view}
          </span>
        </Inline>
      </PageSection>

      <Grid min={320}>
        <PageSection title="Accordion">
          <div data-testid="accordion">
            <Accordion
              defaultValue={["tokens"]}
              items={[
                {
                  value: "tokens",
                  title: "Design tokens",
                  icon: "swatch",
                  content: "A single source for color, type, spacing and motion.",
                },
                { value: "icons", title: "Icons", icon: "star", content: "One icon standard shared by every package." },
                { value: "layouts", title: "Layouts", icon: "view-columns", content: "Shell, split panes and intrinsic grids." },
              ]}
            />
          </div>
        </PageSection>

        <PageSection title="Tree">
          <Card padding="sm" data-testid="tree">
            <Tree nodes={TREE} label="Files" defaultExpanded={["src"]} selected={selected} onSelect={(id) => setSelected(id)} />
          </Card>
          <span className="app-muted">
            Selected: <output data-testid="tree-selected">{selected ?? "none"}</output>
          </span>
        </PageSection>
      </Grid>

      <TreeAndTabsSections />

      <PageSection title="Stepper and pagination">
        <Stack gap={4}>
          <Stepper
            current={step}
            onStepSelect={setStep}
            steps={[
              { label: "Details", description: "Name and owner" },
              { label: "Members", description: "Invite the team" },
              { label: "Review", description: "Confirm and create" },
            ]}
          />
          <Inline>
            <Button size="sm" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>
              Back
            </Button>
            <Button size="sm" variant="primary" onClick={() => setStep(Math.min(3, step + 1))} data-testid="step-next">
              Next
            </Button>
          </Inline>
          <Pagination page={page} pageCount={12} onPageChange={setPage} />
          <CodeBlock
            title="Install"
            language="sh"
            code="pnpm add @zuccadev-labs/zuix-zui @zuccadev-labs/zuix-zout @zuccadev-labs/zuix-zicon @zuccadev-labs/zuix-tokens"
          />
        </Stack>
      </PageSection>
    </Page>
  );
}
