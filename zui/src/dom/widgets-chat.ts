// Familia de chat sin framework: ConversationList, MessageList, Composer, EmojiPicker, VoiceNote, Reactions, CallCard y
// PinnedBar se pintan con el mismo árbol que el binding de React (core/widget + core/vnode) y la misma interacción. El
// texto de los mensajes entra siempre como nodos de texto; los enlaces, solo si su destino es http, https o mailto.
import { registerIcons } from "@zuccadev-labs/zuix-zicon/dom";
import { arrowDown } from "@zuccadev-labs/zuix-zicon/icons/arrow-down";
import { arrowDownTray } from "@zuccadev-labs/zuix-zicon/icons/arrow-down-tray";
import { arrowPath } from "@zuccadev-labs/zuix-zicon/icons/arrow-path";
import { arrowTopRightOnSquare } from "@zuccadev-labs/zuix-zicon/icons/arrow-top-right-on-square";
import { arrowTurnUpLeft } from "@zuccadev-labs/zuix-zicon/icons/arrow-turn-up-left";
import { arrowTurnUpRight } from "@zuccadev-labs/zuix-zicon/icons/arrow-turn-up-right";
import { arrowUp } from "@zuccadev-labs/zuix-zicon/icons/arrow-up";
import { atSymbol } from "@zuccadev-labs/zuix-zicon/icons/at-symbol";
import { bellSlash } from "@zuccadev-labs/zuix-zicon/icons/bell-slash";
import { bookmark } from "@zuccadev-labs/zuix-zicon/icons/bookmark";
import { cake } from "@zuccadev-labs/zuix-zicon/icons/cake";
import { check } from "@zuccadev-labs/zuix-zicon/icons/check";
import { chevronRight } from "@zuccadev-labs/zuix-zicon/icons/chevron-right";
import { chevronUpDown } from "@zuccadev-labs/zuix-zicon/icons/chevron-up-down";
import { clock } from "@zuccadev-labs/zuix-zicon/icons/clock";
import { copy } from "@zuccadev-labs/zuix-zicon/icons/copy";
import { documentText } from "@zuccadev-labs/zuix-zicon/icons/document-text";
import { exclamationCircle } from "@zuccadev-labs/zuix-zicon/icons/exclamation-circle";
import { faceSmile } from "@zuccadev-labs/zuix-zicon/icons/face-smile";
import { globeAlt } from "@zuccadev-labs/zuix-zicon/icons/globe-alt";
import { hand } from "@zuccadev-labs/zuix-zicon/icons/hand";
import { heart } from "@zuccadev-labs/zuix-zicon/icons/heart";
import { lightBulb } from "@zuccadev-labs/zuix-zicon/icons/light-bulb";
import { magnifyingGlass } from "@zuccadev-labs/zuix-zicon/icons/magnifying-glass";
import { mapPin } from "@zuccadev-labs/zuix-zicon/icons/map-pin";
import { microphone } from "@zuccadev-labs/zuix-zicon/icons/microphone";
import { microphoneSlash } from "@zuccadev-labs/zuix-zicon/icons/microphone-slash";
import { noCircle } from "@zuccadev-labs/zuix-zicon/icons/no-circle";
import { paperAirplane } from "@zuccadev-labs/zuix-zicon/icons/paper-airplane";
import { paperClip } from "@zuccadev-labs/zuix-zicon/icons/paper-clip";
import { pause } from "@zuccadev-labs/zuix-zicon/icons/pause";
import { pencil } from "@zuccadev-labs/zuix-zicon/icons/pencil";
import { phone } from "@zuccadev-labs/zuix-zicon/icons/phone";
import { phoneXMark } from "@zuccadev-labs/zuix-zicon/icons/phone-x-mark";
import { play } from "@zuccadev-labs/zuix-zicon/icons/play";
import { plus } from "@zuccadev-labs/zuix-zicon/icons/plus";
import { stop } from "@zuccadev-labs/zuix-zicon/icons/stop";
import { sun } from "@zuccadev-labs/zuix-zicon/icons/sun";
import { trash } from "@zuccadev-labs/zuix-zicon/icons/trash";
import { trophy } from "@zuccadev-labs/zuix-zicon/icons/trophy";
import { user } from "@zuccadev-labs/zuix-zicon/icons/user";
import { videoCamera } from "@zuccadev-labs/zuix-zicon/icons/video-camera";
import { videoCameraSlash } from "@zuccadev-labs/zuix-zicon/icons/video-camera-slash";
import { xMark } from "@zuccadev-labs/zuix-zicon/icons/x-mark";
import { callCardWidget, pinnedBarWidget, reactionsWidget, voiceNoteWidget } from "../core/chat-widgets";
import { composerWidget } from "../core/composer-widget";
import { conversationListWidget } from "../core/conversation-list-widget";
import { emojiPickerWidget } from "../core/emoji-picker-widget";
import { messageListApi, messageListWidget, type MessageListApi } from "../core/message-list-widget";
import { widgetPart } from "./widgets";

registerIcons([
  arrowDown,
  arrowDownTray,
  arrowPath,
  arrowTopRightOnSquare,
  arrowTurnUpLeft,
  arrowTurnUpRight,
  arrowUp,
  atSymbol,
  bellSlash,
  bookmark,
  cake,
  check,
  chevronRight,
  chevronUpDown,
  clock,
  copy,
  documentText,
  exclamationCircle,
  faceSmile,
  globeAlt,
  hand,
  heart,
  lightBulb,
  magnifyingGlass,
  mapPin,
  microphone,
  microphoneSlash,
  noCircle,
  paperAirplane,
  paperClip,
  pause,
  pencil,
  phone,
  phoneXMark,
  play,
  plus,
  stop,
  sun,
  trash,
  trophy,
  user,
  videoCamera,
  videoCameraSlash,
  xMark,
]);

// Lo que pinta otra pieza dentro (la nota de voz y las reacciones de un mensaje, el selector de la caja de texto) no se
// monta aparte.
export const chatWidgets = /* @__PURE__ */ widgetPart(
  46.1,
  [
    conversationListWidget,
    messageListWidget,
    composerWidget,
    emojiPickerWidget,
    voiceNoteWidget,
    reactionsWidget,
    callCardWidget,
    pinnedBarWidget,
  ],
  ".z-message-list, .z-composer, .z-assistant-message",
);

/**
 * API de una MessageList montada (`scrollToEnd`, `jumpTo`, `focus`), o `null`. Los mensajes llegan por
 * `setWidgetProps(el, { messages })`; los avisos salen como `z:reply`, `z:react`, `z:loadolder`, `z:reachend`…
 */
export const messageList = (el: HTMLElement): MessageListApi | null => messageListApi(el);
