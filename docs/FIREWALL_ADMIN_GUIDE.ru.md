# Firewall: практическая настройка через UI

Дата первого черновика: 2026-06-07

Этот документ предназначен для администратора, который настраивает firewall через UI AWG Manager. Здесь не требуется знание кода проекта. Цель руководства — пройти путь от простых правил до bridge/netdev сценариев, понять ограничения интерфейса и собрать материал для проверки удобства UI на стенде.

Проверенный статус: сценарии A-O из walkthrough testplan пройдены на стенде 2026-06-07. Это значит, что текущий учебник можно использовать как базовый пользовательский маршрут: от простого `filter` rule до advanced-сценариев `raw`, `mangle`, named objects, dynamic set и verdict map. Подробные результаты прохода находятся в `docs/FIREWALL_ADMIN_WALKTHROUGH_TESTPLAN.ru.md`.

## 0. Как пользоваться этим руководством

Руководство построено как учебник: каждую главу лучше проходить по порядку.

Порядок работы:

1. Прочитать короткое объяснение.
2. Выполнить шаги в UI.
3. Проверить результат в таблице правил, counters или списке объектов.
4. Отметить, где UI был непонятен, где поле было трудно найти, где не хватило подсказки.

Это не справочник nftables. Если нужен полный список возможностей и ограничений, используйте `docs/FIREWALL_CAPABILITY_MATRIX.ru.md`.

Для проверки удобства UI по этому учебнику используйте walkthrough-чеклист `docs/FIREWALL_ADMIN_WALKTHROUGH_TESTPLAN.ru.md`.

Для коротких объяснений конкретных полей формы Add Rule используйте справочник `docs/FIREWALL_ADD_RULE_FIELD_REFERENCE.ru.md`. Его пополняем по мере просмотра UI на стенде: поле, что означает, что принимает, примеры, текущий статус и UX gaps.

## 0.1. Что уже проверено и что считать roadmap

Уже проверено через UI:

- базовые правила `filter`: `accept`, `drop`, counters;
- `nat` masquerade и отображение NAT action в таблице;
- `collections`: address set, enable/disable;
- `objects`: named counter, named limit/quota, `ct_helper`, `ct_timeout`, `ct_expectation`;
- custom `bridge` и `netdev` contexts через `table builder`;
- `raw`: `notrack` и `nftrace`;
- `mangle`: packet mark и conntrack mark;
- guarded advanced actions: dynamic set statement и named verdict map statement;
- sanity check формы Add Rule по `inet/filter`, `inet/nat`, `inet/raw`, `inet/mangle`, custom `ip/ip6`, `bridge`, `netdev`.

Оставшиеся UX-наблюдения не блокируют прохождение учебника:

- optional поля открываются через маленькую кнопку `+`; пользователю может быть не сразу понятно, что так включаются дополнительные match fields;
- для `drop`/`reject` может понадобиться короткая safety-подсказка;
- в `collections` можно позже усилить объяснение `map` vs `vmap`;
- в `objects` можно позже усилить объяснение anonymous vs named limit/quota;
- cold refresh списка objects может быть медленным на стенде, но сохранение object уже не блокирует закрытие modal.

Roadmap, не текущий обязательный учебный маршрут:

- flowtables — дизайн зафиксирован отдельно в `docs/FIREWALL_FLOWTABLE_DESIGN.ru.md`;
- meter, tproxy, synproxy, JSON-native renderer;
- destructive/admin операции вроде `flush`, `rename`, live `insert/replace` по nft handle.

Практическое правило: если пользователь застрял в уже проверенном сценарии A-O, сначала фиксируем это как реальный UX gap в walkthrough testplan, и только потом меняем UI/backend точечно.

## 1. Главная идея Firewall UI

Firewall в AWG Manager управляет правилами nftables через несколько разделов:

- `policy` — основной раздел правил.
- `collections` — наборы адресов, портов, интерфейсов, maps и verdict maps.
- `objects` — именованные counter, limit, quota и conntrack objects.
- `table builder` — создание custom tables/chains для `inet`, `ip`, `ip6`, `bridge`, `netdev`.

Верхние вкладки внутри `policy`:

