import { describe, expect, it } from 'vitest';
import { AppError, toUserErrorMessage } from '@/lib/errors';
import {
  acceptKnockSchema,
  displayNameSchema,
  incomingKnockSchema,
  knockRequestSchema,
  pushSubscribeSchema,
  redeemCodeSchema,
  registerOptionsSchema,
} from '@/lib/validators';

describe('validators', () => {
  describe('displayNameSchema & registerOptionsSchema', () => {
    it('trims and collapses internal spaces for valid display names', () => {
      const parsed = displayNameSchema.parse('  Prithviraj   Tiwari  ');
      expect(parsed).toBe('Prithviraj Tiwari');

      const reg = registerOptionsSchema.parse({ displayName: '  Alex_Rivera-01.dev  ' });
      expect(reg.displayName).toBe('Alex_Rivera-01.dev');
    });

    it('rejects disallowed characters, HTML tags, and too-short names', () => {
      expect(displayNameSchema.safeParse('g3//').success).toBe(false);
      expect(displayNameSchema.safeParse('<script>alert(1)</script>').success).toBe(false);
      expect(displayNameSchema.safeParse('A').success).toBe(false);
      expect(displayNameSchema.safeParse('   ').success).toBe(false);
      expect(displayNameSchema.safeParse('a'.repeat(33)).success).toBe(false);
    });
  });

  describe('redeemCodeSchema', () => {
    it('normalizes and accepts valid 6-character uppercase alphanumeric invite codes', () => {
      const parsed = redeemCodeSchema.parse({ code: '  ab01cd  ' });
      expect(parsed.code).toBe('AB01CD');
    });

    it('rejects invalid lengths and non-alphanumeric symbols', () => {
      expect(redeemCodeSchema.safeParse({ code: 'ABC12' }).success).toBe(false);
      expect(redeemCodeSchema.safeParse({ code: 'ABCDEFG' }).success).toBe(false);
      expect(redeemCodeSchema.safeParse({ code: 'ABC-23' }).success).toBe(false);
      expect(redeemCodeSchema.safeParse({ code: 'ABC 23' }).success).toBe(false);
    });
  });

  describe('UUID schemas (knockRequestSchema & acceptKnockSchema)', () => {
    const validUuid = '550e8400-e29b-41d4-a716-446655440000';

    it('accepts valid UUIDs and rich knock metadata (stripping path separators)', () => {
      expect(acceptKnockSchema.safeParse({ roomId: validUuid }).success).toBe(true);
      const knock = knockRequestSchema.parse({
        recipientId: validUuid,
        fileName: '../dir/report.pdf',
        fileSize: 4096,
        fileType: 'PDF',
      });
      expect(knock.fileName).toBe('..dirreport.pdf');
      expect(knock.fileType).toBe('PDF');

      expect(
        incomingKnockSchema.safeParse({
          roomId: validUuid,
          senderName: 'Alex Rivera',
          fileName: 'budget.xlsx',
          fileSize: 2048,
          fileType: 'XLSX',
        }).success
      ).toBe(true);
    });

    it('rejects malformed UUIDs and disallowed fileType values', () => {
      expect(acceptKnockSchema.safeParse({ roomId: 'not-a-uuid' }).success).toBe(false);
      expect(
        knockRequestSchema.safeParse({
          recipientId: '12345',
          fileName: 'report.pdf',
          fileSize: 4096,
          fileType: 'PDF',
        }).success
      ).toBe(false);
      expect(
        knockRequestSchema.safeParse({
          recipientId: validUuid,
          fileName: 'script.exe',
          fileSize: 4096,
          fileType: 'EXE',
        }).success
      ).toBe(false);
    });
  });

  describe('pushSubscribeSchema', () => {
    it('accepts valid HTTPS push subscriptions', () => {
      const parsed = pushSubscribeSchema.safeParse({
        endpoint: 'https://fcm.googleapis.com/fcm/send/abc123',
        keys: { p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQ', auth: 'tBHItJI5svbpez7KI4CCXg' },
      });
      expect(parsed.success).toBe(true);
    });

    it('rejects insecure HTTP endpoints and empty keys', () => {
      expect(
        pushSubscribeSchema.safeParse({
          endpoint: 'http://insecure.example.com/push',
          keys: { p256dh: 'key', auth: 'secret' },
        }).success
      ).toBe(false);

      expect(
        pushSubscribeSchema.safeParse({
          endpoint: 'https://fcm.googleapis.com/fcm/send/abc123',
          keys: { p256dh: '', auth: 'secret' },
        }).success
      ).toBe(false);
    });
  });

  describe('toUserErrorMessage', () => {
    it('returns safe userMessage for AppError and maps WebAuthn errors', () => {
      const appErr = new AppError('NOT_PAIRED', 'Recipient is not in your trusted contacts.', 403);
      expect(toUserErrorMessage(appErr)).toBe('Recipient is not in your trusted contacts.');

      const cancelled = new Error('raw browser details');
      cancelled.name = 'NotAllowedError';
      expect(toUserErrorMessage(cancelled)).toBe(
        'Passkey prompt was cancelled or timed out. Click below to try again.'
      );

      expect(toUserErrorMessage(new Error('SQL syntax error at line 1'))).toBe(
        'Something went wrong. Please try again.'
      );
    });
  });
});
