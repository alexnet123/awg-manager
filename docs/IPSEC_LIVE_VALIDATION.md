# IPsec Live Validation Notes

Purpose: record live interoperability checks that prove whether IPsec UI fields are backed by real VICI/strongSwan behavior or are only cosmetic.

Scope:
- IPsec-only checks.
- Current live stand: AWG Manager / strongSwan at `195.133.67.169`.
- Peer stand: MikroTik RouterOS at `195.133.53.242`.
- Do not treat these notes as firewall contract tests; temporary firewall rules may be used only as controlled diagnostics and must be removed immediately.

## Naming

Use these labels when adding new checks:

- **Live validation**: a manual or semi-automated check against real strongSwan/VICI/MikroTik.
- **Interoperability check**: verifies the field works with MikroTik, not only in local config.
- **UI reality check**: verifies a UI control maps to an actual backend/VICI/runtime effect.
- **Cosmetic-only**: the control is visible but does not affect this mode or peer type.
- **Mode-limited**: the control is real, but only meaningful for a specific IKE version or scenario.

## Current Environment Snapshot

- Peer: `awg-live-test`
- Local endpoint: `195.133.67.169`
- Remote endpoint: `195.133.53.242`
- Exchange mode: IKEv1/main
- Phase 1 profile: `Phase1-live-test-ike`
- DPD default restored after tests: `dpd=true`, `dpd_delay=30s`, `dpd_timeout=120s`

## Checks

### DPD delay

Status: **real and verified**

Temporary test values:

- `dpd=true`
- `dpd_delay=10s`
- `dpd_timeout=30s`

Evidence:

- VICI config preview contained `dpd_delay: 10s` and `dpd_timeout: 30s`.
- strongSwan sent DPD probes roughly every 10 seconds:
  - `15:28:49 sending DPD request`
  - `15:28:59 sending DPD request`
  - `15:29:09 sending DPD request`

Conclusion:

- `DPD delay` is not cosmetic.
- It controls the probe interval used by strongSwan.

### DPD enable/disable

Status: **real and verified**

Test:

- DPD was temporarily disabled via `/api/ipsec/peers` and `/api/ipsec/apply`.

Evidence:

- VICI config preview no longer contained `dpd_delay` or `dpd_timeout`.
- strongSwan stopped initiating `sending DPD request`.
- MikroTik could still send DPD packets and strongSwan still responded with `DPD_ACK`.

Conclusion:

- The checkbox controls whether our side initiates DPD probes.
- It does not prevent strongSwan from replying to a peer's DPD request.

### DPD timeout

Status: **real and verified**

Temporary test values:

- `dpd_delay=10s`
- `dpd_timeout=30s`

First attempted test:

- Disabling the MikroTik IPsec peer is not a valid timeout test, because MikroTik sends a graceful `DELETE` for IKE_SA/CHILD_SA.

Timeout test:

- Added temporary MikroTik firewall rules to simulate silent packet loss:
  - filter input drop UDP `500,4500` from `195.133.67.169`
  - raw output drop UDP `500,4500` to `195.133.67.169`
- Rules used comments matching `awg-dpd-timeout-test*`.
- Rules were removed immediately after the test.

Evidence:

- Before drop:
  - `15:42:25 sending DPD request`
  - `15:42:25 parsed ... N(DPD_ACK)`
- During drop:
  - `15:42:35 sending DPD request`
  - no ACK
  - `15:42:45 sending DPD request`
  - no ACK
  - `15:42:55 DPD check timed out, enforcing DPD action`
- `/api/ipsec/active-peers` returned an empty list after timeout.
- `swanctl --list-sas` no longer showed active SA.

Conclusion:

- `DPD timeout` is not cosmetic.
- It controls the timeout window after which strongSwan treats the peer as dead and clears SA.

Restoration:

- MikroTik temporary firewall/raw rules were removed.
- Stand restored to `dpd=true`, `dpd_delay=30s`, `dpd_timeout=120s`.
- IPsec returned to `ESTABLISHED` with CHILD_SA installed.

### MOBIKE

Status: **mode-limited**

Current test mode:

- IKEv1/main with MikroTik.

Evidence:

- strongSwan/VICI accepts the `mobike` connection field.
- In IKEv1/main mode it has no practical effect.

Conclusion:

- MOBIKE is a real strongSwan/VICI option, but an IKEv2 feature.
- UI should disable or hide it for IKEv1.

UI decision:

- For `Exchange mode = IKEv1`, MOBIKE is forced to `no` and the control is disabled with an explanation.

### NAT-T / UDP encapsulation

Status: **real and verified**

Current test mode:

- Peer: `awg-live-test`
- Exchange mode: IKEv1/main with MikroTik.
- Baseline: `nat_t=false`, `send_initial_contact=true`.

Evidence:

- With `nat_t=false`, the peer returned to `ESTABLISHED` on UDP `500`:
  - local endpoint `195.133.67.169[500]`
  - remote endpoint `195.133.53.242[500]`
  - CHILD_SA mode `TUNNEL`
- With `nat_t=true`, the peer returned to `ESTABLISHED` on UDP `4500`:
  - local endpoint `195.133.67.169[4500]`
  - remote endpoint `195.133.53.242[4500]`
  - CHILD_SA mode `TUNNEL-in-UDP`
- strongSwan log during `nat_t=true` contained:
  - `faking NAT situation to enforce UDP encapsulation`

Conclusion:

- `NAT-T` is not cosmetic.
- It maps to strongSwan/VICI UDP encapsulation behavior and is interoperable with the current MikroTik IKEv1/main peer.
- The default on the live stand was restored to `nat_t=false`.

### Initial contact / unique IKE_SA handling

Status: **real and verified at loaded VICI connection level**

Current test mode:

- Peer: `awg-live-test`
- Exchange mode: IKEv1/main with MikroTik.
- Values tested: `send_initial_contact=true` and `send_initial_contact=false`.

Evidence:

- Backend VICI connection builder maps:
  - `send_initial_contact=true` to `unique=replace`
  - `send_initial_contact=false` to `unique=never`
- Targeted runtime tests assert both mappings.
- After `/api/ipsec/apply`, `swanctl --list-conns --pretty` showed the loaded strongSwan/VICI connection changing:
  - `send_initial_contact=false` -> `unique = UNIQUE_NEVER`
  - `send_initial_contact=true` -> `unique = UNIQUE_REPLACE`
- With `send_initial_contact=false`, the live peer still returned to `ESTABLISHED` on UDP `500` and both CHILD_SAs were installed.
- With `send_initial_contact=true`, the live peer also returned to `ESTABLISHED`.

Conclusion:

- `Initial contact` is not cosmetic.
- It changes the loaded VICI/strongSwan `unique` behavior.
- The normal single-peer reconnect path proves compatibility with MikroTik in both modes.
- Duplicate-IKE_SA behavior was verified separately; see the next section.

Restoration:

- Stand restored to `send_initial_contact=true`.

### Keying tries

Status: **real and verified**

Current test mode:

- Peer saved in API: `Peer-live-test`
- Runtime IKE_SA displayed by strongSwan/MikroTik: `awg-live-test`
- Exchange mode: IKEv1/main with MikroTik.
- Values tested: `keyingtries=0`.

Evidence:

- With `keyingtries=0`, `/api/ipsec/config-preview` showed the loaded peer value as `0`.
- After `swanctl --terminate --ike awg-live-test`, the peer returned to `ESTABLISHED`.
- Active peer showed `ph2_total=2`.
- Installed CHILD_SAs returned:
  - `awg-live-test-child-12`
  - `awg-live-test-child`

Conclusion:

- `Keying tries` is not cosmetic.
- `0` is accepted by the generated VICI payload and works on the live MikroTik reconnect path.
- Use `0` for unlimited setup retries; use a positive number when a bounded retry count is desired.

Restoration:

- Stand kept at `keyingtries=0`, which is the current UI/backend default for unlimited retries.
- Final state after restoration: `ESTABLISHED`, 2 CHILD_SAs installed.

### IKE SA rekey/reauth timers

Status: **superseded by the explicit `Peer-live-test` validation below**

Current test mode:

- Peer saved in API: `Peer-live-test`
- Runtime IKE_SA displayed by strongSwan/MikroTik: `awg-live-test`
- Exchange mode: IKEv1/main.
- MikroTik initiated the new Main Mode IKE_SA after each termination.

Temporary test values:

- Rekey test:
  - `rekey_time=60s`
  - `reauth_time=0s`
  - `over_time=20s`
  - `rand_time=0s`
