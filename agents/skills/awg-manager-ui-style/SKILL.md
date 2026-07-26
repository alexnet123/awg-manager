---
name: awg-manager-ui-style
description: Use when Codex creates, edits, reviews, or tests AWG Manager frontend UI, especially AmneziaWG/AWG interfaces and peers, Firewall, IPsec, NTP/Chrony screens, add/edit dialogs, admin tables, status panels, advanced network fields, collections/objects UI, or any task asking to keep the compact AWG Manager operator style.
---

# AWG Manager UI Style

## Core Workflow

1. Preserve the existing AWG Manager shell: sidebar, page header, theme toggle, spacing scale, and route structure unless the user explicitly asks to change global layout.
2. Find the closest implemented analogue before changing UI. Prefer Firewall Policy/Add Rule and IPsec forms as primary style references.
3. Keep behavior stable and backend-first. Do not introduce wire/API breaking changes unless explicitly approved.
4. Use existing components from `webui/src/components/ui` and existing page-local Firewall/IPsec patterns. Do not add a second UI library.
5. After frontend changes, run a production build and targeted browser/Playwright verification when available.

## Product Direction

Build for a network administrator, not for a generic SaaS user.

- Prefer compact, predictable forms over decorative layouts.
- Keep one obvious primary action per screen or dialog.
- Use precise networking language, but add short human explanations where nftables terms are obscure.
- Keep advanced or rare parameters collapsed by default unless hiding them would hide critical state.
- Avoid redesigning accepted surfaces. Improve by making the existing style clearer, not by inventing a new visual language.

## Visual Style

Use the established IPsec/Firewall look:

- Rounded cards with subtle borders and restrained shadows.
- Compact tabs at the top of a card or dialog.
- Dense but readable two-column form grids on desktop; single column on narrow screens.
- Muted helper text and placeholders; avoid large explanatory blocks inside the main workflow.
- Inline error/help text near the field that caused it.
- Existing dark/light theme tokens; no new color system unless explicitly approved.

## Form Patterns

Use these interaction patterns consistently:

- Text field: free-form values, prefixes, marks, names, IDs, raw nft-like values.
- Combobox: one selectable value from known options, while allowing typing custom values when technically valid.
- Checkbox group: multiple independent flags or states when nftables allows a set.
- Radio/preset group: exactly one semantic preset, such as common TCP flag combinations.
- Plus button: reveal an optional field or advanced block; minus button: remove/clear that optional block.

Make placeholders honest. If only one value is allowed, do not show examples as if multiple values can be selected. Use `any` as the default placeholder for protocol-like fields when no match is selected.

## Field Placement

Place fields by user intent:

- Base match: common L3/L4/interface/connection-state matches used in everyday rules.
- Advanced match: uncommon packet metadata, conntrack internals, routing/FIB/socket/L2 matches, debug/raw expressions.
- Action: verdicts and statements that change packet handling or runtime state, including NAT, mark/priority setters, notrack, nftrace, dynamic set update, verdict map, ct helper/timeout/expectation objects, limit/quota object references.
- Collections: reusable sets/maps/vmaps usable by fields.
- Objects: named nftables objects such as limit/quota/ct helper/ct timeout/ct expectation.

If a field mutates packet behavior, prefer Action over Advanced match. If a field only filters which packets match, keep it in Base or Advanced match.

## NTP / Chrony Patterns

For Chrony/NTP screens, keep the Firewall/IPsec visual language but use Chrony-native semantics.

- Keep module tabs compact and operator-oriented. Prefer `Time`, `Sources`, `Access`, `Source status`, `Client status`; avoid vague labels like `Runtime` when a clearer status category exists.
- Keep server controls on `Time` when they are core time-service settings; do not create extra tabs for one small cluster of fields.
- Do not manage firewall from the NTP module. Access rules mean Chrony `allow`/`deny` only; do not show a firewall status column unless the task explicitly asks for cross-module visibility.
- Hide `chrony.conf preview` by default. Show generated config only when explicitly requested or when reviewing backend generation.
- Treat `Source status` as `chronyc tracking` + `chronyc sources` data. Treat `Client status` as `chronyc clients` data. Use these labels in the UI instead of implementation words.

## Time And Apply Semantics

Time controls must distinguish desired configuration from runtime state.

- Checkbox/select/input changes edit the form only. They must not call side-effect APIs until the user presses the main `Apply`.
- Use one main `Apply` at the bottom of the Time panel for desired config writes and Chrony restart/reload. Avoid per-card Apply buttons unless the action is truly separate and explicit.
- Manual date/time fields are active only when NTP client sync is disabled. The visible system time and manual time should tick consistently while displayed.
- Timezone selection should be searchable, constrained to host-supported zones when available, show the current value immediately, and display the UTC offset (for example `UTC+03:00`).
- `Sync hardware clock (RTC)` is a user setting near NTP synchronization; its status badge may also appear in summary cards when useful.
- Page load must render saved configuration quickly even if Chrony runtime/status commands are slow. Fetch slow status independently and keep auto-refresh lightweight.

## Tables And Row Actions

Use the same table grammar across Firewall, IPsec, Sources, Access, and Keys.

- Standard toolbar: `Add`, `Del`, `Disable`, `Enable`; enable buttons according to selected row state. `Del` should be available for a selected row and feel like deletion to the user.
- Row selection uses the established selected-row highlight. Disabled rows use the established muted/yellow disabled-row treatment consistently across tabs.
- Avoid a separate `Enabled` column when enabled/disabled is already represented by row state and toolbar actions.
- Keep columns compact and useful. Remove diagnostic columns that add no action or decision value.
- Copy actions should duplicate the selected entry but clear the identity field (`address`, `network`, or similar) so the user can create a nearby rule/source safely.

