import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { AbstractControl } from '@angular/forms';
import { TranslocoDirective } from '@jsverse/transloco';
import { resolveValidationError } from '@shared/utils';

interface Subscription {
  unsubscribe(): void;
}

@Component({
  selector: 'app-form-error',
  imports: [TranslocoDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-container *transloco="let t">
      @if (resolved(); as e) {
        <p class="m-0 text-xs text-danger-foreground" role="alert">
          {{ t(e.key, e.params ?? {}) }}
        </p>
      }
    </ng-container>
  `,
})
export class FormErrorComponent {
  readonly control = input.required<AbstractControl>();
  readonly showWhenUntouched = input<boolean>(false);

  private readonly destroyRef = inject(DestroyRef);
  private readonly tick = signal(0);

  constructor() {
    let sub: Subscription | null = null;
    effect(() => {
      sub?.unsubscribe();
      const c = this.control();
      sub = c.events.subscribe(() => this.tick.update((v) => v + 1));
    });
    this.destroyRef.onDestroy(() => sub?.unsubscribe());
  }

  protected readonly resolved = computed(() => {
    this.tick();
    const c = this.control();
    if (!c.invalid) return null;
    if (!this.showWhenUntouched() && !c.dirty && !c.touched) return null;
    return resolveValidationError(c.errors);
  });
}
