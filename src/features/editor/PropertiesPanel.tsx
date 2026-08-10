import { useRef, useState } from 'react';
import { useLocale } from '../../i18n/localeContext';
import { registerAsset } from '../../lib/assetRegistry';
import {
  clampContentOffset,
  clampContentScale,
  clampMaterialSetting,
} from '../../lib/contentLayout';
import { ACCEPTED_IMAGE_TYPES, validateImageFile } from '../../lib/fileValidation';
import { selectSelectedObject, useEditorStore } from '../../store/editorStore';
import {
  DEFAULT_MATERIAL_SETTINGS,
  MAX_CONTENT_SCALE,
  MAX_MATERIAL_SETTING,
  MIN_CONTENT_SCALE,
  MIN_MATERIAL_SETTING,
} from '../../types/editor';
import type { ImageValidationError } from '../../lib/fileValidation';
import type {
  ContentFit,
  DisplayMaterial,
  DisplaySignageObject,
  SignageObject,
} from '../../types/editor';

interface PropertiesPanelProps {
  onImageError: (error: ImageValidationError) => void;
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

export function PropertiesPanel({ onImageError }: PropertiesPanelProps) {
  const { messages } = useLocale();
  const selected = useEditorStore(selectSelectedObject);

  if (!selected) {
    return (
      <div className="editor-properties-panel">
        <h2>{messages.editorPropertiesTitle}</h2>
        <p>{messages.editorPropertiesEmptyHint}</p>
      </div>
    );
  }

  return <ObjectPropertiesForm key={selected.id} object={selected} onImageError={onImageError} />;
}

function ObjectPropertiesForm({
  object: selected,
  onImageError,
}: {
  object: SignageObject;
  onImageError: (error: ImageValidationError) => void;
}) {
  const { messages } = useLocale();
  const commitObjectChange = useEditorStore((state) => state.commitObjectChange);
  const [draft, setDraft] = useState<Draft>(() => toDraft(selected));

  const commit = (patch: Partial<SignageObject>) => {
    commitObjectChange(selected.id, patch);
  };

  return (
    <div className="editor-properties-panel">
      <h2>{messages.editorPropertiesTitle}</h2>

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

      {selected.kind === 'display' && (
        <DisplayPropertiesFields object={selected} onImageError={onImageError} />
      )}
    </div>
  );
}

/**
 * Split out from ObjectPropertiesForm (rather than inlined behind `selected.kind === 'display'`)
 * so `object` is typed as DisplaySignageObject at the prop boundary — TS narrowing of a union
 * parameter does not reliably survive into nested event-handler closures.
 */
function DisplayPropertiesFields({
  object,
  onImageError,
}: {
  object: DisplaySignageObject;
  onImageError: (error: ImageValidationError) => void;
}) {
  const { messages } = useLocale();
  const commitObjectChange = useEditorStore((state) => state.commitObjectChange);
  const updateObjectTransient = useEditorStore((state) => state.updateObjectTransient);
  const contentInputRef = useRef<HTMLInputElement | null>(null);
  const [intensityDraft, setIntensityDraft] = useState(object.materialSettings.intensity);
  const [brightnessDraft, setBrightnessDraft] = useState(object.materialSettings.brightness);
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
      <section className="editor-properties-section">
        <h3>{messages.editorContentLabel}</h3>

        {object.content ? (
          <>
            <div className="editor-properties-actions">
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
            <p>{messages.editorContentNoneHint}</p>
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
      </section>

      <section className="editor-properties-section">
        <h3>{messages.editorMaterialLabel}</h3>

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
            onBlur={() =>
              commitMaterialSettings({ intensity: clampMaterialSetting(intensityDraft) })
            }
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

        <p className="editor-properties-notice">{messages.editorMaterialPreviewNotice}</p>
      </section>
    </>
  );
}
