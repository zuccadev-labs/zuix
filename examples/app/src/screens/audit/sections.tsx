// Secciones de la pantalla de auditoría que no usan portal: se renderizan también en servidor (AuditSsr).
import { useRef, useState, type ReactNode } from "react";
import {
  Accordion, Alert, Avatar, AvatarGroup, Badge, Breadcrumb, Button, Calendar, Card, CardHeader, Carousel, Checkbox, Chip, CodeBlock, Combobox,
  DataTable, DateInput, DatePicker, ErrorBoundary, Field, FileUpload, IconButton, Input, Link, LoadingOverlay, NativeSelect, NavLink, NavList,
  OTPInput, Pagination, Radio, RadioGroup, Rating, SearchInput, SegmentedControl, Select, Slider, Stepper, Switch, TabPanel, Tabs, Textarea,
  Toggle, Tree, type DataTableColumn, type TreeNode,
} from "@zuccadev-labs/zuix-zui";

export function Cell({ title, id, children }: { title: string; id?: string; children: ReactNode }) {
  return (
    <Card className="audit__cell" data-testid={id}>
      <CardHeader title={title} />
      {children}
    </Card>
  );
}

export const Out = ({ id, children }: { id: string; children: ReactNode }) => (
  <span className="app-muted">
    <output data-testid={id}>{children}</output>
  </span>
);

export const OPTIONS = [
  { value: "alpha", label: "Alpha" },
  { value: "beta", label: "Beta" },
  { value: "gamma", label: "Gamma", disabled: true },
  { value: "delta", label: "Delta" },
];

/* ---------- Acciones ---------- */

export function ActionsSection() {
  const [loading, setLoading] = useState(false);
  const [clicks, setClicks] = useState(0);
  const [linkClicks, setLinkClicks] = useState(0);
  const [seg, setSeg] = useState("list");
  const [pressed, setPressed] = useState(false);
  return (
    <>
      <Cell title="Button and IconButton" id="a-buttons">
        <div className="audit__row">
          <Button variant="primary" loading={loading} onClick={() => setClicks((n) => n + 1)} data-testid="a-btn">Save</Button>
          <Button onClick={() => setLoading((v) => !v)} data-testid="a-btn-toggle-loading">Toggle loading</Button>
          <IconButton icon="star" label="Favorite" onClick={() => setClicks((n) => n + 1)} data-testid="a-iconbtn" />
        </div>
        <Out id="a-btn-clicks">{clicks}</Out>
      </Cell>
      <Cell title="Link" id="a-links">
        <div className="audit__row">
          <Link href="#audit-link" onClick={() => setLinkClicks((n) => n + 1)} data-testid="a-link">Enabled link</Link>
          <Link href="#audit-disabled" disabled onClick={() => setLinkClicks((n) => n + 1)} data-testid="a-link-disabled">Disabled link</Link>
          <Link href="https://example.com/" external variant="standalone" data-testid="a-link-external">External</Link>
        </div>
        <Out id="a-link-clicks">{linkClicks}</Out>
      </Cell>
      <Cell title="SegmentedControl and Toggle" id="a-segmented">
        <div data-testid="a-seg">
          <SegmentedControl
            label="View"
            value={seg}
            onValueChange={setSeg}
            items={[
              { value: "list", label: "List" },
              { value: "board", label: "Board" },
              { value: "locked", label: "Locked", disabled: true },
              { value: "table", label: "Table" },
            ]}
          />
        </div>
        <Out id="a-seg-value">{seg}</Out>
        <div className="audit__row">
          <Toggle pressed={pressed} onPressedChange={setPressed} icon="star" data-testid="a-toggle">Pin</Toggle>
          <Toggle icon="star" label="Favorite" data-testid="a-toggle-icon" />
        </div>
        <Out id="a-toggle-value">{pressed ? "on" : "off"}</Out>
      </Cell>
    </>
  );
}

/* ---------- Formularios ---------- */

