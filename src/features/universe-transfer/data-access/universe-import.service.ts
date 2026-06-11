import { inject, Injectable, signal } from '@angular/core';
import {
  doc,
  getDoc,
  increment,
  runTransaction,
  setDoc,
} from 'firebase/firestore/lite';
import { AuthStore } from '@features/auth';
import { Calendar, CalendarProjectionContext, CalendarService } from '@features/calendar';
import { Character, buildCharacterDirectoryInputs } from '@features/characters';
import {
  CodexCategoriesConfig,
  CodexCategoriesProjectionContext,
  CodexCategoriesService,
  CodexCategory,
  CodexEntry,
  buildCodexEntryDirectoryInputs,
} from '@features/codex';
import {
  TimelineEvent,
  buildEventDirectoryInputs,
  buildEventTimelineInputs,
} from '@features/events';
import { StoredAsset, uploadCommitTxBody } from '@features/media';
import { Place, buildPlaceDirectoryInputs } from '@features/places';
import { Plotline, buildPlotlineDirectoryInputs } from '@features/plotlines';
import { StoriesService, Story, StoryContent } from '@features/stories';
import { UniverseStore } from '@features/universes';
import {
  DirectoryRowInputs,
  TimelineRowInputs,
  writeEntityWithProjections,
} from '@shared/data-access';
import { EntityKind } from '@shared/models';
import { FirebaseService } from '../../../app/firebase/firebase.service';
import { R2ObjectRef, R2Service } from '../../../app/r2/r2.service';
import { ARCHIVE_ENTITY_KINDS, ArchiveCalendar, UniverseArchive } from './archive-format';
import { readArchive } from './archive-zip';
import { BuiltEntityDoc, buildCanonicalDocs } from './build-canonical-docs';
import {
  AssetSummary,
  ConfigPlan,
  ConflictResolution,
  DryRunReport,
  ImportResult,
  KindSummary,
  RenamedEntity,
  ValidationIssue,
} from './dry-run-report.types';
import { ImportContextService } from './import-context.service';
import { ImportContext, ImportResolution, archiveEntitiesOf, resolveImport } from './mint-ids';
import { countCollisions, validateSemantics } from './validate-semantics';
import { validateStructure } from './validate-structure';

export interface DryRunResult {
  report: DryRunReport;
  archive: UniverseArchive;
  binaries: Map<string, Uint8Array>;
}

export type ImportPhase =
  | 'idle'
  | 'validating'
  | 'config'
  | 'uploading'
  | 'writing'
  | 'done'
  | 'error';

export interface ImportProgress {
  phase: ImportPhase;
  entitiesDone: number;
  entitiesTotal: number;
  assetsDone: number;
  assetsTotal: number;
  error?: string;
}

const IDLE_PROGRESS: ImportProgress = {
  phase: 'idle',
  entitiesDone: 0,
  entitiesTotal: 0,
  assetsDone: 0,
  assetsTotal: 0,
};

const CACHE_CONTROL = 'public, max-age=31536000';

@Injectable({ providedIn: 'root' })
export class UniverseImportService {
  private readonly contextReader = inject(ImportContextService);
  private readonly universes = inject(UniverseStore);
  private readonly auth = inject(AuthStore);
  private readonly firebase = inject(FirebaseService);
  private readonly r2 = inject(R2Service);
  private readonly calendar = inject(CalendarService);
  private readonly categories = inject(CodexCategoriesService);
  private readonly stories = inject(StoriesService);

  private readonly _commitProgress = signal<ImportProgress>(IDLE_PROGRESS);
  readonly commitProgress = this._commitProgress.asReadonly();

  async dryRun(file: File): Promise<DryRunResult> {
    const { json, binaries } = await readArchive(file);
    const structural = validateStructure(json);

    if (structural.some((issue) => issue.severity === 'error')) {
      return { archive: json, binaries, report: buildReport(json, structural, null, binaries) };
    }

    const universeId = this.requireUniverseId();
    const ctx = await this.contextReader.read(universeId);
    const semantic = validateSemantics(json, ctx);

    return {
      archive: json,
      binaries,
      report: buildReport(json, [...structural, ...semantic], ctx, binaries),
    };
  }

