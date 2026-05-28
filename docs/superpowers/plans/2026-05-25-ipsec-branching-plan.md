# IPsec Single-Branch Delivery Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver all IPsec work in one isolated branch (`codex-ipsec-ui-start`) without creating extra IPsec topic branches.

**Architecture:** Keep all IPsec changes in `codex-ipsec-ui-start` inside the dedicated IPsec worktree. Validate incrementally on the IPsec stand and merge to `dev` once the stream is stable.

**Tech Stack:** Git worktrees/branches, Python backend (`api_core.py`, `ipsec_api.py`), React UI (`webui/src/pages/*`), Playwright tests, docs in `docs/`.

---

### Task 1: Confirm Isolated Workspace and Baseline

**Files:**
- Modify: none
- Test: git baseline checks

- [ ] **Step 1: Confirm we are in an isolated worktree**

Run:
```bash
GIT_DIR=$(cd "$(git rev-parse --git-dir)" 2>/dev/null && pwd -P)
GIT_COMMON=$(cd "$(git rev-parse --git-common-dir)" 2>/dev/null && pwd -P)
git rev-parse --show-superproject-working-tree 2>/dev/null || true
printf "GIT_DIR=%s\nGIT_COMMON=%s\n" "$GIT_DIR" "$GIT_COMMON"
```
Expected: `GIT_DIR` path differs from `GIT_COMMON`, and superproject path is empty.

- [ ] **Step 2: Confirm branch and clean status**

Run:
```bash
git branch --show-current
git status --short
```
Expected: current branch `codex-ipsec-ui-start`, status empty.

### Task 2: Define Single-Branch Boundaries

**Files:**
- Create: none
- Modify: none
- Test: scope/boundary review

- [ ] **Step 1: Freeze branch model**

Branch model:
```text
only one delivery branch: codex-ipsec-ui-start
no extra codex-ipsec-* topic branches
```

- [ ] **Step 2: Define change boundaries inside the same branch**

Boundary rules:
```text
allow only IPsec-related files and behaviors
do not include firewall feature/refactor changes
keep commits narrow by concern (runtime/api/ui/tests/docs)
```
Expected: each commit has one clear purpose and remains IPsec-only.

- [ ] **Step 3: Define commit order**

Order:
```text
1) runtime/api prerequisites
2) UI workflows
3) observability
4) tests/docs
5) codex-ipsec-ui-start -> dev
```
Expected: incremental stability while staying in one branch.

### Task 3: Keep Branch Synced with `dev`

**Files:**
- Modify: git refs only
- Test: sync/rebase checks

- [ ] **Step 1: Sync branch with `dev` regularly**

Run:
```bash
git fetch origin
git checkout codex-ipsec-ui-start
git rebase origin/dev
```
Expected: rebase completes without conflicts.

- [ ] **Step 2: Keep commit slices small**

Run before commit:
```bash
git status --short
git diff --name-only --cached
```
Expected: staged set is small and IPsec-only.

### Task 4: Delivery Policy in the Same Branch

**Files:**
- Modify: feature files in branch scope
- Test: targeted validation

- [ ] **Step 1: Work in small TDD slices**

Run per slice:
```bash
# example test command (choose target for current change)
pytest -q
# or
cd webui && npm run build
```
Expected: each slice has passing targeted checks before commit.

- [ ] **Step 2: Guard against firewall leakage**

Run before every commit:
```bash
git diff --name-only --cached
```
Expected: no firewall-only files/components are included.

- [ ] **Step 3: Rebase on latest `dev` before final integration**

Run:
```bash
git fetch origin
git checkout codex-ipsec-ui-start
git rebase origin/dev
```
Expected: clean linear history for merge into `dev`.

### Task 5: IPsec Stand Gate and Final Integration to `dev`

**Files:**
- Modify: none
- Test: stand verification + merge checks

- [ ] **Step 1: Run IPsec stand smoke set at key checkpoints**

Run against IPsec stand:
```bash
curl -sS -H "X-API-Key: $API_KEY" http://127.0.0.1:8788/api/ipsec/peers
curl -sS -H "X-API-Key: $API_KEY" http://127.0.0.1:8788/api/ipsec/active-peers
curl -sS http://127.0.0.1:8788/ui/ | head -n 5
```
Expected: API responds 200 and UI endpoint serves content.

- [ ] **Step 2: Run branch-final test bundle**

Run:
```bash
pytest -q
cd webui && npm run build
```
Expected: tests/build pass on final branch state.

- [ ] **Step 3: Merge to `dev` from the same branch**

Run:
```bash
git checkout dev
git pull --ff-only origin dev
git merge --no-ff codex-ipsec-ui-start
```
Expected: one controlled integration point for the full IPsec stream.

- [ ] **Step 4: Commit integration notes**

Update docs:
```text
docs/REFRACTOR_PROGRESS.ru.md
docs/PARALLEL_DEVELOPMENT.md (if process changed)
```
Expected: delivery and stand verification are documented.
