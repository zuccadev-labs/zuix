// Pantalla de mensajería (`?screen=chat`): ChatLayout con la lista de conversaciones, la conversación (cabecera, fijados,
// mensajes, caja de texto) y los detalles. Enviar recorre los estados de entrega y la otra persona escribe y responde;
// subir carga historial; reaccionar, responder, editar y borrar actúan sobre el estado de la pantalla.
import { useEffect, useMemo, useRef, useState } from "react";
import { ChatLayout, type ChatView } from "@zuccadev-labs/zuix-zout";
import {
  Avatar,
  Button,
  CallCard,
  ChatHeader,
  Composer,
  ConversationList,
  IconButton,
  MessageList,
  PinnedBar,
  mergeDelivery,
  toggleReaction,
  type ChatMessage,
  type ComposerSend,
  type ComposerVoice,
  type ConversationItem,
  type MessageListHandle,
} from "@zuccadev-labs/zuix-zui";

const ME = "me";
const NOW = Date.now();
const MIN = 60_000;
const at = (minutesAgo: number) => new Date(NOW - minutesAgo * MIN).toISOString();
const cp = (...codes: number[]) => String.fromCodePoint(...codes);
const THUMBS = cp(0x1f44d);
const HEART = cp(0x2764, 0xfe0f);
const PARTY = cp(0x1f389);
const PEAKS = [3, 6, 9, 5, 8, 4, 2, 7, 9, 6, 3, 5, 8, 9, 4, 3, 6, 7, 5, 2, 4, 8, 6, 3];

const PEOPLE = {
  ana: { name: "Ana López" },
  luis: { name: "Luis Gil" },
  marta: { name: "Marta Ruiz" },
};

const SEED: Record<string, ChatMessage[]> = {
  ana: [
    { id: "a1", authorId: "ana", author: PEOPLE.ana, createdAt: at(60 * 26), text: "Can you send me the release notes before tomorrow?" },
    { id: "a2", authorId: ME, createdAt: at(60 * 26 - 3), text: "Sure, drafting them tonight.", status: "read" },
    {
      id: "a3",
      authorId: "ana",
      author: PEOPLE.ana,
      createdAt: at(52),
      text: "Morning! Did the new build land? The preview looks great on mobile.",
    },
    {
      id: "a4",
      authorId: "ana",
      author: PEOPLE.ana,
      createdAt: at(51),
      attachments: [{ kind: "voice", src: "", duration: 14, peaks: PEAKS, played: false }],
    },
    {
      id: "a5",
      authorId: ME,
      createdAt: at(44),
      text: "It did. Notes are at https://example.com/notes",
      status: "read",
      replyTo: { id: "a3", author: "Ana López", text: "Morning! Did the new build land?" },
      reactions: [{ emoji: THUMBS, count: 1 }],
    },
    {
      id: "a6",
      authorId: ME,
      createdAt: at(43),
      attachments: [{ kind: "file", name: "release-notes.pdf", size: 482_000, type: "PDF" }],
      status: "read",
    },
    {
      id: "a7",
      authorId: "ana",
      author: PEOPLE.ana,
      createdAt: at(30),
      attachments: [
        {
          kind: "location",
          title: "Studio",
          address: "Calle Mayor 12, Madrid",
          href: "https://www.openstreetmap.org/?mlat=40.4168&mlon=-3.7038",
        },
      ],
    },
    {
      id: "a8",
      authorId: "ana",
      author: PEOPLE.ana,
      createdAt: at(29),
      text: "Meet there at 10?",
      reactions: [{ emoji: HEART, count: 1, mine: true }],
    },
    { id: "a9", authorId: ME, createdAt: at(12), text: "Perfect, see you there " + PARTY, status: "delivered", editedAt: at(11) },
  ],
  team: [
    { id: "s1", authorId: "sys", createdAt: at(60 * 3), text: "Marta added Luis", kind: "system" },
    { id: "t1", authorId: "luis", author: PEOPLE.luis, createdAt: at(60 * 3 - 1), text: "Hi all! Where do the new icons live?" },
    {
      id: "t2",
      authorId: "marta",
      author: PEOPLE.marta,
      createdAt: at(60 * 3 - 2),
      text: "In zicon, under src/icons. Run pnpm icons after adding one.",
      thread: { count: 4, lastAt: at(90), participants: [PEOPLE.luis, PEOPLE.ana] },
    },
    { id: "t3", authorId: ME, createdAt: at(60 * 2), text: "I'll pair with you on it this afternoon <@luis>", status: "read" },
    { id: "t4", authorId: "luis", author: PEOPLE.luis, createdAt: at(35), text: "Standup moved to 10:30", forwarded: true },
  ],
  marta: [
    { id: "m1", authorId: "marta", author: PEOPLE.marta, createdAt: at(60 * 24 * 3), text: "Lunch on Friday?" },
    { id: "m2", authorId: ME, createdAt: at(60 * 24 * 3 - 5), text: "See you then", status: "read" },
  ],
};

