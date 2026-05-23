import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { provideTranslocoScope, TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { ProjectionRebuildService } from '../../../app/data-access/projection-rebuild.service';
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
  EARTH_CALENDAR_PRESET,
  FF14_CALENDAR_PRESET,
  withFreshCalendarIds,
} from '../data-access/calendar.presets';
import {
  Calendar,
  CalendarEra,
  CalendarMonth,
  CalendarWeekday,
  DEFAULT_HOURS_PER_DAY,
  DEFAULT_MINUTES_PER_HOUR,
  DEFAULT_SECONDS_PER_MINUTE,
} from '../data-access/calendar.types';
import calendarEn from '../i18n/en.json';
import calendarUk from '../i18n/uk.json';

@Component({
  selector: 'app-calendar-settings-panel',
  imports: [
    CdkDropList,
    CdkDrag,
    CdkDragHandle,
    PrimaryButtonComponent,
    SecondaryButtonComponent,
    GhostButtonComponent,
    DangerButtonComponent,
    TranslocoDirective,
  ],
  providers: [
    provideTranslocoScope({
      scope: 'calendar',
      loader: {
        en: () => Promise.resolve(calendarEn),
        uk: () => Promise.resolve(calendarUk),
      },
    }),
  ],
  template: `
    <ng-container *transloco="let t; prefix: 'calendar'">
      <ng-container *transloco="let g; prefix: 'general'">
        <section class="relative flex flex-col gap-6 rounded-lg border border-border bg-surface p-4 shadow-sm">
          @if (rebuildProgress(); as p) {
            <div
              class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-lg bg-backdrop text-foreground"
              role="status"
              aria-live="polite"
            >
              <p class="m-0 text-sm font-semibold">{{ t('message.rebuildingHeader') }}</p>
              <p class="m-0 text-sm">
                {{ t('message.rebuildingProgress', { processed: p.processed, total: p.total }) }}
              </p>
            </div>
          }
          <header class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 class="m-0 text-base font-semibold text-foreground">{{ t('field.header') }}</h2>
              <p class="m-0 mt-0.5 text-sm text-foreground-subtle">
                {{ t('field.subtitle') }}
              </p>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              @if (canEdit()) {
                <button uiSecondary type="button" (click)="applyPreset('earth')">{{ t('action.earthPreset') }}</button>
                <button uiSecondary type="button" (click)="applyPreset('ff14')">{{ t('action.ff14Preset') }}</button>
              }
              @if (dirty()) {
                <span class="text-sm text-warning-foreground">{{ t('message.unsavedChanges') }}</span>
              }
              <button uiGhost type="button" [disabled]="!dirty()" (click)="reset()">{{ t('action.reset') }}</button>
              <button
                uiPrimary
                type="button"
                [loading]="saving()"
                [disabled]="!dirty() || saving() || !canEdit()"
                (click)="save()"
              >
                {{ g('action.save') }}
              </button>
            </div>
          </header>

          @if (errorMessage(); as e) {
            <p class="m-0 text-sm text-danger-foreground">{{ e }}</p>
          }

          <details
            class="rounded-md border border-border"
            [open]="erasOpen()"
            (toggle)="onErasToggle($event)"
          >
            <summary
              class="flex cursor-pointer list-none items-center gap-3 rounded-md px-3 py-2 hover:bg-surface-subtle"
            >
              <h3 class="m-0 text-base font-semibold text-foreground">
                {{ t('field.erasHeader') }} <span class="text-sm font-normal text-foreground-faint">({{ eras().length }})</span>
              </h3>
              <span class="ml-auto flex items-center gap-2">
                @if (canEdit()) {
                  <button
                    uiSecondary
                    type="button"
                    (click)="$event.stopPropagation(); addEra()"
                  >{{ t('action.addEra') }}</button>
                }
                <svg
                  class="size-4 shrink-0 text-foreground-faint transition-transform"
                  [class.rotate-180]="erasOpen()"
                  aria-hidden="true"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <polyline points="5 8 10 13 15 8" />
                </svg>
              </span>
            </summary>

            <div class="flex flex-col gap-2 border-t border-border p-3">
            @if (eras().length === 0) {
              <p class="m-0 text-sm text-foreground-subtle">{{ t('empty.eras') }}</p>
            } @else {
              <ul cdkDropList class="flex flex-col gap-2" (cdkDropListDropped)="dropEra($event)">
                @for (era of eras(); track era.id; let i = $index) {
                  <li
                    cdkDrag
                    [cdkDragDisabled]="!canEdit()"
                    class="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3 shadow-sm"
                  >
                    <div class="flex items-start gap-3">
                      <button
                        type="button"
                        cdkDragHandle
                        class="inline-flex size-9 shrink-0 cursor-grab items-center justify-center rounded-full border-0 bg-tone-indigo text-sm font-semibold text-tone-indigo-foreground"
                        [attr.aria-label]="t('tooltip.dragEra', { index: i + 1 })"
                      >
                        {{ i + 1 }}
                      </button>
                      <div class="flex flex-1 flex-wrap gap-2">
                        <label class="flex min-w-[10rem] flex-[2_1_10rem] flex-col gap-1 text-sm">
                          <span class="font-medium text-foreground-muted">{{ t('field.name') }}</span>
                          <input
                            type="text"
                            class="h-10 rounded-md border border-border-strong bg-surface text-foreground placeholder:text-foreground-faint px-3 text-sm"
                            [value]="era.name"
                            [disabled]="!canEdit()"
                            (input)="updateEra(i, { name: text($event) })"
                          />
                        </label>
                        <label class="flex min-w-[7rem] flex-1 flex-col gap-1 text-sm">
                          <span class="font-medium text-foreground-muted">{{ t('field.slugOptional') }}</span>
                          <input
                            type="text"
                            class="h-10 rounded-md border border-border-strong bg-surface text-foreground placeholder:text-foreground-faint px-3 text-sm"
                            [value]="era.slug ?? ''"
                            [disabled]="!canEdit()"
                            (input)="updateEra(i, { slug: text($event) || undefined })"
                          />
                        </label>
                        <label class="flex min-w-[6rem] flex-1 flex-col gap-1 text-sm">
                          <span class="font-medium text-foreground-muted">{{ t('field.maxYears') }}</span>
                          <input
                            type="number"
                            min="0"
                            class="h-10 rounded-md border border-border-strong bg-surface text-foreground placeholder:text-foreground-faint px-3 text-sm"
                            [value]="era.maxYears ?? ''"
                            [disabled]="!canEdit()"
                            [placeholder]="t('empty.maxYearsPlaceholder')"
                            (input)="updateEra(i, { maxYears: optionalInt($event) })"
                          />
                        </label>
                      </div>
                    </div>

                    <div class="flex flex-wrap gap-2 pl-12">
                      <label class="flex min-w-[7rem] flex-1 flex-col gap-1 text-sm">
                        <span class="font-medium text-foreground-muted">{{ t('field.hoursPerDay') }}</span>
                        <input
                          type="number"
                          min="1"
                          class="h-10 rounded-md border border-border-strong bg-surface text-foreground placeholder:text-foreground-faint px-3 text-sm"
                          [value]="era.hoursPerDay ?? ''"
                          [disabled]="!canEdit()"
                          [placeholder]="defaultHoursPerDay"
                          (input)="updateEra(i, { hoursPerDay: optionalInt($event) })"
                        />
                      </label>
                      <label class="flex min-w-[7rem] flex-1 flex-col gap-1 text-sm">
                        <span class="font-medium text-foreground-muted">{{ t('field.minutesPerHour') }}</span>
                        <input
                          type="number"
                          min="1"
                          class="h-10 rounded-md border border-border-strong bg-surface text-foreground placeholder:text-foreground-faint px-3 text-sm"
                          [value]="era.minutesPerHour ?? ''"
                          [disabled]="!canEdit()"
                          [placeholder]="defaultMinutesPerHour"
                          (input)="updateEra(i, { minutesPerHour: optionalInt($event) })"
                        />
                      </label>
                      <label class="flex min-w-[7rem] flex-1 flex-col gap-1 text-sm">
                        <span class="font-medium text-foreground-muted">{{ t('field.secondsPerMinute') }}</span>
                        <input
                          type="number"
                          min="1"
                          class="h-10 rounded-md border border-border-strong bg-surface text-foreground placeholder:text-foreground-faint px-3 text-sm"
                          [value]="era.secondsPerMinute ?? ''"
                          [disabled]="!canEdit()"
                          [placeholder]="defaultSecondsPerMinute"
                          (input)="updateEra(i, { secondsPerMinute: optionalInt($event) })"
                        />
                      </label>
                    </div>

                    <div class="flex items-start gap-3 pl-12 text-sm">
                      <label class="flex flex-1 items-start gap-2">
                        <input
                          type="checkbox"
                          class="mt-1"
                          [checked]="!!era.resetsWeek"
                          [disabled]="!canEdit()"
                          (change)="updateEra(i, { resetsWeek: checked($event) || undefined })"
                        />
                        <span class="flex flex-col gap-0.5">
                          <span class="font-medium text-foreground-muted">{{ t('field.resetsWeekday') }}</span>
                          <span class="text-xs text-foreground-faint">
                            {{ t('message.resetsWeekdayHint') }}
                          </span>
                        </span>
                      </label>
                      @if (canEdit()) {
                        <button uiDanger type="button" (click)="removeEra(i)">{{ g('action.remove') }}</button>
                      }
                    </div>
                  </li>
                }
              </ul>
            }
            </div>
          </details>

          <details
            class="rounded-md border border-border"
            [open]="monthsOpen()"
            (toggle)="onMonthsToggle($event)"
          >
            <summary
              class="flex cursor-pointer list-none items-center gap-3 rounded-md px-3 py-2 hover:bg-surface-subtle"
            >
              <h3 class="m-0 text-base font-semibold text-foreground">
                {{ t('field.monthsHeader') }} <span class="text-sm font-normal text-foreground-faint">({{ months().length }})</span>
              </h3>
              <span class="ml-auto flex items-center gap-2">
                @if (canEdit()) {
                  <button
                    uiSecondary
                    type="button"
                    (click)="$event.stopPropagation(); addMonth()"
                  >{{ t('action.addMonth') }}</button>
                }
                <svg
                  class="size-4 shrink-0 text-foreground-faint transition-transform"
                  [class.rotate-180]="monthsOpen()"
                  aria-hidden="true"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <polyline points="5 8 10 13 15 8" />
                </svg>
              </span>
            </summary>

            <div class="flex flex-col gap-2 border-t border-border p-3">
            @if (months().length === 0) {
              <p class="m-0 text-sm text-foreground-subtle">{{ t('empty.months') }}</p>
            } @else {
              <ul
                cdkDropList
                class="flex flex-col gap-2"
                (cdkDropListDropped)="dropMonth($event)"
              >
                @for (month of months(); track month.id; let i = $index) {
                  <li
                    cdkDrag
                    [cdkDragDisabled]="!canEdit()"
                    class="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3 shadow-sm"
                  >
                    <div class="flex items-start gap-3">
                      <button
                        type="button"
                        cdkDragHandle
                        class="inline-flex size-9 shrink-0 cursor-grab items-center justify-center rounded-full border-0 bg-tone-emerald text-sm font-semibold text-tone-emerald-foreground"
                        [attr.aria-label]="t('tooltip.dragMonth', { index: i + 1 })"
                      >
                        {{ i + 1 }}
                      </button>
                      <div class="flex flex-1 flex-wrap gap-2">
                        <label class="flex min-w-[8rem] flex-[2_1_8rem] flex-col gap-1 text-sm">
                          <span class="font-medium text-foreground-muted">{{ t('field.name') }}</span>
                          <input
                            type="text"
                            class="h-10 rounded-md border border-border-strong bg-surface text-foreground placeholder:text-foreground-faint px-3 text-sm"
                            [value]="month.name"
                            [disabled]="!canEdit()"
                            (input)="updateMonth(i, { name: text($event) })"
                          />
                        </label>
                        <label class="flex min-w-[5rem] flex-1 flex-col gap-1 text-sm">
                          <span class="font-medium text-foreground-muted">{{ t('field.days') }}</span>
                          <input
                            type="number"
                            min="1"
                            class="h-10 rounded-md border border-border-strong bg-surface text-foreground placeholder:text-foreground-faint px-3 text-sm"
                            [value]="month.days"
                            [disabled]="!canEdit()"
                            (input)="updateMonth(i, { days: requiredInt($event) })"
                          />
                        </label>
                      </div>
                      @if (canEdit()) {
                        <button
                          uiDanger
                          type="button"
                          class="mt-6 shrink-0"
                          (click)="removeMonth(i)"
                        >{{ g('action.remove') }}</button>
                      }
                    </div>
                  </li>
                }
              </ul>
            }
            </div>
          </details>

          <details
            class="rounded-md border border-border"
            [open]="weekdaysOpen()"
            (toggle)="onWeekdaysToggle($event)"
          >
            <summary
              class="flex cursor-pointer list-none items-center gap-3 rounded-md px-3 py-2 hover:bg-surface-subtle"
            >
              <div class="flex flex-col">
                <h3 class="m-0 text-base font-semibold text-foreground">
                  {{ t('field.weekdaysHeader') }} <span class="text-sm font-normal text-foreground-faint">({{ weekdays().length }})</span>
                </h3>
                <p class="m-0 mt-0.5 text-xs text-foreground-faint">
                  {{ t('field.weekdaysSubtitle') }}
                </p>
              </div>
              <span class="ml-auto flex items-center gap-2">
                @if (canEdit()) {
                  <button
                    uiSecondary
                    type="button"
                    (click)="$event.stopPropagation(); addWeekday()"
                  >{{ t('action.addWeekday') }}</button>
                }
                <svg
                  class="size-4 shrink-0 text-foreground-faint transition-transform"
                  [class.rotate-180]="weekdaysOpen()"
                  aria-hidden="true"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <polyline points="5 8 10 13 15 8" />
                </svg>
              </span>
            </summary>

            <div class="flex flex-col gap-2 border-t border-border p-3">
            @if (weekdays().length === 0) {
              <p class="m-0 text-sm text-foreground-subtle">{{ t('empty.weekdays') }}</p>
            } @else {
              <ul
                cdkDropList
                class="flex flex-col gap-2"
                (cdkDropListDropped)="dropWeekday($event)"
              >
                @for (wd of weekdays(); track wd.id; let i = $index) {
                  <li
                    cdkDrag
                    [cdkDragDisabled]="!canEdit()"
                    class="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3 shadow-sm"
                  >
                    <div class="flex items-start gap-3">
                      <button
                        type="button"
                        cdkDragHandle
                        class="inline-flex size-9 shrink-0 cursor-grab items-center justify-center rounded-full border-0 bg-tone-amber text-sm font-semibold text-tone-amber-foreground"
                        [attr.aria-label]="t('tooltip.dragWeekday', { index: i + 1 })"
                      >
                        {{ i + 1 }}
                      </button>
                      <div class="flex flex-1 flex-wrap gap-2">
                        <label class="flex min-w-[8rem] flex-[2_1_8rem] flex-col gap-1 text-sm">
                          <span class="font-medium text-foreground-muted">{{ t('field.name') }}</span>
                          <input
                            type="text"
                            class="h-10 rounded-md border border-border-strong bg-surface text-foreground placeholder:text-foreground-faint px-3 text-sm"
                            [value]="wd.name"
                            [disabled]="!canEdit()"
                            (input)="updateWeekday(i, { name: text($event) })"
                          />
                        </label>
                        <label class="flex min-w-[5rem] flex-1 flex-col gap-1 text-sm">
                          <span class="font-medium text-foreground-muted">{{ t('field.short') }}</span>
                          <input
                            type="text"
                            class="h-10 rounded-md border border-border-strong bg-surface text-foreground placeholder:text-foreground-faint px-3 text-sm"
                            [value]="wd.short ?? ''"
                            [disabled]="!canEdit()"
                            (input)="updateWeekday(i, { short: text($event) || undefined })"
                          />
                        </label>
                      </div>
                      @if (canEdit()) {
                        <button
                          uiDanger
                          type="button"
                          class="mt-6 shrink-0"
                          (click)="removeWeekday(i)"
                        >{{ g('action.remove') }}</button>
                      }
                    </div>
                  </li>
                }
              </ul>
            }
            </div>
          </details>
        </section>
      </ng-container>
    </ng-container>
  `,
  styles: [`
    summary::-webkit-details-marker { display: none; }
    summary { list-style: none; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalendarSettingsPanelComponent {
  private readonly service = inject(CalendarService);
  private readonly rebuild = inject(ProjectionRebuildService);
  private readonly universes = inject(UniverseStore);
  private readonly user = inject(AuthStore).user;
  private readonly transloco = inject(TranslocoService);

  protected readonly defaultHoursPerDay = String(DEFAULT_HOURS_PER_DAY);
  protected readonly defaultMinutesPerHour = String(DEFAULT_MINUTES_PER_HOUR);
  protected readonly defaultSecondsPerMinute = String(DEFAULT_SECONDS_PER_MINUTE);

  protected readonly canEdit = computed(
    () => !!this.user() && this.universes.isMemberOfActive(),
  );

  protected readonly draft = signal<Calendar>(this.service.calendar());
  protected readonly eras = computed(() => this.draft().eras);
  protected readonly months = computed(() => this.draft().months);
  protected readonly weekdays = computed<CalendarWeekday[]>(() => this.draft().weekdays ?? []);

  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly erasOpen = signal(this.draft().eras.length === 0);
  protected readonly monthsOpen = signal(this.draft().months.length === 0);
  protected readonly weekdaysOpen = signal((this.draft().weekdays ?? []).length === 0);

  protected onErasToggle(event: Event): void {
    const el = event.target as HTMLDetailsElement;
    if (el.open !== this.erasOpen()) this.erasOpen.set(el.open);
  }
  protected onMonthsToggle(event: Event): void {
    const el = event.target as HTMLDetailsElement;
    if (el.open !== this.monthsOpen()) this.monthsOpen.set(el.open);
  }
  protected onWeekdaysToggle(event: Event): void {
    const el = event.target as HTMLDetailsElement;
    if (el.open !== this.weekdaysOpen()) this.weekdaysOpen.set(el.open);
  }

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

  /**
   * Save the calendar config and block on a projection rebuild — every
   * story and event in the universe has a `dateSortKey` derived from the
   * calendar's era/month layout, so any save without the rebuild leaves
   * the timeline silently scrambled. The progress overlay stays up until
   * the rebuild finishes per `docs/backend-rules.md` *Write discipline*.
   */
  protected async save(): Promise<void> {
    this.saving.set(true);
    this.errorMessage.set(null);
    try {
      await this.service.save(this.draft());
    } catch (err) {
      this.errorMessage.set(err instanceof Error ? `${err.name}: ${err.message}` : String(err));
      this.saving.set(false);
      return;
    }
    const universeId = this.universes.activeUniverseId();
    if (!universeId) {
      this.saving.set(false);
      return;
    }
    try {
      await this.rebuild.rebuildForCalendarChange(universeId);
    } catch (err) {
      this.errorMessage.set(err instanceof Error ? `${err.name}: ${err.message}` : String(err));
    } finally {
      this.saving.set(false);
    }
  }

  /** Bound by the template — surfaces the rebuild progress while we save. */
  protected readonly rebuildProgress = computed(() => {
    const p = this.rebuild.progress();
    return p.phase === 'processing' || p.phase === 'starting' ? p : null;
  });

  protected applyPreset(kind: 'earth' | 'ff14'): void {
    const label = this.transloco.translate(
      kind === 'earth' ? 'calendar.message.presetEarth' : 'calendar.message.presetFf14',
    );
    const ok = window.confirm(
      this.transloco.translate('calendar.message.applyPresetConfirm', { label }),
    );
    if (!ok) return;
    this.errorMessage.set(null);
    const base = kind === 'earth' ? EARTH_CALENDAR_PRESET : FF14_CALENDAR_PRESET;
    this.draft.set(withFreshCalendarIds(base));
  }

  protected addEra(): void {
    this.draft.update((c) => {
      const last = c.eras.at(-1);
      const era: CalendarEra = {
        id: crypto.randomUUID(),
        name: this.transloco.translate('calendar.message.newEraName', { index: c.eras.length + 1 }),
        maxYears: last?.maxYears,
        hoursPerDay: last?.hoursPerDay,
        minutesPerHour: last?.minutesPerHour,
        secondsPerMinute: last?.secondsPerMinute,
      };
      return { ...c, eras: [...c.eras, era] };
    });
    this.erasOpen.set(true);
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
        name: this.transloco.translate('calendar.message.newMonthName', { index: c.months.length + 1 }),
        days: last?.days ?? 30,
      };
      return { ...c, months: [...c.months, month] };
    });
    this.monthsOpen.set(true);
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

  protected addWeekday(): void {
    this.draft.update((c) => {
      const wds = c.weekdays ?? [];
      const wd: CalendarWeekday = {
        id: crypto.randomUUID(),
        name: this.transloco.translate('calendar.message.newWeekdayName', { index: wds.length + 1 }),
      };
      return { ...c, weekdays: [...wds, wd] };
    });
    this.weekdaysOpen.set(true);
  }

  protected updateWeekday(index: number, patch: Partial<CalendarWeekday>): void {
    this.draft.update((c) => {
      const next = [...(c.weekdays ?? [])];
      next[index] = { ...next[index], ...patch };
      return { ...c, weekdays: next };
    });
  }

  protected removeWeekday(index: number): void {
    this.draft.update((c) => ({
      ...c,
      weekdays: (c.weekdays ?? []).filter((_, i) => i !== index),
    }));
  }

  protected dropWeekday(event: CdkDragDrop<unknown>): void {
    if (event.previousIndex === event.currentIndex) return;
    this.draft.update((c) => {
      const next = [...(c.weekdays ?? [])];
      moveItemInArray(next, event.previousIndex, event.currentIndex);
      return { ...c, weekdays: next };
    });
  }

  protected text(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected checked(event: Event): boolean {
    return (event.target as HTMLInputElement).checked;
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
    JSON.stringify({
      eras: a.eras,
      months: a.months,
      weekdays: a.weekdays ?? [],
    }) ===
    JSON.stringify({
      eras: b.eras,
      months: b.months,
      weekdays: b.weekdays ?? [],
    })
  );
}
