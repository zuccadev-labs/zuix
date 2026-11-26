// Tarjetas de la 0.5 con foto: las ilustraciones del sitio (static/img/carousel) y los retratos propios
// (static/img/people) en lugar de las rutas de ejemplo del contrato.
import useBaseUrl from "@docusaurus/useBaseUrl";
import { Badge, Button, IconButton, ProductCard, PromptInput, StatGroup, Suggestions, UserCard } from "@zuccadev-labs/zuix-zui";
import { useState } from "react";
import { type ExampleDemos, usePhoto } from "./shared";

/** Retratos propios del sitio, por nombre. */
function usePeople() {
  const base = useBaseUrl("/img/people/");
  return { ana: `${base}ana.svg`, leo: `${base}leo.svg`, mia: `${base}mia.svg`, sam: `${base}sam.svg` };
}

export const cards: Record<string, ExampleDemos> = {
  ProductCard: {
    "A sangre con precio y CTA de cristal": () => {
      const photo = usePhoto();
      return (
        <div className="zd-demo-card-slot">
          <ProductCard
            tone="info"
            image={{ src: photo.glacier.src, alt: "" }}
            title="Glacier shell jacket"
            subtitle="Wind-proof, packable"
            price={{ amount: 256, currency: "USD", locale: "en-US", trimZeros: true }}
            action={<Button variant="glass">Buy now</Button>}
            href="#glacier"
          />
        </div>
      );
    },
    "Alojamiento con valoración y favorito": () => {
      const photo = usePhoto();
      return (
        <div className="zd-demo-card-slot">
          <ProductCard
            tone="success"
            image={{ src: photo.forest.src, alt: "" }}
            title="Lake House, Canada"
            price={{ amount: 96, currency: "USD", locale: "en-US", unit: "/ night", trimZeros: true }}
            badge="4.96 · 18 reviews"
            corner={<IconButton variant="glass" icon="heart" label="Save" />}
          />
        </div>
      );
    },
    "Inset con datos y reserva": () => {
      const photo = usePhoto();
      return (
        <div className="zd-demo-card-slot">
          <ProductCard
            layout="inset"
            image={{ src: photo.mist.src, alt: "" }}
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
        </div>
      );
    },
  },
  UserCard: {
    "Perfil limpio": () => {
      const people = usePeople();
      return (
        <UserCard
          variant="profile"
          user={{
            name: "Sam Rivers",
            role: "Photographer",
            avatar: people.sam,
            bio: "Based in Sydney, I capture landscapes across the globe.",
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
      );
    },
    Neón: () => {
      const people = usePeople();
      return (
        <div className="zd-demo-card-slot" data-size="sm">
          <UserCard
            variant="neon"
            tone="danger"
            user={{ name: "Zainab Malik", role: "Marketing", bio: "Execution expert", cover: people.mia }}
            href="#zainab"
          />
        </div>
      );
    },
    "Retrato disponible": () => {
      const people = usePeople();
      return (
        <div className="zd-demo-card-slot" data-size="sm">
          <UserCard
            variant="portrait"
            user={{ name: "Emily Carter", role: "UI/UX Designer", cover: people.ana }}
            status={
              <Badge tone="success" dot>
                Available
              </Badge>
            }
            action={<IconButton variant="primary" icon="paper-airplane" label="Message Emily Carter" />}
          />
        </div>
      );
    },
  },
  PromptInput: {
    "Cita y contexto": () => {
      const [quote, setQuote] = useState<string | null>("enhance user confidence in AI-driven responses");
      const [contexts, setContexts] = useState([{ id: "kickoff", label: "Project kickoff", icon: "video-camera" }]);
      return (
        <div className="zd-demo-wide">
          <PromptInput
            quote={quote ? { text: quote } : undefined}
            onQuoteRemove={() => setQuote(null)}
            contexts={contexts}
            onContextRemove={({ id }) => setContexts((list) => list.filter((c) => c.id !== id))}
            models={[{ id: "aurora-3", label: "Aurora 3" }]}
          />
        </div>
      );
    },
  },
  Suggestions: {
    "Lista con pistas de teclado": () => (
      <div className="zd-demo-wide">
        <Suggestions
          layout="list"
          hints
          label="Follow-up questions"
          items={["How should AI show uncertainty?", "Which UI elements build trust?"]}
        />
      </div>
    ),
  },
};
