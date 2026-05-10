import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { describe, it, expect, beforeEach } from 'vitest';
import { provideTransloco } from '@jsverse/transloco';
import { provideTranslocoMessageformat } from '@jsverse/transloco-messageformat';
import {
  Calendar,
  CalendarService,
  DateValidationError,
} from '@features/calendar';
import { InGameDate } from '@shared/models';
import { BundledTranslocoLoader } from '../../../app/transloco-loader';
import { InGameDateInputComponent } from './in-game-date-input.component';

const calendar: Calendar = {
  eras: [{ id: 'astral', name: 'Astral', maxYears: 1000 }],
  months: [
    { id: 'm1', name: 'Spring', days: 30 },
    { id: 'm2', name: 'Summer', days: 31 },
  ],
};

function makeMockCalendarService() {
  const cal = signal<Calendar>(calendar);
  return {
    calendar: cal.asReadonly(),
    eras: signal(calendar.eras).asReadonly(),
    months: signal(calendar.months).asReadonly(),
    weekdays: signal([]).asReadonly(),
    eraNameLookup: (id: string) => calendar.eras.find((e) => e.id === id)?.name,
    monthNameLookup: (idx: number) => calendar.months[idx - 1]?.name,
    weekdayLookup: () => undefined,
  };
}

async function setup(initialValue: InGameDate | null = null) {
  TestBed.configureTestingModule({
    imports: [InGameDateInputComponent],
    providers: [
      { provide: CalendarService, useValue: makeMockCalendarService() },
      provideTransloco({
        config: { availableLangs: ['en'], defaultLang: 'en', fallbackLang: 'en' },
        loader: BundledTranslocoLoader,
      }),
      provideTranslocoMessageformat(),
    ],
  });
  const fixture = TestBed.createComponent(InGameDateInputComponent);
  fixture.componentRef.setInput('value', initialValue);
  fixture.detectChanges();
  // *transloco renders nothing until the active language loads (the bundled
  // loader resolves synchronously, but rendering still waits for a microtask).
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture;
}

function dispatchInput(el: HTMLInputElement | HTMLSelectElement, value: string): void {
  el.value = value;
  el.dispatchEvent(new Event('input'));
  if (el instanceof HTMLSelectElement) {
    el.dispatchEvent(new Event('change'));
  }
}

describe('InGameDateInputComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('creates without errors and renders inputs for the calendar fields', async () => {
    const fx = await setup();
    const root = fx.nativeElement as HTMLElement;
    expect(root.querySelector('select')).toBeTruthy(); // era
    expect(root.querySelectorAll('input[type=number]').length).toBeGreaterThanOrEqual(4); // year + day + hour + minute + second
  });

  it('renders era options from calendar.eras()', async () => {
    const fx = await setup();
    const root = fx.nativeElement as HTMLElement;
    const eraSelect = root.querySelector('select') as HTMLSelectElement;
    const labels = Array.from(eraSelect.options).map((o) => o.textContent?.trim());
    expect(labels).toContain('Astral');
  });

  it('emits valueChanged with the new year when the year input changes', async () => {
    const fx = await setup({});
    const emitted: unknown[] = [];
    fx.componentInstance.valueChanged.subscribe((v) => emitted.push(v));
    const yearInput = (fx.nativeElement as HTMLElement).querySelectorAll(
      'input[type=number]',
    )[0] as HTMLInputElement;
    dispatchInput(yearInput, '1577');
    expect(emitted).toEqual([{ year: 1577 }]);
  });

  it('emits valueChanged with the era id when the era selector changes', async () => {
    const fx = await setup({});
    const emitted: unknown[] = [];
    fx.componentInstance.valueChanged.subscribe((v) => emitted.push(v));
    const eraSelect = (fx.nativeElement as HTMLElement).querySelector('select') as HTMLSelectElement;
    dispatchInput(eraSelect, 'astral');
    expect(emitted).toEqual([{ era: 'astral' }]);
  });

  it('marks the year input invalid when year exceeds the era maxYears', async () => {
    const fx = await setup({ era: 'astral', year: 9999 });
    const yearInput = (fx.nativeElement as HTMLElement).querySelectorAll(
      'input[type=number]',
    )[0] as HTMLInputElement;
    expect(yearInput.getAttribute('aria-invalid')).toBe('true');
  });

  it('emits errorsChanged with the validation errors for the current value', async () => {
    const fx = await setup();
    const seen: DateValidationError[][] = [];
    fx.componentInstance.errorsChanged.subscribe((errs) => seen.push(errs));
    fx.componentRef.setInput('value', { era: 'astral', year: 9999 });
    fx.detectChanges();
    await fx.whenStable();
    const last = seen[seen.length - 1];
    expect(last).toEqual([{ field: 'year', type: 'yearMax', max: 1000 }]);
  });
});
