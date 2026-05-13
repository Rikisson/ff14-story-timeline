import { FirebaseError } from 'firebase/app';

const MAX_ATTEMPTS = 5;
const BASE_DELAY_MS = 3000;

function isTransient(err: unknown): boolean {
  if (!(err instanceof FirebaseError)) return false;
  return (
    err.code === 'firestore/unavailable' ||
    err.code === 'firestore/deadline-exceeded' ||
    (err.code === 'firestore/failed-precondition' && err.message.toLowerCase().includes('index'))
  );
}

export async function retryOnTransient<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (!isTransient(err) || attempt === MAX_ATTEMPTS) throw err;
      await new Promise<void>((r) => setTimeout(r, BASE_DELAY_MS * attempt));
    }
  }
  throw new Error('unreachable');
}
