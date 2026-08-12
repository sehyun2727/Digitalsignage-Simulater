import { useRef, useState } from 'react';
import { useLocale } from '../../i18n/localeContext';
import { getRegisteredAsset, registerAsset } from '../../lib/assetRegistry';
import {
  clampContentOffset,
  clampContentScale,
  clampMaterialSetting,
} from '../../lib/contentLayout';
import { ACCEPTED_IMAGE_TYPES, validateImageFile } from '../../lib/fileValidation';
import { selectSelectedObject, useEditorStore } from '../../store/editorStore';
import { useUiStore } from '../../store/uiStore';
import {
  DEFAULT_MATERIAL_SETTINGS,
  MAX_CONTENT_SCALE,
  MAX_MATERIAL_SETTING,
  MIN_CONTENT_SCALE,
  MIN_MATERIAL_SETTING,
  TEMPLATES,
} from '../../types/editor';
import { PortableBuilderModal } from './PortableBuilderModal';
import type { ImageValidationError } from '../../lib/fileValidation';
import type {
  ContentFit,
  DisplayMaterial,
  DisplaySignageObject,
  PortableSignageObject,
  SignageObject,
  TemplateId,
} from '../../types/editor';

interface ToolbarProps {
  onImageError: (error: ImageValidationError) => void;
}

/**
 * The single always-visible right-side toolbar (Sprint 4.1 correction). Six fixed sections in
 * a fixed order — Space, Add signage, Selected signage, Content, Appearance, Export — replace
 * the earlier five-stage guided flow (see ADR 0006): nothing here is mounted/unmounted based
 * on navigation, so every control is reachable at all times and existing accessible-name-based
 * tests keep working unchanged.
 */
