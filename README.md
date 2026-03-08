<p align="center">
  <img src="docs/buildbutler-logo.png" alt="Build Butler" width="120" />
</p>

# Build Butler GitHub Action

[![GitHub Marketplace](https://img.shields.io/badge/Marketplace-Build%20Butler-blue?logo=github)](https://github.com/marketplace/actions/build-butler)
[![CI](https://github.com/railflow/buildbutler-action/actions/workflows/ci.yml/badge.svg)](https://github.com/railflow/buildbutler-action/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/railflow/buildbutler-action?label=latest)](https://github.com/railflow/buildbutler-action/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> Report build results, test outcomes, and runner fleet health to [Build Butler](https://buildbutler.dev) — your CI analytics platform.

---

## Overview

The **Build Butler** GitHub Action automatically captures and ships data from every workflow run to your Build Butler dashboard:

- **Build status** — job name, run number, branch, conclusion, duration
- **Test results** — JUnit XML parsed and sent as structured test suites
- **Runner fleet** — self-hosted runner status (BUILDING → ONLINE lifecycle)

![Build Butler Dashboard](docs/screenshot-dashboard.png)

> _Screenshot: Build Butler dashboard showing build trends, test pass rates, and runner utilisation._

---

## Quick Start

```yaml
# .github/workflows/ci.yml
name: CI

on: [push, pull_request]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Build & test
        run: ./gradlew test

      - name: Report to Build Butler
        if: always()   # run even on failure so you capture broken builds
        uses: railflow/buildbutler-action@v1
        with:
          api-key: ${{ secrets.BUILDBUTLER_API_KEY }}
          test-results: 'build/test-results/**/*.xml'
```

---

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `api-key` | **Yes** | — | Your Build Butler API key. Store as a [repository secret](https://docs.github.com/en/actions/security-guides/encrypted-secrets). |
| `test-results` | No | `''` | Glob pattern for JUnit XML files (e.g. `build/test-results/**/*.xml`, `**/TEST-*.xml`). Omit to skip test reporting. |
| `github-token` | No | `''` | PAT for full runner fleet reporting (see [Runner Fleet Reporting](#runner-fleet-reporting)). |

---

## Usage Examples

### Minimal — build status only

```yaml
- uses: railflow/buildbutler-action@v1
  if: always()
  with:
    api-key: ${{ secrets.BUILDBUTLER_API_KEY }}
```

### With test results

```yaml
- name: Run tests
  run: mvn test

- uses: railflow/buildbutler-action@v1
  if: always()
  with:
    api-key: ${{ secrets.BUILDBUTLER_API_KEY }}
    test-results: '**/surefire-reports/*.xml'
```

### With full runner fleet reporting

```yaml
- uses: railflow/buildbutler-action@v1
  if: always()
  with:
    api-key: ${{ secrets.BUILDBUTLER_API_KEY }}
    test-results: 'build/test-results/**/*.xml'
    github-token: ${{ secrets.GH_RUNNERS_PAT }}
```

### Matrix builds

```yaml
jobs:
  test:
    strategy:
      matrix:
        java: [11, 17, 21]
    steps:
      - run: ./gradlew test
      - uses: railflow/buildbutler-action@v1
        if: always()
        with:
          api-key: ${{ secrets.BUILDBUTLER_API_KEY }}
          test-results: 'build/test-results/**/*.xml'
```

Each matrix leg is reported as a separate build — Build Butler groups them by workflow run.

---

## Runner Fleet Reporting

Without `github-token`, only the runner executing the current job is reported (status changes from `BUILDING` to `ONLINE` on job completion).

With `github-token`, the action fetches **all** self-hosted runners in your organisation and sends a fleet-wide snapshot.

### Required PAT scopes

| PAT type | Scope | Coverage |
|----------|-------|----------|
| Classic PAT | `manage_runners:org` | All org-level runners (recommended) |
| Classic PAT | `repo` | Repo-level runners only |
| Fine-grained | Self-hosted runners → **Read** | Repo and/or org level |

Create the PAT at **Settings → Developer settings → Personal access tokens**, then add it as a secret (`GH_RUNNERS_PAT`) on your repository or organisation.

---

## Secrets Setup

1. Log in to [buildbutler.dev](https://buildbutler.dev) and copy your API key from **Settings → API Keys**.
2. In your GitHub repository: **Settings → Secrets and variables → Actions → New repository secret**
   - Name: `BUILDBUTLER_API_KEY`
   - Value: your API key
3. _(Optional)_ Add `GH_RUNNERS_PAT` for fleet reporting.

---

## How It Works

The action runs in two phases managed by the `post:` hook in `action.yml`:

```
Job starts
  └── main step  → reports build + test results + sets runner to BUILDING
      ...your other steps run...
Job ends (always)
  └── post step  → flips runner status back to ONLINE
```

This ensures runner availability is accurate even when jobs fail or are cancelled.

---

## Versioning

Pin to a specific version for stability:

```yaml
uses: railflow/buildbutler-action@v1        # latest v1.x (recommended)
uses: railflow/buildbutler-action@v1.2.3    # exact version
uses: railflow/buildbutler-action@main      # bleeding edge (not for production)
```

We follow [semantic versioning](https://semver.org/). The `v1` major tag is updated with every backwards-compatible release.

---

## Contributing

1. Fork the repo and create a branch: `git checkout -b feat/my-feature`
2. Make changes in `src/`
3. Build the bundle: `npm install && npm run build`
4. Commit **both** source and `dist/`: `git add src/ dist/ && git commit`
5. Open a pull request

> **Why commit `dist/`?**
> GitHub Actions runs directly from the repo — there is no install step. The compiled bundle must be committed so the action works without a build step in the consumer's workflow.

---

## Publishing a New Release

1. Bump the version in `package.json`
2. Build: `npm run build`
3. Commit: `git add . && git commit -m "chore: release vX.Y.Z"`
4. Tag:
   ```bash
   git tag -a vX.Y.Z -m "vX.Y.Z"
   git tag -fa v1 -m "Update v1 tag"   # move the major tag
   git push origin main --tags --force
   ```
5. On GitHub: **Releases → Draft a new release** → select the tag → check **"Publish this Action to the GitHub Marketplace"** → publish.

---

## License

[MIT](LICENSE) © [Railflow](https://railflow.io)
