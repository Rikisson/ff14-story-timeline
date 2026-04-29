import { Character } from '@features/characters';
import { TimelineEvent } from '@features/events';
import { Place } from '@features/places';
import { Story } from '@features/stories';
import { SEED_AUTHOR_UID } from './seed-author';

const SEED_CREATED_AT = 1777593600000;

export const SEED_CHARACTERS: Character[] = [
  {
    id: 'char-ingrid',
    slug: 'ingrid',
    name: 'Ingrid',
    race: 'Hyur (voidsent-tainted)',
    job: 'Rogue',
    authorUid: SEED_AUTHOR_UID,
    createdAt: SEED_CREATED_AT,
  },
  {
    id: 'char-marcus',
    slug: 'marcus',
    name: 'Marcus',
    race: 'Hyur',
    job: 'Merchant',
    authorUid: SEED_AUTHOR_UID,
    createdAt: SEED_CREATED_AT,
  },
  {
    id: 'char-brann',
    slug: 'brann',
    name: 'Brann',
    race: 'Hyur',
    job: 'Voidwalker',
    authorUid: SEED_AUTHOR_UID,
    createdAt: SEED_CREATED_AT,
  },
  {
    id: 'char-sakuya',
    slug: 'sakuya',
    name: 'Sakuya',
    race: 'Au Ra',
    job: 'Samurai',
    authorUid: SEED_AUTHOR_UID,
    createdAt: SEED_CREATED_AT,
  },
  {
    id: 'char-zahir',
    slug: 'zahir',
    name: 'Zahir',
    race: 'Hyur',
    job: 'Dark Knight',
    authorUid: SEED_AUTHOR_UID,
    createdAt: SEED_CREATED_AT,
  },
];

export const SEED_PLACES: Place[] = [
  {
    id: 'place-uldah-pearl-lane',
    slug: 'uldah-pearl-lane',
    name: "Pearl Lane, Ul'dah",
    geoPosition: "Ul'dah - Steps of Thal, Thanalan",
    factions: ['Syndicate', 'Immortal Flames'],
    authorUid: SEED_AUTHOR_UID,
    createdAt: SEED_CREATED_AT,
  },
  {
    id: 'place-ishgard',
    slug: 'ishgard',
    name: 'Ishgard',
    geoPosition: 'Coerthas Central Highlands',
    factions: ['House Fortemps', 'Temple Knights'],
    authorUid: SEED_AUTHOR_UID,
    createdAt: SEED_CREATED_AT,
  },
  {
    id: 'place-doma',
    slug: 'doma',
    name: 'Doma',
    geoPosition: 'Yanxia, Far East',
    factions: ['Doman Liberation Front'],
    authorUid: SEED_AUTHOR_UID,
    createdAt: SEED_CREATED_AT,
  },
  {
    id: 'place-gridania-northern-shroud',
    slug: 'gridania-northern-shroud',
    name: 'Gridania & the Northern Shroud',
    geoPosition: 'Black Shroud',
    factions: ['Order of the Twin Adder', 'Wood Wailers'],
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
    mainCharacters: [],
    places: ['place-uldah-pearl-lane', 'place-gridania-northern-shroud'],
    inGameDate: '1572 6AE',
    relatedDates: ['1577 6AE'],
    authorUid: SEED_AUTHOR_UID,
    createdAt: SEED_CREATED_AT,
  },
  {
    id: 'event-fall-of-doma',
    slug: 'fall-of-doma',
    name: 'Fall of Doma',
    description:
      'Garlean forces overrun Doma, scattering its people and pushing the resistance into hiding. The defeat shapes the trajectory of the Doman Liberation Front for years to come.',
    mainCharacters: ['char-sakuya'],
    places: ['place-doma'],
    inGameDate: '1557 6AE',
    relatedDates: ['1582 6AE'],
    authorUid: SEED_AUTHOR_UID,
    createdAt: SEED_CREATED_AT,
  },
  {
    id: 'event-brann-house-attack',
    slug: 'brann-house-attack',
    name: "Attack on Brann's house",
    description:
      "The night Sakuya's blade ended Brann's reign — and nearly Ingrid's existence. Survivors fled toward the Black Shroud; Ingrid's path to Ul'dah began here.",
    mainCharacters: ['char-ingrid', 'char-brann', 'char-sakuya', 'char-zahir'],
    places: ['place-ishgard', 'place-gridania-northern-shroud'],
    inGameDate: '1582 6AE',
    relatedDates: ['1585 6AE, late afternoon'],
    authorUid: SEED_AUTHOR_UID,
    createdAt: SEED_CREATED_AT,
  },
];