- Reauth test:
  - `rekey_time=4h`
  - `reauth_time=60s`
  - `over_time=20s`
  - `rand_time=0s`

Evidence:

- Both test payloads were accepted and stored by `/api/ipsec/peers`.
- `/api/ipsec/apply` completed successfully.
- After `swanctl --terminate --ike awg-live-test`, MikroTik re-initiated IKEv1 Main Mode and the tunnel returned to `ESTABLISHED`.
- Rekey test log:
  - `IKE_SA awg-live-test[795] established`
  - `scheduling rekeying in 13781s`
- Reauth test log:
  - `IKE_SA awg-live-test[796] established`
  - `scheduling rekeying in 13371s`
- No scheduled `reauth` event occurred during the `reauth_time=60s` observation window.

Conclusion:

- `rekey_time`, `reauth_time`, `over_time`, and `rand_time` are real strongSwan/VICI connection fields.
- In the current live scenario, where MikroTik initiates IKEv1/main, short local `rekey_time`/`reauth_time` values did not drive the effective IKE_SA schedule.
- The effective IKE_SA rekey schedule remained near the peer-negotiated MikroTik lifetime, about 3.7-3.8 hours in these tests.
- Keep `reauth_time=0s` for this site-to-site PSK profile unless a specific local-initiation or IKEv2 scenario requires testing.
- Later explicit initiation of the current `Peer-live-test` connection proved these timers do control the selected connection. The confusing part was the stale loaded `awg-live-test` runtime connection.

Restoration:

- Stand restored to `rekey_time=4h`, `reauth_time=0s`, empty `over_time`, empty `rand_time`.
- Final state: `ESTABLISHED`, 2 CHILD_SAs installed.

### Duplicate IKE_SA replacement behavior

Status: **real and verified**

Current test mode:

- Main peer: `awg-live-test`
- Temporary duplicate connection: `awg-live-test-dup-unique-test`
- Exchange mode: IKEv1/main with MikroTik.
- Temporary connection was loaded through Python VICI and removed through `terminate` + `unload_conn`.
- Temporary CHILD_SA used `policies=no` so the test would not install duplicate XFRM policies.

Test setup:

- Start from manager-owned baseline with a single active IKE_SA:
  - `awg-live-test: #706, ESTABLISHED`
- Load a temporary connection with the same endpoints and PSK/auth profile.
- Initiate the temporary duplicate connection.
- Compare `unique=never` and `unique=replace`.

Evidence:

- With temporary connection `unique=never`, `swanctl --list-sas` showed two simultaneous IKE_SAs:
  - `awg-live-test-dup-unique-test: #707, ESTABLISHED`
  - `awg-live-test: #706, ESTABLISHED`
- With temporary connection `unique=replace`, after initiating the duplicate connection, `swanctl --list-sas` showed only the manager-owned IKE_SA:
  - `awg-live-test: #708, ESTABLISHED`
- The temporary duplicate connection was then unloaded.
- Final cleanup check showed no `awg-live-test-dup*` loaded connection and only the manager-owned peer active:
  - `awg-live-test: #709, ESTABLISHED`

Conclusion:

- `UNIQUE_NEVER` allows concurrent duplicate IKE_SAs for the same peer identity/endpoints.
- `UNIQUE_REPLACE` prevents retaining the duplicate IKE_SA in this test scenario.
- This confirms the `Initial contact` UI control is backed by real duplicate-IKE_SA behavior, not only by a stored config flag.

Restoration:

- Temporary VICI connection `awg-live-test-dup-unique-test` was unloaded.
- Stand restored to `send_initial_contact=true`, `nat_t=false`.
- Main peer returned to `ESTABLISHED` with two CHILD_SAs installed.

### IKE fragmentation

Status: **real local strongSwan/VICI option; interoperability-compatible in current test**

Values tested with MikroTik IKEv1/main:

- `yes`
- `no`
- `accept`
- `force`

Evidence:

- All tested values were accepted by VICI.
- The tunnel returned to `ESTABLISHED` with CHILD_SA installed for each value.
- MikroTik RouterOS peer/profile/proposal output did not show a matching explicit `fragmentation` field.

Conclusion:

- The field is real on the strongSwan side.
- MikroTik does not expose a directly equivalent peer/profile option in this observed RouterOS config.
- Current PSK/IKEv1/main payload is small, so `ESTABLISHED` proves compatibility but does not prove actual packet fragmentation was exercised.

