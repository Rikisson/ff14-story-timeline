import { ChangeDetectionStrategy, Component } from '@angular/core';
import { BUTTON_TEMPLATE, ButtonBase } from './button-base';

@Component({
  selector: 'button[uiSecondary]',
  template: BUTTON_TEMPLATE,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SecondaryButtonComponent extends ButtonBase {
  protected readonly variantClasses =
    'bg-slate-100 text-slate-900 hover:bg-slate-200 active:bg-slate-300 ' +
    'focus-visible:ring-slate-400';
}
