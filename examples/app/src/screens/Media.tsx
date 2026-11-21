import { useRef, useState } from "react";
import { Grid, Page, PageHeader, PageSection, Stack } from "@zuccadev-labs/zuix-zout";
import {
  Backdrop,
  Button,
  Card,
  CardHeader,
  Carousel,
  Confetti,
  DownloadTrigger,
  qrcodeSvg,
  CircularSlider,
  CompareSlider,
  ColorArea,
  ColorField,
  ColorPicker,
  ColorPickerTrigger,
  ColorSlider,
  ColorSwatchPicker,
  Field,
  ImageCropper,
  cropImageBlob,
  type Crop,
  Input,
  QRCode,
  SegmentedControl,
  ShortcutInput,
  SignaturePad,
  signatureBlob,
  type ColorFormat,
  type QrLevel,
} from "@zuccadev-labs/zuix-zui";

const SWATCHES = [
  { value: "#ef4444", label: "Red" },
  { value: "#f59e0b", label: "Amber" },
  { value: "#10b981", label: "Emerald" },
  { value: "#3b82f6", label: "Blue" },
  { value: "#8b5cf6", label: "Violet" },
  { value: "#ec4899", label: "Pink" },
  { value: "#64748b", label: "Slate" },
  { value: "#0f172a", label: "Ink" },
];

/** Imagen de muestra (SVG en línea): un atardecer de 640 × 400. */
const SUNSET =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 640 400'%3E%3Cdefs%3E%3ClinearGradient id='s' x2='0' y2='1'%3E%3Cstop offset='0' stop-color='%23f8b26a'/%3E%3Cstop offset='1' stop-color='%23e0598b'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='640' height='400' fill='url(%23s)'/%3E%3Ccircle cx='470' cy='140' r='60' fill='%23fff3c4'/%3E%3Cpath d='M0 300 L160 190 L300 290 L420 210 L640 330 V400 H0Z' fill='%232d2a4a'/%3E%3C/svg%3E";

const PROJECTS = [
  { id: "atlas", title: "Atlas", subtitle: "Maps and routing" },
  { id: "beacon", title: "Beacon", subtitle: "Status pages" },
  { id: "cinder", title: "Cinder", subtitle: "Build cache" },
  { id: "drift", title: "Drift", subtitle: "Schema migrations" },
  { id: "ember", title: "Ember", subtitle: "Realtime sync" },
  { id: "flint", title: "Flint", subtitle: "Feature flags" },
];
type Project = (typeof PROJECTS)[number];
const slide = (p: Project) => (
  <Card>
    <CardHeader title={p.title} subtitle={p.subtitle} />
  </Card>
);

