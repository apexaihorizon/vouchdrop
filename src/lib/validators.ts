import { z } from 'zod';
import type { RegistrationResponseJSON, AuthenticationResponseJSON } from '@simplewebauthn/server';

export const DISPLAY_NAME_REGEX = /^[a-zA-Z0-9 _.-]+$/;
export const DISPLAY_NAME_ERROR =
  "Display name must be 2–32 characters using letters, numbers, spaces, '.', '_', or '-'.";

export function normalizeDisplayName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

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
  code: z
    .string()
    .trim()
    .toUpperCase()
    .length(6, 'Invite code must be exactly 6 characters')
    .regex(/^[A-Z2-9]+$/, 'Invalid invite code format'),
});

export const pushSubscribeSchema = z.object({
  endpoint: z.url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

export const knockRequestSchema = z.object({
  recipientId: z.string().uuid(),
  fileName: z.string().trim().min(1).max(255),
  fileSize: z.number().int().positive(),
});

export const acceptKnockSchema = z.object({
  roomId: z.string().uuid(),
});