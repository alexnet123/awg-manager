# Firewall Add Rule - Hard Test Plan

## Scope
- UI modal: `Add Firewall Rule`
- API layer for rule creation/update
- Runtime apply in nftables (`nft list ruleset`)
- Persistence/reload behavior

## Goals
- Catch invalid rule combinations before apply.
- Prevent silent partial-save states.
- Ensure UI, API, persisted JSON, and runtime nft stay consistent.
- Prove stability under repeated/parallel user actions.
- Finish and validate all currently partial/planned fields in Add Rule modal.
- Reach full functional completeness for all supported parameters across `filter`, `nat`, `raw`, `mangle`.

## Test Environment
- Server with active AWG Manager API + Web UI
- nftables enabled
- Playwright e2e + API checks
- Access to:
  - `/firewall/rules` API
  - `nft list ruleset`
  - `/etc/wg-manager/firewall_rules.json`

## Severity Levels
- P0: can break connectivity / lock out admin / corrupt runtime rules
- P1: wrong rule semantics, wrong chain/table behavior
- P2: UI/UX regressions that can mislead user

## Phase A - Base Validation (P0/P1)
1. Required fields:
- empty chain/action should be blocked
- invalid table/chain combo should be rejected

2. IP and subnet formats:
- invalid CIDR (`10.0.0.0/99`) rejected
- invalid IP token (`300.1.1.1`) rejected
- mixed invalid list item should reject full field

3. Ports:
- non-numeric, negative, >65535 rejected
- bad ranges (`200-100`) rejected
- malformed list (`22,,80`) rejected

4. Protocol coupling:
- sport/dport with protocol `any` behavior verified by spec
- ICMP + TCP-only fields should reject or be ignored consistently

## Phase B - Context Rules by Table/Chain (P0/P1)
1. `filter`:
- input/forward/output rule creation matrix
- in/out interface visibility and behavior by chain

2. `nat`:
- verify allowed nat actions by chain:
  - prerouting/output: dnat, redirect
  - postrouting: snat, masquerade
- forbidden action-chain combinations must fail with clear error

3. `raw`:
- `notrack` behavior only in allowed contexts
- ensure unsupported action combos are blocked

4. `mangle`:
- mark/ct mark set behavior
- invalid mark expression rejected

## Phase C - Advanced Fields (P1)
1. Conntrack state:
- each state value valid
- multi-state combinations valid only where supported

2. Logging:
- log level enum validation
- prefix length/charset constraints
- enabling/disabling log fields must not leave stale payload

3. Counter:
- rule with `counter` should show packet/byte growth in runtime
- without counter should stay zero / unavailable (per design)

4. Limit rate:
- valid formats accepted
- invalid rate expressions rejected

5. Raw expression and debug fields:
- `fib_expr`, `socket_expr`, `rt_expr`, `exthdr_expr` can be entered and saved
- invalid expressions rejected with clear server message
- valid expressions appear in nft runtime in expected form

6. Conntrack helpers/timeouts/expectations:
- `ct_helper_set`, `ct_timeout_set`, `ct_expectation_set` can be saved
- unsupported context usage rejected (by chain/table support)
- no silent drop of these fields in API payload or persistence

## Phase D - Modal UX Integrity (P1/P2)
1. Add/Cancel:
- Cancel never persists draft
- Add closes modal only on success
- modal stays open on API error with visible reason

2. Prevent duplicate submits:
- double-click Add sends one effective create
- Add disabled while request in-flight

3. Tab switching inside modal:
- Base/Advanced/Action/Statistics does not reset unrelated fields
- hidden field values are not accidentally dropped

4. Overlay behavior:
- no invisible modal layer blocking table clicks after close

5. Planned/inactive fields workflow:
- `+` enables field and injects valid default
- `-` disables field and removes payload key
- disabled field values must not leak into submitted request
- re-enable preserves/doesn’t preserve old value per defined spec (must be deterministic)

## Phase E - API and Runtime Consistency (P0/P1)
For every successful Add:
1. UI row appears in correct table tab.
2. `/firewall/rules` returns matching rule payload.
3. `/etc/wg-manager/firewall_rules.json` contains same rule.
4. `nft list ruleset` contains semantically equivalent runtime rule.

For every rejected Add:
1. No new UI row.
2. No new API item.
3. No JSON change.
4. No runtime nft change.

For each supported field key (full payload coverage):
1. UI edit -> API payload contains expected key/value.
2. API value -> persisted JSON keeps exact semantic value.
3. persisted JSON -> runtime nft includes equivalent expression.
4. GET endpoints return same effective value after refresh/restart.

## Phase F - Race and Stress (P0/P1)
1. Rapid Add spam (20 clicks):
- exactly one rule created.

2. Parallel creation (same payload, 5 requests):
- dedup or deterministic conflict behavior.

3. Parallel creation (different payloads):
- all valid rules created without corruption/order loss.

4. Large config:
- add 100+ rules; modal remains usable; save latency acceptable.

5. Field fuzz for hardening:
- random valid/invalid values for src/dst/ports/state/marks/log/limit/raw-expr
- assert: invalid rejected safely, valid accepted consistently

## Phase G - Recovery / Restart (P0)
1. Add several complex rules.
2. Restart `awg-manager-api.service`.
3. Reboot server.
4. Verify rules restored:
- UI
- API
- persisted JSON
- runtime nft

## Phase H - Full Parameter Completion (P0/P1)
This phase is mandatory before considering Add Rule "done".

1. Build field inventory from code + docs:
- all UI fields in Base/Advanced/Action/Statistics tabs
- all API fields accepted by backend schema
- all nft-supported expressions targeted by product scope

