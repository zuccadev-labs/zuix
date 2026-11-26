import { useEffect, useMemo, useState } from "react";
import { Container, Grid, Page, PageHeader, PageSection, Stack } from "@zuccadev-labs/zuix-zout";
import {
  AudioPlayer,
  Button,
  ChatSearch,
  Checkpoint,
  DashboardGrid,
  MessageList,
  StackTrace,
  StatTile,
  VoiceInput,
  VoiceNote,
  Waveform,
  WebPreview,
  Widget,
  type ChatMessage,
  type DashboardLayoutValue,
  type VoiceSend,
  type WidgetStatus,
} from "@zuccadev-labs/zuix-zui";

// Pantalla de piezas de dominio (`?screen=studio`): buscar en una conversación, puntos de restauración, vista previa de
// una página, grabar voz, una traza de error, un reproductor con su onda y widgets de dashboard con sus estados. Todo
// con datos de ejemplo y sin red: la página de la vista previa y el audio salen de la propia aplicación.

const NOW = Date.parse("2026-11-25T10:00:00Z");
const at = (minutesAgo: number) => new Date(NOW - minutesAgo * 60_000).toISOString();
const ANA = { name: "Ana López" };

const MESSAGES: ChatMessage[] = [
  { id: "m1", authorId: "ana", author: ANA, createdAt: at(50), text: "The release notes are ready for review." },
  { id: "m2", authorId: "me", createdAt: at(48), text: "Great, I will read them after lunch.", status: "read" },
  { id: "m3", authorId: "ana", author: ANA, createdAt: at(30), text: "I also added the notes about the new tokens." },
  { id: "m4", authorId: "me", createdAt: at(12), text: "Can we move the release to Thursday?", status: "read" },
  { id: "m5", authorId: "ana", author: ANA, createdAt: at(5), text: "Thursday works. I will update the release checklist." },
];

const STACK = `TypeError: Cannot read properties of undefined (reading 'map')
    at ProjectList (http://localhost:5173/src/screens/Projects.tsx:42:19)
    at renderWithHooks (http://localhost:5173/node_modules/.vite/deps/react-dom.js:11548:26)
    at mountIndeterminateComponent (http://localhost:5173/node_modules/.vite/deps/react-dom.js:14926:21)
    at beginWork (http://localhost:5173/node_modules/.vite/deps/react-dom.js:15914:22)
    at loadProjects (http://localhost:5173/src/data/projects.ts:17:5)
    at async refresh (http://localhost:5173/src/data/store.ts:88:3)`;

const PEAKS = [3, 5, 8, 6, 9, 4, 3, 7, 9, 6, 4, 2, 5, 8, 7, 3, 4, 6, 8, 9, 7, 5, 3, 2, 4, 6, 9, 8, 6, 4, 3, 5];

/** Un tono de 6 s que sube y baja, en WAV, hecho en el navegador: el reproductor tiene algo que sonar sin red. */
function sampleAudio(): string {
  const rate = 8000;
  const seconds = 6;
  const n = rate * seconds;
  const buffer = new ArrayBuffer(44 + n * 2);
  const view = new DataView(buffer);
  const text = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };
  text(0, "RIFF");
  view.setUint32(4, 36 + n * 2, true);
  text(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    const envelope = 0.15 + 0.85 * Math.abs(Math.sin((t * Math.PI) / 1.5));
    view.setInt16(44 + i * 2, Math.round(Math.sin(2 * Math.PI * 330 * t) * envelope * 9000), true);
  }
  return URL.createObjectURL(new Blob([buffer], { type: "audio/wav" }));
}

const LAYOUT: DashboardLayoutValue = [
  { id: "revenue", x: 0, y: 0, w: 4, h: 2 },
  { id: "signups", x: 4, y: 0, w: 4, h: 2 },
  { id: "errors", x: 8, y: 0, w: 4, h: 2 },
];

