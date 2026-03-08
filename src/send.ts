export interface SendOptions {
  apiUrl: string;
  apiKey: string;
}

async function post(opts: SendOptions, path: string, body: unknown): Promise<void> {
  const url = `${opts.apiUrl}${path}`;
  const res = await fetch(url, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'X-API-Key': opts.apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`POST ${path} → ${res.status} ${res.statusText}: ${text}`);
  }
}

export async function sendBuild(opts: SendOptions, payload: unknown): Promise<void> {
  await post(opts, '/api/v1/ingest/builds', payload);
}

export async function sendTestSuite(opts: SendOptions, payload: unknown): Promise<void> {
  await post(opts, '/api/v1/ingest/tests', payload);
}

export async function sendAgentSnapshot(opts: SendOptions, payload: unknown): Promise<void> {
  await post(opts, '/api/v1/ingest/agents', payload);
}
