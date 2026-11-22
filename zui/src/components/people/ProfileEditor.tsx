"use client";
import { useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Icon } from "@zuccadev-labs/zuix-zicon/core";
import {
  BIO_MAX,
  bioCounter,
  cleanHandle,
  HANDLE_PATTERN,
  validateProfile,
  visibleLength,
  type ProfileErrors,
  type ProfileLabels,
  type ProfileValues,
} from "../../core/profile";
import { cx } from "../../cx";
import { Avatar } from "../data/Avatar";

export type { ProfileErrors, ProfileLabels, ProfileValues };

export interface ProfileEditorText {
  title: string;
  name: string;
  handle: string;
  handleHint: string;
  email: string;
  website: string;
  location: string;
  bio: string;
  bioHint: string;
  photo: string;
  changePhoto: string;
  removePhoto: string;
  photoHint: string;
  save: string;
  cancel: string;
  saved: string;
  /** «Fix {count} fields to save.» */
  invalid: string;
  error: string;
}

const PROFILE_EDITOR_TEXT: ProfileEditorText = {
  title: "Profile",
  name: "Name",
  handle: "Username",
  handleHint: "Your profile lives at /@username.",
  email: "Email",
  website: "Website",
  location: "Location",
  bio: "Bio",
  bioHint: "A line or two about you.",
  photo: "Photo",
  changePhoto: "Change photo",
  removePhoto: "Remove",
  photoHint: "JPG or PNG, square works best.",
  save: "Save changes",
  cancel: "Cancel",
  saved: "Profile saved",
  invalid: "Fix {count} fields to save.",
  error: "Error",
};

export interface ProfileEditorProps {
  /** Valores iniciales. */
  defaultValues?: Partial<ProfileValues> & { avatar?: string };
  /** Al guardar con todo válido. Puede devolver una promesa: el botón queda en espera hasta que termine. */
  onSubmit?: (values: ProfileValues & { avatar?: File | null }) => void | Promise<void>;
  onCancel?: () => void;
  /** Usuario ya ocupado (lo decide la aplicación). */
  isHandleTaken?: (handle: string) => boolean;
  bioMax?: number;
  /** Contenido extra al final del formulario (enlaces, preferencias). */
  children?: ReactNode;
  labels?: Partial<ProfileLabels>;
  text?: Partial<ProfileEditorText>;
  className?: string;
  id?: string;
}

const FIELDS: (keyof ProfileValues)[] = ["name", "handle", "email", "website", "location", "bio"];

/**
 * Editor de perfil: foto (elegir y quitar), nombre, usuario, correo, web, ubicación y biografía con contador. Valida
 * al salir de cada campo y al guardar, nunca mientras se escribe por primera vez; el error dice cómo corregirlo y se
 * une al campo por `aria-describedby` solo mientras existe. Al guardar con errores, el foco va al primero.
 */
