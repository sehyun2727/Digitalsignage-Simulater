import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PORTABLE_TEMPLATE_VIEW,
  getDefaultPortableSize,
  getPortableScreenRect,
  PORTABLE_PRESET_SCREEN_QUADS,
  PORTABLE_TEMPLATE_ASPECT,
  PORTABLE_TEMPLATE_VIEWS,
  type PortableTemplateView,
} from '../../src/lib/portableTemplate';
import {
  applyHomography,
  buildQuadMesh,
  computeQuadHomography,
  isQuadValid,
  quadsEqual,
} from '../../src/lib/quadGeometry';

/**
 * The photo-based portable template exposes 3 named views and a screen rect per view. These
 * tests pin down the contract that the toolbar selector, `PortableTemplateBody`, and callers
 * of `getPortableScreenRect` (`ScreenComposition`, `screenHitTest`) all consume:
 *   • Every view returns a non-empty screen rect that stays inside its bounding box.
 *   • `angled-left` and `angled-right` are horizontal mirrors of each other.
 *   • Every preset screen quad is geometrically valid (convex, non-self-intersecting, within 0-1).
 *   • The perspective mapping from unit-square corners to quad corners round-trips correctly.
 */

// ---------------------------------------------------------------------------
// A. Preset data validation
// ---------------------------------------------------------------------------

describe('portableTemplate — view catalog', () => {
  it('lists the three named views', () => {
    expect(PORTABLE_TEMPLATE_VIEWS).toEqual(['angled-left', 'front', 'angled-right']);
  });

  it('defaults to the right-angled 3/4 view that matches the reference photography', () => {
    expect(DEFAULT_PORTABLE_TEMPLATE_VIEW).toBe('angled-right');
  });

  it('has an aspect ratio matching the bundled 1024x1536 source PNGs', () => {
    expect(PORTABLE_TEMPLATE_ASPECT).toBeCloseTo(1024 / 1536, 6);
  });
});

