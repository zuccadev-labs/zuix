import { useMemo, useState } from "react";
import Layout from "@theme/Layout";
import { Icon, type IconName, type IconVariant } from "@zuccadev-labs/zuix-zicon/core";
import manifest from "@zuccadev-labs/zuix-zicon/manifest.json";
import { SearchInput, SegmentedControl, Select } from "@zuccadev-labs/zuix-zui";

const categories = manifest.categories as Record<string, { en: string; es: string }>;

export default function Icons() {
  const [query, setQuery] = useState("");
  const [variant, setVariant] = useState<IconVariant>("outline");
  const [category, setCategory] = useState("");
  const [copied, setCopied] = useState("");
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return manifest.icons.filter((i) => (!category || i.category === category) && (!q || i.name.includes(q) || i.keywords.some((k) => k.toLowerCase().includes(q))));
  }, [query, category]);
  const copy = (name: string) => {
    void navigator.clipboard?.writeText(`<Icon name="${name}" />`);
    setCopied(name);
    setTimeout(() => setCopied((c) => (c === name ? "" : c)), 1200);
  };
  return (
    <Layout title="Iconos" description="Zicon: iconos de la suite">
      <main className="zd-page z-root">
        <div className="zd-wrap">
          <header>
            <h1>Iconos</h1>
            <p className="zd-sub">{manifest.count} iconos en dos variantes. Busca por forma o por concepto, en español o inglés. Un clic copia el JSX.</p>
            <div className="zd-toolbar">
              <SearchInput value={query} onValueChange={setQuery} placeholder="buscar, delete, ajustes…" aria-label="Buscar iconos" />
              <SegmentedControl label="Variante" value={variant} onValueChange={(v) => setVariant(v as IconVariant)} items={[{ value: "outline", label: "Outline" }, { value: "solid", label: "Solid" }]} />
              <Select aria-label="Categoría" block={false} value={category || "all"} onValueChange={(v) => setCategory(v === "all" ? "" : v)} options={[{ value: "all", label: "Todas las categorías" }, ...Object.entries(categories).map(([value, l]) => ({ value, label: l.es }))]} />
              <span className="zd-mono" aria-live="polite">{shown.length} resultados</span>
            </div>
          </header>
          <div className="zd-icons">
            {shown.map((i) => (
              <button key={i.name} type="button" className="zd-icon" title={i.keywords.join(", ")} data-copied={copied === i.name || undefined} onClick={() => copy(i.name)}>
                <Icon name={i.name as IconName} variant={variant} size={24} />
                <span className="zd-icon__name">{copied === i.name ? "copiado" : i.name}</span>
              </button>
            ))}
          </div>
        </div>
      </main>
    </Layout>
  );
}
