'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  PeerTransferSession,
  type IncomingKnock,
  type IncomingMeta,
  type TransferState,
} from '@/lib/webrtcEngine';

export type { IncomingKnock, IncomingMeta, TransferState };

export function usePeerTransfer() {
  const [state, setState] = useState<TransferState>('idle');
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [sha256Receipt, setSha256Receipt] = useState<string | null>(null);
  const [incomingMeta, setIncomingMeta] = useState<IncomingMeta | null>(null);

  const sessionRef = useRef<PeerTransferSession | null>(null);

  const getSession = useCallback(() => {
    if (!sessionRef.current) {
      sessionRef.current = new PeerTransferSession({
        onStateChange: setState,
        onProgress: setProgress,
        onMessage: setMessage,
        onReceipt: setSha256Receipt,
        onIncomingMeta: setIncomingMeta,
      });
    }
    return sessionRef.current;
  }, []);

  useEffect(() => {
    return () => {
      void sessionRef.current?.cleanup();
    };
  }, []);

  const startSend = useCallback(
    (recipientId: string, file: File) => getSession().startSend(recipientId, file),
    [getSession]
  );

  const presentIncomingKnock = useCallback(
    (knock: IncomingKnock) => getSession().presentIncomingKnock(knock),
    [getSession]
  );

  const joinIncomingRoom = useCallback(
    (roomId: string) => getSession().joinIncomingRoom(roomId),
    [getSession]
  );

  const acceptIncoming = useCallback(() => getSession().acceptIncoming(), [getSession]);

  const declineIncoming = useCallback(() => getSession().declineIncoming(), [getSession]);

  const cancelTransfer = useCallback(() => getSession().cancelTransfer(), [getSession]);

  const resetTransfer = useCallback(() => getSession().reset(), [getSession]);

  return {
    state,
    progress,
    message,
    sha256Receipt,
    incomingMeta,
    startSend,
    presentIncomingKnock,
    joinIncomingRoom,
    acceptIncoming,
    declineIncoming,
    acceptTransfer: acceptIncoming,
    declineTransfer: declineIncoming,
    cancelTransfer,
    resetTransfer,
  };
}
