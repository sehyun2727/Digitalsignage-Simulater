import { useEffect, useState } from 'react';
import { getRegisteredAsset } from '../../lib/assetRegistry';
import { sampleMeanLuminance } from '../../lib/contentLuminance';

/**
 * Minimum time between luminance readbacks, in ms. `requestVideoFrameCallback` fires on every
 * decoded frame (up to the video's own frame rate, commonly 30-60/s); sampling a canvas readback
 * that often would reintroduce the per-frame decode cost ADR 0009 originally avoided by not
 * sampling video at all. Glow only needs to track roughly how bright the video is right now, so
 * throttling to ~6 samples/second keeps the effect visibly responsive to scene changes (a cut to
 * a bright shot, a fade to black) without paying for every rendered frame.
 */
const SAMPLE_INTERVAL_MS = 150;

/**
 * Live mean luminance (0-1) of a playing video's current frame, used to scale glow the same way
 * `sampleMeanLuminance` already does for static image content (see `glowLuminanceFactor`). Ties
 * sampling to `HTMLVideoElement.requestVideoFrameCallback` where available, so a readback only
 * happens once an actual new decoded frame exists rather than on a blind timer; browsers without
 * it (older Firefox) fall back to a plain interval. Either way, sampling is throttled to
 * `SAMPLE_INTERVAL_MS` — see that constant's comment for why. Returns `null` while disabled, or
 * before the first sample lands, matching `sampleMeanLuminance`'s existing "no sample yet"
 * contract so `glowLuminanceFactor(null) === 1` (unscaled) is the safe default in both cases.
 */
/** A sample tagged with the sourceId it was read from, so a stale value from a just-disabled or
 *  just-swapped source is never returned (mirrors `useHtmlImage`'s `loadedSrc === src` guard) —
 *  this also lets "not enabled" simply fall out of the return expression below instead of the
 *  effect needing to call setState synchronously on its own early-return path. */
interface Sample {
  sourceId: string;
  value: number | null;
}

export function useVideoLuminance(sourceId: string | null, enabled: boolean): number | null {
  const [sample, setSample] = useState<Sample | null>(null);

  useEffect(() => {
    if (!enabled || !sourceId) return;
    const video = getRegisteredAsset(sourceId)?.image;
    if (!(video instanceof HTMLVideoElement)) return;

    let cancelled = false;
    const takeSample = () => {
      if (!cancelled) setSample({ sourceId, value: sampleMeanLuminance(video) });
    };

    if (typeof video.requestVideoFrameCallback === 'function') {
      let lastSampleTime = 0;
      let handle: number;
      const onFrame: VideoFrameRequestCallback = (now) => {
        if (cancelled) return;
        if (now - lastSampleTime >= SAMPLE_INTERVAL_MS) {
          lastSampleTime = now;
          takeSample();
        }
        handle = video.requestVideoFrameCallback(onFrame);
      };
      handle = video.requestVideoFrameCallback(onFrame);
      return () => {
        cancelled = true;
        video.cancelVideoFrameCallback(handle);
      };
    }

    const intervalId = setInterval(takeSample, SAMPLE_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [sourceId, enabled]);

  return enabled && sample?.sourceId === sourceId ? sample.value : null;
}
