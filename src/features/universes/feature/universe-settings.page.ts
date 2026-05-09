import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { provideTranslocoScope, TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { CalendarSettingsPanelComponent } from '@features/calendar';
import { CodexCategoriesSettingsPanelComponent } from '@features/codex';
import {
  EntityListPaneComponent,
  ListPaneItem,
  PageHeaderComponent,
} from '@shared/ui';
import { UniverseStore } from '../data-access/universe.store';
import { UniverseGeneralSettingsComponent } from '../ui/universe-general-settings.component';
import { UniverseMembersComponent } from '../ui/universe-members.component';
import universeEn from '../i18n/en.json';
import universeUk from '../i18n/uk.json';

export type UniverseSettingsSection = 'general' | 'access' | 'calendar' | 'categories';

const DEFAULT_SECTION: UniverseSettingsSection = 'general';

const SECTION_LABEL_KEY: Record<UniverseSettingsSection, string> = {
  general: 'universe.field.generalHeader',
  access: 'universe.field.accessHeader',
  calendar: 'universe.field.calendarHeader',
  categories: 'universe.field.categoriesHeader',
};

const SECTION_HINT_KEY: Record<UniverseSettingsSection, string> = {
  general: 'universe.message.sectionHintGeneral',
  access: 'universe.message.sectionHintAccess',
  calendar: 'universe.message.sectionHintCalendar',
  categories: 'universe.message.sectionHintCategories',
};

function isSection(value: string | null): value is UniverseSettingsSection {
  return value === 'general' || value === 'access' || value === 'calendar' || value === 'categories';
}

@Component({
  selector: 'app-universe-settings-page',
  host: { class: 'block h-full' },
  imports: [
    EntityListPaneComponent,
    PageHeaderComponent,
    UniverseGeneralSettingsComponent,
    UniverseMembersComponent,
    CalendarSettingsPanelComponent,
    CodexCategoriesSettingsPanelComponent,
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
      <div class="flex h-full flex-col gap-4">
        <app-page-header
          [title]="t('field.settingsTitle')"
          [subtitle]="universe()?.name ?? ''"
        />

        <div class="flex min-h-0 flex-1 flex-col gap-4 md:flex-row">
          <app-entity-list-pane
            class="md:w-72 md:shrink-0"
            [items]="listItems()"
            [selectedId]="section()"
            [ariaLabel]="t('tooltip.settingsList')"
            [emptyMessage]="t('empty.noSections')"
            (select)="onSelect($event)"
          />

          <section class="flex min-h-0 flex-1 flex-col" [attr.aria-label]="t('tooltip.sectionDetails')">
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
              }
            </div>
          </section>
        </div>
      </div>
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

  protected readonly universe = this.store.activeUniverse;
  private readonly isOwner = this.store.isOwnerOfActive;
  private readonly routeParams = toSignal(this.route.paramMap, { requireSync: true });

  protected readonly section = computed<UniverseSettingsSection>(() => {
    const raw = this.routeParams().get('section');
    if (isSection(raw)) {
      if (raw === 'access' && !this.isOwner()) return DEFAULT_SECTION;
      return raw;
    }
    return DEFAULT_SECTION;
  });

  protected readonly listItems = computed<ListPaneItem[]>(() => {
    this.activeLang();
    const sections: UniverseSettingsSection[] = this.isOwner()
      ? ['general', 'access', 'calendar', 'categories']
      : ['general', 'calendar', 'categories'];
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