Follow-up for stronger proof:

- Use a scenario with large IKE payloads, for example certificate chains or EAP, then inspect charon logs for actual fragmentation behavior.

### Phase 1 profile rename

Status: **fixed and verified**

Initial behavior:

- Editing a Phase 1 profile name created a second profile.
- Peers remained linked to the old profile name.

Fix:

- UI sends `original_name` during edit.
- Backend treats this as a rename and updates peers that reference the old profile.

Evidence:

- Renamed `awg-live-test-ike` to a temporary name.
- Peer reference moved to the temporary name.
- Renamed it back.
- Final state contained only the restored profile and the peer pointed to the restored name.

### IKE SA rekey and reauthentication timers

Status: **real and verified; active-SA effect depends on which loaded connection is used**

Baseline:

- Manager peer: `Peer-live-test`
- Existing live MikroTik SA name: `awg-live-test`
- Exchange mode: IKEv1/main.
- MikroTik Phase 1 profile lifetime: `1d`.
- MikroTik Phase 2 proposal lifetime: `1h`.
- Manager Phase 1 profile lifetime: `1d`.
- Manager peer baseline after this decision: `rekey_time=1d`, `reauth_time=0s`, empty `over_time`, empty `rand_time`, `keyingtries=0`.

Evidence:

- With `rekey_time=10m`, `reauth_time=0s`, `over_time=2m`, `rand_time=0s`, `swanctl --list-conns` showed `Peer-live-test: IKEv1, reauthentication every 600s`.
- Explicitly initiating `Peer-live-test` showed `scheduling rekeying in 600s` and the active IKE_SA showed `rekeying in 600s`.
- With `rekey_time=4h`, `reauth_time=10m`, `over_time=2m`, `rand_time=0s`, explicit initiation showed `scheduling rekeying in 14400s`, `scheduling reauthentication in 600s`, and the active IKE_SA showed `rekeying in 14400s, reauth in 600s`.
- The already-loaded legacy connection name `awg-live-test` can still be selected by automatic reconnects and keeps its own schedule. This means live observations must identify the actual IKE_SA name before judging the timer effect.

Conclusion:

- `rekey_time` is not cosmetic: it is loaded into VICI/strongSwan and controls the IKE_SA rekey schedule for the tested connection.
- `reauth_time` is not cosmetic: it is loaded into VICI/strongSwan and controls the separate IKE_SA reauthentication schedule when set.
- Phase 1 profile `lifetime=1d` is a stored proposal/profile-level field in the manager and MikroTik, while peer-level `rekey_time`/`reauth_time` are strongSwan connection timers. They must not be treated as the same UI concept.
- The manager default is now `rekey_time=1d` so the peer-level IKE_SA rekey timer stays aligned with the normal Phase 1 lifetime used on this MikroTik site-to-site profile.
- The manager UI keeps `reauth_time=0s` as the collapsed/default state for stable PSK site-to-site tunnels; when the optional input is opened, the suggested starting value is `7d` so reauthentication remains a rare credential re-check, not a daily tunnel churn event.
- The manager UI keeps empty `over_time` and `rand_time` as collapsed `Auto` states. Empty values are intentionally omitted from the loaded VICI connection so strongSwan can derive the grace and randomization windows.
- Runtime tests must avoid stale loaded connection names, otherwise results can look inconsistent.

Restoration:

- Stand restored to `rekey_time=1d`, `reauth_time=0s`, empty `over_time`, empty `rand_time`, `keyingtries=0`.
- Main MikroTik tunnel returned to `ESTABLISHED` with two CHILD_SAs installed.

### Identity PSK edit and reload

Status: **real and verified**

Current test mode:

- Manager peer: `Peer-live-test`
- MikroTik peer: `awg-live-test`
- Exchange mode: IKEv2 during this PSK validation.
- Authentication method: PSK.

Evidence:

- `/api/ipsec/identities/Peer-live-test/psk` returned an existing PSK.
- RouterOS API showed the MikroTik identity using the same PSK length and SHA-256 prefix.
- A temporary generated PSK was written to both sides:
  - AWG Manager via `/api/ipsec/identities`
  - MikroTik via `/ip/ipsec/identity/set`
