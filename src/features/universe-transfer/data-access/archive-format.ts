import { BackgroundEffect, EntityKind, InGameDate } from '@shared/models';
import { AssetKind } from '@features/media';
import { PlotlineStatus } from '@features/plotlines';
import { BgmTransition, SceneLayout, SceneTransition, TextSpeed } from '@features/stories';
import { UniverseLocale } from '@features/universes';

export const FORMAT_VERSION = 3;

export const ARCHIVE_ENTITY_KINDS: readonly EntityKind[] = [
  'character',
  'place',
  'plotline',
  'event',
  'codexEntry',
  'story',
];

export const COLLECTION_BY_KIND: Record<EntityKind, string> = {
  character: 'characters',
  place: 'places',
  event: 'events',
  story: 'stories',
  plotline: 'plotlines',
  codexEntry: 'codexEntries',
};

export interface ArchiveRef<K extends EntityKind = EntityKind> {
  kind: K;
  ref: string;
}

// `era` holds the matching ArchiveCalendarEra.slug, not a runtime era id.
export type ArchiveInGameDate = InGameDate;

export interface ArchiveAsset {
  slug: string;
  kind: AssetKind;
  label: string;
  file?: string;
  thumbFile?: string;
  blurDataUrl?: string;
  tags?: string[];
}

export interface ArchiveUniverse {
  slug: string;
  name: string;
  description?: string;
  locale: UniverseLocale;
  coverAsset?: string;
}

export interface ArchiveCalendarEra {
  slug: string;
  name: string;
  maxYears?: number;
  hoursPerDay?: number;
  minutesPerHour?: number;
  secondsPerMinute?: number;
  resetsWeek?: boolean;
}

export interface ArchiveCalendarMonth {
  name: string;
  days: number;
}

export interface ArchiveCalendarWeekday {
  name: string;
  short?: string;
}

export interface ArchiveCalendar {
  eras: ArchiveCalendarEra[];
  months: ArchiveCalendarMonth[];
  weekdays?: ArchiveCalendarWeekday[];
}

export interface ArchiveCodexCategory {
  key: string;
  label: string;
  color?: string;
  description?: string;
}

export interface ArchiveCharacter {
  slug: string;
  name: string;
  description?: string;
  coverAsset?: string;
  sprites?: string[];
  relatedRefs?: ArchiveRef[];
}

export interface ArchivePlace {
  slug: string;
  name: string;
  description?: string;
  coverAsset?: string;
  backgrounds?: string[];
  ambientAudio?: string[];
  relatedRefs?: ArchiveRef[];
}

export interface ArchivePlotline {
  slug: string;
  title: string;
  description?: string;
  coverAsset?: string;
  color?: string;
  status?: PlotlineStatus;
  /** Ordered membership — story / event slugs in authored order. */
  members?: ArchiveRef<'story' | 'event'>[];
}

export interface ArchiveEvent {
  slug: string;
  name: string;
  description: string;
  coverAsset?: string;
  bgmAsset?: string;
  backgroundEffect?: BackgroundEffect;
  inGameDate: ArchiveInGameDate;
  relatedRefs?: ArchiveRef[];
}

export interface ArchiveCodexEntry {
  slug: string;
  title: string;
  category?: string;
  description: string;
  coverAsset?: string;
  relatedRefs?: ArchiveRef[];
}

export interface ArchiveStagedCharacter {
  entity: ArchiveRef<'character'>;
  position: string;
  order?: number;
  sprite?: string;
  facing?: 'left' | 'right';
}

export interface ArchiveSceneNext {
  label?: string;
  scene: string;
}

export interface ArchiveScene {
  text: string;
  label?: string;
  speaker?: ArchiveRef<'character'> | string;
  backgroundAsset?: string;
  backgroundEffect?: BackgroundEffect;
  characters: ArchiveStagedCharacter[];
  place?: ArchiveRef<'place'>;
  sfxAsset?: string;
  bgmAsset?: string;
  bgmSilence?: boolean;
  bgmTransition?: BgmTransition;
  textSpeed?: TextSpeed;
  layout?: SceneLayout;
  transition?: SceneTransition;
  transitionMs?: number;
  position?: { x: number; y: number };
  next: ArchiveSceneNext[];
  isEntry?: boolean;
}

export interface ArchiveStory {
  slug: string;
  title: string;
  description?: string;
  coverAsset?: string;
  bgmAsset?: string;
  draft?: boolean;
  inGameDate: ArchiveInGameDate;
  relatedRefs?: ArchiveRef[];
  defaultEntryScene: string;
  scenes: Record<string, ArchiveScene>;
}

// Connection endpoints are slug-keyed (`story` / `event` hold entity
// slugs); `scene` holds the archive-local scene key, mirroring
// `ArchiveSceneNext.scene`. Both endpoints must resolve inside the same
// archive — scene keys have no meaning against an existing universe.
export type ArchiveConnectionSource =
  | { kind: 'story'; story: string; scene: string }
  | { kind: 'event'; event: string };

export type ArchiveConnectionTarget =
  | { kind: 'story'; story: string; scene?: string }
  | { kind: 'event'; event: string };

export interface ArchiveConnection {
  type: 'continues';
  from: ArchiveConnectionSource;
  to: ArchiveConnectionTarget | null;
  visibility: 'editor' | 'reader';
  note?: string;
  snapshotTitle?: string;
}

export interface UniverseArchive {
  formatVersion: number;
  exportedAt?: number;
  generator?: string;
  universe?: ArchiveUniverse;
  calendar?: ArchiveCalendar;
  codexCategories?: ArchiveCodexCategory[];
  assets?: ArchiveAsset[];
  characters?: ArchiveCharacter[];
  places?: ArchivePlace[];
  plotlines?: ArchivePlotline[];
  events?: ArchiveEvent[];
  codexEntries?: ArchiveCodexEntry[];
  stories?: ArchiveStory[];
  connections?: ArchiveConnection[];
}
