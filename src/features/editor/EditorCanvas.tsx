import type Konva from 'konva';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Group, Layer, Rect, Stage, Transformer } from 'react-konva';
import {
  registerContentAsset,
  resolveContentUploadFailure,
  validateContentFile,
} from '../../lib/contentUpload';
import { findCachedNodes, recacheAtPixelRatio } from '../../lib/konvaCacheSync';
import { computeAutoContentRotation } from '../../lib/contentLayout';
import { findTopmostScreenHit, getObjectScreenRect } from '../../lib/screenHitTest';
import type { Point } from '../../lib/screenHitTest';
import { useEditorStore } from '../../store/editorStore';
import { useUiStore } from '../../store/uiStore';
import { buildContentUploadError } from '../../lib/uploadLimits';
import { getDocumentSize } from '../../types/editor';
import type { SignageObject } from '../../types/editor';
import { CanvasObjectView } from './CanvasObjectView';
import { HullWatermarkView } from './HullWatermarkView';
import { OcclusionEditOverlay } from './OcclusionEditOverlay';
import { PerspectiveEditOverlay } from './PerspectiveEditOverlay';
import { ScreenQuadEditOverlay } from './ScreenQuadEditOverlay';
import { SpaceBackgroundView } from './SpaceBackgroundView';

export interface EditorCanvasHandle {
  exportToDataUrl: () => string | null;
  /** Hides selection UI and forces signage visible for a video recording, mirroring
   *  exportToDataUrl's setup, then returns the Layer's own live canvas element (not a snapshot)
   *  so the caller can pass it to captureStream — the recording keeps observing this canvas's
   *  pixels for as long as it runs, so unlike exportToDataUrl this state is not restored until
   *  endVideoExportCapture() is called. */
  beginVideoExportCapture: () => HTMLCanvasElement | null;
  endVideoExportCapture: () => void;
}

interface EditorCanvasProps {
  /** Called when a native OS file drop lands on the canvas but not inside any display/portable
   *  object's screen region, so callers can announce why the drop was ignored instead of leaving
   *  the user with no feedback. The drop-without-target case is a hint (requirement C7
   *  "hints and errors are different channels"), not an upload failure — it is dispatched as a
   *  success-side announcement rather than as an error banner. */
  onDropWithoutTarget: () => void;
  /** When true, renders only the space background so the user can compare it against the
   *  composed result; signage objects, selection, and drag-and-drop are all suppressed. */
  comparisonMode?: boolean;
  /** When true, suppresses the HULL watermark from PNG and video exports. */
  watermarkDisabled?: boolean;
}

