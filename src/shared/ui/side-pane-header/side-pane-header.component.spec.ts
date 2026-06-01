import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { SidePaneHeaderComponent } from './side-pane-header.component';

@Component({
  imports: [SidePaneHeaderComponent],
  template: `
    <app-side-pane-header
      [title]="title"
      [canCreate]="canCreate"
      [createLabel]="createLabel"
      (create)="created = created + 1"
    >
      <span class="rich">{{ rich }}</span>
    </app-side-pane-header>
  `,
})
class HostComponent {
  title = '';
  canCreate = false;
  createLabel = '';
  rich = '';
  created = 0;
}

function setup(patch?: Partial<HostComponent>): ComponentFixture<HostComponent> {
  TestBed.configureTestingModule({ imports: [HostComponent] });
  const fixture = TestBed.createComponent(HostComponent);
  Object.assign(fixture.componentInstance, patch);
  fixture.detectChanges();
  return fixture;
}

describe('SidePaneHeaderComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('renders the text title in the heading', () => {
    const fx = setup({ title: 'Universes' });
    expect(fx.nativeElement.querySelector('h1')!.textContent).toContain('Universes');
  });

  it('projects a rich title when no text title is given', () => {
    const fx = setup({ title: '', rich: 'Characters' });
    expect(fx.nativeElement.querySelector('h1')!.textContent).toContain('Characters');
  });

  it('hides the create button when canCreate is false', () => {
    const fx = setup({ canCreate: false, createLabel: 'New character' });
    expect(fx.nativeElement.querySelector('button[aria-label="New character"]')).toBeNull();
  });

  it('exposes the create label as the icon button accessible name when canCreate is true', () => {
    const fx = setup({ canCreate: true, createLabel: 'New character' });
    expect(fx.nativeElement.querySelector('button[aria-label="New character"]')).toBeTruthy();
  });

  it('emits create when the create button is clicked', () => {
    const fx = setup({ canCreate: true, createLabel: 'New' });
    (fx.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('button[aria-label="New"]')!
      .click();
    expect(fx.componentInstance.created).toBe(1);
  });
});
