# Руководство по Add Firewall Rule (RU)

Документ объясняет, как использовать меню **Firewall → Add Firewall Rule** в AWG Manager.

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

Важно:
- `ct_helper_set`, `ct_timeout_set`, `ct_expectation_set` сейчас намеренно отклоняются (graceful reject), пока не включены ct objects.

## 5) Вкладка Statistics
- `counter`: включает nft-счётчик для правила.
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