export function FormsSection() {
  const [check, setCheck] = useState<boolean | "indeterminate">("indeterminate");
  const [radio, setRadio] = useState("email");
  const [sw, setSw] = useState(false);
  const [slider, setSlider] = useState([40]);
  const [range, setRange] = useState([20, 80]);
  const [otp, setOtp] = useState("");
  const [otpDone, setOtpDone] = useState("");
  const [search, setSearch] = useState("");
  const [searched, setSearched] = useState("");
  const [cleared, setCleared] = useState(0);
  const [searching, setSearching] = useState(false);
  const [ta, setTa] = useState("one");
  const [accepted, setAccepted] = useState<string[]>([]);
  const [rejected, setRejected] = useState<string[]>([]);
  const [single, setSingle] = useState<string[]>([]);
  const [off, setOff] = useState(0);
  const [submitted, setSubmitted] = useState("");
  const [native, setNative] = useState("unset");
  const [text, setText] = useState("");
  return (
    <>
      <Cell title="Checkbox, RadioGroup and Switch" id="a-choice">
        <Checkbox checked={check} onCheckedChange={setCheck} data-testid="a-check">Select all</Checkbox>
        <Checkbox disabled data-testid="a-check-disabled">Disabled</Checkbox>
        <Out id="a-check-value">{String(check)}</Out>
        <RadioGroup value={radio} onValueChange={setRadio} aria-label="Contact" data-testid="a-radio">
          <Radio value="email">Email</Radio>
          <Radio value="phone">Phone</Radio>
          <Radio value="fax" disabled>Fax</Radio>
          <Radio value="post">Post</Radio>
        </RadioGroup>
        <Out id="a-radio-value">{radio}</Out>
        <Switch checked={sw} onCheckedChange={setSw} data-testid="a-switch">Notifications</Switch>
        <Switch disabled data-testid="a-switch-disabled">Disabled</Switch>
        <Out id="a-switch-value">{sw ? "on" : "off"}</Out>
      </Cell>
      <Cell title="Slider" id="a-sliders">
        <div data-testid="a-slider">
          <Slider value={slider} onValueChange={setSlider} min={0} max={100} step={5} aria-label="Volume" />
        </div>
        <Out id="a-slider-value">{slider.join(",")}</Out>
        <div data-testid="a-slider-range">
          <Slider value={range} onValueChange={setRange} min={0} max={100} step={10} thumbLabels={["Minimum", "Maximum"]} />
        </div>
        <Out id="a-range-value">{range.join(",")}</Out>
        <div data-testid="a-slider-disabled">
          <Slider defaultValue={[30]} disabled aria-label="Locked" />
        </div>
      </Cell>
      <Cell title="OTPInput" id="a-otp-cell">
        <div data-testid="a-otp">
          <OTPInput length={4} value={otp} onChange={setOtp} onComplete={setOtpDone} name="code" />
        </div>
        <Out id="a-otp-value">{otp || "empty"}</Out>
        <Out id="a-otp-complete">{otpDone || "pending"}</Out>
        <div data-testid="a-otp-text">
          <OTPInput length={3} mode="text" label="Invite code" />
        </div>
      </Cell>
      <Cell title="SearchInput" id="a-search-cell">
        <SearchInput value={search} onValueChange={setSearch} onSearch={setSearched} onClear={() => setCleared((n) => n + 1)} loading={searching} data-testid="a-search" />
        <Button size="sm" onClick={() => setSearching((v) => !v)} data-testid="a-search-loading">Toggle loading</Button>
        <Out id="a-search-value">{search || "empty"}</Out>
        <Out id="a-search-submitted">{searched || "none"}</Out>
        <Out id="a-search-cleared">{cleared}</Out>
        <SearchInput defaultValue="draft" aria-label="Uncontrolled search" data-testid="a-search-unc" />
      </Cell>
      <Cell title="Input, Textarea and DateInput" id="a-text-cell">
        <Input value={text} onChange={(event) => setText(event.target.value)} invalid={text.length > 0 && text.length < 3} icon="user" trailing={<Badge size="sm">kg</Badge>} aria-label="Weight" data-testid="a-input" />
        <Out id="a-input-value">{text || "empty"}</Out>
        <Textarea value={ta} onChange={(event) => setTa(event.target.value)} autoRows rows={2} maxRows={5} aria-label="Controlled notes" data-testid="a-ta-ctl" />
        <Textarea defaultValue="one" autoRows rows={2} maxRows={5} aria-label="Uncontrolled notes" data-testid="a-ta-unc" />
        <div data-testid="a-dateinput">
          <DateInput aria-label="Start" defaultValue="2026-03-10" />
        </div>
        <div data-testid="a-dateinput-disabled">
          <DateInput aria-label="Locked date" disabled />
        </div>
      </Cell>
      <Cell title="NativeSelect" id="a-native-cell">
        <NativeSelect options={OPTIONS} placeholder="Choose a letter" aria-label="Letter" onChange={(event) => setNative(event.target.value)} data-testid="a-native" />
        <Out id="a-native-value">{native}</Out>
      </Cell>
      <Cell title="FileUpload" id="a-upload-cell">
        <form
          data-testid="a-upload-form"
          onSubmit={(event) => {
            event.preventDefault();
            setSubmitted(new FormData(event.currentTarget).getAll("docs").map((file) => (file instanceof File ? file.name : String(file))).filter(Boolean).join(",") || "none");
          }}
        >
          <div data-testid="a-upload">
            <FileUpload
              name="docs"
              accept=".txt,image/*"
              maxSize={1000}
              multiple
              hint="TXT or images, up to 1 kB"
              onFiles={(files) => setAccepted(files.map((file) => file.name))}
              onReject={(files) => setRejected(files.map((file) => file.name))}
            >
              <span data-testid="a-upload-child">Inner content</span>
            </FileUpload>
          </div>
          <Button type="submit" size="sm" data-testid="a-upload-submit">Submit</Button>
        </form>
        <Out id="a-upload-accepted">{accepted.join(",") || "none"}</Out>
        <Out id="a-upload-rejected">{rejected.join(",") || "none"}</Out>
        <Out id="a-upload-submitted">{submitted || "pending"}</Out>
        <div data-testid="a-upload-single">
          <FileUpload label="One file" onFiles={(files) => setSingle(files.map((file) => file.name))} />
        </div>
        <Out id="a-upload-single-value">{single.join(",") || "none"}</Out>
        <div data-testid="a-upload-disabled">
          <FileUpload label="Disabled zone" disabled onFiles={() => setOff((n) => n + 1)} />
        </div>
        <Out id="a-upload-disabled-count">{off}</Out>
      </Cell>
    </>
  );
}