- `filter` — обычные правила разрешения/запрета.
- `nat` — NAT: masquerade, snat, dnat, redirect.
- `raw` — ранняя обработка, например `notrack` и `nftrace`.
- `mangle` — marks и изменение служебных признаков пакета/соединения.

Важно: `filter`, `nat`, `raw`, `mangle` — это быстрые built-in сценарии для обычного `inet` firewall. `bridge` и `netdev` не являются отдельными верхними вкладками. Они выбираются через custom table context.

## 2. Что такое family/table/chain

В nftables правило всегда живет в контексте:

- `family` — тип таблицы: `inet`, `ip`, `ip6`, `bridge`, `netdev`.
- `table` — таблица правил.
- `chain` — цепочка внутри таблицы.
- `chain type` — назначение цепочки, например `filter` или `nat`.
- `hook` — точка обработки пакета, например `input`, `forward`, `output`, `prerouting`, `postrouting`, `ingress`.
- `device` — сетевой интерфейс для `netdev ingress`.

Практически:

- Для обычного L3/L4 firewall чаще всего используйте built-in `filter`.
- Для NAT используйте built-in `nat`.
- Для bridge-фильтрации создавайте custom `bridge` table в `table builder`.
- Для netdev ingress-фильтрации создавайте custom `netdev` table с `hook=ingress` и обязательным `device`.

## 3. Быстрый старт: первое правило accept

Цель: добавить простое правило, которое разрешает TCP/443 на вход.

Шаги:

1. Откройте `Firewall`.
2. Перейдите в раздел `policy`.
3. Выберите built-in вкладку `filter`.
4. Нажмите `Add`.
5. На вкладке `Base` выберите `Chain = input`.
6. Укажите `Protocol = tcp`.
7. Укажите `Destination port = 443`.
8. На вкладке `Action` выберите `Action = accept`.
9. На вкладке `Stats` включите `counter`, если хотите видеть packets/bytes.
10. Сохраните правило.
11. Нажмите `Refresh` и проверьте, что правило появилось в таблице.

Ожидаемый результат:

- В таблице правил появилась строка с `chain=input`, `action=accept`, `protocol=tcp`, `destination port=443`.
- Если counter включен, в колонках packets/bytes со временем появятся значения.

UX-проверка:

- Было ли понятно, где находится `Add`?
- Было ли понятно, почему правило создается именно в `filter`?
- Были ли видны обязательные поля до сохранения?
- Если поле неактивно, есть ли понятная причина?

## 4. Policy: как читать таблицу правил

Таблица правил показывает активный контекст выбранной вкладки или custom table.

Типовые колонки:

- `Chain` — куда попадает правило.
- `Action` — что делает правило.
- `Protocol` — tcp/udp/icmp/icmpv6 или `any`.
- `Source address` — источник.
- `Destination port` — порт назначения.
- `Connection state` — conntrack state.
- `Packets` и `Bytes` — счетчики runtime.

Основные действия:

- `Add` — добавить правило.
- `Del` — удалить выбранное правило.
- `Disable` — оставить правило в конфигурации, но не применять.
- `Enable` — вернуть правило в runtime.
- `Reset counters` — сбросить счетчики.
- `Columns` — настроить видимость колонок.

Безопасная привычка: после любых изменений нажимайте `Refresh` и проверяйте, что таблица показывает ожидаемое состояние.

## 5. Add/Edit Rule: вкладки формы

Форма правила состоит из нескольких вкладок.

### Base

Здесь задается основной match:

- `Chain`
- `Source address`
- `Destination address`
- `Protocol`
- `Source port`
- `Destination port`
- `Input interface`
- `Output interface`
- `Connection state`

Для `bridge` появляются bridge-specific поля вроде `ibrname` и `obrname`. Для `netdev` набор полей зависит от `ingress` context.

### Advanced

Здесь находятся более тонкие условия:

- TCP flags.
- ICMP/ICMPv6 type/code.
- meta fields.
- conntrack fields.
- VLAN и ether fields.
- raw/expert expressions для поддержанных контекстов.

Если вы не уверены, лучше сначала не использовать Advanced. Большинство типовых правил делается через `Base` и `Action`.

### Action

Здесь выбирается действие:

