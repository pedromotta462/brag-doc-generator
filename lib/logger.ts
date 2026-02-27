/**
 * Debug logger for backend. Never logs secrets, tokens, or full user content.
 * Use prefixes like [Sync], [Auth], [Cron] for filtering.
 */

const DEBUG = process.env.DEBUG_LOGS === "true";

function format(prefix: string, msg: string, meta?: Record<string, unknown>) {
  const ts = new Date().toISOString();
  const metaStr = meta ? ` ${JSON.stringify(meta)}` : "";
  return `[${ts}] ${prefix} ${msg}${metaStr}`;
}

export const log = {
  /** General info (always on) */
  info(prefix: string, msg: string, meta?: Record<string, unknown>) {
    console.log(format(prefix, msg, meta));
  },

  /** Debug (only when DEBUG_LOGS=true) */
  debug(prefix: string, msg: string, meta?: Record<string, unknown>) {
    if (DEBUG) {
      console.log(format(prefix, msg, meta));
    }
  },

  /** Warnings */
  warn(prefix: string, msg: string, meta?: Record<string, unknown>) {
    console.warn(format(prefix, msg, meta));
  },

  /** Errors - never include stack or raw error in meta if it might contain secrets */
  error(prefix: string, msg: string, meta?: Record<string, unknown>) {
    console.error(format(prefix, msg, meta));
  },
};
