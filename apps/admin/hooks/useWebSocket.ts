'use client';
import { useEffect, useRef, useCallback } from 'react';
import type { WSMessage } from '@stray/ui';

const RECONNECT_DELAY_MS = 3000;

export type MessageHandler = (msg: WSMessage) => void;

export function useWebSocket(onMessage: MessageHandler) {
  const wsRef = useRef<WebSocket | null>(null);
  const handlerRef = useRef<MessageHandler>(onMessage);
  const deadRef = useRef(false);

  useEffect(() => {
    handlerRef.current = onMessage;
  }, [onMessage]);

  const connect = useCallback(() => {
    if (deadRef.current) return;
    const url = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:3004/ws';
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onmessage = (ev) => {
      try {
        const msg: WSMessage = JSON.parse(ev.data as string);
        handlerRef.current(msg);
      } catch {
        // ignore malformed frames
      }
    };

    ws.onclose = () => {
      if (!deadRef.current) setTimeout(connect, RECONNECT_DELAY_MS);
    };

    ws.onerror = () => ws.close();
  }, []);

  useEffect(() => {
    deadRef.current = false;
    connect();
    return () => {
      deadRef.current = true;
      wsRef.current?.close();
    };
  }, [connect]);
}
