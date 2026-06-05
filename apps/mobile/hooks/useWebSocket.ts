'use client';
import { useEffect, useRef, useCallback } from 'react';
import type { WSMessage } from '@stray/ui';

type Handler = (msg: WSMessage) => void;

const RECONNECT_DELAY_MS = 3000;

export function useWebSocket(onMessage: Handler) {
  const wsRef = useRef<WebSocket | null>(null);
  const handlerRef = useRef<Handler>(onMessage);
  const deadRef = useRef(false);

  // Keep handler ref fresh without triggering reconnect
  useEffect(() => {
    handlerRef.current = onMessage;
  }, [onMessage]);

  const connect = useCallback(() => {
    if (deadRef.current) return;

    const url = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:8000/ws';
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const msg: WSMessage = JSON.parse(event.data as string);
        handlerRef.current(msg);
      } catch {
        // ignore malformed frames
      }
    };

    ws.onclose = () => {
      if (!deadRef.current) {
        setTimeout(connect, RECONNECT_DELAY_MS);
      }
    };

    ws.onerror = () => {
      ws.close();
    };
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
