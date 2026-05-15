# Add Firewall Rule - Next Implementation Plan

Status: post-hardening baseline completed (strict E2E green).

## Goal
Finish all currently `planned` parts of Add Firewall Rule modal and ensure:
- each visible control is functional,
- each control has deterministic validation,
- each supported field maps correctly to runtime nft,
- docs (EN/RU) explain practical usage.

## Phase 1 - “Not opening / not working” fixes (stability first)
1. Reproduce and fix all UI controls that do not open/expand reliably.
2. Normalize modal section state (collapsed/expanded) so tests and users get deterministic behavior.
3. Add resilient selectors/ids for automation-critical controls.
4. Re-run smoke and strict suites after each fix.

Deliverable:
- zero known “button clicked but section/modal did not open” regressions.

## Phase 2 - Planned fields block A (high value, lower risk)
Scope:
- `raw expression` (free-form)
- `nftrace` toggle
- advanced `notrack` toggle (raw-table constrained)

Work:
1. UI wiring for these fields.
2. API schema and normalization in backend.
3. Runtime renderer mapping to nft syntax.
4. Validation by table/chain context.
5. Positive/negative E2E + runtime equivalence tests.

## Phase 3 - Planned fields block B (match extensions)
Scope:
- tcp flags / icmp / icmpv6 detailed matchers
- meta extended fields (length/priority/pkttype/cpu/...)
- conntrack extended fields (direction/status/labels/...)

Work:
1. Start with a minimal supported subset (documented) instead of “all at once”.
2. Implement explicit unsupported-path errors for not-yet-wired fields.
3. Add docs examples per matcher.

## Phase 4 - Planned fields block C (L2)
Scope:
- vlan, ether src/dst/type

Work:
1. Enable only where nft context supports it.
2. Add strict validation and runtime mapping checks.

## Documentation Workstream (parallel)
1. EN guide: all current controls, examples, constraints, troubleshooting.
2. RU guide: equivalent content for operators/users.
3. Keep docs aligned to real shipped behavior (no speculative fields marked as working).

## Test Workstream Update
For each phase above:
1. Add field-level E2E create/edit/disable checks.
2. Add API negative tests for invalid combinations.
3. Add runtime equivalence assertions (`/firewall.ruleset` + `nft list ruleset`).
4. Add recovery checks (service restart, optional reboot).

## Exit Criteria for “Add Rule Complete”
1. No visible `planned` control left without explicit “unsupported by design” status.
2. Full strict Add Rule suite green on target server profile.
3. EN/RU guides cover all active controls with examples.
4. Pre-release checklist passes end-to-end.
