import { useState, type FormEvent } from "react";
import { Grid, Inline, PageSection, Stack } from "@zuccadev-labs/zuix-zout";
import { Button, Card, CardHeader, DateField, Field, TimeField, TimePicker } from "@zuccadev-labs/zuix-zui";

/** DateField, TimeField y TimePicker con su valor a la vista, un formulario y un campo en RTL (tests/browser). */
export function DateTimeFields() {
  const [date, setDate] = useState<string | null>("2026-11-13");
  const [meeting, setMeeting] = useState<string | null>(null);
  const [alarm, setAlarm] = useState<string | null>("07:30");
  const [night, setNight] = useState<string | null>(null);
  const [start, setStart] = useState<string | null>("09:30");
  const [slot, setSlot] = useState<string | null>(null);
  const [sent, setSent] = useState("none");
  const show = (value: string | null) => value ?? "none";
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSent(JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))));
  };

  return (
    <PageSection title="Date and time fields" description="Segmented fields you can type into, and a time picker.">
      <Grid min={260}>
        <Card className="app-demo">
          <CardHeader title="DateField" subtitle="Segments in the order of the locale" />
          <Stack gap={3}>
            <Field label="Deadline">
              <div data-testid="df">
                <DateField value={date} onValueChange={setDate} locale="en-US" clearable />
              </div>
            </Field>
            <span className="app-muted">
              Value: <output data-testid="df-value">{show(date)}</output>
            </span>
            <Field label="Meeting" hint="Day, month, year and 24-hour time.">
              <div data-testid="dtf">
                <DateField value={meeting} onValueChange={setMeeting} locale="en-GB" granularity="minute" min="2026-01-01" />
              </div>
            </Field>
            <span className="app-muted">
              Value: <output data-testid="dtf-value">{show(meeting)}</output>
            </span>
            <div dir="rtl" data-testid="rtl-df">
              <DateField aria-label="Right-to-left date" locale="en-US" />
            </div>
          </Stack>
        </Card>

        <Card className="app-demo">
          <CardHeader title="TimeField" subtitle="12-hour with steps, and a night shift" />
          <Stack gap={3}>
            <Field label="Alarm">
              <div data-testid="tf">
                <TimeField value={alarm} onValueChange={setAlarm} locale="en-US" minuteStep={15} />
              </div>
            </Field>
            <span className="app-muted">
              Value: <output data-testid="tf-value">{show(alarm)}</output>
            </span>
            <Field label="Night shift" hint="Between 22:00 and 02:00.">
              <div data-testid="night">
                <TimeField value={night} onValueChange={setNight} locale="en-GB" min="22:00" max="02:00" />
              </div>
            </Field>
            <span className="app-muted">
              Value: <output data-testid="night-value">{show(night)}</output>
            </span>
          </Stack>
        </Card>

        <Card className="app-demo">
          <CardHeader title="TimePicker" subtitle="Columns and a list of slots" />
          <Stack gap={3}>
            <Field label="Start time">
              <div data-testid="tp">
                <TimePicker value={start} onValueChange={setStart} locale="en-US" minuteStep={5} showNow />
              </div>
            </Field>
            <span className="app-muted">
              Value: <output data-testid="tp-value">{show(start)}</output>
            </span>
            <Field label="Appointment">
              <div data-testid="tpl">
                <TimePicker
                  variant="list"
                  value={slot}
                  onValueChange={setSlot}
                  locale="en-GB"
                  min="09:00"
                  max="17:00"
                  isTimeDisabled={(time) => time === "12:00"}
                />
              </div>
            </Field>
            <span className="app-muted">
              Value: <output data-testid="tpl-value">{show(slot)}</output>
            </span>
          </Stack>
        </Card>

        <Card className="app-demo">
          <CardHeader title="In a form" subtitle="name, required and reset" />
          <form data-testid="dt-form" onSubmit={submit} onReset={() => setSent("reset")}>
            <Stack gap={3}>
              <Field label="Date" required>
                <DateField name="date" locale="en-US" />
              </Field>
              <Field label="Time">
                <TimeField name="time" locale="en-GB" defaultValue="08:00" />
              </Field>
              <Inline gap={2}>
                <Button type="submit" variant="primary" data-testid="dt-submit">
                  Send
                </Button>
                <Button type="reset" data-testid="dt-reset">
                  Reset
                </Button>
              </Inline>
              <span className="app-muted">
                Sent: <output data-testid="dt-sent">{sent}</output>
              </span>
            </Stack>
          </form>
        </Card>
      </Grid>
    </PageSection>
  );
}
