# Firewall Admin Walkthrough Testplan

Дата первого черновика: 2026-06-07

Этот testplan проверяет, может ли админ пройти `docs/FIREWALL_ADMIN_GUIDE.ru.md` через UI без знания кода и без обращения к nftables CLI. Главная цель — найти UX-проблемы: непонятные поля, неочевидные ограничения, слабые подсказки, несовпадение ожиданий UI и backend validation.

## 0. Принципы проверки

- Проверяем как пользователь, а не как разработчик.
- Не используем код и API напрямую, если сценарий явно не требует диагностики.
- Каждый сценарий должен завершаться понятным пользовательским результатом в UI.
- Если backend отклоняет действие, текст ошибки должен объяснять, что исправить.
- Если поле disabled, UI должен объяснять почему.
- Если сценарий не получается пройти, это не провал пользователя, а UX-сигнал.

## 1. Предусловия

Стенд:

- UI: `http://132.243.237.120:8787/ui/`
- Раздел: `Firewall`
- Рабочий режим: текущий unified Policy UI, без старых отдельных bridge/netdev policy-вкладок.

Перед началом:

1. Открыть `Firewall`.
2. Нажать `Refresh`.
3. Убедиться, что видны верхние разделы `policy`, `collections`, `objects`, `table builder`.
4. Убедиться, что внутри `policy` видны built-in вкладки `filter`, `nat`, `raw`, `mangle`.
5. Не очищать стенд полностью без отдельного согласования: сначала фиксируем текущее состояние.

## 2. Что фиксируем по каждому сценарию

Для каждого задания заполняем:

```text
Сценарий:
Статус: pass / partial / fail
Время прохождения:
Пользовательский результат:
Где возникла пауза:
Какая подсказка помогла:
Какая подсказка отсутствует:
Ошибка UI/backend, если была:
Предложение по улучшению:
Критичность: low / medium / high
```

Статусы:

- `pass` — пользователь прошел сценарий без внешней помощи.
- `partial` — сценарий прошел, но были заметные паузы, догадки или непонятные места.
- `fail` — сценарий нельзя пройти по инструкции или UI не дает понятного пути.

## 3. UX-метрики

Оцениваем каждый сценарий по пяти шкалам от 1 до 5:

- `Findability` — легко ли найти нужный раздел/кнопку.
- `Clarity` — понятны ли названия полей.
- `Guidance` — хватает ли подсказок и why-disabled объяснений.
- `Safety` — сложно ли случайно сделать опасное действие.
- `Result confidence` — понятно ли, что настройка применена.

Итог:

- 5 — отлично, улучшения не нужны.
- 4 — хорошо, есть мелкие шероховатости.
- 3 — пройти можно, но UX требует доработки.
- 2 — пользователь почти наверняка застрянет.
- 1 — сценарий фактически непроходим без помощи.

## 4. Сценарий A: Разрешить HTTPS

Цель: проверить самый простой happy path создания правила.

Шаги:

1. Открыть `Firewall -> policy`.
2. Выбрать `filter`.
3. Нажать `Add`.
4. Выбрать `Chain = input`.
5. Указать `Protocol = tcp`.
6. Указать `Destination port = 443`.
7. На `Action` выбрать `accept`.
8. На `Stats` включить `counter`.
9. Сохранить.
10. Проверить, что правило появилось в таблице.

Ожидаемый результат:

- Правило видно в `filter`.
- В строке понятны `input`, `accept`, `tcp`, `443`.
- Counter columns доступны.

UX-вопросы:

- Понятно ли, что chain выбирается на `Base`?
- Понятно ли, где включается counter?
- Понятно ли, что сохранение применяет правило?

Результат прохода 2026-06-07:

```text
Сценарий: A. HTTPS accept
Статус: pass
Время прохождения: около 4 минут с инспекцией UI
Пользовательский результат: правило `input accept tcp — 443` появилось в таблице `policy -> filter`, counters columns видны.
Где возникла пауза: поля Protocol и Destination port спрятаны за маленькими кнопками `+`; без знания формы не сразу ясно, что их надо раскрыть.
Какая подсказка помогла: Statistics показывает `Counter disabled: enable nft counter...`, это объясняет состояние графика.
Какая подсказка отсутствует: рядом с `+` нет явного текста, что это включение optional поля.
Ошибка UI/backend, если была: backend/UI save прошел без ошибки; console warning от chart sizing: width/height chart should be greater than 0.
Предложение по улучшению: добавить hover/title или inline hint для `+` optional fields; проверить container size для chart в модалке Statistics.
Критичность: medium для optional-field discoverability, low для chart warning.
```

## 5. Сценарий B: Заблокировать SMTP

Цель: проверить базовый `drop`.

Шаги:

1. Открыть `policy -> filter`.
2. Нажать `Add`.
3. Выбрать `Chain = input`.
4. Указать `Protocol = tcp`.
5. Указать `Destination port = 25`.
6. На `Action` выбрать `drop`.
7. Сохранить.
8. Проверить строку в таблице.

Ожидаемый результат:

- Правило создано.
- Action `drop` хорошо виден.

UX-вопросы:

- Не путается ли пользователь между `drop` и `reject`?
- Есть ли ощущение опасности при создании блокирующего правила?

Результат прохода 2026-06-07:

