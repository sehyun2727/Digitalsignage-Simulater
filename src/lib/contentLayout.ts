import {
  MAX_CONTENT_OFFSET,
  MAX_CONTENT_SCALE,
  MAX_MATERIAL_SETTING,
  MIN_CONTENT_SCALE,
  MIN_MATERIAL_SETTING,
} from '../types/editor';
import type { ScreenRegion, SignageContent } from '../types/editor';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Resolves a fraction-based ScreenRegion into pixel coordinates local to its object. */
export function resolveScreenRegionRect(
  objectSize: { width: number; height: number },
  region: ScreenRegion,
): Rect {
  if (region.shape !== 'rect') {
    // Sprint 2 only ships rect screens; polygon screens fall back to the full bounding box
    // rather than throwing, so a future template without a rect region degrades safely.
    return { x: 0, y: 0, width: objectSize.width, height: objectSize.height };
  }
  return {
    x: region.x * objectSize.width,
    y: region.y * objectSize.height,
    width: region.width * objectSize.width,
    height: region.height * objectSize.height,
  };
}

export function clampContentScale(scale: number): number {
  return Math.min(MAX_CONTENT_SCALE, Math.max(MIN_CONTENT_SCALE, scale));
}

export function clampContentOffset(offset: number): number {
  return Math.min(MAX_CONTENT_OFFSET, Math.max(-MAX_CONTENT_OFFSET, offset));
}

export function clampMaterialSetting(value: number): number {
  return Math.min(MAX_MATERIAL_SETTING, Math.max(MIN_MATERIAL_SETTING, value));
}

/**
 * Computes where a natural-size content image should be drawn within a screen rect for the
 * given fit mode, offset, and scale. The result may extend beyond `screen` (by design for
 * 'cover', and whenever scale/offset push it there for 'contain') — callers are expected to
 * clip to `screen` when rendering, they should not shrink the returned rect to fit.
 */
export function computeContentLayout(
  screen: Rect,
  naturalWidth: number,
  naturalHeight: number,
  content: Pick<SignageContent, 'fit' | 'offsetX' | 'offsetY' | 'scale'>,
): Rect {
  const screenRatio = screen.width / screen.height;
  const contentRatio = naturalWidth / naturalHeight;

  let baseWidth: number;
  let baseHeight: number;
  const contentIsWiderThanScreen = contentRatio > screenRatio;
  if (content.fit === 'contain' ? contentIsWiderThanScreen : !contentIsWiderThanScreen) {
    baseWidth = screen.width;
    baseHeight = screen.width / contentRatio;
  } else {
    baseHeight = screen.height;
    baseWidth = screen.height * contentRatio;
  }

  const scale = clampContentScale(content.scale);
  const width = baseWidth * scale;
  const height = baseHeight * scale;

  const offsetX = clampContentOffset(content.offsetX);
  const offsetY = clampContentOffset(content.offsetY);
  const centerX = screen.x + screen.width / 2 + offsetX * screen.width;
  const centerY = screen.y + screen.height / 2 + offsetY * screen.height;

  return { x: centerX - width / 2, y: centerY - height / 2, width, height };
}
