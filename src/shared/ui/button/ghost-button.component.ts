import { ChangeDetectionStrategy, Component } from '@angular/core';
import { BUTTON_TEMPLATE, ButtonBase } from './button-base';

@Component({
  selector: 'button[uiGhost]',
  template: BUTTON_TEMPLATE,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GhostButtonComponent extends ButtonBase {
  protected readonly variantClasses =
    'bg-transparent text-slate-700 hover:bg-slate-100 active:bg-slate-200 ' +
    'focus-visible:ring-slate-400 ' +
    'dark:text-slate-300 dark:hover:bg-slate-800 dark:active:bg-slate-700 ' +
    'dark:focus-visible:ring-slate-500';
}