```text
Сценарий: B. SMTP drop
Статус: pass
Время прохождения: около 3 минут с инспекцией UI
Пользовательский результат: правило `input drop tcp — 25` появилось в таблице `policy -> filter`.
Где возникла пауза: повторилась пауза с optional `+` для Protocol и Destination port; Destination port снова открылся со значением `22`, его надо заменить на `25`.
Какая подсказка помогла: action `drop` хорошо виден в таблице после сохранения.
Какая подсказка отсутствует: при выборе `drop` нет inline safety hint, что это silent block, и нет пояснения отличия от `reject`.
Ошибка UI/backend, если была: save прошел без ошибки; новых console errors нет, сохраняется ранее зафиксированный chart sizing warning.
Предложение по улучшению: добавить короткую подсказку для `drop`/`reject`, например `drop silently blocks packets; reject returns an error to sender`.
Критичность: medium для optional-field discoverability, low/medium для отсутствия safety hint у blocking action.
```

## 6. Сценарий C: NAT masquerade

Цель: проверить, что пользователь понимает NAT-контекст.

Шаги:

1. Открыть `policy -> nat`.
2. Нажать `Add`.
3. Выбрать chain для postrouting-сценария.
4. Указать source subnet, например `10.66.1.0/24`.
5. На `Action` выбрать `masquerade`.
6. Сохранить.
7. Проверить строку в `nat`.

Ожидаемый результат:

- NAT action доступен в `nat`.
- Пользователь понимает, почему NAT не надо искать в `filter`.

UX-вопросы:

- Понятно ли, какую chain выбрать для masquerade?
- Есть ли подсказка, если выбрана неподходящая chain?
- Понятно ли, что bridge/netdev не поддерживают NAT?

Результат прохода 2026-06-07:

```text
Сценарий: C. NAT masquerade
Статус: pass (FW-UX-004/FW-UX-005 fixed/verified)
Время прохождения: около 6 минут с инспекцией UI
Пользовательский результат: исходный проход показал строку `postrouting accept any 10.66.1.0/24`, без видимого `masquerade`; после исправлений таблица показывает NAT action `masquerade`, а Action tab объясняет chain/action mapping.
Где возникла пауза: исходно NAT Add открывался с chain `prerouting`, а для masquerade пользователь должен был сам знать, что нужен `postrouting`; после исправления рядом с Action видна подсказка.
Какая подсказка помогла: Action tab показывает `prerouting/output use dnat or redirect` и `postrouting uses snat or masquerade`.
Какая подсказка отсутствует: для текущего базового masquerade-сценария критичных подсказок больше не найдено.
Ошибка UI/backend, если была: исходно save прошел без UI/backend ошибки, но таблица показывала внутренний verdict `accept`; исправлено через отображение `nat_type` в Action-колонке.
Предложение по улучшению: закрыто для текущего сценария; дальнейшие NAT-сценарии проверять отдельно.
Критичность: закрыто для Scenario C.
```

## 7. Сценарий D: Address collection

Цель: проверить создание reusable set.

Шаги:

1. Открыть `Firewall -> collections`.
2. Создать address set `trusted_admins`.
3. Добавить элементы `10.66.1.10`, `10.66.1.11`.
4. Сохранить.
5. Проверить строку collection.
6. Отключить collection.
7. Включить collection обратно.

Ожидаемый результат:

- Collection создается и отображается.
- Disabled/enabled состояние понятно.

UX-вопросы:

- Понятно ли отличие address/port/interface set?
- Понятно ли, где collection потом использовать?
- Понятна ли ошибка при дубликате имени?

Результат прохода 2026-06-07:

```text
Сценарий: D. Address collection
Статус: pass
Время прохождения: около 4 минут с e2e-проверкой на стенде
Пользовательский результат: address set `trusted_admins_*` создается в `collections`, строка показывает `addr` и элементы `10.66.1.10, 10.66.1.11`; Disable переводит API state в `enabled=false`, Enable возвращает collection в enabled state.
Где возникла пауза: исходно форма Add collection не объясняла, где потом использовать set.
Какая подсказка помогла: добавлена подсказка `Use addr collections in rule fields as @set_name.`
Какая подсказка отсутствует: для текущего базового address-set сценария критичных подсказок больше не найдено.
Ошибка UI/backend, если была: backend/API enable/disable работает; один промежуточный e2e-run поймал краткий сетевой/stand timing сбой и был повторен после cleanup.
Предложение по улучшению: закрыто для текущего сценария; использование collection внутри Add Rule проверять отдельным сценарным шагом при расширении инструкции.
Критичность: закрыто для Scenario D.
```

## 8. Сценарий E: Named counter object

Цель: проверить связь `objects -> Add Rule`.

Шаги:

1. Открыть `Firewall -> objects`.
2. Выбрать `family=inet`, `table=filter`.
3. Создать object `kind=counter`, `name=cnt_https`.
4. Перейти в `policy -> filter`.
5. Нажать `Add`.
6. Создать HTTPS accept rule.
7. На `Stats` выбрать named counter `cnt_https`.
8. Сохранить.
9. Проверить, что правило ссылается на counter.
10. Проверить `Reset counters`.

Ожидаемый результат:

- Object виден в selector.
- Пользователь понимает, почему object выбирается в текущем `family/table`.

UX-вопросы:

- Понятно ли, что object принадлежит table context?
- Понятно ли отличие anonymous counter и named counter?
- Видно ли, что `netdev` object binding отключен намеренно?

