"use client";
import { Icon } from "@zuccadev-labs/zuix-zicon/core";
import { presenceOf, PRESENCE_LABELS, type PresenceStatus } from "../../core/user-presence";
import { cx } from "../../cx";
import { Avatar } from "../data/Avatar";
import type { MenuEntry } from "../overlay/internal";
import { Menu } from "../overlay/Menu";
import { Persona } from "./Persona";

export interface AccountUser {
  id?: string;
  name: string;
  email?: string;
  avatar?: string;
  presence?: PresenceStatus;
}

export interface AccountMenuLabels {
  /** Nombre del botón: «Account of {name}». */
  trigger: string;
  accounts: string;
  theme: string;
  light: string;
  dark: string;
  system: string;
  signOut: string;
  addAccount: string;
}

const ACCOUNT_MENU_LABELS: AccountMenuLabels = {
  trigger: "Account of {name}",
  accounts: "Switch account",
  theme: "Theme",
  light: "Light",
  dark: "Dark",
  system: "System",
  signOut: "Sign out",
  addAccount: "Add account",
};

export interface AccountMenuProps {
  user: AccountUser;
  /** Otras cuentas: un grupo de radio para cambiar de una a otra (incluye la actual). */
  accounts?: readonly AccountUser[];
  /** Id de la cuenta activa en `accounts` (por defecto, `user.id`). */
  currentAccount?: string;
  onSwitch?: (accountId: string) => void;
  /** «Add account» bajo las cuentas. */
  onAddAccount?: () => void;
  /** Entradas propias (perfil, ajustes, ayuda) entre las cuentas y el tema. */
  items?: MenuEntry[];
  /** Tema actual: con `onThemeChange` muestra el grupo de radio Light/Dark/System. */
  theme?: "light" | "dark" | "system";
  onThemeChange?: (theme: "light" | "dark" | "system") => void;
  onSignOut?: () => void;
  /** `avatar` solo la imagen; `full` avatar, nombre y correo (en la sidebar). */
  variant?: "avatar" | "full";
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  labels?: Partial<AccountMenuLabels>;
  className?: string;
}

/**
 * Menú de cuenta: botón con el avatar que abre un Menu con la persona en la cabecera, cambio de cuenta (radio),
 * entradas propias, tema y salir.
 */
export function AccountMenu({
  user,
  accounts,
  currentAccount,
  onSwitch,
  onAddAccount,
  items = [],
  theme,
  onThemeChange,
  onSignOut,
  variant = "avatar",
  side = "bottom",
  align = "end",
  labels: labelsProp,
  className,
}: AccountMenuProps) {
  const l = { ...ACCOUNT_MENU_LABELS, ...labelsProp };
  const entries: MenuEntry[] = [
    {
      type: "label",
      label: (
        <Persona
          className="z-account-menu__persona"
          size="sm"
          name={user.name}
          avatar={user.avatar}
          secondary={user.email}
          presence={user.presence}
          presenceLabels={PRESENCE_LABELS}
        />
      ),
    },
  ];
  if (accounts && accounts.length > 1) {
    entries.push({ type: "separator" });
    entries.push({
      type: "radio-group",
      id: "accounts",
      label: l.accounts,
      value: currentAccount ?? user.id ?? accounts[0]!.id ?? accounts[0]!.name,
      onValueChange: onSwitch,
      items: accounts.map((a) => ({ value: a.id ?? a.name, label: a.email ? `${a.name} · ${a.email}` : a.name })),
    });
    if (onAddAccount) entries.push({ id: "add-account", label: l.addAccount, icon: "user-plus", onSelect: onAddAccount });
  }
  if (items.length) entries.push({ type: "separator" }, ...items);
  if (theme && onThemeChange) {
    entries.push({ type: "separator" });
    entries.push({
      type: "radio-group",
      id: "theme",
      label: l.theme,
      value: theme,
      onValueChange: (v) => onThemeChange(v as "light" | "dark" | "system"),
      items: [
        { value: "light", label: l.light },
        { value: "dark", label: l.dark },
        { value: "system", label: l.system },
      ],
    });
  }
  if (onSignOut)
    entries.push({ type: "separator" }, { id: "sign-out", label: l.signOut, icon: "arrow-right-start-on-rectangle", onSelect: onSignOut });
  const status = user.presence ? presenceOf(user.presence) : undefined;
  const trigger = (
    // El nombre sale del contenido (texto oculto), no de aria-label: así el texto visible (iniciales, nombre) no
    // contradice al nombre accesible.
    <button type="button" className={cx("z-account-menu", className)} data-variant={variant}>
      <span className="z-sr-only">{l.trigger.replace("{name}", user.name)}</span>
      <Avatar size={variant === "full" ? "sm" : "md"} name={user.name} src={user.avatar} alt="" status={status} />
      {variant === "full" ? (
        <>
          <span className="z-account-menu__text" aria-hidden="true">
            <span className="z-account-menu__name">{user.name}</span>
            {user.email ? <span className="z-account-menu__email">{user.email}</span> : null}
          </span>
          <Icon name="chevron-up-down" size={14} />
        </>
      ) : null}
    </button>
  );
  return (
    <Menu
      trigger={trigger}
      items={entries}
      side={side}
      align={align}
      label={l.trigger.replace("{name}", user.name)}
      className="z-account-menu__menu"
    />
  );
}
