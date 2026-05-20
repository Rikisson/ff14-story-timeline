import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { SegmentedControlComponent, SegmentOption } from './segmented-control.component';

const OPTIONS: SegmentOption<string>[] = [
  { value: 'dialog', label: 'Dialog' },
  { value: 'showcase', label: 'Showcase' },
];

function mount(value = 'dialog', ariaLabel = 'Layout') {
  TestBed.configureTestingModule({ imports: [SegmentedControlComponent] });
  const fixture = TestBed.createComponent(SegmentedControlComponent);
  fixture.componentRef.setInput('options', OPTIONS);
  fixture.componentRef.setInput('value', value);
  fixture.componentRef.setInput('ariaLabel', ariaLabel);
  fixture.detectChanges();
  return fixture;
}

function buttons(fx: { nativeElement: HTMLElement }): HTMLButtonElement[] {
  return Array.from(fx.nativeElement.querySelectorAll('button'));
}

describe('SegmentedControlComponent', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  it('renders one button per option with its label', () => {
    const fx = mount();
    expect(buttons(fx).map((b) => b.textContent?.trim())).toEqual(['Dialog', 'Showcase']);
  });

  it('marks only the option matching value as checked', () => {
    const fx = mount('showcase');
    expect(buttons(fx).map((b) => b.getAttribute('aria-checked'))).toEqual(['false', 'true']);
  });

  it('exposes a radiogroup carrying the provided aria-label', () => {
    const fx = mount('dialog', 'Scene layout');
    const group = fx.nativeElement.querySelector('[role="radiogroup"]');
    expect(group?.getAttribute('aria-label')).toBe('Scene layout');
  });

  it('emits valueChange with the clicked option value', () => {
    const fx = mount('dialog');
    const emitted: unknown[] = [];
    fx.componentInstance.valueChange.subscribe((v) => emitted.push(v));
    buttons(fx)[1].click();
    expect(emitted).toEqual(['showcase']);
  });

  it('moves the checked state when the value input changes', () => {
    const fx = mount('dialog');
    expect(buttons(fx).map((b) => b.getAttribute('aria-checked'))).toEqual(['true', 'false']);
    fx.componentRef.setInput('value', 'showcase');
    fx.detectChanges();
    expect(buttons(fx).map((b) => b.getAttribute('aria-checked'))).toEqual(['false', 'true']);
  });
});
