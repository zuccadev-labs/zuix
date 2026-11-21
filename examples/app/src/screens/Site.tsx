import { useState } from "react";
import {
  BottomNavigation,
  Grid,
  NavigationMenu,
  Navbar,
  Page,
  PageHeader,
  PageSection,
  SiteFooter,
  SkipLink,
  Stack,
} from "@zuccadev-labs/zuix-zout";
import {
  AttentionRing,
  Backdrop,
  BorderBeam,
  Button,
  Card,
  CardHeader,
  DOT_PATTERNS,
  DotMatrix,
  Glow,
  Spinner,
  TextEffect,
} from "@zuccadev-labs/zuix-zui";

const MENU = [
  {
    label: "Products",
    columns: 2 as const,
    links: [
      { label: "Analytics", href: "#analytics", icon: "chart-bar" as const, description: "Events, funnels and retention." },
      { label: "Storage", href: "#storage", icon: "circle-stack" as const, description: "Buckets with versioning." },
      { label: "Functions", href: "#functions", icon: "bolt" as const, description: "Run code close to your users." },
      { label: "Auth", href: "#auth", icon: "key" as const, description: "Passkeys and single sign-on." },
    ],
  },
  {
    label: "Resources",
    links: [
      { label: "Docs", href: "#docs", icon: "book" as const, description: "Guides and API reference." },
      { label: "Changelog", href: "#changelog", icon: "newspaper" as const },
    ],
  },
  { label: "Pricing", href: "#pricing", current: true },
];

/** Oleada 6: navegación de sitio, cargadores y efectos. */
export function Site() {
  const [tab, setTab] = useState("home");
  const [beam, setBeam] = useState(false);
  return (
    <Page>
      <PageHeader title="Site" description="Site navigation, loaders and effects." />
      <PageSection title="Navbar">
        <Stack gap={4}>
          <SkipLink target="site-main" data-testid="s-skip">
            Skip to content
          </SkipLink>
          <div data-testid="s-navbar">
            <Navbar
              id="s-nav"
              position="static"
              brand={<a href="#home">Acme</a>}
              items={MENU}
              actions={
                <Button variant="primary" size="sm">
                  Get started
                </Button>
              }
            />
          </div>
          <div data-testid="s-dock">
            <Navbar
              id="s-dock"
              variant="dock"
              position="static"
              brand={<a href="#home">Acme</a>}
              items={[
                { label: "Docs", href: "#docs", current: true },
                { label: "Blog", href: "#blog" },
              ]}
            />
          </div>
          <div data-testid="s-navmenu">
            <NavigationMenu id="s-menu" items={MENU} label="Products" />
          </div>
        </Stack>
      </PageSection>
      <PageSection title="Loaders">
        <div id="site-main" data-testid="s-main">
          <Stack gap={4}>
            <div className="app-row">
              <Spinner shape="dots" />
              <Spinner shape="bars" />
            </div>
            <div className="app-row" data-testid="s-dots">
              {DOT_PATTERNS.map((p) => (
                <DotMatrix key={p} pattern={p} framed label={`Loading ${p}`} />
              ))}
            </div>
          </Stack>
        </div>
      </PageSection>
      <PageSection title="Effects">
        <Grid min="240px" gap={4}>
          <Backdrop pattern="hex" data-testid="s-backdrop">
            <Card variant="outlined">
              <CardHeader title="Backdrop" subtitle="Hexagons behind glass." />
            </Card>
          </Backdrop>
          <BorderBeam paused={beam} data-testid="s-beam">
            <Card>
              <CardHeader
                title="BorderBeam"
                subtitle="Beam around the border."
                action={
                  <Button size="sm" onClick={() => setBeam((b) => !b)}>
                    {beam ? "Play" : "Pause"}
                  </Button>
                }
              />
            </Card>
          </BorderBeam>
          <Glow variant="both" data-testid="s-glow">
            <Card>
              <CardHeader title="Glow" subtitle="Follows the pointer." />
            </Card>
          </Glow>
          <Card>
            <AttentionRing data-testid="s-attention">
              <Button icon="bell">Inbox</Button>
            </AttentionRing>
          </Card>
        </Grid>
        <TextEffect as="p" data-testid="s-text">
          Interfaces that feel native
        </TextEffect>
        <TextEffect effect="gradient">One standard, any brand</TextEffect>
      </PageSection>
      <PageSection title="Bottom navigation and footer">
        <Stack gap={4}>
          <div data-testid="s-bottomnav">
            <BottomNavigation
              position="static"
              value={tab}
              onValueChange={setTab}
              items={[
                { value: "home", label: "Home", icon: "home" },
                { value: "search", label: "Search", icon: "magnifying-glass" },
                { value: "inbox", label: "Inbox", icon: "inbox", badge: 3, badgeLabel: "3 unread" },
                { value: "profile", label: "Profile", icon: "user-circle" },
              ]}
            />
            <p data-testid="s-tab">{tab}</p>
          </div>
          <SiteFooter
            brand="Acme"
            tagline="Interfaces that feel native, on any brand."
            social={[{ label: "Contact", href: "#contact", icon: "envelope" }]}
            columns={[
              { title: "Product", links: [{ label: "Pricing", href: "#pricing" }] },
              { title: "Company", links: [{ label: "About", href: "#about" }] },
            ]}
            legal="© 2026 Acme Inc."
          />
        </Stack>
      </PageSection>
    </Page>
  );
}
