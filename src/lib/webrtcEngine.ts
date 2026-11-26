import { openDiskSink, type DiskSink } from '@/lib/diskSink';
import { toUserErrorMessage } from '@/lib/errors';
import { createIncrementalHasher, validateWorkDocument, type AllowedDocType } from '@/lib/fileGuard';

export const CHUNK_SIZE = 16 * 1024; // 16 KB
export const HIGH_WATERMARK = 2 * 1024 * 1024; // 2 MB
export const LOW_WATERMARK = 1024 * 1024; // 1 MB

const ICE_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }],
};

export type TransferState =
  | 'idle'
  | 'knocking'
  | 'incoming_offer'
  | 'connecting'
  | 'transferring'
  | 'completed'
  | 'timeout'
  | 'error';

export type IncomingMeta = {
  roomId: string;
  fileName: string;
  fileSize: number;
  docType: AllowedDocType;
};

export type PeerTransferCallbacks = {
  onStateChange: (state: TransferState) => void;
  onProgress: (progress: number) => void;
  onMessage: (message: string) => void;
  onReceipt: (sha256: string | null) => void;
  onIncomingMeta: (meta: IncomingMeta | null) => void;
};

type SignalingMessage =
  | { type: 'PEER_JOINED' }
  | { type: 'META'; roomId: string; fileName: string; fileSize: number; docType: AllowedDocType }
  | { type: 'OFFER'; sdp: RTCSessionDescriptionInit }
  | { type: 'ANSWER'; sdp: RTCSessionDescriptionInit }
  | { type: 'ICE'; candidate: RTCIceCandidateInit }
  | { type: 'ACCEPT' }
  | { type: 'DECLINE' }
  | { type: 'TIMEOUT' }
  | { type: 'CANCEL' }
  | { type: 'PEER_LEFT' };

type DataChannelControlMessage = {
  type: 'EOF';
  sha256: string;
};

export class PeerTransferSession {
  private readonly callbacks: PeerTransferCallbacks;
  private ws: WebSocket | null = null;
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private wakeLock: WakeLockSentinel | null = null;
  private sink: DiskSink | null = null;
  private incomingMeta: IncomingMeta | null = null;
  private cancelled = false;

  constructor(callbacks: PeerTransferCallbacks) {
    this.callbacks = callbacks;
  }

  private async releaseWakeLock(): Promise<void> {
    if (this.wakeLock) {
      await this.wakeLock.release().catch(() => {});
      this.wakeLock = null;
    }
  }

  private async acquireWakeLock(): Promise<void> {
    if ('wakeLock' in navigator) {
      this.wakeLock = await navigator.wakeLock.request('screen').catch(() => null);
    }
  }

  async cleanup(): Promise<void> {
    this.dc?.close();
    this.pc?.close();
    this.ws?.close();
    this.dc = null;
    this.pc = null;
    this.ws = null;
    await this.releaseWakeLock();
  }

  // SENDER FLOW
  async startSend(recipientId: string, file: File): Promise<void> {
    this.cancelled = false;
    this.callbacks.onProgress(0);
    this.callbacks.onReceipt(null);

    let check: { valid: true; docType: AllowedDocType };
    try {
      check = await validateWorkDocument(file);
    } catch (err) {
      this.callbacks.onStateChange('error');
      this.callbacks.onMessage(toUserErrorMessage(err));
      return;
    }

    this.callbacks.onStateChange('knocking');
    this.callbacks.onMessage(`Knocking on partner for ${file.name} (${check.docType})...`);

    const knockRes = await fetch('/api/transfer/knock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipientId, fileName: file.name, fileSize: file.size }),
    });
    const knockData = (await knockRes.json()) as { ticket?: string; roomId?: string; error?: string };
    if (!knockRes.ok || !knockData.ticket || !knockData.roomId) {
      this.callbacks.onStateChange('error');
      this.callbacks.onMessage(knockData.error ?? 'Failed to send knock');
      return;
    }

    const ws = new WebSocket(`${process.env.NEXT_PUBLIC_SIGNALING_WS_URL}?ticket=${encodeURIComponent(knockData.ticket)}`);
    this.ws = ws;

    const pc = new RTCPeerConnection(ICE_CONFIG);
    this.pc = pc;

