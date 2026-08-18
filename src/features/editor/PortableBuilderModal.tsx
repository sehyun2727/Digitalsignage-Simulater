import { useEffect, useId, useRef, useState } from 'react';
import { useLocale } from '../../i18n/localeContext';
import { useModalDialog } from './useModalDialog';
import {
  detectHasAlpha,
  getRegisteredAsset,
  registerAsset,
  releaseAsset,
} from '../../lib/assetRegistry';
import {
  ACCEPTED_IMAGE_TYPES,
  validateImageDimensions,
  validateImageFile,
} from '../../lib/fileValidation';
import {
  clampNormalizedRect,
  computeContainRect,
  defaultScreenRegion,
  isNormalizedRectLargeEnough,
  moveNormalizedRect,
  normalizedRectFromPoints,
  previewPointToNormalized,
  resizeNormalizedRectClamped,
} from '../../lib/portableRegion';
import { useEditorStore } from '../../store/editorStore';
import type { ImageValidationError } from '../../lib/fileValidation';
import type { NormalizedRect, ResizeHandle } from '../../lib/portableRegion';
import type { PortableSignageObject } from '../../types/editor';

const RESIZE_HANDLES: ResizeHandle[] = ['nw', 'ne', 'sw', 'se'];

type RegionInteraction =
  | { mode: 'draw'; start: { x: number; y: number } }
  | { mode: 'move'; regionAtStart: NormalizedRect; pointerStart: { x: number; y: number } }
  | { mode: 'resize'; handle: ResizeHandle };

interface PortableBuilderModalProps {
  /**
   * 'create' walks photo-select then region steps; 'edit-region' re-enters on an existing
   * object's region step only; 'replace-photo' re-enters on the photo step but still ends by
   * committing to the existing object (with the region reset, since the new photo's aspect
   * ratio may no longer fit the old region).
   */
  mode: 'create' | 'edit-region' | 'replace-photo';
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
  const [previewBox, setPreviewBox] = useState({ width: 0, height: 0 });
  const interactionRef = useRef<RegionInteraction | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const pendingPhotoRef = useRef<PendingPhoto | null>(null);
  useEffect(() => {
    pendingPhotoRef.current = pendingPhoto;
  }, [pendingPhoto]);

  const { dialogRef, titleId } = useModalDialog(onClose);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const moveResizeHintId = useId();

  const wasCommittedRef = useRef(false);

  const handleCancel = () => {
    onClose();
  };

