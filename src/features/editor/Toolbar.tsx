import { useEffect, useRef, useState } from 'react';
import { useLocale } from '../../i18n/localeContext';
import { getRegisteredAsset, registerSpaceBackgroundAsset } from '../../lib/assetRegistry';
import {
  clampContentOffset,
  clampContentScale,
  clampMaterialSetting,
} from '../../lib/contentLayout';
import { clampCurvatureAmount, isCurvatureSupported } from '../../lib/curvature';
import type { ContentValidationError } from '../../lib/contentUpload';
import {
  contentKindForFile,
  registerContentAsset,
  validateContentFile,
} from '../../lib/contentUpload';
import {
  clampContactShadowOffset,
  clampContactShadowSetting,
  clampEnvironmentIntegration,
} from '../../lib/environmentIntegration';
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
  CURRENT_DISPLAY_MATERIALS,
  DEFAULT_CURVATURE,
  getDocumentSize,
  MAX_CONTENT_SCALE,
  MAX_CONTACT_SHADOW_SETTING,
  MAX_CURVATURE_AMOUNT,
  MAX_ENVIRONMENT_INTEGRATION,
  MAX_MATERIAL_SETTING,
  MIN_CONTENT_SCALE,
  MIN_CONTACT_SHADOW_SETTING,
  MIN_CURVATURE_AMOUNT,
  MIN_ENVIRONMENT_INTEGRATION,
  MIN_MATERIAL_SETTING,
  supportsPerspective,
} from '../../types/editor';
import { ACCEPTED_VIDEO_TYPES } from '../../lib/videoValidation';
import { PortableBuilderModal } from './PortableBuilderModal';
import type { ImageValidationError } from '../../lib/fileValidation';
import type {
  ContactShadowSettings,
  ContentFit,
  ContentKind,
  CurvatureMode,
  DisplayMaterial,
  DisplaySignageObject,
  EnvironmentIntegrationSettings,
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
 * control stays reachable at all times. The Space section's uploaded photo is the sole source of
 * document/export size (see ADR 0007); every other section is gated on that photo existing.
 */
export function Toolbar({ onImageError, onContentError }: ToolbarProps) {
  const { messages } = useLocale();

  return (
    <div className="toolbar" aria-label={messages.toolbarAriaLabel}>
      <SpaceSection onImageError={onImageError} />
      <AddSignageSection onImageError={onImageError} />
      <SelectedSignageSection onImageError={onImageError} />
      <ContentSection onContentError={onContentError} />
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
  const setSpaceBackground = useEditorStore((state) => state.setSpaceBackground);
  const removeSpaceBackground = useEditorStore((state) => state.removeSpaceBackground);
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
        <button type="button" onClick={() => spaceBackgroundInputRef.current?.click()}>
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

function AddSignageSection({
  onImageError,
}: {
  onImageError: (error: ImageValidationError) => void;
}) {
  const { messages } = useLocale();
  const document = useEditorStore((state) => state.document);
  const addText = useEditorStore((state) => state.addText);
  const addImage = useEditorStore((state) => state.addImage);
  const addDisplay = useEditorStore((state) => state.addDisplay);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [builderOpen, setBuilderOpen] = useState(false);
  const canAddSignage = getDocumentSize(document) !== null;

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const error = validateImageFile(file);
    if (error) {
      onImageError(error);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      addImage({
        src: objectUrl,
        naturalWidth: image.naturalWidth,
        naturalHeight: image.naturalHeight,
      });
    };
    // A declared image/* MIME type does not guarantee the bytes are a valid, decodable image
    // (corrupted file, spoofed type, etc.). Fail safely instead of leaving the user with no
    // feedback and a leaked object URL.
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      onImageError('decode-error');
    };
    image.src = objectUrl;
  };

  return (
    <ToolbarSection heading={messages.toolbarAddSignageSectionHeading}>
      {!canAddSignage && <p className="toolbar-notice">{messages.toolbarAddSignageDisabledHint}</p>}

      <div className="toolbar-actions toolbar-actions-grid">
        <button type="button" disabled={!canAddSignage} onClick={() => addDisplay('led')}>
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
        <button type="button" disabled={!canAddSignage} onClick={() => setBuilderOpen(true)}>
          {messages.editorAddPortableButton}
        </button>
      </div>

      <div className="toolbar-actions">
        <button type="button" disabled={!canAddSignage} onClick={addText}>
          {messages.editorAddTextButton}
        </button>
        <button
          type="button"
          disabled={!canAddSignage}
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

      {builderOpen && (
        <PortableBuilderModal
          mode="create"
          onClose={() => setBuilderOpen(false)}
          onImageError={onImageError}
        />
      )}
    </ToolbarSection>
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

function SelectedSignageSection({
  onImageError,
}: {
  onImageError: (error: ImageValidationError) => void;
}) {
  const { messages } = useLocale();
  const selected = useEditorStore(selectSelectedObject);
  const deleteSelected = useEditorStore((state) => state.deleteSelected);

  return (
    <ToolbarSection heading={messages.toolbarSelectedSignageSectionHeading}>
      {!selected ? (
        <p className="toolbar-notice">{messages.editorPropertiesEmptyHint}</p>
      ) : (
        <SelectedSignageFields key={selected.id} object={selected} onImageError={onImageError} />
      )}
      <button type="button" onClick={deleteSelected} disabled={!selected}>
        {messages.editorDeleteButton}
      </button>
    </ToolbarSection>
  );
}

function SelectedSignageFields({
  object: selected,
  onImageError,
}: {
  object: SignageObject;
  onImageError: (error: ImageValidationError) => void;
}) {
  const { messages } = useLocale();
  const commitObjectChange = useEditorStore((state) => state.commitObjectChange);
  const [draft, setDraft] = useState<Draft>(() => toDraft(selected));
  const [regionEditorOpen, setRegionEditorOpen] = useState(false);

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
        <div className="toolbar-actions">
          <button type="button" onClick={() => setRegionEditorOpen(true)}>
            {messages.portableScreenRegionEditButton}
          </button>
        </div>
      )}
      {selected.kind === 'portable' && (
        <p className="toolbar-notice">{messages.portableReplacePhotoHint}</p>
      )}

      {selected.kind === 'portable' && regionEditorOpen && (
        <PortableBuilderModal
          mode="edit-region"
          editingObject={selected}
          onClose={() => setRegionEditorOpen(false)}
          onImageError={onImageError}
        />
      )}
    </>
  );
}