export const EditorCanvas = forwardRef<EditorCanvasHandle, EditorCanvasProps>(function EditorCanvas(
  { onDropWithoutTarget, comparisonMode = false, watermarkDisabled = false },
  ref,
) {
  const document = useEditorStore((state) => state.document);
  const selectedId = useEditorStore((state) => state.selectedId);
  const selectObject = useEditorStore((state) => state.selectObject);
  const commitObjectChange = useEditorStore((state) => state.commitObjectChange);
  const perspectiveEditId = useEditorStore((state) => state.perspectiveEditId);
  const occlusionEditObjectId = useEditorStore((state) => state.occlusionEditObjectId);
  const screenQuadEditId = useEditorStore((state) => state.screenQuadEditId);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const dropTargetObject = document.objects.find((object) => object.id === dropTargetId) ?? null;
  const dropTargetRect = dropTargetObject ? getObjectScreenRect(dropTargetObject) : null;

  const size = getDocumentSize(document);
  const containerRef = useRef<HTMLDivElement | null>(null);
  // v2-S3 2-1: the measure box is the full available workspace (fills `.editor-canvas-wrapper`).
  // The visible container (border + bg) sizes down to the computed Stage width×height so no
  // dead letterbox space sits inside the editor's own frame — the measure box observes the
  // outer size for the fit calculation, the inner container snaps to the fitted Stage.
  const measureRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<Konva.Stage | null>(null);
  const layerRef = useRef<Konva.Layer | null>(null);
  const transformerRef = useRef<Konva.Transformer | null>(null);
  const objectsGroupRef = useRef<Konva.Group | null>(null);
  const watermarkGroupRef = useRef<Konva.Group | null>(null);
  const nodesRef = useRef<Map<string, Konva.Node>>(new Map());
  const captureRestoreRef = useRef<(() => void) | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  // v2-S3 2-1: also track the container's height so the fit calculation can honour BOTH
  // axes — the pre-S3 math was width-only, which clipped 9:16 canvases at tall viewports.
  const [containerHeight, setContainerHeight] = useState(0);
  // v2-S3 B-4: mobile fit formula needs `window.innerHeight` (not just the measure box's
  // own height) so the stage grows to 0.7 × viewport height regardless of how much space
  // the stacked toolbar below is currently taking. Track it the same way as container size.
  const [viewportInnerHeight, setViewportInnerHeight] = useState(
    typeof window !== 'undefined' ? window.innerHeight : 0,
  );
  const [viewportInnerWidth, setViewportInnerWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 0,
  );

  useEffect(() => {
    const element = measureRef.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setContainerWidth(entry.contentRect.width);
        setContainerHeight(entry.contentRect.height);
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onResize = () => {
      setViewportInnerHeight(window.innerHeight);
      setViewportInnerWidth(window.innerWidth);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // v2-S3 B-4: pick the fit formula based on the viewport, not on the measure box. The
  // mobile breakpoint matches the shell's `@media (max-width: 48rem)` block (768 px);
  // below that the layout is stacked (canvas above the toolbar) and the measure box's
  // height is capped at the stage height by the mobile @media rule in global.css, so
  // the formula uses `0.7 × window.innerHeight` as the vertical bound instead.
  //
  // Desktop: fit scale is min(containerW/docW, containerH/docH) — honours both axes of the
  // flex-sized measure box. Coordinate conversion stays correct because scaleX = scaleY.
  const MOBILE_BREAKPOINT_PX = 768;
  const isMobile = viewportInnerWidth > 0 && viewportInnerWidth < MOBILE_BREAKPOINT_PX;
  const fitScale = (() => {
    if (!size) return 1;
    if (isMobile) {
      // v2-S3 B-4 bootstrap: mobile measure box is `flex: 0 0 auto`, so its initial
      // containerWidth starts at ~0 before any inline-style is applied — using that
      // directly would pin fitScale at 0 forever (measure stays 0 → container stays 0).
      // Fall back to `window.innerWidth − shellPadding` for the width term so the first
      // render already has a non-zero scale; afterwards the ResizeObserver keeps us
      // honest.
      const shellPadding = 24;
      const widthBasis = containerWidth > 0 ? containerWidth : viewportInnerWidth - shellPadding;
      if (widthBasis <= 0) return 1;
      if (viewportInnerHeight <= 0) return widthBasis / size.width;
      return Math.min(widthBasis / size.width, (0.7 * viewportInnerHeight) / size.height);
    }
    if (containerWidth <= 0) return 1;
    if (containerHeight <= 0) return 1;
    return Math.min(containerWidth / size.width, containerHeight / size.height);
  })();
  const stageWidth = size ? size.width * fitScale : 0;
  const stageHeight = size ? size.height * fitScale : 0;

  useImperativeHandle(ref, () => ({
    exportToDataUrl: () => {
      const stage = stageRef.current;
      const transformer = transformerRef.current;
      const objectsGroup = objectsGroupRef.current;
      const watermarkGroup = watermarkGroupRef.current;
      if (!stage || fitScale <= 0) return null;

      // Hide the Transformer's border/anchors, and force the signage objects visible, for the
      // duration of the synchronous toDataURL() call: exporting must always capture the
      // composed result (never selection UI, and never the comparison-mode space-photo-only
      // view) regardless of what the user currently has on screen. This must use the layer's
      // synchronous draw(), not batchDraw(): batchDraw() defers the actual canvas redraw to the
      // next animation frame, so toDataURL() would read back a stale bitmap if it ran first.
      const layer = transformer?.getLayer() ?? objectsGroup?.getLayer() ?? null;
      const selectedNodes = transformer?.nodes() ?? [];
      transformer?.nodes([]);
      objectsGroup?.visible(true);
      // Perspective-placed objects can't use the shared Transformer (their hit target is a quad
      // Line, not a rectangular node), so their selection UI is a dashed sibling outline drawn
      // inline (name="perspective-selection-outline"). Hide those the same way the Transformer's
      // handles are hidden here, so exported PNGs never contain selection chrome.
      const selectionOutlines = stage?.find('.perspective-selection-outline') ?? [];
      selectionOutlines.forEach((node) => node.hide());
      // Show the watermark on top of everything for the export capture; it is kept invisible
      // during live editing so it never distracts from the composition workflow.
      if (!watermarkDisabled) watermarkGroup?.visible(true);
      layer?.draw();

      // Konva assigns the exported canvas's pixel dimensions via a raw `canvas.width =`/
      // `canvas.height =` write, which truncates toward zero rather than rounding. A pixelRatio
      // that is the exact mathematical inverse of fitScale can land a hair under the target
      // template size (e.g. 1919.999999999998), which truncates to 1919 instead of 1920. Nudging
      // the ratio up by a fraction of a pixel keeps the result safely above the integer boundary
      // without any visible effect, so the export always lands on the template's exact resolution.
      const exportPixelRatio = (1 / fitScale) * (1 + 1e-6);

      // Contrast (ScreenComposition's ContrastGroup) and contact-shadow blur (ContactShadowView)
      // both require a rasterized `.cache()` bitmap, baked at Konva's default pixelRatio for
      // cheap interactive editing. Left as-is, that bitmap would get stretched up to
      // exportPixelRatio here and look visibly blurrier than the surrounding vector-rendered
      // content, so temporarily re-bake every cached node at full export resolution, snapshot,
      // then restore the cheap default for the live preview.
      const cachedNodes = findCachedNodes(stage);
      cachedNodes.forEach((node) => recacheAtPixelRatio(node, exportPixelRatio));
      layer?.draw();

      const dataUrl = stage.toDataURL({ mimeType: 'image/png', pixelRatio: exportPixelRatio });

      cachedNodes.forEach((node) => recacheAtPixelRatio(node));

      if (selectedNodes.length > 0) transformer?.nodes(selectedNodes);
      objectsGroup?.visible(!comparisonMode);
      selectionOutlines.forEach((node) => node.show());
      watermarkGroup?.visible(false);
      layer?.draw();

      return dataUrl;
    },
    beginVideoExportCapture: () => {
      const layer = layerRef.current;
      const stage = stageRef.current;
      const transformer = transformerRef.current;
      const objectsGroup = objectsGroupRef.current;
      const watermarkGroup = watermarkGroupRef.current;
      if (!layer) return null;

      // Capture the restore closure at begin time (comparisonMode, previous selection, node
      // refs) so end doesn't rely on whatever imperative-handle instance happens to be current
      // when the async recording resolves — otherwise a re-render mid-recording would swap in a
      // new end handler that sees a different comparisonMode/selection than begin recorded.
      const previousSelection = transformer?.nodes() ?? [];
      const previousComparisonMode = comparisonMode;
      const selectionOutlines = stage?.find('.perspective-selection-outline') ?? [];
      transformer?.nodes([]);
      objectsGroup?.visible(true);
      selectionOutlines.forEach((node) => node.hide());
      if (!watermarkDisabled) watermarkGroup?.visible(true);
      layer.draw();
      captureRestoreRef.current = () => {
        transformer?.nodes(previousSelection);
        objectsGroup?.visible(!previousComparisonMode);
        selectionOutlines.forEach((node) => node.show());
        watermarkGroup?.visible(false);
        layer.draw();
      };

      // Konva's SceneCanvas wraps the actual <canvas> element it paints into; unlike
      // stage.toCanvas()/toDataURL(), which rasterize a one-off snapshot, this is the live
      // element MediaRecorder's captureStream keeps reading from as Konva keeps redrawing it
      // (see useVideoPlaybackRedraw.ts's Konva.Animation loop) for the whole recording.
      return layer.getCanvas()._canvas;
    },
    endVideoExportCapture: () => {
      const restore = captureRestoreRef.current;
      if (!restore) return;
      captureRestoreRef.current = null;
      restore();
    },
  }));

  useEffect(() => {
    const transformer = transformerRef.current;
    if (!transformer) return;
    if (
      comparisonMode ||
      !selectedId ||
      perspectiveEditId ||
      occlusionEditObjectId ||
      screenQuadEditId
    ) {
      transformer.nodes([]);
      transformer.getLayer()?.batchDraw();
      return;
    }
    const node = nodesRef.current.get(selectedId);
    const selectedObject = document.objects.find((object) => object.id === selectedId);
    // A portable object's screen region is authored against its photo's own aspect ratio, so
    // any free (non-uniform) resize would distort the photo and desync the region from what
    // the user marked. Restrict resizing to corner handles with keepRatio so every resize
    // scales width/height together; other object kinds keep full free-resize behavior.
    const isPortable = selectedObject?.kind === 'portable';
    transformer.keepRatio(isPortable);
    transformer.enabledAnchors(
      isPortable
        ? ['top-left', 'top-right', 'bottom-left', 'bottom-right']
        : [
            'top-left',
            'top-center',
            'top-right',
            'middle-right',
            'middle-left',
            'bottom-left',
            'bottom-center',
            'bottom-right',
          ],
    );
    transformer.nodes(node ? [node] : []);
    transformer.getLayer()?.batchDraw();
  }, [
    selectedId,
    document.objects,
    comparisonMode,
    perspectiveEditId,
    occlusionEditObjectId,
    screenQuadEditId,
  ]);

  const registerNode = (id: string, node: Konva.Node | null) => {
    if (node) {
      nodesRef.current.set(id, node);
    } else {
      nodesRef.current.delete(id);
    }
  };

  const handleDragEnd = (id: string, x: number, y: number) => {
    commitObjectChange(id, { x, y });
  };

  const handleTransformEnd = (id: string, patch: Partial<SignageObject>) => {
    commitObjectChange(id, patch);
  };

  // Native OS file drag-and-drop, distinct from Konva's own internal object-move drag above:
  // dropping an image file from the desktop directly onto a display/portable object's screen
  // region assigns it as that object's content in one step. Coordinates come from the raw
  // DOM event (not Konva's pointer state, which native drags don't update), so they're mapped
  // into document space the same way Konva itself does: relative to the container's own
  // bounding box, divided by the Stage's uniform fit scale.
  const clientPointToDocumentPoint = (clientX: number, clientY: number): Point | null => {
    const container = containerRef.current;
    if (!container || fitScale <= 0) return null;
    const bounds = container.getBoundingClientRect();
    return { x: (clientX - bounds.left) / fitScale, y: (clientY - bounds.top) / fitScale };
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (comparisonMode || !event.dataTransfer.types.includes('Files')) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    const point = clientPointToDocumentPoint(event.clientX, event.clientY);
    setDropTargetId(point && size ? findTopmostScreenHit(document.objects, point, size) : null);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    setDropTargetId(null);
  };

  // Vertical pan of the space background photo when its cover-fit overflows the canvas height
  // (Option A: canvas frame stays at the preset size, but a taller-than-canvas photo can be
  // panned to reveal the rest). Wheel delta is in screen pixels; divide by fitScale so a
  // one-notch wheel tick pans the photo by the same distance in canvas coords regardless of
  // how large the canvas is drawn on this viewport. Store-side clamping means a no-overflow
  // photo simply pins to 0 — the handler doesn't need to know the overflow range itself.
  const setSpaceBackgroundOffsetY = useEditorStore((state) => state.setSpaceBackgroundOffsetY);
  const spaceBackgroundOffsetY = document.spaceBackground?.offsetY ?? 0;
  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (!document.spaceBackground || comparisonMode || fitScale <= 0) return;
    // A positive deltaY (wheel scrolled toward user) reveals lower parts of the photo, which
    // means shifting the photo UP in canvas coords — so the offset decreases.
    const delta = event.deltaY / fitScale;
    setSpaceBackgroundOffsetY(spaceBackgroundOffsetY - delta);
  };

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDropTargetId(null);
    if (comparisonMode) return;
    // Recomputed fresh from the drop event's own coordinates rather than reading the
    // `dropTargetId` state set by handleDragOver: that state update is not guaranteed to have
    // flushed by the time `drop` fires right after `dragover` (React batches renders across
    // native browser events), so it can still be stale here.
    const point = clientPointToDocumentPoint(event.clientX, event.clientY);
    const targetId = point && size ? findTopmostScreenHit(document.objects, point, size) : null;
    const file = event.dataTransfer.files[0];
    if (!file) return;
    if (!targetId) {
      // A real file was dropped but landed outside every display/portable screen region — tell
      // the user why nothing happened rather than silently swallowing the drop.
      onDropWithoutTarget();
      return;
    }

    const uiStore = useUiStore.getState();
    const requestId = uiStore.beginUploadRequest('content');
    const validation = validateContentFile(file);
    if (validation) {
      uiStore.setUploadError(
        'content',
        requestId,
        buildContentUploadError(validation.kind, validation.error),
      );
      return;
    }

    try {
      const asset = await registerContentAsset(file);
      const targetObject = document.objects.find((object) => object.id === targetId);
      const targetScreen = targetObject ? getObjectScreenRect(targetObject) : null;
      const rotation = targetScreen
        ? computeAutoContentRotation(
            targetScreen.width,
            targetScreen.height,
            asset.naturalWidth,
            asset.naturalHeight,
          )
        : 0;
      commitObjectChange(targetId, {
        content: {
          kind: asset.kind,
          sourceId: asset.sourceId,
          fit: 'contain',
          offsetX: 0,
          offsetY: 0,
          scale: 1,
          rotation,
        },
      });
      selectObject(targetId);
      useUiStore.getState().clearUploadError('content', requestId);
    } catch (error) {
      const failure = resolveContentUploadFailure(file, error);
      useUiStore
        .getState()
        .setUploadError('content', requestId, buildContentUploadError(failure.kind, failure.error));
    }
  };

  return (
    <div className="editor-canvas-measure" ref={measureRef}>
      <div
        className="editor-canvas-container"
        ref={containerRef}
        /* v2-S3 B-5: pin the inline size once a non-zero width is known. For desktop that
         * means `containerWidth > 0` (ResizeObserver landed); for mobile the formula also
         * accepts `viewportInnerWidth > 0` as a bootstrap, so the first mobile paint can
         * already size the stage from `window.innerWidth − shellPadding` without waiting
         * for the ResizeObserver — otherwise `.editor-canvas-measure { flex: 0 0 auto }`
         * would shrink the measure box to 0 and the stage would never grow. */
        style={
          size && stageWidth > 0 && stageHeight > 0
            ? { width: `${stageWidth}px`, height: `${stageHeight}px` }
            : undefined
        }
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onWheel={handleWheel}
      >
        {containerWidth > 0 && containerHeight > 0 && size && (
          <Stage
            ref={stageRef}
            width={stageWidth}
            height={stageHeight}
            scaleX={fitScale}
            scaleY={fitScale}
            onMouseDown={(event) => {
              if (
                !comparisonMode &&
                !perspectiveEditId &&
                !occlusionEditObjectId &&
                !screenQuadEditId &&
                event.target === event.target.getStage()
              ) {
                selectObject(null);
              }
            }}
            onTouchStart={(event) => {
              if (
                !comparisonMode &&
                !perspectiveEditId &&
                !occlusionEditObjectId &&
                !screenQuadEditId &&
                event.target === event.target.getStage()
              ) {
                selectObject(null);
              }
            }}
          >
            <Layer ref={layerRef}>
              {document.spaceBackground && (
                <SpaceBackgroundView
                  spaceBackground={document.spaceBackground}
                  width={size.width}
                  height={size.height}
                />
              )}
              <Group
                ref={objectsGroupRef}
                visible={!comparisonMode}
                listening={
                  !comparisonMode &&
                  !perspectiveEditId &&
                  !occlusionEditObjectId &&
                  !screenQuadEditId
                }
              >
                {document.objects.map((object) => (
                  <CanvasObjectView
                    key={object.id}
                    object={object}
                    onSelect={selectObject}
                    onRegisterNode={registerNode}
                    onDragEnd={handleDragEnd}
                    onTransformEnd={handleTransformEnd}
                    documentSize={size}
                    spaceBackground={document.spaceBackground}
                  />
                ))}
              </Group>
              {!comparisonMode && dropTargetObject && dropTargetRect && (
                <Group
                  x={dropTargetObject.x}
                  y={dropTargetObject.y}
                  rotation={dropTargetObject.rotation}
                  listening={false}
                >
                  <Rect
                    x={dropTargetRect.x}
                    y={dropTargetRect.y}
                    width={dropTargetRect.width}
                    height={dropTargetRect.height}
                    stroke="#2563eb"
                    strokeWidth={3}
                    dash={[10, 6]}
                    listening={false}
                  />
                </Group>
              )}
              {/* Watermark group: always invisible in the live editor; made visible only for the
                duration of PNG/video export captures so it appears in every exported result. */}
              <Group ref={watermarkGroupRef} visible={false} listening={false}>
                <HullWatermarkView canvasWidth={size.width} canvasHeight={size.height} />
              </Group>
              <Transformer
                ref={transformerRef}
                boundBoxFunc={(oldBox, newBox) =>
                  newBox.width < 10 || newBox.height < 10 ? oldBox : newBox
                }
              />
            </Layer>
          </Stage>
        )}
        {!comparisonMode && size && perspectiveEditId && (
          <PerspectiveEditOverlay documentSize={size} fitScale={fitScale} />
        )}
        {!comparisonMode && size && occlusionEditObjectId && (
          <OcclusionEditOverlay documentSize={size} fitScale={fitScale} />
        )}
        {!comparisonMode &&
          screenQuadEditId &&
          (() => {
            const obj = document.objects.find((o) => o.id === screenQuadEditId);
            return obj && obj.kind === 'portable' ? (
              <ScreenQuadEditOverlay object={obj} fitScale={fitScale} />
            ) : null;
          })()}
      </div>
    </div>
  );
});