/** Oleada 7: medios y piezas tardías (color, deslizadores, imágenes, firma, QR, atajos, confeti, descargas). */
export function Media() {
  const [color, setColor] = useState("#3b82f6");
  const [format, setFormat] = useState<ColorFormat>("hex");
  const [ended, setEnded] = useState("");
  const [qrText, setQrText] = useState("https://zuccadev-labs.github.io/zuix/");
  const [qrLevel, setQrLevel] = useState<QrLevel>("M");
  const [dial, setDial] = useState(40);
  const [split, setSplit] = useState(50);
  const [crop, setCrop] = useState<Crop | null>(null);
  const [cropped, setCropped] = useState("");
  const [signed, setSigned] = useState("empty");
  const [png, setPng] = useState("");
  const [shortcut, setShortcut] = useState("Mod+K");
  const [shots, setShots] = useState(0);
  const [celebrated, setCelebrated] = useState(0);
  const [downloaded, setDownloaded] = useState("");
  const party = useRef<HTMLButtonElement>(null);
  return (
    <Page>
      <PageHeader title="Media" description="Color, sliders, images, signature, QR codes, shortcuts and downloads." />
      <PageSection title="Color">
        <Grid min="300px" gap={4}>
          <Card>
            <CardHeader title="Color picker" subtitle="Controlled, with swatches." />
            <Stack gap={3}>
              <div data-testid="m-picker">
                <ColorPicker
                  value={color}
                  onValueChange={setColor}
                  onValueChangeEnd={setEnded}
                  format={format}
                  onFormatChange={setFormat}
                  swatches={SWATCHES}
                  name="brand"
                />
              </div>
              <p className="app-muted" data-testid="m-picker-value">
                {color}
              </p>
              <p className="app-muted" data-testid="m-picker-end">
                {ended}
              </p>
            </Stack>
          </Card>
          <Card>
            <CardHeader title="In a popover" subtitle="Trigger with a swatch, area, sliders and fields." />
            <Stack gap={4}>
              <div data-testid="m-trigger">
                <ColorPickerTrigger id="m-trigger-picker" defaultValue="#8b5cf6" label="Accent color" swatches={SWATCHES.slice(0, 6)} />
              </div>
              <div data-testid="m-swatches">
                <ColorSwatchPicker defaultValue="#10b981" swatches={SWATCHES} label="Tag color" />
              </div>
              <div data-testid="m-field">
                <ColorField defaultValue="rgb(236 72 153 / 0.8)" />
              </div>
            </Stack>
          </Card>
          <Card>
            <CardHeader title="Parts" subtitle="Area and sliders on their own." />
            <Stack gap={3}>
              <div data-testid="m-area">
                <ColorArea defaultValue="#f59e0b" label="Highlight color" />
              </div>
              <div data-testid="m-hue">
                <ColorSlider channel="hue" defaultValue="#10b981" />
              </div>
              <div data-testid="m-alpha">
                <ColorSlider channel="alpha" defaultValue="#3b82f680" />
              </div>
            </Stack>
          </Card>
        </Grid>
      </PageSection>
      <PageSection title="Sliders">
        <Grid min="220px" gap={4}>
          <Card>
            <CardHeader title="Circular slider" subtitle="Controlled dial with an open arc." />
            <Stack gap={2}>
              <div data-testid="m-dial">
                <CircularSlider
                  label="Volume"
                  value={dial}
                  onValueChange={setDial}
                  arc={270}
                  thickness={10}
                  caption="volume"
                  name="volume"
                />
              </div>
              <p className="app-muted" data-testid="m-dial-value">
                {dial}
              </p>
            </Stack>
          </Card>
          <Card>
            <CardHeader title="Before and after" subtitle="Drag the divider or use the arrow keys." />
            <Stack gap={2}>
              <div data-testid="m-compare">
                <CompareSlider
                  value={split}
                  onValueChange={setSplit}
                  before={<Backdrop className="z-solid app-compare" pattern="grid" intensity="strong" fade="none" />}
                  after={<Backdrop className="z-solid app-compare" pattern="hex" intensity="strong" fade="none" />}
                />
              </div>
              <p className="app-muted" data-testid="m-compare-value">
                {split}
              </p>
            </Stack>
          </Card>
          <Card>
            <CardHeader title="Full circle" subtitle="Hue in steps of 15 degrees with marks." />
            <div data-testid="m-ring">
              <CircularSlider label="Hue" defaultValue={210} max={360} step={15} marks caption="degrees" />
            </div>
          </Card>
        </Grid>
      </PageSection>
      <PageSection title="Image cropper">
        <Grid min="300px" gap={4}>
          <div data-testid="m-cropper">
            <ImageCropper src={SUNSET} alt="Hills at sunset" aspect={1} onCropChangeEnd={setCrop} onImageLoad={setCrop} />
          </div>
          <Card>
            <CardHeader title="Export" subtitle="Draws the crop on a canvas and returns a PNG." />
            <Stack gap={3}>
              <Button
                data-testid="m-crop-export"
                onClick={async () => {
                  const img = document.querySelector<HTMLImageElement>('[data-testid="m-cropper"] img');
                  if (!img || !crop) return;
                  const blob = await cropImageBlob(img, crop, { maxSize: 256 });
                  const bitmap = await createImageBitmap(blob);
                  setCropped(`${bitmap.width}×${bitmap.height} ${blob.type}`);
                }}
              >
                Export crop
              </Button>
              <p className="app-muted" data-testid="m-crop-out">
                {cropped}
              </p>
            </Stack>
          </Card>
        </Grid>
      </PageSection>
      <PageSection title="Signature">
        <Grid min="320px" gap={4}>
          <div data-testid="m-signature">
            <SignaturePad
              name="signature"
              onChange={(v) => setSigned(v.empty ? "empty" : `${v.mode}:${v.mode === "type" ? v.typed : v.strokes.length}`)}
            />
          </div>
          <Card>
            <CardHeader title="State" subtitle="Strokes or typed name, and PNG export." />
            <Stack gap={3}>
              <p className="app-muted" data-testid="m-signature-state">
                {signed}
              </p>
              <Button
                data-testid="m-signature-export"
                onClick={async () => {
                  const el = document.querySelector<HTMLElement>('[data-testid="m-signature"] .z-signature');
                  if (!el) return;
                  const blob = await signatureBlob(el, { scale: 1 });
                  setPng(`${blob.type} ${blob.size > 100 ? "ok" : "small"}`);
                }}
              >
                Export PNG
              </Button>
              <p className="app-muted" data-testid="m-signature-png">
                {png}
              </p>
            </Stack>
          </Card>
        </Grid>
      </PageSection>
      <PageSection title="Shortcuts">
        <Card>
          <CardHeader title="Command palette" subtitle="Click, then press a key combination. Escape cancels." />
          <Stack gap={2}>
            <div data-testid="m-shortcut">
              <ShortcutInput value={shortcut} onValueChange={setShortcut} name="palette" labels={{ field: "Open command palette" }} />
            </div>
            <p className="app-muted" data-testid="m-shortcut-value">
              {shortcut || "none"}
            </p>
          </Stack>
        </Card>
      </PageSection>
      <PageSection title="Celebrate">
        <Stack gap={2}>
          <Button ref={party} variant="primary" data-testid="m-confetti" onClick={() => setShots((n) => n + 1)}>
            Publish release
          </Button>
          <Confetti trigger={shots} origin={party} duration={1200} onComplete={() => setCelebrated((n) => n + 1)} />
          <p className="app-muted" role="status" data-testid="m-confetti-done">
            {shots ? `Release published (${celebrated} bursts finished)` : ""}
          </p>
        </Stack>
      </PageSection>
      <PageSection title="QR code">
        <Grid min="260px" gap={4}>
          <Card>
            <CardHeader title="Generator" subtitle="Own encoder: byte mode, levels L to H." />
            <Stack gap={3}>
              <Field label="Text or URL">
                <Input value={qrText} onChange={(e) => setQrText(e.target.value)} data-testid="m-qr-input" />
              </Field>
              <SegmentedControl
                label="Error correction"
                value={qrLevel}
                onValueChange={setQrLevel}
                items={[
                  { value: "L", label: "L" },
                  { value: "M", label: "M" },
                  { value: "Q", label: "Q" },
                  { value: "H", label: "H" },
                ]}
              />
            </Stack>
          </Card>
          <div data-testid="m-qr">
            <QRCode value={qrText} level={qrLevel} size={200} />
          </div>
          <div data-testid="m-qr-icon">
            <QRCode value={qrText} icon="bolt" size={200} label="Project link" />
          </div>
          <Card>
            <CardHeader title="Download" subtitle="Generated on click, as SVG or text." />
            <Stack gap={3}>
              <DownloadTrigger
                data-testid="m-download-qr"
                fileName="zuix-qr.svg"
                data={() => qrcodeSvg({ value: qrText, level: qrLevel, size: 256 }) ?? ""}
                onDownload={(blob) => setDownloaded(blob ? `${blob.type} ${blob.size}` : "url")}
              >
                Download QR
              </DownloadTrigger>
              <DownloadTrigger
                data-testid="m-download-slow"
                variant="ghost"
                fileName="notes.txt"
                data={() => new Promise<string>((resolve) => setTimeout(() => resolve("Ship on Friday."), 600))}
                onDownload={(blob) => setDownloaded(blob ? `${blob.type} ${blob.size}` : "url")}
              >
                Download notes (slow)
              </DownloadTrigger>
              <p className="app-muted" data-testid="m-download-out">
                {downloaded}
              </p>
            </Stack>
          </Card>
        </Grid>
      </PageSection>
      <PageSection title="Carousel">
        <Stack gap={6}>
          <div data-testid="m-car-auto">
            <Carousel
              ariaLabel="Highlights"
              effect="none"
              autoplay={2000}
              indicators="dots"
              items={PROJECTS}
              getKey={(p) => p.id}
              renderItem={slide}
            />
          </div>
          <div data-testid="m-car-page">
            <Carousel
              ariaLabel="Projects"
              slidesPerPage={3}
              indicators="bar"
              loop={false}
              items={PROJECTS}
              getKey={(p) => p.id}
              renderItem={slide}
            />
          </div>
          <Grid min="300px" gap={4}>
            <div data-testid="m-car-vertical">
              <Carousel
                ariaLabel="Release notes"
                orientation="vertical"
                height={260}
                slidesPerPage={2}
                indicators="dots"
                items={PROJECTS}
                getKey={(p) => p.id}
                renderItem={slide}
              />
            </div>
            <div data-testid="m-car-thumbs">
              <Carousel
                ariaLabel="Covers"
                effect="none"
                loop={false}
                indicators="thumbnails"
                items={PROJECTS}
                getKey={(p) => p.id}
                renderItem={slide}
                renderThumbnail={(p) => (
                  <span className="app-thumb" aria-hidden="true">
                    {p.title.slice(0, 2)}
                  </span>
                )}
              />
            </div>
          </Grid>
        </Stack>
      </PageSection>
    </Page>
  );
}
