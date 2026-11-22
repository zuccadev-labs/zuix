"use client";
import type { Ref } from "react";
import { agentPlanWidget, type AgentPlanLabels, type AgentPlanProps as CoreProps } from "../../core/ai-widgets";
import type { PlanStep, StepStatus } from "../../core/agent-state";
import { useWidget } from "../agenda/vtree";

export type { AgentPlanLabels, PlanStep, StepStatus };

export interface AgentPlanProps extends CoreProps {
  id?: string;
  className?: string;
  ref?: Ref<HTMLDivElement>;
}

/** Plan de un agente: pasos y subpasos con su estado en texto y el progreso «3 of 7». */
export function AgentPlan({ id, className, ref, ...props }: AgentPlanProps) {
  return useWidget(agentPlanWidget, props, { id, className, ref });
}
