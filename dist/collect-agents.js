"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.collectAgent = collectAgent;
exports.collectFleetRunners = collectFleetRunners;
const github = __importStar(require("@actions/github"));
/** Report only the current runner (no GitHub token needed). */
function collectAgent(status) {
    const runnerName = process.env.RUNNER_NAME;
    if (!runnerName)
        return null;
    const repo = process.env.GITHUB_REPOSITORY;
    const workflow = process.env.GITHUB_WORKFLOW;
    const runnerLabels = process.env.RUNNER_LABELS ?? '';
    const os = process.env.RUNNER_OS;
    const arch = process.env.RUNNER_ARCH;
    return {
        jenkinsInstanceId: repo,
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
function mapRunnerStatus(r) {
    if (r.status === 'offline')
        return 'OFFLINE';
    return r.busy ? 'BUILDING' : 'ONLINE';
}
/**
 * Fetch the full self-hosted runner fleet via the GitHub API.
 * Tries org-level runners first; falls back to repo-level.
 * Requires a PAT with scopes:  manage_runners:org  (org runners)
 *                           OR  repo               (repo runners)
 * Fine-grained PAT permission: "Self-hosted runners" → Read
 */
async function collectFleetRunners(githubToken) {
    const repo = process.env.GITHUB_REPOSITORY;
    if (!repo)
        return null;
    const [owner, repoName] = repo.split('/');
    const octokit = github.getOctokit(githubToken);
    let runners = [];
    // Try org-level first (captures runners shared across multiple repos)
    try {
        const { data } = await octokit.rest.actions.listSelfHostedRunnersForOrg({
            org: owner,
            per_page: 100,
        });
        runners = data.runners;
    }
    catch {
        // Not an org or insufficient scope — fall back to repo-level
        try {
            const { data } = await octokit.rest.actions.listSelfHostedRunnersForRepo({
                owner,
                repo: repoName,
                per_page: 100,
            });
            runners = data.runners;
        }
        catch {
            return null;
        }
    }
    if (runners.length === 0)
        return null;
    return {
        jenkinsInstanceId: repo,
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
