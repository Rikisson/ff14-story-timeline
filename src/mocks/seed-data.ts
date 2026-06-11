import {
  Calendar,
  FF14_CALENDAR_PRESET,
  FF14_ERA_SEVENTH_UMBRAL_ID,
  FF14_ERA_SIXTH_ASTRAL_ID,
} from '@features/calendar';
import { Character } from '@features/characters';
import { CodexCategoriesConfig, CodexEntry } from '@features/codex';
import { TimelineEvent } from '@features/events';
import { Place } from '@features/places';
import { Plotline } from '@features/plotlines';
import { Story, StoryContent } from '@features/stories';
import { SEED_AUTHOR_UID } from './seed-author';

export type SeedStory = Story & StoryContent;

const SEED_CREATED_AT = 1777593600000;

export const SEED_CALENDAR: Calendar = {
  ...FF14_CALENDAR_PRESET,
  updatedAt: SEED_CREATED_AT,
};

export const SEED_CODEX_CATEGORIES: CodexCategoriesConfig = {
  categories: [
    { id: 'cat-race', key: 'race', label: 'Race', color: '#8b5cf6', description: 'Species or peoples.' },
    { id: 'cat-job', key: 'job', label: 'Job', color: '#06b6d4', description: 'Class, profession, or trade.' },
    { id: 'cat-lore', key: 'lore', label: 'Lore', color: '#f59e0b', description: 'World concepts and phenomena.' },
    { id: 'cat-item', key: 'item', label: 'Item', color: '#ea580c', description: 'Objects, artifacts, trade goods.' },
    { id: 'cat-faction', key: 'faction', label: 'Faction', color: '#e11d48', description: 'Organisations, houses, cabals.' },
    { id: 'cat-history', key: 'history', label: 'History', color: '#71717a', description: 'Past events and eras.' },
  ],
  version: 1,
  updatedAt: SEED_CREATED_AT,
};

export const SEED_CHARACTERS: Character[] = [
  {
    id: 'char-ingrid',
    slug: 'ingrid',
    name: 'Ingrid',
    description:
      'Bound to House Brann as a girl and nearly destroyed when Sakuya cut the household down. Carries the marks of her former master — sun-shy, amber-eyed, careful with shadows.',
    relatedRefs: [
      { kind: 'codexEntry', id: 'codex-job-rogue' },
      { kind: 'codexEntry', id: 'codex-race-hyur' },
      { kind: 'codexEntry', id: 'codex-voidsent-taint' },
      { kind: 'character', id: 'char-marcus' },
      { kind: 'character', id: 'char-zahir' },
      { kind: 'place', id: 'place-uldah-pearl-lane' },
    ],
    authorUid: SEED_AUTHOR_UID,
    createdAt: SEED_CREATED_AT,
  },
  {
    id: 'char-marcus',
    slug: 'marcus',
    name: 'Marcus',
    description:
      "Has run the Pearl Lane stall for forty years. Knows everyone worth knowing in Ul'dah and a great many who would rather not be known.",
    relatedRefs: [
      { kind: 'codexEntry', id: 'codex-job-merchant' },
      { kind: 'codexEntry', id: 'codex-race-hyur' },
      { kind: 'place', id: 'place-uldah-pearl-lane' },
    ],
    authorUid: SEED_AUTHOR_UID,
    createdAt: SEED_CREATED_AT,
  },
  {
    id: 'char-brann',
    slug: 'brann',
    name: 'Brann',
    description:
      'Built a manse at the edge of Ishgard on quiet Syndicate dealings. Drew the notice of the Far East with one bargain too many.',
    relatedRefs: [
      { kind: 'codexEntry', id: 'codex-job-voidwalker' },
      { kind: 'codexEntry', id: 'codex-race-hyur' },
      { kind: 'place', id: 'place-ishgard' },
    ],
    authorUid: SEED_AUTHOR_UID,
    createdAt: SEED_CREATED_AT,
  },
  {
    id: 'char-sakuya',
    slug: 'sakuya',
    name: 'Sakuya',
    description:
      'Survived the fall of Doma as a child. Trained in exile. Came west following a trail that ended in House Brann.',
    relatedRefs: [
      { kind: 'codexEntry', id: 'codex-job-samurai' },
      { kind: 'codexEntry', id: 'codex-race-au-ra' },
    ],
    authorUid: SEED_AUTHOR_UID,
    createdAt: SEED_CREATED_AT,
  },
  {
    id: 'char-zahir',
    slug: 'zahir',
    name: 'Zahir',
    description:
      "Served the house long before Brann turned to the void. Disappeared the night of the attack; whispers place him near the Northern Shroud.",
    relatedRefs: [
      { kind: 'codexEntry', id: 'codex-job-dark-knight' },
      { kind: 'codexEntry', id: 'codex-race-hyur' },
      { kind: 'character', id: 'char-ingrid' },
    ],
    authorUid: SEED_AUTHOR_UID,
    createdAt: SEED_CREATED_AT,
  },
];

