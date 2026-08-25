import { useEffect, useState } from 'react';
import { Group, Image as KonvaImage } from 'react-konva';
import docodemoUrl from '../../assets/portable/docodemo.webp';
import frontUrl from '../../assets/portable/front.png';
import { getRegisteredAsset } from '../../lib/assetRegistry';
import {
  PORTABLE_PRESET_SCREEN_QUADS,
  type PortableTemplateView,
} from '../../lib/portableTemplate';
import type { NormalizedQuad } from '../../types/editor';

interface PortableTemplateBodyProps {
  view: PortableTemplateView;
  width: number;
  height: number;
  /** Asset sourceId of a user-uploaded product photo. When set, the photo is rendered instead
   *  of the fixed template asset. */
  productPhotoSourceId?: string | null;
}

/**
 * Photo-based body/frame/stand for the fixed portable signage template — the actual
 * reference product photographs (bundled under `src/assets/portable/`) are rendered as-is via
 * Konva `Image`, so the on-canvas silhouette is the real product's silhouette rather than a
 * hand-drawn vector approximation. Only draws the physical device photograph plus a black
 * backdrop over the display area; the screen contents (dark backing + content image + material
 * overlays) come from `ScreenComposition`, rendered *on top of* this body by
 * `PortableProductView`. Every shape is `listening={false}` — the interactive hit area is a
 * separate transparent rect installed by `PortableProductView` around this body.
 *
 * `angled-left` uses the raw docodemo asset (a real product shot, delivered as a WebP with a
 * native alpha channel), while `angled-right` is the same asset mirrored via a `scaleX={-1}`
 * wrapper — two views, one source photograph.
 *
 * `front.png` is still an AI-generated shot on a pure-white background, so it needs the
 * flood-fill background removal in `useAssetImage` to avoid a hard white rectangle around the
 * product over a dark space photo. The docodemo WebP already ships with transparency, so
 * `useAssetImage` skips the flood fill for it and only punches the screen-area hole. The
 * black screen backdrop stays in the parent's un-mirrored coordinate space so
 * `ScreenComposition` (also parent-space) always lines up on top of it — only the photo gets
 * mirrored, not the screen rect.
 */
export function PortableTemplateBody({
  view,
  width,
  height,
  productPhotoSourceId,
}: PortableTemplateBodyProps) {
  const isAngled = view === 'angled-right' || view === 'angled-left';
  const mirrored = view === 'angled-right';
  const templateImage = useAssetImage(isAngled ? docodemoUrl : frontUrl);

  // When a user product photo is supplied, render it instead of the fixed template asset.
  const productPhotoAsset = productPhotoSourceId
    ? getRegisteredAsset(productPhotoSourceId)
    : null;

  if (productPhotoSourceId && productPhotoAsset) {
    return (
      <KonvaImage
        image={productPhotoAsset.image}
        width={width}
        height={height}
        listening={false}
      />
    );
  }

  return (
    <>
      {mirrored ? (
        <Group x={width} scaleX={-1} listening={false}>
          {templateImage && (
            <KonvaImage image={templateImage} width={width} height={height} listening={false} />
          )}
        </Group>
      ) : (
        templateImage && (
          <KonvaImage image={templateImage} width={width} height={height} listening={false} />
        )
      )}
    </>
  );
}

/**
 * Module-level cache of processed image bitmaps keyed by asset URL. Each source PNG is
 * decoded once, its background pixels turned transparent, and the screen area punched out
 * (see `maskWhiteBackground` + `clearScreenArea` below), then reused for every portable
 * that references the same view. The React state hook fires a rerender the first time a
 * bitmap becomes available so Konva can pick it up without a manual redraw.
 */
const imageCache = new Map<string, HTMLCanvasElement>();

/**
 * Returns the NormalizedQuad (in the raw source image's coordinate space) for the screen area
 * that should be made transparent. Both angled views share the same source (`docodemo.webp`),
 * so the angled-left quad is what gets punched out; angled-right renders that same asset with
 * scaleX={-1}, which maps the cleared area to the right-hand screen position automatically.
 */
function getScreenQuadForUrl(url: string): NormalizedQuad {
  return url === docodemoUrl
    ? PORTABLE_PRESET_SCREEN_QUADS['angled-left']
    : PORTABLE_PRESET_SCREEN_QUADS['front'];
}

/** Sources that already carry a real alpha channel (WebP), so `useAssetImage` skips the
 *  flood-fill white-background removal and just punches the screen hole. */
const NATIVELY_TRANSPARENT_SOURCES = new Set<string>([docodemoUrl]);

/**
 * Erases the screen-area polygon from a processed template canvas so that ScreenComposition
 * content rendered below (in z-order) shows through. Uses `destination-out` compositing so
 * only the pixels inside the quad become fully transparent — the rest of the device body
 * (frame, stand, wheels) stays opaque and naturally overlays the screen content.
 */
