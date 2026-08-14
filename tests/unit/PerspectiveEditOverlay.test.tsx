import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { forwardRef, useImperativeHandle } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/app/App';
import { ja } from '../../src/i18n/locales/ja';
import type { DisplaySignageObject } from '../../src/types/editor';
import { useEditorStore } from '../../src/store/editorStore';
import { useUiStore } from '../../src/store/uiStore';
import { createEmptyDocument } from '../../src/types/editor';

// A real Konva <Stage> cannot render in jsdom (no canvas 2D context — see App.test.tsx's own
// EditorCanvas mock), but PerspectiveEditOverlay is plain HTML with no Konva dependency, so this
// mock renders the *real* overlay component conditionally on `perspectiveEditId`, the same way
// the real EditorCanvas.tsx does, letting these tests exercise its actual drag/keyboard/numeric-
// field logic end to end through the Toolbar's own "Fit to space" entry point.
vi.mock('../../src/features/editor/EditorCanvas', async () => {
  const React = await import('react');
  const { PerspectiveEditOverlay } = await import(
    '../../src/features/editor/PerspectiveEditOverlay'
  );
  const { useEditorStore: store } = await import('../../src/store/editorStore');
  const { getDocumentSize: docSize } = await import('../../src/types/editor');
  return {
    EditorCanvas: forwardRef(function MockEditorCanvas(_props, ref) {
      useImperativeHandle(ref, () => ({
        exportToDataUrl: () => 'data:image/png;base64,mock',
      }));
      const perspectiveEditId = store((state) => state.perspectiveEditId);
      const document = store((state) => state.document);
      const size = docSize(document);
      return React.createElement(
        'div',
        { 'data-testid': 'mock-editor-canvas' },
        perspectiveEditId && size
          ? React.createElement(PerspectiveEditOverlay, { documentSize: size, fitScale: 1 })
          : null,
      );
    }),
  };
});

class SucceedingImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = 800;
  naturalHeight = 600;
  set src(_value: string) {
    queueMicrotask(() => this.onload?.());
  }
}

function createImageFile(name = 'photo.png'): File {
  return new File([new Uint8Array([1, 2, 3])], name, { type: 'image/png' });
}

const OVERLAY_RECT: DOMRect = {
  x: 0,
  y: 0,
  left: 0,
  top: 0,
  right: 800,
  bottom: 600,
  width: 800,
  height: 600,
  toJSON() {
    return this;
  },
};

function resetStore() {
  useEditorStore.setState({
    document: createEmptyDocument(),
    selectedId: null,
    past: [],
    future: [],
    perspectiveEditId: null,
    perspectiveDraftQuad: null,
    perspectiveEditOriginalQuad: null,
  });
  useUiStore.setState({ comparisonMode: false, onboardingDismissed: true });
}

async function addSpaceBackground(user: ReturnType<typeof userEvent.setup>) {
  vi.stubGlobal('Image', SucceedingImage as unknown as typeof Image);
  await user.upload(
    screen.getByLabelText(ja.editorAddSpaceBackgroundButton),
    createImageFile('space.png'),
  );
  await screen.findByRole('button', { name: ja.editorRemoveSpaceBackgroundButton });
}

function firstDisplayObject(): DisplaySignageObject {
  const object = useEditorStore
    .getState()
    .document.objects.find((candidate): candidate is DisplaySignageObject => candidate.kind === 'display');
  if (!object) throw new Error('expected a display object in the store');
  return object;
}

function cornerFieldset(cornerLabel: string): HTMLElement {
  return screen.getByRole('group', { name: cornerLabel });
}

function cornerFieldValue(cornerLabel: string, axisLabel: string): number {
  const fieldset = cornerFieldset(cornerLabel);
  return Number(
    (within(fieldset).getByRole('spinbutton', { name: axisLabel }) as HTMLInputElement).value,
  );
}

