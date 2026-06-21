# Bilingual Development Documentation Design

Date: 2026-05-26
Status: Implemented

## Goal

Create stable developer-facing documentation that explains module boundaries and function ownership in both Russian and English, without changing runtime behavior.

## Scope

- Add a repository-level contributor/agent contract file (`AGENTS.md`).
- Add a dedicated development docs folder (`docs/development/`).
- Add bilingual module maps with backend/frontend ownership and key function responsibilities.
- Link new docs from existing documentation entrypoints.

## Decisions

1. Keep docs lightweight and operational (module ownership + update rules), not architecture-theory heavy.
2. Maintain RU and EN as separate files with semantic parity.
3. Make docs updates part of each refactor step via explicit rule in `AGENTS.md`.

## Deliverables

- `AGENTS.md`
- `docs/development/README.md`
- `docs/development/MODULE_MAP.md`
- `docs/development/MODULE_MAP.ru.md`
- Link updates in:
  - `docs/README.md`
  - `docs/archive/DOCS_INDEX.ru.md`
  - `README.md`
  - `README.ru.md`
  - `docs/development/REFRACTOR_PROGRESS.ru.md`

## Acceptance Criteria

1. A newcomer can locate module ownership docs from top-level README and docs index.
2. RU/EN versions exist and cover the same boundaries.
3. Refactor contributors have explicit rule to keep docs in sync with code moves.
