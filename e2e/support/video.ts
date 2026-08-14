import type { Page } from '@playwright/test';

export interface GeneratedVideoOptions {
  width?: number;
  height?: number;
  durationMs?: number;
  color?: string;
}

/**
 * Generates a short, real, decodable WebM clip entirely in-browser (canvas.captureStream() +
 * MediaRecorder) — the video counterpart of solidColorPng.ts's image fixtures. No binary asset
 * needs to be checked into the repo, and the result is guaranteed playable by whatever Chromium
 * build actually runs the suite, since it was produced by that same browser's own encoder.
 */
export async function generateWebmVideo(
  page: Page,
  options: GeneratedVideoOptions = {},
): Promise<Buffer> {
  const { width = 320, height = 240, durationMs = 300, color = '#ff3366' } = options;
  const base64 = await page.evaluate(
    async ({ width, height, durationMs, color }) => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('2D context unavailable');
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, width, height);

      const mimeType = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find(
        (candidate) => MediaRecorder.isTypeSupported(candidate),
      );
      if (!mimeType) throw new Error('No supported video/webm mime type in this browser');

      const stream = canvas.captureStream(30);
      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      const stopped = new Promise<void>((resolve) => {
        recorder.onstop = () => resolve();
      });

      recorder.start();
      // Repaint on an interval so the encoded stream carries changing frames rather than one
      // static image, matching what a real signage video clip looks like.
      let toggle = false;
      const repaint = window.setInterval(() => {
        toggle = !toggle;
        ctx.fillStyle = toggle ? color : '#111111';
        ctx.fillRect(0, 0, width, height);
      }, 50);

      await new Promise((resolve) => window.setTimeout(resolve, durationMs));
      window.clearInterval(repaint);
      recorder.stop();
      stream.getTracks().forEach((track) => track.stop());
      await stopped;

      const blob = new Blob(chunks, { type: 'video/webm' });
      const buffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (const byte of bytes) binary += String.fromCharCode(byte);
      return btoa(binary);
    },
    { width, height, durationMs, color },
  );
  return Buffer.from(base64, 'base64');
}

/** Uploads a freshly generated WebM clip into the currently selected object's content field
 *  (the same 'コンテンツを追加' input solidColorPng-based specs use for image content). */
export async function addVideoContent(
  page: Page,
  options: GeneratedVideoOptions & { fileName?: string } = {},
): Promise<void> {
  const { fileName = 'clip.webm', ...videoOptions } = options;
  const video = await generateWebmVideo(page, videoOptions);
  await page
    .getByLabel('コンテンツを追加')
    .setInputFiles({ name: fileName, mimeType: 'video/webm', buffer: video });
}
