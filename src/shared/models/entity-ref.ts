export type EntityKind =
  | 'character'
  | 'place'
  | 'event'
  | 'story'
  | 'plotline'
  | 'item'
  | 'faction'
  | 'codexEntry';

export interface EntityRef<K extends EntityKind = EntityKind> {
  kind: K;
  id: string;
}
