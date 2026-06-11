import { EntityRef } from '@shared/models';

export type ConnectionSource =
  | { kind: 'story'; storyId: string; sceneId: string }
  | { kind: 'event'; eventId: string };

export type ConnectionTarget =
  | { kind: 'story'; storyId: string; sceneId?: string }
  | { kind: 'event'; eventId: string };

export type ConnectionVisibility = 'editor' | 'reader';

export interface Connection {
  id: string;
  type: 'continues';
  from: ConnectionSource;
  to: ConnectionTarget | null;
  fromEntityKey: string;
  toEntityKey: string | null;
  visibility: ConnectionVisibility;
  note?: string;
  snapshotTitle?: string;
  createdBy: string;
  updatedBy: string;
  updatedAt: number;
}

export type StoredConnection = Omit<Connection, 'id'>;

export function endpointEntityId(endpoint: ConnectionSource | ConnectionTarget): string {
  return endpoint.kind === 'story' ? endpoint.storyId : endpoint.eventId;
}

export function entityKeyOf(ref: EntityRef<'story' | 'event'>): string {
  return `${ref.kind}:${ref.id}`;
}

export function sourceEntityRef(from: ConnectionSource): EntityRef<'story' | 'event'> {
  return { kind: from.kind, id: endpointEntityId(from) };
}

export function targetEntityRef(
  to: ConnectionTarget | null,
): EntityRef<'story' | 'event'> | null {
  return to ? { kind: to.kind, id: endpointEntityId(to) } : null;
}

export function connectionIdFor(from: ConnectionSource): string {
  return from.kind === 'story' ? `story_${from.storyId}_${from.sceneId}` : `event_${from.eventId}`;
}

export function deriveConnectionKeys(
  from: ConnectionSource,
  to: ConnectionTarget | null,
): { fromEntityKey: string; toEntityKey: string | null } {
  const target = targetEntityRef(to);
  return {
    fromEntityKey: entityKeyOf(sourceEntityRef(from)),
    toEntityKey: target ? entityKeyOf(target) : null,
  };
}

export function connectionTargetsEntry(
  connection: Connection,
  entry: { sceneId: string; defaultEntrySceneId: string },
): boolean {
  if (!connection.to || connection.to.kind !== 'story') return false;
  const targetScene = connection.to.sceneId ?? entry.defaultEntrySceneId;
  return targetScene === entry.sceneId;
}
