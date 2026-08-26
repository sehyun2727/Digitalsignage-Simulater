import { useEffect, useState } from 'react';
import { Image } from 'react-konva';
import { getHullWatermarkLayout, HULL_WATERMARK_SRC } from '../../lib/hullWatermark';

interface HullWatermarkViewProps {
  canvasWidth: number;
  canvasHeight: number;
}

export function HullWatermarkView({ canvasWidth, canvasHeight }: HullWatermarkViewProps) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    const img = new window.Image();
    img.onload = () => setImage(img);
    img.src = HULL_WATERMARK_SRC;
  }, []);

  if (!image) return null;

  const { x, y, width, height, opacity } = getHullWatermarkLayout(canvasWidth, canvasHeight);

  return (
    <Image
      image={image}
      x={x}
      y={y}
      width={width}
      height={height}
      opacity={opacity}
      listening={false}
      perfectDrawEnabled={false}
    />
  );
}
