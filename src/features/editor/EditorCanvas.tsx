import type Konva from 'konva';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Layer, Rect, Stage, Transformer } from 'react-konva';
import { useEditorStore } from '../../store/editorStore';
import { TEMPLATES } from '../../types/editor';
import type { SignageObject } from '../../types/editor';
import { CanvasObjectView } from './CanvasObjectView';
import { SpaceBackgroundView } from './SpaceBackgroundView';

export interface EditorCanvasHandle {
  exportToDataUrl: () => string | null;
}

export const EditorCanvas = forwardRef<EditorCanvasHandle>(function EditorCanvas(_props, ref) {
  const document = useEditorStore((state) => state.document);
  const selectedId = useEditorStore((state) => state.selectedId);
  const selectObject = useEditorStore((state) => state.selectObject);
  const commitObjectChange = useEditorStore((state) => state.commitObjectChange);

  const template = TEMPLATES[document.templateId];
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<Konva.Stage | null>(null);
  const transformerRef = useRef<Konva.Transformer | null>(null);
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

  const fitScale = containerWidth > 0 ? containerWidth / template.width : 1;
  const stageHeight = template.height * fitScale;

  useImperativeHandle(ref, () => ({
    exportToDataUrl: () => {
      const stage = stageRef.current;
      const transformer = transformerRef.current;
      if (!stage || fitScale <= 0) return null;

      // Hide the Transformer's border/anchors for the duration of the synchronous
      // toDataURL() call so selection UI never appears in the exported PNG, then
      // restore it. This must use the layer's synchronous draw(), not batchDraw():
      // batchDraw() defers the actual canvas redraw to the next animation frame, so
      // toDataURL() would read back the stale (still-visible) bitmap if it ran first.
      const selectedNodes = transformer?.nodes() ?? [];
      if (transformer && selectedNodes.length > 0) {
        transformer.nodes([]);
        transformer.getLayer()?.draw();
      }

      const dataUrl = stage.toDataURL({ mimeType: 'image/png', pixelRatio: 1 / fitScale });

      if (transformer && selectedNodes.length > 0) {
        transformer.nodes(selectedNodes);
        transformer.getLayer()?.draw();
      }

      return dataUrl;
    },
  }));

  useEffect(() => {
    const transformer = transformerRef.current;
    if (!transformer) return;
    if (!selectedId) {
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
  }, [selectedId, document.objects]);

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

  return (
    <div className="editor-canvas-container" ref={containerRef}>
      {containerWidth > 0 && (
        <Stage
          ref={stageRef}
          width={containerWidth}
          height={stageHeight}
          scaleX={fitScale}
          scaleY={fitScale}
          onMouseDown={(event) => {
            if (event.target === event.target.getStage()) selectObject(null);
          }}
          onTouchStart={(event) => {
            if (event.target === event.target.getStage()) selectObject(null);
          }}
        >
          <Layer>
            <Rect
              x={0}
              y={0}
              width={template.width}
              height={template.height}
              fill={document.backgroundColor}
              listening={false}
            />
            {document.spaceBackground && (
              <SpaceBackgroundView
                spaceBackground={document.spaceBackground}
                width={template.width}
                height={template.height}
              />
            )}
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
