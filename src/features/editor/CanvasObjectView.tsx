import type Konva from 'konva';
import { useEffect, useRef } from 'react';
import { Image as KonvaImage, Text as KonvaText } from 'react-konva';
import { getRegisteredAsset } from '../../lib/assetRegistry';
import type { DocumentSize } from '../../lib/quadGeometry';
import { useEditorStore } from '../../store/editorStore';
import type { SignageObject, SpaceBackground } from '../../types/editor';
import { PortableProductView } from './PortableProductView';
import { SignageDisplayView } from './SignageDisplayView';

interface CanvasObjectViewProps {
  object: SignageObject;
  onSelect: (id: string) => void;
  onRegisterNode: (id: string, node: Konva.Node | null) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
  onTransformEnd: (id: string, patch: Partial<SignageObject>) => void;
  documentSize: DocumentSize | null;
  spaceBackground: SpaceBackground | null;
}

export function CanvasObjectView({
  object,
  onSelect,
  onRegisterNode,
  onDragEnd,
  onTransformEnd,
  documentSize,
  spaceBackground,
}: CanvasObjectViewProps) {
  const nodeRef = useRef<Konva.Node | null>(null);
  const translatePerspectiveQuad = useEditorStore((state) => state.translatePerspectiveQuad);
  // Image signage now goes through the same asset registry as space background + display content
  // (fixes the object-URL leak that used to accumulate on every Add-Image / Delete cycle) — the
  // registered decoded HTMLImageElement is available synchronously here, no separate load hook.
  const imageAsset =
    object.kind === 'image' ? getRegisteredAsset(object.sourceId)?.image ?? null : null;

  useEffect(() => {
    return () => onRegisterNode(object.id, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [object.id]);

  const setRef = (node: Konva.Node | null) => {
    nodeRef.current = node;
    onRegisterNode(object.id, node);
  };

  const handleTransformEnd = () => {
    const node = nodeRef.current;
    if (!node) return;
    const scaleX = node.scaleX();
    // The Transformer is configured with keepRatio for portable objects (see EditorCanvas.tsx),
    // but that only constrains the interactive drag; forcing scaleY = scaleX here too keeps
    // the portable object's aspect ratio (and thus its screen-region mapping) correct even if
    // a resize is ever triggered by some other path.
    const scaleY = object.kind === 'portable' ? scaleX : node.scaleY();
    node.scaleX(1);
    node.scaleY(1);
    onTransformEnd(object.id, {
      x: node.x(),
      y: node.y(),
      width: Math.max(10, object.width * scaleX),
      height: Math.max(10, object.height * scaleY),
      rotation: node.rotation(),
    });
  };

  // Selection is indicated solely by the shared Transformer (see EditorCanvas) so that
  // no selection styling is ever baked into the node itself and exported to PNG.
  const commonProps = {
    id: object.id,
    x: object.x,
    y: object.y,
    width: object.width,
    height: object.height,
    rotation: object.rotation,
    draggable: true,
    onClick: () => onSelect(object.id),
    onTap: () => onSelect(object.id),
    // Konva suppresses the click/tap event for an interaction that turned into a drag, so
    // dragging an unselected object would move it without selecting it unless drag end also
    // selects — this keeps "click selects" and "drag selects and moves" consistent in one
    // gesture, for every object kind, using the same commonProps object. Selecting on drag
    // *start* instead would change `selectedId` mid-gesture, re-rendering this component with
    // the store's still-stale `object.x`/`object.y` and having react-konva re-apply them as
    // controlled props onto the node Konva is actively dragging — snapping it back to its
    // pre-drag position. Selecting at drag *end*, after the position commit, avoids that.
    onDragEnd: (event: Konva.KonvaEventObject<DragEvent>) => {
      onSelect(object.id);
      onDragEnd(object.id, event.target.x(), event.target.y());
    },
    onTransformEnd: handleTransformEnd,
    ref: setRef,
  };

  if (object.kind === 'text') {
    return (
      <KonvaText
        {...commonProps}
        text={object.text}
        fontSize={object.fontSize}
        fill={object.color}
        align={object.align}
        verticalAlign="middle"
      />
    );
  }

  if (object.kind === 'display') {
    return (
      <SignageDisplayView
        object={object}
        groupProps={commonProps}
        documentSize={documentSize}
        spaceBackground={spaceBackground}
        onPerspectiveQuadTranslate={translatePerspectiveQuad}
      />
    );
  }

  if (object.kind === 'portable') {
    return (
      <PortableProductView
        object={object}
        groupProps={commonProps}
        documentSize={documentSize}
        spaceBackground={spaceBackground}
        onPerspectiveQuadTranslate={translatePerspectiveQuad}
      />
    );
  }

  if (!imageAsset) return null;

  return <KonvaImage {...commonProps} image={imageAsset} />;
}
