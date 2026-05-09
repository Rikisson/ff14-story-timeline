import { ChangeDetectionStrategy, Component } from '@angular/core';
import { BUTTON_TEMPLATE, ButtonBase } from './button-base';

@Component({
  selector: 'button[uiGhost], a[uiGhost]',
  template: BUTTON_TEMPLATE,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GhostButtonComponent extends ButtonBase {
  protected readonly variantClasses =
    'bg-transparent text-foreground-muted hover:bg-surface-muted active:bg-surface-strong ' +
    'focus-visible:ring-foreground-faint';
}
