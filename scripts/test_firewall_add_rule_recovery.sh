#!/usr/bin/env bash
set -euo pipefail

API_URL="${API_URL:-http://127.0.0.1:8787}"
API_KEY_FILE="${API_KEY_FILE:-/etc/wg-manager/api.key}"
SERVICE_NAME="${SERVICE_NAME:-awg-manager-api.service}"
RULES_JSON="${RULES_JSON:-/etc/wg-manager/firewall_rules.json}"

if [[ ! -f "$API_KEY_FILE" ]]; then
  echo "API key file not found: $API_KEY_FILE" >&2
  exit 1
fi

API_KEY="$(cat "$API_KEY_FILE")"
TEST_DPORT="${TEST_DPORT:-45454}"
TEST_COMMENT="recovery-test-$(date +%s)"

api() {
  local method="$1"
  local path="$2"
  local data="${3:-}"
  if [[ -n "$data" ]]; then
    curl -sS -X "$method" "$API_URL$path" \
      -H "X-API-Key: $API_KEY" \
      -H "Content-Type: application/json" \
      -d "$data"
  else
    curl -sS -X "$method" "$API_URL$path" \
      -H "X-API-Key: $API_KEY"
  fi
}

cleanup_test_rules() {
  local ids
  ids="$(api GET /firewall | python3 -c 'import sys,json; p=json.load(sys.stdin); 
for r in p.get("item",{}).get("rules",[]):
    c=r.get("comment") or ""
    if c.startswith("recovery-test-"):
        print(r["id"])')"
  if [[ -n "$ids" ]]; then
    while IFS= read -r rid; do
      [[ -z "$rid" ]] && continue
      api DELETE "/firewall/rules/$rid" >/dev/null || true
    done <<< "$ids"
  fi
}

echo "[1/6] cleanup old recovery test rules"
cleanup_test_rules

echo "[2/6] create recovery test rule"
CREATE_RESP="$(api POST /firewall/rules "{\"table\":\"filter\",\"chain\":\"input\",\"action\":\"accept\",\"proto\":\"tcp\",\"dport\":\"$TEST_DPORT\",\"comment\":\"$TEST_COMMENT\",\"enabled\":true}")"
echo "$CREATE_RESP" | python3 -c 'import sys,json; p=json.load(sys.stdin); assert p.get("ok") is True'

echo "[3/6] verify rule in API and json before restart"
api GET /firewall | python3 -c "import sys,json; p=json.load(sys.stdin); assert any((r.get('comment')=='$TEST_COMMENT') for r in p.get('item',{}).get('rules',[]))"
python3 - <<PY
import json
with open("$RULES_JSON","r") as f:
    p=json.load(f)
assert any((r.get("comment")=="$TEST_COMMENT") for r in p.get("rules",[]))
PY

echo "[4/6] restart service"
systemctl restart "$SERVICE_NAME"
sleep 1
systemctl is-active "$SERVICE_NAME" >/dev/null

echo "[5/6] verify rule after restart (API + nft + json)"
api GET /firewall | python3 -c "import sys,json; p=json.load(sys.stdin); assert any((r.get('comment')=='$TEST_COMMENT') for r in p.get('item',{}).get('rules',[]))"
nft list ruleset | grep -q "$TEST_COMMENT"
python3 - <<PY
import json
with open("$RULES_JSON","r") as f:
    p=json.load(f)
assert any((r.get("comment")=="$TEST_COMMENT") for r in p.get("rules",[]))
PY

echo "[6/6] cleanup"
cleanup_test_rules
echo "OK: firewall add-rule recovery (service restart) passed"
