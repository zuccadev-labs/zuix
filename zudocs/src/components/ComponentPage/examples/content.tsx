// Acciones, agenda, contenido, datos, efectos, estado y medios: los ejemplos con datos de muestra y estado local.
import { Icon } from "@zuccadev-labs/zuix-zicon/core";
import {
  Alert,
  AspectRatio,
  Avatar,
  Badge,
  Button,
  CalendarHeatmap,
  Card,
  CardHeader,
  CardMedia,
  CompareSlider,
  Confetti,
  type Crop,
  confetti,
  cropImageBlob,
  DataTable,
  DownloadTrigger,
  ErrorBoundary,
  Gauge,
  ImageCropper,
  JsonTree,
  ProgressGoal,
  qrcodeSvg,
  StatTile,
} from "@zuccadev-labs/zuix-zui";
import { useEffect, useRef, useState } from "react";
import { type ExampleDemos, usePhoto, wait } from "./shared";

/** Contribuciones de 2026: un valor por día, estable entre compilaciones (sin Math.random). */
const CONTRIBUTIONS: Record<string, number> = (() => {
  const out: Record<string, number> = {};
  const start = Date.UTC(2026, 0, 1);
  for (let i = 0; i < 365; i++) {
    const date = new Date(start + i * 86_400_000).toISOString().slice(0, 10);
    const weekday = new Date(start + i * 86_400_000).getUTCDay();
    const n = ((i * 7919) % 13) - (weekday === 0 || weekday === 6 ? 7 : 2);
    if (n > 0) out[date] = n;
  }
  return out;
})();

/** Un widget que se puede romper a propósito para ver el límite de error. */
function UsageWidget({ broken }: { broken: boolean }) {
  if (broken) throw new Error("Usage service returned 503.");
  return <StatTile label="Requests this month" value="1,204" delta="+12%" />;
}

function BreakableDemo({ custom }: { custom?: boolean }) {
  const [broken, setBroken] = useState(false);
  const [key, setKey] = useState(0);
  return (
    <div className="zd-demo-stack">
      <ErrorBoundary
        resetKey={key}
        onError={() => {}}
        fallback={
          custom
            ? (error, reset) => (
                <Alert
                  tone="danger"
                  title="Widget failed"
                  actions={
                    <Button
                      size="sm"
                      onClick={() => {
                        setBroken(false);
                        reset();
                      }}
                    >
                      Reload widget
                    </Button>
                  }
                >
                  {error.message}
                </Alert>
              )
            : undefined
        }
      >
        <UsageWidget broken={broken} />
      </ErrorBoundary>
      <span className="zd-demo-inline">
        <Button size="sm" variant="danger" icon="bolt" disabled={broken} onClick={() => setBroken(true)}>
          Break the widget
        </Button>
        {custom ? null : (
          <Button
            size="sm"
            icon="arrow-path"
            onClick={() => {
              setBroken(false);
              setKey((k) => k + 1);
            }}
          >
            Change route
          </Button>
        )}
      </span>
    </div>
  );
}

/** Equipo editable y archivos en árbol de los ejemplos de DataTable como rejilla. */
const TEAM = [
  { id: "a1", name: "Ana Torres", role: "admin", seats: 4, joined: new Date("2025-03-02T12:00:00Z") },
  { id: "b2", name: "Ben Okafor", role: "editor", seats: 12, joined: new Date("2026-01-15T12:00:00Z") },
  { id: "c3", name: "Chen Wei", role: "viewer", seats: 7, joined: new Date("2024-11-20T12:00:00Z") },
];
interface FileRow {
  id: string;
  name: string;
  size: number;
  children?: FileRow[];
}
const FILE_ROWS: FileRow[] = [
  {
    id: "src",
    name: "src",
    size: 0,
    children: [
      { id: "src/index.ts", name: "index.ts", size: 2 },
      { id: "src/app.ts", name: "app.ts", size: 14 },
    ],
  },
  { id: "readme", name: "README.md", size: 4 },
];
/** Diez mil filas deterministas. */
const INVENTORY = Array.from({ length: 10000 }, (_, i) => ({ id: i, name: `Item ${i + 1}`, value: (i * 37) % 1000 }));

