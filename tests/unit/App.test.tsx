import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { forwardRef, useImperativeHandle } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/app/App';
import { ja } from '../../src/i18n/locales/ja';

class SucceedingImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = 800;
  naturalHeight = 600;
  set src(_value: string) {
    queueMicrotask(() => this.onload?.());
  }
}

class FailingImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  set src(_value: string) {
    queueMicrotask(() => this.onerror?.());
  }
}

function createImageFile(name = 'photo.png'): File {
  return new File([new Uint8Array([1, 2, 3])], name, { type: 'image/png' });
}

const canvasMock = vi.hoisted(() => ({
  exportToDataUrl: (): string | null => 'data:image/png;base64,mock',
}));

vi.mock('../../src/features/editor/EditorCanvas', () => ({
  EditorCanvas: forwardRef(function MockEditorCanvas(_props, ref) {
    useImperativeHandle(ref, () => ({
      exportToDataUrl: () => canvasMock.exportToDataUrl(),
    }));
    return <div data-testid="mock-editor-canvas" />;
  }),
}));

function mockBrowserLocale(languages: string[]) {
  vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(languages);
  vi.spyOn(window.navigator, 'language', 'get').mockReturnValue(languages[0] ?? 'ja');
}

describe('App', () => {
  beforeEach(() => {
    window.localStorage.clear();
    // Force a deterministic Japanese default regardless of the test runner's locale.
    mockBrowserLocale(['fr-FR']);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    canvasMock.exportToDataUrl = () => 'data:image/png;base64,mock';
  });

  it('renders the editor shell', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Digital Signage Simulator' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: ja.editorAddTextButton })).toBeInTheDocument();
  });

  it('defaults to Japanese', () => {
    render(<App />);

    expect(document.documentElement.lang).toBe('ja');
    expect(screen.getByText(ja.disclaimer)).toBeInTheDocument();
  });

  it('shows the independent-service disclaimer', () => {
    render(<App />);

    expect(screen.getByText(ja.disclaimer)).toBeInTheDocument();
  });

  it('links the HULL CTA to the approved contact URL as a safe external link', () => {
    render(<App />);

    const link = screen.getByRole('link', { name: ja.hullCtaLabel });
    expect(link).toHaveAttribute('href', 'https://hull-inc.jp/contact');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByText(ja.hullCtaExternalNotice)).toBeInTheDocument();
  });

  it('switches the UI to Korean', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.selectOptions(
      screen.getByRole('combobox', { name: ja.languageSelectorLabel }),
      'ko',
    );

    expect(document.documentElement.lang).toBe('ko');
    expect(screen.getByRole('heading', { name: 'Digital Signage Simulator' })).toBeInTheDocument();
  });

  it('switches the UI to English', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.selectOptions(
      screen.getByRole('combobox', { name: ja.languageSelectorLabel }),
      'en',
    );

    expect(document.documentElement.lang).toBe('en');
    expect(screen.getByRole('link', { name: 'Contact HULL' })).toBeInTheDocument();
  });

  it('persists the selected locale across remounts', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<App />);

    await user.selectOptions(
      screen.getByRole('combobox', { name: ja.languageSelectorLabel }),
      'ko',
    );
    expect(window.localStorage.getItem('signage-canvas.locale')).toBe('ko');
    unmount();

    render(<App />);
    expect(document.documentElement.lang).toBe('ko');
  });

  it('shows an accessible error and skips the download when PNG export fails', async () => {
    canvasMock.exportToDataUrl = () => null;
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: ja.editorExportButton }));

    expect(await screen.findByText(ja.editorExportErrorAnnouncement)).toBeInTheDocument();
  });

  it('shows an accessible error and revokes the object URL when an uploaded image fails to decode', async () => {
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');

    class FailingImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) {
        queueMicrotask(() => this.onerror?.());
      }
    }
    vi.stubGlobal('Image', FailingImage as unknown as typeof Image);

    const user = userEvent.setup();
    render(<App />);

    const file = new File([new Uint8Array([1, 2, 3])], 'corrupt.png', { type: 'image/png' });
    await user.upload(screen.getByLabelText(ja.editorAddImageButton), file);

    expect(await screen.findByText(ja.editorImageUploadErrorDecodeFailed)).toBeInTheDocument();
    expect(revokeSpy).toHaveBeenCalledWith('blob:mock-url');
  });

  describe('Sprint 2: space background and display content/material', () => {
    it('adds a space background photo and can remove it again', async () => {
      vi.stubGlobal('Image', SucceedingImage as unknown as typeof Image);
      const user = userEvent.setup();
      render(<App />);

      await user.upload(
        screen.getByLabelText(ja.editorAddSpaceBackgroundButton),
        createImageFile('space.png'),
      );

      const removeButton = await screen.findByRole('button', {
        name: ja.editorRemoveSpaceBackgroundButton,
      });
      expect(removeButton).toBeInTheDocument();

      await user.click(removeButton);
      expect(
        screen.queryByRole('button', { name: ja.editorRemoveSpaceBackgroundButton }),
      ).not.toBeInTheDocument();
    });

    it('shows an accessible error when the space background photo fails to decode', async () => {
      vi.stubGlobal('Image', FailingImage as unknown as typeof Image);
      const user = userEvent.setup();
      render(<App />);

      await user.upload(
        screen.getByLabelText(ja.editorAddSpaceBackgroundButton),
        createImageFile('space.png'),
      );

      expect(await screen.findByText(ja.editorImageUploadErrorDecodeFailed)).toBeInTheDocument();
    });

    it('adds a Wall LED display and shows its empty-content and material properties', async () => {
      const user = userEvent.setup();
      render(<App />);

      await user.click(screen.getByRole('button', { name: ja.editorAddWallLedButton }));

      expect(screen.getByText(ja.editorContentNoneHint)).toBeInTheDocument();
      expect(screen.getByRole('combobox', { name: ja.editorMaterialLabel })).toHaveValue(
        'outdoor-led',
      );
      expect(screen.getByText(ja.editorMaterialPreviewNotice)).toBeInTheDocument();
    });

    it('adds a Stand Display and defaults its material to LCD', async () => {
      const user = userEvent.setup();
      render(<App />);

      await user.click(screen.getByRole('button', { name: ja.editorAddStandDisplayButton }));

      expect(screen.getByRole('combobox', { name: ja.editorMaterialLabel })).toHaveValue('lcd');
    });

    it('uploads content into a display, edits fit/offset/scale, and resets placement', async () => {
      vi.stubGlobal('Image', SucceedingImage as unknown as typeof Image);
      const user = userEvent.setup();
      render(<App />);

      await user.click(screen.getByRole('button', { name: ja.editorAddWallLedButton }));
      await user.upload(
        screen.getByLabelText(ja.editorContentUploadButton),
        createImageFile('content.png'),
      );

      expect(
        await screen.findByRole('button', { name: ja.editorContentReplaceButton }),
      ).toBeInTheDocument();

      const fitSelect = screen.getByRole('combobox', { name: ja.editorContentFitLabel });
      expect(fitSelect).toHaveValue('contain');
      await user.selectOptions(fitSelect, 'cover');
      expect(fitSelect).toHaveValue('cover');

      const offsetXInput = screen.getByRole('spinbutton', { name: ja.editorContentOffsetXLabel });
      await user.clear(offsetXInput);
      await user.type(offsetXInput, '0.4');
      await user.tab();
      expect(offsetXInput).toHaveValue(0.4);

      await user.click(screen.getByRole('button', { name: ja.editorContentResetButton }));
      expect(offsetXInput).toHaveValue(0);
    });

    it('removes uploaded content from a display', async () => {
      vi.stubGlobal('Image', SucceedingImage as unknown as typeof Image);
      const user = userEvent.setup();
      render(<App />);

      await user.click(screen.getByRole('button', { name: ja.editorAddWallLedButton }));
      await user.upload(
        screen.getByLabelText(ja.editorContentUploadButton),
        createImageFile('content.png'),
      );
      await user.click(await screen.findByRole('button', { name: ja.editorContentRemoveButton }));

      expect(screen.getByText(ja.editorContentNoneHint)).toBeInTheDocument();
    });

    it('shows an accessible error when uploaded display content fails to decode', async () => {
      vi.stubGlobal('Image', FailingImage as unknown as typeof Image);
      const user = userEvent.setup();
      render(<App />);

      await user.click(screen.getByRole('button', { name: ja.editorAddWallLedButton }));
      await user.upload(
        screen.getByLabelText(ja.editorContentUploadButton),
        createImageFile('content.png'),
      );

      expect(await screen.findByText(ja.editorImageUploadErrorDecodeFailed)).toBeInTheDocument();
    });

    it('changes the display material and resets material effects to neutral', async () => {
      const user = userEvent.setup();
      render(<App />);

      await user.click(screen.getByRole('button', { name: ja.editorAddWallLedButton }));

      const materialSelect = screen.getByRole('combobox', { name: ja.editorMaterialLabel });
      await user.selectOptions(materialSelect, 'lcd');
      expect(materialSelect).toHaveValue('lcd');

      const intensitySlider = screen.getByRole('slider', { name: ja.editorMaterialIntensityLabel });
      fireEvent.input(intensitySlider, { target: { value: '80' } });
      fireEvent.pointerUp(intensitySlider);
      expect(intensitySlider).toHaveValue('80');

      await user.click(screen.getByRole('button', { name: ja.editorMaterialResetButton }));
      expect(intensitySlider).toHaveValue('50');
    });

    it('undoing an added display removes it and clears the properties panel', async () => {
      const user = userEvent.setup();
      render(<App />);

      await user.click(screen.getByRole('button', { name: ja.editorAddWallLedButton }));
      expect(screen.getByText(ja.editorContentNoneHint)).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: ja.editorUndoButton }));

      expect(screen.getByText(ja.editorPropertiesEmptyHint)).toBeInTheDocument();
    });
  });

  describe('Sprint 3: custom portable product template', () => {
    // In Japanese, the photo-step dialog title and the "select photo" button/input share the
    // exact same phrase, so a plain getByLabelText(ja.portableSelectPhotoButton) matches both
    // the dialog (labelled via aria-labelledby) and the hidden file input. Disambiguate by
    // picking the actual <input> out of the label matches.
    function getPortablePhotoInput(): HTMLElement {
      return screen
        .getAllByLabelText(ja.portableSelectPhotoButton)
        .find((element) => element.tagName === 'INPUT')!;
    }

    it('opens the portable builder as an accessible dialog on the photo step', async () => {
      const user = userEvent.setup();
      render(<App />);

      await user.click(screen.getByRole('button', { name: ja.editorAddPortableButton }));

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      const heading = screen.getByRole('heading', { name: ja.portableStepSelectPhotoTitle });
      expect(dialog).toHaveAttribute('aria-labelledby', heading.id);
      expect(screen.getByText(ja.portableBackgroundNotice)).toBeInTheDocument();
      expect(screen.getByText(ja.portableRightsNotice)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: ja.portableNextButton })).toBeDisabled();
    });

    it('closes the portable builder without adding an object when cancelled', async () => {
      const user = userEvent.setup();
      render(<App />);

      await user.click(screen.getByRole('button', { name: ja.editorAddPortableButton }));
      await user.click(screen.getByRole('button', { name: ja.portableCancelButton }));

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.getByText(ja.editorPropertiesEmptyHint)).toBeInTheDocument();
    });

    it('shows an accessible error when an unsupported portable photo type is uploaded', async () => {
      // applyAccept: false — a mismatched file's MIME type must be rejected by our own
      // validateImageFile check, not silently filtered out by user-event's accept-attribute
      // emulation before it ever reaches the component.
      const user = userEvent.setup({ applyAccept: false });
      render(<App />);

      await user.click(screen.getByRole('button', { name: ja.editorAddPortableButton }));
      const badFile = new File(['not an image'], 'notes.txt', { type: 'text/plain' });
      await user.upload(getPortablePhotoInput(), badFile);

      expect(await screen.findByText(ja.editorImageUploadErrorUnsupportedType)).toBeInTheDocument();
    });

    it('shows an accessible error when the portable photo fails to decode', async () => {
      vi.stubGlobal('Image', FailingImage as unknown as typeof Image);
      const user = userEvent.setup();
      render(<App />);

      await user.click(screen.getByRole('button', { name: ja.editorAddPortableButton }));
      await user.upload(getPortablePhotoInput(), createImageFile('product.png'));

      expect(await screen.findByText(ja.editorImageUploadErrorDecodeFailed)).toBeInTheDocument();
    });

    it('walks photo then region steps, adds a portable object, and re-enters the region editor', async () => {
      vi.stubGlobal('Image', SucceedingImage as unknown as typeof Image);
      const user = userEvent.setup();
      render(<App />);

      await user.click(screen.getByRole('button', { name: ja.editorAddPortableButton }));
      await user.upload(getPortablePhotoInput(), createImageFile('product.png'));

      const nextButton = await screen.findByRole('button', { name: ja.portableNextButton });
      expect(nextButton).toBeEnabled();
      await user.click(nextButton);

      expect(
        screen.getByRole('heading', { name: ja.portableStepDefineRegionTitle }),
      ).toBeInTheDocument();
      expect(screen.getByText(ja.portableScreenRegionDragHint)).toBeInTheDocument();
      expect(screen.getByRole('spinbutton', { name: ja.portableScreenRegionXLabel })).toHaveValue(
        0.2,
      );

      await user.click(screen.getByRole('button', { name: ja.portableAddButton }));

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.getByText(ja.portableTypeValue)).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: ja.portableScreenRegionEditButton }));

      const editDialog = screen.getByRole('dialog');
      expect(
        screen.getByRole('heading', { name: ja.portableStepDefineRegionTitle }),
      ).toBeInTheDocument();
      // Re-entering edits an existing object's region directly; there is no photo step to redo.
      expect(screen.queryByRole('button', { name: ja.portableBackButton })).not.toBeInTheDocument();

      const widthInput = screen.getByRole('spinbutton', {
        name: ja.portableScreenRegionWidthLabel,
      });
      await user.clear(widthInput);
      await user.type(widthInput, '0.4');
      await user.click(screen.getByRole('button', { name: ja.portableSaveButton }));

      expect(editDialog).not.toBeInTheDocument();
    });

    it('rejects a screen region smaller than the minimum size with an accessible error', async () => {
      vi.stubGlobal('Image', SucceedingImage as unknown as typeof Image);
      const user = userEvent.setup();
      render(<App />);

      await user.click(screen.getByRole('button', { name: ja.editorAddPortableButton }));
      await user.upload(getPortablePhotoInput(), createImageFile('product.png'));
      await user.click(await screen.findByRole('button', { name: ja.portableNextButton }));

      const widthInput = screen.getByRole('spinbutton', {
        name: ja.portableScreenRegionWidthLabel,
      });
      await user.clear(widthInput);
      await user.type(widthInput, '0.01');
      await user.click(screen.getByRole('button', { name: ja.portableAddButton }));

      expect(await screen.findByText(ja.portableScreenRegionMinSizeError)).toBeInTheDocument();
      // The dialog stays open so the user can correct the region instead of losing their upload.
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('resets the screen region back to its default', async () => {
      vi.stubGlobal('Image', SucceedingImage as unknown as typeof Image);
      const user = userEvent.setup();
      render(<App />);

      await user.click(screen.getByRole('button', { name: ja.editorAddPortableButton }));
      await user.upload(getPortablePhotoInput(), createImageFile('product.png'));
      await user.click(await screen.findByRole('button', { name: ja.portableNextButton }));

      const widthInput = screen.getByRole('spinbutton', {
        name: ja.portableScreenRegionWidthLabel,
      });
      await user.clear(widthInput);
      await user.type(widthInput, '0.9');
      expect(widthInput).toHaveValue(0.9);

      await user.click(screen.getByRole('button', { name: ja.portableScreenRegionResetButton }));
      expect(widthInput).toHaveValue(0.6);
    });

    it('shows the portable section and CTA translated in Korean and English', async () => {
      const user = userEvent.setup();
      render(<App />);

      await user.selectOptions(
        screen.getByRole('combobox', { name: ja.languageSelectorLabel }),
        'ko',
      );
      expect(screen.getByRole('button', { name: '포터블 제품 추가' })).toBeInTheDocument();

      await user.selectOptions(screen.getByRole('combobox', { name: '언어' }), 'en');
      expect(
        screen.getByRole('button', { name: /add (a )?portable product/i }),
      ).toBeInTheDocument();
    });
  });
});