  async commit(
    dryRun: DryRunResult,
    conflictPolicy: Record<EntityKind, ConflictResolution>,
  ): Promise<ImportResult> {
    const universeId = this.requireUniverseId();
    const authorUid = this.auth.user()?.uid;
    if (!authorUid) throw new Error('Sign in to import.');

    try {
      this._commitProgress.set({ ...IDLE_PROGRESS, phase: 'validating' });
      const ctx = await this.contextReader.read(universeId);
      if (validateSemantics(dryRun.archive, ctx).some((issue) => issue.severity === 'error')) {
        throw new Error('This universe changed since validation. Validate the file again.');
      }

      const idGen = (): string => crypto.randomUUID();
      const resolution = resolveImport(dryRun.archive, ctx, conflictPolicy, idGen);
      const now = Date.now();

      this._commitProgress.update((progress) => ({ ...progress, phase: 'config' }));
      let calendarApplied = false;
      if (resolution.applyCalendar && dryRun.archive.calendar) {
        await this.calendar.save(buildCalendar(dryRun.archive.calendar, resolution, idGen, now));
        calendarApplied = true;
      }
      const categoriesAdded = await this.applyCategories(
        universeId,
        dryRun.archive,
        ctx,
        idGen,
        now,
      );

      const assetOutcome = await this.uploadAssets(universeId, dryRun, resolution, authorUid, now);

      const { docs, connections } = buildCanonicalDocs(dryRun.archive, {
        resolution,
        authorUid,
        now,
        idGen,
      });
      const calendarContext = this.calendarContext();
      const categoryContext = this.categoryContext();
      const renamed: RenamedEntity[] = [];
      let created = 0;
      let failed = 0;

      this._commitProgress.update((progress) => ({
        ...progress,
        phase: 'writing',
        entitiesTotal: docs.length + connections.length,
      }));

      for (const builtDoc of docs) {
        try {
          await this.writeDoc(universeId, builtDoc, calendarContext, categoryContext);
          if (builtDoc.action === 'rename') {
            renamed.push({ kind: builtDoc.kind, from: builtDoc.archiveSlug, to: builtDoc.slug });
          } else {
            created++;
          }
        } catch (err) {
          console.error('import write failed', builtDoc.kind, builtDoc.slug, err);
          failed++;
        }
        this._commitProgress.update((progress) => ({
          ...progress,
          entitiesDone: progress.entitiesDone + 1,
        }));
      }

      for (const connection of connections) {
        try {
          await setDoc(
            doc(this.firebase.firestore, 'universes', universeId, 'connections', connection.id),
            connection.doc,
          );
        } catch (err) {
          console.error('import connection write failed', connection.id, err);
          failed++;
        }
        this._commitProgress.update((progress) => ({
          ...progress,
          entitiesDone: progress.entitiesDone + 1,
        }));
      }

      this._commitProgress.set({ ...IDLE_PROGRESS, phase: 'done' });
      return {
        total: resolution.entities.length,
        created,
        skipped: resolution.entities.filter((entity) => entity.action === 'skip').length,
        renamed,
        failed,
        assetsUploaded: assetOutcome.uploaded,
        assetsFailed: assetOutcome.failed,
        calendarApplied,
        categoriesAdded,
      };
    } catch (err) {
      this._commitProgress.set({
        ...IDLE_PROGRESS,
        phase: 'error',
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  private async writeDoc(
    universeId: string,
    builtDoc: BuiltEntityDoc,
    calendarContext: CalendarProjectionContext,
    categoryContext: CodexCategoriesProjectionContext,
  ): Promise<void> {
    if (builtDoc.kind === 'story') {
      const story = { id: builtDoc.id, ...builtDoc.doc } as unknown as Story;
      await this.stories.saveStory(
        story,
        builtDoc.content ?? { defaultEntrySceneId: '', scenes: {} },
        0,
      );
      return;
    }
    await writeEntityWithProjections(this.firebase.firestore, {
      universeId,
      kind: builtDoc.kind,
      id: builtDoc.id,
      canonicalCollection: builtDoc.collection,
      patch: builtDoc.doc,
      slug: builtDoc.slug,
      buildInputs: (merged) =>
        buildInputsFor(builtDoc.kind, merged, calendarContext, categoryContext),
    });
  }

  private async applyCategories(
    universeId: string,
    archive: UniverseArchive,
    ctx: ImportContext,
    idGen: () => string,
    now: number,
  ): Promise<number> {
    const incoming = (archive.codexCategories ?? []).filter(
      (category) => !ctx.existingCategoryKeys.has(category.key),
    );
    if (incoming.length === 0) return 0;

    const ref = doc(this.firebase.firestore, 'universes', universeId, '_meta', 'codex_categories');
    const snap = await getDoc(ref);
    const current = snap.exists()
      ? (snap.data() as CodexCategoriesConfig)
      : { categories: [] as CodexCategory[] };
    const additions: CodexCategory[] = incoming.map((category) => ({
      id: idGen(),
      key: category.key,
      label: category.label,
      color: category.color,
      description: category.description,
    }));
    await setDoc(ref, {
      categories: [...current.categories, ...additions],
      version: (current.version ?? 0) + 1,
      updatedAt: now,
    });
    await this.categories.refresh(universeId);
    return additions.length;
  }

  private async uploadAssets(
    universeId: string,
    dryRun: DryRunResult,
    resolution: ImportResolution,
    authorUid: string,
    now: number,
  ): Promise<{ uploaded: number; failed: number }> {
    const pending = (dryRun.archive.assets ?? []).filter(
      (asset) => !!asset.file && dryRun.binaries.has(asset.file),
    );
    if (pending.length === 0) return { uploaded: 0, failed: 0 };

    this._commitProgress.update((progress) => ({
      ...progress,
      phase: 'uploading',
      assetsTotal: pending.length,
    }));

    let uploaded = 0;
    let failed = 0;
    for (const asset of pending) {
      try {
        const assetId = resolution.assetIdBySlug.get(asset.slug);
        const bytes = asset.file ? dryRun.binaries.get(asset.file) : undefined;
        if (!assetId || !bytes) {
          failed++;
        } else {
          const filename = baseName(asset.file as string);
          const ref: R2ObjectRef = { universeId, kind: asset.kind, assetId, filename };
          const fullPut = await this.putBinary(ref, bytes, filename);

          let thumbRef: R2ObjectRef | undefined;
          let thumbPut: { key: string; bytes: number } | undefined;
          let thumbUrl: string | undefined;
          const thumbBytes = asset.thumbFile ? dryRun.binaries.get(asset.thumbFile) : undefined;
          if (asset.thumbFile && thumbBytes) {
            const thumbName = baseName(asset.thumbFile);
            thumbRef = { universeId, kind: asset.kind, assetId, filename: thumbName };
            thumbPut = await this.putBinary(thumbRef, thumbBytes, thumbName);
            thumbUrl = this.r2.publicUrlFor(thumbRef);
          }

          const objects = thumbPut ? [fullPut, thumbPut] : [fullPut];
          const totalBytes = objects.reduce((sum, o) => sum + o.bytes, 0);

          const storedAsset: StoredAsset = {
            kind: asset.kind,
            url: this.r2.publicUrlFor(ref),
            thumbUrl,
            label: asset.label,
            blurDataUrl: asset.blurDataUrl,
            tags: asset.tags,
            authorUid,
            objects,
            totalBytes,
            createdAt: now,
          };
          const assetRef = doc(
            this.firebase.firestore,
            'universes',
            universeId,
            '_assets',
            assetId,
          );
          const universeRef = doc(this.firebase.firestore, 'universes', universeId);
          await runTransaction(this.firebase.firestore, (tx) =>
            uploadCommitTxBody(tx, { assetRef, universeRef }, storedAsset, increment),
          );
          uploaded++;
        }
      } catch (err) {
        console.error('import asset upload failed', asset.slug, err);
        failed++;
      }
      this._commitProgress.update((progress) => ({
        ...progress,
        assetsDone: progress.assetsDone + 1,
      }));
    }
    return { uploaded, failed };
  }

  private async putBinary(
    ref: R2ObjectRef,
    bytes: Uint8Array,
    filename: string,
  ): Promise<{ key: string; bytes: number }> {
    const uploadUrl = await this.r2.signUpload(ref, bytes.byteLength);
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      body: new Blob([new Uint8Array(bytes)]),
      headers: { 'Content-Type': mimeFor(filename), 'Cache-Control': CACHE_CONTROL },
    });
    if (!response.ok) throw new Error(`Asset upload failed (${response.status}).`);
    return {
      key: `universes/${ref.universeId}/${ref.kind}/${ref.assetId}/${ref.filename}`,
      bytes: bytes.byteLength,
    };
  }

  private calendarContext(): CalendarProjectionContext {
    return {
      eraOrdinalLookup: this.calendar.eraOrdinalLookup,
      eraNameLookup: this.calendar.eraNameLookup,
      monthNameLookup: this.calendar.monthNameLookup,
      weekdayLookup: this.calendar.weekdayLookup,
    };
  }

  private categoryContext(): CodexCategoriesProjectionContext {
    const categoryLabelByKey = new Map<string, string>();
    for (const [key, category] of this.categories.categoryByKey()) {
      categoryLabelByKey.set(key, category.label);
    }
    return { categoryLabelByKey };
  }

  private requireUniverseId(): string {
    const id = this.universes.activeUniverseId();
    if (!id) throw new Error('No active universe selected.');
    return id;
  }
}

function buildInputsFor(
  kind: EntityKind,
  merged: Record<string, unknown> & { id: string },
  calendarContext: CalendarProjectionContext,
  categoryContext: CodexCategoriesProjectionContext,
): { directory: DirectoryRowInputs; timeline?: TimelineRowInputs } {
  switch (kind) {
    case 'character':
      return { directory: buildCharacterDirectoryInputs(merged as unknown as Character) };
    case 'place':
      return { directory: buildPlaceDirectoryInputs(merged as unknown as Place) };
    case 'plotline':
      return { directory: buildPlotlineDirectoryInputs(merged as unknown as Plotline) };
    case 'event': {
      const event = merged as unknown as TimelineEvent;
      return {
        directory: buildEventDirectoryInputs(event, calendarContext),
        timeline: buildEventTimelineInputs(event, calendarContext),
      };
    }
    case 'codexEntry':
      return {
        directory: buildCodexEntryDirectoryInputs(merged as unknown as CodexEntry, categoryContext),
      };
    case 'story':
      throw new Error('Stories are written through the story save path.');
  }
}

function buildCalendar(
  archiveCalendar: ArchiveCalendar,
  resolution: ImportResolution,
  idGen: () => string,
  now: number,
): Calendar {
  return {
    eras: archiveCalendar.eras.map((era) => ({
      id: resolution.eraIdBySlug.get(era.slug) ?? idGen(),
      slug: era.slug,
      name: era.name,
      maxYears: era.maxYears,
      hoursPerDay: era.hoursPerDay,
      minutesPerHour: era.minutesPerHour,
      secondsPerMinute: era.secondsPerMinute,
      resetsWeek: era.resetsWeek,
    })),
    months: archiveCalendar.months.map((month) => ({
      id: idGen(),
      name: month.name,
      days: month.days,
    })),
    weekdays: (archiveCalendar.weekdays ?? []).map((weekday) => ({
      id: idGen(),
      name: weekday.name,
      short: weekday.short,
    })),
    updatedAt: now,
  };
}

function buildReport(
  archive: UniverseArchive,
  issues: ValidationIssue[],
  ctx: ImportContext | null,
  binaries: Map<string, Uint8Array>,
): DryRunReport {
  const errors = issues.filter((issue) => issue.severity === 'error');
  const warnings = issues.filter((issue) => issue.severity === 'warning');
  const infos = issues.filter((issue) => issue.severity === 'info');
  const collisions = ctx ? countCollisions(archive, ctx) : null;

  const kinds: KindSummary[] = ARCHIVE_ENTITY_KINDS.map((kind) => {
    const list = archiveEntitiesOf(archive, kind);
    return {
      kind,
      incoming: Array.isArray(list) ? list.length : 0,
      collisions: collisions ? collisions[kind] : 0,
    };
  });

  return {
    ok: errors.length === 0,
    formatVersion: typeof archive.formatVersion === 'number' ? archive.formatVersion : 0,
    generator: archive.generator,
    sourceUniverseName: archive.universe?.name,
    kinds,
    assets: buildAssetSummary(archive, binaries),
    config: buildConfigPlan(archive, ctx),
    errors,
    warnings,
    infos,
  };
}

function buildAssetSummary(
  archive: UniverseArchive,
  binaries: Map<string, Uint8Array>,
): AssetSummary {
  const list = archive.assets ?? [];
  let withBinary = 0;
  let totalBytes = 0;
  for (const asset of list) {
    const bytes = asset.file ? binaries.get(asset.file) : undefined;
    if (bytes) {
      withBinary++;
      totalBytes += bytes.byteLength;
    }
  }
  return { total: list.length, withBinary, missingBinary: list.length - withBinary, totalBytes };
}

function buildConfigPlan(archive: UniverseArchive, ctx: ImportContext | null): ConfigPlan {
  const eras = archive.calendar?.eras ?? [];
  const newCategoryKeys: string[] = [];
  const existingCategoryKeys: string[] = [];
  for (const category of archive.codexCategories ?? []) {
    if (ctx?.existingCategoryKeys.has(category.key)) existingCategoryKeys.push(category.key);
    else newCategoryKeys.push(category.key);
  }
  return {
    applyCalendar: !!ctx && !ctx.targetHasCalendar && eras.length > 0,
    packageCalendarEras: eras.length,
    newCategoryKeys,
    existingCategoryKeys,
  };
}

const MIME_BY_EXTENSION: Record<string, string> = {
  webp: 'image/webp',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  avif: 'image/avif',
  gif: 'image/gif',
  mp3: 'audio/mpeg',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  opus: 'audio/ogg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  webm: 'audio/webm',
  weba: 'audio/webm',
};

function mimeFor(filename: string): string {
  const dot = filename.lastIndexOf('.');
  const extension = dot >= 0 ? filename.slice(dot + 1).toLowerCase() : '';
  return MIME_BY_EXTENSION[extension] ?? 'application/octet-stream';
}

function baseName(path: string): string {
  return path.split('/').pop() || path;
}
