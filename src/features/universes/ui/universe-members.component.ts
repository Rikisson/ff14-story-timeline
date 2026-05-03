import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthStore } from '@features/auth';
import {
  DangerButtonComponent,
  GhostButtonComponent,
  PrimaryButtonComponent,
} from '@shared/ui';
import { UniverseStore } from '../data-access/universe.store';
import { Universe } from '../data-access/universe.types';
import { UniversesService } from '../data-access/universes.service';

const UID_PATTERN = /^[A-Za-z0-9]{20,128}$/;

@Component({
  selector: 'app-universe-members',
  imports: [
    ReactiveFormsModule,
    PrimaryButtonComponent,
    GhostButtonComponent,
    DangerButtonComponent,
  ],
  template: `
    <section class="flex flex-col gap-3">
      <div class="flex items-start justify-between gap-3">
        <div>
          <h2 class="m-0 text-lg font-semibold text-slate-900">Members</h2>
          <p class="m-0 mt-0.5 text-sm text-slate-600">
            Owner and contributors of <strong>{{ universe().name }}</strong>.
          </p>
        </div>
        <button uiGhost type="button" aria-label="Close" (click)="closed.emit()">Close</button>
      </div>

      <ul class="m-0 flex list-none flex-col gap-1 p-0">
        <li
          class="flex items-center justify-between gap-3 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
        >
          <div class="flex flex-col">
            <span class="font-medium text-slate-700">Owner</span>
            <code class="break-all text-xs text-slate-600">{{ universe().ownerUid }}</code>
          </div>
          @if (isYou(universe().ownerUid)) {
            <span class="shrink-0 rounded-full bg-indigo-100 px-2 py-0.5 text-xs text-indigo-800">
              you
            </span>
          }
        </li>
        @for (uid of universe().editorUids; track uid) {
          <li
            class="flex items-center justify-between gap-3 rounded border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            <div class="flex flex-col">
              <span class="font-medium text-slate-700">Contributor</span>
              <code class="break-all text-xs text-slate-600">{{ uid }}</code>
            </div>
            <div class="flex items-center gap-2">
              @if (isYou(uid)) {
                <span class="rounded-full bg-indigo-100 px-2 py-0.5 text-xs text-indigo-800">you</span>
              }
              <button
                uiDanger
                type="button"
                [disabled]="busy()"
                (click)="confirmRemove(uid)"
              >Remove</button>
            </div>
          </li>
        }
      </ul>

      <form [formGroup]="form" class="flex flex-col gap-2" (ngSubmit)="onAdd()">
        <label class="flex flex-col gap-1 text-sm">
          <span class="font-medium text-slate-700">Add contributor by UID</span>
          <input
            type="text"
            formControlName="uid"
            autocomplete="off"
            spellcheck="false"
            class="h-10 rounded-md border border-slate-300 bg-white px-3 font-mono text-xs"
            placeholder="e.g. uDRxrMxHMtNZfgbpNjbJat1BPBE3"
          />
          <span class="text-xs text-slate-500">
            Ask the user to copy their UID from the auth menu and paste it here.
          </span>
        </label>
        @if (errorMessage(); as e) {
          <p class="m-0 text-sm text-red-700">{{ e }}</p>
        }
        <div>
          <button
            uiPrimary
            type="submit"
            [loading]="busy()"
            [disabled]="form.invalid || busy()"
          >Add contributor</button>
        </div>
      </form>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UniverseMembersComponent {
  readonly universe = input.required<Universe>();
  readonly closed = output<void>();

  private readonly service = inject(UniversesService);
  private readonly store = inject(UniverseStore);
  private readonly auth = inject(AuthStore);

  protected readonly busy = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly currentUid = computed(() => this.auth.user()?.uid ?? null);

  protected readonly form = new FormBuilder().nonNullable.group({
    uid: ['', [Validators.required, Validators.pattern(UID_PATTERN)]],
  });

  protected isYou(uid: string): boolean {
    return this.currentUid() === uid;
  }

  protected async onAdd(): Promise<void> {
    if (this.form.invalid) return;
    const uid = this.form.getRawValue().uid.trim();
    const u = this.universe();
    if (uid === u.ownerUid) {
      this.errorMessage.set('That UID is already the owner.');
      return;
    }
    if (u.editorUids.includes(uid)) {
      this.errorMessage.set('That UID is already a contributor.');
      return;
    }
    this.busy.set(true);
    this.errorMessage.set(null);
    try {
      await this.service.addEditor(u.id, uid);
      await this.store.refresh();
      this.form.reset({ uid: '' });
    } catch (err) {
      this.errorMessage.set(err instanceof Error ? `${err.name}: ${err.message}` : String(err));
    } finally {
      this.busy.set(false);
    }
  }

  protected async confirmRemove(uid: string): Promise<void> {
    const label = this.isYou(uid) ? 'yourself' : `contributor "${uid}"`;
    if (!confirm(`Remove ${label} from this universe?`)) return;
    this.busy.set(true);
    this.errorMessage.set(null);
    try {
      await this.service.removeEditor(this.universe().id, uid);
      await this.store.refresh();
    } catch (err) {
      this.errorMessage.set(err instanceof Error ? `${err.name}: ${err.message}` : String(err));
    } finally {
      this.busy.set(false);
    }
  }
}
