import { useState } from "react";
import { Grid, Page, PageHeader, PageSection, Stack } from "@zuccadev-labs/zuix-zout";
import {
  Alert,
  Avatar,
  AvatarGroup,
  Badge,
  Breadcrumb,
  Button,
  Callout,
  Card,
  CardFooter,
  CardHeader,
  Progress,
  StatTile,
} from "@zuccadev-labs/zuix-zui";
import { PROJECTS, STATUS_LABEL, STATUS_TONE, type ScreenId } from "../data";

export function Overview({ onNavigate, onSelectProject }: { onNavigate: (id: ScreenId) => void; onSelectProject: (id: string) => void }) {
  const [alert, setAlert] = useState(true);
  const active = PROJECTS.filter((p) => p.status === "active");
  const tasks = PROJECTS.reduce((sum, p) => sum + p.tasks, 0);
  return (
    <Page
      header={
        <PageHeader
          breadcrumb={<Breadcrumb items={[{ label: "Workspace", icon: "home" }, { label: "Overview" }]} />}
          eyebrow="Workspace"
          title="Overview"
          description="A sample workspace that exercises the shell, overlays, forms, tables and the carousel of the suite."
          actions={
            <>
              <Button icon="folder" onClick={() => onNavigate("projects")} data-testid="overview-projects">
                Projects
              </Button>
              <Button variant="primary" icon="window" onClick={() => onNavigate("overlays")} data-testid="overview-overlays">
                Overlays
              </Button>
            </>
          }
        />
      }
    >
      {alert ? (
        <Alert tone="info" title="Review window open" onDismiss={() => setAlert(false)}>
          Two projects are waiting for your review before Friday.
        </Alert>
      ) : null}

      <PageSection title="Metrics" description="Updated a few minutes ago.">
        <Grid min={148}>
          <StatTile label="Projects" value={PROJECTS.length} icon="folder" hint="Across 4 teams" onClick={() => onNavigate("projects")} />
          <StatTile label="Active" value={active.length} icon="bolt" delta="+2" deltaTone="success" />
          <StatTile label="Open tasks" value={tasks} icon="queue-list" delta="-8%" deltaTone="success" variant="soft" />
          <StatTile label="Completion" value="62%" icon="chart-bar" variant="solid" />
        </Grid>
      </PageSection>

      <PageSection
        title="Active projects"
        actions={
          <Button variant="ghost" iconRight="arrow-right" onClick={() => onNavigate("projects")}>
            View all
          </Button>
        }
      >
        <Grid min={280}>
          {active.map((project) => (
            <Card key={project.id} data-testid={`overview-card-${project.id}`}>
              <CardHeader
                title={project.name}
                subtitle={project.owner}
                action={<Badge tone={STATUS_TONE[project.status]}>{STATUS_LABEL[project.status]}</Badge>}
              />
              <p className="app-text">{project.summary}</p>
              <Progress value={project.progress} label={`${project.name} completion`} showValue size="sm" />
              <CardFooter align="between">
                <AvatarGroup max={3} size="sm">
                  <Avatar name={project.owner} />
                  <Avatar name="Ken Adams" />
                  <Avatar name="Lena Fischer" />
                  <Avatar name="Omar Haddad" />
                </AvatarGroup>
                <Button
                  size="sm"
                  onClick={() => {
                    onSelectProject(project.id);
                    onNavigate("projects");
                  }}
                >
                  Open
                </Button>
              </CardFooter>
            </Card>
          ))}
        </Grid>
      </PageSection>

      <PageSection title="Notes">
        <Stack gap={3}>
          <Callout tone="accent" title="Keyboard first">
            Press Ctrl K to open the command palette from any screen.
          </Callout>
          <Callout tone="warning" title="Maintenance">
            The preview environment restarts every night at 02:00 UTC.
          </Callout>
        </Stack>
      </PageSection>
    </Page>
  );
}