/** Cada tipo de control dentro de un Field con etiqueta, ayuda y error. */
export function FieldSection() {
  const wrap = (id: string, label: string, control: ReactNode, error?: string) => (
    <div data-testid={`f-${id}`} data-field>
      <Field label={label} hint={`${label} hint`} error={error} required={id === "input"}>
        {control}
      </Field>
    </div>
  );
  return (
    <>
      <Cell title="Field with native controls" id="a-field-native">
        {wrap("input", "Name", <Input />, "Name is required")}
        {wrap("textarea", "Notes", <Textarea />)}
        {wrap("native", "Letter", <NativeSelect options={OPTIONS} />)}
        {wrap("search", "Find", <SearchInput />)}
        {wrap("dateinput", "Start", <DateInput />)}
        {wrap("upload", "Attachment", <FileUpload onFiles={() => {}} />, "Attachment is required")}
      </Cell>
      <Cell title="Field with custom controls" id="a-field-custom">
        {wrap("select", "Role", <Select options={OPTIONS} placeholder="Choose" />)}
        {wrap("combobox", "Person", <Combobox options={OPTIONS} />)}
        {wrap("datepicker", "Due", <DatePicker locale="en-US" />)}
        {wrap("checkbox", "Terms", <Checkbox aria-label="Accept terms" />, "You must accept")}
        {wrap("switch", "Alerts", <Switch />)}
      </Cell>
      <Cell title="Field with non-labelable controls" id="a-field-group">
        {wrap(
          "radio",
          "Plan",
          <RadioGroup defaultValue="free">
            <Radio value="free">Free</Radio>
            <Radio value="pro">Pro</Radio>
          </RadioGroup>,
          "Choose a plan",
        )}
        {wrap("otp", "Code", <OTPInput length={4} />, "Code is wrong")}
        {wrap("slider", "Volume", <Slider defaultValue={[30]} />)}
      </Cell>
    </>
  );
}

