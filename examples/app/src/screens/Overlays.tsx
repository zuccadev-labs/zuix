import { useState } from "react";
import { Grid, Inline, Page, PageHeader, PageSection, Stack } from "@zuccadev-labs/zuix-zout";
import {
  Button, Card, CardHeader, Checkbox, ConfirmDialog, ContextMenu, Drawer, Field, IconButton, Input, Kbd, Menu, Modal, Popover, Switch, Tooltip, useToast,
  type MenuEntry,
} from "@zuccadev-labs/zuix-zui";

export function Overlays({ onOpenPalette }: { onOpenPalette: () => void }) {
  const { toast, dismissAll } = useToast();
  const [last, setLast] = useState("none");
  const [modalOpen, setModalOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [pinned, setPinned] = useState(false);

  const menu: MenuEntry[] = [
    { type: "label", label: "Document" },
    { id: "rename", label: "Rename", icon: "pencil", shortcut: "F2", onSelect: () => setLast("menu:rename") },
    { id: "duplicate", label: "Duplicate", icon: "document-duplicate", onSelect: () => setLast("menu:duplicate") },
    { id: "pin", label: pinned ? "Unpin" : "Pin", icon: "star", keepOpen: true, onSelect: () => setPinned((value) => !value) },
    { id: "locked", label: "Locked action", icon: "lock-closed", disabled: true },
    {
      id: "move", label: "Move to", icon: "folder",
      items: [
        { id: "move-atlas", label: "Atlas", onSelect: () => setLast("menu:move-atlas") },
        { id: "move-borealis", label: "Borealis", onSelect: () => setLast("menu:move-borealis") },
      ],
    },
    { type: "separator" },
    { id: "delete", label: "Delete", icon: "trash", danger: true, onSelect: () => setLast("menu:delete") },
  ];

  const roleMenu: MenuEntry[] = [
    { id: "viewer", label: "Viewer", onSelect: () => setLast("role:viewer") },
    { id: "editor", label: "Editor", onSelect: () => setLast("role:editor") },
    { id: "admin", label: "Admin", onSelect: () => setLast("role:admin") },
  ];

  return (
    <Page header={<PageHeader eyebrow="Components" title="Overlays" description="Every floating layer of the suite, opened from real triggers." />}>
      <p className="app-muted">Last action: <output data-testid="last-action">{last}</output></p>

      <PageSection title="Dialogs">
        <Grid min={240}>
          <Card className="app-demo">
            <CardHeader title="Modal" subtitle="Form with a nested menu" />
            <Modal
              open={modalOpen}
              onOpenChange={setModalOpen}
              trigger={<Button variant="primary" icon="users" data-testid="open-modal">Invite member</Button>}
              title="Invite member"
              description="They will receive an email with a link to join."
              footer={
                <>
                  <Button variant="ghost" onClick={() => setModalOpen(false)} data-testid="modal-cancel">Cancel</Button>
                  <Button variant="primary" onClick={() => { setLast(`invite:${email || "empty"}`); setModalOpen(false); }} data-testid="modal-submit">Send invite</Button>
                </>
              }
            >
              <Stack gap={4}>
                <Field label="Email">
                  <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" data-testid="modal-email" />
                </Field>
                <Inline>
                  <Menu trigger={<Button iconRight="chevron-down" data-testid="modal-role">Role</Button>} items={roleMenu} label="Role" align="start" />
                  <Checkbox defaultChecked>Notify by email</Checkbox>
                </Inline>
              </Stack>
            </Modal>
          </Card>

          <Card className="app-demo">
            <CardHeader title="Locked modal" subtitle="Escape and the scrim do not close it" />
            <Modal
              trigger={<Button icon="lock-closed" data-testid="open-locked">Open locked modal</Button>}
              title="Unsaved changes"
              dismissible={false}
              size="sm"
              closeLabel="Close locked modal"
            >
              Use the close button to leave this dialog.
            </Modal>
          </Card>

          <Card className="app-demo">
            <CardHeader title="Confirm dialog" subtitle="Destructive confirmation" />
            <ConfirmDialog
              trigger={<Button variant="danger" icon="trash" data-testid="open-confirm">Delete project</Button>}
              title="Delete project?"
              description="This removes the project and its 18 tasks. It cannot be undone."
              intent="danger"
              confirmLabel="Delete"
              onConfirm={() => setLast("confirm:delete")}
              onCancel={() => setLast("confirm:cancel")}
            />
          </Card>

          <Card className="app-demo">
            <CardHeader title="Drawer" subtitle="Side and bottom panels" />
            <Inline>
              <Drawer
                trigger={<Button icon="adjustments-horizontal" data-testid="open-drawer">Settings</Button>}
                title="Settings"
                description="Preferences for this workspace."
                footer={<Button variant="primary" onClick={() => setLast("drawer:save")} data-testid="drawer-save">Save</Button>}
              >
                <Stack gap={4}>
                  <Field label="Workspace name"><Input defaultValue="Zuix workspace" data-testid="drawer-name" /></Field>
                  <Switch defaultChecked>Compact density</Switch>
                  <Switch>Reduce transparency</Switch>
                </Stack>
              </Drawer>
              <Drawer trigger={<Button data-testid="open-drawer-bottom">Activity</Button>} side="bottom" size="sm" title="Activity">
                <p className="app-text">Borealis moved to review two hours ago.</p>
              </Drawer>
            </Inline>
          </Card>
        </Grid>
      </PageSection>

      <PageSection title="Anchored layers">
        <Grid min={240}>
          <Card className="app-demo">
            <CardHeader title="Popover" subtitle="Small form anchored to its trigger" />
            <Popover trigger={<Button icon="tag" data-testid="open-popover">Add label</Button>} label="Add label" width={260} align="start">
              <Stack gap={3}>
                <Field label="Label"><Input placeholder="design, urgent" data-testid="popover-input" /></Field>
                <Button variant="primary" size="sm" onClick={() => setLast("popover:apply")} data-testid="popover-apply">Apply</Button>
              </Stack>
            </Popover>
          </Card>

          <Card className="app-demo">
            <CardHeader title="Tooltip" subtitle="On hover and on keyboard focus" />
            <Inline>
              <Tooltip content="Refresh the list">
                <IconButton icon="arrow-path" label="Refresh" title={undefined} variant="secondary" data-testid="tooltip-trigger" />
              </Tooltip>
              <Tooltip content="Opens in a new window" side="right">
                <Button iconRight="arrow-top-right-on-square" data-testid="tooltip-trigger-2">Docs</Button>
              </Tooltip>
            </Inline>
          </Card>

          <Card className="app-demo">
            <CardHeader title="Menu" subtitle="Submenu, shortcut and persistent item" />
            <Inline>
              <Menu trigger={<Button iconRight="chevron-down" data-testid="open-menu">Actions</Button>} items={menu} label="Document actions" align="start" />
              <span className="app-muted" data-testid="pin-state">{pinned ? "Pinned" : "Not pinned"}</span>
            </Inline>
          </Card>

          <Card className="app-demo">
            <CardHeader title="Context menu" subtitle="Right-click or long press" />
            <ContextMenu items={menu} label="Document actions">
              <div className="app-dropzone" tabIndex={0} data-testid="context-area">Right-click this area</div>
            </ContextMenu>
          </Card>
        </Grid>
      </PageSection>

      <PageSection title="Command palette and toasts">
        <Grid min={240}>
          <Card className="app-demo">
            <CardHeader title="Command palette" subtitle="Search and run commands" />
            <Inline>
              <Button icon="magnifying-glass" onClick={onOpenPalette} data-testid="open-palette-button">Open palette</Button>
              <Kbd keys="Ctrl K" />
            </Inline>
          </Card>
          <Card className="app-demo">
            <CardHeader title="Toasts" subtitle="Stacked notifications" />
            <Inline>
              <Button onClick={() => toast({ title: "Changes saved", description: "Every edit is synced.", intent: "success" })} data-testid="toast-success">Success</Button>
              <Button onClick={() => toast({ title: "Upload failed", description: "The file is larger than 20 MB.", intent: "danger", duration: 60000 })} data-testid="toast-danger">Error</Button>
              <Button
                onClick={() => toast({ title: "Project archived", intent: "warning", duration: 60000, action: { label: "Undo", onClick: () => setLast("toast:undo") } })}
                data-testid="toast-action"
              >
                With action
              </Button>
              <Button variant="ghost" onClick={dismissAll} data-testid="toast-clear">Clear</Button>
            </Inline>
          </Card>
        </Grid>
      </PageSection>
    </Page>
  );
}
