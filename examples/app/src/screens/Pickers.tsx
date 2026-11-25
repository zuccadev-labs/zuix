import { useState, type FormEvent } from "react";
import { Grid, PageSection, Stack } from "@zuccadev-labs/zuix-zout";
import {
  Button,
  Card,
  CardHeader,
  Cascader,
  DateTimeRangePicker,
  Field,
  MaskedInput,
  QuarterPicker,
  TimeRangePicker,
  TreeSelect,
  type CascaderOption,
  type DateTimeRange,
  type TimeRange,
  type TreeSelectNode,
} from "@zuccadev-labs/zuix-zui";

const PLACES: CascaderOption[] = [
  {
    value: "es",
    label: "Spain",
    children: [
      {
        value: "md",
        label: "Madrid",
        children: [
          { value: "mad", label: "Madrid" },
          { value: "alc", label: "Alcalá de Henares" },
          { value: "get", label: "Getafe" },
        ],
      },
      {
        value: "ct",
        label: "Catalonia",
        children: [
          { value: "bcn", label: "Barcelona" },
          { value: "gir", label: "Girona" },
        ],
      },
    ],
  },
  { value: "pt", label: "Portugal", children: [{ value: "lis", label: "Lisbon", children: [{ value: "sin", label: "Sintra" }] }] },
  // Sin hijos: se cargan al abrirla.
  { value: "fr", label: "France", isLeaf: false },
  { value: "is", label: "Iceland", disabled: true },
];

/** Hijos que llegan del «servidor» con un poco de retraso. */
const loadChildren = (option: CascaderOption) =>
  new Promise<CascaderOption[]>((resolve) =>
    setTimeout(
      () =>
        resolve(
          option.value === "fr"
            ? [
                { value: "idf", label: "Île-de-France", children: [{ value: "par", label: "Paris" }] },
                { value: "ara", label: "Auvergne-Rhône-Alpes" },
              ]
            : [],
        ),
      400,
    ),
  );

const TEAMS: TreeSelectNode[] = [
  {
    value: "eng",
    label: "Engineering",
    children: [
      { value: "web", label: "Web" },
      { value: "mobile", label: "Mobile" },
      {
        value: "platform",
        label: "Platform",
        children: [
          { value: "infra", label: "Infrastructure" },
          { value: "data", label: "Data" },
        ],
      },
    ],
  },
  {
    value: "design",
    label: "Design",
    children: [
      { value: "brand", label: "Brand" },
      { value: "product", label: "Product design" },
    ],
  },
  { value: "sales", label: "Sales", disabled: true },
];