/* ---------- Datos ---------- */

interface Row {
  id: string;
  name: string;
  size: number;
  when: Date;
}
const ROWS: Row[] = [
  { id: "r1", name: "Atlas", size: 12, when: new Date(Date.UTC(2026, 2, 10, 12)) },
  { id: "r2", name: "Borealis", size: 4, when: new Date(Date.UTC(2026, 0, 5, 12)) },
  { id: "r3", name: "Cobalt", size: 30, when: new Date(Date.UTC(2026, 6, 21, 12)) },
];
const COLUMNS: DataTableColumn<Row>[] = [
  { key: "name", header: "Name", accessor: (row) => row.name, sortable: true },
  { key: "size", header: "Size", accessor: (row) => row.size, sortable: true, align: "end" },
  { key: "when", header: "When", accessor: (row) => row.when, sortable: true },
];

export function DataSection() {
  const [rating, setRating] = useState(2);
  const [over, setOver] = useState(7);
  const [chip, setChip] = useState(false);
  const [removed, setRemoved] = useState(0);
  const [row, setRow] = useState("none");
  return (
    <>
      <Cell title="Rating" id="a-rating-cell">
        <div data-testid="a-rating-read">
          <Rating value={3.5} showValue caption="(12)" />
        </div>
        <div data-testid="a-rating">
          <Rating value={rating} onChange={setRating} label="Your rating" />
        </div>
        <Out id="a-rating-value">{rating}</Out>
        <div data-testid="a-rating-over">
          <Rating value={over} onChange={setOver} label="Out of range" />
        </div>
        <Out id="a-rating-over-value">{over}</Out>
        <div data-testid="a-rating-disabled">
          <Rating value={4} onChange={setRating} disabled label="Locked rating" />
        </div>
      </Cell>
      <Cell title="Chip and Avatar" id="a-chip-cell">
        <div className="audit__row">
          <Chip selected={chip} onClick={() => setChip((v) => !v)} count={3} data-testid="a-chip">Open</Chip>
          <Chip onRemove={() => setRemoved((n) => n + 1)} removeLabel="Remove tag" data-testid="a-chip-remove">design</Chip>
          <Chip onClick={() => setChip((v) => !v)} onRemove={() => setRemoved((n) => n + 1)} disabled data-testid="a-chip-disabled">Locked</Chip>
        </div>
        <Out id="a-chip-value">{chip ? "selected" : "idle"}</Out>
        <Out id="a-chip-removed">{removed}</Out>
        <div className="audit__row">
          <Avatar src="data:image/png;base64,AAAA" name="Marta Ruiz" data-testid="a-avatar-broken" />
          <Avatar name="Ken Adams" status="busy" statusLabel="Busy" data-testid="a-avatar-initials" />
          <AvatarGroup max={2} aria-label="Team" data-testid="a-avatar-group">
            <Avatar name="Ana Bo" />
            <Avatar name="Cy Du" />
            <Avatar name="Eli Fa" />
            <Avatar name="Gus Ho" />
          </AvatarGroup>
        </div>
      </Cell>
      <Cell title="DataTable" id="a-table-cell">
        <div data-testid="a-table">
          <DataTable rows={ROWS} columns={COLUMNS} rowKey={(item) => item.id} caption="Files" captionHidden onRowClick={(item) => setRow(item.id)} isRowSelected={(item) => item.id === row} />
        </div>
        <Out id="a-table-row">{row}</Out>
      </Cell>
    </>
  );
}

/* ---------- Estado y contenido ---------- */

