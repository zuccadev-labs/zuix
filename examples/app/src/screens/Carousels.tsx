import { useState } from "react";
import { Grid, Page, PageHeader, PageSection } from "@zuccadev-labs/zuix-zout";
import { Button, Card, CardHeader, Carousel, Gallery, Skeleton, SkeletonGroup, Stories } from "@zuccadev-labs/zuix-zui";

// Imágenes de muestra generadas aquí (degradados SVG): las pruebas no dependen de archivos externos.
const HUES = [
  ["#0b1026", "#3fd0b6"],
  ["#3a1d3f", "#f6c27a"],
  ["#5f93c9", "#dff3ff"],
  ["#0f2a22", "#a8d88a"],
  ["#1a1033", "#f08a5d"],
  ["#03243f", "#5fe0d6"],
];
const art = (i: number) => {
  const [a, b] = HUES[i % HUES.length]!;
  return `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 100"><defs><linearGradient id="g" x2="0" y2="1"><stop stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="160" height="100" fill="url(#g)"/></svg>`,
  )}`;
};
const PHOTOS = HUES.map((_, i) => ({ id: `p${i}`, src: art(i), alt: `Gradient ${i + 1}`, title: `Scene ${i + 1}` }));

export function CarouselsScreen() {
  const [prismIndex, setPrismIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  return (
    <Page>
      <PageHeader title="Carousels" description="Prism, Material 3 layouts, stack, stories, gallery and skeletons." />
      <PageSection title="Prism">
        <div data-testid="c-prism">
          <Carousel
            ariaLabel="Prism"
            effect="prism"
            items={PHOTOS}
            getKey={(p) => p.id}
            onIndexChange={setPrismIndex}
            indicators="dots"
            renderItem={(p) => (
              <>
                <img className="z-carousel__media" src={p.src} alt={p.alt} />
                <div className="z-carousel__caption">{p.title}</div>
              </>
            )}
          />
        </div>
        <p className="app-muted" data-testid="c-prism-index">
          Index {prismIndex}
        </p>
      </PageSection>
      <PageSection title="Autoplay with progress">
        <div data-testid="c-progress">
          <Carousel
            ariaLabel="Progress"
            effect="coverflow"
            autoplay={1500}
            indicators="progress"
            items={PHOTOS}
            getKey={(p) => p.id}
            renderItem={(p) => <img className="z-carousel__media" src={p.src} alt={p.alt} />}
          />
        </div>
      </PageSection>
      <PageSection title="Multi-browse">
        <div data-testid="c-browse">
          <Carousel
            ariaLabel="Multi-browse"
            layout="multi-browse"
            effect="none"
            loop={false}
            indicators="dots"
            items={PHOTOS}
            getKey={(p) => p.id}
            renderItem={(p) => <img className="z-carousel__media" src={p.src} alt={p.alt} />}
          />
        </div>
      </PageSection>
      <PageSection title="Stack">
        <div data-testid="c-stack" className="app-narrow">
          <Carousel
            ariaLabel="Steps"
            layout="stack"
            loop={false}
            items={["One", "Two", "Three"]}
            renderItem={(s) => (
              <Card>
                <CardHeader title={`Step ${s}`} subtitle="Swipe or use the arrows" />
              </Card>
            )}
          />
        </div>
      </PageSection>
      <PageSection title="Stories">
        <div data-testid="c-stories">
          <Stories
            ariaLabel="Team stories"
            duration={1000}
            groups={[
              {
                id: "ana",
                author: { name: "Ana", avatar: art(0) },
                items: PHOTOS.slice(0, 2).map((p) => ({ id: p.id, media: p.src, alt: p.alt })),
              },
              { id: "leo", author: { name: "Leo" }, items: PHOTOS.slice(2, 5).map((p) => ({ id: p.id, media: p.src, alt: p.alt })) },
            ]}
          />
        </div>
      </PageSection>
      <PageSection title="Gallery">
        <div data-testid="c-gallery">
          <Gallery ariaLabel="Gallery" items={PHOTOS.map((p) => ({ src: p.src, alt: p.alt, caption: p.title, width: 160, height: 100 }))} />
        </div>
      </PageSection>
      <PageSection title="Skeletons">
        <Button size="sm" data-testid="c-skeleton-toggle" onClick={() => setLoading((v) => !v)}>
          {loading ? "Load" : "Reset"}
        </Button>
        <SkeletonGroup data-testid="c-skeletons" busy={loading}>
          <Grid min="240px" gap={4}>
            {loading ? (
              <>
                <Skeleton.Card />
                <Skeleton.List rows={3} />
                <Skeleton pattern="chart" type="donut" />
              </>
            ) : (
              <Card>
                <CardHeader title="Loaded" subtitle="The content arrived" />
              </Card>
            )}
            <div>
              <Skeleton loading={loading}>
                <Button data-testid="c-skeleton-wrapped">Save changes</Button>
              </Skeleton>
            </div>
          </Grid>
        </SkeletonGroup>
      </PageSection>
    </Page>
  );
}
