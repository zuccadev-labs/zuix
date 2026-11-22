import { agentStatusNode, type AgentState, type AgentStatusLabels, type AgentStatusProps as CoreProps } from "../../core/ai-widgets";
import { staticNode } from "../chat/static";

export type { AgentState, AgentStatusLabels };

export interface AgentStatusProps extends CoreProps {
  className?: string;
}

/** Estado de un agente: inactivo, pensando, usando una herramienta, esperando aprobación, error o hecho; en texto. */
export function AgentStatus({ className, ...props }: AgentStatusProps) {
  return staticNode(agentStatusNode(props), { className });
}
