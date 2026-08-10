import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { forwardRef, useImperativeHandle } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/app/App';
import { ja } from '../../src/i18n/locales/ja';
import { MIN_SCREEN_REGION_FRACTION } from '../../src/lib/portableRegion';
import { useEditorStore } from '../../src/store/editorStore';
import { createEmptyDocument } from '../../src/types/editor';
import type { PortableSignageObject } from '../../src/types/editor';

// Same 800x600-independent decode stub App.test.tsx uses, sized to a 4:3 photo (400x300) that
// exactly matches the mocked preview container below, so these interaction tests can reason in
// plain pixels without also exercising the (separately unit-tested) letterbox math.
class SucceedingImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = 400;
  naturalHeight = 300;
  set src(_value: string) {
    queueMicrotask(() => this.onload?.());
  }
}

function createImageFile(name = 'product.png'): File {
  return new File([new Uint8Array([1, 2, 3])], name, { type: 'image/png' });
}

vi.mock('../../src/features/editor/EditorCanvas', () => ({
  EditorCanvas: forwardRef(function MockEditorCanvas(_props, ref) {
    useImperativeHandle(ref, () => ({
      exportToDataUrl: () => 'data:image/png;base64,mock',
    }));
    return <div data-testid="mock-editor-canvas" />;
  }),
}));

const PREVIEW_RECT: DOMRect = {
  x: 0,
  y: 0,
  left: 0,
  top: 0,
  right: 400,
  bottom: 300,
  width: 400,
  height: 300,
  toJSON() {
    return this;
  },
};
const ZERO_RECT: DOMRect = {
  x: 0,
  y: 0,
  left: 0,
  top: 0,
  right: 0,
  bottom: 0,
  width: 0,
  height: 0,
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
  });
}

function getPortablePhotoInput(): HTMLElement {
  return screen
    .getAllByLabelText(ja.portableSelectPhotoButton)
    .find((element) => element.tagName === 'INPUT')!;
}

async function addDefaultPortableProduct(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: ja.editorAddPortableButton }));
  await user.upload(getPortablePhotoInput(), createImageFile());
  await user.click(await screen.findByRole('button', { name: ja.portableNextButton }));
  await user.click(screen.getByRole('button', { name: ja.portableAddButton }));
}

function firstPortableObject(): PortableSignageObject {
  const object = useEditorStore
    .getState()
    .document.objects.find(
      (candidate): candidate is PortableSignageObject => candidate.kind === 'portable',
    );
  if (!object) throw new Error('expected a portable object in the store');
  return object;
}

function regionPreview(): HTMLElement {
  return document.querySelector('.portable-region-preview') as HTMLElement;
}

function regionBox(): HTMLElement {
  return document.querySelector('.portable-region-box') as HTMLElement;
}

function regionHandle(corner: 'nw' | 'ne' | 'sw' | 'se'): HTMLElement {
  return document.querySelector(`.portable-region-handle--${corner}`) as HTMLElement;
}

function numberInputValue(label: string): number {
  return Number((screen.getByRole('spinbutton', { name: label }) as HTMLInputElement).value);
}

