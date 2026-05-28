#!/usr/bin/env bash
set -euo pipefail

# IPsec stand smoke for AWG Manager.
#
# Required env:
#   AWG_API_URL   (example: http://127.0.0.1:8788)
#   AWG_API_KEY   (API key for X-API-Key)
#
# Optional env:
#   IPSEC_SMOKE_PREFIX (resource name prefix, default: smoke)

AWG_API_URL="${AWG_API_URL:-}"
AWG_API_KEY="${AWG_API_KEY:-}"
IPSEC_SMOKE_PREFIX="${IPSEC_SMOKE_PREFIX:-smoke}"

if [[ -z "$AWG_API_URL" || -z "$AWG_API_KEY" ]]; then
  echo "ERROR: AWG_API_URL and AWG_API_KEY are required"
  echo "Example: AWG_API_URL=http://127.0.0.1:8788 AWG_API_KEY=... $0"
  exit 1
fi

P1_NAME="${IPSEC_SMOKE_PREFIX}-p1"
P2_NAME="${IPSEC_SMOKE_PREFIX}-p2"
PEER_NAME="${IPSEC_SMOKE_PREFIX}-peer"
POLICY_NAME="${IPSEC_SMOKE_PREFIX}-policy"

api_json() {
  local method="$1"
  local path="$2"
  local body="${3:-}"
  if [[ -n "$body" ]]; then
    curl -sS -X "$method" "$AWG_API_URL$path" \
      -H "X-API-Key: $AWG_API_KEY" \
      -H "Content-Type: application/json" \
      --data "$body"
  else
    curl -sS -X "$method" "$AWG_API_URL$path" \
      -H "X-API-Key: $AWG_API_KEY"
  fi
}

require_ok() {
  local json="$1"
  python3 - "$json" <<'PY'
import json
import sys
payload = json.loads(sys.argv[1])
if not payload.get("ok"):
    raise SystemExit("response is not ok=true")
PY
}

run_step() {
  local title="$1"
  local method="$2"
  local path="$3"
  local body="${4:-}"
  echo "==> $title"
  local out
  out="$(api_json "$method" "$path" "$body")"
  require_ok "$out"
  echo "ok"
}

# health + ui
run_step "health" "GET" "/health"
ui_status="$(curl -sS -o /dev/null -w '%{http_code}' -H "X-API-Key: $AWG_API_KEY" "$AWG_API_URL/ui/")"
if [[ "$ui_status" != "200" ]]; then
  echo "ERROR: /ui/ returned HTTP $ui_status"
  exit 1
fi
echo "==> ui smoke ok"

# CRUD primitives
run_step "create phase1 profile" "POST" "/api/ipsec/phase1-profiles" "{\"name\":\"$P1_NAME\",\"encryption\":\"aes256\",\"hash\":\"sha256\",\"dh_group\":\"modp2048\",\"lifetime\":\"1d\"}"
run_step "create phase2 proposal" "POST" "/api/ipsec/phase2-proposals" "{\"name\":\"$P2_NAME\",\"encryption\":\"aes256\",\"auth\":\"sha256\",\"pfs_group\":\"modp2048\",\"lifetime\":\"1h\"}"
run_step "create peer" "POST" "/api/ipsec/peers" "{\"name\":\"$PEER_NAME\",\"local_addrs\":[\"1.1.1.1\"],\"remote_addrs\":[\"2.2.2.2\"],\"phase1_profile\":\"$P1_NAME\"}"
run_step "create identity" "POST" "/api/ipsec/identities" "{\"peer\":\"$PEER_NAME\",\"auth_method\":\"psk\",\"local_id\":\"1.1.1.1\",\"remote_id\":\"2.2.2.2\",\"psk\":\"secret\"}"
run_step "create policy" "POST" "/api/ipsec/policies" "{\"name\":\"$POLICY_NAME\",\"peer\":\"$PEER_NAME\",\"local_ts\":[\"10.0.0.0/24\"],\"remote_ts\":[\"10.1.0.0/24\"],\"proposal\":\"$P2_NAME\"}"

# runtime actions
run_step "ipsec apply" "POST" "/api/ipsec/apply" "{}"
run_step "ipsec load peer" "POST" "/api/ipsec/load/$PEER_NAME" "{}"
run_step "ipsec initiate policy" "POST" "/api/ipsec/initiate/$POLICY_NAME" "{}"
run_step "ipsec terminate peer" "POST" "/api/ipsec/terminate/$PEER_NAME" "{}"

# readbacks
run_step "list peers" "GET" "/api/ipsec/peers"
run_step "list identities" "GET" "/api/ipsec/identities"
run_step "list policies" "GET" "/api/ipsec/policies"
run_step "list phase1 profiles" "GET" "/api/ipsec/phase1-profiles"
run_step "list phase2 proposals" "GET" "/api/ipsec/phase2-proposals"
run_step "list active peers" "GET" "/api/ipsec/active-peers"
run_step "list installed sas" "GET" "/api/ipsec/installed-sas"
run_step "list events" "GET" "/api/ipsec/events"

# cleanup (best effort)
api_json "DELETE" "/api/ipsec/policies/$POLICY_NAME" >/dev/null || true
api_json "DELETE" "/api/ipsec/peers/$PEER_NAME" >/dev/null || true

echo "OK: ipsec stand smoke passed"