function Bomb({ armed }: { armed: { current: boolean } }) {
  if (armed.current) throw new Error("audit bomb");
  return <span data-testid="a-eb-ok">Content is fine</span>;
}

function BoundaryDemo({ id, custom }: { id: string; custom?: boolean }) {
  const armed = useRef(false);
  const [, bump] = useState(0);
  const [key, setKey] = useState(0);
  const [errors, setErrors] = useState(0);
  return (
    <div data-testid={id}>
      <div className="audit__row">
        <Button size="sm" data-testid={`${id}-arm`} onClick={() => { armed.current = true; bump((n) => n + 1); }}>Break</Button>
        <Button size="sm" data-testid={`${id}-disarm`} onClick={() => { armed.current = false; }}>Repair</Button>
        <Button size="sm" data-testid={`${id}-key`} onClick={() => setKey((n) => n + 1)}>Change resetKey</Button>
      </div>
      <ErrorBoundary
        resetKey={key}
        onError={() => setErrors((n) => n + 1)}
        retryLabel="Retry now"
        fallback={custom ? (error, reset) => (
          <div data-testid={`${id}-fallback`}>
            <span>Custom: {error.message}</span>
            <Button size="sm" onClick={reset} data-testid={`${id}-reset`}>Reset</Button>
          </div>
        ) : undefined}
      >
        <Bomb armed={armed} />
      </ErrorBoundary>
      <Out id={`${id}-errors`}>{errors}</Out>
    </div>
  );
}

export function FeedbackSection() {
  const [alerts, setAlerts] = useState(["info", "danger"]);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState("none");
  return (
    <>
      <Cell title="Alert" id="a-alert-cell">
        {alerts.includes("info") ? (
          <Alert tone="info" title="Heads up" onDismiss={() => setAlerts((list) => list.filter((tone) => tone !== "info"))} data-testid="a-alert-info">Informational message.</Alert>
        ) : null}
        {alerts.includes("danger") ? (
          <Alert tone="danger" title="Failed" dismissLabel="Close alert" onDismiss={() => setAlerts((list) => list.filter((tone) => tone !== "danger"))} data-testid="a-alert-danger">Something broke.</Alert>
        ) : null}
        <Alert tone="success" data-testid="a-alert-static">Saved.</Alert>
        <Out id="a-alert-count">{alerts.length}</Out>
      </Cell>
      <Cell title="ErrorBoundary" id="a-eb-cell">
        <BoundaryDemo id="a-eb" />
        <BoundaryDemo id="a-eb-custom" custom />
      </Cell>
      <Cell title="LoadingOverlay" id="a-loading-cell">
        <Button size="sm" onClick={() => setBusy((v) => !v)} data-testid="a-loading-toggle">Toggle overlay</Button>
        <div className="audit__host" data-testid="a-loading-host">
          <p className="app-text">Covered content.</p>
          <LoadingOverlay visible={busy} message="Saving changes" data-testid="a-loading" />
        </div>
        <div className="audit__host">
          <LoadingOverlay label="Fetching" blur={false} data-testid="a-loading-label" />
        </div>
      </Cell>
      <Cell title="CodeBlock" id="a-code-cell">
        <CodeBlock code={"pnpm add @zuccadev-labs/zuix-zui\npnpm check"} language="sh" title="install.sh" onCopy={setCopied} data-testid="a-code" />
        <Out id="a-code-copied">{copied === "none" ? "none" : `copied:${copied.length}`}</Out>
      </Cell>
    </>
  );
}

/* ---------- Navegación ---------- */

const NODES: TreeNode[] = [
  { id: "src", label: "src", children: [{ id: "app", label: "app.tsx" }, { id: "main", label: "main.tsx" }] },
  { id: "docs", label: "docs", children: [{ id: "guide", label: "guide.md" }] },
  { id: "license", label: "LICENSE" },
  { id: "readme", label: "README.md" },
];
const STEPS = [{ label: "Account" }, { label: "Profile", description: "Name and avatar" }, { label: "Team" }, { label: "Done" }];

