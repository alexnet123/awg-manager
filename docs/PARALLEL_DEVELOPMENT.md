# Parallel Development Workflow (Firewall + IPsec)

This repository supports parallel development streams with isolated branches, local worktrees, and stand roles.

Current refactor progress tracker:
- [REFRACTOR_PROGRESS.ru.md](REFRACTOR_PROGRESS.ru.md)

## Target Model

- Stream A: Firewall/UI (`Policy`, `Policy2`, `Policy3`)
- Stream B: IPsec/UI
- Integration branch: `dev`

Recommended:

- separate local worktrees per stream;
- separate stands per stream;
- explicit stand role marker: `AWG_MANAGER_STAND_PROFILE`.

## Local Worktrees

Create isolated local directories from `dev`:

```bash
cd /path/to/awg_manager
git fetch
git worktree add -b codex-firewall-ui ../awg_manager_firewall origin/dev
git worktree add -b codex-ipsec-ui ../awg_manager_ipsec origin/dev
```

Use one chat/session per worktree.

## Stand Mapping

- Firewall stand:
  - `AWG_MANAGER_STAND_PROFILE=firewall`
  - standard firewall apply flow is allowed.
- IPsec stand:
  - `AWG_MANAGER_STAND_PROFILE=ipsec`
  - used for IPsec UI/API/runtime preparation.

Runtime files are scoped by `AWG_MANAGER_DATA_DIR` (default `/etc/wg-manager`).

If multiple instances share one host, each must have:

- unique API port;
- unique `AWG_MANAGER_DATA_DIR`.

## Installer Example

Firewall stand:

```bash
sudo ./scripts/install_test_stand.sh \
  --project-dir /root/awg-manager \
  --host 0.0.0.0 \
  --port 8787 \
  --data-dir /etc/wg-manager-firewall \
  --stand-profile firewall
```

IPsec stand:

```bash
sudo ./scripts/install_test_stand.sh \
  --project-dir /root/awg-manager \
  --host 0.0.0.0 \
  --port 8788 \
  --data-dir /etc/wg-manager-ipsec \
  --stand-profile ipsec
```

## Integration Rules

- Keep firewall and ipsec commits separate.
- Rebase each feature branch on latest `dev` before merge.
- Run stream-specific checks on target stand before integration.
- Merge one stream at a time into `dev` to simplify rollback.
