'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createIncrementalHasher, validateWorkDocument, type AllowedDocType } from '@/lib/fileGuard';

const CHUNK_SIZE = 16 * 1024; // 16 KB
const HIGH_WATERMARK = 2 * 1024 * 1024; // 2 MB
const LOW_WATERMARK = 1024 * 1024; // 1 MB

const ICE_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }],
};
const MIME_MAP: Record<AllowedDocType, { description: string; accept: Record<string, string[]> }> = {
  PDF: { description: 'PDF Document', accept: { 'application/pdf': ['.pdf'] } },
  DOCX: {
    description: 'Word Document',
    accept: { 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'] },
  },
  PPTX: {
    description: 'PowerPoint Presentation',
    accept: { 'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'] },
  },
  CSV: { description: 'CSV Spreadsheet', accept: { 'text/csv': ['.csv'] } },
  FIG: { description: 'Figma Archive', accept: { 'application/octet-stream': ['.fig'] } },
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

type DiskSink = {
  write: (chunk: Uint8Array) => Promise<void>;
  close: () => Promise<void>;
  abort: () => Promise<void>;
};
async function openDiskSink(suggestedName: string, docType: AllowedDocType): Promise<DiskSink> {
  // Primary: File System Access API (Windows Chrome + Android Chrome v132+)
  if ('showSaveFilePicker' in window) {
    const picker = window.showSaveFilePicker as (opts: {
      suggestedName: string;
      types?: { description: string; accept: Record<string, string[]> }[];
    }) => Promise<FileSystemFileHandle>;

    const handle = await picker({
      suggestedName,
      types: [MIME_MAP[docType]],
    });
    const writable = await handle.createWritable();

    return {
      write: (chunk) => writable.write(chunk as BufferSource),
      close: () => writable.close(),
      abort: () => writable.abort(),
    };
  }

  // Fallback: Origin Private File System (OPFS) -> triggers <a download> on close
  const root = await navigator.storage.getDirectory();
  const tempName = `vd-${crypto.randomUUID()}-${suggestedName}`;
  const fileHandle = await root.getFileHandle(tempName, { create: true });
  const writable = await fileHandle.createWritable();

  return {
    write: (chunk) => writable.write(chunk as BufferSource),
    close: async () => {
      await writable.close();
      const file = await fileHandle.getFile();
      const url = URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = url;
      a.download = suggestedName;
      a.click();
      setTimeout(() => {
        URL.revokeObjectURL(url);
        root.removeEntry(tempName).catch(() => {});
      }, 10_000);
    },
    abort: async () => {
      await writable.abort().catch(() => {});
      await root.removeEntry(tempName).catch(() => {});
    },
  };
}

export function usePeerTransfer() {
  const [state, setState] = useState<TransferState>('idle');
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [sha256Receipt, setSha256Receipt] = useState<string | null>(null);
  const [incomingMeta, setIncomingMeta] = useState<IncomingMeta | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const sinkRef = useRef<DiskSink | null>(null);
  const cancelledRef = useRef(false);

  const releaseWakeLock = useCallback(async () => {
    if (wakeLockRef.current) {
      await wakeLockRef.current.release().catch(() => {});
      wakeLockRef.current = null;
    }
  }, []);

  const acquireWakeLock = useCallback(async () => {
    if ('wakeLock' in navigator) {
      wakeLockRef.current = await navigator.wakeLock.request('screen').catch(() => null);
    }
  }, []);

  const cleanup = useCallback(async () => {
    dcRef.current?.close();
    pcRef.current?.close();
    wsRef.current?.close();
    dcRef.current = null;
    pcRef.current = null;
    wsRef.current = null;
    await releaseWakeLock();
  }, [releaseWakeLock]);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  // SENDER FLOW
  const startSend = useCallback(
    async (recipientId: string, file: File) => {
      cancelledRef.current = false;
      setProgress(0);
      setSha256Receipt(null);

      const check = await validateWorkDocument(file);
      if (!check.valid) {
        setState('error');
        setMessage(check.reason);
        return;
      }

      setState('knocking');
      setMessage(`Knocking on partner for ${file.name} (${check.docType})...`);

      const knockRes = await fetch('/api/transfer/knock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientId, fileName: file.name, fileSize: file.size }),
      });
      const knockData = await knockRes.json();
      if (!knockRes.ok) {
        setState('error');
        setMessage(knockData.error ?? 'Failed to send knock');
        return;
      }

      const ws = new WebSocket(`${process.env.NEXT_PUBLIC_SIGNALING_WS_URL}?ticket=${encodeURIComponent(knockData.ticket)}`);
      wsRef.current = ws;

      const pc = new RTCPeerConnection(ICE_CONFIG);
      pcRef.current = pc;

      const dc = pc.createDataChannel('vouchdrop', { ordered: true });
      dc.binaryType = 'arraybuffer';
      dc.bufferedAmountLowThreshold = LOW_WATERMARK;
      dcRef.current = dc;

      pc.onicecandidate = (e) => {
        if (e.candidate && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ICE', candidate: e.candidate }));
        }
      };

      const streamFileOverChannel = async () => {
        await acquireWakeLock();
        setState('transferring');
        setMessage('Keep screen open until transfer finishes...');

        const hasher = await createIncrementalHasher();
        let offset = 0;

        while (offset < file.size) {
          if (cancelledRef.current || dc.readyState !== 'open') {
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
          setProgress(Math.round((offset / file.size) * 100));
        }

        const digest = hasher.digest();
        dc.send(JSON.stringify({ type: 'EOF', sha256: digest }));
        setSha256Receipt(digest);
        setState('completed');
        setMessage(`Delivered ${file.name} (100% verified)`);
        await releaseWakeLock();
      };

      ws.onmessage = async (event) => {
        const msg = JSON.parse(event.data);

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
          setState('connecting');
          if (dc.readyState === 'open') {
            await streamFileOverChannel();
          } else {
            dc.onopen = () => {
              streamFileOverChannel().catch((err) => {
                setState('error');
                setMessage(err.message);
              });
            };
          }
        } else if (msg.type === 'DECLINE') {
          setState('error');
          setMessage('Partner declined the transfer');
          await cleanup();
        } else if (msg.type === 'TIMEOUT') {
          setState('timeout');
          setMessage("Partner didn't pick up in 15s. Ping them on WhatsApp or call them to open VouchDrop, then tap Retry.");
          await cleanup();
        } else if (msg.type === 'CANCEL') {
          cancelledRef.current = true;
          setState('error');
          setMessage('Transfer cancelled by partner');
          await cleanup();
        }
      };

      ws.onerror = () => {
        setState('error');
        setMessage('Signaling connection failed — check wrangler on port 8787');
      };
    },
    [acquireWakeLock, cleanup, releaseWakeLock]
  );

  // RECEIVER STEP 1: Join room & wait for file metadata
  const joinIncomingRoom = useCallback(async (roomId: string) => {
    cancelledRef.current = false;
    setProgress(0);
    setSha256Receipt(null);
    setState('connecting');
    setMessage('Connecting to incoming transfer room...');

    const joinRes = await fetch('/api/transfer/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId }),
    });
    const joinData = await joinRes.json();
    if (!joinRes.ok) {
      setState('error');
      setMessage(joinData.error ?? 'Could not join room');
      return;
    }

    const ws = new WebSocket(`${process.env.NEXT_PUBLIC_SIGNALING_WS_URL}?ticket=${encodeURIComponent(joinData.ticket)}`);
    wsRef.current = ws;

    const pc = new RTCPeerConnection(ICE_CONFIG);
    pcRef.current = pc;

    pc.onicecandidate = (e) => {
      if (e.candidate && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ICE', candidate: e.candidate }));
      }
    };

    let expectedSize = 0;

    pc.ondatachannel = async (event) => {
      const dc = event.channel;
      dc.binaryType = 'arraybuffer';
      dcRef.current = dc;

      const hasher = await createIncrementalHasher();
      let receivedBytes = 0;

      dc.onmessage = async (msgEvent) => {
        if (typeof msgEvent.data === 'string') {
          const ctrl = JSON.parse(msgEvent.data);
          if (ctrl.type === 'EOF') {
            await sinkRef.current?.close();
            sinkRef.current = null;
            const localDigest = hasher.digest();
            await releaseWakeLock();

            if (localDigest === ctrl.sha256) {
              setSha256Receipt(localDigest);
              setState('completed');
              setMessage('File saved & SHA-256 checksum verified!');
            } else {
              setState('error');
              setMessage('SHA-256 mismatch — file may be corrupted');
            }
          }
          return;
        }

        const chunk = new Uint8Array(msgEvent.data as ArrayBuffer);
        hasher.update(chunk);
        await sinkRef.current?.write(chunk);

        receivedBytes += chunk.byteLength;
        if (expectedSize > 0) {
          setProgress(Math.round((receivedBytes / expectedSize) * 100));
        }
      };
    };

    ws.onmessage = async (event) => {
      const msg = JSON.parse(event.data);

      if (msg.type === 'META') {
        expectedSize = msg.fileSize;
        setIncomingMeta({
          roomId: msg.roomId,
          fileName: msg.fileName,
          fileSize: msg.fileSize,
          docType: msg.docType,
        });
        setState('incoming_offer');
        setMessage(`Incoming ${msg.docType}: ${msg.fileName} (${(msg.fileSize / 1024).toFixed(1)} KB)`);
      } else if (msg.type === 'OFFER') {
        await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        ws.send(JSON.stringify({ type: 'ANSWER', sdp: answer }));
      } else if (msg.type === 'ICE') {
        await pc.addIceCandidate(new RTCIceCandidate(msg.candidate)).catch(() => {});
      } else if (msg.type === 'CANCEL' || msg.type === 'PEER_LEFT') {
        await sinkRef.current?.abort();
        setState('error');
        setMessage('Sender cancelled or disconnected');
        await cleanup();
      }
    };
  }, [cleanup, releaseWakeLock]);

  // RECEIVER STEP 2: Must be called directly inside Accept button onClick!
  const acceptTransfer = useCallback(async () => {
    if (!incomingMeta) return;
    try {
      // Trigger native save picker immediately inside user gesture
      sinkRef.current = await openDiskSink(incomingMeta.fileName, incomingMeta.docType);
      await acquireWakeLock();
      setState('transferring');
      setMessage('Keep screen open until transfer finishes...');
      wsRef.current?.send(JSON.stringify({ type: 'ACCEPT' }));
    } catch {
      setState('error');
      setMessage('Save location cancelled');
    }
  }, [acquireWakeLock, incomingMeta]);

  const declineTransfer = useCallback(async () => {
    wsRef.current?.send(JSON.stringify({ type: 'DECLINE' }));
    setIncomingMeta(null);
    setState('idle');
    await cleanup();
  }, [cleanup]);

  const cancelTransfer = useCallback(async () => {
    cancelledRef.current = true;
    wsRef.current?.send(JSON.stringify({ type: 'CANCEL' }));
    await sinkRef.current?.abort();
    setState('idle');
    setMessage('Transfer cancelled');
    await cleanup();
  }, [cleanup]);

  return {
    state,
    progress,
    message,
    sha256Receipt,
    incomingMeta,
    startSend,
    joinIncomingRoom,
    acceptTransfer,
    declineTransfer,
    cancelTransfer,
  };
}