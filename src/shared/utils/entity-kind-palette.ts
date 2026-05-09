import { EntityKind } from '../models/entity-ref';

// UI chip (square, read-only). Used by <app-entity-ref>.
export const KIND_UI_CLASS: Record<EntityKind, string> = {
  character: 'bg-tone-indigo-soft text-tone-indigo-foreground',
  place: 'bg-tone-emerald-soft text-tone-emerald-foreground',
  event: 'bg-tone-amber-soft text-tone-amber-foreground',
  story: 'bg-tone-fuchsia-soft text-tone-fuchsia-foreground',
  plotline: 'bg-tone-sky-soft text-tone-sky-foreground',
  codexEntry: 'bg-surface-muted text-foreground-muted',
};

// Picker chip: same family as UI but with a visible border for the removable affordance.
export const KIND_PICKER_CLASS: Record<EntityKind, string> = {
  character:
    'border-tone-indigo-border bg-tone-indigo-soft text-tone-indigo-foreground-strong hover:bg-tone-indigo',
  place:
    'border-tone-emerald-border bg-tone-emerald-soft text-tone-emerald-foreground-strong hover:bg-tone-emerald',
  event:
    'border-tone-amber-border bg-tone-amber-soft text-tone-amber-foreground-strong hover:bg-tone-amber',
  story:
    'border-tone-fuchsia-border bg-tone-fuchsia-soft text-tone-fuchsia-foreground-strong hover:bg-tone-fuchsia',
  plotline:
    'border-tone-sky-border bg-tone-sky-soft text-tone-sky-foreground-strong hover:bg-tone-sky',
  codexEntry:
    'border-border bg-surface-muted text-foreground hover:bg-surface-strong',
};

// Inline text ref: foreground color + hover background. No shape, no underline.
export const KIND_TEXT_CLASS: Record<EntityKind, string> = {
  character: 'text-tone-indigo-foreground hover:bg-tone-indigo-soft',
  place: 'text-tone-emerald-foreground hover:bg-tone-emerald-soft',
  event: 'text-tone-amber-foreground hover:bg-tone-amber-soft',
  story: 'text-tone-fuchsia-foreground hover:bg-tone-fuchsia-soft',
  plotline: 'text-tone-sky-foreground hover:bg-tone-sky-soft',
  codexEntry: 'text-foreground-muted hover:bg-surface-muted',
};

export const INLINE_REF_BASE_CLASS = 'cursor-help font-medium px-0.5 transition-colors';

// Generic non-entity tag. Free-text labels for short metadata.
export const TAG_NEUTRAL_CLASS =
  'inline-flex items-center rounded-full bg-surface-muted px-2 py-0.5 text-xs font-medium text-foreground-muted';
