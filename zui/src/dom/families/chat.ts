// @zuccadev-labs/zuix-zui/dom/chat — chat y mensajería sin framework: ConversationList, MessageList, Composer,
// EmojiPicker, VoiceNote, Reactions, CallCard, PinnedBar y ChatSearch. Registro: init(chatModule) o use(chatModule) junto a
// @zuccadev-labs/zuix-zui/dom/core.
import type { DomModule } from "../shared";
import { chatWidgets } from "../widgets-chat";
import { chatSearchPart } from "../widgets-domain";

export { messageList } from "../widgets-chat";
export { destroyWidget, setWidgetProps } from "../widgets";
export { arrivalText, chatRows, dayLabel, typingText } from "../../core/chat-group";
export { mergeDelivery } from "../../core/delivery";
export { EMOJI_SET, QUICK_REACTIONS, searchEmoji } from "../../core/emoji-data";
export { linkify, safeHref } from "../../core/linkify";
export { encodeMentions, mentionParts } from "../../core/mentions";
export { peaksFrom } from "../../core/waveform";
export { toggleReaction } from "../../core/chat-widgets";
export { findMatches } from "../../core/chat-search";

export const chatModule: DomModule = { name: "chat", parts: [chatWidgets, chatSearchPart] };
