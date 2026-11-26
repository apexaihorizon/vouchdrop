import { createSHA256 } from 'hash-wasm';
import { AppError } from '@/lib/errors';
import type { AllowedDocType } from '@/types/vouchdrop';

export type { AllowedDocType };

export const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB hard ceiling
const SNIFF_WINDOW_BYTES = 65_536; // 64 KB header/directory inspection window

const OOXML_SIGNATURES: Record<'xlsx' | 'docx' | 'pptx', { docType: AllowedDocType; dirPrefix: string }> = {
  xlsx: { docType: 'XLSX', dirPrefix: 'xl/' },
  docx: { docType: 'DOCX', dirPrefix: 'word/' },
  pptx: { docType: 'PPTX', dirPrefix: 'ppt/' },
};

const ODF_SIGNATURES: Record<'ods' | 'odt' | 'odp', { docType: AllowedDocType; mime: string }> = {
  ods: { docType: 'ODS', mime: 'application/vnd.oasis.opendocument.spreadsheet' },
  odt: { docType: 'ODT', mime: 'application/vnd.oasis.opendocument.text' },
  odp: { docType: 'ODP', mime: 'application/vnd.oasis.opendocument.presentation' },
};

const FIG_KIWI_MAGIC = [0x66, 0x69, 0x67, 0x2d, 0x6b, 0x69, 0x77, 0x69]; // "fig-kiwi"

function hasZipLocalHeader(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

function hasPrefixBytes(bytes: Uint8Array, prefix: number[]): boolean {
  if (bytes.length < prefix.length) return false;
  for (let i = 0; i < prefix.length; i++) {
    if (bytes[i] !== prefix[i]) return false;
  }
  return true;
}

function decodeByteWindow(bytes: Uint8Array): string {
  return new TextDecoder('latin1').decode(bytes);
}

export async function validateWorkDocument(file: File): Promise<{ valid: true; docType: AllowedDocType }> {
  if (file.size <= 0) {
    throw new AppError('INVALID_FILE_TYPE', 'File is empty (0 bytes).', 400);
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new AppError('FILE_TOO_LARGE', 'File exceeds the 2 GB transfer limit.', 413);
  }

  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  const headerBuf = await file.slice(0, SNIFF_WINDOW_BYTES).arrayBuffer();
  const bytes = new Uint8Array(headerBuf);

  // 1. PDF: %PDF- (0x25 0x50 0x44 0x46 0x2D)
  if (ext === 'pdf') {
    const isPdf = hasPrefixBytes(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d]);
    if (!isPdf) {
      throw new AppError('INVALID_FILE_TYPE', 'Invalid PDF header signature.', 400);
    }
    return { valid: true, docType: 'PDF' };
  }

  // 2. Office Open XML (XLSX, DOCX, PPTX): ZIP header + [Content_Types].xml + format directory prefix
  if (ext === 'xlsx' || ext === 'docx' || ext === 'pptx') {
    const spec = OOXML_SIGNATURES[ext];
    if (!hasZipLocalHeader(bytes)) {
      throw new AppError('INVALID_FILE_TYPE', `Invalid ${spec.docType} archive header.`, 400);
    }
    const windowText = decodeByteWindow(bytes);
    if (!windowText.includes('[Content_Types].xml') || !windowText.includes(spec.dirPrefix)) {
      throw new AppError(
        'INVALID_FILE_TYPE',
        `File does not contain a valid ${spec.docType} document structure.`,
        400
      );
    }
    return { valid: true, docType: spec.docType };
  }

  // 3. OpenDocument (ODS, ODT, ODP): ZIP header + uncompressed mimetype entry
  if (ext === 'ods' || ext === 'odt' || ext === 'odp') {
    const spec = ODF_SIGNATURES[ext];
    if (!hasZipLocalHeader(bytes)) {
      throw new AppError('INVALID_FILE_TYPE', `Invalid ${spec.docType} archive header.`, 400);
    }
    const windowText = decodeByteWindow(bytes);
    if (!windowText.includes(spec.mime)) {
      throw new AppError(
        'INVALID_FILE_TYPE',
        `File does not match the OpenDocument ${spec.docType} signature.`,
        400
      );
    }
    return { valid: true, docType: spec.docType };
  }

  // 4. Figma (.fig): fig-kiwi binary header OR ZIP archive containing canvas.fig / meta.json
  if (ext === 'fig') {
    if (hasPrefixBytes(bytes, FIG_KIWI_MAGIC)) {
      return { valid: true, docType: 'FIG' };
    }
    if (hasZipLocalHeader(bytes)) {
      const windowText = decodeByteWindow(bytes);
      if (windowText.includes('canvas.fig') || windowText.includes('meta.json')) {
        return { valid: true, docType: 'FIG' };
      }
    }
    throw new AppError('INVALID_FILE_TYPE', 'Invalid Figma (.fig) file signature.', 400);
  }

  // 5. Delimited text (CSV, TSV): valid UTF-8 with zero null bytes
  if (ext === 'csv' || ext === 'tsv') {
    for (let i = 0; i < bytes.length; i++) {
      if (bytes[i] === 0x00) {
        throw new AppError(
          'INVALID_FILE_TYPE',
          `Binary content detected inside ${ext.toUpperCase()} file.`,
          400
        );
      }
    }
    try {
      new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      throw new AppError('INVALID_FILE_TYPE', `${ext.toUpperCase()} file is not valid UTF-8 text.`, 400);
    }
    return { valid: true, docType: ext === 'csv' ? 'CSV' : 'TSV' };
  }

  throw new AppError(
    'INVALID_FILE_TYPE',
    'Only PDF, XLSX, DOCX, PPTX, ODS, ODT, ODP, CSV, TSV, and FIG work documents are allowed.',
    400
  );
}

export async function createIncrementalHasher() {
  const hasher = await createSHA256();
  hasher.init();
  return {
    update(chunk: Uint8Array) {
      hasher.update(chunk);
    },
    digest(): string {
      return hasher.digest('hex');
    },
  };
}