describe('PortableBuilderModal direct region move/resize', () => {
  beforeEach(() => {
    resetStore();
    window.localStorage.clear();
    vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(['fr-FR']);
    vi.spyOn(window.navigator, 'language', 'get').mockReturnValue('fr-FR');
    vi.stubGlobal('Image', SucceedingImage as unknown as typeof Image);
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: Element,
    ) {
      return this.classList?.contains('portable-region-preview') ? PREVIEW_RECT : ZERO_RECT;
    });
    HTMLElement.prototype.setPointerCapture = vi.fn();
    HTMLElement.prototype.releasePointerCapture = vi.fn();
    HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('drags inside the existing region to move it, preserving size and the pointer grab offset, with no history entry until Save', async () => {
    const user = userEvent.setup();
    render(<App />);
    await addDefaultPortableProduct(user);
    const pastAfterCreate = useEditorStore.getState().past.length;

    await user.click(screen.getByRole('button', { name: ja.portableScreenRegionEditButton }));

    // Default region is {x:0.2,y:0.2,w:0.6,h:0.6} -> pixel box [80,60]-[320,240] on the 400x300
    // mocked preview; its center is (200,150).
    fireEvent.pointerDown(regionBox(), { clientX: 200, clientY: 150, pointerId: 1 });
    fireEvent.pointerMove(regionPreview(), { clientX: 250, clientY: 180, pointerId: 1 });

    // Numeric fields track the live drag, before pointerup.
    expect(numberInputValue(ja.portableScreenRegionWidthLabel)).toBeCloseTo(0.6, 2);
    expect(numberInputValue(ja.portableScreenRegionHeightLabel)).toBeCloseTo(0.6, 2);
    expect(numberInputValue(ja.portableScreenRegionXLabel)).toBeCloseTo(0.325, 1);
    expect(numberInputValue(ja.portableScreenRegionYLabel)).toBeCloseTo(0.3, 1);

    fireEvent.pointerUp(regionPreview(), { clientX: 250, clientY: 180, pointerId: 1 });

    // Dragging alone never touched the editor's undo/redo history.
    expect(useEditorStore.getState().past.length).toBe(pastAfterCreate);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: ja.portableSaveButton }));

    // Saving a real change creates exactly one history entry.
    expect(useEditorStore.getState().past.length).toBe(pastAfterCreate + 1);
    const object = firstPortableObject();
    expect(object.screenRegion.width).toBeCloseTo(0.6, 2);
    expect(object.screenRegion.height).toBeCloseTo(0.6, 2);
    expect(object.screenRegion.x).toBeCloseTo(0.325, 2);
  });

  it('drags the se corner handle to resize, keeping the nw corner fixed', async () => {
    const user = userEvent.setup();
    render(<App />);
    await addDefaultPortableProduct(user);

    await user.click(screen.getByRole('button', { name: ja.portableScreenRegionEditButton }));

    fireEvent.pointerDown(regionHandle('se'), { clientX: 320, clientY: 240, pointerId: 1 });
    fireEvent.pointerMove(regionPreview(), { clientX: 350, clientY: 270, pointerId: 1 });
    fireEvent.pointerUp(regionPreview(), { clientX: 350, clientY: 270, pointerId: 1 });

    expect(numberInputValue(ja.portableScreenRegionXLabel)).toBeCloseTo(0.2, 2);
    expect(numberInputValue(ja.portableScreenRegionYLabel)).toBeCloseTo(0.2, 2);
    // The true value (0.875 - 0.2) is 0.675, but the number input displays region.width rounded
    // via `.toFixed(2)`, and the closest double to 0.675 rounds up to "0.68" (a JS float quirk,
    // not a bug in the resize math itself — see resizeNormalizedRectClamped's own unit tests for
    // the unrounded value).
    expect(numberInputValue(ja.portableScreenRegionWidthLabel)).toBeCloseTo(0.68, 2);
    expect(numberInputValue(ja.portableScreenRegionHeightLabel)).toBeCloseTo(0.7, 2);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('clamps a corner resize at the minimum size instead of inverting or rejecting it', async () => {
    const user = userEvent.setup();
    render(<App />);
    await addDefaultPortableProduct(user);

    await user.click(screen.getByRole('button', { name: ja.portableScreenRegionEditButton }));

    // Drag the se handle almost on top of the fixed nw corner (80,60) — past what a naive
    // resize would allow — and confirm the box stops at the minimum instead of collapsing.
    fireEvent.pointerDown(regionHandle('se'), { clientX: 320, clientY: 240, pointerId: 1 });
    fireEvent.pointerMove(regionPreview(), { clientX: 85, clientY: 65, pointerId: 1 });
    fireEvent.pointerUp(regionPreview(), { clientX: 85, clientY: 65, pointerId: 1 });

    expect(numberInputValue(ja.portableScreenRegionWidthLabel)).toBeCloseTo(
      MIN_SCREEN_REGION_FRACTION,
      2,
    );
    expect(numberInputValue(ja.portableScreenRegionHeightLabel)).toBeCloseTo(
      MIN_SCREEN_REGION_FRACTION,
      2,
    );
    expect(numberInputValue(ja.portableScreenRegionXLabel)).toBeCloseTo(0.2, 2);
    expect(numberInputValue(ja.portableScreenRegionYLabel)).toBeCloseTo(0.2, 2);
    // A minimum-size rect is valid; no error should be shown, and Save should succeed.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: ja.portableSaveButton }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('cancelling after a move/resize discards the draft and creates no history entry', async () => {
    const user = userEvent.setup();
    render(<App />);
    await addDefaultPortableProduct(user);
    const pastAfterCreate = useEditorStore.getState().past.length;

    await user.click(screen.getByRole('button', { name: ja.portableScreenRegionEditButton }));
    fireEvent.pointerDown(regionBox(), { clientX: 200, clientY: 150, pointerId: 1 });
    fireEvent.pointerMove(regionPreview(), { clientX: 260, clientY: 190, pointerId: 1 });
    fireEvent.pointerUp(regionPreview(), { clientX: 260, clientY: 190, pointerId: 1 });
    expect(numberInputValue(ja.portableScreenRegionXLabel)).not.toBeCloseTo(0.2, 2);

    await user.click(screen.getByRole('button', { name: ja.portableCancelButton }));

    expect(useEditorStore.getState().past.length).toBe(pastAfterCreate);
    expect(firstPortableObject().screenRegion).toEqual({ x: 0.2, y: 0.2, width: 0.6, height: 0.6 });

    // Reopening confirms the object's stored region — not the discarded draft — comes back.
    await user.click(screen.getByRole('button', { name: ja.portableScreenRegionEditButton }));
    expect(numberInputValue(ja.portableScreenRegionXLabel)).toBeCloseTo(0.2, 2);
  });

  it('saving an unchanged region creates no history entry', async () => {
    const user = userEvent.setup();
    render(<App />);
    await addDefaultPortableProduct(user);
    const pastAfterCreate = useEditorStore.getState().past.length;

    await user.click(screen.getByRole('button', { name: ja.portableScreenRegionEditButton }));
    await user.click(screen.getByRole('button', { name: ja.portableSaveButton }));

    expect(useEditorStore.getState().past.length).toBe(pastAfterCreate);
  });

  it('still supports drawing a brand new region on empty preview space outside the existing box', async () => {
    const user = userEvent.setup();
    render(<App />);
    await addDefaultPortableProduct(user);

    await user.click(screen.getByRole('button', { name: ja.portableScreenRegionEditButton }));

    // (10,10) sits outside the default box (which starts at 80,60), so this must draw a new
    // rect from scratch rather than moving/resizing the existing one.
    fireEvent.pointerDown(regionPreview(), { clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(regionPreview(), { clientX: 200, clientY: 200, pointerId: 1 });
    fireEvent.pointerUp(regionPreview(), { clientX: 200, clientY: 200, pointerId: 1 });

    expect(numberInputValue(ja.portableScreenRegionXLabel)).toBeCloseTo(0.025, 2);
    expect(numberInputValue(ja.portableScreenRegionYLabel)).toBeCloseTo(0.033, 2);
    // True value (0.5 - 0.025) is 0.475; the closest double rounds down to "0.47" under
    // `.toFixed(2)` — see the width assertion note in the resize test above.
    expect(numberInputValue(ja.portableScreenRegionWidthLabel)).toBeCloseTo(0.47, 2);
  });
});