export const SEED_PLACES: Place[] = [
  {
    id: 'place-thanalan',
    slug: 'thanalan',
    name: 'Thanalan',
    description: 'The southern desert region of Eorzea — amber dunes, sandstone steppes, and the coin-bright city of Ul’dah at its heart.',
    authorUid: SEED_AUTHOR_UID,
    createdAt: SEED_CREATED_AT,
  },
  {
    id: 'place-coerthas-central-highlands',
    slug: 'coerthas-central-highlands',
    name: 'Coerthas Central Highlands',
    description: 'A snowbound plateau north of Eorzea, walled by stone and bell-towers. Home to Ishgard and the long winter that followed the Calamity.',
    authorUid: SEED_AUTHOR_UID,
    createdAt: SEED_CREATED_AT,
  },
  {
    id: 'place-far-east',
    slug: 'far-east',
    name: 'Far East',
    description: 'The eastern continent of Othard — Yanxia, the Ruby Sea, and the contested provinces under Garlean shadow.',
    authorUid: SEED_AUTHOR_UID,
    createdAt: SEED_CREATED_AT,
  },
  {
    id: 'place-yanxia',
    slug: 'yanxia',
    name: 'Yanxia',
    description: 'Doman homeland — paddy terraces, mist-bound mountains, and a resistance that never quite died.',
    relatedRefs: [{ kind: 'place', id: 'place-far-east' }],
    authorUid: SEED_AUTHOR_UID,
    createdAt: SEED_CREATED_AT,
  },
  {
    id: 'place-black-shroud',
    slug: 'black-shroud',
    name: 'Black Shroud',
    description: 'The wood that swallows the unwary. Gridania holds its southern edge; the Northern Shroud belongs to elementals and older things.',
    authorUid: SEED_AUTHOR_UID,
    createdAt: SEED_CREATED_AT,
  },
  {
    id: 'place-uldah-pearl-lane',
    slug: 'uldah-pearl-lane',
    name: "Pearl Lane, Ul'dah",
    description:
      "Where official commerce thins and the back-channel trade thickens. Marcus's spice stall holds the corner closest to the alley.",
    relatedRefs: [
      { kind: 'place', id: 'place-thanalan' },
      { kind: 'codexEntry', id: 'codex-faction-syndicate' },
      { kind: 'codexEntry', id: 'codex-faction-immortal-flames' },
    ],
    authorUid: SEED_AUTHOR_UID,
    createdAt: SEED_CREATED_AT,
  },
  {
    id: 'place-ishgard',
    slug: 'ishgard',
    name: 'Ishgard',
    description:
      'High-house seats and stone-vaulted halls. Bells from the cathedrals still mark the hours over the snow.',
    relatedRefs: [
      { kind: 'place', id: 'place-coerthas-central-highlands' },
      { kind: 'codexEntry', id: 'codex-faction-house-fortemps' },
      { kind: 'codexEntry', id: 'codex-faction-temple-knights' },
    ],
    authorUid: SEED_AUTHOR_UID,
    createdAt: SEED_CREATED_AT,
  },
  {
    id: 'place-doma',
    slug: 'doma',
    name: 'Doma',
    description:
      'Once a kingdom, now a contested province. The Liberation Front operates from its high villages and rice-terrace hamlets.',
    relatedRefs: [
      { kind: 'place', id: 'place-yanxia' },
      { kind: 'codexEntry', id: 'codex-faction-doman-liberation-front' },
    ],
    authorUid: SEED_AUTHOR_UID,
    createdAt: SEED_CREATED_AT,
  },
  {
    id: 'place-gridania-northern-shroud',
    slug: 'gridania-northern-shroud',
    name: 'Gridania & the Northern Shroud',
    description:
      "Gridania holds the south; the Northern Shroud climbs into wilds where the elementals' grip loosens. Travelers who slip past the wood wailers can vanish for years.",
    relatedRefs: [
      { kind: 'place', id: 'place-black-shroud' },
      { kind: 'codexEntry', id: 'codex-faction-twin-adder' },
      { kind: 'codexEntry', id: 'codex-faction-wood-wailers' },
    ],
    authorUid: SEED_AUTHOR_UID,
    createdAt: SEED_CREATED_AT,
  },
];

