import Konva from 'konva';
import type { Point, QuadMeshCell } from './quadGeometry';
import { solveAffine } from './quadGeometry';

const SEAM_OVERLAP_PX = 0.75;

function inflateTriangle(points: [Point, Point, Point]): [Point, Point, Point] {
  const centroidX = (points[0].x + points[1].x + points[2].x) / 3;
  const centroidY = (points[0].y + points[1].y + points[2].y) / 3;
  return points.map((point) => {
    const dx = point.x - centroidX;
    const dy = point.y - centroidY;
    const length = Math.hypot(dx, dy) || 1;
    return {
      x: point.x + (dx / length) * SEAM_OVERLAP_PX,
      y: point.y + (dy / length) * SEAM_OVERLAP_PX,
    };
  }) as [Point, Point, Point];
}

function drawTriangle(
  ctx: Konva.Context,
  source: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
  src: [Point, Point, Point],
  dst: [Point, Point, Point],
) {
  const affine = solveAffine(src, dst);
  if (!affine) return;
  if (dst.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y))) return;

  const clipDst = inflateTriangle(dst);

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(clipDst[0].x, clipDst[0].y);
  ctx.lineTo(clipDst[1].x, clipDst[1].y);
  ctx.lineTo(clipDst[2].x, clipDst[2].y);
  ctx.closePath();
  ctx.clip();
  ctx.transform(affine.a, affine.b, affine.c, affine.d, affine.e, affine.f);
  ctx.drawImage(source, 0, 0);
  ctx.restore();
}

/**
 * Draws `mesh` (unit-square source cells mapped to destination canvas cells) by splitting each
 * cell into two triangles and drawing each with its own affine transform. Source pixels are
 * sampled at `(src.x * width, src.y * height)`. Used by PerspectiveScreenView for rasterized
 * children (always an HTMLCanvasElement).
 */
export function drawWarpedMesh(
  ctx: Konva.Context,
  mesh: QuadMeshCell[],
  sourceCanvas: HTMLCanvasElement,
  width: number,
  height: number,
) {
  const toSourcePixels = (point: Point): Point => ({ x: point.x * width, y: point.y * height });
  for (const cell of mesh) {
    const src = cell.src.map(toSourcePixels) as [Point, Point, Point, Point];
    const dst = cell.dst;
    drawTriangle(ctx, sourceCanvas, [src[0], src[1], src[3]], [dst[0], dst[1], dst[3]]);
    drawTriangle(ctx, sourceCanvas, [src[1], src[2], src[3]], [dst[1], dst[2], dst[3]]);
  }
}

/**
 * Same as drawWarpedMesh but accepts any drawable media source (HTMLImageElement,
 * HTMLVideoElement, or HTMLCanvasElement) with explicit natural dimensions. Used by
 * WarpedScreenContent to warp user content directly into a portable's screen quad without
 * first rasterizing it into an offscreen canvas.
 */
export function drawWarpedImageMesh(
  ctx: Konva.Context,
  mesh: QuadMeshCell[],
  image: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
  imageWidth: number,
  imageHeight: number,
) {
  if (imageWidth <= 0 || imageHeight <= 0) return;
  const toSourcePixels = (point: Point): Point => ({
    x: point.x * imageWidth,
    y: point.y * imageHeight,
  });
  for (const cell of mesh) {
    const src = cell.src.map(toSourcePixels) as [Point, Point, Point, Point];
    const dst = cell.dst;
    drawTriangle(ctx, image, [src[0], src[1], src[3]], [dst[0], dst[1], dst[3]]);
    drawTriangle(ctx, image, [src[1], src[2], src[3]], [dst[1], dst[2], dst[3]]);
  }
}
