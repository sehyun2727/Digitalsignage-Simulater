import Konva from 'konva';

/**
 * Re-applies whatever cache a node already has (contrast filter from ScreenComposition's
 * ContrastGroup, or blur filter from ContactShadowView) at a different `pixelRatio`, leaving
 * untouched nodes alone. Konva bakes `.cache()` bitmaps at `devicePixelRatio` by default, which
 * is fixed regardless of the Stage's own `toDataURL` pixelRatio — so an export rendered far above
 * screen resolution (a large source photo shown small, per EditorCanvas's `exportPixelRatio`)
 * would otherwise reuse a low-resolution cached bitmap and look blurrier than the vector-rendered
 * content around it. Call with `pixelRatio` set immediately before a `toDataURL()` snapshot, then
 * call again with no `pixelRatio` (Konva's default) to restore normal interactive-editing cost.
 */
export function recacheAtPixelRatio(node: Konva.Group, pixelRatio?: number): void {
  if (!node.isCached()) return;

  const filters = node.filters() ?? [];
  if (filters.includes(Konva.Filters.Blur)) {
    // Mirrors ContactShadowView's explicit cache-rect padding so the blur doesn't clip at its edge.
    const blurRadius = node.blurRadius();
    const rect = node.getClientRect({ relativeTo: node });
    const pad = blurRadius * 2;
    node.cache({
      x: rect.x - pad,
      y: rect.y - pad,
      width: rect.width + pad * 2,
      height: rect.height + pad * 2,
      pixelRatio,
    });
  } else {
    node.cache({ pixelRatio });
  }
}

/**
 * Finds every cached descendant of `root` (see {@link recacheAtPixelRatio}). Both call sites in
 * this codebase (ScreenComposition's ContrastGroup, ContactShadowView) only ever cache a Group.
 */
export function findCachedNodes(root: Konva.Stage): Konva.Group[] {
  return root.find((node: Konva.Node) => node.isCached()) as Konva.Group[];
}
