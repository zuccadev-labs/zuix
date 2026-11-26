// Textos de zout en français. Mismas claves que ./en.
import type { LocaleMessages, LocalePack } from "@zuccadev-labs/zuix-zui";
import type { ZoutMessages } from "./en";

const messages: LocaleMessages<ZoutMessages> = {
  chatLayout: { list: "Discussions", conversation: "Conversation", details: "Détails", launcher: "Ouvrir la discussion", close: "Fermer la discussion" },
  docsLayout: { nav: "Documentation", toc: "Sur cette page", onThisPage: "Sur cette page", previous: "Précédent", next: "Suivant", pager: "Pages" },
};

const fr: LocalePack<typeof messages> = { id: "fr", messages, same: ["chatLayout.conversation", "docsLayout.nav", "docsLayout.pager"] };
export default fr;
