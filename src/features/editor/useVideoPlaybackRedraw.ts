import Konva from 'konva';
import { useEffect } from 'react';
import type { RefObject } from 'react';
import { getRegisteredAsset } from '../../lib/assetRegistry';

/**
 * While the screen's content is a video, Konva does not know the underlying HTMLVideoElement's
 * pixels are changing every frame — a KonvaImage only repaints when something tells its Layer
 * to redraw. This starts the video (muted/looped, matching a real signage screen's autoplay
 * loop) and drives the Layer with a Konva.Animation for as long as this screen shows video
 * content, stopping and pausing on cleanup so an off-screen/removed object doesn't keep
 * decoding frames. The asset is resolved from `sourceId` inside the effect (rather than taking
 * the resolved asset itself as a parameter) so mutating the video element's `loop`/`muted`
 * state isn't flagged as mutating a hook argument.
 */
export function useVideoPlaybackRedraw(
  rootRef: RefObject<Konva.Group | null>,
  sourceId: string | null,
  isVideo: boolean,
  /** When false, the video is paused and the Konva.Animation redraw loop is not started. Used to
   *  stop decoding/painting while the object is hidden (comparison mode, sales review), so an
   *  off-screen video doesn't keep costing frames of CPU. */
  active: boolean = true,
) {
  useEffect(() => {
    if (!isVideo || !sourceId || !active) return;
    const video = getRegisteredAsset(sourceId)?.image;
    if (!(video instanceof HTMLVideoElement)) return;
    const layer = rootRef.current?.getLayer();
    if (!layer) return;

    video.loop = true;
    video.muted = true;
    // play() returns a Promise that rejects if autoplay is blocked; there is no user-facing
    // action to take in that case (the editor has no visible "play" control), so the rejection
    // is deliberately swallowed rather than surfaced as an error.
    video.play().catch(() => {});

    const animation = new Konva.Animation(() => {}, layer);
    animation.start();
    return () => {
      animation.stop();
      video.pause();
    };
  }, [rootRef, sourceId, isVideo, active]);
}