## AmneziaWG Patterns

AmneziaWG must follow the IPsec table and toolbar style closely.

- Treat `AmneziaWG` as one domain page, not separate sidebar sections for interfaces and clients. Use compact tabs: `Interfaces` and `Peers`.
- Call clients `peers` in user-facing AWG labels, empty states, and technical descriptions when practical; keep backend/API names as `clients` where that is the existing contract.
- Do not show page subtitles or marketing helper copy under the `AmneziaWG` heading unless explicitly requested.
- Put `Add` in the tab toolbar and route it to the active tab: create interface on `Interfaces`, create peer on `Peers`.
- Use the standard IPsec-style toolbar on each tab: `Add`, `Del`, `Disable`, `Enable`. Do not add a local `Refresh`; use the global header refresh only.
- Do not add local search or pagination to AWG tables unless the user explicitly requests it or there is a proven data-volume problem.
- Use IPsec-like flat, sortable tables, not nested cards-with-table sections. Avoid extra panel titles such as `Click a row to view details and actions`.
- Keep long keys/config-like values compact in tables with middle truncation and full value in `title`; do not let public keys stretch the table.
- Rows select on click and open the same Add/Edit dialog on double-click, like IPsec. Do not use right-side details drawers for AWG.
- Move interface/client details into the Add/Edit dialog. Keep interface public key/config preview and peer public key/config/QR access available there.
- AWG Add/Edit windows must use the Firewall/IPsec draggable floating-window shell: muted drag header, compact body sections, fixed footer actions. Open them horizontally centered in the `main` workspace and vertically near the top of the workspace by default, then let users drag them. Do not use centered non-draggable Radix modal.
- If backend data disappears on a live stand, check API state before changing UI. Do not run destructive e2e setup against a live stand.

## Dialogs And Drawers

Add/edit dialogs should look like IPsec peer dialogs unless there is a strong reason not to.

- Use a compact modal/drawer with title, short subtitle, grouped fields, and footer actions.
- Put field help above or directly beside inputs, not as long text blocks below that stretch the page.
- Footer order: secondary actions such as `Copy`, then `Cancel`, then primary `Save`/`Add`.
- For secrets, provide a generator appropriate to the selected algorithm and an eye toggle for reveal/hide. Secret values should be masked in tables.
- Use key-management dialogs with the same standard table and button states as other admin lists.

## Status Badges

Color badges by meaning, not by component default.

- Green: healthy/active/enabled/synchronized/current/selected positive state.
- Red: disabled/error/desynchronized/failed negative state.
- Yellow/orange: waiting/pending/needs apply/transitional state.
- Gray: inactive/unknown/not available.
- Do not duplicate the same signal across multiple cards. If `Service` already appears on Time, do not repeat it on Source status unless it changes the user decision there.

## Optional Fields

Optional fields should save space without hiding important state.

- Use `+` to reveal optional values where empty/default means "all" or "none" (`bind address`, `bind interface`, `auth key`, default port). Use `-` to clear back to default.
- Do not over-collapse common operational settings after the user rejects the compact version. Keep important server behavior visible.
- Display defaults in human form, e.g. `0.0.0.0 / all interfaces`, `none / no authentication`, `123 / default`, while ensuring generated config writes the correct Chrony directive or omits it when default is intended.

## Firewall-Specific Rules

Preserve the Policy1 mental model:

- Keep the main policy UI recognizable; do not rebuild it as a new product surface.
- Collapse Policy2/Policy3 functionality into the single Policy flow only through existing table/chain/add-rule concepts.
- Keep built-in filter/nat/raw/mangle scoped to supported families (`inet`, `ip`, `ip6`).
- Expose bridge and netdev rules through table/chain selection rather than pretending they are filter/nat/raw/mangle tabs.
- When chain/family/table context makes a field invalid, disable or hide it with a short reason instead of allowing a broken rule.

## Labels And Help Text

Use user-facing labels first and raw nftables terms second.

Examples:

- `packet length`, not only `meta length`.
- `set packet priority (QoS)`, not only `meta priority`.
- `packet mark`, not only `meta mark`.
- `connection mark`, not only `ct mark`.
- `input interface group`, not only `meta iifgroup`.

For expert-only fields, keep the field available if it works, but make the helper text say that it is expert/debug/admin-oriented.

## Documentation

When changing responsibilities, behavior, or user-facing semantics:

- Update canonical docs instead of creating one-off report files.
- Keep RU/EN module ownership docs aligned when module boundaries move.
- For user-facing Firewall instructions, update the relevant `docs/user/firewall/*` files.

## Verification

Before claiming completion:

- Run `cd webui && npm run build` after frontend changes.
- Run the relevant targeted Playwright test when the changed UI has coverage.
- For Firewall backend/rule behavior, run the project firewall pytest gate required by `AGENTS.md`.
- If deploying to a stand, verify the built asset currently served by the stand and mention the stand URL.

## Anti-Patterns

Avoid:

- New global layout/sidebar/theme changes for a module-local task.
- Decorative UI that does not improve operator confidence.
- Mixing match fields and action statements in the same visual group.
- Showing unsupported nftables combinations as if they work.
- Large permanent plan/report Markdown files for temporary task state.
- Touching IPsec while developing Firewall unless the task explicitly requires a shared interface.
