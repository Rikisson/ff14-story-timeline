import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTransloco, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { describe, it, expect, beforeEach } from 'vitest';
import { BundledTranslocoLoader } from '../../../app/transloco-loader';
import { SidePaneSearchComponent } from './side-pane-search.component';

@Component({
  imports: [SidePaneSearchComponent],
  template: `
    <app-side-pane-search
      [searchValue]="searchValue"
      [hasFilters]="hasFilters"
      [filtersActive]="filtersActive"
      (searchChange)="last = $event"
    >
      <div class="panel">FILTERS</div>
    </app-side-pane-search>
  `,
})
class HostComponent {
  searchValue = '';
  hasFilters = false;
  filtersActive = false;
  last = '';
}

async function setup(patch?: Partial<HostComponent>): Promise<ComponentFixture<HostComponent>> {
  TestBed.configureTestingModule({
    imports: [HostComponent],
    providers: [
      provideTransloco({
        config: { availableLangs: ['en', 'uk'], defaultLang: 'en', fallbackLang: 'en' },
        loader: BundledTranslocoLoader,
      }),
    ],
  });
  const transloco = TestBed.inject(TranslocoService);
  await firstValueFrom(transloco.load('en'));
  const fixture = TestBed.createComponent(HostComponent);
  Object.assign(fixture.componentInstance, patch);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture;
}

describe('SidePaneSearchComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('reflects the search value in the input', async () => {
    const fx = await setup({ searchValue: 'abc' });
    const input = fx.nativeElement.querySelector('input[type=search]') as HTMLInputElement;
    expect(input.value).toBe('abc');
  });

  it('emits searchChange on input', async () => {
    const fx = await setup();
    const input = fx.nativeElement.querySelector('input[type=search]') as HTMLInputElement;
    input.value = 'hello';
    input.dispatchEvent(new Event('input'));
    expect(fx.componentInstance.last).toBe('hello');
  });

  it('renders no filter toggle when hasFilters is false', async () => {
    const fx = await setup({ hasFilters: false });
    expect(fx.nativeElement.querySelector('button')).toBeNull();
  });

  it('renders the filter toggle and keeps the panel collapsed until toggled', async () => {
    const fx = await setup({ hasFilters: true });
    const toggle = fx.nativeElement.querySelector('button[aria-label="Filters"]') as HTMLButtonElement;
    expect(toggle).toBeTruthy();
    expect(fx.nativeElement.textContent).not.toContain('FILTERS');

    toggle.click();
    fx.detectChanges();
    expect(fx.nativeElement.textContent).toContain('FILTERS');
  });
});
