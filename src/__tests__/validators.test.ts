import { describe, expect, it } from 'vitest';
import {
  acceptKnockSchema,
  displayNameSchema,
  knockRequestSchema,
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
    it('normalizes and accepts valid 6-character invite codes', () => {
      const parsed = redeemCodeSchema.parse({ code: '  ab23cd  ' });
      expect(parsed.code).toBe('AB23CD');
    });

    it('rejects invalid lengths and disallowed characters (0, 1, symbols)', () => {
      expect(redeemCodeSchema.safeParse({ code: 'ABC12' }).success).toBe(false);
      expect(redeemCodeSchema.safeParse({ code: 'ABCDEFG' }).success).toBe(false);
      expect(redeemCodeSchema.safeParse({ code: 'ABC012' }).success).toBe(false);
      expect(redeemCodeSchema.safeParse({ code: 'ABC-23' }).success).toBe(false);
    });
  });

  describe('UUID schemas (knockRequestSchema & acceptKnockSchema)', () => {
    const validUuid = '550e8400-e29b-41d4-a716-446655440000';

    it('accepts valid UUIDs', () => {
      expect(acceptKnockSchema.safeParse({ roomId: validUuid }).success).toBe(true);
      expect(
        knockRequestSchema.safeParse({
          recipientId: validUuid,
          fileName: 'report.pdf',
          fileSize: 4096,
        }).success
      ).toBe(true);
    });

    it('rejects malformed UUIDs', () => {
      expect(acceptKnockSchema.safeParse({ roomId: 'not-a-uuid' }).success).toBe(false);
      expect(
        knockRequestSchema.safeParse({
          recipientId: '12345',
          fileName: 'report.pdf',
          fileSize: 4096,
        }).success
      ).toBe(false);
    });
  });
});
