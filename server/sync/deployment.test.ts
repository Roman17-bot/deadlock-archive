import { describe, expect, it, vi } from 'vitest';
import { verifyDeploymentHead } from './deployment';
const commit = 'a'.repeat(40);
describe('last deployment gate', () => {
  it('accepts the current main commit', async () => {
    const fetchImpl = vi.fn(
      async () => new Response(JSON.stringify({ object: { sha: commit } })),
    ) as unknown as typeof fetch;
    await expect(
      verifyDeploymentHead(commit, { fetchImpl, token: 'test-token' }),
    ).resolves.toBeUndefined();
    expect(fetchImpl).toHaveBeenCalledOnce();
  });
  it('refuses a pinned retry after main advances', async () => {
    const fetchImpl = vi.fn(
      async () => new Response(JSON.stringify({ object: { sha: 'b'.repeat(40) } })),
    ) as unknown as typeof fetch;
    await expect(verifyDeploymentHead(commit, { fetchImpl })).rejects.toThrow(/main/i);
  });
  it('rejects invalid inputs before requests and keeps diagnostics private', async () => {
    const fetchImpl = vi.fn(async () => {
      throw Error('secret-token');
    }) as unknown as typeof fetch;
    await expect(verifyDeploymentHead('invalid', { fetchImpl })).rejects.toThrow();
    expect(fetchImpl).not.toHaveBeenCalled();
    await expect(verifyDeploymentHead(commit, { fetchImpl })).rejects.toThrow(
      'Deployment main check failed',
    );
  });
});
