"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendBuild = sendBuild;
exports.sendTestSuite = sendTestSuite;
exports.sendAgentSnapshot = sendAgentSnapshot;
async function post(opts, path, body) {
    const url = `${opts.apiUrl}${path}`;
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-API-Key': opts.apiKey,
        },
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        const err = new Error(`POST ${path} → ${res.status} ${res.statusText}: ${text}`);
        err.requestBody = body;
        throw err;
    }
}
async function sendBuild(opts, payload) {
    await post(opts, '/api/v1/ingest/builds', payload);
}
async function sendTestSuite(opts, payload) {
    await post(opts, '/api/v1/ingest/tests', payload);
}
async function sendAgentSnapshot(opts, payload) {
    await post(opts, '/api/v1/ingest/agents', payload);
}
