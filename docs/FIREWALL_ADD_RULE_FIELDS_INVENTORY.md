# Add Firewall Rule - Fields Inventory

Last updated from UI source: `webui/src/pages/firewall.tsx`

## Status Legend
- `implemented+tested`: wired end-to-end and covered by current e2e suite
- `implemented+untested`: wired in UI/API, but strict e2e coverage not complete yet
- `implemented+partially-tested`: covered только в части сценариев (нужны доп. кейсы)
- `planned`: visible placeholder only, not wired

## Base Tab
- Rule enabled: `implemented+tested`
- Chain: `implemented+tested`
- Source address (`src`): `implemented+tested`
- Destination address (`dst`): `implemented+tested`
- Protocol (`proto`): `implemented+tested`
- Source port (`sport`): `implemented+tested`
- Destination port (`dport`): `implemented+tested`
- Input interface (`in_interface`): `implemented+tested`
- Output interface (`out_interface`): `implemented+tested`
- Connection state (`ct_state`): `implemented+tested`
- Connection mark match: `planned`
- Packet mark match: `planned`
- Rate limit (`limit_rate`): `implemented+tested`
- User ID: `planned`
- Hour: `planned`
- DSCP: `planned`

## Advanced Tab
- fib expression (`fib_expr`): `implemented+tested`
- socket expression (`socket_expr`): `implemented+tested`
- rt expression (`rt_expr`): `implemented+tested`
- exthdr expression (`exthdr_expr`): `implemented+tested`
- raw expression (free-form): `planned`
- nftrace checkbox: `planned`
- notrack advanced checkbox: `planned`
- tcp flags / icmp / icmpv6 detailed matchers: `planned`
- meta extended block (`meta length/priority/pkttype/cpu/...`): `planned`
- conntrack extended block (`ct direction/status/labels/...`): `planned`
- l2 fields (`vlan`, `ether src/dst/type`): `planned`

## Action Tab
- Action verdict selector: `implemented+tested`
- Target / to (jump/goto/nat target): `implemented+tested`
- Reject with (`reject_type`): `implemented+tested`
- NAT options (`nat_random`, `nat_fully_random`, `nat_persistent`): `implemented+tested`
- meta mark set (`mark_set`): `implemented+tested`
- ct mark set (`ct_mark_set`): `implemented+tested`
- ct helper set (`ct_helper_set`): `implemented+tested (graceful reject until ct objects are supported)`
- ct timeout set (`ct_timeout_set`): `implemented+tested (graceful reject until ct objects are supported)`
- ct expectation set (`ct_expectation_set`): `implemented+tested (graceful reject until ct objects are supported)`
- Logging toggle + prefix + level (`log_prefix`, `log_level`): `implemented+tested`

## Statistics Tab
- Counter toggle (`counter`): `implemented+tested`
- Runtime packets/bytes display: `implemented+tested`
- Live chart preview: `implemented+tested`

## Current e2e Coverage Snapshot
- `firewall-add-rule-fields-completeness.spec.ts`: modal structure/tabs/planned-field visibility
- `firewall-add-rule-validation.spec.ts`: strict negative validation (`src`, `dport`, `sport`)
- `firewall-add-rule-context.spec.ts`: table/chain matrix + invalid action/context API rejects
- `firewall-add-rule-race.spec.ts`: parallel create behavior + dedup guard verification
- `firewall-add-rule-runtime-fields.spec.ts`: runtime field behavior (`reject_type`, `mark_set`, `ct_mark_set`, `ct_*_set` graceful reject)
- `firewall-add-rule-wired-fields.spec.ts`: wired persistence for base/advanced/nat fields (`dst`, `in/out_interface`, `ct_state`, `limit_rate`, `fib/socket/rt/exthdr`, `nat to + flags`)
- `firewall-add-rule-action-stats.spec.ts`: action/stats behavior (`enabled`, jump target guard, logging, counter + runtime history payload)
- `firewall-add-rule-stats-visual.spec.ts`: visual statistics UX (chart render, series switch, counter warning visibility)
- `firewall-add-rule-toggle-semantics.spec.ts`: strict `+/-` semantics (field enable, value set, disable, payload omission on save)
- `firewall-add-rule-nft-equivalence.spec.ts`: API→runtime equivalence via `/firewall.ruleset` (`filter`, `mangle`, `nat`, and disabled-rule omission)
- `firewall-rules.spec.ts`: smoke flow for create/basic actions
- `firewall-maps.spec.ts`: map lifecycle (outside Add Rule modal)
- `firewall-tables.spec.ts`: table-chain lifecycle (outside Add Rule modal)

## Next Mandatory Coverage
1. Full Add Rule field toggle semantics (`+`/`-`) for all wired fields (not only `src/sport/dport`). ✅
2. Runtime nft equivalence checks per field (`target/to`, `reject_type`, `mark_set`, `ct_mark_set`, `log_*`, `ct_*_set`, `fib/socket/rt/exthdr`). ✅ (implemented for core supported runtime fields; `ct_*_set` remains graceful-reject by design)
3. `negative-fuzz` suite: randomized invalid/valid payload batches.
4. `recovery` suite: restart/reboot persistence parity (`UI/API/JSON/nft`).
