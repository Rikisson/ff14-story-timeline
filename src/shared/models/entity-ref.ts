export type EntityKind = 'character' | 'place' | 'event' | 'story';

export interface EntityRef<K extends EntityKind = EntityKind> {
  kind: K;
  id: string;
}
