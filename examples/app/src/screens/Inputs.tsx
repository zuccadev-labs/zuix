import { useState, type FormEvent } from "react";
import { Grid, Page, PageHeader, PageSection, Stack } from "@zuccadev-labs/zuix-zout";
import { Icon } from "@zuccadev-labs/zuix-zicon";
import { ExpressiveSection } from "./Expressive";
import { LargeListsSection } from "./scale";
import {
  Button,
  ButtonGroup,
  ButtonGroupSeparator,
  Card,
  CardHeader,
  Checkbox,
  CheckboxGroup,
  Combobox,
  CopyButton,
  Editable,
  Field,
  FieldGroup,
  Fieldset,
  FileUpload,
  Form,
  IconButton,
  Input,
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
  Kbd,
  Listbox,
  NativeSelect,
  NumberInput,
  OTPInput,
  PasswordInput,
  Radio,
  RadioGroup,
  Rating,
  SegmentedControl,
  Select,
  Slider,
  Swap,
  Switch,
  TagsInput,
  Toggle,
  ToggleGroup,
  TransferList,
} from "@zuccadev-labs/zuix-zui";

const REVIEWERS = [
  { value: "ana", label: "Ana Ruiz" },
  { value: "leo", label: "Leo Park" },
  { value: "mia", label: "Mia Chen" },
  { value: "noor", label: "Noor Rahman" },
];

const LABELS = [
  {
    label: "Type",
    options: [
      { value: "bug", label: "Bug" },
      { value: "feature", label: "Feature" },
    ],
  },
  {
    label: "Area",
    options: [
      { value: "forms", label: "Forms" },
      { value: "docs", label: "Docs" },
    ],
  },
];

const CITIES = [
  { value: "lisbon", label: "Lisbon" },
  { value: "madrid", label: "Madrid" },
  { value: "montreal", label: "Montreal" },
];

const show = (value: unknown) =>
  Array.isArray(value) ? value.join(",") || "none" : value === null || value === "" ? "none" : String(value);

