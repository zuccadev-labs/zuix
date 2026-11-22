// Embudo: conversión de cada etapa frente a la anterior y frente a la primera, y la caída entre etapas. Sin documento.

export interface FunnelStageInput {
  label: string;
  value: number;
}

export interface FunnelStage extends FunnelStageInput {
  index: number;
  /** Fracción frente a la primera etapa (0…1). */
  ofFirst: number;
  /** Fracción frente a la etapa anterior (0…1); la primera es 1. */
  ofPrevious: number;
  /** Lo que se perdió desde la anterior (valor absoluto, ≥ 0). */
  dropped: number;
}

const safe = (v: number) => (Number.isFinite(v) && v > 0 ? v : 0);

/** Etapas con sus conversiones. Los valores negativos o no finitos cuentan 0. */
export function funnelStages(input: readonly FunnelStageInput[]): FunnelStage[] {
  const first = safe(input[0]?.value ?? 0);
  return input.map((s, index) => {
    const value = safe(s.value);
    const prev = index === 0 ? value : safe(input[index - 1]!.value);
    return {
      label: s.label,
      value,
      index,
      ofFirst: first > 0 ? value / first : 0,
      ofPrevious: index === 0 ? 1 : prev > 0 ? value / prev : 0,
      dropped: index === 0 ? 0 : Math.max(0, prev - value),
    };
  });
}

/** Conversión total (última / primera). */
export function funnelConversion(stages: readonly FunnelStage[]): number {
  return stages.length ? stages[stages.length - 1]!.ofFirst : 0;
}

/** Etapa con la mayor caída relativa (el cuello de botella), o `null` con menos de dos etapas. */
export function funnelBottleneck(stages: readonly FunnelStage[]): FunnelStage | null {
  let worst: FunnelStage | null = null;
  for (const s of stages.slice(1)) if (!worst || s.ofPrevious < worst.ofPrevious) worst = s;
  return worst;
}
