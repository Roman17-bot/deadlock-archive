import { pathToFileURL } from 'node:url';
export async function verifyDeploymentHead(
  commit: string,
  deps: { fetchImpl?: typeof fetch; token?: string } = {},
): Promise<void> {
  try {
    if (!/^[a-f0-9]{40}$/.test(commit)) throw Error('Invalid commit');
    const response = await (deps.fetchImpl ?? fetch)(
      'https://api.github.com/repos/Roman17-bot/deadlock-archive/git/ref/heads/main',
      {
        redirect: 'error',
        signal: AbortSignal.timeout(20_000),
        headers: {
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2026-03-10',
          'User-Agent': 'deadlock-archive-deployment-gate',
          ...(deps.token ? { Authorization: `Bearer ${deps.token}` } : {}),
        },
      },
    );
    if (!response.ok) throw Error('Unavailable');
    const value = (await response.json()) as { object?: { sha?: unknown } };
    if (value.object?.sha !== commit) throw Error('Advanced');
  } catch {
    throw Error(
      'Deployment main check failed: the snapshot is stale or current main could not be verified',
    );
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await verifyDeploymentHead(process.env.EXPECTED_SYNC_COMMIT || process.env.GITHUB_SHA || '', {
      token: process.env.GITHUB_TOKEN,
    });
    console.log('Deployment commit is still current main.');
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Deployment main check failed');
    process.exitCode = 1;
  }
}
