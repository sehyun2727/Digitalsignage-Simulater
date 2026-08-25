import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { forwardRef, useImperativeHandle } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/app/App';
import { en } from '../../src/i18n/locales/en';
import { ja } from '../../src/i18n/locales/ja';
import { useEditorStore } from '../../src/store/editorStore';
import { useUiStore } from '../../src/store/uiStore';
import { createEmptyDocument } from '../../src/types/editor';

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

function createVideoFile(name = 'clip.mp4'): File {
  return new File([new Uint8Array(1024)], name, { type: 'video/mp4' });
}

class SucceedingMockVideo {
  onloadedmetadata: (() => void) | null = null;
  onerror: (() => void) | null = null;
  videoWidth = 1280;
  videoHeight = 720;
  duration = 10;
  muted = false;
  playsInline = false;
  preload = '';
  set src(_value: string) {
    queueMicrotask(() => this.onloadedmetadata?.());
  }
  // validateVideoFile (src/lib/videoValidation.ts) probes codec support via a fresh
  // document.createElement('video') too, ahead of the registerVideoAsset decode this class
  // otherwise stands in for, so it needs its own canPlayType.
  canPlayType(): string {
    return 'probably';
  }
}

// registerVideoAsset (src/lib/assetRegistry.ts) decodes through a real <video> element, which
// jsdom cannot actually play — swap document.createElement('video') for a controllable stand-in,
// the same approach contentUpload.test.ts uses at the lib level.
function stubVideoElement() {
  const originalCreateElement = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation((tagName: string, options?: unknown) => {
    if (tagName === 'video') return new SucceedingMockVideo() as unknown as HTMLVideoElement;
    return originalCreateElement(tagName, options as ElementCreationOptions);
  });
}

/**
 * registerContentAsset's video duration check only runs when the decoded asset's `.image` is a
 * genuine `instanceof HTMLVideoElement` (see src/lib/contentUpload.ts) — the plain-object
 * SucceedingMockVideo stand-in above doesn't satisfy that, so exercising duration/dimension
 * failures needs a real <video> element with its readonly getters shadowed on the instance.
 * Also stubs canPlayType at the prototype level so validateVideoFile's pre-decode codec probe
 * (which creates its own throwaway <video> element) passes regardless of which instance it gets.
 */
function stubRealVideoElementWith(overrides: {
  videoWidth: number;
  videoHeight: number;
  duration?: number;
}) {
  vi.spyOn(HTMLVideoElement.prototype, 'canPlayType').mockReturnValue('probably');
  const originalCreateElement = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation((tagName: string, options?: unknown) => {
    if (tagName !== 'video')
      return originalCreateElement(tagName, options as ElementCreationOptions);
    const video = originalCreateElement('video') as HTMLVideoElement;
    Object.defineProperty(video, 'videoWidth', { value: overrides.videoWidth, configurable: true });
    Object.defineProperty(video, 'videoHeight', {
      value: overrides.videoHeight,
      configurable: true,
    });
    if (overrides.duration !== undefined) {
      Object.defineProperty(video, 'duration', { value: overrides.duration, configurable: true });
    }
    Object.defineProperty(video, 'src', {
      set() {
        queueMicrotask(() => video.onloadedmetadata?.(new Event('loadedmetadata')));
      },
      configurable: true,
    });
    return video;
  });
}

const canvasMock = vi.hoisted(() => ({
  exportToDataUrl: (): string | null => 'data:image/png;base64,mock',
  beginVideoExportCapture: (): HTMLCanvasElement | null => document.createElement('canvas'),
  endVideoExportCapture: (): void => {},
}));

vi.mock('../../src/features/editor/EditorCanvas', () => ({
  EditorCanvas: forwardRef(function MockEditorCanvas(_props, ref) {
    useImperativeHandle(ref, () => ({
      exportToDataUrl: () => canvasMock.exportToDataUrl(),
      beginVideoExportCapture: () => canvasMock.beginVideoExportCapture(),
      endVideoExportCapture: () => canvasMock.endVideoExportCapture(),
    }));
    return <div data-testid="mock-editor-canvas" />;
  }),
}));

