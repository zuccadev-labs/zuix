// Pool de almacenamiento: vdevs con su fila de discos (SSD, HDD, NVMe), tipo de redundancia (RAIDZ1/2/3, mirror,
// single, stripe), cuántos discos pueden fallar, barra de uso con libre y total, y nota. Marcado (core/vnode), textos
// y cálculos, sin documento. La barra es un `meter` con su valor en texto; el color no es la única pista.

import { formatByte } from "./format";
import { fill, h, type VEl } from "./vnode";

export type DiskKind = "hdd" | "ssd" | "nvme";
export type VdevLayout = "single" | "stripe" | "mirror" | "raidz1" | "raidz2" | "raidz3";

export interface PoolVdev {
  /** Papel del vdev («data», «special», «log», «cache»). */
  role?: string;
  layout: VdevLayout;
  disks: number;
  disk: DiskKind;
  /** Modelo o descripción de los discos («7× Exos 16 TB»). */
  model?: string;
  /** Nota corta («metadata · 22 / 118 GiB used»). */
  note?: string;
}

export interface StoragePoolData {
  name: string;
  vdevs: PoolVdev[];
  /** Bytes usados y utilizables. */
  used: number;
  size: number;
  note?: string;
}

export interface StoragePoolLabels {
  /** «{percent} used · {free} free · {size} usable». */
  usage: string;
  /** «{count} disk may fail», por forma plural. */
  mayFail: { one: string; other: string };
  noRedundancy: string;
  layouts: Record<VdevLayout, string>;
  disks: Record<DiskKind, string>;
  /** «{count} {kind}» en el resumen («7 HDD + 2 SSD»). */
  diskCount: string;
  /** Nombre del medidor: «Used space in {name}». */
  meter: string;
}

export const STORAGE_POOL_LABELS: StoragePoolLabels = {
  usage: "{percent} used · {free} free · {size} usable",
  mayFail: { one: "{count} disk may fail", other: "{count} disks may fail" },
  noRedundancy: "no redundancy",
  layouts: { single: "single disk", stripe: "stripe", mirror: "mirror", raidz1: "RAIDZ1", raidz2: "RAIDZ2", raidz3: "RAIDZ3" },
  disks: { hdd: "HDD", ssd: "SSD", nvme: "NVMe" },
  diskCount: "{count} {kind}",
  meter: "Used space in {name}",
};

export const mergeStoragePoolLabels = (l?: Partial<StoragePoolLabels>): StoragePoolLabels =>
  l
    ? {
        ...STORAGE_POOL_LABELS,
        ...l,
        layouts: { ...STORAGE_POOL_LABELS.layouts, ...l.layouts },
        disks: { ...STORAGE_POOL_LABELS.disks, ...l.disks },
        mayFail: { ...STORAGE_POOL_LABELS.mayFail, ...l.mayFail },
      }
    : STORAGE_POOL_LABELS;

/** Discos de un vdev que pueden fallar sin perder datos. */
export function faultTolerance(layout: VdevLayout, disks: number): number {
  const n = Math.max(0, Math.floor(disks));
  if (layout === "mirror") return Math.max(0, n - 1);
  if (layout === "raidz1") return n >= 2 ? 1 : 0;
  if (layout === "raidz2") return n >= 3 ? 2 : 0;
  if (layout === "raidz3") return n >= 4 ? 3 : 0;
  return 0;
}

/** Tolerancia del pool: la del vdev más débil (con un solo vdev sin redundancia, se pierde todo). */
export const poolTolerance = (vdevs: readonly PoolVdev[]) =>
  vdevs.length ? Math.min(...vdevs.map((v) => faultTolerance(v.layout, v.disks))) : 0;

/** Uso entre 0 y 1 (0 si el tamaño no es válido). */
export function poolUsage(used: number, size: number): number {
  if (!(size > 0) || !Number.isFinite(used)) return 0;
  return Math.min(1, Math.max(0, used / size));
}

/** Resumen de discos de un pool («7 HDD + 2 SSD»). */
export function diskSummary(vdevs: readonly PoolVdev[], labels: StoragePoolLabels = STORAGE_POOL_LABELS): string {
  const count = new Map<DiskKind, number>();
  for (const v of vdevs) count.set(v.disk, (count.get(v.disk) ?? 0) + Math.max(0, Math.floor(v.disks)));
  return [...count]
    .filter(([, n]) => n > 0)
    .map(([kind, n]) => fill(labels.diskCount, { count: n, kind: labels.disks[kind] }))
    .join(" + ");
}

