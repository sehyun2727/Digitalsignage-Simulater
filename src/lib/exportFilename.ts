import type { TemplateId } from '../types/editor';

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function buildExportFilename(templateId: TemplateId, date: Date = new Date()): string {
  const stamp =
    [date.getFullYear(), pad(date.getMonth() + 1), pad(date.getDate())].join('') +
    '-' +
    [pad(date.getHours()), pad(date.getMinutes()), pad(date.getSeconds())].join('');

  return `signage-canvas_${templateId}_${stamp}.png`;
}
