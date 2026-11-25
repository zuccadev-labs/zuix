// @zuccadev-labs/zuix-zui/dom/people — MemberList y ProfileEditor sin framework (Persona, UserCard, ProfileHeader,
// PresenceBadge, SettingRow y SettingsSection son solo marcado; AvatarGroup con lista y AccountMenu usan el popover y
// el menú del núcleo). Registro: init(peopleModule) o use(peopleModule) junto a @zuccadev-labs/zuix-zui/dom/core.
import type { DomModule } from "../shared";
import { peopleWidgets, profileEditorPart } from "../widgets-people";

export { destroyWidget, setWidgetProps } from "../widgets";
export { filterMembers, groupMembers } from "../../core/members";
export { presenceText } from "../../core/user-presence";
export { validateProfile } from "../../core/profile";

export const peopleModule: DomModule = { name: "people", parts: [peopleWidgets, profileEditorPart] };
