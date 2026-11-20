import { useState } from "react";
import { Grid, Page, PageHeader, PageSection, Stack } from "@zuccadev-labs/zuix-zout";
import { Card, CardHeader, Tree, type TreeNode } from "@zuccadev-labs/zuix-zui";

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

/** Piezas de la oleada 5 (contenido y navegación) con su valor a la vista, para las pruebas en navegador. */
export function ContentWave5() {
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [picked, setPicked] = useState<string[]>([]);
  const [checked, setChecked] = useState<string[]>(["photos/2025"]);
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
        </Grid>
      </PageSection>
    </Page>
  );
}
