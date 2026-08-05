import { useState } from 'react';
import { useLocale } from '../../i18n/localeContext';
import { selectSelectedObject, useEditorStore } from '../../store/editorStore';
import type { SignageObject } from '../../types/editor';

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

export function PropertiesPanel() {
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

  return <ObjectPropertiesForm key={selected.id} object={selected} />;
}

function ObjectPropertiesForm({ object: selected }: { object: SignageObject }) {
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
    </div>
  );
}
