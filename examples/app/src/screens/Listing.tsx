import { useEffect, useMemo, useState } from "react";
import { Container, Grid, Inline, Page, PageHeader, PageSection, Stack } from "@zuccadev-labs/zuix-zout";
import {
  Card,
  CardHeader,
  FileUpload,
  FilterBar,
  IconButton,
  NotificationBadge,
  NotificationCenter,
  PriceBreakdown,
  PriceTag,
  ReviewCard,
  ReviewSummary,
  type FilterDef,
  type FilterValue,
  type NotificationItem,
} from "@zuccadev-labs/zuix-zui";

// Pantalla de un anuncio de alojamiento: avisos del anfitrión, filtros de búsqueda, precios, opiniones y las fotos
// del anuncio en una rejilla ordenable. Todo con datos de ejemplo y sin red.

const NOW = Date.parse("2026-11-23T12:00:00Z");

const NOTIFICATIONS: NotificationItem[] = [
  {
    id: "n1",
    title: "Marco Rossi booked Sea View Loft",
    body: "3 nights, 12–15 Dec.",
    time: "2026-11-23T10:42:00Z",
    icon: "calendar-days",
    tone: "accent",
    actions: [{ id: "view", label: "View booking" }],
  },
  { id: "n2", title: "Payout of €1,240.00 sent", time: "2026-11-23T08:05:00Z", icon: "banknotes", tone: "success" },
  {
    id: "n3",
    title: "New review from Ana López",
    body: "“Great base for exploring.”",
    time: "2026-11-22T19:30:00Z",
    icon: "star",
    read: true,
  },
  {
    id: "n4",
    title: "Calendar sync failed",
    body: "Reconnect your external calendar.",
    time: "2026-11-18T07:15:00Z",
    icon: "exclamation-triangle",
    tone: "warning",
    read: true,
    actions: [{ id: "retry", label: "Reconnect" }],
  },
];

const FILTERS: FilterDef[] = [
  { id: "instant", label: "Instant book", icon: "bolt" },
  {
    id: "price",
    label: "Price",
    icon: "banknotes",
    multiple: false,
    options: [
      { value: "low", label: "Under €100" },
      { value: "mid", label: "€100–€200" },
      { value: "high", label: "Over €200" },
    ],
  },
  {
    id: "type",
    label: "Type of place",
    options: [
      { value: "entire", label: "Entire home" },
      { value: "room", label: "Private room" },
    ],
  },
  { id: "pets", label: "Pets allowed" },
  { id: "parking", label: "Free parking" },
  { id: "pool", label: "Pool" },
  { id: "wifi", label: "Wi-Fi", icon: "wifi" },
];

interface Stay {
  id: string;
  name: string;
  place: string;
  price: number;
  previous?: number;
  type: "entire" | "room";
  instant: boolean;
  pets: boolean;
  parking: boolean;
  pool: boolean;
  wifi: boolean;
}

const STAYS: Stay[] = [
  {
    id: "s1",
    name: "Sea View Loft",
    place: "Lisbon",
    price: 120,
    previous: 150,
    type: "entire",
    instant: true,
    pets: false,
    parking: true,
    pool: false,
    wifi: true,
  },
  {
    id: "s2",
    name: "Garden Room",
    place: "Porto",
    price: 68,
    type: "room",
    instant: true,
    pets: true,
    parking: false,
    pool: false,
    wifi: true,
  },
  {
    id: "s3",
    name: "Hillside Villa",
    place: "Sintra",
    price: 260,
    type: "entire",
    instant: false,
    pets: true,
    parking: true,
    pool: true,
    wifi: true,
  },
  {
    id: "s4",
    name: "Old Town Studio",
    place: "Lisbon",
    price: 95,
    type: "entire",
    instant: false,
    pets: false,
    parking: false,
    pool: false,
    wifi: false,
  },
];

const band = (price: number) => (price < 100 ? "low" : price <= 200 ? "mid" : "high");

function matches(stay: Stay, value: FilterValue): boolean {
  for (const key of ["instant", "pets", "parking", "pool", "wifi"] as const) if (value[key] === true && !stay[key]) return false;
  const price = value.price;
  if (Array.isArray(price) && price.length && !price.includes(band(stay.price))) return false;
  const type = value.type;
  if (Array.isArray(type) && type.length && !type.includes(stay.type)) return false;
  return true;
}

const REVIEW_TEXT =
  "The flat is bright and quiet, and the kitchen has everything you need for longer stays. We walked to the old town every morning and took the tram back in the evening. The only thing I would change is the shower pressure, which was weak on the second floor. Check-in was easy with the lockbox, and the host answered every message within minutes. We would happily come back in spring.";

/** Fotos de ejemplo dibujadas en un lienzo y entregadas como archivos, como si llegaran del selector. */
async function samplePhotos(): Promise<File[]> {
  // Colores de la serie de gráficos de la marca activa: la foto de ejemplo cambia con la marca y el tema.
  // Se resuelven en un elemento de prueba: el lienzo no entiende `var()` ni todas las mezclas de color.
  const probe = document.createElement("span");
  document.body.append(probe);
  const token = (name: string) => {
    probe.style.color = `var(${name})`;
    return getComputedStyle(probe).color;
  };
  const scenes: [string, string, string][] = [
    ["living-room.png", token("--z-chart-1"), token("--z-chart-2")],
    ["kitchen.png", token("--z-chart-3"), token("--z-chart-4")],
    ["bedroom.png", token("--z-chart-5"), token("--z-chart-6")],
    ["terrace.png", token("--z-chart-7"), token("--z-chart-8")],
    ["view.png", token("--z-chart-2"), token("--z-chart-5")],
  ];
  const out: File[] = [];
  for (const [name, from, to] of scenes) {
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 240;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const g = ctx.createLinearGradient(0, 0, 320, 240);
      g.addColorStop(0, from);
      g.addColorStop(1, to);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 320, 240);
    }
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (blob) out.push(new File([blob], name, { type: "image/png", lastModified: NOW }));
  }
  probe.remove();
  return out;
}

