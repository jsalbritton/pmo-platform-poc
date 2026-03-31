/**
 * Minimal Observable implementation for the WorkerBus streaming protocol.
 *
 * Covers exactly the patterns the WorkerBus needs:
 *   - Observable<T>  — subscribe to a value stream (Constellation ticks, risk cascade)
 *   - Subject<T>     — multicast bridge from worker messages to Observable subscribers
 *   - Subscription   — explicit teardown on component unmount
 *
 * Interface is intentionally compatible with RxJS Observable/Subject/Subscription.
 * If RxJS is added later: swap this import for 'rxjs' with no call-site changes.
 *
 * ADR-001: Decision 3 — Observable streaming protocol (custom implementation, $0)
 */

// ─── Observer ─────────────────────────────────────────────────────────────────

export interface Observer<T> {
  next: (value: T) => void
  error: (err: unknown) => void
  complete: () => void
}

// ─── Subscription ─────────────────────────────────────────────────────────────

export interface Subscription {
  unsubscribe(): void
  readonly closed: boolean
}

// ─── Observable ───────────────────────────────────────────────────────────────

type SubscriberFn<T> = (observer: Observer<T>) => (() => void) | void

export class Observable<T> {
  constructor(private readonly _subscribe: SubscriberFn<T>) {}

  subscribe(observerOrNext: Partial<Observer<T>> | ((value: T) => void)): Subscription {
    // Accept either a full observer object or a bare next() function
    const observer: Partial<Observer<T>> =
      typeof observerOrNext === 'function' ? { next: observerOrNext } : observerOrNext

    let closed = false
    let teardown: (() => void) | void

    // Wrap provided observer so we stop delivering after closed
    const safe: Observer<T> = {
      next:     (v) => { if (!closed) observer.next?.(v) },
      error:    (e) => { if (!closed) { closed = true; observer.error?.(e) } },
      complete: ()  => { if (!closed) { closed = true; observer.complete?.() } },
    }

    try {
      teardown = this._subscribe(safe)
    } catch (err) {
      safe.error(err)
    }

    return {
      get closed() { return closed },
      unsubscribe() {
        if (!closed) {
          closed = true
          teardown?.()
        }
      },
    }
  }
}

// ─── Subject ──────────────────────────────────────────────────────────────────

/**
 * A Subject is both an Observer (you can push values into it) and an
 * Observable (subscribers receive those values).
 *
 * The WorkerBus creates one Subject per in-flight streaming correlation ID.
 * Worker messages push ticks via subject.next(); component teardown calls
 * subscription.unsubscribe() which triggers cleanup in the bus.
 */
export class Subject<T> {
  private readonly _observers = new Set<Observer<T>>()
  private _closed = false

  get closed(): boolean {
    return this._closed
  }

  next(value: T): void {
    if (this._closed) return
    // Iterate over a snapshot in case an observer triggers unsubscribe during delivery
    for (const observer of [...this._observers]) {
      observer.next(value)
    }
  }

  error(err: unknown): void {
    if (this._closed) return
    this._closed = true
    for (const observer of [...this._observers]) {
      observer.error(err)
    }
    this._observers.clear()
  }

  complete(): void {
    if (this._closed) return
    this._closed = true
    for (const observer of [...this._observers]) {
      observer.complete()
    }
    this._observers.clear()
  }

  /** Returns an Observable view of this Subject — subscribers cannot push values */
  asObservable(): Observable<T> {
    return new Observable<T>((observer) => {
      if (this._closed) {
        observer.complete()
        return
      }
      this._observers.add(observer)
      return () => {
        this._observers.delete(observer)
      }
    })
  }
}
