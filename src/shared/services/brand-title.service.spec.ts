import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { describe, expect, it } from 'vitest';
import { BrandTitleService } from './brand-title.service';
import { LocaleService, type UiLocale } from './locale.service';

function setup(locale: UiLocale) {
  const active = signal<UiLocale>(locale);
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [{ provide: LocaleService, useValue: { active } }],
  });
  TestBed.inject(BrandTitleService);
  const title = TestBed.inject(Title);
  TestBed.tick();
  return { title, active };
}

describe('BrandTitleService', () => {
  it('sets the English tab title', () => {
    expect(setup('en').title.getTitle()).toBe('Opovid');
  });

  it('sets the Ukrainian tab title', () => {
    expect(setup('uk').title.getTitle()).toBe('Оповідь');
  });

  it('follows a locale change', () => {
    const { title, active } = setup('en');
    active.set('uk');
    TestBed.tick();
    expect(title.getTitle()).toBe('Оповідь');
  });
});
