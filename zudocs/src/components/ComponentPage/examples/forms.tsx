// Formularios y tiempo: calendarios con datos por día, selectores, subida de archivos con progreso simulado.
import {
  Calendar,
  Combobox,
  DatePicker,
  DateRangePicker,
  Field,
  FileUpload,
  OTPInput,
  Select,
  TimeZoneSelect,
} from "@zuccadev-labs/zuix-zui";
import { useEffect, useRef, useState } from "react";
import type { ExampleDemos } from "./shared";

/** Precio por noche de diciembre de 2026; los días sin precio están agotados. */
const PRICES: Record<string, number> = {};
for (let d = 1; d <= 31; d++) {
  if (d % 9 === 4) continue;
  PRICES[`2026-12-${String(d).padStart(2, "0")}`] = 39 + ((d * 17) % 7) * 9 + (d > 20 ? 30 : 0);
}

const day = (d: number) => `2026-11-${String(d).padStart(2, "0")}`;
const inRange = (from: number, to: number) => (date: string) => date >= day(from) && date <= day(to);
const period = inRange(3, 7);
const predicted = inRange(30, 30);
const fertile = inRange(15, 20);
const ovulation = (date: string) => date === day(19);
const SYMPTOMS: Record<string, number> = { [day(3)]: 3, [day(4)]: 2, [day(5)]: 1, [day(19)]: 1, [day(24)]: 2 };

const BOOKED = new Set(["2026-12-10", "2026-12-11", "2026-12-12", "2026-12-24", "2026-12-25"]);
const CHECKOUT_ONLY = new Set(["2026-12-13", "2026-12-26"]);

/** Subida simulada: cada archivo avanza hasta el 100 %. */
function useFakeUpload() {
  const [progress, setProgress] = useState<Record<string, number>>({});
  const timer = useRef<ReturnType<typeof setInterval>>(undefined);
  useEffect(() => () => clearInterval(timer.current), []);
  const start = (files: File[]) => {
    setProgress((p) => ({ ...p, ...Object.fromEntries(files.map((f) => [f.name, 0])) }));
    clearInterval(timer.current);
    timer.current = setInterval(() => {
      setProgress((p) => {
        const next = Object.fromEntries(Object.entries(p).map(([k, v]) => [k, Math.min(100, v + 8)]));
        if (Object.values(next).every((v) => v >= 100)) clearInterval(timer.current);
        return next;
      });
    }, 250);
  };
  return { progress, start };
}

