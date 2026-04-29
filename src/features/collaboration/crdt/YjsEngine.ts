/**
 * Stub for Yjs-based conflict-safe collaborative editing.
 *
 * Gated behind NEXT_PUBLIC_REALTIME_CRDT. When the flag is true the
 * spreadsheet engine wires through this module to share document updates.
 * Today every method is a no-op so we can ship the boundary without
 * pulling in Yjs as a dependency.
 *
 * Implementation lives in a follow-up R8.x session.
 */

export interface CrdtEngine {
  start(workbookId: string): Promise<void>
  stop(): Promise<void>
  applyUpdate(update: Uint8Array): void
}

export const YjsEngine: CrdtEngine = {
  async start(_workbookId: string) {
    // intentional no-op
  },
  async stop() {
    // intentional no-op
  },
  applyUpdate(_update: Uint8Array) {
    // intentional no-op
  },
}
