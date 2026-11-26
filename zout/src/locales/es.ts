// Textos de zout en español. Mismas claves que ./en.
import type { LocaleMessages, LocalePack } from "@zuccadev-labs/zuix-zui";
import type { ZoutMessages } from "./en";

const messages: LocaleMessages<ZoutMessages> = {
  chatLayout: { list: "Chats", conversation: "Conversación", details: "Detalles", launcher: "Abrir el chat", close: "Cerrar el chat" },
  docsLayout: { nav: "Documentación", toc: "En esta página", onThisPage: "En esta página", previous: "Anterior", next: "Siguiente", pager: "Páginas" },
};

const es: LocalePack<typeof messages> = { id: "es", messages, same: ["chatLayout.list"] };
export default es;
