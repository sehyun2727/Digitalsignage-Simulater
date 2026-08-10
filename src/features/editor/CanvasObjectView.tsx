import type Konva from 'konva';
import { useEffect, useRef } from 'react';
import { Image as KonvaImage, Text as KonvaText } from 'react-konva';
import { useHtmlImage } from '../../lib/useHtmlImage';
import type { SignageObject } from '../../types/editor';
import { PortableProductView } from './PortableProductView';
import { SignageDisplayView } from './SignageDisplayView';

interface CanvasObjectViewProps {
  object: SignageObject;
  onSelect: (id: string) => void;
  onRegisterNode: (id: string, node: Konva.Node | null) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
  onTransformEnd: (id: string, patch: Partial<SignageObject>) => void;
}

export function CanvasObjectView({
  object,
  onSelect,
  onRegisterNode,
  onDragEnd,
  onTransformEnd,
}: CanvasObjectViewProps) {
  const nodeRef = useRef<Konva.Node | null>(null);
  const image = useHtmlImage(object.kind === 'image' ? object.src : null);

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
    onDragEnd: (event: Konva.KonvaEventObject<DragEvent>) => {
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
    return <SignageDisplayView object={object} groupProps={commonProps} />;
  }

  if (object.kind === 'portable') {
    return <PortableProductView object={object} groupProps={commonProps} />;
  }

  if (!image) return null;

  return <KonvaImage {...commonProps} image={image} />;
}