function clearScreenArea(canvas: HTMLCanvasElement, quad: NormalizedQuad): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.moveTo(quad.topLeft.x * w, quad.topLeft.y * h);
  ctx.lineTo(quad.topRight.x * w, quad.topRight.y * h);
  ctx.lineTo(quad.bottomRight.x * w, quad.bottomRight.y * h);
  ctx.lineTo(quad.bottomLeft.x * w, quad.bottomLeft.y * h);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function useAssetImage(url: string): HTMLCanvasElement | null {
  const [image, setImage] = useState<HTMLCanvasElement | null>(
    () => imageCache.get(url) ?? null,
  );

  useEffect(() => {
    const cached = imageCache.get(url);
    if (cached) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setImage(cached);
      return;
    }
    let cancelled = false;
    const img = new window.Image();
    img.onload = () => {
      if (cancelled) return;
      // WebP sources ship with a real alpha channel already, so skip the flood fill that
      // trims a white PNG background and only punch the screen hole. Running the flood
      // fill anyway would either be a no-op (near-white pixels are already transparent)
      // or accidentally erode subtle bright product highlights.
      const canvas = NATIVELY_TRANSPARENT_SOURCES.has(url)
        ? copyImageToCanvas(img)
        : maskWhiteBackground(img);
      clearScreenArea(canvas, getScreenQuadForUrl(url));
      imageCache.set(url, canvas);
      setImage(canvas);
    };
    img.src = url;
    return () => {
      // Prevent a still-decoding image from writing to state after the component unmounts.
      cancelled = true;
      img.onload = null;
    };
  }, [url]);

  return image;
}

/** Rasterizes `img` (already carrying an alpha channel) into a fresh canvas so the shared
 *  `clearScreenArea` can then use `destination-out` compositing to punch the screen hole. */
function copyImageToCanvas(img: HTMLImageElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.drawImage(img, 0, 0);
  return canvas;
}

/**
 * Copies the source image into an offscreen canvas and turns background pixels transparent
 * via flood-fill from the four image corners. Only background-connected near-white pixels
 * are erased — the product's own white frame stays fully opaque because it's not reachable
 * from the outside without crossing a non-white pixel (the darker frame edge/shading).
 *
 * Runs once per source PNG (results are module-cached), so O(W×H) iteration at app startup
 * is a one-time cost — no per-frame work.
 */
function maskWhiteBackground(img: HTMLImageElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, w, h);
  const pixels = data.data;

  // "Near-white background" means very bright + very desaturated. Any pixel darker than
  // BRIGHTNESS_THRESHOLD or with more than CHROMA_THRESHOLD channel spread is considered
  // product content and blocks the flood fill from crossing.
  const BRIGHTNESS_THRESHOLD = 240;
  const CHROMA_THRESHOLD = 10;
  const isBackground = (idx: number): boolean => {
    const r = pixels[idx];
    const g = pixels[idx + 1];
    const b = pixels[idx + 2];
    if (r === undefined || g === undefined || b === undefined) return false;
    const brightness = (r + g + b) / 3;
    if (brightness < BRIGHTNESS_THRESHOLD) return false;
    const chroma = Math.max(r, g, b) - Math.min(r, g, b);
    return chroma <= CHROMA_THRESHOLD;
  };

  // Iterative BFS from every image corner. Uint8Array-backed visited buffer + a flat
  // number stack for cheap ~2M-pixel processing without stack-overflow risk.
  const visited = new Uint8Array(w * h);
  const stack: number[] = [0, 0, w - 1, 0, 0, h - 1, w - 1, h - 1];
  while (stack.length) {
    const py = stack.pop();
    const px = stack.pop();
    if (px === undefined || py === undefined) break;
    if (px < 0 || px >= w || py < 0 || py >= h) continue;
    const flatIdx = py * w + px;
    if (visited[flatIdx]) continue;
    const pxIdx = flatIdx * 4;
    if (!isBackground(pxIdx)) continue;
    visited[flatIdx] = 1;
    pixels[pxIdx + 3] = 0;
    stack.push(px - 1, py, px + 1, py, px, py - 1, px, py + 1);
  }

  // A second pass softens the 1-pixel jaggy boundary the flood fill leaves at the
  // product's edge: any still-opaque pixel that borders a transparent one and is itself
  // near-white gets a partial alpha, so the silhouette anti-aliases into the space
  // background rather than clipping hard.
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const flat = y * w + x;
      if (visited[flat]) continue;
      const pxIdx = flat * 4;
      const r = pixels[pxIdx];
      const g = pixels[pxIdx + 1];
      const b = pixels[pxIdx + 2];
      if (r === undefined || g === undefined || b === undefined) continue;
      const brightness = (r + g + b) / 3;
      if (brightness < 220) continue;
      const chroma = Math.max(r, g, b) - Math.min(r, g, b);
      if (chroma > 15) continue;
      const hasTransparentNeighbor =
        (x > 0 && visited[flat - 1]) ||
        (x < w - 1 && visited[flat + 1]) ||
        (y > 0 && visited[flat - w]) ||
        (y < h - 1 && visited[flat + w]);
      if (hasTransparentNeighbor) {
        pixels[pxIdx + 3] = 128;
      }
    }
  }

  ctx.putImageData(data, 0, 0);
  return canvas;
}
