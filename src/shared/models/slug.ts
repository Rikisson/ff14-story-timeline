import { EntityKind } from './entity-ref';

export const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
export const SLUG_MAX_LENGTH = 60;

export type SlugScope = EntityKind | 'universe';

export class SlugTakenError extends Error {
  constructor(
    public readonly kind: SlugScope,
    public readonly slug: string,
  ) {
    super(
      kind === 'universe'
        ? `Universe slug "${slug}" is already taken.`
        : `A ${kind} with slug "${slug}" already exists in this universe.`,
    );
    this.name = 'SlugTakenError';
  }
}