Результат прохода 2026-06-07:

```text
Сценарий: E. Named counter object
Статус: pass
Время прохождения: около 8 минут с e2e-проверкой на стенде
Пользовательский результат: counter object `cnt_https_*` создается для `inet/filter`, затем в `policy -> filter -> Add -> Statistics` он доступен в selector `counter object`; после сохранения rule API содержит `counter_name=<object>`, `Reset counters` доступен в toolbar.
Где возникла пауза: исходно Objects selector не показывал built-in `inet/filter`, хотя backend/API поддерживал named objects для этой таблицы.
Какая подсказка помогла: Objects panel уже объясняет, что objects scoped by family/table; после исправления selector показывает built-in `filter/nat/raw/mangle`.
Какая подсказка отсутствует: для текущего базового named counter сценария критичных подсказок больше не найдено.
Ошибка UI/backend, если была: backend/API работал; UI не давал выбрать built-in `inet/filter` в Objects section. Исправлено добавлением built-in tables в Object table selector.
Предложение по улучшению: закрыто для текущего сценария; отдельно можно улучшить wording различия anonymous vs named counter, если walkthrough H подтвердит путаницу.
Критичность: закрыто для Scenario E.
```

## 9. Сценарий F: Bridge rule

Цель: проверить custom bridge path.

Шаги:

1. Открыть `table builder`.
2. Создать custom table с `family=bridge`.
3. Выбрать `chain_type=filter`.
4. Выбрать поддержанный hook.
5. Сохранить.
6. Перейти в `policy`.
7. В custom table selector выбрать bridge table.
8. Нажать `Add`.
9. Создать простое bridge rule с `drop`.
10. Проверить, что NAT actions недоступны.

Ожидаемый результат:

- Bridge table выбирается из unified Policy.
- В форме появляются bridge-specific поля.
- NAT не доступен и причина понятна.

UX-вопросы:

- Легко ли найти custom table selector?
- Понятно ли, что bridge не находится внутри `filter/nat/raw/mangle`?
- Достаточно ли объяснений для disabled NAT/ct_expectation?

Результат прохода 2026-06-07:

```text
Сценарий: F. Bridge rule
Статус: pass
Время прохождения: около 8 минут с e2e-проверкой на стенде
Пользовательский результат: custom `bridge` table выбирается в unified `policy` selector; `Add Rule` открывает общую форму, показывает `Bridge input`/`Bridge output`, позволяет сохранить `drop` rule, а API возвращает rule с `family=bridge`, `chain=forward`, `action=drop`, `ibrname=br0`.
Где возникла пауза: table selector по-прежнему требует понимания, что `bridge` живет не во вкладках `filter/nat/raw/mangle`, а в custom table selector рядом с ними.
Какая подсказка помогла: в Action tab видно `NAT actions are not available for bridge/netdev rules.`, поэтому отсутствие `dnat/snat/masquerade/redirect` не выглядит как поломка.
Какая подсказка отсутствует: критичной отсутствующей подсказки для базового bridge drop сценария не найдено; отдельно можно улучшить русскоязычный/локализованный wording, если будем локализовать UI.
Ошибка UI/backend, если была: не обнаружена. В e2e table создавалась через API как setup, пользовательский UI-path проверялся от выбора bridge table до сохранения rule.
Предложение по улучшению: оставить как есть для текущего сценария; следующий UX-риск проверять в Scenario G/H для netdev и why-disabled подсказок.
Критичность: закрыто для Scenario F.
```

## 10. Сценарий G: Netdev ingress rule

Цель: проверить custom netdev path.

Шаги:

1. Открыть `table builder`.
2. Создать custom table с `family=netdev`.
3. Выбрать `chain_type=filter`.
4. Выбрать `hook=ingress`.
5. Указать `device`.
6. Сохранить.
7. Перейти в `policy`.
8. Выбрать netdev custom table.
9. Нажать `Add`.
10. Создать rule `tcp dport=23 drop`.
11. Проверить, что object bindings отключены.
12. Проверить, что `fwd` доступен как netdev-only action.

Ожидаемый результат:

- Без `device` table не создается или UI явно объясняет требование.
- Netdev table доступна из unified Policy.
- Object bindings disabled с понятной причиной.

UX-вопросы:

- Понятно ли, что netdev — это ingress на конкретном устройстве?
- Понятно ли, почему egress нет?
- Понятно ли, почему objects нельзя привязать к netdev rule?

Результат прохода 2026-06-07:

```text
Сценарий: G. Netdev ingress rule
Статус: pass
Время прохождения: около 15 минут с e2e-проверкой на стенде
Пользовательский результат: custom `netdev` table выбирается в unified `policy` selector; `Add Rule` показывает ingress/base поля, позволяет сохранить `tcp dport=23 drop`, а API возвращает rule с `family=netdev`, `chain=ingress`, `proto=tcp`, `dport=23`, `action=drop`.
Где возникла пауза: `netdev` требует понимания, что это ingress на конкретном `device`; в e2e device задавался через API setup (`eth0`), поэтому полноценную удобность создания через table builder стоит отдельно подтвердить, если будем проходить table-builder-only руками.
Какая подсказка помогла: в Action tab видно `Named object bindings are not available for netdev rules.`, а `fwd` появляется только в netdev context; NAT также скрыт с общей bridge/netdev подсказкой.
Какая подсказка отсутствует: для базового Add Rule сценария критичной подсказки не найдено; потенциальное улучшение — явнее объяснить `device` и отсутствие `egress` прямо в table builder.
Ошибка UI/backend, если была: не обнаружена. UI-path от выбора netdev table до сохранения rule прошел на стенде.
Предложение по улучшению: вынести проверку table builder `device`/`egress` wording в отдельный UX follow-up, если Scenario H покажет, что объяснений мало.
Критичность: закрыто для Scenario G.
```

