// Conjunto de emojis propio y pequeño para el selector y las reacciones: unos 120, por categorías, con el nombre CLDR en
// inglés (dominio público, de Unicode) y palabras clave. Los emojis se guardan como puntos de código y se construyen al
// usarlos: el texto fuente no lleva emojis. Una aplicación que necesite el juego completo pasa el suyo (o una promesa
// que lo carga a demanda) con la misma forma. Puro.

export interface Emoji {
  /** El emoji como texto. */
  char: string;
  /** Nombre CLDR («thumbs up»): lo que lee un lector de pantalla. */
  name: string;
  keywords: readonly string[];
  /** Admite tono de piel. */
  tone?: boolean;
}

export interface EmojiCategory {
  id: string;
  /** Nombre visible de la categoría (en inglés por defecto; la aplicación lo traduce). */
  label: string;
  /** Icono de la pestaña (zicon). */
  icon: string;
  emojis: readonly Emoji[];
}

export type EmojiSet = readonly EmojiCategory[];

/** Texto de una secuencia de puntos de código en hexadecimal separados por guiones (`2764-fe0f`). */
export const fromCodes = (codes: string) => String.fromCodePoint(...codes.split("-").map((c) => Number.parseInt(c, 16)));

type Row = readonly [codes: string, name: string, keywords: string, tone?: 1];

