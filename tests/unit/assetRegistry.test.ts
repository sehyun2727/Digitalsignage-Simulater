import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getRegisteredAsset,
  registerAsset,
  registerVideoAsset,
  sweepUnusedAssets,
} from '../../src/lib/assetRegistry';

class SucceedingMockImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = 800;
  naturalHeight = 600;
  set src(_value: string) {
    queueMicrotask(() => this.onload?.());
  }
}

class FailingMockImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  set src(_value: string) {
    queueMicrotask(() => this.onerror?.());
  }
}

function createFile(name = 'photo.png'): File {
  return new File([new Uint8Array([1, 2, 3])], name, { type: 'image/png' });
}

class SucceedingMockVideo {
  onloadedmetadata: (() => void) | null = null;
  onerror: (() => void) | null = null;
  videoWidth = 1280;
  videoHeight = 720;
  muted = false;
  playsInline = false;
  preload = '';
  set src(_value: string) {
    queueMicrotask(() => this.onloadedmetadata?.());
  }
}

class FailingMockVideo {
  onloadedmetadata: (() => void) | null = null;
  onerror: (() => void) | null = null;
  muted = false;
  playsInline = false;
  preload = '';
  set src(_value: string) {
    queueMicrotask(() => this.onerror?.());
  }
}

function createVideoFile(name = 'clip.mp4'): File {
  return new File([new Uint8Array([1, 2, 3])], name, { type: 'video/mp4' });
}

function stubVideoElement(MockVideo: new () => unknown) {
  const originalCreateElement = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation((tagName: string, options?: unknown) => {
    if (tagName === 'video') return new MockVideo() as HTMLVideoElement;
    return originalCreateElement(tagName, options as ElementCreationOptions);
  });
}

describe('assetRegistry', () => {
  let objectUrlCounter = 0;

  beforeEach(() => {
    objectUrlCounter = 0;
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:mock-${++objectUrlCounter}`);
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.stubGlobal('Image', SucceedingMockImage as unknown as typeof Image);
  });

  afterEach(() => {
    sweepUnusedAssets(new Set());
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('registers a decodable image and makes it retrievable by sourceId', async () => {
    const asset = await registerAsset(createFile());

    expect(asset.naturalWidth).toBe(800);
    expect(asset.naturalHeight).toBe(600);
    expect(getRegisteredAsset(asset.sourceId)).toMatchObject({
      naturalWidth: 800,
      naturalHeight: 600,
      objectUrl: 'blob:mock-1',
    });
  });

  it('rejects and revokes the object URL when the image fails to decode', async () => {
    vi.stubGlobal('Image', FailingMockImage as unknown as typeof Image);
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL');

    await expect(registerAsset(createFile())).rejects.toThrow();
    expect(revokeSpy).toHaveBeenCalledWith('blob:mock-1');
  });

  it('sweepUnusedAssets revokes and drops assets whose sourceId is not in the used set', async () => {
    const asset = await registerAsset(createFile());
    const objectUrl = getRegisteredAsset(asset.sourceId)?.objectUrl;
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL');

    sweepUnusedAssets(new Set());

    expect(revokeSpy).toHaveBeenCalledWith(objectUrl);
    expect(getRegisteredAsset(asset.sourceId)).toBeUndefined();
  });

  it('sweepUnusedAssets keeps assets whose sourceId is in the used set', async () => {
    const asset = await registerAsset(createFile());
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL');

    sweepUnusedAssets(new Set([asset.sourceId]));

    expect(revokeSpy).not.toHaveBeenCalled();
    expect(getRegisteredAsset(asset.sourceId)).toBeDefined();
  });

  it('registers a decodable video and makes it retrievable by sourceId', async () => {
    stubVideoElement(SucceedingMockVideo);

    const asset = await registerVideoAsset(createVideoFile());

    expect(asset.naturalWidth).toBe(1280);
    expect(asset.naturalHeight).toBe(720);
    const registered = getRegisteredAsset(asset.sourceId);
    expect(registered).toMatchObject({
      naturalWidth: 1280,
      naturalHeight: 720,
      objectUrl: 'blob:mock-1',
    });
    expect(registered?.image).toBeInstanceOf(SucceedingMockVideo);
  });

  it('rejects and revokes the object URL when the video fails to decode', async () => {
    stubVideoElement(FailingMockVideo);
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL');

    await expect(registerVideoAsset(createVideoFile())).rejects.toThrow();
    expect(revokeSpy).toHaveBeenCalledWith('blob:mock-1');
  });

  it('sweepUnusedAssets also revokes and drops unreachable video assets', async () => {
    stubVideoElement(SucceedingMockVideo);
    const asset = await registerVideoAsset(createVideoFile());
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL');

    sweepUnusedAssets(new Set());

    expect(revokeSpy).toHaveBeenCalledWith('blob:mock-1');
    expect(getRegisteredAsset(asset.sourceId)).toBeUndefined();
  });
});
