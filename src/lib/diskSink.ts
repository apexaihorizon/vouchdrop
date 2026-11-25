import type { AllowedDocType } from '@/lib/fileGuard';

export const MIME_MAP: Record<AllowedDocType, { description: string; accept: Record<string, string[]> }> = {
  PDF: { description: 'PDF Document', accept: { 'application/pdf': ['.pdf'] } },
  DOCX: {
    description: 'Word Document',
    accept: { 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'] },
  },
  PPTX: {
    description: 'PowerPoint Presentation',
    accept: { 'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'] },
  },
  CSV: { description: 'CSV Spreadsheet', accept: { 'text/csv': ['.csv'] } },
  FIG: { description: 'Figma Archive', accept: { 'application/octet-stream': ['.fig'] } },
};

export type DiskSink = {
  write: (chunk: Uint8Array) => Promise<void>;
  close: () => Promise<void>;
  abort: () => Promise<void>;
};

export async function openDiskSink(suggestedName: string, docType: AllowedDocType): Promise<DiskSink> {
  // Primary: File System Access API (Windows Chrome + Android Chrome v132+)
  if ('showSaveFilePicker' in window) {
    const picker = window.showSaveFilePicker as (opts: {
      suggestedName: string;
      types?: { description: string; accept: Record<string, string[]> }[];
    }) => Promise<FileSystemFileHandle>;

    const handle = await picker({
      suggestedName,
      types: [MIME_MAP[docType]],
    });
    const writable = await handle.createWritable();

    return {
      write: (chunk) => writable.write(chunk as BufferSource),
      close: () => writable.close(),
      abort: () => writable.abort(),
    };
  }

  // Fallback: Origin Private File System (OPFS) -> triggers <a download> on close
  const root = await navigator.storage.getDirectory();
  const tempName = `vd-${crypto.randomUUID()}-${suggestedName}`;
  const fileHandle = await root.getFileHandle(tempName, { create: true });
  const writable = await fileHandle.createWritable();

  return {
    write: (chunk) => writable.write(chunk as BufferSource),
    close: async () => {
      await writable.close();
      const file = await fileHandle.getFile();
      const url = URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = url;
      a.download = suggestedName;
      a.click();
      setTimeout(() => {
        URL.revokeObjectURL(url);
        root.removeEntry(tempName).catch(() => {});
      }, 10_000);
    },
    abort: async () => {
      await writable.abort().catch(() => {});
      await root.removeEntry(tempName).catch(() => {});
    },
  };
}
