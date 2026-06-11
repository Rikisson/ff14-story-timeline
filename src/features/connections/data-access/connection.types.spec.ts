import { describe, expect, it } from 'vitest';
import {
  Connection,
  connectionIdFor,
  connectionTargetsEntry,
  deriveConnectionKeys,
  entityKeyOf,
  sourceEntityRef,
  targetEntityRef,
} from './connection.types';

const storySource = { kind: 'story', storyId: 's1', sceneId: 'sc9' } as const;
const eventSource = { kind: 'event', eventId: 'e1' } as const;

function connectionWith(to: Connection['to']): Connection {
  return {
    id: 'c1',
    type: 'continues',
    from: eventSource,
    to,
    ...deriveConnectionKeys(eventSource, to),
    visibility: 'reader',
    createdBy: 'u1',
    updatedBy: 'u1',
    updatedAt: 0,
  };
}

describe('connection helpers', () => {
  it('derives deterministic ids per source endpoint', () => {
    expect(connectionIdFor(storySource)).toBe('story_s1_sc9');
    expect(connectionIdFor(eventSource)).toBe('event_e1');
  });

  it('maps endpoints to entity refs and keys', () => {
    expect(sourceEntityRef(storySource)).toEqual({ kind: 'story', id: 's1' });
    expect(targetEntityRef({ kind: 'event', eventId: 'e2' })).toEqual({ kind: 'event', id: 'e2' });
    expect(targetEntityRef(null)).toBeNull();
    expect(entityKeyOf({ kind: 'story', id: 's1' })).toBe('story:s1');
  });

  it('derives flat keys with null target for pending edges', () => {
    expect(deriveConnectionKeys(storySource, null)).toEqual({
      fromEntityKey: 'story:s1',
      toEntityKey: null,
    });
    expect(deriveConnectionKeys(eventSource, { kind: 'story', storyId: 's2' })).toEqual({
      fromEntityKey: 'event:e1',
      toEntityKey: 'story:s2',
    });
  });

  it('matches inbound connections against a story entry scene', () => {
    const explicit = connectionWith({ kind: 'story', storyId: 's2', sceneId: 'entryB' });
    const defaulted = connectionWith({ kind: 'story', storyId: 's2' });
    const pending = connectionWith(null);
    const entryA = { sceneId: 'entryA', defaultEntrySceneId: 'entryA' };
    const entryB = { sceneId: 'entryB', defaultEntrySceneId: 'entryA' };

    expect(connectionTargetsEntry(explicit, entryB)).toBe(true);
    expect(connectionTargetsEntry(explicit, entryA)).toBe(false);
    expect(connectionTargetsEntry(defaulted, entryA)).toBe(true);
    expect(connectionTargetsEntry(defaulted, entryB)).toBe(false);
    expect(connectionTargetsEntry(pending, entryA)).toBe(false);
  });
});
