import { spawn } from 'node:child_process';
import type { PublicationState } from '../../shared/update-types';

const repository = 'Roman17-bot/deadlock-archive';
const workflow = 'refresh-data.yml';
const endpoint = `https://api.github.com/repos/${repository}/actions/workflows/${workflow}/dispatches`;
const workflowUrl = `https://github.com/${repository}/actions/workflows/${workflow}`;
const safeError = () =>
  new Error('GitHub publication could not be dispatched. Check owner authorization and retry.');

export interface PublicationDependencies {
  fetchImpl?: typeof fetch;
  credentialProvider?: () => Promise<string>;
}

function validCredential(value: string) {
  return value.length > 0 && value.length <= 8192 && !/\s/.test(value);
}

/** Read GCM directly rather than `git credential fill`, which may execute arbitrary configured helpers. */
export async function existingCredential(): Promise<string> {
  if (process.env.GH_TOKEN && validCredential(process.env.GH_TOKEN)) return process.env.GH_TOKEN;
  return new Promise((resolve, reject) => {
    const child = spawn(
      'git',
      [
        '-c',
        'credential.trace=false',
        '-c',
        'credential.traceSecrets=false',
        '-c',
        'credential.interactive=never',
        'credential-manager',
        'get',
      ],
      {
        shell: false,
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'ignore'],
        env: {
          ...process.env,
          GCM_INTERACTIVE: 'never',
          GCM_GUI_PROMPT: '0',
          GIT_TERMINAL_PROMPT: '0',
          GCM_TRACE: '0',
          GCM_TRACE_SECRETS: '0',
          GIT_TRACE: '0',
          GIT_TRACE2: '0',
          GIT_TRACE_CURL: '0',
          GIT_CURL_VERBOSE: '0',
        },
      },
    );
    let output = '',
      bytes = 0,
      failed = false;
    const fail = () => {
      failed = true;
      child.kill();
      reject(safeError());
    };
    const timer = setTimeout(fail, 10000);
    timer.unref();
    child.on('error', () => {
      clearTimeout(timer);
      fail();
    });
    child.stdin.on('error', () => {
      /* close/error handles failed acquisition without leaking stderr */
    });
    child.stdout.on('data', (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > 16384) fail();
      else output += chunk.toString('utf8');
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (failed) return;
      const token = /^password=([^\r\n]+)$/m.exec(output)?.[1];
      output = '';
      if (code !== 0 || !token || !validCredential(token)) reject(safeError());
      else resolve(token);
    });
    child.stdin.end('protocol=https\nhost=github.com\nusername=Roman17-bot\n\n');
  });
}

async function responseDetails(response: Response): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) throw safeError();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > 65536) {
        await reader.cancel();
        throw safeError();
      }
      chunks.push(part.value);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } finally {
    reader.releaseLock();
  }
}

/** Dispatch acceptance is queued publication, never evidence that Pages deployed successfully. */
export async function dispatchPublication(
  options: { expectedVersion: number },
  dependencies: PublicationDependencies = {},
): Promise<PublicationState> {
  if (!Number.isSafeInteger(options.expectedVersion) || options.expectedVersion <= 0)
    throw safeError();
  try {
    const token = await (dependencies.credentialProvider ?? existingCredential)();
    if (!validCredential(token)) throw safeError();
    const response = await (dependencies.fetchImpl ?? fetch)(endpoint, {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(20000),
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2026-03-10',
        'User-Agent': 'deadlock-archive-local-updater',
      },
      body: JSON.stringify({
        ref: 'main',
        inputs: { expected_version: String(options.expectedVersion) },
      }),
    });
    if (response.status === 204) return { status: 'queued', url: workflowUrl };
    if (response.status !== 200) {
      await response.body?.cancel();
      throw safeError();
    }
    const details = await responseDetails(response);
    if (!details || typeof details !== 'object') throw safeError();
    const runId = 'workflow_run_id' in details ? details.workflow_run_id : undefined;
    const url = 'html_url' in details ? details.html_url : undefined;
    if (
      typeof runId !== 'number' ||
      !Number.isSafeInteger(runId) ||
      runId <= 0 ||
      url !== `https://github.com/${repository}/actions/runs/${runId}`
    )
      throw safeError();
    return { status: 'queued', runId, url };
  } catch {
    throw safeError();
  }
}
