import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale } from '../../i18n/localeContext';
import { buildExportFilename } from '../../lib/exportFilename';
import type { ImageValidationError } from '../../lib/fileValidation';
import { useEditorStore } from '../../store/editorStore';
import type { EditorCanvasHandle } from './EditorCanvas';
import { EditorCanvas } from './EditorCanvas';
import { PropertiesPanel } from './PropertiesPanel';
import { Toolbar } from './Toolbar';

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

export function EditorLayout() {
  const { messages } = useLocale();
  const objectCount = useEditorStore((state) => state.document.objects.length);
  const templateId = useEditorStore((state) => state.document.templateId);
  const deleteSelected = useEditorStore((state) => state.deleteSelected);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);
  const canvasRef = useRef<EditorCanvasHandle>(null);
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isEditableTarget(event.target)) return;

      if ((event.key === 'Delete' || event.key === 'Backspace') && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        deleteSelected();
        return;
      }

      const isModifier = event.ctrlKey || event.metaKey;
      if (!isModifier) return;

      if (event.key.toLowerCase() === 'z' && event.shiftKey) {
        event.preventDefault();
        redo();
      } else if (event.key.toLowerCase() === 'z') {
        event.preventDefault();
        undo();
      } else if (event.key.toLowerCase() === 'y') {
        event.preventDefault();
        redo();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [deleteSelected, undo, redo]);

  const handleImageError = useCallback(
    (error: ImageValidationError) => {
      if (error === 'unsupported-type') {
        setAnnouncement(messages.editorImageUploadErrorUnsupportedType);
      } else if (error === 'too-large') {
        setAnnouncement(messages.editorImageUploadErrorTooLarge);
      } else {
        setAnnouncement(messages.editorImageUploadErrorDecodeFailed);
      }
    },
    [messages],
  );

  const handleExport = useCallback(() => {
    let dataUrl: string | null = null;
    try {
      dataUrl = canvasRef.current?.exportToDataUrl() ?? null;
    } catch {
      // Fall through to the accessible error announcement below.
    }

    if (!dataUrl) {
      setAnnouncement(messages.editorExportErrorAnnouncement);
      return;
    }

    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = buildExportFilename(templateId);
    document.body.appendChild(link);
    link.click();
    link.remove();
    setAnnouncement(messages.editorExportedAnnouncement);
  }, [templateId, messages]);

  return (
    <div className="editor-layout">
      <Toolbar onImageError={handleImageError} onExport={handleExport} />

      <div className="editor-workspace">
        <div className="editor-canvas-wrapper">
          {objectCount === 0 && <p className="editor-empty-hint">{messages.editorEmptyCanvasHint}</p>}
          <EditorCanvas ref={canvasRef} />
        </div>
        <PropertiesPanel />
      </div>

      <p role="status" aria-live="polite" className="visually-hidden">
        {announcement}
      </p>
    </div>
  );
}
