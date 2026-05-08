import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthStore } from '@features/auth';
import {
  DangerButtonComponent,
  PrimaryButtonComponent,
} from '@shared/ui';
import { UniverseStore } from '../data-access/universe.store';
import { UniversesService } from '../data-access/universes.service';

const UID_PATTERN = /^[A-Za-z0-9]{20,128}$/;

@Component({
  selector: 'app-universe-members',
  imports: [
    ReactiveFormsModule,
    PrimaryButtonComponent,
    DangerButtonComponent,
  ],
  template: `
    <section class="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div>
        <h2 class="m-0 text-lg font-semibold text-slate-900">Access</h2>
        @if (universe(); as u) {
          <p class="m-0 mt-0.5 text-sm text-slate-600">
            Owner and contributors of <strong>{{ u.name }}</strong>.
          </p>
        }
      </div>

      @if (universe(); as u) {
        <ul class="m-0 flex list-none flex-col gap-1 p-0">
          <li
            class="flex items-center justify-between gap-3 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
          >
            <div class="flex flex-col">
              <span class="font-medium text-slate-700">Owner</span>
              <code class="break-all text-xs text-slate-600">{{ u.ownerUid }}</code>
            </div>
            @if (isYou(u.ownerUid)) {
              <span class="shrink-0 rounded-full bg-indigo-100 px-2 py-0.5 text-xs text-indigo-800">
                you
              </span>
            }
          </li>
          @for (uid of u.editorUids; track uid) {
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
                  (click)="confirmRemove(u.id, uid)"
                >Remove</button>
              </div>
            </li>
          }
        </ul>

        <form [formGroup]="form" class="flex flex-col gap-2" (ngSubmit)="onAdd(u.id, u.ownerUid, u.editorUids)">
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
      } @else {
        <p class="m-0 text-sm italic text-slate-500">No active universe.</p>
      }
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UniverseMembersComponent {
  private readonly service = inject(UniversesService);
  private readonly store = inject(UniverseStore);
  private readonly auth = inject(AuthStore);

  protected readonly universe = this.store.activeUniverse;
  protected readonly busy = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly currentUid = computed(() => this.auth.user()?.uid ?? null);

  protected readonly form = new FormBuilder().nonNullable.group({
    uid: ['', [Validators.required, Validators.pattern(UID_PATTERN)]],
  });

  protected isYou(uid: string): boolean {
    return this.currentUid() === uid;
  }

  protected async onAdd(universeId: string, ownerUid: string, editorUids: string[]): Promise<void> {
    if (this.form.invalid) return;
    const uid = this.form.getRawValue().uid.trim();
    if (uid === ownerUid) {
      this.errorMessage.set('That UID is already the owner.');
      return;
    }
    if (editorUids.includes(uid)) {
      this.errorMessage.set('That UID is already a contributor.');
      return;
    }
    this.busy.set(true);
    this.errorMessage.set(null);
    try {
      await this.service.addEditor(universeId, uid);
      await this.store.refresh();
      this.form.reset({ uid: '' });
    } catch (err) {
      this.errorMessage.set(err instanceof Error ? `${err.name}: ${err.message}` : String(err));
    } finally {
      this.busy.set(false);
    }
  }

  protected async confirmRemove(universeId: string, uid: string): Promise<void> {
    const label = this.isYou(uid) ? 'yourself' : `contributor "${uid}"`;
    if (!confirm(`Remove ${label} from this universe?`)) return;
    this.busy.set(true);
    this.errorMessage.set(null);
    try {
      await this.service.removeEditor(universeId, uid);
      await this.store.refresh();
    } catch (err) {
      this.errorMessage.set(err instanceof Error ? `${err.name}: ${err.message}` : String(err));
    } finally {
      this.busy.set(false);
    }
  }
}