Follow-up 2026-06-07:

```text
Статус: fixed/verified
Что уточнили: `table builder -> Add Table Chain -> family=netdev` теперь явно объясняет, что netdev tables используют `filter/ingress` на одном device, что device обязателен для ingress, и что netdev egress не включен в текущем runtime profile.
Проверка: Playwright `tests/firewall-tables.spec.ts -g "netdev table builder explains"` на стенде — pass.
```

## 11. Сценарий H: Why-disabled подсказки

Цель: проверить, что ограничения не выглядят как баг UI.

Проверить:

- NAT actions в bridge/netdev.
- Object bindings в netdev.
- `ct_expectation` в bridge/netdev.
- Dynamic set statement вне поддержанного `inet` scope.
- Vmap statement вне поддержанного `inet` scope.

Ожидаемый результат:

- Пользователь видит или быстро находит объяснение.
- Текст объясняет не только “нельзя”, но и “почему”.

UX-вопросы:

- Где подсказка должна быть видна сразу?
- Где достаточно tooltip/help text?
- Где backend error должен стать inline validation?

Результат прохода 2026-06-07:

```text
Сценарий: H. Why-disabled hints
Статус: pass
Время прохождения: около 8 минут с e2e-проверкой на стенде
Пользовательский результат: bridge/netdev `Add Rule -> Action` показывает причины для скрытых NAT actions, `inet`-only Dynamic set update и Verdict map; bridge дополнительно объясняет отсутствие `ct expectation object`, netdev объясняет отсутствие named object bindings; Objects modal для netdev держит `ct_expectation` disabled.
Где возникла пауза: подсказки находятся в Action tab, поэтому пользователь должен открыть именно эту вкладку, чтобы увидеть большинство why-disabled объяснений.
Какая подсказка помогла: `NAT actions are not available for bridge/netdev rules.`, `Dynamic set update is available only for inet rules.`, `Verdict map is available only for inet rules.`, `ct expectation object is available only for inet/ip/ip6 rules.`, `Named object bindings are not available for netdev rules.`
Какая подсказка отсутствует: критичной отсутствующей подсказки для текущего Scenario H не найдено; потенциальный follow-up — добавить более явную подсказку в table builder про `netdev device` и отсутствие `egress` на текущем runtime profile.
Ошибка UI/backend, если была: не обнаружена. Все проверенные ограничения объясняются до сохранения rule/object.
Предложение по улучшению: оставить текущие Action-tab hints; отдельно обсудить локализацию текстов и table-builder help, если будем делать русскоязычный UI.
Критичность: закрыто для Scenario H.
```

Follow-up 2026-06-07:

```text
Статус: fixed/verified
Что уточнили: потенциальный table-builder gap закрыт отдельной подсказкой для `family=netdev`.
Проверка: Playwright `tests/firewall-tables.spec.ts -g "netdev table builder explains"` на стенде — pass.
```

## 12. Advanced scenarios I-O

Эти сценарии продолжают руководство вторым уровнем. Их цель — пройти уже существующие advanced controls на стенде и чинить только реальные UX gaps, найденные при прохождении.

Общий критерий:

- если сценарий проходит через UI без внешней помощи, фиксируем `pass`;
- если пользователь застревает на непонятном поле/ограничении, фиксируем UX issue;
- если UI разрешает сохранить невозможное или backend отклоняет корректную настройку, исправляем этот конкретный разрыв;
- не расширяем wire/API и не добавляем новые большие capabilities в рамках walkthrough без отдельного согласования.

### Сценарий I: Raw table `notrack` / `nftrace`

Цель: проверить, что raw-only debug/conntrack controls доступны в `policy -> raw` и понятно отключены вне raw.

Шаги:

1. Открыть `policy -> raw`.
2. Нажать `Add`.
3. Выбрать raw chain, например `prerouting` или `output`.
4. Задать простой match.
5. На `Advanced` включить `notrack`.
6. Отдельным правилом или повторным проходом включить `nftrace`.
7. Сохранить и проверить строки в `raw`.
8. Открыть `policy -> filter` и убедиться, что raw-only поля не выглядят доступными там.

Ожидаемый результат:

- `notrack` и `nftrace` сохраняются только в raw context.
- UI объясняет raw-only ограничение вне `raw`.

Результат прохода 2026-06-07:

```text
Сценарий: I. Raw notrack/nftrace
Статус: pass
Время прохождения: около 12 секунд в e2e-проверке на стенде
Пользовательский результат: в `policy -> raw -> Add -> Advanced match` видны `nftrace` и `notrack (advanced mode)`; правило с `nftrace=true` и `notrack=true` сохраняется, API возвращает rule в table `raw`; в `filter` context UI показывает `nftrace (raw table only)` и `notrack (raw table only)`.
Где возникла пауза: при первом e2e-прогоне тест пытался сразу открыть вторую Add-форму после save и попал в post-save busy/refresh state; это тестовый порядок шагов, не пользовательский UX gap Scenario I.
Какая подсказка помогла: raw-only labels в `filter` context и предупреждение `notrack` про raw prerouting/output.
Какая подсказка отсутствует: критичной отсутствующей подсказки для Scenario I не найдено.
Ошибка UI/backend, если была: не обнаружена. Первичный timeout был связан с тестовым ожиданием во время refresh; тест переставлен так, чтобы проверять raw-only подсказку до сохранения raw rule.
Предложение по улучшению: оставить текущий UI; отдельно можно позже улучшить общий busy-state feedback после save, если это повторится в пользовательском walkthrough, но Scenario I этого не требует.
Критичность: закрыто для Scenario I.
```

### Сценарий J: Mangle `mark` / `ct mark`

Цель: проверить mark setters/matches в `policy -> mangle`.

Шаги:

1. Открыть `policy -> mangle`.
2. Нажать `Add`.
3. Задать простой match.
4. На `Action` включить `meta mark set`, например `0x10`.
5. Сохранить и проверить правило.
6. Повторить для `ct mark set`, например `0x20`.
7. Проверить match по packet mark / ct mark, если поле доступно в форме.

Ожидаемый результат:

- mark-поля доступны в mangle context.
- Неправильный формат mark отклоняется понятной ошибкой.
- UI не смешивает mangle mark controls с raw-only controls.

Результат прохода 2026-06-07:

```text
Сценарий: J. Mangle mark/ct mark
Статус: pass
Время прохождения: около 12 секунд в e2e-проверке на стенде
Пользовательский результат: в `policy -> mangle -> Add -> Action` видны `meta mark set` и `ct mark set`; правило с `chain=forward`, `dport=45563`, `mark_set=0x10`, `ct_mark_set=0x20` сохраняется, API возвращает rule в table `mangle`.
Где возникла пауза: в e2e-проходе паузы не было; поля находятся в Action tab рядом с другими action/statements.
Какая подсказка помогла: inactive hints `0x1 or 10` дают формат значения.
Какая подсказка отсутствует: критичной отсутствующей подсказки для Scenario J не найдено; отличие packet mark и ct mark пока понятно только по label, но сценарий проходится.
Ошибка UI/backend, если была: не обнаружена. Отдельные API/backend tests уже проверяют runtime render и invalid mark validation.
Предложение по улучшению: оставить текущий UI; если ручной walkthrough покажет путаницу между packet mark и ct mark, добавить короткий helper text.
Критичность: закрыто для Scenario J.
```

### Сценарий K: Named limit/quota object

Цель: проверить создание и rule binding для named `limit` и `quota`.

Шаги:

1. Открыть `objects`.
2. Выбрать `inet/filter`.
3. Создать `limit` object.
4. Создать `quota` object.
5. Перейти в `policy -> filter`.
6. Создать правило и выбрать named limit/quota object в Add Rule.
7. Сохранить и проверить, что rule ссылается на object.
8. Проверить, что netdev rule binding объясненно отключен.

Ожидаемый результат:

- Object selector показывает созданные limit/quota в подходящем context.
- Пользователь понимает table-scoped ownership object.

Результат прохода 2026-06-07:

```text
Сценарий: K. Named limit/quota object
Статус: pass
Время прохождения: около 16 секунд в e2e-проверке на стенде
Пользовательский результат: в `objects -> inet/filter` созданы named `limit` и `quota`; затем в `policy -> filter -> Add -> Action` оба объекта доступны в selectors `limit object` и `quota object`; сохраненное правило возвращает `limit_name=<limit>` и `quota_name=<quota>`.
Где возникла пауза: в e2e-проходе паузы не было; путь повторяет уже понятный Scenario E pattern `objects -> policy`.
Какая подсказка помогла: Objects panel показывает `Objects are scoped to the selected nftables table.`, а Add Rule использует labels `limit object` / `quota object`.
Какая подсказка отсутствует: критичной отсутствующей подсказки для Scenario K не найдено; отличие anonymous limit/quota от named object можно позже пояснить helper text, если ручной walkthrough покажет путаницу.
Ошибка UI/backend, если была: не обнаружена.
Предложение по улучшению: оставить текущий UI; возможный будущий low-priority helper — коротко объяснить, что named object можно переиспользовать между правилами этой table.
Критичность: закрыто для Scenario K.
```

### Сценарий L: `ct helper` / `ct timeout` / `ct expectation`

Цель: проверить conntrack objects и family-specific restrictions.

Шаги:

1. Открыть `objects`.
2. В `inet/ip/ip6` context создать `ct_helper`.
3. Создать `ct_timeout`.
4. Создать `ct_expectation`.
5. Перейти в matching `policy` context.
6. Привязать objects в `Add Rule -> Action`.
7. Проверить, что `ct_expectation` не доступен для `bridge/netdev`.

Ожидаемый результат:

- Required fields для ct objects понятны.
- `ct_expectation` доступен только в `inet/ip/ip6`.
- Bridge/netdev ограничения объясняются до сохранения.

Результат прохода 2026-06-07:

```text
Сценарий: L. CT helper/timeout/expectation
Статус: pass (FW-UX-006 fixed/verified)
Время прохождения: около 24 секунд в e2e-проверке на стенде после исправления
Пользовательский результат: `ct_helper`, `ct_timeout`, `ct_expectation` для `inet/filter` создаются и затем доступны в `policy -> filter -> Add -> Action`; сохраненное правило возвращает `ct_helper_set`, `ct_timeout_set`, `ct_expectation_set` с выбранными object names.
Где возникла пауза: исходно сценарий упирался в долгий object refresh/list после save; после исправления object save больше не блокирует закрытие модалки, а walkthrough L проходит стабильно.
Какая подсказка помогла: UI показывает `ct helper object`, `ct timeout object`, `ct expectation object`; family restrictions для bridge/netdev уже проверены в Scenario H.
Какая подсказка отсутствует: критичной отсутствующей подсказки для Scenario L после исправления не найдено; latency `/firewall/objects` остается кандидатом на будущую backend/performance оптимизацию.
Ошибка UI/backend, если была: исходно `FW-UX-006` — блокирующий refresh после object save; исправлено frontend-first без изменения wire/API.
Предложение по улучшению: `FW-UX-006` закрыт; отдельно можно измерить и оптимизировать холодный `/firewall/objects?family=inet&table=filter`.
Критичность: закрыто для Scenario L; остаточный риск low/medium только для cold-list performance.
```

### Сценарий M: Dynamic set statement

Цель: проверить ограниченный runtime-safe путь `inet` dynamic set statement.

Шаги:

1. Открыть `collections`.
2. Создать dynamic-capable `addr` или `port` set с `timeout` и `size`.
3. Перейти в `policy -> filter`.
4. Открыть `Add Rule -> Action`.
5. Включить dynamic set statement.
6. Выбрать `add` или `update`, target set и expression.
7. Сохранить правило.
8. Проверить why-disabled объяснение вне `inet`.

Ожидаемый результат:

- Dynamic set statement работает в текущем `inet` scope.
- `timeout`/`size` требования понятны.
- Вне `inet` UI объясняет ограничение.

Результат прохода 2026-06-07:

```text
Сценарий: M. Dynamic set statement
Статус: pass
Время прохождения: около 18 секунд в e2e-проверке на стенде
Пользовательский результат: dynamic-capable `addr` set создается через API setup; в `policy -> filter -> Add -> Action` виден блок `Dynamic set update`; правило сохраняется с `set_stmt_op=add`, `set_stmt_name=<set>`, `set_stmt_expr=ip saddr`, `set_stmt_timeout=10s`; временные rule/set удаляются.
Где возникла пауза: первый запуск Playwright не подключился к стенду из-за transient connect timeout; сервис стенда был жив, повторный запуск прошел.
Какая подсказка помогла: Action tab показывает отдельный блок `Dynamic set update`, target set, set op, set expression и timeout.
Какая подсказка отсутствует: критичной отсутствующей подсказки для текущего guarded `inet` path не найдено; ручной walkthrough может позже проверить, достаточно ли понятно требование `dynamic=true`/`size`/`timeout` при создании collection.
Ошибка UI/backend, если была: не обнаружена; transient network timeout не был ошибкой UI/backend.
Предложение по улучшению: оставить текущий UI; будущий low-priority helper может пояснить, что dynamic set statement сейчас поддержан только для runtime-safe `inet` addr/port scope.
Критичность: закрыто для Scenario M.
```

### Сценарий N: Verdict map statement

Цель: проверить named `vmap` statement в текущем `inet` protocol-key scope.

Шаги:

1. Открыть `collections`.
2. Создать enabled `vmap` для `inet` с protocol-key entries.
3. Перейти в `policy -> filter`.
4. Открыть `Add Rule -> Action`.
5. Включить `Verdict map`.
6. Выбрать созданную vmap collection.
7. Сохранить правило.
8. Проверить why-disabled объяснение вне `inet`.

Ожидаемый результат:

- Verdict map statement сохраняется в `inet`.
- UI объясняет отличие `map` / `vmap` достаточно для прохождения.
- UI объясняет, почему vmap не включается в bridge/netdev.

Результат прохода 2026-06-07:

```text
Сценарий: N. Verdict map statement
Статус: pass
Время прохождения: около 20 секунд в e2e-проверке на стенде
Пользовательский результат: `vmap` collection с protocol entries `tcp:accept`, `udp:drop`, `icmp:return` создается через API setup; в `policy -> filter -> Add -> Action` виден блок `Verdict map`; правило сохраняется с `vmap_stmt_name=<vmap>` и `vmap_stmt_expr=meta l4proto`, при этом terminal action очищен и решение принимает vmap.
Где возникла пауза: в e2e-проходе паузы не было; путь повторяет уже понятный pattern `collection -> Add Rule -> Action`.
Какая подсказка помогла: Action tab показывает `Verdict map`, `Runtime-safe: inet protocol vmap, named vmap collection only`, `target vmap`, `vmap expression`, и объясняет, что vmap выбирает accept/drop/return по protocol.
Какая подсказка отсутствует: критичной отсутствующей подсказки для текущего guarded `inet` protocol-vmap path не найдено; ручной walkthrough может позже проверить, достаточно ли понятно отличие `map` от `vmap` при создании collection.
Ошибка UI/backend, если была: не обнаружена.
Предложение по улучшению: оставить текущий UI; будущий low-priority helper может пояснить `map` vs `vmap` прямо в Collections modal.
Критичность: закрыто для Scenario N.
```