describe('portableTemplate — preset screen quads: data validity', () => {
  it('PORTABLE_PRESET_SCREEN_QUADS has an entry for every view in PORTABLE_TEMPLATE_VIEWS', () => {
    for (const view of PORTABLE_TEMPLATE_VIEWS) {
      expect(PORTABLE_PRESET_SCREEN_QUADS).toHaveProperty(view);
    }
    // No extra keys beyond the known views.
    expect(Object.keys(PORTABLE_PRESET_SCREEN_QUADS)).toHaveLength(PORTABLE_TEMPLATE_VIEWS.length);
  });

  it.each(PORTABLE_TEMPLATE_VIEWS as PortableTemplateView[])(
    '%s quad: all corner coordinates are within [0, 1]',
    (view) => {
      const quad = PORTABLE_PRESET_SCREEN_QUADS[view];
      for (const corner of ['topLeft', 'topRight', 'bottomRight', 'bottomLeft'] as const) {
        expect(quad[corner].x).toBeGreaterThanOrEqual(0);
        expect(quad[corner].x).toBeLessThanOrEqual(1);
        expect(quad[corner].y).toBeGreaterThanOrEqual(0);
        expect(quad[corner].y).toBeLessThanOrEqual(1);
      }
    },
  );

  it.each(PORTABLE_TEMPLATE_VIEWS as PortableTemplateView[])(
    '%s quad passes isQuadValid (convex, non-self-intersecting, min area, min edge)',
    (view) => {
      const quad = PORTABLE_PRESET_SCREEN_QUADS[view];
      expect(isQuadValid(quad)).toBe(true);
    },
  );

  it('the three preset quads are all distinct (not identical to each other)', () => {
    const [angledLeft, front, angledRight] = PORTABLE_TEMPLATE_VIEWS.map(
      (v) => PORTABLE_PRESET_SCREEN_QUADS[v],
    ) as [
      (typeof PORTABLE_PRESET_SCREEN_QUADS)['angled-left'],
      (typeof PORTABLE_PRESET_SCREEN_QUADS)['front'],
      (typeof PORTABLE_PRESET_SCREEN_QUADS)['angled-right'],
    ];
    expect(quadsEqual(angledLeft, front)).toBe(false);
    expect(quadsEqual(angledLeft, angledRight)).toBe(false);
    expect(quadsEqual(front, angledRight)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// B. Perspective mapping: unit-square corners → quad corners via homography
// ---------------------------------------------------------------------------

describe('portableTemplate — perspective mapping (homography round-trip)', () => {
  /**
   * The homography maps the unit square (0,0)-(1,0)-(1,1)-(0,1) onto the quad's four corners.
   * So applyHomography(H, (0,0)) = topLeft, applyHomography(H, (1,0)) = topRight, etc.
   * Verify all four corners for each preset quad.
   */
  it.each(PORTABLE_TEMPLATE_VIEWS as PortableTemplateView[])(
    '%s quad: homography maps unit-square corners onto the quad corners',
    (view) => {
      const quad = PORTABLE_PRESET_SCREEN_QUADS[view];
      const H = computeQuadHomography(quad);
      expect(H).not.toBeNull();
      if (!H) return;

      const tol = 1e-6;
      const mapped = {
        topLeft: applyHomography(H, { x: 0, y: 0 }),
        topRight: applyHomography(H, { x: 1, y: 0 }),
        bottomRight: applyHomography(H, { x: 1, y: 1 }),
        bottomLeft: applyHomography(H, { x: 0, y: 1 }),
      };

      expect(mapped.topLeft.x).toBeCloseTo(quad.topLeft.x, Math.abs(Math.log10(tol)));
      expect(mapped.topLeft.y).toBeCloseTo(quad.topLeft.y, Math.abs(Math.log10(tol)));
      expect(mapped.topRight.x).toBeCloseTo(quad.topRight.x, Math.abs(Math.log10(tol)));
      expect(mapped.topRight.y).toBeCloseTo(quad.topRight.y, Math.abs(Math.log10(tol)));
      expect(mapped.bottomRight.x).toBeCloseTo(quad.bottomRight.x, Math.abs(Math.log10(tol)));
      expect(mapped.bottomRight.y).toBeCloseTo(quad.bottomRight.y, Math.abs(Math.log10(tol)));
      expect(mapped.bottomLeft.x).toBeCloseTo(quad.bottomLeft.x, Math.abs(Math.log10(tol)));
      expect(mapped.bottomLeft.y).toBeCloseTo(quad.bottomLeft.y, Math.abs(Math.log10(tol)));
    },
  );

  it.each(PORTABLE_TEMPLATE_VIEWS as PortableTemplateView[])(
    '%s quad: buildQuadMesh produces non-null mesh with positive-area cells',
    (view) => {
      const quad = PORTABLE_PRESET_SCREEN_QUADS[view];
      const mesh = buildQuadMesh(quad, 4);
      expect(mesh).not.toBeNull();
      expect(mesh!.length).toBe(16); // 4x4 subdivisions
      // Every destination cell should have finite coordinates (no NaN from degenerate homography).
      for (const cell of mesh!) {
        for (const pt of cell.dst) {
          expect(Number.isFinite(pt.x)).toBe(true);
          expect(Number.isFinite(pt.y)).toBe(true);
        }
      }
    },
  );

  it('angled-left and angled-right are near-mirrors (x → 1-x) within sub-pixel tolerance', () => {
    // v2-release R1 (D10): angled-right preset was switched from "exact mirror of angled-left"
    // to the directly-measured docodemo-right quad. The two remain near-mirrors (same photo
    // shot) but differ by sub-pixel amounts per corner — angled-right now matches the fixture
    // `e2e/fixtures/portable-screen-quads.json` exactly, which drives K1 pixel verification.
    // PortableTemplateBody.useAssetImage caches angled-right's hole separately in source
    // space (mirror of measured) so the body-hole and content-warp still line up.
    const left = PORTABLE_PRESET_SCREEN_QUADS['angled-left'];
    const right = PORTABLE_PRESET_SCREEN_QUADS['angled-right'];
    // Tolerance: 1 % of normalized coord = ~3 px at 300 px object width; actual
    // asymmetry is ~0.00077 normalized (~0.25 px). This test guards against the
    // quad becoming grossly different (e.g. if someone accidentally edits one corner).
    const TOL = 0.01;

    expect(Math.abs(right.topLeft.x - (1 - left.topRight.x))).toBeLessThan(TOL);
    expect(Math.abs(right.topLeft.y - left.topRight.y)).toBeLessThan(TOL);

    expect(Math.abs(right.topRight.x - (1 - left.topLeft.x))).toBeLessThan(TOL);
    expect(Math.abs(right.topRight.y - left.topLeft.y)).toBeLessThan(TOL);

    expect(Math.abs(right.bottomRight.x - (1 - left.bottomLeft.x))).toBeLessThan(TOL);
    expect(Math.abs(right.bottomRight.y - left.bottomLeft.y)).toBeLessThan(TOL);

    expect(Math.abs(right.bottomLeft.x - (1 - left.bottomRight.x))).toBeLessThan(TOL);
    expect(Math.abs(right.bottomLeft.y - left.bottomRight.y)).toBeLessThan(TOL);
  });

  it('front quad is approximately symmetric around x = 0.5 (left/right bezel balance)', () => {
    const front = PORTABLE_PRESET_SCREEN_QUADS['front'];
    // Left edge x ≈ 1 - right edge x (mirrored), within 2% of object width for real-photo tolerance.
    const leftX = (front.topLeft.x + front.bottomLeft.x) / 2;
    const rightX = (front.topRight.x + front.bottomRight.x) / 2;
    expect(Math.abs(leftX - (1 - rightX))).toBeLessThan(0.02);
  });
});

// ---------------------------------------------------------------------------
// C. getPortableScreenRect — axis-aligned backdrop rects
// ---------------------------------------------------------------------------

describe('portableTemplate — screen rects', () => {
  const OBJECT_WIDTH = 300;
  const OBJECT_HEIGHT = OBJECT_WIDTH / PORTABLE_TEMPLATE_ASPECT;

  it('returns a non-empty rect inside the object bounds for every view', () => {
    for (const view of PORTABLE_TEMPLATE_VIEWS) {
      const rect = getPortableScreenRect(view, OBJECT_WIDTH, OBJECT_HEIGHT);
      expect(rect.width).toBeGreaterThan(0);
      expect(rect.height).toBeGreaterThan(0);
      expect(rect.x).toBeGreaterThanOrEqual(0);
      expect(rect.y).toBeGreaterThanOrEqual(0);
      expect(rect.x + rect.width).toBeLessThanOrEqual(OBJECT_WIDTH + 1e-6);
      expect(rect.y + rect.height).toBeLessThanOrEqual(OBJECT_HEIGHT + 1e-6);
    }
  });

  it('angled-left and angled-right rects are approximately mirrored horizontally (within 1 px)', () => {
    // v2-release R1 (D10): angled-right preset switched from "exact mirror of angled-left"
    // to the directly-measured quad from the actual docodemo-right asset. The two quads
    // remain near-mirrors (same photo shot) but differ by sub-pixel amounts (<1 px per
    // corner at a 300 px-wide object), which is why the exact-equality assertion is
    // relaxed to a 1 px tolerance here. Width/height/y stay very close; the mirror-x
    // identity holds to within the same tolerance.
    const leftRect = getPortableScreenRect('angled-left', OBJECT_WIDTH, OBJECT_HEIGHT);
    const rightRect = getPortableScreenRect('angled-right', OBJECT_WIDTH, OBJECT_HEIGHT);
    const PX_TOLERANCE = 1;
    expect(Math.abs(leftRect.width - rightRect.width)).toBeLessThan(PX_TOLERANCE);
    expect(Math.abs(leftRect.height - rightRect.height)).toBeLessThan(PX_TOLERANCE);
    expect(Math.abs(leftRect.y - rightRect.y)).toBeLessThan(PX_TOLERANCE);
    // Horizontal mirror around x = OBJECT_WIDTH / 2 (approx).
    expect(Math.abs(leftRect.x + leftRect.width - (OBJECT_WIDTH - rightRect.x))).toBeLessThan(
      PX_TOLERANCE,
    );
  });

  it('front view screen rect is approximately horizontally centered inside the object', () => {
    const rect = getPortableScreenRect('front', OBJECT_WIDTH, OBJECT_HEIGHT);
    const leftGap = rect.x;
    const rightGap = OBJECT_WIDTH - (rect.x + rect.width);
    expect(Math.abs(leftGap - rightGap)).toBeLessThan(OBJECT_WIDTH * 0.02);
  });

  it('scales proportionally with object size', () => {
    const bigWidth = 600;
    const bigHeight = bigWidth / PORTABLE_TEMPLATE_ASPECT;
    for (const view of PORTABLE_TEMPLATE_VIEWS) {
      const small = getPortableScreenRect(view, OBJECT_WIDTH, OBJECT_HEIGHT);
      const big = getPortableScreenRect(view, bigWidth, bigHeight);
      // Doubling object size doubles every rect dimension.
      expect(big.width).toBeCloseTo(small.width * 2, 6);
      expect(big.height).toBeCloseTo(small.height * 2, 6);
      expect(big.x).toBeCloseTo(small.x * 2, 6);
      expect(big.y).toBeCloseTo(small.y * 2, 6);
    }
  });

  // Single-source-of-truth invariant: the axis-aligned rect returned by
  // getPortableScreenRect (consumed by ScreenComposition and screenHitTest) must be
  // exactly the axis-aligned bounding box of PORTABLE_PRESET_SCREEN_QUADS[view]
  // (consumed by WarpedScreenContent and PortableTemplateBody.clearScreenArea). If
  // these ever drift, the dark backdrop / hit-test area and the perspective-warped
  // content will show at different positions and the seams reappear.
  it.each(PORTABLE_TEMPLATE_VIEWS as PortableTemplateView[])(
    '%s: getPortableScreenRect matches the axis-aligned bbox of PORTABLE_PRESET_SCREEN_QUADS',
    (view) => {
      const quad = PORTABLE_PRESET_SCREEN_QUADS[view];
      const xs = [quad.topLeft.x, quad.topRight.x, quad.bottomRight.x, quad.bottomLeft.x];
      const ys = [quad.topLeft.y, quad.topRight.y, quad.bottomRight.y, quad.bottomLeft.y];
      const expectedX = Math.min(...xs) * OBJECT_WIDTH;
      const expectedY = Math.min(...ys) * OBJECT_HEIGHT;
      const expectedWidth = (Math.max(...xs) - Math.min(...xs)) * OBJECT_WIDTH;
      const expectedHeight = (Math.max(...ys) - Math.min(...ys)) * OBJECT_HEIGHT;
      const rect = getPortableScreenRect(view, OBJECT_WIDTH, OBJECT_HEIGHT);
      expect(rect.x).toBeCloseTo(expectedX, 6);
      expect(rect.y).toBeCloseTo(expectedY, 6);
      expect(rect.width).toBeCloseTo(expectedWidth, 6);
      expect(rect.height).toBeCloseTo(expectedHeight, 6);
    },
  );
});

// ---------------------------------------------------------------------------
// D. getDefaultPortableSize
// ---------------------------------------------------------------------------

describe('portableTemplate — getDefaultPortableSize', () => {
  it('returns the correct aspect ratio (PORTABLE_TEMPLATE_ASPECT)', () => {
    const size = getDefaultPortableSize({ width: 1920, height: 1080 });
    expect(size.width / size.height).toBeCloseTo(PORTABLE_TEMPLATE_ASPECT, 6);
  });

  it('targets approximately 55% of canvas height', () => {
    const canvasHeight = 1080;
    const size = getDefaultPortableSize({ width: 1920, height: canvasHeight });
    // Not capped at 600px for a 1080px canvas (0.55 * 1080 = 594 < 600).
    expect(size.height).toBeCloseTo(canvasHeight * 0.55, 1);
  });

  it('caps height at 600px for very tall canvases', () => {
    const size = getDefaultPortableSize({ width: 2000, height: 2000 });
    expect(size.height).toBe(600);
  });

  it('produces consistent width/height for a standard 16:9 canvas', () => {
    const size = getDefaultPortableSize({ width: 1920, height: 1080 });
    expect(size.height).toBeGreaterThan(0);
    expect(size.width).toBeGreaterThan(0);
    // Width is derived from height, so the object is always narrower than a 16:9 canvas.
    expect(size.width).toBeLessThan(1920);
  });
});
