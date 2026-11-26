// @zuccadev-labs/zuix-zicon/dom — iconos sin framework y sin datos: registra los iconos que uses.
export { iconSvg, iconElement, iconPaths, iconParts, iconFrame, type IconPart, type IconSvgOptions } from "./svg";
export { defineIconElement } from "./define";
export { registerIcons, getIcon, registeredIconNames, onIconsRegistered } from "./registry";
export { iconNames, type IconName } from "./names";
export type { IconDef, IconVariant } from "./types";
export {
  type AppIconProblem,
  type AppIconSource,
  type CustomIconName,
  type CustomIcons,
  defineIcon,
  parseSvgIcon,
  registerAppIcons,
  safeImageUrl,
} from "./custom";
export type { IconPath, IconPathDef } from "./types";
