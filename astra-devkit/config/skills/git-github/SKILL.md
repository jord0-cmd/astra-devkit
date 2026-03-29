---
name: git-github
description: Use this skill when working with Git, GitHub, pull requests, branching strategies, CI/CD pipelines, GitHub Actions, the gh CLI, conventional commits, or any version control workflow. Contains branching strategies, commit standards, PR patterns, GitHub Actions templates, advanced Git techniques, and recovery procedures.
---

# Git & GitHub

Version control done right. Commits, branches, PRs, CI/CD, and the tools that tie it all together.

---

## Commit Messages — Conventional Commits

Every commit message follows this format:

```
type(scope): description

[optional body]

[optional footer]
```

### Types

| Type | When |
|------|------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Formatting, no code change |
| `refactor` | Code change that neither fixes nor adds |
| `test` | Adding or updating tests |
| `chore` | Build, CI, tooling, dependencies |
| `perf` | Performance improvement |
| `ci` | CI/CD changes |
| `revert` | Reverts a previous commit |

### Examples

```bash
feat(auth): add JWT refresh token rotation
fix(api): handle null response from payment provider
docs(readme): add deployment instructions
refactor(users): extract validation into separate service
test(orders): add edge cases for empty cart
chore(deps): bump fastapi to 0.115.0
ci(actions): add caching for Python dependencies
```

### Rules

- **Subject line under 72 characters**
- **Imperative mood**: "add feature" not "added feature"
- **No period at end** of subject line
- **Body wraps at 72 characters** — explain what and why, not how
- **Breaking changes**: add `!` after type: `feat(api)!: change auth response format`
- **Reference issues**: `Closes #123` or `Fixes #456` in footer

---

## Branching Strategies

### GitHub Flow (Recommended for Most Teams)

```
main (always deployable)
  └── feature/add-auth
  └── fix/payment-timeout
  └── chore/update-deps
```

Simple: branch from main, PR back to main, deploy from main.

- **Best for**: small-medium teams, web apps, continuous deployment
- **Branch from**: `main`
- **Merge via**: Pull request with review
- **Delete after merge**: Always

### Trunk-Based Development (For Experienced Teams)

```
main (everyone commits here)
  └── short-lived feature branches (< 1 day)
```

Everyone commits to main (or very short-lived branches). Requires strong testing and feature flags.

- **Best for**: teams with strong CI/CD, senior developers
- **Requires**: excellent test coverage, feature flags, fast CI pipeline

### Branch Naming

```
feature/add-user-auth
fix/payment-timeout-123
chore/update-deps
docs/api-reference
hotfix/security-patch
release/v2.1.0
```

Pattern: `type/short-kebab-description` or `type/ticket-number-description`

---

## Pull Requests

### Creating PRs with gh CLI

```bash
# Create PR
gh pr create --title "feat(auth): add JWT refresh tokens" --body "## Summary
- Implements refresh token rotation
- Adds token blacklist on logout
- Updates auth middleware

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual test: login → wait → refresh → verify new token"

# Create draft PR
gh pr create --draft --title "WIP: user dashboard"

# Create PR and assign reviewers
gh pr create --title "fix: timeout" --reviewer teammate1,teammate2

# Create PR from current branch
gh pr create --fill  # Auto-fills from commits
```

### PR Best Practices

- **Keep PRs small** — under 400 lines changed. Large PRs get rubber-stamped.
- **One concern per PR** — a bug fix is not a refactor is not a feature
- **Descriptive title** — follows conventional commit format
- **Body has context** — what changed, why, how to test
- **Tests included** — no PR without tests for new functionality
- **Self-review first** — read your own diff before requesting reviews
- **Link issues** — `Closes #123` in the description

### Reviewing PRs

```bash
# List PRs to review
gh pr list --reviewer @me

# Check out a PR locally
gh pr checkout 123

# View PR diff
gh pr diff 123

# Approve
gh pr review 123 --approve --body "Looks good"

# Request changes
gh pr review 123 --request-changes --body "See comments on the auth logic"

# Merge
gh pr merge 123 --squash --delete-branch
```

### Merge Strategies

