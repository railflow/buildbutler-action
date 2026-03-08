import * as core from '@actions/core';
import { collectBuild } from './collect-build';
import { collectTests }  from './collect-tests';
import { collectAgent, collectFleetRunners } from './collect-agents';
import { sendBuild, sendTestSuite, sendAgentSnapshot } from './send';

// action.yml declares `post: dist/index.js` — we use STATE_IS_POST to detect the post step
const IS_POST = !!process.env.STATE_IS_POST;

async function main() {
  const apiKey     = core.getInput('api-key', { required: true });
  const apiUrl     = core.getInput('api-url') || 'https://api.buildbutler.dev';
  const testGlob   = core.getInput('test-results');
  const githubToken = core.getInput('github-token');

  const opts = { apiKey, apiUrl };

  if (IS_POST) {
    // Post step: mark current runner as ONLINE (released).
    // We always send an individual update here — the fleet snapshot captured in
    // the main step showed this runner as BUILDING, so we need to flip it back.
    const agentSnap = collectAgent('ONLINE');
    if (agentSnap) {
      try {
        await sendAgentSnapshot(opts, agentSnap);
        core.info('[Build Butler] Runner released → ONLINE');
      } catch (err) {
        core.warning(`[Build Butler] Could not update runner status:\n${(err as any)?.stack ?? err}\nRequest body: ${JSON.stringify((err as any)?.requestBody, null, 2)}`);
      }
    }
    return;
  }

  // Main step: save state so the post step runs
  core.saveState('IS_POST', 'true');

  // 1. Collect and send build
  const build = collectBuild();
  core.info(`[Build Butler] Reporting build ${build.jobName} #${build.buildNumber} → ${build.status}`);
  try {
    await sendBuild(opts, build);
    core.info('[Build Butler] Build reported.');
  } catch (err) {
    core.warning(`[Build Butler] Could not report build:\n${(err as any)?.stack ?? err}\nRequest body: ${JSON.stringify((err as any)?.requestBody, null, 2)}`);
  }

  // 2. Send runner fleet snapshot if github-token provided, otherwise single runner
  if (githubToken) {
    try {
      const fleetSnap = await collectFleetRunners(githubToken);
      if (fleetSnap) {
        await sendAgentSnapshot(opts, fleetSnap);
        core.info(`[Build Butler] Fleet reported: ${fleetSnap.agents.length} runner(s).`);
      }
    } catch (err) {
      core.warning(`[Build Butler] Could not report runner fleet:\n${(err as any)?.stack ?? err}\nRequest body: ${JSON.stringify((err as any)?.requestBody, null, 2)}`);
      // Fall back to single runner
      const agentSnap = collectAgent('BUILDING');
      if (agentSnap) await sendAgentSnapshot(opts, agentSnap).catch(() => {});
    }
  } else {
    const agentSnap = collectAgent('BUILDING');
    if (agentSnap) {
      try {
        await sendAgentSnapshot(opts, agentSnap);
      } catch (err) {
        core.warning(`[Build Butler] Could not report runner:\n${(err as any)?.stack ?? err}\nRequest body: ${JSON.stringify((err as any)?.requestBody, null, 2)}`);
      }
    }
  }

  // 3. Parse and send test results
  if (testGlob) {
    core.info(`[Build Butler] Parsing test results: ${testGlob}`);
    try {
      const suites = await collectTests(testGlob, build.id);
      core.info(`[Build Butler] Found ${suites.length} test suite(s).`);
      for (const suite of suites) {
        await sendTestSuite(opts, suite);
      }
      if (suites.length > 0) core.info('[Build Butler] Test results reported.');
    } catch (err) {
      core.warning(`[Build Butler] Could not report test results:\n${(err as any)?.stack ?? err}\nRequest body: ${JSON.stringify((err as any)?.requestBody, null, 2)}`);
    }
  }
}

main().catch((err) => {
  core.setFailed(`[Build Butler] ${(err as any)?.stack ?? err}`);
});
