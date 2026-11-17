import { useMemo, useState } from "react";
import { Page, PageHeader, PageSection } from "@zuccadev-labs/zuix-zout";
import { Badge, Button, Card, CardFooter, CardHeader, Carousel, Progress } from "@zuccadev-labs/zuix-zui";
import { PROJECTS, STATUS_LABEL, STATUS_TONE, type Brand, type Project, type Theme } from "../data";
import { COVER_HEIGHT, COVER_WIDTH, drawCover } from "../raster";

const ITEMS = PROJECTS.slice(0, 6);

export function Gallery({ theme, brand }: { theme: Theme; brand: Brand }) {
  const [cssIndex, setCssIndex] = useState(0);
  const [glIndex, setGlIndex] = useState(0);
  const [flatIndex, setFlatIndex] = useState(0);
  const [opened, setOpened] = useState("none");

  // Las portadas se redibujan con los tokens del tema y la marca activos.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `theme` y `brand` no se leen dentro, pero cambian los tokens CSS que `drawCover` lee del documento; son el disparador del redibujado.
  const covers = useMemo(() => {
    const map = new Map<string, { canvas: HTMLCanvasElement; url: string }>();
    ITEMS.forEach((project, index) => {
      const canvas = drawCover(project, index);
      map.set(project.id, { canvas, url: canvas.toDataURL("image/png") });
    });
    return map;
  }, [theme, brand]);

  return (
    <Page header={<PageHeader eyebrow="Components" title="Gallery" description="The carousel in its three drawing modes: CSS lens, WebGL lens and flat." />}>
      <PageSection title="Featured projects" description="CSS mode: real slides warped with transforms. Drag, use the arrows or the keyboard.">
        <Carousel
          data-testid="carousel-css"
          ariaLabel="Featured projects"
          items={ITEMS}
          getKey={(project) => project.id}
          onIndexChange={setCssIndex}
          renderItem={(project: Project, _index, { active, clone }) => (
            <Card className="app-slide" variant={active ? "elevated" : "outlined"}>
              <CardHeader title={project.name} subtitle={project.owner} action={<Badge tone={STATUS_TONE[project.status]}>{STATUS_LABEL[project.status]}</Badge>} />
              <p className="app-text">{project.summary}</p>
              <Progress value={project.progress} label={`${project.name} completion`} size="sm" showValue />
              <CardFooter align="end">
                <Button size="sm" tabIndex={clone ? -1 : undefined} onClick={() => setOpened(project.id)}>Open</Button>
              </CardFooter>
            </Card>
          )}
        />
        <span className="app-muted">Active slide: <output data-testid="carousel-css-index">{cssIndex}</output> · Opened: <output data-testid="carousel-css-opened">{opened}</output></span>
      </PageSection>

      <PageSection title="Covers" description="WebGL mode: the curved zones are drawn on a canvas from the raster of each slide.">
        <Carousel
          key={`${theme}-${brand}`}
          data-testid="carousel-gl"
          ariaLabel="Project covers"
          items={ITEMS}
          getKey={(project) => project.id}
          slideWidth={320}
          onIndexChange={setGlIndex}
          rasterize={(project) => covers.get(project.id)!.canvas}
          renderItem={(project: Project) => (
            <img className="app-cover" src={covers.get(project.id)!.url} width={COVER_WIDTH} height={COVER_HEIGHT} alt={`${project.name} cover`} draggable={false} />
          )}
        />
        <span className="app-muted">Active slide: <output data-testid="carousel-gl-index">{glIndex}</output></span>
      </PageSection>

      <PageSection title="Flat" description="No lens and no loop.">
        <Carousel
          data-testid="carousel-flat"
          ariaLabel="Project list"
          effect="none"
          loop={false}
          items={ITEMS}
          getKey={(project) => project.id}
          slideWidth={260}
          onIndexChange={setFlatIndex}
          renderItem={(project: Project) => (
            <Card className="app-slide" variant="filled">
              <CardHeader title={project.name} subtitle={project.owner} />
              <p className="app-text">{project.summary}</p>
            </Card>
          )}
        />
        <span className="app-muted">Active slide: <output data-testid="carousel-flat-index">{flatIndex}</output></span>
      </PageSection>
    </Page>
  );
}
