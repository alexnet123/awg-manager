# AGENTS: Development Rules (RU/EN)

This repository is under active modular refactoring. These rules are mandatory for all contributors and agents.

## 0) Mandatory Read Order

Before changing code or documentation, read only the relevant mandatory context:

1. `AGENTS.md`
2. `docs/development/START_HERE.md`
3. `docs/development/START_HERE.ru.md` when Russian development context is needed
4. `docs/development/MODULE_MAP.md`
5. `docs/development/MODULE_MAP.ru.md`
6. `docs/agents/PRODUCT_UI.ru.md`
7. `docs/agents/MODULE_WORKFLOW.ru.md`
8. `docs/agents/DOCUMENTATION_POLICY.ru.md`
9. The current task, issue, or user request

Do not read all of `docs/` by default. Open large references only when they are relevant to the current task.

## 1) Working Mode

- Work in the current isolated workspace and current branch.
- Do not create extra topic branches unless explicitly requested.
- One task should have one responsible agent and one assigned workspace/worktree.
- Do not change a neighboring module "while you are there".
- Keep external behavior stable: no wire/API breaking changes unless explicitly approved.
- Repository intent: parallel development is the default mode (`firewall` and `ipsec` streams may evolve independently in isolated workspaces/branches, then converge via integration flow).
- Before coding, find the closest implemented analogue and list the expected changed files in the response or PR. Do not create a separate plan file unless explicitly requested.

## 2) Backend Boundaries

- `backend/app/*` is the only HTTP routing/error boundary.
- `backend/app/manager_facade.py` is a compatibility facade and must stay backend-first.
- Domain modules (`backend/domains/firewall`, `backend/domains/ipsec`, `backend/domains/awg`) must be HTTP-neutral.
- Domain-to-domain imports are forbidden. Domains may import only `backend/common` and their own package.
- `awg_core.py` is removed. Legacy runtime compatibility is provided by `backend/app/legacy_manager_compat.py`.
- For refactor steps touching `backend/app/legacy_manager_compat.py` or `manager_facade.py`, prefer direct domain wiring over local wrapper helpers when signatures stay stable.
- Private helper bridging from facade to removed `awg_core` paths is not allowed for new code paths; use domain modules first, keep fallback only via public service wrappers.
- Naming decision completed: canonical backend domain name is `backend/domains/awg` (former transitional name `backend/domains/interfaces_clients` is retired).
- Rename stability rule: do not reintroduce `backend/domains/interfaces_clients`; all new code/imports must use `backend/domains/awg`.

## 3) Frontend Boundaries

- Use domain API clients in `webui/src/frontend/domains/*/api.ts`.
- Put pages under `webui/src/pages`; decompose complex pages under `webui/src/pages/<domain>/` when needed.
- Reuse components from `webui/src/components/ui`.
- Do not introduce a second UI library or a new base component if the existing component set solves the task.
- Keep UI/UX and existing routes stable during refactoring.
- Structural decomposition is allowed; behavioral changes require explicit approval.
- Do not rework `App.tsx`, the sidebar, theme, or global layout for one module unless explicitly approved.
- After frontend changes, run a production build and update committed `webui/dist`.

## 4) Product UI

- The primary user is a network administrator.
- Screens must be predictable, compact, readable, and consistent with the closest existing screen.
- A new screen should have one obvious primary operation.
- Rare or dangerous parameters belong in `Advanced` unless hiding them would hide critical state.
- `Save`, `Apply`, `Start`, `Stop`, `Restore`, and similar actions must describe their real effect. Do not call a storage-only write "Apply".
- Show errors near the action context and keep entered data when it is safe.
- Dangerous deletes and resets require explicit confirmation.
- Before handoff, the agent checks spacing, labels, disabled/loading/error/success states, and consistency with the accepted UI pattern.
- Product owner QA should focus on subjective product direction, not basic correctness. Final handoff may include up to three subjective questions in `What the product owner should evaluate`.

