# Рефакторинг: прогресс работ

Обновлено: 2026-05-24

Цель итерации:
- параллельная модель разработки (`firewall` + `ipsec`) без конфликтов;
- инкрементальная декомпозиция `webui/src/pages/firewall.tsx`;
- без изменения внешнего HTTP API.

## 1) Инфраструктура и runtime-конфиги

- [x] Введен `AWG_MANAGER_DATA_DIR` (default `/etc/wg-manager`) в backend.
- [x] Переведены runtime пути state/key/db на `AWG_MANAGER_DATA_DIR`.
- [x] Добавлен `AWG_MANAGER_STAND_PROFILE` в env-шаблоны.
- [x] Расширен installer:
  - [x] `--data-dir`
  - [x] `--stand-profile`
- [x] Документация обновлена:
  - [x] `docs/DEPLOY.md`
  - [x] `docs/API.md`
  - [x] `docs/PARALLEL_DEVELOPMENT.md`

## 2) Тестовый контракт для data dir

- [x] Добавлен `tests/test_data_dir_config.py`.
- [x] Проверяется переопределение путей через `AWG_MANAGER_DATA_DIR`.
- [x] Проверяется `save/load/rotate` API key в выбранном data dir.

## 3) Декомпозиция Firewall UI (Policy2/Policy3)

### Уже вынесено

- [x] Capability matrix:
  - `webui/src/pages/firewall/capabilities.ts`
- [x] Helpers object bindings:
  - `webui/src/pages/firewall/objectBindings.ts`
- [x] Helpers sections:
  - `webui/src/pages/firewall/sections.ts`
- [x] Rule form factory/create/edit:
  - `webui/src/pages/firewall/ruleForm.ts`
- [x] Rules table component:
  - `webui/src/pages/firewall/PolicyAdvancedRulesTable.tsx`
- [x] Bridge objects table component:
  - `webui/src/pages/firewall/PolicyBridgeObjectsTable.tsx`
- [x] Rule editor modal shell:
  - `webui/src/pages/firewall/PolicyAdvancedRuleEditorModal.tsx`
- [x] Bridge object modal extracted:
  - `webui/src/pages/firewall/PolicyBridgeObjectModal.tsx`
- [x] Collections modal extracted:
  - `webui/src/pages/firewall/CollectionsModal.tsx`
- [x] Table builder modal extracted:
  - `webui/src/pages/firewall/TableBuilderModal.tsx`
- [x] Rule editor base section:
  - `webui/src/pages/firewall/PolicyAdvancedRuleEditorBaseSection.tsx`
- [x] Rule editor match section:
  - `webui/src/pages/firewall/PolicyAdvancedRuleEditorMatchSection.tsx`
- [x] Shared field controls (`ToggleLine` / `PlannedField`):
  - `webui/src/pages/firewall/RuleFieldControls.tsx`
- [x] Rule editor action/logging/statistics section:
  - `webui/src/pages/firewall/PolicyAdvancedRuleEditorActionSection.tsx`
- [x] Rule/object filter and usage state hook (phase 1):
  - `webui/src/pages/firewall/usePolicyV2RuleObjectState.ts`
  - includes rule/object selection-anchor sync
- [x] PolicyAdvanced section container (phase 3 start):
  - `webui/src/pages/firewall/PolicyAdvancedSection.tsx`
- [x] PolicyAdvanced bindings/orchestration hook:
  - `webui/src/pages/firewall/usePolicyAdvancedBindings.ts`
- [x] PolicyAdvanced context sync hook:
  - `webui/src/pages/firewall/usePolicyAdvancedContextSync.ts`
  - section/family/table sync now capability-driven (no hardcoded `activeSection === policy_v2/policy_v3` checks)
- [x] PolicyAdvanced page adapter component:
  - `webui/src/pages/firewall/PolicyAdvancedPage.tsx`
- [x] Rule editor orchestration hook (phase 2, part 1):
  - `webui/src/pages/firewall/usePolicyAdvancedRuleEditor.ts`
