import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  EntityListPaneComponent,
  ListPaneItem,
} from './entity-list-pane.component';

function setup(inputs?: Partial<{
  items: ListPaneItem[];
  selectedId: string | null;
  hasMore: boolean;
  loadingMore: boolean;
  canCreate: boolean;
  createLabel: string;
  emptyMessage: string;
}>) {
  TestBed.configureTestingModule({ imports: [EntityListPaneComponent] });
  const fixture = TestBed.createComponent(EntityListPaneComponent);
  fixture.componentRef.setInput('items', inputs?.items ?? []);
  if (inputs?.selectedId !== undefined) fixture.componentRef.setInput('selectedId', inputs.selectedId);
  if (inputs?.hasMore !== undefined) fixture.componentRef.setInput('hasMore', inputs.hasMore);
  if (inputs?.loadingMore !== undefined) fixture.componentRef.setInput('loadingMore', inputs.loadingMore);
  if (inputs?.canCreate !== undefined) fixture.componentRef.setInput('canCreate', inputs.canCreate);
  if (inputs?.createLabel !== undefined) fixture.componentRef.setInput('createLabel', inputs.createLabel);
  if (inputs?.emptyMessage !== undefined) fixture.componentRef.setInput('emptyMessage', inputs.emptyMessage);
  fixture.detectChanges();
  return fixture;
}

describe('EntityListPaneComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('shows the empty message when there are no items', () => {
    const fx = setup({ emptyMessage: 'No characters yet.' });
    const text = (fx.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('No characters yet.');
  });

  it('renders one button per item with the label and optional secondary text', () => {
    const fx = setup({
      items: [
        { id: 'a', label: 'Alpha', secondary: 'a-slug' },
        { id: 'b', label: 'Beta' },
      ],
    });
    const buttons = (fx.nativeElement as HTMLElement).querySelectorAll('button[role=option]');
    expect(buttons.length).toBe(2);
    expect(buttons[0].textContent).toContain('Alpha');
    expect(buttons[0].textContent).toContain('a-slug');
    expect(buttons[1].textContent).toContain('Beta');
  });

  it('marks the selected item via aria-selected', () => {
    const fx = setup({
      items: [
        { id: 'a', label: 'Alpha' },
        { id: 'b', label: 'Beta' },
      ],
      selectedId: 'b',
    });
    const buttons = (fx.nativeElement as HTMLElement).querySelectorAll('button[role=option]');
    expect(buttons[0].getAttribute('aria-selected')).toBe('false');
    expect(buttons[1].getAttribute('aria-selected')).toBe('true');
  });

  it('emits select with the item id when clicked', () => {
    const fx = setup({ items: [{ id: 'a', label: 'Alpha' }] });
    const emitted: string[] = [];
    fx.componentInstance.select.subscribe((id) => emitted.push(id));
    const button = (fx.nativeElement as HTMLElement).querySelector(
      'button[role=option]',
    ) as HTMLButtonElement;
    button.click();
    expect(emitted).toEqual(['a']);
  });

  it('hides the create button when canCreate is false', () => {
    const fx = setup({ items: [], canCreate: false });
    expect(fx.nativeElement.textContent).not.toContain('+ New');
  });

  it('renders the create button label when canCreate is true', () => {
    const fx = setup({ items: [], canCreate: true, createLabel: 'New character' });
    expect(fx.nativeElement.textContent).toContain('New character');
  });

  it('emits create when the create button is clicked', () => {
    const fx = setup({ items: [], canCreate: true, createLabel: 'New' });
    let createCount = 0;
    fx.componentInstance.create.subscribe(() => createCount++);
    const button = Array.from(
      (fx.nativeElement as HTMLElement).querySelectorAll('button'),
    ).find((b) => b.textContent?.includes('New')) as HTMLButtonElement;
    button.click();
    expect(createCount).toBe(1);
  });

  it('renders the View more button only when hasMore is true and emits loadMore on click', () => {
    const fx = setup({ items: [{ id: 'a', label: 'Alpha' }], hasMore: true });
    let loadMoreCount = 0;
    fx.componentInstance.loadMore.subscribe(() => loadMoreCount++);
    const text = fx.nativeElement.textContent ?? '';
    expect(text).toContain('View more');
    const button = Array.from(
      (fx.nativeElement as HTMLElement).querySelectorAll('button'),
    ).find((b) => b.textContent?.trim() === 'View more') as HTMLButtonElement;
    button.click();
    expect(loadMoreCount).toBe(1);
  });

  it('disables the View more button while loadingMore is true', () => {
    const fx = setup({
      items: [{ id: 'a', label: 'Alpha' }],
      hasMore: true,
      loadingMore: true,
    });
    const button = Array.from(
      (fx.nativeElement as HTMLElement).querySelectorAll('button'),
    ).find((b) => b.textContent?.trim().startsWith('Loading')) as HTMLButtonElement;
    expect(button).toBeTruthy();
    expect(button.disabled).toBe(true);
  });
});
