import { ChangeDetectionStrategy, Component } from '@angular/core';
import { BUTTON_TEMPLATE, ButtonBase } from './button-base';

@Component({
  selector: 'button[uiGhost]',
  template: BUTTON_TEMPLATE,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GhostButtonComponent extends ButtonBase {
  protected readonly variantClasses =
    'bg-transparent text-foreground-muted hover:bg-surface-muted active:bg-slate-200 ' +
    'focus-visible:ring-slate-400 ' +
    'dark:active:bg-slate-700 ' +
    'dark:focus-visible:ring-slate-500';
}
