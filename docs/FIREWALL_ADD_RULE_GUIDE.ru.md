# Руководство по Add Firewall Rule (RU)

Документ объясняет, как использовать меню **Firewall → Add Firewall Rule** в AWG Manager.

## 0) Policy, Policy2 и Policy3
- Вкладка `policy` по дизайну работает только с **inet**.
- Для bridge используйте **Firewall → policy2**.
- Для netdev ingress используйте **Firewall → policy3**.
- Текущий `policy2`: `Family=bridge` и включённые custom bridge-таблицы.
- Текущий `policy3`: `Family=netdev` и включённые custom netdev-таблицы (`filter` + `ingress` + `device`).
- В `policy v2` в списке `Table` показываются только включённые custom-таблицы выбранного семейства.
- В bridge `policy v2` поддерживаются: `ibrname/obrname`, `ether src/dst/type`, `vlan id`, `proto`, `sport`, `dport`, `ct state`, `meta pkttype`, `meta iifgroup`, `meta oifgroup`, `mark match`, `ct mark match`, `counter`, именованные `counter/limit/quota`, `limit rate`, расширенные параметры `log` и `action=queue` (`queue_num`, `queue_flags`).
- В netdev `policy3` поддерживаются ingress-safe L2/L3/L4 поля, anonymous `counter`, `limit rate`, расширенный `log`, `action=queue` и `action=fwd` с `fwd_to/fwd_dev/fwd_family`.
- Для bridge `reject` допускается только для цепочек с hook `input` или `prerouting`.
- Для bridge `vlan id` допустим диапазон `1..4095`.
- Для bridge `ether type` принимается Ethertype в hex/decimal: `0x0000..0xffff` или `0..65535`.
- В bridge MVP для логирования `log_group` и `log_flags` взаимно исключают друг друга.

## 1) Таблицы правил и назначение
- `filter`: разрешение/запрет трафика (`accept`, `drop`, `reject`, `jump`, `goto`, `return`)
- `nat`: трансляция адресов/портов (`dnat`, `snat`, `masquerade`, `redirect`)
- `raw`: ранняя обработка (сценарии типа `notrack`)
- `mangle`: работа с mark пакета/соединения

Сначала выбирайте таблицу, затем нажимайте **Add**.

## 2) Вкладка Base match
- `enabled`: если выключено, правило хранится в конфиге, но не применяется в runtime.
- `Chain`: цепочка, куда добавляется правило.
- `Source address` / `Destination address`: CIDR или адрес.
- `Protocol`: tcp/udp/icmp/icmpv6.
- `Source port` / `Destination port`: одиночный порт или диапазон.
- `Input interface` / `Output interface`: например `eth0`, `awg1`.
- `Connection state`: `new`, `established`, `related`, `invalid`, `untracked`.
- `Connection mark` / `Packet mark`: match по ct mark и packet mark (`0x1` или decimal).
- `Rate limit`: формат вида `10/second`.
- `User ID`: match по uid сокета (`meta skuid`), положительное целое.
- `Hour`: `HH:MM` или `HH:MM-HH:MM` (24-часовой формат).
- `DSCP`: `cs0..cs7`, `af11..af43`, `ef` или число `0..63`.

Подсказка: поля с `+` не активны, пока вы их не включите. Кнопка `-` отключает поле и убирает его из payload.

## 3) Вкладка Advanced match
Сейчас реально работают:
- `fib expression`
- `socket expression`
- `rt expression`
- `exthdr expression`
- `fib check`
- `socket match`
- `rt nexthop`
- `ipv6 extension headers`
- `raw expression` (только для raw)
- `nftrace` (только для raw)
- `notrack` advanced toggle (только для raw)
- `tcp flags`
- `icmp type` / `icmp code`
- `icmpv6 type` / `icmpv6 code`
- `meta length`
- `meta priority`
- `meta cpu`
- `meta pkttype`
- `meta iifgroup`
- `meta oifgroup`
- `ct status`
- `ct direction`
- `ct expiration`
- `ct helper`
- `ct label`
- `ct event`
- `ct original saddr` / `ct original daddr`
- `ct reply saddr` / `ct reply daddr`
- `vlan id`
- `ether src` / `ether dst` / `ether type`

### 3.1 Быстрый справочник по matcher-полям
Рабочие примеры:
- `tcp flags`: `syn,ack` (требует `proto=tcp`)
- `icmp type/code`: `echo-request` + `0` (требует `proto=icmp`)
- `icmpv6 type/code`: `echo-request` + `0` (требует `proto=icmpv6`)
- `meta length`: `64-1500`
- `meta priority`: `1:10`
- `meta cpu`: `0`
- `meta pkttype`: `host`
- `meta iifgroup`: `10`
- `meta oifgroup`: `20`
- `ct status`: `assured,confirmed`
- `ct direction`: `original`
- `ct expiration`: `30s`
- `ct helper`: `ftp`
- `ct label`: `0x1`
- `ct event`: `new,related`
- `ct original/reply saddr`: `10.8.0.2` / `10.8.0.1`
- `fib check`: `daddr . iif type`
- `socket match`: `transparent 1`
- `rt nexthop`: `10.0.0.1`
- `ipv6 exthdrs`: `frag`
- `vlan id`: `10`
- `ether type`: `0x0800`