- `accept`
- `drop`
- `reject`
- `jump`
- `goto`
- `return`
- NAT actions в NAT-контексте.
- `queue`
- `fwd` для `netdev`.
- dynamic set statement для поддержанного `inet` scope.
- named verdict map statement для поддержанного `inet` scope.

Если действие недоступно, причина обычно связана с выбранной family/table/chain.

### Stats

Здесь включаются счетчики:

- anonymous `counter`;
- named counter из раздела `objects`, если он доступен для текущего family/table.

## 6. Built-in filter/nat/raw/mangle

### filter

Используйте для обычных решений:

- разрешить порт;
- запретить IP;
- разрешить established/related;
- фильтровать input/output/forward.

Пример: запретить входящий TCP/25:

1. `policy -> filter -> Add`.
2. `Chain = input`.
3. `Protocol = tcp`.
4. `Destination port = 25`.
5. `Action = drop`.
6. Сохранить.

### nat

Используйте для NAT:

- `masquerade`;
- `snat`;
- `dnat`;
- `redirect`.

NAT доступен только там, где выбран подходящий NAT-контекст. Он не должен включаться для `bridge` и `netdev`.

### raw

Используйте осторожно. Здесь находятся ранние действия вроде `notrack` и `nftrace`.

### mangle

Используйте для mark-сценариев:

- `meta mark set`;
- `ct mark set`;
- match по mark.

## 7. Collections

`collections` нужны, чтобы не перечислять значения прямо в каждом правиле.

Типы collections:

- address set — список IP/CIDR;
- port set — список портов;
- interface set — список интерфейсов;
- map — сопоставление ключа и значения;
- vmap — сопоставление ключа и verdict.

Пример: создать набор доверенных адресов:

1. Откройте `Firewall -> collections`.
2. Создайте address set.
3. Назовите его, например `trusted_admins`.
4. Добавьте элементы: `10.66.1.10`, `10.66.1.11`.
5. Сохраните.
6. Используйте set в правилах там, где UI предлагает выбор collection или dynamic set statement.

UX-проверка:

- Понятно ли, где collection потом используется?
- Понятно ли отличие set/map/vmap?
- Понятно ли, что disabled collection не должна попасть в runtime?

## 8. Objects

`objects` — это именованные nftables objects, которые можно переиспользовать.

Основные типы:

- `counter` — именованный счетчик.
- `limit` — лимит скорости.
- `quota` — квота.
- `ct_helper` — conntrack helper.
- `ct_timeout` — conntrack timeout.
- `ct_expectation` — conntrack expectation.

Objects выбираются по `family/table`. Один и тот же object принадлежит конкретному context.

Пример: named counter для HTTPS:

1. Откройте `Firewall -> objects`.
2. Выберите `family=inet`, `table=filter` или нужный custom context.
3. Создайте object `kind=counter`, `name=cnt_https`.
4. Перейдите в `policy -> filter`.
5. Нажмите `Add`.
6. Создайте правило для `tcp/443`.
7. На вкладке `Stats` выберите named counter `cnt_https`.
8. Сохраните и проверьте counters.

Ограничения:

- Object bindings доступны для `inet`, `ip`, `ip6`, `bridge`.
- Для `netdev` object bindings намеренно выключены.
- `ct_expectation` доступен для `inet`, `ip`, `ip6`; для `bridge` и `netdev` выключен.

## 9. NAT: базовые сценарии

### Masquerade для исходящего трафика

Сценарий: клиенты из внутренней подсети выходят наружу через внешний интерфейс.

Шаги:

1. Откройте `policy -> nat`.
2. Нажмите `Add`.
3. Выберите chain, который соответствует postrouting.
4. Укажите source address внутренней подсети, например `10.66.1.0/24`.
5. На вкладке `Action` выберите `masquerade`.
6. Сохраните.

### DNAT для входящего сервиса

Сценарий: внешний TCP/443 перенаправить на внутренний `10.66.1.10:8443`.

Шаги:

1. Откройте `policy -> nat`.
2. Нажмите `Add`.
3. Выберите chain, который соответствует prerouting.
4. Укажите `Protocol = tcp`.
5. Укажите `Destination port = 443`.
6. На вкладке `Action` выберите `dnat`.
7. В поле target/to укажите `10.66.1.10:8443`.
8. Сохраните.

