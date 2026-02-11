/**
 * Shared stdin reader with timeout.
 * All hooks import this to avoid duplicating stdin parsing.
 */

export async function readStdin<T>(timeoutMs: number = 100): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout>;
  try {
    const text = await Promise.race([
      Bun.stdin.text(),
      new Promise<string>((_, reject) => {
        timer = setTimeout(() => reject(new Error('timeout')), timeoutMs);
      }),
    ]);
    clearTimeout(timer!);

    if (!text.trim()) return null;
    return JSON.parse(text) as T;
  } catch {
    clearTimeout(timer!);
    return null;
  }
}