// The real capability probe depends on jsdom's (absent) MediaRecorder/captureStream support —
// these tests care about EditorLayout's own UI reaction to that boolean, not the probe itself
// (see videoExportCapability.test.ts for the probe's own coverage), so it is stubbed directly.
const videoExportMock = vi.hoisted(() => ({
  supported: true,
  recordCanvasToVideo: vi.fn<
    (canvas: HTMLCanvasElement, options: { durationMs: number }) => Promise<Blob>
  >(async () => new Blob(['clip'], { type: 'video/webm' })),
}));

vi.mock('../../src/lib/videoExportCapability', () => ({
  isVideoExportSupported: () => videoExportMock.supported,
}));

vi.mock('../../src/lib/videoExport', async () => {
  const actual = await vi.importActual<typeof import('../../src/lib/videoExport')>(
    '../../src/lib/videoExport',
  );
  return {
    ...actual,
    recordCanvasToVideo: (...args: Parameters<typeof actual.recordCanvasToVideo>) =>
      videoExportMock.recordCanvasToVideo(...args),
  };
});

function mockBrowserLocale(languages: string[]) {
  vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(languages);
  vi.spyOn(window.navigator, 'language', 'get').mockReturnValue(languages[0] ?? 'ja');
}

// Every "Add signage" control (and the header Export button) is disabled until a space photo
// exists, since document/export size is now derived entirely from that photo. Tests that need to
// add objects or export must upload one first via this helper.
async function addSpaceBackground(user: ReturnType<typeof userEvent.setup>) {
  vi.stubGlobal('Image', SucceedingImage as unknown as typeof Image);
  await user.upload(
    screen.getByLabelText(ja.editorAddSpaceBackgroundButton),
    createImageFile('space.png'),
  );
  await screen.findByRole('button', { name: ja.editorRemoveSpaceBackgroundButton });
}

