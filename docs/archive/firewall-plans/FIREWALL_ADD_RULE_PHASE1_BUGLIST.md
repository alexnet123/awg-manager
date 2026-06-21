# Add Firewall Rule - Phase 1 Buglist / Backlog

Purpose: track what is currently not fully functional in Add Rule modal and what must be implemented next.

## A. Functional issues (priority fix)

## A1. Some UI sections are visible but not actionable (`planned` placeholders)
Status: expected for now, but should be clearly treated as backlog, not “working”.

Current placeholders:
- Base tab:
  - Connection mark match
  - Packet mark match
  - User ID
  - Hour
  - DSCP
- Advanced tab:
  - tcp/icmp/icmpv6 detailed matchers
  - meta extended match block
  - conntrack extended match block
  - fib check/socket match standalone fields
  - vlan / ether src/dst/type / ipv6 extension headers
  - raw expression
  - nftrace
  - notrack (advanced mode)
- Statistics tab:
  - `handle` stays planned placeholder

Action:
- keep placeholders visually obvious as “planned”
- do not expose as functional in user docs
- implement in phased blocks (see implementation plan)

## A2. Context-dependent controls can look missing/confusing for users
Observed behavior:
- controls appear/disappear by table support matrix (`filter/nat/raw/mangle`).

Risk:
- user may interpret hidden control as UI bug.

Action:
- add tiny contextual hint near top of modal:
  - “Fields shown depend on selected table/chain.”
- include table/chain support matrix in guide (EN/RU).

## A3. Jump/Goto target-chain confusion
Current behavior:
- jump/goto to base hook chains are rejected by backend (correct).

Risk:
- users still try `input/forward/output` as `target_chain`.

Action:
- add inline helper text in Action tab:
  - “target_chain must be a user-defined chain.”

## B. Implementation backlog (next working blocks)

## B1. Block A (next to implement)
1. raw expression (free-form)
2. nftrace
3. advanced notrack toggle (raw-only semantics)

Definition of done:
- UI wired
- backend validation
- nft runtime mapping
- strict e2e + negative + runtime equivalence
- EN/RU docs examples

Status:
- Completed in current cycle.
- Covered by `webui/tests/firewall-add-rule-block-a.spec.ts` and consolidated add-rule suite.

## B2. Block B
1. tcp/icmp/icmpv6 detailed matchers
2. meta extended subset
3. conntrack extended subset

Status:
- In progress.
- Completed subset:
  - `tcp_flags`
  - `icmp_type`, `icmp_code`
  - `icmpv6_type`, `icmpv6_code`
  - `meta_length`
  - `ct_status`
- Remaining:
  - other meta extended fields
  - other conntrack extended fields

## B3. Block C
1. vlan / ether / L2-related fields

## C. Test tasks tied to this buglist

1. Add strict spec for “planned controls are clearly non-interactive”.
2. Add strict spec for “context hint + field visibility by table/chain”.
3. Add strict spec for jump/goto inline guidance and backend rejection consistency.
4. Add new block-specific specs as each planned feature becomes implemented.
