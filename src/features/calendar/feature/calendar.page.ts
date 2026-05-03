import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { AuthStore } from '@features/auth';
import { UniverseStore } from '@features/universes';
import {
  DangerButtonComponent,
  GhostButtonComponent,
  PrimaryButtonComponent,
  SecondaryButtonComponent,
} from '@shared/ui';
import { CalendarService } from '../data-access/calendar.service';
import {
  Calendar,
  CalendarEra,
  CalendarMonth,
  DEFAULT_HOURS_PER_DAY,
  DEFAULT_MINUTES_PER_HOUR,
  DEFAULT_SECONDS_PER_MINUTE,
} from '../data-access/calendar.types';

@Component({
  selector: 'app-calendar-page',
  host: { class: 'block h-full' },
  imports: [
    CdkDropList,
    CdkDrag,
    CdkDragHandle,
    PrimaryButtonComponent,
    SecondaryButtonComponent,
    GhostButtonComponent,
    DangerButtonComponent,
  ],
  template: `
    <div class="flex h-full flex-col gap-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 class="m-0 text-2xl font-semibold text-slate-900">Calendar</h1>
          <p class="m-0 mt-1 text-sm text-slate-600">
            Define eras and months for this universe. Drag to reorder — order is the sort key.
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          @if (canEdit()) {
            <button uiSecondary type="button" (click)="applyPreset('earth')">Earth preset</button>
            <button uiSecondary type="button" (click)="applyPreset('ff14')">FF14 preset</button>
          }
          @if (dirty()) {
            <span class="text-sm text-amber-700">Unsaved changes</span>
          }
          <button uiGhost type="button" [disabled]="!dirty()" (click)="reset()">Reset</button>
          <button
            uiPrimary
            type="button"
            [loading]="saving()"
            [disabled]="!dirty() || saving() || !canEdit()"
            (click)="save()"
          >
            Save
          </button>
        </div>
      </div>

      @if (errorMessage(); as e) {
        <p class="m-0 text-sm text-red-700">{{ e }}</p>
      }

      <div class="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row lg:gap-6">
      <section class="flex flex-col gap-3 lg:min-h-0 lg:flex-1">
        <div class="flex items-center justify-between gap-3">
          <h2 class="m-0 text-lg font-semibold text-slate-900">Eras</h2>
          @if (canEdit()) {
            <button uiSecondary type="button" (click)="addEra()">+ Add era</button>
          }
        </div>

        @if (eras().length === 0) {
          <p class="text-sm text-slate-600">No eras yet.</p>
        } @else {
          <ul cdkDropList class="flex flex-col gap-2 lg:flex-1 lg:overflow-y-auto lg:pr-1" (cdkDropListDropped)="dropEra($event)">
            @for (era of eras(); track era.id; let i = $index) {
              <li
                cdkDrag
                [cdkDragDisabled]="!canEdit()"
                class="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
              >
                <div class="flex items-start gap-3">
                  <button
                    type="button"
                    cdkDragHandle
                    class="inline-flex size-9 shrink-0 cursor-grab items-center justify-center rounded-full border-0 bg-indigo-100 text-sm font-semibold text-indigo-700"
                    [attr.aria-label]="'Era ' + (i + 1) + ', drag to reorder'"
                  >
                    {{ i + 1 }}
                  </button>
                  <div class="grid flex-1 gap-2 sm:grid-cols-[2fr_1fr_1fr]">
                    <label class="flex flex-col gap-1 text-sm">
                      <span class="font-medium text-slate-700">Name</span>
                      <input
                        type="text"
                        class="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
                        [value]="era.name"
                        [disabled]="!canEdit()"
                        (input)="updateEra(i, { name: text($event) })"
                      />
                    </label>
                    <label class="flex flex-col gap-1 text-sm">
                      <span class="font-medium text-slate-700">Slug (optional)</span>
                      <input
                        type="text"
                        class="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
                        [value]="era.slug ?? ''"
                        [disabled]="!canEdit()"
                        (input)="updateEra(i, { slug: text($event) || undefined })"
                      />
                    </label>
                    <label class="flex flex-col gap-1 text-sm">
                      <span class="font-medium text-slate-700">Max years</span>
                      <input
                        type="number"
                        min="0"
                        class="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
                        [value]="era.maxYears ?? ''"
                        [disabled]="!canEdit()"
                        placeholder="unknown"
                        (input)="updateEra(i, { maxYears: optionalInt($event) })"
                      />
                    </label>
                  </div>
                </div>

                <div class="grid gap-2 pl-12 sm:grid-cols-3">
                  <label class="flex flex-col gap-1 text-sm">
                    <span class="font-medium text-slate-700">Hours / day</span>
                    <input
                      type="number"
                      min="1"
                      class="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
                      [value]="era.hoursPerDay ?? ''"
                      [disabled]="!canEdit()"
                      [placeholder]="defaultHoursPerDay"
                      (input)="updateEra(i, { hoursPerDay: optionalInt($event) })"
                    />
                  </label>
                  <label class="flex flex-col gap-1 text-sm">
                    <span class="font-medium text-slate-700">Minutes / hour</span>
                    <input
                      type="number"
                      min="1"
                      class="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
                      [value]="era.minutesPerHour ?? ''"
                      [disabled]="!canEdit()"
                      [placeholder]="defaultMinutesPerHour"
                      (input)="updateEra(i, { minutesPerHour: optionalInt($event) })"
                    />
                  </label>
                  <label class="flex flex-col gap-1 text-sm">
                    <span class="font-medium text-slate-700">Seconds / minute</span>
                    <input
                      type="number"
                      min="1"
                      class="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
                      [value]="era.secondsPerMinute ?? ''"
                      [disabled]="!canEdit()"
                      [placeholder]="defaultSecondsPerMinute"
                      (input)="updateEra(i, { secondsPerMinute: optionalInt($event) })"
                    />
                  </label>
                </div>

                <label class="flex flex-col gap-1 pl-12 text-sm">
                  <span class="font-medium text-slate-700">Description</span>
                  <textarea
                    rows="2"
                    class="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                    [value]="era.description ?? ''"
                    [disabled]="!canEdit()"
                    (input)="updateEra(i, { description: text($event) || undefined })"
                  ></textarea>
                </label>

                @if (canEdit()) {
                  <div class="flex justify-end pl-12">
                    <button uiDanger type="button" (click)="removeEra(i)">Remove</button>
                  </div>
                }
              </li>
            }
          </ul>
        }
      </section>

      <section class="flex flex-col gap-3 lg:min-h-0 lg:flex-1">
        <div class="flex items-center justify-between gap-3">
          <h2 class="m-0 text-lg font-semibold text-slate-900">Months</h2>
          @if (canEdit()) {
            <button uiSecondary type="button" (click)="addMonth()">+ Add month</button>
          }
        </div>

        @if (months().length === 0) {
          <p class="text-sm text-slate-600">No months yet.</p>
        } @else {
          <ul cdkDropList class="flex flex-col gap-2 lg:flex-1 lg:overflow-y-auto lg:pr-1" (cdkDropListDropped)="dropMonth($event)">
            @for (month of months(); track month.id; let i = $index) {
              <li
                cdkDrag
                [cdkDragDisabled]="!canEdit()"
                class="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
              >
                <div class="flex items-start gap-3">
                  <button
                    type="button"
                    cdkDragHandle
                    class="inline-flex size-9 shrink-0 cursor-grab items-center justify-center rounded-full border-0 bg-emerald-100 text-sm font-semibold text-emerald-700"
                    [attr.aria-label]="'Month ' + (i + 1) + ', drag to reorder'"
                  >
                    {{ i + 1 }}
                  </button>
                  <div class="grid flex-1 gap-2 sm:grid-cols-[2fr_1fr]">
                    <label class="flex flex-col gap-1 text-sm">
                      <span class="font-medium text-slate-700">Name</span>
                      <input
                        type="text"
                        class="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
                        [value]="month.name"
                        [disabled]="!canEdit()"
                        (input)="updateMonth(i, { name: text($event) })"
                      />
                    </label>
                    <label class="flex flex-col gap-1 text-sm">
                      <span class="font-medium text-slate-700">Days</span>
                      <input
                        type="number"
                        min="1"
                        class="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
                        [value]="month.days"
                        [disabled]="!canEdit()"
                        (input)="updateMonth(i, { days: requiredInt($event) })"
                      />
                    </label>
                  </div>
                </div>

                <label class="flex flex-col gap-1 pl-12 text-sm">
                  <span class="font-medium text-slate-700">Description</span>
                  <textarea
                    rows="2"
                    class="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                    [value]="month.description ?? ''"
                    [disabled]="!canEdit()"
                    (input)="updateMonth(i, { description: text($event) || undefined })"
                  ></textarea>
                </label>

                @if (canEdit()) {
                  <div class="flex justify-end pl-12">
                    <button uiDanger type="button" (click)="removeMonth(i)">Remove</button>
                  </div>
                }
              </li>
            }
          </ul>
        }
      </section>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalendarPage {
  private readonly service = inject(CalendarService);
  private readonly universes = inject(UniverseStore);
  private readonly user = inject(AuthStore).user;

  protected readonly defaultHoursPerDay = String(DEFAULT_HOURS_PER_DAY);
  protected readonly defaultMinutesPerHour = String(DEFAULT_MINUTES_PER_HOUR);
  protected readonly defaultSecondsPerMinute = String(DEFAULT_SECONDS_PER_MINUTE);

  protected readonly canEdit = computed(
    () => !!this.user() && this.universes.isMemberOfActive(),
  );

  protected readonly draft = signal<Calendar>(this.service.calendar());
  protected readonly eras = computed(() => this.draft().eras);
  protected readonly months = computed(() => this.draft().months);

  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly dirty = computed(
    () => !sameCalendar(this.draft(), this.service.calendar()),
  );

  constructor() {
    let lastServerSnapshot = this.service.calendar();
    effect(() => {
      const current = this.service.calendar();
      if (current !== lastServerSnapshot) {
        if (sameCalendar(this.draft(), lastServerSnapshot)) {
          this.draft.set(current);
        }
        lastServerSnapshot = current;
      }
    });
  }

  protected reset(): void {
    this.draft.set(this.service.calendar());
    this.errorMessage.set(null);
  }

  protected async save(): Promise<void> {
    this.saving.set(true);
    this.errorMessage.set(null);
    try {
      await this.service.save(this.draft());
    } catch (err) {
      this.errorMessage.set(err instanceof Error ? `${err.name}: ${err.message}` : String(err));
    } finally {
      this.saving.set(false);
    }
  }

  protected applyPreset(kind: 'earth' | 'ff14'): void {
    const label = kind === 'earth' ? 'Earth' : 'FF14';
    const ok = window.confirm(
      `Replace the current calendar with the ${label} preset? Any unsaved changes will be lost.`,
    );
    if (!ok) return;
    this.errorMessage.set(null);
    this.draft.set(kind === 'earth' ? earthCalendarPreset() : ff14CalendarPreset());
  }

  protected addEra(): void {
    this.draft.update((c) => {
      const last = c.eras.at(-1);
      const era: CalendarEra = {
        id: crypto.randomUUID(),
        name: `Era ${c.eras.length + 1}`,
        maxYears: last?.maxYears,
        hoursPerDay: last?.hoursPerDay,
        minutesPerHour: last?.minutesPerHour,
        secondsPerMinute: last?.secondsPerMinute,
      };
      return { ...c, eras: [...c.eras, era] };
    });
  }

  protected updateEra(index: number, patch: Partial<CalendarEra>): void {
    this.draft.update((c) => {
      const next = [...c.eras];
      next[index] = { ...next[index], ...patch };
      return { ...c, eras: next };
    });
  }

  protected removeEra(index: number): void {
    this.draft.update((c) => ({ ...c, eras: c.eras.filter((_, i) => i !== index) }));
  }

  protected dropEra(event: CdkDragDrop<unknown>): void {
    if (event.previousIndex === event.currentIndex) return;
    this.draft.update((c) => {
      const next = [...c.eras];
      moveItemInArray(next, event.previousIndex, event.currentIndex);
      return { ...c, eras: next };
    });
  }

  protected addMonth(): void {
    this.draft.update((c) => {
      const last = c.months.at(-1);
      const month: CalendarMonth = {
        id: crypto.randomUUID(),
        name: `Month ${c.months.length + 1}`,
        days: last?.days ?? 30,
      };
      return { ...c, months: [...c.months, month] };
    });
  }

  protected updateMonth(index: number, patch: Partial<CalendarMonth>): void {
    this.draft.update((c) => {
      const next = [...c.months];
      next[index] = { ...next[index], ...patch };
      return { ...c, months: next };
    });
  }

  protected removeMonth(index: number): void {
    this.draft.update((c) => ({ ...c, months: c.months.filter((_, i) => i !== index) }));
  }

  protected dropMonth(event: CdkDragDrop<unknown>): void {
    if (event.previousIndex === event.currentIndex) return;
    this.draft.update((c) => {
      const next = [...c.months];
      moveItemInArray(next, event.previousIndex, event.currentIndex);
      return { ...c, months: next };
    });
  }

  protected text(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected optionalInt(event: Event): number | undefined {
    const v = (event.target as HTMLInputElement).value;
    if (v === '') return undefined;
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : undefined;
  }

  protected requiredInt(event: Event): number {
    const v = (event.target as HTMLInputElement).value;
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : 0;
  }
}

function sameCalendar(a: Calendar, b: Calendar): boolean {
  return (
    JSON.stringify({ eras: a.eras, months: a.months }) ===
    JSON.stringify({ eras: b.eras, months: b.months })
  );
}

function earthCalendarPreset(): Calendar {
  return {
    eras: [
      {
        id: crypto.randomUUID(),
        slug: 'common-era',
        name: 'Common Era',
        hoursPerDay: 24,
        minutesPerHour: 60,
        secondsPerMinute: 60,
      },
    ],
    months: [
      { id: crypto.randomUUID(), name: 'January', days: 31 },
      { id: crypto.randomUUID(), name: 'February', days: 28 },
      { id: crypto.randomUUID(), name: 'March', days: 31 },
      { id: crypto.randomUUID(), name: 'April', days: 30 },
      { id: crypto.randomUUID(), name: 'May', days: 31 },
      { id: crypto.randomUUID(), name: 'June', days: 30 },
      { id: crypto.randomUUID(), name: 'July', days: 31 },
      { id: crypto.randomUUID(), name: 'August', days: 31 },
      { id: crypto.randomUUID(), name: 'September', days: 30 },
      { id: crypto.randomUUID(), name: 'October', days: 31 },
      { id: crypto.randomUUID(), name: 'November', days: 30 },
      { id: crypto.randomUUID(), name: 'December', days: 31 },
    ],
  };
}

function ff14CalendarPreset(): Calendar {
  return {
    eras: [
      {
        id: crypto.randomUUID(),
        slug: 'sixth-astral',
        name: 'Sixth Astral Era',
        maxYears: 1577,
        hoursPerDay: 24,
        minutesPerHour: 60,
        secondsPerMinute: 60,
        description: 'The age that ended with the Calamity.',
      },
      {
        id: crypto.randomUUID(),
        slug: 'seventh-umbral',
        name: 'Seventh Umbral Era',
        hoursPerDay: 24,
        minutesPerHour: 60,
        secondsPerMinute: 60,
        description: 'Born from the fall of Dalamud.',
      },
    ],
    months: [
      { id: crypto.randomUUID(), name: '1st Astral Moon', days: 32 },
      { id: crypto.randomUUID(), name: '1st Umbral Moon', days: 32 },
      { id: crypto.randomUUID(), name: '2nd Astral Moon', days: 32 },
      { id: crypto.randomUUID(), name: '2nd Umbral Moon', days: 32 },
      { id: crypto.randomUUID(), name: '3rd Astral Moon', days: 32 },
      { id: crypto.randomUUID(), name: '3rd Umbral Moon', days: 32 },
      { id: crypto.randomUUID(), name: '4th Astral Moon', days: 32 },
      { id: crypto.randomUUID(), name: '4th Umbral Moon', days: 32 },
      { id: crypto.randomUUID(), name: '5th Astral Moon', days: 32 },
      { id: crypto.randomUUID(), name: '5th Umbral Moon', days: 32 },
      { id: crypto.randomUUID(), name: '6th Astral Moon', days: 32 },
      { id: crypto.randomUUID(), name: '6th Umbral Moon', days: 32 },
    ],
  };
}
