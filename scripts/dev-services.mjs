import { setTimeout as delay } from 'node:timers/promises';

export async function waitForServices(urls, { signal, timeoutMs = 30_000, intervalMs = 200 } = {}) {
  const timeout = AbortSignal.timeout(timeoutMs);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
  try {
    while (true) {
      combined.throwIfAborted();
      const ready = await Promise.all(
        urls.map(async (url) => {
          try {
            const response = await fetch(url, { signal: combined });
            await response.body?.cancel();
            return response.ok;
          } catch {
            return false;
          }
        }),
      );
      combined.throwIfAborted();
      if (ready.every(Boolean)) return;
      await delay(intervalMs, undefined, { signal: combined });
    }
  } catch (error) {
    signal?.throwIfAborted();
    if (timeout.aborted) throw new Error(`Timed out waiting for: ${urls.join(', ')}`);
    throw error;
  }
}
