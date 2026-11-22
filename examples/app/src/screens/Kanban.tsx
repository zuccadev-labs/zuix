import { useState } from "react";
import { KanbanLayout, Page } from "@zuccadev-labs/zuix-zout";
import { AvatarGroup, Button, FabMenu, KanbanBoard, SearchInput, type KanbanColumn } from "@zuccadev-labs/zuix-zui";

const COLUMNS: KanbanColumn[] = [
  {
    id: "backlog",
    title: "Backlog",
    cards: [
      { id: "k1", title: "Audit color contrast in charts", labels: [{ text: "Design", tone: "info" }], priority: "medium", due: "Nov 28" },
      { id: "k2", title: "Write the 0.4 release notes", labels: [{ text: "Docs", tone: "neutral" }] },
      { id: "k3", title: "Spike: grid lanes for Masonry", labels: [{ text: "Research", tone: "accent" }], priority: "low" },
    ],
  },
  {
    id: "doing",
    title: "In progress",
    limit: 3,
    tone: "accent",
    cards: [
      {
        id: "k4",
        title: "Dashboard grid keyboard resize",
        description: "Shift and arrows change the size; announce rows and columns.",
        labels: [{ text: "A11y", tone: "success" }],
        priority: "urgent",
        assignees: [{ name: "Ana López" }, { name: "Marco Rossi" }],
        due: "Nov 24",
      },
      { id: "k5", title: "Profile editor validation", assignees: [{ name: "Yuki Tanaka" }], priority: "high" },
    ],
  },
  {
    id: "review",
    title: "Review",
    tone: "warning",
    cards: [
      { id: "k6", title: "Kanban pointer drag in Safari", labels: [{ text: "Bug", tone: "danger" }], assignees: [{ name: "Lea Martin" }] },
    ],
  },
  {
    id: "done",
    title: "Done",
    tone: "success",
    cards: [{ id: "k7", title: "Tracker roving focus", assignees: [{ name: "Omar Haddad" }] }],
  },
];

export function KanbanScreen() {
  const [columns, setColumns] = useState(COLUMNS);
  const [last, setLast] = useState("");
  return (
    <Page label="Board" width="full">
      <KanbanLayout
        title="Sprint 14"
        description="Nov 18 – Dec 1 · 7 cards"
        actions={
          <>
            <AvatarGroup
              size="sm"
              max={4}
              items={[
                { name: "Ana López" },
                { name: "Marco Rossi" },
                { name: "Yuki Tanaka" },
                { name: "Lea Martin" },
                { name: "Omar Haddad" },
              ]}
            />
            <Button icon="share">Share</Button>
          </>
        }
        filters={<SearchInput placeholder="Filter cards" aria-label="Filter cards" size="sm" />}
      >
        <div data-testid="kb-board">
          <KanbanBoard
            label="Sprint 14"
            addable
            columns={columns}
            onMove={(move) => {
              setColumns(move.columns);
              setLast(`${move.cardId} → ${move.toColumn} #${move.index + 1}`);
            }}
            onOpen={({ cardId }) => setLast(`Opened ${cardId}`)}
            onAdd={({ columnId }) => setLast(`Add to ${columnId}`)}
          />
        </div>
        <p className="app-muted" data-testid="kb-last">
          {last || "No moves yet"}
        </p>
      </KanbanLayout>
      <div className="app-fab">
        <FabMenu
          icon="plus"
          label="Create"
          items={[
            { id: "card", label: "Card", icon: "document-plus" },
            { id: "column", label: "Column", icon: "view-columns" },
            { id: "sprint", label: "Sprint", icon: "calendar-days" },
          ]}
        />
      </div>
    </Page>
  );
}
