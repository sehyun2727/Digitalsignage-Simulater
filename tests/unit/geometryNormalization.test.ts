import { describe, expect, it } from 'vitest';
import { normalizeObjectGeometry } from '../../src/lib/geometryNormalization';

describe('normalizeObjectGeometry', () => {
  it('preserves normalized center and size fractions when the document doubles in size', () => {
    // object center at (200,100) of a 1000x500 doc -> fraction (0.2, 0.2); size 200x100 -> 0.2x0.2.
    const object = { x: 100, y: 50, width: 200, height: 100 };
    const result = normalizeObjectGeometry(
      object,
      { width: 1000, height: 500 },
      { width: 2000, height: 1000 },
    );

    expect((result.x + result.width / 2) / 2000).toBeCloseTo(0.2);
    expect((result.y + result.height / 2) / 1000).toBeCloseTo(0.2);
    expect(result.width / 2000).toBeCloseTo(200 / 1000);
    expect(result.height / 1000).toBeCloseTo(100 / 500);
  });

  it('is a no-op when the document size is unchanged', () => {
    const object = { x: 30, y: 40, width: 120, height: 80 };
    const result = normalizeObjectGeometry(
      object,
      { width: 800, height: 600 },
      { width: 800, height: 600 },
    );

    expect(result.x).toBeCloseTo(30);
    expect(result.y).toBeCloseTo(40);
    expect(result.width).toBeCloseTo(120);
    expect(result.height).toBeCloseTo(80);
  });

  it('scales non-uniformly when width and height change by different factors', () => {
    const object = { x: 0, y: 0, width: 100, height: 100 };
    const result = normalizeObjectGeometry(
      object,
      { width: 100, height: 100 },
      { width: 400, height: 100 },
    );

    expect(result.width).toBeCloseTo(400);
    expect(result.height).toBeCloseTo(100);
  });

  it('returns the object unchanged when the old document size is zero or negative', () => {
    const object = { x: 10, y: 20, width: 30, height: 40 };

    expect(
      normalizeObjectGeometry(object, { width: 0, height: 100 }, { width: 200, height: 200 }),
    ).toBe(object);
    expect(
      normalizeObjectGeometry(object, { width: 100, height: -5 }, { width: 200, height: 200 }),
    ).toBe(object);
  });

  it('clamps the object so its center stays within the new document bounds', () => {
    // Object centered near the old document's right edge; shrinking the new document a lot
    // would otherwise push its center far outside [0, newWidth].
    const object = { x: 950, y: 0, width: 40, height: 40 };
    const result = normalizeObjectGeometry(
      object,
      { width: 1000, height: 1000 },
      { width: 50, height: 50 },
    );

    const centerX = result.x + result.width / 2;
    expect(centerX).toBeGreaterThanOrEqual(0);
    expect(centerX).toBeLessThanOrEqual(50);
  });

  it('keeps at least half the object reachable near the bounds for an oversized object', () => {
    // An object much wider than the new document should still have its right half reachable
    // (x itself may go negative, but not so negative the whole object leaves the canvas).
    const object = { x: 0, y: 0, width: 100, height: 100 };
    const result = normalizeObjectGeometry(
      object,
      { width: 100, height: 100 },
      { width: 20, height: 20 },
    );

    expect(result.x).toBeGreaterThanOrEqual(-result.width / 2);
    expect(result.x).toBeLessThanOrEqual(20 - result.width / 2);
  });
});
