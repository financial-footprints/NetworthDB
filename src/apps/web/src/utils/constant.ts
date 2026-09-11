/** Base overlay (settings, file viewer, account form). */
export const OVERLAY_Z = "z-50";

/** Nested overlay above an open base overlay (vault / security confirm). */
export const STACKED_OVERLAY_Z = "z-60";

/** Toast notifications above all overlays. */
export const TOAST_Z = "z-70";

/** Default page size for paginated list endpoints. */
export const DEFAULT_LIST_PAGE_SIZE = 100;

/** Background polling interval for active jobs and similar live views. */
export const POLL_INTERVAL_MS = 30_000;