export const SEED_PLOTLINES: Plotline[] = [
  {
    id: 'plotline-ingrid-flight',
    slug: 'ingrid-flight',
    title: "Ingrid's Flight",
    description:
      'Ingrid escapes the destruction of her former master and rebuilds a quiet life in Ul’dah, all while searching for what remains of those nights.',
    color: '#6366f1',
    status: 'active',
    authorUid: SEED_AUTHOR_UID,
    createdAt: SEED_CREATED_AT,
  },
  {
    id: 'plotline-doman-liberation',
    slug: 'doman-liberation',
    title: 'Doman Liberation',
    description: 'The Doman resistance regroups in exile and prepares to retake the homeland.',
    color: '#10b981',
    status: 'planned',
    authorUid: SEED_AUTHOR_UID,
    createdAt: SEED_CREATED_AT,
  },
  {
    id: 'plotline-calamity-aftermath',
    slug: 'calamity-aftermath',
    title: 'Calamity Aftermath',
    description: 'The years immediately following Bahamut’s release and the realm’s slow recovery.',
    color: '#f59e0b',
    status: 'resolved',
    authorUid: SEED_AUTHOR_UID,
    createdAt: SEED_CREATED_AT,
  },
];

export const SEED_CODEX_ENTRIES: CodexEntry[] = [
  {
    id: 'codex-item-doman-tea',
    slug: 'doman-tea',
    title: 'Doman Tea',
    categoryKey: 'item',
    description: 'Genuine leaf from the Far East. Harder to obtain since the Garlean withdrawal.',
    relatedRefs: [
      { kind: 'place', id: 'place-doma' },
      { kind: 'character', id: 'char-marcus' },
    ],
    authorUid: SEED_AUTHOR_UID,
    createdAt: SEED_CREATED_AT,
  },
  {
    id: 'codex-item-ingrid-daggers',
    slug: 'ingrid-daggers',
    title: "Ingrid's Daggers",
    categoryKey: 'item',
    description: 'A matched pair carried since the night she fled Ishgard.',
    relatedRefs: [{ kind: 'character', id: 'char-ingrid' }],
    authorUid: SEED_AUTHOR_UID,
    createdAt: SEED_CREATED_AT,
  },
  {
    id: 'codex-item-brann-signet',
    slug: 'brann-signet',
    title: "Brann's Signet",
    categoryKey: 'item',
    description: 'A heavy silver signet bearing the mark of his house. Lost on the night of the attack.',
    relatedRefs: [{ kind: 'character', id: 'char-brann' }],
    authorUid: SEED_AUTHOR_UID,
    createdAt: SEED_CREATED_AT,
  },
  {
    id: 'codex-faction-syndicate',
    slug: 'syndicate',
    title: 'Syndicate',
    categoryKey: 'faction',
    description: 'The shadow council that quietly steers Ul’dahn commerce.',
    relatedRefs: [
      { kind: 'place', id: 'place-uldah-pearl-lane' },
      { kind: 'character', id: 'char-marcus' },
    ],
    authorUid: SEED_AUTHOR_UID,
    createdAt: SEED_CREATED_AT,
  },
  {
    id: 'codex-faction-doman-liberation-front',
    slug: 'doman-liberation-front',
    title: 'Doman Liberation Front',
    categoryKey: 'faction',
    description: 'Survivors of fallen Doma, scattered but unbroken.',
    relatedRefs: [
      { kind: 'place', id: 'place-doma' },
      { kind: 'character', id: 'char-sakuya' },
    ],
    authorUid: SEED_AUTHOR_UID,
    createdAt: SEED_CREATED_AT,
  },
  {
    id: 'codex-faction-house-fortemps',
    slug: 'house-fortemps',
    title: 'House Fortemps',
    categoryKey: 'faction',
    description: 'A high house of Ishgard, keepers of long oaths.',
    relatedRefs: [{ kind: 'place', id: 'place-ishgard' }],
    authorUid: SEED_AUTHOR_UID,
    createdAt: SEED_CREATED_AT,
  },
  {
    id: 'codex-faction-immortal-flames',
    slug: 'immortal-flames',
    title: 'Immortal Flames',
    categoryKey: 'faction',
    description: 'Ul’dah’s standing army and city guard.',
    authorUid: SEED_AUTHOR_UID,
    createdAt: SEED_CREATED_AT,
  },
  {
    id: 'codex-faction-temple-knights',
    slug: 'temple-knights',
    title: 'Temple Knights',
    categoryKey: 'faction',
    description: 'Ishgard’s cathedral guard — sworn to the Holy See, drilled in winter cold.',
    authorUid: SEED_AUTHOR_UID,
    createdAt: SEED_CREATED_AT,
  },
  {
    id: 'codex-faction-twin-adder',
    slug: 'twin-adder',
    title: 'Order of the Twin Adder',
    categoryKey: 'faction',
    description: 'Gridania’s standing force, sworn to the Elder Seedseer and the elementals of the Shroud.',
    authorUid: SEED_AUTHOR_UID,
    createdAt: SEED_CREATED_AT,
  },
  {
    id: 'codex-faction-wood-wailers',
    slug: 'wood-wailers',
    title: 'Wood Wailers',
    categoryKey: 'faction',
    description: 'Border keepers of the Black Shroud — half guard, half ranger, all eye and ear for the wood.',
    authorUid: SEED_AUTHOR_UID,
    createdAt: SEED_CREATED_AT,
  },
  {
    id: 'codex-race-hyur',
    slug: 'hyur',
    title: 'Hyur',
    categoryKey: 'race',
    description: 'The most populous race of Eorzea — adaptable, ambitious, scattered across every climate and station.',
    authorUid: SEED_AUTHOR_UID,
    createdAt: SEED_CREATED_AT,
  },
  {
    id: 'codex-race-au-ra',
    slug: 'au-ra',
    title: 'Au Ra',
    categoryKey: 'race',
    description: 'A scaled people of the Far East — Raen and Xaela by lineage, marked by horns and a long memory.',
    authorUid: SEED_AUTHOR_UID,
    createdAt: SEED_CREATED_AT,
  },
  {
    id: 'codex-job-rogue',
    slug: 'rogue',
    title: 'Rogue',
    categoryKey: 'job',
    description: 'A blade-and-shadow trade. Rogues work in the spaces commerce and law would rather not see.',
    authorUid: SEED_AUTHOR_UID,
    createdAt: SEED_CREATED_AT,
  },
  {
    id: 'codex-job-merchant',
    slug: 'merchant',
    title: 'Merchant',
    categoryKey: 'job',
    description: 'Stallholders, brokers, and the quiet middlemen of every realm. The ledger is the merchant\'s blade.',
    authorUid: SEED_AUTHOR_UID,
    createdAt: SEED_CREATED_AT,
  },
  {
    id: 'codex-job-voidwalker',
    slug: 'voidwalker',
    title: 'Voidwalker',
    categoryKey: 'job',
    description: 'Practitioners who deal in voidsent contracts. The cost of the bargain is rarely paid by the bargainer.',
    authorUid: SEED_AUTHOR_UID,
    createdAt: SEED_CREATED_AT,
  },
  {
    id: 'codex-job-samurai',
    slug: 'samurai',
    title: 'Samurai',
    categoryKey: 'job',
    description: 'Doman blade-discipline. A craft of stillness, exact strikes, and oaths that outlast the wielder.',
    authorUid: SEED_AUTHOR_UID,
    createdAt: SEED_CREATED_AT,
  },
  {
    id: 'codex-job-dark-knight',
    slug: 'dark-knight',
    title: 'Dark Knight',
    categoryKey: 'job',
    description: 'Sworn blades who pay their debts in shadow. Often hired, rarely trusted, never quite free of the bond.',
    authorUid: SEED_AUTHOR_UID,
    createdAt: SEED_CREATED_AT,
  },
  {
    id: 'codex-voidsent-taint',
    slug: 'voidsent-taint',
    title: 'Voidsent Taint',
    categoryKey: 'lore',
    description: 'A lingering corruption left by prolonged contact with voidsent kin. Survivors carry sensitivity to sunlight, faintly altered eye color, and an instinctive drift toward shadow.',
    relatedRefs: [
      { kind: 'character', id: 'char-ingrid' },
      { kind: 'character', id: 'char-brann' },
    ],
    authorUid: SEED_AUTHOR_UID,
    createdAt: SEED_CREATED_AT,
  },
  {
    id: 'codex-the-echo',
    slug: 'the-echo',
    title: 'The Echo',
    categoryKey: 'lore',
    description: 'A rare gift that lets the bearer glimpse memories not their own. Those who carry it are drawn into greater currents of fate whether they wish it or not.',
    authorUid: SEED_AUTHOR_UID,
    createdAt: SEED_CREATED_AT,
  },
  {
    id: 'codex-calamity',
    slug: 'seventh-umbral-calamity',
    title: 'The Seventh Umbral Calamity',
    categoryKey: 'history',
    description: '${ev:event-seventh-umbral-calamity}[The cataclysm] that ended the Sixth Astral Era and reshaped Eorzea. Five years on, the realm still measures its losses.',
    authorUid: SEED_AUTHOR_UID,
    createdAt: SEED_CREATED_AT,
  },
];

