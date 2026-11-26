// Familia de usuarios y perfiles sin framework. MemberList se pinta con el mismo árbol que el binding de React
// (core/widget); ProfileEditor conecta la validación de core/profile al formulario ya escrito (errores tras salir de
// cada campo y al guardar, unidos con `aria-describedby` solo mientras existen; contador de la biografía; vista previa
// de la foto) y emite `z:submit { values }`. Persona, UserCard, ProfileHeader, SettingRow y PresenceBadge son solo
// marcado; AvatarGroup con lista y AccountMenu usan el popover y el menú del núcleo (`data-z-open`).
import { localize } from "../core/locale";
import { localeOf } from "./locale";
import { iconElement, registerIcons } from "@zuccadev-labs/zuix-zicon/dom";
import { arrowLeft } from "@zuccadev-labs/zuix-zicon/icons/arrow-left";
import { check } from "@zuccadev-labs/zuix-zicon/icons/check";
import { chevronUpDown } from "@zuccadev-labs/zuix-zicon/icons/chevron-up-down";
import { clock } from "@zuccadev-labs/zuix-zicon/icons/clock";
import { exclamationCircle } from "@zuccadev-labs/zuix-zicon/icons/exclamation-circle";
import { magnifyingGlass } from "@zuccadev-labs/zuix-zicon/icons/magnifying-glass";
import { minus } from "@zuccadev-labs/zuix-zicon/icons/minus";
import { userMinus } from "@zuccadev-labs/zuix-zicon/icons/user-minus";
import { userPlus } from "@zuccadev-labs/zuix-zicon/icons/user-plus";
import { xMark } from "@zuccadev-labs/zuix-zicon/icons/x-mark";
import { memberListWidget } from "../core/member-list-widget";
import {
  bioCounter,
  BIO_MAX,
  cleanHandle,
  PROFILE_LABELS,
  validateProfile,
  visibleLength,
  type ProfileLabels,
  type ProfileValues,
} from "../core/profile";
import { emit, inDom } from "./forms-popup";
import type { DomPart } from "./shared";
import { widgetPart } from "./widgets";

registerIcons([arrowLeft, check, chevronUpDown, clock, exclamationCircle, magnifyingGlass, minus, userMinus, userPlus, xMark]);

export const peopleWidgets = /* @__PURE__ */ widgetPart(45.95, [memberListWidget]);

const FIELDS: (keyof ProfileValues)[] = ["name", "handle", "email", "website", "location", "bio"];

interface EditorEntry {
  touched: Set<string>;
  abort: AbortController;
}
const editors = new Map<HTMLFormElement, EditorEntry>();

function labelsOf(form: HTMLFormElement): Partial<ProfileLabels> {
  const out: Partial<ProfileLabels> = { ...localize("profile", PROFILE_LABELS, localeOf(form)) };
  for (const key of Object.keys(PROFILE_LABELS) as (keyof ProfileLabels)[]) {
    const v = form.dataset[`${key}Label`];
    if (v !== undefined) out[key] = v;
  }
  return out;
}

