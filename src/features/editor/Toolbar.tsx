import { useEffect, useRef, useState } from 'react';
import { useLocale } from '../../i18n/localeContext';
import { getRegisteredAsset, registerSpaceBackgroundAsset } from '../../lib/assetRegistry';
import {
  clampContentOffset,
  clampContentScale,
  clampMaterialSetting,
  computeAutoContentRotation,
} from '../../lib/contentLayout';
import { getObjectScreenRect } from '../../lib/screenHitTest';
import { clampCurvatureAmount, isCurvatureSupported } from '../../lib/curvature';
import type { ContentValidationError } from '../../lib/contentUpload';
import {
  ContentDimensionError,
  contentKindForFile,
  registerContentAsset,
  validateContentFile,
} from '../../lib/contentUpload';
import {
  clampContactShadowOffset,
  clampContactShadowSetting,
  clampContactShadowSpread,
  clampContactShadowTint,
  clampEnvironmentIntegration,
} from '../../lib/environmentIntegration';
import { validateOcclusionPolygon } from '../../lib/occlusion';
import type { OcclusionInvalidReason } from '../../lib/occlusion';
import {
  clampPoint01 as clampQuadPoint01,
  QUAD_CORNER_ORDER,
  validateQuad,
} from '../../lib/quadGeometry';
import type { QuadCorner, QuadInvalidReason } from '../../lib/quadGeometry';
import { ACCEPTED_IMAGE_TYPES, validateImageFile } from '../../lib/fileValidation';
import { normalizeMaterial } from '../../lib/materialTexture';
import {
  detectActivePreset,
  getPresetContactShadow,
  getPresetMaterialSettings,
  getPresetEnvironmentIntegration,
  RENDERING_PRESET_IDS,
  resolvePresetPatch,
  type RenderingPresetId,
} from '../../lib/renderingPresets';
import { selectSelectedObject, useEditorStore } from '../../store/editorStore';
import { useUiStore } from '../../store/uiStore';
import {
  CANVAS_PRESET_IDS,
  CURRENT_DISPLAY_MATERIALS,
  DEFAULT_CURVATURE,
  getDocumentSize,
  MAX_CONTENT_SCALE,
  MAX_CONTACT_SHADOW_SETTING,
  MAX_CONTACT_SHADOW_SPREAD,
  MAX_CONTACT_SHADOW_TINT,
  MAX_CURVATURE_AMOUNT,
  MAX_ENVIRONMENT_INTEGRATION,
  MAX_MATERIAL_SETTING,
  MIN_CONTENT_SCALE,
  MIN_CONTACT_SHADOW_SETTING,
  MIN_CONTACT_SHADOW_SPREAD,
  MIN_CONTACT_SHADOW_TINT,
  MIN_CURVATURE_AMOUNT,
  MIN_ENVIRONMENT_INTEGRATION,
  MIN_MATERIAL_SETTING,
  supportsPerspective,
} from '../../types/editor';
import { ACCEPTED_VIDEO_TYPES } from '../../lib/videoValidation';
import {
  PORTABLE_TEMPLATE_VIEWS,
  type PortableTemplateView,
} from '../../lib/portableTemplate';
import { AdvancedSettingsModal } from './AdvancedSettingsModal';
import { RealismGuideCard } from './RealismGuideCard';
import type { ImageValidationError } from '../../lib/fileValidation';
import type {
  CanvasPresetId,
  ContactShadowSettings,
  ContentFit,
  ContentKind,
  CurvatureMode,
  DisplayMaterial,
  DisplaySignageObject,
  EnvironmentIntegrationSettings,
  InstallationMode,
  MaterialSettings,
  PerspectiveCapableObject,
  PortableSignageObject,
  SignageObject,
} from '../../types/editor';

interface ToolbarProps {
  onImageError: (error: ImageValidationError) => void;
  onContentError: (kind: ContentKind, error: ContentValidationError) => void;
}

/**
 * The single always-visible right-side toolbar (Sprint 4.1 correction, Sprint 4.2 photo-first
 * rework). Six fixed sections in a fixed order — Space, Add signage, Selected signage, Content,
 * Appearance, Export — so nothing here is mounted/unmounted based on navigation, and every
 * control stays reachable at all times. The document/export size is a fixed canvasPreset chosen
 * in the Space section, independent of the uploaded photo (see ADR 0011); every other section is
 * still gated on the photo existing, unchanged from before.
 */
export function Toolbar({ onImageError, onContentError }: ToolbarProps) {
  const { messages } = useLocale();

  return (
    <div className="toolbar" aria-label={messages.toolbarAriaLabel}>
      <SpaceSection onImageError={onImageError} />
      <AddSignageSection />
      <SelectedSignageSection />
      <ContentSection onContentError={onContentError} onImageError={onImageError} />
      <AppearanceSection />
      <ExportSection />
    </div>
  );
}

function ToolbarSection({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section className="toolbar-section">
      <h2 className="toolbar-section-heading">{heading}</h2>
      {children}
    </section>
  );
}

