import * as github from '@actions/github';

export interface AgentSnapshotPayload {
  jenkinsInstanceId: string;
  agents: {
    name: string;
    status: 'ONLINE' | 'OFFLINE' | 'BUILDING' | 'UNKNOWN';
    currentJob?: string;
    labels?: string;
    os?: string;
    arch?: string;
    executors: number;
  }[];
  queueItems: [];
}

/** Report only the current runner (no GitHub token needed). */
export function collectAgent(status: 'BUILDING' | 'ONLINE'): AgentSnapshotPayload | null {
  const runnerName = process.env.RUNNER_NAME;
  if (!runnerName) return null;

  const repo         = process.env.GITHUB_REPOSITORY!;
  const workflow     = process.env.GITHUB_WORKFLOW;
  const runnerLabels = process.env.RUNNER_LABELS ?? '';
  const os           = process.env.RUNNER_OS;
  const arch         = process.env.RUNNER_ARCH;

  return {
    jenkinsInstanceId: `https://github.com/${repo}`,
    agents: [{
      name: runnerName,
      status,
      currentJob: status === 'BUILDING' ? workflow : undefined,
      labels: runnerLabels || undefined,
      os,
      arch,
      executors: 1,
    }],
    queueItems: [],
  };
}

interface GitHubRunner {
  id: number;
  name: string;
  os: string;
  status: string;   // 'online' | 'offline'
  busy: boolean;
  labels: { name: string }[];
}

function mapRunnerStatus(r: GitHubRunner): 'ONLINE' | 'OFFLINE' | 'BUILDING' {
  if (r.status === 'offline') return 'OFFLINE';
  return r.busy ? 'BUILDING' : 'ONLINE';
}

/**
 * Fetch the full self-hosted runner fleet via the GitHub API.
 * Tries org-level runners first; falls back to repo-level.
 * Requires a PAT with scopes:  manage_runners:org  (org runners)
 *                           OR  repo               (repo runners)
 * Fine-grained PAT permission: "Self-hosted runners" → Read
 */
export async function collectFleetRunners(
  githubToken: string,
): Promise<AgentSnapshotPayload | null> {
  const repo = process.env.GITHUB_REPOSITORY;
  if (!repo) return null;

  const [owner, repoName] = repo.split('/');
  const octokit = github.getOctokit(githubToken);

  let runners: GitHubRunner[] = [];

  // Try org-level first (captures runners shared across multiple repos)
  try {
    const { data } = await octokit.rest.actions.listSelfHostedRunnersForOrg({
      org: owner,
      per_page: 100,
    });
    runners = data.runners as GitHubRunner[];
  } catch {
    // Not an org or insufficient scope — fall back to repo-level
    try {
      const { data } = await octokit.rest.actions.listSelfHostedRunnersForRepo({
        owner,
        repo: repoName,
        per_page: 100,
      });
      runners = data.runners as GitHubRunner[];
    } catch {
      return null;
    }
  }

  if (runners.length === 0) return null;

  return {
    jenkinsInstanceId: `https://github.com/${repo}`,
    agents: runners.map((r) => ({
      name: r.name,
      status: mapRunnerStatus(r),
      labels: r.labels.map((l) => l.name).join(',') || undefined,
      os: r.os,
      executors: 1,
    })),
    queueItems: [],
  };
}
