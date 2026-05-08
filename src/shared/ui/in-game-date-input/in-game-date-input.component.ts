import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { CalendarService } from '@features/calendar';
import { InGameDate, isInGameDateEmpty } from '@shared/models';

@Component({
  selector: 'app-in-game-date-input',
  template: `
    <details
      class="rounded-md border border-slate-200 bg-white"
      [open]="expanded()"
      (toggle)="onToggle($event)"
    >
      <summary
        class="flex cursor-pointer list-none items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      >
        <span class="flex flex-col">
          @if (label(); as l) {
            <span class="text-xs font-medium text-slate-600">{{ l }}</span>
          }
          @if (summary(); as s) {
            <span class="text-sm text-slate-900">{{ s }}</span>
          } @else {
            <span class="text-sm italic text-slate-500">Set in-game date</span>
          }
        </span>
        <svg
          class="ml-auto size-4 shrink-0 text-slate-500 transition-transform"
          [class.rotate-180]="expanded()"
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
      </summary>

      <div class="flex flex-col gap-2 border-t border-slate-200 p-3">
        <div class="flex flex-wrap gap-2">
          @if (eras().length > 0) {
            <label class="flex min-w-[8rem] flex-1 flex-col gap-1 text-xs text-slate-600">
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
          <label class="flex min-w-[5rem] flex-1 flex-col gap-1 text-xs text-slate-600">
            <span>Year</span>
            <input
              type="number"
              class="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm"
              [value]="value()?.year ?? ''"
              (input)="onField('year', $event)"
            />
          </label>
          <label class="flex min-w-[6rem] flex-1 flex-col gap-1 text-xs text-slate-600">
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
                class="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm"
                [value]="value()?.month ?? ''"
                (input)="onField('month', $event)"
              />
            }
          </label>
          <label class="flex min-w-[5rem] flex-1 flex-col gap-1 text-xs text-slate-600">
            <span>Day</span>
            <input
              type="number"
              min="1"
              [max]="dayMax()"
              class="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm"
              [value]="value()?.day ?? ''"
              (input)="onField('day', $event)"
            />
          </label>
        </div>

        <div class="grid grid-cols-3 gap-2">
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
              class="h-9 rounded-md border bg-white px-2 text-sm"
              [class.border-red-500]="timeErrors().minute"
              [class.border-slate-300]="!timeErrors().minute"
              [attr.aria-invalid]="timeErrors().minute || null"
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
              class="h-9 rounded-md border bg-white px-2 text-sm"
              [class.border-red-500]="timeErrors().second"
              [class.border-slate-300]="!timeErrors().second"
              [attr.aria-invalid]="timeErrors().second || null"
              [value]="value()?.second ?? ''"
              (input)="onField('second', $event)"
            />
          </label>
        </div>
        @if (timeError(); as e) {
          <p class="m-0 text-xs text-red-700" role="alert">{{ e }}</p>
        }

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
      </div>
    </details>
  `,
  styles: [`
    summary::-webkit-details-marker { display: none; }
    summary { list-style: none; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InGameDateInputComponent {
  readonly value = input<InGameDate | null>(null);
  readonly label = input<string | null>(null);
  readonly valueChanged = output<InGameDate>();

  private readonly calendar = inject(CalendarService);
  protected readonly eras = this.calendar.eras;
  protected readonly months = this.calendar.months;

  protected readonly expanded = signal(isInGameDateEmpty(this.value()));

  protected readonly currentEra = computed(() => {
    const v = this.value();
    if (!v?.era) return undefined;
    return this.eras().find((e) => e.id === v.era);
  });

  protected readonly summary = computed(() => {
    const v = this.value();
    if (isInGameDateEmpty(v) || !v) return null;
    if (v.display) return v.display;
    return formatProseDate(
      v,
      v.era ? this.calendar.eraNameLookup(v.era) : undefined,
      v.month ? this.calendar.monthNameLookup(v.month) : undefined,
    );
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

  protected readonly timeErrors = computed(() => {
    const v = this.value();
    return {
      minute: !!v && v.minute !== undefined && v.hour === undefined,
      second: !!v && v.second !== undefined && v.minute === undefined,
    };
  });

  protected readonly timeError = computed(() => {
    const e = this.timeErrors();
    if (e.minute) return 'Minute requires an hour.';
    if (e.second) return 'Second requires a minute.';
    return null;
  });

  protected onToggle(event: Event): void {
    const el = event.target as HTMLDetailsElement;
    if (el.open !== this.expanded()) {
      this.expanded.set(el.open);
    }
  }

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

function formatProseDate(
  d: InGameDate,
  eraName: string | undefined,
  monthName: string | undefined,
): string {
  const datePart = buildProseDatePart(d, monthName);
  const yearPart = d.year !== undefined ? String(d.year) : '';
  const timePart = buildProseTimePart(d);

  let head: string;
  if (datePart && yearPart && eraName) {
    head = `${datePart} of ${yearPart}, ${eraName}`;
  } else if (datePart && yearPart) {
    head = `${datePart} of ${yearPart}`;
  } else if (datePart && eraName) {
    head = `${datePart}, ${eraName}`;
  } else if (datePart) {
    head = datePart;
  } else if (yearPart && eraName) {
    head = `${yearPart} of the ${eraName}`;
  } else if (yearPart) {
    head = `the year ${yearPart}`;
  } else if (eraName) {
    head = eraName;
  } else {
    head = '';
  }

  if (!timePart) return head;
  return head ? `${head} — ${timePart}` : timePart;
}

function buildProseDatePart(d: InGameDate, monthName: string | undefined): string {
  const day = d.day;
  const month = d.month;
  if (day !== undefined && monthName) return `${day} ${monthName}`;
  if (day !== undefined && month !== undefined) return `Day ${day}, month ${pad2(month)}`;
  if (day !== undefined) return `day ${day}`;
  if (monthName) return monthName;
  if (month !== undefined) return `month ${pad2(month)}`;
  return '';
}

function buildProseTimePart(d: InGameDate): string {
  if (d.hour === undefined) return '';
  const parts: string[] = [pad2(d.hour)];
  if (d.minute !== undefined) {
    parts.push(pad2(d.minute));
    if (d.second !== undefined) parts.push(pad2(d.second));
  }
  return parts.join(':');
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}
