export type ElementId = string;

export interface BaseSignageObject {
  id: ElementId;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

export interface TextSignageObject extends BaseSignageObject {
  kind: 'text';
  text: string;
  fontSize: number;
  color: string;
  align: 'left' | 'center' | 'right';
}

export interface ImageSignageObject extends BaseSignageObject {
  kind: 'image';
  src: string;
  naturalWidth: number;
  naturalHeight: number;
}

export type SignageObject = TextSignageObject | ImageSignageObject;

export type TemplateId = 'wall-led' | 'stand-display';

export interface SignageTemplate {
  id: TemplateId;
  width: number;
  height: number;
}

export const TEMPLATES: Record<TemplateId, SignageTemplate> = {
  'wall-led': { id: 'wall-led', width: 1920, height: 1080 },
  'stand-display': { id: 'stand-display', width: 1080, height: 1920 },
};

export const DEFAULT_TEMPLATE_ID: TemplateId = 'wall-led';

export interface EditorDocument {
  templateId: TemplateId;
  backgroundColor: string;
  objects: SignageObject[];
}

export const DEFAULT_BACKGROUND_COLOR = '#0b1120';

export function createEmptyDocument(templateId: TemplateId = DEFAULT_TEMPLATE_ID): EditorDocument {
  return {
    templateId,
    backgroundColor: DEFAULT_BACKGROUND_COLOR,
    objects: [],
  };
}
