# Pre-Release Checklist (Web UI + API)

Use this checklist before pushing a release build.

## 1) Environment sanity
- API service is active:
  - `systemctl status awg-manager-api.service --no-pager`
- API key exists:
  - `cat /etc/wg-manager/api.key`

## 2) Strict Add Rule suite
Run on low-RAM hosts with low-memory browser profile:

```bash
cd /root/awg-manager/webui
PLAYWRIGHT_API_KEY=$(cat /etc/wg-manager/api.key) \
PLAYWRIGHT_BASE_URL=http://127.0.0.1:8787/ui/ \
PLAYWRIGHT_LOW_MEM=1 \
npx playwright test tests/firewall-add-rule-*.spec.ts --reporter=list
```

Expected: all tests pass.

## 3) Release-readiness smoke pack
Run cross-area smoke set (firewall + interfaces + clients):

```bash
cd /root/awg-manager/webui
PLAYWRIGHT_API_KEY=$(cat /etc/wg-manager/api.key) \
PLAYWRIGHT_BASE_URL=http://127.0.0.1:8787/ui/ \
PLAYWRIGHT_LOW_MEM=1 \
npx playwright test \
  tests/firewall-rules.spec.ts \
  tests/firewall-maps.spec.ts \
  tests/firewall-tables.spec.ts \
  tests/interfaces-form.spec.ts \
  tests/interfaces-edge.spec.ts \
  tests/clients-edge.spec.ts \
  --reporter=list
```

Expected: all tests pass.

## 4) Recovery checks
- Service restart:
  - `bash /root/awg-manager/scripts/test_firewall_add_rule_recovery.sh`
- Optional reboot validation:
  - reboot host
  - verify `/firewall`, `nft list ruleset`, and persisted files stay consistent

## 5) Manual spot checks
- Login/logout and API key auth
- Create/edit/delete one interface (v1 and v2)
- Create/edit/delete one client and download `.conf`
- Open firewall Add Rule modal and verify tabs: Base / Advanced / Action / Statistics

## Notes
- If Chromium page allocation flakes on small VPS, keep `PLAYWRIGHT_LOW_MEM=1` and run with a single worker.
- `firewall-rules.spec.ts` now covers rules flow only; sets behavior is validated through dedicated firewall sets/maps/table suites and API checks.