function SpaceBackgroundThumbnail({ sourceId }: { sourceId: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // A plain <img src> can't represent a downscaled space background, whose decoded asset is an
  // offscreen HTMLCanvasElement rather than a Blob URL (see assetRegistry.registerSpaceBackgroundAsset).
  // Drawing into a small preview canvas works uniformly for either asset shape.
  useEffect(() => {
    const asset = getRegisteredAsset(sourceId);
    const canvas = canvasRef.current;
    if (!asset || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const scale = Math.min(canvas.width / asset.naturalWidth, canvas.height / asset.naturalHeight);
    const drawWidth = asset.naturalWidth * scale;
    const drawHeight = asset.naturalHeight * scale;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(
      asset.image,
      (canvas.width - drawWidth) / 2,
      (canvas.height - drawHeight) / 2,
      drawWidth,
      drawHeight,
    );
  }, [sourceId]);

  return (
    <canvas
      ref={canvasRef}
      className="space-background-thumb"
      width={160}
      height={90}
      aria-hidden="true"
    />
  );
}

function SpaceSection({ onImageError }: { onImageError: (error: ImageValidationError) => void }) {
  const { messages } = useLocale();
  const spaceBackground = useEditorStore((state) => state.document.spaceBackground);
  const canvasPreset = useEditorStore((state) => state.document.canvasPreset);
  const setSpaceBackground = useEditorStore((state) => state.setSpaceBackground);
  const removeSpaceBackground = useEditorStore((state) => state.removeSpaceBackground);
  const setCanvasPreset = useEditorStore((state) => state.setCanvasPreset);
  const spaceBackgroundInputRef = useRef<HTMLInputElement | null>(null);

  const handleSpaceBackgroundChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const error = validateImageFile(file);
    if (error) {
      onImageError(error);
      return;
    }

    try {
      const asset = await registerSpaceBackgroundAsset(file);
      setSpaceBackground(asset);
    } catch {
      onImageError('decode-error');
    }
  };

  const addOrReplaceLabel = spaceBackground
    ? messages.editorReplaceSpaceBackgroundButton
    : messages.editorAddSpaceBackgroundButton;

  return (
    <ToolbarSection heading={messages.toolbarSpaceSectionHeading}>
      <div
        className="canvas-preset-group"
        role="group"
        aria-label={messages.editorCanvasPresetLabel}
      >
        <span>{messages.editorCanvasPresetLabel}</span>
        <div className="toolbar-actions">
          {CANVAS_PRESET_IDS.map((preset) => (
            <button
              key={preset}
              type="button"
              className={canvasPreset === preset ? 'is-active' : undefined}
              aria-pressed={canvasPreset === preset}
              onClick={() => setCanvasPreset(preset)}
            >
              {canvasPresetLabel(preset, messages)}
            </button>
          ))}
        </div>
      </div>

      {!spaceBackground && <p className="toolbar-notice">{messages.toolbarSpaceEmptyHint}</p>}

      {spaceBackground && (
        <>
          <SpaceBackgroundThumbnail sourceId={spaceBackground.sourceId} />
          <p className="toolbar-notice">
            {messages.editorSpaceBackgroundDimensionsLabel}: {spaceBackground.width} ×{' '}
            {spaceBackground.height} px
          </p>
          {spaceBackground.downscaled && (
            <p className="toolbar-notice">{messages.editorSpaceBackgroundDownscaledNotice}</p>
          )}
        </>
      )}
      <p className="toolbar-notice">{messages.editorSpaceBackgroundPrivacyNotice}</p>

      <div className="toolbar-actions">
        <button
          type="button"
          id="toolbar-space-upload-trigger"
          onClick={() => spaceBackgroundInputRef.current?.click()}
        >
          {addOrReplaceLabel}
        </button>
        {spaceBackground && (
          <button type="button" onClick={removeSpaceBackground}>
            {messages.editorRemoveSpaceBackgroundButton}
          </button>
        )}
      </div>
      <input
        ref={spaceBackgroundInputRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(',')}
        onChange={handleSpaceBackgroundChange}
        className="visually-hidden"
        aria-label={addOrReplaceLabel}
      />
    </ToolbarSection>
  );
}

function AddSignageSection() {
  const { messages } = useLocale();
  const document = useEditorStore((state) => state.document);
  const addDisplay = useEditorStore((state) => state.addDisplay);
  const addPortable = useEditorStore((state) => state.addPortable);
  const canAddSignage = document.spaceBackground !== null;

  return (
    <ToolbarSection heading={messages.toolbarAddSignageSectionHeading}>
      {!canAddSignage && <p className="toolbar-notice">{messages.toolbarAddSignageDisabledHint}</p>}

      <div className="toolbar-actions toolbar-actions-grid">
        <button
          type="button"
          id="toolbar-add-signage-trigger"
          disabled={!canAddSignage}
          onClick={() => addDisplay('led')}
        >
          {messages.editorAddLedButton}
        </button>
        <button type="button" disabled={!canAddSignage} onClick={() => addDisplay('lcd')}>
          {messages.editorAddLcdButton}
        </button>
        <button
          type="button"
          disabled={!canAddSignage}
          onClick={() => addDisplay('transparent-led')}
        >
          {messages.editorAddTransparentLedButton}
        </button>
        {/* Portable is now a fixed vector template — click adds directly, no photo-upload
            wizard needed. Its screen still receives content via the same drop-onto-signage /
            Add Image flow every other signage kind uses. */}
        <button type="button" disabled={!canAddSignage} onClick={() => addPortable()}>
          {messages.editorAddPortableButton}
        </button>
      </div>
    </ToolbarSection>
  );
}

/** Add Text / Add Image controls that were previously mixed in with the signage-creation
 *  buttons — moved next to the content controls so the same section handles every "put something
 *  on / into the canvas" flow. Add Image still routes into a selected display/portable as its
 *  screen content (the drop-into-signage flow) when one is selected, and falls back to adding a
 *  floating image element otherwise; Add Text always adds a floating text element. */
function AddCanvasElementControls({
  onImageError,
}: {
  onImageError: (error: ImageValidationError) => void;
}) {
  const { messages } = useLocale();
  const document = useEditorStore((state) => state.document);
  const addText = useEditorStore((state) => state.addText);
  const addImage = useEditorStore((state) => state.addImage);
  const commitObjectChange = useEditorStore((state) => state.commitObjectChange);
  const selectedObject = useEditorStore(selectSelectedObject);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const canAddElement = document.spaceBackground !== null;

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const error = validateImageFile(file);
    if (error) {
      onImageError(error);
      return;
    }

    try {
      const asset = await registerContentAsset(file);
      // Selected display/portable → assign as its screen content (matches drag-and-drop flow).
      // Anything else selected (or nothing) → add as a floating image element on top.
      if (selectedObject?.kind === 'display' || selectedObject?.kind === 'portable') {
        const screenRect = getObjectScreenRect(selectedObject);
        const rotation = screenRect
          ? computeAutoContentRotation(
              screenRect.width,
              screenRect.height,
              asset.naturalWidth,
              asset.naturalHeight,
            )
          : 0;
        commitObjectChange(selectedObject.id, {
          content: {
            kind: asset.kind,
            sourceId: asset.sourceId,
            fit: selectedObject.content?.fit ?? 'contain',
            offsetX: 0,
            offsetY: 0,
            scale: 1,
            rotation,
          },
        });
        return;
      }
      addImage({
        sourceId: asset.sourceId,
        naturalWidth: asset.naturalWidth,
        naturalHeight: asset.naturalHeight,
      });
    } catch (err) {
      if (err instanceof ContentDimensionError) {
        onImageError(err.error as ImageValidationError);
      } else {
        onImageError('decode-error');
      }
    }
  };

  return (
    <div className="toolbar-subsection">
      <span className="toolbar-subsection-heading">{messages.toolbarAddElementSubheading}</span>
      <div className="toolbar-actions">
        <button type="button" disabled={!canAddElement} onClick={addText}>
          {messages.editorAddTextButton}
        </button>
        <button
          type="button"
          disabled={!canAddElement}
          onClick={() => fileInputRef.current?.click()}
        >
          {messages.editorAddImageButton}
        </button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(',')}
        onChange={handleFileChange}
        className="visually-hidden"
        aria-label={messages.editorAddImageButton}
      />
    </div>
  );
}

type Draft = Pick<SignageObject, 'x' | 'y' | 'width' | 'height' | 'rotation'> & {
  text?: string;
  fontSize?: number;
  color?: string;
  align?: 'left' | 'center' | 'right';
};

function toDraft(object: SignageObject): Draft {
  if (object.kind === 'text') {
    return {
      x: object.x,
      y: object.y,
      width: object.width,
      height: object.height,
      rotation: object.rotation,
      text: object.text,
      fontSize: object.fontSize,
      color: object.color,
      align: object.align,
    };
  }
  return {
    x: object.x,
    y: object.y,
    width: object.width,
    height: object.height,
    rotation: object.rotation,
  };
}

function signageTypeLabel(
  object: SignageObject,
  messages: ReturnType<typeof useLocale>['messages'],
): string {
  switch (object.kind) {
    case 'text':
      return messages.signageTypeText;
    case 'image':
      return messages.signageTypeImage;
    case 'portable':
      return messages.signageTypePortable;
    case 'display': {
      const material = normalizeMaterial(object.material);
      if (material === 'lcd') return messages.signageTypeLcd;
      if (material === 'transparent-led') return messages.signageTypeTransparentLed;
      return messages.signageTypeLed;
    }
  }
}

function SelectedSignageSection() {
  const { messages } = useLocale();
  const selected = useEditorStore(selectSelectedObject);
  const deleteSelected = useEditorStore((state) => state.deleteSelected);

  return (
    <ToolbarSection heading={messages.toolbarSelectedSignageSectionHeading}>
      {!selected ? (
        <p className="toolbar-notice">{messages.editorPropertiesEmptyHint}</p>
      ) : (
        <SelectedSignageFields key={selected.id} object={selected} />
      )}
      <button type="button" onClick={deleteSelected} disabled={!selected}>
        {messages.editorDeleteButton}
      </button>
    </ToolbarSection>
  );
}

