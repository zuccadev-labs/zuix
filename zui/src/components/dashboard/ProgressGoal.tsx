import { cloneElement, type ReactElement } from "react";
import { progressGoalTree, type ProgressGoalProps as CoreProps } from "../../core/dashboard-trees";
import { cx } from "../../cx";
import { toReact } from "../vnode";

export type { ProgressGoalLabels } from "../../core/dashboard-trees";

export interface ProgressGoalProps extends CoreProps {
  className?: string;
  id?: string;
}

/** Avance hacia un objetivo con la marca del ritmo esperado («vas al 92 % del ritmo»): delante, en ritmo, detrás o conseguido, dicho con texto e icono. */
export function ProgressGoal({ className, id, ...props }: ProgressGoalProps) {
  const el = toReact(progressGoalTree(props)) as ReactElement<{ className?: string; id?: string }>;
  return cloneElement(el, { id, className: cx((el.props as { className?: string }).className, className) });
}