UX-проверка:

- UI понятно показывает, что NAT недоступен вне NAT-контекста?
- Понятно ли, где вводить target/to?
- Ошибка при неправильной chain/action комбинации объясняет проблему?

## 10. Bridge

Bridge используется для фильтрации L2/L3 трафика в bridge family.

Как начать:

1. Откройте `Firewall -> table builder`.
2. Создайте custom table с `family=bridge`.
3. Выберите `chain_type=filter`.
4. Выберите поддержанный hook, например `input`, `forward` или `prerouting`.
5. Сохраните table/chain.
6. Вернитесь в `policy`.
7. В custom table selector выберите созданную bridge table.
8. Нажмите `Add`.

Что меняется в форме:

- появляются bridge-specific interface fields;
- NAT actions недоступны;
- raw/expert опасные поля ограничены;
- object bindings доступны для supported object kinds;
- `ct_expectation` выключен.

Пример: запретить трафик с bridge-интерфейса:

1. Выберите bridge custom table.
2. Нажмите `Add`.
3. На `Base` укажите bridge input interface field.
4. На `Action` выберите `drop`.
5. Сохраните.

## 11. Netdev

Netdev используется для ранней фильтрации на уровне устройства, сейчас безопасный рабочий путь — `ingress`.

Как начать:

1. Откройте `Firewall -> table builder`.
2. Создайте custom table с `family=netdev`.
3. Выберите `chain_type=filter`.
4. Выберите `hook=ingress`.
5. Укажите обязательный `device`, например `eth0`.
6. Сохраните table/chain.
7. Вернитесь в `policy`.
8. В custom table selector выберите созданную netdev table.
9. Нажмите `Add`.

Что важно:

- `device` обязателен.
- `egress` на текущем стенде не включаем: runtime его не поддерживает.
- NAT недоступен.
- Object bindings отключены.
- `fwd` доступен только для netdev.

Пример: drop входящего TCP/23 на устройстве:

1. Выберите netdev custom table.
2. Нажмите `Add`.
3. `Protocol = tcp`.
4. `Destination port = 23`.
5. `Action = drop`.
6. Сохраните.

## 12. Advanced действия

Используйте advanced действия только когда базовых правил недостаточно.

Поддержанные и важные сценарии:

- `log` — логировать matching packets.
- `reject` — отклонять вместо silent drop.
- `queue` — отправить packets в userspace queue.
- `fwd` — netdev-only forwarding.
- dynamic set statement — ограниченный `inet` сценарий для `add @set` / `update @set`.
- vmap statement — ограниченный `inet` сценарий с named verdict map.
- raw/expert expression — escape hatch, но с family/table ограничениями.

Правило безопасности: если UI отключает advanced поле, не пытайтесь обходить это raw expression без понимания runtime-ограничений.

## 13. Проверка результата

В UI:

- нажмите `Refresh`;
- проверьте строку правила;
- проверьте `Packets` и `Bytes`;
- используйте `Reset counters`, если нужно начать измерение заново;
- проверьте, что disabled правило не влияет на runtime.

При ошибке:

- прочитайте текст ошибки в UI;
- проверьте, не выбрана ли несовместимая family/table/chain/action комбинация;
- проверьте формат IP/CIDR/port;
- проверьте, существует ли object/collection, на который ссылается правило.

## 14. Учебные задания для проверки UI

Эти задания нужны не только пользователю, но и нам: по ним можно пройти стенд и понять, насколько интерфейс удобен.

### Задание 1. Разрешить HTTPS

- Context: `policy -> filter`.
- Rule: `input`, `tcp`, `dport=443`, `accept`, `counter`.
- Проверка: правило видно в таблице, counters отображаются.

### Задание 2. Заблокировать SMTP

- Context: `policy -> filter`.
- Rule: `input`, `tcp`, `dport=25`, `drop`.
- Проверка: правило видно, action понятен.

### Задание 3. Создать NAT masquerade

- Context: `policy -> nat`.
- Rule: source subnet, `masquerade`.
- Проверка: NAT action доступен только в правильном context.

