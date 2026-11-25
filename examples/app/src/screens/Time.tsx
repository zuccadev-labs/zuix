import { useState } from "react";
import { Grid, Page, PageHeader, PageSection, Stack } from "@zuccadev-labs/zuix-zout";
import {
  AnalogClock,
  Button,
  Card,
  CardHeader,
  Clock,
  Countdown,
  DurationField,
  FormatDuration,
  TimeZoneSelect,
  WorldClock,
  type WorldClockZone,
} from "@zuccadev-labs/zuix-zui";

const CITIES: WorldClockZone[] = [
  { timeZone: "America/Los_Angeles", label: "San Francisco" },
  { timeZone: "America/New_York", label: "New York" },
  { timeZone: "Europe/Madrid", label: "Madrid" },
  { timeZone: "Asia/Kolkata", label: "Mumbai" },
  { timeZone: "Asia/Tokyo", label: "Tokyo" },
  { timeZone: "Australia/Sydney", label: "Sydney" },
];

// La cuenta atrás de la demo: siempre unos días por delante, fijada al cargar.
const LAUNCH = Date.now() + ((3 * 24 + 5) * 60 + 42) * 60_000;

export function TimeScreen() {
  const [zones, setZones] = useState(CITIES);
  const [removed, setRemoved] = useState("");
  const [length, setLength] = useState("PT45M");
  const [zone, setZone] = useState<string | null>("Europe/Madrid");
  const [done, setDone] = useState(0);
  const [soon, setSoon] = useState<number | null>(null);
  return (
    <Page>
      <PageHeader title="Time" description="Clocks, world clock, countdowns, durations and time zones." />
      <PageSection title="Clocks">
        <Grid min="260px" gap={4}>
          <Card>
            <CardHeader title="Local time" subtitle="Seconds, date and a blinking separator." />
            <div data-testid="t-clock">
              <Clock seconds date blink label="Local" locale="en-GB" />
            </div>
          </Card>
          <Card>
            <CardHeader title="Fixed instant" subtitle="Tokyo, 24-hour, with the zone name." />
            <div data-testid="t-clock-fixed">
              <Clock value="2026-11-21T09:42:07Z" timeZone="Asia/Tokyo" hourCycle="h23" zone label="Tokyo" locale="en-GB" />
            </div>
          </Card>
          <Card>
            <CardHeader title="Analog" subtitle="Quarter numerals and minute marks." />
            <div data-testid="t-analog">
              <AnalogClock numerals="quarters" marks="minutes" timeZone="Europe/Madrid" label="Madrid" caption smooth locale="en-GB" />
            </div>
          </Card>
        </Grid>
      </PageSection>
      <PageSection title="World clock">
        <Stack gap={3}>
          <div data-testid="t-world">
            <WorldClock
              layout="grid"
              locale="en-GB"
              reference="Europe/Madrid"
              zones={zones}
              removable
              onRemove={({ timeZone }) => {
                setZones((list) => list.filter((z) => z.timeZone !== timeZone));
                setRemoved(timeZone);
              }}
            />
          </div>
          <p className="app-muted" data-testid="t-world-removed">
            {removed ? `Removed ${removed}` : "Nothing removed"}
          </p>
        </Stack>
      </PageSection>
      <PageSection title="Countdowns">
        <Grid min="300px" gap={4}>
          <Card>
            <CardHeader title="Launch" subtitle="Segments with the target date." />
            <div data-testid="t-countdown">
              <Countdown to={LAUNCH} showTarget locale="en-GB" labels={{ timer: "Launch countdown", target: "Launch {date}" }} />
            </div>
          </Card>
          <Card>
            <CardHeader title="Flip" subtitle="Two seconds from the button." />
            <Stack gap={3}>
              <Button size="sm" data-testid="t-soon-start" onClick={() => setSoon(Date.now() + 2000)}>
                Start a 2 s countdown
              </Button>
              <div data-testid="t-soon">
                {soon ? (
                  <Countdown
                    variant="flip"
                    units={["minutes", "seconds"]}
                    to={soon}
                    locale="en-GB"
                    labels={{ complete: "Lift-off" }}
                    onComplete={() => setDone((n) => n + 1)}
                  />
                ) : null}
              </div>
              <p className="app-muted" data-testid="t-soon-done">{`${done} completed`}</p>
            </Stack>
          </Card>
          <Card>
            <CardHeader title="Inline" subtitle="Days, hours and minutes in a sentence." />
            <Stack gap={1}>
              <span className="app-muted">Offer ends in</span>
              <Countdown
                variant="inline"
                units={["days", "hours", "minutes"]}
                to={LAUNCH}
                locale="en-GB"
                labels={{ timer: "Offer ends in" }}
              />
            </Stack>
          </Card>
        </Grid>
      </PageSection>
      <PageSection title="Durations and zones">
        <Grid min="300px" gap={4}>
          <Card>
            <CardHeader title="Meeting length" subtitle="Segments, five-minute step and presets." />
            <Stack gap={3}>
              <div data-testid="t-duration">
                <DurationField
                  label="Meeting length"
                  value={length}
                  onValueChange={setLength}
                  step={5}
                  presets={["PT15M", "PT30M", "PT1H"]}
                  name="length"
                  locale="en-US"
                />
              </div>
              <p className="app-muted" data-testid="t-duration-value">
                {length} · <FormatDuration value={length} format="long" locale="en-US" />
              </p>
            </Stack>
          </Card>
          <Card>
            <CardHeader title="Time zone" subtitle="Searchable, with the current offset." />
            <Stack gap={3}>
              <div data-testid="t-zone">
                <TimeZoneSelect aria-label="Event time zone" value={zone} onValueChange={(tz) => setZone(tz)} locale="en-GB" />
              </div>
              <p className="app-muted" data-testid="t-zone-value">
                {zone ?? "No zone"}
              </p>
            </Stack>
          </Card>
          <Card>
            <CardHeader title="Formatted durations" subtitle="Long, short, narrow and digital." />
            <Stack gap={2}>
              <FormatDuration value="PT1H30M" format="long" locale="en-US" />
              <FormatDuration value="PT1H30M" locale="en-US" />
              <FormatDuration value="PT1H30M" format="narrow" locale="en-US" />
              <FormatDuration value={5_400_000} format="digital" locale="en-US" />
            </Stack>
          </Card>
        </Grid>
      </PageSection>
    </Page>
  );
}
