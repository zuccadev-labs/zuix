import { useMemo, useState, type FormEvent } from "react";
import { Grid, Inline, Page, PageHeader, PageSection, Stack } from "@zuccadev-labs/zuix-zout";
import {
  Badge, Button, Card, CardHeader, Checkbox, ContextMenu, DataTable, EmptyState, Field, Input, Pagination, Panel, Progress, Radio, RadioGroup,
  SearchInput, Slider, Switch, Textarea, useToast, type DataTableColumn, type MenuEntry,
} from "@zuccadev-labs/zuix-zui";
import { PROJECTS, STATUS_LABEL, STATUS_TONE, type Project } from "../data";

const PAGE_SIZE = 5;

export function Projects({ selectedId, onSelect }: { selectedId: string; onSelect: (id: string) => void }) {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [budget, setBudget] = useState([40]);
  const [visibility, setVisibility] = useState("team");
  const [lastAction, setLastAction] = useState("none");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? PROJECTS.filter((p) => `${p.name} ${p.owner}`.toLowerCase().includes(q)) : PROJECTS;
  }, [query]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const rows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const columns: DataTableColumn<Project>[] = [
    { key: "name", header: "Project", accessor: (p) => p.name, sortable: true, render: (p) => <strong>{p.name}</strong> },
    { key: "owner", header: "Owner", accessor: (p) => p.owner, sortable: true },
    { key: "status", header: "Status", accessor: (p) => p.status, render: (p) => <Badge tone={STATUS_TONE[p.status]}>{STATUS_LABEL[p.status]}</Badge> },
    { key: "progress", header: "Progress", accessor: (p) => p.progress, sortable: true, width: "160px", render: (p) => <Progress value={p.progress} label={`${p.name} progress`} size="sm" showValue /> },
    { key: "tasks", header: "Tasks", accessor: (p) => p.tasks, sortable: true, align: "end", mono: true },
    { key: "updated", header: "Updated", accessor: (p) => p.updated, sortable: true, mono: true },
  ];

  const menuFor = (project: Project): MenuEntry[] => [
    { type: "label", label: project.name },
    { id: "open", label: "Open", icon: "folder-open", shortcut: "Enter", onSelect: () => { onSelect(project.id); setLastAction(`open:${project.id}`); } },
    { id: "rename", label: "Rename", icon: "pencil", onSelect: () => setLastAction(`rename:${project.id}`) },
    { id: "share", label: "Share", icon: "share", items: [
      { id: "copy-link", label: "Copy link", icon: "link", onSelect: () => setLastAction(`copy-link:${project.id}`) },
      { id: "invite", label: "Invite people", icon: "users", onSelect: () => setLastAction(`invite:${project.id}`) },
    ] },
    { type: "separator" },
    { id: "archive", label: "Archive", icon: "archive-box", danger: true, onSelect: () => setLastAction(`archive:${project.id}`) },
  ];

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (name.trim().length < 3) {
      setError("Use at least 3 characters.");
      return;
    }
    setError(null);
    toast({ title: "Project created", description: `${name.trim()} is ready.`, intent: "success" });
    setName("");
  };

  return (
    <Page header={<PageHeader eyebrow="Workspace" title="Projects" description="Sortable table, context menus and a creation form." />}>
      <PageSection
        title="All projects"
        actions={<SearchInput value={query} onValueChange={(value) => { setQuery(value); setPage(1); }} placeholder="Filter projects" aria-label="Filter projects" data-testid="projects-filter" />}
      >
        <div data-testid="projects-table">
          <DataTable
            rows={rows}
            columns={columns}
            rowKey={(p) => p.id}
            caption="Projects"
            captionHidden
            defaultSort={{ key: "name", direction: "asc" }}
            onRowClick={(p) => onSelect(p.id)}
            isRowSelected={(p) => p.id === selectedId}
            empty={<EmptyState icon="magnifying-glass" title="No projects match" description="Try a different name or owner." size="sm" />}
          />
        </div>
        <Inline justify="between">
          <span className="app-muted" data-testid="projects-count">{filtered.length} projects</span>
          <Pagination page={current} pageCount={pageCount} onPageChange={setPage} size="sm" />
        </Inline>
      </PageSection>

      <PageSection title="Pinned" description="Right-click a card to open its context menu.">
        <Grid min={220}>
          {PROJECTS.slice(0, 3).map((project) => (
            <ContextMenu key={project.id} items={menuFor(project)} label={`${project.name} actions`}>
              <Card variant="outlined" tabIndex={0} data-testid={`pinned-${project.id}`}>
                <CardHeader title={project.name} subtitle={project.owner} />
                <p className="app-text">{project.summary}</p>
              </Card>
            </ContextMenu>
          ))}
        </Grid>
        <span className="app-muted">Last action: <output data-testid="projects-last-action">{lastAction}</output></span>
      </PageSection>

      <PageSection title="New project">
        <Panel material="solid" padding="lg">
          <form onSubmit={submit} noValidate data-testid="project-form">
            <Stack gap={4}>
              <Field label="Name" required error={error} hint="Shown in the sidebar and in the command palette.">
                <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Project name" icon="folder" data-testid="project-name" />
              </Field>
              <Field label="Description" optionalLabel="Optional">
                <Textarea rows={3} placeholder="What is this project about?" data-testid="project-description" />
              </Field>
              <Field label="Visibility">
                <RadioGroup value={visibility} onValueChange={setVisibility} orientation="horizontal" aria-label="Visibility">
                  <Radio value="private">Private</Radio>
                  <Radio value="team">Team</Radio>
                  <Radio value="public">Public</Radio>
                </RadioGroup>
              </Field>
              <Field label={`Weekly budget: ${budget[0]} hours`}>
                <Slider value={budget} onValueChange={setBudget} min={0} max={80} step={5} aria-label="Weekly budget" />
              </Field>
              <Checkbox defaultChecked description="Members receive a summary every Monday.">Send weekly digest</Checkbox>
              <Switch defaultChecked>Enable review requests</Switch>
              <Inline justify="end">
                <Button type="reset" variant="ghost" onClick={() => { setName(""); setError(null); }}>Reset</Button>
                <Button type="submit" variant="primary" icon="plus" data-testid="project-submit">Create project</Button>
              </Inline>
            </Stack>
          </form>
        </Panel>
      </PageSection>
    </Page>
  );
}
