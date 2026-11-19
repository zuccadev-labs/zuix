import { useState } from "react";
import { Grid, Page, PageHeader, PageSection, Stack } from "@zuccadev-labs/zuix-zout";
import {
  Button,
  Calendar,
  Card,
  CardHeader,
  Combobox,
  DatePicker,
  DateRangePicker,
  DateTimePicker,
  Field,
  Modal,
  MonthPicker,
  NativeSelect,
  Select,
  WeekPicker,
  YearPicker,
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

const TODAY = "2026-11-19";
const BOOKED = new Set(["2026-11-20", "2026-11-21", "2026-11-22", "2026-11-25", "2026-11-28", "2026-11-29"]);
const PRESETS = [
  { label: "Today", value: "today" },
  { label: "Tomorrow", value: "tomorrow" },
  { label: "Next 7 days", value: "next-7-days" },
  { label: "Next 30 days", value: "next-30-days" },
  { label: "This month", value: "this-month" },
];

/** La familia de selección de fecha: variantes del Calendar y cada selector, con «hoy» fijo para las pruebas. */
function DateFamily() {
  const [multiple, setMultiple] = useState<string[]>(["2026-11-04", "2026-11-11"]);
  const [trip, setTrip] = useState<DateRange | null>({ from: "2026-11-26", to: "2026-12-04" });
  const [picked, setPicked] = useState<string | null>("2026-11-06");
  const [shown, setShown] = useState("2026-11");
  const [preset, setPreset] = useState<DateRange | null>(null);
  const [booking, setBooking] = useState<string | null>(null);
  const [viewed, setViewed] = useState<string | null>("2026-11-24");
  const [span, setSpan] = useState<DateRange | null>(null);
  const [month, setMonth] = useState<string | null>("2026-11");
  const [year, setYear] = useState<string | null>("2024");
  const [week, setWeek] = useState<string | null>("2026-W47");
  const [shifts, setShifts] = useState<string[]>([]);
  const [meeting, setMeeting] = useState<string | null>("2026-11-24T14:30");
  const [typed, setTyped] = useState<string | null>("2026-11-24");
  const out = (name: string, value: string) => (
    <span className="app-muted">
      Value: <output data-testid={`family-${name}-value`}>{value || "none"}</output>
    </span>
  );
  return (
    <Grid min={320}>
      <Card className="app-demo">
        <CardHeader title="Multiple dates" subtitle="Up to four" />
        <div data-testid="family-multiple">
          <Calendar
            mode="multiple"
            maxSelected={4}
            value={multiple}
            onValueChange={setMultiple}
            today={TODAY}
            defaultMonth="2026-11"
            locale="en-US"
            weekStartsOn={1}
          />
        </div>
        {out("multiple", multiple.join(","))}
      </Card>
      <Card className="app-demo">
        <CardHeader title="Two months" subtitle="Range across months, at least 3 days" />
        <div data-testid="family-months">
          <Calendar
            mode="range"
            numberOfMonths={2}
            minRange={3}
            value={trip}
            onValueChange={setTrip}
            today={TODAY}
            defaultMonth="2026-11"
            locale="en-US"
            weekStartsOn={1}
          />
        </div>
        {out("months", showRange(trip))}
      </Card>
      <Card className="app-demo">
        <CardHeader title="Month and year selects" subtitle="Bounded to 2025–2027" />
        <div data-testid="family-caption">
          <Calendar
            captionLayout="dropdown"
            min="2025-01-01"
            max="2027-12-31"
            value={picked}
            onValueChange={setPicked}
            onMonthChange={setShown}
            today={TODAY}
            locale="en-US"
            weekStartsOn={1}
          />
        </div>
        {out("caption", `${picked ?? "none"}@${shown}`)}
      </Card>
      <Card className="app-demo">
        <CardHeader title="Presets" subtitle="Relative to today" />
        <div data-testid="family-presets">
          <Calendar
            className="z-liquid"
            mode="range"
            presets={PRESETS}
            value={preset}
            onValueChange={setPreset}
            today={TODAY}
            locale="en-US"
            weekStartsOn={1}
          />
        </div>
        {out("presets", showRange(preset))}
      </Card>
      <Card className="app-demo">
        <CardHeader title="Booked dates" subtitle="Past days disabled; booked days struck through" />
        <div data-testid="family-booked">
          <Calendar
            min={TODAY}
            today={TODAY}
            defaultMonth="2026-11"
            value={booking}
            onValueChange={setBooking}
            isDateUnavailable={(date) => BOOKED.has(date)}
            unavailableLabel="booked"
            legend={{ today: "Today", selected: "Selected", unavailable: "Booked" }}
            locale="en-US"
            weekStartsOn={1}
          />
        </div>
        {out("booked", booking ?? "")}
      </Card>
      <Card className="app-demo">
        <CardHeader title="Views" subtitle="Title → months → years; week numbers and Today" />
        <div data-testid="family-views">
          <Calendar showWeekNumber fixedWeeks showTodayButton value={viewed} onValueChange={setViewed} today={TODAY} locale="en-GB" />
        </div>
        {out("views", viewed ?? "")}
      </Card>
      <Card className="app-demo">
        <CardHeader title="Pickers" subtitle="Range with confirmation, month, year, week and multiple" />
        <Stack gap={3}>
          <Field label="Window">
            <div data-testid="family-range-picker">
              <DateRangePicker
                confirm
                presets={PRESETS}
                value={span}
                onValueChange={setSpan}
                today={TODAY}
                locale="en-US"
                weekStartsOn={1}
                name="window"
              />
            </div>
          </Field>
          {out("range-picker", showRange(span))}
          <Field label="Billing month">
            <div data-testid="family-month-picker">
              <MonthPicker value={month} onValueChange={setMonth} today={TODAY} locale="en-US" min="2026-03" />
            </div>
          </Field>
          {out("month-picker", month ?? "")}
          <Field label="Model year">
            <div data-testid="family-year-picker">
              <YearPicker value={year} onValueChange={setYear} today={TODAY} locale="en-US" />
            </div>
          </Field>
          {out("year-picker", year ?? "")}
          <Field label="Report week">
            <div data-testid="family-week-picker">
              <WeekPicker value={week} onValueChange={setWeek} today={TODAY} locale="en-GB" name="week" />
            </div>
          </Field>
          {out("week-picker", week ?? "")}
          <Field label="Shifts">
            <div data-testid="family-multiple-picker">
              <DatePicker
                mode="multiple"
                value={shifts}
                onValueChange={setShifts}
                today={TODAY}
                locale="en-US"
                weekStartsOn={1}
                formatCount={(n) => `${n} shifts`}
              />
            </div>
          </Field>
          {out("multiple-picker", shifts.join(","))}
          <Field label="Meeting">
            <div data-testid="family-datetime">
              <DateTimePicker
                value={meeting}
                onValueChange={setMeeting}
                today={TODAY}
                locale="en-US"
                hourCycle={24}
                weekStartsOn={1}
                name="meeting"
              />
            </div>
          </Field>
          {out("datetime", meeting ?? "")}
          <Field label="Due date (typed)">
            <div data-testid="family-date-input">
              <DatePicker input value={typed} onValueChange={setTyped} today={TODAY} locale="en-US" weekStartsOn={1} />
            </div>
          </Field>
          {out("date-input", typed ?? "")}
        </Stack>
      </Card>
      <Card className="app-demo">
        <CardHeader title="Right to left" subtitle="Arabic (Egypt)" />
        <div data-testid="family-rtl" dir="rtl">
          <Calendar today={TODAY} defaultValue="2026-11-10" locale="ar-EG" />
        </div>
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
      <PageSection title="Date family" description="Calendar variants and every date picker.">
        <DateFamily />
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
