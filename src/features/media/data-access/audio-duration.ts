export const MAX_AUDIO_SECONDS = {
  ambient: 600,
  sfx: 60,
} as const;

export type AudioKind = keyof typeof MAX_AUDIO_SECONDS;

export function readAudioDurationSeconds(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    audio.preload = 'metadata';
    const cleanup = (): void => {
      audio.removeEventListener('loadedmetadata', onLoaded);
      audio.removeEventListener('error', onError);
      URL.revokeObjectURL(url);
    };
    const onLoaded = (): void => {
      const duration = audio.duration;
      cleanup();
      if (!Number.isFinite(duration) || duration <= 0) {
        reject(new Error('Could not read audio duration.'));
        return;
      }
      resolve(duration);
    };
    const onError = (): void => {
      cleanup();
      reject(new Error('Could not read audio duration.'));
    };
    audio.addEventListener('loadedmetadata', onLoaded);
    audio.addEventListener('error', onError);
    audio.src = url;
  });
}

export function assertAudioDuration(kind: AudioKind, seconds: number): void {
  const max = MAX_AUDIO_SECONDS[kind];
  if (seconds > max) {
    throw new Error(
      `Audio file is too long (${seconds.toFixed(1)}s). Maximum for ${kind} is ${max}s.`,
    );
  }
}
