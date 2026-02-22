import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export function useSSE(url = '/api/events') {
  const [connected, setConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  // Map of event type → Set of listener callbacks
  const listenersRef = useRef(new Map<string, Set<(data: unknown) => void>>());
  // Track which event types have been registered on the EventSource
  const registeredTypesRef = useRef(new Set<string>());

  useEffect(() => {
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);

    // Re-register all previously subscribed event types on the new EventSource
    for (const eventType of listenersRef.current.keys()) {
      registerEventType(es, eventType);
    }

    return () => {
      es.close();
      eventSourceRef.current = null;
      registeredTypesRef.current.clear();
      setConnected(false);
    };
  }, [url]);

  function registerEventType(es: EventSource, eventType: string) {
    if (registeredTypesRef.current.has(eventType)) return;
    registeredTypesRef.current.add(eventType);

    es.addEventListener(eventType, (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        const handlers = listenersRef.current.get(eventType);
        handlers?.forEach((h) => h(data));
      } catch {
        // ignore malformed events
      }
    });
  }

  const on = useCallback(<T,>(eventType: string, handler: (data: T) => void): (() => void) => {
    if (!listenersRef.current.has(eventType)) {
      listenersRef.current.set(eventType, new Set());
    }

    // Register on the EventSource if it exists
    if (eventSourceRef.current) {
      registerEventType(eventSourceRef.current, eventType);
    }

    const handlers = listenersRef.current.get(eventType)!;
    const wrappedHandler = handler as (data: unknown) => void;
    handlers.add(wrappedHandler);

    return () => {
      handlers.delete(wrappedHandler);
    };
  }, []);

  return useMemo(() => ({ connected, on }), [connected, on]);
}

export function useSSEEvent<T>(
  sse: { on: <U>(eventType: string, handler: (data: U) => void) => () => void },
  eventType: string,
  handler: (data: T) => void,
): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    return sse.on<T>(eventType, (data) => handlerRef.current(data));
  }, [sse, eventType]);
}