| Strategy | When | Result |
|----------|------|--------|
| **Squash merge** | Feature branches, clean history | One commit per PR on main |
| **Merge commit** | When full branch history matters | Preserves all commits |
| **Rebase merge** | Linear history purists | Replays commits on main |

**Recommended**: Squash merge for feature/fix branches. Clean main history, easy to bisect.

---

## GitHub CLI (gh) — Essential Commands

### Issues

```bash
gh issue create --title "Bug: login fails" --body "Steps to reproduce..."
gh issue list --state open --assignee @me
gh issue close 123 --comment "Fixed in #456"
gh issue view 123
```

### Repos

```bash
gh repo create myproject --private --clone
gh repo clone org/repo
gh repo view --web  # Open in browser
gh repo fork org/repo --clone
```

### Workflow Runs

```bash
gh run list                        # Recent runs
gh run view 12345                  # Details
gh run watch 12345                 # Live output
gh run rerun 12345                 # Retry failed
gh run download 12345 -n artifact  # Download artifacts
```

### Releases

```bash
gh release create v1.2.0 --title "v1.2.0" --notes "## Changes
- feat: add user dashboard
- fix: payment timeout handling"

gh release create v1.2.0 --generate-notes  # Auto from commits
gh release list
gh release download v1.2.0
```

### Gists, SSH Keys, Secrets

```bash
gh gist create file.py --public --desc "Quick snippet"
gh ssh-key add ~/.ssh/id_ed25519.pub --title "Work laptop"
gh secret set API_KEY --body "sk-..."  # Repo secret
gh secret set API_KEY --org myorg       # Org secret
```

---

## GitHub Actions — CI/CD

### Basic CI Workflow

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

permissions:
  contents: read

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      - name: Install dependencies
        run: |
          pip install uv
          uv sync --frozen

      - name: Lint and type check
        run: |
          uv run ruff check .
          uv run mypy src/

      - name: Test
        run: uv run pytest --cov=src --junitxml=results.xml

      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: test-results
          path: results.xml
```

### Node.js CI

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run type-check
      - run: npm run test -- --run
      - run: npm run build
```

### Deploy with OIDC (No Static Credentials)

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

permissions:
  contents: read
  id-token: write  # Required for OIDC

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4

      - uses: azure/login@v2
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}

      - name: Deploy
        run: |
          az webapp deploy --resource-group myapp-rg \
            --name myapp-api --src-path ./dist
```

**OIDC > static credentials.** No long-lived secrets to rotate. The runner gets a short-lived token per run.

### Reusable Workflows

```yaml
# .github/workflows/reusable-python-ci.yml
name: Python CI (Reusable)

on:
  workflow_call:
    inputs:
      python-version:
        type: string
        default: "3.12"

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: ${{ inputs.python-version }}
      - run: pip install uv && uv sync --frozen
      - run: uv run ruff check . && uv run mypy src/
      - run: uv run pytest
```

```yaml
# .github/workflows/ci.yml (consuming)
jobs:
  python:
    uses: ./.github/workflows/reusable-python-ci.yml
    with:
      python-version: "3.12"
```

### Security Rules

- **Pin actions to full SHA**, not tags: `actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11`
- **Set explicit `permissions:`** on every workflow — least privilege
- **Never use `pull_request_target`** with checkout of PR code — injection risk
- **Use OIDC** for cloud auth, not static credentials
- **Secrets go in GitHub Secrets**, never in workflow files
- **Use `concurrency`** to cancel outdated runs:

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

---

## Branch Protection

Configure on GitHub: Settings → Branches → Branch protection rules.

### Recommended for `main`

- Require pull request before merging
- Require at least 1 approval
- Dismiss stale reviews when new commits pushed
- Require status checks to pass (CI)
- Require branches to be up to date before merging
- Require linear history (squash merge)
- Do not allow force pushes
- Do not allow deletions

```bash
# Set via gh CLI
gh api repos/{owner}/{repo}/branches/main/protection --method PUT \
  --field required_pull_request_reviews='{"required_approving_review_count":1}' \
  --field required_status_checks='{"strict":true,"contexts":["test"]}' \
  --field enforce_admins=true
