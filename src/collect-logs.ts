import * as github from '@actions/github';
import { BuildPayload } from './collect-build';

export interface LogsPayload {
  buildId: string;
  jobName: string;
  buildNumber: number;
  status: string;
  jenkinsInstanceId: string;
  branch?: string;
  duration: number;
  startedAt: string;
  completedAt: string;
  logContent: string;
}

export async function collectLogs(token: string, build: BuildPayload): Promise<LogsPayload | null> {
  const repo = process.env.GITHUB_REPOSITORY!;
  const [owner, repoName] = repo.split('/');
  const runId = parseInt(process.env.GITHUB_RUN_ID!, 10);

  const octokit = github.getOctokit(token);

  const { data } = await octokit.rest.actions.listJobsForWorkflowRun({
    owner,
    repo: repoName,
    run_id: runId,
  });

  const parts: string[] = [];
  for (const job of data.jobs) {
    try {
      const logsRes = await octokit.request('GET /repos/{owner}/{repo}/actions/jobs/{job_id}/logs', {
        owner,
        repo: repoName,
        job_id: job.id,
        request: { redirect: 'follow' },
      });
      const logText = typeof logsRes.data === 'string' ? logsRes.data : String(logsRes.data);
      parts.push(`=== Job: ${job.name} ===\n${logText}`);
    } catch {
      parts.push(`=== Job: ${job.name} ===\n[Log not available]\n`);
    }
  }

  if (parts.length === 0) return null;

  const logContent = parts.join('\n');

  return {
    buildId: build.id,
    jobName: build.jobName,
    buildNumber: build.buildNumber,
    status: build.status,
    jenkinsInstanceId: build.jenkinsInstanceId,
    branch: build.branch,
    duration: build.duration,
    startedAt: build.startedAt,
    completedAt: build.completedAt,
    logContent,
  };
}