export const SEED_EVENTS: TimelineEvent[] = [
  {
    id: 'event-seventh-umbral-calamity',
    slug: 'seventh-umbral-calamity',
    name: 'Calamity of the Seventh Umbral Era',
    description:
      'Dalamud crashes into Eorzea, releasing Bahamut and devastating the realm. Marks the close of the Sixth Astral Era and the start of the Seventh Umbral Era.',
    inGameDate: { era: FF14_ERA_SIXTH_ASTRAL_ID, year: 1572 },
    relatedRefs: [
      { kind: 'place', id: 'place-uldah-pearl-lane' },
      { kind: 'place', id: 'place-gridania-northern-shroud' },
    ],
    plotlineRefs: [{ kind: 'plotline', id: 'plotline-calamity-aftermath' }],
    authorUid: SEED_AUTHOR_UID,
    createdAt: SEED_CREATED_AT,
  },
  {
    id: 'event-fall-of-doma',
    slug: 'fall-of-doma',
    name: 'Fall of Doma',
    description:
      'Garlean forces overrun ${pl:place-doma}[Doma], scattering its people and pushing the resistance into hiding. The defeat shapes the trajectory of the ${cx:codex-faction-doman-liberation-front}[Doman Liberation Front] for years to come.',
    inGameDate: { era: FF14_ERA_SIXTH_ASTRAL_ID, year: 1557 },
    relatedRefs: [
      { kind: 'character', id: 'char-sakuya' },
      { kind: 'place', id: 'place-doma' },
    ],
    plotlineRefs: [{ kind: 'plotline', id: 'plotline-doman-liberation' }],
    authorUid: SEED_AUTHOR_UID,
    createdAt: SEED_CREATED_AT,
  },
  {
    id: 'event-brann-house-attack',
    slug: 'brann-house-attack',
    name: "Attack on Brann's house",
    description:
      "The night ${ch:char-sakuya}[Sakuya]'s blade ended ${ch:char-brann}[Brann]'s reign — and nearly ${ch:char-ingrid}[Ingrid]'s existence. Survivors fled toward the ${pl:place-gridania-northern-shroud}[Black Shroud]; Ingrid's path to ${pl:place-uldah-pearl-lane}[Ul'dah] began here. Five years on, the attack is still felt — see ${ev:event-seventh-umbral-calamity}[the Calamity] for the era it closed.",
    inGameDate: { era: FF14_ERA_SEVENTH_UMBRAL_ID, year: 5 },
    relatedRefs: [
      { kind: 'character', id: 'char-ingrid' },
      { kind: 'character', id: 'char-brann' },
      { kind: 'character', id: 'char-sakuya' },
      { kind: 'character', id: 'char-zahir' },
      { kind: 'place', id: 'place-ishgard' },
      { kind: 'place', id: 'place-gridania-northern-shroud' },
    ],
    plotlineRefs: [
      { kind: 'plotline', id: 'plotline-ingrid-flight' },
      { kind: 'plotline', id: 'plotline-calamity-aftermath' },
    ],
    authorUid: SEED_AUTHOR_UID,
    createdAt: SEED_CREATED_AT,
  },
  // Filler events for pagination testing — keep the meaningful 3 above by
  // using strictly older createdAt values so orderBy('createdAt','desc') ranks
  // them last.
  ...Array.from(
    { length: 72 },
    (_, i): TimelineEvent => ({
      id: `event-filler-${String(i + 1).padStart(2, '0')}`,
      slug: `filler-event-${String(i + 1).padStart(2, '0')}`,
      name: `Filler event ${i + 1}`,
      description: `Auto-generated filler entry #${i + 1} for pagination testing.`,
      inGameDate: {},
      authorUid: SEED_AUTHOR_UID,
      createdAt: SEED_CREATED_AT - (i + 1) * 1000,
    }),
  ),
];

