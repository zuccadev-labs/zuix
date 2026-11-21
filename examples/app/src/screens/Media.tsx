import { useState } from "react";
import { Grid, Page, PageHeader, PageSection, Stack } from "@zuccadev-labs/zuix-zout";
import {
  Backdrop,
  Card,
  CardHeader,
  Carousel,
  CircularSlider,
  CompareSlider,
  ColorArea,
  ColorField,
  ColorPicker,
  ColorPickerTrigger,
  ColorSlider,
  ColorSwatchPicker,
  Field,
  Input,
  QRCode,
  SegmentedControl,
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
