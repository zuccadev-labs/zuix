import { useState } from "react";
import { AppBar, Page, ProfileLayout, SettingsLayout } from "@zuccadev-labs/zuix-zout";
import {
  AccountMenu,
  ActivityFeed,
  AvatarGroup,
  Badge,
  Button,
  Card,
  CardHeader,
  IconButton,
  MemberList,
  NativeSelect,
  Persona,
  PresenceBadge,
  ProfileEditor,
  ProfileHeader,
  SettingRow,
  SettingsSection,
  Switch,
  Tabs,
  UserCard,
  useToast,
  type Member,
  type ProfileValues,
} from "@zuccadev-labs/zuix-zui";

const ROLES = [
  { id: "owner", label: "Owner", locked: true },
  { id: "admin", label: "Admin" },
  { id: "member", label: "Member" },
  { id: "guest", label: "Guest" },
];

const MEMBERS: Member[] = [
  { id: "m1", name: "Ana López", email: "ana@acme.dev", role: "owner", presence: "online" },
  { id: "m2", name: "Marco Rossi", email: "marco@acme.dev", role: "admin", presence: "busy" },
  { id: "m3", name: "Yuki Tanaka", email: "yuki@acme.dev", role: "member", presence: "away" },
  { id: "m4", name: "Lea Martin", email: "lea@acme.dev", role: "member", presence: "dnd" },
  { id: "m5", name: "Omar Haddad", email: "omar@acme.dev", role: "guest", presence: "oof" },
  { id: "m6", name: "Sofía Núñez", email: "sofia@acme.dev", role: "member", pending: true },
];

export function ProfileScreen() {
  const [members, setMembers] = useState(MEMBERS);
  const [log, setLog] = useState("");
  const [theme, setTheme] = useState<"light" | "dark" | "system">("dark");
  return (
    <Page label="Profile" width="full">
      <AppBar
        size="large"
        collapseOnScroll
        title="Ana López"
        subtitle="Principal designer · Madrid"
        leading={<IconButton icon="arrow-left" label="Back" variant="ghost" />}
        actions={
          <>
            <IconButton icon="magnifying-glass" label="Search" variant="ghost" />
            <AccountMenu
              user={{ id: "ana", name: "Ana López", email: "ana@acme.dev", presence: "online" }}
              accounts={[
                { id: "ana", name: "Ana López", email: "ana@acme.dev" },
                { id: "studio", name: "Studio account", email: "studio@acme.dev" },
              ]}
              items={[
                { id: "profile", label: "Profile", icon: "user" },
                { id: "settings", label: "Settings", icon: "cog" },
              ]}
              theme={theme}
              onThemeChange={setTheme}
              onSignOut={() => setLog("Signed out")}
            />
          </>
        }
        headingLevel={2}
      />
      <ProfileLayout
        header={
          <ProfileHeader
            user={{
              name: "Ana López",
              handle: "ana",
              role: "Principal designer",
              bio: "I design systems that ship. Type nerd, occasional climber, and the person who files the contrast bugs.",
              presence: "online",
            }}
            badges={<Badge tone="accent">Staff</Badge>}
            meta={[
              { icon: "map-pin", label: "Madrid" },
              { icon: "link", label: "ana.design", href: "#" },
              { icon: "calendar", label: "Joined March 2021" },
            ]}
            stats={[
              { label: "Followers", value: "1.2k" },
              { label: "Following", value: 184 },
              { label: "Projects", value: 34 },
            ]}
            actions={
              <>
                <Button icon="chat-bubble-left-right">Message</Button>
                <Button variant="primary" icon="user-plus">
                  Follow
                </Button>
              </>
            }
          />
        }
        aside={
          <>
            <UserCard
              variant="compact"
              user={{ name: "Marco Rossi", handle: "marco", role: "Engineering", bio: "Builds the rendering pipeline.", presence: "busy" }}
              stats={[
                { label: "Reviews", value: 210 },
                { label: "Projects", value: 12 },
              ]}
              actions={<Button size="sm">View profile</Button>}
            />
            <Card>
              <CardHeader title="Team" />
              <div data-testid="pp-group">
                <AvatarGroup
                  max={4}
                  overflow="list"
                  overflowLabel={(n) => `Show ${n} more people`}
                  items={MEMBERS.map((m) => ({ name: m.name, status: m.presence, secondary: m.email }))}
                />
              </div>
              <div className="app-presence">
                <PresenceBadge status="online" showLabel />
                <PresenceBadge status="away" showLabel />
                <PresenceBadge status="dnd" showLabel />
                <PresenceBadge status="oof" showLabel />
                <PresenceBadge
                  status="offline"
                  showLabel
                  lastSeen="2026-11-22T11:00:00Z"
                  now={Date.parse("2026-11-22T14:00:00Z")}
                  locale="en-US"
                />
              </div>
            </Card>
          </>
        }
      >
        <Tabs
          label="Profile sections"
          items={[
            {
              value: "team",
              label: "Team",
              content: (
                <Card>
                  <div data-testid="pp-members">
                    <MemberList
                      title="Design team"
                      editable
                      invitable
                      currentUserId="m1"
                      roles={ROLES}
                      members={members}
                      onRoleChange={({ memberId, role }) => {
                        setMembers((list) => list.map((m) => (m.id === memberId ? { ...m, role } : m)));
                        setLog(`Role of ${memberId}: ${role}`);
                      }}
                      onRemove={({ memberId }) => {
                        setMembers((list) => list.filter((m) => m.id !== memberId));
                        setLog(`Removed ${memberId}`);
                      }}
                      onInvite={() => setLog("Invite")}
                    />
                  </div>
                  <p className="app-muted" data-testid="pp-log">
                    {log || "No changes"}
                  </p>
                </Card>
              ),
            },
            {
              value: "activity",
              label: "Activity",
              content: (
                <Card>
                  <ActivityFeed
                    label="Ana's activity"
                    now="2026-11-22T15:00:00Z"
                    timeZone="UTC"
                    locale="en-US"
                    items={[
                      {
                        id: "p1",
                        actor: { name: "Ana López" },
                        verb: "published",
                        object: "Tokens 2.0 proposal",
                        href: "#",
                        at: "2026-11-22T12:10:00Z",
                      },
                      {
                        id: "p2",
                        actor: { name: "Ana López" },
                        verb: "reviewed",
                        object: "Dashboard grid",
                        href: "#",
                        at: "2026-11-21T16:00:00Z",
                      },
                    ]}
                  />
                </Card>
              ),
            },
            {
              value: "people",
              label: "People",
              content: (
                <Card>
                  <div className="app-people">
                    <Persona name="Ana López" secondary="Principal designer" presence="online" showPresence size="lg" />
                    <Persona name="Marco Rossi" secondary="Engineering" presence="busy" />
                    <Persona name="Yuki Tanaka" secondary="Research" tertiary="Tokyo" presence="away" orientation="vertical" size="lg" />
                  </div>
                </Card>
              ),
            },
          ]}
        />
      </ProfileLayout>
    </Page>
  );
}

