import { describe, expect, it } from 'vitest';
import { CacheInvalidationBus } from './cache-invalidation.bus';

describe('CacheInvalidationBus', () => {
  it('delivers entity-write events to current subscribers', () => {
    const bus = new CacheInvalidationBus();
    const received: Array<{ universeId: string; kind: string; id: string }> = [];
    const sub = bus.entityWrites$.subscribe((e) => received.push(e));

    bus.publishEntityWrite({ universeId: 'u1', kind: 'character', id: 'c1' });
    bus.publishEntityWrite({ universeId: 'u1', kind: 'place', id: 'p1' });

    expect(received).toHaveLength(2);
    expect(received[0]).toEqual({ universeId: 'u1', kind: 'character', id: 'c1' });
    expect(received[1]).toEqual({ universeId: 'u1', kind: 'place', id: 'p1' });
    sub.unsubscribe();
  });

  it('delivers asset-write events on a separate stream', () => {
    const bus = new CacheInvalidationBus();
    const entityEvents: unknown[] = [];
    const assetEvents: unknown[] = [];
    const s1 = bus.entityWrites$.subscribe((e) => entityEvents.push(e));
    const s2 = bus.assetWrites$.subscribe((e) => assetEvents.push(e));

    bus.publishAssetWrite({ universeId: 'u1', assetId: 'a1' });
    bus.publishEntityWrite({ universeId: 'u1', kind: 'character', id: 'c1' });

    expect(entityEvents).toHaveLength(1);
    expect(assetEvents).toHaveLength(1);
    s1.unsubscribe();
    s2.unsubscribe();
  });

  it('does not replay past events to late subscribers', () => {
    const bus = new CacheInvalidationBus();
    bus.publishEntityWrite({ universeId: 'u1', kind: 'character', id: 'c1' });

    const received: unknown[] = [];
    const sub = bus.entityWrites$.subscribe((e) => received.push(e));
    expect(received).toHaveLength(0);
    sub.unsubscribe();
  });
});
