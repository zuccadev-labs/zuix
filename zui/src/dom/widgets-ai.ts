// Familia de IA sin framework: AssistantMessage, PromptInput, Reasoning, ToolCall, ApprovalCard, AgentPlan, Sources,
// Suggestions, Artifact, BranchPicker, AgentStatus, UsageMeter y Markdown, con el mismo árbol y la misma interacción que
// el binding de React. El texto del modelo se construye como nodos (core/markdown-lite), nunca como marcado.
import { registerIcons } from "@zuccadev-labs/zuix-zicon/dom";
import { arrowDownTray } from "@zuccadev-labs/zuix-zicon/icons/arrow-down-tray";
import { arrowPath } from "@zuccadev-labs/zuix-zicon/icons/arrow-path";
import { arrowUp } from "@zuccadev-labs/zuix-zicon/icons/arrow-up";
import { check } from "@zuccadev-labs/zuix-zicon/icons/check";
import { checkCircle } from "@zuccadev-labs/zuix-zicon/icons/check-circle";
import { chevronDown } from "@zuccadev-labs/zuix-zicon/icons/chevron-down";
import { chevronLeft } from "@zuccadev-labs/zuix-zicon/icons/chevron-left";
import { chevronRight } from "@zuccadev-labs/zuix-zicon/icons/chevron-right";
import { chevronUpDown } from "@zuccadev-labs/zuix-zicon/icons/chevron-up-down";
import { clock } from "@zuccadev-labs/zuix-zicon/icons/clock";
import { codeBracket } from "@zuccadev-labs/zuix-zicon/icons/code-bracket";
import { copy } from "@zuccadev-labs/zuix-zicon/icons/copy";
import { documentText } from "@zuccadev-labs/zuix-zicon/icons/document-text";
import { exclamationCircle } from "@zuccadev-labs/zuix-zicon/icons/exclamation-circle";
import { exclamationTriangle } from "@zuccadev-labs/zuix-zicon/icons/exclamation-triangle";
import { hand } from "@zuccadev-labs/zuix-zicon/icons/hand";
import { handThumbDown } from "@zuccadev-labs/zuix-zicon/icons/hand-thumb-down";
import { handThumbUp } from "@zuccadev-labs/zuix-zicon/icons/hand-thumb-up";
import { lightBulb } from "@zuccadev-labs/zuix-zicon/icons/light-bulb";
import { minusCircle } from "@zuccadev-labs/zuix-zicon/icons/minus-circle";
import { noCircle } from "@zuccadev-labs/zuix-zicon/icons/no-circle";
import { paperClip } from "@zuccadev-labs/zuix-zicon/icons/paper-clip";
import { plus } from "@zuccadev-labs/zuix-zicon/icons/plus";
import { shieldCheck } from "@zuccadev-labs/zuix-zicon/icons/shield-check";
import { shieldExclamation } from "@zuccadev-labs/zuix-zicon/icons/shield-exclamation";
import { sparkles } from "@zuccadev-labs/zuix-zicon/icons/sparkles";
import { stop } from "@zuccadev-labs/zuix-zicon/icons/stop";
import { user } from "@zuccadev-labs/zuix-zicon/icons/user";
import { wrench } from "@zuccadev-labs/zuix-zicon/icons/wrench";
import { xCircle } from "@zuccadev-labs/zuix-zicon/icons/x-circle";
import { xMark } from "@zuccadev-labs/zuix-zicon/icons/x-mark";
import {
  agentPlanWidget,
  approvalCardWidget,
  artifactWidget,
  assistantMessageWidget,
  branchPickerWidget,
  markdownWidget,
  reasoningWidget,
  sourcesWidget,
  suggestionsWidget,
  toolCallWidget,
} from "../core/ai-widgets";
import { promptInputWidget } from "../core/composer-widget";
import { widgetPart } from "./widgets";

registerIcons([
  arrowDownTray,
  arrowPath,
  arrowUp,
  check,
  checkCircle,
  chevronDown,
  chevronLeft,
  chevronRight,
  chevronUpDown,
  clock,
  codeBracket,
  copy,
  documentText,
  exclamationCircle,
  exclamationTriangle,
  hand,
  handThumbDown,
  handThumbUp,
  lightBulb,
  minusCircle,
  noCircle,
  paperClip,
  plus,
  shieldCheck,
  shieldExclamation,
  sparkles,
  stop,
  user,
  wrench,
  xCircle,
  xMark,
]);

export const aiWidgets = /* @__PURE__ */ widgetPart(
  46.2,
  [
    assistantMessageWidget,
    promptInputWidget,
    reasoningWidget,
    toolCallWidget,
    approvalCardWidget,
    agentPlanWidget,
    sourcesWidget,
    suggestionsWidget,
    artifactWidget,
    branchPickerWidget,
    markdownWidget,
  ],
  ".z-assistant-message, .z-artifact",
);