describe('App', () => {
  beforeEach(() => {
    window.localStorage.clear();
    // Force a deterministic Japanese default regardless of the test runner's locale.
    mockBrowserLocale(['fr-FR']);
    // useUiStore is a module-level singleton; reset it so state never leaks between tests.
    // onboardingDismissed is forced true here since these tests exercise the toolbar itself,
    // not the onboarding card (see OnboardingOverlay.test.tsx).
    useUiStore.setState({ comparisonMode: false, onboardingDismissed: true });
    // useEditorStore is also a module-level singleton; reset it so the space background,
    // objects, and history from one test never leak into the next.
    useEditorStore.setState({
      document: createEmptyDocument(),
      selectedId: null,
      past: [],
      future: [],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    canvasMock.exportToDataUrl = () => 'data:image/png;base64,mock';
    canvasMock.beginVideoExportCapture = () => document.createElement('canvas');
    canvasMock.endVideoExportCapture = () => {};
    videoExportMock.supported = true;
    videoExportMock.recordCanvasToVideo.mockReset();
    videoExportMock.recordCanvasToVideo.mockImplementation(
      async () => new Blob(['clip'], { type: 'video/webm' }),
    );
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
    expect(link).toHaveAttribute('href', 'https://hull-inc.jp/');
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
    expect(screen.getByRole('link', { name: en.hullCtaLabel })).toBeInTheDocument();
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
    await addSpaceBackground(user);

    await user.click(screen.getByRole('button', { name: ja.editorExportButton }));

    expect(await screen.findByText(ja.editorExportErrorAnnouncement)).toBeInTheDocument();
  });

  it('hides the video export button and shows the unsupported hint when the browser cannot record', async () => {
    videoExportMock.supported = false;
    render(<App />);

    expect(
      screen.queryByRole('button', { name: ja.editorExportVideoButton }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(ja.editorExportVideoUnsupportedHint)).toBeInTheDocument();
  });

  it('exports a video, showing the in-progress label while recording and announcing success once it resolves', async () => {
    let resolveRecording: (blob: Blob) => void = () => {};
    videoExportMock.recordCanvasToVideo.mockImplementation(
      () =>
        new Promise<Blob>((resolve) => {
          resolveRecording = resolve;
        }),
    );
    const user = userEvent.setup();
    render(<App />);
    await addSpaceBackground(user);
    expect(screen.queryByText(ja.editorExportVideoUnsupportedHint)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: ja.editorExportVideoButton }));

    const inProgressButton = await screen.findByRole('button', {
      name: ja.editorExportVideoInProgressButton,
    });
    expect(inProgressButton).toBeDisabled();

    resolveRecording(new Blob(['clip'], { type: 'video/webm' }));

    expect(await screen.findByText(ja.editorExportedVideoAnnouncement)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: ja.editorExportVideoButton })).not.toBeDisabled();
  });

  it('shows an accessible error and does not download when video export fails', async () => {
    videoExportMock.recordCanvasToVideo.mockRejectedValue(new Error('capture failed'));
    const user = userEvent.setup();
    render(<App />);
    await addSpaceBackground(user);

    await user.click(screen.getByRole('button', { name: ja.editorExportVideoButton }));

    expect(await screen.findByText(ja.editorExportVideoErrorAnnouncement)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: ja.editorExportVideoButton })).not.toBeDisabled();
  });

  it('shows an accessible error and revokes the object URL when an uploaded image fails to decode', async () => {
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');

    const user = userEvent.setup();
    render(<App />);
    await addSpaceBackground(user);

    class FailingImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) {
        queueMicrotask(() => this.onerror?.());
      }
    }
    vi.stubGlobal('Image', FailingImage as unknown as typeof Image);

    const file = new File([new Uint8Array([1, 2, 3])], 'corrupt.png', { type: 'image/png' });
    await user.upload(screen.getByLabelText(ja.editorAddImageButton), file);

    expect(await screen.findByText(ja.editorImageUploadErrorDecodeFailed)).toBeInTheDocument();
    expect(revokeSpy).toHaveBeenCalledWith('blob:mock-url');
  });

  it('shows a visibly styled accessible error and revokes the object URL when an uploaded image decodes to an oversized bitmap', async () => {
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-oversized');

    class OversizedImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      naturalWidth = 8000;
      naturalHeight = 6000;
      set src(_value: string) {
        queueMicrotask(() => this.onload?.());
      }
    }

    const user = userEvent.setup();
    render(<App />);
    await addSpaceBackground(user);
    vi.stubGlobal('Image', OversizedImage as unknown as typeof Image);

    const file = new File([new Uint8Array([1, 2, 3])], 'huge.png', { type: 'image/png' });
    await user.upload(screen.getByLabelText(ja.editorAddImageButton), file);

    const message = await screen.findByText(ja.editorImageUploadErrorDimensionsTooLarge);
    // The status/announcement region moved into the canvas wrapper as a bottom overlay so it
    // no longer wastes a fixed slice of below-canvas height; class names updated to match.
    expect(message).toHaveClass('editor-canvas-status-announcement--error');
    expect(revokeSpy).toHaveBeenCalledWith('blob:mock-oversized');
  });

  it('does not style a successful announcement as an error', async () => {
    const user = userEvent.setup();
    render(<App />);
    await addSpaceBackground(user);

    await user.click(screen.getByRole('button', { name: ja.editorExportButton }));

    const message = await screen.findByText(ja.editorExportedAnnouncement);
    expect(message).toHaveClass('editor-canvas-status-announcement');
    expect(message).not.toHaveClass('editor-canvas-status-announcement--error');
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

    it('adds an LED display and shows its empty-content and material properties', async () => {
      const user = userEvent.setup();
      render(<App />);
      await addSpaceBackground(user);

      await user.click(screen.getByRole('button', { name: ja.editorAddLedButton }));

      expect(screen.getByText(ja.editorContentNoneHint)).toBeInTheDocument();

      expect(screen.getByRole('combobox', { name: ja.editorMaterialLabel })).toHaveValue('led');
      expect(screen.getByText(ja.editorMaterialPreviewNotice)).toBeInTheDocument();
    });

    it('adds an LCD display and its material select shows LCD', async () => {
      const user = userEvent.setup();
      render(<App />);
      await addSpaceBackground(user);

      await user.click(screen.getByRole('button', { name: ja.editorAddLcdButton }));

      expect(screen.getByRole('combobox', { name: ja.editorMaterialLabel })).toHaveValue('lcd');
    });

    it('uploads content into a display, edits fit/offset/scale, and resets placement', async () => {
      const user = userEvent.setup();
      render(<App />);
      await addSpaceBackground(user);

      await user.click(screen.getByRole('button', { name: ja.editorAddLedButton }));

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

      await user.click(
        screen.getByRole('button', { name: ja.editorContentAdvancedSettingsOpenButton }),
      );

      const offsetXInput = screen.getByRole('spinbutton', { name: ja.editorContentOffsetXLabel });
      await user.clear(offsetXInput);
      await user.type(offsetXInput, '0.4');
      await user.tab();
      expect(offsetXInput).toHaveValue(0.4);

      await user.click(screen.getByRole('button', { name: ja.editorContentResetButton }));
      expect(offsetXInput).toHaveValue(0);
    });

    it('removes uploaded content from a display', async () => {
      const user = userEvent.setup();
      render(<App />);
      await addSpaceBackground(user);

      await user.click(screen.getByRole('button', { name: ja.editorAddLedButton }));

      await user.upload(
        screen.getByLabelText(ja.editorContentUploadButton),
        createImageFile('content.png'),
      );
      await user.click(await screen.findByRole('button', { name: ja.editorContentRemoveButton }));

      expect(screen.getByText(ja.editorContentNoneHint)).toBeInTheDocument();
    });

    it('shows an accessible error when uploaded display content fails to decode', async () => {
      const user = userEvent.setup();
      render(<App />);
      await addSpaceBackground(user);
      vi.stubGlobal('Image', FailingImage as unknown as typeof Image);

      await user.click(screen.getByRole('button', { name: ja.editorAddLedButton }));

      await user.upload(
        screen.getByLabelText(ja.editorContentUploadButton),
        createImageFile('content.png'),
      );

      expect(await screen.findByText(ja.editorImageUploadErrorDecodeFailed)).toBeInTheDocument();
    });

    it('uploads a video into a display and shows the autoplay/loop/mute hint', async () => {
      stubVideoElement();
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-video');
      const user = userEvent.setup();
      render(<App />);
      await addSpaceBackground(user);

      await user.click(screen.getByRole('button', { name: ja.editorAddLedButton }));
      await user.upload(screen.getByLabelText(ja.editorContentUploadButton), createVideoFile());

      expect(
        await screen.findByRole('button', { name: ja.editorContentReplaceButton }),
      ).toBeInTheDocument();
      expect(screen.getByText(ja.editorContentVideoAutoplayHint)).toBeInTheDocument();
    });

    it('shows an accessible error when an uploaded video has an unsupported codec', async () => {
      vi.spyOn(HTMLVideoElement.prototype, 'canPlayType').mockReturnValue('');
      const user = userEvent.setup();
      render(<App />);
      await addSpaceBackground(user);

      await user.click(screen.getByRole('button', { name: ja.editorAddLedButton }));
      await user.upload(screen.getByLabelText(ja.editorContentUploadButton), createVideoFile());

      expect(
        await screen.findByText(ja.editorVideoUploadErrorUnsupportedCodec),
      ).toBeInTheDocument();
      expect(screen.getByText(ja.editorContentNoneHint)).toBeInTheDocument();
    });

    it('shows an accessible error when an uploaded video decodes to oversized dimensions', async () => {
      stubRealVideoElementWith({ videoWidth: 3840, videoHeight: 2160 });
      const user = userEvent.setup();
      render(<App />);
      await addSpaceBackground(user);

      await user.click(screen.getByRole('button', { name: ja.editorAddLedButton }));
      await user.upload(screen.getByLabelText(ja.editorContentUploadButton), createVideoFile());

      expect(
        await screen.findByText(ja.editorVideoUploadErrorDimensionsTooLarge),
      ).toBeInTheDocument();
      expect(screen.getByText(ja.editorContentNoneHint)).toBeInTheDocument();
    });

    it('shows an accessible error when an uploaded video is longer than the duration limit', async () => {
      stubRealVideoElementWith({ videoWidth: 1280, videoHeight: 720, duration: 45 });
      const user = userEvent.setup();
      render(<App />);
      await addSpaceBackground(user);

      await user.click(screen.getByRole('button', { name: ja.editorAddLedButton }));
      await user.upload(screen.getByLabelText(ja.editorContentUploadButton), createVideoFile());

      expect(await screen.findByText(ja.editorVideoUploadErrorDurationTooLong)).toBeInTheDocument();
      expect(screen.getByText(ja.editorContentNoneHint)).toBeInTheDocument();
    });

    it('changes the display material and resets material effects to its material default', async () => {
      const user = userEvent.setup();
      render(<App />);
      await addSpaceBackground(user);

      await user.click(screen.getByRole('button', { name: ja.editorAddLedButton }));

      const materialSelect = screen.getByRole('combobox', { name: ja.editorMaterialLabel });
      await user.selectOptions(materialSelect, 'lcd');
      expect(materialSelect).toHaveValue('lcd');

      const intensitySlider = screen.getByRole('slider', { name: ja.editorMaterialIntensityLabel });
      fireEvent.input(intensitySlider, { target: { value: '80' } });
      fireEvent.pointerUp(intensitySlider);
      expect(intensitySlider).toHaveValue('80');

      await user.click(screen.getByRole('button', { name: ja.editorAdvancedSettingsOpenButton }));
      await user.click(screen.getByRole('button', { name: ja.editorMaterialResetButton }));
      // LCD's own Natural-preset baseline (see renderingPresets.ts), not a flat generic value.
      expect(intensitySlider).toHaveValue('18');
    });

    it('clicking a rendering preset button updates material sliders and marks itself active', async () => {
      const user = userEvent.setup();
      render(<App />);
      await addSpaceBackground(user);

      await user.click(screen.getByRole('button', { name: ja.editorAddLedButton }));

      const naturalButton = screen.getByRole('button', { name: ja.editorRenderingPresetNatural });
      const nightButton = screen.getByRole('button', { name: ja.editorRenderingPresetNight });
      expect(naturalButton).toHaveAttribute('aria-pressed', 'true');
      expect(nightButton).toHaveAttribute('aria-pressed', 'false');

      const brightnessSlider = screen.getByRole('slider', {
        name: ja.editorMaterialBrightnessLabel,
      });
      const naturalBrightness = brightnessSlider.getAttribute('value');

      await user.click(nightButton);

      expect(nightButton).toHaveAttribute('aria-pressed', 'true');
      expect(naturalButton).toHaveAttribute('aria-pressed', 'false');
      expect(brightnessSlider.getAttribute('value')).not.toBe(naturalBrightness);
      expect(Number(brightnessSlider.getAttribute('value'))).toBeLessThan(
        Number(naturalBrightness),
      );
    });

    it('undoing an added display removes it and clears the properties panel', async () => {
      const user = userEvent.setup();
      render(<App />);
      await addSpaceBackground(user);

      await user.click(screen.getByRole('button', { name: ja.editorAddLedButton }));

      expect(screen.getByText(ja.editorContentNoneHint)).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: ja.editorUndoButton }));

      expect(screen.getByText(ja.editorPropertiesEmptyHint)).toBeInTheDocument();
    });
  });

  describe('Sprint 4.1: original/result comparison toggle', () => {
    it('switching to the original view clears the selection; switching back restores it', async () => {
      const user = userEvent.setup();
      render(<App />);
      await addSpaceBackground(user);

      await user.click(screen.getByRole('button', { name: ja.editorAddLedButton }));
      expect(screen.getByRole('button', { name: ja.editorDeleteButton })).toBeEnabled();

      const resultButton = screen.getByRole('button', { name: ja.comparisonResultLabel });
      const originalButton = screen.getByRole('button', { name: ja.comparisonOriginalLabel });
      expect(resultButton).toHaveAttribute('aria-pressed', 'true');
      expect(originalButton).toHaveAttribute('aria-pressed', 'false');

      await user.click(originalButton);

      expect(originalButton).toHaveAttribute('aria-pressed', 'true');
      expect(resultButton).toHaveAttribute('aria-pressed', 'false');
      expect(screen.getByRole('button', { name: ja.editorDeleteButton })).toBeDisabled();
      expect(screen.queryByText(ja.comparisonOriginalNoSpaceHint)).not.toBeInTheDocument();

      await user.click(resultButton);

      expect(resultButton).toHaveAttribute('aria-pressed', 'true');
      expect(originalButton).toHaveAttribute('aria-pressed', 'false');
    });

    it('shows the no-space hint when switching to the original view before any space background exists', async () => {
      const user = userEvent.setup();
      render(<App />);

      const originalButton = screen.getByRole('button', { name: ja.comparisonOriginalLabel });
      await user.click(originalButton);

      expect(originalButton).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByText(ja.comparisonOriginalNoSpaceHint)).toBeInTheDocument();
    });
  });

  describe('Portable template signage', () => {
    it('adds a portable directly without a wizard and selects it', async () => {
      const user = userEvent.setup();
      render(<App />);
      await addSpaceBackground(user);

      await user.click(screen.getByRole('button', { name: ja.editorAddPortableButton }));

      // The old build wizard is gone — no modal, no photo upload step.
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

      const state = useEditorStore.getState();
      expect(state.document.objects).toHaveLength(1);
      const object = state.document.objects[0]!;
      expect(object.kind).toBe('portable');
      expect(state.selectedId).toBe(object.id);
      if (object.kind === 'portable') {
        // `angled-right` is the default view — matches the reference 3/4 product photo where
        // the stand + wheel are visible on the left of the composition.
        expect(object.templateView).toBe('angled-right');
        // LCD is the material portable ships with — the "screen shows as an LCD screen" ask.
        expect(object.material).toBe('lcd');
      }
    });

    it('lets the user switch between the three template views', async () => {
      const user = userEvent.setup();
      render(<App />);
      await addSpaceBackground(user);

      await user.click(screen.getByRole('button', { name: ja.editorAddPortableButton }));

      const viewSelect = screen.getByRole('combobox', { name: ja.portableViewLabel });
      expect(viewSelect).toHaveValue('angled-right');

      await user.selectOptions(viewSelect, 'front');
      expect(useEditorStore.getState().document.objects[0]).toMatchObject({
        kind: 'portable',
        templateView: 'front',
      });

      // `angled-left` renders the same docodemo.webp source asset flipped via a scaleX={-1}
      // wrapper in PortableTemplateBody — no separate left-facing photo is bundled.
      await user.selectOptions(viewSelect, 'angled-left');
      expect(useEditorStore.getState().document.objects[0]).toMatchObject({
        kind: 'portable',
        templateView: 'angled-left',
      });
    });

    it('translates the Add Portable button in Korean and English', async () => {
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