describe('PerspectiveEditOverlay (Fit to space)', () => {
  beforeEach(() => {
    resetStore();
    window.localStorage.clear();
    vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(['fr-FR']);
    vi.spyOn(window.navigator, 'language', 'get').mockReturnValue('fr-FR');
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: Element,
    ) {
      return this.classList?.contains('perspective-edit-overlay') ? OVERLAY_RECT : OVERLAY_RECT;
    });
    HTMLElement.prototype.setPointerCapture = vi.fn();
    HTMLElement.prototype.releasePointerCapture = vi.fn();
    HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('enters edit mode from the toolbar, drags the top-left corner, and applies as one history entry', async () => {
    const user = userEvent.setup();
    render(<App />);
    await addSpaceBackground(user);
    await user.click(screen.getByRole('button', { name: ja.editorAddLedButton }));
    const pastBeforeEdit = useEditorStore.getState().past.length;

    await user.click(screen.getByRole('button', { name: ja.editorPerspectiveFitButton }));

    // The "Fit to space" entry point itself is hidden while this object's own session is open.
    expect(
      screen.queryByRole('button', { name: ja.editorPerspectiveFitButton }),
    ).not.toBeInTheDocument();
    expect(useEditorStore.getState().past.length).toBe(pastBeforeEdit);

    const topLeftHandle = screen.getByRole('slider', { name: ja.editorPerspectiveCornerTopLeft });
    fireEvent.pointerDown(topLeftHandle, { clientX: 160, clientY: 165, pointerId: 1 });
    fireEvent.pointerMove(topLeftHandle, { clientX: 50, clientY: 40, pointerId: 1 });
    fireEvent.pointerUp(topLeftHandle, { clientX: 50, clientY: 40, pointerId: 1 });

    // Document is 800x600 (space photo), fitScale is 1 in this mock, so preview px == document px.
    expect(cornerFieldValue(ja.editorPerspectiveCornerTopLeft, ja.editorPositionXLabel)).toBeCloseTo(
      50 / 800,
      2,
    );
    expect(cornerFieldValue(ja.editorPerspectiveCornerTopLeft, ja.editorPositionYLabel)).toBeCloseTo(
      40 / 600,
      2,
    );
    // Still just a live draft — nothing committed to history yet.
    expect(useEditorStore.getState().past.length).toBe(pastBeforeEdit);

    await user.click(screen.getByRole('button', { name: ja.editorPerspectiveApplyButton }));

    expect(useEditorStore.getState().past.length).toBe(pastBeforeEdit + 1);
    const object = firstDisplayObject();
    expect(object.placementMode).toBe('perspective');
    expect(object.perspectiveQuad?.topLeft.x).toBeCloseTo(50 / 800, 2);
    expect(object.perspectiveQuad?.topLeft.y).toBeCloseTo(40 / 600, 2);
    expect(
      screen.queryByRole('slider', { name: ja.editorPerspectiveCornerTopLeft }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: ja.editorPerspectiveUseRectButton }),
    ).toBeInTheDocument();
  });

  it('switches a perspective-placed object back to normal (rect) placement as its own history entry', async () => {
    const user = userEvent.setup();
    render(<App />);
    await addSpaceBackground(user);
    await user.click(screen.getByRole('button', { name: ja.editorAddLedButton }));
    await user.click(screen.getByRole('button', { name: ja.editorPerspectiveFitButton }));
    await user.click(screen.getByRole('button', { name: ja.editorPerspectiveApplyButton }));
    const pastAfterApply = useEditorStore.getState().past.length;

    await user.click(screen.getByRole('button', { name: ja.editorPerspectiveUseRectButton }));

    expect(useEditorStore.getState().past.length).toBe(pastAfterApply + 1);
    expect(firstDisplayObject().placementMode).toBe('rect');
    // The last-applied quad is preserved so re-entering "Fit to space" restores it, not a fresh one.
    expect(firstDisplayObject().perspectiveQuad).not.toBeNull();
    expect(
      screen.getByRole('button', { name: ja.editorPerspectiveFitButton }),
    ).toBeInTheDocument();
  });

  it('cancelling a drag discards the draft with zero history entries', async () => {
    const user = userEvent.setup();
    render(<App />);
    await addSpaceBackground(user);
    await user.click(screen.getByRole('button', { name: ja.editorAddLedButton }));
    const pastBeforeEdit = useEditorStore.getState().past.length;

    await user.click(screen.getByRole('button', { name: ja.editorPerspectiveFitButton }));
    const topLeftHandle = screen.getByRole('slider', { name: ja.editorPerspectiveCornerTopLeft });
    fireEvent.pointerDown(topLeftHandle, { clientX: 160, clientY: 165, pointerId: 1 });
    fireEvent.pointerMove(topLeftHandle, { clientX: 50, clientY: 40, pointerId: 1 });
    fireEvent.pointerUp(topLeftHandle, { clientX: 50, clientY: 40, pointerId: 1 });

    await user.click(screen.getByRole('button', { name: ja.editorPerspectiveCancelButton }));

    expect(useEditorStore.getState().past.length).toBe(pastBeforeEdit);
    expect(firstDisplayObject().placementMode).toBe('rect');
    expect(firstDisplayObject().perspectiveQuad).toBeNull();
    expect(
      screen.queryByRole('slider', { name: ja.editorPerspectiveCornerTopLeft }),
    ).not.toBeInTheDocument();
  });

  it('resetting during a drag restores the original quad without leaving edit mode', async () => {
    const user = userEvent.setup();
    render(<App />);
    await addSpaceBackground(user);
    await user.click(screen.getByRole('button', { name: ja.editorAddLedButton }));

    await user.click(screen.getByRole('button', { name: ja.editorPerspectiveFitButton }));
    const originalX = cornerFieldValue(ja.editorPerspectiveCornerTopLeft, ja.editorPositionXLabel);

    const topLeftHandle = screen.getByRole('slider', { name: ja.editorPerspectiveCornerTopLeft });
    fireEvent.pointerDown(topLeftHandle, { clientX: 160, clientY: 165, pointerId: 1 });
    fireEvent.pointerMove(topLeftHandle, { clientX: 50, clientY: 40, pointerId: 1 });
    fireEvent.pointerUp(topLeftHandle, { clientX: 50, clientY: 40, pointerId: 1 });
    expect(
      cornerFieldValue(ja.editorPerspectiveCornerTopLeft, ja.editorPositionXLabel),
    ).not.toBeCloseTo(originalX, 2);

    await user.click(screen.getByRole('button', { name: ja.editorPerspectiveResetButton }));

    expect(
      cornerFieldValue(ja.editorPerspectiveCornerTopLeft, ja.editorPositionXLabel),
    ).toBeCloseTo(originalX, 2);
    // Reset stays inside the edit session — it does not Apply or Cancel.
    expect(screen.getByRole('slider', { name: ja.editorPerspectiveCornerTopLeft })).toBeInTheDocument();
  });

  it('moving a corner via the numeric field updates the draft the same as dragging', async () => {
    const user = userEvent.setup();
    render(<App />);
    await addSpaceBackground(user);
    await user.click(screen.getByRole('button', { name: ja.editorAddLedButton }));
    await user.click(screen.getByRole('button', { name: ja.editorPerspectiveFitButton }));

    const fieldset = cornerFieldset(ja.editorPerspectiveCornerTopLeft);
    const xInput = within(fieldset).getByRole('spinbutton', { name: ja.editorPositionXLabel });
    await user.clear(xInput);
    await user.type(xInput, '0.05');

    expect(xInput).toHaveValue(0.05);

    await user.click(screen.getByRole('button', { name: ja.editorPerspectiveApplyButton }));
    expect(firstDisplayObject().perspectiveQuad?.topLeft.x).toBeCloseTo(0.05, 2);
  });

  it('nudges a corner with the arrow keys as an accessible alternative to dragging', async () => {
    const user = userEvent.setup();
    render(<App />);
    await addSpaceBackground(user);
    await user.click(screen.getByRole('button', { name: ja.editorAddLedButton }));
    await user.click(screen.getByRole('button', { name: ja.editorPerspectiveFitButton }));

    const originalX = cornerFieldValue(ja.editorPerspectiveCornerTopLeft, ja.editorPositionXLabel);
    const topLeftHandle = screen.getByRole('slider', { name: ja.editorPerspectiveCornerTopLeft });
    topLeftHandle.focus();
    fireEvent.keyDown(topLeftHandle, { key: 'ArrowRight' });

    expect(
      cornerFieldValue(ja.editorPerspectiveCornerTopLeft, ja.editorPositionXLabel),
    ).toBeCloseTo(originalX + 0.01, 2);
  });

  it('shows an accessible error and disables Apply for a self-intersecting quad', async () => {
    const user = userEvent.setup();
    render(<App />);
    await addSpaceBackground(user);
    await user.click(screen.getByRole('button', { name: ja.editorAddLedButton }));
    await user.click(screen.getByRole('button', { name: ja.editorPerspectiveFitButton }));
    const pastBeforeEdit = useEditorStore.getState().past.length;

    // Drag the top-left corner far past the bottom-right corner, crossing the quad's own edges.
    const topLeftHandle = screen.getByRole('slider', { name: ja.editorPerspectiveCornerTopLeft });
    fireEvent.pointerDown(topLeftHandle, { clientX: 160, clientY: 165, pointerId: 1 });
    fireEvent.pointerMove(topLeftHandle, { clientX: 780, clientY: 580, pointerId: 1 });
    fireEvent.pointerUp(topLeftHandle, { clientX: 780, clientY: 580, pointerId: 1 });

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: ja.editorPerspectiveApplyButton })).toBeDisabled();

    // Applying directly at the store level (bypassing the disabled button) must still refuse to
    // commit and must keep the edit session open, matching applyPerspectiveEdit's own contract.
    const result = useEditorStore.getState().applyPerspectiveEdit();
    expect(result.applied).toBe(false);
    expect(useEditorStore.getState().past.length).toBe(pastBeforeEdit);
    expect(useEditorStore.getState().perspectiveEditId).not.toBeNull();

    await user.click(screen.getByRole('button', { name: ja.editorPerspectiveCancelButton }));
  });
});
