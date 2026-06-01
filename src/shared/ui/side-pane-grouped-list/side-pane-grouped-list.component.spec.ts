import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTransloco, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { describe, it, expect, beforeEach } from 'vitest';
import { BundledTranslocoLoader } from '../../../app/transloco-loader';
import { SidePaneGroup, SidePaneGroupedListComponent } from './side-pane-grouped-list.component';

async function setup(inputs?: Partial<{
  groups: SidePaneGroup[];
  selectedId: string | null;
  loading: boolean;
  error: unknown;
  emptyMessage: string;
  ariaLabel: string;
}>): Promise<ComponentFixture<SidePaneGroupedListComponent>> {
  TestBed.configureTestingModule({
    imports: [SidePaneGroupedListComponent],
    providers: [
      provideTransloco({
        config: { availableLangs: ['en', 'uk'], defaultLang: 'en', fallbackLang: 'en' },
        loader: BundledTranslocoLoader,
      }),
    ],
  });
  const transloco = TestBed.inject(TranslocoService);
  await firstValueFrom(transloco.load('en'));
  const fixture = TestBed.createComponent(SidePaneGroupedListComponent);
  fixture.componentRef.setInput('groups', inputs?.groups ?? []);
  if (inputs?.selectedId !== undefined) fixture.componentRef.setInput('selectedId', inputs.selectedId);
  if (inputs?.loading !== undefined) fixture.componentRef.setInput('loading', inputs.loading);
  if (inputs?.error !== undefined) fixture.componentRef.setInput('error', inputs.error);
  if (inputs?.emptyMessage !== undefined) fixture.componentRef.setInput('emptyMessage', inputs.emptyMessage);
  if (inputs?.ariaLabel !== undefined) fixture.componentRef.setInput('ariaLabel', inputs.ariaLabel);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture;
}

describe('SidePaneGroupedListComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('renders group labels and their items', async () => {
    const fx = await setup({
      groups: [
        { key: 'g1', label: 'Era One', items: [{ id: 'a', label: 'Alpha' }] },
        { key: 'g2', label: 'Era Two', items: [{ id: 'b', label: 'Beta' }] },
      ],
    });
    const text = (fx.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Era One');
    expect(text).toContain('Alpha');
    expect(text).toContain('Era Two');
    expect(text).toContain('Beta');
    expect((fx.nativeElement as HTMLElement).querySelectorAll('button[role=option]').length).toBe(2);
  });

  it('shows the empty message when there are no items', async () => {
    const fx = await setup({ groups: [], emptyMessage: 'Nothing here.' });
    expect((fx.nativeElement as HTMLElement).textContent).toContain('Nothing here.');
  });

  it('shows the loading message during the initial fetch', async () => {
    const fx = await setup({ groups: [], loading: true, emptyMessage: 'Nothing here.' });
    const text = (fx.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Loading');
    expect(text).not.toContain('Nothing here.');
  });

  it('emits select with the item id when an item is clicked', async () => {
    const fx = await setup({
      groups: [{ key: 'g1', label: 'Era One', items: [{ id: 'a', label: 'Alpha' }] }],
    });
    const emitted: string[] = [];
    fx.componentInstance.select.subscribe((id) => emitted.push(id));
    (fx.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('button[role=option]')!
      .click();
    expect(emitted).toEqual(['a']);
  });
});