function SelectedSignageFields({ object: selected }: { object: SignageObject }) {
  const { messages } = useLocale();
  const commitObjectChange = useEditorStore((state) => state.commitObjectChange);
  const [draft, setDraft] = useState<Draft>(() => toDraft(selected));

  // Reflect store-side changes (canvas drag/rotate/resize, undo, redo) back into the numeric
  // inputs; without this the fields would keep showing pre-drag values after any interaction
  // that didn't originate from typing in these inputs. Skip refresh while a field itself is
  // focused so the user's own in-progress edit isn't clobbered mid-keystroke — the onBlur commit
  // then flushes to store, which re-triggers this effect and syncs the untouched fields.
  useEffect(() => {
    if (document.activeElement?.tagName === 'INPUT') return;
    if (document.activeElement?.tagName === 'TEXTAREA') return;
    // Syncing external (Zustand) state into local UI state — React docs explicitly allow this
    // exact case for effects. See react.dev "You Might Not Need an Effect" § "Adjusting some
    // state when a prop changes": local state driven by props/store is the intended pattern.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(toDraft(selected));
  }, [
    selected,
    selected.x,
    selected.y,
    selected.width,
    selected.height,
    selected.rotation,
  ]);

  const commit = (patch: Partial<SignageObject>) => {
    commitObjectChange(selected.id, patch);
  };

  return (
    <>
      <p className="toolbar-notice">
        {messages.toolbarSelectedSignageTypeLabel}:{' '}
        <span>{signageTypeLabel(selected, messages)}</span>
      </p>

      <label>
        <span>{messages.editorPositionXLabel}</span>
        <input
          type="number"
          value={Math.round(draft.x)}
          onChange={(event) => setDraft({ ...draft, x: Number(event.target.value) })}
          onBlur={() => commit({ x: draft.x })}
        />
      </label>

      <label>
        <span>{messages.editorPositionYLabel}</span>
        <input
          type="number"
          value={Math.round(draft.y)}
          onChange={(event) => setDraft({ ...draft, y: Number(event.target.value) })}
          onBlur={() => commit({ y: draft.y })}
        />
      </label>

      <label>
        <span>{messages.editorWidthLabel}</span>
        <input
          type="number"
          min={10}
          value={Math.round(draft.width)}
          onChange={(event) => setDraft({ ...draft, width: Number(event.target.value) })}
          onBlur={() => commit({ width: Math.max(10, draft.width) })}
        />
      </label>

      <label>
        <span>{messages.editorHeightLabel}</span>
        <input
          type="number"
          min={10}
          value={Math.round(draft.height)}
          onChange={(event) => setDraft({ ...draft, height: Number(event.target.value) })}
          onBlur={() => commit({ height: Math.max(10, draft.height) })}
        />
      </label>

      <label>
        <span>{messages.editorRotationLabel}</span>
        <input
          type="number"
          value={Math.round(draft.rotation)}
          onChange={(event) => setDraft({ ...draft, rotation: Number(event.target.value) })}
          onBlur={() => commit({ rotation: draft.rotation })}
        />
      </label>

      {selected.kind === 'text' && (
        <>
          <label>
            <span>{messages.editorTextContentLabel}</span>
            <textarea
              value={draft.text ?? ''}
              onChange={(event) => setDraft({ ...draft, text: event.target.value })}
              onBlur={() => commit({ text: draft.text })}
            />
          </label>

          <label>
            <span>{messages.editorFontSizeLabel}</span>
            <input
              type="number"
              min={8}
              value={draft.fontSize ?? 16}
              onChange={(event) => setDraft({ ...draft, fontSize: Number(event.target.value) })}
              onBlur={() => commit({ fontSize: Math.max(8, draft.fontSize ?? 16) })}
            />
          </label>

          <label>
            <span>{messages.editorTextColorLabel}</span>
            <input
              type="color"
              value={draft.color ?? '#ffffff'}
              onChange={(event) => {
                const color = event.target.value;
                setDraft({ ...draft, color });
                commit({ color });
              }}
            />
          </label>

          <label>
            <span>{messages.editorTextAlignLabel}</span>
            <select
              value={draft.align ?? 'left'}
              onChange={(event) => {
                const align = event.target.value as 'left' | 'center' | 'right';
                setDraft({ ...draft, align });
                commit({ align });
              }}
            >
              <option value="left">{messages.editorAlignLeft}</option>
              <option value="center">{messages.editorAlignCenter}</option>
              <option value="right">{messages.editorAlignRight}</option>
            </select>
          </label>
        </>
      )}

      {supportsPerspective(selected) && <PerspectiveFitControls object={selected} />}

      {selected.kind === 'portable' && (
        <label>
          <span>{messages.portableViewLabel}</span>
          {/* One <option> per entry in PORTABLE_TEMPLATE_VIEWS so adding a new view slot
              later is a change in one place, not two. Label lookup routes through
              messages.portableViewOptions so all three locales stay type-checked. */}
          <select
            value={selected.templateView}
            onChange={(event) =>
              commit({ templateView: event.target.value as PortableTemplateView })
            }
          >
            {PORTABLE_TEMPLATE_VIEWS.map((view) => (
              <option key={view} value={view}>
                {messages.portableViewOptions[view]}
              </option>
            ))}
          </select>
        </label>
      )}

      {/* PortableProductPhotoControls (developer-only: custom product photo + quad editor)
          is intentionally hidden from the regular user flow. Re-enable here if needed. */}
    </>
  );
}

type StringMessageKey = {
  [K in keyof ReturnType<typeof useLocale>['messages']]: ReturnType<
    typeof useLocale
  >['messages'][K] extends string
    ? K
    : never;
}[keyof ReturnType<typeof useLocale>['messages']];

const PERSPECTIVE_CORNER_LABEL_KEY: Record<QuadCorner, StringMessageKey> = {
  topLeft: 'editorPerspectiveCornerTopLeft',
  topRight: 'editorPerspectiveCornerTopRight',
  bottomRight: 'editorPerspectiveCornerBottomRight',
  bottomLeft: 'editorPerspectiveCornerBottomLeft',
};

const PERSPECTIVE_ERROR_KEY: Record<QuadInvalidReason, StringMessageKey> = {
  'invalid-values': 'editorPerspectiveErrorInvalidValues',
  'out-of-bounds': 'editorPerspectiveErrorOutOfBounds',
  'self-intersecting': 'editorPerspectiveErrorSelfIntersecting',
  concave: 'editorPerspectiveErrorConcave',
  'min-area': 'editorPerspectiveErrorMinArea',
  'min-edge': 'editorPerspectiveErrorMinEdge',
};

const OCCLUSION_ERROR_KEY: Record<OcclusionInvalidReason, StringMessageKey> = {
  'too-few-points': 'editorOcclusionErrorTooFewPoints',
  'too-many-points': 'editorOcclusionErrorTooManyPoints',
  'invalid-values': 'editorOcclusionErrorInvalidValues',
  'out-of-bounds': 'editorOcclusionErrorOutOfBounds',
  'duplicate-points': 'editorOcclusionErrorDuplicatePoints',
  'self-intersecting': 'editorOcclusionErrorSelfIntersecting',
  'min-area': 'editorOcclusionErrorMinArea',
};

/**
 * Entry points for perspective ("Fit to space") edit mode. While this object's edit session is
 * open, the corner inputs and action buttons render inline in the toolbar (so they no longer
 * cover the canvas on mobile); the corner drag handles remain in PerspectiveEditOverlay on the
 * canvas.
 */