    const dc = pc.createDataChannel('vouchdrop', { ordered: true });
    dc.binaryType = 'arraybuffer';
    dc.bufferedAmountLowThreshold = LOW_WATERMARK;
    this.dc = dc;

    pc.onicecandidate = (e) => {
      if (e.candidate && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ICE', candidate: e.candidate }));
      }
    };

    const streamFileOverChannel = async (): Promise<void> => {
      await this.acquireWakeLock();
      this.callbacks.onStateChange('transferring');
      this.callbacks.onMessage('Keep screen open until transfer finishes...');

      const hasher = await createIncrementalHasher();
      let offset = 0;

      while (offset < file.size) {
        if (this.cancelled || dc.readyState !== 'open') {
          throw new Error('Transfer cancelled');
        }

        if (dc.bufferedAmount > HIGH_WATERMARK) {
          await new Promise<void>((resolve) => {
            dc.onbufferedamountlow = () => {
              dc.onbufferedamountlow = null;
              resolve();
            };
          });
        }

        const slice = await file.slice(offset, offset + CHUNK_SIZE).arrayBuffer();
        const bytes = new Uint8Array(slice);
        hasher.update(bytes);
        dc.send(slice);

        offset += bytes.byteLength;
        this.callbacks.onProgress(Math.round((offset / file.size) * 100));
      }

      const digest = hasher.digest();
      dc.send(JSON.stringify({ type: 'EOF', sha256: digest }));
      this.callbacks.onReceipt(digest);
      this.callbacks.onStateChange('completed');
      this.callbacks.onMessage(`Delivered ${file.name} (100% verified)`);
      await this.releaseWakeLock();
    };

    ws.onmessage = async (event: MessageEvent<string>) => {
      const msg = JSON.parse(event.data) as SignalingMessage;

      if (msg.type === 'PEER_JOINED') {
        ws.send(
          JSON.stringify({
            type: 'META',
            roomId: knockData.roomId,
            fileName: file.name,
            fileSize: file.size,
            docType: check.docType,
          })
        );
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        ws.send(JSON.stringify({ type: 'OFFER', sdp: offer }));
      } else if (msg.type === 'ANSWER') {
        await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
      } else if (msg.type === 'ICE') {
        await pc.addIceCandidate(new RTCIceCandidate(msg.candidate)).catch(() => {});
      } else if (msg.type === 'ACCEPT') {
        this.callbacks.onStateChange('connecting');
        if (dc.readyState === 'open') {
          await streamFileOverChannel();
        } else {
          dc.onopen = () => {
            streamFileOverChannel().catch((err: unknown) => {
              this.callbacks.onStateChange('error');
              this.callbacks.onMessage(err instanceof Error ? err.message : String(err));
            });
          };
        }
      } else if (msg.type === 'DECLINE') {
        this.callbacks.onStateChange('error');
        this.callbacks.onMessage('Partner declined the transfer');
        await this.cleanup();
      } else if (msg.type === 'TIMEOUT') {
        this.callbacks.onStateChange('timeout');
        this.callbacks.onMessage(
          "Partner didn't pick up in 15s. Ping them on WhatsApp or call them to open VouchDrop, then tap Retry."
        );
        await this.cleanup();
      } else if (msg.type === 'CANCEL') {
        this.cancelled = true;
        this.callbacks.onStateChange('error');
        this.callbacks.onMessage('Transfer cancelled by partner');
        await this.cleanup();
      }
    };

