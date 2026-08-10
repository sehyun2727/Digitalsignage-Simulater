import { useEffect, useId, useRef, useState } from 'react';
import { useLocale } from '../../i18n/localeContext';
import {
  detectHasAlpha,
  getRegisteredAsset,
  registerAsset,
  releaseAsset,
} from '../../lib/assetRegistry';
import { ACCEPTED_IMAGE_TYPES, validateImageFile } from '../../lib/fileValidation';
import {
  clampNormalizedRect,
  defaultScreenRegion,
  isNormalizedRectLargeEnough,
  normalizedRectFromPoints,
  previewPointToNormalized,
} from '../../lib/portableRegion';
import { useEditorStore } from '../../store/editorStore';
import type { ImageValidationError } from '../../lib/fileValidation';
import type { NormalizedRect } from '../../lib/portableRegion';
import type { PortableSignageObject } from '../../types/editor';

interface PortableBuilderModalProps {
  /** 'create' walks photo-select then region steps; 'edit-region' re-enters on an existing object. */
  mode: 'create' | 'edit-region';
  editingObject?: PortableSignageObject;
  onClose: () => void;
  onImageError: (error: ImageValidationError) => void;
}

interface PendingPhoto {
  sourceId: string;
  naturalWidth: number;
  naturalHeight: number;
  hasAlpha: boolean | null;
  previewUrl: string;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function PortableBuilderModal({
  mode,
  editingObject,
  onClose,
  onImageError,
}: PortableBuilderModalProps) {
  const { messages } = useLocale();
  const addPortable = useEditorStore((state) => state.addPortable);
  const commitObjectChange = useEditorStore((state) => state.commitObjectChange);

  const [step, setStep] = useState<'photo' | 'region'>(mode === 'edit-region' ? 'region' : 'photo');
  const [pendingPhoto, setPendingPhoto] = useState<PendingPhoto | null>(null);
  const [region, setRegion] = useState<NormalizedRect>(
    editingObject?.screenRegion ?? defaultScreenRegion(),
  );
  const [regionError, setRegionError] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const pendingPhotoRef = useRef<PendingPhoto | null>(null);
  useEffect(() => {
    pendingPhotoRef.current = pendingPhoto;
  }, [pendingPhoto]);

  const dialogRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previouslyFocusedRef = useRef<Element | null>(null);
  const titleId = useId();

  const wasCommittedRef = useRef(false);

  const handleCancel = () => {
    onClose();
  };

  // Focus trap, initial focus, Esc-to-close, and background scroll lock — this is the first
  // modal dialog in the app, so all of this is built from scratch rather than reused.
  useEffect(() => {
    previouslyFocusedRef.current = window.document.activeElement;
    const dialog = dialogRef.current;
    const firstFocusable = dialog?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    firstFocusable?.focus();

    const originalOverflow = window.document.body.style.overflow;
    window.document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && window.document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && window.document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.document.removeEventListener('keydown', handleKeyDown);
      window.document.body.style.overflow = originalOverflow;
      if (previouslyFocusedRef.current instanceof HTMLElement) {
        previouslyFocusedRef.current.focus();
      }
      // A pending photo that was uploaded but never committed to the document (cancel, or the
      // component unmounting some other way) is unreachable from any document/history snapshot,
      // so the reachability-based sweep in editorStore.ts would never revoke it on its own.
      if (!wasCommittedRef.current && pendingPhotoRef.current) {
        releaseAsset(pendingPhotoRef.current.sourceId);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePhotoFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const error = validateImageFile(file);
    if (error) {
      onImageError(error);
      return;
    }

    try {
      const asset = await registerAsset(file);
      const registered = getRegisteredAsset(asset.sourceId);
      if (pendingPhoto) releaseAsset(pendingPhoto.sourceId);
      setPendingPhoto({
        sourceId: asset.sourceId,
        naturalWidth: asset.naturalWidth,
        naturalHeight: asset.naturalHeight,
        hasAlpha: registered ? detectHasAlpha(registered.image) : null,
        previewUrl: registered?.objectUrl ?? '',
      });
      setRegion(defaultScreenRegion());
    } catch {
      onImageError('decode-error');
    }
  };

  const goToRegionStep = () => {
    if (!pendingPhoto) return;
    setStep('region');
  };

  const previewSize = () => {
    const element = previewRef.current;
    if (!element) return { width: 0, height: 0 };
    const box = element.getBoundingClientRect();
    return { width: box.width, height: box.height };
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const element = previewRef.current;
    if (!element) return;
    const box = element.getBoundingClientRect();
    const point = previewPointToNormalized(
      { x: event.clientX - box.left, y: event.clientY - box.top },
      previewSize(),
    );
    dragStartRef.current = point;
    setRegion(normalizedRectFromPoints(point, point));
    setRegionError(false);
    element.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStartRef.current) return;
    const element = previewRef.current;
    if (!element) return;
    const box = element.getBoundingClientRect();
    const point = previewPointToNormalized(
      { x: event.clientX - box.left, y: event.clientY - box.top },
      previewSize(),
    );
    setRegion(normalizedRectFromPoints(dragStartRef.current, point));
  };

  const handlePointerUp = () => {
    dragStartRef.current = null;
    setRegionError(!isNormalizedRectLargeEnough(region));
  };

  const handleNumericFieldChange = (key: keyof NormalizedRect, value: number) => {
    setRegion((current) => clampNormalizedRect({ ...current, [key]: value }));
    setRegionError(false);
  };

  const handleResetRegion = () => {
    setRegion(defaultScreenRegion());
    setRegionError(false);
  };

  const handleConfirm = () => {
    if (!isNormalizedRectLargeEnough(region)) {
      setRegionError(true);
      return;
    }

    if (mode === 'edit-region' && editingObject) {
      commitObjectChange(editingObject.id, { screenRegion: region });
      wasCommittedRef.current = true;
      onClose();
      return;
    }

    if (!pendingPhoto) return;
    addPortable({
      productSourceId: pendingPhoto.sourceId,
      productIntrinsicWidth: pendingPhoto.naturalWidth,
      productIntrinsicHeight: pendingPhoto.naturalHeight,
      productHasAlpha: pendingPhoto.hasAlpha,
      screenRegion: region,
    });
    wasCommittedRef.current = true;
    onClose();
  };

  const photoPreviewUrl =
    mode === 'edit-region' && editingObject
      ? getRegisteredAsset(editingObject.productSourceId)?.objectUrl
      : pendingPhoto?.previewUrl;

  return (
    <div
      className="modal-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) handleCancel();
      }}
    >
      <div
        className="modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={dialogRef}
      >
        {step === 'photo' && (
          <>
            <h2 id={titleId}>{messages.portableStepSelectPhotoTitle}</h2>
            <p className="editor-properties-notice">{messages.portableSupportedFormatsHint}</p>
            <p className="editor-properties-notice">{messages.portableBackgroundNotice}</p>
            <p className="editor-properties-notice">{messages.portableRightsNotice}</p>

            {pendingPhoto ? (
              <img src={pendingPhoto.previewUrl} alt="" className="portable-builder-photo-thumb" />
            ) : (
              <p>{messages.portableNoPhotoSelectedHint}</p>
            )}

            <div className="editor-properties-actions">
              <button type="button" onClick={() => fileInputRef.current?.click()}>
                {pendingPhoto
                  ? messages.portableChangePhotoButton
                  : messages.portableSelectPhotoButton}
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_IMAGE_TYPES.join(',')}
              onChange={handlePhotoFileChange}
              className="visually-hidden"
              aria-label={messages.portableSelectPhotoButton}
            />

            <div className="editor-properties-actions">
              <button type="button" onClick={handleCancel}>
                {messages.portableCancelButton}
              </button>
              <button type="button" onClick={goToRegionStep} disabled={!pendingPhoto}>
                {messages.portableNextButton}
              </button>
            </div>
          </>
        )}

