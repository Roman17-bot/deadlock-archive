export class HttpError extends Error {
  constructor(public readonly status: number) {
    super(`Request failed: ${status}`);
    this.name = 'HttpError';
  }
}

/** Shared transport. Callers keep control of cancellation and response validation. */
export async function readJson(url: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(url, {
    ...init,
    signal: init?.signal ?? AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new HttpError(response.status);
  return response.json();
}
