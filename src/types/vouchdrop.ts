import type { AppErrorCode } from '@/lib/errors';

export type AllowedDocType =
  | 'PDF'
  | 'XLSX'
  | 'DOCX'
  | 'PPTX'
  | 'ODS'
  | 'ODT'
  | 'ODP'
  | 'CSV'
  | 'TSV'
  | 'FIG';

export const ALL_ALLOWED_DOC_TYPES: readonly AllowedDocType[] = [
  'PDF',
  'XLSX',
  'DOCX',
  'PPTX',
  'ODS',
  'ODT',
  'ODP',
  'CSV',
  'TSV',
  'FIG',
] as const;

export const ALLOWED_FILE_ACCEPT = '.pdf,.xlsx,.docx,.pptx,.ods,.odt,.odp,.csv,.tsv,.fig';

export type SessionUser = {
  id: string;
  displayName: string;
};

export type TrustedContact = {
  id: string;
  displayName: string;
  connectedAt: string;
};

export type InvitePayload = {
  code: string;
  expiresAt: string;
};

export type ApiSuccess<T extends Record<string, unknown> = Record<string, never>> = {
  ok: true;
} & T;

export type ApiFailure = {
  ok: false;
  code: AppErrorCode;
  error: string;
};

export type ApiResponse<T extends Record<string, unknown> = Record<string, never>> =
  | ApiSuccess<T>
  | ApiFailure;