export interface StoragePoolProps extends StoragePoolData {
  /** Sistema de unidades: `binary` (TiB, GiB; por defecto, como ZFS) o `decimal`. */
  units?: "binary" | "decimal";
  labels?: Partial<StoragePoolLabels>;
  locale?: string;
  /** Nivel del título del pool. Por defecto 3. */
  headingLevel?: 2 | 3 | 4 | 5 | 6;
}

/** Texto de uso del pool («48 % used · 44.2 TiB free · 85.6 TiB usable»). */
export function usageText(
  used: number,
  size: number,
  o: { units?: "binary" | "decimal"; locale?: string; labels?: StoragePoolLabels } = {},
): string {
  const labels = o.labels ?? STORAGE_POOL_LABELS;
  const system = o.units ?? "binary";
  const pct = new Intl.NumberFormat(o.locale, { style: "percent", maximumFractionDigits: 0 }).format(poolUsage(used, size));
  return fill(labels.usage, {
    percent: pct,
    free: formatByte(Math.max(0, size - used), o.locale, { system, maximumFractionDigits: 1 }),
    size: formatByte(size, o.locale, { system, maximumFractionDigits: 1 }),
  });
}

/** Árbol del pool (contrato HTML). */
export function storagePoolTree(p: StoragePoolProps): VEl {
  const labels = mergeStoragePoolLabels(p.labels);
  const usage = poolUsage(p.used, p.size);
  const text = usageText(p.used, p.size, { units: p.units, locale: p.locale, labels });
  const heading = `h${p.headingLevel ?? 3}`;
  return h(
    "section",
    { class: "z-storage-pool", "aria-label": p.name },
    h(
      "div",
      { class: "z-storage-pool__head" },
      h(heading, { class: "z-storage-pool__name" }, p.name),
      h("span", { class: "z-storage-pool__disks" }, diskSummary(p.vdevs, labels)),
      h("span", { class: "z-storage-pool__usage" }, text),
    ),
    h(
      "div",
      {
        class: "z-storage-pool__meter",
        role: "meter",
        "aria-label": fill(labels.meter, { name: p.name }),
        "aria-valuemin": 0,
        "aria-valuemax": 100,
        "aria-valuenow": Math.round(usage * 100),
        "aria-valuetext": text,
        "data-level": usage >= 0.9 ? "critical" : usage >= 0.8 ? "high" : undefined,
        s: { "--z-pool-used": `${Math.round(usage * 1000) / 10}%` },
      },
      h("span", { class: "z-storage-pool__fill" }),
    ),
    h(
      "ul",
      { class: "z-storage-pool__vdevs", role: "list" },
      ...p.vdevs.map((v, i) => {
        const tolerance = faultTolerance(v.layout, v.disks);
        const title = [v.role, labels.layouts[v.layout]].filter(Boolean).join(" · ");
        return h(
          "li",
          { key: `${i}`, class: "z-storage-pool__vdev", "data-layout": v.layout },
          h(
            "span",
            { class: "z-storage-pool__drives", "data-disk": v.disk, "aria-hidden": "true" },
            ...Array.from({ length: Math.max(0, Math.min(64, Math.floor(v.disks))) }, (_, k) =>
              h("span", { key: `${k}`, class: "z-disk", "data-kind": v.disk }, h("span", { class: "z-disk__face" })),
            ),
          ),
          h("span", { class: "z-storage-pool__title" }, title),
          v.model ? h("span", { class: "z-storage-pool__meta" }, v.model) : null,
          h(
            "span",
            { class: "z-storage-pool__meta", "data-redundancy": tolerance ? undefined : "none" },
            tolerance
              ? fill(new Intl.PluralRules(p.locale).select(tolerance) === "one" ? labels.mayFail.one : labels.mayFail.other, {
                  count: new Intl.NumberFormat(p.locale).format(tolerance),
                })
              : labels.noRedundancy,
          ),
          v.note ? h("span", { class: "z-storage-pool__meta" }, v.note) : null,
        );
      }),
    ),
    p.note ? h("p", { class: "z-storage-pool__note" }, p.note) : null,
  );
}
