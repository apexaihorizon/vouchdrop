import { z } from 'zod';
import type { RegistrationResponseJSON, AuthenticationResponseJSON } from '@simplewebauthn/server';

export const registerOptionsSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, 'Display name must be at least 2 characters')
    .max(40, 'Display name must be 40 characters or fewer'),
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