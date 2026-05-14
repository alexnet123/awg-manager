# Firewall UI Test Plan (Hard Mode)

## Goal
- Validate every firewall UI action end-to-end.
- Confirm each UI operation is reflected in:
  1. API response
  2. persistence files (`/etc/wg-manager/firewall_*.json`)
  3. runtime nftables (`nft list ruleset`)

## Scope
- Tabs: `filter`, `nat`, `raw`, `mangle`, `sets`, `maps`, `tables`.
- Actions: create, edit, delete, enable/disable, reorder, counters, validation errors.
- Recovery: service restart, server reboot.

## Environments
- Test server: `root@132.243.237.120`
- API: `http://127.0.0.1:8787`
- UI: main deployed web UI on test stand.

## Required Access
- API key: `/etc/wg-manager/api.key`
- Encryption key (if needed by endpoint): `/etc/wg-manager/encryption.key`
- Runtime checks: root shell for `nft`, `journalctl`, file checks.

## Golden Rules
- Every test has asserts in 3 layers: UI + API + NFT.
- After every negative test, verify no partial runtime changes were applied.
- No silent pass: each test must have explicit expected output.

## Pre-Test Reset
1. Backup current state.
2. Clear custom firewall entities (rules/sets/maps/custom tables) using API.
3. Apply firewall and confirm clean baseline:
   - `POST /firewall/apply` returns `200`.
   - `nft list ruleset` contains only expected baseline chains/rules.
4. Start log tail:
   - `journalctl -u awg-manager-api.service -f`

## Test Matrix

### A. Rules Tabs (`filter/nat/raw/mangle`)
1. Create valid rule from UI.
2. Edit rule fields (proto, ports, interface, ct state, action).
3. Disable/Enable rule.
4. Delete rule.
5. Reorder rules via drag/drop.
6. Counter on/off and reset counters.
7. Invalid combinations:
   - wrong chain/hook context
   - malformed IP/port values
   - unsupported action in table context

### B. Sets Tab
1. Create `addr`, `port`, `iface` sets.
2. Edit elements and comment.
3. Disable/Enable set.
4. Delete set.
5. Duplicate name rejection.
6. Verify disabled set is not active in runtime matching.

### C. Maps Tab
1. Create `map` and `vmap`.
2. Edit entries.
3. Disable/Enable map.
4. Delete map.
5. Validation:
   - malformed `key:value`
   - duplicate names
   - subnet map handling (`flags interval`)
   - long/invalid token types

### D. Tables Tab
1. Confirm built-in rows exist and are not deletable.
2. Create custom table+chain.
3. Validate reserved priorities reject:
   - `-300`, `-150`, `-100`, `0`, `100`.
4. Delete custom table row.
5. Duplicate `(table, chain, hook, priority)` rejection.

### E. Stability / Race
1. Double-click Add/Delete buttons.
2. Rapid repeated create requests from UI.
3. Parallel create attempts for identical entities.
4. Confirm no duplicate/partial corruption.

### F. Recovery
1. Restart service:
   - `systemctl restart awg-manager-api.service`
   - confirm state restored and matches UI/API/NFT.
2. Reboot server:
   - after boot, same parity checks.

## Assertions Template (for each test)
1. UI assert:
   - expected row/state visible.
2. API assert:
   - endpoint returns expected payload/status.
3. File assert:
   - relevant object in `/etc/wg-manager/firewall_*.json`.
4. NFT assert:
   - expected chain/set/map/rule present or absent.
5. Log assert:
   - no unexpected traceback/errors.

## Suggested Automation Split
- Playwright (`webui/tests/firewall-*.spec.ts`):
  - UI flows, button behavior, form validation, race-click scenarios.
- Python API tests (`tests/test_firewall_api.py`):
  - strict status/payload checks and negative validation.
- Runtime verifier script:
  - parse `nft -j list ruleset` and assert expected entities.

## Pass Criteria
- 100% green for all mandatory matrix tests.
- 0 critical mismatches between UI/API/NFT.
- Recovery tests pass after restart and reboot.

## Working Mode (How we use this)
- We execute tests by sections: A -> B -> C -> D -> E -> F.
- We do not move to next section until current section is green.
- Every failure gets:
  - issue ID
  - repro steps
  - fix commit
  - re-test evidence.
