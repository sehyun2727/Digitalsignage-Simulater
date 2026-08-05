import { describe, expect, it } from 'vitest';
import { MAX_IMAGE_BYTES, validateImageFile } from '../../src/lib/fileValidation';

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

  it('rejects files larger than the size limit', () => {
    expect(validateImageFile(createFile('image/png', MAX_IMAGE_BYTES + 1))).toBe('too-large');
  });

  it('accepts a file exactly at the size limit', () => {
    expect(validateImageFile(createFile('image/png', MAX_IMAGE_BYTES))).toBeNull();
  });
});