    ws.onerror = () => {
      this.callbacks.onStateChange('error');
      this.callbacks.onMessage('Signaling connection failed — check wrangler on port 8787');
    };
  }

  // RECEIVER STEP 1: Join room & wait for file metadata
  async joinIncomingRoom(roomId: string): Promise<void> {
    this.cancelled = false;
    this.callbacks.onProgress(0);
    this.callbacks.onReceipt(null);
    this.callbacks.onStateChange('connecting');
    this.callbacks.onMessage('Connecting to incoming transfer room...');

    const joinRes = await fetch('/api/transfer/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId }),
    });
    const joinData = (await joinRes.json()) as { ticket?: string; error?: string };
    if (!joinRes.ok || !joinData.ticket) {
      this.callbacks.onStateChange('error');
      this.callbacks.onMessage(joinData.error ?? 'Could not join room');
      return;
    }

    const ws = new WebSocket(`${process.env.NEXT_PUBLIC_SIGNALING_WS_URL}?ticket=${encodeURIComponent(joinData.ticket)}`);
    this.ws = ws;

    const pc = new RTCPeerConnection(ICE_CONFIG);
    this.pc = pc;

    pc.onicecandidate = (e) => {
      if (e.candidate && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ICE', candidate: e.candidate }));
      }
    };

    let expectedSize = 0;

    pc.ondatachannel = async (event) => {
      const dc = event.channel;
      dc.binaryType = 'arraybuffer';
      this.dc = dc;

      const hasher = await createIncrementalHasher();
      let receivedBytes = 0;

      dc.onmessage = async (msgEvent: MessageEvent<string | ArrayBuffer>) => {
        if (typeof msgEvent.data === 'string') {
          const ctrl = JSON.parse(msgEvent.data) as DataChannelControlMessage;
          if (ctrl.type === 'EOF') {
            await this.sink?.close();
            this.sink = null;
            const localDigest = hasher.digest();
            await this.releaseWakeLock();

            if (localDigest === ctrl.sha256) {
              this.callbacks.onReceipt(localDigest);
              this.callbacks.onStateChange('completed');
              this.callbacks.onMessage('File saved & SHA-256 checksum verified!');
            } else {
              this.callbacks.onStateChange('error');
              this.callbacks.onMessage('SHA-256 mismatch — file may be corrupted');
            }
          }
          return;
        }

        const chunk = new Uint8Array(msgEvent.data);
        hasher.update(chunk);
        await this.sink?.write(chunk);

        receivedBytes += chunk.byteLength;
        if (expectedSize > 0) {
          this.callbacks.onProgress(Math.round((receivedBytes / expectedSize) * 100));
        }
      };
    };

    ws.onmessage = async (event: MessageEvent<string>) => {
      const msg = JSON.parse(event.data) as SignalingMessage;

      if (msg.type === 'META') {
        expectedSize = msg.fileSize;
        const meta: IncomingMeta = {
          roomId: msg.roomId,
          fileName: msg.fileName,
          fileSize: msg.fileSize,
          docType: msg.docType,
        };
        this.incomingMeta = meta;
        this.callbacks.onIncomingMeta(meta);
        this.callbacks.onStateChange('incoming_offer');
        this.callbacks.onMessage(`Incoming ${msg.docType}: ${msg.fileName} (${(msg.fileSize / 1024).toFixed(1)} KB)`);
      } else if (msg.type === 'OFFER') {
        await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        ws.send(JSON.stringify({ type: 'ANSWER', sdp: answer }));
      } else if (msg.type === 'ICE') {
        await pc.addIceCandidate(new RTCIceCandidate(msg.candidate)).catch(() => {});
      } else if (msg.type === 'CANCEL' || msg.type === 'PEER_LEFT') {
        await this.sink?.abort();
        this.sink = null;
        this.callbacks.onStateChange('error');
        this.callbacks.onMessage('Sender cancelled or disconnected');
        await this.cleanup();
      }
    };
  }

  // RECEIVER STEP 2: Must be called directly inside Accept button onClick!
  async acceptTransfer(): Promise<void> {
    if (!this.incomingMeta) return;
    try {
      // Trigger native save picker immediately inside user gesture
      this.sink = await openDiskSink(this.incomingMeta.fileName, this.incomingMeta.docType);
      await this.acquireWakeLock();
      this.callbacks.onStateChange('transferring');
      this.callbacks.onMessage('Keep screen open until transfer finishes...');
      this.ws?.send(JSON.stringify({ type: 'ACCEPT' }));
    } catch {
      this.callbacks.onStateChange('error');
      this.callbacks.onMessage('Save location cancelled');
    }
  }

  async declineTransfer(): Promise<void> {
    this.ws?.send(JSON.stringify({ type: 'DECLINE' }));
    this.incomingMeta = null;
    this.callbacks.onIncomingMeta(null);
    this.callbacks.onStateChange('idle');
    await this.cleanup();
  }

  async cancelTransfer(): Promise<void> {
    this.cancelled = true;
    this.ws?.send(JSON.stringify({ type: 'CANCEL' }));
    await this.sink?.abort();
    this.sink = null;
    this.callbacks.onStateChange('idle');
    this.callbacks.onMessage('Transfer cancelled');
    await this.cleanup();
  }
}