export function NavigationSection() {
  const [step, setStep] = useState(2);
  const [nav, setNav] = useState("none");
  const [crumb, setCrumb] = useState("none");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string[]>(["a"]);
  const [tab, setTab] = useState("one");
  const [selected, setSelected] = useState<string | null>(null);
  const [slide, setSlide] = useState(1);
  return (
    <>
      <Cell title="Stepper" id="a-stepper-cell">
        <div data-testid="a-stepper">
          <Stepper steps={STEPS} current={step} onStepSelect={setStep} />
        </div>
        <div data-testid="a-stepper-static">
          <Stepper steps={STEPS} current={1} orientation="vertical" label="Static progress" />
        </div>
        <div className="audit__row">
          <Button size="sm" onClick={() => setStep((n) => Math.min(STEPS.length, n + 1))} data-testid="a-stepper-next">Next step</Button>
          <Out id="a-stepper-value">{step}</Out>
        </div>
      </Cell>
      <Cell title="NavList and Breadcrumb" id="a-nav-cell">
        <NavList label="Audit navigation" heading="Sections" data-testid="a-navlist">
          <NavLink href="#audit-home" icon="home" active onClick={() => setNav("home")} data-testid="a-nav-link">Home</NavLink>
          <NavLink icon="folder" onClick={() => setNav("files")} trailing={<Badge size="sm">4</Badge>} data-testid="a-nav-button">Files</NavLink>
          <NavLink href="#audit-off" disabled onClick={() => setNav("off-link")} data-testid="a-nav-link-disabled">Billing</NavLink>
          <NavLink disabled onClick={() => setNav("off-button")} data-testid="a-nav-button-disabled">Admin</NavLink>
          <NavLink asChild icon="star" onClick={() => setNav("child")}>
            <a href="#audit-child" data-testid="a-nav-child">Router link</a>
          </NavLink>
        </NavList>
        <Out id="a-nav-value">{nav}</Out>
        <div data-testid="a-breadcrumb">
          <Breadcrumb
            items={[
              { label: "Home", href: "#audit-root", icon: "home" },
              { label: "Projects", onClick: () => setCrumb("projects") },
              { label: "Archive" },
              { label: "Atlas" },
            ]}
          />
        </div>
        <Out id="a-breadcrumb-value">{crumb}</Out>
      </Cell>
      <Cell title="Pagination" id="a-pagination-cell">
        <div data-testid="a-pagination">
          <Pagination page={page} pageCount={20} onPageChange={setPage} />
        </div>
        <Out id="a-pagination-value">{page}</Out>
        <div data-testid="a-pagination-short">
          <Pagination page={1} pageCount={1} onPageChange={() => {}} label="Short" size="sm" />
        </div>
      </Cell>
      <Cell title="Accordion multiple" id="a-accordion-cell">
        <div data-testid="a-accordion">
          <Accordion
            type="multiple"
            value={open}
            onValueChange={setOpen}
            items={[
              { value: "a", title: "First", content: "First body" },
              { value: "b", title: "Second", content: "Second body" },
              { value: "c", title: "Third", content: "Third body", disabled: true },
            ]}
          />
        </div>
        <Out id="a-accordion-value">{open.join(",") || "none"}</Out>
      </Cell>
      <Cell title="Tabs vertical" id="a-tabs-cell">
        <div data-testid="a-tabs">
          <Tabs
            orientation="vertical"
            variant="underline"
            label="Vertical tabs"
            value={tab}
            onValueChange={setTab}
            items={[{ value: "one", label: "One" }, { value: "two", label: "Two" }, { value: "three", label: "Three", disabled: true }, { value: "four", label: "Four" }]}
          >
            <TabPanel value="one">Panel one</TabPanel>
            <TabPanel value="two" keepMounted>
              <input aria-label="Kept" data-testid="a-tabs-kept" defaultValue="" />
            </TabPanel>
            <TabPanel value="four">Panel four</TabPanel>
          </Tabs>
        </div>
        <Out id="a-tabs-value">{tab}</Out>
      </Cell>
      <Cell title="Tree" id="a-tree-cell">
        <div data-testid="a-tree">
          <Tree nodes={NODES} label="Files" defaultExpanded={["src"]} selected={selected} onSelect={setSelected} />
        </div>
        <Out id="a-tree-value">{selected ?? "none"}</Out>
      </Cell>
      <Cell title="Carousel" id="a-carousel-cell">
        <div data-testid="a-carousel">
          <Carousel
            items={["One", "Two", "Three", "Four"]}
            renderItem={(item) => <Card className="app-slide">{item}</Card>}
            ariaLabel="Audit slides"
            effect="none"
            loop={false}
            defaultIndex={1}
            slideWidth={160}
            onIndexChange={setSlide}
          />
        </div>
        <Out id="a-carousel-value">{slide}</Out>
      </Cell>
    </>
  );
}

