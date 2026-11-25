/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import { DurableObject } from 'cloudflare:workers';

export interface Env {
  TRANSFER_ROOM: DurableObjectNamespace<TransferRoom>;
  SESSION_SECRET: string;
  ALLOWED_ORIGIN: string;
}

type TicketPayload = {
  roomId: string;
  userId: string;
  role: 'sender' | 'receiver';
  exp: number;
};

type SocketMeta = {
  userId: string;
  role: 'sender' | 'receiver';
};

function base64UrlToUint8Array(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(b64url.length / 4) * 4, '=');
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function verifyTicket(token: string, secret: string): Promise<TicketPayload | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [headerB64, payloadB64, sigB64] = parts;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );

  const valid = await crypto.subtle.verify(
    'HMAC',
    key,
    base64UrlToUint8Array(sigB64),
    new TextEncoder().encode(`${headerB64}.${payloadB64}`)
  );
  if (!valid) return null;

  const payload = JSON.parse(new TextDecoder().decode(base64UrlToUint8Array(payloadB64))) as TicketPayload;
  if (!payload.exp || Date.now() / 1000 > payload.exp) return null;
  if (!payload.roomId || !payload.userId || (payload.role !== 'sender' && payload.role !== 'receiver')) return null;

  return payload;
}

export class TransferRoom extends DurableObject<Env> {
  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket upgrade', { status: 426 });
    }

    const url = new URL(request.url);
    const userId = url.searchParams.get('userId')!;
    const role = url.searchParams.get('role') as 'sender' | 'receiver';

    // Enforce max 2 peers (1 sender + 1 receiver)
    const existing = this.ctx.getWebSockets();
    if (existing.some((ws) => (ws.deserializeAttachment() as SocketMeta)?.role === role)) {
      return new Response('Role already connected in this room', { status: 409 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ userId, role } satisfies SocketMeta);

    if (role === 'sender') {
      // Start 15-second knock timeout
      await this.ctx.storage.setAlarm(Date.now() + 15_000);
    } else if (role === 'receiver') {
      // Receiver arrived in time — cancel timeout and notify sender
      await this.ctx.storage.deleteAlarm();
      this.broadcastExcept(server, JSON.stringify({ type: 'PEER_JOINED', userId }));
    }

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    if (typeof message !== 'string' || message.length > 32_768) return; // Cap SDP/ICE payload at 32 KB
    this.broadcastExcept(ws, message);
  }

  async webSocketClose(ws: WebSocket) {
    this.broadcastExcept(ws, JSON.stringify({ type: 'PEER_LEFT' }));
    await this.ctx.storage.deleteAlarm();
  }

  async alarm() {
    // 15 seconds elapsed without receiver joining
    for (const ws of this.ctx.getWebSockets()) {
      ws.send(JSON.stringify({ type: 'TIMEOUT' }));
      ws.close(1000, 'Knock timed out after 15s');
    }
  }

  private broadcastExcept(senderWs: WebSocket, data: string) {
    for (const ws of this.ctx.getWebSockets()) {
      if (ws !== senderWs) {
        try {
          ws.send(data);
        } catch {
          // Ignore closed socket
        }
      }
    }
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin');
    if (origin && origin !== env.ALLOWED_ORIGIN) {
      return new Response('Forbidden origin', { status: 403 });
    }

    const url = new URL(request.url);
    const token = url.searchParams.get('ticket');
    if (!token) {
      return new Response('Missing signaling ticket', { status: 401 });
    }

    const ticket = await verifyTicket(token, env.SESSION_SECRET);
    if (!ticket) {
      return new Response('Invalid or expired ticket', { status: 401 });
    }

    const roomStub = env.TRANSFER_ROOM.get(env.TRANSFER_ROOM.idFromName(ticket.roomId));
    const internalUrl = new URL(request.url);
    internalUrl.searchParams.set('userId', ticket.userId);
    internalUrl.searchParams.set('role', ticket.role);

    return roomStub.fetch(new Request(internalUrl.toString(), request));
  },
};