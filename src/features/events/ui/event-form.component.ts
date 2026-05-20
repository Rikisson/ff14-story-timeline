import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { provideTranslocoScope, TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { DateValidationError } from '@features/calendar';
import { AssetPickerComponent, CoverSlotComponent } from '@features/media';
import { ContentLangDirective } from '@features/universes';
import { AssetThumbResolver } from '@shared/data-access';
import { BackgroundEffect, EntityRef, InGameDate, SLUG_MAX_LENGTH, SLUG_PATTERN } from '@shared/models';
import {
  EntityPickerComponent,
  GhostButtonComponent,
  InGameDateInputComponent,
  PrimaryButtonComponent,
  RichTextInputComponent,
  SecondaryButtonComponent,
  SegmentedControlComponent,
  SegmentOption,
} from '@shared/ui';
import { TimelineEventDraft } from '../data-access/event.types';
import eventEn from '../i18n/en.json';
import eventUk from '../i18n/uk.json';

/** Per `docs/backend-rules.md` *Cardinality limits*. */
const RELATED_REFS_MAX = 50;
const PLOTLINE_REFS_MAX = 10;
const NEXT_REFS_MAX = 1;
const LONG_DESCRIPTION_THRESHOLD = 600;
type BackgroundEffectOption = BackgroundEffect | 'none';
const BG_EFFECTS: readonly BackgroundEffectOption[] = [
  'none',
  'darken',
  'desaturate',
  'sepia',
  'cool',
  'warm',
];

@Component({
  selector: 'app-event-form',
  imports: [
    ReactiveFormsModule,
    AssetPickerComponent,
    CoverSlotComponent,
    PrimaryButtonComponent,
    SecondaryButtonComponent,
    GhostButtonComponent,
    EntityPickerComponent,
    InGameDateInputComponent,
    RichTextInputComponent,
    SegmentedControlComponent,
    TranslocoDirective,
    ContentLangDirective,
  ],
  providers: [
    provideTranslocoScope({
      scope: 'event',
      loader: {
        en: () => Promise.resolve(eventEn),
        uk: () => Promise.resolve(eventUk),
      },
    }),
  ],
  template: `
    <ng-container *transloco="let t; prefix: 'event'">
      <ng-container *transloco="let g; prefix: 'general'">
        <form
          [formGroup]="form"
          class="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-sm"
          (ngSubmit)="onSubmit()"
        >
          <h3 class="m-0 text-base font-semibold text-foreground">
            {{ initial() ? t('field.formEdit') : t('field.formAdd') }}
          </h3>

          <div class="grid gap-3 sm:grid-cols-2">
            <label class="flex flex-col gap-1 text-sm">
              <span class="font-medium text-foreground-muted">{{ g('field.name') }}</span>
              <input
                type="text"
                formControlName="name"
                class="h-10 rounded-md border border-border-strong bg-surface text-foreground placeholder:text-foreground-faint px-3 text-sm"
                [placeholder]="t('empty.namePlaceholder')"
              />
            </label>
            <label class="flex flex-col gap-1 text-sm">
              <span class="font-medium text-foreground-muted">{{ g('field.slug') }}</span>
              <input
                type="text"
                formControlName="slug"
                class="h-10 rounded-md border border-border-strong bg-surface text-foreground placeholder:text-foreground-faint px-3 text-sm"
                [placeholder]="t('empty.slugPlaceholder')"
              />
              <span class="text-xs text-foreground-faint">{{ g('message.slugHint') }}</span>
            </label>
          </div>

          <app-in-game-date-input
            [label]="t('field.inGameDate')"
            [value]="inGameDate()"
            (valueChanged)="onDate($event)"
            (errorsChanged)="dateErrors.set($event)"
          />

          <app-cover-slot
            [label]="g('field.coverImage')"
            [assetId]="cover()"
            (picked)="cover.set($event)"
          />

          <div class="flex flex-col gap-1 text-sm">
            <div class="flex items-center justify-between gap-2">
              <span class="font-medium text-foreground-muted">{{ g('field.description') }}</span>
              <span
                class="text-xs tabular-nums"
                [class.text-foreground-faint]="!descriptionOverLong()"
                [class.text-warning-foreground]="descriptionOverLong()"
              >{{ descriptionLength() }} / {{ longDescriptionThreshold }}</span>
            </div>
            <app-rich-text-input
              appContentLang
              [value]="description()"
              [ariaLabel]="g('tooltip.descriptionAria')"
              [placeholder]="t('empty.descriptionPlaceholder')"
              (valueChange)="onDescription($event)"
            />
            @if (descriptionOverLong()) {
              <p class="m-0 text-xs text-warning-foreground" role="status">{{ t('message.descriptionLong') }}</p>
            }
          </div>

          <div class="flex flex-col gap-2 text-sm">
            <span class="font-medium text-foreground-muted">{{ t('field.backgroundEffect') }}</span>
            <app-segmented-control
              [options]="backgroundEffectOptions()"
              [value]="resolvedBackgroundEffect()"
              [ariaLabel]="t('field.backgroundEffect')"
              (valueChange)="onBackgroundEffectChange($event)"
            />
          </div>

          <div class="flex flex-col gap-2 text-sm">
            <span class="font-medium text-foreground-muted">{{ t('field.bgm') }}</span>
            @if (bgmUrl(); as url) {
              <audio class="w-full" controls preload="none" [src]="url"></audio>
              <div class="flex gap-2">
                <button uiSecondary type="button" (click)="bgmPicker.open()">{{ t('empty.replaceBgm') }}</button>
                <button uiGhost type="button" (click)="onBgmPicked([])">{{ t('empty.removeBgm') }}</button>
              </div>
            } @else {
              <button uiSecondary type="button" (click)="bgmPicker.open()">{{ t('empty.pickBgm') }}</button>
            }
            <p class="m-0 text-xs text-foreground-faint">{{ t('empty.bgmHint') }}</p>
            <app-asset-picker
              #bgmPicker
              kind="ambient"
              [title]="t('tooltip.pickBgmTitle')"
              [currentSelection]="bgmSelection()"
              (picked)="onBgmPicked($event)"
            />
          </div>

          <div class="flex flex-col gap-1 text-sm">
            <span class="font-medium text-foreground-muted">{{ t('field.nextRefs') }}</span>
            <app-entity-picker
              [value]="nextRefsValue()"
              [kinds]="nextKinds"
              [maxSelections]="nextRefsMax"
              [includeDrafts]="true"
              [placeholder]="t('empty.searchContinuation')"
              (valueChange)="onNextRefs($event)"
            />
            <span class="text-xs text-foreground-faint">{{ t('empty.nextRefsHint') }}</span>
          </div>

          <div class="flex flex-col gap-1 text-sm">
            <span class="font-medium text-foreground-muted">{{ g('field.relatedEntities') }}</span>
            <app-entity-picker
              [value]="related()"
              [kinds]="relatedKinds"
              [maxSelections]="relatedMax"
              [placeholder]="g('empty.searchRelated')"
              (valueChange)="related.set($event)"
            />
          </div>

          <div class="flex flex-col gap-1 text-sm">
            <span class="font-medium text-foreground-muted">{{ g('field.plotlines') }}</span>
            <app-entity-picker
              [value]="plotlineValue()"
              [kinds]="plotlineKinds"
              [maxSelections]="plotlineMax"
              [placeholder]="g('empty.searchPlotlines')"
              (valueChange)="onPlotlineRefs($event)"
            />
          </div>

          @if (errorMessage(); as e) {
            <p class="m-0 text-sm text-danger-foreground">{{ e }}</p>
          }

          <div class="flex gap-2">
            <button
              uiPrimary
              type="submit"
              [loading]="busy()"
              [disabled]="form.invalid || dateErrors().length > 0 || busy()"
            >
              {{ initial() ? g('action.save') : g('action.add') }}
            </button>
            <button uiGhost type="button" (click)="cancelled.emit()">{{ g('action.cancel') }}</button>
          </div>
        </form>
      </ng-container>
    </ng-container>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EventFormComponent {
  readonly initial = input<TimelineEventDraft | null>(null);
  readonly busy = input<boolean>(false);
  readonly errorMessage = input<string | null>(null);
  readonly submitted = output<TimelineEventDraft>();
  readonly cancelled = output<void>();

  protected readonly relatedKinds = ['character', 'place', 'codexEntry'] as const;
  protected readonly relatedMax = RELATED_REFS_MAX;
  protected readonly plotlineKinds = ['plotline'] as const;
  protected readonly plotlineMax = PLOTLINE_REFS_MAX;
  protected readonly nextKinds = ['story', 'event'] as const;
  protected readonly nextRefsMax = NEXT_REFS_MAX;
  protected readonly longDescriptionThreshold = LONG_DESCRIPTION_THRESHOLD;

  private readonly assets = inject(AssetThumbResolver);
  private readonly transloco = inject(TranslocoService);
  private readonly activeLang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  protected readonly related = signal<EntityRef[]>([]);
  protected readonly plotlineRefs = signal<EntityRef<'plotline'>[]>([]);
  protected readonly nextRefs = signal<EntityRef<'story' | 'event'>[]>([]);
  protected readonly description = signal<string>('');
  protected readonly cover = signal<string | undefined>(undefined);
  protected readonly bgmAssetId = signal<string | undefined>(undefined);
  protected readonly backgroundEffect = signal<BackgroundEffect | undefined>(undefined);

  protected readonly nextRefsValue = computed<EntityRef[]>(() => this.nextRefs().slice());
  protected readonly resolvedBackgroundEffect = computed<BackgroundEffectOption>(
    () => this.backgroundEffect() ?? 'none',
  );
  protected readonly backgroundEffectOptions = computed<SegmentOption<BackgroundEffectOption>[]>(
    () => {
      this.activeLang();
      return BG_EFFECTS.map((eff) => ({
        value: eff,
        label: this.transloco.translate('event.effect.' + eff),
      }));
    },
  );
  protected readonly bgmSelection = computed<string[]>(() => {
    const id = this.bgmAssetId();
    return id ? [id] : [];
  });
  protected readonly bgmUrl = computed(() => this.assets.resolve(this.bgmAssetId())()?.url);

  protected readonly descriptionLength = computed(() => this.description().length);
  protected readonly descriptionOverLong = computed(
    () => this.descriptionLength() > LONG_DESCRIPTION_THRESHOLD,
  );

  protected readonly plotlineValue = computed<EntityRef[]>(() => this.plotlineRefs().slice());

  protected readonly inGameDate = signal<InGameDate>({});
  protected readonly dateErrors = signal<DateValidationError[]>([]);

  protected readonly form = new FormBuilder().nonNullable.group({
    slug: ['', [Validators.required, Validators.pattern(SLUG_PATTERN), Validators.maxLength(SLUG_MAX_LENGTH)]],
    name: ['', [Validators.required, Validators.maxLength(120)]],
  });

  constructor() {
    effect(() => {
      const init = this.initial();
      this.form.reset({
        slug: init?.slug ?? '',
        name: init?.name ?? '',
      });
      this.related.set(init?.relatedRefs ?? []);
      this.plotlineRefs.set(init?.plotlineRefs ?? []);
      this.nextRefs.set(init?.nextRefs ?? []);
      this.description.set(init?.description ?? '');
      this.cover.set(init?.coverAssetId);
      this.bgmAssetId.set(init?.bgmAssetId);
      this.backgroundEffect.set(init?.backgroundEffect);
      this.inGameDate.set(init?.inGameDate ?? {});
    });
  }

  protected onBackgroundEffectChange(eff: BackgroundEffectOption): void {
    this.backgroundEffect.set(eff === 'none' ? undefined : eff);
  }

  protected onBgmPicked(ids: string[]): void {
    this.bgmAssetId.set(ids[0]);
  }

  protected onNextRefs(refs: EntityRef[]): void {
    this.nextRefs.set(
      refs.filter((r) => r.kind === 'story' || r.kind === 'event') as EntityRef<'story' | 'event'>[],
    );
  }

  protected onDate(value: InGameDate): void {
    this.inGameDate.set(value);
  }

  protected onPlotlineRefs(refs: EntityRef[]): void {
    this.plotlineRefs.set(refs.filter((r) => r.kind === 'plotline') as EntityRef<'plotline'>[]);
  }

  protected onDescription(value: string): void {
    this.description.set(value);
  }

  protected onSubmit(): void {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    const related = this.related();
    const plotlineRefs = this.plotlineRefs();
    const nextRefs = this.nextRefs();
    this.submitted.emit({
      slug: v.slug.trim().toLowerCase(),
      name: v.name.trim(),
      inGameDate: this.inGameDate(),
      description: this.description().trim(),
      coverAssetId: this.cover(),
      bgmAssetId: this.bgmAssetId(),
      backgroundEffect: this.backgroundEffect(),
      relatedRefs: related.length > 0 ? related : undefined,
      plotlineRefs: plotlineRefs.length > 0 ? plotlineRefs : undefined,
      nextRefs: nextRefs.length > 0 ? nextRefs : undefined,
    });
  }
}
