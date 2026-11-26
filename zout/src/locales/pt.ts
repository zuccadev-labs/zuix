// Textos de zout en português. Mismas claves que ./en.
import type { LocaleMessages, LocalePack } from "@zuccadev-labs/zuix-zui";
import type { ZoutMessages } from "./en";

const messages: LocaleMessages<ZoutMessages> = {
  chatLayout: { list: "Conversas", conversation: "Conversa", details: "Detalhes", launcher: "Abrir conversa", close: "Fechar conversa" },
  docsLayout: { nav: "Documentação", toc: "Nesta página", onThisPage: "Nesta página", previous: "Anterior", next: "Próxima", pager: "Páginas" },
};

const pt: LocalePack<typeof messages> = { id: "pt", messages };
export default pt;
