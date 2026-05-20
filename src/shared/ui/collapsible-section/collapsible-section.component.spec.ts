import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { CollapsibleSectionComponent } from './collapsible-section.component';

@Component({
  imports: [CollapsibleSectionComponent],
  template: `
    <app-collapsible-section [title]="title" [defaultOpen]="defaultOpen">
      <p class="projected">Body content</p>
    </app-collapsible-section>
  `,
})
class HostComponent {
  title = 'Staging';
  defaultOpen = false;
}

function render(setup: Partial<HostComponent> = {}) {
  TestBed.configureTestingModule({ imports: [HostComponent] });
  const fixture = TestBed.createComponent(HostComponent);
  Object.assign(fixture.componentInstance, setup);
  fixture.detectChanges();
  return fixture;
}

describe('CollapsibleSectionComponent', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  it('renders the title in the summary', () => {
    const fx = render({ title: 'Staging' });
    expect(fx.nativeElement.querySelector('summary')?.textContent).toContain('Staging');
  });

  it('projects content into the body', () => {
    const fx = render();
    expect(fx.nativeElement.querySelector('.projected')?.textContent).toBe('Body content');
  });

  it('starts collapsed by default', () => {
    const fx = render({ defaultOpen: false });
    const details = fx.nativeElement.querySelector('details') as HTMLDetailsElement;
    expect(details.open).toBe(false);
  });

  it('starts open when defaultOpen is true', () => {
    const fx = render({ defaultOpen: true });
    const details = fx.nativeElement.querySelector('details') as HTMLDetailsElement;
    expect(details.open).toBe(true);
  });

  it('rotates the chevron once the details element is opened', () => {
    const fx = render({ defaultOpen: false });
    const details = fx.nativeElement.querySelector('details') as HTMLDetailsElement;
    expect(fx.nativeElement.querySelector('svg')?.classList.contains('rotate-90')).toBe(false);

    details.open = true;
    details.dispatchEvent(new Event('toggle'));
    fx.detectChanges();

    expect(fx.nativeElement.querySelector('svg')?.classList.contains('rotate-90')).toBe(true);
  });
});
