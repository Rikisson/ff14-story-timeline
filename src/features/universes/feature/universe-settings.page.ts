import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
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

export type UniverseSettingsSection = 'general' | 'access' | 'calendar' | 'categories';

const DEFAULT_SECTION: UniverseSettingsSection = 'general';

const SECTION_LABEL: Record<UniverseSettingsSection, string> = {
  general: 'General',
  access: 'Access',
  calendar: 'Calendar',
  categories: 'Categories',
};

const SECTION_HINT: Record<UniverseSettingsSection, string> = {
  general: 'Name, slug, description, cover',
  access: 'Owner and contributors',
  calendar: 'Eras and months',
  categories: 'Codex category buckets',
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
  ],
  template: `
    <div class="flex h-full flex-col gap-4">
      <app-page-header
        title="Universe settings"
        [subtitle]="universe()?.name ?? ''"
      />

      <div class="flex min-h-0 flex-1 flex-col gap-4 md:flex-row">
        <app-entity-list-pane
          class="md:w-72 md:shrink-0"
          [items]="listItems()"
          [selectedId]="section()"
          ariaLabel="Universe settings sections"
          emptyMessage="No sections."
          (select)="onSelect($event)"
        />

        <section class="flex min-h-0 flex-1 flex-col" aria-label="Section details">
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
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UniverseSettingsPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly store = inject(UniverseStore);

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
    const sections: UniverseSettingsSection[] = this.isOwner()
      ? ['general', 'access', 'calendar', 'categories']
      : ['general', 'calendar', 'categories'];
    return sections.map((s) => ({
      id: s,
      label: SECTION_LABEL[s],
      secondary: SECTION_HINT[s],
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
