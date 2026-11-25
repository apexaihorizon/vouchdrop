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
