import { afterEach, describe, expect, it, vi } from 'vitest';

// media-assets.service.ts imports firebase/firestore/lite at module load.
// These tests only exercise pure helpers, so stub the SDK to no-ops.
vi.mock('firebase/firestore/lite', () => ({
  collection: vi.fn(),
  deleteDoc: vi.fn(),
  doc: vi.fn(),
  getDocs: vi.fn(),
  orderBy: vi.fn(),
  query: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  where: vi.fn(),
}));

import { assertMimeAndSize, processSprite, spriteFitsBounds } from './media-assets.service';

function fakeFile(type: string, sizeBytes = 1024, name = 'art'): File {
  return new File([new Uint8Array(sizeBytes)], name, { type });
}

describe('assertMimeAndSize — sprite', () => {
  it('accepts JPEG, PNG, WebP, and AVIF', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp', 'image/avif']) {
      expect(() => assertMimeAndSize('sprite', fakeFile(type))).not.toThrow();
    }
  });

  it('rejects a non-image type', () => {
    expect(() => assertMimeAndSize('sprite', fakeFile('image/gif'))).toThrow(
      /Unsupported image type/,
    );
  });

  it('rejects a sprite over the 5 MB cap', () => {
    expect(() =>
      assertMimeAndSize('sprite', fakeFile('image/png', 6 * 1024 * 1024)),
    ).toThrow(/too large/i);
  });
});

// --- canvas / bitmap stubs for processSprite ---------------------------------
// jsdom implements neither createImageBitmap nor a real 2D canvas, so the
// decode/encode primitives are stubbed. These tests cover routing only; the
// actual pixel work is verified manually in a browser (see the plan).

function stubBitmap(width: number, height: number): { close: ReturnType<typeof vi.fn> } {
  const bitmap = { width, height, close: vi.fn() };
  vi.stubGlobal('createImageBitmap', vi.fn(async () => bitmap));
  return bitmap;
}

function stubCanvas(toBlob: HTMLCanvasElement['toBlob']): { drawImage: ReturnType<typeof vi.fn> } {
  const drawImage = vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    drawImage,
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(toBlob);
  return { drawImage };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('spriteFitsBounds', () => {
  it('accepts an image exactly on the 1440×2560 boundary', () => {
    expect(spriteFitsBounds(1440, 2560)).toBe(true);
  });

  it('rejects an image past the boundary on either axis', () => {
    expect(spriteFitsBounds(1441, 2560)).toBe(false);
    expect(spriteFitsBounds(1440, 2561)).toBe(false);
  });

  it('accepts a comfortably small image', () => {
    expect(spriteFitsBounds(800, 1200)).toBe(true);
  });
});

describe('processSprite', () => {
  it('returns an in-bounds WebP file untouched', async () => {
    const bitmap = stubBitmap(1000, 1500);
    const input = fakeFile('image/webp', 2048, 'hero.webp');
    const out = await processSprite(input);
    expect(out).toBe(input);
    expect(bitmap.close).toHaveBeenCalledOnce();
  });

  it('transcodes a PNG sprite to WebP', async () => {
    const bitmap = stubBitmap(1000, 1500);
    stubCanvas((cb, type) => cb(new Blob(['x'], { type })));
    const out = await processSprite(fakeFile('image/png', 4096, 'hero.png'));
    expect(out.type).toBe('image/webp');
    expect(out.name).toBe('hero.webp');
    expect(bitmap.close).toHaveBeenCalledOnce();
  });

  it('falls back to PNG when the browser cannot encode WebP', async () => {
    const bitmap = stubBitmap(1000, 1500);
    // Safari ignores the WebP request and yields a PNG blob instead.
    stubCanvas((cb) => cb(new Blob(['x'], { type: 'image/png' })));
    const out = await processSprite(fakeFile('image/png', 4096, 'hero.png'));
    expect(out.type).toBe('image/png');
    expect(out.name).toBe('hero.png');
    expect(HTMLCanvasElement.prototype.toBlob).toHaveBeenCalledTimes(2);
    expect(bitmap.close).toHaveBeenCalledOnce();
  });

  it('throws when neither WebP nor PNG encoding produces a blob', async () => {
    stubBitmap(1000, 1500);
    stubCanvas((cb) => cb(null));
    await expect(
      processSprite(fakeFile('image/png', 4096, 'hero.png')),
    ).rejects.toThrow(/Image encoding failed/);
  });

  it('re-encodes an oversize WebP instead of passing it through', async () => {
    const bitmap = stubBitmap(3000, 4000);
    const { drawImage } = stubCanvas((cb, type) => cb(new Blob(['x'], { type })));
    const input = fakeFile('image/webp', 4096, 'big.webp');
    const out = await processSprite(input);
    expect(out).not.toBe(input);
    expect(HTMLCanvasElement.prototype.toBlob).toHaveBeenCalled();
    expect(bitmap.close).toHaveBeenCalledOnce();
    // 3000×4000 scaled by min(1, 1440/3000, 2560/4000) = 0.48 → drawn at 1440×1920.
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 1440, 1920);
  });
});