/** Controles que dependen de la dirección de escritura, dentro de un contenedor `dir="rtl"`. */
export function RtlSection() {
  const [day, setDay] = useState<string | null>("2026-03-10");
  const [rating, setRating] = useState(2);
  const [tab, setTab] = useState("one");
  const [slider, setSlider] = useState([50]);
  const [page, setPage] = useState(5);
  return (
    <div dir="rtl" data-testid="a-rtl" className="audit__grid">
      <Cell title="Calendar" id="a-rtl-calendar-cell">
        <div data-testid="a-rtl-calendar">
          <Calendar value={day} onValueChange={setDay} defaultMonth="2026-03" locale="en-US" weekStartsOn={1} />
        </div>
        <Out id="a-rtl-calendar-value">{day ?? "none"}</Out>
      </Cell>
      <Cell title="Rating, Slider, Tabs" id="a-rtl-controls">
        <div data-testid="a-rtl-rating">
          <Rating value={rating} onChange={setRating} />
        </div>
        <Out id="a-rtl-rating-value">{rating}</Out>
        <div data-testid="a-rtl-slider">
          <Slider value={slider} onValueChange={setSlider} aria-label="RTL volume" />
        </div>
        <Out id="a-rtl-slider-value">{slider.join(",")}</Out>
        <div data-testid="a-rtl-tabs">
          <Tabs label="RTL tabs" value={tab} onValueChange={setTab} items={[{ value: "one", label: "One", content: "1" }, { value: "two", label: "Two", content: "2" }, { value: "three", label: "Three", content: "3" }]} />
        </div>
        <Out id="a-rtl-tabs-value">{tab}</Out>
      </Cell>
      <Cell title="Pagination and Breadcrumb" id="a-rtl-nav">
        <div data-testid="a-rtl-pagination">
          <Pagination page={page} pageCount={9} onPageChange={setPage} />
        </div>
        <Out id="a-rtl-pagination-value">{page}</Out>
        <div data-testid="a-rtl-breadcrumb">
          <Breadcrumb items={[{ label: "Home", href: "#rtl-home" }, { label: "Docs", href: "#rtl-docs" }, { label: "Page" }]} />
        </div>
        <Field label="Name" hint="As in your passport">
          <Input icon="user" data-testid="a-rtl-input" />
        </Field>
      </Cell>
    </div>
  );
}

/** Todo lo que se renderiza sin portal: lo comparten la pantalla y la prueba de hidratación. */
export function StaticSections() {
  return (
    <>
      <h2 className="audit__group">Actions</h2>
      <div className="audit__grid"><ActionsSection /></div>
      <h2 className="audit__group">Forms</h2>
      <div className="audit__grid"><FormsSection /><FieldSection /></div>
      <h2 className="audit__group">Data</h2>
      <div className="audit__grid"><DataSection /></div>
      <h2 className="audit__group">Feedback and content</h2>
      <div className="audit__grid"><FeedbackSection /></div>
      <h2 className="audit__group">Navigation</h2>
      <div className="audit__grid"><NavigationSection /></div>
      <h2 className="audit__group">Right to left</h2>
      <RtlSection />
    </>
  );
}
