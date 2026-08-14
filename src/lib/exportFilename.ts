function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function buildTimestamp(date: Date): string {
  return (
    [date.getFullYear(), pad(date.getMonth() + 1), pad(date.getDate())].join('') +
    '-' +
    [pad(date.getHours()), pad(date.getMinutes()), pad(date.getSeconds())].join('')
  );
}

export function buildExportFilename(date: Date = new Date()): string {
  return `signage-canvas_${buildTimestamp(date)}.png`;
}

export function buildVideoExportFilename(date: Date = new Date()): string {
  return `signage-canvas_${buildTimestamp(date)}.webm`;
}