- After `/api/ipsec/load/Peer-live-test`, `/api/ipsec/active-peers` returned:
  - `state=ESTABLISHED`
  - `ike_version=2`
  - `ph2_total=2`
- The original PSK was then restored on both sides and `/api/ipsec/load/Peer-live-test` returned the tunnel to:
  - `state=ESTABLISHED`
  - `ph2_total=2`

Bug found and fixed:

- Blank `psk` in the identity payload used to overwrite the stored encrypted PSK with an encrypted empty string.
- Backend now preserves the existing PSK when the payload PSK is blank.
- A regression test covers this behavior.

Conclusion:

- PSK editing is not cosmetic: changing the PSK affects the loaded VICI secret and live MikroTik interoperability.
- The UI may safely keep the PSK field visually hidden; clearing the field and saving now means "keep existing PSK" instead of "store empty PSK".
- Saving a changed PSK should be followed by peer reload so strongSwan uses the updated VICI secret immediately.

Restoration:

- Temporary generated PSK was removed.
- Original PSK restored on both AWG Manager and MikroTik.
- Tunnel returned to `ESTABLISHED` with two CHILD_SAs installed.

### Identity PSK UI generate/save

Status: **real and verified**

Current test mode:

- Manager peer: `Peer-live-test`
- MikroTik peer: `awg-live-test`
- Exchange mode: IKEv2.
- Authentication method: PSK.

Evidence:

- Baseline PSK was saved on the stand without printing the secret; AWG Manager and MikroTik matched by length and SHA-256 prefix.
- The Identity editor loaded the current PSK into a single password field:
  - field type: `password`
  - current value length matched the saved PSK
  - peer binding was locked to `Peer-live-test` in edit mode
- The UI Generate PSK button produced a new PSK with length 48 and the Save action closed the editor without an error.
- After the UI save, AWG Manager showed the new PSK length/hash prefix while MikroTik still had the old PSK, proving the UI save changed the stored manager-side secret.
- After syncing the same new PSK to MikroTik and reloading the peer, `/api/ipsec/active-peers` returned:
  - `state=ESTABLISHED`
  - `ike_version=2`
  - `ph2_total=2`
- `/api/ipsec/installed-sas` returned both CHILD_SAs installed after the tunnel settled:
  - `awg-live-test-child-12`
  - `awg-live-test-child`

Conclusion:

- The UI Generate PSK button is not cosmetic: it writes a new secret to the selected Identity, and that secret is used by VICI after peer reload.
- A PSK mismatch between AWG Manager and MikroTik prevents the tunnel from installing CHILD_SAs; matching the generated PSK on both sides restores the tunnel.
- The edit-mode peer lock is important because PSK save must affect only the Identity attached to the current peer.

Restoration:

- The baseline PSK was restored on both AWG Manager and MikroTik.
- `Peer-live-test` returned to `ESTABLISHED`.
- Active Peers returned to `ph2_total=2`.
- Installed SAs returned with two CHILD_SAs.

### CHILD_SA mode: beet / pass / drop

Status: **mode-specific live behavior verified**

Current test mode:

- Manager peer: `Peer-live-test`
- MikroTik peer: `awg-live-test`
- Temporary selectors were limited to endpoint ICMP only:
  - local: `195.133.67.169/32[icmp]`
  - remote: `195.133.53.242/32[icmp]`
- Existing `transport-icmp-live-test` was temporarily disabled during mode checks to avoid selector overlap, then restored.

Evidence:

- `beet` was accepted by `/api/ipsec/policies` and loaded into VICI, but strongSwan could not establish the CHILD_SA against the live MikroTik peer:
  - warning: `initiate failed for mode-beet-icmp-test: Command failed: establishing CHILD_SA 'mode-beet-icmp-test' failed`
  - no `mode-beet-icmp-test` appeared in installed SAs.
- `pass` with `start_action=trap` installed a real shunt policy:
  - `swanctl --list-pols` showed `Peer-live-test/mode-pass-icmp-test, PASS`
  - `ip xfrm policy` showed endpoint ICMP policies without ESP templates.
- `drop` with `start_action=trap` installed a real drop shunt:
  - `swanctl --list-pols` showed `Peer-live-test/mode-drop-icmp-test, DROP`
  - `ip xfrm policy` showed endpoint ICMP policies with `action block`.