/** Entry points for perspective ("Fit to space") edit mode; while this object's own edit session
 *  is open, the corner-drag controls live in PerspectiveEditOverlay instead, so this renders
 *  nothing to avoid a second, conflicting "Fit to space" affordance on screen at the same time. */
function PerspectiveFitControls({ object }: { object: PerspectiveCapableObject }) {
  const { messages } = useLocale();
  const perspectiveEditId = useEditorStore((state) => state.perspectiveEditId);
  const beginPerspectiveEdit = useEditorStore((state) => state.beginPerspectiveEdit);
  const commitObjectChange = useEditorStore((state) => state.commitObjectChange);

  if (perspectiveEditId === object.id) return null;

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
}: {
  onContentError: (kind: ContentKind, error: ContentValidationError) => void;
}) {
  const { messages } = useLocale();
  const selected = useEditorStore(selectSelectedObject);
  const hasContentSupport = selected?.kind === 'display' || selected?.kind === 'portable';

  return (
    <ToolbarSection heading={messages.editorContentLabel}>
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
      commit({
        content: {
          kind: asset.kind,
          sourceId: asset.sourceId,
          fit: object.content?.fit ?? 'contain',
          offsetX: 0,
          offsetY: 0,
          scale: 1,
        },
      });
      setOffsetXDraft(0);
      setOffsetYDraft(0);
      setScaleDraft(1);
    } catch {
      onContentError(contentKindForFile(file), 'decode-error');
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
                commit({ content: { ...object.content, scale: clampContentScale(scaleDraft) } });
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
        </>
      ) : (
        <>
          <p className="toolbar-notice">{messages.editorContentNoneHint}</p>
          <button type="button" onClick={() => contentInputRef.current?.click()}>
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

  return (
    <ToolbarSection heading={messages.toolbarAppearanceSectionHeading}>
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

function AppearanceFields({ object }: { object: DisplaySignageObject | PortableSignageObject }) {
  const { messages } = useLocale();
  const commitObjectChange = useEditorStore((state) => state.commitObjectChange);
  const updateObjectTransient = useEditorStore((state) => state.updateObjectTransient);
  const applyRenderingPresetAction = useEditorStore((state) => state.applyRenderingPreset);
  const [advancedOpen, setAdvancedOpen] = useState(false);
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

      {isTransparentLed && (
        <p className="toolbar-notice">{messages.editorTransparentLedDisclaimer}</p>
      )}

      <label className="toolbar-checkbox-field">
        <input
          type="checkbox"
          checked={advancedOpen}
          onChange={(event) => setAdvancedOpen(event.target.checked)}
        />
        <span>{messages.editorMaterialAdvancedToggleLabel}</span>
      </label>

      {advancedOpen && (
        <>
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
        </>
      )}

      <button type="button" onClick={resetMaterial}>
        {messages.editorMaterialResetButton}
      </button>

      <p className="toolbar-notice">{messages.editorMaterialPreviewNotice}</p>

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
            onBlur={() => commitCurvature({ amount: clampCurvatureAmount(curvatureAmountDraft) })}
          />
        </label>
      )}

      {curvatureSupported && (
        <button type="button" onClick={resetCurvature}>
          {messages.editorCurvatureResetButton}
        </button>
      )}

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
                  commitContactShadow({ strength: clampContactShadowSetting(shadowStrengthDraft) })
                }
                onBlur={() =>
                  commitContactShadow({ strength: clampContactShadowSetting(shadowStrengthDraft) })
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

        <button type="button" onClick={resetEnvironmentIntegration}>
          {messages.editorEnvironmentIntegrationResetButton}
        </button>
      </div>
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
  const size = getDocumentSize(document);

  const setMode = (nextComparisonMode: boolean) => {
    setComparisonMode(nextComparisonMode);
    if (nextComparisonMode) selectObject(null);
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

      {size ? (
        <p className="toolbar-notice">
          {messages.exportResolutionLabel}: {size.width} × {size.height} px
        </p>
      ) : (
        <p className="toolbar-notice">{messages.toolbarExportDisabledReason}</p>
      )}
    </ToolbarSection>
  );
}