export const SEED_STORY: SeedStory = {
  id: 'story-shadows-and-provisions',
  slug: 'shadows-and-provisions',
  title: 'Shadows and Provisions',
  description:
    "A short, character-driven scene set five years after ${ev:event-seventh-umbral-calamity}[the Calamity]. ${ch:char-ingrid}[Ingrid] surfaces just long enough to ask the question that has haunted her since ${ev:event-brann-house-attack}[the night the blade fell] — whether ${ch:char-zahir}[Zahir], the only person who ever taught her anything worth keeping, survived the same fire she did. Part of the ${pt:plotline-ingrid-flight}[Ingrid's Flight] arc.",
  inGameDate: {
    era: FF14_ERA_SEVENTH_UMBRAL_ID,
    year: 8,
    hour: 17,
    display: 'Year 8 of the Seventh Umbral Era, late afternoon',
  },
  relatedRefs: [
    { kind: 'character', id: 'char-ingrid' },
    { kind: 'character', id: 'char-marcus' },
    { kind: 'character', id: 'char-brann' },
    { kind: 'character', id: 'char-sakuya' },
    { kind: 'character', id: 'char-zahir' },
    { kind: 'place', id: 'place-uldah-pearl-lane' },
    { kind: 'place', id: 'place-ishgard' },
    { kind: 'place', id: 'place-doma' },
    { kind: 'place', id: 'place-gridania-northern-shroud' },
  ],
  plotlineRefs: [{ kind: 'plotline', id: 'plotline-ingrid-flight' }],
  defaultEntrySceneId: 's01_opening',
  authorUid: SEED_AUTHOR_UID,
  draft: false,
  createdAt: SEED_CREATED_AT,
  publishedAt: SEED_CREATED_AT,
  scenes: {
    s01_opening: {
      text: "The amber glow of Ul'dah's sun cast long shadows through the ${pl:place-uldah-pearl-lane}[Pearl Lane], and ${ch:char-ingrid}[Ingrid] found herself unconsciously seeking them as she moved between the market stalls. The late afternoon light made her skin prickle with discomfort, though she endured it better than most of her kind — a small mercy from her former master's tainted blood.",
      position: { x: 0, y: 0 },
      characters: [],
      next: [{ sceneId: 's02_intro' }],
    },
    s02_intro: {
      text: "Her dark hair caught the light as she paused before a spice merchant's stall, amber eyes — carefully maintained in their human hue — scanning the exotic imports. Three years had passed since ${ch:char-sakuya}[Sakuya]'s blade had ended ${ch:char-brann}[Brann]'s reign and nearly ended ${ch:char-ingrid}[Ingrid]'s existence as well. Only her mistress's unexpected mercy had spared her.",
      position: { x: 320, y: 0 },
      characters: [],
      next: [{ sceneId: 's03_voice' }],
    },
    s03_voice: {
      speaker: 'Marcus',
      text: "Ingrid? By Nald'thal's scales, is that really you?",
      position: { x: 640, y: 0 },
      characters: [],
      next: [{ sceneId: 's04_recognize' }],
    },
    s04_recognize: {
      text: 'She turned at the familiar voice. An elderly Hyur stood between the stalls, his weathered face lined with age but his eyes still bright with the sharp intelligence of his youth. Marcus moved with surprising vigor for a man nearing eighty summers, his merchant\'s robes dusty from the road.',
      position: { x: 960, y: 0 },
      characters: [],
      next: [{ sceneId: 's05_thought_dead' }],
    },
    s05_thought_dead: {
      speaker: 'Marcus',
      text: 'I thought... three years ago, when we heard about what happened... I was certain you were... By the Twelve, I thought you were dead.',
      position: { x: 1280, y: 0 },
      characters: [],
      next: [{ sceneId: 's06_greet_back' }],
    },
    s06_greet_back: {
      speaker: 'Ingrid',
      text: 'Marcus. Still trading in the spaces between official commerce, I see.',
      position: { x: 1600, y: 0 },
      characters: [],
      next: [{ sceneId: 's07_history' }],
    },
    s07_history: {
      text: "Marcus had been more than a contact during those desperate weeks after she had fled Ishgard — he had been her salvation. When she arrived in Ul'dah with nothing but the clothes on her back, Marcus had given her work sorting inventory and moving goods. Simple labor, but it had kept her fed and housed.",
      position: { x: 1920, y: 0 },
      characters: [],
      next: [{ sceneId: 's08_office_offer' }],
    },
    s08_office_offer: {
      speaker: 'Marcus',
      text: 'Come — my office is just above. We can speak privately there.',
      position: { x: 2240, y: 0 },
      characters: [],
      next: [
        { label: 'Stay in the marketplace shadows', sceneId: 's09a_stay' },
        { label: 'Follow him upstairs', sceneId: 's09b_upstairs' },
      ],
    },
    s09a_stay: {
      speaker: 'Ingrid',
      text: "I'd prefer to stay here, if you don't mind. Sometimes privacy draws more attention than open conversation.",
      position: { x: 2560, y: 200 },
      characters: [],
      next: [{ sceneId: 's10_compliment' }],
    },
    s09b_upstairs: {
      text: 'She let him lead her up the narrow staircase to a cramped office above the spice stall. Dust motes drifted in the slatted light, but no curious ears could reach them here.',
      position: { x: 2560, y: -200 },
      characters: [],
      next: [{ sceneId: 's10_compliment' }],
    },
    s10_compliment: {
      speaker: 'Marcus',
      text: 'Of course. Among other things... You look well, lovely as always. After what happened to your former... employer.',
      position: { x: 2880, y: 0 },
      characters: [],
      next: [{ sceneId: 's11_provisions' }],
    },
    s11_provisions: {
      speaker: 'Ingrid',
      text: "That chapter of my life is closed. Which brings me to why I'm here. I need provisions for a month's journey — the finest quality, nothing that will spoil. About half a dozen people. And I need something else — ${cx:codex-item-doman-tea}[Doman tea], the genuine article from ${pl:place-doma}[the Far East]. The best quality you can acquire.",
      position: { x: 3200, y: 0 },
      characters: [],
      next: [{ sceneId: 's12_warn_routes' }],
    },
    s12_warn_routes: {
      speaker: 'Marcus',
      text: "That won't be cheap. Especially with the roads being what they are these days. Since the Garlean Empire fell, their legions no longer secure the trade routes or patrol the waters. The path to the Far East has become... treacherous. Doman tea specifically, you said? That suggests a very particular destination.",
      position: { x: 3520, y: 0 },
      characters: [],
      next: [{ sceneId: 's13_hesitate' }],
    },
    s13_hesitate: {
      text: 'Ingrid hesitated, then pressed forward. The question had been eating at her for three years, though she had never dared voice it.',
      position: { x: 3840, y: 0 },
      characters: [],
      next: [{ sceneId: 's14_ask' }],
    },
    s14_ask: {
      speaker: 'Ingrid',
      text: "Information, ${ch:char-marcus}[Marcus]. About what happened that night three years ago. There was another in ${ch:char-brann}[Brann]'s service — ${ch:char-zahir}[Zahir]. An older man, been with the house for a long time. I need to know if he... if anyone survived.",
      position: { x: 4160, y: 0 },
      characters: [],
      next: [{ sceneId: 's15_marcus_recall' }],
    },
    s15_marcus_recall: {
      speaker: 'Marcus',
      text: '${ch:char-zahir}[Zahir]. Dark hair, carried himself like minor nobility? Spoke with the accent of someone educated in the old ways? I heard of him through the network — ${ch:char-brann}[Brann] had fingers in several ${cx:codex-faction-syndicate}[Syndicate] dealings.',
      position: { x: 4480, y: 0 },
      characters: [],
      next: [{ sceneId: 's16_you_knew' }],
    },
    s16_you_knew: {
      speaker: 'Ingrid',
      text: 'You knew him?',
      position: { x: 4800, y: 0 },
      characters: [],
      next: [{ sceneId: 's17_marcus_whispers' }],
    },
    s17_marcus_whispers: {
      speaker: 'Marcus',
      text: "Of him — never met the man. The attack that night... it was thorough. Most of the household didn't survive. But there were whispers afterward — someone seen fleeing into the night, heading toward the ${pl:place-gridania-northern-shroud}[Black Shroud]. The descriptions could match your friend.",
      position: { x: 5120, y: 0 },
      characters: [],
      next: [{ sceneId: 's18_could_match' }],
    },
    s18_could_match: {
      speaker: 'Ingrid',
      text: "Could match isn't a certainty.",
      position: { x: 5440, y: 0 },
      characters: [],
      next: [{ sceneId: 's19_north_trader' }],
    },
    s19_north_trader: {
      speaker: 'Marcus',
      text: "No, it's not. But about six months ago, I had a trader come through who swore he'd encountered someone matching that description near Gridania. An older man seeking passage to the northern settlements, paying in old coin and asking no questions about destination. Could be coincidence, could be wishful thinking, or...",
      position: { x: 5760, y: 0 },
      characters: [],
      next: [{ sceneId: 's20a_could_be' }],
    },
    s20a_could_be: {
      speaker: 'Ingrid',
      text: 'Could be Zahir.',
      position: { x: 6080, y: 0 },
      characters: [],
      next: [{ sceneId: 's20b_hope' }],
    },
    s20b_hope: {
      text: 'Ingrid closed her eyes briefly, allowing herself a moment of possibility. If he had survived — if he had escaped that night of blood and fire — then perhaps something good had come from the ashes of that terrible house.',
      position: { x: 6400, y: 0 },
      characters: [],
      next: [{ sceneId: 's21_inquiries' }],
    },
    s21_inquiries: {
      speaker: 'Marcus',
      text: "I can make inquiries. Carefully, of course. My northern contacts owe me favors. Though I should warn you — if he survived and he's anything like the man I heard described, he won't have taken kindly to what happened. He might not welcome contact from anyone associated with that night.",
      position: { x: 6720, y: 0 },
      characters: [],
      next: [{ sceneId: 's22_safe' }],
    },
    s22_safe: {
      speaker: 'Ingrid',
      text: 'I just need to know he\'s safe. He helped me adjust... what would it cost?',
      position: { x: 7040, y: 0 },
      characters: [],
      next: [{ sceneId: 's23_part_of_service' }],
    },
    s23_part_of_service: {
      speaker: 'Marcus',
      text: 'For an old friend who once helped me sort through a warehouse of mislabeled goods until dawn? Consider it part of the service. The provisions and tea I can have ready by tomorrow evening. The information about your friend will take longer — maybe a month or two to hear back from my northern sources.',
      position: { x: 7360, y: 0 },
      characters: [],
      next: [{ sceneId: 's24_discretion' }],
    },
    s24_discretion: {
      speaker: 'Ingrid',
      text: "I'll take what you can provide now. And Marcus? Discretion, please.",
      position: { x: 7680, y: 0 },
      characters: [],
      next: [{ sceneId: 's25_silk_spices' }],
    },
    s25_silk_spices: {
      speaker: 'Marcus',
      text: 'I sell silk and spices. Nothing more controversial than overpriced saffron.',
      position: { x: 8000, y: 0 },
      characters: [],
      next: [{ sceneId: 's26_one_more' }],
    },
    s26_one_more: {
      text: 'As they concluded their business and emerged back into the marketplace, Marcus caught her arm gently.',
      position: { x: 8320, y: 0 },
      characters: [],
      next: [{ sceneId: 's27_warning' }],
    },
    s27_warning: {
      speaker: 'Marcus',
      text: 'One more thing. About that journey you\'re preparing for — especially if it\'s heading toward ${pl:place-doma}[Doman territories]. The roads aren\'t just dangerous because of bandits or wild beasts. There have been reports of specialized hunters operating along the eastern routes. The kind who ask uncomfortable questions and carry very specific tools. Whatever business takes you that direction, be extremely careful about who you trust and where you stop for the night.',
      position: { x: 8640, y: 0 },
      characters: [],
      next: [{ sceneId: 's28_closing' }],
    },
    s28_closing: {
      text: "Ingrid pulled her hood up and slipped through Ul'dah's winding alleys, keeping to the shadowed paths she had learned during her early days in the city. Tonight, she would inform her mistress that the preparations were underway — though she would keep the inquiry about Zahir to herself. Some hopes were too fragile to share. But as she walked through the growing shadows, Ingrid allowed herself to imagine — just for a moment — that somewhere in the northern reaches of Eorzea, an old friend might be watching the sunset and remembering better days.",
      position: { x: 8960, y: 0 },
      characters: [],
      next: [],
    },
  },
};

