import { useState } from "react";
import { Icon } from "@zuccadev-labs/zuix-zicon/core";
import { Container, Grid, Page, PageHeader, PageSection, Stack } from "@zuccadev-labs/zuix-zout";
import {
  Avatar,
  Backdrop,
  Badge,
  BalanceCard,
  Button,
  Card,
  CardBanner,
  CardHeader,
  CategoryTile,
  Countdown,
  FeatureCard,
  IconButton,
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  MetricCard,
  ModelPicker,
  OfferCard,
  PaymentCard,
  PricingCard,
  PricingTable,
  ProductCard,
  PromptInput,
  Radio,
  RadioGroup,
  RangeHistogram,
  SegmentedControl,
  Slider,
  StatGroup,
  StatTile,
  Suggestions,
  UserCard,
  type PatternName,
} from "@zuccadev-labs/zuix-zui";
import dunes from "../../../../zudocs/static/img/carousel/dunes.svg";
import forest from "../../../../zudocs/static/img/carousel/forest.svg";
import glacier from "../../../../zudocs/static/img/carousel/glacier.svg";
import mist from "../../../../zudocs/static/img/carousel/mist.svg";
import ana from "../../../../zudocs/static/img/people/ana.svg";
import leo from "../../../../zudocs/static/img/people/leo.svg";
import mia from "../../../../zudocs/static/img/people/mia.svg";
import sam from "../../../../zudocs/static/img/people/sam.svg";

// Galería de tarjetas: materiales, portadas con patrón, producto, personas, ofertas, precios, finanzas, explorar y el
// panel de IA. Las fotos son las ilustraciones del sitio (zudocs/static/img); los retratos, ilustraciones propias.

const PATTERNS: { pattern: PatternName; tone?: "accent" | "info" | "success" | "warning" | "danger" | 3 | 5 | 7; title: string }[] = [
  { pattern: "stars", tone: "info", title: "Night sky" },
  { pattern: "triangles", tone: 5, title: "Triangles" },
  { pattern: "plus", tone: "info", title: "Crosses" },
  { pattern: "pixels", tone: 7, title: "Pixels" },
  { pattern: "contours", tone: "success", title: "Contour lines" },
  { pattern: "mesh", tone: 3, title: "Mesh gradient" },
  { pattern: "grain", tone: "accent", title: "Film grain" },
  { pattern: "halftone", tone: "warning", title: "Halftone" },
];

const NOW = Date.parse("2026-11-25T12:00:00Z");

