// Class strings for "hero" buttons that float on top of a cover image (used
// by entity detail cards). They use semi-transparent surface tokens so the
// underlying cover bleeds through slightly, which reads better than the
// solid uiSecondary/uiDanger directives in this context. Text colors stay
// on theme tokens so they adapt to light/dark.

const HERO_BASE =
  'inline-flex h-11 items-center justify-center rounded-md px-5 text-sm font-medium ' +
  'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2';

export const HERO_PRIMARY =
  HERO_BASE +
  ' bg-accent text-accent-foreground shadow-lg hover:bg-accent-hover active:bg-accent-active focus-visible:ring-accent-ring';

export const HERO_SECONDARY =
  HERO_BASE +
  ' bg-surface/90 text-foreground shadow hover:bg-surface active:bg-surface-muted focus-visible:ring-accent-ring';

export const HERO_DANGER =
  HERO_BASE +
  ' bg-danger-strong/90 text-danger-strong-foreground shadow hover:bg-danger-strong active:bg-danger-strong-active focus-visible:ring-danger-strong-ring';
