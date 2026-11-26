import { describe, expect, it } from 'vitest';
import { AppError } from '@/lib/errors';
import { MAX_FILE_SIZE_BYTES, validateWorkDocument } from '@/lib/fileGuard';

function makeBytesFile(name: string, bytes: Uint8Array): File {
  return new File([bytes as BlobPart], name);
}

function makeTextFile(name: string, content: string): File {
  return new File([content], name);
}

function makeZipWithEntries(name: string, entries: string[]): File {
  // Minimal ZIP local file header PK\x03\x04 followed by ASCII entry names / payloads
  const prefix = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00]);
  const body = new TextEncoder().encode(entries.join('\n'));
  const combined = new Uint8Array(prefix.length + body.length);
  combined.set(prefix, 0);
  combined.set(body, prefix.length);
  return makeBytesFile(name, combined);
}

describe('validateWorkDocument', () => {
  it('accepts valid PDF header', async () => {
    const file = makeTextFile('contract.pdf', '%PDF-1.7\n1 0 obj\n<<>>\nendobj');
    await expect(validateWorkDocument(file)).resolves.toEqual({ valid: true, docType: 'PDF' });
  });

  it('accepts valid OOXML documents (XLSX, DOCX, PPTX)', async () => {
    const xlsx = makeZipWithEntries('financials.xlsx', ['[Content_Types].xml', 'xl/workbook.xml']);
    const docx = makeZipWithEntries('memo.docx', ['[Content_Types].xml', 'word/document.xml']);
    const pptx = makeZipWithEntries('deck.pptx', ['[Content_Types].xml', 'ppt/presentation.xml']);

    await expect(validateWorkDocument(xlsx)).resolves.toEqual({ valid: true, docType: 'XLSX' });
    await expect(validateWorkDocument(docx)).resolves.toEqual({ valid: true, docType: 'DOCX' });
    await expect(validateWorkDocument(pptx)).resolves.toEqual({ valid: true, docType: 'PPTX' });
  });

  it('accepts valid OpenDocument formats (ODS, ODT, ODP)', async () => {
    const ods = makeZipWithEntries('ledger.ods', ['mimetypeapplication/vnd.oasis.opendocument.spreadsheet']);
    const odt = makeZipWithEntries('brief.odt', ['mimetypeapplication/vnd.oasis.opendocument.text']);
    const odp = makeZipWithEntries('slides.odp', ['mimetypeapplication/vnd.oasis.opendocument.presentation']);

    await expect(validateWorkDocument(ods)).resolves.toEqual({ valid: true, docType: 'ODS' });
    await expect(validateWorkDocument(odt)).resolves.toEqual({ valid: true, docType: 'ODT' });
    await expect(validateWorkDocument(odp)).resolves.toEqual({ valid: true, docType: 'ODP' });
  });

  it('accepts valid UTF-8 CSV and TSV files', async () => {
    const csv = makeTextFile('export.csv', 'name,amount\nAlice,120.50\n');
    const tsv = makeTextFile('export.tsv', 'name\tamount\nAlice\t120.50\n');

    await expect(validateWorkDocument(csv)).resolves.toEqual({ valid: true, docType: 'CSV' });
    await expect(validateWorkDocument(tsv)).resolves.toEqual({ valid: true, docType: 'TSV' });
  });

  it('accepts valid Figma files (ZIP container and fig-kiwi binary)', async () => {
    const zipFig = makeZipWithEntries('design.fig', ['canvas.fig', 'meta.json']);
    const kiwiFig = makeTextFile('system.fig', 'fig-kiwi\x00\x01binarypayload');

    await expect(validateWorkDocument(zipFig)).resolves.toEqual({ valid: true, docType: 'FIG' });
    await expect(validateWorkDocument(kiwiFig)).resolves.toEqual({ valid: true, docType: 'FIG' });
  });

  it('rejects generic ZIP archives renamed to .xlsx or .docx', async () => {
    const spoofedXlsx = makeZipWithEntries('fake.xlsx', ['readme.txt', 'payload.exe']);
    const spoofedDocx = makeZipWithEntries('fake.docx', ['[Content_Types].xml', 'xl/workbook.xml']);

    await expect(validateWorkDocument(spoofedXlsx)).rejects.toMatchObject({
      name: 'AppError',
      code: 'INVALID_FILE_TYPE',
    });
    await expect(validateWorkDocument(spoofedDocx)).rejects.toMatchObject({
      name: 'AppError',
      code: 'INVALID_FILE_TYPE',
    });
  });

  it('rejects binary files with null bytes renamed to .csv', async () => {
    const binaryCsv = makeBytesFile('malware.csv', new Uint8Array([0x4d, 0x5a, 0x00, 0x01, 0x02]));

    await expect(validateWorkDocument(binaryCsv)).rejects.toBeInstanceOf(AppError);
    await expect(validateWorkDocument(binaryCsv)).rejects.toMatchObject({
      code: 'INVALID_FILE_TYPE',
    });
  });

  it('rejects 0-byte files', async () => {
    const empty = makeBytesFile('empty.pdf', new Uint8Array(0));

    await expect(validateWorkDocument(empty)).rejects.toMatchObject({
      code: 'INVALID_FILE_TYPE',
    });
  });

  it('rejects files exceeding 2 GB with FILE_TOO_LARGE', async () => {
    const oversized = makeTextFile('huge.pdf', '%PDF-1.7\n');
    Object.defineProperty(oversized, 'size', { value: MAX_FILE_SIZE_BYTES + 1 });

    await expect(validateWorkDocument(oversized)).rejects.toMatchObject({
      name: 'AppError',
      code: 'FILE_TOO_LARGE',
      httpStatus: 413,
    });
  });
});