export function ProfileEditor({
  defaultValues = {},
  onSubmit,
  onCancel,
  isHandleTaken,
  bioMax = BIO_MAX,
  children,
  labels,
  text: textProp,
  className,
  id,
}: ProfileEditorProps) {
  const t = { ...PROFILE_EDITOR_TEXT, ...textProp };
  const auto = useId().replace(/:/g, "");
  const uid = id ?? `pe-${auto}`;
  const initial: ProfileValues = {
    name: defaultValues.name ?? "",
    handle: defaultValues.handle ?? "",
    email: defaultValues.email ?? "",
    website: defaultValues.website ?? "",
    location: defaultValues.location ?? "",
    bio: defaultValues.bio ?? "",
  };
  const [values, setValues] = useState<ProfileValues>(initial);
  const [touched, setTouched] = useState<Partial<Record<keyof ProfileValues, boolean>>>({});
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [photo, setPhoto] = useState<string | undefined>(defaultValues.avatar);
  const [file, setFile] = useState<File | null | undefined>(undefined);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const form = useRef<HTMLFormElement | null>(null);

  const check = (next: ProfileValues, fields?: (keyof ProfileValues)[]) =>
    validateProfile(next, { labels, taken: isHandleTaken, bioMax, fields });

  const change = (key: keyof ProfileValues, value: string) => {
    const next = { ...values, [key]: value };
    setValues(next);
    // Tras el primer error, el campo se revalida al escribir: el aviso desaparece en cuanto se corrige.
    if (touched[key]) setErrors((e) => ({ ...e, [key]: check(next, [key])[key] }));
  };
  const blur = (key: keyof ProfileValues) => {
    setTouched((s) => ({ ...s, [key]: true }));
    setErrors((e) => ({ ...e, [key]: check(values, [key])[key] }));
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const all = check(values);
    setErrors(all);
    setTouched(Object.fromEntries(FIELDS.map((f) => [f, true])));
    const bad = FIELDS.filter((f) => all[f]);
    if (bad.length) {
      setStatus(t.invalid.replace("{count}", String(bad.length)));
      form.current?.querySelector<HTMLElement>(`[name="${bad[0]}"]`)?.focus();
      return;
    }
    setBusy(true);
    try {
      await onSubmit?.({ ...values, handle: cleanHandle(values.handle), avatar: file });
      setStatus(t.saved);
    } finally {
      setBusy(false);
    }
  };

  const field = (key: keyof ProfileValues, label: string, input: ReactNode, hint?: ReactNode, extra?: ReactNode) => {
    const err = touched[key] ? errors[key] : undefined;
    return (
      <div className="z-field z-profile-editor__field" data-layout="stacked" data-field={key} data-invalid={err ? "" : undefined}>
        <label className="z-field__label" htmlFor={`${uid}-${key}`}>
          {label}
        </label>
        <div className="z-field__body">
          {input}
          {hint || extra ? (
            <p className="z-field__hint z-profile-editor__hint" id={`${uid}-${key}-hint`}>
              {hint}
              {extra}
            </p>
          ) : null}
          {err ? (
            <p className="z-field__error z-profile-editor__error" id={`${uid}-${key}-error`}>
              <Icon name="exclamation-circle" size={14} />
              <span className="z-sr-only">{t.error}: </span>
              {err}
            </p>
          ) : null}
        </div>
      </div>
    );
  };
  const describe = (key: keyof ProfileValues, hint: boolean) =>
    [hint ? `${uid}-${key}-hint` : null, touched[key] && errors[key] ? `${uid}-${key}-error` : null].filter(Boolean).join(" ") || undefined;
  const input = (
    key: keyof ProfileValues,
    type: string,
    autoComplete: string,
    opts: { hint?: boolean; required?: boolean; pattern?: string } = {},
  ) => (
    <span className="z-input" data-size="md" data-invalid={touched[key] && errors[key] ? "" : undefined}>
      {key === "handle" ? (
        <span className="z-input__icon z-profile-editor__at" aria-hidden="true">
          @
        </span>
      ) : null}
      <input
        className="z-input__control"
        id={`${uid}-${key}`}
        name={key}
        type={type}
        autoComplete={autoComplete}
        required={opts.required}
        pattern={opts.pattern}
        spellCheck={key === "handle" || key === "email" || key === "website" ? false : undefined}
        autoCapitalize={key === "handle" || key === "email" || key === "website" ? "off" : undefined}
        value={values[key] ?? ""}
        aria-invalid={touched[key] && errors[key] ? true : undefined}
        aria-describedby={describe(key, Boolean(opts.hint))}
        onChange={(e) => change(key, e.target.value)}
        onBlur={() => blur(key)}
      />
    </span>
  );
  const over = visibleLength(values.bio) > bioMax;

  return (
    <form
      ref={form}
      id={id}
      className={cx("z-profile-editor", className)}
      noValidate
      aria-labelledby={`${uid}-title`}
      onSubmit={submit}
      onReset={(e) => {
        e.preventDefault();
        setValues(initial);
        setErrors({});
        setTouched({});
        setPhoto(defaultValues.avatar);
        setFile(undefined);
        onCancel?.();
      }}
    >
      <h2 className="z-profile-editor__title" id={`${uid}-title`}>
        {t.title}
      </h2>
      <div className="z-profile-editor__photo">
        <Avatar size="xl" name={values.name || initial.name} src={photo} alt="" />
        <div className="z-profile-editor__photo-actions">
          <span className="z-profile-editor__photo-label" id={`${uid}-photo`}>
            {t.photo}
          </span>
          <div className="z-profile-editor__photo-buttons">
            <button
              type="button"
              className="z-btn z-btn--secondary"
              data-size="sm"
              data-photo-pick=""
              aria-describedby={`${uid}-photo-hint`}
              onClick={() => fileInput.current?.click()}
            >
              <Icon name="camera" size={14} />
              {t.changePhoto}
            </button>
            {photo ? (
              <button
                type="button"
                className="z-btn z-btn--ghost"
                data-size="sm"
                onClick={() => {
                  setPhoto(undefined);
                  setFile(null);
                }}
              >
                {t.removePhoto}
              </button>
            ) : null}
          </div>
          <p className="z-field__hint" id={`${uid}-photo-hint`}>
            {t.photoHint}
          </p>
          <input
            ref={fileInput}
            className="z-profile-editor__file"
            type="file"
            name="avatar"
            accept="image/png, image/jpeg, image/webp"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setFile(f);
              setPhoto(URL.createObjectURL(f));
            }}
          />
        </div>
      </div>
      <div className="z-profile-editor__grid">
        {field("name", t.name, input("name", "text", "name", { required: true }))}
        {field(
          "handle",
          t.handle,
          input("handle", "text", "username", { required: true, pattern: HANDLE_PATTERN, hint: true }),
          t.handleHint,
        )}
        {field("email", t.email, input("email", "email", "email"))}
        {field("website", t.website, input("website", "url", "url"))}
        {field("location", t.location, input("location", "text", "address-level2"))}
      </div>
      {field(
        "bio",
        t.bio,
        <textarea
          className="z-textarea"
          data-size="md"
          data-resize="vertical"
          data-invalid={touched.bio && errors.bio ? "" : undefined}
          id={`${uid}-bio`}
          name="bio"
          rows={3}
          value={values.bio}
          aria-invalid={touched.bio && errors.bio ? true : undefined}
          aria-describedby={describe("bio", true)}
          onChange={(e) => change("bio", e.target.value)}
          onBlur={() => blur("bio")}
        />,
        t.bioHint,
        <span className="z-profile-editor__counter" data-over={over ? "" : undefined}>
          {" "}
          {bioCounter(values.bio, bioMax, labels)}
        </span>,
      )}
      {children}
      <div className="z-profile-editor__actions">
        <span className="z-profile-editor__status" role="status">
          {status}
        </span>
        <button type="reset" className="z-btn z-btn--ghost" data-size="md">
          {t.cancel}
        </button>
        <button
          type="submit"
          className="z-btn z-btn--primary"
          data-size="md"
          aria-disabled={busy || undefined}
          data-loading={busy || undefined}
        >
          {t.save}
        </button>
      </div>
    </form>
  );
}
