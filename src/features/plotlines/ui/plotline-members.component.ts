import {
  CdkDrag,
  CdkDragDrop,
  CdkDragHandle,
  CdkDropList,
  moveItemInArray,
} from '@angular/cdk/drag-drop';
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { provideTranslocoScope, TranslocoDirective } from '@jsverse/transloco';
import { UniverseStore } from '@features/universes';
import { EntityDirectoryService } from '@shared/data-access';
import { EntityRef } from '@shared/models';
import { EntityPickerComponent, GhostButtonComponent, TagComponent } from '@shared/ui';
import { PlotlinesService } from '../data-access/plotlines.service';
import { PlotlineMember, memberKeyOf } from '../data-access/plotline.types';
import plotlineEn from '../i18n/en.json';
import plotlineUk from '../i18n/uk.json';

interface MemberEntry {
  key: string;
  ref: PlotlineMember;
  label: string;
  missing: boolean;
}

@Component({
  selector: 'app-plotline-members',
  host: { class: 'block' },
  imports: [
    CdkDropList,
    CdkDrag,
    CdkDragHandle,
    EntityPickerComponent,
    GhostButtonComponent,
    TagComponent,
    TranslocoDirective,
  ],
  providers: [
    provideTranslocoScope({
      scope: 'plotline',
      loader: {
        en: () => Promise.resolve(plotlineEn),
        uk: () => Promise.resolve(plotlineUk),
      },
    }),
  ],
  template: `
    <ng-container *transloco="let t; prefix: 'plotline'">
      <div class="flex flex-col gap-2">
        <span class="text-sm font-medium text-foreground-subtle">{{ t('field.members') }}</span>

        @if (entries().length) {
          <ul
            cdkDropList
            class="m-0 flex list-none flex-col gap-1 p-0"
            [cdkDropListDisabled]="!canEdit()"
            (cdkDropListDropped)="onDrop($event)"
          >
            @for (e of entries(); track e.key) {
              <li
                cdkDrag
                class="flex items-center gap-2 rounded-md border border-border bg-surface px-2 py-1.5"
              >
                @if (canEdit()) {
                  <button
                    cdkDragHandle
                    type="button"
                    class="cursor-grab text-foreground-faint"
                    [attr.aria-label]="t('action.reorderMember')"
                  >⠿</button>
                }
                <span
                  class="flex-1 truncate text-sm"
                  [class.text-foreground-faint]="e.missing"
                >{{ e.label }}</span>
                @if (e.missing) {
                  <app-tag tone="amber">{{ t('badge.unavailable') }}</app-tag>
                }
                @if (canEdit()) {
                  <button
                    uiGhost
                    type="button"
                    [attr.aria-label]="t('action.removeMember')"
                    (click)="remove(e.ref)"
                  >✕</button>
                }
              </li>
            }
          </ul>
        } @else {
          <span class="text-xs text-foreground-faint">{{ t('empty.noMembers') }}</span>
        }

        @if (canEdit()) {
          <app-entity-picker
            [value]="empty"
            [kinds]="memberKinds"
            [multiple]="false"
            [placeholder]="t('empty.addMember')"
            (valueChange)="onAdd($event)"
          />
        }
      </div>
    </ng-container>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlotlineMembersComponent {
  readonly plotlineId = input.required<string>();
  readonly canEdit = input<boolean>(false);

  private readonly plotlines = inject(PlotlinesService);
  private readonly directory = inject(EntityDirectoryService);
  private readonly universes = inject(UniverseStore);

  protected readonly memberKinds = ['story', 'event'] as const;
  protected readonly empty: readonly EntityRef[] = [];

  private readonly members = signal<PlotlineMember[]>([]);
  private readonly labelByKey = signal<Record<string, string>>({});

  protected readonly entries = signal<MemberEntry[]>([]);

  constructor() {
    let token = 0;
    effect(() => {
      const id = this.plotlineId();
      const mine = ++token;
      this.members.set([]);
      this.labelByKey.set({});
      this.entries.set([]);
      if (!id) return;
      void this.plotlines.getById(id).then((p) => {
        if (mine !== token) return;
        const members = p?.members ?? [];
        this.members.set(members);
        void this.resolveLabels(members, mine, () => mine === token);
      });
    });
  }

  protected async onAdd(refs: EntityRef[]): Promise<void> {
    const ref = refs.find((r) => r.kind === 'story' || r.kind === 'event') as
      | PlotlineMember
      | undefined;
    if (!ref) return;
    const key = memberKeyOf(ref);
    if (this.members().some((m) => memberKeyOf(m) === key)) return;
    await this.persist([...this.members(), ref]);
  }

  protected async remove(ref: PlotlineMember): Promise<void> {
    const key = memberKeyOf(ref);
    await this.persist(this.members().filter((m) => memberKeyOf(m) !== key));
  }

  protected async onDrop(event: CdkDragDrop<unknown>): Promise<void> {
    const next = [...this.members()];
    moveItemInArray(next, event.previousIndex, event.currentIndex);
    await this.persist(next);
  }

  private async persist(members: PlotlineMember[]): Promise<void> {
    this.members.set(members);
    this.rebuildEntries();
    await this.resolveLabels(members);
    await this.plotlines.setMembers(this.plotlineId(), members);
  }

  private async resolveLabels(
    members: readonly PlotlineMember[],
    _token?: number,
    stillCurrent: () => boolean = () => true,
  ): Promise<void> {
    const universeId = this.universes.activeUniverseId();
    if (!universeId || members.length === 0) {
      this.rebuildEntries();
      return;
    }
    const rows = await this.directory.byIds({ universeId, refs: members, includeDrafts: true });
    if (!stillCurrent()) return;
    const map: Record<string, string> = {};
    for (const row of rows) map[`${row.kind}:${row.id}`] = row.label;
    this.labelByKey.set(map);
    this.rebuildEntries();
  }

  private rebuildEntries(): void {
    const labels = this.labelByKey();
    this.entries.set(
      this.members().map((ref) => {
        const key = memberKeyOf(ref);
        const label = labels[key];
        return { key, ref, label: label ?? ref.id, missing: label === undefined };
      }),
    );
  }
}