  // A pending photo that was uploaded but never committed to the document (cancel, or the
  // component unmounting some other way) is unreachable from any document/history snapshot, so
  // the reachability-based sweep in editorStore.ts would never revoke it on its own.
  useEffect(() => {
    return () => {
      if (!wasCommittedRef.current && pendingPhotoRef.current) {
        releaseAsset(pendingPhotoRef.current.sourceId);
      }
    };
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
      const dimensionError = validateImageDimensions(asset.naturalWidth, asset.naturalHeight);
      if (dimensionError) {
        releaseAsset(asset.sourceId);
        onImageError(dimensionError);
        return;
      }
      const registered = getRegisteredAsset(asset.sourceId);
      if (pendingPhoto) releaseAsset(pendingPhoto.sourceId);
      setPendingPhoto({
        sourceId: asset.sourceId,
        naturalWidth: asset.naturalWidth,
        naturalHeight: asset.naturalHeight,
        // registerAsset (used here, never registerVideoAsset) only ever produces an image/canvas
        // source, but the shared RegisteredAsset.image type also allows HTMLVideoElement.
        hasAlpha:
          registered && !(registered.image instanceof HTMLVideoElement)
            ? detectHasAlpha(registered.image)
            : null,
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

  // The photo's own intrinsic size (not the preview container's) — needed to resolve the
  // background-size:contain letterboxing below, since it's independent of `mode`.
  const photoNaturalSize =
    mode === 'edit-region' && editingObject
      ? { width: editingObject.productIntrinsicWidth, height: editingObject.productIntrinsicHeight }
      : pendingPhoto
        ? { width: pendingPhoto.naturalWidth, height: pendingPhoto.naturalHeight }
        : null;

  // Re-measure whenever the region step becomes visible and on viewport resize, so the
  // region box/handles stay aligned with the photo after the builder or window is resized —
  // normalized region values themselves never depend on this and are never recomputed here.
  useEffect(() => {
    if (step !== 'region') return;
    const measure = () => {
      const box = previewRef.current?.getBoundingClientRect();
      if (box) setPreviewBox({ width: box.width, height: box.height });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [step]);

  // Where the photo actually renders inside the (possibly letterboxed) preview box — pointer
  // coordinates and the region box/handles are both positioned against this, not the raw
  // container, so a non-4:3 photo's screen region tracks the photo's own pixels correctly.
  const containRect = photoNaturalSize
    ? computeContainRect(previewBox, photoNaturalSize)
    : { x: 0, y: 0, width: previewBox.width, height: previewBox.height };

  const pointFromEvent = (event: React.PointerEvent<HTMLDivElement>): { x: number; y: number } => {
    const element = previewRef.current;
    if (!element) return { x: 0, y: 0 };
    const box = element.getBoundingClientRect();
    return previewPointToNormalized(
      {
        x: event.clientX - box.left - containRect.x,
        y: event.clientY - box.top - containRect.y,
      },
      { width: containRect.width, height: containRect.height },
    );
  };

  const finishInteraction = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!interactionRef.current) return;
    interactionRef.current = null;
    if (previewRef.current?.hasPointerCapture(event.pointerId)) {
      previewRef.current.releasePointerCapture(event.pointerId);
    }
    setRegion((current) => {
      setRegionError(!isNormalizedRectLargeEnough(current));
      return current;
    });
  };

  // Drawing a brand-new region from scratch (pointer down on empty preview space, i.e. not on
  // the existing region box or one of its resize handles).
  const handlePreviewPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const point = pointFromEvent(event);
    interactionRef.current = { mode: 'draw', start: point };
    setRegion(normalizedRectFromPoints(point, point));
    setRegionError(false);
    previewRef.current?.setPointerCapture(event.pointerId);
  };

  // Moving the existing region: pointer down inside its box. The pointer's offset from the
  // region's top-left is preserved via a delta (not by re-deriving position from the raw
  // pointer point), so the box doesn't jump to re-center under the cursor.
  const handleBoxPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    interactionRef.current = {
      mode: 'move',
      regionAtStart: region,
      pointerStart: pointFromEvent(event),
    };
    setRegionError(false);
    previewRef.current?.setPointerCapture(event.pointerId);
  };

  // Resizing via one of the four corner handles, opposite corner fixed.
  const handleHandlePointerDown =
    (handle: ResizeHandle) => (event: React.PointerEvent<HTMLDivElement>) => {
      event.stopPropagation();
      interactionRef.current = { mode: 'resize', handle };
      setRegionError(false);
      previewRef.current?.setPointerCapture(event.pointerId);
    };

  const handlePreviewPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const interaction = interactionRef.current;
    if (!interaction) return;
    const point = pointFromEvent(event);
    if (interaction.mode === 'draw') {
      setRegion(normalizedRectFromPoints(interaction.start, point));
    } else if (interaction.mode === 'move') {
      const delta = {
        dx: point.x - interaction.pointerStart.x,
        dy: point.y - interaction.pointerStart.y,
      };
      setRegion(moveNormalizedRect(interaction.regionAtStart, delta));
    } else {
      const handle = interaction.handle;
      setRegion((current) => resizeNormalizedRectClamped(current, handle, point));
    }
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

    if (mode === 'replace-photo' && editingObject) {
      if (!pendingPhoto) return;
      commitObjectChange(editingObject.id, {
        productSourceId: pendingPhoto.sourceId,
        productIntrinsicWidth: pendingPhoto.naturalWidth,
        productIntrinsicHeight: pendingPhoto.naturalHeight,
        productHasAlpha: pendingPhoto.hasAlpha,
        screenRegion: region,
      });
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
            <p id={moveResizeHintId} className="editor-properties-notice">
              {messages.portableScreenRegionMoveResizeHint}
            </p>

            <div
              ref={previewRef}
              className="portable-region-preview"
              style={photoPreviewUrl ? { backgroundImage: `url(${photoPreviewUrl})` } : undefined}
              onPointerDown={handlePreviewPointerDown}
              onPointerMove={handlePreviewPointerMove}
              onPointerUp={finishInteraction}
              onPointerCancel={finishInteraction}
            >
              <div
                className="portable-region-box"
                aria-hidden="true"
                style={{
                  left: `${containRect.x + region.x * containRect.width}px`,
                  top: `${containRect.y + region.y * containRect.height}px`,
                  width: `${region.width * containRect.width}px`,
                  height: `${region.height * containRect.height}px`,
                }}
                onPointerDown={handleBoxPointerDown}
              >
                {RESIZE_HANDLES.map((handle) => (
                  <div
                    key={handle}
                    className={`portable-region-handle portable-region-handle--${handle}`}
                    onPointerDown={handleHandlePointerDown(handle)}
                  />
                ))}
              </div>
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
                aria-describedby={moveResizeHintId}
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
                aria-describedby={moveResizeHintId}
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
                aria-describedby={moveResizeHintId}
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
                aria-describedby={moveResizeHintId}
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
              {(mode === 'create' || mode === 'replace-photo') && (
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
