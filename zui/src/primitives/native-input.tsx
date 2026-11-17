"use client";
// Campo nativo oculto que acompaña a un control propio (casilla, interruptor, radio): lleva el valor al formulario,
// participa en su validación (`required`) y avisa de `form.reset()`. Las tecnologías de apoyo no lo ven.
import { useEffect, useRef } from "react";
import { useLatest } from "./hooks";

export interface NativeInputProps {
  type: "checkbox" | "radio";
  name?: string;
  value?: string;
  checked: boolean;
  indeterminate?: boolean;
  required?: boolean;
  disabled?: boolean;
  form?: string;
  /** El formulario se ha restablecido: el control vuelve a su valor inicial. */
  onReset: () => void;
}

export function NativeInput({ type, name, value = "on", checked, indeterminate, required, disabled, form, onReset }: NativeInputProps) {
  const node = useRef<HTMLInputElement | null>(null);
  const latest = useLatest(onReset);
  useEffect(() => {
    if (node.current) node.current.indeterminate = Boolean(indeterminate);
  }, [indeterminate]);
  useEffect(() => {
    const owner = node.current?.form;
    if (!owner) return;
    // `reset` se emite antes de que el formulario restablezca sus campos: se espera a que termine.
    const onFormReset = () => setTimeout(() => latest.current(), 0);
    owner.addEventListener("reset", onFormReset);
    return () => owner.removeEventListener("reset", onFormReset);
  }, [latest]);
  return <input ref={node} type={type} className="z-native-input" aria-hidden="true" tabIndex={-1} name={name} value={value} checked={checked} required={required} disabled={disabled} form={form} onChange={noop} />;
}

const noop = () => {};