export function SettingsScreen() {
  const { toast } = useToast();
  const [mentions, setMentions] = useState(true);
  const [digest, setDigest] = useState("monday");
  const [status, setStatus] = useState<"saving" | "saved" | undefined>(undefined);
  const [dirty, setDirty] = useState(false);
  const [submitted, setSubmitted] = useState<ProfileValues | null>(null);
  const save = (next: boolean) => {
    setMentions(next);
    setStatus("saving");
    setTimeout(() => setStatus("saved"), 300);
  };
  return (
    <Page label="Settings" width="full">
      <SettingsLayout
        title="Settings"
        description="Manage your profile, notifications and workspace."
        nav={[
          { href: "#settings-profile", label: "Profile", icon: "user", current: true },
          { href: "#settings-notifications", label: "Notifications", icon: "bell" },
          { href: "#settings-workspace", label: "Workspace", icon: "building-office" },
          { href: "#settings-danger", label: "Danger zone", icon: "exclamation-triangle" },
        ]}
        dirty={dirty}
        saveBar={
          <>
            <Button variant="ghost" onClick={() => setDirty(false)}>
              Discard
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setDirty(false);
                toast({ title: "Settings saved", intent: "success" });
              }}
              data-testid="st-save"
            >
              Save changes
            </Button>
          </>
        }
      >
        <SettingsSection id="settings-profile" title="Profile" description="How other people see you across the workspace.">
          <div className="app-profile-form" data-testid="st-editor">
            <ProfileEditor
              defaultValues={{
                name: "Ana López",
                handle: "ana",
                email: "ana@acme.dev",
                website: "https://ana.design",
                location: "Madrid",
                bio: "I design systems that ship.",
              }}
              isHandleTaken={(h) => h.toLowerCase() === "admin"}
              onSubmit={(values) => setSubmitted(values)}
            />
          </div>
          <p className="app-muted" data-testid="st-submitted">
            {submitted ? `Saved @${submitted.handle}` : "Not saved yet"}
          </p>
        </SettingsSection>
        <SettingsSection id="settings-notifications" title="Notifications" description="Choose what reaches your inbox.">
          <SettingRow
            htmlFor="st-mentions"
            label="Mentions"
            description="When someone mentions you in a comment."
            status={status}
            control={<Switch id="st-mentions" checked={mentions} onCheckedChange={save} aria-label="Mentions" data-testid="st-mentions" />}
          />
          <SettingRow
            htmlFor="st-digest"
            label="Weekly digest"
            description="A summary of what changed, once a week."
            control={
              <NativeSelect
                id="st-digest"
                block={false}
                value={digest}
                onChange={(e) => {
                  setDigest(e.target.value);
                  setDirty(true);
                }}
                options={[
                  { value: "monday", label: "Monday" },
                  { value: "friday", label: "Friday" },
                  { value: "never", label: "Never" },
                ]}
                data-testid="st-digest"
              />
            }
          />
        </SettingsSection>
        <SettingsSection id="settings-workspace" title="Workspace">
          <SettingRow
            htmlFor="st-public"
            label="Public profiles"
            description="Anyone with the link can see member profiles."
            control={<Switch id="st-public" aria-label="Public profiles" onCheckedChange={() => setDirty(true)} />}
          />
        </SettingsSection>
        <SettingsSection id="settings-danger" title="Danger zone" tone="danger">
          <SettingRow
            danger
            label="Delete workspace"
            description="Removes every project, file and member. This can't be undone."
            control={
              <Button variant="danger" icon="trash">
                Delete
              </Button>
            }
          />
        </SettingsSection>
      </SettingsLayout>
    </Page>
  );
}