const OLDER: ChatMessage[] = Array.from({ length: 12 }, (_, i) => ({
  id: `old-${i}`,
  authorId: i % 3 ? "ana" : ME,
  author: i % 3 ? PEOPLE.ana : undefined,
  createdAt: at(60 * 24 * 4 + (12 - i) * 7),
  text: ["Did you see the new tokens?", "Yes, the glass looks better", "Ship it", "Who reviews the docs?"][i % 4]!,
  status: i % 3 ? undefined : "read",
}));

const MEMBERS = [
  { id: "ana", label: "Ana López" },
  { id: "luis", label: "Luis Gil" },
  { id: "marta", label: "Marta Ruiz" },
];

const REPLIES = ["Sounds good!", "On my way", "Got it, thanks " + THUMBS, "Let me check and get back to you"];

const CHATS: ConversationItem[] = [
  { id: "ana", title: "Ana López", presence: "online", pinned: true },
  { id: "team", title: "Design team", group: true, unread: 3, mention: true },
  { id: "marta", title: "Marta Ruiz", presence: "away" },
  { id: "ops", title: "Ops alerts", muted: true, unread: 12, lastMessage: "Deploy finished in 4 min", lastAt: at(60 * 5) },
  { id: "eva", title: "Eva Martín", lastMessage: "Thanks!", lastAt: at(60 * 24 * 9), draft: "Will send the photos" },
];

let seq = 0;
const nextId = () => `n${++seq}-${Date.now().toString(36)}`;