export function StudioScreen() {
  const [audio, setAudio] = useState("");
  const [restored, setRestored] = useState<string | null>(null);
  const [recording, setRecording] = useState<VoiceSend | null>(null);
  const [recordingUrl, setRecordingUrl] = useState("");
  const [signups, setSignups] = useState<WidgetStatus>("loading");
  const [errors, setErrors] = useState<WidgetStatus>("error");
  const [layout, setLayout] = useState(LAYOUT);
  const [position, setPosition] = useState(12);
  const [searching, setSearching] = useState(true);
  useEffect(() => {
    const url = sampleAudio();
    setAudio(url);
    const timer = setTimeout(() => setSignups("empty"), 1200);
    return () => {
      URL.revokeObjectURL(url);
      clearTimeout(timer);
    };
  }, []);
  useEffect(() => {
    if (!recording) return;
    const url = URL.createObjectURL(recording.blob);
    setRecordingUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [recording]);
  const preview = useMemo(() => (typeof window === "undefined" ? "" : new URL("/preview.html", window.location.href).href), []);
  return (
    <Page label="Studio" width="full">
      <Container width="xl">
        <Stack gap={8}>
          <PageHeader eyebrow="Assistant" title="Studio" description="Chat search, checkpoints, previews, voice, traces and audio." />

          <PageSection title="Conversation">
            <Grid min={320} gap={4}>
              <Stack gap={3}>
                {searching ? (
                  <ChatSearch target="studio-messages" defaultQuery="release" onClose={() => setSearching(false)} />
                ) : (
                  <Button size="sm" icon="magnifying-glass" onClick={() => setSearching(true)}>
                    Search in conversation
                  </Button>
                )}
                <div id="studio-messages" style={{ height: 360 }}>
                  <MessageList messages={MESSAGES} currentUserId="me" timeZone="UTC" locale="en-US" />
                </div>
              </Stack>
              <Stack gap={3}>
                <Checkpoint label="Before refactor" time="09:12" dateTime="2026-11-25T09:12:00Z" description="Plan approved, no files changed" restored={restored === "refactor"} onRestore={() => setRestored("refactor")} />
                <Checkpoint label="Tests passing" time="09:48" dateTime="2026-11-25T09:48:00Z" restored={restored === "tests"} onRestore={() => setRestored("tests")} />
                <VoiceInput showLabel maxDuration={60} onSend={setRecording} />
                {recording ? <VoiceNote src={recordingUrl} duration={recording.duration} peaks={recording.peaks} /> : null}
              </Stack>
            </Grid>
          </PageSection>

          <PageSection title="Preview">
            <WebPreview defaultUrl={preview} title="Pricing preview" viewports />
          </PageSection>

          <PageSection title="Error">
            <StackTrace error={STACK} selectable />
          </PageSection>

          <PageSection title="Audio">
            <Stack gap={4}>
              <AudioPlayer src={audio || undefined} title="Release walkthrough" subtitle="Generated tone · 6 s" analyze />
              <Waveform duration={42} peaks={PEAKS} position={position} onSeek={setPosition} label="Seek interview" />
            </Stack>
          </PageSection>

          <PageSection title="Widgets">
            <DashboardGrid label="Studio widgets" layout={layout} onLayoutChange={setLayout} columns={12} rowHeight={88}>
              <Widget
                id="revenue"
                title="Revenue"
                description="Last 30 days"
                menu={[
                  { id: "refresh", label: "Refresh", icon: "arrow-path" },
                  { id: "remove", label: "Remove", icon: "trash", danger: true },
                ]}
              >
                <StatTile label="Revenue" value="$48.2k" />
              </Widget>
              <Widget id="signups" title="Sign-ups" status={signups} message="No sign-ups in this period" />
              <Widget id="errors" title="Errors" status={errors} onRetry={() => setErrors("ready")}>
                <StatTile label="Errors" value="3" />
              </Widget>
            </DashboardGrid>
          </PageSection>
        </Stack>
      </Container>
    </Page>
  );
}
