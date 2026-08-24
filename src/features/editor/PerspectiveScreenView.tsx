import Konva from 'konva';
import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { Group, Shape } from 'react-konva';
import { buildQuadMesh, normalizedQuadToDocument } from '../../lib/quadGeometry';
import type { DocumentSize } from '../../lib/quadGeometry';
import { drawWarpedMesh } from '../../lib/warpMesh';
import type { NormalizedQuad } from '../../types/editor';

interface PerspectiveScreenViewProps {
  /** The flat, unwarped visual content (bezel + screen composition), authored at `width`x`height`
   *  in its own local, unrotated coordinate space — the same tree SignageDisplayView/
   *  PortableProductView already render for 'rect' mode. */
  children: ReactNode;
  width: number;
  height: number;
  quad: NormalizedQuad;
  documentSize: DocumentSize;
  /** True when `children` contains a playing video: the source raster must then be re-baked every
   *  animation frame instead of only on React re-renders, or the warped mesh keeps sampling one
   *  frozen frame while the underlying video keeps playing (ContrastGroup solves the same problem
   *  the same way — see ScreenComposition.tsx). */
  redrawContinuously?: boolean;
}

/** Mesh subdivisions per axis for the piecewise-affine perspective warp (see quadGeometry.ts
 *  buildQuadMesh): high enough that the affine approximation of each cell is visually
 *  indistinguishable from the true projective warp at typical signage screen sizes, low enough
 *  that redrawing on every prop change (not just once) stays cheap in the editor. */
const MESH_SUBDIVISIONS = 8;

/** Placed far outside the document's own 0..width/0..height bounds, which is exactly the region
 *  the Stage draws and exports (see EditorCanvas.tsx) — so the flat source copy below never
 *  appears on screen or in a PNG export; it exists solely to be rasterized into a bitmap. */
const OFFSCREEN_MARGIN = 10000;

/**
 * Renders `children` warped into `quad`'s four corners, in absolute document coordinates
 * (ADR 0008). `perspectiveQuad` is decoupled from the object's own x/y/rotation/width/height (see
 * screenHitTest.ts's isPointOnObjectScreen), so this renders as an absolutely positioned sibling
 * rather than nesting inside the object's own rotated Group.
 *
 * Canvas 2D has no native projective transform, so the warp is approximated piecewise: `children`
 * is first rasterized off-canvas into a plain bitmap (via Konva's synchronous `toCanvas()`, the
 * same primitive EditorCanvas.tsx's PNG export uses), then that bitmap is redrawn as a grid of
 * small triangles, each with its own affine transform following the quad's homography mesh — as
 * the grid gets finer this converges to the true perspective warp.
 */
export function PerspectiveScreenView({
  children,
  width,
  height,
  quad,
  documentSize,
  redrawContinuously = false,
}: PerspectiveScreenViewProps) {
  const sourceGroupRef = useRef<Konva.Group | null>(null);
  const shapeRef = useRef<Konva.Shape | null>(null);
  // A plain ref, not useState: `toCanvas()` returns a new HTMLCanvasElement object on every call,
  // so storing it in state and setting it from a no-dependency-array effect (which runs after
  // every render) would re-render every time with a "changed" value, forever. A ref plus an
  // explicit `batchDraw()` gets the same "always reflects the latest rasterization" behavior
  // without going through React's render loop at all.
  const sourceCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const offscreenX = documentSize.width + OFFSCREEN_MARGIN;

  // No dependency array: children's own props (material/curvature/content/etc.) change on every
  // relevant store update, and re-rasterizing every render (not per-animation-frame) matches the
  // same tradeoff ScreenComposition.tsx's ContrastGroup already makes for its own cache() call.
  // toCanvas()'s x/y/width/height config is interpreted in the node's *absolute* (screen-pixel)
  // coordinate space — i.e. after the Stage's own scaleX/scaleY (EditorCanvas.tsx fits the
  // Stage to the container via scaleX={fitScale}) — not in this Group's local, unscaled document
  // coordinates. Passing offscreenX/width/height (document-space numbers) straight through only
  // happens to work when fitScale is exactly 1; at any other scale it captures the wrong region
  // (or nothing), which is why the warp painted no visible content before this fix. Multiplying
  // by the Stage's current scale converts to absolute space, and pixelRatio's inverse cancels
  // that same scale back out so the raster still comes out at exactly `width`x`height` device
  // pixels, matching what drawWarpedMesh's toSourcePixels assumes.
  useEffect(() => {
    const sourceNode = sourceGroupRef.current;
    if (!sourceNode || width <= 0 || height <= 0) return;
    const stageScale = sourceNode.getStage()?.scaleX() || 1;
    sourceCanvasRef.current = sourceNode.toCanvas({
      x: offscreenX * stageScale,
      y: 0,
      width: width * stageScale,
      height: height * stageScale,
      pixelRatio: 1 / stageScale,
    });
    shapeRef.current?.getLayer()?.batchDraw();
  });

  // A React re-render triggers the effect above once, which is enough for a static image but not
  // for a playing video: HTMLVideoElement frames advance without any React state change, so the
  // source bitmap the mesh samples would stay frozen on whichever frame happened to be captured
  // first. While `redrawContinuously` is on, drive a Konva.Animation that re-runs the same
  // toCanvas() every frame — matching ContrastGroup's exact pattern in ScreenComposition.tsx.
  useEffect(() => {
    if (!redrawContinuously || width <= 0 || height <= 0) return;
    const sourceNode = sourceGroupRef.current;
    const layer = shapeRef.current?.getLayer();
    if (!sourceNode || !layer) return;
    const animation = new Konva.Animation(() => {
      const stageScale = sourceNode.getStage()?.scaleX() || 1;
      sourceCanvasRef.current = sourceNode.toCanvas({
        x: offscreenX * stageScale,
        y: 0,
        width: width * stageScale,
        height: height * stageScale,
        pixelRatio: 1 / stageScale,
      });
    }, layer);
    animation.start();
    return () => {
      animation.stop();
    };
  }, [redrawContinuously, width, height, offscreenX]);

  const documentQuad = normalizedQuadToDocument(quad, documentSize);
  const mesh = buildQuadMesh(documentQuad, MESH_SUBDIVISIONS);

  return (
    <>
      <Group ref={sourceGroupRef} x={offscreenX} y={0} listening={false}>
        {children}
      </Group>
      {mesh && (
        <Shape
          ref={shapeRef}
          listening={false}
          sceneFunc={(ctx) => {
            const sourceCanvas = sourceCanvasRef.current;
            if (!sourceCanvas) return;
            drawWarpedMesh(ctx, mesh, sourceCanvas, width, height);
          }}
        />
      )}
    </>
  );
}

