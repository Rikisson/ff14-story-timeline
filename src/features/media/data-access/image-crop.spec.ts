import { describe, expect, it } from 'vitest';
import {
  aspectRatioOf,
  clampCropRect,
  initialCropRect,
  mirrorCropRect,
  moveCropRect,
  resizeCropRect,
} from './image-crop';

const BOUNDS = { w: 1920, h: 1080 };

describe('aspectRatioOf', () => {
  it('maps locked ratios to w/h', () => {
    expect(aspectRatioOf('16:9')).toBeCloseTo(16 / 9);
    expect(aspectRatioOf('9:16')).toBeCloseTo(9 / 16);
    expect(aspectRatioOf('1:1')).toBe(1);
  });

  it('returns null for free crops', () => {
    expect(aspectRatioOf('free')).toBeNull();
  });
});

describe('clampCropRect', () => {
  it('keeps a free rect inside the bounds', () => {
    const out = clampCropRect({ x: -50, y: -20, w: 5000, h: 5000 }, BOUNDS, {
      aspect: 'free',
    });
    expect(out).toEqual({ x: 0, y: 0, w: 1920, h: 1080 });
  });

  it('clamps position so the rect never leaves the bounds', () => {
    const out = clampCropRect({ x: 1800, y: 1000, w: 400, h: 300 }, BOUNDS, {
      aspect: 'free',
    });
    expect(out.x + out.w).toBeLessThanOrEqual(BOUNDS.w);
    expect(out.y + out.h).toBeLessThanOrEqual(BOUNDS.h);
  });

  it('snaps a locked 16:9 rect by deriving height from width', () => {
    const out = clampCropRect({ x: 0, y: 0, w: 1600, h: 1600 }, BOUNDS, {
      aspect: '16:9',
    });
    expect(out.w / out.h).toBeCloseTo(16 / 9, 1);
  });

  it('shrinks a locked rect to fit when height would overflow', () => {
    const out = clampCropRect({ x: 0, y: 0, w: 1920, h: 1920 }, BOUNDS, {
      aspect: '9:16',
    });
    expect(out.w).toBeLessThanOrEqual(BOUNDS.w);
    expect(out.h).toBeLessThanOrEqual(BOUNDS.h);
    expect(out.w / out.h).toBeCloseTo(9 / 16, 1);
  });
});

describe('moveCropRect', () => {
  it('translates a rect by the given delta', () => {
    const out = moveCropRect({ x: 100, y: 100, w: 200, h: 200 }, 50, -30, BOUNDS);
    expect(out).toEqual({ x: 150, y: 70, w: 200, h: 200 });
  });

  it('stops the rect at the bounds edge', () => {
    const out = moveCropRect({ x: 100, y: 100, w: 200, h: 200 }, -500, -500, BOUNDS);
    expect(out).toEqual({ x: 0, y: 0, w: 200, h: 200 });
  });
});

describe('resizeCropRect', () => {
  it('keeps the opposite corner anchored when resizing from se', () => {
    const start = { x: 100, y: 100, w: 400, h: 300 };
    const out = resizeCropRect(start, 'se', 100, 60, BOUNDS, { aspect: 'free' });
    expect(out.x).toBe(100);
    expect(out.y).toBe(100);
    expect(out.w).toBe(500);
    expect(out.h).toBe(360);
  });

  it('keeps the se corner anchored when resizing from nw', () => {
    const start = { x: 100, y: 100, w: 400, h: 300 };
    const out = resizeCropRect(start, 'nw', 50, 40, BOUNDS, { aspect: 'free' });
    expect(out.x + out.w).toBe(500);
    expect(out.y + out.h).toBe(400);
  });

  it('preserves the locked ratio while resizing', () => {
    const start = initialCropRect(BOUNDS, { aspect: '16:9' });
    const out = resizeCropRect(start, 'se', -300, 0, BOUNDS, { aspect: '16:9' });
    expect(out.w / out.h).toBeCloseTo(16 / 9, 1);
  });
});

describe('initialCropRect', () => {
  it('returns the full image for a free crop', () => {
    expect(initialCropRect(BOUNDS, { aspect: 'free' })).toEqual({
      x: 0,
      y: 0,
      w: 1920,
      h: 1080,
    });
  });

  it('returns a centered, ratio-correct rect for a locked crop', () => {
    const out = initialCropRect(BOUNDS, { aspect: '9:16' });
    expect(out.w / out.h).toBeCloseTo(9 / 16, 1);
    expect(out.h).toBe(BOUNDS.h);
    expect(out.x).toBe(Math.round((BOUNDS.w - out.w) / 2));
  });
});

describe('mirrorCropRect', () => {
  it('mirrors the rect x across the bounds width', () => {
    const out = mirrorCropRect({ x: 100, y: 50, w: 200, h: 300 }, BOUNDS);
    expect(out).toEqual({ x: 1620, y: 50, w: 200, h: 300 });
  });

  it('is its own inverse', () => {
    const rect = { x: 240, y: 80, w: 360, h: 600 };
    expect(mirrorCropRect(mirrorCropRect(rect, BOUNDS), BOUNDS)).toEqual(rect);
  });

  it('keeps a full-width rect in place', () => {
    const rect = { x: 0, y: 0, w: BOUNDS.w, h: BOUNDS.h };
    expect(mirrorCropRect(rect, BOUNDS)).toEqual(rect);
  });
});
