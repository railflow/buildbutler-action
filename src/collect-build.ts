import * as core from '@actions/core';

export type BuildStatus = 'SUCCESS' | 'FAILURE' | 'ABORTED' | 'UNSTABLE' | 'NOT_BUILT';

function mapConclusion(conclusion: string): BuildStatus {
  switch (conclusion.toLowerCase()) {
    case 'success':    return 'SUCCESS';
    case 'failure':    return 'FAILURE';
    case 'cancelled':  return 'ABORTED';
    case 'timed_out':  return 'FAILURE';
    case 'skipped':    return 'NOT_BUILT';
    case 'unstable':   return 'UNSTABLE';
    default:           return 'FAILURE';
  }
}

export interface BuildPayload {
  id: string;
  jobName: string;
  jobDisplayName: string;
  buildNumber: number;
  status: BuildStatus;
  duration: number;
  startedAt: string;
  completedAt: string;
  branch?: string;
  commitSha?: string;
  jenkinsInstanceId: string;
  url: string;
  cause?: string;
  nodeInfo?: {
    nodeName: string;
    nodeLabels: string[];
    isBuiltIn: boolean;
  };
  source: 'github';
  externalRunId: string;
  queueDuration?: number;
}

export function collectBuild(overrideStatus?: string, queueDurationMs?: number): BuildPayload {
  const repo          = process.env.GITHUB_REPOSITORY!;
  const runNumber     = parseInt(process.env.GITHUB_RUN_NUMBER!, 10);
  const runId         = process.env.GITHUB_RUN_ID!;
  // GITHUB_WORKFLOW_REF = "owner/repo/.github/workflows/ci.yml@refs/heads/main"
  const workflowRef   = process.env.GITHUB_WORKFLOW_REF ?? '';
  const workflowFile  = workflowRef.match(/\/\.github\/workflows\/([^@]+)/)?.[1];
  const workflow      = workflowFile ?? process.env.GITHUB_WORKFLOW!;
  const sha        = process.env.GITHUB_SHA;
  const ref        = process.env.GITHUB_REF_NAME;
  const eventName  = process.env.GITHUB_EVENT_NAME;
  // Use GITHUB_RUN_STARTED_AT for whole-workflow duration.
  // Fall back to saved state then current time as last resort.
  const startedAt  = process.env.GITHUB_RUN_STARTED_AT || core.getState('STARTED_AT') || new Date().toISOString();
  const completedAt = new Date().toISOString();
  const runnerName  = process.env.RUNNER_NAME;
  const runnerLabels = process.env.RUNNER_LABELS ?? '';
  const isBuiltIn   = !runnerLabels.includes('self-hosted');

  const conclusion = overrideStatus || core.getInput('status') || process.env.GITHUB_JOB_STATUS || 'failure';
  const status = mapConclusion(conclusion);

  const started   = new Date(startedAt).getTime();
  const completed = new Date(completedAt).getTime();
  const duration  = Math.max(0, completed - started);

  const payload: BuildPayload = {
    id: crypto.randomUUID(),
    jobName: workflow,
    jobDisplayName: process.env.GITHUB_WORKFLOW!,
    buildNumber: runNumber,
    status,
    duration,
    startedAt,
    completedAt,
    branch: ref,
    commitSha: sha,
    jenkinsInstanceId: `https://github.com/${repo}`,
    url: `https://github.com/${repo}/actions/runs/${runId}`,
    cause: eventName,
    nodeInfo: runnerName
      ? { nodeName: runnerName, nodeLabels: runnerLabels ? runnerLabels.split(',').map(s => s.trim()) : [], isBuiltIn }
      : undefined,
    source: 'github',
    externalRunId: runId,
  };

  if (queueDurationMs !== undefined) {
    payload.queueDuration = queueDurationMs;
  }

  return payload;
}
