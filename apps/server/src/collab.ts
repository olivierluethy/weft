import { Server } from '@hocuspocus/server';

/**
 * Real-time collaboration via Hocuspocus (Yjs).
 *
 * Documents are keyed by pageId and held in memory for the life of the server
 * process, which powers live co-editing and presence cursors. The *canonical*
 * source of truth remains the BlockNote JSON persisted to Prisma by the client's
 * autosave and by version snapshots — so nothing is lost across restarts; the
 * Yjs doc simply rehydrates from that JSON when the first editor reconnects.
 *
 * On localhost the socket is intentionally unauthenticated to keep setup
 * zero-config; tighten `onAuthenticate` before exposing the server publicly.
 */
export const hocuspocus = Server.configure({
  name: 'weft-collab',
  quiet: true,
});
