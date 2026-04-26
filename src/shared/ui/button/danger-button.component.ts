import { ChangeDetectionStrategy, Component } from '@angular/core';
import { BUTTON_TEMPLATE, ButtonBase } from './button-base';

@Component({
  selector: 'button[uiDanger]',
  template: BUTTON_TEMPLATE,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DangerButtonComponent extends ButtonBase {
  protected readonly variantClasses =
    'bg-red-600 text-white hover:bg-red-500 active:bg-red-700 ' +
    'focus-visible:ring-red-500';
}