```

---

## Advanced Git

### Interactive Rebase (Clean Up Before PR)

```bash
# Squash last 5 commits into one
git rebase -i HEAD~5

# In editor: change "pick" to "squash" (or "s") for commits to combine
# First commit stays "pick", rest become "squash"
```

### Cherry-Pick (Selective Commits)

```bash
# Apply specific commit to current branch
git cherry-pick abc1234

# Cherry-pick without committing (stage changes only)
git cherry-pick abc1234 --no-commit

# Cherry-pick a range
git cherry-pick abc1234..def5678
```

### Bisect (Find the Bug Commit)

```bash
git bisect start
git bisect bad                  # Current commit is broken
git bisect good v1.0.0          # This version was fine

# Git checks out a middle commit. Test it, then:
git bisect good   # or
git bisect bad    # Repeat until found

git bisect reset  # Done, return to original state
```

### Stash (Save Work Temporarily)

```bash
git stash                       # Stash changes
git stash -u                    # Include untracked files
git stash push -m "WIP: auth"  # Named stash
git stash list                  # List stashes
git stash pop                   # Apply and remove latest
git stash apply stash@{2}      # Apply specific stash
git stash drop stash@{0}       # Delete specific stash
```

### Worktrees (Multiple Branches Simultaneously)

```bash
# Check out another branch in a separate directory
git worktree add ../myproject-hotfix hotfix/urgent-fix

# Work in both directories simultaneously
# Main branch in ./myproject, hotfix in ../myproject-hotfix

# Clean up when done
git worktree remove ../myproject-hotfix
```

---

## Recovery

### Undo Last Commit (Keep Changes)

```bash
git reset --soft HEAD~1   # Uncommit, keep staged
git reset HEAD~1          # Uncommit, keep unstaged
git reset --hard HEAD~1   # Uncommit, discard changes (DANGEROUS)
```

### Recover Deleted Commits

```bash
# Reflog shows everything — even "deleted" commits
git reflog
# Find the commit hash, then:
git checkout abc1234
# Or create a branch from it:
git branch recovery abc1234
```

### Revert a Merge

```bash
# Safely undo a merged PR (creates new commit)
git revert -m 1 abc1234
```

### Fix a Commit Message

```bash
# Last commit only
git commit --amend -m "fix(auth): correct token expiry check"

# Older commit — interactive rebase
git rebase -i HEAD~3
# Change "pick" to "reword" for the commit to fix
```

---

## .gitignore Essentials

```gitignore
# Dependencies
node_modules/
.venv/
venv/
__pycache__/

# Build output
dist/
build/
*.egg-info/

# Environment & secrets
.env
.env.local
*.pem
credentials.json

# IDE
.vscode/settings.json
.idea/
*.swp

# OS
.DS_Store
Thumbs.db

# Testing & coverage
coverage/
.pytest_cache/
htmlcov/

# Logs
*.log
```

---

## Git Config (Team Recommendations)

```bash
# Identity
git config --global user.name "Your Name"
git config --global user.email "your@email.com"

# Default branch
git config --global init.defaultBranch main

# Pull strategy (rebase instead of merge)
git config --global pull.rebase true

# Auto-prune deleted remote branches
git config --global fetch.prune true

# Better diff algorithm
git config --global diff.algorithm histogram

# Sign commits (recommended for teams)
git config --global commit.gpgsign true
git config --global gpg.format ssh
git config --global user.signingkey ~/.ssh/id_ed25519.pub
```

---

## Quick Reference

```bash
# Daily workflow
git checkout -b feature/my-feature      # New branch
git add -p                               # Stage interactively
git commit -m "feat: add feature"        # Commit
git push -u origin feature/my-feature    # Push
gh pr create --fill                      # Create PR

# Sync with main
git fetch origin
git rebase origin/main                   # Rebase on latest main

# After PR merged
git checkout main
git pull
git branch -d feature/my-feature        # Delete local branch

# Check status
git status
git log --oneline --graph --all -20     # Visual history
git diff --stat                          # Changed files summary
```

---

*Clean history. Small PRs. Conventional commits. Branch protection. These aren't bureaucracy — they're how teams ship safely at speed.*