export function ChatScreen() {
  const [threads, setThreads] = useState(SEED);
  const [chatId, setChatId] = useState("ana");
  const [view, setView] = useState<ChatView>("conversation");
  const [details, setDetails] = useState(false);
  const [replyTo, setReplyTo] = useState<{ id: string; author?: string; text?: string } | null>(null);
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [typing, setTyping] = useState<string | null>(null);
  const [hasOlder, setHasOlder] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [call, setCall] = useState<"incoming" | "ongoing" | null>(null);
  const [startedAt, setStartedAt] = useState<number | undefined>(undefined);
  const list = useRef<MessageListHandle>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const later = (ms: number, fn: () => void) => timers.current.push(setTimeout(fn, ms));

  const messages = threads[chatId] ?? [];
  const isGroup = chatId === "team";
  const contact = CHATS.find((c) => c.id === chatId)!;

  const update = (id: string, change: (m: ChatMessage) => ChatMessage, thread = chatId) =>
    setThreads((all) => ({ ...all, [thread]: (all[thread] ?? []).map((m) => (m.id === id ? change(m) : m)) }));
  const append = (m: ChatMessage, thread = chatId) => setThreads((all) => ({ ...all, [thread]: [...(all[thread] ?? []), m] }));

  // Lo que se envía pasa por enviando → enviado → entregado → leído, y la otra persona responde.
  const deliver = (id: string, thread: string) => {
    later(500, () => update(id, (m) => ({ ...m, status: mergeDelivery(m.status, "sent") }), thread));
    later(1100, () => update(id, (m) => ({ ...m, status: mergeDelivery(m.status, "delivered") }), thread));
    later(2200, () => update(id, (m) => ({ ...m, status: mergeDelivery(m.status, "read") }), thread));
    if (thread === "marta" || thread === "team") return;
    later(2600, () => setTyping(thread));
    later(4600, () => {
      setTyping(null);
      append(
        { id: nextId(), authorId: "ana", author: PEOPLE.ana, createdAt: new Date().toISOString(), text: REPLIES[seq % REPLIES.length] },
        thread,
      );
    });
  };

  const send = ({ text, attachments }: ComposerSend) => {
    if (editing) {
      update(editing.id, (m) => ({ ...m, text, editedAt: new Date().toISOString() }));
      setEditing(null);
      return;
    }
    const id = nextId();
    append({
      id,
      authorId: ME,
      createdAt: new Date().toISOString(),
      text: text || undefined,
      status: "sending",
      replyTo: replyTo ?? undefined,
      attachments: attachments.map((f) =>
        f.preview && f.type?.startsWith("image/")
          ? { kind: "image" as const, src: f.preview, alt: f.name }
          : { kind: "file" as const, name: f.name, size: f.size, type: f.type?.split("/")[1]?.toUpperCase() },
      ),
    });
    setReplyTo(null);
    deliver(id, chatId);
  };

  const voice = ({ blob, duration, peaks }: ComposerVoice) => {
    const id = nextId();
    append({
      id,
      authorId: ME,
      createdAt: new Date().toISOString(),
      status: "sending",
      attachments: [{ kind: "voice", src: URL.createObjectURL(blob), duration, peaks }],
    });
    deliver(id, chatId);
  };

  const loadOlder = () => {
    if (loadingOlder || !hasOlder || chatId !== "ana") return;
    setLoadingOlder(true);
    later(700, () => {
      setThreads((all) => ({ ...all, ana: [...OLDER, ...(all.ana ?? [])] }));
      setLoadingOlder(false);
      setHasOlder(false);
    });
  };

  const items: ConversationItem[] = useMemo(
    () =>
      CHATS.map((c) => {
        const thread = threads[c.id];
        const last = thread?.filter((m) => m.kind !== "system").at(-1);
        if (!last) return c;
        return {
          ...c,
          lastAt: last.createdAt,
          lastMessage: last.deletedAt
            ? "This message was deleted"
            : (last.text ??
              (last.attachments?.[0]?.kind === "voice"
                ? "Voice message"
                : last.attachments?.[0]?.kind === "location"
                  ? "Location"
                  : "File")),
          lastMine: last.authorId === ME,
          lastAuthor: c.group && last.authorId !== ME ? last.author?.name.split(" ")[0] : undefined,
          status: last.status,
          unread: c.id === chatId ? 0 : c.unread,
          typing: typing === c.id ? [PEOPLE.ana.name] : undefined,
        };
      }),
    [threads, typing, chatId],
  );

  const open = (id: string) => {
    setChatId(id);
    setReplyTo(null);
    setEditing(null);
    setView("conversation");
  };

  const header = (
    <ChatHeader
      title={contact.title}
      titleId="chat-title"
      presence={contact.presence}
      presenceLabel={contact.presence === "online" ? "Online" : contact.presence === "away" ? "Away" : undefined}
      status={
        typing === chatId
          ? `${isGroup ? "Ana is " : ""}typing…`
          : isGroup
            ? "Ana, Luis, Marta, you"
            : contact.presence === "online"
              ? "online"
              : "last seen today at 09:12"
      }
      statusTone={typing === chatId || contact.presence === "online" ? "accent" : "muted"}
      onBack={() => setView("list")}
      backLabel="Back to chats"
      onTitleClick={() => {
        setDetails(true);
        setView("details");
      }}
      actions={
        <>
          <IconButton icon="phone" label="Voice call" data-testid="c-call" onClick={() => setCall("incoming")} />
          <IconButton icon="video-camera" label="Video call" />
          <IconButton
            icon="information-circle"
            label="Details"
            active={details}
            onClick={() => {
              setDetails(!details);
              setView(details ? "conversation" : "details");
            }}
          />
        </>
      }
    />
  );

  return (
    <div className="app-chat" data-testid="c-chat">
      <ChatLayout
        view={view}
        onViewChange={setView}
        history
        detailsOpen={details}
        list={
          <>
            <div className="app-chat__list-head">
              <h1 className="app-chat__title">Chats</h1>
              <IconButton icon="pencil-square" label="New chat" />
            </div>
            <div data-testid="c-list" className="app-chat__fill">
              <ConversationList items={items} selectedId={chatId} locale="en" onSelect={({ id }) => open(id)} />
            </div>
          </>
        }
        details={
          <div className="app-chat__details" data-testid="c-details">
            <Avatar name={contact.title} size="xl" status={contact.presence} />
            <h2 className="app-chat__details-name">{contact.title}</h2>
            <p className="app-muted">{isGroup ? "3 members" : "Product designer · Madrid"}</p>
            <Button size="sm" icon="phone" onClick={() => setCall("incoming")}>
              Simulate incoming call
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setDetails(false)}>
              Close details
            </Button>
          </div>
        }
      >
        {header}
        {chatId === "team" ? (
          <PinnedBar
            unpinnable
            items={[
              { id: "t2", author: "Marta", text: "In zicon, under src/icons. Run pnpm icons after adding one." },
              { id: "t4", author: "Luis", text: "Standup moved to 10:30" },
            ]}
            onJump={({ id }) => list.current?.jumpTo(id)}
          />
        ) : null}
        <div data-testid="c-messages" className="app-chat__messages">
          <MessageList
            key={chatId}
            ref={list}
            messages={messages}
            currentUserId={ME}
            locale="en"
            group={isGroup}
            mentions={MEMBERS}
            label={`Messages with ${contact.title}`}
            unreadFrom={chatId === "team" ? "t3" : undefined}
            hasOlder={chatId === "ana" && hasOlder}
            loadingOlder={loadingOlder}
            onLoadOlder={loadOlder}
            typing={typing === chatId ? [PEOPLE.ana] : []}
            composer="chat-composer"
            onReact={({ id, emoji }) => update(id, (m) => ({ ...m, reactions: toggleReaction(m.reactions ?? [], emoji) }))}
            onReply={({ id }) => {
              const m = messages.find((x) => x.id === id);
              setEditing(null);
              setReplyTo({ id, author: m?.authorId === ME ? "You" : m?.author?.name, text: m?.text ?? "Attachment" });
            }}
            onEdit={({ id }) => {
              const m = messages.find((x) => x.id === id);
              if (m?.text) setEditing({ id, text: m.text });
            }}
            onDelete={({ id }) => update(id, (m) => ({ ...m, deletedAt: new Date().toISOString() }))}
            onRetry={({ id }) => {
              update(id, (m) => ({ ...m, status: "sending" }));
              deliver(id, chatId);
            }}
          />
        </div>
        <div data-testid="c-composer">
          <Composer
            id="chat-composer"
            voice
            replyTo={replyTo ?? undefined}
            editing={editing ?? undefined}
            mentions={{ items: MEMBERS }}
            onCancelReply={() => setReplyTo(null)}
            onCancelEdit={() => setEditing(null)}
            onSend={send}
            onVoice={voice}
          />
        </div>
      </ChatLayout>
      {call ? (
        <div className="app-chat__call" data-testid="c-callcard">
          <CallCard
            kind={call}
            caller={PEOPLE.ana}
            startedAt={startedAt}
            onAccept={() => {
              setStartedAt(Date.now());
              setCall("ongoing");
            }}
            onDecline={() => setCall(null)}
            onHangUp={() => setCall(null)}
          />
        </div>
      ) : null}
    </div>
  );
}