export function CardsScreen() {
  const [model, setModel] = useState("aurora-3");
  const [auto, setAuto] = useState(false);
  const [multi, setMulti] = useState(false);
  const [temporary, setTemporary] = useState(true);
  const [quote, setQuote] = useState<string | null>("enhance user confidence in AI-driven responses");
  const [contexts, setContexts] = useState([{ id: "kickoff", label: "Project kickoff", icon: "video-camera" }]);
  const [place, setPlace] = useState("hotel");
  const [price, setPrice] = useState([150, 1200]);
  const [stars, setStars] = useState("5");
  const [saved, setSaved] = useState(false);
  const buckets = [2, 3, 5, 8, 12, 16, 22, 26, 30, 28, 24, 21, 18, 16, 13, 10, 8, 6, 5, 3, 2, 2, 1, 1];
  const bucketOf = (v: number) => Math.min(buckets.length - 1, Math.floor((v / 2000) * buckets.length));

  return (
    <Page label="Cards" width="full">
      <Container width="xl">
        <Stack gap={10}>
          <PageHeader title="Cards" description="Surfaces, covers with generated patterns and ready-made compositions." />

          <PageSection title="Surfaces" description="Plain, elevated, glass, tinted, neon and metal; with glow and grain.">
            <Grid min={220} gap={5} className="app-cards-grid">
              <Card>
                <CardHeader icon="square-2-stack" title="Plain" subtitle="The quiet default" />
              </Card>
              <Card surface="elevated" interactive>
                <CardHeader icon="chart-bar-square" title="Elevated" subtitle="Layered shadows, inner rim" href="#elevated" />
              </Card>
              <Card surface="glass">
                <CardHeader icon="sparkles" title="Glass" subtitle="Liquid glass material" />
              </Card>
              <Card surface="tinted" tone="info">
                <CardHeader icon="information-circle" title="Tinted" subtitle="Washed with its tone" />
              </Card>
              <Card surface="neon" tone="danger">
                <CardHeader icon="bolt" title="Neon" subtitle="Rim and halo of its tone" />
              </Card>
              <Card surface="metal" grain tone="accent">
                <CardHeader icon="credit-card" title="Metal" subtitle="Brushed fill with grain" />
              </Card>
            </Grid>
          </PageSection>

          <PageSection title="Pattern covers" description="Deterministic by seed: the same seed always draws the same cover.">
            <Grid min={220} gap={5} className="app-cards-grid">
              {PATTERNS.map((p, i) => (
                <FeatureCard
                  key={p.pattern}
                  pattern={p.pattern}
                  seed={i + 3}
                  tone={p.tone}
                  title={p.title}
                  description="Biometric sign-in keeps every account unique and safe."
                  href={`#pattern-${p.pattern}`}
                />
              ))}
            </Grid>
          </PageSection>

          <PageSection title="Products and stays">
            <Grid min={230} gap={5} className="app-cards-grid">
              <ProductCard
                tone="info"
                image={{ src: glacier, alt: "" }}
                title="Glacier shell jacket"
                subtitle="Wind-proof, packable"
                price={{ amount: 256, currency: "USD", locale: "en-US", trimZeros: true }}
                action={<Button variant="glass">Buy now</Button>}
                href="#glacier"
              />
              <ProductCard
                tone="warning"
                image={{ src: dunes, alt: "" }}
                title="Dune runner hoodie"
                subtitle="Organic cotton"
                price={{ amount: 128, previous: 160, currency: "USD", locale: "en-US", trimZeros: true }}
                badge={
                  <>
                    <Icon name="star" size={12} variant="solid" /> 4.96 · 18 reviews
                  </>
                }
                action={<Button variant="glass">Buy now</Button>}
                href="#dunes"
              />
              <ProductCard
                tone="success"
                image={{ src: forest, alt: "" }}
                title="Lake House, Canada"
                price={{ amount: 96, currency: "USD", locale: "en-US", unit: "/ night", trimZeros: true }}
                badge={
                  <>
                    <Icon name="star" size={12} variant="solid" /> 4.96 · 18 reviews
                  </>
                }
                corner={
                  <IconButton
                    variant="glass"
                    icon="heart"
                    label={saved ? "Remove from saved" : "Save"}
                    aria-pressed={saved}
                    onClick={() => setSaved(!saved)}
                  />
                }
                href="#lake"
              />
              <ProductCard
                layout="inset"
                image={{ src: mist, alt: "" }}
                title="Iceland Cabin"
                price={{ amount: 680, currency: "USD", locale: "en-US", unit: "per night", trimZeros: true }}
                subtitle="Cozy cabin with views of the mountains and the northern lights."
                action={
                  <Button variant="primary" size="lg">
                    Reserve
                  </Button>
                }
              >
                <StatGroup
                  items={[
                    { label: "Days", value: 3 },
                    { label: "Rating", value: "4.9" },
                  ]}
                />
              </ProductCard>
            </Grid>
          </PageSection>

          <PageSection title="People">
            <Stack gap={5}>
              <Grid min={300} gap={5} className="app-cards-grid">
                <UserCard
                  variant="profile"
                  user={{
                    name: "Sam Rivers",
                    role: "Photographer",
                    avatar: sam,
                    bio: "Based in Sydney, I capture landscapes and cultural moments across the globe.",
                  }}
                  stats={[
                    { label: "Countries", value: 28 },
                    { label: "Exhibitions", value: 10 },
                    { label: "Rating", value: "4.9" },
                  ]}
                  actions={
                    <>
                      <Button variant="primary">Explore portfolio</Button>
                      <Button>Message</Button>
                    </>
                  }
                />
                <UserCard
                  variant="compact"
                  user={{ name: "James Liu", role: "Frontend", avatar: mia, presence: "online" }}
                  action={<IconButton variant="primary" icon="paper-airplane" label="Message James Liu" />}
                />
              </Grid>
              <Grid min={170} gap={5} className="app-cards-grid">
                <UserCard variant="neon" tone="success" user={{ name: "Emma Reynolds", role: "Engineer", bio: "Vue.js expert", cover: ana }} href="#emma" />
                <UserCard variant="neon" tone="info" user={{ name: "Fuwad Muhammed", role: "Designer", bio: "Visually astute", cover: leo }} href="#fuwad" />
                <UserCard variant="neon" tone="danger" user={{ name: "Zainab Malik", role: "Marketing", bio: "Execution expert", cover: mia }} href="#zainab" />
                <UserCard variant="neon" tone="warning" user={{ name: "Ethan Thompson", role: "Accountant", bio: "Insightful analysis", cover: sam }} href="#ethan" />
              </Grid>
              <Grid min={170} gap={5} className="app-cards-grid">
                {[
                  { name: "Emily Carter", role: "UI/UX Designer", cover: ana },
                  { name: "Sofia Martínez", role: "Product Designer", cover: leo },
                  { name: "James Liu", role: "Frontend Developer", cover: mia },
                ].map((u) => (
                  <UserCard
                    key={u.name}
                    variant="portrait"
                    user={u}
                    status={
                      <Badge tone="success" dot>
                        Available
                      </Badge>
                    }
                    action={<IconButton variant="primary" icon="paper-airplane" label={`Message ${u.name}`} />}
                  />
                ))}
              </Grid>
            </Stack>
          </PageSection>

          <PageSection title="Offers">
            <Grid min={340} gap={5} className="app-cards-grid">
              <CardBanner
                tone="success"
                icon="clock"
                message={
                  <>
                    Closes in <Countdown to="2026-11-26T11:08:11Z" now={NOW} variant="inline" units={["hours", "minutes", "seconds"]} locale="en-US" />
                  </>
                }
              >
                <OfferCard
                  title="Web designer, part time"
                  avatar={{ name: "Amine Tiffrent", src: leo }}
                  meta={[{ icon: "globe-alt", label: "Remote-friendly" }]}
                  tags={
                    <Badge tone="warning" icon="bolt">
                      New job
                    </Badge>
                  }
                  aside="$20/hour"
                  description="We're looking for a detail-driven web designer to bring a bilingual healthcare site to life: clean, engaging and user-first."
                  actions={
                    <>
                      <Button icon="paper-airplane">View details</Button>
                      <Button icon="bookmark">Save job</Button>
                      <Button variant="outline" icon="information-circle">
                        About the hirer
                      </Button>
                    </>
                  }
                />
              </CardBanner>
              <CardBanner tone="info" position="top" icon="clock" message="Available now, open to new projects">
                <OfferCard
                  title="Amine Tiffrent"
                  avatar={{ name: "Amine Tiffrent", src: sam }}
                  meta={[{ icon: "map-pin", label: "Algiers" }]}
                  tags={
                    <>
                      <Badge tone="warning" icon="trophy">
                        Top rated
                      </Badge>
                      <Badge tone="info" icon="check-badge">
                        Verified
                      </Badge>
                    </>
                  }
                  aside="$20/hour"
                  description="Web designer focused on clean layouts, responsive design and seamless user experiences."
                  actions={
                    <>
                      <Button variant="primary" icon="paper-airplane">
                        Message
                      </Button>
                      <Button icon="user">See profile</Button>
                    </>
                  }
                />
              </CardBanner>
              <OfferCard
                title="Landing page designer"
                meta={[{ icon: "bookmark", label: "Saved 2 days ago" }]}
                tags={
                  <>
                    <Badge tone="success" icon="banknotes">
                      $600
                    </Badge>
                    <Badge tone="info" icon="clock">
                      1 week
                    </Badge>
                  </>
                }
                description="A clean, modern landing page for a dental SaaS product. Must be mobile-first."
                actions={
                  <>
                    <Button variant="primary" icon="paper-airplane">
                      Apply
                    </Button>
                    <Button variant="danger" icon="trash">
                      Remove
                    </Button>
                  </>
                }
              />
            </Grid>
          </PageSection>

          <PageSection title="Pricing">
            <PricingTable label="Plans" seed={11}>
              <PricingCard
                tone="success"
                name="Basic"
                price={{ amount: 29, currency: "USD", locale: "en-US", period: "/ month" }}
                features={[{ label: "3 projects" }, { label: "Community support" }, { label: "Custom brands", included: false }, { label: "Audit log", included: false }]}
                action={<Button>Choose Basic</Button>}
              />
              <PricingCard
                featured
                badge="Most popular"
                tone="info"
                name="Professional"
                price={{ amount: 39, currency: "USD", locale: "en-US", period: "/ month" }}
                features={[{ label: "Unlimited projects" }, { label: "Priority support" }, { label: "Custom brands" }, { label: "Audit log", included: false }]}
                action={<Button variant="primary">Choose Professional</Button>}
              />
              <PricingCard
                tone={5}
                name="Business"
                price={{ amount: 49, currency: "USD", locale: "en-US", period: "/ month" }}
                features={[{ label: "Unlimited projects" }, { label: "Dedicated support" }, { label: "Custom brands" }, { label: "Audit log" }]}
                action={<Button>Choose Business</Button>}
              />
            </PricingTable>
          </PageSection>

          <PageSection title="Finance">
            <Grid min={300} gap={5} className="app-cards-grid">
              <BalanceCard
                label="Total balance"
                value={84250.8}
                currency="USD"
                locale="en-US"
                delta={0.0842}
                deltaText="+$6,540.20 this month"
                trend={[42, 44, 41, 47, 46, 52, 50, 55, 58, 57, 63, 66, 71]}
                header={
                  <>
                    <span className="app-balance-owner">
                      <Avatar size="sm" name="Ana Ruiz" src={ana} alt="" />
                      Ana Ruiz
                    </span>
                    <IconButton variant="glass" icon="bell" label="Notifications" />
                  </>
                }
                actions={[
                  { id: "send", label: "Send", icon: "arrow-up-tray" },
                  { id: "request", label: "Request", icon: "arrow-down-tray" },
                  { id: "top-up", label: "Top up", icon: "plus" },
                  { id: "more", label: "More", icon: "ellipsis-horizontal" },
                ]}
              />
              <Stack gap={5}>
                <PaymentCard issuer="zuix bank" holder="Ana Ruiz" last4="4242" expires="08/29" tone="accent" />
                <Grid min={140} gap={3}>
                  <StatTile variant="elevated" layout="stacked" tone="success" icon="banknotes" label="Income" value="$12,850" />
                  <StatTile variant="elevated" layout="stacked" tone="danger" icon="credit-card" label="Expenses" value="$5,420" />
                  <StatTile variant="elevated" layout="stacked" tone="info" icon="building-library" label="Savings" value="$7,430" />
                </Grid>
              </Stack>
              <Card surface="elevated" padding="none" className="app-spending">
                <Backdrop pattern="halftone" seed={4} fade="radial" intensity="strong" className="app-spending__art">
                  <div className="app-spending__body">
                    <CardHeader title="Monthly spending" subtitle="August" />
                    <p className="app-spending__value">$5.1k</p>
                  </div>
                </Backdrop>
              </Card>
              <MetricCard
                label="Savings rate"
                value={0.31}
                format={{ style: "percent" }}
                previous={0.27}
                period="last month"
                trend={[0.2, 0.22, 0.24, 0.23, 0.27, 0.29, 0.31]}
                locale="en-US"
              />
            </Grid>
          </PageSection>

          <PageSection title="Explore">
            <Grid min={320} gap={5} className="app-cards-grid">
              <Card surface="elevated" padding="none" className="app-explore">
                <Backdrop pattern="mesh" seed={21} intensity="strong" fade="bottom" className="app-explore__hero">
                  <div className="app-explore__hello">
                    <p>Hello, Emily</p>
                    <h3>Explore</h3>
                  </div>
                </Backdrop>
                <div className="app-explore__body">
                  <InputGroup size="lg">
                    <InputGroupAddon>
                      <Icon name="magnifying-glass" />
                    </InputGroupAddon>
                    <InputGroupInput aria-label="Destination" placeholder="Enter destination" />
                    <InputGroupAddon align="inline-end">
                      <IconButton icon="adjustments-horizontal" label="Filters" size="sm" />
                    </InputGroupAddon>
                  </InputGroup>
                  <Grid min={130} gap={3}>
                    <CategoryTile href="#hotels" icon="building-office" title="Hotels" count="1.4k" tone="accent" />
                    <CategoryTile href="#rooms" icon="home-modern" title="Rooms" count="42.6k" tone="success" />
                  </Grid>
                </div>
              </Card>
              <Card surface="elevated" padding="lg" className="app-filters">
                <CardHeader title="Filters" action={<IconButton icon="x-mark" label="Close filters" />} />
                <p className="app-filters__row" id="place-label">
                  Type of place
                </p>
                <RadioGroup aria-labelledby="place-label" variant="card" orientation="horizontal" value={place} onValueChange={setPlace} className="app-filters__places">
                  <Radio value="hotel">
                    <Icon name="building-office" size={18} /> Hotel
                  </Radio>
                  <Radio value="rooms">
                    <Icon name="home-modern" size={18} /> Rooms
                  </Radio>
                  <Radio value="condo">
                    <Icon name="building-office-2" size={18} /> Condo
                  </Radio>
                </RadioGroup>
                <div className="app-filters__price">
                  <p className="app-filters__row">
                    <span>Price range</span>
                    <strong>
                      ${price[0]} – ${price[1]!.toLocaleString("en-US")}
                    </strong>
                  </p>
                  <RangeHistogram values={buckets} selected={[bucketOf(price[0]!), bucketOf(price[1]!)]} />
                  <Slider min={0} max={2000} step={50} value={price} onValueChange={setPrice} thumbLabels={["Minimum price", "Maximum price"]} />
                </div>
                <div className="app-filters__row app-filters__stack">
                  <span aria-hidden="true">Hotel class</span>
                  <SegmentedControl
                    label="Hotel class"
                    fullWidth
                    value={stars}
                    onValueChange={setStars}
                    items={["5", "4", "3", "2"].map((n) => ({ value: n, label: n, ariaLabel: `${n} stars`, icon: "star" as const }))}
                  />
                </div>
                <div className="app-filters__actions">
                  <Button variant="ghost">Clear all</Button>
                  <Button variant="primary" size="lg">
                    Show 500+ places
                  </Button>
                </div>
              </Card>
            </Grid>
          </PageSection>

          <PageSection title="Assistant" description="Quoted context, keyboard hints, model menu, drop zone and recording.">
            <Grid min={340} gap={6} className="app-cards-grid">
              <Card surface="elevated" padding="lg" className="app-ai">
                <CardHeader
                  title="New AI chat"
                  subtitle={
                    <Badge icon="lock-closed" variant="outline">
                      Private
                    </Badge>
                  }
                  action={
                    <>
                      <Button size="sm" variant="outline">
                        Share
                      </Button>
                      <IconButton icon="x-mark" label="Close chat" />
                    </>
                  }
                />
                <Suggestions
                  id="cd-suggestions"
                  layout="list"
                  hints
                  label="Follow-up questions"
                  items={["How should AI show uncertainty?", "Which UI elements build trust in AI responses?", "What signals make AI responses feel reliable?"]}
                />
                <PromptInput
                  id="cd-prompt"
                  placeholder="Ask anything"
                  quote={quote ? { text: quote } : undefined}
                  onQuoteRemove={() => setQuote(null)}
                  contexts={contexts}
                  onContextRemove={({ id }) => setContexts((list) => list.filter((c) => c.id !== id))}
                  voice
                  models={[
                    { id: "aurora-3", label: "Aurora 3" },
                    { id: "aurora-3-mini", label: "Aurora 3 mini" },
                  ]}
                />
              </Card>
              <Stack gap={6}>
                <PromptInput halo placeholder="Get a detailed report…" contexts={[{ id: "onboarding", label: "Onboarding meeting", icon: "calendar-days" }]} />
                <div className="app-model">
                  <ModelPicker
                    className="cd-model"
                    value={model}
                    onValueChange={setModel}
                    options={[
                      { id: "auto", label: "Auto", checked: auto },
                      { id: "multi", label: "Multiple models", checked: multi },
                    ]}
                    onToggle={({ id, checked }) => {
                      if (id === "auto") setAuto(checked);
                      if (id === "multi") setMulti(checked);
                      if (id === "temporary") setTemporary(checked);
                    }}
                    models={[
                      { id: "aurora-3", label: "Aurora 3", icon: "sparkles", badge: "Beta" },
                      { id: "aurora-2", label: "Aurora 2.5 Flash", icon: "bolt" },
                      { id: "orbit", label: "Orbit 5", icon: "cpu-chip" },
                    ]}
                    more={[
                      { id: "orbit-instant", label: "Orbit 5 Instant", icon: "cpu-chip" },
                      { id: "orbit-thinking", label: "Orbit 5 Thinking", icon: "light-bulb" },
                      { id: "nova", label: "Nova 4", icon: "sparkles", badge: "Soon", disabled: true },
                    ]}
                    toggles={[{ id: "temporary", label: "Temporary chat", icon: "clock", checked: temporary }]}
                  />
                </div>
                <PromptInput
                  ref={(el) => {
                    if (el) el.dataset.drop = "";
                  }}
                  placeholder="Ask a follow-up"
                />
              </Stack>
            </Grid>
          </PageSection>
        </Stack>
      </Container>
    </Page>
  );
}