/** Cascader, TreeSelect, MaskedInput, rangos de horas y de fecha y hora y QuarterPicker en un formulario (tests/browser). */
export function Pickers() {
  const [place, setPlace] = useState<string[]>(["es", "md", "alc"]);
  const [coverage, setCoverage] = useState<string[][]>([["es", "ct"]]);
  const [team, setTeam] = useState<string | null>(null);
  const [teams, setTeams] = useState<string[]>(["web", "design"]);
  const [phone, setPhone] = useState("5551234567");
  const [cardNumber, setCardNumber] = useState("");
  const [shift, setShift] = useState<TimeRange>({ start: "22:00", end: "06:00" });
  const [office, setOffice] = useState<TimeRange>({ start: "09:00", end: "17:30" });
  const [window, setWindow] = useState<DateTimeRange>({ start: "2026-11-28T22:00", end: "2026-11-29T02:00", timeZone: "Europe/Madrid" });
  const [quarter, setQuarter] = useState<string | null>("2026-Q4");
  const [sent, setSent] = useState("none");
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const out: Record<string, string | string[]> = {};
    for (const key of new Set(data.keys())) {
      const all = data.getAll(key).map(String);
      out[key] = all.length > 1 ? all : all[0]!;
    }
    setSent(JSON.stringify(out));
  };

  return (
    <PageSection title="Pickers" description="Hierarchical selects, masks and ranges, all inside one native form.">
      <form onSubmit={submit} data-testid="pk-form" noValidate={false}>
        <Grid min={300}>
          <Card className="app-demo">
            <CardHeader title="Cascader" subtitle="Country, region and city" />
            <Stack gap={3}>
              <Field label="Location" hint="Type to search the whole path." required>
                <div data-testid="pk-cascader">
                  <Cascader
                    name="location"
                    searchable
                    clearable
                    required
                    levelLabels={["Country", "Region", "City"]}
                    options={PLACES}
                    loadChildren={loadChildren}
                    value={place}
                    onValueChange={setPlace}
                  />
                </div>
              </Field>
              <span className="app-muted">
                Value: <output data-testid="pk-cascader-value">{place.join("/") || "none"}</output>
              </span>
              <Field label="Coverage">
                <div data-testid="pk-cascader-multi">
                  <Cascader multiple name="coverage" options={PLACES} value={coverage} onValueChange={setCoverage} />
                </div>
              </Field>
              <span className="app-muted">
                Value: <output data-testid="pk-cascader-multi-value">{coverage.map((p) => p.join("/")).join(", ") || "none"}</output>
              </span>
            </Stack>
          </Card>

          <Card className="app-demo">
            <CardHeader title="TreeSelect" subtitle="Single, and checkboxes with mixed state" />
            <Stack gap={3}>
              <Field label="Owner team">
                <div data-testid="pk-tree">
                  <TreeSelect name="owner" clearable nodes={TEAMS} value={team} onValueChange={setTeam} />
                </div>
              </Field>
              <span className="app-muted">
                Value: <output data-testid="pk-tree-value">{team ?? "none"}</output>
              </span>
              <Field label="Teams" hint="A full branch counts as the branch.">
                <div data-testid="pk-tree-multi">
                  <TreeSelect
                    multiple
                    name="teams"
                    showCheckedStrategy="parent"
                    defaultExpanded={["eng"]}
                    nodes={TEAMS}
                    value={teams}
                    onValueChange={setTeams}
                  />
                </div>
              </Field>
              <span className="app-muted">
                Value: <output data-testid="pk-tree-multi-value">{teams.join(", ") || "none"}</output>
              </span>
            </Stack>
          </Card>

          <Card className="app-demo">
            <CardHeader title="MaskedInput" subtitle="Phone, card and plate" />
            <Stack gap={3}>
              <Field label="Phone">
                <div data-testid="pk-phone">
                  <MaskedInput mask="phone" name="phone" value={phone} onValueChange={setPhone} />
                </div>
              </Field>
              <span className="app-muted">
                Raw: <output data-testid="pk-phone-value">{phone || "none"}</output>
              </span>
              <Field label="Card number" validate>
                <div data-testid="pk-card">
                  <MaskedInput mask="card" name="card" icon="credit-card" value={cardNumber} onValueChange={setCardNumber} />
                </div>
              </Field>
              <Field label="License plate">
                <div data-testid="pk-plate">
                  <MaskedInput mask="plate" name="plate" submit="formatted" />
                </div>
              </Field>
            </Stack>
          </Card>

          <Card className="app-demo">
            <CardHeader title="Time ranges" subtitle="Office hours and a night shift" />
            <Stack gap={3}>
              <Field label="Opening hours" validate>
                <div data-testid="pk-office">
                  <TimeRangePicker name="hours" locale="en-US" value={office} onValueChange={setOffice} minDuration={30} />
                </div>
              </Field>
              <span className="app-muted">
                Value: <output data-testid="pk-office-value">{`${office.start ?? ""}/${office.end ?? ""}`}</output>
              </span>
              <Field label="Night shift">
                <div data-testid="pk-shift">
                  <TimeRangePicker name="shift" allowOvernight locale="en-GB" hourCycle={24} value={shift} onValueChange={setShift} />
                </div>
              </Field>
            </Stack>
          </Card>

          <Card className="app-demo">
            <CardHeader title="Date and time range" subtitle="Time zone and quick ranges" />
            <Stack gap={3}>
              <Field label="Maintenance window">
                <div data-testid="pk-window">
                  <DateTimeRangePicker
                    name="window"
                    showTimeZone
                    timeZones={["UTC", "Europe/Madrid", "America/New_York", "Asia/Tokyo"]}
                    locale="en-US"
                    hourCycle={24}
                    today="2026-11-25"
                    presets={[
                      { label: "Today", value: "today" },
                      { label: "Last 24 hours", value: "last-24-hours" },
                      { label: "Next 7 days", value: "next-7-days" },
                    ]}
                    value={window}
                    onValueChange={setWindow}
                  />
                </div>
              </Field>
              <span className="app-muted">
                Value: <output data-testid="pk-window-value">{`${window.start ?? ""}/${window.end ?? ""} ${window.timeZone ?? ""}`}</output>
              </span>
            </Stack>
          </Card>

          <Card className="app-demo">
            <CardHeader title="QuarterPicker" subtitle="Fiscal quarters" />
            <Stack gap={3}>
              <Field label="Report quarter">
                <div data-testid="pk-quarter">
                  <QuarterPicker
                    name="quarter"
                    locale="en-US"
                    today="2026-11-25"
                    min="2024-Q1"
                    max="2027-Q4"
                    value={quarter}
                    onValueChange={setQuarter}
                  />
                </div>
              </Field>
              <span className="app-muted">
                Value: <output data-testid="pk-quarter-value">{quarter ?? "none"}</output>
              </span>
              <div dir="rtl" data-testid="pk-rtl">
                <Cascader aria-label="Right-to-left location" options={PLACES} />
              </div>
            </Stack>
          </Card>
        </Grid>
        <Stack gap={2}>
          <span>
            <Button type="submit" variant="primary" data-testid="pk-submit">
              Send
            </Button>{" "}
            <Button type="reset" variant="ghost" data-testid="pk-reset">
              Reset
            </Button>
          </span>
          <output className="app-muted" data-testid="pk-sent">
            {sent}
          </output>
        </Stack>
      </form>
    </PageSection>
  );
}
