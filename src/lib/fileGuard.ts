import { createSHA256 } from 'hash-wasm';

export type AllowedDocType = 'PDF' | 'DOCX' | 'PPTX' | 'CSV' | 'FIG';

const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB hard ceiling

export async function validateWorkDocument(file: File): Promise<{ valid: true; docType: AllowedDocType } | { valid: false; reason: string }> {
  if (file.size === 0) {
    return { valid: false, reason: 'File is empty (0 bytes)' };
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { valid: false, reason: 'File exceeds 2 GB transfer limit' };
  }

  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  const headerBuf = await file.slice(0, 4096).arrayBuffer();
  const bytes = new Uint8Array(headerBuf);

  // 1. PDF: %PDF- (0x25 0x50 0x44 0x46 0x2D)
  if (ext === 'pdf') {
    const isPdf = bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d;
    return isPdf ? { valid: true, docType: 'PDF' } : { valid: false, reason: 'Invalid PDF signature' };
  }

  // 2. Office Open XML (DOCX, PPTX) & Figma (FIG): ZIP container PK\x03\x04 (0x50 0x4B 0x03 0x04)
  if (ext === 'docx' || ext === 'pptx' || ext === 'fig') {
    const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
    if (!isZip) {
      return { valid: false, reason: `Invalid ${ext.toUpperCase()} binary header` };
    }
    return { valid: true, docType: ext.toUpperCase() as AllowedDocType };
  }

  // 3. CSV: Extension .csv + valid UTF-8 text without null/control binary bytes
  if (ext === 'csv') {
    for (let i = 0; i < bytes.length; i++) {
      if (bytes[i] === 0x00) {
        return { valid: false, reason: 'Binary content detected inside CSV file' };
      }
    }
    try {
      new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      return { valid: true, docType: 'CSV' };
    } catch {
      return { valid: false, reason: 'CSV is not valid UTF-8 text' };
    }
  }

  return { valid: false, reason: 'Only PDF, DOCX, PPTX, CSV, and FIG work documents are allowed' };
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