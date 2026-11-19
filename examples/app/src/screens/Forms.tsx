import { useState } from "react";
import { Grid, Page, PageHeader, PageSection, Stack } from "@zuccadev-labs/zuix-zout";
import {
  Button,
  Calendar,
  Card,
  CardHeader,
  Combobox,
  DatePicker,
  Field,
  Modal,
  NativeSelect,
  Select,
  type ComboboxOption,
  type DateRange,
  type SelectOption,
  type SelectOptionGroup,
} from "@zuccadev-labs/zuix-zui";
import { DateTimeFields } from "./DateTimeFields";

const ROLES: ReadonlyArray<SelectOption | SelectOptionGroup> = [
  { value: "viewer", label: "Viewer", icon: "eye" },
  { value: "editor", label: "Editor", icon: "pencil" },
  { value: "locked", label: "Guest (unavailable)", disabled: true },
  {
    label: "Administration",
    options: [
      { value: "admin", label: "Admin", icon: "key" },
      { value: "owner", label: "Owner", icon: "star" },
    ],
  },
];

const PEOPLE: ReadonlyArray<ComboboxOption> = [
  { value: "marta", label: "Marta Ruiz" },
  { value: "ken", label: "Ken Adams" },
  { value: "ines", label: "Inés Vidal" },
  { value: "omar", label: "Omar Haddad" },
  { value: "lena", label: "Lena Fischer", disabled: true },
  { value: "noor", label: "Noor Rahman" },
];

const PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "blocked", label: "Blocked", disabled: true },
];

const showRange = (range: DateRange | null) => (range?.from ? `${range.from}/${range.to ?? ""}` : "none");

/** Los cinco controles de selección con su valor a la vista. `scope` distingue la copia de la página de la del modal. */
function Controls({ scope }: { scope: "page" | "modal" }) {
  const [role, setRole] = useState("");
  const [person, setPerson] = useState<string | null>(null);
  const [day, setDay] = useState<string | null>("2026-03-10");
  const [range, setRange] = useState<DateRange | null>(null);
  const [due, setDue] = useState<string | null>(null);
  const [stay, setStay] = useState<DateRange | null>(null);
  const [priority, setPriority] = useState("");
  const id = (name: string) => `${scope}-${name}`;

  return (
    <Grid min={260}>
      <Card className="app-demo">
        <CardHeader title="Select" subtitle="Custom popup with icons and groups" />
        <Field label="Role">
          <div data-testid={id("select")}>
            <Select options={ROLES} value={role} onValueChange={setRole} placeholder="Choose a role" />
          </div>
        </Field>
        <span className="app-muted">
          Value: <output data-testid={id("select-value")}>{role || "none"}</output>
        </span>
      </Card>

      <Card className="app-demo">
        <CardHeader title="Combobox" subtitle="Filterable list, focus stays in the field" />
        <Field label="Assignee">
          <div data-testid={id("combobox")}>
            <Combobox options={PEOPLE} value={person} onValueChange={setPerson} placeholder="Search people" clearable />
          </div>
        </Field>
        <span className="app-muted">
          Value: <output data-testid={id("combobox-value")}>{person ?? "none"}</output>
        </span>
      </Card>

      <Card className="app-demo">
        <CardHeader title="NativeSelect" subtitle="System list" />
        <Field label="Priority">
          <NativeSelect
            options={PRIORITIES}
            value={priority}
            onChange={(event) => setPriority(event.target.value)}
            placeholder="Choose a priority"
            data-testid={id("native")}
          />
        </Field>
        <span className="app-muted">
          Value: <output data-testid={id("native-value")}>{priority || "none"}</output>
        </span>
      </Card>

      <Card className="app-demo">
        <CardHeader title="DatePicker" subtitle="Single date and range" />
        <Stack gap={3}>
          <Field label="Due date">
            <div data-testid={id("date")}>
              <DatePicker value={due} onValueChange={setDue} locale="en-US" weekStartsOn={1} />
            </div>
          </Field>
          <span className="app-muted">
            Value: <output data-testid={id("date-value")}>{due ?? "none"}</output>
          </span>
          <Field label="Stay">
            <div data-testid={id("range")}>
              <DatePicker mode="range" value={stay} onValueChange={setStay} locale="en-US" weekStartsOn={1} />
            </div>
          </Field>
          <span className="app-muted">
            Value: <output data-testid={id("range-value")}>{showRange(stay)}</output>
          </span>
        </Stack>
      </Card>

      <Card className="app-demo">
        <CardHeader title="Calendar" subtitle="Single date, bounded to March and April 2026" />
        <div data-testid={id("calendar")}>
          <Calendar
            value={day}
            onValueChange={setDay}
            defaultMonth="2026-03"
            min="2026-03-03"
            max="2026-04-20"
            locale="en-US"
            weekStartsOn={1}
            isDateDisabled={(date) => date === "2026-03-17"}
          />
        </div>
        <span className="app-muted">
          Value: <output data-testid={id("calendar-value")}>{day ?? "none"}</output>
        </span>
      </Card>

      <Card className="app-demo">
        <CardHeader title="Calendar range" subtitle="Two clicks or keyboard" />
        <div data-testid={id("calendar-range")}>
          <Calendar mode="range" value={range} onValueChange={setRange} defaultMonth="2026-03" locale="en-US" weekStartsOn={1} />
        </div>
        <span className="app-muted">
          Value: <output data-testid={id("calendar-range-value")}>{showRange(range)}</output>
        </span>
      </Card>
    </Grid>
  );
}

export function Forms() {
  return (
    <Page
      header={
        <PageHeader
          eyebrow="Components"
          title="Forms"
          description="Select, Combobox, Calendar, DatePicker and NativeSelect, on the page and inside a modal."
        />
      }
    >
      <PageSection title="On the page">
        <Controls scope="page" />
      </PageSection>
      <PageSection title="Inside a modal" description="The same controls, with their popups layered above the dialog.">
        <div>
          <Modal
            trigger={
              <Button variant="primary" icon="window" data-testid="open-forms-modal">
                Open form in a modal
              </Button>
            }
            title="Schedule task"
            description="Popups open above the dialog and keep the focus trapped."
            size="lg"
          >
            <Controls scope="modal" />
          </Modal>
        </div>
      </PageSection>
      <DateTimeFields />
    </Page>
  );
}
