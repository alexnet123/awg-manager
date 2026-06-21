# START HERE (EN)

Last updated: 2026-05-28

This page is a quick onboarding guide for any engineer/agent joining development in this repository.

## 1) Mission And Constraints

- Keep external behavior stable (no wire/API breaking changes without explicit approval).
- Develop in the current isolated workspace and current branch.
- Parallel development is the default model (`firewall` and `ipsec` can evolve independently).

Source of truth:
- `AGENTS.md`
- `docs/development/MODULE_MAP.md`
- `docs/development/MODULE_MAP.ru.md`
- `docs/development/REFRACTOR_PROGRESS.ru.md`

## 2) First 5 Minutes Checklist

1. Read `AGENTS.md` fully.
2. Read `docs/development/MODULE_MAP.md` (ownership/boundaries).
3. Run baseline checks:
   - `git branch --show-current`
   - `git status --short`
   - `python3 -m pytest -q tests/test_api_contract.py`
4. Confirm your task scope:
   - `firewall` behavior change
   - `ipsec` structural refactor (feature stream is on hold)
   - legacy compatibility cleanup (`backend/app/legacy_manager_compat.py`)

## 3) Architectural Guardrails

- `backend/app/*` is the only HTTP and error boundary.
- Domain modules are HTTP-neutral.
- Domain-to-domain imports are forbidden.
- Domains may import only `backend/common` and their own package.
- New logic goes to `backend/common` or `backend/domains/*`, not to legacy compatibility modules.

## 4) Definition Of Done (DoD)

A refactor step is done only when all are true:

1. Code changes are complete and scoped.
2. Ownership docs are updated (RU+EN when inside `docs/development/`).
3. `docs/development/REFRACTOR_PROGRESS.ru.md` has a progress entry.
4. Verification commands executed:
   - `python3 -m pytest -q tests/test_firewall_rule_ops.py` (or relevant targeted replacement)
   - `python3 -m pytest -q tests/test_api_contract.py`
   - `python3 -m pytest -q tests`
   - If `backend/app/legacy_manager_compat.py` or `backend/app/manager_facade.py` changed:
     - `python3 -m pytest -q tests/test_manager_access_facade.py`
5. If any check is skipped, reason is documented in the progress note.

## 5) Playbooks

### A) Firewall Change Playbook

1. Locate target code in `backend/domains/firewall/*` and related frontend domain API.
2. Add/update a focused test first when behavior is impacted.
3. Implement minimal change in domain/common layers.
4. Ensure router/wire contract remains unchanged.
5. Run test gate and add progress note.

### B) IPsec Structural Change Playbook (No New Features)

1. Restrict work to structural split/adapter/boundary improvements.
2. Keep `/api/ipsec/*` wire format and statuses stable.
3. Avoid introducing new IPsec behavior in this cycle.
4. Run contract and full test suites.
5. Update module maps and progress log.

### C) `legacy_manager_compat.py` / `manager_facade.py` Playbook

1. Prefer direct domain wiring over new local wrappers.
2. Keep fallback behavior controlled via existing facade patterns.
3. Do not add new business logic into `backend/app/legacy_manager_compat.py`.
4. Run `tests/test_manager_access_facade.py` plus standard gate.
5. Record moved responsibilities in module map and progress log.

## 6) Common Mistakes To Avoid

- Mixing structural refactor and unrelated feature changes in one step.
- Changing API payload shape/status texts accidentally.
- Updating only RU or only EN docs under `docs/development/`.
- Relying on legacy paths when domain-first path already exists.

## 7) Minimal Progress Note Template

Use this in `docs/development/REFRACTOR_PROGRESS.ru.md`:

- Step scope:
- Ownership moved:
- Legacy entrypoint now delegates to:
- Verification commands:
- Result summary:
- Skipped checks and reasons (if any):