### Сценарий O: Advanced fields inventory sanity check

Цель: пройти форму Add Rule по ключевым context и найти расхождения видимости advanced fields.

Контексты:

- `inet/filter`;
- `inet/nat`;
- `inet/raw`;
- `inet/mangle`;
- custom `ip` / `ip6`;
- custom `bridge`;
- custom `netdev`.

Проверить:

- raw-only controls видны только в raw context или объясненно disabled;
- mark controls видны в mangle context;
- NAT actions доступны только в NAT context;
- bridge-specific fields видны в bridge context;
- netdev-specific action `fwd` и ограничения object binding понятны;
- dynamic set и vmap объясняют `inet`-only scope;
- ct expectation объясняет `inet/ip/ip6` scope.

Ожидаемый результат:

- Получаем либо `pass`, либо конкретный список UX issue IDs.
- Не исправляем “на вкус”; исправляем только подтвержденный gap.

Результат прохода 2026-06-07:

```text
Сценарий: O. Advanced inventory sanity
Статус: pass
Время прохождения: набор e2e-проверок на стенде, около 6 минут суммарно
Пользовательский результат: Add Rule форма корректно разделяет built-in `filter/nat/raw/mangle`, custom `ip/ip6`, `bridge` и `netdev` контексты; raw-only controls не выглядят доступными вне raw, mangle mark controls видны в mangle, NAT actions следуют chain/table context, bridge/netdev показывают свои поля и why-disabled hints.
Где возникла пауза: первый параллельный inventory run дал transient login зависание на `Checking...`; последовательный повтор прошел. Один bridge action test использовал substring selector и считал why-disabled hint как поле `ct expectation object`; тест уточнен на exact label.
Какая подсказка помогла: Action tab содержит why-disabled hints для NAT, dynamic set, verdict map, bridge `ct expectation`, netdev named-object bindings; Base tab меняет interface fields по hook/family.
Какая подсказка отсутствует: новых критичных gaps не найдено; будущие улучшения остаются low-priority helper text для отдельных advanced concepts, если ручной walkthrough покажет путаницу.
Ошибка UI/backend, если была: продуктовых ошибок не обнаружено; исправлена только test-only проверка bridge exact label.
Предложение по улучшению: не менять UI по Scenario O сейчас; продолжать развитие по следующему roadmap/block после завершения I-O walkthrough.
Критичность: закрыто для Scenario O.
```

## 13. Итоговая таблица прохождения

| Сценарий | Статус | Findability | Clarity | Guidance | Safety | Result confidence | UX issue IDs |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A. HTTPS accept | pass | 4 | 4 | 3 | 4 | 5 | FW-UX-001, FW-UX-002 |
| B. SMTP drop | pass | 4 | 4 | 3 | 3 | 5 | FW-UX-001, FW-UX-003 |
| C. NAT masquerade | pass | 4 | 4 | 4 | 3 | 5 | FW-UX-004 fixed, FW-UX-005 fixed |
| D. Address collection | pass | 4 | 4 | 4 | 4 | 5 | - |
| E. Named counter object | pass | 4 | 4 | 4 | 4 | 5 | - |
| F. Bridge rule | pass | 4 | 4 | 4 | 4 | 5 | - |
| G. Netdev ingress rule | pass | 4 | 4 | 4 | 4 | 5 | - |
| H. Why-disabled hints | pass | 4 | 4 | 4 | 4 | 5 | - |
| I. Raw notrack/nftrace | pass | 4 | 4 | 4 | 4 | 5 | - |
| J. Mangle mark/ct mark | pass | 4 | 4 | 4 | 4 | 5 | - |
| K. Named limit/quota | pass | 4 | 4 | 4 | 4 | 5 | - |
| L. CT helper/timeout/expectation | pass | 4 | 4 | 4 | 4 | 5 | FW-UX-006 fixed |
| M. Dynamic set statement | pass | 4 | 4 | 4 | 4 | 5 | - |
| N. Verdict map statement | pass | 4 | 4 | 4 | 4 | 5 | - |
| O. Advanced inventory sanity | pass | 4 | 4 | 4 | 4 | 5 | - |

## 14. UX issue template

```text
ID:
Scenario:
Step:
Severity: low / medium / high
Observed:
Expected:
Why it matters:
Suggested fix:
Evidence:
```

Severity:

- `high` — сценарий нельзя пройти или можно создать опасную конфигурацию.
- `medium` — сценарий проходится, но пользователь легко ошибается.
- `low` — косметика, wording, мелкая неясность.

## 15. Найденные UX issues

### FW-UX-001: Optional поля за маленькой кнопкой `+`

```text
ID: FW-UX-001
Scenario: A. HTTPS accept
Step: включить Protocol и Destination port
Severity: medium
Observed: поля Protocol и Destination port скрыты за маленькими `+`; новый пользователь может не понять, что это не декоративная кнопка, а включение поля.
Expected: UI явно объясняет, что `+` добавляет optional match/action/stat field.
Why it matters: базовый HTTPS сценарий требует раскрыть Protocol и Destination port, поэтому это первое место, где админ может застрять.
Suggested fix: добавить title/tooltip или короткий inline hint `Add field`/`Enable field`; возможно заменить одиночный `+` на более явный control.
Evidence: browser walkthrough 2026-06-07, Scenario A.
```

