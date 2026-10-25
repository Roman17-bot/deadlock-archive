import { describe, expect, it } from 'vitest';
import { dispatchPublication } from './publish';

const runUrl = 'https://github.com/Roman17-bot/deadlock-archive/actions/runs/123';
const credentialProvider = async () => 'test-fixture-credential';
describe('fixed owner publication dispatch', () => {
  it('dispatches the fixed workflow with version binding and returns only a queued run link', async () => {
    const fetchImpl: typeof fetch = async (input, init) => {
      expect(String(input)).toBe(
        'https://api.github.com/repos/Roman17-bot/deadlock-archive/actions/workflows/refresh-data.yml/dispatches',
      );
      expect(init?.method).toBe('POST');
      expect(init?.redirect).toBe('error');
      const headers = new Headers(init?.headers);
      expect(headers.get('X-GitHub-Api-Version')).toBe('2026-03-10');
      expect(headers.get('Authorization')).toBe('Bearer test-fixture-credential');
      expect(JSON.parse(String(init?.body))).toEqual({
        ref: 'main',
        inputs: { expected_version: '6820' },
      });
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      return Response.json({
        workflow_run_id: 123,
        html_url: runUrl,
        run_url: 'https://api.github.com/repos/Roman17-bot/deadlock-archive/actions/runs/123',
      });
    };
    expect(
      await dispatchPublication({ expectedVersion: 6820 }, { fetchImpl, credentialProvider }),
    ).toEqual({ status: 'queued', runId: 123, url: runUrl });
  });
  it('accepts legacy 204 as queued with a generic Actions URL', async () => {
    expect(
      await dispatchPublication(
        { expectedVersion: 6819 },
        { credentialProvider, fetchImpl: async () => new Response(null, { status: 204 }) },
      ),
    ).toEqual({
      status: 'queued',
      url: 'https://github.com/Roman17-bot/deadlock-archive/actions/workflows/refresh-data.yml',
    });
  });
  it.each([
    { workflow_run_id: 123, html_url: 'https://evil.test/secret' },
    { workflow_run_id: -1, html_url: runUrl },
    { workflow_run_id: 124, html_url: runUrl },
    { id: 123, html_url: runUrl },
  ])('rejects malformed or foreign dispatch details', async (details) => {
    await expect(
      dispatchPublication(
        { expectedVersion: 6819 },
        { credentialProvider, fetchImpl: async () => Response.json(details) },
      ),
    ).rejects.toThrow(/publication|GitHub/i);
  });
  it('redacts credential and upstream error details', async () => {
    for (const deps of [
      {
        credentialProvider: async () => {
          throw new Error('private credential detail');
        },
        fetchImpl: fetch,
      },
      {
        credentialProvider,
        fetchImpl: async () => new Response('private credential detail', { status: 403 }),
      },
      {
        credentialProvider,
        fetchImpl: async () => {
          throw new Error('private credential detail');
        },
      },
      { credentialProvider, fetchImpl: async () => new Response('x'.repeat(70000)) },
    ]) {
      try {
        await dispatchPublication({ expectedVersion: 6819 }, deps);
        throw new Error('Expected rejection');
      } catch (error) {
        expect(String(error)).not.toContain('private credential detail');
        expect(String(error)).not.toContain('Expected rejection');
      }
    }
  });
  it.each([0, -1, NaN, Infinity, 1.5])(
    'rejects invalid client version %s before credentials or HTTP',
    async (expectedVersion) => {
      let contacted = false;
      await expect(
        dispatchPublication(
          { expectedVersion },
          {
            credentialProvider: async () => {
              contacted = true;
              return 'fixture';
            },
            fetchImpl: fetch,
          },
        ),
      ).rejects.toThrow();
      expect(contacted).toBe(false);
    },
  );
});
