import { beforeEach, describe, expect, it } from 'vitest';
import { SignJWT, jwtVerify } from 'jose';
import { mintSignalingTicket } from '@/lib/session';

const TEST_SECRET = 'vouchdrop-unit-test-secret-key-32-bytes-min';

describe('signaling ticket JWT lifecycle', () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = TEST_SECRET;
  });

  it('mints and verifies a signaling ticket round-trip', async () => {
    const ticket = await mintSignalingTicket({
      roomId: '550e8400-e29b-41d4-a716-446655440000',
      userId: 'user-123',
      role: 'sender',
    });

    const { payload } = await jwtVerify(ticket, new TextEncoder().encode(TEST_SECRET), {
      algorithms: ['HS256'],
    });

    expect(payload.roomId).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(payload.userId).toBe('user-123');
    expect(payload.role).toBe('sender');
    expect(typeof payload.exp).toBe('number');
  });

  it('rejects a tampered JWT payload', async () => {
    const ticket = await mintSignalingTicket({
      roomId: '550e8400-e29b-41d4-a716-446655440000',
      userId: 'user-123',
      role: 'receiver',
    });

    const parts = ticket.split('.');
    expect(parts).toHaveLength(3);

    const tamperedPayload = Buffer.from(
      JSON.stringify({
        roomId: '550e8400-e29b-41d4-a716-446655440000',
        userId: 'attacker-999',
        role: 'sender',
      })
    ).toString('base64url');

    const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

    await expect(
      jwtVerify(tamperedToken, new TextEncoder().encode(TEST_SECRET), {
        algorithms: ['HS256'],
      })
    ).rejects.toThrow();
  });

  it('rejects an expired ticket (exp in the past)', async () => {
    const expiredToken = await new SignJWT({
      roomId: '550e8400-e29b-41d4-a716-446655440000',
      userId: 'user-123',
      role: 'sender',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(new TextEncoder().encode(TEST_SECRET));

    await expect(
      jwtVerify(expiredToken, new TextEncoder().encode(TEST_SECRET), {
        algorithms: ['HS256'],
      })
    ).rejects.toThrow();
  });
});
