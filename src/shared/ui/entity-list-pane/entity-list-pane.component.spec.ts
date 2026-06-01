import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTransloco, TranslocoService } from '@jsverse/transloco';
import { EntityKind } from '@shared/models';
import { firstValueFrom } from 'rxjs';
import { describe, it, expect, beforeEach } from 'vitest';
import { BundledTranslocoLoader } from '../../../app/transloco-loader';
import {
  EntityListPaneComponent,
  ListPaneItem,
} from './entity-list-pane.component';

async function setup(inputs?: Partial<{
  items: ListPaneItem[];
  kind: EntityKind;
  selectedId: string | null;
  hasMore: boolean;
  loadingMore: boolean;
  loading: boolean;
  error: unknown;
  canCreate: boolean;
  createLabel: string;
  emptyMessage: string;
  ariaLabel: string;
}>): Promise<ComponentFixture<EntityListPaneComponent>> {
  TestBed.configureTestingModule({
    imports: [EntityListPaneComponent],
    providers: [
      provideTransloco({
        config: { availableLangs: ['en', 'uk'], defaultLang: 'en', fallbackLang: 'en' },
        loader: BundledTranslocoLoader,
      }),
    ],
  });
  // *transloco renders its body only once the language file resolves.
  // The bundled loader is async, so block on the load before any
  // detectChanges so test assertions can read final markup.
  const transloco = TestBed.inject(TranslocoService);
  await firstValueFrom(transloco.load('en'));
  const fixture = TestBed.createComponent(EntityListPaneComponent);
  fixture.componentRef.setInput('items', inputs?.items ?? []);
  if (inputs?.kind !== undefined) fixture.componentRef.setInput('kind', inputs.kind);
  if (inputs?.selectedId !== undefined) fixture.componentRef.setInput('selectedId', inputs.selectedId);
  if (inputs?.hasMore !== undefined) fixture.componentRef.setInput('hasMore', inputs.hasMore);
  if (inputs?.loadingMore !== undefined) fixture.componentRef.setInput('loadingMore', inputs.loadingMore);
  if (inputs?.loading !== undefined) fixture.componentRef.setInput('loading', inputs.loading);
  if (inputs?.error !== undefined) fixture.componentRef.setInput('error', inputs.error);
  if (inputs?.canCreate !== undefined) fixture.componentRef.setInput('canCreate', inputs.canCreate);
  if (inputs?.createLabel !== undefined) fixture.componentRef.setInput('createLabel', inputs.createLabel);
  if (inputs?.emptyMessage !== undefined) fixture.componentRef.setInput('emptyMessage', inputs.emptyMessage);
  if (inputs?.ariaLabel !== undefined) fixture.componentRef.setInput('ariaLabel', inputs.ariaLabel);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture;
}

describe('EntityListPaneComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('shows the empty message when there are no items, no loading, no error', async () => {
    const fx = await setup({ emptyMessage: 'No characters yet.' });
    const text = (fx.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('No characters yet.');
  });

  it('shows the loading message during the initial fetch instead of the empty message', async () => {
    const fx = await setup({ loading: true, emptyMessage: 'No characters yet.' });
    const text = (fx.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Loading');
    expect(text).not.toContain('No characters yet.');
  });

  it('shows the error message (with stringified error) when error is set', async () => {
    const fx = await setup({
      error: new Error('Boom'),
      ariaLabel: 'Characters',
      emptyMessage: 'No characters yet.',
    });
    const text = (fx.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Characters');
    expect(text).toContain('Boom');
    expect(text).not.toContain('No characters yet.');
  });

  it('keeps the list visible while refreshing (items present + loading=true)', async () => {
    const fx = await setup({
      items: [{ id: 'a', label: 'Alpha' }],
      loading: true,
    });
    const buttons = (fx.nativeElement as HTMLElement).querySelectorAll('button[role=option]');
    expect(buttons.length).toBe(1);
    expect(buttons[0].textContent).toContain('Alpha');
  });

  it('renders one button per item with the label and optional secondary text', async () => {
    const fx = await setup({
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

  it('renders a kind-icon placeholder for cover-less items when kind is set', async () => {
    const fx = await setup({ items: [{ id: 'a', label: 'Alpha' }], kind: 'character' });
    const icon = (fx.nativeElement as HTMLElement).querySelector('app-entity-kind-icon');
    expect(icon).toBeTruthy();
  });

  it('renders no thumbnail slot for cover-less items when kind is unset', async () => {
    const fx = await setup({ items: [{ id: 'a', label: 'Alpha' }] });
    const icon = (fx.nativeElement as HTMLElement).querySelector('app-entity-kind-icon');
    expect(icon).toBeNull();
  });

  it('marks the selected item via aria-selected', async () => {
    const fx = await setup({
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

  it('emits select with the item id when clicked', async () => {
    const fx = await setup({ items: [{ id: 'a', label: 'Alpha' }] });
    const emitted: string[] = [];
    fx.componentInstance.select.subscribe((id) => emitted.push(id));
    const button = (fx.nativeElement as HTMLElement).querySelector(
      'button[role=option]',
    ) as HTMLButtonElement;
    button.click();
    expect(emitted).toEqual(['a']);
  });

  it('hides the create button when canCreate is false', async () => {
    const fx = await setup({ items: [], canCreate: false, createLabel: 'New character' });
    const button = (fx.nativeElement as HTMLElement).querySelector(
      'button[aria-label="New character"]',
    );
    expect(button).toBeNull();
  });

  it('exposes the create label as the icon button accessible name when canCreate is true', async () => {
    const fx = await setup({ items: [], canCreate: true, createLabel: 'New character' });
    const button = (fx.nativeElement as HTMLElement).querySelector(
      'button[aria-label="New character"]',
    );
    expect(button).toBeTruthy();
  });

  it('emits create when the create button is clicked', async () => {
    const fx = await setup({ items: [], canCreate: true, createLabel: 'New' });
    let createCount = 0;
    fx.componentInstance.create.subscribe(() => createCount++);
    const button = (fx.nativeElement as HTMLElement).querySelector(
      'button[aria-label="New"]',
    ) as HTMLButtonElement;
    button.click();
    expect(createCount).toBe(1);
  });

  it('renders the View more button only when hasMore is true and emits loadMore on click', async () => {
    const fx = await setup({ items: [{ id: 'a', label: 'Alpha' }], hasMore: true });
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

  it('disables the View more button while loadingMore is true', async () => {
    const fx = await setup({
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