2. Mark each field status:
- `implemented+tested`
- `implemented+untested`
- `ui-only (not wired)`
- `api-only (not exposed in UI)`
- `unsupported by design`

3. For each non-complete field:
- define expected behavior by table/chain
- implement missing wiring (UI -> API -> core -> nft)
- add positive + negative + persistence tests

4. Completion rule:
- no `ui-only` / `implemented+untested` fields left in Add Rule scope
- every visible field has deterministic validation and runtime mapping

## Cross-Table Coverage Matrix (Mandatory)
For each field, execute tests where applicable:
- `filter`: input/forward/output
- `nat`: prerouting/input/output/postrouting
- `raw`: prerouting/output
- `mangle`: prerouting/input/forward/output/postrouting

Expected outcome:
- field is either fully functional in allowed contexts, or explicitly blocked with clear error in disallowed contexts.

## Automation Matrix
- `firewall-rules.spec.ts`:
  - stable smoke path (rules + sets)
- `firewall-maps.spec.ts`:
  - map lifecycle stability
- `firewall-tables.spec.ts`:
  - table chain lifecycle + API verification
- new strict suite to add:
  - `firewall-add-rule-validation.spec.ts`
  - `firewall-add-rule-context.spec.ts`
  - `firewall-add-rule-fields-completeness.spec.ts`
  - `firewall-add-rule-negative-fuzz.spec.ts`
  - `firewall-add-rule-race.spec.ts`
  - `firewall-add-rule-recovery.spec.ts`

## Acceptance Criteria
- 0 open P0 issues
- 0 open P1 issues in add-rule path
- e2e suite pass rate >= 95% on 10 consecutive runs
- no divergence between UI/API/JSON/nft in validation checks
- all visible Add Rule fields classified as `implemented+tested` or explicitly `unsupported by design`
- Add Rule works functionally across all supported tables/chains

## Exit Checklist
- [x] Negative validation coverage complete
- [x] Table/chain context coverage complete
- [x] All Add Rule fields wired and verified end-to-end
- [x] Runtime consistency checks implemented
- [x] Race/retry protections verified
- [x] Recovery after restart/reboot verified

## Current Run Status (2026-05-14)
- Strict suite files are in place and actively used:
  - `firewall-add-rule-validation.spec.ts`
  - `firewall-add-rule-context.spec.ts`
  - `firewall-add-rule-fields-completeness.spec.ts`
  - `firewall-add-rule-negative-fuzz.spec.ts`
  - `firewall-add-rule-race.spec.ts`
  - `firewall-add-rule-runtime-fields.spec.ts`
- Full run on server showed infra flakiness (`browserContext.newPage` timeout) under normal mode.
- Re-run in low-memory browser mode passed cleanly:
  - command profile: `PLAYWRIGHT_LOW_MEM=1`
  - result: 9/9 for previously failed block.
- Recovery checks completed:
  - service restart recovery script: `scripts/test_firewall_add_rule_recovery.sh` passed
  - reboot recovery validated manually (rule persisted + restored in runtime)
- Runtime equivalence block completed:
  - `firewall-add-rule-nft-equivalence.spec.ts` verifies API payload → `nft list ruleset` canonical expression match for `filter`, `mangle`, `nat`, plus disabled-rule non-application.
- Consolidated strict suite run completed on server:
  - command: `PLAYWRIGHT_LOW_MEM=1 npx playwright test tests/firewall-add-rule-*.spec.ts`
  - result: `27 passed (35.0s)`

## Practical CI/Server Recommendation
- For low-RAM VPS test agents, run Playwright with:
  - `PLAYWRIGHT_LOW_MEM=1`
  - single worker (`--workers=1` if needed)
- Keep suite timeout at `60s` (in `webui/playwright.config.ts`) for long firewall runs on small VPS.
- This avoids false negatives from Chromium page-creation timeouts.

## Update (2026-05-15)
- During consolidated `46-test` run, two tests timed out at the old `30s` global limit while passing in isolated reruns.
- This is tracked as infra timing under load (not functional regression).
- Mitigation applied: Playwright global timeout increased to `60s`, expect timeout to `15s`.

## Next Iteration (Planned Controls Activation)
After baseline hardening completion, the next cycle focuses on fields currently marked `planned`.

Execution order:
1. Block A:
- raw expression
- nftrace
- advanced notrack

2. Block B:
- tcp/icmp/icmpv6 detailed matchers
- meta extended match subset
- conntrack extended match subset

3. Block C:
- L2 matchers (vlan / ether src/dst/type)

For each block:
- implement UI wiring
- add backend validation/schema mapping
- add runtime nft renderer mapping
- add strict E2E (positive + negative + toggle semantics + runtime equivalence)
- update EN/RU guides with examples

Current status:
- Block A implemented and verified (`firewall-add-rule-block-a.spec.ts`, plus full add-rule consolidated run green).
- Block B subset implemented and verified (`firewall-add-rule-block-b.spec.ts`):
  - done: `tcp_flags`, `icmp_type`, `icmp_code`, `icmpv6_type`, `icmpv6_code`, `meta_length`, `ct_status`
  - plus extended subset done:
    - `meta_priority`, `meta_cpu`, `ct_direction`, `ct_expiration` (`firewall-add-rule-block-b2.spec.ts`)
    - `meta_pkttype`, `meta_iifgroup`, `meta_oifgroup` (`firewall-add-rule-block-b3.spec.ts`)
  - pending in Block B: remaining meta/conntrack extended fields (`iiftype/oiftype`, ct helper/label/event, etc.)
