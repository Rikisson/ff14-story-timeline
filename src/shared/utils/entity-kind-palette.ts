import { EntityKind } from '../models/entity-ref';

// UI chip (square, read-only). Used by <app-entity-ref>.
export const KIND_UI_CLASS: Record<EntityKind, string> = {
  character: 'bg-indigo-50 text-indigo-700',
  place: 'bg-emerald-50 text-emerald-700',
  event: 'bg-amber-50 text-amber-800',
  story: 'bg-fuchsia-50 text-fuchsia-700',
  plotline: 'bg-sky-50 text-sky-700',
  item: 'bg-orange-50 text-orange-800',
  faction: 'bg-rose-50 text-rose-700',
  codexEntry: 'bg-slate-100 text-slate-700',
};

// Picker chip: same family as UI but with a visible border for the removable affordance.
export const KIND_PICKER_CLASS: Record<EntityKind, string> = {
  character: 'border-indigo-200 bg-indigo-50 text-indigo-900 hover:bg-indigo-100',
  place: 'border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100',
  event: 'border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100',
  story: 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-900 hover:bg-fuchsia-100',
  plotline: 'border-sky-200 bg-sky-50 text-sky-900 hover:bg-sky-100',
  item: 'border-orange-200 bg-orange-50 text-orange-900 hover:bg-orange-100',
  faction: 'border-rose-200 bg-rose-50 text-rose-900 hover:bg-rose-100',
  codexEntry: 'border-slate-200 bg-slate-100 text-slate-900 hover:bg-slate-200',
};

// Inline text ref: foreground color + hover background. No shape, no underline.
export const KIND_TEXT_CLASS: Record<EntityKind, string> = {
  character: 'text-indigo-700 hover:bg-indigo-50',
  place: 'text-emerald-700 hover:bg-emerald-50',
  event: 'text-amber-800 hover:bg-amber-50',
  story: 'text-fuchsia-700 hover:bg-fuchsia-50',
  plotline: 'text-sky-700 hover:bg-sky-50',
  item: 'text-orange-800 hover:bg-orange-50',
  faction: 'text-rose-700 hover:bg-rose-50',
  codexEntry: 'text-slate-700 hover:bg-slate-100',
};

export const INLINE_REF_BASE_CLASS = 'cursor-help font-medium px-0.5 transition-colors';

// Generic non-entity tag. Free-text labels (genreTags, factions strings, etc.)
export const TAG_NEUTRAL_CLASS =
  'inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700';
