/**
 * WorkerBus — singleton compute transport for the PMO Platform
 *
 * Provides a unified dispatch surface for all off-thread computation.
 * Workers are instantiated lazily on first use and terminated after
 * 30 seconds of idle time.
 *
 * Usage:
 *   // Single response
 *   const scores = await workerBus.dispatch<RiskScore[]>('constellation', 'SCORE_RISKS', payload)
 *
 *   // Streaming (returns Observable — call .subscribe() and unsubscribe on unmount)
 *   const sub = workerBus
 *     .stream<ConstellationTick>('constellation', 'CONSTELLATION_TICK', graph)
 *     .subscribe({ next: tick => renderer.applyTick(tick) })
 *   // In useEffect cleanup: sub.unsubscribe()
 *
 * ADR-001: Decision 2 — WorkerBus with lazy per-domain workers
 * ADR-001: Decision 3 — Structured protocol with Observable streaming
 * ADR-001: Decision 4 — Hybrid state model (transparent to this file)
 */

import { Observable, Subject } from './observable'
import type { BusMessage, BusResponse, WorkerDomain } from './types'

// ─── Internal types ────────────────────────────────────────────────────────────

interface PendingEntry {
  resolve: (value: unknown) => void
  reject: (reason: unknown) => void
  /** Present only for stream-mode dispatches */
  subject?: Subject<unknown>
}

// ─── Constants ─────────────────────────────────────────────────────────────────

/** Terminate idle workers after this many ms of inactivity */
const IDLE_TIMEOUT_MS = 30_000

// ─── WorkerBus ────────────────────────────────────────────────────────────────

class WorkerBus {
  private readonly workers   = new Map<WorkerDomain, Worker>()
  private readonly idleTimers = new Map<WorkerDomain, ReturnType<typeof setTimeout>>()
  private readonly pending    = new Map<string, PendingEntry>()

  // ── Worker lifecycle ────────────────────────────────────────────────────────

  /**
   * Return the live Worker for a domain, creating it if it doesn't exist.
   * Resets the idle timer on every access.
   */
  private acquire(domain: WorkerDomain): Worker {
    if (!this.workers.has(domain)) {
      // Vite transforms new URL('./x.worker.ts', import.meta.url) at build time
      // into the correct hashed production URL. No runtime path guessing needed.
      const worker = new Worker(
        new URL(`./${domain}.worker.ts`, import.meta.url),
        { type: 'module' },
      )
      worker.onmessage = (e: MessageEvent<BusResponse>) => this._receive(e.data)
      worker.onerror   = (e: ErrorEvent) => {
        console.error(`[WorkerBus:${domain}] uncaught worker error`, e.message)
      }
      this.workers.set(domain, worker)
    }

    this._resetIdleTimer(domain)
    return this.workers.get(domain)!
  }

  private _resetIdleTimer(domain: WorkerDomain): void {
    const existing = this.idleTimers.get(domain)
    if (existing) clearTimeout(existing)

    // Don't start the idle timer while any stream is active on this domain
    const hasActiveStreams = [...this.pending.values()].some(e => e.subject && !e.subject.closed)
    if (hasActiveStreams) return

    const timer = setTimeout(() => {
      this.workers.get(domain)?.terminate()
      this.workers.delete(domain)
      this.idleTimers.delete(domain)
    }, IDLE_TIMEOUT_MS)

    this.idleTimers.set(domain, timer)
  }

  // ── Dispatch: single response ───────────────────────────────────────────────

  /**
   * Send a message to a domain worker and resolve when the worker replies.
   * The returned Promise rejects if the worker sends an error response.
   */
  dispatch<T>(
    domain:  WorkerDomain,
    type:    string,
    payload: unknown,
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const correlationId = crypto.randomUUID()

      this.pending.set(correlationId, {
        resolve: resolve as (v: unknown) => void,
        reject,
      })

      const message: BusMessage = {
        type,
        correlationId,
        responseMode: 'single',
        payload,
      }

      this.acquire(domain).postMessage(message)
    })
  }

  // ── Stream: progressive response ────────────────────────────────────────────

  /**
   * Send a message to a domain worker and receive a stream of tick values.
   *
   * IMPORTANT: The returned Observable is cold — nothing happens until you
   * call .subscribe(). Always unsubscribe in useEffect cleanup:
   *
   *   useEffect(() => {
   *     const sub = workerBus.stream(...).subscribe(...)
   *     return () => sub.unsubscribe()
   *   }, [deps])
   *
   * Unsubscribing sends a CANCEL message to the worker so it stops computing.
   */
  stream<T>(
    domain:  WorkerDomain,
    type:    string,
    payload: unknown,
  ): Observable<T> {
    return new Observable<T>((observer) => {
      const correlationId = crypto.randomUUID()
      const subject       = new Subject<unknown>()

      // Bridge subject → observer
      const sub = subject.asObservable().subscribe({
        next:     (v) => observer.next(v as T),
        error:    (e) => observer.error(e),
        complete: ()  => observer.complete(),
      })

      this.pending.set(correlationId, {
        resolve: () => { /* streams don't use single-resolve */ },
        reject:  (e) => observer.error(e),
        subject,
      })

      const message: BusMessage = {
        type,
        correlationId,
        responseMode: 'stream',
        payload,
      }

      const worker = this.acquire(domain)
      worker.postMessage(message)

      // Teardown: called when the consumer unsubscribes or the component unmounts
      return () => {
        sub.unsubscribe()
        this.pending.delete(correlationId)
        // Tell the worker to stop computing — fire and forget
        worker.postMessage({ type: 'CANCEL', correlationId })
        // Worker is no longer streaming; idle timer can start
        this._resetIdleTimer(domain)
      }
    })
  }

  // ── Message handler ─────────────────────────────────────────────────────────

  private _receive(response: BusResponse): void {
    const entry = this.pending.get(response.correlationId)
    if (!entry) return // Already cancelled or timed out

    switch (response.kind) {
      case 'error': {
        entry.reject(new Error(response.error ?? 'Worker error'))
        this.pending.delete(response.correlationId)
        break
      }

      case 'result': {
        // Single-mode response
        entry.resolve(response.data)
        this.pending.delete(response.correlationId)
        break
      }

      case 'tick': {
        // Stream-mode progress update
        entry.subject?.next(response.data)
        break
      }

      case 'complete': {
        // Stream ended cleanly
        entry.subject?.complete()
        this.pending.delete(response.correlationId)
        break
      }
    }
  }
}

// ─── Singleton export ─────────────────────────────────────────────────────────

/**
 * The application-wide WorkerBus instance.
 * Import and use this directly — do not instantiate WorkerBus.
 */
export const workerBus = new WorkerBus()