export const forms: Record<string, ExampleDemos> = {
  Calendar: {
    "Semana por su número": () => {
      const [week, setWeek] = useState<string>();
      return (
        <div className="zd-demo-stack zd-demo-stack--center">
          <Calendar
            mode="range"
            locale="en-US"
            showWeekNumber
            onWeekNumberClick={(w) => setWeek(`${w.from} → ${w.to}`)}
            defaultMonth="2026-11"
          />
          <p className="zd-demo-hint">{week ? `Week picked: ${week}` : "Click a week number to pick the whole week."}</p>
        </div>
      );
    },
    "Contenido por celda: precio por día": () => (
      <Calendar
        locale="en-US"
        defaultMonth="2026-12"
        cellSize="lg"
        renderDay={(date) => (PRICES[date] ? `€${PRICES[date]}` : "—")}
        getDayDescription={(date) => (PRICES[date] ? `€${PRICES[date]}${PRICES[date] < 50 ? ", lowest" : ""}` : "sold out")}
        isDateDisabled={(date) => !PRICES[date]}
        modifiers={{ cheap: (date) => (PRICES[date] ?? Number.POSITIVE_INFINITY) < 50 }}
        className="zd-calendar-prices"
      />
    ),
    "Contenido por celda: marcadores de ciclo con leyenda": () => (
      <div className="zd-demo-stack zd-demo-stack--center zd-calendar-cycle">
        <Calendar
          locale="en-US"
          defaultMonth="2026-11"
          cellSize="lg"
          modifiers={{ period, predicted, fertile, ovulation }}
          renderDay={(date) => (SYMPTOMS[date] ? "•".repeat(SYMPTOMS[date]) : null)}
          getDayDescription={(date) =>
            [
              period(date) && "period",
              predicted(date) && "predicted period",
              fertile(date) && "fertile window",
              ovulation(date) && "ovulation",
            ]
              .filter(Boolean)
              .join(", ") || ""
          }
        />
        <ul className="zd-legend" aria-label="Legend">
          <li data-mark="period">Period</li>
          <li data-mark="predicted">Predicted</li>
          <li data-mark="fertile">Fertile window</li>
          <li data-mark="ovulation">Ovulation</li>
        </ul>
      </div>
    ),
    "Estancia: noches, solo salida, flexibilidad y ajuste ±1": () => (
      <Calendar
        mode="range"
        locale="en-US"
        defaultMonth="2026-12"
        numberOfMonths={2}
        rangeUnit="nights"
        minRange={2}
        isDateUnavailable={(date) => BOOKED.has(date)}
        isDateCheckoutOnly={(date) => CHECKOUT_ONLY.has(date)}
        defaultFlexibility={1}
        showLengthStepper
      />
    ),
  },
  Combobox: {
    "Lista local": () => (
      <Combobox
        aria-label="Country"
        placeholder="Search a country"
        clearable
        options={[
          { value: "ar", label: "Argentina" },
          { value: "br", label: "Brazil" },
          { value: "cl", label: "Chile" },
          { value: "mx", label: "Mexico" },
          { value: "es", label: "Spain" },
          { value: "uy", label: "Uruguay" },
        ]}
      />
    ),
    "Dentro de Field, con valor": () => (
      <Field label="Assignee" hint="Type to filter.">
        <Combobox
          defaultValue="leo"
          options={[
            { value: "ana", label: "Ana Ruiz", icon: "user" },
            { value: "leo", label: "Leo Park", icon: "user" },
            { value: "mia", label: "Mia Chen", icon: "user", disabled: true },
          ]}
        />
      </Field>
    ),
  },
  DatePicker: {
    "Rango dentro de Field": () => (
      <Field label="Stay" hint="Check-in and check-out.">
        <DatePicker mode="range" locale="en-US" min="2026-11-01" defaultValue={{ from: "2026-11-09", to: "2026-11-14" }} />
      </Field>
    ),
    "Vacío, pequeño": () => <DatePicker size="sm" block={false} aria-label="Start date" locale="en-US" placeholder="Pick a date" />,
  },
  DateRangePicker: {
    "Estancia con mínimo de noches": () => (
      <DateRangePicker
        aria-label="Stay"
        locale="en-US"
        minRange={3}
        isDateUnavailable={(date) => date === "2026-12-24"}
        unavailableLabel="booked"
      />
    ),
  },
  FileUpload: {
    Imágenes: () => {
      const [images, setImages] = useState<File[]>([]);
      const [error, setError] = useState<string>();
      return (
        <div className="zd-demo-stack">
          <FileUpload
            accept="image/*"
            multiple
            maxSize={5 * 1024 * 1024}
            hint={
              error ?? (images.length ? `${images.length} ready: ${images.map((f) => f.name).join(", ")}` : "PNG or JPG, up to 5 MB each.")
            }
            invalid={Boolean(error)}
            onFiles={(files) => {
              setImages(files);
              setError(undefined);
            }}
            onReject={() => setError("Some files were skipped.")}
          />
        </div>
      );
    },
    "Con lista y progreso": () => {
      const { progress, start } = useFakeUpload();
      return (
        <FileUpload
          multiple
          showFiles
          accept="image/*,.pdf"
          hint="Images or PDF."
          onFiles={start}
          progress={(file) => progress[file.name]}
        />
      );
    },
  },
  OTPInput: {
    "Controlado con error": () => {
      const [pin, setPin] = useState("12");
      const done = pin.length === 4;
      return (
        <div className="zd-demo-stack zd-demo-stack--center">
          <OTPInput length={4} value={pin} onChange={setPin} mask invalid={done && pin !== "2468"} label="PIN" />
          <p className="zd-demo-hint">
            {done ? (pin === "2468" ? "PIN accepted." : "Wrong PIN. Try 2468.") : "Enter the 4-digit PIN (2468)."}
          </p>
        </div>
      );
    },
  },
  Select: {
    "Con iconos": () => (
      <Select
        aria-label="View"
        placeholder="Choose a view"
        options={[
          { value: "list", label: "List", icon: "list-bullet" },
          { value: "grid", label: "Grid", icon: "squares-2x2" },
          { value: "board", label: "Board", disabled: true },
        ]}
      />
    ),
    "Grupos dentro de Field": () => (
      <Field label="Region">
        <Select
          defaultValue="eu-west"
          options={[
            {
              label: "Europe",
              options: [
                { value: "eu-west", label: "Ireland" },
                { value: "eu-central", label: "Frankfurt" },
              ],
            },
            {
              label: "Americas",
              options: [
                { value: "us-east", label: "Virginia" },
                { value: "sa-east", label: "São Paulo" },
              ],
            },
          ]}
        />
      </Field>
    ),
    "Pequeño, en línea": () => (
      <span className="zd-demo-inline">
        Rows per page
        <Select
          size="sm"
          block={false}
          aria-label="Rows per page"
          defaultValue="25"
          options={[
            { value: "10", label: "10" },
            { value: "25", label: "25" },
            { value: "50", label: "50" },
          ]}
        />
      </span>
    ),
  },
  TimeZoneSelect: {
    "Lista corta por desfase": () => (
      <TimeZoneSelect
        aria-label="Time zone"
        groupBy="offset"
        zones={["America/Los_Angeles", "America/New_York", "Europe/London", "Europe/Madrid", "Asia/Kolkata", "Asia/Tokyo"]}
      />
    ),
  },
};