// Filler stories for pagination testing — minimal valid Story shape with
// strictly older publishedAt than SEED_STORY so the meaningful one ranks first.
export const SEED_STORIES: SeedStory[] = [
  SEED_STORY,
  ...Array.from({ length: 26 }, (_, i): SeedStory => {
    const idx = i + 1;
    const defaultEntrySceneId = `s01_opening`;
    // Spread filler dates across both eras so timeline pagination has
    // something to scroll through — and the unassigned-lane toggle isn't
    // empty when the timeline filters `dateKnown == true`.
    const inGameDate =
      idx <= 13
        ? { era: FF14_ERA_SIXTH_ASTRAL_ID, year: 1500 + idx }
        : { era: FF14_ERA_SEVENTH_UMBRAL_ID, year: idx - 13 };
    return {
      id: `story-filler-${String(idx).padStart(2, '0')}`,
      slug: `filler-story-${String(idx).padStart(2, '0')}`,
      title: `Filler story ${idx}`,
      inGameDate,
      defaultEntrySceneId,
      scenes: {
        [defaultEntrySceneId]: {
          text: `Auto-generated filler story #${idx} for pagination testing.`,
          position: { x: 0, y: 0 },
          characters: [],
          next: [],
        },
      },
      authorUid: SEED_AUTHOR_UID,
      draft: false,
      createdAt: SEED_CREATED_AT - idx * 1000,
      publishedAt: SEED_CREATED_AT - idx * 1000,
      version: 1,
    };
  }),
];

