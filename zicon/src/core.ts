// Núcleo sin datos: el componente y el registro. Lo usan las librerías (zui, zout) para no arrastrar el set completo.
export { Icon, type IconProps } from "./Icon";
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