Conclusion:

- `beet`, `pass`, and `drop` are not just stored UI strings; they are passed through to strongSwan/VICI.
- `beet` is not currently interoperable with the live MikroTik peer in this endpoint ICMP scenario.
- `pass` and `drop` are real local shunt-policy modes, not normal site-to-site CHILD_SA tunnels. They should be treated as advanced diagnostics/special cases, not default MikroTik tunnel settings.
- For normal site-to-site MikroTik policies, keep `mode=tunnel`.
- For endpoint-only encrypted checks, `mode=transport` remains the verified working mode.

Restoration:

- Temporary `mode-beet-icmp-test`, `mode-pass-icmp-test`, and `mode-drop-icmp-test` policies were deleted.
- Original policies were restored and `/api/ipsec/apply` completed successfully.
- Final state returned to `ESTABLISHED` with:
  - `awg-live-test-child`
  - `awg-live-test-child-12`
  - `transport-icmp-live-test`

### Policy start action

Current test mode:

- Manager peer: `Peer-live-test`
- MikroTik peer: `awg-live-test`
- Exchange mode: IKEv2 during this validation.
- Policies:
  - `awg-live-test-child-12`
  - `awg-live-test-child`

Evidence:

- Runtime code loads each policy value into the VICI CHILD_SA `start_action` field.
- `/api/ipsec/apply` explicitly initiates enabled IKEv2 policies only when `start_action=start`.
- Both live policies were temporarily changed from `start` to `none` and `/api/ipsec/apply` was run.
- With both policies set to `none`:
  - `/api/ipsec/active-peers` returned no active peers after apply settled.
  - `/api/ipsec/installed-sas` returned no installed CHILD_SAs.
  - `swanctl --list-sas` was empty.
- After restoring both policies to `start` and applying:
  - `Peer-live-test` returned to `ESTABLISHED`.
  - `/api/ipsec/active-peers` showed `ph2_total=2`.
- `/api/ipsec/installed-sas` showed both CHILD_SAs installed:

### CHILD_SA transport mode

Status: **real and verified**

Current test mode:

- Manager peer: `Peer-live-test`
- MikroTik peer: `awg-live-test`
- Exchange mode: IKEv2.
- Existing site-to-site tunnel policies were left in `mode=tunnel`.
- A separate temporary ICMP-only policy was added for transport validation:
  - Manager CHILD_SA: `transport-icmp-live-test`
  - local TS: `195.133.67.169/32[icmp]`
  - remote TS: `195.133.53.242/32[icmp]`
  - mode: `transport`
  - reqid: `21`
  - MikroTik policy comment: `codex-transport-icmp-test`
  - MikroTik policy: `tunnel=no`, `protocol=icmp`, public endpoint /32 selectors.

Evidence:

- `/api/ipsec/apply` returned `ok=true` and initiated `transport-icmp-live-test`.
- `swanctl --list-sas` showed:
  - `transport-icmp-live-test`
  - `INSTALLED`
  - `TRANSPORT`
  - local selector `195.133.67.169/32[icmp]`
  - remote selector `195.133.53.242/32[icmp]`
- `ip xfrm policy` showed ICMP selectors with `mode transport` and `reqid 21`.
- `ip xfrm state` showed transport ESP SAs for both directions.
- `ping -c 4 195.133.53.242` from the stand succeeded with `4 received, 0% packet loss`.
- After the ping, `swanctl --list-sas` showed `256 bytes / 4 packets` in and out for `transport-icmp-live-test`.
- MikroTik policy `codex-transport-icmp-test` showed:
  - `tunnel=no`
  - `protocol=icmp`
  - `ph2-count=1`
  - `ph2-state=established`
- MikroTik installed SAs for the transport SPI pairs showed `seen-traffic` and `current-packets=4`.

Conclusion:

- `mode=transport` is not cosmetic.
- It is loaded through VICI, installed into Linux XFRM as transport mode, negotiated with MikroTik, and carries live ICMP traffic.
- The safe validation pattern is to use a narrow protocol-specific public endpoint selector such as ICMP. Avoid testing `0.0.0.0/0` or all-protocol public endpoint transport selectors on the management stand, because that could capture SSH/API traffic.

Restoration decision:

