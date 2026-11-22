"use client";
import type { Ref } from "react";
import { reasoningWidget, type ReasoningProps as CoreProps } from "../../core/ai-widgets";
import { useWidget } from "../agenda/vtree";

export interface ReasoningProps extends CoreProps {
  id?: string;
  className?: string;
  ref?: Ref<HTMLDivElement>;
}

/** Razonamiento plegable: «Thinking…» con brillo mientras dura y «Thought for 12 s» al terminar. */
export function Reasoning({ id, className, ref, ...props }: ReasoningProps) {
  return useWidget(reasoningWidget, props, { id, className, ref });
}
