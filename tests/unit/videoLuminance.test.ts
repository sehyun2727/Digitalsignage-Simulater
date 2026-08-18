import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useVideoLuminance } from '../../src/features/editor/useVideoLuminance';
import type { RegisteredAsset } from '../../src/lib/assetRegistry';

const { getRegisteredAsset } = vi.hoisted(() => ({ getRegisteredAsset: vi.fn() }));
const { sampleMeanLuminance } = vi.hoisted(() => ({ sampleMeanLuminance: vi.fn() }));

vi.mock('../../src/lib/assetRegistry', () => ({ getRegisteredAsset }));
vi.mock('../../src/lib/contentLuminance', () => ({ sampleMeanLuminance }));

const SAMPLE_INTERVAL_MS = 150;

function createVideoAsset(): { asset: RegisteredAsset; video: HTMLVideoElement } {
  const video = document.createElement('video');
  const asset: RegisteredAsset = {
    objectUrl: 'blob:mock-1',
    image: video,
    naturalWidth: 1280,
    naturalHeight: 720,
  };
  return { asset, video };
}

describe('useVideoLuminance', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    getRegisteredAsset.mockReset();
    sampleMeanLuminance.mockReset();
  });

  // jsdom's HTMLVideoElement has no requestVideoFrameCallback, so every test here exercises the
  // setInterval fallback path; the requestVideoFrameCallback path is covered separately below by
  // stubbing the method directly onto a video instance.

  it('returns null and samples nothing when disabled', () => {
    const { asset } = createVideoAsset();
    getRegisteredAsset.mockReturnValue(asset);

    const { result } = renderHook(() => useVideoLuminance('src-1', false));
    act(() => {
      vi.advanceTimersByTime(SAMPLE_INTERVAL_MS * 3);
    });

    expect(result.current).toBeNull();
    expect(sampleMeanLuminance).not.toHaveBeenCalled();
  });

  it('returns null when there is no sourceId', () => {
    const { result } = renderHook(() => useVideoLuminance(null, true));
    expect(result.current).toBeNull();
    expect(getRegisteredAsset).not.toHaveBeenCalled();
  });

  it('returns null for an image asset (not an HTMLVideoElement)', () => {
    getRegisteredAsset.mockReturnValue({
      objectUrl: 'blob:mock-2',
      image: new Image(),
      naturalWidth: 800,
      naturalHeight: 600,
    } satisfies RegisteredAsset);

    const { result } = renderHook(() => useVideoLuminance('src-2', true));
    act(() => {
      vi.advanceTimersByTime(SAMPLE_INTERVAL_MS * 3);
    });

    expect(result.current).toBeNull();
    expect(sampleMeanLuminance).not.toHaveBeenCalled();
  });

  it('samples on a throttled interval and returns the latest value', () => {
    const { asset } = createVideoAsset();
    getRegisteredAsset.mockReturnValue(asset);
    sampleMeanLuminance.mockReturnValue(0.42);

    const { result } = renderHook(() => useVideoLuminance('src-3', true));
    expect(result.current).toBeNull();

    act(() => {
      vi.advanceTimersByTime(SAMPLE_INTERVAL_MS);
    });
    expect(result.current).toBe(0.42);
    expect(sampleMeanLuminance).toHaveBeenCalledTimes(1);

    sampleMeanLuminance.mockReturnValue(0.9);
    act(() => {
      vi.advanceTimersByTime(SAMPLE_INTERVAL_MS);
    });
    expect(result.current).toBe(0.9);
    expect(sampleMeanLuminance).toHaveBeenCalledTimes(2);
  });

  it('discards a stale sample immediately when the sourceId changes', () => {
    const { asset } = createVideoAsset();
    getRegisteredAsset.mockReturnValue(asset);
    sampleMeanLuminance.mockReturnValue(0.7);

    const { result, rerender } = renderHook(
      ({ sourceId }: { sourceId: string }) => useVideoLuminance(sourceId, true),
      { initialProps: { sourceId: 'src-a' } },
    );
    act(() => {
      vi.advanceTimersByTime(SAMPLE_INTERVAL_MS);
    });
    expect(result.current).toBe(0.7);

    rerender({ sourceId: 'src-b' });
    expect(result.current).toBeNull();
  });

  it('stops sampling on unmount', () => {
    const { asset } = createVideoAsset();
    getRegisteredAsset.mockReturnValue(asset);
    sampleMeanLuminance.mockReturnValue(0.5);

    const { unmount } = renderHook(() => useVideoLuminance('src-4', true));
    act(() => {
      vi.advanceTimersByTime(SAMPLE_INTERVAL_MS);
    });
    expect(sampleMeanLuminance).toHaveBeenCalledTimes(1);

    unmount();
    act(() => {
      vi.advanceTimersByTime(SAMPLE_INTERVAL_MS * 5);
    });
    expect(sampleMeanLuminance).toHaveBeenCalledTimes(1);
  });

  it('prefers requestVideoFrameCallback when available, throttled to the same interval', () => {
    const { asset, video } = createVideoAsset();
    getRegisteredAsset.mockReturnValue(asset);
    sampleMeanLuminance.mockReturnValue(0.33);

    let frameCallback: VideoFrameRequestCallback | null = null;
    let nextHandle = 1;
    const cancel = vi.fn();
    video.requestVideoFrameCallback = vi.fn((callback: VideoFrameRequestCallback) => {
      frameCallback = callback;
      return nextHandle++;
    }) as HTMLVideoElement['requestVideoFrameCallback'];
    video.cancelVideoFrameCallback = cancel;

    const { result, unmount } = renderHook(() => useVideoLuminance('src-5', true));
    expect(video.requestVideoFrameCallback).toHaveBeenCalledTimes(1);

    // A frame arriving before the throttle interval elapses is skipped.
    act(() => {
      frameCallback?.(10, {} as VideoFrameCallbackMetadata);
    });
    expect(sampleMeanLuminance).not.toHaveBeenCalled();
    expect(result.current).toBeNull();

    // A frame arriving after the interval elapses triggers a sample.
    act(() => {
      frameCallback?.(SAMPLE_INTERVAL_MS + 1, {} as VideoFrameCallbackMetadata);
    });
    expect(sampleMeanLuminance).toHaveBeenCalledTimes(1);
    expect(result.current).toBe(0.33);

    unmount();
    expect(cancel).toHaveBeenCalled();
  });
});