const control = (form: HTMLFormElement, key: string) => form.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="${key}"]`);

function valuesOf(form: HTMLFormElement): ProfileValues {
  const v = (k: string) => control(form, k)?.value ?? "";
  return { name: v("name"), handle: v("handle"), email: v("email"), website: v("website"), location: v("location"), bio: v("bio") };
}

/** Pinta o quita el error de un campo y su enlace en `aria-describedby`. */
function showError(form: HTMLFormElement, key: string, message: string | undefined): void {
  const input = control(form, key);
  if (!input) return;
  const field = input.closest<HTMLElement>(".z-field");
  const body = input.closest<HTMLElement>(".z-field__body") ?? field;
  const errorId = `${input.id || `${form.id}-${key}`}-error`;
  let error = form.ownerDocument.getElementById(errorId);
  const ids = (input.getAttribute("aria-describedby") ?? "").split(/\s+/).filter((id) => id && id !== errorId);
  const wrap = input.closest<HTMLElement>(".z-input") ?? input;
  if (message) {
    if (!error) {
      error = form.ownerDocument.createElement("p");
      error.className = "z-field__error z-profile-editor__error";
      error.id = errorId;
      body?.append(error);
    }
    const sr = form.ownerDocument.createElement("span");
    sr.className = "z-sr-only";
    sr.textContent = `${form.dataset.errorLabel ?? "Error"}: `;
    error.replaceChildren(iconElement("exclamation-circle", { size: 14 }), sr, form.ownerDocument.createTextNode(message));
    ids.push(errorId);
    input.setAttribute("aria-invalid", "true");
    wrap.setAttribute("data-invalid", "");
    field?.setAttribute("data-invalid", "");
  } else {
    error?.remove();
    input.removeAttribute("aria-invalid");
    wrap.removeAttribute("data-invalid");
    field?.removeAttribute("data-invalid");
  }
  if (ids.length) input.setAttribute("aria-describedby", ids.join(" "));
  else input.removeAttribute("aria-describedby");
}

function mountEditor(form: HTMLFormElement): void {
  if (editors.has(form)) return;
  const entry: EditorEntry = { touched: new Set(), abort: new AbortController() };
  editors.set(form, entry);
  const signal = entry.abort.signal;
  const max = Number(form.dataset.bioMax) || BIO_MAX;
  const opts = () => ({ labels: labelsOf(form), bioMax: max });
  const counter = () => {
    const bio = control(form, "bio")?.value ?? "";
    const out = form.querySelector<HTMLElement>(".z-profile-editor__counter");
    if (!out) return;
    out.textContent = ` ${bioCounter(bio, max, labelsOf(form))}`;
    out.toggleAttribute("data-over", visibleLength(bio) > max);
  };
  const validate = (key: keyof ProfileValues) => showError(form, key, validateProfile(valuesOf(form), { ...opts(), fields: [key] })[key]);
  form.noValidate = true;
  // Pulsar «Guardar» con un campo enfocado: el error de ese campo no se pinta al salir (movería el botón bajo el
  // puntero y el clic se perdería); lo pinta el propio envío.
  let pressing = false;
  form.addEventListener(
    "pointerdown",
    (e) => {
      pressing = (e.target as HTMLElement).closest?.('button[type="submit"]') !== null;
      if (pressing)
        setTimeout(() => {
          pressing = false;
        }, 600);
    },
    { signal, capture: true },
  );
  form.addEventListener(
    "focusout",
    (e) => {
      const key = (e.target as HTMLInputElement).name as keyof ProfileValues;
      if (!FIELDS.includes(key)) return;
      entry.touched.add(key);
      if (pressing || (e.relatedTarget as HTMLElement | null)?.matches?.('button[type="submit"]')) return;
      validate(key);
    },
    { signal },
  );
  form.addEventListener(
    "input",
    (e) => {
      const key = (e.target as HTMLInputElement).name as keyof ProfileValues;
      if (key === "bio") counter();
      if (entry.touched.has(key)) validate(key);
    },
    { signal },
  );
  form.addEventListener(
    "submit",
    (e) => {
      e.preventDefault();
      const values = valuesOf(form);
      const errors = validateProfile(values, opts());
      for (const key of FIELDS) {
        entry.touched.add(key);
        showError(form, key, errors[key]);
      }
      const bad = FIELDS.filter((k) => errors[k]);
      const status = form.querySelector<HTMLElement>(".z-profile-editor__status");
      if (bad.length) {
        if (status)
          status.textContent = (form.dataset.invalidLabel ?? "Fix {count} fields to save.").replace("{count}", String(bad.length));
        control(form, bad[0]!)?.focus();
        return;
      }
      if (status) status.textContent = form.dataset.savedLabel ?? "Profile saved";
      emit(form, "submit", { values: { ...values, handle: cleanHandle(values.handle) } });
    },
    { signal },
  );
  form.addEventListener(
    "reset",
    () => {
      entry.touched.clear();
      for (const key of FIELDS) showError(form, key, undefined);
      requestAnimationFrame(counter);
    },
    { signal },
  );
  form.addEventListener(
    "click",
    (e) => {
      const pick = (e.target as HTMLElement).closest?.("[data-photo-pick]");
      if (pick) form.querySelector<HTMLInputElement>(".z-profile-editor__file")?.click();
    },
    { signal },
  );
  form.addEventListener(
    "change",
    (e) => {
      const input = e.target as HTMLInputElement;
      if (!input.matches?.(".z-profile-editor__file") || !input.files?.[0]) return;
      const avatar = form.querySelector<HTMLElement>(".z-profile-editor__photo .z-avatar");
      if (!avatar) return;
      const img = form.ownerDocument.createElement("img");
      img.className = "z-avatar__image";
      img.alt = "";
      img.src = URL.createObjectURL(input.files[0]);
      avatar.replaceChildren(img);
      emit(form, "photochange", { file: input.files[0] });
    },
    { signal },
  );
  counter();
}

export const profileEditorPart: DomPart = {
  rank: 45.96,
  setup() {},
  hydrate(root) {
    const found = [...root.querySelectorAll<HTMLFormElement>("form.z-profile-editor")];
    if (root instanceof HTMLFormElement && root.matches(".z-profile-editor")) found.unshift(root);
    for (const form of found) if (inDom(form)) mountEditor(form);
  },
  teardown() {
    for (const entry of editors.values()) entry.abort.abort();
    editors.clear();
  },
};
