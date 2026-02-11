/**
 * Structured stderr logging for hooks.
 * Logs to stderr so they appear in debug mode but don't pollute stdout context injection.
 */

export function log(hook: string, message: string): void {
  const ts = new Date().toISOString();
  process.stderr.write(`[${ts}] [${hook}] ${message}\n`);
}

export function logError(hook: string, error: unknown): void {
  const msg = error instanceof Error ? error.message : String(error);
  log(hook, `ERROR: ${msg}`);
}