/** Piezas de formularios y acciones con su valor a la vista, para las pruebas en navegador. */
export function Inputs() {
  const [team, setTeam] = useState<string[]>(["chen"]);
  const [seats, setSeats] = useState<number | null>(3);
  const [budget, setBudget] = useState<number | null>(1250);
  const [tags, setTags] = useState<string[]>(["design"]);
  const [region, setRegion] = useState("eu-west");
  const [regions, setRegions] = useState<string[]>(["eu-west"]);
  const [format, setFormat] = useState<string[]>(["bold"]);
  const [align, setAlign] = useState("left");
  const [notify, setNotify] = useState<string[]>(["mentions"]);
  const [reviewers, setReviewers] = useState<string[]>(["ana"]);
  const [labels, setLabels] = useState<string[]>(["bug"]);
  const [city, setCity] = useState<string | null>(null);
  const [title, setTitle] = useState("Borealis");
  const [visible, setVisible] = useState(false);
  const [stars, setStars] = useState(3.5);
  const [section, setSection] = useState("overview");
  const [submitted, setSubmitted] = useState("none");
  const [copied, setCopied] = useState("none");

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setSubmitted(`${data.get("email")}|${data.get("password") ? "pw" : ""}`);
  };

  return (
    <Page width="full">
      <PageHeader title="Inputs" description="Composite fields, choice groups, validation and actions." />
      <PageSection title="Fields">
        <Grid min={280}>
          <Card className="app-demo">
            <CardHeader title="InputGroup" subtitle="Addons, segments and buttons" />
            <Stack gap={3}>
              <div data-testid="i-group">
                <InputGroup>
                  <InputGroupAddon>
                    <Icon name="magnifying-glass" />
                  </InputGroupAddon>
                  <InputGroupInput placeholder="Search projects" aria-label="Search projects" />
                  <InputGroupAddon align="inline-end">
                    <Kbd keys="⌘ K" size="sm" />
                  </InputGroupAddon>
                </InputGroup>
              </div>
              <Field label="Website">
                <InputGroup>
                  <InputGroupAddon variant="segment">
                    <InputGroupText>https://</InputGroupText>
                  </InputGroupAddon>
                  <InputGroupInput placeholder="example" />
                </InputGroup>
              </Field>
            </Stack>
          </Card>

          <Card className="app-demo">
            <CardHeader title="NumberInput" subtitle="Steps, bounds and locale format" />
            <Stack gap={3}>
              <Field label="Seats">
                <div data-testid="i-number">
                  <NumberInput value={seats} onValueChange={setSeats} min={1} max={10} />
                </div>
              </Field>
              <span className="app-muted">
                Value: <output data-testid="i-number-value">{show(seats)}</output>
              </span>
              <Field label="Monthly budget">
                <div data-testid="i-currency">
                  <NumberInput
                    value={budget}
                    onValueChange={setBudget}
                    step={50}
                    min={0}
                    locale="en-US"
                    formatOptions={{ style: "currency", currency: "USD" }}
                  />
                </div>
              </Field>
              <span className="app-muted">
                Value: <output data-testid="i-currency-value">{show(budget)}</output>
              </span>
            </Stack>
          </Card>

          <Card className="app-demo">
            <CardHeader title="PasswordInput" subtitle="Show and hide, strength meter" />
            <Field label="New password" hint="Eight or more characters.">
              <div data-testid="i-password">
                <PasswordInput autoComplete="new-password" strength visible={visible} onVisibleChange={setVisible} />
              </div>
            </Field>
            <span className="app-muted">
              Visible: <output data-testid="i-password-visible">{String(visible)}</output>
            </span>
          </Card>

          <Card className="app-demo">
            <CardHeader title="TagsInput" subtitle="Enter, comma or paste a list" />
            <Field label="Topics">
              <div data-testid="i-tags">
                <TagsInput value={tags} onValueChange={setTags} max={5} placeholder="Add a topic" />
              </div>
            </Field>
            <span className="app-muted">
              Value: <output data-testid="i-tags-value">{show(tags)}</output>
            </span>
          </Card>

          <Card className="app-demo">
            <CardHeader title="Editable" subtitle="Inline text" />
            <div data-testid="i-editable">
              <Editable label="Project name" value={title} onValueChange={setTitle} size="lg" />
            </div>
            <span className="app-muted">
              Value: <output data-testid="i-editable-value">{title}</output>
            </span>
          </Card>

          <Card className="app-demo">
            <CardHeader title="Multiple choice" subtitle="Select, Combobox and autocomplete" />
            <Stack gap={3}>
              <Field label="Reviewers" hint="Up to two.">
                <div data-testid="i-select-multi">
                  <Select
                    multiple
                    maxSelected={2}
                    options={REVIEWERS}
                    value={reviewers}
                    onValueChange={setReviewers}
                    placeholder="Choose"
                  />
                </div>
              </Field>
              <span className="app-muted">
                Value: <output data-testid="i-select-multi-value">{show(reviewers)}</output>
              </span>
              <Field label="Labels">
                <div data-testid="i-combo-multi">
                  <Combobox multiple options={LABELS} value={labels} onValueChange={setLabels} placeholder="Add labels" />
                </div>
              </Field>
              <span className="app-muted">
                Value: <output data-testid="i-combo-multi-value">{show(labels)}</output>
              </span>
              <Field label="City">
                <div data-testid="i-autocomplete">
                  <Combobox
                    allowCustomValue
                    icon="map-pin"
                    options={CITIES}
                    value={city}
                    onValueChange={setCity}
                    placeholder="Search a city"
                  />
                </div>
              </Field>
              <span className="app-muted">
                Value: <output data-testid="i-autocomplete-value">{show(city)}</output>
              </span>
            </Stack>
          </Card>

          <Card className="app-demo">
            <CardHeader title="Listbox" subtitle="Single and multiple" />
            <Stack gap={3}>
              <div data-testid="i-listbox">
                <Listbox
                  label="Region"
                  value={region}
                  onValueChange={setRegion}
                  options={[
                    { value: "eu-west", label: "EU West", description: "Dublin" },
                    { value: "us-east", label: "US East", description: "Virginia" },
                    { value: "ap-south", label: "AP South", description: "Mumbai", disabled: true },
                    { value: "sa-east", label: "SA East", description: "São Paulo" },
                  ]}
                />
              </div>
              <span className="app-muted">
                Value: <output data-testid="i-listbox-value">{show(region)}</output>
              </span>
              <div data-testid="i-listbox-multi">
                <Listbox
                  label="Replicas"
                  selectionMode="multiple"
                  size="sm"
                  value={regions}
                  onValueChange={setRegions}
                  options={[
                    { value: "eu-west", label: "EU West" },
                    { value: "us-east", label: "US East" },
                    { value: "sa-east", label: "SA East" },
                  ]}
                />
              </div>
              <span className="app-muted">
                Value: <output data-testid="i-listbox-multi-value">{show(regions)}</output>
              </span>
            </Stack>
          </Card>
        </Grid>
      </PageSection>

      <PageSection title="Choice groups and validation">
        <Grid min={280}>
          <Card className="app-demo">
            <CardHeader title="CheckboxGroup" subtitle="Select all and cards" />
            <div data-testid="i-checkgroup">
              <CheckboxGroup
                label="Notify me about"
                selectAll="All activity"
                value={notify}
                onValueChange={setNotify}
                options={[
                  { value: "mentions", label: "Mentions" },
                  { value: "comments", label: "Comments" },
                  { value: "releases", label: "Releases" },
                ]}
              />
            </div>
            <span className="app-muted">
              Value: <output data-testid="i-checkgroup-value">{show(notify)}</output>
            </span>
          </Card>

          <Card className="app-demo">
            <CardHeader title="Cards" subtitle="Radio, Checkbox and Switch" />
            <Stack gap={2}>
              <RadioGroup aria-label="Plan" variant="card" defaultValue="pro">
                <Radio value="free" description="Up to 3 projects">
                  Free
                </Radio>
                <Radio value="pro" description="Unlimited projects">
                  Pro
                </Radio>
              </RadioGroup>
              <Checkbox variant="card" description="Every Monday.">
                Weekly digest
              </Checkbox>
              <Switch variant="card" defaultChecked description="Pause notifications after hours.">
                Focus mode
              </Switch>
            </Stack>
          </Card>

          <Card className="app-demo">
            <CardHeader title="Form" subtitle="Messages by ValidityState" />
            <Form aria-label="Create account" onSubmit={onSubmit} data-testid="i-form">
              <Field
                label="Email"
                required
                validate={{ valueMissing: "Enter your email address.", typeMismatch: "Enter an email like you@example.com." }}
              >
                <Input type="email" name="email" autoComplete="email" data-testid="i-form-email" />
              </Field>
              <Field label="Password" required validate={{ tooShort: "Use at least 8 characters." }}>
                <PasswordInput name="password" autoComplete="new-password" minLength={8} data-testid="i-form-password" />
              </Field>
              <Button type="submit" variant="primary" data-testid="i-form-submit">
                Create account
              </Button>
            </Form>
            <span className="app-muted">
              Submitted: <output data-testid="i-form-value">{submitted}</output>
            </span>
          </Card>

          <Card className="app-demo">
            <CardHeader title="Fieldset" subtitle="Legend and disabled group" />
            <Fieldset legend="Shipping" description="Where we send the key." variant="card">
              <FieldGroup orientation="horizontal">
                <Field label="City">
                  <Input name="city" autoComplete="address-level2" />
                </Field>
                <Field label="Country">
                  <NativeSelect
                    defaultValue="es"
                    options={[
                      {
                        label: "Europe",
                        options: [
                          { value: "es", label: "Spain" },
                          { value: "pt", label: "Portugal" },
                        ],
                      },
                      { label: "America", options: [{ value: "mx", label: "Mexico" }] },
                    ]}
                  />
                </Field>
              </FieldGroup>
            </Fieldset>
          </Card>

          <Card className="app-demo">
            <CardHeader title="Variants" subtitle="Slider marks, half stars, OTP groups, files" />
            <Stack gap={4}>
              <Field label="Quality">
                <Slider
                  defaultValue={[50]}
                  step={25}
                  marks={[
                    { value: 0, label: "Low" },
                    { value: 25 },
                    { value: 50, label: "Medium" },
                    { value: 75 },
                    { value: 100, label: "High" },
                  ]}
                />
              </Field>
              <div data-testid="i-rating">
                <Rating value={stars} onChange={setStars} allowHalf showValue label="Your rating" />
              </div>
              <span className="app-muted">
                Value: <output data-testid="i-rating-value">{stars}</output>
              </span>
              <OTPInput length={6} groups={[3, 3]} placeholder="·" label="Authenticator code" />
              <FileUpload multiple showFiles onFiles={() => {}} hint="Images or PDF." accept="image/*,.pdf" />
            </Stack>
          </Card>
        </Grid>
      </PageSection>

      <PageSection title="Actions">
        <Grid min={280}>
          <Card className="app-demo">
            <CardHeader title="Button" subtitle="Outline, link, xs to xl" />
            <Stack gap={3}>
              <ButtonGroup label="Sizes" attached={false}>
                <Button size="xs">XS</Button>
                <Button size="sm">SM</Button>
                <Button>MD</Button>
                <Button size="lg">LG</Button>
                <Button size="xl" variant="primary">
                  XL
                </Button>
              </ButtonGroup>
              <ButtonGroup label="Variants" attached={false}>
                <Button variant="outline" icon="arrow-down-tray">
                  Export
                </Button>
                <Button variant="link">Learn more</Button>
              </ButtonGroup>
              <ButtonGroup label="History">
                <Button icon="arrow-uturn-up-left">Undo</Button>
                <Button icon="arrow-uturn-up-right">Redo</Button>
                <ButtonGroupSeparator />
                <IconButton icon="ellipsis-horizontal" label="More" variant="secondary" />
              </ButtonGroup>
            </Stack>
          </Card>

          <Card className="app-demo">
            <CardHeader title="ToggleGroup" subtitle="Multiple and single" />
            <Stack gap={3}>
              <div data-testid="i-toggle-multi">
                <ToggleGroup
                  type="multiple"
                  label="Text formatting"
                  value={format}
                  onValueChange={setFormat}
                  items={[
                    { value: "bold", icon: "bold", ariaLabel: "Bold" },
                    { value: "italic", icon: "italic", ariaLabel: "Italic" },
                    { value: "underline", icon: "underline", ariaLabel: "Underline" },
                  ]}
                />
              </div>
              <span className="app-muted">
                Value: <output data-testid="i-toggle-multi-value">{show(format)}</output>
              </span>
              <div data-testid="i-toggle-single">
                <ToggleGroup
                  label="Alignment"
                  variant="ghost"
                  required
                  value={align}
                  onValueChange={setAlign}
                  items={[
                    { value: "left", icon: "bars-3-bottom-left", ariaLabel: "Align left" },
                    { value: "center", icon: "bars-3", ariaLabel: "Align center" },
                    { value: "right", icon: "bars-3-bottom-right", ariaLabel: "Align right" },
                  ]}
                />
              </div>
              <span className="app-muted">
                Value: <output data-testid="i-toggle-single-value">{show(align)}</output>
              </span>
            </Stack>
          </Card>

          <Card className="app-demo">
            <CardHeader title="SegmentedControl" subtitle="Underline and vertical" />
            <Stack gap={3}>
              <div data-testid="i-segmented">
                <SegmentedControl
                  label="Section"
                  variant="underline"
                  value={section}
                  onValueChange={setSection}
                  items={[
                    { value: "overview", label: "Overview" },
                    { value: "activity", label: "Activity" },
                    { value: "settings", label: "Settings" },
                  ]}
                />
              </div>
              <span className="app-muted">
                Value: <output data-testid="i-segmented-value">{section}</output>
              </span>
              <SegmentedControl
                label="Density"
                orientation="vertical"
                defaultValue="comfortable"
                items={[
                  { value: "compact", label: "Compact" },
                  { value: "comfortable", label: "Comfortable" },
                ]}
              />
            </Stack>
          </Card>

          <Card className="app-demo">
            <CardHeader title="CopyButton and Swap" subtitle="Clipboard and animated toggles" />
            <Stack gap={3}>
              <span className="app-row" data-testid="i-copy">
                <code>zx_live_4f9c2a</code>
                <CopyButton value="zx_live_4f9c2a" label="Copy API key" onCopied={setCopied} onCopyError={() => setCopied("failed")} />
              </span>
              <span className="app-muted">
                Copied: <output data-testid="i-copy-value">{copied}</output>
              </span>
              <span className="app-row">
                <Toggle label="Dark mode" data-testid="i-swap">
                  <Swap effect="rotate" off={<Icon name="sun" />} on={<Icon name="moon" />} />
                </Toggle>
                <Toggle label="Favourite" variant="ghost">
                  <Swap effect="flip" off={<Icon name="heart" />} on={<Icon name="heart" variant="solid" />} />
                </Toggle>
              </span>
            </Stack>
          </Card>
        </Grid>
      </PageSection>
      <ExpressiveSection />
      <PageSection title="Transfer list">
        <Stack gap={2}>
          <div data-testid="i-transfer">
            <TransferList
              searchable
              name="team"
              labels={{ source: "People", target: "Team" }}
              items={PEOPLE}
              value={team}
              onValueChange={setTeam}
            />
          </div>
          <span className="app-muted" data-testid="i-transfer-value">{`Team: ${team.join(", ") || "none"}`}</span>
        </Stack>
      </PageSection>
      <LargeListsSection />
    </Page>
  );
}

const PEOPLE = [
  { value: "ana", label: "Ana Torres", description: "Design" },
  { value: "ben", label: "Ben Okafor", description: "Engineering" },
  { value: "chen", label: "Chen Wei", description: "Engineering" },
  { value: "dara", label: "Dara Singh", description: "Product", disabled: true },
  { value: "eli", label: "Eli Moreau", description: "Support" },
  { value: "femi", label: "Femi Adeyemi", description: "Sales" },
  { value: "gus", label: "Gustavo Lima", description: "Engineering" },
];
