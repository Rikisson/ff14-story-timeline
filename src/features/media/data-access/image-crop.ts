// Standalone image-crop utilities. Self-contained — no Firebase, no asset
// pipeline — so the crop dialog (and any future upload surface) can depend on
// it freely. The pure geometry helpers work entirely in source-image pixels,
// which makes a locked aspect ratio just `w / h`.

export type CropAspect = 'free' | '16:9' | '9:16' | '1:1';
export type CropCorner = 'nw' | 'ne' | 'sw' | 'se';

export interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CropBounds {
  w: number;
  h: number;
}

export interface ClampOptions {
  aspect: CropAspect;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function stripExtension(name: string): string {
  const idx = name.lastIndexOf('.');
  return idx > 0 ? name.slice(0, idx) : name;
}

/** Pixel width / height for a locked ratio; `null` for free-form crops. */
export function aspectRatioOf(aspect: CropAspect): number | null {
  switch (aspect) {
    case '16:9':
      return 16 / 9;
    case '9:16':
      return 9 / 16;
    case '1:1':
      return 1;
    case 'free':
      return null;
  }
}

/**
 * Fit `rect` inside `[0,0,bounds.w,bounds.h]` and — when the aspect is locked —
 * snap the dimensions to that ratio by deriving height from width.
 */
export function clampCropRect(
  rect: CropRect,
  bounds: CropBounds,
  opts: ClampOptions,
): CropRect {
  const ratio = aspectRatioOf(opts.aspect);

  let w = clamp(rect.w, 1, bounds.w);
  let h = clamp(rect.h, 1, bounds.h);

  if (ratio !== null) {
    h = w / ratio;
    if (h > bounds.h) {
      h = bounds.h;
      w = h * ratio;
    }
    if (w > bounds.w) {
      w = bounds.w;
      h = w / ratio;
    }
  }

  w = clamp(Math.round(w), 1, bounds.w);
  h = clamp(Math.round(h), 1, bounds.h);
  const x = clamp(Math.round(rect.x), 0, bounds.w - w);
  const y = clamp(Math.round(rect.y), 0, bounds.h - h);
  return { x, y, w, h };
}

/** Translate a rect, keeping it within bounds. Deltas are source-image pixels. */
export function moveCropRect(
  start: CropRect,
  dx: number,
  dy: number,
  bounds: CropBounds,
): CropRect {
  return {
    x: clamp(Math.round(start.x + dx), 0, bounds.w - start.w),
    y: clamp(Math.round(start.y + dy), 0, bounds.h - start.h),
    w: start.w,
    h: start.h,
  };
}

/**
 * Resize from `corner`, keeping the opposite corner anchored. Deltas are
 * source-image pixels. The result honors bounds, minimum size, and the locked
 * aspect ratio.
 */
export function resizeCropRect(
  start: CropRect,
  corner: CropCorner,
  dx: number,
  dy: number,
  bounds: CropBounds,
  opts: ClampOptions,
): CropRect {
  const right = start.x + start.w;
  const bottom = start.y + start.h;
  const movesX = corner === 'nw' || corner === 'sw';
  const movesY = corner === 'nw' || corner === 'ne';

  const x = movesX ? start.x + dx : start.x;
  const y = movesY ? start.y + dy : start.y;
  const w = Math.max(1, movesX ? right - x : start.w + dx);
  const h = Math.max(1, movesY ? bottom - y : start.h + dy);

  const sized = clampCropRect({ x, y, w, h }, bounds, opts);
  // clampCropRect can change w/h (ratio, minimum, bounds) — re-pin the
  // anchored corner so it stays put, then clamp position back into bounds.
  const fixedX = movesX ? right - sized.w : sized.x;
  const fixedY = movesY ? bottom - sized.h : sized.y;
  return clampCropRect(
    { x: fixedX, y: fixedY, w: sized.w, h: sized.h },
    bounds,
    opts,
  );
}

/** Largest centered rect of the requested aspect. */
export function initialCropRect(bounds: CropBounds, opts: ClampOptions): CropRect {
  const ratio = aspectRatioOf(opts.aspect);
  let w = bounds.w;
  let h = bounds.h;
  if (ratio !== null) {
    h = w / ratio;
    if (h > bounds.h) {
      h = bounds.h;
      w = h * ratio;
    }
  }
  return clampCropRect(
    { x: (bounds.w - w) / 2, y: (bounds.h - h) / 2, w, h },
    bounds,
    opts,
  );
}

export function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number,
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Encode a canvas without quality loss. WebP first — lossless on Chromium,
 * max-quality on Firefox; falls back to lossless PNG where the browser cannot
 * encode WebP (Safari). Both containers preserve the alpha channel.
 */
export async function encodeCanvasLossless(
  canvas: HTMLCanvasElement,
  sourceName: string,
): Promise<File> {
  const stem = stripExtension(sourceName);
  const webp = await canvasToBlob(canvas, 'image/webp', 1);
  if (webp && webp.type === 'image/webp') {
    return new File([webp], `${stem}.webp`, { type: 'image/webp' });
  }
  const png = await canvasToBlob(canvas, 'image/png');
  if (png) {
    return new File([png], `${stem}.png`, { type: 'image/png' });
  }
  throw new Error('Image encoding failed.');
}

/**
 * Crop `file` to `rect` (source-image pixels) and re-encode losslessly. EXIF
 * orientation is baked in, matching how the browser renders the same file in
 * an `<img>`. The canvas is left transparent so sprite alpha survives.
 */
export async function cropFileToFile(file: File, rect: CropRect): Promise<File> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    const w = clamp(Math.round(rect.w), 1, bitmap.width);
    const h = clamp(Math.round(rect.h), 1, bitmap.height);
    const x = clamp(Math.round(rect.x), 0, bitmap.width - w);
    const y = clamp(Math.round(rect.y), 0, bitmap.height - h);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable.');
    ctx.drawImage(bitmap, x, y, w, h, 0, 0, w, h);
    return await encodeCanvasLossless(canvas, file.name);
  } finally {
    bitmap.close();
  }
}