function PerspectiveFitControls({ object }: { object: PerspectiveCapableObject }) {
  const { messages } = useLocale();
  const perspectiveEditId = useEditorStore((state) => state.perspectiveEditId);
  const draftQuad = useEditorStore((state) => state.perspectiveDraftQuad);
  const beginPerspectiveEdit = useEditorStore((state) => state.beginPerspectiveEdit);
  const updatePerspectiveDraft = useEditorStore((state) => state.updatePerspectiveDraft);
  const applyPerspectiveEdit = useEditorStore((state) => state.applyPerspectiveEdit);
  const cancelPerspectiveEdit = useEditorStore((state) => state.cancelPerspectiveEdit);
  const resetPerspectiveEdit = useEditorStore((state) => state.resetPerspectiveEdit);
  const commitObjectChange = useEditorStore((state) => state.commitObjectChange);

  if (perspectiveEditId === object.id && draftQuad) {
    const validation = validateQuad(draftQuad);
    return (
      <div className="toolbar-subsection">
        <div className="perspective-corner-fields">
          {QUAD_CORNER_ORDER.map((corner) => {
            const point = draftQuad[corner];
            return (
              <fieldset key={corner}>
                <legend>{messages[PERSPECTIVE_CORNER_LABEL_KEY[corner]]}</legend>
                <label>
                  <span>{messages.editorPositionXLabel}</span>
                  <input
                    type="number"
                    step={0.01}
                    min={0}
                    max={1}
                    value={Number(point.x.toFixed(2))}
                    onChange={(event) => {
                      if (!Number.isFinite(Number(event.target.value))) return;
                      const next = clampQuadPoint01({
                        ...point,
                        x: Number(event.target.value),
                      });
                      updatePerspectiveDraft({ ...draftQuad, [corner]: next });
                    }}
                  />
                </label>
                <label>
                  <span>{messages.editorPositionYLabel}</span>
                  <input
                    type="number"
                    step={0.01}
                    min={0}
                    max={1}
                    value={Number(point.y.toFixed(2))}
                    onChange={(event) => {
                      if (!Number.isFinite(Number(event.target.value))) return;
                      const next = clampQuadPoint01({
                        ...point,
                        y: Number(event.target.value),
                      });
                      updatePerspectiveDraft({ ...draftQuad, [corner]: next });
                    }}
                  />
                </label>
              </fieldset>
            );
          })}
        </div>
        {!validation.valid && validation.reason && (
          <p role="alert" className="editor-properties-error">
            {messages[PERSPECTIVE_ERROR_KEY[validation.reason]]}
          </p>
        )}
        <div className="editor-properties-actions">
          <button type="button" onClick={resetPerspectiveEdit}>
            {messages.editorPerspectiveResetButton}
          </button>
          <button type="button" onClick={cancelPerspectiveEdit}>
            {messages.editorPerspectiveCancelButton}
          </button>
          <button type="button" onClick={() => applyPerspectiveEdit()} disabled={!validation.valid}>
            {messages.editorPerspectiveApplyButton}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="toolbar-actions">
      <button type="button" onClick={() => beginPerspectiveEdit(object.id)}>
        {messages.editorPerspectiveFitButton}
      </button>
      {object.placementMode === 'perspective' && (
        <button
          type="button"
          onClick={() => commitObjectChange(object.id, { placementMode: 'rect' })}
        >
          {messages.editorPerspectiveUseRectButton}
        </button>
      )}
    </div>
  );
}

function ContentSection({
  onContentError,
  onImageError,
}: {
  onContentError: (kind: ContentKind, error: ContentValidationError) => void;
  onImageError: (error: ImageValidationError) => void;
}) {
  const { messages } = useLocale();
  const selected = useEditorStore(selectSelectedObject);
  const hasContentSupport = selected?.kind === 'display' || selected?.kind === 'portable';

  return (
    <ToolbarSection heading={messages.editorContentLabel}>
      <AddCanvasElementControls onImageError={onImageError} />
      {!hasContentSupport ? (
        <p className="toolbar-notice">{messages.toolbarContentEmptyHint}</p>
      ) : (
        <ContentFields key={selected.id} object={selected} onContentError={onContentError} />
      )}
    </ToolbarSection>
  );
}

function ContentFields({
  object,
  onContentError,
}: {
  object: DisplaySignageObject | PortableSignageObject;
  onContentError: (kind: ContentKind, error: ContentValidationError) => void;
}) {
  const { messages } = useLocale();
  const commitObjectChange = useEditorStore((state) => state.commitObjectChange);
  const contentInputRef = useRef<HTMLInputElement | null>(null);
  const [offsetXDraft, setOffsetXDraft] = useState(object.content?.offsetX ?? 0);
  const [offsetYDraft, setOffsetYDraft] = useState(object.content?.offsetY ?? 0);
  const [scaleDraft, setScaleDraft] = useState(object.content?.scale ?? 1);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const commit = (patch: Partial<SignageObject>) => commitObjectChange(object.id, patch);

  const handleContentFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const validation = validateContentFile(file);
    if (validation) {
      onContentError(validation.kind, validation.error);
      return;
    }

    try {
      const asset = await registerContentAsset(file);
      const screenRect = getObjectScreenRect(object);
      const rotation = screenRect
        ? computeAutoContentRotation(
            screenRect.width,
            screenRect.height,
            asset.naturalWidth,
            asset.naturalHeight,
          )
        : 0;
      commit({
        content: {
          kind: asset.kind,
          sourceId: asset.sourceId,
          fit: object.content?.fit ?? 'contain',
          offsetX: 0,
          offsetY: 0,
          scale: 1,
          rotation,
        },
      });
      setOffsetXDraft(0);
      setOffsetYDraft(0);
      setScaleDraft(1);
    } catch (error) {
      if (error instanceof ContentDimensionError) {
        onContentError(error.kind, error.error);
      } else {
        onContentError(contentKindForFile(file), 'decode-error');
      }
    }
  };

  return (
    <>
      {object.content ? (
        <>
          <div className="toolbar-actions">
            <button type="button" onClick={() => contentInputRef.current?.click()}>
              {messages.editorContentReplaceButton}
            </button>
            <button type="button" onClick={() => commit({ content: null })}>
              {messages.editorContentRemoveButton}
            </button>
          </div>

          {object.content.kind === 'video' && (
            <p className="toolbar-notice">{messages.editorContentVideoAutoplayHint}</p>
          )}

          <label>
            <span>{messages.editorContentFitLabel}</span>
            <select
              value={object.content.fit}
              onChange={(event) => {
                if (!object.content) return;
                commit({ content: { ...object.content, fit: event.target.value as ContentFit } });
              }}
            >
              <option value="contain">{messages.editorContentFitContain}</option>
              <option value="cover">{messages.editorContentFitCover}</option>
            </select>
          </label>

          <label>
            <span>{messages.editorContentRotationLabel}</span>
            <select
              value={String(object.content.rotation ?? 0)}
              onChange={(event) => {
                if (!object.content) return;
                const rotation = event.target.value === '90' ? 90 : 0;
                commit({ content: { ...object.content, rotation } });
              }}
            >
              <option value="0">{messages.editorContentRotationZero}</option>
              <option value="90">{messages.editorContentRotationNinety}</option>
            </select>
          </label>

          <div className="editor-properties-actions">
            <button type="button" onClick={() => setSettingsOpen(true)}>
              {messages.editorContentAdvancedSettingsOpenButton}
            </button>
          </div>

          {settingsOpen && (
            <AdvancedSettingsModal onClose={() => setSettingsOpen(false)}>
              <label>
                <span>{messages.editorContentOffsetXLabel}</span>
                <input
                  type="number"
                  step={0.05}
                  min={-1}
                  max={1}
                  value={offsetXDraft}
                  onChange={(event) => setOffsetXDraft(Number(event.target.value))}
                  onBlur={() => {
                    if (!object.content) return;
                    commit({
                      content: { ...object.content, offsetX: clampContentOffset(offsetXDraft) },
                    });
                  }}
                />
              </label>

              <label>
                <span>{messages.editorContentOffsetYLabel}</span>
                <input
                  type="number"
                  step={0.05}
                  min={-1}
                  max={1}
                  value={offsetYDraft}
                  onChange={(event) => setOffsetYDraft(Number(event.target.value))}
                  onBlur={() => {
                    if (!object.content) return;
                    commit({
                      content: { ...object.content, offsetY: clampContentOffset(offsetYDraft) },
                    });
                  }}
                />
              </label>

              <label>
                <span>{messages.editorContentScaleLabel}</span>
                <input
                  type="number"
                  step={0.1}
                  min={MIN_CONTENT_SCALE}
                  max={MAX_CONTENT_SCALE}
                  value={scaleDraft}
                  onChange={(event) => setScaleDraft(Number(event.target.value))}
                  onBlur={() => {
                    if (!object.content) return;
                    commit({
                      content: { ...object.content, scale: clampContentScale(scaleDraft) },
                    });
                  }}
                />
              </label>

              <button
                type="button"
                onClick={() => {
                  if (!object.content) return;
                  commit({ content: { ...object.content, offsetX: 0, offsetY: 0, scale: 1 } });
                  setOffsetXDraft(0);
                  setOffsetYDraft(0);
                  setScaleDraft(1);
                }}
              >
                {messages.editorContentResetButton}
              </button>
            </AdvancedSettingsModal>
          )}
        </>
      ) : (
        <>
          <p className="toolbar-notice">{messages.editorContentNoneHint}</p>
          <button
            type="button"
            id="toolbar-content-upload-trigger"
            onClick={() => contentInputRef.current?.click()}
          >
            {messages.editorContentUploadButton}
          </button>
        </>
      )}

      <input
        ref={contentInputRef}
        type="file"
        accept={[...ACCEPTED_IMAGE_TYPES, ...ACCEPTED_VIDEO_TYPES].join(',')}
        onChange={handleContentFileChange}
        className="visually-hidden"
        aria-label={messages.editorContentUploadButton}
      />
    </>
  );
}

