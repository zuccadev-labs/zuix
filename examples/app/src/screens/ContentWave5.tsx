import { useState } from "react";
import { Grid, Page, PageHeader, PageSection, Stack } from "@zuccadev-labs/zuix-zout";
import { Card, CardHeader, Input, JsonTree, Stepper, Tree, type TreeNode } from "@zuccadev-labs/zuix-zui";

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
      <PageSection title="Navigation">
        <Grid min={320}>
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
    </Page>
  );
}
