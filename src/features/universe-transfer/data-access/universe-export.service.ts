import { inject, Injectable, signal } from '@angular/core';
import { EntityKind } from '@shared/models';
import { UniverseStore } from '@features/universes';
import { ArchiveBinary, writeArchive } from './archive-zip';
import { downloadBlob } from './download-blob';
import { ExportReadService, UniverseExportData } from './export-read.service';
import { AssetExportPlan, buildUniverseArchive } from './to-archive';

const GENERATOR = 'ff14-story-timeline';
const DOWNLOAD_CONCURRENCY = 6;

export interface ExportOptions {
  kinds?: readonly EntityKind[];
  includeAssets: boolean;
}

export type ExportPhase = 'idle' | 'reading' | 'downloading' | 'packing' | 'done' | 'error';

export interface ExportProgress {
  phase: ExportPhase;
  assetsDone: number;
  assetsTotal: number;
  assetsFailed: number;
  error?: string;
}

const IDLE: ExportProgress = { phase: 'idle', assetsDone: 0, assetsTotal: 0, assetsFailed: 0 };

@Injectable({ providedIn: 'root' })
export class UniverseExportService {
  private readonly reader = inject(ExportReadService);
  private readonly universes = inject(UniverseStore);

  private readonly _progress = signal<ExportProgress>(IDLE);
  readonly progress = this._progress.asReadonly();

  reset(): void {
    this._progress.set(IDLE);
  }

  async exportUniverse(options: ExportOptions): Promise<void> {
    const universe = this.universes.activeUniverse();
    if (!universe) throw new Error('No active universe selected.');

    try {
      this._progress.set({ ...IDLE, phase: 'reading' });
      const data = filterByKinds(await this.reader.read(universe.id), options.kinds);
      const { archive, assetPlan } = buildUniverseArchive({ ...data, generator: GENERATOR });

      let binaries: ArchiveBinary[] = [];
      let failed = 0;
      if (options.includeAssets && assetPlan.length > 0) {
        const result = await this.downloadBinaries(assetPlan);
        binaries = result.binaries;
        failed = result.failed;
      } else if (!options.includeAssets) {
        archive.assets = undefined;
      }

      const done = assetPlan.length - failed;
      this._progress.set({
        phase: 'packing',
        assetsDone: done,
        assetsTotal: assetPlan.length,
        assetsFailed: failed,
      });
      const blob = await writeArchive(archive, binaries);
      downloadBlob(blob, `${universe.slug}-${dateStamp()}.universe`);
      this._progress.set({
        phase: 'done',
        assetsDone: done,
        assetsTotal: assetPlan.length,
        assetsFailed: failed,
      });
    } catch (err) {
      this._progress.set({
        ...IDLE,
        phase: 'error',
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  private async downloadBinaries(
    plan: readonly AssetExportPlan[],
  ): Promise<{ binaries: ArchiveBinary[]; failed: number }> {
    const queue = [...plan];
    const binaries: ArchiveBinary[] = [];
    let failed = 0;
    let done = 0;

    const worker = async (): Promise<void> => {
      for (;;) {
        const job = queue.shift();
        if (!job) return;
        try {
          binaries.push({ path: job.file, bytes: await fetchBytes(job.url) });
          if (job.thumbUrl && job.thumbFile) {
            binaries.push({ path: job.thumbFile, bytes: await fetchBytes(job.thumbUrl) });
          }
        } catch {
          failed++;
        }
        done++;
        this._progress.set({
          phase: 'downloading',
          assetsDone: done,
          assetsTotal: plan.length,
          assetsFailed: failed,
        });
      }
    };

    const workerCount = Math.min(DOWNLOAD_CONCURRENCY, plan.length);
    await Promise.all(Array.from({ length: workerCount }, () => worker()));
    return { binaries, failed };
  }
}

function filterByKinds(
  data: UniverseExportData,
  kinds?: readonly EntityKind[],
): UniverseExportData {
  if (!kinds) return data;
  const selected = new Set(kinds);
  return {
    ...data,
    characters: selected.has('character') ? data.characters : [],
    places: selected.has('place') ? data.places : [],
    plotlines: selected.has('plotline') ? data.plotlines : [],
    events: selected.has('event') ? data.events : [],
    codexEntries: selected.has('codexEntry') ? data.codexEntries : [],
    stories: selected.has('story') ? data.stories : [],
  };
}

async function fetchBytes(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed (${response.status}).`);
  return new Uint8Array(await response.arrayBuffer());
}

function dateStamp(): string {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return `${now.getFullYear()}${month}${day}`;
}
