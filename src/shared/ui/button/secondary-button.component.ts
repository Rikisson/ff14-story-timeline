import { ChangeDetectionStrategy, Component } from '@angular/core';
import { BUTTON_TEMPLATE, ButtonBase } from './button-base';

@Component({
  selector: 'button[uiSecondary]',
  template: BUTTON_TEMPLATE,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SecondaryButtonComponent extends ButtonBase {
  protected readonly variantClasses =
    'bg-surface-muted text-foreground hover:bg-surface-strong active:bg-surface-stronger ' +
    'focus-visible:ring-foreground-faint';
}
