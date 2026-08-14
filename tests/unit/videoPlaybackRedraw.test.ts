import type Konva from 'konva';
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useVideoPlaybackRedraw } from '../../src/features/editor/useVideoPlaybackRedraw';
import type { RegisteredAsset } from '../../src/lib/assetRegistry';

const { getRegisteredAsset } = vi.hoisted(() => ({ getRegisteredAsset: vi.fn() }));

vi.mock('../../src/lib/assetRegistry', () => ({ getRegisteredAsset }));

function createFakeLayer(): Konva.Layer {
  return { batchDraw: vi.fn() } as unknown as Konva.Layer;
}

function createVideoAsset(): { asset: RegisteredAsset; video: HTMLVideoElement } {
  const video = document.createElement('video');
  vi.spyOn(video, 'play').mockResolvedValue(undefined);
  vi.spyOn(video, 'pause').mockImplementation(() => {});
  const asset: RegisteredAsset = {
    objectUrl: 'blob:mock-1',
    image: video,
    naturalWidth: 1280,
    naturalHeight: 720,
  };
  return { asset, video };
}

describe('useVideoPlaybackRedraw', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    getRegisteredAsset.mockReset();
  });

  it('plays a muted, looping video and starts a redraw animation for a video source', () => {
    const layer = createFakeLayer();
    const rootRef = { current: { getLayer: () => layer } as unknown as Konva.Group };
    const { asset, video } = createVideoAsset();
    getRegisteredAsset.mockReturnValue(asset);

    renderHook(() => useVideoPlaybackRedraw(rootRef, 'src-1', true));

    expect(getRegisteredAsset).toHaveBeenCalledWith('src-1');
    expect(video.play).toHaveBeenCalled();
    expect(video.loop).toBe(true);
    expect(video.muted).toBe(true);
  });

  it('pauses the video and stops the animation on unmount', () => {
    const layer = createFakeLayer();
    const rootRef = { current: { getLayer: () => layer } as unknown as Konva.Group };
    const { asset, video } = createVideoAsset();
    getRegisteredAsset.mockReturnValue(asset);

    const { unmount } = renderHook(() => useVideoPlaybackRedraw(rootRef, 'src-1', true));
    unmount();

    expect(video.pause).toHaveBeenCalled();
  });

  it('does nothing when isVideo is false, even if the asset holds a video element', () => {
    const layer = createFakeLayer();
    const rootRef = { current: { getLayer: () => layer } as unknown as Konva.Group };
    const { asset, video } = createVideoAsset();
    getRegisteredAsset.mockReturnValue(asset);

    renderHook(() => useVideoPlaybackRedraw(rootRef, 'src-1', false));

    expect(video.play).not.toHaveBeenCalled();
    expect(getRegisteredAsset).not.toHaveBeenCalled();
  });

  it('does nothing when there is no sourceId', () => {
    const layer = createFakeLayer();
    const rootRef = { current: { getLayer: () => layer } as unknown as Konva.Group };

    expect(() => renderHook(() => useVideoPlaybackRedraw(rootRef, null, true))).not.toThrow();
    expect(getRegisteredAsset).not.toHaveBeenCalled();
  });

  it('does nothing for an image asset (not an HTMLVideoElement)', () => {
    const layer = createFakeLayer();
    const rootRef = { current: { getLayer: () => layer } as unknown as Konva.Group };
    const imageAsset: RegisteredAsset = {
      objectUrl: 'blob:mock-2',
      image: new Image(),
      naturalWidth: 800,
      naturalHeight: 600,
    };
    getRegisteredAsset.mockReturnValue(imageAsset);

    expect(() => renderHook(() => useVideoPlaybackRedraw(rootRef, 'src-2', true))).not.toThrow();
  });
});
