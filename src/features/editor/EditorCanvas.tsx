import type Konva from 'konva';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Group, Layer, Rect, Stage, Transformer } from 'react-konva';
import { registerAsset } from '../../lib/assetRegistry';
import type { ImageValidationError } from '../../lib/fileValidation';
import { validateImageFile } from '../../lib/fileValidation';
import { findTopmostScreenHit, getObjectScreenRect } from '../../lib/screenHitTest';
import type { Point } from '../../lib/screenHitTest';
import { useEditorStore } from '../../store/editorStore';
import { getDocumentSize } from '../../types/editor';
import type { SignageObject } from '../../types/editor';
import { CanvasObjectView } from './CanvasObjectView';
import { SpaceBackgroundView } from './SpaceBackgroundView';

export interface EditorCanvasHandle {
  exportToDataUrl: () => string | null;
}

interface EditorCanvasProps {
  onImageError: (error: ImageValidationError) => void;
  /** When true, renders only the space background so the user can compare it against the
   *  composed result; signage objects, selection, and drag-and-drop are all suppressed. */
  comparisonMode?: boolean;
}

export const EditorCanvas = forwardRef<EditorCanvasHandle, EditorCanvasProps>(function EditorCanvas(
  { onImageError, comparisonMode = false },
  ref,
) {
  const document = useEditorStore((state) => state.document);
  const selectedId = useEditorStore((state) => state.selectedId);
  const selectObject = useEditorStore((state) => state.selectObject);
  const commitObjectChange = useEditorStore((state) => state.commitObjectChange);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const dropTargetObject = document.objects.find((object) => object.id === dropTargetId) ?? null;
  const dropTargetRect = dropTargetObject ? getObjectScreenRect(dropTargetObject) : null;

  const size = getDocumentSize(document);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<Konva.Stage | null>(null);
  const transformerRef = useRef<Konva.Transformer | null>(null);
  const objectsGroupRef = useRef<Konva.Group | null>(null);
  const nodesRef = useRef<Map<string, Konva.Node>>(new Map());
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setContainerWidth(entry.contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const fitScale = containerWidth > 0 && size ? containerWidth / size.width : 1;
  const stageHeight = size ? size.height * fitScale : 0;

  useImperativeHandle(ref, () => ({
    exportToDataUrl: () => {
      const stage = stageRef.current;
      const transformer = transformerRef.current;
      const objectsGroup = objectsGroupRef.current;
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
      layer?.draw();

      // Konva assigns the exported canvas's pixel dimensions via a raw `canvas.width =`/
      // `canvas.height =` write, which truncates toward zero rather than rounding. A pixelRatio
      // that is the exact mathematical inverse of fitScale can land a hair under the target
      // template size (e.g. 1919.999999999998), which truncates to 1919 instead of 1920. Nudging
      // the ratio up by a fraction of a pixel keeps the result safely above the integer boundary
      // without any visible effect, so the export always lands on the template's exact resolution.
      const exportPixelRatio = (1 / fitScale) * (1 + 1e-6);
      const dataUrl = stage.toDataURL({ mimeType: 'image/png', pixelRatio: exportPixelRatio });

      if (selectedNodes.length > 0) transformer?.nodes(selectedNodes);
      objectsGroup?.visible(!comparisonMode);
      layer?.draw();

      return dataUrl;
    },
  }));

  useEffect(() => {
    const transformer = transformerRef.current;
    if (!transformer) return;
    if (comparisonMode || !selectedId) {
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
  }, [selectedId, document.objects, comparisonMode]);

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
    if (!targetId || !file) return;

    const validationError = validateImageFile(file);
    if (validationError) {
      onImageError(validationError);
      return;
    }

    try {
      const asset = await registerAsset(file);
      commitObjectChange(targetId, {
        content: {
          kind: 'image',
          sourceId: asset.sourceId,
          fit: 'contain',
          offsetX: 0,
          offsetY: 0,
          scale: 1,
        },
      });
      selectObject(targetId);
    } catch {
      onImageError('decode-error');
    }
  };

  return (
    <div
      className="editor-canvas-container"
      ref={containerRef}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {containerWidth > 0 && size && (
        <Stage
          ref={stageRef}
          width={containerWidth}
          height={stageHeight}
          scaleX={fitScale}
          scaleY={fitScale}
          onMouseDown={(event) => {
            if (!comparisonMode && event.target === event.target.getStage()) selectObject(null);
          }}
          onTouchStart={(event) => {
            if (!comparisonMode && event.target === event.target.getStage()) selectObject(null);
          }}
        >
          <Layer>
            {document.spaceBackground && (
              <SpaceBackgroundView
                spaceBackground={document.spaceBackground}
                width={size.width}
                height={size.height}
              />
            )}
            <Group ref={objectsGroupRef} visible={!comparisonMode} listening={!comparisonMode}>
              {document.objects.map((object) => (
                <CanvasObjectView
                  key={object.id}
                  object={object}
                  onSelect={selectObject}
                  onRegisterNode={registerNode}
                  onDragEnd={handleDragEnd}
                  onTransformEnd={handleTransformEnd}
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
            <Transformer
              ref={transformerRef}
              boundBoxFunc={(oldBox, newBox) =>
                newBox.width < 10 || newBox.height < 10 ? oldBox : newBox
              }
            />
          </Layer>
        </Stage>
      )}
    </div>
  );
});
