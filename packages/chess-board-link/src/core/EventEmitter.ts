/**
 * Minimal strongly-typed event emitter. No dependencies — keeps the library
 * runtime free of node/event-emitter polyfills so it works in any browser.
 *
 * `EventMap` maps an event name to the payload type delivered to listeners.
 */
export type Listener<T> = (payload: T) => void;

export class TypedEventEmitter<EventMap> {
  private readonly listeners: {
    [K in keyof EventMap]?: Set<Listener<EventMap[K]>>;
  } = {};

  /** Subscribe to an event. Returns an unsubscribe function. */
  on<K extends keyof EventMap>(
    event: K,
    listener: Listener<EventMap[K]>,
  ): () => void {
    let set = this.listeners[event];
    if (!set) {
      set = new Set();
      this.listeners[event] = set;
    }
    set.add(listener);
    return () => this.off(event, listener);
  }

  /** Subscribe to an event for a single emission. */
  once<K extends keyof EventMap>(
    event: K,
    listener: Listener<EventMap[K]>,
  ): () => void {
    const off = this.on(event, (payload) => {
      off();
      listener(payload);
    });
    return off;
  }

  off<K extends keyof EventMap>(
    event: K,
    listener: Listener<EventMap[K]>,
  ): void {
    this.listeners[event]?.delete(listener);
  }

  protected emit<K extends keyof EventMap>(
    event: K,
    payload: EventMap[K],
  ): void {
    const set = this.listeners[event];
    if (!set) return;
    // Copy to tolerate listeners that unsubscribe during emission.
    for (const listener of [...set]) listener(payload);
  }

  /** Drop every listener. Call on teardown to avoid leaks. */
  protected removeAllListeners(): void {
    for (const key of Object.keys(this.listeners)) {
      delete this.listeners[key as keyof EventMap];
    }
  }
}