const RAW: readonly (readonly [id: string, label: string, icon: string, rows: readonly Row[]])[] = [
  [
    "smileys",
    "Smileys",
    "face-smile",
    [
      ["1f600", "grinning face", "happy smile grin"],
      ["1f603", "grinning face with big eyes", "happy joy smile"],
      ["1f604", "grinning face with smiling eyes", "happy laugh smile"],
      ["1f601", "beaming face with smiling eyes", "grin happy"],
      ["1f602", "face with tears of joy", "lol laugh funny"],
      ["1f923", "rolling on the floor laughing", "lol rofl laugh"],
      ["1f60a", "smiling face with smiling eyes", "blush happy"],
      ["1f642", "slightly smiling face", "smile"],
      ["1f609", "winking face", "wink"],
      ["1f607", "smiling face with halo", "angel innocent"],
      ["1f60d", "smiling face with heart-eyes", "love crush"],
      ["1f970", "smiling face with hearts", "love adore"],
      ["1f618", "face blowing a kiss", "kiss love"],
      ["1f60b", "face savoring food", "yum tasty"],
      ["1f61b", "face with tongue", "playful tongue"],
      ["1f914", "thinking face", "hmm think"],
      ["1f928", "face with raised eyebrow", "skeptic doubt"],
      ["1f610", "neutral face", "meh"],
      ["1f644", "face with rolling eyes", "eyeroll"],
      ["1f60f", "smirking face", "smirk"],
      ["1f62e", "face with open mouth", "wow surprised"],
      ["1f632", "astonished face", "shocked amazed"],
      ["1f973", "partying face", "party celebrate"],
      ["1f60e", "smiling face with sunglasses", "cool"],
      ["1f622", "crying face", "sad tear"],
      ["1f62d", "loudly crying face", "sob sad"],
      ["1f621", "enraged face", "angry mad"],
      ["1f631", "face screaming in fear", "scream scared"],
      ["1f634", "sleeping face", "sleep tired"],
      ["1f912", "face with thermometer", "sick ill"],
      ["1f92f", "exploding head", "mind blown"],
    ],
  ],
  [
    "people",
    "People",
    "hand",
    [
      ["1f44d", "thumbs up", "like yes ok +1", 1],
      ["1f44e", "thumbs down", "dislike no -1", 1],
      ["1f44f", "clapping hands", "clap applause bravo", 1],
      ["1f64c", "raising hands", "hooray celebrate", 1],
      ["1f64f", "folded hands", "please thanks pray", 1],
      ["1f44b", "waving hand", "hello hi bye wave", 1],
      ["1f44c", "OK hand", "ok perfect", 1],
      ["270c-fe0f", "victory hand", "peace victory", 1],
      ["1f91d", "handshake", "deal agreement"],
      ["1f4aa", "flexed biceps", "strong muscle", 1],
      ["1f440", "eyes", "look see watch"],
      ["1f937", "person shrugging", "shrug dunno", 1],
      ["1f926", "person facepalming", "facepalm", 1],
    ],
  ],
  [
    "nature",
    "Animals & nature",
    "sun",
    [
      ["1f436", "dog face", "dog puppy pet"],
      ["1f431", "cat face", "cat kitten pet"],
      ["1f98a", "fox", "fox"],
      ["1f43c", "panda", "panda"],
      ["1f981", "lion", "lion"],
      ["1f984", "unicorn", "unicorn magic"],
      ["1f33b", "sunflower", "flower"],
      ["1f339", "rose", "flower love"],
      ["1f332", "evergreen tree", "tree pine"],
      ["1f308", "rainbow", "rainbow"],
      ["2600-fe0f", "sun", "sunny weather"],
      ["1f319", "crescent moon", "moon night"],
      ["26a1", "high voltage", "lightning zap"],
      ["2744-fe0f", "snowflake", "snow cold winter"],
    ],
  ],
  [
    "food",
    "Food & drink",
    "cake",
    [
      ["1f34e", "red apple", "apple fruit"],
      ["1f34b", "lemon", "lemon fruit"],
      ["1f353", "strawberry", "fruit berry"],
      ["1f951", "avocado", "avocado"],
      ["1f355", "pizza", "pizza"],
      ["1f354", "hamburger", "burger"],
      ["1f32e", "taco", "taco mexican"],
      ["1f363", "sushi", "sushi japanese"],
      ["1f369", "doughnut", "donut sweet"],
      ["1f382", "birthday cake", "birthday cake party"],
      ["2615", "hot beverage", "coffee tea"],
      ["1f37a", "beer mug", "beer drink"],
      ["1f377", "wine glass", "wine drink"],
    ],
  ],
  [
    "activities",
    "Activities",
    "trophy",
    [
      ["26bd", "soccer ball", "football sport"],
      ["1f3c0", "basketball", "sport ball"],
      ["1f3be", "tennis", "sport ball"],
      ["1f3ae", "video game", "game controller"],
      ["1f3b8", "guitar", "music rock"],
      ["1f3a8", "artist palette", "art paint"],
      ["1f3c6", "trophy", "win prize"],
      ["1f389", "party popper", "party tada celebrate"],
      ["1f381", "wrapped gift", "present gift"],
      ["1f388", "balloon", "party balloon"],
    ],
  ],
  [
    "travel",
    "Travel & places",
    "globe-alt",
    [
      ["1f697", "automobile", "car drive"],
      ["1f6b2", "bicycle", "bike"],
      ["2708-fe0f", "airplane", "flight plane travel"],
      ["1f680", "rocket", "launch ship"],
      ["1f3e0", "house", "home"],
      ["1f3d6-fe0f", "beach with umbrella", "beach holiday"],
      ["1f5fa-fe0f", "world map", "map travel"],
      ["1f30d", "globe showing Europe-Africa", "world earth"],
    ],
  ],
  [
    "objects",
    "Objects",
    "light-bulb",
    [
      ["1f4f1", "mobile phone", "phone cell"],
      ["1f4bb", "laptop", "computer"],
      ["1f4f7", "camera", "photo"],
      ["1f4a1", "light bulb", "idea"],
      ["1f4da", "books", "book read study"],
      ["270f-fe0f", "pencil", "write edit"],
      ["1f4cc", "pushpin", "pin"],
      ["1f4ce", "paperclip", "attach clip"],
      ["1f512", "locked", "lock secure"],
      ["1f511", "key", "key password"],
      ["23f0", "alarm clock", "alarm time"],
      ["1f4c5", "calendar", "date"],
      ["1f4b0", "money bag", "money cash"],
      ["1f514", "bell", "notification"],
    ],
  ],
  [
    "symbols",
    "Symbols",
    "heart",
    [
      ["2764-fe0f", "red heart", "love heart like"],
      ["1f9e1", "orange heart", "love heart"],
      ["1f49b", "yellow heart", "love heart"],
      ["1f49a", "green heart", "love heart"],
      ["1f499", "blue heart", "love heart"],
      ["1f49c", "purple heart", "love heart"],
      ["1f5a4", "black heart", "love heart"],
      ["1f494", "broken heart", "sad heart"],
      ["1f525", "fire", "fire hot lit"],
      ["2728", "sparkles", "sparkle shiny new"],
      ["1f4af", "hundred points", "100 perfect"],
      ["2705", "check mark button", "done yes ok"],
      ["274c", "cross mark", "no wrong"],
      ["2757", "red exclamation mark", "exclamation important"],
      ["2753", "red question mark", "question"],
    ],
  ],
];

