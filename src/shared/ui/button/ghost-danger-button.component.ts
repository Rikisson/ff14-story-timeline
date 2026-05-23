import { ChangeDetectionStrategy, Component } from '@angular/core';
import { BUTTON_TEMPLATE, ButtonBase } from './button-base';

@Component({
  selector: 'button[uiGhostDanger], a[uiGhostDanger]',
  template: BUTTON_TEMPLATE,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GhostDangerButtonComponent extends ButtonBase {
  protected readonly variantClasses =
    'bg-transparent text-danger-foreground hover:bg-danger active:bg-danger ' +
    'focus-visible:ring-danger-strong-ring';
}
