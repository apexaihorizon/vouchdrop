import { z } from 'zod';
import type { RegistrationResponseJSON, AuthenticationResponseJSON } from '@simplewebauthn/server';

export const DISPLAY_NAME_REGEX = /^[a-zA-Z0-9 _.-]+$/;
export const DISPLAY_NAME_ERROR =
  "Display name must be 2–32 characters using letters, numbers, spaces, '.', '_', or '-'.";

export const INVITE_CODE_REGEX = /^[A-Z0-9]{6}$/;
export const INVITE_CODE_ERROR = 'Invite code must be 6 uppercase alphanumeric characters.';

export function normalizeDisplayName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export const uuidSchema = z.string().uuid('Invalid identifier format.');

export const displayNameSchema = z
  .string()
  .transform(normalizeDisplayName)
  .pipe(
    z
      .string()
      .min(2, DISPLAY_NAME_ERROR)
      .max(32, DISPLAY_NAME_ERROR)
      .regex(DISPLAY_NAME_REGEX, DISPLAY_NAME_ERROR)
  );

export const registerOptionsSchema = z.object({
  displayName: displayNameSchema,
});

export const registerVerifySchema: z.ZodType<RegistrationResponseJSON> = z.object({
  id: z.string().min(1),
  rawId: z.string().min(1),
  type: z.literal('public-key'),
  response: z.object({
    clientDataJSON: z.string().min(1),
    attestationObject: z.string().min(1),
    authenticatorData: z.string().optional(),
    transports: z
      .array(z.enum(['ble', 'cable', 'hybrid', 'internal', 'nfc', 'smart-card', 'usb']))
      .optional(),
    publicKeyAlgorithm: z.number().optional(),
    publicKey: z.string().optional(),
  }),
  authenticatorAttachment: z.enum(['platform', 'cross-platform']).optional(),
  clientExtensionResults: z.record(z.string(), z.unknown()).default({}),
});

export const loginVerifySchema: z.ZodType<AuthenticationResponseJSON> = z.object({
  id: z.string().min(1),
  rawId: z.string().min(1),
  type: z.literal('public-key'),
  response: z.object({
    clientDataJSON: z.string().min(1),
    authenticatorData: z.string().min(1),
    signature: z.string().min(1),
    userHandle: z.string().optional(),
  }),
  authenticatorAttachment: z.enum(['platform', 'cross-platform']).optional(),
  clientExtensionResults: z.record(z.string(), z.unknown()).default({}),
});

export const redeemCodeSchema = z.object({
  code: z.string().trim().toUpperCase().regex(INVITE_CODE_REGEX, INVITE_CODE_ERROR),
});

export const pushSubscribeSchema = z.object({
  endpoint: z
    .string()
    .url('Push endpoint must be a valid URL.')
    .refine((url) => url.startsWith('https://'), 'Push endpoint must use HTTPS.'),
  keys: z.object({
    p256dh: z.string().min(1, 'Missing push encryption key.'),
    auth: z.string().min(1, 'Missing push auth secret.'),
  }),
});

export const MAX_TRANSFER_FILE_SIZE = 2 * 1024 * 1024 * 1024;

export const allowedDocTypeSchema = z.enum([
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
]);

export const knockRequestSchema = z.object({
  recipientId: uuidSchema,
  fileName: z
    .string()
    .transform((val) => val.replace(/[/\\]/g, '').trim())
    .pipe(z.string().min(1, 'File name is required.').max(255, 'File name is too long.')),
  fileSize: z.number().int().positive().max(MAX_TRANSFER_FILE_SIZE, 'File exceeds 2 GB transfer limit.'),
  fileType: allowedDocTypeSchema,
});

export const incomingKnockSchema = z.object({
  roomId: uuidSchema,
  senderName: z.string().min(1).max(64),
  fileName: z.string().min(1).max(255),
  fileSize: z.number().int().positive().max(MAX_TRANSFER_FILE_SIZE),
  fileType: allowedDocTypeSchema,
});

export const acceptKnockSchema = z.object({
  roomId: uuidSchema,
});

// Client-side API response contracts
export const apiFailureSchema = z.object({
  ok: z.literal(false),
  code: z.string(),
  error: z.string(),
});

export const authVerifyResponseSchema = z.object({
  ok: z.literal(true),
  user: z.object({
    id: z.string().min(1),
    displayName: z.string().min(1),
  }),
});

export const inviteResponseSchema = z.object({
  ok: z.literal(true),
  code: z.string().regex(INVITE_CODE_REGEX),
  expiresAt: z.string().min(1),
});

export const redeemResponseSchema = z.object({
  ok: z.literal(true),
  contact: z.object({
    id: z.string().min(1),
    displayName: z.string().min(1),
  }),
});

export const contactsListResponseSchema = z.object({
  ok: z.literal(true),
  contacts: z.array(
    z.object({
      id: z.string().min(1),
      displayName: z.string().min(1),
    })
  ),
});