- [x] Policy2/Policy3 data refresh hook (phase 2, part 2):
  - `webui/src/pages/firewall/usePolicyAdvancedData.ts`
- [x] Policy2/Policy3 rule save/delete actions hook (phase 2, part 2):
  - `webui/src/pages/firewall/usePolicyAdvancedRuleActions.ts`
- [x] Policy2 objects save/delete actions hook (phase 2, part 2):
  - `webui/src/pages/firewall/usePolicyAdvancedObjectActions.ts`
- [x] Shared Policy2 object form model extracted:
  - `webui/src/pages/firewall/policyV2ObjectForm.ts`
- [x] Policy2 object editor orchestration extracted:
  - `webui/src/pages/firewall/usePolicyAdvancedObjectEditor.ts`
- [x] Table builder editor orchestration extracted:
  - `webui/src/pages/firewall/useTableBuilderEditor.ts`
- [x] Collections editor orchestration extracted:
  - `webui/src/pages/firewall/useCollectionsEditor.ts`
- [x] Policy (inet) rule editor actions extracted:
  - `webui/src/pages/firewall/usePolicyRuleEditorActions.ts`
- [x] Policy (inet) rule editor sync effects extracted:
  - `webui/src/pages/firewall/usePolicyRuleEditorSync.ts`
- [x] Policy (inet) rule editor modal shell extracted:
  - `webui/src/pages/firewall/PolicyRuleEditorModal.tsx`
- [x] Policy (inet) rule editor stats tab extracted:
  - `webui/src/pages/firewall/PolicyRuleEditorStatsTab.tsx`
- [x] Policy (inet) rule editor action tab extracted:
  - `webui/src/pages/firewall/PolicyRuleEditorActionTab.tsx`
- [x] Policy (inet) rule editor base tab extracted:
  - `webui/src/pages/firewall/PolicyRuleEditorBaseTab.tsx`
- [x] Policy (inet) rule editor advanced tab extracted:
  - `webui/src/pages/firewall/PolicyRuleEditorAdvancedTab.tsx`
- [x] Shared policy/collections format/time helpers extracted:
  - `webui/src/pages/firewall/policyUtils.ts`
  - includes `buildPolicyV2BridgeExprSummary`
- [x] Collections tab section extracted:
  - `webui/src/pages/firewall/CollectionsSection.tsx`
- [x] Table Builder tab section extracted:
  - `webui/src/pages/firewall/TablesSection.tsx`
- [x] Policy top toolbar block extracted (tabs/custom table/banner/actions/columns):
  - `webui/src/pages/firewall/PolicySectionToolbar.tsx`
- [x] Firewall section tabs extracted:
  - `webui/src/pages/firewall/FirewallSectionTabs.tsx`
- [x] Policy (inet) rule editor dialog container extracted:
  - `webui/src/pages/firewall/PolicyRuleEditorDialog.tsx`
- [x] Policy2/Policy3 rule editor dialog container extracted:
  - `webui/src/pages/firewall/PolicyAdvancedRuleEditorDialog.tsx`
- [x] Firewall modal stack extracted:
  - `webui/src/pages/firewall/FirewallModalStack.tsx`
- [x] Bulk actions orchestration extracted (rules/collections/tables):
  - `webui/src/pages/firewall/useFirewallBulkActions.ts`
- [x] Shared selection/sort helpers extracted:
  - `webui/src/pages/firewall/selectionUtils.ts`
- [x] Policy rules drag&drop reorder orchestration extracted:
  - `webui/src/pages/firewall/usePolicyRuleReorder.ts`
- [x] Policy2 object summary formatter extracted:
  - `webui/src/pages/firewall/policyV2ObjectSummary.ts`
- [x] Shared draggable modal window behavior extracted:
  - `webui/src/pages/firewall/useDraggableWindow.ts`
- [x] Policy field visibility matrix extracted:
  - `webui/src/pages/firewall/policyFieldStates.ts`
- [x] PolicyAdvanced table/chain context extracted:
  - `webui/src/pages/firewall/usePolicyAdvancedTableContext.ts`
