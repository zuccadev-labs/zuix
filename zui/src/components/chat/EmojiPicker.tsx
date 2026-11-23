"use client";
import type { Ref } from "react";
import { emojiPickerWidget, type EmojiPickerLabels, type EmojiPickerProps as CoreProps } from "../../core/emoji-picker-widget";
import { useWidget } from "../agenda/vtree";
import { withRef } from "../../react-compat";

export type { EmojiPickerLabels };

export interface EmojiPickerProps extends CoreProps {
  onSelect?: (detail: { emoji: string }) => void;
  /** Escape desde el buscador. */
  onClose?: () => void;
  id?: string;
  className?: string;
  ref?: Ref<HTMLDivElement>;
}

/**
 * Selector de emojis: buscador (combobox) sobre una rejilla por categorías, recientes y tono de piel. Conjunto propio
 * pequeño o el de la aplicación, también cargado a demanda.
 */
export const EmojiPicker = withRef(function EmojiPicker({ onSelect, onClose, id, className, ref, ...props }: EmojiPickerProps) {
  return useWidget(emojiPickerWidget, props, { id, className, ref, handlers: { select: onSelect, close: onClose } });
});