### Задание 4. Создать address collection

- Context: `collections`.
- Collection: `trusted_admins`, элементы `10.66.1.10`, `10.66.1.11`.
- Проверка: collection сохраняется, редактируется, disabled state понятен.

### Задание 5. Создать named counter и привязать к правилу

- Context: `objects`, затем `policy`.
- Object: `counter cnt_https`.
- Rule: HTTPS accept + named counter.
- Проверка: object виден в selector, counter можно сбросить.

### Задание 6. Создать bridge rule

- Context: `table builder`, затем `policy custom table`.
- Table: `family=bridge`, `chain_type=filter`.
- Rule: bridge-specific match + `drop`.
- Проверка: NAT не показывается, bridge fields доступны.

### Задание 7. Создать netdev ingress rule

- Context: `table builder`, затем `policy custom table`.
- Table: `family=netdev`, `hook=ingress`, `device=<iface>`.
- Rule: `tcp dport=23 drop`.
- Проверка: `device` обязателен, object bindings выключены, `fwd` доступен.

### Задание 8. Проверить why-disabled подсказки

- Открыть bridge/netdev Add Rule.
- Найти NAT/object/dynamic set/vmap ограничения.
- Проверить, понятно ли объяснение.

## 15. Advanced сценарии второго уровня

Этот блок нужен после базового прохождения A-H. Здесь мы проверяем не “все nftables сразу”, а самые важные продвинутые возможности, которые уже видны в unified Policy UI.

Правило прохождения:

- сначала пробуем пройти сценарий как обычный админ через UI;
- если сценарий проходит, фиксируем это в walkthrough testplan;
- если сценарий не проходит из-за непонятного UI, заводим UX gap;
- если backend отклоняет корректную настройку или UI разрешает невозможное, исправляем только этот реальный разрыв;
- не добавляем новые большие возможности в рамках walkthrough без отдельного backend-first плана.

### I. Raw table: `notrack` / `nftrace`

Цель: проверить ранние raw-действия без ухода в raw expression.

Путь:

1. Открыть `policy -> raw`.
2. Нажать `Add`.
3. Выбрать raw chain, например `prerouting` или `output`.
4. Задать простой match, например source address или `Protocol = tcp`.
5. На вкладке `Advanced` включить `notrack` или `nftrace`.
6. Сохранить правило.
7. Проверить, что правило видно в `raw` и не смешивается с `filter/nat/mangle`.

Проверить UX:

- понятно ли, что `notrack` отключает conntrack для matching packets;
- понятно ли, что `nftrace` нужен для диагностики;
- видно ли, почему эти поля не доступны вне `raw`.

### J. Mangle: `mark` / `ct mark`

Цель: проверить packet mark и conntrack mark в `mangle`.

Путь:

1. Открыть `policy -> mangle`.
2. Нажать `Add`.
3. Выбрать подходящую chain.
4. Задать match, например `Protocol = tcp`.
5. На вкладке `Action` включить `meta mark set`, например `0x10`.
6. Отдельным правилом проверить `ct mark set`, например `0x20`.
7. Проверить match по `mark` / `ct mark`, если он нужен сценарию.

Проверить UX:

- понятно ли отличие packet mark от conntrack mark;
- понятно ли, что mark-сценарии живут в `mangle`, а не в `filter`;
- есть ли защита от неправильного формата mark.

### K. Named limit/quota object

Цель: проверить reusable rate/volume controls через `objects`.

Путь:

1. Открыть `objects`.
2. Выбрать нужный `family/table`, например `inet/filter`.
3. Создать `limit` object с понятной скоростью, например `10/second`.
4. Создать `quota` object с понятным лимитом, например `over 100 mbytes`.
5. Перейти в `policy -> filter`.
6. Добавить правило и привязать named limit/quota object.
7. Проверить, что object виден в selector и правило сохраняется.

Проверить UX:

- понятно ли, что object принадлежит выбранной table;
- понятно ли отличие anonymous limit/quota от named object;
- видно ли, что netdev rule bindings отключены намеренно.

### L. `ct helper` / `ct timeout` / `ct expectation`

Цель: проверить conntrack objects и family-ограничения.

