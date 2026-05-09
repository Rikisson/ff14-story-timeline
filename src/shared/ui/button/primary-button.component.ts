import { ChangeDetectionStrategy, Component } from '@angular/core';
import { BUTTON_TEMPLATE, ButtonBase } from './button-base';

@Component({
  selector: 'button[uiPrimary], a[uiPrimary]',
  template: BUTTON_TEMPLATE,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrimaryButtonComponent extends ButtonBase {
  protected readonly variantClasses =
    'bg-accent text-accent-foreground hover:bg-accent-hover active:bg-accent-active ' +
    'focus-visible:ring-accent-ring';
}
