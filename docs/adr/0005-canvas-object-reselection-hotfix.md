# ADR 0005: Canvas object reselection hotfix (Sprint 3.2)

## Status

Accepted — Sprint 3.2.

## Context

Wall LED displays, Stand Displays, and custom portable products could not be
reselected by clicking their rendered shape once deselected. `CanvasObjectView.tsx`
renders these three kinds as a Konva `<Group>` carrying the shared
select/drag/transform props (`onClick`, `onTap`, `onDragStart`/`onDragEnd`,
`onTransformEnd`), while every descendant shape actually painted inside that Group
(frame decorations, the clipped screen-region background, content image, material
overlays) is `listening={false}` — deliberately, so none of them individually eats a
click meant for the object as a whole. The result was that **no descendant shape ever
participated in Konva's hit graph**, so a click landing anywhere on the object never
resolved to any listening node, and the Group's own `onClick`/`onTap` (attached via
`groupProps`) never fired. Text and image elements were unaffected because they render
as a single listening shape directly, with no wrapping Group.

This is a P0 hotfix: reselecting a placed object is required for editing it at all
after any deselection (clicking blank canvas, Undo/Redo, which both clear selection —
see `editorStore.ts`'s `undo`/`redo`).

## Decisions

- **Every Group-based object (`SignageDisplayView.tsx`, `PortableProductView.tsx`)
  gets an invisible `Rect` hit-area as the first child of its outer `<Group>`**, sized
  to the object's full `width`/`height`, with `fill="transparent"` and
  `listening={true}`. `fill="transparent"` (not an omitted `fill`) is required: Konva's
  default hit function skips painting a shape's hit-canvas region entirely when it has
  no fill at all, so an undefined fill is both invisible and unclickable, while a
  defined zero-alpha fill is invisible but still hit-tested across the shape's full
  bounds. Being the first child (not last) means every decorative shape still paints
  over it, and — since the hit-area itself never paints any pixels to the _scene_
  canvas, only the separate hit canvas — it never appears in exported PNGs
  (`e2e/reselection.spec.ts` verifies byte-identical exports before/after a
  reselection).
- **The hit target is always the object's full rectangular bounding box, never a
  product photo's actual alpha channel.** A portable product's user-uploaded photo may
  have transparent areas (`productHasAlpha`), but `PortableProductView`'s hit-area
  covers the whole object regardless — alpha-aware hit testing (clicking only where
  the photo is visually opaque) is explicitly out of scope for this sprint, matching
  `CLAUDE.md`'s "small, reviewable increments" principle. `tests/unit/canvasHitArea.test.tsx`
  documents this directly with a `productHasAlpha: true` fixture.
- **Dragging an object that is not yet selected now selects it at `onDragEnd`, not
  `onDragStart`.** Konva suppresses the `click`/`tap` event for an interaction that
  turns into a drag, so a drag-without-a-prior-click on an unselected object needed an
  explicit selection call somewhere in the drag lifecycle to keep "click selects" and
  "drag selects and moves" behaviorally consistent in one gesture. Selecting at drag
  _start_ was tried first and rejected: it changes `selectedId` in the Zustand store
  mid-gesture, which re-renders `CanvasObjectView` with the store's still-stale
  `object.x`/`object.y`, and react-konva's reconciler then re-applies those as
  controlled props onto the Konva node Konva is actively dragging — snapping its
  position back to where the drag started and discarding the in-progress move.
  Selecting at drag _end_, immediately before the position commit
  (`CanvasObjectView.tsx`'s `commonProps.onDragEnd`), avoids that mid-gesture
  re-render entirely.
- **Blank-canvas deselection (`EditorCanvas.tsx`'s `onMouseDown`/`onTouchStart`,
  `event.target === event.target.getStage()`) and Undo/Redo's unconditional
  `selectedId: null` (`editorStore.ts`) are both unchanged.** The hotfix only restores
  the _re_-selection path; it does not touch how or when selection is cleared.
- **No new layer/outline panel was added.** The reselection path relies entirely on
  clicking the object's own rendered area (now hit-testable end to end via the fix
  above); a separate always-visible list of objects to click instead was considered
  and rejected as out-of-scope scope creep for a hotfix.

## Consequences

- Any future Group-wrapped object kind must add the same first-child, full-bounds,
  `fill="transparent"`/`listening` hit-area `Rect`, or it will reintroduce this bug.
  There is no shared helper for this yet (only two call sites), so a third Group-based
  kind should factor one out rather than copy-pasting a third time.
- Konva's default event bubbling (click/tap events bubble from the hit shape up
  through listening ancestors unless `evt.cancelBubble` is set) is now a load-bearing
  behavior for every Group-based object kind, not an incidental detail. No code in this
  codebase sets `cancelBubble`; if that ever changes, this fix breaks silently.
- Selecting on drag-end instead of drag-start means an unselected object shows no
  Transformer handles for the duration of the drag itself — only once the pointer is
  released. This is a minor, accepted UX difference from dragging an already-selected
  object (which shows live Transformer handles throughout), not a functional gap.
- `e2e/reselection.spec.ts` and a companion mobile tap test in `e2e/mobile.spec.ts` are
  now the durable regression coverage for this behavior across every object kind,
  Undo/Redo, overlapping z-order, and drag-to-select; any change to selection or
  hit-testing should keep these green.

## Review trigger

Revisit this ADR when: a third Group-based object kind is added (factor out the
hit-area `Rect` into a shared component), alpha-aware hit testing for transparent
product photos is explicitly approved, or a layer/outline panel is approved as an
alternative reselection path.
