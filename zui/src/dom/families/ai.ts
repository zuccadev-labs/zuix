// @zuccadev-labs/zuix-zui/dom/ai — IA, chatbots y agentes sin framework: AssistantMessage, PromptInput, Reasoning,
// ToolCall, ApprovalCard, AgentPlan, Sources, Suggestions, Artifact, BranchPicker, AgentStatus, UsageMeter, Markdown,
// WebPreview, VoiceInput y StackTrace (Checkpoint es solo marcado).
// Registro: init(aiModule) o use(aiModule) junto a @zuccadev-labs/zuix-zui/dom/core.
import type { DomModule } from "../shared";
import { aiWidgets } from "../widgets-ai";
import { aiToolsPart } from "../widgets-domain";

export { destroyWidget, setWidgetProps } from "../widgets";
export { markdownText, parseMarkdown } from "../../core/markdown-lite";
export { createTextStream, provisional } from "../../core/stream-text";
export { activePath, addBranch, branchInfo, selectBranch, stepBranch } from "../../core/branches";
export { compactTokens, formatCost } from "../../core/usage";
export { parseStack, stackText } from "../../core/stack-trace";
export { normalizeUrl } from "../../core/web-preview";

export const aiModule: DomModule = { name: "ai", parts: [aiWidgets, aiToolsPart] };