        {step === 'region' && (
          <>
            <h2 id={titleId}>{messages.portableStepDefineRegionTitle}</h2>
            <p className="editor-properties-notice">{messages.portableScreenRegionDragHint}</p>

            <div
              ref={previewRef}
              className="portable-region-preview"
              style={photoPreviewUrl ? { backgroundImage: `url(${photoPreviewUrl})` } : undefined}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
            >
              <div
                className="portable-region-box"
                style={{
                  left: `${region.x * 100}%`,
                  top: `${region.y * 100}%`,
                  width: `${region.width * 100}%`,
                  height: `${region.height * 100}%`,
                }}
              />
            </div>

            <label>
              <span>{messages.portableScreenRegionXLabel}</span>
              <input
                type="number"
                step={0.01}
                min={0}
                max={1}
                value={Number(region.x.toFixed(2))}
                onChange={(event) => handleNumericFieldChange('x', Number(event.target.value))}
              />
            </label>
            <label>
              <span>{messages.portableScreenRegionYLabel}</span>
              <input
                type="number"
                step={0.01}
                min={0}
                max={1}
                value={Number(region.y.toFixed(2))}
                onChange={(event) => handleNumericFieldChange('y', Number(event.target.value))}
              />
            </label>
            <label>
              <span>{messages.portableScreenRegionWidthLabel}</span>
              <input
                type="number"
                step={0.01}
                min={0}
                max={1}
                value={Number(region.width.toFixed(2))}
                onChange={(event) => handleNumericFieldChange('width', Number(event.target.value))}
              />
            </label>
            <label>
              <span>{messages.portableScreenRegionHeightLabel}</span>
              <input
                type="number"
                step={0.01}
                min={0}
                max={1}
                value={Number(region.height.toFixed(2))}
                onChange={(event) => handleNumericFieldChange('height', Number(event.target.value))}
              />
            </label>

            {regionError && (
              <p role="alert" className="editor-properties-error">
                {messages.portableScreenRegionMinSizeError}
              </p>
            )}

            <div className="editor-properties-actions">
              <button type="button" onClick={handleResetRegion}>
                {messages.portableScreenRegionResetButton}
              </button>
            </div>

            <div className="editor-properties-actions">
              <button type="button" onClick={handleCancel}>
                {messages.portableCancelButton}
              </button>
              {mode === 'create' && (
                <button type="button" onClick={() => setStep('photo')}>
                  {messages.portableBackButton}
                </button>
              )}
              <button type="button" onClick={handleConfirm}>
                {mode === 'create' ? messages.portableAddButton : messages.portableSaveButton}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
