// Builds a minimal, spec-valid Exif APP1 JPEG segment containing only an
// Orientation tag, so tests can splice real EXIF metadata onto a JPEG encoded
// by the browser itself (no external image library needed).
export function buildExifOrientationSegment(orientation: number): Buffer {
  const tiffHeader = Buffer.from([0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00]); // "II", 42, IFD0 @8

  const ifd = Buffer.alloc(18);
  ifd.writeUInt16LE(1, 0); // one directory entry
  ifd.writeUInt16LE(0x0112, 2); // tag: Orientation
  ifd.writeUInt16LE(3, 4); // type: SHORT
  ifd.writeUInt32LE(1, 6); // component count
  ifd.writeUInt16LE(orientation, 10); // value, left-justified in the 4-byte slot
  ifd.writeUInt16LE(0, 12); // padding
  ifd.writeUInt32LE(0, 14); // next IFD offset (none)

  const payload = Buffer.concat([Buffer.from('Exif\0\0', 'ascii'), tiffHeader, ifd]);

  const segment = Buffer.alloc(4 + payload.length);
  segment.writeUInt8(0xff, 0);
  segment.writeUInt8(0xe1, 1);
  segment.writeUInt16BE(payload.length + 2, 2);
  payload.copy(segment, 4);
  return segment;
}

export function spliceExifIntoJpeg(jpegBytes: Buffer, orientation: number): Buffer {
  const segment = buildExifOrientationSegment(orientation);
  return Buffer.concat([jpegBytes.subarray(0, 2), segment, jpegBytes.subarray(2)]);
}
