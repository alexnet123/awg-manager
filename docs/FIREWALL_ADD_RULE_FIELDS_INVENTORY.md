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
- Connection mark match: `implemented+tested`
- Packet mark match: `implemented+tested`
- Rate limit (`limit_rate`): `implemented+tested`
- User ID: `implemented+tested`
- Hour: `implemented+tested`
- DSCP: `implemented+tested`

## Advanced Tab
- fib expression (`fib_expr`): `implemented+tested`
- socket expression (`socket_expr`): `implemented+tested`
- rt expression (`rt_expr`): `implemented+tested`
- exthdr expression (`exthdr_expr`): `implemented+tested`
- fib check (`fib_check`): `implemented+tested`
- socket match (`socket_match`): `implemented+tested`
- rt nexthop (`rt_nexthop`): `implemented+tested`
- ipv6 extension headers (`ipv6_exthdrs`): `implemented+tested`
- raw expression (free-form): `implemented+tested (raw table only)`
- nftrace checkbox: `implemented+tested (raw table only)`
- notrack advanced checkbox: `implemented+tested (raw table only)`
- tcp flags / icmp / icmpv6 detailed matchers: `implemented+tested`
- meta extended block (`meta length/priority/pkttype/cpu/...`): `implemented+tested`
- conntrack extended block (`ct direction/status/labels/...`): `implemented+tested`
- l2 fields (`vlan`, `ether src/dst/type`): `implemented+tested`

## Action Tab
- Action verdict selector: `implemented+tested`
- Target / to (jump/goto/nat target): `implemented+tested`
- Reject with (`reject_type`): `implemented+tested`
- NAT options (`nat_random`, `nat_fully_random`, `nat_persistent`): `implemented+tested`
- meta mark set (`mark_set`): `implemented+tested`
- ct mark set (`ct_mark_set`): `implemented+tested`
- ct helper set (`ct_helper_set`) in `Policy v2 bridge`: `implemented+tested`
- ct timeout set (`ct_timeout_set`) in `Policy v2 bridge`: `implemented+tested`
- ct expectation set (`ct_expectation_set`) in `Policy v2 bridge`: `planned (disabled by design for bridge in current sprint/runtime)`
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
- `firewall-add-rule-runtime-fields.spec.ts`: runtime field behavior (`reject_type`, `mark_set`, `ct_mark_set`, plus bridge policy checks for named stateful fields)
- `firewall-add-rule-wired-fields.spec.ts`: wired persistence for base/advanced/nat fields (`dst`, `in/out_interface`, `ct_state`, `limit_rate`, `fib/socket/rt/exthdr`, `nat to + flags`)
- `firewall-add-rule-action-stats.spec.ts`: action/stats behavior (`enabled`, jump target guard, logging, counter + runtime history payload)
- `firewall-add-rule-stats-visual.spec.ts`: visual statistics UX (chart render, series switch, counter warning visibility)
- `firewall-add-rule-toggle-semantics.spec.ts`: strict `+/-` semantics (field enable, value set, disable, payload omission on save)
- `firewall-add-rule-nft-equivalence.spec.ts`: API→runtime equivalence via `/firewall.ruleset` (`filter`, `mangle`, `nat`, and disabled-rule omission)
- `firewall-add-rule-block-a.spec.ts`: raw block fields (`raw_expr`, `nftrace`, `notrack`) runtime mapping and non-raw rejection
- `firewall-add-rule-block-b.spec.ts`: advanced matcher subset (`tcp_flags`, `icmp*`, `meta_length`, `ct_status`) runtime mapping and proto-validation rejects
- `firewall-add-rule-block-b2.spec.ts`: meta/ct extended subset (`meta_priority`, `meta_cpu`, `ct_direction`, `ct_expiration`) runtime mapping + negative validation
- `firewall-add-rule-block-b3.spec.ts`: meta extras subset (`meta_pkttype`, `meta_iifgroup`, `meta_oifgroup`) runtime mapping + negative validation
- `firewall-add-rule-block-b4.spec.ts`: meta type subset (`meta_iiftype`, `meta_oiftype`) runtime mapping + negative validation
- `firewall-add-rule-block-b5.spec.ts`: conntrack helper match subset (`ct_helper_match`) runtime mapping + negative validation
- `firewall-add-rule-block-b6.spec.ts`: mark match subset (`mark_match`, `ct_mark_match`) runtime mapping + negative validation
- `firewall-add-rule-block-b7.spec.ts`: conntrack subset (`ct_label`, `ct_event`) runtime mapping + negative validation
- `firewall-add-rule-block-b8.spec.ts`: L2 subset (`vlan_id`, `ether_src/dst`, `ether_type`) runtime mapping + negative validation
- `firewall-add-rule-block-b9.spec.ts`: conntrack tuple address subset (`ct_original_saddr/daddr`, `ct_reply_saddr/daddr`) runtime mapping + negative validation
- `firewall-add-rule-block-b10.spec.ts`: base matcher (`dscp`) runtime mapping + negative validation
- `firewall-add-rule-block-b11.spec.ts`: base matchers (`user_id`, `hour`) runtime mapping + negative validation
- `firewall-add-rule-block-b12.spec.ts`: advanced matchers (`fib_check`, `socket_match`, `rt_nexthop`, `ipv6_exthdrs`) runtime mapping + negative validation
- `firewall-rules.spec.ts`: smoke flow for create/basic actions
- `firewall-maps.spec.ts`: map lifecycle (outside Add Rule modal)
- `firewall-tables.spec.ts`: table-chain lifecycle (outside Add Rule modal)

## Next Mandatory Coverage
1. Full Add Rule field toggle semantics (`+`/`-`) for all wired fields (not only `src/sport/dport`). ✅
2. Runtime nft equivalence checks per field (`target/to`, `reject_type`, `mark_set`, `ct_mark_set`, `log_*`, `ct_*_set`, `fib/socket/rt/exthdr`). ✅ (`ct_helper_set` and `ct_timeout_set` active in bridge Policy v2; `ct_expectation_set` is planned/disabled for bridge)
3. `negative-fuzz` suite: randomized invalid/valid payload batches. ✅
4. `recovery` suite: restart/reboot persistence parity (`UI/API/JSON/nft`). ✅ (service restart script + reboot parity verified on stand)
