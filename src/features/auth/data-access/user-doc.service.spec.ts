import { initializeApp } from 'firebase/app';
import { doc, getFirestore } from 'firebase/firestore/lite';
import { beforeEach, describe, expect, it } from 'vitest';
import { bootstrapUserDocTxBody } from './user-doc.service';

const firestore = getFirestore(initializeApp({ projectId: 'unit-test' }, 'user-doc-spec'));

let database: Map<string, Record<string, unknown>>;

const fakeTx = {
  get: async (ref: { path: string }) => {
    const payload = database.get(ref.path);
    return {
      exists: () => payload !== undefined,
      data: () => payload,
    };
  },
  set: (ref: { path: string }, data: Record<string, unknown>) => {
    database.set(ref.path, data);
  },
};

beforeEach(() => {
  database = new Map();
});

describe('bootstrapUserDocTxBody', () => {
  it('writes a new user doc when none exists', async () => {
    const userRef = doc(firestore, 'users', 'uid-1');

    await bootstrapUserDocTxBody(fakeTx as never, userRef, 12345);

    expect(database.get('users/uid-1')).toEqual({
      authoredUniverseCount: 0,
      createdAt: 12345,
    });
  });

  it('does not write when the user doc already exists', async () => {
    database.set('users/uid-1', { authoredUniverseCount: 1, createdAt: 1 });
    const userRef = doc(firestore, 'users', 'uid-1');

    await bootstrapUserDocTxBody(fakeTx as never, userRef, 99999);

    expect(database.get('users/uid-1')).toEqual({
      authoredUniverseCount: 1,
      createdAt: 1,
    });
  });
});
