export class CapExceededError extends Error {
  constructor(public readonly cap: number) {
    super(`Universe authorship cap exceeded (${cap})`);
    this.name = 'CapExceededError';
  }
}
