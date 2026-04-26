import { ChangeDetectionStrategy, Component } from '@angular/core';
import { BUTTON_TEMPLATE, ButtonBase } from './button-base';

@Component({
  selector: 'button[uiPrimary]',
  template: BUTTON_TEMPLATE,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrimaryButtonComponent extends ButtonBase {
  protected readonly variantClasses =
    'bg-indigo-600 text-white hover:bg-indigo-500 active:bg-indigo-700 ' +
    'focus-visible:ring-indigo-500';
}