function AppearanceSection() {
  const { messages } = useLocale();
  const selected = useEditorStore(selectSelectedObject);
  const realismGuideDismissed = useUiStore((state) => state.realismGuideDismissed);
  const showRealismGuide =
    !realismGuideDismissed &&
    !!selected &&
    (selected.kind === 'display' || selected.kind === 'portable');

  return (
    <ToolbarSection heading={messages.toolbarAppearanceSectionHeading}>
      {showRealismGuide && <RealismGuideCard />}
      {!selected ? (
        <p className="toolbar-notice">{messages.toolbarAppearanceEmptyHint}</p>
      ) : selected.kind !== 'display' && selected.kind !== 'portable' ? (
        <p className="toolbar-notice">{messages.toolbarAppearanceUnsupportedHint}</p>
      ) : (
        <AppearanceFields key={selected.id} object={selected} />
      )}
    </ToolbarSection>
  );
}

function materialOptionLabel(
  material: DisplayMaterial,
  messages: ReturnType<typeof useLocale>['messages'],
): string {
  const normalized = normalizeMaterial(material);
  if (normalized === 'lcd') return messages.editorMaterialLcd;
  if (normalized === 'transparent-led') return messages.editorMaterialTransparentLed;
  return messages.editorMaterialLed;
}

function curvatureModeLabel(
  mode: CurvatureMode,
  messages: ReturnType<typeof useLocale>['messages'],
): string {
  if (mode === 'concave') return messages.editorCurvatureConcave;
  if (mode === 'convex') return messages.editorCurvatureConvex;
  return messages.editorCurvatureFlat;
}

const CURVATURE_MODES: CurvatureMode[] = ['flat', 'concave', 'convex'];

function renderingPresetLabel(
  preset: RenderingPresetId,
  messages: ReturnType<typeof useLocale>['messages'],
): string {
  if (preset === 'bright') return messages.editorRenderingPresetBright;
  if (preset === 'night') return messages.editorRenderingPresetNight;
  return messages.editorRenderingPresetNatural;
}

function canvasPresetLabel(
  preset: CanvasPresetId,
  messages: ReturnType<typeof useLocale>['messages'],
): string {
  if (preset === 'portrait-9-16') return messages.editorCanvasPresetPortraitLabel;
  return messages.editorCanvasPresetLandscapeLabel;
}