Путь:

1. Открыть `objects`.
2. В `inet/ip/ip6` context создать `ct_helper`, например FTP helper для TCP.
3. Создать `ct_timeout` для TCP policy.
4. Создать `ct_expectation`, если выбран `inet/ip/ip6`.
5. Перейти в соответствующий `policy` context.
6. В `Add Rule -> Action` привязать helper/timeout/expectation object.
7. Проверить, что `ct_expectation` не предлагается для `bridge/netdev`.

Проверить UX:

- понятно ли, какие поля обязательны для каждого ct object;
- понятно ли, почему `ct_expectation` ограничен `inet/ip/ip6`;
- не выглядит ли отсутствие ct object binding в netdev как баг.

### M. Dynamic set statement

Цель: проверить runtime-safe `add @set` / `update @set` в текущем ограниченном scope.

Путь:

1. Открыть `collections`.
2. Создать dynamic-capable address или port set для `inet`.
3. Убедиться, что у collection заданы safety limits: `timeout` и `size`.
4. Перейти в `policy -> filter`.
5. Открыть `Add Rule -> Action`.
6. Включить dynamic set statement.
7. Выбрать `add` или `update`, target set и поддержанное expression.
8. Сохранить правило.

Проверить UX:

- понятно ли, что dynamic set statement сейчас только для `inet`;
- понятно ли, почему нужны `timeout` и `size`;
- понятно ли, что bridge/netdev/ip/ip6 scope пока отключен.

### N. Verdict map statement

Цель: проверить named verdict map в `inet` scope.

Путь:

1. Открыть `collections`.
2. Создать enabled `vmap` для `inet` с protocol-key entries, например `tcp : accept`, `udp : drop`.
3. Перейти в `policy -> filter`.
4. Открыть `Add Rule -> Action`.
5. Включить `Verdict map`.
6. Выбрать созданную vmap collection.
7. Сохранить правило.

Проверить UX:

- понятно ли, что первый scope — `inet` + `meta l4proto`;
- понятно ли, почему verdict map не комбинируется с NAT/dynamic set statement;
- понятно ли отличие обычной `map` от `vmap`.

### O. Advanced fields inventory sanity check

Цель: пройти форму Add Rule по всем context и проверить, что поля появляются только там, где могут работать.

Контексты:

- `inet/filter`;
- `inet/nat`;
- `inet/raw`;
- `inet/mangle`;
- custom `ip` / `ip6`;
- custom `bridge`;
- custom `netdev`.

Что проверяем:

- raw-only поля не доступны вне `raw`;
- mangle mark setters не смешиваются с raw-only debug controls;
- NAT actions доступны только в NAT context;
- bridge показывает bridge-specific поля и не показывает NAT;
- netdev показывает ingress/fwd path и не показывает object bindings;
- dynamic set и verdict map объясняют `inet`-only scope;
- ct expectation объясняет `inet/ip/ip6` scope.

Результат этого сценария — не одно правило, а список реальных UX gaps, если пользователь где-то не понимает, почему поле видно или скрыто.

## 16. Лист UX-наблюдений

При прохождении учебника записывайте:

- На каком шаге пользователь задумался.
- Какое поле было трудно найти.
- Какой label непонятен.
- Где нужна подсказка.
- Где UI разрешает выбрать то, что потом backend отклоняет.
- Где backend ошибка понятная, а где выглядит технической.
- Где не хватает preview итогового правила.

Шаблон заметки:

```text
Глава:
Шаг:
Что хотел сделать пользователь:
Что было непонятно:
Ожидаемое улучшение:
Критичность: low / medium / high
```

## 17. Что пока не входит в учебник

Пока не включаем как обязательный пользовательский путь:

- `insert/replace` по live nft handle;
- `flush` ruleset/table/chain;
- `rename` chain/table/object;
- flowtables (дизайн зафиксирован в `docs/FIREWALL_FLOWTABLE_DESIGN.ru.md`, но UI/API пока не включены);
- meter;
- tproxy;
- synproxy;
- JSON-native renderer.

Эти темы остаются в roadmap и требуют отдельного проектирования, потому что могут усложнить UI или изменить ожидания пользователя.
