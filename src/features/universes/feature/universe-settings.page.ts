import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { provideTranslocoScope, TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { CalendarSettingsPanelComponent } from '@features/calendar';
import { CodexCategoriesSettingsPanelComponent } from '@features/codex';
import { UniverseTransferPage } from '@features/universe-transfer';
import {
  EntityListPaneComponent,
  ListPaneItem,
  PageComponent,
  PageHeaderComponent,
} from '@shared/ui';
import { UniverseStore } from '../data-access/universe.store';
import { UniverseGeneralSettingsComponent } from '../ui/universe-general-settings.component';
import { UniverseMembersComponent } from '../ui/universe-members.component';
import { UniverseDeletionPanelComponent } from './universe-deletion-panel.component';
import universeEn from '../i18n/en.json';
import universeUk from '../i18n/uk.json';

export type UniverseSettingsSection =
  | 'general'
  | 'access'
  | 'calendar'
  | 'categories'
  | 'transfer'
  | 'dangerZone';

const DEFAULT_SECTION: UniverseSettingsSection = 'general';

const SECTION_LABEL_KEY: Record<UniverseSettingsSection, string> = {
  general: 'universe.field.generalHeader',
  access: 'universe.field.accessHeader',
  calendar: 'universe.field.calendarHeader',
  categories: 'universe.field.categoriesHeader',
  transfer: 'universe.field.transferHeader',
  dangerZone: 'universe.field.dangerHeader',
};

const SECTION_HINT_KEY: Record<UniverseSettingsSection, string> = {
  general: 'universe.message.sectionHintGeneral',
  access: 'universe.message.sectionHintAccess',
  calendar: 'universe.message.sectionHintCalendar',
  categories: 'universe.message.sectionHintCategories',
  transfer: 'universe.message.sectionHintTransfer',
  dangerZone: 'universe.message.sectionHintDanger',
};

function isSection(value: string | null): value is UniverseSettingsSection {
  return (
    value === 'general' ||
    value === 'access' ||
    value === 'calendar' ||
    value === 'categories' ||
    value === 'transfer' ||
    value === 'dangerZone'
  );
}

@Component({
  selector: 'app-universe-settings-page',
  host: { class: 'block h-full' },
  imports: [
    EntityListPaneComponent,
    PageComponent,
    PageHeaderComponent,
    UniverseGeneralSettingsComponent,
    UniverseMembersComponent,
    CalendarSettingsPanelComponent,
    CodexCategoriesSettingsPanelComponent,
    UniverseTransferPage,
    UniverseDeletionPanelComponent,
    TranslocoDirective,
  ],
  providers: [
    provideTranslocoScope({
      scope: 'universe',
      loader: {
        en: () => Promise.resolve(universeEn),
        uk: () => Promise.resolve(universeUk),
      },
    }),
  ],
  template: `
    <ng-container *transloco="let t; prefix: 'universe'">
      <app-page class="h-full">
        <app-page-header [title]="t('field.settingsTitle')" />

        <div class="flex min-h-0 flex-1 flex-col gap-4 md:flex-row">
          <app-entity-list-pane
            class="md:w-72 md:shrink-0"
            [items]="listItems()"
            [selectedId]="section()"
            [ariaLabel]="t('tooltip.settingsList')"
            [emptyMessage]="t('empty.noSections')"
            (select)="onSelect($event)"
          />

          <section
            class="flex min-h-0 flex-1 flex-col"
            [attr.aria-label]="t('tooltip.sectionDetails')"
          >
            <div class="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
              @switch (section()) {
                @case ('general') {
                  <app-universe-general-settings />
                }
                @case ('access') {
                  <app-universe-members />
                }
                @case ('calendar') {
                  <app-calendar-settings-panel />
                }
                @case ('categories') {
                  <app-codex-categories-settings-panel />
                }
                @case ('transfer') {
                  <app-universe-transfer-page />
                }
                @case ('dangerZone') {
                  <app-universe-deletion-panel />
                }
              }
            </div>
          </section>
        </div>
      </app-page>
    </ng-container>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UniverseSettingsPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly store = inject(UniverseStore);
  private readonly transloco = inject(TranslocoService);
  private readonly activeLang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  private readonly isOwner = this.store.isOwnerOfActive;
  private readonly routeParams = toSignal(this.route.paramMap, { requireSync: true });

  protected readonly section = computed<UniverseSettingsSection>(() => {
    const raw = this.routeParams().get('section');
    if (isSection(raw)) {
      if (raw === 'access' && !this.isOwner()) return DEFAULT_SECTION;
      if (
        raw === 'dangerZone' &&
        !this.isOwner() &&
        this.store.pendingForAuthor().length === 0
      ) {
        return DEFAULT_SECTION;
      }
      return raw;
    }
    return DEFAULT_SECTION;
  });

  protected readonly listItems = computed<ListPaneItem[]>(() => {
    this.activeLang();
    const hasPending = this.store.pendingForAuthor().length > 0;
    const owner = this.isOwner();
    const sections: UniverseSettingsSection[] = owner
      ? ['general', 'access', 'calendar', 'categories', 'transfer']
      : ['general', 'calendar', 'categories', 'transfer'];
    if (owner || hasPending) sections.push('dangerZone');
    return sections.map((s) => ({
      id: s,
      label: this.transloco.translate(SECTION_LABEL_KEY[s]),
      secondary: this.transloco.translate(SECTION_HINT_KEY[s]),
    }));
  });

  constructor() {
    effect(() => {
      const raw = this.routeParams().get('section');
      const resolved = this.section();
      if (raw !== resolved) {
        void this.router.navigate(['/universe/settings', resolved], { replaceUrl: true });
      }
    });
  }

  protected onSelect(id: string): void {
    if (!isSection(id)) return;
    void this.router.navigate(['/universe/settings', id]);
  }
}
