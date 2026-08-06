import { describe, expect, it } from 'vitest';
import { buildExportFilename } from '../../src/lib/exportFilename';

describe('buildExportFilename', () => {
  it('builds a filename with template id and a timestamp', () => {
    const date = new Date(2026, 0, 5, 9, 8, 7);
    expect(buildExportFilename('wall-led', date)).toBe('signage-canvas_wall-led_20260105-090807.png');
  });

  it('pads single-digit date/time components', () => {
    const date = new Date(2026, 8, 1, 1, 2, 3);
    expect(buildExportFilename('stand-display', date)).toBe('signage-canvas_stand-display_20260901-010203.png');
  });

  it('never contains characters that are unsafe in file systems (colon, slash, etc.)', () => {
    const filename = buildExportFilename('wall-led', new Date(2026, 0, 5, 9, 8, 7));
    expect(filename).toMatch(/^[a-zA-Z0-9_.-]+$/);
    expect(filename).not.toContain(':');
  });
});
