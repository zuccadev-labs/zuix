// Textos de zout en Deutsch. Mismas claves que ./en.
import type { LocaleMessages, LocalePack } from "@zuccadev-labs/zuix-zui";
import type { ZoutMessages } from "./en";

const messages: LocaleMessages<ZoutMessages> = {
  chatLayout: { list: "Chats", conversation: "Unterhaltung", details: "Details", launcher: "Chat öffnen", close: "Chat schließen" },
  docsLayout: { nav: "Dokumentation", toc: "Auf dieser Seite", onThisPage: "Auf dieser Seite", previous: "Zurück", next: "Weiter", pager: "Seiten" },
};

const de: LocalePack<typeof messages> = { id: "de", messages, same: ["chatLayout.list", "chatLayout.details"] };
export default de;