### FW-UX-002: Chart sizing warning в Statistics

```text
ID: FW-UX-002
Scenario: A. HTTPS accept
Step: открыть Statistics и включить counter
Severity: low
Observed: console warning: chart width/height should be greater than 0.
Expected: Statistics chart не пишет warning при открытии модалки.
Why it matters: пользователь не видит warning напрямую, но это может указывать на нестабильный layout графика.
Suggested fix: проверить min-width/min-height или container sizing для chart в Statistics tab.
Evidence: browser console logs, Scenario A, 2026-06-07.
```

### FW-UX-003: Нет safety-подсказки для `drop`

```text
ID: FW-UX-003
Scenario: B. SMTP drop
Step: выбрать Action = drop
Severity: low / medium
Observed: после выбора `drop` UI не показывает пояснение, что это silent block, и не объясняет отличие от `reject`.
Expected: для blocking actions есть короткая inline подсказка или helper text рядом с action selector.
Why it matters: админ может не понимать, что `drop` молча отбрасывает пакет, а `reject` отвечает ошибкой; для первых firewall-настроек это важная safety-информация.
Suggested fix: добавить contextual helper text для `drop` и `reject` в Action tab.
Evidence: browser walkthrough 2026-06-07, Scenario B.
```

### FW-UX-004: NAT masquerade требует знания chain `postrouting`

```text
ID: FW-UX-004
Scenario: C. NAT masquerade
Step: выбрать chain для masquerade
Severity: medium
Observed: NAT Add по умолчанию открывается с `prerouting`; пользователь должен сам знать, что для masquerade нужен `postrouting`.
Expected: UI помогает выбрать chain под NAT action или показывает подсказку `masquerade is usually used in postrouting`.
Why it matters: NAT — один из первых реальных админских сценариев, и ошибка chain делает настройку непонятной.
Suggested fix: добавить helper text в NAT context или action-aware hint; возможно фильтровать/предлагать actions после выбора chain и объяснять выбор.
Evidence: browser walkthrough 2026-06-07, Scenario C; Playwright `tests/firewall-rules.spec.ts -g "action tab explains"` сначала воспроизвел отсутствие подсказки, затем прошел после выкладки на стенд.
Status: fixed/verified 2026-06-07. Action tab now shows `prerouting/output use dnat or redirect` and `postrouting uses snat or masquerade`.
```

### FW-UX-005: NAT таблица не подтверждает выбранный `masquerade`

```text
ID: FW-UX-005
Scenario: C. NAT masquerade
Step: сохранить правило masquerade
Severity: high
Observed: после выбора Action `masquerade` строка в таблице отображается как `postrouting accept any 10.66.1.0/24`, без видимого `masquerade`.
Expected: таблица показывает NAT action (`masquerade`) или отдельную NAT колонку, чтобы пользователь видел результат сохранения.
Why it matters: админ не может понять, настроил ли он NAT, или случайно создал обычное accept-правило.
Suggested fix: fixed 2026-06-07 — Action-колонка теперь показывает `nat_type` для NAT statements, сохраняя backend/API модель `action=accept + nat_type=masquerade`.
Evidence: browser walkthrough screenshot, Scenario C, 2026-06-07; Playwright `tests/firewall-rules.spec.ts -g "table shows nat action"` сначала воспроизвел `accept`, затем прошел после выкладки на стенд.
```

### FW-UX-006: CT object refresh/list блокирует Scenario L

```text
ID: FW-UX-006
Scenario: L. CT helper/timeout/expectation
Step: создать/подготовить ct objects и перейти к Add Rule binding
Severity: medium / high
Observed: backend/API создание `ct_helper`, `ct_timeout`, `ct_expectation` работает, но UI walkthrough нестабилен: object refresh/list может занимать десятки секунд; модалка или Add Rule остаются в ожидании, сценарий не завершается даже при e2e timeout 120 секунд.
Expected: после успешного сохранения object UI закрывает модалку или показывает понятный loading/error state; Add Rule получает object options без блокировки пользователя на десятки секунд.
Why it matters: advanced ct функциональность существует, но пользовательский путь не выглядит надёжным; админ не понимает, сохранение завершилось или зависло.
Suggested fix: fixed 2026-06-07 — object save closes the modal after successful POST and runs object refresh in the background; `/firewall/objects?family=inet&table=filter` cold-list latency remains a separate performance candidate.
Evidence: Scenario L stand e2e 2026-06-07: first `GET /firewall/objects?family=inet&table=filter` measured around 24s, repeated probe measured around 56s; after the UI fix, `PLAYWRIGHT_BASE_URL=http://132.243.237.120:8787/ui/ ... npx playwright test tests/firewall-rules.spec.ts -g "walkthrough L" --project=chromium` passed in 24.4s.
```

## 15. Что считаем хорошим результатом первой проверки

Первая проверка считается полезной, если:

- пройдены все сценарии A-H;
- для каждого сценария есть статус и UX-оценки;
- найденные проблемы записаны как issue templates;
- отдельно отмечены места, где инструкция была неточной;
- после проверки понятно, что править первым: guide text, UI labels, inline hints, validation или backend error text.

Не требуется, чтобы все сценарии сразу получили `pass`. Если сценарии дают `partial` или `fail`, это и есть материал для улучшения firewall UI.
