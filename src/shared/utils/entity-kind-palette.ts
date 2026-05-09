import { EntityKind } from '../models/entity-ref';

// UI chip (square, read-only). Used by <app-entity-ref>.
export const KIND_UI_CLASS: Record<EntityKind, string> = {
  character: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300',
  place: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
  event: 'bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300',
  story: 'bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-950/50 dark:text-fuchsia-300',
  plotline: 'bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300',
  codexEntry: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
};

// Picker chip: same family as UI but with a visible border for the removable affordance.
export const KIND_PICKER_CLASS: Record<EntityKind, string> = {
  character:
    'border-indigo-200 bg-indigo-50 text-indigo-900 hover:bg-indigo-100 ' +
    'dark:border-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-100 dark:hover:bg-indigo-900/70',
  place:
    'border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 ' +
    'dark:border-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-100 dark:hover:bg-emerald-900/70',
  event:
    'border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100 ' +
    'dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-100 dark:hover:bg-amber-900/70',
  story:
    'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-900 hover:bg-fuchsia-100 ' +
    'dark:border-fuchsia-700 dark:bg-fuchsia-950/60 dark:text-fuchsia-100 dark:hover:bg-fuchsia-900/70',
  plotline:
    'border-sky-200 bg-sky-50 text-sky-900 hover:bg-sky-100 ' +
    'dark:border-sky-700 dark:bg-sky-950/60 dark:text-sky-100 dark:hover:bg-sky-900/70',
  codexEntry:
    'border-slate-200 bg-slate-100 text-slate-900 hover:bg-slate-200 ' +
    'dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700',
};

// Inline text ref: foreground color + hover background. No shape, no underline.
export const KIND_TEXT_CLASS: Record<EntityKind, string> = {
  character: 'text-indigo-700 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/40',
  place: 'text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40',
  event: 'text-amber-800 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/40',
  story: 'text-fuchsia-700 hover:bg-fuchsia-50 dark:text-fuchsia-400 dark:hover:bg-fuchsia-950/40',
  plotline: 'text-sky-700 hover:bg-sky-50 dark:text-sky-400 dark:hover:bg-sky-950/40',
  codexEntry: 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
};

export const INLINE_REF_BASE_CLASS = 'cursor-help font-medium px-0.5 transition-colors';

// Generic non-entity tag. Free-text labels for short metadata.
export const TAG_NEUTRAL_CLASS =
  'inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 ' +
  'dark:bg-slate-800 dark:text-slate-300';