Details: `docs/agents/PRODUCT_UI.ru.md`.

## 5) New Feature / Module Standard

Before implementation, define:

1. the closest existing backend and frontend analogue;
2. scope and out-of-scope;
3. stored desired configuration versus runtime side effects;
4. API contract;
5. expected changed files;
6. automated checks;
7. which canonical document will be updated.

During implementation:

- change the minimum necessary file set;
- do not add capabilities outside the accepted scope;
- do not create temporary architecture, plan, progress, report, or notes `.md` files;
- when a product decision is ambiguous, choose the conservative option or ask the owner no more than two options with a recommendation.

Details: `docs/agents/MODULE_WORKFLOW.ru.md`.

## 6) Documentation Policy (Bilingual)

When moving responsibilities between files/modules, update documentation in the same change:

- English map: `docs/development/MODULE_MAP.md`
- Russian map: `docs/development/MODULE_MAP.ru.md`
- Refactor progress log: `docs/REFRACTOR_PROGRESS.ru.md`

Minimum update requirement per refactor step:

1. New module/function ownership (what moved where).
2. Which old entrypoint delegates to the new module.
3. Verification commands and result summary.

Agents must not create new permanent Markdown files without need. Update the existing canonical document first.

Forbidden without explicit request or a clear canonical need:

- `*_PLAN.md`
- `*_REPORT.md`
- `*_NOTES.md`
- `*_BUGLIST.md`
- `*_PROGRESS.md`
- `*_FINAL.md`
- `*_NEW.md`
- `*_UPDATED.md`
- `*_V2.md`

Task plans, temporary notes, and one-off test results belong in the issue/PR/chat or ignored `tasks/active`, not permanent docs.

New permanent docs must be linked from `docs/README.md`.

Details: `docs/agents/DOCUMENTATION_POLICY.ru.md`.

## 7) Test Gate

For backend refactor steps, run at least:

1. `python3 -m pytest -q tests/test_firewall_rule_ops.py` (or relevant targeted test)
2. `python3 -m pytest -q tests/test_api_contract.py`
3. `python3 -m pytest -q tests`
4. If `backend/app/legacy_manager_compat.py` or `backend/app/manager_facade.py` is changed: `python3 -m pytest -q tests/test_manager_access_facade.py`

For frontend changes, run at least:

1. `cd webui && npm run build`
2. the relevant Playwright test
3. broader `npm run test:e2e` when the change touches global layout, routing, auth, or shared API clients

If any test is skipped, explicitly document why.

Never claim tests passed without the exact command and factual result.

## 8) Language Rule

- Development documentation under `docs/development/` must be maintained in two files: RU and EN.
- Keep both versions semantically aligned.

## 9) Rename Completion Note (`interfaces_clients` -> `awg`)

Rename has been completed as a dedicated structural changeset.

1. All backend imports must use `backend.domains.awg`.
2. Legacy references to `interfaces_clients` are allowed only in historical progress text.
3. Any residual alias/back-compat shim for the old path requires explicit approval.

## 10) Result Handoff

Final response or PR description must include:

1. what changed;
2. key changed files;
3. added or changed endpoints, or `API не менялся`;
4. test commands and factual results;
5. stand address/profile if deployed;
6. known limitations;
7. `What the product owner should evaluate` / `Что должен оценить владелец продукта` with zero to three subjective points.

Do not commit a separate report file for this handoff.

Template: `tasks/RESULT_TEMPLATE.md`.

## 11) Stand Strategy And Final Deployment

- During development/refactor, temporary multi-instance validation setups are allowed.
- Final acceptance target is a single stand.
- After all changes are pushed and approved for release:
  1. Clean the stand state (services/runtime/data as agreed for release procedure).
  2. Deploy code from `main` only (no ad-hoc local snapshot).
  3. Run release verification on that single stand.
- Dual-port smoke (`:8787` + `:8788`) is not a mandatory release gate; it is optional diagnostic tooling.
