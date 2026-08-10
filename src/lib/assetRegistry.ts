import { createId } from './id';

export interface RegisteredAsset {
  objectUrl: string;
  image: HTMLImageElement;
  naturalWidth: number;
  naturalHeight: number;
}

/**
 * Decoded content/space-background images, keyed by sourceId. Kept outside of the
 * (serializable, undo/redo-able) Zustand document state on purpose: Blob URLs and
 * HTMLImageElements are not meaningful to snapshot/restore by value, and copying them into
 * every history entry would multiply decode/memory cost for no benefit. The editor store
 * only ever stores a `sourceId` string; components look the decoded asset up here.
 */
const registry = new Map<string, RegisteredAsset>();

function loadImage(objectUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    // A declared image/* MIME type does not guarantee decodable bytes (corrupted file,
    // spoofed type, etc.); surface that as a rejected promise instead of a stuck asset.
    image.onerror = () => reject(new Error('decode-error'));
    image.src = objectUrl;
  });
}

export async function registerAsset(
  file: File,
): Promise<{ sourceId: string; naturalWidth: number; naturalHeight: number }> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadImage(objectUrl);
    const sourceId = createId();
    registry.set(sourceId, {
      objectUrl,
      image,
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
    });
    return { sourceId, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}

export function getRegisteredAsset(sourceId: string): RegisteredAsset | undefined {
  return registry.get(sourceId);
}

/**
 * Revokes and drops any registered asset whose sourceId is not in `usedSourceIds`. Intended
 * to be called after every store mutation with the set of sourceIds still reachable from the
 * current document plus the full undo/redo history, so an asset survives exactly as long as
 * some reachable document snapshot could still reference it (see editorStore.ts).
 */
export function sweepUnusedAssets(usedSourceIds: ReadonlySet<string>): void {
  for (const [sourceId, asset] of registry) {
    if (!usedSourceIds.has(sourceId)) {
      URL.revokeObjectURL(asset.objectUrl);
      registry.delete(sourceId);
    }
  }
}