- [x] Firewall data/schema polling and refresh orchestration extracted:
  - `webui/src/pages/firewall/useFirewallDataSync.ts`
- [x] Collections/tables aggregation, sorting and selection derivations extracted:
  - `webui/src/pages/firewall/useFirewallCollectionsTablesView.ts`
- [x] Policy rules list sorting/columns derivations extracted:
  - `webui/src/pages/firewall/usePolicyRulesView.ts`
- [x] Policy rule editor live runtime stats orchestration extracted:
  - `webui/src/pages/firewall/usePolicyRuleLiveStats.ts`
- [x] Page guard effects extracted (table hook/device, active policy table, Policy2 editor form guards):
  - `webui/src/pages/firewall/useFirewallPageGuards.ts`
- [x] Policy rule form context derivation extracted:
  - `webui/src/pages/firewall/usePolicyRuleFormContext.ts`
- [x] Shared policy rule live chart constants/helpers extracted:
  - `webui/src/pages/firewall/policyLiveChart.ts`
- [x] Selected rows derivation extracted:
  - `webui/src/pages/firewall/useFirewallSelections.ts`

### В работе

- [x] Вынести внутренние секции rule editor в подкомпоненты:
  - [x] Base
  - [x] Match
  - [x] Action/Stats
- [x] Вынести state-логику Policy2/Policy3 в хуки (`use*`).
  - [x] Phase 1: filters/usage/bindings/selection sync
  - [x] Phase 2 (part 1): editor open/edit + form state guardrails
  - [x] Phase 2 (part 2): data loading and save/delete orchestration
    - [x] data loading / refresh hooks
    - [x] rule save/delete/enable orchestration
    - [x] object save/delete orchestration

### Следом

- [ ] Собрать `PolicyAdvancedPage` контейнер из модулей.
  - [x] Step 1: extract Policy2/Policy3 main section into `PolicyAdvancedSection`
  - [~] Step 2: move remaining orchestration into dedicated hooks/container adapter
    - [x] object/rule binding + prefill orchestration moved to hook
    - [x] policy section context sync moved to hook
    - [x] assemble thin `PolicyAdvancedPage` adapter component
- [ ] Максимально заменить точечные ветвления `isPolicyV2Tab/isPolicyV3Tab` на capability-driven рендер.
  - [x] Rule editor sections switched to `family/caps` instead of `isPolicyV2Tab/isPolicyV3Tab`
  - [x] section switch + policy advanced data/sync hooks switched to capability-driven checks
  - [x] PolicyAdvanced family type narrowed to `bridge|netdev` across hooks/state
  - [x] object editor orchestration moved to dedicated hook; legacy tab conditionals centralized in `sections.ts`/`capabilities.ts`

## 4) Валидация и выкатка

- [ ] Локально после установки Node/npm:
  - [x] `npm run build`
  - [ ] e2e `policy2` (локально блокируется без `PLAYWRIGHT_API_KEY`)
  - [ ] e2e `policy3` (локально блокируется без `PLAYWRIGHT_API_KEY`)
- [x] Проверка на firewall-стенде.
  - [x] `tests/firewall-policy-v2-bridge.spec.ts` (28/28 including policy3 run bundle)
  - [x] `tests/firewall-policy-v3-netdev.spec.ts`
  - [x] `tests/firewall-policy-dnd.spec.ts` (фикс селектора вкладки `policy`, strict locator)
  - [x] `tests/firewall-tables.spec.ts`
  - [x] `tests/firewall-maps.spec.ts`
  - [x] `tests/firewall-counters-reset.spec.ts`
  - [x] `/firewall/apply` smoke (`HTTP 200`, `{\"ok\": true}`)
- [ ] Проверка на ipsec-стенде (без влияния на firewall поток).

## 5) Коммит-политика

- [ ] Отдельные commits/PR для:
  - infra/runtime
  - ui refactor
  - docs/tests
- [ ] Без смешивания firewall/ipsec изменений в одном changeset.
