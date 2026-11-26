// Textos en inglés de zout por espacio de nombres: la referencia de claves de los demás idiomas.
import type { LocalePack } from "@zuccadev-labs/zuix-zui";
import { CHAT_LAYOUT_LABELS } from "../chat-layout";
import { DOCS_LABELS } from "../pages";

export const messages = {
  chatLayout: CHAT_LAYOUT_LABELS,
  docsLayout: DOCS_LABELS,
};

/** Claves y anidamiento de los textos de zout: lo que tiene que cubrir un paquete de idioma. */
export type ZoutMessages = typeof messages;

const en: LocalePack<ZoutMessages> = { id: "en", messages };
export default en;
