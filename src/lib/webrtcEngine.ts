import { openDiskSink, type DiskSink } from '@/lib/diskSink';
import { AppError, toUserErrorMessage } from '@/lib/errors';
import { createIncrementalHasher, validateWorkDocument, type AllowedDocType } from '@/lib/fileGuard';

export const CHUNK_SIZE = 16 * 1024; // 16 KB
export const HIGH_WATERMARK = 2 * 1024 * 1024; // 2 MB
export const LOW_WATERMARK = 1024 * 1024; // 1 MB
export const ICE_WATCHDOG_MS = 12_000; // 12-second ICE/DataChannel watchdog
export const RECEIPT_TIMEOUT_MS = 10_000; // 10-second receiver SHA-256 confirmation watchdog

const ICE_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }],
};

export type TransferState =
  | 'idle'
  | 'knocking'
  | 'incoming_offer'
  | 'connecting'
  | 'transferring'
  | 'verifying'
  | 'completed'
  | 'timeout'
  | 'error';

export type IncomingKnock = {
  roomId: string;
  senderName: string;
  fileName: string;
  fileSize: number;
  fileType: AllowedDocType;
};

export type IncomingMeta = {
  roomId: string;
  senderName?: string;
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

type DataChannelControlMessage =
  | { type: 'EOF'; sha256: string }
  | { type: 'RECEIPT_ACK'; verified: true; sha256: string }
  | { type: 'RECEIPT_ACK'; verified: false };

export class PeerTransferSession {
  private readonly callbacks: PeerTransferCallbacks;
  private ws: WebSocket | null = null;
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private wakeLock: WakeLockSentinel | null = null;
  private sink: DiskSink | null = null;
  private incomingMeta: IncomingMeta | null = null;
  private pendingKnock: IncomingKnock | null = null;
  private iceWatchdog: ReturnType<typeof setTimeout> | null = null;
  private receiptWatchdog: ReturnType<typeof setTimeout> | null = null;
  private cancelled = false;
  private completed = false;
  private natTimedOut = false;

  constructor(callbacks: PeerTransferCallbacks) {
    this.callbacks = callbacks;
  }

  private clearIceWatchdog(): void {
    if (this.iceWatchdog !== null) {
      clearTimeout(this.iceWatchdog);
      this.iceWatchdog = null;
    }
  }

  private clearReceiptWatchdog(): void {
    if (this.receiptWatchdog !== null) {
      clearTimeout(this.receiptWatchdog);
      this.receiptWatchdog = null;
    }
  }

  private startIceWatchdog(): void {
    this.clearIceWatchdog();
    this.iceWatchdog = setTimeout(() => {
      if (this.dc?.readyState !== 'open' && !this.completed && !this.cancelled) {
        void this.triggerNatTimeout();
      }
    }, ICE_WATCHDOG_MS);
  }

  private teardownSignalingOnP2POpen(): void {
    this.clearIceWatchdog();
    if (this.ws) {
      const socket = this.ws;
      this.ws = null;
      socket.onclose = null;
      socket.onerror = null;
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close(1000, 'P2P_ESTABLISHED');
      }
    }
  }

  private async abortOpenSink(): Promise<void> {
    if (this.sink) {
      const activeSink = this.sink;
      this.sink = null;
      await activeSink.abort().catch(() => {});
    }
  }

  private async triggerNatTimeout(): Promise<void> {
    if (this.natTimedOut || this.completed || this.cancelled) return;
    this.natTimedOut = true;
    await this.cleanup();

    const natError = new AppError(
      'NAT_TIMEOUT',
      'Direct peer connection blocked by network NAT. Connect both devices to the same Wi-Fi or hotspot and retry.',
      504
    );
    this.callbacks.onStateChange('error');
    this.callbacks.onMessage(toUserErrorMessage(natError));
  }

  private attachConnectionStateMonitor(pc: RTCPeerConnection): void {
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        if (!this.completed && !this.cancelled) {
          void this.triggerNatTimeout();
        }
      }
    };
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
    this.clearIceWatchdog();
    this.clearReceiptWatchdog();
    await this.abortOpenSink();
    if (this.pc) {
      this.pc.onconnectionstatechange = null;
    }
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.onerror = null;
    }
    this.dc?.close();
    this.pc?.close();
    this.ws?.close();
    this.dc = null;
    this.pc = null;
    this.ws = null;
    await this.releaseWakeLock();
  }

  async reset(): Promise<void> {
    this.cancelled = false;
    this.completed = false;
    this.natTimedOut = false;
    this.incomingMeta = null;
    this.pendingKnock = null;
    await this.cleanup();
    this.callbacks.onIncomingMeta(null);
    this.callbacks.onProgress(0);
    this.callbacks.onReceipt(null);
    this.callbacks.onMessage('');
    this.callbacks.onStateChange('idle');
  }

  // SENDER FLOW
  async startSend(recipientId: string, file: File): Promise<void> {
    await this.cleanup();
    this.cancelled = false;
    this.completed = false;
    this.natTimedOut = false;
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
      body: JSON.stringify({
        recipientId,
        fileName: file.name,
        fileSize: file.size,
        fileType: check.docType,
      }),
    });
    const knockData = (await knockRes.json().catch(() => null)) as {
      ticket?: string;
      roomId?: string;
      error?: string;
    } | null;
    if (!knockRes.ok || !knockData?.ticket || !knockData.roomId) {
      this.callbacks.onStateChange('error');
      this.callbacks.onMessage(knockData?.error ?? 'Failed to notify recipient.');
      return;
    }

    const ws = new WebSocket(`${process.env.NEXT_PUBLIC_SIGNALING_WS_URL}?ticket=${encodeURIComponent(knockData.ticket)}`);
    this.ws = ws;

    const pc = new RTCPeerConnection(ICE_CONFIG);
    this.pc = pc;
    this.attachConnectionStateMonitor(pc);

    let hasStartedOffer = false;
    let remoteDescriptionSet = false;
    let expectedReceiptHash: string | null = null;
    const pendingRemoteIce: RTCIceCandidateInit[] = [];

    pc.onicecandidate = (e) => {
      if (e.candidate && this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ICE', candidate: e.candidate }));
      }
    };

    const streamFileOverChannel = async (dc: RTCDataChannel): Promise<void> => {
      this.teardownSignalingOnP2POpen();
      await this.acquireWakeLock();
      this.callbacks.onStateChange('transferring');
      this.callbacks.onMessage('Keep screen open until transfer finishes...');

      const hasher = await createIncrementalHasher();
      let offset = 0;

      while (offset < file.size) {
        if (this.cancelled || dc.readyState !== 'open') {
          throw new AppError('INTERNAL_ERROR', 'Transfer cancelled.', 499);
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
        this.callbacks.onProgress(Math.min(99, Math.round((offset / file.size) * 100)));
      }

      const digest = hasher.digest();
      expectedReceiptHash = digest;
      dc.send(JSON.stringify({ type: 'EOF', sha256: digest }));

      // Wait for receiver RECEIPT_ACK before marking completed
      this.callbacks.onProgress(99);
      this.callbacks.onStateChange('verifying');
      this.callbacks.onMessage('Verifying recipient SHA-256...');

      this.clearReceiptWatchdog();
      this.receiptWatchdog = setTimeout(() => {
        if (!this.completed && !this.cancelled) {
          const timeoutErr = new AppError(
            'HASH_MISMATCH',
            'Timed out waiting for recipient SHA-256 confirmation.',
            504
          );
          this.callbacks.onStateChange('error');
          this.callbacks.onMessage(toUserErrorMessage(timeoutErr));
          void this.cleanup();
        }
      }, RECEIPT_TIMEOUT_MS);
    };

    const startOfferHandshake = async (): Promise<void> => {
      if (hasStartedOffer) return;
      hasStartedOffer = true;

      this.callbacks.onStateChange('connecting');
      this.callbacks.onMessage('Establishing encrypted WebRTC channel...');
      this.startIceWatchdog();

      const dc = pc.createDataChannel('vouchdrop', { ordered: true });
      dc.binaryType = 'arraybuffer';
      dc.bufferedAmountLowThreshold = LOW_WATERMARK;
      this.dc = dc;

      dc.onmessage = async (msgEvent: MessageEvent<string | ArrayBuffer>) => {
        if (typeof msgEvent.data !== 'string') return;
        const ctrl = JSON.parse(msgEvent.data) as DataChannelControlMessage;
        if (ctrl.type !== 'RECEIPT_ACK') return;

        this.clearReceiptWatchdog();
        if (ctrl.verified && expectedReceiptHash && ctrl.sha256 === expectedReceiptHash) {
          this.completed = true;
          this.callbacks.onProgress(100);
          this.callbacks.onReceipt(expectedReceiptHash);
          this.callbacks.onStateChange('completed');
          this.callbacks.onMessage(`Verified & Delivered: ${file.name}`);
          await this.cleanup();
        } else {
          const hashErr = new AppError('HASH_MISMATCH', 'Recipient reported a SHA-256 verification mismatch.', 422);
          this.callbacks.onStateChange('error');
          this.callbacks.onMessage(toUserErrorMessage(hashErr));
          await this.cleanup();
        }
      };

      dc.onopen = () => {
        streamFileOverChannel(dc).catch((err: unknown) => {
          this.callbacks.onStateChange('error');
          this.callbacks.onMessage(toUserErrorMessage(err));
          void this.cleanup();
        });
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      if (this.ws?.readyState === WebSocket.OPEN && pc.localDescription) {
        this.ws.send(JSON.stringify({ type: 'OFFER', sdp: pc.localDescription }));
      }
    };

    ws.onmessage = async (event: MessageEvent<string>) => {
      const msg = JSON.parse(event.data) as SignalingMessage;

      if (msg.type === 'PEER_JOINED') {
        // Send META for cold-boot receivers; wait for ACCEPT before creating DataChannel/OFFER
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.ws.send(
            JSON.stringify({
              type: 'META',
              roomId: knockData.roomId,
              fileName: file.name,
              fileSize: file.size,
              docType: check.docType,
            })
          );
        }
      } else if (msg.type === 'ACCEPT') {
        await startOfferHandshake();
      } else if (msg.type === 'ANSWER') {
        await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
        remoteDescriptionSet = true;
        while (pendingRemoteIce.length > 0) {
          const candidate = pendingRemoteIce.shift();
          if (candidate) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
          }
        }
      } else if (msg.type === 'ICE') {
        if (remoteDescriptionSet) {
          await pc.addIceCandidate(new RTCIceCandidate(msg.candidate)).catch(() => {});
        } else {
          pendingRemoteIce.push(msg.candidate);
        }
      } else if (msg.type === 'DECLINE') {
        this.callbacks.onStateChange('error');
        this.callbacks.onMessage('Partner declined the transfer.');
        await this.cleanup();
      } else if (msg.type === 'TIMEOUT') {
        this.callbacks.onStateChange('timeout');
        this.callbacks.onMessage(
          "Partner didn't pick up in 15s. Ping them to open VouchDrop, then retry."
        );
        await this.cleanup();
      } else if (msg.type === 'CANCEL') {
        this.cancelled = true;
        this.callbacks.onStateChange('error');
        this.callbacks.onMessage('Transfer cancelled by partner.');
        await this.cleanup();
      }
    };

    ws.onclose = (event: CloseEvent) => {
      if (event.code === 1000 && event.reason === 'P2P_ESTABLISHED') return;
      if (this.dc?.readyState === 'open' || this.completed || this.cancelled) return;
    };

    ws.onerror = () => {
      if (this.dc?.readyState === 'open' || this.completed) return;
      this.callbacks.onStateChange('error');
      this.callbacks.onMessage('Signaling connection failed. Please try again.');
    };
  }

  // RECEIVER ZERO-SOCKET PREVIEW: Render incoming offer immediately from Web Push payload
  presentIncomingKnock(knock: IncomingKnock): void {
    this.cancelled = false;
    this.completed = false;
    this.natTimedOut = false;
    this.pendingKnock = knock;
    const meta: IncomingMeta = {
      roomId: knock.roomId,
      senderName: knock.senderName,
      fileName: knock.fileName,
      fileSize: knock.fileSize,
      docType: knock.fileType,
    };
    this.incomingMeta = meta;
    this.callbacks.onProgress(0);
    this.callbacks.onReceipt(null);
    this.callbacks.onIncomingMeta(meta);
    this.callbacks.onStateChange('incoming_offer');
    this.callbacks.onMessage(`${knock.senderName} wants to send ${knock.fileName}`);
  }

  // Internal receiver signaling + DataChannel setup
  // NOTE: Never clears an already-opened DiskSink when autoAccept is true!
  private async connectReceiverRoom(
    roomId: string,
    options: { autoAccept: boolean; expectedSize?: number }
  ): Promise<void> {
    // Preserve active sink when called from acceptIncoming()
    const preservedSink = options.autoAccept ? this.sink : null;
    if (options.autoAccept) {
      this.sink = null;
    }
    await this.cleanup();
    if (preservedSink) {
      this.sink = preservedSink;
    }

    this.cancelled = false;
    this.completed = false;
    this.natTimedOut = false;
    this.callbacks.onProgress(0);
    this.callbacks.onReceipt(null);
    this.callbacks.onStateChange('connecting');
    this.callbacks.onMessage(
      options.autoAccept ? 'Establishing direct encrypted peer channel...' : 'Connecting to incoming transfer room...'
    );

    const joinRes = await fetch('/api/transfer/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId }),
    });
    const joinData = (await joinRes.json().catch(() => null)) as { ticket?: string; error?: string } | null;
    if (!joinRes.ok || !joinData?.ticket) {
      await this.cleanup();
      this.callbacks.onStateChange('error');
      this.callbacks.onMessage(joinData?.error ?? 'Could not join transfer room.');
      return;
    }

    const ws = new WebSocket(`${process.env.NEXT_PUBLIC_SIGNALING_WS_URL}?ticket=${encodeURIComponent(joinData.ticket)}`);
    this.ws = ws;

    const pc = new RTCPeerConnection(ICE_CONFIG);
    this.pc = pc;
    this.attachConnectionStateMonitor(pc);

    if (options.autoAccept) {
      this.startIceWatchdog();
    }

    let remoteDescriptionSet = false;
    const pendingRemoteIce: RTCIceCandidateInit[] = [];
    let expectedSize = options.expectedSize ?? 0;

    // Step D: Send ACCEPT immediately once receiver WS opens
    ws.onopen = () => {
      if (options.autoAccept && this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ACCEPT' }));
      }
    };

    pc.onicecandidate = (e) => {
      if (e.candidate && this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ICE', candidate: e.candidate }));
      }
    };

    // Step F: Only inside pc.ondatachannel -> dc.onopen close WS, clear watchdog, and enter 'transferring'
    pc.ondatachannel = async (event) => {
      const dc = event.channel;
      dc.binaryType = 'arraybuffer';
      this.dc = dc;

      const hasher = await createIncrementalHasher();
      let receivedBytes = 0;

      const handleDataChannelOpen = () => {
        this.teardownSignalingOnP2POpen();
        this.callbacks.onStateChange('transferring');
        this.callbacks.onMessage('Keep screen open until transfer finishes...');
      };

      dc.onmessage = async (msgEvent: MessageEvent<string | ArrayBuffer>) => {
        if (typeof msgEvent.data === 'string') {
          const ctrl = JSON.parse(msgEvent.data) as DataChannelControlMessage;
          if (ctrl.type === 'EOF') {
            const localDigest = hasher.digest();
            await this.releaseWakeLock();

            if (localDigest === ctrl.sha256) {
              const activeSink = this.sink;
              this.sink = null;
              await activeSink?.close();

              try {
                dc.send(JSON.stringify({ type: 'RECEIPT_ACK', verified: true, sha256: localDigest }));
              } catch {
                // Ignore if channel already closed
              }

              // Allow RECEIPT_ACK to flush before tearing down RTCPeerConnection
              await new Promise<void>((resolve) => setTimeout(resolve, 150));

              this.completed = true;
              this.callbacks.onProgress(100);
              this.callbacks.onReceipt(localDigest);
              this.callbacks.onStateChange('completed');
              this.callbacks.onMessage('File saved & SHA-256 checksum verified!');
              await this.cleanup();
            } else {
              try {
                dc.send(JSON.stringify({ type: 'RECEIPT_ACK', verified: false }));
              } catch {
                // Ignore send errors
              }
              await this.cleanup();

              const hashError = new AppError('HASH_MISMATCH', 'SHA-256 mismatch — file may be corrupted.', 422);
              this.callbacks.onStateChange('error');
              this.callbacks.onMessage(toUserErrorMessage(hashError));
            }
          }
          return;
        }

        const chunk = new Uint8Array(msgEvent.data);
        hasher.update(chunk);
        await this.sink?.write(chunk);

        receivedBytes += chunk.byteLength;
        if (expectedSize > 0) {
          this.callbacks.onProgress(Math.min(99, Math.round((receivedBytes / expectedSize) * 100)));
        }
      };

      if (dc.readyState === 'open') {
        handleDataChannelOpen();
      } else {
        dc.onopen = handleDataChannelOpen;
      }
    };

    ws.onmessage = async (event: MessageEvent<string>) => {
      const msg = JSON.parse(event.data) as SignalingMessage;

      if (msg.type === 'META') {
        expectedSize = msg.fileSize;
        if (!options.autoAccept) {
          this.clearIceWatchdog();
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
        }
      } else if (msg.type === 'OFFER') {
        // Step E: Apply remote offer, flush buffered ICE, create & send answer
        await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
        remoteDescriptionSet = true;
        while (pendingRemoteIce.length > 0) {
          const candidate = pendingRemoteIce.shift();
          if (candidate) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
          }
        }
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        if (this.ws?.readyState === WebSocket.OPEN && pc.localDescription) {
          this.ws.send(JSON.stringify({ type: 'ANSWER', sdp: pc.localDescription }));
        }
      } else if (msg.type === 'ICE') {
        if (remoteDescriptionSet) {
          await pc.addIceCandidate(new RTCIceCandidate(msg.candidate)).catch(() => {});
        } else {
          pendingRemoteIce.push(msg.candidate);
        }
      } else if (msg.type === 'CANCEL' || msg.type === 'PEER_LEFT') {
        if (this.dc?.readyState === 'open' || this.completed) return;
        await this.cleanup();
        this.callbacks.onStateChange('error');
        this.callbacks.onMessage('Sender cancelled or disconnected.');
      }
    };

    ws.onclose = (event: CloseEvent) => {
      if (event.code === 1000 && event.reason === 'P2P_ESTABLISHED') return;
      if (this.dc?.readyState === 'open' || this.completed || this.cancelled) return;
    };

    ws.onerror = () => {
      if (this.dc?.readyState === 'open' || this.completed) return;
      void this.cleanup();
      this.callbacks.onStateChange('error');
      this.callbacks.onMessage('Signaling connection failed. Please try again.');
    };
  }

  // RECEIVER COLD-BOOT FALLBACK: Join room & fetch META over signaling when /app?room=<id> loaded directly
  async joinIncomingRoom(roomId: string): Promise<void> {
    this.pendingKnock = null;
    await this.connectReceiverRoom(roomId, { autoAccept: false });
  }

  // RECEIVER ACCEPT: Must be called directly inside Accept button onClick to preserve user gesture!
  async acceptIncoming(): Promise<void> {
    if (!this.incomingMeta) return;
    const meta = this.incomingMeta;
    const deferredKnock = this.pendingKnock;

    try {
      // Step A: Trigger native save picker FIRST inside transient user gesture
      this.sink = await openDiskSink(meta.fileName, meta.docType);
      await this.acquireWakeLock();
      this.callbacks.onIncomingMeta(null);

      // Step B: Always enter 'connecting' — NEVER 'transferring' until dc.onopen fires
      this.callbacks.onStateChange('connecting');
      this.callbacks.onMessage('Establishing direct encrypted peer channel...');

      if (deferredKnock) {
        // Step C & D: Mint receiver ticket, open WS, and send ACCEPT on ws.onopen
        this.pendingKnock = null;
        await this.connectReceiverRoom(deferredKnock.roomId, {
          autoAccept: true,
          expectedSize: deferredKnock.fileSize,
        });
      } else {
        // Cold-boot path: WS is already open; start watchdog and send ACCEPT now
        this.startIceWatchdog();
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ type: 'ACCEPT' }));
        }
      }
    } catch {
      await this.cleanup();
      this.callbacks.onStateChange('error');
      this.callbacks.onMessage('Save location cancelled.');
    }
  }

  async acceptTransfer(): Promise<void> {
    await this.acceptIncoming();
  }

  async declineIncoming(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'DECLINE' }));
    }
    this.pendingKnock = null;
    this.incomingMeta = null;
    this.callbacks.onIncomingMeta(null);
    this.callbacks.onStateChange('idle');
    await this.cleanup();
  }

  async declineTransfer(): Promise<void> {
    await this.declineIncoming();
  }

  async cancelTransfer(): Promise<void> {
    this.cancelled = true;
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'CANCEL' }));
    }
    this.pendingKnock = null;
    await this.cleanup();
    this.callbacks.onStateChange('idle');
    this.callbacks.onMessage('Transfer cancelled.');
  }
}