export function ListingScreen() {
  const [notifications, setNotifications] = useState(NOTIFICATIONS);
  const [filters, setFilters] = useState<FilterValue>({ instant: true });
  const [photos, setPhotos] = useState<File[]>([]);
  const [log, setLog] = useState("");
  useEffect(() => {
    let alive = true;
    void samplePhotos().then((files) => {
      if (alive) setPhotos(files);
    });
    return () => {
      alive = false;
    };
  }, []);
  const shown = useMemo(() => STAYS.filter((stay) => matches(stay, filters)), [filters]);
  const unread = notifications.filter((n) => !n.read).length;
  return (
    <Page label="Listing" width="full">
      <Container width="xl">
        <Stack gap={8}>
          <PageHeader
            eyebrow="Host"
            title="Sea View Loft"
            description="Lisbon · Entire home · 2 guests"
            actions={
              <Inline gap={2}>
                <NotificationBadge count={unread} label="" data-testid="ls-badge">
                  <IconButton icon="chat-bubble-left-right" label={`Messages, ${unread} unread`} variant="ghost" />
                </NotificationBadge>
                <div data-testid="ls-notifications">
                  <NotificationCenter
                    notifications={notifications}
                    now={NOW}
                    timeZone="UTC"
                    locale="en-GB"
                    viewAllHref="#notifications"
                    onReadChange={({ id, read }) => setNotifications((list) => list.map((n) => (n.id === id ? { ...n, read } : n)))}
                    onReadAll={({ ids }) => setNotifications((list) => list.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n)))}
                    onAction={({ id, action }) => setLog(`${action}:${id}`)}
                  />
                </div>
              </Inline>
            }
          />

          <PageSection title="Find a stay" description={`${shown.length} of ${STAYS.length} stays match.`}>
            <Stack gap={4}>
              <div data-testid="ls-filters">
                <FilterBar filters={FILTERS} value={filters} onChange={({ value }) => setFilters(value)} />
              </div>
              <Grid min={220} gap={4} as="ul" className="app-stays">
                {shown.map((stay) => (
                  <li key={stay.id} data-testid={`ls-stay-${stay.id}`}>
                    <Card>
                      <CardHeader title={stay.name} subtitle={stay.place} />
                      <PriceTag amount={stay.price} previous={stay.previous} currency="EUR" locale="en-IE" unit="/ night" trimZeros />
                    </Card>
                  </li>
                ))}
              </Grid>
            </Stack>
          </PageSection>

          <Grid min={320} gap={8}>
            <PageSection title="Price details">
              <Card>
                <PriceBreakdown
                  data-testid="ls-price"
                  currency="EUR"
                  locale="en-IE"
                  subtotal
                  lines={[
                    { label: "3 nights", hint: "€120.00 × 3", amount: 360 },
                    { label: "Cleaning fee", amount: 45, kind: "fee" },
                    { label: "Weekly discount", amount: 36, kind: "discount" },
                    { label: "VAT (13%)", rate: 13, kind: "tax" },
                  ]}
                  totalHint="You won't be charged yet"
                />
              </Card>
            </PageSection>
            <PageSection title="Guest reviews">
              <ReviewSummary data-testid="ls-summary" locale="en-GB" distribution={{ 5: 873, 4: 241, 3: 90, 2: 31, 1: 49 }} />
            </PageSection>
          </Grid>

          <PageSection title="What guests say">
            <Grid min={320} gap={6}>
              <ReviewCard
                data-testid="ls-review"
                author={{ name: "Ana López", secondary: "Madrid, Spain" }}
                rating={4}
                date="2026-10-12"
                locale="en-GB"
                title="Great base for exploring"
                text={REVIEW_TEXT}
                reply={{ author: "Marta", date: "2026-10-14", text: "Thank you, Ana! We have fixed the shower since your stay." }}
              />
              <ReviewCard
                author={{ name: "Yuki Tanaka", secondary: "Osaka, Japan" }}
                rating={5}
                date="2026-09-30"
                locale="en-GB"
                text="Spotless and exactly as described."
              />
            </Grid>
          </PageSection>

          <PageSection
            title="Photos"
            description="The first photo is the cover. Drag the handle, or press Space on it and use the arrow keys."
          >
            <div data-testid="ls-photos">
              <FileUpload
                layout="grid"
                multiple
                sortable
                cover
                accept="image/*"
                label="Add photos"
                hint="PNG or JPG. Drag to reorder."
                icon="photo"
                files={photos}
                onFiles={(added) => setPhotos((list) => [...list, ...added])}
                onRemove={(file) => setPhotos((list) => list.filter((f) => f !== file))}
                onReorder={(files) => {
                  setPhotos(files);
                  setLog(`order:${files.map((f) => f.name.replace(".png", "")).join(",")}`);
                }}
                progress={(file) => (file.name === "view.png" ? 60 : undefined)}
              />
            </div>
            <p className="app-muted" data-testid="ls-log">
              {log}
            </p>
          </PageSection>
        </Stack>
      </Container>
    </Page>
  );
}
