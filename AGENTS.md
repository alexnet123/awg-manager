# AGENTS: Development Rules (RU/EN)

This repository is under active modular refactoring. These rules are mandatory for all contributors and agents.

## 1) Working Mode

- Work in the current isolated workspace and current branch.
- Do not create extra topic branches unless explicitly requested.
- Keep external behavior stable: no wire/API breaking changes unless explicitly approved.
- Repository intent: parallel development is the default mode (`firewall` and `ipsec` streams may evolve independently in isolated workspaces/branches, then converge via integration flow).

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
- Keep UI/UX and existing routes stable during refactoring.
- Structural decomposition is allowed; behavioral changes require explicit approval.

## 4) Documentation Policy (Bilingual)

When moving responsibilities between files/modules, update documentation in the same change:

- English map: `docs/development/MODULE_MAP.md`
- Russian map: `docs/development/MODULE_MAP.ru.md`
- Refactor progress log: `docs/REFRACTOR_PROGRESS.ru.md`

Minimum update requirement per refactor step:

1. New module/function ownership (what moved where).
2. Which old entrypoint delegates to the new module.
3. Verification commands and result summary.

## 5) Test Gate

For backend refactor steps, run at least:

1. `python3 -m pytest -q tests/test_firewall_rule_ops.py` (or relevant targeted test)
2. `python3 -m pytest -q tests/test_api_contract.py`
3. `python3 -m pytest -q tests`
4. If `backend/app/legacy_manager_compat.py` or `backend/app/manager_facade.py` is changed: `python3 -m pytest -q tests/test_manager_access_facade.py`

If any test is skipped, explicitly document why.

## 6) Language Rule

- Development documentation under `docs/development/` must be maintained in two files: RU and EN.
- Keep both versions semantically aligned.

## 7) Rename Completion Note (`interfaces_clients` -> `awg`)

Rename has been completed as a dedicated structural changeset.

1. All backend imports must use `backend.domains.awg`.
2. Legacy references to `interfaces_clients` are allowed only in historical progress text.
3. Any residual alias/back-compat shim for the old path requires explicit approval.

## 8) Stand Strategy And Final Deployment

- During development/refactor, temporary multi-instance validation setups are allowed.
- Final acceptance target is a single stand.
- After all changes are pushed and approved for release:
  1. Clean the stand state (services/runtime/data as agreed for release procedure).
  2. Deploy code from `main` only (no ad-hoc local snapshot).
  3. Run release verification on that single stand.
- Dual-port smoke (`:8787` + `:8788`) is not a mandatory release gate; it is optional diagnostic tooling.