Типовые ожидаемые ошибки:
- `tcp_flags` при протоколе не `tcp`.
- `icmp_type/icmp_code` при протоколе не `icmp`.
- `icmpv6_type/icmpv6_code` при протоколе не `icmpv6`.
- `vlan id` вне диапазона `1..4095`.
- `ether type` вне диапазона Ethertype.
- неверный `ct_direction` (должен быть `original` или `reply`).
- неверный формат `ct_expiration` (только `30s`, `1m`, `2h`, `1d` и т.п.).
- некорректные форматы mark/meta токенов.

## 4) Вкладка Action
- `Action`: вердикт или управляющее действие.
- `Target / to`: для jump/goto/nat параметров.
- `Reject type`: только для `action=reject`.
- `NAT options`: `random`, `fully-random`, `persistent`.
- `meta mark set`, `ct mark set`: установка mark.
- `log prefix`, `log level`: параметры логирования.

Bridge Policy v2 B2:
- `counter` и `counter_name` взаимоисключающие.
- `limit_rate` и `limit_name` взаимоисключающие.
- `ct_helper_set`, `ct_timeout_set`, `counter_name`, `limit_name`, `quota_name` требуют существующие именованные объекты в выбранной bridge-таблице.
- `ct_expectation_set` для bridge пока в статусе planned и временно отключен.
- Форма загружает именованные объекты через API `GET /firewall/objects?family=bridge&table=<table>` и показывает их в выпадающих списках.
- Expert expressions (`fib_check`, `socket_match`, `rt_nexthop`, `ipv6_exthdrs`) для bridge на текущем runtime в статусе planned/disabled.
- `dup_to/dup_dev` и `fwd_to/fwd_dev/fwd_family` на текущем runtime в bridge остаются planned.
- В редакторе добавлено явное пояснение по runtime-статусу `structured expressions`, `dup` и `fwd`, чтобы ограничения были видны до сохранения правила.
- Управление жизненным циклом именованных объектов доступно через API: `POST/PUT/DELETE /firewall/objects`.
- UI shortcut:
  - В `Policy v2 -> objects` кнопка `use` у строки объекта открывает `Add Bridge Rule` с автоподстановкой ссылки на этот объект.
  - Если выделить несколько объектов разных типов (`counter`, `limit`, `quota`, `ct_helper`, `ct_timeout`) и нажать `Use in rule`, форма откроется с несколькими привязками сразу.
  - Ограничение: по одному объекту на каждый `kind` в одном клике (дубликаты вида блокируются валидацией UI).
  - В `Edit Bridge Rule` есть блок `Linked objects (quick actions)`: `open` (переход к объекту во вкладку objects) и `unlink` (снять конкретную привязку).

Примеры объектов (зачем нужны):
1. `counter` для SSH:
- Object: `kind=counter`, `name=cnt_ssh_attempts`.
- Rule: `proto=tcp`, `dport=22`, `counter_name=cnt_ssh_attempts`, `action=accept`.
- Зачем: считать обращения к SSH и видеть нагрузку/подбор.

2. `limit` для DNS burst:
- Object: `kind=limit`, `name=lim_dns`, `rate=30/second`, `burst=100 packets`.
- Rule: `proto=udp`, `dport=53`, `limit_name=lim_dns`, `action=accept`.
- Зачем: сглаживать всплески DNS-трафика и защищаться от флуда.

## 5) Вкладка Statistics
- `counter`: включает nft-счётчик для правила.
- `counter name`: использование существующего именованного счётчика из выбранной bridge-таблицы.
- Runtime показывает packets/bytes и предпросмотр графика.
- График переключается между packets/sec и bytes/sec.

## 6) Валидации (важно)
- Некорректные комбинации table/chain/action отклоняются.
- Порты требуют контекст протокола tcp/udp.
- Поля TCP/ICMP/ICMPv6 match требуют соответствующий протокол.
- Неверные CIDR/port форматы отклоняются до apply.
- Небезопасный `jump` в базовые цепочки блокируется.

## 7) Практические примеры
1. Разрешить SSH:
- table `filter`, chain `input`, proto `tcp`, dport `22`, action `accept`.

2. DNAT для веба:
- table `nat`, chain `prerouting`, proto `tcp`, dport `443`, nat type `dnat`, to `10.8.0.2:8443`.

3. Маркировать VPN-forward:
- table `mangle`, chain `forward`, in interface `awg1`, action `accept`, `meta mark set=0x10`.

4. Доступ только в рабочие часы:
- table `filter`, chain `input`, proto `tcp`, dport `443`, `hour=08:00-18:00`, `action=accept`.

5. Ограничение по UID процесса:
- table `filter`, chain `output`, `user_id=1001`, proto `tcp`, dport `443`, action `accept`.

6. Match по conntrack tuple:
- table `filter`, chain `forward`, `ct original saddr=10.8.0.2`, `ct reply daddr=10.8.0.2`, action `accept`.

7. Пример L2-матча:
- table `filter`, chain `input`, `vlan id=10`, `ether type=0x0800`, action `accept`.

## 8) Диагностика
- Если apply падает, проверяйте:
  - текст ошибки `/firewall` API
  - `journalctl -u awg-manager-api.service -n 200`
  - `nft list ruleset`
- На VPS с малой памятью запускайте UI E2E с `PLAYWRIGHT_LOW_MEM=1`.