/** Conjunto por defecto de la suite. */
export const EMOJI_SET: EmojiSet = RAW.map(([id, label, icon, rows]) => ({
  id,
  label,
  icon,
  emojis: rows.map(([codes, name, keywords, tone]) => ({
    char: fromCodes(codes),
    name,
    keywords: keywords.split(" "),
    tone: tone === 1 || undefined,
  })),
}));

/** Las seis reacciones rápidas: me gusta, corazón, risa, sorpresa, tristeza, gracias. */
export const QUICK_REACTIONS: readonly string[] = ["1f44d", "2764-fe0f", "1f602", "1f62e", "1f622", "1f64f"].map(fromCodes);

/** Modificadores de tono de piel (Fitzpatrick 1-2 a 6), de claro a oscuro; el primero de la lista es «sin tono». */
export const SKIN_TONES: readonly string[] = ["", ...["1f3fb", "1f3fc", "1f3fd", "1f3fe", "1f3ff"].map(fromCodes)];

/** Aplica un tono a un emoji que lo admite (el modificador va tras el carácter base, antes del selector de variación). */
export function withTone(emoji: Emoji, tone: string): string {
  if (!tone || !emoji.tone) return emoji.char;
  const [base, ...rest] = [...emoji.char];
  return base + tone + rest.filter((c) => c !== "️").join("");
}

const strip = (s: string) => s.replace(/[\u{1f3fb}-\u{1f3ff}️]/gu, "");

/** Nombre de un emoji (con o sin tono ni selector de variación), o el propio texto si no está en el conjunto. */
export function emojiName(char: string, set: EmojiSet = EMOJI_SET): string {
  const want = strip(char);
  for (const cat of set) for (const e of cat.emojis) if (strip(e.char) === want) return e.name;
  return char;
}

/** Emojis cuyo nombre o palabras clave empiezan por (o contienen) lo buscado, los de prefijo primero. */
export function searchEmoji(set: EmojiSet, query: string, limit = 48): Emoji[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const scored: { e: Emoji; s: number; i: number }[] = [];
  let i = 0;
  for (const cat of set)
    for (const e of cat.emojis) {
      const words = [e.name, ...e.keywords].map((w) => w.toLowerCase());
      const s = words.some((w) => w.split(/[\s-]+/).some((p) => p.startsWith(q))) ? 2 : words.some((w) => w.includes(q)) ? 1 : 0;
      if (s) scored.push({ e, s, i });
      i++;
    }
  return scored
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .slice(0, limit)
    .map((x) => x.e);
}

/** Recientes: el elegido al principio, sin repetir, hasta `max`. */
export const pushRecent = (recent: readonly string[], char: string, max = 16) => [char, ...recent.filter((c) => c !== char)].slice(0, max);