export const SEED_STORY: Story = {
  id: 'story-shadows-and-provisions',
  slug: 'shadows-and-provisions',
  title: 'Shadows and Provisions',
  summary:
    "Three years after fleeing the destruction of her former master's house, Ingrid meets an old contact in Ul'dah's Pearl Lane to arrange provisions for a journey east — and to ask a question she has never dared voice aloud.",
  mainCharacters: [
    'char-ingrid',
    'char-marcus',
    'char-brann',
    'char-sakuya',
    'char-zahir',
  ],
  places: [
    'place-uldah-pearl-lane',
    'place-ishgard',
    'place-doma',
    'place-gridania-northern-shroud',
  ],
  inGameDate: '1585 6AE, late afternoon',
  startSceneId: 's01_opening',
  authorUid: SEED_AUTHOR_UID,
  draft: false,
  publishedAt: SEED_CREATED_AT,
  scenes: {
    s01_opening: {
      text: "The amber glow of Ul'dah's sun cast long shadows through the Pearl Lane, and Ingrid found herself unconsciously seeking them as she moved between the market stalls. The late afternoon light made her skin prickle with discomfort, though she endured it better than most of her kind — a small mercy from her former master's tainted blood.",
      position: { x: 0, y: 0 },
      next: [{ sceneId: 's02_intro' }],
    },
    s02_intro: {
      text: "Her dark hair caught the light as she paused before a spice merchant's stall, amber eyes — carefully maintained in their human hue — scanning the exotic imports. Three years had passed since Sakuya's blade had ended Brann's reign and nearly ended Ingrid's existence as well. Only her mistress's unexpected mercy had spared her.",
      position: { x: 320, y: 0 },
      next: [{ sceneId: 's03_voice' }],
    },
    s03_voice: {
      speaker: 'Marcus',
      text: "Ingrid? By Nald'thal's scales, is that really you?",
      position: { x: 640, y: 0 },
      next: [{ sceneId: 's04_recognize' }],
    },
    s04_recognize: {
      text: 'She turned at the familiar voice. An elderly Hyur stood between the stalls, his weathered face lined with age but his eyes still bright with the sharp intelligence of his youth. Marcus moved with surprising vigor for a man nearing eighty summers, his merchant\'s robes dusty from the road.',
      position: { x: 960, y: 0 },
      next: [{ sceneId: 's05_thought_dead' }],
    },
    s05_thought_dead: {
      speaker: 'Marcus',
      text: 'I thought... three years ago, when we heard about what happened... I was certain you were... By the Twelve, I thought you were dead.',
      position: { x: 1280, y: 0 },
      next: [{ sceneId: 's06_greet_back' }],
    },
    s06_greet_back: {
      speaker: 'Ingrid',
      text: 'Marcus. Still trading in the spaces between official commerce, I see.',
      position: { x: 1600, y: 0 },
      next: [{ sceneId: 's07_history' }],
    },
    s07_history: {
      text: "Marcus had been more than a contact during those desperate weeks after she had fled Ishgard — he had been her salvation. When she arrived in Ul'dah with nothing but the clothes on her back, Marcus had given her work sorting inventory and moving goods. Simple labor, but it had kept her fed and housed.",
      position: { x: 1920, y: 0 },
      next: [{ sceneId: 's08_office_offer' }],
    },
    s08_office_offer: {
      speaker: 'Marcus',
      text: 'Come — my office is just above. We can speak privately there.',
      position: { x: 2240, y: 0 },
      next: [
        { label: 'Stay in the marketplace shadows', sceneId: 's09a_stay' },
        { label: 'Follow him upstairs', sceneId: 's09b_upstairs' },
      ],
    },
    s09a_stay: {
      speaker: 'Ingrid',
      text: "I'd prefer to stay here, if you don't mind. Sometimes privacy draws more attention than open conversation.",
      position: { x: 2560, y: 200 },
      next: [{ sceneId: 's10_compliment' }],
    },
    s09b_upstairs: {
      text: 'She let him lead her up the narrow staircase to a cramped office above the spice stall. Dust motes drifted in the slatted light, but no curious ears could reach them here.',
      position: { x: 2560, y: -200 },
      next: [{ sceneId: 's10_compliment' }],
    },
    s10_compliment: {
      speaker: 'Marcus',
      text: 'Of course. Among other things... You look well, lovely as always. After what happened to your former... employer.',
      position: { x: 2880, y: 0 },
      next: [{ sceneId: 's11_provisions' }],
    },
    s11_provisions: {
      speaker: 'Ingrid',
      text: "That chapter of my life is closed. Which brings me to why I'm here. I need provisions for a month's journey — the finest quality, nothing that will spoil. About half a dozen people. And I need something else — Doman tea, the genuine article from the Far East. The best quality you can acquire.",
      position: { x: 3200, y: 0 },
      next: [{ sceneId: 's12_warn_routes' }],
    },
    s12_warn_routes: {
      speaker: 'Marcus',
      text: "That won't be cheap. Especially with the roads being what they are these days. Since the Garlean Empire fell, their legions no longer secure the trade routes or patrol the waters. The path to the Far East has become... treacherous. Doman tea specifically, you said? That suggests a very particular destination.",
      position: { x: 3520, y: 0 },
      next: [{ sceneId: 's13_hesitate' }],
    },
    s13_hesitate: {
      text: 'Ingrid hesitated, then pressed forward. The question had been eating at her for three years, though she had never dared voice it.',
      position: { x: 3840, y: 0 },
      next: [{ sceneId: 's14_ask' }],
    },
    s14_ask: {
      speaker: 'Ingrid',
      text: "Information, Marcus. About what happened that night three years ago. There was another in Brann's service — Zahir. An older man, been with the house for a long time. I need to know if he... if anyone survived.",
      position: { x: 4160, y: 0 },
      next: [{ sceneId: 's15_marcus_recall' }],
    },
    s15_marcus_recall: {
      speaker: 'Marcus',
      text: 'Zahir. Dark hair, carried himself like minor nobility? Spoke with the accent of someone educated in the old ways? I heard of him through the network — Brann had fingers in several Syndicate dealings.',
      position: { x: 4480, y: 0 },
      next: [{ sceneId: 's16_you_knew' }],
    },
    s16_you_knew: {
      speaker: 'Ingrid',
      text: 'You knew him?',
      position: { x: 4800, y: 0 },
      next: [{ sceneId: 's17_marcus_whispers' }],
    },
    s17_marcus_whispers: {
      speaker: 'Marcus',
      text: "Of him — never met the man. The attack that night... it was thorough. Most of the household didn't survive. But there were whispers afterward — someone seen fleeing into the night, heading toward the Black Shroud. The descriptions could match your friend.",
      position: { x: 5120, y: 0 },
      next: [{ sceneId: 's18_could_match' }],
    },
    s18_could_match: {
      speaker: 'Ingrid',
      text: "Could match isn't a certainty.",
      position: { x: 5440, y: 0 },
      next: [{ sceneId: 's19_north_trader' }],
    },
    s19_north_trader: {
      speaker: 'Marcus',
      text: "No, it's not. But about six months ago, I had a trader come through who swore he'd encountered someone matching that description near Gridania. An older man seeking passage to the northern settlements, paying in old coin and asking no questions about destination. Could be coincidence, could be wishful thinking, or...",
      position: { x: 5760, y: 0 },
      next: [{ sceneId: 's20a_could_be' }],
    },
    s20a_could_be: {
      speaker: 'Ingrid',
      text: 'Could be Zahir.',
      position: { x: 6080, y: 0 },
      next: [{ sceneId: 's20b_hope' }],
    },
    s20b_hope: {
      text: 'Ingrid closed her eyes briefly, allowing herself a moment of possibility. If he had survived — if he had escaped that night of blood and fire — then perhaps something good had come from the ashes of that terrible house.',
      position: { x: 6400, y: 0 },
      next: [{ sceneId: 's21_inquiries' }],
    },
    s21_inquiries: {
      speaker: 'Marcus',
      text: "I can make inquiries. Carefully, of course. My northern contacts owe me favors. Though I should warn you — if he survived and he's anything like the man I heard described, he won't have taken kindly to what happened. He might not welcome contact from anyone associated with that night.",
      position: { x: 6720, y: 0 },
      next: [{ sceneId: 's22_safe' }],
    },
    s22_safe: {
      speaker: 'Ingrid',
      text: 'I just need to know he\'s safe. He helped me adjust... what would it cost?',
      position: { x: 7040, y: 0 },
      next: [{ sceneId: 's23_part_of_service' }],
    },
    s23_part_of_service: {
      speaker: 'Marcus',
      text: 'For an old friend who once helped me sort through a warehouse of mislabeled goods until dawn? Consider it part of the service. The provisions and tea I can have ready by tomorrow evening. The information about your friend will take longer — maybe a month or two to hear back from my northern sources.',
      position: { x: 7360, y: 0 },
      next: [{ sceneId: 's24_discretion' }],
    },
    s24_discretion: {
      speaker: 'Ingrid',
      text: "I'll take what you can provide now. And Marcus? Discretion, please.",
      position: { x: 7680, y: 0 },
      next: [{ sceneId: 's25_silk_spices' }],
    },
    s25_silk_spices: {
      speaker: 'Marcus',
      text: 'I sell silk and spices. Nothing more controversial than overpriced saffron.',
      position: { x: 8000, y: 0 },
      next: [{ sceneId: 's26_one_more' }],
    },
    s26_one_more: {
      text: 'As they concluded their business and emerged back into the marketplace, Marcus caught her arm gently.',
      position: { x: 8320, y: 0 },
      next: [{ sceneId: 's27_warning' }],
    },
    s27_warning: {
      speaker: 'Marcus',
      text: 'One more thing. About that journey you\'re preparing for — especially if it\'s heading toward Doman territories. The roads aren\'t just dangerous because of bandits or wild beasts. There have been reports of specialized hunters operating along the eastern routes. The kind who ask uncomfortable questions and carry very specific tools. Whatever business takes you that direction, be extremely careful about who you trust and where you stop for the night.',
      position: { x: 8640, y: 0 },
      next: [{ sceneId: 's28_closing' }],
    },
    s28_closing: {
      text: "Ingrid pulled her hood up and slipped through Ul'dah's winding alleys, keeping to the shadowed paths she had learned during her early days in the city. Tonight, she would inform her mistress that the preparations were underway — though she would keep the inquiry about Zahir to herself. Some hopes were too fragile to share. But as she walked through the growing shadows, Ingrid allowed herself to imagine — just for a moment — that somewhere in the northern reaches of Eorzea, an old friend might be watching the sunset and remembering better days.",
      position: { x: 8960, y: 0 },
      next: [],
    },
  },
};
