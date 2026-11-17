// La página de resultados del buscador local no tiene región principal (<main>) y su campo lleva
// aria-label="Search" sin traducir. Se corrigen tras montar, sin copiar el componente del plugin.
import { translate } from "@docusaurus/Translate";
import SearchPage from "@theme-original/SearchPage";
import { type ComponentProps, useEffect } from "react";

export default function SearchPageWrapper(props: ComponentProps<typeof SearchPage>) {
  const label = translate({
    id: "theme.SearchBar.label",
    message: "Search",
    description: "The ARIA label and placeholder for search button",
  });
  useEffect(() => {
    const input = document.querySelector<HTMLInputElement>('input[type="search"][name="q"]');
    input?.setAttribute("aria-label", label);
    input?.closest(".container")?.setAttribute("role", "main");
  });
  return <SearchPage {...props} />;
}
