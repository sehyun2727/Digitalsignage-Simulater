import { useEffect, useState } from 'react';

export function useHtmlImage(src: string | null): HTMLImageElement | null {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!src) return;
    const element = new Image();
    element.onload = () => {
      setImage(element);
      setLoadedSrc(src);
    };
    element.src = src;
    return () => {
      element.onload = null;
    };
  }, [src]);

  return loadedSrc === src ? image : null;
}
