import { create } from 'zustand';
import { createId } from '../lib/id';
import type {
  EditorDocument,
  ElementId,
  ImageSignageObject,
  SignageObject,
  TemplateId,
  TextSignageObject,
} from '../types/editor';
import { createEmptyDocument, TEMPLATES } from '../types/editor';

const HISTORY_LIMIT = 50;

export interface EditorState {
  document: EditorDocument;
  selectedId: ElementId | null;
  past: EditorDocument[];
  future: EditorDocument[];
  selectTemplate: (templateId: TemplateId) => void;
  setBackgroundColor: (color: string) => void;
  addText: () => void;
  addImage: (payload: { src: string; naturalWidth: number; naturalHeight: number }) => void;
  selectObject: (id: ElementId | null) => void;
  updateObjectTransient: (id: ElementId, patch: Partial<SignageObject>) => void;
  commitObjectChange: (id: ElementId, patch: Partial<SignageObject>) => void;
  deleteSelected: () => void;
  undo: () => void;
  redo: () => void;
}

function pushHistory(past: EditorDocument[], current: EditorDocument): EditorDocument[] {
  const next = [...past, current];
  return next.length > HISTORY_LIMIT ? next.slice(next.length - HISTORY_LIMIT) : next;
}

function patchObjects(objects: SignageObject[], id: ElementId, patch: Partial<SignageObject>): SignageObject[] {
  return objects.map((object) => (object.id === id ? ({ ...object, ...patch } as SignageObject) : object));
}

function hasObjectChange(target: SignageObject, patch: Partial<SignageObject>): boolean {
  return (Object.keys(patch) as (keyof SignageObject)[]).some((key) => target[key] !== patch[key]);
}

export const useEditorStore = create<EditorState>((set, get) => ({
  document: createEmptyDocument(),
  selectedId: null,
  past: [],
  future: [],

  selectTemplate: (templateId) => {
    const { document } = get();
    if (document.templateId === templateId) return;
    set({
      document: { templateId, backgroundColor: document.backgroundColor, objects: [] },
      selectedId: null,
      past: pushHistory(get().past, document),
      future: [],
    });
  },

  setBackgroundColor: (color) => {
    const { document } = get();
    set({
      document: { ...document, backgroundColor: color },
      past: pushHistory(get().past, document),
      future: [],
    });
  },

  addText: () => {
    const { document } = get();
    const template = TEMPLATES[document.templateId];
    const newObject: TextSignageObject = {
      id: createId(),
      kind: 'text',
      x: template.width / 2 - 150,
      y: template.height / 2 - 30,
      width: 300,
      height: 60,
      rotation: 0,
      text: '',
      fontSize: 48,
      color: '#ffffff',
      align: 'center',
    };
    set({
      document: { ...document, objects: [...document.objects, newObject] },
      selectedId: newObject.id,
      past: pushHistory(get().past, document),
      future: [],
    });
  },

  addImage: ({ src, naturalWidth, naturalHeight }) => {
    const { document } = get();
    const template = TEMPLATES[document.templateId];
    const maxWidth = template.width * 0.6;
    const scale = naturalWidth > maxWidth ? maxWidth / naturalWidth : 1;
    const width = naturalWidth * scale;
    const height = naturalHeight * scale;
    const newObject: ImageSignageObject = {
      id: createId(),
      kind: 'image',
      x: template.width / 2 - width / 2,
      y: template.height / 2 - height / 2,
      width,
      height,
      rotation: 0,
      src,
      naturalWidth,
      naturalHeight,
    };
    set({
      document: { ...document, objects: [...document.objects, newObject] },
      selectedId: newObject.id,
      past: pushHistory(get().past, document),
      future: [],
    });
  },

  selectObject: (id) => set({ selectedId: id }),

  updateObjectTransient: (id, patch) => {
    const { document } = get();
    set({ document: { ...document, objects: patchObjects(document.objects, id, patch) } });
  },

  commitObjectChange: (id, patch) => {
    const { document, past } = get();
    const target = document.objects.find((object) => object.id === id);
    if (!target || !hasObjectChange(target, patch)) return;

    const nextDocument: EditorDocument = {
      ...document,
      objects: patchObjects(document.objects, id, patch),
    };
    set({
      document: nextDocument,
      past: pushHistory(past, document),
      future: [],
    });
  },

  deleteSelected: () => {
    const { document, selectedId, past } = get();
    if (!selectedId) return;
    set({
      document: { ...document, objects: document.objects.filter((object) => object.id !== selectedId) },
      selectedId: null,
      past: pushHistory(past, document),
      future: [],
    });
  },

  undo: () => {
    const { past, document, future } = get();
    if (past.length === 0) return;
    const previous = past[past.length - 1]!;
    set({
      document: previous,
      past: past.slice(0, -1),
      future: [document, ...future],
      selectedId: null,
    });
  },

  redo: () => {
    const { future, document, past } = get();
    if (future.length === 0) return;
    const next = future[0]!;
    set({
      document: next,
      future: future.slice(1),
      past: [...past, document],
      selectedId: null,
    });
  },
}));

export function selectCanUndo(state: EditorState): boolean {
  return state.past.length > 0;
}

export function selectCanRedo(state: EditorState): boolean {
  return state.future.length > 0;
}

export function selectSelectedObject(state: EditorState): SignageObject | null {
  return state.document.objects.find((object) => object.id === state.selectedId) ?? null;
}
