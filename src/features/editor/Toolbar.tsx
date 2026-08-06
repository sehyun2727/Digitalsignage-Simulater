import { useRef } from 'react';
import { useLocale } from '../../i18n/localeContext';
import { ACCEPTED_IMAGE_TYPES, validateImageFile } from '../../lib/fileValidation';
import { selectCanRedo, selectCanUndo, useEditorStore } from '../../store/editorStore';
import { TEMPLATES } from '../../types/editor';
import type { TemplateId } from '../../types/editor';

interface ToolbarProps {
  onImageError: (error: 'unsupported-type' | 'too-large' | 'decode-error') => void;
  onExport: () => void;
}

export function Toolbar({ onImageError, onExport }: ToolbarProps) {
  const { messages } = useLocale();
  const templateId = useEditorStore((state) => state.document.templateId);
  const selectedId = useEditorStore((state) => state.selectedId);
  const canUndo = useEditorStore(selectCanUndo);
  const canRedo = useEditorStore(selectCanRedo);
  const selectTemplate = useEditorStore((state) => state.selectTemplate);
  const addText = useEditorStore((state) => state.addText);
  const addImage = useEditorStore((state) => state.addImage);
  const deleteSelected = useEditorStore((state) => state.deleteSelected);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const templateLabel: Record<TemplateId, string> = {
    'wall-led': messages.editorTemplateWallLed,
    'stand-display': messages.editorTemplateStandDisplay,
  };

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
      addImage({ src: objectUrl, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight });
    };
    // A declared image/* MIME type does not guarantee the bytes are a valid,
    // decodable image (corrupted file, spoofed type, etc.). Fail safely instead
    // of leaving the user with no feedback and a leaked object URL.
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      onImageError('decode-error');
    };
    image.src = objectUrl;
  };

  return (
    <div className="editor-toolbar">
      <label className="editor-toolbar-field">
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

      <button type="button" onClick={addText}>
        {messages.editorAddTextButton}
      </button>

      <button type="button" onClick={() => fileInputRef.current?.click()}>
        {messages.editorAddImageButton}
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(',')}
        onChange={handleFileChange}
        className="visually-hidden"
        aria-label={messages.editorAddImageButton}
      />

      <button type="button" onClick={deleteSelected} disabled={!selectedId}>
        {messages.editorDeleteButton}
      </button>

      <button type="button" onClick={undo} disabled={!canUndo}>
        {messages.editorUndoButton}
      </button>

      <button type="button" onClick={redo} disabled={!canRedo}>
        {messages.editorRedoButton}
      </button>

      <button type="button" onClick={onExport}>
        {messages.editorExportButton}
      </button>
    </div>
  );
}
