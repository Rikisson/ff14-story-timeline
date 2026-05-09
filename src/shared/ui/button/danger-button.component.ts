import { ChangeDetectionStrategy, Component } from '@angular/core';
import { BUTTON_TEMPLATE, ButtonBase } from './button-base';

@Component({
  selector: 'button[uiDanger], a[uiDanger]',
  template: BUTTON_TEMPLATE,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DangerButtonComponent extends ButtonBase {
  protected readonly variantClasses =
    'bg-danger-strong text-danger-strong-foreground hover:bg-danger-strong-hover active:bg-danger-strong-active ' +
    'focus-visible:ring-danger-strong-ring';
}