const ORDERS = [
  { id: "ORD-4821", customer: "Ana Ruiz", total: "$129.00", paid: true },
  { id: "ORD-4822", customer: "Leo Park", total: "$48.50", paid: false },
  { id: "ORD-4823", customer: "Mia Chen", total: "$310.20", paid: true },
];

export const content: Record<string, ExampleDemos> = {
  DownloadTrigger: {
    Texto: () => (
      <DownloadTrigger fileName="notes.txt" data="Ship on Friday.">
        Download notes
      </DownloadTrigger>
    ),
    "Código QR en SVG": () => (
      <DownloadTrigger
        fileName="zuix-qr.svg"
        data={() => qrcodeSvg({ value: "https://zuccadev-labs.github.io/zuix/" }) ?? ""}
        variant="ghost"
      >
        Download QR
      </DownloadTrigger>
    ),
    "Desde una promesa": () => (
      <DownloadTrigger
        fileName="report.csv"
        variant="primary"
        data={async () => {
          await wait(1200);
          return new Blob(["month,signups\n2026-09,980\n2026-10,1104\n2026-11,1240\n"], { type: "text/csv" });
        }}
      >
        Export CSV
      </DownloadTrigger>
    ),
  },
  CalendarHeatmap: {
    "Contribuciones del año": () => {
      const total = Object.values(CONTRIBUTIONS).reduce((a, b) => a + b, 0);
      return (
        <CalendarHeatmap
          title={`${total.toLocaleString("en-US")} contributions in 2026`}
          locale="en-US"
          values={CONTRIBUTIONS}
          range={{ from: "2026-01-01", to: "2026-12-31" }}
        />
      );
    },
  },
  AspectRatio: {
    "Vídeo 16:9": () => {
      const { city } = usePhoto();
      return (
        <div className="zd-demo-media">
          <AspectRatio ratio={16 / 9}>
            <img src={city.src} alt="Product tour, first frame" />
          </AspectRatio>
        </div>
      );
    },
    "Cuadrado con un icono": () => (
      <AspectRatio ratio={1} style={{ maxWidth: 160 }}>
        <Icon name="photo" size={32} />
      </AspectRatio>
    ),
  },
  CardMedia: {
    "Imagen dentro del relleno": () => {
      const { aurora: cover } = usePhoto();
      return (
        <div className="zd-demo-card-media">
          <Card>
            <CardMedia placement="inset" ratio={4 / 3} src={cover.src} alt="Atlas dashboard" />
            <CardHeader title="Atlas" subtitle="Maps and routing" />
          </Card>
        </div>
      );
    },
  },
  JsonTree: {
    "Respuesta de una API": () => (
      <JsonTree
        label="Response"
        defaultExpandDepth={2}
        value={{ id: 42, name: "Atlas", active: true, owner: null, tags: ["design", "tokens"], stats: { views: 1204, ratio: 0.82 } }}
      />
    ),
    "Map, Set, fechas y copiar ruta": () => (
      <JsonTree
        label="Session"
        copyPath
        value={{ when: new Date("2026-11-20T09:00:00Z"), roles: new Set(["admin", "editor"]), limits: new Map([["api", BigInt(1000)]]) }}
      />
    ),
  },
  Gauge: {
    "240° con aguja": () => (
      <Gauge
        label="Satisfaction"
        arc={240}
        needle
        value={8.4}
        min={0}
        max={10}
        valueFormat={{ maximumFractionDigits: 1 }}
        zones={[
          { to: 6, tone: "danger", label: "Low" },
          { to: 8, tone: "warning", label: "Fair" },
          { to: 10, tone: "success", label: "Great" },
        ]}
        locale="en-US"
      />
    ),
  },
  ProgressGoal: {
    Conseguido: () => <ProgressGoal label="Signups" value={1240} target={1200} locale="en-US" />,
  },
  DataTable: {
    Ordenable: () => (
      <DataTable
        caption="Users"
        captionHidden
        rows={[
          { id: 1, name: "Ana Ruiz", seats: 3, joined: new Date("2025-03-02") },
          { id: 2, name: "Leo Park", seats: 1, joined: new Date("2026-01-15") },
          { id: 3, name: "Mia Chen", seats: 2, joined: new Date("2025-09-21") },
        ]}
        rowKey={(user) => user.id}
        defaultSort={{ key: "name", direction: "asc" }}
        columns={[
          { key: "name", header: "Name", accessor: (user) => user.name, sortable: true },
          { key: "seats", header: "Seats", accessor: (user) => user.seats, sortable: true, align: "end", mono: true },
          {
            key: "joined",
            header: "Joined",
            accessor: (user) => user.joined,
            // Locale y zona fijos: el texto del render del servidor y el de la hidratación coinciden.
            render: (user) => user.joined.toLocaleDateString("en-US", { timeZone: "UTC" }),
            sortable: true,
          },
        ]}
      />
    ),
    "Filas activables y celda propia": () => {
      const [selectedId, setSelectedId] = useState("ORD-4822");
      return (
        <DataTable
          caption="Orders"
          captionHidden
          rows={ORDERS}
          rowKey={(order) => order.id}
          onRowClick={(order) => setSelectedId(order.id)}
          isRowSelected={(order) => order.id === selectedId}
          empty="No orders yet"
          columns={[
            { key: "id", header: "Order", accessor: (order) => order.id, mono: true, width: "120px" },
            { key: "customer", header: "Customer", accessor: (order) => order.customer },
            { key: "total", header: "Total", accessor: (order) => order.total, align: "end", mono: true },
            {
              key: "status",
              header: "Status",
              render: (order) => <Badge tone={order.paid ? "success" : "warning"}>{order.paid ? "Paid" : "Pending"}</Badge>,
            },
          ]}
        />
      );
    },
    "Selección, pie y paginación": () => (
      <DataTable
        caption="Members"
        captionHidden
        rows={[
          { id: "a1", name: "Ana Ruiz", seats: 3 },
          { id: "b2", name: "Leo Park", seats: 12 },
          { id: "c3", name: "Mia Chen", seats: 1 },
          { id: "d4", name: "Zoe Katz", seats: 7 },
          { id: "e5", name: "Iker Sanz", seats: 5 },
        ]}
        rowKey={(member) => member.id}
        selectable
        defaultSelectedKeys={["b2"]}
        pageSize={3}
        columns={[
          { key: "name", header: "Name", accessor: (member) => member.name, sortable: true, footer: "Total" },
          {
            key: "seats",
            header: "Seats",
            accessor: (member) => member.seats,
            sortable: true,
            align: "end",
            mono: true,
            footer: (all) => all.reduce((sum, member) => sum + member.seats, 0),
          },
        ]}
      />
    ),
    "Rejilla editable, columnas fijadas y reordenables": () => {
      const [people, setPeople] = useState(TEAM);
      return (
        <DataTable
          caption="Team"
          captionHidden
          locale="es-ES"
          reorderable
          rows={people}
          rowKey={(p) => p.id}
          onCellEdit={({ rowKey, key, value }) => {
            if (key === "name" && value.trim().toLowerCase() === "taken") return "That name is taken";
            setPeople((list) => list.map((p) => (p.id === rowKey ? { ...p, [key]: key === "seats" ? Number(value) : value } : p)));
            return undefined;
          }}
          columns={[
            { key: "name", header: "Name", accessor: (p) => p.name, pinned: "start", editable: true, required: true },
            {
              key: "role",
              header: "Role",
              accessor: (p) => p.role,
              editable: true,
              editor: "select",
              options: [
                { value: "admin", label: "Admin" },
                { value: "editor", label: "Editor" },
                { value: "viewer", label: "Viewer" },
              ],
            },
            { key: "seats", header: "Seats", accessor: (p) => p.seats, align: "end", editable: true, editor: "number", min: 1, max: 50 },
            { key: "joined", header: "Joined", accessor: (p) => p.joined, pinned: "end" },
          ]}
        />
      );
    },
    "Agrupada con agregados": () => (
      <DataTable
        caption="Sales"
        captionHidden
        locale="en-US"
        groupBy="region"
        rows={[
          { id: 1, region: "North", rep: "Ana", amount: 1200 },
          { id: 2, region: "North", rep: "Leo", amount: 800 },
          { id: 3, region: "South", rep: "Mia", amount: 1500 },
        ]}
        rowKey={(s) => s.id}
        columns={[
          { key: "region", header: "Region", accessor: (s) => s.region },
          { key: "rep", header: "Rep", accessor: (s) => s.rep, aggregate: "count" },
          { key: "amount", header: "Amount", accessor: (s) => s.amount, align: "end", mono: true, aggregate: "sum" },
        ]}
      />
    ),
    "Datos en árbol y fila de detalle": () => (
      <DataTable
        caption="Files"
        captionHidden
        rows={FILE_ROWS}
        rowKey={(f) => f.id}
        getRowChildren={(f) => f.children}
        defaultExpandedRows={["src"]}
        renderDetail={(f) => `Path: ${f.id}`}
        defaultExpandedDetails={["readme"]}
        columns={[
          { key: "name", header: "Name", accessor: (f) => f.name },
          { key: "size", header: "Size (kB)", accessor: (f) => f.size, align: "end", mono: true },
        ]}
      />
    ),
    "Diez mil filas con ventana virtual": () => (
      <DataTable
        caption="Inventory"
        captionHidden
        rows={INVENTORY}
        rowKey={(r) => r.id}
        selectable
        columns={[
          { key: "name", header: "Name", accessor: (r) => r.name, sortable: true, filterable: true },
          { key: "value", header: "Value", accessor: (r) => r.value, sortable: true, align: "end", mono: true },
        ]}
      />
    ),
  },
  Confetti: {
    "Desde un botón": () => {
      const button = useRef<HTMLButtonElement | null>(null);
      const [shots, setShots] = useState(0);
      return (
        <>
          <Button ref={button} variant="primary" icon="rocket-launch" onClick={() => setShots((n) => n + 1)}>
            Publish
          </Button>
          <Confetti trigger={shots} origin={button} />
        </>
      );
    },
    "Desde código": () => (
      <Button icon="sparkles" onClick={() => void confetti({ origin: { x: 0.5, y: 0.3 }, count: 200, spread: 120 })}>
        Celebrate
      </Button>
    ),
  },
  ErrorBoundary: {
    "Por ruta": () => <BreakableDemo />,
    "Vista propia": () => <BreakableDemo custom />,
  },
  CompareSlider: {
    "Antes y después": () => {
      const { city } = usePhoto();
      return (
        <div className="zd-demo-media">
          <CompareSlider
            before={<img className="zd-raw" src={city.src} alt="City, unedited" />}
            after={<img src={city.src} alt="City, color graded" />}
          />
        </div>
      );
    },
  },
  ImageCropper: {
    Cuadrado: () => {
      const { glacier } = usePhoto();
      const [crop, setCrop] = useState<Crop>();
      return (
        <div className="zd-demo-media zd-demo-stack">
          <ImageCropper src={glacier.src} alt="Glacier at first light" aspect={1} onImageLoad={setCrop} onCropChangeEnd={setCrop} />
          <p className="zd-demo-hint">
            {crop
              ? `Crop: ${Math.round(crop.width)} × ${Math.round(crop.height)} at ${Math.round(crop.x)}, ${Math.round(crop.y)}`
              : "Loading…"}
          </p>
        </div>
      );
    },
    "Avatar circular y exportación": () => {
      const { forest } = usePhoto();
      const root = useRef<HTMLDivElement | null>(null);
      const [crop, setCrop] = useState<Crop>();
      const [avatar, setAvatar] = useState<string>();
      useEffect(() => () => (avatar ? URL.revokeObjectURL(avatar) : undefined), [avatar]);
      const save = async () => {
        const image = root.current?.querySelector("img");
        if (!image || !crop) return;
        const blob = await cropImageBlob(image, crop, { shape: "circle", maxSize: 512 });
        setAvatar(URL.createObjectURL(blob));
      };
      return (
        <div className="zd-demo-media zd-demo-stack">
          <ImageCropper
            ref={root}
            src={forest.src}
            alt="New avatar"
            aspect={1}
            shape="circle"
            onImageLoad={setCrop}
            onCropChangeEnd={setCrop}
          />
          <span className="zd-demo-inline">
            <Button variant="primary" onClick={() => void save()}>
              Save avatar
            </Button>
            {avatar ? <Avatar name="Ana Ruiz" src={avatar} size="lg" /> : null}
          </span>
        </div>
      );
    },
    Libre: () => {
      const { aurora } = usePhoto();
      return (
        <div className="zd-demo-media">
          <ImageCropper src={aurora.src} alt="Aurora over the ridge" grid={false} />
        </div>
      );
    },
  },
};