- The temporary transport policy can be kept while actively inspecting the UI/runtime behavior.
- Remove `transport-icmp-live-test` on the stand and `codex-transport-icmp-test` on MikroTik before final release cleanup unless transport mode is intentionally part of the accepted live stand scenario.
    - `awg-live-test-child-12`
    - `awg-live-test-child`
  - `swanctl --list-sas` showed both CHILD_SAs as `INSTALLED`.

Conclusion:

- `Start action` is not cosmetic.
- `start` means the manager should bring the CHILD_SA up during apply/load.
- `none` means the CHILD_SA is loaded but not initiated by the manager.
- `trap` should remain documented as "wait for matching traffic" until a dedicated trap-policy traffic test proves the full live behavior with MikroTik.

Restoration:

- Both policies restored to `start_action=start`.
- Tunnel returned to `ESTABLISHED` with two CHILD_SAs installed.

### Policy start action: trap

Status: **real; traffic-trigger verified with MikroTik passive mode**

Current test mode:

- Manager peer: `Peer-live-test`
- MikroTik peer: `awg-live-test`
- Exchange mode: IKEv2.
- Target policy: `awg-live-test-child-12`
- Target traffic selector:
  - local: `10.11.12.0/24`
  - remote: `10.11.11.0/24`
- Local test address existed on the stand:
  - `dummy-ipsec12` with `10.11.12.1/24`

Test:

- Temporarily enabled passive mode on MikroTik:
  - `/ip/ipsec/peer/set 0 passive=yes`
- Temporarily set `awg-live-test-child-12` to `start_action=trap`.
- Temporarily set the other policy to `start_action=none`.
- Ran `/api/ipsec/apply`.
- Waited 12 seconds before generating local traffic.
- Generated matching traffic:
  - `ping -I 10.11.12.1 10.11.11.1`

Evidence:

- The apply response immediately after loading showed no active peers and no installed CHILD_SAs.
- The apply response XFRM policy contained a trap policy for the target selector:
  - `src 10.11.12.0/24 dst 10.11.11.0/24 dir out`
  - template `proto esp reqid 12 mode tunnel`
- With MikroTik `passive=yes`, 12 seconds after apply and before traffic:
  - `/api/ipsec/active-peers` returned `[]`
  - `/api/ipsec/installed-sas` returned no installed CHILD_SAs
- Matching traffic then triggered negotiation:
  - `ping -c 3 -W 1 -I 10.11.12.1 10.11.11.1`
  - result: `3 packets transmitted, 2 received`
  - the first packet was lost while the trap-triggered SA was being established.
- After traffic, only the target CHILD_SA was installed:
  - active peer: `Peer-live-test`, `ESTABLISHED`, `ph2_total=1`
  - installed CHILD_SA: `awg-live-test-child-12`, `INSTALLED`
  - counters: `packets_in=2`, `packets_out=2`

Conclusion:

- `trap` is not cosmetic: it is accepted by the backend/VICI path and loads an XFRM trap policy for the target selector.
- With MikroTik passive mode enabled, `trap` kept IKE/CHILD_SA down until matching local traffic appeared.
- The first matching packet can be lost while the CHILD_SA is negotiated; subsequent matching packets passed through the tunnel.
- In normal MikroTik non-passive mode, the remote peer may still initiate CHILD_SAs before local traffic, so `trap` behavior is most visible with a passive/no-auto-initiation peer.

Restoration:

- Both policies restored to `start_action=start`.
- MikroTik peer restored to default non-passive mode:
  - `/ip/ipsec/peer/set 0 passive=no`
- Tunnel returned to `ESTABLISHED`.
- Both CHILD_SAs returned to `INSTALLED`.

### Backend policy delete runtime cleanup

Status: **real**

Test setup:

- Stand: `195.133.67.169:8787`
- Peer: `Peer-live-test`
- Temporarily selected policy: `awg-live-test-child-12`
- Before test:
  - `/api/ipsec/policies` returned `awg-live-test-child` and `awg-live-test-child-12`
  - `/api/ipsec/installed-sas` returned installed CHILD_SAs for both policies

Evidence:

- Saved the selected policy JSON to `/tmp/ipsec-policy-restore.json` on the stand.
- Called `DELETE /api/ipsec/policies/awg-live-test-child-12`.
- The backend delete path invoked IPsec apply after successful persistence delete.
- After delete:
  - `/api/ipsec/policies` returned only `awg-live-test-child`
  - `/api/ipsec/installed-sas` returned only `awg-live-test-child`
