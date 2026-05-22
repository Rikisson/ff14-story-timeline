import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { LocaleService, type UiLocale } from '@shared/services';
import { BrandComponent } from './brand.component';

function setup(locale: UiLocale) {
  const active = signal<UiLocale>(locale);
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [BrandComponent],
    providers: [{ provide: LocaleService, useValue: { active } }],
  });
  const fixture = TestBed.createComponent(BrandComponent);
  fixture.detectChanges();
  return { fixture, active };
}

describe('BrandComponent', () => {
  it('renders the Ukrainian wordmark with a rubricated initial', () => {
    const el = setup('uk').fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.brand-initial')?.textContent).toBe('О');
    expect(el.querySelector('.brand-word')?.textContent?.trim()).toBe('Оповідь');
  });

  it('renders the English wordmark with a rubricated initial', () => {
    const el = setup('en').fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.brand-initial')?.textContent).toBe('O');
    expect(el.querySelector('.brand-word')?.textContent?.trim()).toBe('Opovid');
  });

  it('follows a locale change', () => {
    const { fixture, active } = setup('en');
    active.set('uk');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.brand-word')?.textContent?.trim()).toBe('Оповідь');
  });
});
