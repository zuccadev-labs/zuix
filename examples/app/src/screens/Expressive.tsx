// Variantes de Material 3 Expressive en la pantalla `?screen=inputs`: barra y anillo ondulados, botón tonal, grupo
// conectado, Slider desde el centro, etiqueta flotante con autocompletado, Modal a pantalla completa en el teléfono y
// el menú del FAB.
import { useState } from "react";
import { Grid, Inline, PageSection, Stack } from "@zuccadev-labs/zuix-zout";
import {
  Button,
  ButtonGroup,
  Card,
  CardHeader,
  CircularProgress,
  FabMenu,
  Field,
  Input,
  Modal,
  Progress,
  Slider,
} from "@zuccadev-labs/zuix-zui";

const VIEWS = [
  { id: "list", label: "List", icon: "list-bullet" },
  { id: "grid", label: "Grid", icon: "squares-2x2" },
  { id: "calendar", label: "Calendar", icon: "calendar-days" },
] as const;

export function ExpressiveSection() {
  const [view, setView] = useState<string>("grid");
  const [balance, setBalance] = useState(-20);
  const [action, setAction] = useState("none");
  return (
    <PageSection title="Material 3 Expressive">
      <Grid min={280}>
        <Card className="app-demo" data-testid="x3-progress">
          <CardHeader title="Wavy progress" subtitle="Bar and ring, determinate and indeterminate" />
          <Stack gap={4}>
            <Progress label="Exporting" value={64} variant="wavy" showValue />
            <Progress label="Syncing" variant="wavy" />
            <Inline gap={4} align="center">
              <CircularProgress label="Upload" value={72} variant="wavy" size="lg" showValue />
              <CircularProgress label="Loading" variant="wavy" size="lg" />
            </Inline>
          </Stack>
        </Card>
        <Card className="app-demo" data-testid="x3-buttons">
          <CardHeader title="Tonal and connected" subtitle="Button variant and ButtonGroup" />
          <Stack gap={4}>
            <Inline gap={2}>
              <Button variant="primary">Publish</Button>
              <Button variant="tonal" icon="eye">
                Preview
              </Button>
              <Button>Save draft</Button>
            </Inline>
            <ButtonGroup label="View" connected data-testid="x3-group">
              {VIEWS.map((v) => (
                <Button key={v.id} icon={v.icon} aria-pressed={view === v.id} onClick={() => setView(v.id)}>
                  {v.label}
                </Button>
              ))}
            </ButtonGroup>
          </Stack>
        </Card>
        <Card className="app-demo" data-testid="x3-slider">
          <CardHeader title="Centered slider" subtitle="origin=&quot;center&quot;" />
          <Stack gap={2}>
            <Slider
              aria-label="Balance"
              value={[balance]}
              onValueChange={(v) => setBalance(v[0] ?? 0)}
              min={-50}
              max={50}
              step={5}
              origin="center"
            />
            <span className="app-muted" data-testid="x3-balance">{`Balance ${balance}`}</span>
          </Stack>
        </Card>
        <Card className="app-demo" data-testid="x3-fields">
          <CardHeader title="Floating labels" subtitle="With browser autofill" />
          <form onSubmit={(e) => e.preventDefault()}>
            <Stack gap={4}>
              <Field label="Email" labelPlacement="floating">
                <Input type="email" name="email" autoComplete="email" data-testid="x3-email" />
              </Field>
              <Field label="Full name" labelPlacement="floating" hint="As it appears on your ID.">
                <Input name="name" autoComplete="name" icon="user" data-testid="x3-name" />
              </Field>
            </Stack>
          </form>
        </Card>
        <Card className="app-demo" data-testid="x3-overlays">
          <CardHeader title="Full-screen dialog and FAB menu" subtitle="Compact windows and speed dial" />
          <Inline gap={4} align="center">
            <Modal
              trigger={
                <Button variant="tonal" data-testid="x3-open">
                  New event
                </Button>
              }
              title="New event"
              fullScreen="compact"
              footer={<Button variant="primary">Save</Button>}
            >
              <Field label="Title" labelPlacement="floating">
                <Input name="title" />
              </Field>
            </Modal>
            <FabMenu
              icon="plus"
              label="Create"
              items={[
                { id: "doc", label: "Document", icon: "document-text", onSelect: () => setAction("doc") },
                { id: "image", label: "Image", icon: "photo", onSelect: () => setAction("image") },
                { id: "folder", label: "Folder", icon: "folder-plus", onSelect: () => setAction("folder") },
              ]}
            />
            <span className="app-muted" data-testid="x3-action">{`Created: ${action}`}</span>
          </Inline>
        </Card>
      </Grid>
    </PageSection>
  );
}