- Restored the saved policy with `POST /api/ipsec/policies`, then called `POST /api/ipsec/apply`.
- After restore:
  - `/api/ipsec/policies` returned `awg-live-test-child` and `awg-live-test-child-12`
  - `/api/ipsec/installed-sas` returned installed CHILD_SAs for both policies

Conclusion:

- Policy deletion is not cosmetic: direct API delete now removes the persisted policy and reloads strongSwan/VICI runtime so the matching stale CHILD_SA disappears.
- The UI `Del` button for policies relies on this backend behavior and no longer performs a second redundant apply for policy deletes.

Restoration:

- `awg-live-test-child-12` was restored from the saved JSON.
- Runtime was reapplied and both baseline CHILD_SAs returned to `INSTALLED`.

### Enable/Disable runtime cleanup

Status: **real and verified**

Test setup:

- Stand: `195.133.67.169:8787`
- Peer: `Peer-live-test`
- Phase 1 profile: `Phase1-live-test-ike`
- Phase 2 proposal: `Phase2-live-test-esp`
- Policies: `awg-live-test-child`, `awg-live-test-child-12`
- Baseline before and after tests:
  - active peers: `1`
  - installed CHILD_SAs: `2`

Evidence:

- Peer disable + apply:
  - `Peer-live-test.enabled=false`
  - `/api/ipsec/apply` returned warning `peer Peer-live-test is disabled`
  - active peers dropped to `0`
  - installed CHILD_SAs dropped to `0`
- Peer enable + apply:
  - `Peer-live-test.enabled=true`
  - active peers returned to `1`
  - installed CHILD_SAs returned to `2`
- Policy disable + apply:
  - `awg-live-test-child-12.enabled=false`
  - active peers stayed at `1`
  - installed CHILD_SAs dropped from `2` to `1`
  - remaining CHILD_SA: `awg-live-test-child`
- Policy restore + apply:
  - `awg-live-test-child-12.enabled=true`
  - installed CHILD_SAs returned to `2`
- Identity disable + apply:
  - `Peer-live-test` identity `enabled=false`, PSK preserved
  - `/api/ipsec/apply` returned warning `peer Peer-live-test identity is disabled`
  - active peers dropped to `0`
  - installed CHILD_SAs dropped to `0`
- Identity restore + apply:
  - identity `enabled=true`, `has_psk=true`
  - active peers returned to `1`
  - installed CHILD_SAs returned to `2`
- Phase 1 disable + apply:
  - `Phase1-live-test-ike.enabled=false`
  - `/api/ipsec/apply` returned warning `peer Peer-live-test phase1 profile Phase1-live-test-ike is disabled`
  - active peers dropped to `0`
  - installed CHILD_SAs dropped to `0`
- Phase 1 restore + apply:
  - active peers returned to `1`
  - installed CHILD_SAs returned to `2`
- Phase 2 disable + apply:
  - `Phase2-live-test-esp.enabled=false`
  - `/api/ipsec/apply` returned warnings for both policies referencing the disabled proposal and `peer Peer-live-test has no enabled policies`
  - active peers dropped to `0`
  - installed CHILD_SAs dropped to `0`
- Phase 2 restore + apply:
  - active peers returned to `1`
  - installed CHILD_SAs returned to `2`

Conclusion:

- Enable/Disable is not cosmetic when followed by IPsec apply.
- Disabling the peer, identity, Phase 1 profile, or Phase 2 proposal removes the active IKE/CHILD_SA runtime state.
- Disabling one policy removes only the matching CHILD_SA while keeping the peer active when another enabled policy remains.
- A raw upsert without apply changes persisted JSON only and does not clean runtime state; UI bulk Enable/Disable must keep calling apply after persistence changes.

Restoration:

- `Peer-live-test`, its identity, `Phase1-live-test-ike`, `Phase2-live-test-esp`, `awg-live-test-child`, and `awg-live-test-child-12` were restored to `enabled=true`.
- Final state: active peers `1`, installed CHILD_SAs `2`.

## Add New Check Template

```md
### <Field or scenario>

Status: **real / cosmetic-only / mode-limited / unknown**

Test setup:

- ...

Evidence:

- ...

Conclusion:

- ...

Restoration:

- ...
```