function AppearanceFields({ object }: { object: DisplaySignageObject | PortableSignageObject }) {
  const { messages } = useLocale();
  const commitObjectChange = useEditorStore((state) => state.commitObjectChange);
  const updateObjectTransient = useEditorStore((state) => state.updateObjectTransient);
  const applyRenderingPresetAction = useEditorStore((state) => state.applyRenderingPreset);
  const sampleEnvironmentColor = useEditorStore((state) => state.sampleEnvironmentColor);
  const spaceBackground = useEditorStore((state) => state.document.spaceBackground);
  const occlusionEditObjectId = useEditorStore((state) => state.occlusionEditObjectId);
  const beginOcclusionEdit = useEditorStore((state) => state.beginOcclusionEdit);
  const cancelOcclusionEdit = useEditorStore((state) => state.cancelOcclusionEdit);
  const applyOcclusionEdit = useEditorStore((state) => state.applyOcclusionEdit);
  const deleteOcclusionMask = useEditorStore((state) => state.deleteOcclusionMask);
  const setOcclusionMaskEnabled = useEditorStore((state) => state.setOcclusionMaskEnabled);
  const occlusionDraftPoints = useEditorStore((state) => state.occlusionDraftPoints);
  const occlusionDraftFeather = useEditorStore((state) => state.occlusionDraftFeather);
  const occlusionDraftOpacity = useEditorStore((state) => state.occlusionDraftOpacity);
  const setOcclusionDraftFeather = useEditorStore((state) => state.setOcclusionDraftFeather);
  const setOcclusionDraftOpacity = useEditorStore((state) => state.setOcclusionDraftOpacity);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [intensityDraft, setIntensityDraft] = useState(object.materialSettings.intensity);
  const [brightnessDraft, setBrightnessDraft] = useState(object.materialSettings.brightness);
  const [transparencyDraft, setTransparencyDraft] = useState(object.materialSettings.transparency);
  const [gridDensityDraft, setGridDensityDraft] = useState(object.materialSettings.gridDensity);
  const [glowDraft, setGlowDraft] = useState(object.materialSettings.glow);
  const [contrastDraft, setContrastDraft] = useState(object.materialSettings.contrast);
  const [curvatureAmountDraft, setCurvatureAmountDraft] = useState(object.curvature.amount);
  const [shadowStrengthDraft, setShadowStrengthDraft] = useState(object.contactShadow.strength);
  const [shadowBlurDraft, setShadowBlurDraft] = useState(object.contactShadow.blur);
  const [shadowOffsetXDraft, setShadowOffsetXDraft] = useState(object.contactShadow.offsetX);
  const [shadowOffsetYDraft, setShadowOffsetYDraft] = useState(object.contactShadow.offsetY);
  const [shadowSpreadDraft, setShadowSpreadDraft] = useState(object.contactShadow.spread);
  const [shadowDepthDraft, setShadowDepthDraft] = useState(object.contactShadow.depth);
  const [shadowTintDraft, setShadowTintDraft] = useState(object.contactShadow.tint);
  const [environmentStrengthDraft, setEnvironmentStrengthDraft] = useState(
    object.environmentIntegration.strength,
  );

  const material = normalizeMaterial(object.material);
  const isTransparentLed = material === 'transparent-led';
  const supportsGridAndGlow = material === 'led' || isTransparentLed;
  const curvatureSupported = isCurvatureSupported(material);
  const activePreset = detectActivePreset(
    object.kind,
    object.material,
    object.materialSettings,
    object.contactShadow,
    object.environmentIntegration,
  );

  const commit = (patch: Partial<SignageObject>) => commitObjectChange(object.id, patch);

  const commitMaterialSettings = (patch: Partial<MaterialSettings>) => {
    commit({ materialSettings: { ...object.materialSettings, ...patch } });
  };

  const previewMaterialSettings = (patch: Partial<MaterialSettings>) => {
    updateObjectTransient(object.id, {
      materialSettings: { ...object.materialSettings, ...patch },
    });
  };

  const commitCurvature = (patch: Partial<{ mode: CurvatureMode; amount: number }>) => {
    commit({ curvature: { ...object.curvature, ...patch } });
  };

  const commitContactShadow = (patch: Partial<ContactShadowSettings>) => {
    commit({ contactShadow: { ...object.contactShadow, ...patch } });
  };

  const previewContactShadow = (patch: Partial<ContactShadowSettings>) => {
    updateObjectTransient(object.id, { contactShadow: { ...object.contactShadow, ...patch } });
  };

  const commitEnvironmentIntegration = (patch: Partial<EnvironmentIntegrationSettings>) => {
    commit({ environmentIntegration: { ...object.environmentIntegration, ...patch } });
  };

  const previewEnvironmentIntegration = (patch: Partial<EnvironmentIntegrationSettings>) => {
    updateObjectTransient(object.id, {
      environmentIntegration: { ...object.environmentIntegration, ...patch },
    });
  };

  // "Reset" restores the Natural preset's per-material starting point rather than one flat
  // legacy default, so a reset LED and a reset LCD each land on a plausible value for their own
  // technology instead of an identical generic number (sprint spec section 7/21).
  const resetMaterial = () => {
    const defaults = getPresetMaterialSettings(object.material, 'natural');
    commit({ materialSettings: defaults });
    setIntensityDraft(defaults.intensity);
    setBrightnessDraft(defaults.brightness);
    setTransparencyDraft(defaults.transparency);
    setGridDensityDraft(defaults.gridDensity);
    setGlowDraft(defaults.glow);
    setContrastDraft(defaults.contrast);
  };

  const resetCurvature = () => {
    commit({ curvature: { ...DEFAULT_CURVATURE } });
    setCurvatureAmountDraft(DEFAULT_CURVATURE.amount);
  };

  const resetContactShadow = () => {
    const defaults = getPresetContactShadow(object.kind, object.material, 'natural');
    commit({ contactShadow: defaults });
    setShadowStrengthDraft(defaults.strength);
    setShadowBlurDraft(defaults.blur);
    setShadowOffsetXDraft(defaults.offsetX);
    setShadowOffsetYDraft(defaults.offsetY);
    setShadowSpreadDraft(defaults.spread);
    setShadowDepthDraft(defaults.depth);
    setShadowTintDraft(defaults.tint);
  };

  const resetEnvironmentIntegration = () => {
    const defaults = getPresetEnvironmentIntegration('natural');
    commit({ environmentIntegration: defaults });
    setEnvironmentStrengthDraft(defaults.strength);
  };

  const applyPreset = (preset: RenderingPresetId) => {
    const patch = resolvePresetPatch(object.kind, object.material, preset);
    applyRenderingPresetAction(object.id, preset);
    setIntensityDraft(patch.materialSettings.intensity);
    setBrightnessDraft(patch.materialSettings.brightness);
    setTransparencyDraft(patch.materialSettings.transparency);
    setGridDensityDraft(patch.materialSettings.gridDensity);
    setGlowDraft(patch.materialSettings.glow);
    setContrastDraft(patch.materialSettings.contrast);
    setShadowStrengthDraft(patch.contactShadow.strength);
    setShadowBlurDraft(patch.contactShadow.blur);
    setShadowOffsetXDraft(patch.contactShadow.offsetX);
    setShadowOffsetYDraft(patch.contactShadow.offsetY);
    setShadowSpreadDraft(patch.contactShadow.spread);
    setShadowDepthDraft(patch.contactShadow.depth);
    setShadowTintDraft(patch.contactShadow.tint);
    setEnvironmentStrengthDraft(patch.environmentIntegration.strength);
  };

  return (
    <>
      <div
        className="rendering-preset-group"
        role="group"
        aria-label={messages.editorRenderingPresetLabel}
      >
        <span>{messages.editorRenderingPresetLabel}</span>
        <div className="toolbar-actions">
          {RENDERING_PRESET_IDS.map((preset) => (
            <button
              key={preset}
              type="button"
              className={activePreset === preset ? 'is-active' : undefined}
              aria-pressed={activePreset === preset}
              onClick={() => applyPreset(preset)}
            >
              {renderingPresetLabel(preset, messages)}
            </button>
          ))}
        </div>
        <p className="toolbar-notice">{messages.editorRenderingPresetHint}</p>
      </div>

      <label>
        <span>{messages.editorMaterialLabel}</span>
        <select
          value={material}
          onChange={(event) => commit({ material: event.target.value as DisplayMaterial })}
        >
          {CURRENT_DISPLAY_MATERIALS.map((value) => (
            <option key={value} value={value}>
              {materialOptionLabel(value, messages)}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span>{messages.editorMaterialIntensityLabel}</span>
        <input
          type="range"
          min={MIN_MATERIAL_SETTING}
          max={MAX_MATERIAL_SETTING}
          value={intensityDraft}
          onInput={(event) => {
            const intensity = Number((event.target as HTMLInputElement).value);
            setIntensityDraft(intensity);
            previewMaterialSettings({ intensity });
          }}
          onPointerUp={() =>
            commitMaterialSettings({ intensity: clampMaterialSetting(intensityDraft) })
          }
          onBlur={() => commitMaterialSettings({ intensity: clampMaterialSetting(intensityDraft) })}
        />
      </label>

      <label>
        <span>{messages.editorMaterialBrightnessLabel}</span>
        <input
          type="range"
          min={MIN_MATERIAL_SETTING}
          max={MAX_MATERIAL_SETTING}
          value={brightnessDraft}
          onInput={(event) => {
            const brightness = Number((event.target as HTMLInputElement).value);
            setBrightnessDraft(brightness);
            previewMaterialSettings({ brightness });
          }}
          onPointerUp={() =>
            commitMaterialSettings({ brightness: clampMaterialSetting(brightnessDraft) })
          }
          onBlur={() =>
            commitMaterialSettings({ brightness: clampMaterialSetting(brightnessDraft) })
          }
        />
      </label>

      {isTransparentLed && (
        <p className="toolbar-notice">{messages.editorTransparentLedDisclaimer}</p>
      )}

      <p className="toolbar-notice">{messages.editorMaterialPreviewNotice}</p>

      <div className="editor-properties-actions">
        <button type="button" onClick={() => setSettingsOpen(true)}>
          {messages.editorAdvancedSettingsOpenButton}
        </button>
      </div>

      {settingsOpen && (
        <AdvancedSettingsModal onClose={() => setSettingsOpen(false)}>
          {isTransparentLed && (
            <label>
              <span>{messages.editorMaterialTransparencyLabel}</span>
              <input
                type="range"
                min={MIN_MATERIAL_SETTING}
                max={MAX_MATERIAL_SETTING}
                value={transparencyDraft}
                onInput={(event) => {
                  const transparency = Number((event.target as HTMLInputElement).value);
                  setTransparencyDraft(transparency);
                  previewMaterialSettings({ transparency });
                }}
                onPointerUp={() =>
                  commitMaterialSettings({ transparency: clampMaterialSetting(transparencyDraft) })
                }
                onBlur={() =>
                  commitMaterialSettings({ transparency: clampMaterialSetting(transparencyDraft) })
                }
              />
            </label>
          )}

          {supportsGridAndGlow && (
            <label>
              <span>{messages.editorMaterialGridDensityLabel}</span>
              <input
                type="range"
                min={MIN_MATERIAL_SETTING}
                max={MAX_MATERIAL_SETTING}
                value={gridDensityDraft}
                onInput={(event) => {
                  const gridDensity = Number((event.target as HTMLInputElement).value);
                  setGridDensityDraft(gridDensity);
                  previewMaterialSettings({ gridDensity });
                }}
                onPointerUp={() =>
                  commitMaterialSettings({ gridDensity: clampMaterialSetting(gridDensityDraft) })
                }
                onBlur={() =>
                  commitMaterialSettings({ gridDensity: clampMaterialSetting(gridDensityDraft) })
                }
              />
            </label>
          )}

          {supportsGridAndGlow && (
            <label>
              <span>{messages.editorMaterialGlowLabel}</span>
              <input
                type="range"
                min={MIN_MATERIAL_SETTING}
                max={MAX_MATERIAL_SETTING}
                value={glowDraft}
                onInput={(event) => {
                  const glow = Number((event.target as HTMLInputElement).value);
                  setGlowDraft(glow);
                  previewMaterialSettings({ glow });
                }}
                onPointerUp={() =>
                  commitMaterialSettings({ glow: clampMaterialSetting(glowDraft) })
                }
                onBlur={() => commitMaterialSettings({ glow: clampMaterialSetting(glowDraft) })}
              />
            </label>
          )}

          <label>
            <span>{messages.editorMaterialContrastLabel}</span>
            <input
              type="range"
              min={MIN_MATERIAL_SETTING}
              max={MAX_MATERIAL_SETTING}
              value={contrastDraft}
              onInput={(event) => {
                const contrast = Number((event.target as HTMLInputElement).value);
                setContrastDraft(contrast);
                previewMaterialSettings({ contrast });
              }}
              onPointerUp={() =>
                commitMaterialSettings({ contrast: clampMaterialSetting(contrastDraft) })
              }
              onBlur={() =>
                commitMaterialSettings({ contrast: clampMaterialSetting(contrastDraft) })
              }
            />
          </label>

          <button type="button" onClick={resetMaterial}>
            {messages.editorMaterialResetButton}
          </button>

          <div
            className="curvature-mode-group"
            role="group"
            aria-label={messages.editorCurvatureModeLabel}
          >
            <span>{messages.editorCurvatureModeLabel}</span>
            <div className="toolbar-actions">
              {CURVATURE_MODES.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  disabled={!curvatureSupported}
                  className={object.curvature.mode === mode ? 'is-active' : undefined}
                  aria-pressed={object.curvature.mode === mode}
                  onClick={() => commitCurvature({ mode })}
                >
                  {curvatureModeLabel(mode, messages)}
                </button>
              ))}
            </div>
          </div>

          {!curvatureSupported && (
            <p className="toolbar-notice">{messages.editorCurvatureUnsupportedHint}</p>
          )}

          {curvatureSupported && object.curvature.mode !== 'flat' && (
            <label>
              <span>{messages.editorCurvatureAmountLabel}</span>
              <input
                type="range"
                min={MIN_CURVATURE_AMOUNT}
                max={MAX_CURVATURE_AMOUNT}
                value={curvatureAmountDraft}
                onInput={(event) => {
                  const amount = Number((event.target as HTMLInputElement).value);
                  setCurvatureAmountDraft(amount);
                  updateObjectTransient(object.id, { curvature: { ...object.curvature, amount } });
                }}
                onPointerUp={() =>
                  commitCurvature({ amount: clampCurvatureAmount(curvatureAmountDraft) })
                }
                onBlur={() =>
                  commitCurvature({ amount: clampCurvatureAmount(curvatureAmountDraft) })
                }
              />
            </label>
          )}

          {curvatureSupported && (
            <button type="button" onClick={resetCurvature}>
              {messages.editorCurvatureResetButton}
            </button>
          )}

          <div className="toolbar-subsection">
            <span className="toolbar-subsection-heading">
              {messages.editorInstallationModeLabel}
            </span>
            <label>
              <span>{messages.editorInstallationModeLabel}</span>
              <select
                value={object.installationMode}
                onChange={(event) =>
                  commit({ installationMode: event.target.value as InstallationMode })
                }
              >
                <option value="wall">{messages.editorInstallationModeWall}</option>
                <option value="window">{messages.editorInstallationModeWindow}</option>
                <option value="freestanding">{messages.editorInstallationModeFreestanding}</option>
              </select>
            </label>
          </div>

          <div className="toolbar-subsection">
            <span className="toolbar-subsection-heading">{messages.editorOcclusionLabel}</span>

            {occlusionEditObjectId === object.id ? (
              // Edit mode: feather/opacity sliders + Cancel/Apply inline in the toolbar
              // so the canvas isn't covered by the floating panel on mobile.
              (() => {
                const validation = validateOcclusionPolygon(occlusionDraftPoints);
                return (
                  <>
                    <label>
                      <span>{messages.editorOcclusionFeatherLabel}</span>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={occlusionDraftFeather}
                        onChange={(event) => setOcclusionDraftFeather(Number(event.target.value))}
                      />
                    </label>
                    <label>
                      <span>{messages.editorOcclusionOpacityLabel}</span>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={occlusionDraftOpacity}
                        onChange={(event) => setOcclusionDraftOpacity(Number(event.target.value))}
                      />
                    </label>
                    {!validation.valid && validation.reason && (
                      <p role="alert" className="editor-properties-error">
                        {messages[OCCLUSION_ERROR_KEY[validation.reason]]}
                      </p>
                    )}
                    <div className="editor-properties-actions">
                      <button type="button" onClick={cancelOcclusionEdit}>
                        {messages.editorOcclusionCancelButton}
                      </button>
                      <button
                        type="button"
                        onClick={() => applyOcclusionEdit()}
                        disabled={!validation.valid}
                      >
                        {messages.editorOcclusionApplyButton}
                      </button>
                    </div>
                  </>
                );
              })()
            ) : (
              <>
                {object.occlusionMasks.length === 0 ? (
                  <p className="toolbar-notice">{messages.editorOcclusionEmptyHint}</p>
                ) : (
                  <ul className="toolbar-occlusion-list">
                    {object.occlusionMasks.map((mask, index) => (
                      <li key={mask.id}>
                        <label className="toolbar-checkbox-field">
                          <input
                            type="checkbox"
                            checked={mask.enabled}
                            onChange={(event) =>
                              setOcclusionMaskEnabled(object.id, mask.id, event.target.checked)
                            }
                          />
                          <span>
                            {messages.editorOcclusionMaskItemLabel} {index + 1}
                          </span>
                        </label>
                        <div className="toolbar-actions">
                          <button
                            type="button"
                            onClick={() => {
                              setSettingsOpen(false);
                              beginOcclusionEdit(object.id, mask.id);
                            }}
                          >
                            {messages.editorOcclusionEditButton}
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteOcclusionMask(object.id, mask.id)}
                          >
                            {messages.editorOcclusionDeleteButton}
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="toolbar-actions">
                  <button
                    type="button"
                    onClick={() => {
                      setSettingsOpen(false);
                      beginOcclusionEdit(object.id);
                    }}
                    disabled={!spaceBackground}
                  >
                    {messages.editorOcclusionAddButton}
                  </button>
                </div>
              </>
            )}
            {!spaceBackground && occlusionEditObjectId !== object.id && (
              <p className="toolbar-notice">{messages.editorOcclusionNoSpaceHint}</p>
            )}
          </div>

          <div className="toolbar-subsection">
            <span className="toolbar-subsection-heading">{messages.editorContactShadowLabel}</span>

            <label className="toolbar-checkbox-field">
              <input
                type="checkbox"
                checked={object.contactShadow.enabled}
                onChange={(event) => commitContactShadow({ enabled: event.target.checked })}
              />
              <span>{messages.editorContactShadowEnableLabel}</span>
            </label>

            {object.contactShadow.enabled && (
              <>
                <label>
                  <span>{messages.editorContactShadowStrengthLabel}</span>
                  <input
                    type="range"
                    min={MIN_CONTACT_SHADOW_SETTING}
                    max={MAX_CONTACT_SHADOW_SETTING}
                    value={shadowStrengthDraft}
                    onInput={(event) => {
                      const strength = Number((event.target as HTMLInputElement).value);
                      setShadowStrengthDraft(strength);
                      previewContactShadow({ strength });
                    }}
                    onPointerUp={() =>
                      commitContactShadow({
                        strength: clampContactShadowSetting(shadowStrengthDraft),
                      })
                    }
                    onBlur={() =>
                      commitContactShadow({
                        strength: clampContactShadowSetting(shadowStrengthDraft),
                      })
                    }
                  />
                </label>

                <label>
                  <span>{messages.editorContactShadowBlurLabel}</span>
                  <input
                    type="range"
                    min={MIN_CONTACT_SHADOW_SETTING}
                    max={MAX_CONTACT_SHADOW_SETTING}
                    value={shadowBlurDraft}
                    onInput={(event) => {
                      const blur = Number((event.target as HTMLInputElement).value);
                      setShadowBlurDraft(blur);
                      previewContactShadow({ blur });
                    }}
                    onPointerUp={() =>
                      commitContactShadow({ blur: clampContactShadowSetting(shadowBlurDraft) })
                    }
                    onBlur={() =>
                      commitContactShadow({ blur: clampContactShadowSetting(shadowBlurDraft) })
                    }
                  />
                </label>

                <label>
                  <span>{messages.editorContactShadowOffsetXLabel}</span>
                  <input
                    type="number"
                    step={0.05}
                    min={-1}
                    max={1}
                    value={shadowOffsetXDraft}
                    onChange={(event) => setShadowOffsetXDraft(Number(event.target.value))}
                    onBlur={() =>
                      commitContactShadow({ offsetX: clampContactShadowOffset(shadowOffsetXDraft) })
                    }
                  />
                </label>

                <label>
                  <span>{messages.editorContactShadowOffsetYLabel}</span>
                  <input
                    type="number"
                    step={0.05}
                    min={-1}
                    max={1}
                    value={shadowOffsetYDraft}
                    onChange={(event) => setShadowOffsetYDraft(Number(event.target.value))}
                    onBlur={() =>
                      commitContactShadow({ offsetY: clampContactShadowOffset(shadowOffsetYDraft) })
                    }
                  />
                </label>

                <label>
                  <span>{messages.editorContactShadowSpreadLabel}</span>
                  <input
                    type="range"
                    min={MIN_CONTACT_SHADOW_SPREAD}
                    max={MAX_CONTACT_SHADOW_SPREAD}
                    value={shadowSpreadDraft}
                    onInput={(event) => {
                      const spread = Number((event.target as HTMLInputElement).value);
                      setShadowSpreadDraft(spread);
                      previewContactShadow({ spread });
                    }}
                    onPointerUp={() =>
                      commitContactShadow({ spread: clampContactShadowSpread(shadowSpreadDraft) })
                    }
                    onBlur={() =>
                      commitContactShadow({ spread: clampContactShadowSpread(shadowSpreadDraft) })
                    }
                  />
                </label>

                <label>
                  <span>{messages.editorContactShadowDepthLabel}</span>
                  <input
                    type="range"
                    min={MIN_CONTACT_SHADOW_SPREAD}
                    max={MAX_CONTACT_SHADOW_SPREAD}
                    value={shadowDepthDraft}
                    onInput={(event) => {
                      const depth = Number((event.target as HTMLInputElement).value);
                      setShadowDepthDraft(depth);
                      previewContactShadow({ depth });
                    }}
                    onPointerUp={() =>
                      commitContactShadow({ depth: clampContactShadowSpread(shadowDepthDraft) })
                    }
                    onBlur={() =>
                      commitContactShadow({ depth: clampContactShadowSpread(shadowDepthDraft) })
                    }
                  />
                </label>

                <label>
                  <span>{messages.editorContactShadowTintLabel}</span>
                  <input
                    type="range"
                    min={MIN_CONTACT_SHADOW_TINT}
                    max={MAX_CONTACT_SHADOW_TINT}
                    value={shadowTintDraft}
                    onInput={(event) => {
                      const tint = Number((event.target as HTMLInputElement).value);
                      setShadowTintDraft(tint);
                      previewContactShadow({ tint });
                    }}
                    onPointerUp={() =>
                      commitContactShadow({ tint: clampContactShadowTint(shadowTintDraft) })
                    }
                    onBlur={() =>
                      commitContactShadow({ tint: clampContactShadowTint(shadowTintDraft) })
                    }
                  />
                </label>
              </>
            )}

            <button type="button" onClick={resetContactShadow}>
              {messages.editorContactShadowResetButton}
            </button>
          </div>

          <div className="toolbar-subsection">
            <span className="toolbar-subsection-heading">
              {messages.editorEnvironmentIntegrationLabel}
            </span>

            <label>
              <span>{messages.editorEnvironmentIntegrationStrengthLabel}</span>
              <input
                type="range"
                min={MIN_ENVIRONMENT_INTEGRATION}
                max={MAX_ENVIRONMENT_INTEGRATION}
                value={environmentStrengthDraft}
                onInput={(event) => {
                  const strength = Number((event.target as HTMLInputElement).value);
                  setEnvironmentStrengthDraft(strength);
                  previewEnvironmentIntegration({ strength });
                }}
                onPointerUp={() =>
                  commitEnvironmentIntegration({
                    strength: clampEnvironmentIntegration(environmentStrengthDraft),
                  })
                }
                onBlur={() =>
                  commitEnvironmentIntegration({
                    strength: clampEnvironmentIntegration(environmentStrengthDraft),
                  })
                }
              />
            </label>

            <div className="toolbar-actions">
              <button
                type="button"
                onClick={() => sampleEnvironmentColor(object.id)}
                disabled={!spaceBackground}
              >
                {messages.editorEnvironmentSampleButton}
              </button>
              {object.environmentIntegration.sampledColor && (
                <span
                  className="toolbar-color-swatch"
                  style={{ backgroundColor: object.environmentIntegration.sampledColor }}
                  aria-label={messages.editorEnvironmentSampledSwatchLabel}
                  role="img"
                />
              )}
            </div>
            {!spaceBackground && (
              <p className="toolbar-notice">{messages.editorEnvironmentSampleNoSpaceHint}</p>
            )}

            <button type="button" onClick={resetEnvironmentIntegration}>
              {messages.editorEnvironmentIntegrationResetButton}
            </button>
          </div>
        </AdvancedSettingsModal>
      )}
    </>
  );
}

function ExportSection() {
  const { messages } = useLocale();
  const document = useEditorStore((state) => state.document);
  const spaceBackground = useEditorStore((state) => state.document.spaceBackground);
  const comparisonMode = useUiStore((state) => state.comparisonMode);
  const setComparisonMode = useUiStore((state) => state.setComparisonMode);
  const selectObject = useEditorStore((state) => state.selectObject);
  const cancelPerspectiveEdit = useEditorStore((state) => state.cancelPerspectiveEdit);
  const cancelOcclusionEdit = useEditorStore((state) => state.cancelOcclusionEdit);
  const size = getDocumentSize(document);

  const setMode = (nextComparisonMode: boolean) => {
    setComparisonMode(nextComparisonMode);
    if (nextComparisonMode) {
      selectObject(null);
      cancelPerspectiveEdit();
      cancelOcclusionEdit();
    }
  };

  return (
    <ToolbarSection heading={messages.toolbarExportSectionHeading}>
      <div className="comparison-toggle-group" aria-label={messages.comparisonToggleGroupLabel}>
        <button
          type="button"
          className={!comparisonMode ? 'is-active' : undefined}
          aria-pressed={!comparisonMode}
          onClick={() => setMode(false)}
        >
          {messages.comparisonResultLabel}
        </button>
        <button
          type="button"
          className={comparisonMode ? 'is-active' : undefined}
          aria-pressed={comparisonMode}
          onClick={() => setMode(true)}
        >
          {messages.comparisonOriginalLabel}
        </button>
      </div>
      {comparisonMode && !spaceBackground && (
        <p className="toolbar-notice">{messages.comparisonOriginalNoSpaceHint}</p>
      )}

      {spaceBackground ? (
        <p className="toolbar-notice">
          {messages.exportResolutionLabel}: {size.width} × {size.height} px
        </p>
      ) : (
        <p className="toolbar-notice">{messages.toolbarExportDisabledReason}</p>
      )}
    </ToolbarSection>
  );
}