export function Toolbar({ onImageError }: ToolbarProps) {
  const { messages } = useLocale();

  return (
    <div className="toolbar" aria-label={messages.toolbarAriaLabel}>
      <SpaceSection onImageError={onImageError} />
      <AddSignageSection onImageError={onImageError} />
      <SelectedSignageSection onImageError={onImageError} />
      <ContentSection onImageError={onImageError} />
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

function SpaceSection({ onImageError }: { onImageError: (error: ImageValidationError) => void }) {
  const { messages } = useLocale();
  const templateId = useEditorStore((state) => state.document.templateId);
  const spaceBackground = useEditorStore((state) => state.document.spaceBackground);
  const selectTemplate = useEditorStore((state) => state.selectTemplate);
  const addSpaceBackground = useEditorStore((state) => state.addSpaceBackground);
  const removeSpaceBackground = useEditorStore((state) => state.removeSpaceBackground);
  const spaceBackgroundInputRef = useRef<HTMLInputElement | null>(null);

  const templateLabel: Record<TemplateId, string> = {
    'wall-led': messages.editorTemplateWallLed,
    'stand-display': messages.editorTemplateStandDisplay,
  };

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
      const asset = await registerAsset(file);
      addSpaceBackground(asset);
    } catch {
      onImageError('decode-error');
    }
  };

  const thumbnailUrl = spaceBackground
    ? getRegisteredAsset(spaceBackground.sourceId)?.objectUrl
    : undefined;

  return (
    <ToolbarSection heading={messages.toolbarSpaceSectionHeading}>
      <label className="toolbar-field">
        <span>{messages.editorTemplateLabel}</span>
        <select
          value={templateId}
          onChange={(event) => selectTemplate(event.target.value as TemplateId)}
        >
          {Object.keys(TEMPLATES).map((id) => (
            <option key={id} value={id}>
              {templateLabel[id as TemplateId]}
            </option>
          ))}
        </select>
      </label>

      {spaceBackground && thumbnailUrl && (
        <img
          className="space-background-thumb"
          src={thumbnailUrl}
          alt=""
          width={spaceBackground.naturalWidth}
          height={spaceBackground.naturalHeight}
        />
      )}
      {spaceBackground && (
        <p className="toolbar-notice">
          {spaceBackground.naturalWidth} × {spaceBackground.naturalHeight} px
        </p>
      )}

      <div className="toolbar-actions">
        <button type="button" onClick={() => spaceBackgroundInputRef.current?.click()}>
          {spaceBackground
            ? messages.editorAddSpaceBackgroundButton
            : messages.editorAddSpaceBackgroundButton}
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
        aria-label={messages.editorAddSpaceBackgroundButton}
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
  const addText = useEditorStore((state) => state.addText);
  const addImage = useEditorStore((state) => state.addImage);
  const addDisplay = useEditorStore((state) => state.addDisplay);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [builderOpen, setBuilderOpen] = useState(false);

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
      <div className="toolbar-actions toolbar-actions-grid">
        <button type="button" onClick={() => addDisplay('wall-led')}>
          {messages.editorAddWallLedButton}
        </button>
        <button type="button" onClick={() => addDisplay('stand-display')}>
          {messages.editorAddStandDisplayButton}
        </button>
        <button type="button" onClick={() => setBuilderOpen(true)}>
          {messages.editorAddPortableButton}
        </button>
      </div>

      <div className="toolbar-actions">
        <button type="button" onClick={addText}>
          {messages.editorAddTextButton}
        </button>
        <button type="button" onClick={() => fileInputRef.current?.click()}>
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
    case 'display':
      return object.frameId === 'wall-led'
        ? messages.signageTypeWallLed
        : messages.signageTypeStandDisplay;
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

function ContentSection({ onImageError }: { onImageError: (error: ImageValidationError) => void }) {
  const { messages } = useLocale();
  const selected = useEditorStore(selectSelectedObject);
  const hasContentSupport = selected?.kind === 'display' || selected?.kind === 'portable';

  return (
    <ToolbarSection heading={messages.editorContentLabel}>
      {!hasContentSupport ? (
        <p className="toolbar-notice">{messages.toolbarContentEmptyHint}</p>
      ) : (
        <ContentFields key={selected.id} object={selected} onImageError={onImageError} />
      )}
    </ToolbarSection>
  );
}

function ContentFields({
  object,
  onImageError,
}: {
  object: DisplaySignageObject | PortableSignageObject;
  onImageError: (error: ImageValidationError) => void;
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

    const error = validateImageFile(file);
    if (error) {
      onImageError(error);
      return;
    }

    try {
      const asset = await registerAsset(file);
      commit({
        content: {
          kind: 'image',
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
      onImageError('decode-error');
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
        accept={ACCEPTED_IMAGE_TYPES.join(',')}
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

function AppearanceFields({ object }: { object: DisplaySignageObject | PortableSignageObject }) {
  const { messages } = useLocale();
  const commitObjectChange = useEditorStore((state) => state.commitObjectChange);
  const updateObjectTransient = useEditorStore((state) => state.updateObjectTransient);
  const [intensityDraft, setIntensityDraft] = useState(object.materialSettings.intensity);
  const [brightnessDraft, setBrightnessDraft] = useState(object.materialSettings.brightness);

  const commit = (patch: Partial<SignageObject>) => commitObjectChange(object.id, patch);

  const commitMaterialSettings = (patch: Partial<{ intensity: number; brightness: number }>) => {
    commit({ materialSettings: { ...object.materialSettings, ...patch } });
  };

  const previewMaterialSettings = (patch: Partial<{ intensity: number; brightness: number }>) => {
    updateObjectTransient(object.id, {
      materialSettings: { ...object.materialSettings, ...patch },
    });
  };

  return (
    <>
      <select
        aria-label={messages.editorMaterialLabel}
        value={object.material}
        onChange={(event) => commit({ material: event.target.value as DisplayMaterial })}
      >
        <option value="outdoor-led">{messages.editorMaterialOutdoorLed}</option>
        <option value="lcd">{messages.editorMaterialLcd}</option>
      </select>

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

      <button
        type="button"
        onClick={() => {
          commit({ materialSettings: { ...DEFAULT_MATERIAL_SETTINGS } });
          setIntensityDraft(DEFAULT_MATERIAL_SETTINGS.intensity);
          setBrightnessDraft(DEFAULT_MATERIAL_SETTINGS.brightness);
        }}
      >
        {messages.editorMaterialResetButton}
      </button>

      <p className="toolbar-notice">{messages.editorMaterialPreviewNotice}</p>
    </>
  );
}

function ExportSection() {
  const { messages } = useLocale();
  const templateId = useEditorStore((state) => state.document.templateId);
  const spaceBackground = useEditorStore((state) => state.document.spaceBackground);
  const comparisonMode = useUiStore((state) => state.comparisonMode);
  const setComparisonMode = useUiStore((state) => state.setComparisonMode);
  const selectObject = useEditorStore((state) => state.selectObject);
  const template = TEMPLATES[templateId];

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

      <p className="toolbar-notice">
        {messages.exportResolutionLabel}: {template.width} × {template.height} px
      </p>
    </ToolbarSection>
  );
}
