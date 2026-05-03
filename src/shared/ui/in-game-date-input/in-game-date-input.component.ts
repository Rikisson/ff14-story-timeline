import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { CalendarService } from '@features/calendar';
import { InGameDate } from '@shared/models';

@Component({
  selector: 'app-in-game-date-input',
  template: `
    <fieldset class="flex flex-col gap-2 rounded-md border border-slate-200 p-3">
      @if (label(); as l) {
        <legend class="px-1 text-sm font-medium text-slate-700">{{ l }}</legend>
      }

      <div class="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
        @if (eras().length > 0) {
          <label class="flex flex-col gap-1 text-xs text-slate-600">
            <span>Era</span>
            <select
              class="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm"
              [value]="value()?.era ?? ''"
              (change)="onEra($event)"
            >
              <option value="">—</option>
              @for (e of eras(); track e.id) {
                <option [value]="e.id">{{ e.name }}</option>
              }
            </select>
          </label>
        }
        <label class="flex flex-col gap-1 text-xs text-slate-600">
          <span>Year</span>
          <input
            type="number"
            class="h-9 w-24 rounded-md border border-slate-300 bg-white px-2 text-sm"
            [value]="value()?.year ?? ''"
            (input)="onField('year', $event)"
          />
        </label>
        <label class="flex flex-col gap-1 text-xs text-slate-600">
          <span>Month</span>
          @if (months().length > 0) {
            <select
              class="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm"
              [value]="value()?.month ?? ''"
              (change)="onField('month', $event)"
            >
              <option value="">—</option>
              @for (m of months(); track m.id; let i = $index) {
                <option [value]="i + 1">{{ m.name }}</option>
              }
            </select>
          } @else {
            <input
              type="number"
              min="1"
              class="h-9 w-20 rounded-md border border-slate-300 bg-white px-2 text-sm"
              [value]="value()?.month ?? ''"
              (input)="onField('month', $event)"
            />
          }
        </label>
        <label class="flex flex-col gap-1 text-xs text-slate-600">
          <span>Day</span>
          <input
            type="number"
            min="1"
            [max]="dayMax()"
            class="h-9 w-20 rounded-md border border-slate-300 bg-white px-2 text-sm"
            [value]="value()?.day ?? ''"
            (input)="onField('day', $event)"
          />
        </label>
      </div>

      <div class="grid gap-2 sm:grid-cols-3">
        <label class="flex flex-col gap-1 text-xs text-slate-600">
          <span>Hour</span>
          <input
            type="number"
            min="0"
            [max]="hourMax()"
            class="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm"
            [value]="value()?.hour ?? ''"
            (input)="onField('hour', $event)"
          />
        </label>
        <label class="flex flex-col gap-1 text-xs text-slate-600">
          <span>Minute</span>
          <input
            type="number"
            min="0"
            [max]="minuteMax()"
            class="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm"
            [value]="value()?.minute ?? ''"
            (input)="onField('minute', $event)"
          />
        </label>
        <label class="flex flex-col gap-1 text-xs text-slate-600">
          <span>Second</span>
          <input
            type="number"
            min="0"
            [max]="secondMax()"
            class="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm"
            [value]="value()?.second ?? ''"
            (input)="onField('second', $event)"
          />
        </label>
      </div>

      <label class="flex flex-col gap-1 text-xs text-slate-600">
        <span>Display override (optional — replaces the formatted output)</span>
        <input
          type="text"
          class="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm"
          placeholder="e.g. Spring of the Wolf, 1577"
          [value]="value()?.display ?? ''"
          (input)="onDisplay($event)"
        />
      </label>
    </fieldset>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InGameDateInputComponent {
  readonly value = input<InGameDate | null>(null);
  readonly label = input<string | null>(null);
  readonly valueChanged = output<InGameDate>();

  private readonly calendar = inject(CalendarService);
  protected readonly eras = this.calendar.eras;
  protected readonly months = this.calendar.months;

  protected readonly currentEra = computed(() => {
    const v = this.value();
    if (!v?.era) return undefined;
    return this.eras().find((e) => e.id === v.era);
  });

  protected readonly dayMax = computed(() => {
    const v = this.value();
    if (v?.month && v.month >= 1 && v.month <= this.months().length) {
      return this.months()[v.month - 1].days;
    }
    return undefined;
  });

  protected readonly hourMax = computed(() => (this.currentEra()?.hoursPerDay ?? 24) - 1);
  protected readonly minuteMax = computed(() => (this.currentEra()?.minutesPerHour ?? 60) - 1);
  protected readonly secondMax = computed(() => (this.currentEra()?.secondsPerMinute ?? 60) - 1);

  protected onEra(event: Event): void {
    const id = (event.target as HTMLSelectElement).value;
    const next: InGameDate = { ...(this.value() ?? {}) };
    if (id) next.era = id;
    else delete next.era;
    this.valueChanged.emit(next);
  }

  protected onField(
    key: 'year' | 'month' | 'day' | 'hour' | 'minute' | 'second',
    event: Event,
  ): void {
    const raw = (event.target as HTMLInputElement | HTMLSelectElement).value;
    const next: InGameDate = { ...(this.value() ?? {}) };
    if (raw === '') delete next[key];
    else {
      const n = parseInt(raw, 10);
      if (Number.isFinite(n)) next[key] = n;
    }
    this.valueChanged.emit(next);
  }

  protected onDisplay(event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    const next: InGameDate = { ...(this.value() ?? {}) };
    if (raw) next.display = raw;
    else delete next.display;
    this.valueChanged.emit(next);
  }
}
