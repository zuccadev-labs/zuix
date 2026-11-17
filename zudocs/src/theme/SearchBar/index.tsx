// El buscador local escribe aria-label="Search" a mano, sin pasar por las traducciones. Aquí se corrige
// tras montar: el nombre accesible del campo sale de la misma clave que su texto de ayuda.
import { translate } from "@docusaurus/Translate";
import SearchBar from "@theme-original/SearchBar";
import { type ComponentProps, useEffect, useRef } from "react";

export default function SearchBarWrapper(props: ComponentProps<typeof SearchBar>) {
  const ref = useRef<HTMLSpanElement>(null);
  const label = translate({
    id: "theme.SearchBar.label",
    message: "Search",
    description: "The ARIA label and placeholder for search button",
  });
  useEffect(() => {
    ref.current?.querySelector("input")?.setAttribute("aria-label", label);
  });
  return (
    <span ref={ref} style={{ display: "contents" }}>
      <SearchBar {...props} />
    </span>
  );
}
