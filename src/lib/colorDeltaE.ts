/**
 * CIE76 ΔE between two sRGB 8-bit colours. Formula:
 *
 *   1. Linearise sRGB (gamma 2.4 above 0.04045, else /12.92).
 *   2. Linear sRGB → CIE XYZ via the D65 reference primaries.
 *   3. XYZ → CIE L*a*b* with reference white D65 (Xn, Yn, Zn).
 *   4. ΔE_76 = sqrt((L1−L2)² + (a1−a2)² + (b1−b2)²).
 *
 * We use CIE76 instead of CIEDE2000 because the audit threshold for X1 is **ΔE ≤ 10**,
 * which is well above the perceptual breakeven between the two formulas (~1 JND unit
 * each). CIE76 is simpler, is cheap to run inside a tight PNG scan loop, and matches
 * the "straight Euclidean distance in Lab space" baseline the K1 gate was written
 * against.
 *
 * Unit test: `tests/unit/colorDeltaE.test.ts` locks in reference numbers against
 * hand-computed values for black/white/red/green/blue/#FF00FF so a drift in the
 * formula is caught at CI time.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface Lab {
  L: number;
  a: number;
  b: number;
}

function srgbToLinear(c: number): number {
  const x = c / 255;
  return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
}

/** D65 reference white used by the sRGB working space, scaled so Y=1 at full white. */
const Xn = 0.95047;
const Yn = 1.0;
const Zn = 1.08883;

function labF(t: number): number {
  const delta = 6 / 29;
  return t > delta * delta * delta ? Math.cbrt(t) : t / (3 * delta * delta) + 4 / 29;
}

/** Convert 8-bit sRGB to CIE L*a*b* under D65. */
export function rgbToLab(rgb: Rgb): Lab {
  const R = srgbToLinear(rgb.r);
  const G = srgbToLinear(rgb.g);
  const B = srgbToLinear(rgb.b);
  // sRGB → XYZ (D65) using the standard 3×3 matrix (ITU-R BT.709 primaries).
  const X = R * 0.4124564 + G * 0.3575761 + B * 0.1804375;
  const Y = R * 0.2126729 + G * 0.7151522 + B * 0.072175;
  const Z = R * 0.0193339 + G * 0.119192 + B * 0.9503041;
  const fx = labF(X / Xn);
  const fy = labF(Y / Yn);
  const fz = labF(Z / Zn);
  return {
    L: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

/** CIE76 ΔE between two 8-bit sRGB colours. */
export function deltaE76(a: Rgb, b: Rgb): number {
  const la = rgbToLab(a);
  const lb = rgbToLab(b);
  const dL = la.L - lb.L;
  const da = la.a - lb.a;
  const db = la.b - lb.b;
  return Math.sqrt(dL * dL + da * da + db * db);
}

/** True if `candidate` is within `threshold` ΔE76 of `target`. */
export function withinDeltaE(target: Rgb, candidate: Rgb, threshold: number): boolean {
  return deltaE76(target, candidate) <= threshold;
}
