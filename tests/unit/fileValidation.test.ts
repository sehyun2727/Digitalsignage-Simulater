import { describe, expect, it } from 'vitest';
import {
  MAX_IMAGE_BYTES,
  MAX_IMAGE_LONG_EDGE,
  MAX_IMAGE_PIXELS,
  validateImageDimensions,
  validateImageFile,
} from '../../src/lib/fileValidation';

function createFile(type: string, size: number): File {
  const file = new File([new Uint8Array(size)], 'image', { type });
  return file;
}

describe('validateImageFile', () => {
  it('accepts a PNG within the size limit', () => {
    expect(validateImageFile(createFile('image/png', 1024))).toBeNull();
  });

  it('accepts JPEG and WebP', () => {
    expect(validateImageFile(createFile('image/jpeg', 1024))).toBeNull();
    expect(validateImageFile(createFile('image/webp', 1024))).toBeNull();
  });

  it('rejects unsupported file types', () => {
    expect(validateImageFile(createFile('image/svg+xml', 1024))).toBe('unsupported-type');
    expect(validateImageFile(createFile('application/pdf', 1024))).toBe('unsupported-type');
  });

  it('rejects a file with an empty or missing MIME type', () => {
    expect(validateImageFile(createFile('', 1024))).toBe('unsupported-type');
  });

  it('rejects files larger than the size limit', () => {
    expect(validateImageFile(createFile('image/png', MAX_IMAGE_BYTES + 1))).toBe('too-large');
  });

  it('accepts a file exactly at the size limit', () => {
    expect(validateImageFile(createFile('image/png', MAX_IMAGE_BYTES))).toBeNull();
  });
});

describe('validateImageDimensions', () => {
  it('accepts dimensions within both the long-edge and pixel-count limits', () => {
    expect(validateImageDimensions(1920, 1080)).toBeNull();
  });

  it('accepts dimensions exactly at the long-edge limit', () => {
    expect(validateImageDimensions(MAX_IMAGE_LONG_EDGE, 100)).toBeNull();
    expect(validateImageDimensions(100, MAX_IMAGE_LONG_EDGE)).toBeNull();
  });

  it('rejects a width beyond the long-edge limit', () => {
    expect(validateImageDimensions(MAX_IMAGE_LONG_EDGE + 1, 100)).toBe('dimensions-too-large');
  });

  it('rejects a height beyond the long-edge limit', () => {
    expect(validateImageDimensions(100, MAX_IMAGE_LONG_EDGE + 1)).toBe('dimensions-too-large');
  });

  it('rejects dimensions under the long-edge limit but over the total pixel-count limit', () => {
    const side = Math.ceil(Math.sqrt(MAX_IMAGE_PIXELS)) + 1;
    expect(side).toBeLessThan(MAX_IMAGE_LONG_EDGE);
    expect(validateImageDimensions(side, side)).toBe('dimensions-too-large');
  });
});
