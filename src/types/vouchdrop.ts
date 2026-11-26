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
