/**
 * Shared stdin reader with timeout.
 * All hooks import this to avoid duplicating stdin parsing.
 */

export async function readStdin<T>(timeoutMs: number = 100): Promise<T | null> {
  try {
    const text = await Promise.race([
      Bun.stdin.text(),
      new Promise<string>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), timeoutMs)
      ),
    ]);

    if (!text.trim()) return null;
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}
