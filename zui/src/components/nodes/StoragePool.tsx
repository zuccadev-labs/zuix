import { cloneElement, type ReactElement } from "react";
import { type StoragePoolProps as CoreProps, storagePoolTree } from "../../core/storage-pool";
import { cx } from "../../cx";
import { toReact } from "../vnode";

export type { DiskKind, PoolVdev, StoragePoolData, StoragePoolLabels, VdevLayout } from "../../core/storage-pool";

export interface StoragePoolProps extends CoreProps {
  className?: string;
  id?: string;
}

/**
 * Pool de discos: nombre, resumen de discos, uso con libre y total (un `meter` con el valor en texto), y cada vdev con
 * su fila de discos (HDD, SSD, NVMe), su tipo (RAIDZ1, mirror, single…), cuántos discos pueden fallar y una nota.
 */
export function StoragePool({ className, id, ...props }: StoragePoolProps) {
  const el = toReact(storagePoolTree(props)) as ReactElement<{ className?: string; id?: string }>;
  return cloneElement(el, { id, className: cx((el.props as { className?: string }).className, className) });
}
